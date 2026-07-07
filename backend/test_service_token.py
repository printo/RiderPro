import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'riderpro.settings')
django.setup()

from django.conf import settings
from utils.pops_client import pops_client

print("=== POPS Config ===")
print(f"POPS_API_BASE_URL: {settings.POPS_API_BASE_URL}")
print(f"RIDER_PRO_SERVICE_TOKEN exists: {bool(settings.RIDER_PRO_SERVICE_TOKEN)}")
print(f"POPS_SERVICE_EMAIL: {settings.POPS_SERVICE_EMAIL}")
print(f"POPS_SERVICE_PASSWORD exists: {bool(settings.POPS_SERVICE_PASSWORD)}")

# Attempt to resolve service token
print("\n=== Running get_service_token() ===")
try:
    token = pops_client.get_service_token()
    print(f"Resolved token: {token[:20] if token else 'None'}...")
    if token:
        print("Token is valid! Checking against POPS verify_token endpoint:")
        verify_res = pops_client.verify_token(token)
        print(f"Verify response: {verify_res}")
except Exception as e:
    print(f"Error occurred: {e}")
