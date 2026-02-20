"""
Management command to cleanup old shipment records
Maintains only last N days of data for performance

Usage:
    python manage.py cleanup_old_shipments --days=3 --dry-run
    python manage.py cleanup_old_shipments --days=3 --backup

Setup:
    # Add to crontab for daily execution at 2 AM:
    0 2 * * * cd /path/to/backend && python manage.py cleanup_old_shipments --days=3 >> cleanup.log 2>&1

Configuration:
    # Add to settings.py:
    CLEANUP_SETTINGS = {
        'enabled': True,
        'default_retention_days': 3,
        'backup_before_delete': False,
        'cleanup_time': '02:00',
        'log_file': 'cleanup.log',
    }
"""
import logging
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.conf import settings

from apps.shipments.models import Shipment, Acknowledgment, OrderEvent, RouteSession, RouteTracking

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean up old shipment records, keeping only last N days of data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=getattr(settings, 'CLEANUP_SETTINGS', {}).get('default_retention_days', 3),
            help=f'Number of days to keep (default: {getattr(settings, "CLEANUP_SETTINGS", {}).get("default_retention_days", 3)})'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )
        parser.add_argument(
            '--backup',
            action='store_true',
            default=getattr(settings, 'CLEANUP_SETTINGS', {}).get('backup_before_delete', False),
            help='Create backup before deletion'
        )

    def handle(self, *args, **options):
        days_to_keep = options['days']
        dry_run = options['dry_run']
        create_backup = options['backup']
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Starting cleanup: Keep last {days_to_keep} days, '
                f'Dry run: {dry_run}, Backup: {create_backup}'
            )
        )

        # Calculate cutoff date
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        self.stdout.write(f'Cutoff date: {cutoff_date}')

        # Get statistics before cleanup
        stats_before = self.get_statistics()
        self.print_statistics('Before cleanup', stats_before)

        if create_backup and not dry_run:
            self.create_backup(cutoff_date)

        # Perform cleanup
        with transaction.atomic():
            deleted_counts = self.cleanup_old_data(cutoff_date, dry_run)

        # Get statistics after cleanup
        if not dry_run:
            stats_after = self.get_statistics()
            self.print_statistics('After cleanup', stats_after)

        # Print summary
        self.print_summary(deleted_counts, dry_run)

    def get_statistics(self):
        """Get current database statistics"""
        return {
            'shipments': Shipment.objects.count(),
            'acknowledgments': Acknowledgment.objects.count(),
            'order_events': OrderEvent.objects.count(),
            'route_sessions': RouteSession.objects.count(),
            'route_tracking': RouteTracking.objects.count(),
        }

    def print_statistics(self, title, stats):
        """Print database statistics"""
        self.stdout.write(f'\n{title}:')
        for model, count in stats.items():
            self.stdout.write(f'  {model}: {count:,}')

    def create_backup(self, cutoff_date):
        """Create backup of data to be deleted"""
        self.stdout.write('Creating backup...')
        # TODO: Implement backup logic
        # Could export to CSV, JSON, or archive table
        self.stdout.write(self.style.WARNING('Backup not implemented yet'))

    def cleanup_old_data(self, cutoff_date, dry_run):
        """Clean up old data"""
        deleted_counts = {}
        
        # Clean up RouteTracking (largest table first)
        tracking_qs = RouteTracking.objects.filter(timestamp__lt=cutoff_date)
        deleted_counts['route_tracking'] = self.delete_queryset(tracking_qs, 'RouteTracking', dry_run)
        
        # Clean up OrderEvent
        events_qs = OrderEvent.objects.filter(created_at__lt=cutoff_date)
        deleted_counts['order_events'] = self.delete_queryset(events_qs, 'OrderEvent', dry_run)
        
        # Clean up Acknowledgment
        ack_qs = Acknowledgment.objects.filter(acknowledgment_captured_at__lt=cutoff_date)
        deleted_counts['acknowledgments'] = self.delete_queryset(ack_qs, 'Acknowledgment', dry_run)
        
        # Clean up RouteSession
        session_qs = RouteSession.objects.filter(created_at__lt=cutoff_date)
        deleted_counts['route_sessions'] = self.delete_queryset(session_qs, 'RouteSession', dry_run)
        
        # Clean up Shipment (main table)
        shipment_qs = Shipment.objects.filter(created_at__lt=cutoff_date)
        deleted_counts['shipments'] = self.delete_queryset(shipment_qs, 'Shipment', dry_run)
        
        return deleted_counts

    def delete_queryset(self, queryset, model_name, dry_run):
        """Delete queryset and return count"""
        count = queryset.count()
        if count > 0:
            if dry_run:
                self.stdout.write(f'Would delete {count:,} {model_name} records')
            else:
                self.stdout.write(f'Deleting {count:,} {model_name} records...')
                queryset.delete()
                self.stdout.write(self.style.SUCCESS(f'Deleted {count:,} {model_name} records'))
        return count

    def print_summary(self, deleted_counts, dry_run):
        """Print cleanup summary"""
        total_deleted = sum(deleted_counts.values())
        
        self.stdout.write(f'\nSummary:')
        if dry_run:
            self.stdout.write(f'  Would delete: {total_deleted:,} total records')
            for model, count in deleted_counts.items():
                if count > 0:
                    self.stdout.write(f'    {model}: {count:,}')
        else:
            self.stdout.write(self.style.SUCCESS(f'  Deleted: {total_deleted:,} total records'))
            for model, count in deleted_counts.items():
                if count > 0:
                    self.stdout.write(f'    {model}: {count:,}')
        
        self.stdout.write(self.style.SUCCESS('Cleanup completed successfully!'))
