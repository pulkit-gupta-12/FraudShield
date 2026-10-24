"""
apps/ml/feature_builder.py

Honest bridge between real user inputs (amount, time, spending pattern)
and the 30 PCA-projected features (Time, V1..V28, Amount) expected by the model.

ARCHITECTURE NOTE:
This function is the ONLY place to change if the machine learning model
is retrained on human-readable feature columns (e.g. merchant category,
geographic coordinates, velocity counters).
"""

from datetime import datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
import math
from django.utils import timezone
from django.utils.dateparse import parse_datetime

DISPLAY_RATE: float = 90.0
FEATURE_NAMES: List[str] = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']


def build_features(
    amount_inr: Union[float, int, Decimal],
    local_datetime: Optional[Union[datetime, str]] = None,
    pattern: Optional[Any] = None,
    raw_values: Optional[Union[Dict[str, Any], List[float]]] = None,
) -> Dict[str, float]:
    """
    Builds the exact 30 RAW numeric features (Time, V1..V28, Amount) needed by scaler -> model.

    Args:
        amount_inr: Transaction amount in Indian Rupees (display currency).
        local_datetime: Transaction timestamp (datetime or ISO 8601 string).
        pattern: PatternProfile model instance, pattern ID, or pattern code ('P01'..'P20').
        raw_values: Explicit dictionary or list of 28/30 raw floats (Admin/Analyst override).

    Returns:
        dict: Mapping of 30 feature names to raw float values.
    """
    # 1. Calculate Amount in model dataset units (raw = amount_inr / 90.0)
    try:
        amt_num = float(amount_inr)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid amount: {amount_inr}")
    if math.isnan(amt_num) or math.isinf(amt_num):
        raise ValueError("Amount cannot be NaN or infinite.")
    amount_raw = amt_num / DISPLAY_RATE

    # 2. Calculate Time = seconds since local midnight
    if local_datetime is None:
        dt = timezone.localtime()
    elif isinstance(local_datetime, str):
        parsed = parse_datetime(local_datetime)
        if parsed is None:
            try:
                parsed = datetime.fromisoformat(local_datetime)
            except Exception:
                parsed = timezone.localtime()
        dt = timezone.localtime(parsed) if timezone.is_aware(parsed) else parsed
    elif isinstance(local_datetime, datetime):
        dt = timezone.localtime(local_datetime) if timezone.is_aware(local_datetime) else local_datetime
    else:
        dt = timezone.localtime()

    time_raw = float(dt.hour * 3600 + dt.minute * 60 + dt.second + dt.microsecond / 1e6)

    # 3. Resolve V1..V28 values
    v_dict: Dict[str, float] = {}

    if raw_values is not None:
        if isinstance(raw_values, dict):
            for i in range(1, 29):
                key = f'V{i}'
                val = raw_values.get(key, raw_values.get(f'v{i}', 0.0))
                try:
                    v_dict[key] = float(val)
                except (TypeError, ValueError):
                    v_dict[key] = 0.0
            # If raw_values explicitly specified Time or Amount, allow override
            if 'Time' in raw_values:
                time_raw = float(raw_values['Time'])
            if 'Amount' in raw_values:
                amount_raw = float(raw_values['Amount'])
        elif isinstance(raw_values, (list, tuple)):
            if len(raw_values) == 28:
                for idx, val in enumerate(raw_values):
                    v_dict[f'V{idx+1}'] = float(val)
            elif len(raw_values) == 30:
                time_raw = float(raw_values[0])
                for idx in range(1, 29):
                    v_dict[f'V{idx}'] = float(raw_values[idx])
                amount_raw = float(raw_values[29])
            else:
                raise ValueError(f"raw_values list must contain 28 or 30 numbers, got {len(raw_values)}")
    elif pattern is not None:
        from apps.fraud.models import PatternProfile

        profile = None
        if isinstance(pattern, PatternProfile):
            profile = pattern
        elif isinstance(pattern, int) or (isinstance(pattern, str) and pattern.isdigit()):
            profile = PatternProfile.objects.filter(id=int(pattern)).first()
        elif isinstance(pattern, str):
            profile = PatternProfile.objects.filter(code__iexact=pattern.strip()).first()

        if profile is not None and isinstance(profile.v_values, list):
            for idx, val in enumerate(profile.v_values[:28]):
                v_dict[f'V{idx+1}'] = float(val)
        else:
            # Fallback zero defaults if pattern not found
            for i in range(1, 29):
                v_dict[f'V{i}'] = 0.0
    else:
        # Default all 28 features to 0.0
        for i in range(1, 29):
            v_dict[f'V{i}'] = 0.0

    # Ensure all 28 V keys are present
    for i in range(1, 29):
        key = f'V{i}'
        if key not in v_dict or math.isnan(v_dict[key]) or math.isinf(v_dict[key]):
            v_dict[key] = 0.0

    # 4. Construct final 30-feature dictionary in exact order
    features: Dict[str, float] = {'Time': time_raw}
    for i in range(1, 29):
        features[f'V{i}'] = v_dict[f'V{i}']
    features['Amount'] = amount_raw

    return features
