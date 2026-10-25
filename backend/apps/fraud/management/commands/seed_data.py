import json
import random
import time
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import UserSession
from apps.audit.models import AuditLog
from apps.fraud.models import (
    Alert,
    Card,
    Case,
    CaseEvent,
    CaseNote,
    Dispute,
    DisputeEvidence,
    Merchant,
    ModelConfig,
    Notification,
    Transaction,
)
from apps.ml.ml_service import FEATURES, band, explain, ml_service, score, status_for

User = get_user_model()

MERCHANT_SEEDS = [
    # Grocery (4)
    {"name": "Reliance Fresh", "category": "Grocery", "city": "Mumbai"},
    {"name": "BigBasket", "category": "Grocery", "city": "Bengaluru"},
    {"name": "Nature's Basket", "category": "Grocery", "city": "Delhi"},
    {"name": "DMart Supermarket", "category": "Grocery", "city": "Pune"},
    # Electronics (4)
    {"name": "Reliance Digital", "category": "Electronics", "city": "Mumbai"},
    {"name": "Croma Electronics", "category": "Electronics", "city": "Bengaluru"},
    {"name": "Vijay Sales", "category": "Electronics", "city": "Delhi"},
    {"name": "Poorvika Mobiles", "category": "Electronics", "city": "Chennai"},
    # Fashion (4)
    {"name": "FabIndia Lifestyle", "category": "Fashion", "city": "New Delhi"},
    {"name": "Myntra Fashion", "category": "Fashion", "city": "Bengaluru"},
    {"name": "Pantaloons", "category": "Fashion", "city": "Kolkata"},
    {"name": "Raymond Showroom", "category": "Fashion", "city": "Mumbai"},
    # Travel (4)
    {"name": "MakeMyTrip India", "category": "Travel", "city": "Gurugram"},
    {"name": "Cleartrip Flights", "category": "Travel", "city": "Mumbai"},
    {"name": "Yatra Online", "category": "Travel", "city": "Gurugram"},
    {"name": "IRCTC Tourism", "category": "Travel", "city": "New Delhi"},
    # Food (4)
    {"name": "Swiggy Orders", "category": "Food", "city": "Bengaluru"},
    {"name": "Zomato Dining", "category": "Food", "city": "Gurugram"},
    {"name": "Haldiram's Sweets", "category": "Food", "city": "Nagpur"},
    {"name": "Barbeque Nation", "category": "Food", "city": "Hyderabad"},
    # Fuel (4)
    {"name": "Indian Oil Station", "category": "Fuel", "city": "Mumbai"},
    {"name": "Bharat Petroleum", "category": "Fuel", "city": "Chennai"},
    {"name": "HPCL Fuel Point", "category": "Fuel", "city": "Ahmedabad"},
    {"name": "Shell Auto Service", "category": "Fuel", "city": "Bengaluru"},
    # Entertainment (3)
    {"name": "BookMyShow Movies", "category": "Entertainment", "city": "Mumbai"},
    {"name": "PVR Inox Cinemas", "category": "Entertainment", "city": "Delhi"},
    {"name": "Cinepolis Multiplex", "category": "Entertainment", "city": "Kolkata"},
    # Online Services (3)
    {"name": "Flipkart Internet", "category": "Online Services", "city": "Bengaluru"},
    {"name": "Amazon India", "category": "Online Services", "city": "Hyderabad"},
    {"name": "Paytm Mall Services", "category": "Online Services", "city": "Noida"},
]

INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat",
    "Lucknow", "Chandigarh", "Nagpur", "Indore", "Bhopal"
]

CUSTOMER_NAMES = [
    "Rohan Verma", "Priya Patel", "Ananya Iyer", "Vikram Singh", "Neha Gupta",
    "Rahul Nair", "Sneha Reddy", "Aditya Joshi", "Pooja Shah", "Karan Malhotra",
    "Divya Kapoor", "Amit Mehra", "Ritu Bansal", "Suresh Kumar", "Meera Das",
    "Sandeep Choudhury", "Ankit Saxena", "Sunita Rao", "Deepak Verma", "Swati Deshmukh",
    "Gaurav Bhatia", "Kavita Pillai", "Manish Jain", "Shweta Kulkarni", "Nikhil Agarwal",
    "Tanvi Mukherjee", "Rajesh Khanna", "Siddharth Rao"
]

ANALYST_NAMES = [
    "Ishaan Sen", "Radhika Menon", "Kunal Trivedi", "Simran Kaur"
]

MERCHANT_USER_NAMES = [
    "Tarun Bajaj", "Alok Nath", "Sonal Singhania"
]


class Command(BaseCommand):
    help = "Seeds database with real ML scoring, demo users, transactions, alerts, cases, disputes, and audit logs."

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing database records before seeding'
        )
        parser.add_argument(
            '--minimal',
            action='store_true',
            default=False,
            help='Seed minimal demo accounts, merchants, cards, patterns, and NO transactions (default)'
        )
        parser.add_argument(
            '--history',
            action='store_true',
            default=False,
            help='Additionally seed 30 days of scored transaction history and investigations'
        )

    def handle(self, *args, **options):
        start_time = time.time()
        do_reset = options['reset']

        if do_reset:
            self.stdout.write(self.style.WARNING("Resetting database tables..."))
            DisputeEvidence.objects.all().delete()
            Dispute.objects.all().delete()
            CaseNote.objects.all().delete()
            CaseEvent.objects.all().delete()
            Case.objects.all().delete()
            Alert.objects.all().delete()
            Transaction.objects.all().delete()
            Card.objects.all().delete()
            Notification.objects.all().delete()
            ModelConfig.objects.all().delete()
            AuditLog.objects.all().delete()
            UserSession.objects.all().delete()
            User.objects.all().delete()
            Merchant.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("All tables cleared successfully."))
        elif Transaction.objects.exists():
            self.stdout.write("Existing transactions found, refreshing transaction and investigation tables...")
            DisputeEvidence.objects.all().delete()
            Dispute.objects.all().delete()
            CaseNote.objects.all().delete()
            CaseEvent.objects.all().delete()
            Case.objects.all().delete()
            Alert.objects.all().delete()
            Transaction.objects.all().delete()
            Card.objects.all().delete()

        is_history = options.get('history', False)
        is_minimal = not is_history

        # 1. Load ModelConfig & ML files
        ml_dir = Path(getattr(settings, 'ML_DIR', Path(__file__).resolve().parent.parent.parent.parent / 'ml'))
        threshold_file = ml_dir / 'threshold.txt'
        report_file = ml_dir / 'model_report.json'
        csv_path = ml_dir / 'data' / 'test_sample.csv'

        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f"CSV file not found at {csv_path}"))
            return
        if not threshold_file.exists():
            self.stderr.write(self.style.ERROR(f"Threshold file not found at {threshold_file}"))
            return
        if not report_file.exists():
            self.stderr.write(self.style.ERROR(f"Model report file not found at {report_file}"))
            return

        with open(report_file, 'r') as f:
            report_data = json.load(f)
        threshold_val = float(threshold_file.read_text().strip())
        review_floor_val = float(report_data.get('review_floor'))
        scale_pos_weight = float(report_data.get('scale_pos_weight', 0.0))
        best_params = report_data.get('best_params', {})
        version = report_data.get('version', 'v1.0')

        ModelConfig.objects.all().delete()
        model_config = ModelConfig.objects.create(
            version=version,
            threshold=threshold_val,
            review_floor=review_floor_val,
            scale_pos_weight=scale_pos_weight,
            best_params=best_params,
            dataset_info=report_data.get('dataset', {}),
            metrics=report_data.get('metrics', {}),
            confusion_matrix=report_data.get('confusion_matrix', {}),
            pr_curve=report_data.get('pr_curve', []),
            feature_importance=report_data.get('feature_importance', []),
            comparison=report_data.get('comparison', []),
        )
        self.stdout.write(f"Created ModelConfig ({model_config.version}) with threshold {model_config.threshold} and review floor {model_config.review_floor}.")

        # Build 20 spending patterns
        from django.core.management import call_command
        self.stdout.write("Building 20 demo spending patterns...")
        call_command('build_patterns')

        # 2. Seed Merchants (10 for minimal, 30 for history)
        merchant_pool = MERCHANT_SEEDS[:10] if is_minimal else MERCHANT_SEEDS
        merchants = []
        for m_data in merchant_pool:
            m, _ = Merchant.objects.get_or_create(
                name=m_data['name'],
                defaults={'category': m_data['category'], 'city': m_data['city'], 'active': True}
            )
            merchants.append(m)
        self.stdout.write(f"Seeded {len(merchants)} merchants.")

        # 3. Seed Demo Users (4 demo users)
        demo_merchant = merchants[0]  # Reliance Fresh / Reliance Digital
        demo_definitions = [
            ("admin@fraudshield.com", "admin@fraudshield.io", "Admin User", "admin", "password123", "Security & Administration", "FraudShield Global", True, True, None),
            ("analyst@fraudshield.com", "analyst@fraudshield.io", "Lead Analyst", "analyst", "password123", "Fraud Investigation Unit", "FraudShield Global", False, False, None),
            ("customer@fraudshield.com", "customer@fraudshield.io", "Aarav Sharma", "customer", "password123", "Retail Customer", "Personal Account", False, False, None),
            ("merchant@fraudshield.com", "merchant@fraudshield.io", "Merchant Partner", "merchant", "password123", "Merchant Operations", demo_merchant.name, False, False, demo_merchant),
        ]

        demo_users_map = {}
        for primary_email, alt_email, name, role, pwd, dept, org, is_staff, is_super, m_obj in demo_definitions:
            for em in [primary_email, alt_email]:
                u, _ = User.objects.get_or_create(
                    email=em,
                    defaults={
                        'name': name,
                        'role': role,
                        'department': dept,
                        'organisation': org,
                        'status': 'active',
                        'is_active': True,
                        'is_staff': is_staff,
                        'is_superuser': is_super,
                        'merchant': m_obj,
                    }
                )
                u.set_password(pwd)
                u.role = role
                u.status = 'active'
                u.is_active = True
                u.merchant = m_obj
                u.save()
                demo_users_map[em] = u

        demo_customer = demo_users_map["customer@fraudshield.io"]
        demo_customer_alt = demo_users_map["customer@fraudshield.com"]
        demo_analyst = demo_users_map["analyst@fraudshield.io"]

        # 4. Seed Additional Users (12 for minimal: 8 cust, 2 analyst, 1 merchant, 1 admin; 36 for history)
        cust_names = CUSTOMER_NAMES[:8] if is_minimal else CUSTOMER_NAMES
        analyst_names = ANALYST_NAMES[:2] if is_minimal else ANALYST_NAMES
        merch_user_names = MERCHANT_USER_NAMES[:1] if is_minimal else MERCHANT_USER_NAMES

        customers = [demo_customer, demo_customer_alt]
        for i, c_name in enumerate(cust_names):
            email = f"customer.{c_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': c_name,
                    'role': 'customer',
                    'department': 'Standard Retail',
                    'organisation': 'Personal Account',
                    'status': 'active',
                    'is_active': True,
                }
            )
            u.set_password("Customer@123")
            u.save()
            customers.append(u)

        analysts = [demo_analyst]
        for i, a_name in enumerate(analyst_names):
            email = f"analyst.{a_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': a_name,
                    'role': 'analyst',
                    'department': 'Level 2 Operations',
                    'organisation': 'FraudShield Global',
                    'status': 'active',
                    'is_active': True,
                }
            )
            u.set_password("Analyst@123")
            u.save()
            analysts.append(u)

        for i, m_name in enumerate(merch_user_names):
            email = f"merchant.{m_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
            linked_m = merchants[(i + 1) % len(merchants)]
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': m_name,
                    'role': 'merchant',
                    'department': 'Partner Commerce',
                    'organisation': linked_m.name,
                    'status': 'active',
                    'is_active': True,
                    'merchant': linked_m,
                }
            )
            u.set_password("Merchant@123")
            u.save()

        extra_admin, _ = User.objects.get_or_create(
            email="admin.compliance@fraudshield.io",
            defaults={
                'name': "Devendra Sharma",
                'role': 'admin',
                'department': 'Risk & Compliance',
                'organisation': 'FraudShield Global',
                'status': 'active',
                'is_active': True,
                'is_staff': True,
            }
        )
        extra_admin.set_password("Admin@123")
        extra_admin.save()

        self.stdout.write(f"Seeded users: {User.objects.count()} total users across all roles.")

        # 5. Seed Cards (12 for minimal, 60 for history)
        cards = []
        card_types = ["Visa Platinum", "Mastercard World", "RuPay Select", "Visa Signature", "Mastercard Black"]

        demo_customer_cards = [
            ("4532 •••• •••• 8821", "8821", "Visa", "Visa Platinum", 150000.00, "08/28"),
            ("5241 •••• •••• 4129", "4129", "Mastercard", "Mastercard World", 250000.00, "11/27"),
        ]
        if not is_minimal:
            demo_customer_cards.append(("6071 •••• •••• 9034", "9034", "RuPay", "RuPay Select", 100000.00, "03/29"))

        for cnum, last4, brand, ctype, limit, exp in demo_customer_cards:
            c, _ = Card.objects.get_or_create(
                owner=demo_customer,
                last4=last4,
                defaults={
                    'card_number': cnum,
                    'brand': brand,
                    'card_type': ctype,
                    'status': 'active',
                    'spending_limit': limit,
                    'expiry': exp,
                    'travel_notice': False,
                }
            )
            cards.append(c)

        rng = random.Random(42)
        other_customers = [c for c in customers if c.id != demo_customer.id]
        target_card_count = 12 if is_minimal else 60

        for i in range(len(cards), target_card_count):
            owner = other_customers[(i - len(demo_customer_cards)) % len(other_customers)]
            last4 = str(rng.randint(1000, 9999))
            brand = rng.choice(["Visa", "Mastercard", "RuPay"])
            c_type = rng.choice(card_types)
            c, _ = Card.objects.get_or_create(
                owner=owner,
                last4=last4,
                defaults={
                    'card_number': f"•••• •••• •••• {last4}",
                    'brand': brand,
                    'card_type': c_type,
                    'status': 'blocked' if (not is_minimal and rng.random() < 0.05) else 'active',
                    'spending_limit': rng.choice([50000, 100000, 200000, 500000]),
                    'expiry': f"{rng.randint(1, 12):02d}/{rng.randint(27, 31)}",
                    'travel_notice': rng.random() < 0.1,
                }
            )
            cards.append(c)

        self.stdout.write(f"Seeded {len(cards)} cards.")

        if is_minimal:
            # Ensure transactions, alerts, cases, disputes, notifications are completely empty
            DisputeEvidence.objects.all().delete()
            Dispute.objects.all().delete()
            CaseNote.objects.all().delete()
            CaseEvent.objects.all().delete()
            Case.objects.all().delete()
            Alert.objects.all().delete()
            Transaction.objects.all().delete()
            Notification.objects.all().delete()

            self.stdout.write(self.style.SUCCESS(
                f"\n=== Minimal Demo Seed Completed in {time.time() - start_time:.2f}s ===\n"
                f"  - Users: {User.objects.count()} (4 demo + 12 extra)\n"
                f"  - Merchants: {Merchant.objects.count()} (10)\n"
                f"  - Cards: {Card.objects.count()} (12 active)\n"
                f"  - ModelConfig: threshold={model_config.threshold}, review_floor={model_config.review_floor}\n"
                f"  - Spending Patterns: 20 demo profiles (P01..P20)\n"
                f"  - Transactions: 0 (Pure Real-User Input Mode)\n"
            ))
            return

        # 6. Single Batch Scoring of all CSV rows (History Mode)
        df = pd.read_csv(csv_path)
        self.stdout.write(f"Loaded test sample CSV: {len(df)} rows.")
        self.stdout.write("Scoring transactions in ONE vectorised batch...")
        scores = score(df)
        explanations = explain(df)
        bands = band(scores, threshold=model_config.threshold, review_floor=model_config.review_floor)
        statuses = [status_for(b) for b in bands]

        # Generate timestamps spread over the last 30 days in order of Time
        min_time = df['Time'].min()
        max_time = df['Time'].max()
        time_span = max(1.0, float(max_time - min_time))
        now = timezone.now()
        start_time_base = now - timedelta(days=30)

        transactions_to_create = []
        num_rows = len(df)
        for i in range(num_rows):
            row = df.iloc[i]
            t_val = float(row['Time'])
            progress_ratio = (t_val - min_time) / time_span
            ts = start_time_base + timedelta(days=30 * progress_ratio) + timedelta(milliseconds=i * 20)

            raw_amount = float(row['Amount'])
            amount_inr = round(raw_amount * 90.0, 2)
            if amount_inr <= 0:
                amount_inr = round(float(rng.randint(250, 4500)), 2)

            card = cards[i % len(cards)]
            merchant = merchants[i % len(merchants)]
            city = merchant.city or rng.choice(INDIAN_CITIES)
            class_val = int(row['Class']) if 'Class' in row else 0
            true_label = 'FRAUD' if class_val == 1 else 'LEGIT'

            model_inputs = {col: float(row[col]) for col in FEATURES}

            public_id = f"TXN-{100000 + (i + 1)}"

            txn = Transaction(
                public_id=public_id,
                card=card,
                merchant=merchant,
                merchant_name=merchant.name,
                merchant_category=merchant.category,
                amount=raw_amount,
                amount_inr=amount_inr,
                city=city,
                timestamp=ts,
                risk_score=round(float(scores[i]), 4),
                status=statuses[i],
                true_label=true_label,
                model_inputs=model_inputs,
                factors=explanations[i],
                model_version=ml_service.version,
                source='seed',
            )
            transactions_to_create.append(txn)

        Transaction.objects.bulk_create(transactions_to_create, batch_size=1000)
        self.stdout.write(f"Bulk created {len(transactions_to_create)} transactions.")

        # Re-fetch created transactions with ids
        created_txns = list(Transaction.objects.all().select_related('card__owner', 'merchant').order_by('id'))

        # 7. Create Alerts, Cases, CaseEvents, and Notifications for review / high
        alerts_to_create = []
        cases_to_create = []
        case_events_to_create = []
        notifications_to_create = []

        active_analysts = list(User.objects.filter(role='analyst', is_active=True))

        for txn in created_txns:
            b = txn.band(threshold=model_config.threshold, review_floor=model_config.review_floor)
            if b in ('review', 'high'):
                severity = 'high' if b == 'high' else 'medium'
                alert = Alert(
                    transaction=txn,
                    severity=severity,
                    status='new',
                    customer_response='none',
                )
                alerts_to_create.append(alert)

        Alert.objects.bulk_create(alerts_to_create, batch_size=500)
        self.stdout.write(f"Bulk created {len(alerts_to_create)} alerts.")

        # Map alerts by transaction_id
        alerts_map = {a.transaction_id: a for a in Alert.objects.all().select_related('transaction')}

        for txn_id, alert in alerts_map.items():
            txn = alert.transaction
            b = txn.band(threshold=model_config.threshold, review_floor=model_config.review_floor)
            case = Case(
                alert=alert,
                transaction=txn,
                status='Open',
                priority='P1' if b == 'high' else 'P2',
                outcome='none',
            )
            cases_to_create.append(case)

            # Notifications: cardholder
            if txn.card and txn.card.owner:
                cardholder = txn.card.owner
                notifications_to_create.append(Notification(
                    user=cardholder,
                    type='alert',
                    title='Suspicious Activity Alert',
                    body=f"Your card was charged ₹{float(txn.amount_inr):,.2f} at {txn.merchant_name}. Status: {txn.status}.",
                    link=f"/transactions/{txn.public_id}",
                ))

            # Notifications: analysts
            for analyst in active_analysts:
                notifications_to_create.append(Notification(
                    user=analyst,
                    type='alert',
                    title=f"New {b.upper()} Risk Alert",
                    body=f"Transaction {txn.public_id} flagged ({b.upper()}, score: {txn.risk_score:.3f}).",
                    link=f"/alerts/{alert.id}",
                ))

        Case.objects.bulk_create(cases_to_create, batch_size=500)
        self.stdout.write(f"Bulk created {len(cases_to_create)} cases.")

        created_cases = list(Case.objects.all().select_related('transaction'))
        for case in created_cases:
            case_events_to_create.append(CaseEvent(
                case=case,
                event_type='system',
                action='Case Created',
                text=f"Transaction {case.transaction.public_id} flagged by ML model (score: {case.transaction.risk_score:.4f}).",
                actor='System',
            ))

        CaseEvent.objects.bulk_create(case_events_to_create, batch_size=500)

        # 8. Resolve some cases with notes and timelines
        resolved_cases = created_cases[:10]
        case_notes_to_create = []
        for i, c in enumerate(resolved_cases):
            c.status = 'Resolved' if i % 2 == 0 else 'Confirmed Fraud'
            c.outcome = 'safe' if i % 2 == 0 else 'fraud'
            c.closed_at = timezone.now() - timedelta(hours=i * 2 + 1)
            c.save()

            case_notes_to_create.append(CaseNote(
                case=c,
                author='Lead Analyst',
                text='Contacted customer via phone; confirmed transaction details.'
            ))
            case_events_to_create.append(CaseEvent(
                case=c,
                event_type='status_change',
                action='Status Changed',
                text=f"Case status updated to {c.status} by analyst.",
                actor='Lead Analyst',
            ))

        CaseNote.objects.bulk_create(case_notes_to_create)
        self.stdout.write(f"Resolved {len(resolved_cases)} cases with notes and timelines.")

        # 9. Create 20 Disputes for merchants from flagged/blocked transactions
        flagged_or_blocked = [t for t in created_txns if t.status in ('flagged', 'blocked')]
        if len(flagged_or_blocked) < 20:
            flagged_or_blocked = created_txns[:20]

        disputes_to_create = []
        dispute_reasons = [
            "Card was cloned and charged unauthorized",
            "Item was never delivered by merchant",
            "Double billed for single checkout",
            "Fraudulent transaction reported by cardholder",
            "Amount charged was higher than invoice",
        ]
        dispute_stages = ['opened', 'evidence', 'review', 'resolved']

        for i in range(20):
            dtxn = flagged_or_blocked[i % len(flagged_or_blocked)]
            d_cust = dtxn.card.owner if dtxn.card else demo_customer
            stage_val = dispute_stages[i % len(dispute_stages)]
            status_val = 'Resolved' if stage_val == 'resolved' else 'Under Review' if stage_val == 'review' else 'Submitted'
            outcome_val = 'Refund Approved' if stage_val == 'resolved' else ''

            dispute = Dispute(
                merchant=dtxn.merchant,
                transaction=dtxn,
                customer=d_cust,
                customer_name=d_cust.name if d_cust else "Aarav Sharma",
                amount_inr=dtxn.amount_inr,
                reason=dispute_reasons[i % len(dispute_reasons)],
                stage=stage_val,
                status=status_val,
                outcome=outcome_val,
                evidence_notes="Cardholder submitted transaction statement and police complaint copy.",
            )
            disputes_to_create.append(dispute)

        Dispute.objects.bulk_create(disputes_to_create)
        self.stdout.write("Created 20 disputes for merchants.")

        # 10. Create 80 Audit Log entries
        audit_actions = [
            ('auth.login', 'User logged into web dashboard', 'auth'),
            ('auth.logout', 'User logged out', 'auth'),
            ('threshold.update', f'Admin updated risk threshold to {model_config.threshold}', 'config'),
            ('case.decision', 'Analyst marked Case as Confirmed Fraud', 'case'),
            ('card.block', 'Card was blocked due to high risk anomaly', 'card'),
            ('card.unblock', 'Card was unblocked after identity verification', 'card'),
            ('transaction.export', 'Admin exported transaction report CSV', 'export'),
            ('alert.assign', 'Alert assigned to Lead Analyst', 'alert'),
        ]
        all_users = list(User.objects.all())
        audit_logs_to_create = []
        for i in range(80):
            act, desc, tgt = audit_actions[i % len(audit_actions)]
            u = all_users[i % len(all_users)]
            ts_audit = now - timedelta(days=float(i) * 0.35)
            log = AuditLog(
                user=u,
                role=u.role,
                action=act,
                target=f"{tgt}_{i+100}",
                ip_address=f"192.168.1.{10 + (i % 50)}",
                details={'description': desc, 'event_index': i},
                created_at=ts_audit,
            )
            audit_logs_to_create.append(log)

        AuditLog.objects.bulk_create(audit_logs_to_create)
        self.stdout.write("Created 80 audit log entries.")

        # 11. Notifications for every role
        role_notifications = [
            ("admin", "System Security Digest", "Weekly risk scan completed: 0 critical infrastructure vulnerabilities found."),
            ("analyst", "Queue Update", "High priority alert queue currently has unassigned cases requiring attention."),
            ("customer", "Monthly Card Statement", "Your monthly transaction statement is now available to download."),
            ("merchant", "Settlement Batch Processed", "Daily merchant payout batch of ₹248,500 has been credited to your bank account."),
        ]
        for role, title, body in role_notifications:
            for u in User.objects.filter(role=role)[:3]:
                notifications_to_create.append(Notification(
                    user=u,
                    type='system',
                    title=title,
                    body=body,
                    link='/dashboard',
                ))

        Notification.objects.bulk_create(notifications_to_create, batch_size=500)
        self.stdout.write(f"Bulk created {Notification.objects.count()} notifications across all roles.")

        # 12. Summary Statistics
        total_txns = len(created_txns)
        safe_count = sum(1 for t in created_txns if t.band(model_config.threshold, model_config.review_floor) == 'safe')
        review_count = sum(1 for t in created_txns if t.band(model_config.threshold, model_config.review_floor) == 'review')
        high_count = sum(1 for t in created_txns if t.band(model_config.threshold, model_config.review_floor) == 'high')

        actual_frauds = sum(1 for t in created_txns if t.true_label == 'FRAUD')
        fraud_rate = (actual_frauds / total_txns * 100) if total_txns > 0 else 0.0

        # High risk threshold metrics (threshold >= model_config.threshold)
        tp_high = sum(1 for t in created_txns if t.true_label == 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) == 'high')
        fp_high = sum(1 for t in created_txns if t.true_label != 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) == 'high')
        fn_high = sum(1 for t in created_txns if t.true_label == 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) != 'high')

        prec_high = (tp_high / (tp_high + fp_high) * 100) if (tp_high + fp_high) > 0 else 0.0
        rec_high = (tp_high / (tp_high + fn_high) * 100) if (tp_high + fn_high) > 0 else 0.0

        # Review+High combined (score >= model_config.review_floor)
        tp_flagged = sum(1 for t in created_txns if t.true_label == 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) in ('review', 'high'))
        fp_flagged = sum(1 for t in created_txns if t.true_label != 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) in ('review', 'high'))
        fn_flagged = sum(1 for t in created_txns if t.true_label == 'FRAUD' and t.band(model_config.threshold, model_config.review_floor) == 'safe')

        prec_flagged = (tp_flagged / (tp_flagged + fp_flagged) * 100) if (tp_flagged + fp_flagged) > 0 else 0.0
        rec_flagged = (tp_flagged / (tp_flagged + fn_flagged) * 100) if (tp_flagged + fn_flagged) > 0 else 0.0

        elapsed = time.time() - start_time

        # Print summary table
        summary_text = f"""
================================================================================
                         FRAUDSHIELD SEED SUMMARY
================================================================================
Execution Time       : {elapsed:.2f} seconds

Database Table Counts:
  - Users            : {User.objects.count()} (4 demo + 36 Indian users)
  - Merchants        : {Merchant.objects.count()} (across 8 categories)
  - Cards            : {Card.objects.count()} (demo customer owns 3)
  - Transactions     : {Transaction.objects.count()}
  - Alerts           : {Alert.objects.count()}
  - Cases            : {Case.objects.count()} (with timeline events)
  - Case Notes       : {CaseNote.objects.count()}
  - Case Events      : {CaseEvent.objects.count()}
  - Disputes         : {Dispute.objects.count()}
  - Audit Logs       : {AuditLog.objects.count()}
  - Notifications    : {Notification.objects.count()}
  - ModelConfig      : {ModelConfig.objects.count()}

Dataset & Risk Bands:
  - Total Sample Rows: {total_txns}
  - True Fraud Cases : {actual_frauds} ({fraud_rate:.2f}% dataset fraud rate)
  - Safe Band (<{model_config.review_floor:.2f}): {safe_count} ({safe_count/total_txns*100:.1f}%)
  - Review ({model_config.review_floor:.2f}-{model_config.threshold:.3f}): {review_count} ({review_count/total_txns*100:.1f}%)
  - High Band (>={model_config.threshold:.3f}): {high_count} ({high_count/total_txns*100:.1f}%)

Model Performance on Seeded Rows:
  [At High-Risk Threshold ({model_config.threshold:.3f}) - Block]:
    * True Positives  : {tp_high} / {actual_frauds}
    * False Positives : {fp_high}
    * Precision       : {prec_high:.2f}%
    * Recall          : {rec_high:.2f}%

  [At Review Floor ({model_config.review_floor:.2f}) - Flag/Review]:
    * True Positives  : {tp_flagged} / {actual_frauds}
    * False Positives : {fp_flagged}
    * Precision       : {prec_flagged:.2f}%
    * Recall          : {rec_flagged:.2f}%
================================================================================
"""
        self.stdout.write(self.style.SUCCESS(summary_text))
