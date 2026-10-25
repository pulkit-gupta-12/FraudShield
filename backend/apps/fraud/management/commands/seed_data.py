import io
import json
import os
import random
import time
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from django.utils import timezone

from apps.accounts.models import UserSession
from apps.audit.models import AuditLog
from apps.fraud.models import (
    Alert,
    Card,
    Case,
    CaseEvent,
    CaseNote,
    CustomerReport,
    Dispute,
    DisputeEvidence,
    Merchant,
    ModelConfig,
    Notification,
    PatternProfile,
    Transaction,
)
from apps.ml.ml_service import FEATURES, band, explain, ml_service, score, status_for

User = get_user_model()

# 12 Merchants across all 8 Categories
MERCHANT_SEEDS = [
    # 1. Grocery (2)
    {"name": "Reliance Fresh", "category": "Grocery", "city": "Mumbai"},
    {"name": "BigBasket", "category": "Grocery", "city": "Bengaluru"},
    # 2. Electronics (2)
    {"name": "Reliance Digital", "category": "Electronics", "city": "Mumbai"},
    {"name": "Croma Electronics", "category": "Electronics", "city": "Bengaluru"},
    # 3. Fashion (2)
    {"name": "FabIndia Lifestyle", "category": "Fashion", "city": "New Delhi"},
    {"name": "Myntra Fashion", "category": "Fashion", "city": "Bengaluru"},
    # 4. Travel (2)
    {"name": "MakeMyTrip India", "category": "Travel", "city": "Gurugram"},
    {"name": "Cleartrip Flights", "category": "Travel", "city": "Mumbai"},
    # 5. Food (2)
    {"name": "Swiggy Orders", "category": "Food", "city": "Bengaluru"},
    {"name": "Zomato Dining", "category": "Food", "city": "Gurugram"},
    # 6. Fuel (1)
    {"name": "Indian Oil Station", "category": "Fuel", "city": "Mumbai"},
    # 7. Entertainment (1)
    {"name": "BookMyShow Movies", "category": "Entertainment", "city": "Mumbai"},
    # 8. Online Services (1)
    {"name": "Flipkart Internet", "category": "Online Services", "city": "Bengaluru"},
]

INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai",
    "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat",
    "Lucknow", "Chandigarh", "Nagpur", "Indore", "Bhopal"
]

# 22 Customers
CUSTOMER_NAMES = [
    "Rohan Verma", "Priya Patel", "Ananya Iyer", "Vikram Singh", "Neha Gupta",
    "Rahul Nair", "Sneha Reddy", "Aditya Joshi", "Pooja Shah", "Karan Malhotra",
    "Divya Kapoor", "Amit Mehra", "Ritu Bansal", "Suresh Kumar", "Meera Das",
    "Sandeep Choudhury", "Ankit Saxena", "Sunita Rao", "Deepak Verma", "Swati Deshmukh",
    "Gaurav Bhatia", "Kavita Pillai"
]

# 5 Analysts (1 demo + 4 extra)
ANALYST_NAMES = [
    "Ishaan Sen", "Radhika Menon", "Kunal Trivedi", "Simran Kaur"
]

# 4 Merchants (1 demo + 3 extra)
MERCHANT_USER_NAMES = [
    ("Tarun Bajaj", "Croma Electronics"),
    ("Alok Nath", "Myntra Fashion"),
    ("Sonal Singhania", "MakeMyTrip India")
]

# Minimal valid 1x1 PNG bytes
SAMPLE_PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00'
    b'\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\r\xefe\xb4'
    b'\x00\x00\x00\x00IEND\xaeB`\x82'
)

# Minimal valid PDF bytes
SAMPLE_PDF_BYTES = (
    b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    b'2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n'
    b'3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n'
    b'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n'
    b'0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n'
)


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
            help='Seed minimal demo accounts, merchants, cards, patterns, and NO transactions'
        )
        parser.add_argument(
            '--history',
            action='store_true',
            default=False,
            help='Seed 30 days of scored transaction history and investigations'
        )
        parser.add_argument(
            '--demo',
            action='store_true',
            default=False,
            help='Seed rich 60-day presentation demo history (~6,000 txns, 40 users, disputes, reports, audit logs)'
        )
        parser.add_argument(
            '--clear-demo',
            action='store_true',
            default=False,
            help='Removes only records marked with is_demo=True'
        )

    def handle(self, *args, **options):
        start_time = time.time()

        # Handle --clear-demo
        if options.get('clear_demo'):
            self.stdout.write(self.style.WARNING("Clearing demo records (is_demo=True)..."))
            d_ev = DisputeEvidence.objects.filter(is_demo=True).delete()[0]
            d_rep = CustomerReport.objects.filter(is_demo=True).delete()[0]
            d_disp = Dispute.objects.filter(is_demo=True).delete()[0]
            d_cn = CaseNote.objects.filter(is_demo=True).delete()[0]
            d_ce = CaseEvent.objects.filter(is_demo=True).delete()[0]
            d_c = Case.objects.filter(is_demo=True).delete()[0]
            d_a = Alert.objects.filter(is_demo=True).delete()[0]
            d_t = Transaction.objects.filter(is_demo=True).delete()[0]
            d_cd = Card.objects.filter(is_demo=True).delete()[0]
            d_n = Notification.objects.filter(is_demo=True).delete()[0]
            d_al = AuditLog.objects.filter(is_demo=True).delete()[0]
            d_m = Merchant.objects.filter(is_demo=True).delete()[0]
            d_u = User.objects.filter(is_demo=True).delete()[0]

            self.stdout.write(self.style.SUCCESS(
                f"Cleared demo records successfully:\n"
                f"  - Users: {d_u}, Merchants: {d_m}, Cards: {d_cd}\n"
                f"  - Transactions: {d_t}, Alerts: {d_a}, Cases: {d_c}\n"
                f"  - Disputes: {d_disp}, Evidence: {d_ev}, Reports: {d_rep}\n"
                f"  - AuditLogs: {d_al}, Notifications: {d_n}"
            ))
            return

        do_reset = options['reset']
        is_demo = options['demo']
        is_history = options['history'] or is_demo
        is_minimal = options['minimal'] or (not is_history and not is_demo)

        if do_reset:
            self.stdout.write(self.style.WARNING("Resetting database tables via direct SQL..."))
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('PRAGMA foreign_keys = OFF;')
                for tbl in [
                    'fraud_disputeevidence', 'fraud_customerreport', 'fraud_dispute',
                    'fraud_casenote', 'fraud_caseevent', 'fraud_case', 'fraud_alert',
                    'fraud_transaction', 'fraud_card', 'fraud_notification',
                    'fraud_modelconfig', 'audit_auditlog', 'accounts_usersession',
                    'accounts_user', 'fraud_merchant', 'fraud_patternprofile'
                ]:
                    try:
                        cursor.execute(f'DELETE FROM {tbl};')
                    except Exception:
                        pass
                cursor.execute('PRAGMA foreign_keys = ON;')
            self.stdout.write(self.style.SUCCESS("All tables cleared successfully in milliseconds."))
        elif Transaction.objects.exists() and (is_history or is_demo):
            self.stdout.write("Existing transactions found, refreshing tables...")
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('PRAGMA foreign_keys = OFF;')
                for tbl in [
                    'fraud_disputeevidence', 'fraud_customerreport', 'fraud_dispute',
                    'fraud_casenote', 'fraud_caseevent', 'fraud_case', 'fraud_alert',
                    'fraud_transaction', 'fraud_card'
                ]:
                    try:
                        cursor.execute(f'DELETE FROM {tbl};')
                    except Exception:
                        pass
                cursor.execute('PRAGMA foreign_keys = ON;')

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
        review_floor_val = float(report_data.get('review_floor', 0.5))
        scale_pos_weight = float(report_data.get('scale_pos_weight', 599.0))
        best_params = report_data.get('best_params', {})
        version = report_data.get('version', 'v1.0')

        ModelConfig.objects.all().delete()
        now = timezone.now()
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
        self.stdout.write("Building 20 demo spending patterns...")
        call_command('build_patterns')

        # 2. Seed Merchants (12 across 8 categories for demo, 10 for minimal)
        merchant_pool = MERCHANT_SEEDS if (is_demo or is_history) else MERCHANT_SEEDS[:8]
        merchants = []
        for i, m_data in enumerate(merchant_pool):
            m, _ = Merchant.objects.get_or_create(
                name=m_data['name'],
                defaults={
                    'category': m_data['category'],
                    'city': m_data['city'],
                    'active': True,
                    'is_demo': True if is_demo else False,
                }
            )
            merchants.append(m)
        demo_merchant = merchants[0]  # Reliance Fresh (busiest merchant)
        self.stdout.write(f"Seeded {len(merchants)} merchants.")

        # 3. Seed Demo Users (4 core accounts)
        from django.contrib.auth.hashers import make_password
        pwd_hashes = {
            "password123": make_password("password123"),
            "Customer@123": make_password("Customer@123"),
            "Analyst@123": make_password("Analyst@123"),
            "Merchant@123": make_password("Merchant@123"),
            "Admin@123": make_password("Admin@123"),
        }

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
                        'is_demo': False,  # Keep primary logins persistent across clear-demo
                        'last_login': now - timedelta(hours=random.randint(1, 12)),
                    }
                )
                u.password = pwd_hashes[pwd]
                u.role = role
                u.status = 'active'
                u.is_active = True
                u.merchant = m_obj
                u.save()
                demo_users_map[em] = u

        demo_customer = demo_users_map["customer@fraudshield.io"]
        demo_analyst = demo_users_map["analyst@fraudshield.io"]

        # 4. Seed People: 40 users total in --demo mode
        # 2 Admins, 5 Analysts, 4 Merchants, 29 Customers (22 active, 3 pending, 2 disabled)
        customers = [demo_customer]
        analysts = [demo_analyst]

        extended_customer_names = CUSTOMER_NAMES + [
            "Shweta Sen", "Manish Tiwari", "Nidhi Agarwal", "Tanvi Mukherjee",
            "Rajesh Khanna", "Siddharth Rao", "Preeti Deshmukh"
        ]

        if is_demo or is_history:
            # 29 Customers
            # Add 3 pending access requests & 2 disabled users
            for i, c_name in enumerate(extended_customer_names[:28]):
                email = f"customer.{c_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
                cust_status = 'active'
                cust_is_active = True
                if i == 0:
                    cust_status = 'pending'
                    cust_is_active = False
                elif i == 1:
                    cust_status = 'pending'
                    cust_is_active = False
                elif i == 2:
                    cust_status = 'disabled'
                    cust_is_active = False

                u, _ = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'name': c_name,
                        'role': 'customer',
                        'department': 'Standard Retail',
                        'organisation': 'Personal Account',
                        'status': cust_status,
                        'is_active': cust_is_active,
                        'city': INDIAN_CITIES[i % len(INDIAN_CITIES)],
                        'is_demo': True,
                        'last_login': now - timedelta(days=random.randint(1, 14)) if cust_is_active else None,
                    }
                )
                u.password = pwd_hashes["Customer@123"]
                u.save()
                customers.append(u)

            # 5 Analysts (1 demo + 4 extra)
            # 1 pending analyst request
            for i, a_name in enumerate(ANALYST_NAMES):
                email = f"analyst.{a_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
                a_status = 'pending' if i == 0 else 'active'
                a_is_active = False if i == 0 else True

                u, _ = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'name': a_name,
                        'role': 'analyst',
                        'department': 'Fraud Investigation Unit',
                        'organisation': 'FraudShield Global',
                        'status': a_status,
                        'is_active': a_is_active,
                        'city': 'Mumbai' if i % 2 == 0 else 'Bengaluru',
                        'is_demo': True,
                        'last_login': now - timedelta(hours=random.randint(2, 48)) if a_is_active else None,
                    }
                )
                u.password = pwd_hashes["Analyst@123"]
                u.save()
                analysts.append(u)

            # 4 Merchant users (1 demo + 3 on different merchants)
            # 1 disabled merchant user
            for i, (m_user_name, m_entity_name) in enumerate(MERCHANT_USER_NAMES):
                email = f"merchant.{m_user_name.lower().replace(' ', '.')}.{i+1}@fraudshield.io"
                linked_m = Merchant.objects.filter(name=m_entity_name).first() or merchants[(i + 1) % len(merchants)]
                m_status = 'disabled' if i == 0 else 'active'
                m_is_active = False if i == 0 else True

                u, _ = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'name': m_user_name,
                        'role': 'merchant',
                        'department': 'Merchant Operations',
                        'organisation': linked_m.name,
                        'status': m_status,
                        'is_active': m_is_active,
                        'merchant': linked_m,
                        'city': linked_m.city,
                        'is_demo': True,
                        'last_login': now - timedelta(days=random.randint(1, 10)) if m_is_active else None,
                    }
                )
                u.password = pwd_hashes["Merchant@123"]
                u.save()

            # 2 Admins (demo admin + compliance admin)
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
                    'is_demo': True,
                    'last_login': now - timedelta(hours=6),
                }
            )
            extra_admin.password = pwd_hashes["Admin@123"]
            extra_admin.save()
        else:
            # Minimal seed: 8 customers, 2 analysts, 1 merchant user, 1 extra admin
            for i, c_name in enumerate(CUSTOMER_NAMES[:8]):
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
                        'is_demo': False,
                    }
                )
                u.set_password("Customer@123")
                u.save()
                customers.append(u)

        self.stdout.write(f"Seeded users: {User.objects.count()} total users across all roles.")

        # 5. Seed Cards: Every customer has 1 to 3 cards
        # Demo customer has 3 cards:
        # Card 1: Active, limit ₹150,000
        # Card 2: Blocked, limit ₹250,000
        # Card 3: Active with travel notice, limit ₹100,000
        cards = []
        demo_customer_cards = [
            ("4532 •••• •••• 8821", "8821", "Visa", "Visa Platinum", 150000.00, "08/28", "active", False),
            ("5241 •••• •••• 4129", "4129", "Mastercard", "Mastercard World", 250000.00, "11/27", "blocked", False),
            ("6071 •••• •••• 9034", "9034", "RuPay", "RuPay Select", 100000.00, "03/29", "active", True),
        ]

        for cnum, last4, brand, ctype, limit, exp, st, travel in demo_customer_cards:
            c, _ = Card.objects.get_or_create(
                owner=demo_customer,
                last4=last4,
                defaults={
                    'card_number': cnum,
                    'brand': brand,
                    'card_type': ctype,
                    'status': st,
                    'spending_limit': limit,
                    'expiry': exp,
                    'travel_notice': travel,
                    'is_demo': True if is_demo else False,
                }
            )
            c.status = st
            c.spending_limit = limit
            c.travel_notice = travel
            c.save()
            cards.append(c)

        rng = random.Random(42)
        card_types = ["Visa Platinum", "Mastercard World", "RuPay Select", "Visa Signature", "Mastercard Black"]

        # Ensure every other customer has 1 to 3 cards
        for cust in customers:
            if cust.id == demo_customer.id:
                continue
            card_count = rng.randint(1, 3)
            for k in range(card_count):
                last4 = str(rng.randint(1000, 9999))
                brand = rng.choice(["Visa", "Mastercard", "RuPay"])
                c_type = rng.choice(card_types)
                limit = rng.choice([50000.0, 100000.0, 200000.0, 500000.0])
                c, _ = Card.objects.get_or_create(
                    owner=cust,
                    last4=last4,
                    defaults={
                        'card_number': f"•••• •••• •••• {last4}",
                        'brand': brand,
                        'card_type': c_type,
                        'status': 'blocked' if (is_demo and rng.random() < 0.08) else 'active',
                        'spending_limit': limit,
                        'expiry': f"{rng.randint(1, 12):02d}/{rng.randint(27, 31)}",
                        'travel_notice': rng.random() < 0.15,
                        'is_demo': True if is_demo else False,
                    }
                )
                cards.append(c)

        self.stdout.write(f"Seeded {len(cards)} cards across customers.")

        if is_minimal:
            # Minimal mode: 0 transactions, exit cleanly
            DisputeEvidence.objects.all().delete()
            CustomerReport.objects.all().delete()
            Dispute.objects.all().delete()
            CaseNote.objects.all().delete()
            CaseEvent.objects.all().delete()
            Case.objects.all().delete()
            Alert.objects.all().delete()
            Transaction.objects.all().delete()
            Notification.objects.all().delete()

            self.stdout.write(self.style.SUCCESS(
                f"\n=== Minimal Demo Seed Completed in {time.time() - start_time:.2f}s ===\n"
                f"  - Users: {User.objects.count()} (4 demo + extra)\n"
                f"  - Merchants: {Merchant.objects.count()}\n"
                f"  - Cards: {Card.objects.count()}\n"
                f"  - ModelConfig: threshold={model_config.threshold}, review_floor={model_config.review_floor}\n"
                f"  - Spending Patterns: 20 demo profiles (P01..P20)\n"
                f"  - Transactions: 0 (Pure Real-User Input Mode)\n"
            ))
            return

        # 6. Transactions: ~6,000 over 60 days in --demo mode (or 3,071 in --history mode)
        df = pd.read_csv(csv_path)
        self.stdout.write(f"Loaded test sample CSV: {len(df)} rows.")

        target_txn_count = 6000 if is_demo else len(df)
        days_span = 60 if is_demo else 30

        if target_txn_count > len(df):
            # Duplicate and sample additional rows with index reset
            extra_needed = target_txn_count - len(df)
            extra_df = df.sample(n=extra_needed, replace=True, random_state=42).copy()
            combined_df = pd.concat([df, extra_df], ignore_index=True)
        else:
            combined_df = df.copy()

        # Apply up to 20% amount variation
        jitter = np.random.uniform(0.80, 1.20, size=len(combined_df))
        combined_df['Amount'] = np.maximum(1.0, combined_df['Amount'] * jitter)

        self.stdout.write(f"Scoring {len(combined_df)} transactions in ONE vectorised batch with real XGBoost & scaler...")
        scores = score(combined_df)
        explanations = explain(combined_df)
        bands = band(scores, threshold=model_config.threshold, review_floor=model_config.review_floor)
        statuses = [status_for(b) for b in bands]

        # Diurnal rhythm and timestamp scheduling
        start_date = now - timedelta(days=days_span)
        transactions_to_create = []

        # Find true fraud rows and legitimate rows
        fraud_indices = [idx for idx, r in combined_df.iterrows() if int(r.get('Class', 0)) == 1]
        legit_indices = [idx for idx, r in combined_df.iterrows() if int(r.get('Class', 0)) == 0]

        # Ensure frauds are spread so that most of the last 30 days show at least one
        fraud_day_assignments = {}
        for fi, f_idx in enumerate(fraud_indices):
            assigned_day = (fi % min(days_span, 30)) + (days_span - min(days_span, 30))
            fraud_day_assignments[f_idx] = assigned_day

        active_cards_list = [c for c in cards if c.status == 'active']
        blocked_cards_list = [c for c in cards if c.status == 'blocked']

        for i in range(len(combined_df)):
            row = combined_df.iloc[i]
            raw_amount = float(row['Amount'])
            amount_inr = round(raw_amount * 90.0, 2)
            if amount_inr <= 0:
                amount_inr = round(float(rng.randint(250, 4800)), 2)

            class_val = int(row['Class']) if 'Class' in row else 0
            true_label = 'FRAUD' if class_val == 1 else 'LEGIT'

            # Timestamp calculation:
            # 25 in last 60 minutes, 40 in last 24 hours, others spread with rhythm
            if i < 25:
                # Last 60 minutes
                ts = now - timedelta(minutes=float(rng.uniform(1.0, 58.0)), seconds=float(rng.randint(0, 59)))
            elif i < 65:
                # Last 24 hours
                ts = now - timedelta(hours=float(rng.uniform(1.0, 23.5)), minutes=float(rng.randint(0, 59)))
            elif i in fraud_day_assignments:
                # Spread fraud across days
                d_offset = fraud_day_assignments[i]
                hour = rng.choice([19, 20, 21, 22, 23, 14, 15, 2, 3])
                ts = start_date + timedelta(days=d_offset, hours=hour, minutes=rng.randint(0, 59))
            else:
                # Weighted diurnal distribution (evening peaks 18:00 - 22:00, weekend peaks)
                d_offset = rng.uniform(0, days_span)
                calc_date = start_date + timedelta(days=d_offset)
                is_weekend = calc_date.weekday() in (5, 6)
                # Pick hour with weighted distribution
                hour_weights = [
                    0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.8, 1.2, 1.5, 1.8, 2.0, 2.2,
                    2.5, 2.4, 2.0, 2.0, 2.2, 2.6, 3.2, 3.5, 3.8, 3.2, 2.0, 1.0
                ]
                hour = rng.choices(range(24), weights=hour_weights)[0]
                ts = calc_date.replace(hour=hour, minute=rng.randint(0, 59), second=rng.randint(0, 59))
                if ts > now:
                    ts = now - timedelta(minutes=rng.randint(2, 55))

            # Merchant assignment: demo merchant gets 25% of traffic
            if rng.random() < 0.25:
                merchant = demo_merchant
            else:
                merchant = merchants[i % len(merchants)]

            # Card assignment: demo customer gets some active traffic, some blocked card declines
            txn_status = statuses[i]
            calc_risk_score = round(float(scores[i]), 4)
            txn_source = 'merchant_terminal' if (merchant.id == demo_merchant.id and i % 8 == 0) else 'seed'

            if i % 65 == 17:
                # Review band transactions (score strictly between review_floor and threshold)
                calc_risk_score = round(float(model_config.review_floor) + 0.003 + (i % 10) * 0.0014, 4)
                txn_status = 'flagged' if (i % 2 == 0) else 'under_review'
                card = cards[0] if (i % 130 == 17) else active_cards_list[i % len(active_cards_list)]
            elif i % 35 == 0 and blocked_cards_list:
                # Declined on blocked card
                card = blocked_cards_list[i % len(blocked_cards_list)]
                txn_status = 'declined'
            elif i % 50 == 0:
                # Declined over limit
                card = active_cards_list[i % len(active_cards_list)]
                amount_inr = round(float(card.spending_limit) + rng.randint(5000, 25000), 2)
                txn_status = 'declined'
            elif i % 8 == 0:
                # Demo customer transaction
                card = cards[0]  # demo active card
            else:
                card = cards[i % len(cards)]

            public_id = f"TXN-{100000 + (i + 1)}"
            model_inputs = {col: float(row[col]) for col in FEATURES}

            txn = Transaction(
                public_id=public_id,
                card=card,
                merchant=merchant,
                merchant_name=merchant.name,
                merchant_category=merchant.category,
                amount=raw_amount,
                amount_inr=amount_inr,
                city=merchant.city or rng.choice(INDIAN_CITIES),
                timestamp=ts,
                risk_score=calc_risk_score,
                scoring_ms=round(float(rng.uniform(14.0, 24.0)), 1),
                status=txn_status,
                true_label=true_label,
                model_inputs=model_inputs,
                factors=explanations[i],
                model_version=version,
                source=txn_source,
                is_demo=True if is_demo else False,
            )
            transactions_to_create.append(txn)

        Transaction.objects.bulk_create(transactions_to_create, batch_size=1000)
        self.stdout.write(f"Bulk created {len(transactions_to_create)} transactions.")

        # Re-fetch created transactions with ids
        created_txns = list(Transaction.objects.all().select_related('card__owner', 'merchant').order_by('id'))

        # 7. Alerts, Cases, CaseEvents, CaseNotes
        alerts_to_create = []
        cases_to_create = []

        active_analysts = [a for a in analysts if a.is_active]
        if not active_analysts:
            active_analysts = [demo_analyst]

        # Alerts for review and high transactions
        flagged_txns = [t for t in created_txns if t.band(model_config.threshold, model_config.review_floor) in ('review', 'high')]
        self.stdout.write(f"Found {len(flagged_txns)} review/high transactions to create alerts & cases.")

        for txn in flagged_txns:
            b = txn.band(model_config.threshold, model_config.review_floor)
            severity = 'high' if b == 'high' else 'medium'
            alert = Alert(
                transaction=txn,
                severity=severity,
                status='new',
                customer_response='none',
                is_demo=True if is_demo else False,
            )
            alerts_to_create.append(alert)

        Alert.objects.bulk_create(alerts_to_create, batch_size=500)
        self.stdout.write(f"Bulk created {len(alerts_to_create)} alerts.")

        created_alerts = list(Alert.objects.all().select_related('transaction__card__owner', 'transaction__merchant'))
        alerts_map = {a.transaction_id: a for a in created_alerts}

        for alert in created_alerts:
            txn = alert.transaction
            b = txn.band(model_config.threshold, model_config.review_floor)
            # Default open case
            case = Case(
                alert=alert,
                transaction=txn,
                status='Open',
                priority='P1' if b == 'high' else 'P2',
                outcome='none',
                assignee=None,
                source='system',
                is_demo=True if is_demo else False,
            )
            cases_to_create.append(case)

        Case.objects.bulk_create(cases_to_create, batch_size=500)
        self.stdout.write(f"Bulk created {len(cases_to_create)} cases.")

        created_cases = list(Case.objects.all().select_related('transaction', 'alert'))

        # Timeline events, notes, and resolutions
        case_events_to_create = []
        case_notes_to_create = []
        notifications_to_create = []

        # Resolve older cases (> 3 days old) following DATASET LABEL
        cutoff_recent = now - timedelta(days=3)

        sample_notes_fraud = [
            "Customer confirmed unauthorized charge; card cancelled and replacement issued.",
            "Multiple rapid transactions detected at anomalous geolocation. Verified chargeback.",
            "IP and device fingerprint mismatch confirmed by cardholder; marked as fraudulent.",
        ]
        sample_notes_safe = [
            "Contacted cardholder via SMS confirmation; customer confirmed authorized retail purchase.",
            "Merchant verified biometric POS terminal swipe; confirmed safe transaction.",
            "Cardholder notified travel status to Mumbai; marked as false alarm / safe.",
        ]

        resolved_count = 0
        in_review_count = 0
        escalated_count = 0
        open_count = 0

        cases_to_update = []
        alerts_to_update = []
        txns_to_update = []

        for idx, case in enumerate(created_cases):
            txn = case.transaction
            assigned_analyst = active_analysts[idx % len(active_analysts)]
            is_older = txn.timestamp < cutoff_recent

            # Initial creation event
            case_events_to_create.append(CaseEvent(
                case=case,
                event_type='system',
                action='Case Created',
                text=f"Transaction {txn.public_id} flagged by ML model (score: {txn.risk_score:.4f}).",
                actor='System',
                is_demo=True if is_demo else False,
            ))

            if is_older:
                # Older cases resolved according to true label
                review_duration_mins = rng.randint(15, 220)
                case.assignee = assigned_analyst
                case.closed_at = txn.timestamp + timedelta(minutes=review_duration_mins)

                if idx % 20 == 0:
                    # Some ambiguous ones escalated
                    case.status = 'Escalated'
                    case.outcome = 'escalated'
                    escalated_count += 1
                    case_notes_to_create.append(CaseNote(
                        case=case,
                        author=assigned_analyst.name,
                        text="Unresolved dispute between merchant receipt and customer claim; escalating to senior fraud risk committee.",
                        is_demo=True if is_demo else False,
                    ))
                elif txn.true_label == 'FRAUD':
                    case.status = 'Confirmed Fraud'
                    case.outcome = 'fraud'
                    txn.status = 'confirmed_fraud'
                    txns_to_update.append(txn)
                    resolved_count += 1
                    case_notes_to_create.append(CaseNote(
                        case=case,
                        author=assigned_analyst.name,
                        text=sample_notes_fraud[idx % len(sample_notes_fraud)],
                        is_demo=True if is_demo else False,
                    ))
                else:
                    case.status = 'Confirmed Safe'
                    case.outcome = 'safe'
                    txn.status = 'confirmed_safe'
                    txns_to_update.append(txn)
                    resolved_count += 1
                    case_notes_to_create.append(CaseNote(
                        case=case,
                        author=assigned_analyst.name,
                        text=sample_notes_safe[idx % len(sample_notes_safe)],
                        is_demo=True if is_demo else False,
                    ))

                # Update linked alert
                if case.alert:
                    case.alert.status = 'resolved'
                    case.alert.customer_response = 'fraud' if case.outcome == 'fraud' else 'legit'
                    alerts_to_update.append(case.alert)

                case_events_to_create.append(CaseEvent(
                    case=case,
                    event_type='status_change',
                    action='Status Changed',
                    text=f"Case marked as {case.status} by {assigned_analyst.name}.",
                    actor=assigned_analyst.name,
                    is_demo=True if is_demo else False,
                ))
            else:
                # Recent cases: distribute across Open, In Review, Escalated, Resolved
                # Ensure demo analyst has assigned cases
                if idx % 4 == 0:
                    case.status = 'In Review'
                    case.assignee = demo_analyst if idx % 8 == 0 else assigned_analyst
                    in_review_count += 1
                elif idx % 4 == 1:
                    case.status = 'Open'
                    case.assignee = demo_analyst if idx % 8 == 1 else None
                    open_count += 1
                elif idx % 4 == 2:
                    case.status = 'Escalated'
                    case.assignee = assigned_analyst
                    escalated_count += 1
                else:
                    case.status = 'Resolved'
                    case.outcome = 'safe' if txn.true_label != 'FRAUD' else 'fraud'
                    case.assignee = assigned_analyst
                    case.closed_at = txn.timestamp + timedelta(minutes=45)
                    resolved_count += 1

            cases_to_update.append(case)

        Case.objects.bulk_update(cases_to_update, ['status', 'outcome', 'assignee', 'closed_at'], batch_size=500)
        if alerts_to_update:
            Alert.objects.bulk_update(alerts_to_update, ['status', 'customer_response'], batch_size=500)
        if txns_to_update:
            Transaction.objects.bulk_update(txns_to_update, ['status'], batch_size=500)
        CaseEvent.objects.bulk_create(case_events_to_create, batch_size=500)
        CaseNote.objects.bulk_create(case_notes_to_create, batch_size=500)
        self.stdout.write(f"Updated cases: {open_count} Open, {in_review_count} In Review, {escalated_count} Escalated, {resolved_count} Resolved.")

        # Ensure Demo Customer has exactly 2 pending alerts and several resolved alerts
        demo_cust_txns = Transaction.objects.filter(card__owner=demo_customer).order_by('-timestamp')
        demo_alerts = Alert.objects.filter(transaction__in=demo_cust_txns)

        if demo_alerts.count() >= 2:
            d_alerts_list = list(demo_alerts)
            # 2 pending
            d_alerts_list[0].status = 'new'
            d_alerts_list[0].customer_response = 'none'
            d_alerts_list[0].save()
            d_alerts_list[1].status = 'new'
            d_alerts_list[1].customer_response = 'none'
            d_alerts_list[1].save()
            # rest resolved
            for da in d_alerts_list[2:]:
                da.status = 'resolved'
                da.customer_response = 'legit'
                da.save()
        elif demo_cust_txns.exists():
            # Create 2 pending alerts for demo customer
            for t in demo_cust_txns[:2]:
                Alert.objects.create(
                    transaction=t,
                    severity='high',
                    status='new',
                    customer_response='none',
                    is_demo=True if is_demo else False,
                )

        # 8. Customer Reports & Disputes
        # 8 Customer Reports in different stages (3 on APPROVED txns, 1 on false negative pattern)
        approved_txns = list(Transaction.objects.filter(status='approved').order_by('-id')[:20])
        # Find false negative: fraud row that scored low (< review_floor)
        false_negative_txn = Transaction.objects.filter(true_label='FRAUD', risk_score__lt=model_config.review_floor).first()
        if not false_negative_txn and approved_txns:
            false_negative_txn = approved_txns[0]

        report_txns = []
        if false_negative_txn:
            report_txns.append(false_negative_txn)
        for at in approved_txns:
            if at.id != getattr(false_negative_txn, 'id', None) and len(report_txns) < 8:
                report_txns.append(at)

        report_reasons = ['not_mine', 'duplicate', 'wrong_amount', 'not_received', 'other']
        report_notes = [
            "I noticed this charge on my statement while travelling; I never shopped at this store.",
            "Billed twice within 2 minutes for the same grocery order checkout.",
            "Amount charged was ₹4,200 instead of the invoice amount ₹2,400.",
            "Ordered electronics online 14 days ago; package never arrived and merchant unresponsive.",
            "Card was in my possession at the time of transaction; suspicious online merchant.",
            "Card used overseas while I was in Mumbai; unauthorized payment.",
            "Duplicate debit on my statement for coffee shop visit.",
            "Subscription renewal billed after cancellation confirmation was received.",
        ]
        dispute_stages = ['opened', 'evidence', 'review', 'resolved']

        for r_idx, r_txn in enumerate(report_txns[:8]):
            # Ensure report transaction is linked to demo customer card
            r_txn.card = cards[0]
            r_txn.save()
            r_cust = demo_customer
            stage = dispute_stages[r_idx % len(dispute_stages)]
            status_str = 'Resolved' if stage == 'resolved' else ('Under Review' if stage == 'review' else 'Submitted')

            # Create Case for this report
            r_case = Case.objects.create(
                transaction=r_txn,
                status='Resolved' if stage == 'resolved' else 'In Review',
                priority='P1',
                outcome='fraud' if stage == 'resolved' else 'none',
                assignee=demo_analyst,
                source='customer_report',
                is_demo=True if is_demo else False,
            )

            # Create Dispute
            r_disp = Dispute.objects.create(
                merchant=r_txn.merchant,
                transaction=r_txn,
                customer=r_cust,
                customer_name=r_cust.name,
                amount_inr=r_txn.amount_inr,
                reason=report_notes[r_idx],
                stage=stage,
                status=status_str,
                outcome='Refund Approved' if stage == 'resolved' else '',
                evidence_notes="Cardholder submitted written dispute statement and transaction screenshot.",
                is_demo=True if is_demo else False,
            )

            # Create CustomerReport
            CustomerReport.objects.create(
                transaction=r_txn,
                customer=r_cust,
                reason=report_reasons[r_idx % len(report_reasons)],
                note=report_notes[r_idx],
                case=r_case,
                dispute=r_disp,
                is_demo=True if is_demo else False,
            )

        self.stdout.write(f"Created {CustomerReport.objects.count()} customer reports with linked cases & disputes.")

        # At least 12 disputes for the demo merchant across all four stages
        demo_m_txns = list(Transaction.objects.filter(merchant=demo_merchant).order_by('-id')[:25])
        existing_demo_disputes = Dispute.objects.filter(merchant=demo_merchant).count()
        needed_disputes = max(0, 14 - existing_demo_disputes)

        dispute_titles = [
            "Customer claims unauthorized debit card checkout",
            "Item damaged during transit; customer requested refund",
            "Double swipe at checkout counter; double debit reported",
            "Cardholder claims card was stolen and used at terminal",
            "Order cancelled prior to dispatch; merchant settlement discrepancy",
            "Digital voucher code was inactive when redeemed",
            "Subscription billed after customer requested downgrade",
            "Incorrect billing currency conversion reported by international customer",
            "Customer returned item in-store; refund receipt pending bank clearance",
            "Proof of delivery signature disputed by recipient",
            "Delivery delayed by 10 days; chargeback initiated by customer",
            "Merchant terminal communication timeout caused dual pending hold",
            "Customer reported card skimming alert after retail checkout",
            "Duplicate payment processed via POS QR code scan",
        ]

        evidence_created = 0
        for d_i in range(needed_disputes):
            d_txn = demo_m_txns[d_i % len(demo_m_txns)] if demo_m_txns else created_txns[d_i]
            d_cust = d_txn.card.owner if (d_txn.card and d_txn.card.owner) else demo_customer
            stage = dispute_stages[d_i % len(dispute_stages)]
            status_str = 'Resolved' if stage == 'resolved' else ('Under Review' if stage == 'review' else 'Submitted')
            outcome_str = 'Chargeback Accepted' if stage == 'resolved' else ''

            disp = Dispute.objects.create(
                merchant=demo_merchant,
                transaction=d_txn,
                customer=d_cust,
                customer_name=d_cust.name,
                amount_inr=d_txn.amount_inr,
                reason=dispute_titles[d_i % len(dispute_titles)],
                stage=stage,
                status=status_str,
                outcome=outcome_str,
                evidence_notes="Merchant uploaded signed invoice receipt and shipping tracking log.",
                is_demo=True if is_demo else False,
            )

            # Generate real PDF / PNG evidence files for some disputes
            if d_i < 6:
                if d_i % 2 == 0:
                    ev_file = ContentFile(SAMPLE_PDF_BYTES, name=f"invoice_receipt_{disp.id}.pdf")
                    ev_name = f"merchant_invoice_{disp.id}.pdf"
                else:
                    ev_file = ContentFile(SAMPLE_PNG_BYTES, name=f"pos_terminal_receipt_{disp.id}.png")
                    ev_name = f"pos_terminal_receipt_{disp.id}.png"

                DisputeEvidence.objects.create(
                    dispute=disp,
                    file=ev_file,
                    original_name=ev_name,
                    uploaded_by=demo_users_map["merchant@fraudshield.io"],
                    is_demo=True if is_demo else False,
                )
                evidence_created += 1

        self.stdout.write(f"Created {Dispute.objects.filter(merchant=demo_merchant).count()} disputes for demo merchant with {evidence_created} evidence files.")

        # 9. 150 Audit Log entries across 30 days and all users/roles
        audit_actions = [
            ('auth.login', 'User logged into web dashboard', 'auth'),
            ('auth.logout', 'User logged out', 'auth'),
            ('threshold.update', f'Admin updated risk threshold to {model_config.threshold}', 'config'),
            ('case.decision', 'Analyst marked Case as Confirmed Fraud', 'case'),
            ('case.assign', 'Analyst assigned Case to investigation queue', 'case'),
            ('card.block', 'Card was blocked due to high risk anomaly', 'card'),
            ('card.unblock', 'Card was reactivated after identity verification', 'card'),
            ('card.issue', 'New platinum card issued to customer account', 'card'),
            ('transaction.export', 'Exported transaction report CSV', 'export'),
            ('alert.assign', 'Alert assigned to Lead Analyst', 'alert'),
            ('dispute.evidence_upload', 'Merchant uploaded proof of delivery document', 'dispute'),
            ('report.submit', 'Customer reported unauthorized card charge', 'report'),
        ]
        all_users = list(User.objects.all())
        audit_logs_to_create = []

        for al_idx in range(150):
            act, desc, tgt = audit_actions[al_idx % len(audit_actions)]
            u = all_users[al_idx % len(all_users)]
            ts_audit = now - timedelta(days=float(al_idx) * 0.2)
            log = AuditLog(
                user=u,
                role=u.role,
                action=act,
                target=f"{tgt}_{100 + al_idx}",
                ip_address=f"192.168.1.{10 + (al_idx % 60)}",
                details={'description': desc, 'event_index': al_idx},
                created_at=ts_audit,
                is_demo=True if is_demo else False,
            )
            audit_logs_to_create.append(log)

        AuditLog.objects.bulk_create(audit_logs_to_create)
        self.stdout.write("Created 150 audit log entries.")

        # 10. 15+ Notifications for every role over time (some unread)
        notifs_by_role = {
            "admin": [
                ("System Security Digest", "Weekly risk scan completed: 0 critical infrastructure vulnerabilities found."),
                ("Threshold Modification", f"Model threshold set to {model_config.threshold}. Review floor maintained at {model_config.review_floor}."),
                ("User Access Request", "New merchant onboarding request received for verification."),
                ("Batch Pipeline Completed", "Daily transaction scoring batch finished in 18.2ms average latency."),
                ("Audit Log Archived", "System compliance archive generated for previous calendar quarter."),
                ("Model Calibration", "Feature contribution weights recalibrated against latest dataset validation fold."),
                ("Infrastructure Alert", "Database connection pool utilization normalized below 25% threshold."),
                ("Security Notice", "Mandatory two-factor authentication enabled for all administrative accounts."),
                ("Export Completed", "Monthly governance transaction ledger export CSV ready for download."),
                ("Security Policy Update", "Card brand authorization timeout limits updated to 3500ms."),
                ("Merchant Registered", "New merchant Croma Electronics verified and added to registry."),
                ("Anomaly Spike Detected", "Temporary risk score elevation detected during evening shopping peak."),
                ("System Health Status", "All microservice health probes reporting 100% availability."),
                ("Database Migration", "Applied schema update 0006 with demo flags successfully."),
                ("Compliance Audit Passed", "PCI-DSS quarterly data processing verification completed without remarks."),
                ("Admin Session Expired", "Previous administrative terminal session automatically terminated."),
            ],
            "analyst": [
                ("High Priority Alert", "Transaction TXN-100012 scored 0.942. Immediate triage recommended."),
                ("Case Assigned to You", "Case CASE-104 assigned to your queue for forensic review."),
                ("Customer Response Received", "Cardholder answered 'No, not me' for transaction alert."),
                ("Case Escalation Notice", "Case CASE-108 escalated to Senior Investigation Lead."),
                ("Merchant Dispute Response", "Merchant uploaded evidence document for transaction inquiry."),
                ("Review Queue Cleared", "Morning P1 triage backlog resolved within SLA duration."),
                ("Model False Alarm", "Chargeback investigation cleared; false positive recorded for retraining."),
                ("Suspicious Velocity Burst", "Multiple card authorizations within 60 seconds detected at POS terminal."),
                ("Case Resolved", "Case CASE-115 closed with outcome Confirmed Safe."),
                ("Forensic Note Added", "Senior Analyst added evidence notes to ongoing investigation."),
                ("Card Block Confirmation", "Card ending 4129 placed on hold following fraud determination."),
                ("New Transaction Stream", "Real-time feed streaming live charges at 3-second polling interval."),
                ("Customer Report Opened", "Cardholder submitted unauthorized transaction dispute."),
                ("Investigation SLA Reminder", "2 cases in your queue approaching 4-hour resolution target."),
                ("Daily Triage Briefing", "Summary of 12 flagged charges available for review desk."),
                ("Dispute Outcome Updated", "Merchant chargeback inquiry marked as Refund Approved."),
            ],
            "customer": [
                ("Transaction Alert", "Charge of ₹4,250.00 at Reliance Digital was approved on your card ending 8821."),
                ("Suspicious Charge Flagged", "We held a payment of ₹18,500.00 for your verification. Please review."),
                ("Card Protection Notice", "Your Mastercard ending in 4129 has been temporarily blocked for security."),
                ("Dispute Status Updated", "Your report on transaction TXN-100015 has been escalated to merchant operations."),
                ("Monthly Statement Ready", "Your card statement for the previous billing cycle is ready for download."),
                ("Travel Notice Active", "Travel notice confirmed active for your RuPay Select card ending 9034."),
                ("Payment Approved", "Transaction of ₹1,200.00 at Swiggy Orders was successfully completed."),
                ("Alert Resolved", "Thank you for confirming your transaction. Your card remains safe and active."),
                ("Credit Limit Notification", "You have utilized 45% of your available credit line this month."),
                ("Security Recommendation", "Enable SMS transaction alerts for enhanced account safety."),
                ("Password Change Notice", "Your FraudShield account security credentials were confirmed."),
                ("Merchant Refund Processed", "Credit of ₹2,400.00 from BigBasket credited back to your account."),
                ("Card Replaced", "Your replacement card has been dispatched via courier tracking."),
                ("Spending Summary", "You spent ₹14,800.00 this week across grocery and retail categories."),
                ("Dispute Resolved in Your Favor", "Investigation concluded: disputed charge of ₹3,100.00 refunded."),
                ("Annual Card Benefits", "Review exclusive airport lounge and cashback perks on your Platinum card."),
            ],
            "merchant": [
                ("Daily Settlement Credited", "Merchant payout batch of ₹248,500.00 processed to your bank account."),
                ("New Chargeback Opened", "Customer filed a dispute for transaction TXN-100008. Please review evidence."),
                ("Evidence Submission Required", "Dispute #14 requires proof of delivery within 7 business days."),
                ("Dispute Resolved", "Dispute for ₹4,200.00 was resolved with merchant documentation accepted."),
                ("POS Terminal Terminal Active", "Terminal #104 online and processing customer authorizations."),
                ("Fraud Rate Alert", "Your 30-day merchant fraud rate is healthy at 0.14% (well below 1% threshold)."),
                ("High Volume Day", "Your store processed over 150 transactions today. Great job!"),
                ("Weekly Sales Digest", "Gross merchant volume reached ₹840,000.00 across all retail categories."),
                ("Chargeback Reversed", "Customer withdrew unauthorized charge complaint after receipt verification."),
                ("API Key Rotation Reminder", "Recommended security update: rotate your POS terminal authorization keys."),
                ("New Sale Approved", "Customer transaction of ₹1,850.00 successfully authorized via payment terminal."),
                ("Refund Processed", "Customer return refund of ₹650.00 debited from daily settlement balance."),
                ("Terminal Firmware Verified", "Virtual payment terminal running latest security encryption standards."),
                ("Dispute Review Complete", "Operations analyst concluded inquiry for customer chargeback #18."),
                ("Monthly Merchant Statement", "Monthly merchant fee and transaction volume report is now ready."),
                ("Batch Reconciliation", "All end-of-day transaction registers matched settlement records."),
            ],
        }

        notifs_to_create = []
        for role_name, notif_list in notifs_by_role.items():
            demo_u = demo_users_map.get(f"{role_name}@fraudshield.io")
            role_users = list(User.objects.filter(role=role_name))
            if not role_users:
                continue

            for n_idx, (title, body) in enumerate(notif_list):
                if demo_u and n_idx < 8:
                    u = demo_u
                else:
                    u = role_users[n_idx % len(role_users)]

                is_read = (n_idx >= 3)  # First 3 are unread so badge shows > 0
                ts_notif = now - timedelta(days=float(n_idx) * 1.5, hours=rng.randint(1, 12))
                notifs_to_create.append(Notification(
                    user=u,
                    type='alert' if 'Alert' in title or 'Flagged' in title else 'system',
                    title=title,
                    body=body,
                    link='/alerts' if 'Alert' in title else '/dashboard',
                    is_read=is_read,
                    created_at=ts_notif,
                    is_demo=True if is_demo else False,
                ))

        Notification.objects.bulk_create(notifs_to_create)
        self.stdout.write(f"Created {Notification.objects.count()} notifications across all roles.")

        # 11. Final Summary Statistics
        total_txns = Transaction.objects.count()
        safe_count = Transaction.objects.filter(risk_score__lt=model_config.review_floor).count()
        review_count = Transaction.objects.filter(risk_score__gte=model_config.review_floor, risk_score__lt=model_config.threshold).count()
        high_count = Transaction.objects.filter(risk_score__gte=model_config.threshold).count()
        declined_count = Transaction.objects.filter(status='declined').count()

        actual_frauds = Transaction.objects.filter(true_label='FRAUD').count()
        fraud_rate = (actual_frauds / total_txns * 100) if total_txns > 0 else 0.0

        tp_high = Transaction.objects.filter(true_label='FRAUD', risk_score__gte=model_config.threshold).count()
        fp_high = Transaction.objects.filter(true_label='LEGIT', risk_score__gte=model_config.threshold).count()
        fn_high = Transaction.objects.filter(true_label='FRAUD', risk_score__lt=model_config.threshold).count()

        prec_high = (tp_high / (tp_high + fp_high) * 100) if (tp_high + fp_high) > 0 else 0.0
        rec_high = (tp_high / (tp_high + fn_high) * 100) if (tp_high + fn_high) > 0 else 0.0

        elapsed = time.time() - start_time

        summary_text = f"""
================================================================================
                         FRAUDSHIELD SEED SUMMARY
================================================================================
Mode                 : {'DEMO (--demo)' if is_demo else ('HISTORY (--history)' if is_history else 'MINIMAL (--minimal)')}
Execution Time       : {elapsed:.2f} seconds

Database Table Counts:
  - Users            : {User.objects.count()} (22 customers, 5 analysts, 4 merchants, 2 admins)
  - Merchants        : {Merchant.objects.count()} (across all 8 industry categories)
  - Cards            : {Card.objects.count()} (demo customer owns 3: active, blocked, travel)
  - Transactions     : {Transaction.objects.count()} ({declined_count} declined)
  - Alerts           : {Alert.objects.count()} (demo customer has 2 pending alerts)
  - Cases            : {Case.objects.count()} (Open, In Review, Escalated, Resolved)
  - Customer Reports : {CustomerReport.objects.count()} (including false negative & approved)
  - Disputes         : {Dispute.objects.count()} (demo merchant has {Dispute.objects.filter(merchant=demo_merchant).count()} disputes)
  - Dispute Evidence : {DisputeEvidence.objects.count()} (PDF and PNG documents attached)
  - Audit Logs       : {AuditLog.objects.count()} (across all actions & users)
  - Notifications    : {Notification.objects.count()} (15+ per role with unread badges)
  - ModelConfig      : {ModelConfig.objects.count()} (threshold={model_config.threshold}, review_floor={model_config.review_floor})

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
================================================================================
"""
        self.stdout.write(self.style.SUCCESS(summary_text))
