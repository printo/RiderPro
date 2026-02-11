
import requests
import json
import time
import sys

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc0Njk0NzIxLCJpYXQiOjE3NzA4MDY3MjEsImp0aSI6ImY0MTFiYjI5YjBjZTQ3OGM4N2UxNjNlNmJjMDk0ODEyIiwidXNlcl9pZCI6IjYifQ.o1juI-Nw0vGjzHlJiDqMLEh--vbPnRGzRMKBNYsRdC8"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def log(msg):
    print(f"[TEST] {msg}")

def test_track_location():
    log("Testing POST /routes/track-location...")
    url = f"{BASE_URL}/routes/track-location"
    payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "speed": 15.5,
        "accuracy": 10.0
    }
    
    try:
        response = requests.post(url, headers=HEADERS, json=payload)
        log(f"Response Status: {response.status_code}")
        if response.status_code == 201:
            data = response.json()
            if data.get("success"):
                log("✅ Track location successful")
                return data['location']
            else:
                log(f"❌ Failed: {data}")
        else:
            log(f"❌ Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        log(f"❌ Exception: {e}")
    return None

def test_current_location():
    log("Testing GET /routes/current-location...")
    url = f"{BASE_URL}/routes/current-location"
    
    try:
        response = requests.get(url, headers=HEADERS)
        log(f"Response Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                loc = data['location']
                log(f"✅ Current location retrieved: {loc['latitude']}, {loc['longitude']}")
                if loc['latitude'] == 12.9716 and loc['longitude'] == 77.5946:
                     log("✅ Location matches tracked data")
                else:
                     log("❌ Location mismatch")
            else:
                log(f"❌ Failed: {data}")
        else:
            log(f"❌ Failed with status {response.status_code}: {response.text}")
    except Exception as e:
        log(f"❌ Exception: {e}")

def main():
    log("Starting verification...")
    # 1. Track Location
    tracked_data = test_track_location()
    
    if tracked_data:
        # 2. Get Current Location
        test_current_location()
    else:
        log("Skipping current location test due to tracking failure")

if __name__ == "__main__":
    main()
