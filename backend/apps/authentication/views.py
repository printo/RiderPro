"""
Authentication views for RiderPro
Handles login with multi-source authentication
"""
import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    LoginSerializer, LoginResponseSerializer, UserSerializer, 
    RiderAccountSerializer, HomebaseSerializer, RiderHomebaseAssignmentSerializer
)
from .models import RiderAccount, Homebase, RiderHomebaseAssignment
from utils.pops_client import pops_client
import bcrypt

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Login endpoint - matches /api/auth/login from Node.js backend
    
    Authentication flow:
    1. Try local User database
    2. Try RiderAccount database
    3. Fallback to POPS API
    4. If POPS login fails, try fetching user from POPS and create local user
    
    Returns JWT tokens in same format as POPS API
    """
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Username and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    username = serializer.validated_data['username']
    password = serializer.validated_data['password']
    
    # Check if user is an API user (API users cannot login via this endpoint)
    from .models import User
    try:
        api_user = User.objects.get(username=username, is_api_user=True)
        if api_user:
            return Response({
                'success': False,
                'message': 'API users cannot login via this endpoint. Use API key authentication for webhooks.'
            }, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        pass
    
    # Authenticate using custom backend
    user = authenticate(request, username=username, password=password)
    
    if not user:
        # If authentication failed, try fetching user from POPS
        # This handles cases where user exists in POPS but password might be wrong
        # or user data needs to be synced
        try:
            # Try to login with POPS to get access token (username is the email value from estimator)
            pops_response = pops_client.login(username, password)
            if pops_response:
                # If POPS login succeeds, create/update user
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.filter(username=username).first()
                if user:
                    # Update existing user with latest POPS data
                    user = authenticate(request, username=username, password=password)
                else:
                    # Create new user from POPS response
                    user = authenticate(request, username=username, password=password)
        except Exception as e:
            logger.debug(f"POPS fetch attempt failed: {e}")
        
        if not user:
            return Response({
                'success': False,
                'message': 'Login failed: Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Generate JWT tokens (using Simple JWT, same as POPS)
    # Use token_utils for API users with infinite token lifetime
    from .token_utils import get_token_for_user
    tokens = get_token_for_user(user)
    access_token = tokens['access']
    refresh_token = tokens['refresh']
    
    # Update user's last login
    from django.utils import timezone
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    
    # Determine role flags
    is_staff = user.role in ['admin', 'manager'] or user.is_staff
    is_super_user = user.role == 'admin' or user.is_superuser
    is_ops_team = user.is_ops_team
    
    # Return response in same format as Node.js backend
    response_data = {
        'success': True,
        'message': 'Login successful',
        'access': access_token,
        'refresh': refresh_token,
        'full_name': user.full_name or user.username,
        'is_staff': is_staff,
        'is_super_user': is_super_user,
        'is_ops_team': is_ops_team,
        'username': user.username,
    }
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Rider registration endpoint - matches /api/auth/register from Node.js backend
    Creates a rider account that requires manager approval
    If rider doesn't exist in RiderAccount table, attempts to fetch from PIA
    """
    rider_id = request.data.get('riderId')
    password = request.data.get('password')
    full_name = request.data.get('fullName')
    email = request.data.get('email')
    rider_type = request.data.get('riderType', 'bike')
    dispatch_option = request.data.get('dispatchOption', 'printo-bike')
    homebase_id_code = request.data.get('homebaseId') # The string ID like 'HB001'
    
    if not rider_id or not password or not full_name:
        return Response({
            'success': False,
            'message': 'Rider ID, password, and full name are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if rider already exists
    rider_account = RiderAccount.objects.filter(rider_id=rider_id).first()
    if rider_account:
        return Response({
            'success': False,
            'message': 'Rider ID already registered'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # If rider doesn't exist, try to fetch from PIA (optional - don't fail if PIA is unavailable)
    # This will be done during manager approval, but we can try here too
    pops_rider_id = None
    try:
        from django.conf import settings
        access_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None)
        if access_token:
            try:
                pops_rider = pops_client.fetch_rider_by_id(rider_id, access_token)
                if pops_rider:
                    pops_rider_id = pops_rider.get('id')
                    # Use PIA data if available
                    if not full_name and pops_rider.get('name'):
                        full_name = pops_rider.get('name')
                    # Map POPS tags to rider_type
                    tags = pops_rider.get('tags', '').lower()
                    if 'milkround' in tags or 'goods-auto' in tags or 'auto' in tags:
                        rider_type = 'auto'
                    elif 'printo-bike' in tags or 'bike' in tags:
                        rider_type = 'bike'
                    elif 'hyperlocal' in tags:
                        rider_type = 'hyperlocal'
                    elif '3pl' in tags:
                        rider_type = '3pl'
            except Exception as e:
                # Don't fail registration if PIA fetch fails - manager can fetch during approval
                logger.debug(f"Could not fetch rider {rider_id} from PIA during registration: {e}")
    except Exception as e:
        logger.debug(f"Error attempting to fetch from PIA during registration: {e}")
    
    # Hash password with bcrypt
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
    
    # Find homebase if provided
    primary_homebase = None
    if homebase_id_code:
        primary_homebase = Homebase.objects.filter(homebase_id=homebase_id_code).first()
    
    # Create rider account
    # IMPORTANT: Riders should NEVER have superuser permissions
    rider = RiderAccount.objects.create(
        rider_id=rider_id,
        full_name=full_name,
        password_hash=password_hash,
        email=email,
        rider_type=rider_type,
        dispatch_option=dispatch_option,
        primary_homebase=primary_homebase,
        pops_rider_id=pops_rider_id,
        is_active=False,  # Default to inactive until approved
        is_approved=False,
        is_rider=True,
        synced_to_pops=bool(pops_rider_id)
    )
    
    # If homebase provided, also create assignment
    if primary_homebase:
        RiderHomebaseAssignment.objects.create(
            rider=rider,
            homebase=primary_homebase,
            is_primary=True,
            pops_rider_id=pops_rider_id,
            synced_to_pops=bool(pops_rider_id)
        )
    
    return Response({
        'success': True,
        'message': 'Registration successful. Please wait for account approval.',
        'riderId': rider.rider_id
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def local_login(request):
    """
    Local rider login endpoint - matches /api/auth/local-login from Node.js backend
    For riders who don't have POPS accounts
    """
    rider_id = request.data.get('riderId')
    password = request.data.get('password')
    
    if not rider_id or not password:
        return Response({
            'success': False,
            'message': 'Rider ID and password are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        rider = RiderAccount.objects.get(rider_id=rider_id)
    except RiderAccount.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Verify password
    password_bytes = password.encode('utf-8')
    hash_bytes = rider.password_hash.encode('utf-8')
    if not bcrypt.checkpw(password_bytes, hash_bytes):
        return Response({
            'success': False,
            'message': 'Invalid credentials'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    # Check if rider is approved
    if not rider.is_approved:
        return Response({
            'success': False,
            'message': 'Account pending approval. Please wait for manager approval.',
            'isApproved': False
        }, status=status.HTTP_403_FORBIDDEN)
    
    if not rider.is_active:
        return Response({
            'success': False,
            'message': 'Account is inactive'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Generate tokens
    from rest_framework_simplejwt.tokens import RefreshToken
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Get or create user from rider
    # IMPORTANT: Riders should NEVER have superuser permissions
    # Username is set to rider_id (which is the email value from estimator)
    user, created = User.objects.get_or_create(
        username=rider.rider_id,
        defaults={
            'full_name': rider.full_name,
            'role': 'driver',
            'is_active': rider.is_active,
            'is_deliveryq': True,
            'is_superuser': False,  # Riders never have superuser permissions
            'is_staff': False,  # Riders are not staff
            'auth_source': 'rider'
        }
    )
    
    if not created:
        user.full_name = rider.full_name
        user.is_active = rider.is_active
        # Ensure riders never get superuser permissions
        user.is_superuser = False
        user.is_staff = False
        user.save()
    
    # Use token_utils for API users with infinite token lifetime
    from .token_utils import get_token_for_user
    tokens = get_token_for_user(user)
    access_token = tokens['access']
    refresh_token = tokens['refresh']
    
    # Update last login
    from django.utils import timezone
    rider.last_login_at = timezone.now()
    rider.save()
    
    return Response({
        'success': True,
        'message': 'Login successful',
        'accessToken': access_token,
        'refreshToken': refresh_token,
        'fullName': rider.full_name,
        'isApproved': rider.is_approved,
        'is_super_user': False,  # Riders never have superuser permissions
        'is_staff': False,
        'is_ops_team': False,
        'username': rider.rider_id
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """
    Refresh token endpoint - matches /api/auth/refresh from Node.js backend
    Uses POPS API for token refresh if user is from POPS
    Checks blacklist before refreshing
    """
    refresh_token_str = request.data.get('refresh')
    if not refresh_token_str:
        return Response({
            'success': False,
            'message': 'Refresh token is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Try to refresh using Simple JWT first
    try:
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken(refresh_token_str)
        
        # Get user from token
        user_id = refresh.get('user_id')
        from .models import User, BlackListedToken
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if refresh token is blacklisted
        if BlackListedToken.objects.filter(token=refresh_token_str, user=user).exists():
            logger.warning(f"Attempted refresh with blacklisted token for user {user.username}")
            return Response({
                'success': False,
                'message': 'Token has been blacklisted'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Check if user's tokens are revoked (admin-level revocation)
        if hasattr(user, 'tokens_revoked') and user.tokens_revoked:
            logger.warning(f"Attempted refresh for revoked user {user.username}")
            return Response({
                'success': False,
                'message': 'Tokens have been revoked'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        # Generate new access token
        access_token = str(refresh.access_token)
        
        return Response({
            'access': access_token
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        
        # If local refresh fails and user is from POPS, try POPS API
        # Note: We'd need to identify the user first, which requires storing refresh tokens
        # For now, return error
        return Response({
            'success': False,
            'message': 'Token refresh failed'
        }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Logout endpoint - blacklists current access token
    Matches pattern from printo_se_api and pops
    """
    if not request.auth:
        return Response({
            'success': False,
            'message': 'No token provided'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Get token string
        token_str = str(request.auth)
        user = request.user
        
        # Blacklist the token
        from .models import BlackListedToken
        blacklisted_token, created = BlackListedToken.objects.get_or_create(
            token=token_str,
            user=user,
            defaults={'reason': 'logout'}
        )
        
        if created:
            logger.info(f"Token blacklisted for user {user.username} (logout)")
        else:
            logger.debug(f"Token already blacklisted for user {user.username}")
        
        return Response({
            'success': True,
            'message': 'Successfully logged out'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Logout error: {e}")
        return Response({
            'success': False,
            'message': 'Logout failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def fetch_rider(request):
    """
    Fetch rider data from POPS and sync to RiderPro
    Can be called by rider_id or name
    
    GET /api/v1/auth/fetch-rider?rider_id=xxx or ?name=xxx
    POST /api/v1/auth/fetch-rider with {rider_id: xxx} or {name: xxx}
    
    Requires authentication token from a manager/admin to access POPS API
    Note: Riders in POPS are records, not users. They don't have login access.
    POPS Rider model has: name, homebaseId, phone, rider_id, account_code, tags
    Tags map to rider_type: milkround/printo-bike/hyperlocal/goods-auto -> bike/auto/3pl/hyperlocal
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Only managers and admins can fetch riders
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get rider_id or name from request
    rider_id = request.query_params.get('rider_id') or request.data.get('rider_id')
    name = request.query_params.get('name') or request.data.get('name')
    
    if not rider_id and not name:
        return Response({
            'success': False,
            'message': 'Rider ID or name is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Get access token from authenticated user
    access_token = request.user.access_token
    if not access_token:
        return Response({
            'success': False,
            'message': 'User must have a valid POPS access token'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Fetch rider from POPS (Rider model, not User model)
        pops_rider = None
        if rider_id:
            pops_rider = pops_client.fetch_rider_by_id(rider_id, access_token)
        elif name:
            pops_rider = pops_client.fetch_rider_by_name(name, access_token)
        
        if not pops_rider:
            return Response({
                'success': False,
                'message': 'Rider not found in POPS'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Map POPS tags to rider_type
        # POPS tags: milkround, printo-bike, hyperlocal, goods-auto
        # RiderPro rider_type: bike, auto, 3pl, hyperlocal
        tags = pops_rider.get('tags', '').lower()
        rider_type = 'bike'  # default
        if 'milkround' in tags:
            rider_type = 'auto'  # milkround is auto
        elif 'printo-bike' in tags or 'bike' in tags:
            rider_type = 'bike'
        elif 'hyperlocal' in tags:
            rider_type = 'hyperlocal'
        elif 'goods-auto' in tags or 'auto' in tags:
            rider_type = 'auto'
        elif '3pl' in tags:
            rider_type = '3pl'
        
        # Create or update RiderAccount in RiderPro
        pops_rider_id = pops_rider.get('id')
        rider_id_value = pops_rider.get('rider_id') or rider_id
        rider_name = pops_rider.get('name', '')
        
        rider_account, created = RiderAccount.objects.get_or_create(
            rider_id=rider_id_value,
            defaults={
                'full_name': rider_name,
                'email': None,  # Riders don't have email in POPS
                'rider_type': rider_type,
                'is_active': True,
                'is_approved': True,  # If fetched from POPS, assume approved
                'pops_rider_id': pops_rider_id,
                'synced_to_pops': True,
            }
        )
        
        if not created:
            # Update existing rider account
            rider_account.full_name = rider_name
            rider_account.rider_type = rider_type
            rider_account.pops_rider_id = pops_rider_id
            rider_account.synced_to_pops = True
            rider_account.save()
        
        # Also create/update User record for the rider
        # IMPORTANT: Riders should NEVER have superuser permissions
        # Username is set to rider_id (which is the email value from estimator)
        user, user_created = User.objects.get_or_create(
            username=rider_id_value,
            defaults={
                'full_name': rider_name,
                'role': 'driver',
                'is_active': True,
                'is_deliveryq': True,
                'is_superuser': False,  # Riders never have superuser permissions
                'is_staff': False,  # Riders are not staff
                'auth_source': 'rider',
            }
        )
        
        if not user_created:
            user.full_name = rider_name
            # Ensure riders never get superuser permissions
            user.is_superuser = False
            user.is_staff = False
            user.save()
        
        from .serializers import RiderAccountSerializer
        return Response({
            'success': True,
            'message': 'Rider data fetched and synced successfully',
            'rider': RiderAccountSerializer(rider_account).data,
            'user': UserSerializer(user).data,
            'created': created
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error fetching rider from POPS: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to fetch rider data: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_approvals(request):
    """
    Get pending rider approvals - matches /api/auth/pending-approvals from Node.js backend
    Returns riders who are waiting for manager approval
    """
    from .serializers import RiderAccountSerializer
    
    # Only managers and admins can see pending approvals
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get pending riders (not approved yet)
    pending_riders = RiderAccount.objects.filter(is_approved=False).order_by('-created_at')
    
    serializer = RiderAccountSerializer(pending_riders, many=True)
    
    return Response({
        'success': True,
        'users': serializer.data
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_users(request):
    """
    Get all users - matches /api/auth/all-users from Node.js backend
    Returns all users (both User and RiderAccount)
    """
    from .serializers import UserSerializer, RiderAccountSerializer
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Only managers and admins can see all users
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get all users and riders
    users = User.objects.all().order_by('-created_at')
    riders = RiderAccount.objects.all().order_by('-created_at')
    
    user_serializer = UserSerializer(users, many=True)
    rider_serializer = RiderAccountSerializer(riders, many=True)
    
    # Combine and format for frontend
    all_users_data = []
    
    # Add regular users
    for user_data in user_serializer.data:
        all_users_data.append({
            'id': str(user_data.get('id', '')),
            'rider_id': user_data.get('username', ''),  # username is the identifier
            'full_name': user_data.get('full_name', ''),
            'username': user_data.get('username', ''),
            'is_active': user_data.get('is_active', True),
            'is_approved': True,  # Users are always approved
            'role': user_data.get('role', 'viewer'),
            'is_super_user': user_data.get('is_superuser', False),
            'is_staff': user_data.get('is_staff', False),
            'is_ops_team': user_data.get('is_ops_team', False),
            'created_at': user_data.get('created_at', ''),
        })
    
    # Add rider accounts
    for rider_data in rider_serializer.data:
        all_users_data.append({
            'id': str(rider_data.get('id', '')),
            'rider_id': rider_data.get('rider_id', ''),
            'full_name': rider_data.get('full_name', ''),
            'username': rider_data.get('rider_id', ''),  # rider_id is the username
            'is_active': rider_data.get('is_active', True),
            'is_approved': rider_data.get('is_approved', False),
            'role': rider_data.get('role', 'is_driver'),
            'rider_type': rider_data.get('rider_type', ''),
            'dispatch_option': rider_data.get('dispatch_option', ''),
            'primary_homebase': rider_data.get('primary_homebase', None),
            'primary_homebase_details': rider_data.get('primary_homebase_details', None),
            'is_super_user': False,  # Riders never have superuser permissions
            'is_staff': False,
            'is_ops_team': False,
            'created_at': rider_data.get('created_at', ''),
        })
    
    return Response({
        'success': True,
        'users': all_users_data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_user(request, user_id):
    """
    Approve a rider account - matches /api/auth/approve/:userId from Node.js backend
    Sets is_approved=True for the rider account
    """
    # Only managers and admins can approve riders
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Try to find as RiderAccount first
        try:
            rider = RiderAccount.objects.get(id=user_id)
            rider.is_approved = True
            rider.is_active = True
            rider.save()
            
            # Sync to POPS if manager has an access token
            from utils.pops_rider_sync import PopsRiderSyncService
            if request.user.access_token:
                PopsRiderSyncService.sync_rider_to_pops(rider, request.user.access_token)
            
            return Response({
                'success': True,
                'message': 'Rider approved successfully'
            }, status=status.HTTP_200_OK)
        except RiderAccount.DoesNotExist:
            # If not a rider, check if it's a User
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                # For regular users, just activate them
                user.is_active = True
                user.save()
                return Response({
                    'success': True,
                    'message': 'User activated successfully'
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error approving user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to approve user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_user(request, user_id):
    """
    Reject a rider account - matches /api/auth/reject/:userId from Node.js backend
    Sets is_approved=False and optionally deactivates the rider
    """
    # Only managers and admins can reject riders
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Try to find as RiderAccount first
        try:
            rider = RiderAccount.objects.get(id=user_id)
            rider.is_approved = False
            rider.is_active = False  # Deactivate rejected riders
            rider.save()
            
            return Response({
                'success': True,
                'message': 'Rider rejected successfully'
            }, status=status.HTTP_200_OK)
        except RiderAccount.DoesNotExist:
            # If not a rider, check if it's a User
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                # For regular users, deactivate them
                user.is_active = False
                user.save()
                return Response({
                    'success': True,
                    'message': 'User deactivated successfully'
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error rejecting user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to reject user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user(request, user_id):
    """
    Get a specific user by ID - matches /api/auth/users/:userId from Node.js backend
    Returns user data (either User or RiderAccount)
    """
    # Users can view their own data, managers/admins can view any user
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff or str(request.user.id) == str(user_id)):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Try to find as RiderAccount first
        try:
            rider = RiderAccount.objects.get(id=user_id)
            from .serializers import RiderAccountSerializer
            serializer = RiderAccountSerializer(rider)
            return Response({
                'success': True,
                'user': serializer.data
            }, status=status.HTTP_200_OK)
        except RiderAccount.DoesNotExist:
            # If not a rider, check if it's a User
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                from .serializers import UserSerializer
                serializer = UserSerializer(user)
                return Response({
                    'success': True,
                    'user': serializer.data
                }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to get user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_password(request, user_id):
    """
    Reset password for a user - matches /api/auth/reset-password/:userId from Node.js backend
    Accepts new password in request body, or generates one if not provided
    """
    # Only managers and admins can reset passwords
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    new_password = request.data.get('password') or request.data.get('new_password')
    password_was_generated = False
    # If no password provided, generate a random one
    if not new_password:
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits
        new_password = ''.join(secrets.choice(alphabet) for i in range(12))  # Generate 12-char password
        password_was_generated = True
    
    try:
        # Try to find as RiderAccount first
        try:
            rider = RiderAccount.objects.get(id=user_id)
            # Hash password with bcrypt
            password_bytes = new_password.encode('utf-8')
            salt = bcrypt.gensalt()
            hash_bytes = bcrypt.hashpw(password_bytes, salt)
            rider.password_hash = hash_bytes.decode('utf-8')
            rider.save()
            
            response_data = {
                'success': True,
                'message': 'Password reset successfully'
            }
            # Include generated password in response if it was auto-generated
            if password_was_generated:
                response_data['password'] = new_password
                response_data['message'] = 'Password reset successfully. New password generated.'
            
            return Response(response_data, status=status.HTTP_200_OK)
        except RiderAccount.DoesNotExist:
            # If not a rider, check if it's a User
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                # Set password using Django's built-in method
                user.set_password(new_password)
                user.save()
                
                response_data = {
                    'success': True,
                    'message': 'Password reset successfully'
                }
                # Include generated password in response if it was auto-generated
                if password_was_generated:
                    response_data['password'] = new_password
                    response_data['message'] = 'Password reset successfully. New password generated.'
                
                return Response(response_data, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error resetting password for user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to reset password: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pops_homebases(request):
    """
    Fetch homebases from POPS API
    Proxies to POPS /api/v1/master/homebases/ endpoint
    
    GET /api/v1/auth/pops/homebases
    Requires authentication token with POPS access
    """
    # Only managers and admins can fetch homebases
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get access token from authenticated user
    access_token = request.user.access_token
    if not access_token:
        return Response({
            'success': False,
            'message': 'User must have a valid POPS access token'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Fetch homebases from POPS
        homebases = pops_client.fetch_homebases(access_token)
        
        if homebases is None:
            return Response({
                'success': False,
                'message': 'Failed to fetch homebases from POPS'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'homebases': homebases
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error fetching homebases from POPS: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to fetch homebases: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pops_create_rider(request):
    """
    Create a rider in POPS API
    Proxies to POPS /api/v1/master/riders/ endpoint
    
    POST /api/v1/auth/pops/riders
    Requires authentication token with POPS access
    
    Expected payload:
    {
        "name": "Rider Name",
        "phone": "1234567890",
        "rider_id": "RIDER123",
        "account_code": "ACC123",
        "tags": "printo-bike,goods-auto",
        "homebaseId": 1  # or "homebaseId__homebaseId": "HB001"
    }
    """
    # Only managers and admins can create riders in POPS
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get access token from authenticated user
    access_token = request.user.access_token
    if not access_token:
        return Response({
            'success': False,
            'message': 'User must have a valid POPS access token'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    rider_data = request.data
    
    # Validate required fields
    if not rider_data.get('name') or not rider_data.get('homebaseId'):
        return Response({
            'success': False,
            'message': 'name and homebaseId are required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Create rider in POPS
        created_rider = pops_client.create_rider(rider_data, access_token)
        
        if created_rider is None:
            return Response({
                'success': False,
                'message': 'Failed to create rider in POPS'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            'success': True,
            'message': 'Rider created successfully in POPS',
            'rider': created_rider
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating rider in POPS: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to create rider: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def homebase_list(request):
    """
    Get all homebases or create a new one
    GET /api/v1/auth/homebases/
    POST /api/v1/auth/homebases/
    """
    # Only managers and admins can manage homebases
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        homebases = Homebase.objects.all().order_by('name')
        
        # Filter by name or homebaseId if provided
        name_filter = request.query_params.get('name')
        if name_filter:
            homebases = homebases.filter(name__icontains=name_filter)
            
        code_filter = request.query_params.get('code')
        if code_filter:
            homebases = homebases.filter(homebase_id__icontains=code_filter)
            
        serializer = HomebaseSerializer(homebases, many=True)
        return Response({
            'success': True,
            'homebases': serializer.data
        })
    
    elif request.method == 'POST':
        serializer = HomebaseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Homebase created successfully',
                'homebase': serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Invalid data',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def homebase_detail(request, pk):
    """
    Get, update or delete a homebase
    GET/PUT/DELETE /api/v1/auth/homebases/:id/
    """
    try:
        homebase = Homebase.objects.get(pk=pk)
    except Homebase.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Homebase not found'
        }, status=status.HTTP_404_NOT_FOUND)
        
    # Only managers and admins can manage homebases
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
    
    if request.method == 'GET':
        serializer = HomebaseSerializer(homebase)
        return Response({
            'success': True,
            'homebase': serializer.data
        })
        
    elif request.method == 'PUT':
        serializer = HomebaseSerializer(homebase, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'success': True,
                'message': 'Homebase updated successfully',
                'homebase': serializer.data
            })
        return Response({
            'success': False,
            'message': 'Invalid data',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
        
    elif request.method == 'DELETE':
        homebase.delete()
        return Response({
            'success': True,
            'message': 'Homebase deleted successfully'
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_homebases_from_pops(request):
    """
    Sync homebases from POPS API into local database
    POST /api/v1/auth/homebases/sync
    """
    # Only managers and admins can sync homebases
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
        
    access_token = request.user.access_token
    if not access_token:
        return Response({
            'success': False,
            'message': 'User must have a valid POPS access token'
        }, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        # Fetch homebases from POPS
        pops_homebases = pops_client.fetch_homebases(access_token)
        
        if pops_homebases is None:
            return Response({
                'success': False,
                'message': 'Failed to fetch homebases from POPS'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        sync_stats = {
            'created': 0,
            'updated': 0,
            'failed': 0,
            'total': len(pops_homebases)
        }
        
        from django.utils import timezone
        now = timezone.now()
        
        for hb_data in pops_homebases:
            try:
                # Map POPS data to Homebase model
                hb_id = hb_data.get('homebaseId')
                if not hb_id:
                    sync_stats['failed'] += 1
                    continue
                    
                pops_id = hb_data.get('id')
                
                # Check if exists by pops_homebase_id or homebase_id
                homebase = Homebase.objects.filter(pops_homebase_id=pops_id).first() \
                           or Homebase.objects.filter(homebase_id=hb_id).first()
                           
                if homebase:
                    # Update
                    homebase.pops_homebase_id = pops_id
                    homebase.name = hb_data.get('name', homebase.name)
                    homebase.homebase_id = hb_id
                    homebase.aggregator_id = hb_data.get('aggregator_id', homebase.aggregator_id)
                    homebase.synced_from_pops = True
                    homebase.last_synced_at = now
                    homebase.save()
                    sync_stats['updated'] += 1
                else:
                    # Create
                    Homebase.objects.create(
                        pops_homebase_id=pops_id,
                        name=hb_data.get('name', ''),
                        homebase_id=hb_id,
                        aggregator_id=hb_data.get('aggregator_id', ''),
                        synced_from_pops=True,
                        last_synced_at=now
                    )
                    sync_stats['created'] += 1
            except Exception as e:
                logger.error(f"Error syncing homebase {hb_data.get('homebaseId')}: {e}")
                sync_stats['failed'] += 1
                
        return Response({
            'success': True,
            'message': f"Sync complete. Created {sync_stats['created']}, Updated {sync_stats['updated']}, Failed {sync_stats['failed']}",
            'stats': sync_stats
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error during homebase sync: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Sync failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
