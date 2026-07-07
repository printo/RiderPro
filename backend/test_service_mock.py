import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'riderpro.settings')
django.setup()

from django.conf import settings
from utils.pops_client import pops_client

# Backup original methods
orig_verify = pops_client.verify_token
orig_login = pops_client.login

print("=== Starting Mock Test ===")

# Test case 1: Email/password missing
settings.POPS_SERVICE_EMAIL = ''
settings.POPS_SERVICE_PASSWORD = ''
settings.RIDER_PRO_SERVICE_TOKEN = ''
if hasattr(pops_client, '_service_token'):
    delattr(pops_client, '_service_token')

token = pops_client.get_service_token()
assert token is None, "Should return None if no credentials"
print("✓ Test case 1 passed: Returns None when credentials missing.")

# Test case 2: Autologin with valid credentials
settings.POPS_SERVICE_EMAIL = 'service@printo.in'
settings.POPS_SERVICE_PASSWORD = 'secretpassword'

login_calls = 0
def mock_login(email, password):
    global login_calls
    login_calls += 1
    assert email == 'service@printo.in'
    assert password == 'secretpassword'
    return {'access': 'mock-access-token-123', 'refresh': 'mock-refresh'}

verify_calls = 0
def mock_verify_token(token):
    global verify_calls
    verify_calls += 1
    if token == 'mock-access-token-123':
        return {'user_id': 99}
    return None

pops_client.login = mock_login
pops_client.verify_token = mock_verify_token

token = pops_client.get_service_token()
assert token == 'mock-access-token-123', f"Expected mock token, got {token}"
assert login_calls == 1, f"Expected 1 login call, got {login_calls}"
assert settings.RIDER_PRO_SERVICE_TOKEN == 'mock-access-token-123', "Settings should be updated"
print("✓ Test case 2 passed: Successfully logs in and caches token.")

# Test case 3: Subsequent call returns cached token without login
token2 = pops_client.get_service_token()
assert token2 == 'mock-access-token-123', f"Expected mock token, got {token2}"
assert login_calls == 1, "Should not log in again"
assert verify_calls == 1, "Should verify cached token"
print("✓ Test case 3 passed: Returns cached token without logging in.")

# Clean up
pops_client.login = orig_login
pops_client.verify_token = orig_verify
print("\n=== All Mock Tests Passed! ===")
