import sys
import time
from django.core.management.base import BaseCommand
from apps.fraud.simulator import create_simulated_transaction


class Command(BaseCommand):
    help = "Run the real-time transaction simulator, scoring new transactions at specified intervals."

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=float,
            default=3.0,
            help='Interval in seconds between simulated transactions (default: 3)'
        )

    def handle(self, *args, **options):
        import os
        if not (os.getenv('DEMO_SIMULATOR', 'false').lower() in ('true', '1')):
            self.stderr.write(self.style.ERROR("Simulator is disabled in demo mode. Set DEMO_SIMULATOR=true in .env to run."))
            sys.exit(1)

        interval = options['interval']
        self.stdout.write(self.style.SUCCESS(f"Starting transaction simulator with {interval}s interval... (Ctrl+C to stop)"))

        count = 0
        try:
            while True:
                txn = create_simulated_transaction()
                count += 1
                band_str = txn.band()
                if band_str == 'high':
                    style_fn = self.style.ERROR
                elif band_str == 'review':
                    style_fn = self.style.WARNING
                else:
                    style_fn = self.style.SUCCESS

                self.stdout.write(style_fn(
                    f"[{count}] {txn.public_id} | Amount: INR {txn.amount_inr:,.2f} | "
                    f"Risk: {txn.risk_score:.4f} | Band: {band_str.upper()} | Status: {txn.status}"
                ))
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.NOTICE(f"\nSimulator stopped. Total transactions generated: {count}"))
