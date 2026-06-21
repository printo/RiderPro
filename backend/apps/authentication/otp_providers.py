import logging
import requests
from abc import ABC, abstractmethod
from django.conf import settings

logger = logging.getLogger(__name__)


def send_whatsapp_otp(phone: str, code: str, name: str = "") -> None:
    """
    Deliver an OTP code over WhatsApp via the Botspace Business API.

    This is the channel-specific delivery function only — it does NOT generate
    the OTP. Generation / hashing / storage / verification live in the generic
    OtpService, so swapping or adding a channel never touches that logic.

    Botspace send-message API:
        POST {base}/v1/{channelId}/message/send-message?apiKey=<key>
        body: { name, phone, templateId, variables: [<code>] }
        200 -> { "data": { "id", "conversationId", "status": "accepted" } }

    Raises on any misconfiguration or delivery failure (caller maps it to a
    generic user-facing message and logs the detail).
    """
    api_base = getattr(settings, 'BOTSPACE_API_BASE', 'https://public-api.bot.space/v1')
    api_key = getattr(settings, 'BOTSPACE_API_KEY', '')
    channel_id = getattr(settings, 'BOTSPACE_CHANNEL_ID', '')
    template_id = getattr(settings, 'BOTSPACE_OTP_TEMPLATE', '')

    if not api_key:
        raise ValueError("BOTSPACE_API_KEY is not configured.")
    if not channel_id:
        raise ValueError("BOTSPACE_CHANNEL_ID is not configured.")
    if not template_id:
        raise ValueError("BOTSPACE_OTP_TEMPLATE is not configured.")

    # The Botspace path is /v1/{channelId}/message/send-message. Tolerate a base
    # that either already includes the /v1 segment or doesn't.
    base = api_base.rstrip('/')
    if not base.endswith('/v1'):
        base = base + '/v1'
    url = f"{base}/{channel_id}/message/send-message"

    # Botspace requires the number in E.164 form with a leading '+' and the
    # country code, e.g. +919940117071. Rider phones are often stored as bare
    # 10 digits, which Botspace rejects with "Invalid phone number". Default to
    # India (91).
    default_cc = getattr(settings, 'OTP_DEFAULT_COUNTRY_CODE', '91')
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = default_cc + digits
    phone_e164 = '+' + digits

    payload = {
        "name": name or "",
        "phone": phone_e164,
        "templateId": template_id,
        "variables": [code],
    }

    logger.info(f"Sending OTP template '{template_id}' to {phone} via Botspace WhatsApp")
    response = None
    try:
        response = requests.post(url, params={"apiKey": api_key}, json=payload, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        detail = str(e)
        if response is not None:
            detail += f" | {response.status_code} {response.text}"
        # Log the upstream detail; raise without it so it never reaches the client.
        logger.error(f"Botspace OTP send failed for {phone}: {detail}")
        raise ValueError("Failed to deliver OTP via WhatsApp.")


class BaseOtpSender(ABC):
    """Interface for an OTP delivery channel."""

    @abstractmethod
    def send_otp(self, phone: str, code: str, name: str = "") -> None:
        """Deliver the code to the phone. Raise on failure."""
        ...


class ConsoleOtpSender(BaseOtpSender):
    """Development sender — logs the code instead of delivering it."""

    def send_otp(self, phone: str, code: str, name: str = "") -> None:
        logger.info("============ OTP SEND (CONSOLE) ============")
        logger.info(f"Phone: {phone}  Code: {code}")
        logger.info("=============================================")
        print(f"\n[OTP SENDER] Phone: {phone} | Code: {code}\n", flush=True)


class BotspaceOtpSender(BaseOtpSender):
    """WhatsApp OTP delivery via Botspace."""

    def send_otp(self, phone: str, code: str, name: str = "") -> None:
        send_whatsapp_otp(phone, code, name=name)


def get_otp_sender() -> BaseOtpSender:
    """Return the configured OTP sender, selected by OTP_PROVIDER."""
    provider = getattr(settings, 'OTP_PROVIDER', 'console').lower()
    if provider == 'botspace':
        return BotspaceOtpSender()
    return ConsoleOtpSender()
