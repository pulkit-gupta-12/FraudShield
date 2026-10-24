# FraudShield — Frontend API Contract

This document specifies every endpoint called by the frontend services in `frontend/src/services/` and the contract documented in `BACKEND_SPEC.md` and `PROJECT_CONTEXT.md`.
The **frontend is the source of truth**. All JSON keys in requests and responses use **camelCase**, which is converted to/from **snake_case** by the Django REST backend.
Every viewset in the backend enforces **queryset scoping** via `ScopedQuerySetMixin` so users only access authorized records according to their role.

---

## Base URL
- Default: `http://localhost:8000/api`
- Handled by `apiClient.js` with Bearer JWT token header (`Authorization: Bearer <access_token>`).

---

## 1. Authentication (`frontend/src/services/auth.js` & `apiClient.js`)

### 1.1 Login
- **Method:** `POST`
- **URL:** `/api/auth/login/`
- **Roles:** Public
- **Request Body:**
  ```json
  {
    "email": "user@fraudshield.io",
    "password": "password123"
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "email": "user@fraudshield.io",
      "name": "Admin User",
      "role": "admin",
      "status": "active",
      "organisation": "FraudShield HQ",
      "department": "Fraud Operations",
      "city": "Mumbai",
      "phone": "+91 98000 00000",
      "lastLogin": "2026-10-14T10:00:00Z"
    }
  }
  ```

### 1.2 Token Refresh
- **Method:** `POST`
- **URL:** `/api/auth/refresh/`
- **Roles:** Public / Authenticated
- **Request Body:**
  ```json
  {
    "refresh": "eyJhbGciOi..."
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi..."
  }
  ```

### 1.3 Logout
- **Method:** `POST`
- **URL:** `/api/auth/logout/`
- **Roles:** Authenticated (Any role)
- **Request Body:**
  ```json
  {
    "refresh": "eyJhbGciOi..."
  }
  ```
- **Response Shape (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### 1.4 Get Current User Profile
- **Method:** `GET`
- **URL:** `/api/auth/me/`
- **Roles:** Authenticated (admin, analyst, customer, merchant)
- **Response Shape (200 OK):**
  ```json
  {
    "id": 1,
    "email": "user@fraudshield.io",
    "name": "Admin User",
    "role": "admin",
    "status": "active",
    "organisation": "FraudShield HQ",
    "department": "Fraud Operations",
    "city": "Mumbai",
    "phone": "+91 98000 00000",
    "lastLogin": "2026-10-14T10:00:00Z"
  }
  ```

### 1.5 Register User
- **Method:** `POST`
- **URL:** `/api/auth/register/`
- **Roles:** Public
- **Request Body:**
  ```json
  {
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "password": "Password@123",
    "role": "customer",
    "city": "Mumbai",
    "phone": "+91 98000 12345"
  }
  ```
- **Response Shape (201 Created):**
  ```json
  {
    "message": "Registration submitted successfully. Account pending approval.",
    "status": "pending",
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "user": {
      "id": 5,
      "email": "aarav@example.com",
      "name": "Aarav Sharma",
      "role": "customer",
      "status": "pending"
    }
  }
  ```

---

## 2. Transactions (`frontend/src/services/transactions.js`)

### 2.1 List Transactions
- **Method:** `GET`
- **URL:** `/api/transactions/`
- **Roles:** admin, analyst, customer (only their cards' transactions), merchant (only their merchant's transactions)
- **Query Params:**
  - `page` (number, default: 1)
  - `pageSize` (number, default: 20)
  - `search` (string: searches public id, merchant name, city, cardholder name, card last 4)
  - `ordering` (string: camelCase mapped to model fields, e.g. `riskScore`, `-riskScore`, `timestamp`, `-timestamp`, `amount`, `-amount`, `amountINR`, `-amountINR`, `customerName`, `-customerName`. Unknown names rejected with 400 Bad Request)
  - `riskTier` / `band` (string: `ALL`, `safe`, `review`, `high`, `LEGIT`, `SUSPICIOUS`, `FRAUD`)
  - `status` (string: `ALL`, `approved`, `flagged`, `blocked`, `confirmed_fraud`, `confirmed_safe`, `under_review`)
  - `category` (string: merchant category filter)
  - `dateFrom` (ISO date/datetime)
  - `dateTo` (ISO date/datetime)
  - `amountMin` (number)
  - `amountMax` (number)
  - `cardId` (number/string)
  - `userId` / `customerId` (number/string)
  - `merchant` (string)
  - `since` (ISO timestamp: returns only transactions newer than this timestamp; used by live feed)
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": "TXN-000001",
        "publicId": "TXN-000001",
        "cardId": 1,
        "cardNumber": "4532 •••• •••• 8821",
        "cardLast4": "8821",
        "last4": "8821",
        "cardholder": "Aarav Sharma",
        "customerName": "Aarav Sharma",
        "userId": 3,
        "merchant": "Reliance Digital",
        "merchantCategory": "Electronics",
        "category": "Electronics",
        "amount": 14200.0,
        "amountINR": 14200.0,
        "city": "Mumbai",
        "timestamp": "2026-10-14T09:30:00Z",
        "riskScore": 0.045,
        "band": "safe",
        "status": "approved",
        "trueLabel": "LEGIT",
        "scoringMs": 14.2,
        "factors": [
          { "name": "Amount", "impact": -0.15 }
        ],
        "modelInputs": { "Time": 1240.0, "Amount": 157.8 }
      }
    ],
    "count": 1
  }
  ```
  *Note:* `band` is computed dynamically from the CURRENT threshold and review_floor in `ModelConfig`.

### 2.2 Get Transaction Detail
- **Method:** `GET`
- **URL:** `/api/transactions/{id}/`
- **Roles:** admin, analyst, customer (own), merchant (own)
- **Response Shape (200 OK):**
  Transaction object with full `factors` and `scoringMs`. `modelInputs` is included ONLY for admin, analyst, and merchant (omitted for customers).

### 2.3 Update Transaction Status
- **Method:** `PATCH`
- **URL:** `/api/transactions/{id}/status/`
- **Roles:** admin, analyst
- **Request Body:**
  ```json
  {
    "status": "confirmed_fraud",
    "reason": "Customer reported stolen card"
  }
  ```
- **Response Shape (200 OK):** Updated Transaction object.

### 2.4 Export Transactions CSV
- **Method:** `GET`
- **URL:** `/api/transactions/export/`
- **Roles:** admin only (returns 403 for analyst, merchant, customer)
- **Query Params:** Supports all list filters (`status`, `band`, `dateFrom`, `dateTo`, etc.)
- **Audit:** Writes an AuditLog entry with action `TRANSACTIONS_EXPORT_CSV`.
- **Response Shape (200 OK):** `text/csv` stream with header `Content-Disposition: attachment; filename="transactions_export.csv"`.

### 2.5 Submit Real Transaction
- **Method:** `POST`
- **URL:** `/api/transactions/submit/`
- **Roles:**
  - `customer`: own cards only (`source='customer_entry'`)
  - `merchant`: own merchant only (`source='merchant_terminal'`); cards from `/api/pos/cards/`
  - `admin`, `analyst`: any card (`source='staff_entry'`)
- **Throttling:** 30 requests per minute per user.
- **Request Body:**
  ```json
  {
    "cardId": 1,
    "merchantId": 2,
    "amount": 14200.0,
    "city": "Mumbai",
    "occurredAt": "2026-10-25T10:30:00Z",
    "patternId": 9,
    "rawValues": null,
    "note": "Optional demo submission note"
  }
  ```
  *(Note: `rawValues` containing all 30 floats is permitted for admin and analyst only).*
- **Order of Execution:**
  1. Card status check: if not `active`, returns `decision='declined'` with `reason='card_blocked'`, stores transaction as `declined` with `riskScore=null`, writes audit log.
  2. Spending limit check: if amount <= 0 or amount > card.spending_limit, returns `decision='declined'` with `reason='limit_exceeded'`, stores transaction as `declined`, writes audit log.
  3. Feature Translation (`build_features`): maps INR amount to dataset scale (amount / 90.0) and local time to seconds since midnight; merges with pattern V-numbers.
  4. Real Model Scoring: scores with XGBoost, applies dynamic thresholds from `ModelConfig`.
  5. If flagged / review / high: automatically creates Alert, Case with initial timeline event, and notifies analysts & cardholder.
- **Response Shape (200 OK or 201 Created):**
  ```json
  {
    "transaction": {
      "id": "TXN-839210",
      "publicId": "TXN-839210",
      "amount": 14200.0,
      "riskScore": 0.0758,
      "band": "safe",
      "status": "approved"
    },
    "decision": "approved",
    "reason": "approved",
    "riskScore": 0.0758,
    "band": "safe",
    "threshold": 0.521,
    "reviewFloor": 0.5,
    "reasons": [
      "The amount is consistent with typical profile transactions."
    ],
    "factors": [
      { "name": "Amount", "impact": 0.04 }
    ],
    "alertId": null,
    "caseId": null
  }
  ```
  *(Note: `factors` is visible only to admin and analyst; customers and merchants receive friendly sentences in `reasons` without technical V-names).*

### 2.6 Report Transaction (Customer Complaint)
- **Method:** `POST`
- **URL:** `/api/transactions/{id}/report/`
- **Roles:** Card owner only (customer). Allowed once per transaction.
- **Request Body:**
  ```json
  {
    "reason": "not_mine",
    "note": "I did not authorize this charge while card was in my possession."
  }
  ```
  *(Accepted reasons: `not_mine`, `duplicate`, `not_received`, `wrong_amount`, `other`. Note required, max 500 chars).*
- **Actions Triggered:**
  - Creates `CustomerReport` record.
  - Creates `Case` with `source='customer_report'` (enables tracking model misses on approved transactions).
  - Creates `Alert` assigned to fraud investigation team.
  - Creates `Dispute` for merchant with `stage='opened'`.
  - Sends notifications to analysts and merchant.
- **Response Shape (201 Created):**
  ```json
  {
    "success": true,
    "message": "Transaction reported successfully.",
    "reportId": 1,
    "caseId": 12,
    "disputeId": 4,
    "alertId": 15,
    "report": {
      "id": 1,
      "transactionId": "TXN-000001",
      "reason": "not_mine",
      "note": "I did not authorize this charge while card was in my possession.",
      "createdAt": "2026-10-25T11:00:00Z"
    }
  }
  ```

### 2.7 Customer Reports (Mine)
- **Method:** `GET`
- **URL:** `/api/reports/mine/`
- **Roles:** customer
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "transactionId": "TXN-000001",
        "reason": "not_mine",
        "note": "I did not authorize this charge while card was in my possession.",
        "createdAt": "2026-10-25T11:00:00Z",
        "case": {
          "id": 12,
          "status": "In Review",
          "outcome": "none"
        },
        "dispute": {
          "id": 4,
          "stage": "opened",
          "status": "Submitted"
        }
      }
    ],
    "count": 1
  }
  ```

### 2.8 Demo Spending Patterns
- **Method:** `GET`
- **URL:** `/api/patterns/`
- **Roles:** Authenticated (admin, analyst, customer, merchant)
- **Response Shape (200 OK):**
  ```json
  [
    {
      "id": 9,
      "code": "P09",
      "label": "Late Night Electronics",
      "typicalAmount": 10553.40,
      "typicalTime": "10:26",
      "trueLabel": 0,
      "baseScore": 0.0758
    }
  ]
  ```
  *(Note: `trueLabel` and `baseScore` are returned only for admin and analyst).*

### 2.9 POS Masked Cards
- **Method:** `GET`
- **URL:** `/api/pos/cards/`
- **Roles:** merchant, admin, analyst
- **Response Shape (200 OK):**
  ```json
  [
    {
      "id": 1,
      "brand": "Visa",
      "last4": "8821",
      "holderFirstName": "Aarav"
    }
  ]
  ```

---

## 3. Alerts (`frontend/src/services/alerts.js`)

### 3.1 List Alerts
- **Method:** `GET`
- **URL:** `/api/alerts/`
- **Roles:** admin, analyst, customer (own cards' alerts only)
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `status`, `severity`, `userId`, `customerId`, `customerName`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "transactionId": "TXN-000001",
        "customerName": "Aarav Sharma",
        "userId": 3,
        "merchant": "Reliance Digital",
        "amountINR": 14200.0,
        "severity": "high",
        "status": "new",
        "assignee": "analyst@fraudshield.io",
        "customerResponse": "none",
        "timestamp": "2026-10-14T09:30:00Z"
      }
    ],
    "count": 1
  }
  ```

### 3.2 Update Alert
- **Method:** `PATCH`
- **URL:** `/api/alerts/{id}/`
- **Roles:** admin, analyst, customer (for their own alerts)
- **Request Body:**
  - Analysts: `{ "status": "in_review", "assignee": "analyst@fraudshield.io" }`
  - Customers: `{ "customerResponse": "confirmed_me" | "not_me" }` (or `{ "status": "safe_confirmed" | "fraud_confirmed" }`)
- **Rules:**
  - When customer answers `not_me` (or `fraud_confirmed`): alert becomes `escalated`, corresponding case becomes `Escalated`, all analysts are notified, and a timeline event is written to the case.
  - When customer answers `confirmed_me` (or `safe_confirmed`): alert resolved, transaction status becomes `confirmed_safe`, case closed with outcome `safe`.
- **Response Shape (200 OK):** Updated Alert object.

### 3.3 Bulk Actions on Alerts
- **Method:** `POST`
- **URL:** `/api/alerts/bulk/`
- **Roles:** admin, analyst
- **Request Body:**
  ```json
  {
    "action": "assign",
    "alertIds": [1, 2, 3],
    "assignee": "analyst@fraudshield.io"
  }
  ```
  *or*
  ```json
  {
    "action": "resolve",
    "alertIds": [1, 2, 3]
  }
  ```
- **Execution:** Executed inside a single atomic database transaction.
- **Response Shape (200 OK):**
  ```json
  {
    "updatedCount": 3
  }
  ```

---

## 4. Cases (`frontend/src/services/cases.js`)

### 4.1 List Cases
- **Method:** `GET`
- **URL:** `/api/cases/`
- **Roles:** admin, analyst (merchant gets 403, customer gets 403 or empty)
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `status`, `priority`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "caseId": "CASE-1001",
        "transactionId": "TXN-000001",
        "customerName": "Aarav Sharma",
        "status": "Open",
        "priority": "P1",
        "outcome": "none",
        "assignedTo": "Analyst User",
        "createdAt": "2026-10-14T09:30:00Z",
        "updatedAt": "2026-10-14T09:30:00Z"
      }
    ],
    "count": 1
  }
  ```

### 4.2 Get Case Detail
- **Method:** `GET`
- **URL:** `/api/cases/{id}/`
- **Roles:** admin, analyst
- **Response Shape (200 OK):**
  ```json
  {
    "id": 1,
    "caseId": "CASE-1001",
    "transactionId": "TXN-000001",
    "status": "Open",
    "priority": "P1",
    "outcome": "none",
    "assignedTo": "Analyst User",
    "createdAt": "2026-10-14T09:30:00Z",
    "updatedAt": "2026-10-14T09:30:00Z",
    "transaction": { ... },
    "cardholder": {
      "id": 3,
      "name": "Aarav Sharma",
      "email": "aarav@example.com",
      "phone": "+91 98000 12345",
      "city": "Mumbai"
    },
    "card": {
      "id": 1,
      "cardNumber": "4532 •••• •••• 8821",
      "last4": "8821",
      "brand": "Visa",
      "status": "active"
    },
    "last5Transactions": [ ... ],
    "notes": [
      {
        "id": 1,
        "author": "Analyst User",
        "text": "Investigating unusual spike",
        "createdAt": "2026-10-14T09:40:00Z"
      }
    ],
    "timeline": [
      {
        "id": 1,
        "action": "Case Created",
        "user": "System",
        "note": "Transaction flagged by ML model",
        "timestamp": "2026-10-14T09:30:00Z"
      }
    ]
  }
  ```

### 4.3 Add Case Note
- **Method:** `POST`
- **URL:** `/api/cases/{id}/notes/`
- **Roles:** admin, analyst
- **Request Body:**
  ```json
  {
    "text": "Cardholder verified authorization via 2FA."
  }
  ```
- **Response Shape (201 Created):**
  ```json
  {
    "id": 2,
    "author": "Analyst User",
    "text": "Cardholder verified authorization via 2FA.",
    "createdAt": "2026-10-14T10:00:00Z"
  }
  ```

### 4.4 Case Action / Status Transition
- **Method:** `POST /api/cases/{id}/action/` (or `PATCH /api/cases/{id}/status/`)
- **Roles:** admin, analyst (merchant gets 403)
- **Request Body:**
  ```json
  {
    "action": "fraud",
    "note": "Confirmed stolen card pattern; blocking immediately."
  }
  ```
  *(or `{ "status": "Confirmed Fraud" | "Confirmed Safe" | "Escalated", "reason": "..." }`)*
- **Validation & Rules:**
  - A note / reason is **REQUIRED** for every action. Missing note returns 400 Bad Request.
  - Invalid transitions return 400 Bad Request.
  - **Action `fraud` / status `Confirmed Fraud`**: transaction becomes `confirmed_fraud`, card is automatically blocked (`status='blocked'`), associated alert is resolved, cardholder is notified.
  - **Action `safe` / status `Confirmed Safe`**: transaction becomes `confirmed_safe`, associated alert is resolved, case closed with outcome `safe`.
  - **Action `escalate` / status `Escalated`**: case status becomes `Escalated`, priority bumped to P1.
  - Every action writes a timeline event and an audit log entry.
- **Response Shape (200 OK):** Updated Case object.

---

## 5. Cards (`frontend/src/services/cards.js`)

### 5.1 List Cards
- **Method:** `GET`
- **URL:** `/api/cards/`
- **Roles:** customer (only their own cards), admin (all cards)
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `userId`, `status`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "userId": 3,
        "cardNumber": "4532 •••• •••• 8821",
        "last4": "8821",
        "cardType": "Visa Platinum",
        "brand": "Visa",
        "holderName": "Aarav Sharma",
        "expiry": "08/28",
        "status": "active",
        "spendingLimit": 150000.0,
        "travelNotice": false
      }
    ],
    "count": 1
  }
  ```

### 5.2 Update Card (Owner or Admin)
- **Method:** `PATCH`
- **URL:** `/api/cards/{id}/` (or `/api/cards/{id}/status/`)
- **Roles:** customer (owner only — 404 for other users' cards), admin
- **Request Body:**
  ```json
  {
    "status": "blocked",
    "spendingLimit": 200000.0,
    "travelNotice": true
  }
  ```
- **Rules & Invariants:**
  - `status`: Must be `"active"` or `"blocked"`. Blocking or unblocking writes an `AuditLog` entry (`CARD_BLOCKED` or `CARD_UNBLOCKED`) and triggers a `Notification` to the cardholder.
  - `spendingLimit`: Must be a positive number (> 0) with a maximum of 10,000,000 INR.
  - `travelNotice`: Boolean flag.
  - **Blocked Card Transaction Invariant**: Any transaction processed or created on a card with `status == "blocked"` is automatically saved with `status = "blocked"` and high risk band.
- **Response Shape (200 OK):** Updated Card object.

### 5.3 Issue Card (Admin Only)
- **Method:** `POST`
- **URL:** `/api/cards/`
- **Roles:** admin
- **Request Body:**
  ```json
  {
    "ownerId": 3,
    "brand": "Visa",
    "cardType": "Visa Platinum",
    "spendingLimit": 150000.0
  }
  ```
- **Rules & Invariants:**
  - Auto-generates a unique 4-digit `last4` for the cardholder.
  - Generates full masked card number `•••• •••• •••• {last4}`.
  - Automatically calculates expiry date (4 years forward).
  - Emits `AuditLog` entry with action `CARD_ISSUED`.
- **Response Shape (201 Created):**
  ```json
  {
    "id": 5,
    "userId": 3,
    "cardNumber": "•••• •••• •••• 9241",
    "last4": "9241",
    "cardType": "Visa Platinum",
    "brand": "Visa",
    "holderName": "Aarav Sharma",
    "expiry": "10/30",
    "status": "active",
    "spendingLimit": 150000.0,
    "travelNotice": false
  }
  ```

---

## 6. Disputes (`frontend/src/services/disputes.js`)

### 6.1 List Disputes
- **Method:** `GET`
- **URL:** `/api/disputes/`
- **Roles:** merchant (own merchant only), admin (all), customer (own)
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `status`, `customerId`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "disputeId": "DSP-1001",
        "transactionId": "TXN-000001",
        "customerId": 3,
        "customerName": "Aarav Sharma",
        "amountINR": 14200.0,
        "reason": "Fraudulent charge",
        "status": "Submitted",
        "stage": "opened",
        "outcome": "",
        "filedAt": "2026-10-14T10:00:00Z",
        "evidenceNotes": "Card was cloned"
      }
    ],
    "count": 1
  }
  ```

### 6.2 Create Dispute
- **Method:** `POST`
- **URL:** `/api/disputes/`
- **Roles:** customer
- **Request Body:**
  ```json
  {
    "transactionId": "TXN-000001",
    "customerId": 3,
    "customerName": "Aarav Sharma",
    "amountINR": 14200.0,
    "reason": "Fraudulent transaction",
    "evidenceNotes": "Card was cloned"
  }
  ```
- **Response Shape (201 Created):** Created Dispute object. Automatically notifies merchant and fraud analysts.

### 6.3 Upload Dispute Evidence
- **Method:** `POST`
- **URL:** `/api/disputes/{id}/evidence/`
- **Roles:** merchant (own), customer (own), admin
- **Request Body:** `multipart/form-data` with:
  - `files`: list of file binaries (PDF, PNG, JPG only)
  - `notes`: optional string
- **Validation & Security Rules:**
  - Files allowed: `.pdf`, `.png`, `.jpg`, `.jpeg`.
  - Signature verification: real magic bytes verified (`%PDF-`, `\x89PNG`, `\xff\xd8\xff`). Fake extensions rejected with 400 Bad Request.
  - Max file size: 5 MB (5,242,880 bytes).
  - Storage: saved under `MEDIA_ROOT/evidence/` with a cryptographically secure random UUID filename.
  - Automatically notifies the opposite party.
- **Response Shape (200 OK):** Updated Dispute object with attached `evidenceFiles`.

### 6.4 Download Dispute Evidence (Authenticated)
- **Method:** `GET`
- **URL:** `/api/disputes/{id}/evidence/{evidenceId}/`
- **Roles:** Authenticated (owner merchant, customer, or admin only; 404 for unauthorized users)
- **Response:** File stream with proper mime-type and `Content-Disposition`. Direct unauthenticated file serving is blocked.

### 6.5 Advance Dispute Stage
- **Method:** `POST`
- **URL:** `/api/disputes/{id}/advance/`
- **Roles:** Owning merchant or admin only. (Other roles receive 403 Forbidden).
- **Request Body:**
  ```json
  {
    "outcome": "merchant_won"
  }
  ```
- **Rules & Invariants:**
  - Ordered sequence: `opened` -> `evidence` -> `review` -> `resolved`.
  - Only an **admin** may set the final `outcome` and advance to `resolved`. Merchants attempting to resolve receive 403 Forbidden.
  - Cross-notification: automatically notifies the customer when merchant advances, or customer & merchant when admin advances.
  - Generates forensic `AuditLog` entry.
- **Response Shape (200 OK):** Updated Dispute object.

---

## 7. Model & Prediction (`frontend/src/services/model.js` & `predict.js`)

### 7.1 Single Fraud Prediction
- **Method:** `POST`
- **URL:** `/api/predict/`
- **Roles:** admin, analyst, merchant
- **Request Body:**
  ```json
  {
    "transactionId": "TXN-000001"
  }
  ```
  *or*
  ```json
  {
    "features": {
      "Time": 1240.0,
      "V1": -1.2,
      "V2": 0.5,
      "...": "...",
      "Amount": 15000.0
    }
  }
  ```
- **Validation & Scoping:**
  - When called with `transactionId`: scores the stored row. `trueLabel` is returned ONLY to admin and analyst (omitted for merchant).
  - When called with `features`: validates that all 30 features are present and numeric. Does NOT save to the database.
- **Response Shape (200 OK):**
  ```json
  {
    "riskScore": 0.082,
    "band": "safe",
    "actionRecommended": "APPROVE",
    "modelLatencyMs": 14.2,
    "modelVersion": "v1.2.0-xgb",
    "threshold": 0.521,
    "reviewFloor": 0.5,
    "trueLabel": "LEGIT",
    "factors": [
      {
        "feature": "Amount",
        "name": "Amount (unusually high or low)",
        "impact": 0.32,
        "direction": "risk_increasing"
      }
    ]
  }
  ```

### 7.2 Batch Predict CSV
- **Method:** `POST`
- **URL:** `/api/predict/batch/`
- **Roles:** admin, analyst
- **Request Body:** `multipart/form-data` with `file` (CSV file)
- **Validation:**
  - Maximum size: 5 MB.
  - Maximum row count: 5,000 rows.
  - Never trusts file names or Content-Type headers alone; validates CSV content and ensures all 30 feature columns are present and numeric. Returns 400 Bad Request on invalid data.
- **Response Shape (200 OK):**
  ```json
  {
    "processedCount": 100,
    "flaggedCount": 8,
    "fraudCount": 3,
    "summary": {
      "processedCount": 100,
      "flaggedCount": 8,
      "fraudCount": 3
    },
    "results": [
      {
        "rowIndex": 1,
        "riskScore": 0.92,
        "band": "high",
        "factors": []
      }
    ]
  }
  ```

### 7.3 Predict Samples
- **Method:** `GET`
- **URL:** `/api/predict/samples/`
- **Roles:** admin, analyst
- **Response Shape (200 OK):**
  Array of 200 sample transactions (mixed fraud and normal) from the test sample dataset, without the true label (`Class` stripped).

### 7.4 Simulator Tick
- **Method:** `POST`
- **URL:** `/api/simulator/tick/`
- **Roles:** admin, analyst
- **Behavior:** Creates ONE real new transaction through `process_transaction()` (skipping blocked cards), so alerts, cases, and notifications appear for real. Reuses the creation function from `run_simulator`.
- **Response Shape (200 OK):** Created & scored Transaction object.

### 7.5 Model Information
- **Method:** `GET`
- **URL:** `/api/model/info/`
- **Roles:** admin, analyst, merchant (frontend loads threshold and reviewFloor from here once after login)
- **Response Shape (200 OK):**
  ```json
  {
    "threshold": 0.521,
    "reviewFloor": 0.5,
    "modelVersion": "v1.2.0-xgb",
    "version": "v1.2.0-xgb",
    "algorithm": "XGBoost Classifier (PCA 28 + Time + Amount)",
    "scalePosWeight": 577.88,
    "dataset": { ... },
    "datasetInfo": { ... },
    "metrics": {
      "aucRoc": 0.982,
      "precision": 0.914,
      "recall": 0.887,
      "f1Score": 0.900
    },
    "confusionMatrix": {
      "truePositive": 436,
      "falsePositive": 41,
      "trueNegative": 284274,
      "falseNegative": 56
    },
    "prCurve": [ ... ],
    "featureImportance": [
      { "feature": "V14", "importance": 0.28 }
    ],
    "comparison": [ ... ]
  }
  ```

### 7.6 What-If Simulation
- **Method:** `GET`
- **URL:** `/api/model/what-if/`
- **Roles:** admin
- **Query Params:** `threshold` (float, optional; defaults to active `ModelConfig.threshold`)
- **Calculation:** Computes `flagged`, `caught`, `falseAlarms`, `precision`, and `recall` from stored transactions with `true_label` using numpy in a single database query.
- **Response Shape (200 OK):**
  ```json
  {
    "threshold": 0.521,
    "totalEvaluated": 3071,
    "flagged": 56,
    "caught": 56,
    "falseAlarms": 0,
    "precision": 1.0,
    "recall": 0.7887
  }
  ```

### 7.7 Update Model Thresholds
- **Method:** `PUT /api/model/threshold/` (and `PATCH /api/model/thresholds/`)
- **Roles:** admin only (analyst, merchant, customer get 403 Forbidden)
- **Request Body:**
  ```json
  {
    "threshold": 0.65,
    "reviewFloor": 0.45
  }
  ```
  *(or `{ "fraud": 0.65, "suspicious": 0.45 }`)*
- **Validation:**
  - `threshold` must be between 0.05 and 0.99.
  - Optional `reviewFloor` must be between 0.1 and the specified `threshold`.
  - Updates `ModelConfig` immediately so all subsequent band and status logic reads the new threshold.
  - Writes an AuditLog entry.
  - Sends a Notification to all admins.
- **Response Shape (200 OK):**
  ```json
  {
    "threshold": 0.65,
    "reviewFloor": 0.45,
    "fraudThreshold": 0.65,
    "suspiciousThreshold": 0.45,
    "message": "Model thresholds updated successfully."
  }
  ```

### 7.8 System / Model Config
- **Method:** `GET`
- **URL:** `/api/model/config/`
- **Roles:** admin, analyst
- **Response Shape (200 OK):**
  ```json
  {
    "threshold": 0.521,
    "reviewFloor": 0.5,
    "suspiciousThreshold": 0.5,
    "fraudThreshold": 0.521,
    "autoBlockScore": 0.521,
    "enableRealTimeScoring": true
  }
  ```

---

## 8. Dashboard Statistics (`frontend/src/services/stats.js`)

All stats endpoints support the `range` parameter (`7d`, `30d`, `90d`) and enforce role-based scoping using database-level aggregations (`Count`, `Sum`, `TruncDate`, `ExtractHour`). No Python loops over all rows.

### 8.1 Overview Stats
- **Method:** `GET`
- **URL:** `/api/stats/overview/`
- **Roles:** admin, analyst, merchant (merchant-scoped), customer (customer-scoped)
- **Query Params:** `range` (string: `7d`, `30d`, `90d`; default: `30d`)
- **Response Shape (200 OK):**
  ```json
  {
    "totalTransactions": 3071,
    "transactionsToday": 42,
    "fraudCount": 56,
    "fraudDetected": 56,
    "suspiciousCount": 12,
    "legitCount": 3003,
    "fraudRate": 1.82,
    "fraudVolumeINR": 1420500.0,
    "totalVolumeINR": 98450000.0,
    "amountSaved": 1420500.0,
    "moneyProtected": 1420500.0,
    "confirmedFraud": 56,
    "falseAlarms": 12,
    "missedFraud": 2,
    "avgReviewMinutes": 24.5,
    "avgDetectionMs": 14.5,
    "activeAlerts": 14,
    "openAlerts": 14,
    "openCases": 8,
    "activeCards": 320,
    "trend": {
      "transactionsTrend": 5.2,
      "fraudRateTrend": -0.4,
      "amountSavedTrend": 12.1
    }
  }
  ```

### 8.2 Timeseries Trends
- **Method:** `GET`
- **URL:** `/api/stats/timeseries/`
- **Roles:** admin, analyst, merchant
- **Query Params:** `range` (`7d`, `30d`, `90d`) or `days` (number)
- **Aggregation:** Groups transactions by date via SQL `TruncDate`.
- **Response Shape (200 OK):**
  ```json
  [
    {
      "date": "14 Oct",
      "total": 45,
      "fraud": 2,
      "suspicious": 5
    }
  ]
  ```

### 8.3 Hourly Distribution
- **Method:** `GET`
- **URL:** `/api/stats/by-hour/`
- **Roles:** admin, analyst
- **Aggregation:** Groups transactions by hour of day (0–23) via SQL `ExtractHour`.
- **Response Shape (200 OK):**
  ```json
  [
    {
      "hour": 0,
      "label": "00:00",
      "total": 12,
      "fraud": 1
    }
  ]
  ```

### 8.4 Spending & Fraud by Category
- **Method:** `GET`
- **URL:** `/api/stats/by-category/`
- **Roles:** admin, analyst
- **Aggregation:** Grouped by `merchant_category`.
- **Response Shape (200 OK):**
  ```json
  [
    {
      "category": "Electronics",
      "total": 350,
      "fraud": 12,
      "fraudRate": 3.4,
      "volumeINR": 4200000.0
    }
  ]
  ```

### 8.5 Risk Distribution
- **Method:** `GET`
- **URL:** `/api/stats/risk-distribution/`
- **Roles:** admin, analyst
- **Response Shape (200 OK):**
  ```json
  [
    { "band": "Approved", "count": 3003, "color": "#16a34a" },
    { "band": "Needs review", "count": 12, "color": "#d97706" },
    { "band": "Likely fraud", "count": 56, "color": "#dc2626" }
  ]
  ```

### 8.6 Analyst Performance
- **Method:** `GET`
- **URL:** `/api/stats/analyst/`
- **Roles:** admin, analyst
- **Response Shape (200 OK):**
  ```json
  [
    {
      "analystId": 2,
      "analystName": "Pooja Verma",
      "totalCases": 48,
      "resolved": 42,
      "avgResolutionHrs": 3.8
    }
  ]
  ```

### 8.7 Merchant Stats
- **Method:** `GET`
- **URL:** `/api/stats/merchant/`
- **Roles:** admin, analyst, merchant (merchant sees own stats)
- **Query Params:** `limit` (number, default: 6)
- **Response Shape (200 OK):**
  ```json
  [
    {
      "merchant": "QuickCash Jewelers",
      "fraudRate": 14.2,
      "fraudCount": 18,
      "totalCount": 127,
      "volumeINR": 3500000.0
    }
  ]
  ```

### 8.8 Customer Stats
- **Method:** `GET`
- **URL:** `/api/stats/customer/`
- **Roles:** customer (scoped to own cards), admin
- **Response Shape (200 OK):**
  ```json
  {
    "totalSpentINR": 84200.0,
    "transactionCount": 18,
    "activeCardsCount": 2,
    "flaggedCount": 1,
    "disputesCount": 0
  }
  ```

---

## 9. Users & RBAC Administration (`frontend/src/services/users.js`)

### 9.1 List Users
- **Method:** `GET`
- **URL:** `/api/users/`
- **Roles:** admin only
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `role`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "name": "Admin User",
        "email": "admin@fraudshield.io",
        "role": "admin",
        "status": "active",
        "department": "Operations",
        "city": "Mumbai",
        "phone": "+91 98000 00000",
        "lastLogin": "2026-10-14T10:00:00Z"
      }
    ],
    "count": 1
  }
  ```

### 9.2 Create User
- **Method:** `POST`
- **URL:** `/api/users/`
- **Roles:** admin
- **Request Body:**
  ```json
  {
    "email": "analyst.new@fraudshield.io",
    "name": "New Analyst",
    "role": "analyst",
    "department": "Risk Operations",
    "city": "Mumbai"
  }
  ```
- **Rules:** Email must be unique. Generates a cryptographically strong temporary password returned once in `temporaryPassword`. Creates forensic audit log.
- **Response Shape (201 Created):**
  ```json
  {
    "id": 12,
    "email": "analyst.new@fraudshield.io",
    "name": "New Analyst",
    "role": "analyst",
    "department": "Risk Operations",
    "city": "Mumbai",
    "status": "active",
    "isActive": true,
    "temporaryPassword": "X7!b9Q#mP$2v"
  }
  ```

### 9.3 Update User & Invariant Rules
- **Method:** `PATCH`
- **URL:** `/api/users/{id}/` (or `/api/users/{id}/role/`, `/api/users/{id}/status/`)
- **Roles:** admin
- **Request Body:**
  ```json
  {
    "role": "analyst",
    "isActive": false
  }
  ```
- **Invariants & Protection Rules:**
  1. An admin cannot deactivate (`isActive: false` / `status: "suspended"`) or demote (`role != "admin"`) themselves.
  2. The last active administrator in the system can never be removed, deactivated, or demoted. Violations return 400 Bad Request.
  3. Every status or role modification writes an immutable `AuditLog` entry.
- **Response Shape (200 OK):** Updated User object.

### 9.4 Access Requests
- **List Access Requests:** `GET /api/users/access-requests/` (admin only). Returns list of pending user registrations.
- **Approve Access Request:** `POST /api/users/{id}/approve/` (admin only). Activates user (`status: "active"`, `isActive: true`), triggers in-app notification to the approved user, and logs audit record.
- **Reject Access Request:** `POST /api/users/{id}/reject/` (admin only). Sets `status: "rejected"`, `isActive: false`, logs audit record.

---

## 10. Notifications (`frontend/src/services/notifications.js`)

### 10.1 List Notifications
- **Method:** `GET`
- **URL:** `/api/notifications/`
- **Roles:** Authenticated (scoped strictly to the logged-in user's notifications)
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "type": "alert",
        "title": "High Risk Transaction Flagged",
        "body": "Transaction TXN-000001 at Reliance Digital was blocked.",
        "link": "/analyst/investigate?id=TXN-000001",
        "read": false,
        "isRead": false,
        "createdAt": "2026-10-14T09:35:00Z"
      }
    ],
    "count": 1,
    "unreadCount": 1
  }
  ```

### 10.2 Mark Notification Read
- **Method:** `PATCH`
- **URL:** `/api/notifications/{id}/read/` (or `PATCH /api/notifications/{id}/` with `{ "isRead": true }`)
- **Roles:** Authenticated (owner)
- **Response Shape (200 OK):** Updated Notification object.

### 10.3 Mark All Read
- **Method:** `POST`
- **URL:** `/api/notifications/mark-all-read/` (or `POST /api/notifications/read-all/`)
- **Roles:** Authenticated
- **Response Shape (200 OK):** `{ "success": true, "unreadCount": 0 }`.

### 10.4 Notification Generation Triggers
Notifications are automatically dispatched for:
- New alert (customer)
- Case escalation and decisions (analysts and customer)
- Dispute events (creation, evidence upload, stage transitions)
- Threshold changes (all active admins)
- Access requests (all active admins upon registration)

---

## 11. Audit Logs (`frontend/src/services/auditLogs.js` & `reports.js`)

### 11.1 List Audit Logs
- **Method:** `GET`
- **URL:** `/api/audit-logs/`
- **Roles:** admin
- **Query Params:** `page`, `pageSize`, `search`, `ordering`, `user` (or `userId`), `action`, `status`, `dateFrom`, `dateTo`
- **Response Shape (200 OK):**
  ```json
  {
    "results": [
      {
        "id": 1,
        "createdAt": "2026-10-14T10:00:00Z",
        "actor": "admin@fraudshield.io",
        "role": "admin",
        "action": "CONFIG_UPDATE",
        "target": "ModelConfig",
        "ipAddress": "127.0.0.1",
        "status": "SUCCESS",
        "details": { "threshold": 0.521 }
      }
    ],
    "count": 1
  }
  ```

### 11.2 Export Audit Logs (CSV)
- **Method:** `GET`
- **URL:** `/api/audit-logs/export/` (or `GET /api/audit-logs/?format=csv`)
- **Roles:** admin
- **Auditing:** Every export call writes an immutable `AuditLog` entry (`action: "AUDIT_LOG_EXPORTED"`).
- **Response:** CSV attachment `audit_logs.csv`.

---

## 12. Reports Builder (`frontend/src/services/reports.js`)

### 12.1 Report Builder
- **Method:** `GET`
- **URL:** `/api/reports/`
- **Query Params:**
  - `type`: Report type (required)
  - `dateFrom`: Start timestamp / date (optional)
  - `dateTo`: End timestamp / date (optional)
  - `format`: `json` (default) or `csv`
- **Role Scoping & Report Types:**
  - **Admin**: `daily_summary`, `fraud_by_category`, `analyst_performance`, `model_performance`
  - **Merchant**: `merchant_summary`, `merchant_chargebacks` (scoped strictly to user's merchant)
  - Non-authorized roles receive 403 Forbidden.
- **Response Shape (200 OK — JSON):**
  ```json
  {
    "columns": ["date", "totalTransactions", "totalAmount", "fraudTransactions", "fraudAmount", "flaggedCount", "blockedCount"],
    "rows": [
      {
        "date": "2026-10-14",
        "totalTransactions": 150,
        "totalAmount": 450000.0,
        "fraudTransactions": 3,
        "fraudAmount": 28000.0,
        "flaggedCount": 8,
        "blockedCount": 3
      }
    ],
    "chart": {
      "type": "line",
      "labels": ["2026-10-14"],
      "datasets": [
        { "name": "Total Transactions", "data": [150] },
        { "name": "Fraud Transactions", "data": [3] }
      ]
    }
  }
  ```
- **Response Shape (200 OK — CSV):** When `format=csv`, returns direct CSV stream attachment `report_{type}.csv`.

---

## 13. Interactive API Documentation (`drf-spectacular`)

### 13.1 Swagger UI & Schema
- **Interactive Swagger UI:** `GET /api/docs/`
- **OpenAPI 3.0 Schema:** `GET /api/schema/`
- **Availability:** Active and accessible strictly when `DEBUG = True`. Returns 404 Not Found in production when `DEBUG = False`.

---

## 14. Health Check
- **Method:** `GET`
- **URL:** `/api/health/`
- **Roles:** Public
- **Response Shape (200 OK):**
  ```json
  {
    "status": "healthy",
    "modelLoaded": true,
    "modelVersion": "v1.2.0-xgb"
  }
  ```

---

## 15. Merchants (`GET, POST, PATCH /api/merchants/`)

### 15.1 List Merchants
- **Method:** `GET`
- **URL:** `/api/merchants/`
- **Roles:** admin, analyst, merchant
- **Response Shape (200 OK):**
  ```json
  [
    {
      "id": 1,
      "name": "Reliance Digital",
      "category": "Electronics",
      "city": "Mumbai",
      "active": true,
      "isActive": true,
      "createdAt": "2026-10-24T18:00:00Z"
    }
  ]
  ```

### 15.2 Create Merchant (Admin Only)
- **Method:** `POST`
- **URL:** `/api/merchants/`
- **Roles:** admin
- **Request Body:**
  ```json
  {
    "name": "Titan Watch Co",
    "category": "Fashion",
    "city": "Bengaluru",
    "active": true
  }
  ```
- **Response Shape (201 Created):** Created Merchant object. Emits `AuditLog` entry.

### 15.3 Update Merchant (Admin Only)
- **Method:** `PATCH`
- **URL:** `/api/merchants/{id}/`
- **Roles:** admin
- **Request Body:**
  ```json
  {
    "city": "Hyderabad",
    "active": true
  }
  ```
- **Response Shape (200 OK):** Updated Merchant object. Emits `AuditLog` entry.
