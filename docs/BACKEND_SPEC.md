# FraudShield - Backend Spec (read before EVERY backend task)

## Goal
A secure Django REST API that replaces ALL mock data in the frontend. The frontend (frontend/src/services and its README backend contract) is the source of truth for URLs, query params and JSON field names. docs/API_CONTRACT.md (made in Part 6A) records them. The real XGBoost model in ml/ scores every transaction. No mock or random scores anywhere in the backend.

## Stack
Python 3.11+, Django 5, Django REST Framework, djangorestframework-simplejwt (JWT, refresh rotation, blacklist), django-cors-headers, djangorestframework-camel-case (JSON is camelCase, database is snake_case), django-filter, dj-database-url, python-dotenv, pandas, numpy, scikit-learn, xgboost, joblib, gunicorn, pytest, pytest-django. Database: SQLite by default, PostgreSQL through DATABASE_URL. No Celery or Redis.

## Folder structure
backend/
  manage.py  requirements.txt  .env.example  pytest.ini  Dockerfile
  config/            settings.py  urls.py  wsgi.py
  apps/accounts/     User, auth, access requests, permission classes, sessions
  apps/fraud/        Merchant, Card, Transaction, Alert, Case, CaseNote, CaseEvent, Dispute, DisputeEvidence, Notification, ModelConfig
  apps/audit/        AuditLog, audit helper
  apps/ml/           ml_service.py (load model, score, explain, bands)
  apps/stats/        statistics endpoints
  apps/reports/      report builder and CSV
  apps/*/management/commands/  seed_data.py  run_simulator.py
ml/ (project root, not inside backend): fraud_xgb_model.pkl  scaler.pkl  threshold.txt  model_report.json  VERSIONS.txt  data/test_sample.csv

## Models (fields)
User: email (unique, used to log in), name, role (admin|analyst|customer|merchant), organisation, status (active|pending|disabled), is_active, merchant (FK, only for role merchant), last_login, created_at.
Merchant: name, category (Grocery, Electronics, Fashion, Travel, Food, Fuel, Entertainment, Online Services), city.
Card: owner (User, customer), last4, brand, status (active|blocked), spending_limit, travel_notice, created_at.
Transaction: public_id (TXN-000001 style), card, merchant, amount (display value in INR = dataset Amount x DISPLAY_RATE 90), city, timestamp, risk_score (0-1), status (approved|flagged|blocked|confirmed_fraud|confirmed_safe), true_label (nullable, from dataset), model_inputs (JSON: Time, Amount, V1..V28; always the RAW unscaled values, the scaler is applied only inside ml_service), factors (JSON, top 5 [{name, impact}]), model_version, source (seed|simulator|upload). Band is COMPUTED from risk_score and the current threshold, never stored.
Alert: transaction, severity (medium|high), status (new|in_review|escalated|resolved), assignee, customer_response (none|confirmed_me|not_me), created_at, resolved_at.
Case: alert, transaction, status (open|in_review|escalated|closed), outcome (none|fraud|safe|escalated), assignee, created_at, closed_at.  CaseNote: case, author, text, created_at.  CaseEvent: case, type, text, actor, created_at (the timeline).
Dispute: merchant, transaction, reason, amount, stage (opened|evidence|review|resolved), outcome, created_at.  DisputeEvidence: dispute, file, original_name, uploaded_by, created_at.
Notification: user, type (alert|case|dispute|system), title, body, link, is_read, created_at.
AuditLog: user (nullable), role, action, target, ip, details (JSON), created_at.
ModelConfig (one row): version, threshold (loaded from ml/threshold.txt), review_floor (loaded from review_floor key of ml/model_report.json), trained_at, dataset_info, metrics, confusion_matrix, pr_curve, feature_importance, comparison, scale_pos_weight, best_params (loaded from ml/model_report.json). Threshold and review floor are NOT fixed numbers and both are stored in ModelConfig. Rule: never hard-code these numbers anywhere in the backend.

### ml/model_report.json Schema
The report file contains:
- `model_name`: string identifier of the trained model
- `version`: string version tag
- `threshold`: decision threshold loaded from ml/threshold.txt
- `review_floor`: floor score separating safe and review bands
- `scale_pos_weight`: float imbalance weighting used during training
- `dataset`: object `{name, rows_after_dedupe, frauds, test_rows, test_frauds}`
- `metrics`: object `{recall, precision, f1, pr_auc, roc_auc}`
- `confusion_matrix`: object `{tn, fp, fn, tp}`
- `pr_curve`: list of objects `[{precision, recall}]`
- `feature_importance`: list of objects `[{feature, importance}]`
- `comparison`: list of objects `[{model, recall, precision, f1, pr_auc, note}]`
- `best_params`: object of tuned hyperparameters

## Scoring rules (apps/ml/ml_service.py)
- Load the model once at startup (lazy singleton) from ml/fraud_xgb_model.pkl and the StandardScaler from ml/scaler.pkl (both loaded with joblib, from the project's own ml/ folder only). The 30 input columns, in this exact order, are: Time, V1 to V28, Amount (a constant FEATURES list; check scaler.n_features_in_ == 30 at startup).
- Scoring pipeline: the raw 30 values in the order Time, V1..V28, Amount -> scaler.transform -> model.predict_proba, using plain numpy arrays (the model and the scaler were trained without column names).
- Threshold comes from ml/threshold.txt, the review_floor from the review_floor key of ml/model_report.json, and both are stored in ModelConfig in the database.
- Bands: score < review_floor -> safe, review_floor <= score < threshold -> review, score >= threshold -> high. The model's own flag point is the threshold.
- Rule: never hard-code these numbers anywhere in the backend.
- Status from band: safe -> approved, review -> flagged, high -> blocked.
- Explanations: use model.get_booster().predict(xgboost.DMatrix(scaled_rows), pred_contribs=True) and drop the last (bias) column; no extra library; factor names come from the FEATURES list. Keep the 5 largest by absolute value as factors [{name, impact}] (positive pushes toward fraud). Give each factor a friendly label, for example 'V14 (unusual pattern signal)', 'Amount (unusually high or low)', 'Time (unusual hour)'.
- Whenever a transaction is scored as review or high: create an Alert (severity high when band is high, else medium) and a Case with a first timeline event, notify the cardholder, and notify all analysts.

## Who can do what
admin: everything.
analyst: all transactions, alerts, cases, checker, model info (read), stats. Cannot manage users or change the threshold.
customer: ONLY own cards, own transactions, own alerts, own notifications. Can answer alerts and block or unblock own cards.
merchant: ONLY own merchant's transactions, disputes and stats. Can use the checker and read model info.
Every list and detail query is filtered on the server by the logged-in user. Never trust the frontend to hide data.

## Endpoints (list endpoints return exactly { results, count })
AUTH
  POST /api/auth/login/ {email,password} -> {access,refresh,user}   (public, throttled)
  POST /api/auth/refresh/ {refresh} -> {access,refresh}   POST /api/auth/logout/ {refresh} (blacklists it)
  POST /api/auth/register/ (creates a PENDING access request)   POST /api/auth/forgot-password/ (always the same 200 message)
  GET,PATCH /api/auth/me/   POST /api/auth/change-password/   GET /api/auth/sessions/   POST /api/auth/sessions/sign-out-others/
TRANSACTIONS
  GET /api/transactions/  params: page, pageSize, search, ordering, band, status, category, dateFrom, dateTo, amountMin, amountMax, cardId, since
  GET /api/transactions/{id}/ (with factors; modelInputs only for admin, analyst, merchant)   GET /api/transactions/export/ (CSV, admin)
PREDICT AND LIVE DATA (admin, analyst, merchant)
  GET /api/predict/samples/ -> 200 sample transactions without the true label
  POST /api/predict/ {transactionId} or {features:{Time,Amount,V1..V28}} -> {riskScore,band,factors,threshold,modelVersion,trueLabel (only for stored sample rows)}
  POST /api/predict/batch/ multipart CSV (max 5 MB, 5000 rows, must have the 30 feature columns) -> {results:[{row,riskScore,band}],summary:{total,safe,review,high}}
  POST /api/simulator/tick/ -> creates and scores ONE new live transaction (random row from the sample file, random card and merchant, timestamp now) and returns it
ALERTS AND CASES
  GET /api/alerts/ (filters: status, severity, assignee, dateFrom, dateTo, amountMin, amountMax)   PATCH /api/alerts/{id}/ (customer: {customerResponse}; analyst: {status,assignee})   POST /api/alerts/bulk/ {ids,action:'assign'|'resolve',assignee}
  GET /api/cases/ (filter outcome, search)   GET /api/cases/{id}/ (transaction, cardholder, card, last 5 card transactions, notes, timeline)   PATCH /api/cases/{id}/ {assignee}
  POST /api/cases/{id}/action/ {action:'fraud'|'safe'|'escalate', note (required)}   POST /api/cases/{id}/notes/ {text}
CARDS  GET /api/cards/   PATCH /api/cards/{id}/ {status,spendingLimit,travelNotice} (owner only)
USERS (admin)  GET,POST /api/users/   PATCH /api/users/{id}/ {role,isActive}   GET /api/users/access-requests/   POST /api/users/{id}/approve/   POST /api/users/{id}/reject/
DISPUTES  GET /api/disputes/   GET /api/disputes/{id}/   POST /api/disputes/{id}/evidence/ (multipart pdf/png/jpg, max 5 MB)   POST /api/disputes/{id}/advance/
NOTIFICATIONS (own only)  GET /api/notifications/ (adds unreadCount)   PATCH /api/notifications/{id}/ {isRead}   POST /api/notifications/read-all/
MODEL  GET /api/model/info/ (admin, analyst, merchant)   GET /api/model/what-if/?threshold=<val> (admin; threshold defaults to active ModelConfig.threshold if omitted; computed from stored transactions with true_label: flagged, caught, falseAlarms, precision, recall)   PUT /api/model/threshold/ {threshold, reviewFloor optional} (admin; threshold 0.05 to 0.99, reviewFloor 0.1 up to the threshold; writes an audit log)
STATS (role-scoped, param range=7d|30d|90d)  GET /api/stats/overview/ | timeseries/ | by-hour/ | by-category/ | risk-distribution/ | analyst/ | merchant/ | customer/
REPORTS  GET /api/reports/?type=&dateFrom=&dateTo=&format=json|csv (admin types: daily_summary, fraud_by_category, analyst_performance, model_performance; merchant types: merchant_summary, merchant_chargebacks)
AUDIT  GET /api/audit-logs/ (admin; filters user, action, dateFrom, dateTo; ?format=csv)
HEALTH  GET /api/health/ (public) -> {status, modelLoaded, modelVersion}

## Security rules (non-negotiable)
1. All secrets and settings come from environment variables (.env, never committed). DEBUG=False by default. Explicit ALLOWED_HOSTS. CORS allows only the frontend origin from env.
2. JWT: access token 15 minutes, refresh 7 days with rotation and blacklist after rotation; logout blacklists the refresh token.
3. Throttling: login and register 5 per minute per IP, forgot-password 3 per minute, other endpoints 120 per minute per user.
4. Strong password validators. Login errors never reveal whether the email exists. Forgot-password always returns the same message. Disabled or pending users cannot log in.
5. Object-level access: filter every queryset by user and role; return 404 (not 403) for other people's objects.
6. Serializers list fields explicitly (never '__all__'). Role, is_active, status and ownership can never be set by the client on self-service endpoints.
7. Uploads: allowed types pdf, png, jpg only, max 5 MB, random stored filenames, files served only to authorised users. CSV prediction: max 5 MB and 5000 rows, validate columns and numeric values, never execute or eval anything.
8. ORM only, no raw SQL built from user input. Model files (.pkl) are loaded only from the project's own ml/ folder, never from uploads (pickle files can run code). Never return stack traces; one error format { message, status, fields }.
9. Security headers (X-Content-Type-Options, X-Frame-Options, HSTS and secure cookies when not DEBUG). Do not log passwords or tokens.
10. Audit log every login, failed login, logout, user create or change, role change, threshold change, case decision, card block or unblock, and export.
11. Security note for the report: the frontend keeps tokens in localStorage, which is fine for this project demo; production should use httpOnly cookies.

## Code rules
Small focused modules, type hints on services, docstrings on endpoints, pytest tests for the permission matrix, scoring, and each endpoint group. Pin versions in requirements.txt; scikit-learn, xgboost, numpy and joblib MUST be pinned to the exact versions in ml/VERSIONS.txt, because .pkl files only load safely with the versions that saved them. Everything must run with: pip install -r requirements.txt, python manage.py migrate, python manage.py seed_data, python manage.py runserver.
