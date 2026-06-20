"""
Delete old OTP challenges. Codes live ~5 minutes, so anything older than a day
or two is dead weight. Run from cron, e.g. daily:

    python manage.py cleanup_otp_challenges --days 2
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.authentication.models import OtpChallenge


class Command(BaseCommand):
    help = "Delete OTP challenges older than --days (default 2)."

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=2,
                            help='Delete challenges created more than this many days ago.')

    def handle(self, *args, **options):
        days = options['days']
        cutoff = timezone.now() - timedelta(days=days)
        qs = OtpChallenge.objects.filter(created_at__lt=cutoff)
        count = qs.count()
        qs.delete()
        self.stdout.write(self.style.SUCCESS(
            f"Deleted {count} OTP challenge(s) older than {days} day(s)."
        ))
