from django.urls import path
from apps.ml.views import (
    predict_samples,
    predict_single,
    predict_batch,
    simulator_tick,
    model_info,
    model_what_if,
    model_threshold,
    model_config,
    model_retrain,
)

urlpatterns = [
    # Predict endpoints
    path('predict/samples/', predict_samples, name='predict_samples'),
    path('predict/batch/', predict_batch, name='predict_batch'),
    path('predict/', predict_single, name='predict_single'),

    # Simulator endpoints
    path('simulator/tick/', simulator_tick, name='simulator_tick'),

    # Model endpoints
    path('model/info/', model_info, name='model_info'),
    path('model/what-if/', model_what_if, name='model_what_if'),
    path('model/threshold/', model_threshold, name='model_threshold'),
    path('model/thresholds/', model_threshold, name='model_thresholds'),
    path('model/config/', model_config, name='model_config'),
    path('model/retrain/', model_retrain, name='model_retrain'),
]
