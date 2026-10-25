# FraudShield – Screen Specifications

> **Section 4 — Comprehensive Page-by-page UI Spec.**
> All screens connect directly to the real Django REST backend and XGBoost model via `src/services` and `apiClient` with `VITE_USE_MOCK=false`.

---

## Global & Layout Components

### Topbar & Navigation
- **Role-scoped Search Bar**: Queries real backend (`/api/transactions/`, `/api/cases/`) across transaction ID, cardholder, merchant, card last 4. Results appear in a live dropdown; clicking a result opens the corresponding transaction drawer or case detail modal.
- **Notification Bell**: Polls every 10 seconds and on tab focus (`/api/notifications/`). When unread notifications increase, a toast banner alerts the user.
- **Role Scoping & Badges**: Clean header without mock demo chips in production/real mode.

### Reusable Core Components
- **`PaymentForm`** (`components/payment/PaymentForm.jsx`):
  - Used across Customer (`/customer/pay`), Merchant POS (`/merchant/terminal`), and Staff Checker (`/checker`).
  - Fields:
    - Card selection (customer cards or POS test cards)
    - Merchant (select registered merchant or enter custom name + pick category)
    - Amount in INR (validated positive number)
    - City (autocomplete suggestions with Indian metro and tier-1 cities)
    - Date and time (defaults to current timestamp, editable)
    - Spending pattern dropdown (select P01..P20 from `GET /api/patterns/` with informative tooltip: *"The dataset hides real card details. Patterns are real anonymised behaviours. Amount and time are fully your input."*)
    - Staff mode options: Collapsible "Advanced" section to paste all 30 raw numeric values (`Time`, `V1..V28`, `Amount`), and a toggle switch *"Save as a real transaction and open a case if flagged"* (defaults to OFF).
    - Clear validation error display and submit button loading state.
- **`ResultPanel`** (`components/payment/ResultPanel.jsx`):
  - Large decision banner with accessible badge:
    - Green: **Approved**
    - Amber: **Needs Review** (under threshold, above review floor)
    - Red: **Blocked** (high risk fraud detected)
    - Slate/Grey: **Declined** (card limit exceeded or inactive card) with plain-language decline reason
  - **RiskMeter**: Live probability arc with dynamic threshold and review-floor markers supplied by `ModelConfigContext`.
  - **Plain-language reasons list**: Clear human explanations for the score or decline.
  - **FactorsChart** (Staff mode only): Horizontal SHAP-like feature contribution bars.
  - Role-based action buttons: *"View alert"*, *"View case"*, *"Make another payment"*.

---

## Customer Pages (`/customer/*`)

### `/customer/pay` — "Use My Card" (New Screen / Sidebar)
- Quick payment entry point for authenticated customers.
- Employs `PaymentForm` pre-populated with customer's active cards.
- Submits to `POST /api/transactions/submit/` and displays `ResultPanel`.
- When scored as `review` or `blocked`, displays a dedicated banner: *"We sent you an alert"* with a direct action button to `/customer/alerts`.

### `/customer/transactions` — "My Transactions" (S17)
- Real transaction history table polling every 10 seconds and on tab focus, with subtle highlight animation on new transactions.
- **Transaction Drawer (S17)**:
  - Slide-over drawer showing complete transaction timeline and risk status.
  - Includes **"Report this transaction"** button for every non-declined transaction.
  - Report Modal: Reason selector (`unauthorized`, `incorrect_amount`, `duplicate_charge`, `goods_not_received`, `other`) and required note (up to 500 characters).
  - Submits to `POST /api/transactions/{id}/report/` with a success toast.
  - Reported transactions display an amber **"Reported"** chip.

### `/customer/alerts` — "Security Alerts & Reports" (S18)
- Tab 1: **Active Alerts** — High-risk transactions requiring cardholder confirmation.
- Tab 2: **My Reports** — Lists all transactions reported by the customer.
  - Displays linked transaction ID, merchant, reported timestamp, reason, and customer note.
  - Shows live case status (`Investigation In Progress`, `Resolved`, etc.).
  - Shows merchant dispute stage via a live 4-step `Stepper` (1: Reported → 2: Merchant Evidence → 3: Under Review → 4: Final Outcome).

---

## Merchant Pages (`/merchant/*`)

### `/merchant/terminal` — "New Sale Terminal" (New Screen / Sidebar)
- POS-style virtual payment terminal for counter and online sales.
- Employs `PaymentForm` configured for POS:
  - Masked test card selector (`GET /api/pos/cards/`)
  - Amount in INR, Indian city suggestions, item/order description
  - Pattern selection and real-time validation
- Interactive `ResultPanel` showing immediate decision (Approved / Declined / Flagged).
- **Recent sales from this terminal**: Live table below the form polling every 10 seconds and on window focus.

### `/merchant/overview` — "Merchant Dashboard" (S19)
- Real KPIs: Today's Volume, Fraud Rate %, Blocked Revenue, Open Disputes.
- Transaction volume and fraud distribution charts.
- Quick navigation to Terminal and Chargebacks.

### `/merchant/chargebacks` — "Disputes & Chargebacks" (S21)
- Disputes DataTable polling every 10 seconds and on tab focus.
- **Dispute Drawer (S21)**:
  - Slide-over detail panel showing customer's report reason and full note.
  - Linked transaction details and cardholder info.
  - **Evidence Files**: Authenticated download links for all submitted documentation.
  - **Advance Stage Button**: Allows merchants/analysts to progress dispute stages through the workflow.

---

## Analyst Pages (`/analyst/*`)

### `/analyst/dashboard` — "Analyst Command Center" (S12)
- Real decision KPIs: Open Cases, Cases Resolved, Avg Risk Score, High-Risk Volume.
- **Zero-State Banner**: When no transactions exist on a fresh database, displays:
  > *"No activity yet. Make a payment as a customer to see alerts here."* with a direct link to `/checker`.
- Flagged transactions trend charts and recent case queue.

### `/analyst/investigate` — "Case Queue & Investigation Desk" (S13 / S14)
- Server-side DataTable polling every 10 seconds and on tab focus, highlighting new arrivals.
- **Case Detail Console (S14)**:
  - When case source is `customer_report`, renders a prominent **"Customer Report"** card at the top displaying report reason, customer note, and submission timestamp.
  - Full forensic inspector: model inputs, RiskMeter, FactorsChart, timeline, and audit logs.
  - Action buttons: Mark Legit, Mark Fraud, Escalate, Re-score.

### `/analyst/feed` — "Real-Time Transaction Stream"
- Sub-20ms streaming pipeline polling transactions every 3 seconds via `?since=<ISO>` to display real live transactions.
- Pause / Resume streaming controls.

---

## Staff Checker (`/checker`)

### `/checker` — "Transaction Checker" (S23)
- Unified evaluation workbench for analysts and administrators.
- **Tabs**:
  1. **Manual Entry**: Embedded `PaymentForm` in staff mode:
     - Includes card and merchant selectors, INR amount, city, timestamp, and spending patterns.
     - Advanced section: raw input for all 30 features (`Time`, `V1..V28`, `Amount`).
     - Save toggle: *"Save as a real transaction and open a case if flagged"* (defaults to OFF for sandbox testing).
     - Submits to `POST /api/transactions/submit/` with full `ResultPanel` and `FactorsChart`.
  2. **CSV Batch Scoring**: Multipart CSV drag-and-drop batch evaluation with CSV download.
  3. **Stored Sample**: Select from pre-stored test rows representing diverse fraud profiles.
  *(Note: The old synthetic live simulator tab has been completely removed).*

---

## Admin Pages (`/admin/*`)

### `/admin/dashboard` — "Admin Executive Dashboard" (S6)
- Executive KPIs: Total Processed, Fraud Rate, Active Alerts, System Latency.
- **Model Feedback Tiles**:
  - Confirmed Fraud (True Positives)
  - False Alarms (False Positives investigated & cleared)
  - Missed Fraud (Chargebacks / reported fraud)
  - Money Protected (₹ total prevented fraud volume)
- **First-Run Hint Cards** (shown to admins only when database is fresh):
  - *Step 1: Create a customer* → link to `/admin/users`
  - *Step 2: Issue a card* → link to `/admin/users`
  - *Step 3: Log in as the customer and use the card* → link to `/customer/pay`
- Chart empty states with clear explanatory placeholders.

### `/admin/merchants` — "Merchants Registry" (New Screen / Sidebar)
- DataTable of all merchant entities with public ID, name, category, city, status, and creation date.
- Modal dialogs:
  - **Register Merchant**: Name, category selection, and city.
  - **Edit Merchant**: Update details and toggle active / inactive state.

### `/admin/patterns` — "Spending Patterns Reference" (New Screen / Sidebar)
- Read-only table of the 20 benchmark spending patterns (`P01` to `P20`).
- Displays Code, Label, Typical Amount, Typical Time, True Label, and Base Model Score.
- Explanatory header explaining the honest bridge between 30 PCA vector numbers and human-interpretable payment attributes.

### `/admin/users` — "User Management" (S15)
- User table with search, role filters, and active toggles.
- **User Detail Drawer (S15)**:
  - Profile and account details tab.
  - **Cards Tab**: Lists all cards issued to the user with card brand, last 4 digits, status, and spending limit.
  - **Issue Card Form**: Allows admins to issue new debit/credit cards with selectable brand (`VISA`, `MASTERCARD`, `RUPAY`) and customized spending limit in INR.

---

## Polling & Real-time Update Rules
- **Notification Bell**: Polls every 10s and on tab focus (`focus` / `visibilitychange`). Triggers toast on newly arrived notifications.
- **Alerts, Cases, Disputes & Transactions**: Poll every 10s and on tab focus. Newly added rows receive a subtle background highlight animation.
- **Live Feed**: Polls with `?since=<timestamp>` every 3s to reflect genuine incoming traffic.
