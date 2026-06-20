import bcrypt
from datetime import timedelta
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
from apps.authentication.models import RiderAccount, OtpChallenge, User
from apps.authentication.otp_service import OtpService

class AuthenticationTestCase(TestCase):
    def setUp(self):
        # Create an approved and active rider
        self.phone = "+919876543210"
        self.rider = RiderAccount.objects.create(
            rider_id="R001",
            full_name="Rider One",
            phone=self.phone,
            is_approved=True,
            is_active=True
        )
        self.client = Client()

    def test_deprecated_endpoints(self):
        # /auth/login should return 400
        response = self.client.post(reverse('authentication:login'), {
            'username': 'admin@printo.in',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])
        self.assertIn('deprecated', response.json()['message'].lower())

        # /auth/local-login should return 400
        response = self.client.post(reverse('authentication:local_login'), {
            'riderId': 'R001',
            'password': 'password123'
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['success'])
        self.assertIn('deprecated', response.json()['message'].lower())

    def test_request_otp_success(self):
        response = self.client.post(reverse('authentication:request_otp'), {
            'phone': self.phone
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        
        # Verify OtpChallenge was created
        challenge = OtpChallenge.objects.filter(phone=self.phone).first()
        self.assertIsNotNone(challenge)
        self.assertEqual(challenge.attempts, 0)
        self.assertIsNone(challenge.consumed_at)

    def test_request_otp_not_found(self):
        response = self.client.post(reverse('authentication:request_otp'), {
            'phone': '+910000000000'
        })
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()['success'])

    def test_request_otp_cooldown(self):
        # First request
        self.client.post(reverse('authentication:request_otp'), {'phone': self.phone})
        # Second request immediately should trigger cooldown
        response = self.client.post(reverse('authentication:request_otp'), {'phone': self.phone})
        self.assertEqual(response.status_code, 400)
        self.assertIn("wait", response.json()['message'].lower())

    def test_verify_otp_success(self):
        # We can bypass sending and generate directly to know the plain code
        plain_code = "123456"
        salt = bcrypt.gensalt()
        code_hash = bcrypt.hashpw(plain_code.encode('utf-8'), salt).decode('utf-8')
        
        challenge = OtpChallenge.objects.create(
            phone=self.phone,
            code_hash=code_hash,
            purpose='rider_login',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        response = self.client.post(reverse('authentication:verify_otp'), {
            'phone': self.phone,
            'code': plain_code
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        self.assertIn('accessToken', response.json())
        
        # Verify challenge consumed
        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.consumed_at)
        self.assertEqual(challenge.attempts, 1)

    def test_verify_otp_invalid_code(self):
        plain_code = "123456"
        salt = bcrypt.gensalt()
        code_hash = bcrypt.hashpw(plain_code.encode('utf-8'), salt).decode('utf-8')
        
        challenge = OtpChallenge.objects.create(
            phone=self.phone,
            code_hash=code_hash,
            purpose='rider_login',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        response = self.client.post(reverse('authentication:verify_otp'), {
            'phone': self.phone,
            'code': '654321' # Wrong code
        })
        self.assertEqual(response.status_code, 400)
        
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 1)
        self.assertIsNone(challenge.consumed_at)

    def test_verify_otp_expired(self):
        plain_code = "123456"
        salt = bcrypt.gensalt()
        code_hash = bcrypt.hashpw(plain_code.encode('utf-8'), salt).decode('utf-8')
        
        challenge = OtpChallenge.objects.create(
            phone=self.phone,
            code_hash=code_hash,
            purpose='rider_login',
            expires_at=timezone.now() - timedelta(minutes=1) # Expired
        )
        
        response = self.client.post(reverse('authentication:verify_otp'), {
            'phone': self.phone,
            'code': plain_code
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("expired", response.json()['message'].lower())

    def test_verify_otp_max_attempts(self):
        plain_code = "123456"
        salt = bcrypt.gensalt()
        code_hash = bcrypt.hashpw(plain_code.encode('utf-8'), salt).decode('utf-8')
        
        challenge = OtpChallenge.objects.create(
            phone=self.phone,
            code_hash=code_hash,
            purpose='rider_login',
            expires_at=timezone.now() + timedelta(minutes=5),
            attempts=5 # Already 5 attempts
        )
        
        response = self.client.post(reverse('authentication:verify_otp'), {
            'phone': self.phone,
            'code': plain_code
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("attempts", response.json()['message'].lower())

    def test_request_and_verify_otp_phone_normalization(self):
        # Request OTP using a 10-digit number without country code
        response = self.client.post(reverse('authentication:request_otp'), {
            'phone': '9876543210'
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
        
        # Verify OtpChallenge was created for the canonical phone number '+919876543210'
        challenge = OtpChallenge.objects.filter(phone=self.phone).first()
        self.assertIsNotNone(challenge)
        
        # Clear existing challenges and create a fresh challenge with canonical phone for verification
        OtpChallenge.objects.all().delete()
        plain_code = "123456"
        salt = bcrypt.gensalt()
        code_hash = bcrypt.hashpw(plain_code.encode('utf-8'), salt).decode('utf-8')
        
        challenge = OtpChallenge.objects.create(
            phone=self.phone,
            code_hash=code_hash,
            purpose='rider_login',
            expires_at=timezone.now() + timedelta(minutes=5)
        )
        
        # Verify using a 10-digit phone number
        response = self.client.post(reverse('authentication:verify_otp'), {
            'phone': '9876543210',
            'code': plain_code
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
