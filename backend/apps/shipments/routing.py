"""
Routing service abstraction for RiderPro.

Provides road-aware distance and duration matrices used by optimize_path.
The active backend is chosen via the ROUTING_PROVIDER setting (env var):

    ROUTING_PROVIDER=osrm    (default) — self-hosted OSRM via OSRM_BASE_URL
    ROUTING_PROVIDER=google  — Google Distance Matrix API via GOOGLE_MAPS_API_KEY
    ROUTING_PROVIDER=haversine — straight-line fallback (no external service)

Every backend falls back to Haversine if the external service is unreachable,
so the app always works even without a routing provider running.
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
    distance_km: float       # road distance in kilometres
    duration_seconds: float  # estimated travel time in seconds


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------

class RoutingBackend:
    """Abstract base — subclasses return an NxN distance/duration matrix."""

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        """
        Return matrix[i][j] = LegResult(distance, duration) from points[i] → points[j].
        Diagonal entries are always LegResult(0, 0).
        """
        raise NotImplementedError


class HaversineBackend(RoutingBackend):
    """
    Straight-line (great-circle) distances.
    Duration is estimated using ROUTING_AVERAGE_SPEED_KMH (default 30 km/h).
    Used as the fallback when no external routing provider is available.
    """

    @staticmethod
    def _haversine(p1: Coord, p2: Coord) -> float:
        """Return great-circle distance in km between two (lat, lng) points."""
        R = 6371.0
        lat1, lng1 = math.radians(p1[0]), math.radians(p1[1])
        lat2, lng2 = math.radians(p2[0]), math.radians(p2[1])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
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


class OSRMBackend(RoutingBackend):
    """
    OSRM Table API — actual road distances and durations.

    Requires a running OSRM instance. Configure with:
        OSRM_BASE_URL=http://osrm:5000   (default, matches docker-compose service name)

    One-time data setup:  run  scripts/setup-osrm.sh  before starting the service.
    Falls back to Haversine if OSRM is unreachable or returns an error.

    Note: OSRM expects coordinates as  lng,lat  (longitude first).
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

            durations = data['durations']                   # NxN seconds (may contain null)
            distances = data.get('distances') or []         # NxN metres (optional annotation)

            n = len(points)
            matrix: List[List[LegResult]] = []
            for i in range(n):
                row: List[LegResult] = []
                for j in range(n):
                    dur_s = durations[i][j]
                    dist_m = distances[i][j] if distances else None

                    if dur_s is None:
                        # Location unreachable via road — fall back to Haversine for this pair
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
                "OSRM unavailable (%s) — falling back to Haversine distances. "
                "Run scripts/setup-osrm.sh to set up the routing data.",
                exc,
            )
            return HaversineBackend().get_distance_matrix(points)


class GoogleMapsBackend(RoutingBackend):
    """
    Google Distance Matrix API — road distances and durations.

    Requires:
        GOOGLE_MAPS_API_KEY=<your key>

    Switch from OSRM to Google by setting  ROUTING_PROVIDER=google  in the
    environment — no code changes needed.
    Falls back to Haversine if the key is missing or the API call fails.
    """

    _BASE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"

    def get_distance_matrix(self, points: List[Coord]) -> List[List[LegResult]]:
        api_key: str = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')
        avg_speed: float = getattr(settings, 'ROUTING_AVERAGE_SPEED_KMH', 30.0)

        if not api_key:
            logger.warning(
                "GOOGLE_MAPS_API_KEY is not set — falling back to Haversine distances. "
                "Set ROUTING_PROVIDER=osrm or provide GOOGLE_MAPS_API_KEY."
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
                        # Element unreachable — Haversine fallback for this pair only
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

    Reads ROUTING_PROVIDER from Django settings (set via env var):
        osrm      → OSRMBackend       (default)
        google    → GoogleMapsBackend
        haversine → HaversineBackend  (straight-line, no external service)
    """
    provider: str = getattr(settings, 'ROUTING_PROVIDER', 'osrm').lower()
    if provider == 'google':
        return GoogleMapsBackend()
    if provider == 'haversine':
        return HaversineBackend()
    return OSRMBackend()  # default
