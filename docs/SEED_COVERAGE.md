# Seed Data Coverage Audit (docs/SEED_COVERAGE.md)

This audit documents every screen section across all 4 user roles (Admin, Analyst, Customer, Merchant) plus public pages (Landing Page, Transaction Checker, Notifications, Profile).

Status definitions:
- **EMPTY**: The section displays an empty placeholder or 0 rows because no records exist in the database.
- **ZERO**: Numeric KPI counters evaluate to 0 / ₹0.00 / 0.00%.
- **FLAT**: Charts render a single bar, single slice, straight line, or flat zero line due to lack of diverse historical time/category/band distribution.
- **OK**: The section displays rich, meaningful, and dynamically populated data matching production requirements.

---

## Screen & Section Coverage Checklist

| Screen | Section / Component | Backend Endpoint | Minimum Data Required | Baseline Status (Current DB) | Target Status (`--demo`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Landing Page (`/`)** | Hero & Metrics Bar | `GET /api/public/summary/` | Aggregated scans, blocked fraud, money protected, ms, precision, recall, PR-AUC | **EMPTY** (endpoint pending) | **OK** |
| **Landing Page (`/`)** | Live Stream Ticker | `GET /api/transactions/?since=` | $\ge 4$ recent transactions with mixed bands & merchants | **ZERO** (only 2 old txns) | **OK** |
| **Staff Checker (`/checker`)** | Manual Entry Form | `GET /api/cards/`, `GET /api/patterns/`, `GET /api/merchants/` | Active cards, 20 pattern profiles, registered merchants | **OK** | **OK** |
| **Staff Checker (`/checker`)** | Stored Test Samples | `GET /api/predict/samples/` | 200 real held-out rows with feature vectors | **OK** | **OK** |
| **Staff Checker (`/checker`)** | Batch CSV Evaluator | `POST /api/predict/batch/` | Multi-row CSV file evaluation | **OK** | **OK** |
| **Notifications (`/notifications`)** | Notifications List | `GET /api/notifications/` | $\ge 15$ notifications across roles (alert, dispute, system, case) | **EMPTY** (0 records) | **OK** |
| **Notifications (`/notifications`)** | Unread Badge | `GET /api/notifications/` | Unread notifications count $> 0$ | **ZERO** (0 unread) | **OK** |
| **Profile (`/profile`)** | Profile & Credentials | `GET /api/auth/me/` | Authenticated user profile | **OK** | **OK** |
| **Profile (`/profile`)** | Active Sessions | `GET /api/auth/sessions/` | $\ge 1$ active session record with IP & device | **OK** | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Executive KPI: Total Processed | `GET /api/stats/overview/` | Total transaction count & volume | **ZERO** (2 txns) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Executive KPI: Fraud Rate | `GET /api/stats/overview/` | Fraud rate % derived from confirmed fraud | **ZERO** (0.00%) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Executive KPI: Active Alerts | `GET /api/stats/overview/` | Count of unresolved alerts | **ZERO** (0 alerts) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Executive KPI: System Latency | `GET /api/stats/overview/` | Average ML inference latency in ms | **OK** | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Model Feedback: Confirmed Fraud | `GET /api/stats/overview/` | $\ge 1$ true positive case outcome | **ZERO** (0) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Model Feedback: False Alarms | `GET /api/stats/overview/` | $\ge 1$ false positive case cleared | **ZERO** (0) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Model Feedback: Missed Fraud | `GET /api/stats/overview/` | $\ge 1$ customer report / dispute on approved txn | **ZERO** (0) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Model Feedback: Money Protected | `GET /api/stats/overview/` | INR volume of blocked/declined frauds | **ZERO** (₹0.00) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Daily Volume Trend Chart | `GET /api/stats/timeseries/` | 30 days of transactions with daily/weekly rhythm | **FLAT** (no 30d history) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Diurnal Hourly Distribution | `GET /api/stats/by-hour/` | 24 hours of transactions with peak evening volume | **FLAT** (only 2 txns) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Merchant Category Breakdown | `GET /api/stats/by-category/` | Transactions across all 8 merchant categories | **FLAT** (no category volume) | **OK** |
| **Admin Dashboard (`/admin/dashboard`)** | Recent Flagged Alerts Table | `GET /api/alerts/` | Recent alerts with severity and merchant tags | **EMPTY** (0 alerts) | **OK** |
| **Admin Users (`/admin/users`)** | User Management Table | `GET /api/users/` | 40 users across customer, analyst, merchant, admin | **OK** (21 users) | **OK** (40 users) |
| **Admin Users (`/admin/users`)** | Pending Access Requests | `GET /api/users/access-requests/` | $\ge 3$ pending registration requests | **EMPTY** (0 pending) | **OK** |
| **Admin Users (`/admin/users`)** | User Detail Drawer: Cards Tab | `GET /api/cards/?userId=` | Cards per user with limits & last 4 | **OK** | **OK** |
| **Admin Users (`/admin/users`)** | Issue Card Modal | `POST /api/cards/` | Card brand, limit, and unique last 4 issuance | **OK** | **OK** |
| **Admin Merchants (`/admin/merchants`)** | Merchants Directory Table | `GET /api/merchants/` | 12 merchants across 8 categories & Indian cities | **OK** (10 merchants) | **OK** (12 merchants) |
| **Admin Patterns (`/admin/patterns`)** | Spending Patterns Registry | `GET /api/patterns/` | 20 benchmark patterns (`P01` to `P20`) with base scores | **OK** (20 patterns) | **OK** |
| **Admin Config (`/admin/config`)** | Active Thresholds & Policy | `GET /api/model/info/` | Current threshold (0.521) and review floor (0.500) | **OK** | **OK** |
| **Admin Config (`/admin/config`)** | What-If Simulation Panel | `GET /api/model/what-if/?threshold=` | Labeled transactions with live precision/recall curve | **ZERO** (no labeled txns) | **OK** |
| **Admin Audit Logs (`/audit-logs`)** | System Audit Trail Table | `GET /api/audit-logs/` | $\ge 150$ audit logs across actions, actors, and dates | **FLAT** (only 34 entries) | **OK** ($\ge 150$) |
| **Analyst Dashboard (`/analyst/dashboard`)** | KPI: Open Cases | `GET /api/stats/analyst/` | Open investigation cases count | **ZERO** (0 cases) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | KPI: Cases Resolved | `GET /api/stats/analyst/` | Resolved cases count | **ZERO** (0 cases) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | KPI: Avg Risk Score | `GET /api/stats/analyst/` | Average risk score of flagged transactions | **ZERO** (0.000) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | KPI: High-Risk Volume | `GET /api/stats/analyst/` | INR volume of high risk transactions | **ZERO** (₹0.00) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | Analyst Workload Distribution | `GET /api/stats/analyst/` | Case assignment breakdown across 5 analysts | **EMPTY** (0 cases) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | Priority Cases Queue | `GET /api/cases/?status=Open` | P1 and P2 open cases queue | **EMPTY** (0 cases) | **OK** |
| **Analyst Dashboard (`/analyst/dashboard`)** | Recent High-Risk Alerts | `GET /api/alerts/` | Severity high/medium alerts list | **EMPTY** (0 alerts) | **OK** |
| **Analyst Investigation (`/analyst/investigate`)** | Case Queue DataTable | `GET /api/cases/` | Cases in all 4 tabs: New, In Review, Escalated, Resolved | **EMPTY** (0 cases) | **OK** |
| **Analyst Investigation (`/analyst/investigate`)** | Case Detail Console | `GET /api/cases/{id}/` | XAI factors, model inputs, timeline events, notes | **EMPTY** (no cases) | **OK** |
| **Analyst Investigation (`/analyst/investigate`)** | Customer Report Card | `GET /api/cases/{id}/` | Reason and customer notes for reported transactions | **EMPTY** (no reports) | **OK** |
| **Analyst Live Feed (`/analyst/live`)** | Real-Time Stream Table | `GET /api/transactions/?since=` | $\ge 25$ txns in last 60m and $\ge 40$ in last 24h | **EMPTY** (no live txns) | **OK** |
| **Analyst Batch Scoring (`/analyst/batch`)** | CSV Batch Scoring Console | `POST /api/predict/batch/` | Evaluation of multi-row CSV files | **OK** | **OK** |
| **Analyst Model Diagnostics (`/analyst/model`)** | Model Evaluation Summary | `GET /api/model/info/` | XGBoost metrics: recall (78.87%), precision (100%) | **OK** | **OK** |
| **Analyst Model Diagnostics (`/analyst/model`)** | Feature Importance Ranking | `GET /api/model/info/` | 30 feature importance weights | **OK** | **OK** |
| **Analyst Model Diagnostics (`/analyst/model`)** | PR Curve & Confusion Matrix | `GET /api/model/info/` | Precision-Recall curve points and confusion matrix | **OK** | **OK** |
| **Analyst Reports (`/analyst/reports`)** | Intelligence Reports Generator | `GET /api/reports/` | Daily summary, category fraud, analyst KPIs (JSON & CSV) | **FLAT** / **ZERO** | **OK** |
| **Customer Overview (`/customer/overview`)** | Customer KPI: Active Cards | `GET /api/cards/` | Demo customer active cards count | **OK** (2 cards) | **OK** (3 cards) |
| **Customer Overview (`/customer/overview`)** | Customer KPI: Blocked Cards | `GET /api/cards/` | Demo customer has 1 blocked card | **ZERO** (0 blocked) | **OK** (1 blocked) |
| **Customer Overview (`/customer/overview`)** | Customer KPI: Fraud Alerts | `GET /api/alerts/` | $\ge 2$ pending security alerts on customer card | **ZERO** (0 alerts) | **OK** (2 pending) |
| **Customer Overview (`/customer/overview`)** | Customer KPI: Active Disputes | `GET /api/reports/mine/` | $\ge 1$ open dispute filed by customer | **ZERO** (0 disputes) | **OK** |
| **Customer Overview (`/customer/overview`)** | Urgent Fraud Advisory Banner | `GET /api/alerts/?status=new` | 2 urgent fraud advisories with "No, not me" action | **EMPTY** (hidden) | **OK** (2 alerts) |
| **Customer Overview (`/customer/overview`)** | Payment Cards Showcase | `GET /api/cards/` | 3 visual cards (1 active, 1 blocked chip, 1 travel notice) | **FLAT** (only 2 active) | **OK** (3 distinct) |
| **Customer Overview (`/customer/overview`)** | Customer Spending Analytics | `GET /api/stats/by-category/` | Retail categories with varied spend | **ZERO** / **FLAT** | **OK** |
| **Customer Pay (`/customer/pay`)** | Payment Form & Card Selector | `GET /api/cards/`, `GET /api/patterns/` | Pre-populated customer cards and pattern options | **OK** | **OK** |
| **Customer Transactions (`/customer/transactions`)** | My Transactions History Table | `GET /api/transactions/` | History of customer purchases over 60 days | **EMPTY** (0 txns) | **OK** ($\ge 20$ txns) |
| **Customer Transactions (`/customer/transactions`)** | Transaction Detail Drawer | `GET /api/transactions/{id}/` | Full timeline, status, and "Report Transaction" modal | **OK** | **OK** |
| **Customer Alerts (`/customer/alerts`)** | Tab 1: Active Security Alerts | `GET /api/alerts/` | High/medium alerts with confirm/deny interactive buttons | **EMPTY** (0 alerts) | **OK** |
| **Customer Alerts (`/customer/alerts`)** | Tab 2: My Reports | `GET /api/reports/mine/` | 8 customer reports with live 4-step dispute stepper | **EMPTY** (0 reports) | **OK** |
| **Customer Disputes (`/customer/dispute`)** | Dispute Center Summary | `GET /api/reports/mine/` | Customer dispute status and resolution tracker | **EMPTY** (0 disputes) | **OK** |
| **Merchant Terminal (`/merchant/terminal`)** | POS Counter Payment Terminal | `GET /api/pos/cards/`, `GET /api/patterns/` | Masked customer cards and instant terminal scoring | **OK** | **OK** |
| **Merchant Terminal (`/merchant/terminal`)** | Recent Sales from Terminal | `GET /api/transactions/?source=merchant_terminal` | Terminal transactions feed | **EMPTY** (0 terminal txns) | **OK** ($\ge 10$ txns) |
| **Merchant Overview (`/merchant/overview`)** | Merchant KPI: Today's Volume | `GET /api/stats/merchant/` | Real today sales volume for demo merchant | **ZERO** (₹0.00) | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Merchant KPI: Fraud Rate % | `GET /api/stats/merchant/` | Merchant fraud rate % based on disputed charges | **ZERO** (0.00%) | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Merchant KPI: Blocked Revenue | `GET /api/stats/merchant/` | Revenue protected from blocked frauds | **ZERO** (₹0.00) | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Merchant KPI: Open Disputes | `GET /api/stats/merchant/` | Open chargeback disputes count | **ZERO** (0 disputes) | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Volume Trend Chart | `GET /api/stats/timeseries/` | 30-day sales volume and dispute curve | **FLAT** / **ZERO** | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Risk / Diurnal Distribution Chart| `GET /api/stats/risk-distribution/` | Risk distribution across bands or hours | **FLAT** / **ZERO** | **OK** |
| **Merchant Overview (`/merchant/overview`)** | Recent Transactions Table | `GET /api/transactions/` | Recent merchant transactions with status badges | **EMPTY** (0 txns) | **OK** |
| **Merchant Chargebacks (`/merchant/chargebacks`)**| Chargebacks DataTable | `GET /api/disputes/` | $\ge 12$ disputes across Opened, Evidence, Review, Resolved | **EMPTY** (0 disputes) | **OK** ($\ge 12$) |
| **Merchant Chargebacks (`/merchant/chargebacks`)**| Dispute Drawer & Evidence | `GET /api/disputes/{id}/` | PDF/PNG evidence download, upload proof, advance stage | **OK** | **OK** |
| **Merchant Reports (`/merchant/reports`)** | Settlement & Chargeback Summary | `GET /api/reports/?type=merchant_summary` | Aggregate payouts, dispute rates, net settlements | **ZERO** / **FLAT** | **OK** |
