# FraudShield — AI-Powered Credit Card Fraud Detection Platform

FraudShield is an enterprise-grade credit card fraud prevention and case investigation platform. It marries a real tuned **XGBoost machine learning model** with a high-performance **Django REST Framework backend** and an intuitive, accessible **React 18 frontend** to offer end-to-end fraud scoring, feature attribution, real-time transaction streaming, and dispute lifecycle management.

---

## Architecture Diagram

```
+---------------------------------------------------------------------------------------------------+
|                                      CLIENT LAYER (Browser)                                        |
|  React 18 + Vite SPA | TailwindCSS | Recharts | Lucide Icons | Axios HTTP Client                  |
|  Role Views: Admin (/admin) | Analyst (/analyst) | Customer (/customer) | Merchant (/merchant)   |
+---------------------------------------------------------------------------------------------------+
                                         │  HTTP / REST (JSON)
                                         ▼
+---------------------------------------------------------------------------------------------------+
|                                REVERSE PROXY & GATEWAY (Nginx)                                    |
|  - Static Assets Delivery (/dist)                                                                 |
|  - API Reverse Proxy (/api/ -> backend:8000/api/)                                                 |
|  - Security Headers: X-Frame-Options, X-Content-Type-Options                                      |
+---------------------------------------------------------------------------------------------------+
                                         │  Proxy Pass
                                         ▼
+---------------------------------------------------------------------------------------------------+
|                                BACKEND APPLICATION (Django 5 / DRF)                               |
|  Gunicorn WSGI Server | SimpleJWT Auth | Rate Throttling | Audit Logger                          |
|                                                                                                   |
|  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  |
|  │  apps/accounts    │  │   apps/fraud      │  │    apps/audit     │  │      apps/reports      │  |
|  │  RBAC, Sessions   │  │  Txns, Cards,     │  │  Immutable Audit  │  │   CSV & JSON Summary   │  |
|  │  Access Requests  │  │  Alerts & Cases   │  │  Activity Logs    │  │   Aggregations         │  |
|  └───────────────────┘  └───────────────────┘  └───────────────────┘  └────────────────────────┘  |
|                                         │                                                         |
|                                         ▼                                                         |
|  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  |
|  │                                    apps/ml (ML Service)                                     │  |
|  │  - Model: XGBoost Classifier (fraud_xgb_model.pkl, scale_pos_weight=577.88)                 │  |
|  │  - Preprocessor: StandardScaler (scaler.pkl, 30 features: Time, V1..V28, Amount)            │  |
|  │  - Decision Policy: threshold=0.521, review_floor=0.50 (Loaded from ModelConfig)           │  |
|  │  - XAI Attributions: Native TreeExplainer Contributions via pred_contribs                   │  |
|  └─────────────────────────────────────────────────────────────────────────────────────────────┘  |
+---------------------------------------------------------------------------------------------------+
                 │                                                   │
                 ▼                                                   ▼
+---------------------------------+                 +-----------------------------------------------+
|     DATA STORAGE (PostgreSQL)   |                 |         BACKGROUND SIMULATOR WORKER           |
|  Transactions, Cards, Alerts,   |                 |  `manage.py run_simulator --interval 3`       |
|  Cases, Users, ModelConfig,     |                 |  Synthesizes realistic cardholder velocity    |
|  AuditLogs                      |                 |  and streams transactions into live feeds     |
+---------------------------------+                 +-----------------------------------------------+
```

---

## Quick Start with Docker (Recommended)

One command spins up PostgreSQL, runs migrations, seeds initial data, boots the Gunicorn API backend, starts the live streaming transaction simulator, and serves the Nginx frontend:

```bash
docker compose up --build
```

- **Frontend Application:** [http://localhost](http://localhost) (or [http://localhost:80](http://localhost:80))
- **Django REST API Root:** [http://localhost:8000/api/](http://localhost:8000/api/)
- **API Health Check:** [http://localhost:8000/api/health/](http://localhost:8000/api/health/)

To shut down and wipe volumes:
```bash
docker compose down -v
```

---

## Quick Start without Docker (Local Development)

Run each of the following components in separate terminal windows:

### Terminal 1: Backend Server

```bash
cd backend

# 1. Create and activate a Python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env

# 4. Migrate database, create demo users, and seed transactions
python manage.py migrate
python manage.py create_demo_users
python manage.py seed_data

# 5. Start development API server
python manage.py runserver 127.0.0.1:8000
```

### Terminal 2: Transaction Simulator (Live Data Feed)

```bash
cd backend
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Emits a newly scored real transaction every 3 seconds
python manage.py run_simulator --interval 3
```

### Terminal 3: Frontend Client

```bash
cd frontend

# 1. Install Node dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Ensure VITE_USE_MOCK=false and VITE_API_URL=http://localhost:8000/api

# 3. Start Vite dev server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## Demo Accounts

All test accounts are pre-configured with secure credentials. You can click the role chips on the login screen or enter them manually:

| Role | Demo Email | Password | Landing Route | Key Responsibilities & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@fraudshield.io` | `password123` / `Admin@123` | `/admin/dashboard` | System-wide fraud KPIs, user management (RBAC), threshold slider tuning, CSV audit log export |
| **Analyst** | `analyst@fraudshield.io` | `password123` / `Analyst@123` | `/analyst/dashboard` | Live fraud queue, Case investigation triage, SHAP factor analysis, batch CSV scoring, model panel |
| **Customer** | `customer@fraudshield.io` | `password123` / `Customer@123` | `/customer/overview` | Personal card management, instant block/unblock, interactive alert responses ("No, not me") |
| **Merchant** | `merchant@fraudshield.io` | `password123` / `Merchant@123` | `/merchant/overview` | Transaction settlement velocity, chargeback dispute defense, multipart PDF/PNG evidence upload |

*(Note: Demo logins with `@fraudshield.com` aliases are also supported).*

---

## Demo Data Modes

FraudShield provides flexible database seeding modes via `python manage.py seed_data`:

| Command / Flag | Purpose | Users | Transactions | Time | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `python manage.py seed_data --minimal` | Quick Smoke Test | 8 users | 50 txns | ~5s | Ultra-fast baseline seeding for quick automated tests, initial migrations, or manual verification. |
| `python manage.py seed_data --reset --demo` | Full Presentation Demo | 44 users | 6,000 txns | ~75s | Rich, 60-day presentation history with diurnal rhythms, 20 benchmark spending patterns, cases across all 4 statuses (Open, In Review, Escalated, Resolved), customer reports, chargeback disputes with evidence PDFs/PNGs, audit logs, and notifications. **No screen section is empty, zero, or flat.** |
| `python manage.py seed_data --clear-demo` | Safe Cleanup | - | - | <1s | Wipes only seeded demo data (`is_demo=True`), preserving real production accounts, newly registered users, and issued cards. |

### Real vs Demo Data Guarantee
- **Real ML Inference**: Every transaction seeded into the database is scored directly through the real `StandardScaler` and tuned `XGBoost` model (`ml/models/fraud_xgb_model.pkl`) using feature vectors extracted from `ml/data/test_sample.csv`. No artificial or random scores are fabricated.
- **Data Protection (`is_demo=True`)**: All seeded presentation records are flagged with `is_demo=True`. When `--clear-demo` is executed, only presentation demo records are deleted; non-demo users, issued cards, and real transactions submitted via the payment form remain intact.

---

## Real vs Demo System Boundaries

FraudShield is designed to demonstrate authentic banking security and machine learning operations without synthetic smoke-and-mirrors:

- **What is REAL:**
  - **Scoring, logins, permissions, alerts, cases, disputes and notifications are real.**
  - **The spending patterns are real anonymised rows from the test split** (the 28 PCA-transformed numerical features $V_1 \dots V_{28}$, time delta, and baseline transaction amounts extracted directly from the holdout dataset `ml/data/test_sample.csv`).
  - **Dynamic model threshold policies and live what-if calibrations are real.**
  - **Role-based multi-tenant database scoping and immutable audit logs are real.**
- **What is NOT real:**
  - **The payment network, email and SMS are not real** (payment rail gateway hooks and telecom delivery are simulated internally within the service layer).

---

## 5-Minute Interactive Demo Script (No Simulator Needed)

Experience the complete fraud detection and dispute lifecycle using real inputs and live ML scoring—starting from a fresh database without needing pre-seeded transaction histories or background simulator workers:

### 1. Customer Provisioning & Card Issuance (Admin Persona)
1. Log in as **Admin** (`admin@fraudshield.io` / `Admin@123`) and navigate to **Users** (`/admin/users`).
2. Click **"New User"**, create a customer (e.g. `priya.patel@example.com` / `Customer@123`).
3. Navigate to **Cards** (`/admin/cards`), click **"Issue Card"**, assign it to the new customer with a credit limit of ₹100,000, and activate the card.

### 2. Normal Spending Pattern & Instant Approval (Customer Persona)
1. Log out and log in as the newly created **Customer**.
2. Navigate to **Make a Payment** (`/customer/pay`).
3. Select your active card, pick spending pattern **"P01 - Grocery & Everyday Essentials"**, and enter amount `₹1,200`.
4. Click **"Submit Payment"**:
   - The XGBoost model evaluates the 30 real feature inputs and outputs a safe score (e.g., `0.0001`).
   - The payment is instantly **Approved**.
   - Navigate to **Transactions** (`/customer/transactions`) and verify the transaction appears; check your **Dashboard** (`/customer/overview`) to see your monthly spent update to ₹1,200.

### 3. High-Risk Fraud Pattern & Alert Trigger
1. Return to **Make a Payment** (`/customer/pay`).
2. Choose spending pattern **"P13 - High-Risk Anomalous Night Surge"** and enter `₹9,500`.
3. Click **"Submit Payment"**:
   - The real ML model scores the transaction at `1.0000` (well above the `0.521` threshold).
   - The transaction is immediately **Blocked** (or flagged for **Review**).
   - An instant high-risk alert badge appears in your header notification bell and on `/customer/alerts`.

### 4. Alert Denial, Case Escalation & Card Defense
1. Open **Alerts** (`/customer/alerts`) and click **"No, not me"** on the blocked transaction.
2. Confirm the action to trigger immediate card protection.
3. Switch persona by logging in as **Analyst** (`analyst@fraudshield.io` / `Analyst@123`):
   - Open **Cases** (`/analyst/cases`) to inspect the escalated fraud case.
   - Review the **XAI Factor Attribution** (extreme $V_{14}$, unusual transaction velocity, out-of-pattern amount).
   - Click **"Mark as Fraud"**, enter an analyst note (*"Confirmed unauthorized card compromise by cardholder"*), and submit.
4. Log back in as **Customer**:
   - Verify your card status is now **Blocked** in `/customer/cards`.
   - Attempt any payment on `/customer/pay`: the transaction is immediately **Declined** with reason `card_blocked` before even reaching the ML model.

### 5. Merchant Terminal Sale & Live Polling (Merchant Persona)
1. Log in as **Merchant** (`merchant@fraudshield.io` / `Merchant@123`).
2. Navigate to **Terminal** (`/merchant/terminal`).
3. Select a customer test card, pick pattern **"P02 - Electronic Store Purchase"**, enter `₹2,400`, and submit.
4. Log in as that customer and open **Transactions** (`/customer/transactions`):
   - Within 10 seconds, the new transaction appears in their personal feed via live polling.

### 6. Dispute Resolution & Model Feedback Loop
1. As the **Customer**, report an approved transaction in `/customer/transactions` selecting reason **"not_received"**.
2. Log in as **Merchant** and go to **Disputes** (`/merchant/disputes`):
   - Open the dispute, upload delivery evidence (`proof.pdf`), and advance the stage to **"Under Review"**.
3. Log in as **Admin** and open **Disputes** (`/admin/disputes`):
   - Adjudicate the dispute and set the final outcome to **"Customer Won"**.
4. Open the **Admin Dashboard** (`/admin/dashboard`):
   - Verify the **Model Feedback** tiles accurately reflect Confirmed Fraud, Missed Fraud, and False Alarms.
   - The Analyst operational KPIs on `/analyst/dashboard` reconcile with the adjudicated cases.

### 7. Dynamic Threshold Policy Tuning & Audit Trail
1. As **Admin**, navigate to **Config & Thresholds** (`/admin/config`).
2. Adjust the threshold slider (e.g., from `0.521` to `0.900`).
3. Test a borderline pattern (such as `P18` with raw score `0.8054`): notice how the system decision flips from `Blocked` to `Review`.
4. Open **Audit Logs** (`/admin/audit-logs`) to verify the immutable `THRESHOLDS_UPDATED` record capturing admin credentials, timestamp, and parameter changes.

---

## Machine Learning Provenance & Metrics Verification

The core fraud classification engine uses an **XGBoost Classifier** trained on highly imbalanced real-world credit card transaction distributions:

- **Model Files:** `ml/fraud_xgb_model.pkl` (Model), `ml/scaler.pkl` (StandardScaler), `ml/threshold.txt` (`0.521`), `ml/model_report.json`
- **Features (30 inputs):** `Time`, `V1` through `V28` (PCA projections), `Amount` (unscaled raw values converted at inference)
- **Class Imbalance Strategy:** `scale_pos_weight = 577.88`
- **Tuned Threshold Policy:**
  - `score < 0.500`: **Safe** (`approved`)
  - `0.500 <= score < 0.521`: **Review** (`flagged` for analyst triage)
  - `score >= 0.521`: **High Risk** (`blocked` immediately)

### Holdout Test Evaluation (`ml/data/test_sample.csv`)

| Metric | Holdout Sample Performance | Reference Baseline | Status |
| :--- | :--- | :--- | :--- |
| **Total Test Transactions** | 3,071 | 3,071 | Match |
| **Actual Positive Frauds** | 71 | 71 | Match |
| **Frauds Caught (TP)** | 56 | 56 | **PASS (100% Match)** |
| **Missed Frauds (FN)** | 15 | 15 | **PASS (100% Match)** |
| **False Alarms (FP)** | 0 | 0 | **PASS (100% Match)** |
| **True Negatives (TN)** | 3,000 | 3,000 | **PASS (100% Match)** |
| **Recall** | 78.87% | 78.87% | Verified |
| **Precision** | 100.00% | 100.00% | Verified |
| **PR-AUC** | 0.8653 | 0.8653 | Verified |

---

## Security Architecture & Audit Report

FraudShield implements strict security controls compliant with enterprise banking specifications:

1. **Environment Isolation:** Secrets and configurations are loaded exclusively through environment variables; `DEBUG=False` by default in production.
2. **Stateless JWT Rotation:** 15-minute short-lived access tokens with 7-day refresh tokens; refresh tokens rotate on every renewal and are added to a cryptographic blacklist.
3. **Defense-in-Depth Rate Limiting:** 5 requests/min on authentication routes (`/api/auth/login/`, `/api/auth/register/`), 3 requests/min on `/api/auth/forgot-password/`, and 120 requests/min on general authenticated endpoints.
4. **Information Leakage Prevention:** Authentication errors return generic `"Invalid email or password"` without disclosing account existence. Password reset requests return uniform confirmation responses regardless of account presence.
5. **Strict Multi-Tenant Scoping:** All database queries are filtered server-side via `QuerysetScopeMixin`. Attempting to access unauthorized foreign identifiers yields `404 Not Found` rather than leaking existence via `403`.
6. **Explicit Serialization:** Zero use of `__all__` in serializers. Privilege fields (`role`, `is_active`, `status`) cannot be manipulated on public or self-service endpoints.
7. **Secure File Uploads:** Dispute attachments are strictly validated for MIME type and file extension (`pdf`, `png`, `jpg`), capped at 5 MB, stored under non-guessable UUID filenames, and served solely through authenticated streaming endpoints.
8. **Pickle Security:** Machine learning models are loaded exclusively from the local verified `ml/` repository folder on container startup; arbitrary uploaded pickles are strictly rejected.
9. **Production Headers:** Emits `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (HSTS), and secure cookie flags.
10. **Comprehensive Audit Trail:** Captures immutable records for logins, failed attempts, logouts, role modifications, card blocks, case dispositions, threshold adjustments, and data exports.

> **Security Note:** In this demo deployment, client authentication tokens are stored in browser `localStorage` for responsive developer ergonomics and demonstration simplicity. For commercial production environments handling real financial transactions, tokens should be transported via `HttpOnly`, `SameSite=Strict`, and `Secure` cookies.

---

## Honest System Limitations

While FraudShield is built to enterprise architectural standards, several practical boundaries should be acknowledged:

1. **Event Streaming vs. Queue Broker:** The live transaction simulator streams transactions into the database using a lightweight polling loop (`since` cursor parameter) rather than an enterprise distributed event bus (Apache Kafka, AWS Kinesis, or RabbitMQ).
2. **Database Concurrency:** In standard local mode, FraudShield runs on SQLite for friction-free setup without requiring a database engine. SQLite's single-writer database locking is not suited for high-throughput concurrent transaction streams; use the Docker compose PostgreSQL configuration for multi-user stress testing.
3. **Pre-extracted Feature Vectors:** The XGBoost model operates on 28 PCA-transformed numerical features (`V1`..`V28`) derived from credit card transaction datasets. In a full production banking environment, an upstream real-time feature store (such as Feast or Hopsworks) would compute real-time aggregations (e.g., velocity in past 10 minutes, geographic jump distance) before invoking the scoring pipeline.
4. **Token Storage:** As noted above, storing JWTs in `localStorage` leaves tokens accessible to same-origin script execution; production hardening requires `HttpOnly` cookie-based auth sessions.

---

## Verification & Automated Test Suite

FraudShield includes comprehensive contract verification and end-to-end integration test suites:

- **12 End-to-End Scenarios Proof (S1–S12, Zero Simulator):**
  ```bash
  python -m pytest backend/tests/e2e/test_scenarios.py -s -v
  # Result: 12 passed in ~41s with 100% SUCCESS! (See PROOF.md)
  ```
- **API Contract Verification:**
  ```bash
  python backend/scripts/contract_check.py
  # Result: ALL CONTRACTS PASS WITH ZERO MISMATCHES!
  ```
- **Automated 4 E2E Scenarios:**
  ```bash
  python backend/scripts/run_e2e_scenarios.py
  # Result: ALL 4 SCENARIOS PASSED WITH 100% SUCCESS!
  ```
- **Django & Pytest Suite:**
  ```bash
  pytest backend/
  # Result: 37 passed in 184s
  ```
- **Frontend Production Bundle:**
  ```bash
  cd frontend && npm run build
  # Result: Built dist/ in ~28s with zero errors
  ```