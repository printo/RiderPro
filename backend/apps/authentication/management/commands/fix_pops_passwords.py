"""
Management command to fix empty passwords for POPS-authenticated users.

This command sets unusable passwords for all users who:
1. Have auth_source='pops' (authenticated via PIA/POPS)
2. Have empty or missing passwords

Usage:
    python manage.py fix_pops_passwords
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Fix empty passwords for POPS-authenticated users by setting unusable passwords'

    def handle(self, *args, **options):
        # Find all POPS users
        pops_users = User.objects.filter(auth_source='pops')
        
        total_count = pops_users.count()
        self.stdout.write(f'Found {total_count} POPS user(s) to check.\n')
        
        fixed_count = 0
        already_fixed_count = 0
        
        for user in pops_users:
            # Refresh from DB to get current password value
            user.refresh_from_db()
            
            # Check password field directly - it might be empty string, None, or already unusable
            password_value = user.password
            
            # Check if password is empty (None, empty string, or whitespace)
            is_empty = not password_value or (isinstance(password_value, str) and password_value.strip() == '')
            
            # Check if it's already an unusable password (starts with '!' or is the unusable marker)
            is_unusable = password_value and password_value.startswith('!')
            
            if is_empty:
                # Password is empty - set unusable password
                user.set_unusable_password()
                user.save(update_fields=['password'])
                fixed_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Fixed empty password for user: {user.username} (ID: {user.id})'
                    )
                )
            elif not is_unusable and not user.has_usable_password():
                # Password exists but is not usable and not marked as unusable
                # This shouldn't happen, but let's fix it anyway
                user.set_unusable_password()
                user.save(update_fields=['password'])
                fixed_count += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠ Fixed invalid password for user: {user.username} (ID: {user.id})'
                    )
                )
            elif is_unusable:
                # Already has unusable password - no action needed
                already_fixed_count += 1
                self.stdout.write(
                    self.style.NOTICE(
                        f'○ User {user.username} (ID: {user.id}) already has unusable password'
                    )
                )
            else:
                # User has a usable password - this is unexpected for POPS users
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠ User {user.username} (ID: {user.id}) has a usable password (unexpected for POPS user)'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSummary:\n'
                f'  - Total POPS users: {total_count}\n'
                f'  - Fixed (empty passwords): {fixed_count}\n'
                f'  - Already correct (unusable passwords): {already_fixed_count}\n'
            )
        )

