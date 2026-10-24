import ctypes
import io
import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from django.conf import settings
from xgboost.core import _LIB, _check_call, c_array, c_bst_ulong

logger = logging.getLogger(__name__)

# Fixed 30 input columns in exact order
FEATURES: List[str] = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']

FRIENDLY_LABELS: Dict[str, str] = {
    'Time': 'Time (unusual hour / timing)',
    'Amount': 'Amount (unusually high or low)',
    'V1': 'V1 (account activity deviation)',
    'V2': 'V2 (transaction frequency shift)',
    'V3': 'V3 (credit velocity anomaly)',
    'V4': 'V4 (spending pattern change)',
    'V5': 'V5 (location velocity signal)',
    'V6': 'V6 (terminal consistency check)',
    'V7': 'V7 (behavioral variance)',
    'V8': 'V8 (device fingerprint deviation)',
    'V9': 'V9 (channel risk indicator)',
    'V10': 'V10 (unusual account usage)',
    'V11': 'V11 (authorization pattern shift)',
    'V12': 'V12 (risk corridor flag)',
    'V13': 'V13 (cross-border indicator)',
    'V14': 'V14 (unusual pattern signal)',
    'V15': 'V15 (historical deviation)',
    'V16': 'V16 (merchant category variance)',
    'V17': 'V17 (reversal/chargeback correlation)',
    'V18': 'V18 (geo-temporal disparity)',
    'V19': 'V19 (balance depletion signal)',
    'V20': 'V20 (high-risk velocity burst)',
    'V21': 'V21 (cardholder profile variance)',
    'V22': 'V22 (counterparty risk signal)',
    'V23': 'V23 (unusual transfer sequence)',
    'V24': 'V24 (off-hours activity)',
    'V25': 'V25 (token mismatch risk)',
    'V26': 'V26 (frequency spike)',
    'V27': 'V27 (sudden ticket size anomaly)',
    'V28': 'V28 (atypical checkout cadence)',
}


def _read_count(f):
    import struct
    t = f.read(1)
    if t == b'i': return struct.unpack('>b', f.read(1))[0]
    elif t == b'U': return struct.unpack('>B', f.read(1))[0]
    elif t == b'I': return struct.unpack('>h', f.read(2))[0]
    elif t == b'l': return struct.unpack('>i', f.read(4))[0]
    elif t == b'L': return struct.unpack('>q', f.read(8))[0]
    raise ValueError(f"Unknown count tag: {t}")


def _parse_val(f, val_type=None):
    import struct
    tag = val_type if val_type is not None else f.read(1)
    if not tag:
        return None
    if tag == b'{':
        obj = {}
        t_type = None
        count = None
        cur = f.tell()
        nxt = f.read(1)
        if nxt == b'$':
            t_type = f.read(1)
            nxt = f.read(1)
        if nxt == b'#':
            count = _read_count(f)
        else:
            f.seek(cur)

        if count is not None:
            for _ in range(count):
                klen = _read_count(f)
                key = f.read(klen).decode('utf-8', errors='ignore')
                obj[key] = _parse_val(f, t_type)
            return obj

        while True:
            cur = f.tell()
            next_b = f.read(1)
            if not next_b or next_b == b'}':
                break
            f.seek(cur)
            klen = _read_count(f)
            key = f.read(klen).decode('utf-8', errors='ignore')
            obj[key] = _parse_val(f)
        return obj
    elif tag == b'[':
        t_type = None
        count = None
        cur = f.tell()
        nxt = f.read(1)
        if nxt == b'$':
            t_type = f.read(1)
            nxt = f.read(1)
        if nxt == b'#':
            count = _read_count(f)
        else:
            f.seek(cur)

        if count is not None:
            if t_type == b'u':
                return f.read(count)
            arr = []
            for _ in range(count):
                arr.append(_parse_val(f, t_type))
            return arr

        arr = []
        while True:
            cur = f.tell()
            next_b = f.read(1)
            if not next_b or next_b == b']':
                break
            f.seek(cur)
            arr.append(_parse_val(f))
        return arr
    elif tag == b'Z':
        return None
    elif tag == b'T':
        return True
    elif tag == b'F':
        return False
    elif tag == b'i':
        return struct.unpack('>b', f.read(1))[0]
    elif tag == b'U':
        return struct.unpack('>B', f.read(1))[0]
    elif tag == b'I':
        return struct.unpack('>h', f.read(2))[0]
    elif tag == b'l':
        return struct.unpack('>i', f.read(4))[0]
    elif tag == b'L':
        return struct.unpack('>q', f.read(8))[0]
    elif tag == b'd':
        return struct.unpack('>f', f.read(4))[0]
    elif tag == b'D':
        return struct.unpack('>d', f.read(8))[0]
    elif tag in (b'S', b's'):
        slen = _read_count(f)
        return f.read(slen).decode('utf-8', errors='ignore')
    elif tag == b'C':
        return f.read(1).decode('latin1')
    else:
        raise ValueError(f"Unknown tag: {tag} at pos {f.tell()-1}")


# Ensure Booster unpickling handles UBJSON buffers seamlessly on XGBoost 3.x
_orig_booster_setstate = xgb.Booster.__setstate__

def _safe_booster_setstate(self, state: Dict) -> None:
    try:
        _orig_booster_setstate(self, state)
    except Exception as e:
        handle = state.get("handle")
        if handle is not None:
            stream = io.BytesIO(handle)
            parsed = _parse_val(stream)
            model_dict = parsed.get("Model", parsed)
            if isinstance(model_dict.get("learner"), dict) and model_dict["learner"].get("metrics") is None:
                model_dict["learner"]["metrics"] = []
            json_bytes = bytearray(json.dumps(model_dict).encode("utf-8"))
            dmats = c_array(ctypes.c_void_p, [])
            h = ctypes.c_void_p()
            _check_call(_LIB.XGBoosterCreate(dmats, c_bst_ulong(0), ctypes.byref(h)))
            self.handle = h
            self.load_model(json_bytes)
            state["handle"] = self.handle
            self.__dict__.update(state)
            return
        raise

xgb.Booster.__setstate__ = _safe_booster_setstate


class MLService:
    """
    Lazy singleton managing the XGBoost fraud detection model, StandardScaler,
    threshold configuration from ModelConfig, scoring, and SHAP-based explanations.
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._loaded: bool = False

    def _ensure_loaded(self):
        if self._loaded:
            return

        ml_dir = Path(getattr(settings, 'ML_DIR', Path(__file__).resolve().parent.parent.parent.parent / 'ml'))
        model_path = ml_dir / 'fraud_xgb_model.pkl'
        scaler_path = ml_dir / 'scaler.pkl'

        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found at {model_path}")
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler file not found at {scaler_path}")

        # Load scaler
        self._scaler = joblib.load(scaler_path)
        if getattr(self._scaler, 'n_features_in_', None) != 30:
            raise ValueError(
                f"Expected scaler to have 30 features, but found {getattr(self._scaler, 'n_features_in_', None)}"
            )

        # Load XGBoost model
        self._model = joblib.load(model_path)
        self._loaded = True
        logger.info("MLService loaded successfully. Model and Scaler ready (30 features).")

    @property
    def is_loaded(self) -> bool:
        try:
            self._ensure_loaded()
            return self._loaded and self._model is not None and self._scaler is not None
        except Exception as e:
            logger.error(f"Error checking model load status: {e}")
            return False

    @property
    def version(self) -> str:
        try:
            self._ensure_loaded()
            cfg = self.get_config()
            return cfg.get('version', '')
        except Exception:
            return ''

    @property
    def model(self):
        self._ensure_loaded()
        return self._model

    @property
    def scaler(self):
        self._ensure_loaded()
        return self._scaler

    def get_config(self) -> dict:
        """Returns active threshold, review_floor, and version from ModelConfig."""
        from apps.fraud.models import ModelConfig
        cfg = ModelConfig.objects.first()
        if not cfg:
            try:
                ml_dir = Path(getattr(settings, 'ML_DIR', Path(__file__).resolve().parent.parent.parent.parent / 'ml'))
                t_file = ml_dir / 'threshold.txt'
                r_file = ml_dir / 'model_report.json'
                if t_file.exists() and r_file.exists():
                    with open(r_file, 'r') as f:
                        r_data = json.load(f)
                    t_val = float(t_file.read_text().strip())
                    rf_val = float(r_data.get('review_floor'))
                    cfg = ModelConfig.objects.create(
                        version=r_data.get('version', 'v1.0'),
                        threshold=t_val,
                        review_floor=rf_val,
                        scale_pos_weight=float(r_data.get('scale_pos_weight', 0.0)),
                        best_params=r_data.get('best_params', {}),
                        dataset_info=r_data.get('dataset', {}),
                        metrics=r_data.get('metrics', {}),
                        confusion_matrix=r_data.get('confusion_matrix', {}),
                        pr_curve=r_data.get('pr_curve', []),
                        feature_importance=r_data.get('feature_importance', []),
                        comparison=r_data.get('comparison', []),
                    )
            except Exception as e:
                logger.warning(f"Could not auto-create ModelConfig: {e}")

        if cfg:
            return {
                'threshold': float(cfg.threshold),
                'review_floor': float(cfg.review_floor),
                'version': cfg.version,
            }
        raise RuntimeError("ModelConfig not found in database. Run migrations and seed_data.")

    def _prepare_array(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Validates columns, returns raw array and scaled array using plain numpy arrays."""
        missing = [col for col in FEATURES if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required feature columns: {missing}")

        raw_array = df[FEATURES].to_numpy(dtype=np.float64)
        scaled_array = self.scaler.transform(raw_array)
        return raw_array, scaled_array

    def score(self, df: pd.DataFrame) -> np.ndarray:
        """
        Vectorised scoring pipeline: RAW 30 values in FEATURES order -> scaler.transform -> model.predict_proba.
        Uses plain numpy arrays (the model and scaler were trained without column names).
        Returns numpy array of fraud probabilities (class 1).
        """
        self._ensure_loaded()
        if not isinstance(df, pd.DataFrame):
            df = pd.DataFrame(df)

        _, scaled_array = self._prepare_array(df)
        probs = self.model.predict_proba(scaled_array)[:, 1]
        return np.asarray(probs, dtype=np.float64)

    def explain(self, df: pd.DataFrame) -> List[List[Dict[str, Union[str, float]]]]:
        """
        Calculates SHAP contributions using model.get_booster().predict(xgboost.DMatrix(scaled_rows), pred_contribs=True)
        and drops the last (bias) column. Uses plain numpy arrays.
        Returns top 5 factors per row with friendly labels.
        """
        self._ensure_loaded()
        if not isinstance(df, pd.DataFrame):
            df = pd.DataFrame(df)

        _, scaled_array = self._prepare_array(df)
        booster = self.model.get_booster()
        dmat = xgb.DMatrix(scaled_array)
        # Drop last column (bias / base value)
        contribs = booster.predict(dmat, pred_contribs=True)[:, :-1]

        # Top 5 indices by absolute contribution
        top_indices = np.argsort(-np.abs(contribs), axis=1)[:, :5]

        explanations = []
        num_rows = contribs.shape[0]
        for i in range(num_rows):
            row_factors = []
            for idx in top_indices[i]:
                feat_name = FEATURES[idx]
                val = float(contribs[i, idx])
                row_factors.append({
                    'name': FRIENDLY_LABELS.get(feat_name, feat_name),
                    'impact': round(val, 4),
                    'feature': feat_name,
                })
            explanations.append(row_factors)

        return explanations


# Global Singleton instance
ml_service = MLService()


def score(dataframe: pd.DataFrame) -> np.ndarray:
    """Convenience functional wrapper around ml_service.score."""
    return ml_service.score(dataframe)


def explain(dataframe: pd.DataFrame) -> List[List[Dict[str, Union[str, float]]]]:
    """Convenience functional wrapper around ml_service.explain."""
    return ml_service.explain(dataframe)


def band(
    score_val: Union[float, np.ndarray, pd.Series],
    threshold: Optional[float] = None,
    review_floor: Optional[float] = None,
):
    """
    Computes risk band:
    score < review_floor -> safe
    review_floor <= score < threshold -> review
    score >= threshold -> high

    Threshold and review_floor are always read from ModelConfig when not explicitly passed.
    """
    if threshold is None or review_floor is None:
        cfg = ml_service.get_config()
        if threshold is None:
            threshold = cfg['threshold']
        if review_floor is None:
            review_floor = cfg['review_floor']

    if isinstance(score_val, (np.ndarray, pd.Series, list)):
        arr = np.asarray(score_val, dtype=np.float64)
        return np.where(arr >= threshold, 'high', np.where(arr >= review_floor, 'review', 'safe'))

    val = float(score_val)
    if val >= threshold:
        return 'high'
    elif val >= review_floor:
        return 'review'
    return 'safe'


def status_for(band_val: str) -> str:
    """Maps risk band to transaction status: safe -> approved, review -> flagged, high -> blocked."""
    b = str(band_val).lower()
    if b == 'high':
        return 'blocked'
    elif b == 'review':
        return 'flagged'
    return 'approved'


def process_transaction(
    transaction,
    save: bool = True,
    threshold: Optional[float] = None,
    review_floor: Optional[float] = None,
):
    """
    Scores a transaction, stores risk_score, factors and model_version, sets status.
    When band is 'review' or 'high', creates Alert, Case with first timeline event,
    and notifications (cardholder plus all analysts).
    Threshold and review_floor come strictly from ModelConfig when not provided.
    """
    inputs = transaction.model_inputs
    if not isinstance(inputs, dict) or not inputs:
        raise ValueError(f"Transaction {transaction.public_id} has invalid or missing model_inputs.")

    cfg = ml_service.get_config()
    t_val = cfg['threshold'] if threshold is None else threshold
    rf_val = cfg['review_floor'] if review_floor is None else review_floor

    row_df = pd.DataFrame([inputs])
    start_time = time.perf_counter()
    scores = score(row_df)
    risk_score = float(scores[0])
    factors = explain(row_df)[0]
    scoring_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
    band_val = band(risk_score, threshold=t_val, review_floor=rf_val)
    status_val = status_for(band_val)
    if transaction.card and transaction.card.status == 'blocked':
        status_val = 'blocked'

    transaction.risk_score = round(risk_score, 4)
    transaction.scoring_ms = scoring_ms
    transaction.factors = factors
    transaction.model_version = ml_service.version
    transaction.status = status_val

    if save:
        transaction.save()

    if band_val in ('review', 'high'):
        from apps.fraud.models import Alert, Case, CaseEvent, Notification
        from apps.accounts.models import User

        severity = 'high' if band_val == 'high' else 'medium'
        alert, _ = Alert.objects.get_or_create(
            transaction=transaction,
            defaults={
                'severity': severity,
                'status': 'new',
            }
        )

        case, created_case = Case.objects.get_or_create(
            transaction=transaction,
            defaults={
                'alert': alert,
                'status': 'Open',
                'priority': 'P1' if band_val == 'high' else 'P2',
                'outcome': 'none',
            }
        )

        if created_case:
            CaseEvent.objects.create(
                case=case,
                event_type='system',
                action='Case Created',
                text=f"Transaction {transaction.public_id} flagged by ML model ({band_val} risk, score: {risk_score:.4f}).",
                actor='System',
            )

        # Notify cardholder
        if transaction.card and transaction.card.owner:
            cardholder = transaction.card.owner
            merchant_name = transaction.merchant_name or (transaction.merchant.name if transaction.merchant else 'Merchant')
            Notification.objects.create(
                user=cardholder,
                type='alert',
                title='Suspicious Activity Alert',
                body=f"Transaction of ₹{float(transaction.amount_inr):,.2f} at {merchant_name} flagged for review ({status_val}).",
                link=f"/transactions/{transaction.public_id}",
            )

        # Notify all active analysts
        analysts = User.objects.filter(role='analyst', is_active=True)
        for analyst in analysts:
            Notification.objects.create(
                user=analyst,
                type='alert',
                title=f"New {band_val.upper()} Risk Alert",
                body=f"Transaction {transaction.public_id} flagged ({band_val.upper()}, score: {risk_score:.3f}).",
                link=f"/alerts/{alert.id}",
            )

    return transaction
