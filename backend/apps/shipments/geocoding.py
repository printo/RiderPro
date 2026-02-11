"""
Geocoding helper for shipment delivery addresses.
Uses Nominatim (OpenStreetMap) when latitude/longitude are not provided by POPS.
Respects Nominatim Usage Policy: 1 req/sec, meaningful User-Agent.
"""
import logging
import time
from typing import Optional, Tuple, Any

import requests

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "RiderPro-Delivery/1.0 (Delivery Management; contact@riderpro.local)"
# Nominatim allows 1 request per second
MIN_INTERVAL_SECONDS = 1.1
_last_request_time: float = 0


def _rate_limit() -> None:
    """Enforce at least MIN_INTERVAL_SECONDS between Nominatim requests."""
    global _last_request_time
    now = time.monotonic()
    elapsed = now - _last_request_time
    if elapsed < MIN_INTERVAL_SECONDS:
        time.sleep(MIN_INTERVAL_SECONDS - elapsed)
    _last_request_time = time.monotonic()


def address_to_query(address_data: Any) -> str:
    """
    Build a single-line search query from address JSON for Nominatim.
    Handles dicts like:
      {"address": "...", "place_name": "...", "city": "...", "state": "...", "pincode": "...", "country": "..."}
    """
    if not address_data:
        return ""
    if isinstance(address_data, str):
        return address_data.strip()
    if not isinstance(address_data, dict):
        return str(address_data).strip()

    parts = []
    # Prefer street/address line first
    if address_data.get("address"):
        parts.append(str(address_data["address"]).strip())
    if address_data.get("formattedAddress") and not parts:
        parts.append(str(address_data["formattedAddress"]).strip())
    if address_data.get("place_name") and not parts:
        parts.append(str(address_data["place_name"]).strip())
    if address_data.get("city"):
        parts.append(str(address_data["city"]).strip())
    if address_data.get("state"):
        parts.append(str(address_data["state"]).strip())
    if address_data.get("pincode"):
        parts.append(str(address_data["pincode"]).strip())
    if address_data.get("country"):
        parts.append(str(address_data["country"]).strip())

    return ", ".join(parts) if parts else ""


def geocode_address(address_data: Any) -> Optional[Tuple[float, float]]:
    """
    Geocode a delivery address to (latitude, longitude) using Nominatim.
    POPS location master may already provide lat/long; use this for customer
    delivery addresses when coords are missing.

    Args:
        address_data: Address as JSON dict (e.g. address, city, state, pincode, country)
                      or a string.

    Returns:
        (latitude, longitude) or None if geocoding failed.
    """
    query = address_to_query(address_data)
    if not query:
        return None

    _rate_limit()
    try:
        response = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        
        # Fallback logic: if full address fails, try simpler query (city + pincode + place_name)
        if (not data or not isinstance(data, list)) and isinstance(address_data, dict):
            fallback_parts = []
            if address_data.get("place_name"):
                fallback_parts.append(str(address_data["place_name"]).strip())
            if address_data.get("city"):
                fallback_parts.append(str(address_data["city"]).strip())
            if address_data.get("pincode"):
                fallback_parts.append(str(address_data["pincode"]).strip())
            
            if fallback_parts:
                fallback_query = ", ".join(fallback_parts)
                logger.info("Retrying geocoding with fallback query: %s", fallback_query)
                _rate_limit()
                response = requests.get(NOMINATIM_URL, params={"q": fallback_query, "format": "json", "limit": 1}, headers={"User-Agent": USER_AGENT}, timeout=10)
                response.raise_for_status()
                data = response.json()

        # Last resort fallback: just city + pincode
        if (not data or not isinstance(data, list)) and isinstance(address_data, dict):
            last_resort_parts = []
            if address_data.get("city"):
                last_resort_parts.append(str(address_data["city"]).strip())
            if address_data.get("pincode"):
                last_resort_parts.append(str(address_data["pincode"]).strip())
            
            if last_resort_parts:
                last_resort_query = ", ".join(last_resort_parts)
                logger.info("Retrying geocoding with last resort query: %s", last_resort_query)
                _rate_limit()
                response = requests.get(NOMINATIM_URL, params={"q": last_resort_query, "format": "json", "limit": 1}, headers={"User-Agent": USER_AGENT}, timeout=10)
                response.raise_for_status()
                data = response.json()

        if not data or not isinstance(data, list):
            return None
            
        first = data[0]
        lat = first.get("lat")
        lon = first.get("lon")
        if lat is None or lon is None:
            return None
        return (float(lat), float(lon))
    except requests.exceptions.Timeout:
        logger.warning("Geocoding timeout for query: %s", query[:80])
        return None
    except requests.exceptions.RequestException as e:
        logger.warning("Geocoding request failed for query %s: %s", query[:80], e)
        return None
    except (KeyError, TypeError, ValueError) as e:
        logger.warning("Geocoding parse error for query %s: %s", query[:80], e)
        return None
