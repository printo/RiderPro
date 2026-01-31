"""
Custom authentication backend for RiderPro
Supports:
1. Local database users (admin users created in RiderPro)
2. POPS API authentication (fallback if local fails)
3. Rider accounts (local riders without POPS login)
"""
import logging
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from django.db import transaction
import bcrypt
from utils.pops_client import pops_client

logger = logging.getLogger(__name__)
User = get_user_model()


class RiderProAuthBackend(BaseBackend):
    """
    Multi-source authentication backend:
    1. Try local User database first
    2. Try RiderAccount database
    3. Fallback to POPS API
    """
    
    def authenticate(self, request, email=None, password=None, **kwargs):
        """
        Authenticate user from multiple sources
        
        Flow:
        1. Try local User model (admin users)
        2. Try RiderAccount model (local riders)
        3. Fallback to POPS API (POPS users)
        """
        if not email or not password:
            return None
        
        # Check if this is an API user - API users cannot authenticate via password
        # They authenticate via API keys only (for webhooks)
        try:
            api_user = User.objects.get(email=email, is_api_user=True)
            if api_user:
                logger.warning(f"API user attempted password authentication: {email}")
                return None  # API users cannot authenticate via password
        except User.DoesNotExist:
            pass
        
        # 1. Try local User database first
        try:
            user = User.objects.get(email=email)
            # Double-check it's not an API user
            if user.is_api_user:
                logger.warning(f"API user attempted password authentication: {email}")
                return None
            if user.check_password(password):
                logger.info(f"User authenticated from local DB: {email}")
                return user
        except User.DoesNotExist:
            pass
        except Exception as e:
            logger.error(f"Error checking local user: {e}")
        
        # 2. Try RiderAccount database
        try:
            from .models import RiderAccount
            rider = RiderAccount.objects.get(rider_id=email)
            if rider.is_approved and rider.is_active:
                # Verify password with bcrypt
                password_bytes = password.encode('utf-8')
                hash_bytes = rider.password_hash.encode('utf-8')
                if bcrypt.checkpw(password_bytes, hash_bytes):
                    # Create or get User from RiderAccount
                    user = self._get_or_create_user_from_rider(rider)
                    logger.info(f"Rider authenticated: {email}")
                    return user
        except Exception as e:
            logger.debug(f"Rider account check failed: {e}")
        
        # 3. Fallback to POPS API
        try:
            pops_response = pops_client.login(email, password)
            if pops_response:
                # Create or update User from POPS response
                user = self._get_or_create_user_from_pops(pops_response, email)
                logger.info(f"User authenticated from POPS API: {email}")
                return user
        except Exception as e:
            logger.error(f"POPS API authentication failed: {e}")
        
        # 4. If login failed but user might exist in POPS, try fetching user data
        # This handles cases where password might be wrong but user exists
        # We'll fetch the user data and create a local record (without password)
        # The user will need to login via POPS to authenticate
        try:
            # Try to get a manager/admin token to fetch user data
            # For now, we'll skip this and let the user login via POPS
            # This is a fallback that can be enhanced later
            logger.debug(f"User not found locally and POPS login failed for: {email}")
        except Exception as e:
            logger.debug(f"User fetch fallback failed: {e}")
        
        return None
    
    def _get_or_create_user_from_rider(self, rider):
        """
        Get or create User from RiderAccount
        Links rider account to User model
        """
        user, created = User.objects.get_or_create(
            email=rider.email or f"{rider.rider_id}@rider.local",
            defaults={
                'username': rider.rider_id,
                'employee_id': rider.rider_id,
                'full_name': rider.full_name,
                'role': 'driver',
                'is_active': rider.is_active,
                'is_deliveryq': True,
                'auth_source': 'rider',
            }
        )
        
        if not created:
            # Update existing user
            user.username = rider.rider_id
            user.employee_id = rider.rider_id
            user.full_name = rider.full_name
            user.is_active = rider.is_active
            user.is_deliveryq = True
            user.save()
        
        return user
    
    def _get_or_create_user_from_pops(self, pops_response, email):
        """
        Get or create User from POPS API response
        Stores POPS JWT tokens and user data
        """
        access_token = pops_response.get('access')
        refresh_token = pops_response.get('refresh')
        
        # Extract user data from POPS response
        user_id = str(pops_response.get('id', email))
        full_name = pops_response.get('full_name', '')
        is_superuser = pops_response.get('is_superuser', False)
        is_staff = pops_response.get('is_staff', False)
        is_ops_team = pops_response.get('is_ops_team', False)
        is_deliveryq = pops_response.get('is_deliveryq', False)
        pia_access = pops_response.get('pia_access', False)
        
        # Determine role
        if is_superuser:
            role = 'admin'
        elif is_ops_team or is_staff:
            role = 'manager'
        elif is_deliveryq:
            role = 'driver'
        else:
            role = 'viewer'
        
        # Get or create user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'employee_id': user_id,
                'full_name': full_name,
                'role': role,
                'is_active': pops_response.get('is_active', True),
                'is_staff': is_staff,
                'is_superuser': is_superuser,
                'is_ops_team': is_ops_team,
                'is_deliveryq': is_deliveryq,
                'pia_access': pia_access,
                'access_token': access_token,
                'refresh_token': refresh_token,
                'auth_source': 'pops',
            }
        )
        
        if not created:
            # Update existing user with latest POPS data
            user.username = email
            user.employee_id = user_id
            user.full_name = full_name
            user.role = role
            user.is_active = pops_response.get('is_active', True)
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.is_ops_team = is_ops_team
            user.is_deliveryq = is_deliveryq
            user.pia_access = pia_access
            user.access_token = access_token
            user.refresh_token = refresh_token
            user.auth_source = 'pops'
            user.save()
        
        return user
    
    def get_user(self, user_id):
        """Get user by ID"""
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None






