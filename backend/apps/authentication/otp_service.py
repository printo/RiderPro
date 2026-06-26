import bcrypt
import random
import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from apps.authentication.models import OtpChallenge
from apps.authentication.otp_providers import get_otp_sender

logger = logging.getLogger(__name__)


class OtpService:
    """
    Generic OTP engine: generation, hashing, expiry, rate-limiting, verification.
    Delivery is delegated to a pluggable sender (see otp_providers.get_otp_sender),
    so this stays channel-agnostic.
    """

    @staticmethod
    def generate_and_send(phone: str, purpose: str = 'rider_login',
                          request_ip: str = None, name: str = '') -> OtpChallenge:
        now = timezone.now()
        cooldown_seconds = getattr(settings, 'OTP_RESEND_COOLDOWN', 45)
        max_per_phone_day = getattr(settings, 'OTP_MAX_PER_PHONE_PER_DAY', 10)
        max_per_ip_hour = getattr(settings, 'OTP_MAX_PER_IP_PER_HOUR', 30)

        # Resend cooldown (per phone)
        last_challenge = OtpChallenge.objects.filter(
            phone=phone, purpose=purpose
        ).order_by('-created_at').first()
        if last_challenge:
            elapsed = (now - last_challenge.created_at).total_seconds()
            if elapsed < cooldown_seconds:
                wait_time = int(cooldown_seconds - elapsed)
                raise ValueError(f"Please wait {wait_time} seconds before requesting a new OTP.")

        # Lenient abuse caps: per-phone/day and per-IP/hour (anti SMS/WhatsApp pumping)
        day_ago = now - timedelta(days=1)
        if OtpChallenge.objects.filter(phone=phone, created_at__gte=day_ago).count() >= max_per_phone_day:
            raise ValueError("Too many OTP requests for this number today. Please try again later.")
        if request_ip:
            hour_ago = now - timedelta(hours=1)
            if OtpChallenge.objects.filter(request_ip=request_ip, created_at__gte=hour_ago).count() >= max_per_ip_hour:
                raise ValueError("Too many OTP requests from this device. Please try again later.")

        # Generate a cryptographically-random 6-digit code, store only its hash
        code = str(random.SystemRandom().randint(100000, 999999))
        code_hash = bcrypt.hashpw(code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        ttl_seconds = getattr(settings, 'OTP_TTL_SECONDS', 300)

        challenge = OtpChallenge.objects.create(
            phone=phone,
            code_hash=code_hash,
            plaintext_code=code,
            purpose=purpose,
            expires_at=now + timedelta(seconds=ttl_seconds),
            request_ip=request_ip,
        )

        # Deliver. If the send fails, drop the challenge (so the cooldown doesn't
        # strand the rider) and surface a generic message — the sender already
        # logged the upstream detail.
        try:
            get_otp_sender().send_otp(phone, code, name=name)
        except Exception as e:
            logger.error(f"OTP delivery failed for {phone}: {e}")
            challenge.delete()
            raise ValueError("Couldn't send the verification code right now. Please try again.")

        return challenge

    @staticmethod
    def verify_otp(phone: str, code: str, purpose: str = 'rider_login') -> bool:
        max_attempts = getattr(settings, 'OTP_MAX_ATTEMPTS', 5)

        # Lock the challenge row so concurrent verifies can't race past the
        # attempt cap. The attempt increment must persist even on a wrong code,
        # so we only raise for an invalid code AFTER the block commits.
        with transaction.atomic():
            challenge = OtpChallenge.objects.select_for_update().filter(
                phone=phone, purpose=purpose, consumed_at__isnull=True
            ).order_by('-created_at').first()

            if not challenge:
                raise ValueError("No active OTP request found for this phone number.")
            if challenge.expires_at < timezone.now():
                raise ValueError("OTP has expired. Please request a new one.")
            if challenge.attempts >= max_attempts:
                raise ValueError("Too many failed attempts. Please request a new OTP.")

            challenge.attempts += 1
            challenge.save(update_fields=['attempts'])

            is_valid = bcrypt.checkpw(code.encode('utf-8'), challenge.code_hash.encode('utf-8'))
            if is_valid:
                challenge.consumed_at = timezone.now()
                challenge.plaintext_code = None
                challenge.save(update_fields=['consumed_at', 'plaintext_code'])

        if not is_valid:
            raise ValueError("Invalid verification code.")
        return True
