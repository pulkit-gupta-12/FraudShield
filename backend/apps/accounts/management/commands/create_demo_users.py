from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.fraud.models import Merchant

User = get_user_model()

class Command(BaseCommand):
    help = "Creates the 4 demo accounts for FraudShield (admin, analyst, customer, merchant)."

    def handle(self, *args, **options):
        # Ensure a default demo merchant exists
        merchant, _ = Merchant.objects.get_or_create(
            name="Reliance Digital",
            defaults={"category": "Electronics", "city": "Mumbai"}
        )

        demo_users = [
            {
                "email": "admin@fraudshield.com",
                "alt_email": "admin@fraudshield.io",
                "name": "Admin User",
                "role": "admin",
                "password": "Admin@123",
                "department": "Security & Administration",
                "organisation": "FraudShield Global",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "analyst@fraudshield.com",
                "alt_email": "analyst@fraudshield.io",
                "name": "Lead Analyst",
                "role": "analyst",
                "password": "Analyst@123",
                "department": "Fraud Investigation Unit",
                "organisation": "FraudShield Global",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "customer@fraudshield.com",
                "alt_email": "customer@fraudshield.io",
                "name": "Aarav Sharma",
                "role": "customer",
                "password": "Customer@123",
                "department": "Retail Customer",
                "organisation": "Personal Account",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "merchant@fraudshield.com",
                "alt_email": "merchant@fraudshield.io",
                "name": "Merchant Partner",
                "role": "merchant",
                "password": "Merchant@123",
                "department": "Merchant Operations",
                "organisation": "Reliance Digital",
                "merchant": merchant,
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        for user_data in demo_users:
            emails = [user_data["email"], user_data["alt_email"]]
            for email in emails:
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        "name": user_data["name"],
                        "role": user_data["role"],
                        "department": user_data["department"],
                        "organisation": user_data["organisation"],
                        "status": "active",
                        "is_active": True,
                        "is_staff": user_data.get("is_staff", False),
                        "is_superuser": user_data.get("is_superuser", False),
                        "merchant": user_data.get("merchant", None),
                    }
                )
                user.set_password(user_data["password"])
                user.status = "active"
                user.is_active = True
                user.role = user_data["role"]
                if "merchant" in user_data:
                    user.merchant = user_data["merchant"]
                user.save()
                action_str = "Created" if created else "Updated"
                self.stdout.write(self.style.SUCCESS(f"{action_str} {email} ({user.role})"))

        self.stdout.write(self.style.SUCCESS("All 4 demo users successfully created/configured!"))
