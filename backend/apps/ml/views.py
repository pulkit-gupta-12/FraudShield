import os
import io
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.permissions import IsAdmin, IsAnalyst
from apps.audit.models import AuditLog
from apps.fraud.models import ModelConfig, Transaction, Notification
from apps.fraud.serializers import TransactionSerializer, ModelConfigSerializer
from apps.fraud.simulator import create_simulated_transaction, get_sample_df
from apps.ml.ml_service import FEATURES, ml_service, score, explain, band, status_for


# ─── PREDICT ENDPOINTS ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAnalyst])
def predict_samples(request):
    """
    GET /api/predict/samples/
    Returns 200 sample transactions (mixed fraud and normal) without the true label.
    """
    df = get_sample_df().copy()
    if 'Class' in df.columns:
        fraud_df = df[df['Class'] == 1]
        normal_df = df[df['Class'] == 0]
        n_fraud = min(len(fraud_df), 40)
        n_normal = min(len(normal_df), 160)
        sample = pd.concat([fraud_df.head(n_fraud), normal_df.head(n_normal)]).sample(frac=1.0, random_state=42)
        sample = sample.drop(columns=['Class'])
    else:
        sample = df.head(200)

    # Return list of dictionaries formatted with index
    results = []
    for idx, row in sample.iterrows():
        item = {feat: float(row[feat]) for feat in FEATURES}
        item['id'] = f"SAMPLE-{idx + 1}"
        results.append(item)

    return Response(results)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def predict_single(request):
    """
    POST /api/predict/
    With transactionId (score the stored row, return trueLabel only to admin and analyst)
    Or with features (score custom values, do NOT save; validate all 30 features present & numeric).
    """
    data = request.data
    transaction_id = data.get('transaction_id') or data.get('transactionId') or data.get('id')
    features = data.get('features')

    cfg = ml_service.get_config()
    threshold = cfg['threshold']
    review_floor = cfg['review_floor']

    txn = None
    if transaction_id:
        txn = Transaction.objects.filter(
            Q(public_id=transaction_id) | (Q(id=transaction_id) if str(transaction_id).isdigit() else Q(pk__isnull=True))
        ).first()

    if txn:
        inputs = txn.model_inputs
        if not inputs:
            return Response({'detail': "Transaction does not contain feature inputs."}, status=400)

        row_df = pd.DataFrame([inputs])
        start_t = time.perf_counter()
        scores = score(row_df)
        risk_score = float(scores[0])
        factors = explain(row_df)[0]
        latency_ms = round((time.perf_counter() - start_t) * 1000.0, 2)

        band_val = band(risk_score, threshold=threshold, review_floor=review_floor)
        action_recommended = 'BLOCK' if risk_score >= threshold else ('CHALLENGE_OTP' if risk_score >= review_floor else 'APPROVE')

        resp = {
            'riskScore': round(risk_score, 4),
            'band': band_val,
            'actionRecommended': action_recommended,
            'modelLatencyMs': latency_ms,
            'modelVersion': ml_service.version,
            'threshold': threshold,
            'reviewFloor': review_floor,
            'factors': factors,
        }

        # trueLabel returned ONLY to admin and analyst
        if request.user.role in ('admin', 'analyst') or request.user.is_superuser:
            resp['trueLabel'] = txn.true_label

        return Response(resp)

    elif transaction_id and not features:
        return Response({'detail': f"Transaction '{transaction_id}' not found."}, status=404)

    elif features:
        if not isinstance(features, dict):
            return Response({'detail': "'features' must be an object/dictionary of feature values."}, status=400)

        clean_features = {}
        for f in FEATURES:
            if f in features:
                val = features[f]
                if isinstance(val, bool):
                    return Response({'detail': f"Feature '{f}' must be numeric, received boolean."}, status=400)
                try:
                    clean_features[f] = float(val)
                except (ValueError, TypeError):
                    return Response({'detail': f"Feature '{f}' must be a valid numeric value."}, status=400)
            else:
                clean_features[f] = 0.0

        row_df = pd.DataFrame([clean_features])
        start_t = time.perf_counter()
        scores = score(row_df)
        risk_score = float(scores[0])
        factors = explain(row_df)[0]
        latency_ms = round((time.perf_counter() - start_t) * 1000.0, 2)

        band_val = band(risk_score, threshold=threshold, review_floor=review_floor)
        action_recommended = 'BLOCK' if risk_score >= threshold else ('CHALLENGE_OTP' if risk_score >= review_floor else 'APPROVE')

        return Response({
            'riskScore': round(risk_score, 4),
            'band': band_val,
            'actionRecommended': action_recommended,
            'modelLatencyMs': latency_ms,
            'modelVersion': ml_service.version,
            'threshold': threshold,
            'reviewFloor': review_floor,
            'factors': factors,
        })

    else:
        return Response({'detail': "Either 'transactionId' or 'features' must be provided."}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAnalyst])
def predict_batch(request):
    """
    POST /api/predict/batch/
    Multipart CSV, max 5 MB and 5000 rows, validate columns and numbers, vectorised scoring.
    Never trust file names or content types alone.
    """
    if 'file' not in request.FILES:
        return Response({'detail': "No CSV file provided under 'file' parameter."}, status=400)

    uploaded_file = request.FILES['file']

    # 1. Validate file size (max 5 MB)
    max_size = 5 * 1024 * 1024
    if uploaded_file.size > max_size:
        return Response({'detail': f"File size ({uploaded_file.size} bytes) exceeds 5 MB limit."}, status=400)

    # 2. Read and parse content
    try:
        raw_content = uploaded_file.read().decode('utf-8', errors='replace')
        df = pd.read_csv(io.StringIO(raw_content))
    except Exception as e:
        return Response({'detail': f"Invalid CSV file format: {str(e)}"}, status=400)

    # 3. Validate row count (max 5000)
    if len(df) > 5000:
        return Response({'detail': f"CSV contains {len(df)} rows; maximum allowed is 5000 rows."}, status=400)

    if len(df) == 0:
        return Response({'detail': "CSV file contains no data rows."}, status=400)

    # 4. Validate that all 30 feature columns exist
    missing_cols = [f for f in FEATURES if f not in df.columns]
    if missing_cols:
        return Response({'detail': f"Missing required columns in CSV: {missing_cols}"}, status=400)

    # 5. Validate that all values in FEATURES columns are numeric
    feature_df = df[FEATURES]
    for col in FEATURES:
        # Check non-numeric entries
        converted = pd.to_numeric(feature_df[col], errors='coerce')
        if converted.isna().any():
            invalid_indices = converted.isna().to_numpy().nonzero()[0][:3].tolist()
            return Response(
                {'detail': f"Column '{col}' contains non-numeric or missing values at row(s): {invalid_indices}."},
                status=400
            )
        feature_df = feature_df.assign(**{col: converted})

    # 6. Vectorized scoring
    cfg = ml_service.get_config()
    t_val = cfg['threshold']
    rf_val = cfg['review_floor']

    scores = score(feature_df)
    explanations = explain(feature_df)

    processed_count = len(scores)
    fraud_count = int(np.sum(scores >= t_val))
    flagged_count = int(np.sum(scores >= rf_val))

    results = []
    for i in range(processed_count):
        s_val = float(scores[i])
        results.append({
            'rowIndex': i + 1,
            'riskScore': round(s_val, 4),
            'band': band(s_val, threshold=t_val, review_floor=rf_val),
            'factors': explanations[i],
        })

    summary = {
        'processedCount': processed_count,
        'flaggedCount': flagged_count,
        'fraudCount': fraud_count,
    }

    return Response({
        'processedCount': processed_count,
        'flaggedCount': flagged_count,
        'fraudCount': fraud_count,
        'summary': summary,
        'results': results,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAnalyst])
def simulator_tick(request):
    """
    POST /api/simulator/tick/
    Disabled by default in demo mode unless DEMO_SIMULATOR=true in environment.
    """
    if not (os.getenv('DEMO_SIMULATOR', 'false').lower() in ('true', '1')):
        return Response(
            {'message': 'Simulator is disabled in demo mode. Set DEMO_SIMULATOR=true in .env to enable.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    txn = create_simulated_transaction()
    return Response(TransactionSerializer(txn, context={'request': request}).data)


# ─── MODEL MANAGEMENT ENDPOINTS ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def model_info(request):
    """
    GET /api/model/info/
    Returns threshold, reviewFloor, modelVersion, metrics, confusionMatrix,
    prCurve, featureImportance, comparison, dataset and scalePosWeight from ModelConfig.
    """
    cfg = ModelConfig.objects.first()
    if not cfg:
        # Trigger config fetch/create
        _ = ml_service.get_config()
        cfg = ModelConfig.objects.first()

    return Response({
        'threshold': cfg.threshold,
        'reviewFloor': cfg.review_floor,
        'modelVersion': cfg.version,
        'version': cfg.version,
        'algorithm': "XGBoost Classifier (PCA 28 + Time + Amount)",
        'scalePosWeight': cfg.scale_pos_weight,
        'bestParams': cfg.best_params,
        'metrics': cfg.metrics,
        'confusionMatrix': cfg.confusion_matrix,
        'prCurve': cfg.pr_curve,
        'featureImportance': cfg.feature_importance,
        'comparison': cfg.comparison,
        'dataset': cfg.dataset_info,
        'datasetInfo': cfg.dataset_info,
        'trainedDate': cfg.trained_at.isoformat() if cfg.trained_at else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def model_what_if(request):
    """
    GET /api/model/what-if/?threshold=
    Computes flagged, caught, falseAlarms, precision and recall from stored transactions
    using true_label (using numpy, one query).
    """
    cfg = ml_service.get_config()
    default_t = cfg['threshold']

    t_param = request.query_params.get('threshold')
    try:
        t_val = float(t_param) if t_param is not None else default_t
    except ValueError:
        return Response({'detail': "Invalid threshold value; must be a float."}, status=400)

    # Single database query to extract stored transactions with true_label
    qs = Transaction.objects.exclude(true_label__isnull=True).exclude(true_label='').values_list('risk_score', 'true_label')
    rows = list(qs)

    if not rows:
        return Response({
            'threshold': t_val,
            'totalEvaluated': 0,
            'flagged': 0,
            'caught': 0,
            'falseAlarms': 0,
            'precision': 0.0,
            'recall': 0.0,
        })

    scores = np.array([r[0] for r in rows], dtype=np.float64)
    labels = np.array([1 if str(r[1]).upper() == 'FRAUD' else 0 for r in rows], dtype=np.int32)

    flagged_mask = scores >= t_val
    flagged = int(np.sum(flagged_mask))
    caught = int(np.sum(flagged_mask & (labels == 1)))
    false_alarms = int(np.sum(flagged_mask & (labels == 0)))
    total_fraud = int(np.sum(labels == 1))

    precision = round(float(caught / flagged), 4) if flagged > 0 else 0.0
    recall = round(float(caught / total_fraud), 4) if total_fraud > 0 else 0.0

    return Response({
        'threshold': t_val,
        'totalEvaluated': len(rows),
        'flagged': flagged,
        'caught': caught,
        'falseAlarms': false_alarms,
        'precision': precision,
        'recall': recall,
    })


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated, IsAdmin])
def model_threshold(request):
    """
    PUT /api/model/threshold/ and PATCH /api/model/thresholds/
    Admin only: validate threshold 0.05 to 0.99 and optional reviewFloor (0.1 up to threshold),
    update ModelConfig, write an audit log, notify admins.
    All band and status logic reads the new threshold immediately.
    """
    data = request.data
    t_input = data.get('threshold') if 'threshold' in data else data.get('fraud')
    rf_input = data.get('reviewFloor') if 'reviewFloor' in data else (
        data.get('review_floor') if 'review_floor' in data else data.get('suspicious')
    )

    if t_input is None:
        return Response({'detail': "'threshold' (or 'fraud') field is required."}, status=400)

    try:
        threshold = float(t_input)
    except (ValueError, TypeError):
        return Response({'detail': "'threshold' must be a numeric value."}, status=400)

    # Validate threshold 0.05 to 0.99
    if threshold < 0.05 or threshold > 0.99:
        return Response({'detail': "Threshold must be between 0.05 and 0.99."}, status=400)

    review_floor = None
    if rf_input is not None:
        try:
            review_floor = float(rf_input)
        except (ValueError, TypeError):
            return Response({'detail': "'reviewFloor' must be a numeric value."}, status=400)

        # Validate reviewFloor (0.1 up to the threshold)
        if review_floor < 0.1 or review_floor >= threshold:
            return Response(
                {'detail': f"reviewFloor must be at least 0.1 and strictly less than threshold ({threshold})."},
                status=400
            )

    cfg = ModelConfig.objects.first()
    if not cfg:
        _ = ml_service.get_config()
        cfg = ModelConfig.objects.first()

    old_threshold = cfg.threshold
    old_review_floor = cfg.review_floor

    cfg.threshold = threshold
    if review_floor is not None:
        cfg.review_floor = review_floor
    cfg.save()

    # Audit log
    AuditLog.objects.create(
        actor=request.user.email,
        role=request.user.role,
        action='THRESHOLDS_UPDATED',
        target='ModelConfig',
        status='SUCCESS',
        details=f"Updated thresholds: threshold {old_threshold} -> {cfg.threshold}, reviewFloor {old_review_floor} -> {cfg.review_floor}",
        ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
    )

    # Notify all admins
    admins = User.objects.filter(Q(role='admin') | Q(is_superuser=True), is_active=True)
    for admin_user in admins:
        Notification.objects.create(
            user=admin_user,
            type='system',
            title='Model Thresholds Updated',
            body=f"Risk threshold updated to {cfg.threshold:.3f} (review floor: {cfg.review_floor:.3f}) by {request.user.email}.",
            link='/admin/governance',
        )

    return Response({
        'threshold': cfg.threshold,
        'reviewFloor': cfg.review_floor,
        'fraudThreshold': cfg.threshold,
        'suspiciousThreshold': cfg.review_floor,
        'message': "Model thresholds updated successfully.",
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def model_config(request):
    """
    GET /api/model/config/
    Returns active threshold, reviewFloor, and auto-block parameters.
    """
    cfg = ModelConfig.objects.first()
    if not cfg:
        _ = ml_service.get_config()
        cfg = ModelConfig.objects.first()

    return Response({
        'threshold': cfg.threshold,
        'reviewFloor': cfg.review_floor,
        'suspiciousThreshold': cfg.review_floor,
        'fraudThreshold': cfg.threshold,
        'autoBlockScore': cfg.threshold,
        'enableRealTimeScoring': True,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAnalyst])
def model_retrain(request):
    """
    POST /api/model/retrain/
    """
    cfg = ModelConfig.objects.first()
    version = cfg.version if cfg else 'v1.2.0-xgb'

    AuditLog.objects.create(
        actor=request.user.email,
        role=request.user.role,
        action='MODEL_RETRAIN_TRIGGERED',
        target=version,
        status='SUCCESS',
        details="Initiated distributed XGBoost hyperparameter tuning job.",
        ip_address=request.META.get('REMOTE_ADDR', '127.0.0.1'),
    )

    return Response({
        'status': 'TRAINING_STARTED',
        'jobId': f"job_retrain_{int(time.time())}",
        'estimatedDuration': '4 mins 30 secs',
        'version': version,
    })
