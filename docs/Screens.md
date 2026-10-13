# FraudShield – Screen Specifications

> **Section 4 — Page-by-page UI spec.**

---

## Public Pages

### `/` — Landing Page
- Hero section: animated gradient, tagline, CTA buttons (Login / Register)
- Feature highlights: Real-time detection, Role-based access, Analytics
- Stats bar: transactions analyzed, fraud prevented, accuracy rate

### `/login` — Login Page
- Email + password form
- Role selector (for demo/dev: dropdown to pick persona)
- "Remember me" checkbox
- Link to Register
- Error state for invalid credentials

### `/register` — Register Page
- Name, email, password, confirm password, role selection
- Inline validation
- Success redirect to login

---

## Common Pages (all authenticated roles)

### `/profile` — Profile Page
- Avatar upload, display name, email (read-only)
- Change password section
- Notification preferences
- Session info (last login, active devices)

### `/unauthorized` — 403 Page
- Friendly error with role context
- Back / Home buttons

### `/404` — Not Found Page
- Animated illustration
- Back / Home buttons

---

## Admin Pages (`/admin/*`)

### `/admin/dashboard`
- KPI cards: Total Transactions, Fraud Rate %, Flagged Today, Model Accuracy
- Line chart: Fraud trend (last 30 days)
- Pie chart: Transaction label distribution
- Recent alerts table (top 10 fraud cases)
- System health indicators (API latency, model version)

### `/admin/users`
- Searchable, sortable DataTable of all users
- Columns: Name, Email, Role, Status, Last Login, Actions
- Inline role change, deactivate/activate toggle
- "Invite User" modal: email + role

### `/admin/config`
- Risk threshold sliders (SUSPICIOUS cutoff, FRAUD cutoff)
- Alert email list
- Model version selector (dropdown of available `.joblib` files)
- Feature flag toggles (e.g., "Enable batch scoring")
- Save / Reset buttons

---

## Analyst Pages (`/analyst/*`)

### `/analyst/dashboard`
- KPI cards: Cases Open, Cases Closed Today, Avg Risk Score, High-Risk Merchants
- Area chart: daily flagged transactions (last 14 days)
- Top 5 risky merchants bar chart
- Quick-action buttons: Investigate, Batch Upload

### `/analyst/investigate`
- Transaction search bar (ID, card, merchant, date range)
- Results DataTable with risk badges
- **Transaction Detail Panel** (slide-over / modal):
  - Transaction metadata (amount, timestamp, merchant, location)
  - Risk score gauge (RiskMeter)
  - Feature importance bar chart (FactorsChart)
  - Raw feature vector (collapsible)
  - Action buttons: Mark Resolved, Escalate, Add Note

### `/analyst/batch`
- Drag-and-drop CSV upload
- Preview table (first 10 rows)
- "Run Scoring" button
- Progress bar during scoring
- Results DataTable with download (CSV export)
- Error log for rows that failed

### `/analyst/model`
- Current model info card (version, trained date, dataset size, AUC)
- Confusion matrix heatmap
- ROC curve chart
- Precision-Recall chart
- "Trigger Retraining" button (sends POST to backend)
- Training history table

---

## Customer Pages (`/customer/*`)

### `/customer/transactions`
- My Transactions DataTable
- Columns: Date, Merchant, Amount, Category, Risk Label
- Filter: date range, label, category
- Click row → Transaction Detail modal (read-only, no analyst actions)
- Summary cards: Total Spent, Flagged Transactions, Disputes Open

### `/customer/dispute`
- List of flagged transactions eligible for dispute
- "Open Dispute" button per row → DisputeForm modal:
  - Reason dropdown, description textarea, upload evidence
- Dispute status tracker (Submitted → Under Review → Resolved)

---

## Merchant Pages (`/merchant/*`)

### `/merchant/overview`
- KPI cards: Today's Transactions, Fraud Rate, Blocked Transactions, Revenue at Risk
- Bar chart: hourly transaction volume (today)
- Line chart: fraud rate trend (last 7 days)
- Recent high-risk transactions table

### `/merchant/chargebacks`
- Chargebacks DataTable
- Columns: Date, Transaction ID, Customer, Amount, Status, Reason
- Filter by status: Pending / Won / Lost
- Summary: Total Chargebacks, Win Rate, Amount Recovered

---

## Shared Components Reference

| Component | Location | Description |
|-----------|----------|-------------|
| `RiskBadge` | `ui/` | Colored pill: LEGIT / SUSPICIOUS / FRAUD |
| `RiskMeter` | `charts/` | Gauge / arc showing 0–100% fraud probability |
| `FactorsChart` | `charts/` | Horizontal bar chart of top SHAP-like feature importances |
| `DataTable` | `ui/` | Sortable, paginated, filterable table |
| `Modal` | `ui/` | Accessible overlay with backdrop |
| `Button` | `ui/` | Primary / secondary / danger variants |
| `Card` | `ui/` | Surface container with optional header |
| `AppShell` | `layout/` | Sidebar + Topbar wrapper for authenticated pages |
| `Sidebar` | `layout/` | Role-aware nav links |
| `Topbar` | `layout/` | User avatar, notifications, breadcrumb |
| `PublicLayout` | `layout/` | Centered layout for auth pages |
