"""
Routing service abstraction for RiderPro.

Provides road-aware distance and duration matrices used by optimize_path.
The active backend is chosen via the ROUTING_PROVIDER setting (env var):

    ROUTING_PROVIDER=ors        OpenRouteService API (default — free, no local data)
    ROUTING_PROVIDER=google     Google Distance Matrix API (pay-per-use, no local data)
    ROUTING_PROVIDER=osrm       Self-hosted OSRM (requires local map data setup)
    ROUTING_PROVIDER=haversine  Straight-line fallback (dev/offline, no external service)

Switching providers requires only an env var change — no code changes.

Every backend falls back to Haversine automatically if the external service is
unreachable, so the app always works even without a routing provider configured.

Provider comparison:
    ors        Free tier: 2,000 requests/day — enough for ~2,000 route optimizations/day.
               Register at https://openrouteservice.org to get a free API key.
               Set ORS_API_KEY env var. No local data, works globally.

    google     $200 free credit/month (~20,000 matrix elements free).
               Set GOOGLE_MAPS_API_KEY env var. Reliable, SLA-backed.

    osrm       Self-hosted, unlimited calls, no per-call cost.
               Requires running scripts/setup-osrm.sh to download and pre-process
               regional OSM data (~90 MB Karnataka / ~700 MB India).
               Only needed if you want fully offline or very-high-volume routing.

    haversine  No external service. Straight-line distances — inaccurate on real roads
               (typically 20-40% shorter than actual road distance). Use only for
               development or as a last-resort fallback.
"""
import json
import logging
import math
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import List, Tuple

from django.conf import settings

logger = logging.getLogger(__name__)

# (latitude, longitude) pair
Coord = Tuple[float, float]


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class LegResult:
    """Road distance and travel time between two consecutive stops."""
    distance_km: float        # road distance in kilometres
    duration_seconds: float   # estimated travel time in seconds


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------

class RoutingBackend:
    """Abstract base — subclasses return an NxN distance/duration matrix and road geometry."""

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        """
        Return matrix[i][j] = LegResult(distance, duration) for points[i] → points[j].
        Diagonal entries are always LegResult(0, 0).
        """
        raise NotImplementedError

    def get_route_geometry(self, points: List[Coord]) -> List[Coord]:
        """
        Return an ordered list of (lat, lng) coordinates that follow the actual
        road path through all points in sequence.
        Used for drawing road-accurate polylines on the map.
        Falls back to returning the input points directly (straight lines) if
        the provider is unavailable.
        """
        # Default: straight-line — subclasses override for road-accurate paths
        return list(points)


class HaversineBackend(RoutingBackend):
    """
    Straight-line (great-circle) distances.
    Duration estimated using ROUTING_AVERAGE_SPEED_KMH (default 30 km/h).
    Always available — used as the fallback when no external provider works.
    """

    @staticmethod
    def _haversine(p1: Coord, p2: Coord) -> float:
        """Return great-circle distance in km between two (lat, lng) points."""
        R = 6371.0
        lat1, lng1 = math.radians(p1[0]), math.radians(p1[1])
        lat2, lng2 = math.radians(p2[0]), math.radians(p2[1])
        dlat, dlng = lat2 - lat1, lng2 - lng1
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        )
        return R * 2 * math.asin(math.sqrt(max(0.0, a)))

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        avg_speed: float = getattr(settings, 'ROUTING_AVERAGE_SPEED_KMH', 30.0)
        n = len(points)
        matrix: List[List[LegResult]] = []
        for i in range(n):
            row: List[LegResult] = []
            for j in range(n):
                if i == j:
                    row.append(LegResult(0.0, 0.0))
                else:
                    dist = self._haversine(points[i], points[j])
                    row.append(LegResult(
                        distance_km=round(dist, 3),
                        duration_seconds=round((dist / avg_speed) * 3600, 1),
                    ))
            matrix.append(row)
        return matrix


class OpenRouteServiceBackend(RoutingBackend):
    """
    OpenRouteService (ORS) Matrix API — real road distances and durations.

    Free tier: 2,000 requests/day (sufficient for ~2,000 route optimisations/day).
    Register at https://openrouteservice.org to get a free API key.
    Max 50 locations per request on the free tier.

    Configure with:
        ORS_API_KEY=<your key>       (required)
        ORS_BASE_URL=...             (optional, default: https://api.openrouteservice.org)

    Falls back to Haversine if the key is missing or the API call fails.
    """

    _DEFAULT_BASE_URL = "https://api.openrouteservice.org"
    _MAX_LOCATIONS = 50   # free-tier hard limit per request

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        api_key: str = getattr(settings, 'ORS_API_KEY', '')
        avg_speed: float = getattr(settings, 'ROUTING_AVERAGE_SPEED_KMH', 30.0)

        if not api_key:
            logger.warning(
                "ORS_API_KEY is not set — falling back to Haversine distances. "
                "Register free at https://openrouteservice.org and set ORS_API_KEY."
            )
            return HaversineBackend().get_distance_matrix(points)

        if len(points) > self._MAX_LOCATIONS:
            logger.warning(
                "ORS free tier supports max %d locations per request; got %d. "
                "Falling back to Haversine. Upgrade your ORS plan for larger routes.",
                self._MAX_LOCATIONS, len(points),
            )
            return HaversineBackend().get_distance_matrix(points)

        base_url: str = getattr(settings, 'ORS_BASE_URL', self._DEFAULT_BASE_URL)
        url = f"{base_url}/v2/matrix/driving-car"

        # ORS Matrix API expects [lng, lat] pairs (GeoJSON order)
        locations = [[lng, lat] for lat, lng in points]
        payload = json.dumps({
            "locations": locations,
            "metrics": ["duration", "distance"],
            "units": "km",
        }).encode()

        try:
            req = urllib.request.Request(
                url,
                data=payload,
                method="POST",
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "RiderPro/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())

            # ORS returns durations[i][j] in seconds, distances[i][j] in km
            durations: List[List[float]] = data["durations"]
            distances: List[List[float]] = data.get("distances") or []

            n = len(points)
            matrix: List[List[LegResult]] = []
            for i in range(n):
                row: List[LegResult] = []
                for j in range(n):
                    dur_s = durations[i][j]
                    dist_km = distances[i][j] if distances else None

                    if dur_s is None:
                        # Unreachable via road — Haversine fallback for this pair
                        hav = HaversineBackend._haversine(points[i], points[j])
                        row.append(LegResult(
                            distance_km=round(hav, 3),
                            duration_seconds=round((hav / avg_speed) * 3600, 1),
                        ))
                    else:
                        row.append(LegResult(
                            distance_km=round(float(dist_km), 3) if dist_km is not None else 0.0,
                            duration_seconds=round(float(dur_s), 1),
                        ))
                matrix.append(row)

            return matrix

        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError, OSError) as exc:
            logger.warning(
                "OpenRouteService unavailable (%s) — falling back to Haversine distances.", exc
            )
            return HaversineBackend().get_distance_matrix(points)

    def get_route_geometry(self, points: List[Coord]) -> List[Coord]:
        """
        Return road-accurate path coordinates via ORS Directions API.
        Used to draw a realistic polyline on the map (follows actual roads).
        Falls back to straight-line (input points) if ORS is unavailable.
        """
        api_key: str = getattr(settings, 'ORS_API_KEY', '')
        if not api_key or len(points) < 2:
            return list(points)

        base_url: str = getattr(settings, 'ORS_BASE_URL', self._DEFAULT_BASE_URL)
        url = f"{base_url}/v2/directions/driving-car/geojson"

        # ORS uses [lng, lat] order (GeoJSON)
        locations = [[lng, lat] for lat, lng in points]
        payload = json.dumps({"coordinates": locations}).encode()

        try:
            req = urllib.request.Request(
                url,
                data=payload,
                method="POST",
                headers={
                    "Authorization": api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "RiderPro/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())

            # GeoJSON coordinates are [lng, lat] — convert to our [lat, lng]
            raw_coords = data["features"][0]["geometry"]["coordinates"]
            return [(lat, lng) for lng, lat in raw_coords]

        except Exception as exc:
            logger.warning(
                "ORS Directions unavailable (%s) — returning straight-line path.", exc
            )
            return list(points)


class OSRMBackend(RoutingBackend):
    """
    OSRM Table API — actual road distances and durations.

    Self-hosted. Requires regional OSM data downloaded and pre-processed once:
        bash scripts/setup-osrm.sh karnataka   # or india, tamil-nadu, etc.

    Configure with:
        OSRM_BASE_URL=http://osrm:5000   (default, matches docker-compose service name)

    Falls back to Haversine if OSRM is unreachable.
    Note: OSRM expects coordinates as lng,lat (longitude first).
    """

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        base_url: str = getattr(settings, 'OSRM_BASE_URL', 'http://osrm:5000')
        avg_speed: float = getattr(settings, 'ROUTING_AVERAGE_SPEED_KMH', 30.0)

        # OSRM uses lng,lat order — opposite of our internal (lat, lng)
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in points)
        url = f"{base_url}/table/v1/driving/{coords_str}?annotations=duration,distance"

        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RiderPro/1.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())

            if data.get('code') != 'Ok':
                raise ValueError(f"OSRM error: {data.get('message', 'unknown')}")

            durations = data['durations']            # NxN seconds (may contain null)
            distances = data.get('distances') or []  # NxN metres (optional annotation)

            n = len(points)
            matrix: List[List[LegResult]] = []
            for i in range(n):
                row: List[LegResult] = []
                for j in range(n):
                    dur_s = durations[i][j]
                    dist_m = distances[i][j] if distances else None

                    if dur_s is None:
                        hav = HaversineBackend._haversine(points[i], points[j])
                        row.append(LegResult(
                            distance_km=round(hav, 3),
                            duration_seconds=round((hav / avg_speed) * 3600, 1),
                        ))
                    else:
                        row.append(LegResult(
                            distance_km=round((dist_m / 1000.0) if dist_m is not None else 0.0, 3),
                            duration_seconds=round(float(dur_s), 1),
                        ))
                matrix.append(row)

            return matrix

        except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError, OSError) as exc:
            logger.warning(
                "OSRM unavailable (%s) — falling back to Haversine. "
                "Run scripts/setup-osrm.sh to set up routing data, or use ROUTING_PROVIDER=ors.",
                exc,
            )
            return HaversineBackend().get_distance_matrix(points)


class GoogleMapsBackend(RoutingBackend):
    """
    Google Distance Matrix API — road distances and durations.

    Configure with:
        GOOGLE_MAPS_API_KEY=<your key>   (required)

    Pricing: $200 free credit/month, then ~$10 per 1,000 matrix elements.
    Falls back to Haversine if the key is missing or the API call fails.
    """

    _BASE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        api_key: str = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        avg_speed: float = getattr(settings, 'ROUTING_AVERAGE_SPEED_KMH', 30.0)

        if not api_key:
            logger.warning(
                "GOOGLE_MAPS_API_KEY is not set — falling back to Haversine distances."
            )
            return HaversineBackend().get_distance_matrix(points)

        latlng_strs = [f"{lat},{lng}" for lat, lng in points]
        params = urllib.parse.urlencode({
            'origins':      "|".join(latlng_strs),
            'destinations': "|".join(latlng_strs),
            'mode':         'driving',
            'key':          api_key,
        })
        url = f"{self._BASE_URL}?{params}"

        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'RiderPro/1.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode())

            if data.get('status') != 'OK':
                raise ValueError(f"Google Maps API status: {data.get('status')}")

            matrix: List[List[LegResult]] = []
            for i, row_data in enumerate(data['rows']):
                row: List[LegResult] = []
                for j, element in enumerate(row_data['elements']):
                    if element.get('status') == 'OK':
                        dist_km = element['distance']['value'] / 1000.0
                        dur_s = float(element['duration']['value'])
                    else:
                        hav = HaversineBackend._haversine(points[i], points[j])
                        dist_km = hav
                        dur_s = (hav / avg_speed) * 3600
                    row.append(LegResult(
                        distance_km=round(dist_km, 3),
                        duration_seconds=round(dur_s, 1),
                    ))
                matrix.append(row)

            return matrix

        except Exception as exc:
            logger.warning(
                "Google Maps API failed (%s) — falling back to Haversine distances.", exc
            )
            return HaversineBackend().get_distance_matrix(points)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_routing_backend() -> RoutingBackend:
    """
    Return the configured routing backend.

    Reads ROUTING_PROVIDER from Django settings (overridable via env var):
        ors        → OpenRouteServiceBackend  (default — free, no local data)
        google     → GoogleMapsBackend
        osrm       → OSRMBackend              (requires local map data)
        haversine  → HaversineBackend         (straight-line, no external service)
    """
    provider: str = getattr(settings, 'ROUTING_PROVIDER', 'ors').lower()
    if provider == 'google':
        return GoogleMapsBackend()
    if provider == 'osrm':
        return OSRMBackend()
    if provider == 'haversine':
        return HaversineBackend()
    return OpenRouteServiceBackend()  # default: ors
