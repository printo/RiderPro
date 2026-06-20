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
from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .serializers import (
    LoginSerializer, LoginResponseSerializer, UserSerializer,
    RiderAccountSerializer, HomebaseSerializer, RiderHomebaseAssignmentSerializer,
    VehicleChangeRequestSerializer
)
from .models import RiderAccount, Homebase, RiderHomebaseAssignment, VehicleChangeRequest
from django.utils import timezone
from utils.pops_client import pops_client
import bcrypt

logger = logging.getLogger(__name__)



@extend_schema(
    tags=['Authentication'],
    summary='Login (Staff / POPS user)',
    description='Authenticate with username + password. Falls back to POPS API if not found locally.',
    request={
        'application/x-www-form-urlencoded': {
            'type': 'object',
            'properties': {
                'username': {'type': 'string', 'example': 'admin@printo.in'},
                'password': {'type': 'string', 'example': 'secret123'},
            },
            'required': ['username', 'password'],
        },
        'application/json': LoginSerializer,
    },
    examples=[
        OpenApiExample(
            'Form login',
            summary='Standard form-data login',
            value={'username': 'admin@printo.in', 'password': 'secret123'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'JSON login',
            summary='JSON body login',
            value={'username': 'admin@printo.in', 'password': 'secret123'},
            request_only=True,
            media_type='application/json',
        ),
        OpenApiExample(
            'Success',
            value={
                'success': True,
                'message': 'Login successful',
                'access': '<jwt-access-token>',
                'refresh': '<jwt-refresh-token>',
                'full_name': 'John Doe',
                'is_staff': True,
                'is_super_user': False,
                'is_ops_team': False,
                'username': 'admin@printo.in',
            },
            response_only=True,
            status_codes=['200'],
        ),
        OpenApiExample(
            'Invalid credentials',
            value={'success': False, 'message': 'Login failed: Invalid credentials'},
            response_only=True,
            status_codes=['401'],
        ),
    ],
)
@extend_schema(
    tags=['Authentication'],
    summary='Login (Staff / POPS user) - DEPRECATED',
    description='Deprecated. Please use Google Sign-In or OTP login.',
    request={
        'application/json': LoginSerializer,
    },
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Deprecated. Password login is disabled.
    """
    return Response({
        'success': False,
        'message': 'Password authentication is deprecated. Please use Google Sign-In or OTP login.'
    }, status=status.HTTP_400_BAD_REQUEST)



@extend_schema(
    tags=['Authentication'],
    summary='Login with Google (PIA Access)',
    description='Verify a Google Sign-In id_token and return JWT tokens. The '
                'verified email must be in GOOGLE_ADMIN_EMAILS (bootstrap admins) '
                'or already exist as a user.',
    request=OpenApiTypes.OBJECT,
    examples=[OpenApiExample('Request', value={'id_token': '<google-id-token-jwt>'})],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """
    Google Sign-In endpoint. The "Continue with Google" button on the frontend
    obtains a Google id_token (a signed JWT) and POSTs it here. We verify it
    against Google's public certs (signature, audience == our client ID, issuer
    and expiry), then map the verified email to a User and issue our own SimpleJWT
    tokens — mirroring the response shape of the regular `login` view.

    Access policy: emails in settings.GOOGLE_ADMIN_EMAILS are bootstrapped as admins
    with superuser and staff flags on first login; an already-existing user logs in
    with their current role; any other email is rejected.
    """
    from django.conf import settings

    token = request.data.get('id_token')
    if not token:
        return Response(
            {'success': False, 'message': 'id_token is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '')
    if not client_id:
        logger.error('GOOGLE_OAUTH_CLIENT_ID is not configured')
        return Response(
            {'success': False, 'message': 'Google login is not configured on the server'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Verify the id_token with Google (signature via Google certs, audience ==
    # our client ID, issuer and expiry). Raises ValueError on any failure.
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), client_id
        )
    except ValueError as exc:
        logger.warning(f'Google id_token verification failed: {exc}')
        return Response(
            {'success': False, 'message': 'Invalid or expired Google sign-in'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    email = (idinfo.get('email') or '').strip().lower()
    if not email or not idinfo.get('email_verified', False):
        return Response(
            {'success': False, 'message': 'Google account has no verified email'},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    full_name = idinfo.get('name') or email

    from django.contrib.auth import get_user_model
    User = get_user_model()
    admin_emails = getattr(settings, 'GOOGLE_ADMIN_EMAILS', []) or []

    user = User.objects.filter(username__iexact=email).first()
    if user is None:
        if email in admin_emails:
            # Bootstrap an APP admin from the allowlist on first Google login.
            user = User.objects.create(
                username=email,
                full_name=full_name,
                role='admin',
                is_active=True,
                pia_access=True,
                auth_source='local',
                is_staff=True,
                is_superuser=True,
            )
        else:
            return Response(
                {
                    'success': False,
                    'message': 'This Google account is not authorized. '
                               'Ask an admin to grant access.',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
    else:
        # Existing user: promote to APP admin if newly allowlisted, ensure PIA
        # access is on. Django-admin (is_staff/is_superuser) is automatically set here.
        updated_fields = []
        if email in admin_emails:
            if user.role != 'admin':
                user.role = 'admin'
                updated_fields.append('role')
            if not user.is_staff:
                user.is_staff = True
                updated_fields.append('is_staff')
            if not user.is_superuser:
                user.is_superuser = True
                updated_fields.append('is_superuser')
        if not user.pia_access:
            user.pia_access = True
            updated_fields.append('pia_access')
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            updated_fields.append('full_name')
        if updated_fields:
            user.save(update_fields=updated_fields)

    if not user.is_active:
        return Response(
            {'success': False, 'message': 'Account is inactive'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Establish standard session authentication for raw django-admin (/admin/)
    from django.contrib.auth import login as django_login
    django_login(request, user, backend='apps.authentication.backends.RiderProAuthBackend')

    # Issue our own JWTs (same helper as the other login paths).
    from .token_utils import get_token_for_user
    tokens = get_token_for_user(user)

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    is_staff = user.role in ['admin', 'manager'] or user.is_staff
    is_super_user = user.role == 'admin' or user.is_superuser
    is_ops_team = user.is_ops_team

    return Response(
        {
            'success': True,
            'message': 'Login successful',
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'full_name': user.full_name or user.username,
            'username': user.username,
            'employee_id': user.username,
            'is_staff': is_staff,
            'is_super_user': is_super_user,
            'is_ops_team': is_ops_team,
            'django_admin': user.is_staff,  # RAW Django-admin (/admin/) access — gates the UI button
        },
        status=status.HTTP_200_OK,
    )



@extend_schema(
    tags=['Authentication'],
    summary='Register rider account',
    description='Create a new rider account. Requires manager approval before login.',
    request={
        'application/x-www-form-urlencoded': {
            'type': 'object',
            'properties': {
                'riderId':      {'type': 'string', 'example': 'R001'},
                'password':     {'type': 'string', 'example': 'rider@123'},
                'fullName':     {'type': 'string', 'example': 'Ravi Kumar'},
                'email':        {'type': 'string', 'example': 'ravi@example.com'},
                'riderType':    {'type': 'string', 'enum': ['bike', 'auto', '3pl', 'hyperlocal'], 'example': 'bike'},
                'dispatchOption': {'type': 'string', 'example': 'printo-bike'},
                'homebaseId':   {'type': 'string', 'example': 'HB001'},
            },
            'required': ['riderId', 'password', 'fullName'],
        },
        'application/json': {
            'type': 'object',
            'properties': {
                'riderId':      {'type': 'string'},
                'password':     {'type': 'string'},
                'fullName':     {'type': 'string'},
                'email':        {'type': 'string'},
                'riderType':    {'type': 'string'},
                'dispatchOption': {'type': 'string'},
                'homebaseId':   {'type': 'string'},
            },
        },
    },
    examples=[
        OpenApiExample(
            'Auto rider registration (form)',
            value={'riderId': 'R002', 'password': 'pass123', 'fullName': 'Suresh V', 'riderType': 'auto', 'homebaseId': 'HB001'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            '3PL rider registration (form)',
            value={'riderId': 'R003', 'password': 'pass123', 'fullName': 'Mohan L', 'riderType': '3pl'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'Success',
            value={'success': True, 'message': 'Registration successful. Please wait for account approval.', 'riderId': 'R002'},
            response_only=True,
            status_codes=['201'],
        ),
    ],
)
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Deprecated. Rider self-signup has been removed: riders are now sourced from
    POPS via the rider sync and authenticate with phone + OTP.
    """
    return Response({
        'success': False,
        'message': 'Rider signup has been removed. Riders are synced from POPS and sign in with a phone OTP.'
    }, status=status.HTTP_410_GONE)



@extend_schema(
    tags=['Authentication'],
    summary='Local rider login',
    description='Login for riders who are in the local RiderAccount table (not POPS). Uses rider ID + password.',
    request={
        'application/x-www-form-urlencoded': {
            'type': 'object',
            'properties': {
                'riderId':   {'type': 'string', 'example': 'R001'},
                'password':  {'type': 'string', 'example': 'rider@123'},
            },
            'required': ['riderId', 'password'],
        },
        'application/json': {
            'type': 'object',
            'properties': {
                'riderId':  {'type': 'string'},
                'password': {'type': 'string'},
            },
        },
    },
    examples=[
        OpenApiExample(
            'Form login',
            value={'riderId': 'R001', 'password': 'rider@123'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'Success',
            value={'success': True, 'accessToken': '<jwt>', 'refreshToken': '<jwt>', 'fullName': 'Ravi Kumar', 'isApproved': True},
            response_only=True,
            status_codes=['200'],
        ),
        OpenApiExample(
            'Pending approval',
            value={'success': False, 'message': 'Account pending approval. Please wait for manager approval.', 'isApproved': False},
            response_only=True,
            status_codes=['403'],
        ),
    ],
)
@extend_schema(
    tags=['Authentication'],
    summary='Local rider login - DEPRECATED',
    description='Deprecated. Please use OTP login.',
)
@api_view(['POST'])
@permission_classes([AllowAny])
def local_login(request):
    """
    Deprecated. Password login is disabled.
    """
    return Response({
        'success': False,
        'message': 'Password authentication is deprecated. Please use OTP login.'
    }, status=status.HTTP_400_BAD_REQUEST)



@extend_schema(
    tags=['Authentication'],
    summary='Request Rider OTP',
    description='Generate and send a 6-digit OTP code to the rider\'s registered phone number.',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'phone': {'type': 'string', 'example': '+919876543210'}
            },
            'required': ['phone']
        }
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp(request):
    phone = (request.data.get('phone') or '').strip()
    if not phone:
        return Response({
            'success': False,
            'message': 'Phone number is required.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Normalise: keep digits and '+', and derive the trailing 10 digits.
    phone_clean = ''.join(c for c in phone if c.isdigit() or c == '+')
    phone_last10 = phone_clean[-10:] if len(phone_clean) >= 10 else phone_clean

    # Resolve an approved, active, non-archived rider by phone (flexible formats).
    from django.db.models import Q
    rider = RiderAccount.objects.filter(
        Q(phone=phone_clean) |
        Q(phone=phone_last10) |
        Q(phone='+91' + phone_last10) |
        Q(phone='91' + phone_last10),
        archived_at__isnull=True,
        is_approved=True,
        is_active=True,
    ).first()

    if rider:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')
        from apps.authentication.otp_service import OtpService
        try:
            OtpService.generate_and_send(
                rider.phone or phone_clean, purpose='rider_login',
                request_ip=ip, name=rider.full_name,
            )
        except ValueError as e:
            # Cooldown / rate-limit / delivery failure. Only reachable for a real
            # rider who already triggered a send, so it leaks nothing new.
            return Response({'success': False, 'message': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # Same response whether or not a rider matched -> can't enumerate riders.
    return Response({
        'success': True,
        'message': 'If your number is registered, you will receive a verification code shortly.'
    }, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Authentication'],
    summary='Verify Rider OTP',
    description='Verify the OTP code sent to the rider\'s phone and issue JWT tokens.',
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'phone': {'type': 'string', 'example': '+919876543210'},
                'code': {'type': 'string', 'example': '123456'}
            },
            'required': ['phone', 'code']
        }
    }
)
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    phone = (request.data.get('phone') or '').strip()
    code = (request.data.get('code') or '').strip()

    if not phone or not code:
        return Response({
            'success': False,
            'message': 'Phone number and verification code are required.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Normalise: keep digits and '+', and derive the trailing 10 digits.
    phone_clean = ''.join(c for c in phone if c.isdigit() or c == '+')
    phone_last10 = phone_clean[-10:] if len(phone_clean) >= 10 else phone_clean

    from django.db.models import Q
    rider = RiderAccount.objects.filter(
        Q(phone=phone_clean) |
        Q(phone=phone_last10) |
        Q(phone='+91' + phone_last10) |
        Q(phone='91' + phone_last10),
        archived_at__isnull=True,
        is_approved=True,
        is_active=True,
    ).first()

    # Uniform failure for "no such rider" and every OTP error, so the endpoint
    # can't be used to tell which numbers are registered.
    invalid = Response({
        'success': False,
        'message': 'Invalid or expired verification code.'
    }, status=status.HTTP_400_BAD_REQUEST)

    if not rider:
        return invalid

    from apps.authentication.otp_service import OtpService
    try:
        OtpService.verify_otp(rider.phone or phone_clean, code, purpose='rider_login')
    except ValueError:
        return invalid
        
    # Get or create Django User from rider
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    user, created = User.objects.get_or_create(
        username=rider.rider_id,
        defaults={
            'full_name': rider.full_name,
            'role': 'driver',
            'is_active': rider.is_active,
            'is_deliveryq': True,
            'is_superuser': False,
            'is_staff': False,
            'auth_source': 'rider'
        }
    )
    if not created:
        user.full_name = rider.full_name
        user.is_active = rider.is_active
        user.is_superuser = False
        user.is_staff = False
        user.save()
        
    from .token_utils import get_token_for_user
    tokens = get_token_for_user(user)
    
    rider.last_login_at = timezone.now()
    rider.save()
    
    return Response({
        'success': True,
        'message': 'Login successful',
        'accessToken': tokens['access'],
        'refreshToken': tokens['refresh'],
        'fullName': rider.full_name,
        'isApproved': rider.is_approved,
        'is_super_user': False,
        'is_staff': False,
        'is_ops_team': False,
        'username': rider.rider_id
    }, status=status.HTTP_200_OK)



@extend_schema(
    tags=['Authentication'],
    summary='Refresh access token',
    description='Exchange a refresh token for a new access token.',
    request={
        'application/x-www-form-urlencoded': {
            'type': 'object',
            'properties': {'refresh': {'type': 'string', 'example': '<jwt-refresh-token>'}},
            'required': ['refresh'],
        },
        'application/json': {
            'type': 'object',
            'properties': {'refresh': {'type': 'string'}},
        },
    },
    examples=[
        OpenApiExample(
            'Form refresh',
            value={'refresh': '<jwt-refresh-token>'},
            request_only=True,
            media_type='application/x-www-form-urlencoded',
        ),
        OpenApiExample(
            'Success',
            value={'access': '<new-jwt-access-token>'},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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



@extend_schema(
    tags=['Authentication'],
    summary='Logout (blacklist token)',
    description='Blacklists the current access token. Requires Bearer token in Authorization header.',
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'message': 'Successfully logged out'},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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



@extend_schema(
    tags=['Authentication'],
    summary='Fetch & sync rider from POPS',
    description='Fetch a rider from POPS by rider_id or name and sync to local DB. Requires manager/admin token.',
    parameters=[
        OpenApiParameter('rider_id', OpenApiTypes.STR, OpenApiParameter.QUERY, description='Rider ID e.g. R001', required=False),
        OpenApiParameter('name', OpenApiTypes.STR, OpenApiParameter.QUERY, description='Rider full name search', required=False),
    ],
    request={
        'application/x-www-form-urlencoded': {
            'type': 'object',
            'properties': {
                'rider_id': {'type': 'string', 'example': 'R001'},
                'name':     {'type': 'string', 'example': 'Ravi Kumar'},
            },
        },
    },
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'message': 'Rider data fetched and synced successfully', 'created': True},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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



@extend_schema(
    tags=['Authentication'],
    summary='Pending rider approvals',
    description='List all riders waiting for manager/admin approval. Requires manager/admin token.',
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'users': [{'id': '1', 'rider_id': 'R001', 'full_name': 'Ravi Kumar', 'is_approved': False}]},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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
    
    # Get pending riders (not approved yet, and not archived)
    pending_riders = RiderAccount.objects.filter(is_approved=False, archived_at__isnull=True).order_by('-created_at')
    
    serializer = RiderAccountSerializer(pending_riders, many=True)
    
    return Response({
        'success': True,
        'users': serializer.data
    }, status=status.HTTP_200_OK)



@extend_schema(
    tags=['Authentication'],
    summary='List all users',
    description='Returns all staff users and rider accounts. Requires manager/admin token.',
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'users': [{'id': '1', 'rider_id': 'admin@printo.in', 'full_name': 'Admin', 'role': 'admin', 'is_approved': True}]},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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
    
    # Get all users and riders (including archived ones)
    users = User.objects.all().order_by('-created_at')
    riders = RiderAccount.objects.all().order_by('-created_at')
    
    user_serializer = UserSerializer(users, many=True)
    rider_serializer = RiderAccountSerializer(riders, many=True)
    
    # Combine and format for frontend
    all_users_data = []
    
    # Add regular users
    for user_data in user_serializer.data:
        all_users_data.append({
            'id': f"user:{user_data.get('id', '')}",
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
            'id': f"rider:{rider_data.get('id', '')}",
            'rider_id': rider_data.get('rider_id', ''),
            'full_name': rider_data.get('full_name', ''),
            'username': rider_data.get('rider_id', ''),  # rider_id is the username
            'email': rider_data.get('email', ''),
            'phone': rider_data.get('phone', ''),
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
            'archived_at': rider_data.get('archived_at', None),
        })
    
    return Response({
        'success': True,
        'users': all_users_data
    }, status=status.HTTP_200_OK)


def _resolve_account(user_id):
    """
    Resolve a combined user-list id to its model instance.

    all_users emits type-qualified ids -- 'user:<pk>' for User rows and
    'rider:<pk>' for RiderAccount rows -- because the two models live in
    separate tables with independent autoincrement pks (a User and a
    RiderAccount can share the same numeric id). The prefix tells us which
    table to hit so we never resolve to the wrong record.

    For backwards compatibility (pending-approvals lists riders only and emits
    bare pks, and external callers may still send bare pks) a bare id falls
    back to the historical RiderAccount-first-then-User lookup.

    Returns (kind, instance) where kind is 'rider' or 'user', or (None, None)
    when no matching record exists.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    raw = str(user_id)

    if ':' in raw:
        prefix, _, pk = raw.partition(':')
        prefix = prefix.lower()
        if prefix == 'rider':
            try:
                return 'rider', RiderAccount.objects.get(id=pk)
            except (RiderAccount.DoesNotExist, ValueError, TypeError):
                return None, None
        if prefix == 'user':
            try:
                return 'user', User.objects.get(id=pk)
            except (User.DoesNotExist, ValueError, TypeError):
                return None, None
        return None, None  # unknown prefix

    # Legacy bare pk -- preserve the original RiderAccount-first behaviour.
    try:
        return 'rider', RiderAccount.objects.get(id=raw)
    except (RiderAccount.DoesNotExist, ValueError, TypeError):
        pass
    try:
        return 'user', User.objects.get(id=raw)
    except (User.DoesNotExist, ValueError, TypeError):
        return None, None



@extend_schema(
    tags=['Authentication'],
    summary='Approve rider',
    description='Approve a pending rider account by user ID. Rider becomes active immediately.',
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'message': 'Rider approved successfully'},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if kind == 'rider':
            account.is_approved = True
            account.is_active = True
            account.save()

            # Sync to POPS if manager has an access token
            from utils.pops_rider_sync import PopsRiderSyncService
            if request.user.access_token:
                PopsRiderSyncService.sync_rider_to_pops(account, request.user.access_token)

            return Response({
                'success': True,
                'message': 'Rider approved successfully'
            }, status=status.HTTP_200_OK)

        # Regular User -> just activate them
        account.is_active = True
        account.save()
        return Response({
            'success': True,
            'message': 'User activated successfully'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error approving user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to approve user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@extend_schema(
    tags=['Authentication'],
    summary='Reject rider',
    description='Reject and deactivate a pending rider account.',
    examples=[
        OpenApiExample(
            'Success',
            value={'success': True, 'message': 'Rider rejected successfully'},
            response_only=True,
            status_codes=['200'],
        ),
    ],
)
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
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if kind == 'rider':
            account.is_approved = False
            account.is_active = False  # Deactivate rejected riders
            account.save()
            return Response({
                'success': True,
                'message': 'Rider rejected successfully'
            }, status=status.HTTP_200_OK)

        # Regular User -> deactivate them
        account.is_active = False
        account.save()
        return Response({
            'success': True,
            'message': 'User deactivated successfully'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error rejecting user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to reject user: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'PATCH', 'PUT'])
@permission_classes([IsAuthenticated])
def get_user(request, user_id):
    """
    Get or update a specific user by ID - matches /api/auth/users/:userId.

    GET       -> returns user data (either User or RiderAccount). Self or manager.
    PATCH/PUT -> updates the editable fields surfaced by the admin "Edit User"
                 modal (full_name, email, rider_id/username, is_active).
                 Manager only.
    """
    is_manager = request.user.is_superuser or request.user.is_ops_team or request.user.is_staff

    if request.method == 'GET':
        try:
            kind, account = _resolve_account(user_id)
            if account is None:
                return Response({
                    'success': False,
                    'message': 'User not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Users can view their own data; managers/admins can view anyone.
            is_self = (kind == 'user' and str(account.id) == str(request.user.id))
            if not (is_manager or is_self):
                return Response({
                    'success': False,
                    'message': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if kind == 'rider':
                from .serializers import RiderAccountSerializer
                serializer = RiderAccountSerializer(account)
            else:
                from .serializers import UserSerializer
                serializer = UserSerializer(account)
            return Response({
                'success': True,
                'user': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}", exc_info=True)
            return Response({
                'success': False,
                'message': f'Failed to get user: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # PATCH / PUT -> update. Editing a user changes their login identifier and
    # active state, so it stays manager-only (mirrors reset_password / approve).
    if not is_manager:
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)

    def _errors_to_message(errors):
        """Flatten DRF serializer errors into a single human-readable string."""
        parts = []
        for field, msgs in errors.items():
            text = ' '.join(str(m) for m in msgs) if isinstance(msgs, (list, tuple)) else str(msgs)
            parts.append(f"{field}: {text}")
        return '; '.join(parts) or 'Validation failed'

    try:
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if kind == 'rider':
            from .serializers import RiderAccountSerializer
            # Whitelist only the fields exposed by the "Edit User" modal so this
            # endpoint can't be used to flip is_approved / role / privileges.
            payload = {}
            for field in ('full_name', 'email', 'rider_id', 'is_active'):
                if field in request.data:
                    payload[field] = request.data[field]
            serializer = RiderAccountSerializer(account, data=payload, partial=True)
        else:
            from .serializers import UserSerializer
            # The User identifier is `username`; the admin UI sends it as `rider_id`.
            # The User model has no email field, so email is ignored for User rows.
            payload = {}
            if 'full_name' in request.data:
                payload['full_name'] = request.data['full_name']
            if 'rider_id' in request.data:
                payload['username'] = request.data['rider_id']
            elif 'username' in request.data:
                payload['username'] = request.data['username']
            if 'is_active' in request.data:
                payload['is_active'] = request.data['is_active']
            serializer = UserSerializer(account, data=payload, partial=True)

        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': _errors_to_message(serializer.errors),
                'errors': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({
            'success': True,
            'user': serializer.data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f'Failed to update user: {str(e)}'
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
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({
                'success': False,
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if kind == 'rider':
            # Hash password with bcrypt
            password_bytes = new_password.encode('utf-8')
            salt = bcrypt.gensalt()
            hash_bytes = bcrypt.hashpw(password_bytes, salt)
            account.password_hash = hash_bytes.decode('utf-8')
            account.save()
        else:
            # Set password using Django's built-in method
            account.set_password(new_password)
            account.save()

        response_data = {
            'success': True,
            'message': 'Password reset successfully'
        }
        # Include generated password in response if it was auto-generated
        if password_was_generated:
            response_data['password'] = new_password
            response_data['message'] = 'Password reset successfully. New password generated.'

        return Response(response_data, status=status.HTTP_200_OK)
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
        homebases, error = pops_client.fetch_homebases(access_token)
        
        if homebases is None:
            status_code = status.HTTP_502_BAD_GATEWAY
            msg = 'Failed to fetch homebases from POPS'
            if error:
                status_code = error.get('status', status_code)
                msg = f"POPS error: {error.get('message', '')}"
                if status_code in [401, 403]:
                    status_code = status.HTTP_401_UNAUTHORIZED
                    msg = 'POPS rejected the token (expired or not a POPS session token). Log out and back in via POPS, or run sync as an admin with a valid POPS session.'
            return Response({
                'success': False,
                'message': msg
            }, status=status_code)
        
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
@permission_classes([AllowAny])
def homebase_list(request):
    """
    List homebases or create a new one.
    GET  /api/v1/auth/homebases/  — public; the unauthenticated signup page populates its homebase selector from this.
    POST /api/v1/auth/homebases/  — managers/admins only.
    """
    # GET is public; creating a homebase stays restricted to managers/admins.
    # Guard the role check with is_authenticated so AnonymousUser (no custom
    # role attrs) doesn't raise on a public GET.
    if request.method != 'GET':
        is_manager = request.user.is_authenticated and (
            request.user.is_superuser or request.user.is_ops_team or request.user.is_staff
        )
        if not is_manager:
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
        pops_homebases, error = pops_client.fetch_homebases(access_token)
        
        if pops_homebases is None:
            status_code = status.HTTP_502_BAD_GATEWAY
            msg = 'Failed to fetch homebases from POPS'
            if error:
                status_code = error.get('status', status_code)
                msg = f"POPS error: {error.get('message', '')}"
                if status_code in [401, 403]:
                    status_code = status.HTTP_401_UNAUTHORIZED
                    msg = 'POPS rejected the token (expired or not a POPS session token). Log out and back in via POPS, or run sync as an admin with a valid POPS session.'
            return Response({
                'success': False,
                'message': msg
            }, status=status_code)
            
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


# ---------------------------------------------------------------------------
# Vehicle (mileage) control & approval
# The vehicle sets the rider's mileage, which sets the fuel-cost / reimbursement
# money — so it's admin-governed: a rider raises a request, a manager approves.
# ---------------------------------------------------------------------------

def _get_rider_account(request):
    """Resolve the RiderAccount for the logged-in user (rider_id == username)."""
    rid = getattr(request.user, 'employee_id', None) or getattr(request.user, 'username', None)
    if not rid:
        return None
    return RiderAccount.objects.filter(rider_id=rid).select_related('vehicle_type').first()


def _is_manager(user):
    return bool(user.is_superuser or user.is_ops_team or user.is_staff)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_vehicle(request):
    """Rider's current vehicle, the selectable vehicle types, and any pending change request."""
    from apps.vehicles.models import VehicleType
    from apps.vehicles.serializers import VehicleTypeSerializer

    rider = _get_rider_account(request)
    if not rider:
        return Response({'success': False, 'message': 'Rider account not found'},
                        status=status.HTTP_404_NOT_FOUND)
    pending = (
        VehicleChangeRequest.objects.filter(rider=rider, status='pending')
        .select_related('requested_vehicle_type', 'current_vehicle_type').first()
    )
    return Response({
        'success': True,
        'current_vehicle': VehicleTypeSerializer(rider.vehicle_type).data if rider.vehicle_type else None,
        'available_vehicles': VehicleTypeSerializer(VehicleType.objects.all(), many=True).data,
        'pending_request': VehicleChangeRequestSerializer(pending).data if pending else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_vehicle_change(request):
    """Rider raises a pending request to change their vehicle type (admin must approve)."""
    from apps.vehicles.models import VehicleType

    rider = _get_rider_account(request)
    if not rider:
        return Response({'success': False, 'message': 'Rider account not found'},
                        status=status.HTTP_404_NOT_FOUND)

    vt_id = request.data.get('vehicleTypeId') or request.data.get('requested_vehicle_type')
    if not vt_id:
        return Response({'success': False, 'message': 'vehicleTypeId is required'},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        requested = VehicleType.objects.get(id=vt_id)
    except VehicleType.DoesNotExist:
        return Response({'success': False, 'message': 'Vehicle type not found'},
                        status=status.HTTP_404_NOT_FOUND)

    if VehicleChangeRequest.objects.filter(rider=rider, status='pending').exists():
        return Response({'success': False, 'message': 'You already have a pending vehicle change request'},
                        status=status.HTTP_400_BAD_REQUEST)

    req = VehicleChangeRequest.objects.create(
        rider=rider,
        current_vehicle_type=rider.vehicle_type,
        requested_vehicle_type=requested,
        reason=request.data.get('reason', ''),
        status='pending',
    )
    return Response({
        'success': True,
        'message': 'Vehicle change request submitted for approval',
        'request': VehicleChangeRequestSerializer(req).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pending_vehicle_change_requests(request):
    """Manager: list pending vehicle change requests."""
    if not _is_manager(request.user):
        return Response({'success': False, 'message': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN)
    qs = (
        VehicleChangeRequest.objects.filter(status='pending')
        .select_related('rider', 'current_vehicle_type', 'requested_vehicle_type')
    )
    return Response({
        'success': True,
        'requests': VehicleChangeRequestSerializer(qs, many=True).data,
        'count': qs.count(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_vehicle_change(request, request_id):
    """Manager: approve a vehicle change → updates the rider's vehicle type."""
    if not _is_manager(request.user):
        return Response({'success': False, 'message': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        req = VehicleChangeRequest.objects.select_related('rider', 'requested_vehicle_type').get(id=request_id)
    except VehicleChangeRequest.DoesNotExist:
        return Response({'success': False, 'message': 'Request not found'},
                        status=status.HTTP_404_NOT_FOUND)
    if req.status != 'pending':
        return Response({'success': False, 'message': f'Request already {req.status}'},
                        status=status.HTTP_400_BAD_REQUEST)

    rider = req.rider
    rider.vehicle_type = req.requested_vehicle_type
    rider.save(update_fields=['vehicle_type'])

    req.status = 'approved'
    req.reviewed_by = getattr(request.user, 'username', None)
    req.reviewed_at = timezone.now()
    req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

    logger.info(f"Vehicle change {req.id} approved by {req.reviewed_by}: "
                f"rider {rider.rider_id} -> {req.requested_vehicle_type_id}")
    return Response({'success': True, 'message': 'Vehicle change approved; rider vehicle updated'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_vehicle_change(request, request_id):
    """Manager: reject a vehicle change request."""
    if not _is_manager(request.user):
        return Response({'success': False, 'message': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN)
    try:
        req = VehicleChangeRequest.objects.get(id=request_id)
    except VehicleChangeRequest.DoesNotExist:
        return Response({'success': False, 'message': 'Request not found'},
                        status=status.HTTP_404_NOT_FOUND)
    if req.status != 'pending':
        return Response({'success': False, 'message': f'Request already {req.status}'},
                        status=status.HTTP_400_BAD_REQUEST)

    req.status = 'rejected'
    req.reviewed_by = getattr(request.user, 'username', None)
    req.reviewed_at = timezone.now()
    req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])
    return Response({'success': True, 'message': 'Vehicle change request rejected'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_riders_from_pops(request):
    """
    Sync riders from POPS API into local database
    POST /api/v1/auth/riders/sync
    """
    # Only managers and admins can sync riders
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({
            'success': False,
            'message': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)
        
    access_token = getattr(settings, 'RIDER_PRO_SERVICE_TOKEN', None) or request.user.access_token
    if not access_token:
        return Response({
            'success': False,
            'message': 'No configured service token or user POPS token'
        }, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        pops_riders, error = pops_client.fetch_riders(access_token)
        if pops_riders is None:
            status_code = status.HTTP_502_BAD_GATEWAY
            msg = 'Failed to fetch riders from POPS'
            if error:
                status_code = error.get('status', status_code)
                msg = f"POPS error: {error.get('message', '')}"
                if status_code in [401, 403]:
                    status_code = status.HTTP_401_UNAUTHORIZED
                    msg = 'POPS rejected the token (expired or not valid).'
            return Response({
                'success': False,
                'message': msg
            }, status=status_code)
            
        sync_stats = {
            'created': 0,
            'updated': 0,
            'failed': 0,
            'total': len(pops_riders)
        }
        
        from django.utils import timezone
        now = timezone.now()
        
        for r_data in pops_riders:
            try:
                # Map POPS rider payload to RiderAccount
                pops_id = r_data.get('id')
                rider_id = r_data.get('rider_id') or str(pops_id)
                if not pops_id:
                    sync_stats['failed'] += 1
                    continue
                    
                # Look up local RiderAccount
                rider = RiderAccount.objects.filter(pops_rider_id=pops_id).first() \
                        or RiderAccount.objects.filter(rider_id=rider_id).first()
                
                # Extract fields
                name = r_data.get('name') or ''
                phone = r_data.get('phone') or ''
                tags = (r_data.get('tags') or '').lower()
                
                # Determine rider/vehicle type from tags
                rider_type = 'bike'
                if 'milkround' in tags:
                    rider_type = 'auto'
                elif 'printo-bike' in tags or 'bike' in tags:
                    rider_type = 'bike'
                elif 'hyperlocal' in tags:
                    rider_type = 'hyperlocal'
                elif 'goods-auto' in tags or 'auto' in tags:
                    rider_type = '3pl'
                
                # Resolve homebase
                homebase = None
                hb_val = r_data.get('homebaseId')
                if hb_val:
                    homebase = Homebase.objects.filter(pops_homebase_id=hb_val).first() \
                               or Homebase.objects.filter(homebase_id=str(hb_val)).first()
                
                if rider:
                    # Update existing
                    rider.pops_rider_id = pops_id
                    rider.rider_id = rider_id
                    rider.full_name = name
                    rider.phone = phone
                    rider.rider_type = rider_type
                    rider.synced_to_pops = True
                    if homebase:
                        rider.primary_homebase = homebase
                    rider.save()
                    sync_stats['updated'] += 1
                else:
                    # Create new
                    rider = RiderAccount.objects.create(
                        rider_id=rider_id,
                        pops_rider_id=pops_id,
                        full_name=name,
                        phone=phone,
                        rider_type=rider_type,
                        primary_homebase=homebase,
                        synced_to_pops=True,
                        is_approved=True,  # Synced from POPS directly -> pre-approved
                        is_active=True
                    )
                    sync_stats['created'] += 1
                    
                # Sync junction assignments
                if homebase:
                    RiderHomebaseAssignment.objects.get_or_create(
                        rider=rider,
                        homebase=homebase,
                        defaults={'is_primary': True, 'is_active': True, 'synced_to_pops': True, 'pops_rider_id': pops_id}
                    )
                    
            except Exception as ex:
                logger.error(f"Failed to sync rider data {r_data}: {ex}")
                sync_stats['failed'] += 1
                
        return Response({
            'success': True,
            'message': f"Rider sync completed: {sync_stats['created']} created, {sync_stats['updated']} updated, {sync_stats['failed']} failed.",
            'stats': sync_stats
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error syncing riders from POPS: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': f"Failed to sync riders: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def archive_user(request, user_id):
    """
    Archive user (soft delete)
    POST /api/v1/auth/users/<user_id>/archive
    """
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({'success': False, 'message': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN)
                        
    try:
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({'success': False, 'message': 'User not found'},
                            status=status.HTTP_404_NOT_FOUND)
                            
        from django.utils import timezone
        if kind == 'rider':
            account.archived_at = timezone.now()
            account.is_active = False
            account.save()
            return Response({'success': True, 'message': 'Rider archived successfully'},
                            status=status.HTTP_200_OK)
        else:
            account.is_active = False
            account.save()
            return Response({'success': True, 'message': 'Staff user deactivated successfully'},
                            status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error archiving user {user_id}: {e}", exc_info=True)
        return Response({'success': False, 'message': f"Failed to archive user: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def restore_user(request, user_id):
    """
    Restore an archived user
    POST /api/v1/auth/users/<user_id>/restore
    """
    if not (request.user.is_superuser or request.user.is_ops_team or request.user.is_staff):
        return Response({'success': False, 'message': 'Permission denied'},
                        status=status.HTTP_403_FORBIDDEN)
                        
    try:
        kind, account = _resolve_account(user_id)
        if account is None:
            return Response({'success': False, 'message': 'User not found'},
                            status=status.HTTP_404_NOT_FOUND)
                            
        if kind == 'rider':
            account.archived_at = None
            account.is_active = True
            account.save()
            return Response({'success': True, 'message': 'Rider restored successfully'},
                            status=status.HTTP_200_OK)
        else:
            account.is_active = True
            account.save()
            return Response({'success': True, 'message': 'Staff user restored successfully'},
                            status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error restoring user {user_id}: {e}", exc_info=True)
        return Response({'success': False, 'message': f"Failed to restore user: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)
