import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import { Shipment, RouteLocation } from '@shared/types';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for drop points
const createDropPointIcon = (count: number) => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #3b82f6;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">
        ${count}
      </div>
    `,
    className: 'custom-drop-point-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

// Custom icon for rider
const createRiderIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #22c55e;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    className: 'custom-rider-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

interface DropPoint {
  latitude: number;
  longitude: number;
  shipments: Shipment[];
  address: string;
}

interface DropPointMapProps {
  shipments: Shipment[];
  currentLocation?: { latitude: number; longitude: number };
  optimizedPath?: RouteLocation[];
  onDropPointSelect?: (shipments: Shipment[]) => void;
  center?: [number, number];
  zoom?: number;
}

function MapUpdater({ points, currentLocation }: { points: [number, number][], currentLocation?: { latitude: number, longitude: number } }) {
  const map = useMap();

  useEffect(() => {
    const allPoints = [...points];
    if (currentLocation) {
      allPoints.push([currentLocation.latitude, currentLocation.longitude]);
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points, currentLocation]);

  return null;
}

function DropPointMap({
  shipments,
  currentLocation,
  optimizedPath,
  onDropPointSelect,
  center = [12.9716, 77.5946], // Default to Bangalore
  zoom = 13
}: DropPointMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [roadPathPositions, setRoadPathPositions] = useState<[number, number][]>([]);

  // Group shipments by location
  const dropPoints = useMemo(() => {
    const points: Record<string, DropPoint> = {};

    shipments.forEach(s => {
      if (s.latitude && s.longitude) {
        const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
        if (!points[key]) {
          points[key] = {
            latitude: s.latitude,
            longitude: s.longitude,
            shipments: [],
            address: s.address_display || 'Unknown Address'
          };
        }
        points[key].shipments.push(s);
      }
    });

    return Object.values(points);
  }, [shipments]);

  const pathPositions: [number, number][] = useMemo(() => {
    if (!optimizedPath || optimizedPath.length === 0) return [];

    const positions: [number, number][] = [];
    if (currentLocation) {
      positions.push([currentLocation.latitude, currentLocation.longitude]);
    }

    optimizedPath.forEach(loc => {
      positions.push([loc.latitude, loc.longitude]);
    });

    return positions;
  }, [optimizedPath, currentLocation]);

  // Round rider position to reduce routing API churn from tiny GPS jitters.
  const routeRequestPositions: [number, number][] = useMemo(() => {
    if (pathPositions.length === 0) return [];
    const points = [...pathPositions];
    if (currentLocation && points.length > 0) {
      points[0] = [
        Number(currentLocation.latitude.toFixed(3)),
        Number(currentLocation.longitude.toFixed(3)),
      ];
    }
    return points;
  }, [pathPositions, currentLocation]);

  useEffect(() => {
    if (routeRequestPositions.length < 2) {
      setRoadPathPositions([]);
      return;
    }

    const controller = new AbortController();

    const loadRoadPath = async () => {
      try {
        // OSRM expects "lon,lat;lon,lat;..."
        const coordinates = routeRequestPositions
          .map(([lat, lng]) => `${lng},${lat}`)
          .join(';');

        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Routing API failed: ${res.status}`);
        }

        const data = await res.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates;

        if (!Array.isArray(geometry) || geometry.length < 2) {
          throw new Error('No road geometry returned');
        }

        const snapped: [number, number][] = geometry.map((coord: [number, number]) => [coord[1], coord[0]]);
        setRoadPathPositions(snapped);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          // Fall back to straight segments if road routing is unavailable.
          setRoadPathPositions(routeRequestPositions);
        }
      }
    };

    loadRoadPath();
    return () => controller.abort();
  }, [routeRequestPositions]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-border/60">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapReady && <MapUpdater
          points={dropPoints.map(p => [p.latitude, p.longitude])}
          currentLocation={currentLocation}
        />}

        {/* Render rider location */}
        {currentLocation && (
          <Marker
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={createRiderIcon()}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* Render drop points */}
        {dropPoints.map((point, idx) => (
          <Marker
            key={`drop-${idx}`}
            position={[point.latitude, point.longitude]}
            icon={createDropPointIcon(point.shipments.length)}
            eventHandlers={{
              click: () => onDropPointSelect?.(point.shipments)
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="font-semibold text-sm mb-1">{point.address}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {point.shipments.length} shipment(s)
                </div>
                <div className="max-h-[100px] overflow-y-auto border-t pt-1">
                  {point.shipments.map(s => (
                    <div key={s.shipment_id ?? `${s.customer_name}-${idx}`} className="text-[10px] py-0.5 border-b last:border-0">
                      {s.customer_name}
                      {s.shipment_id && (
                        <> - {String(s.shipment_id).slice(-6)}</>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onDropPointSelect?.(point.shipments)}
                  className="mt-2 w-full bg-primary text-white text-[10px] py-1 rounded hover:opacity-90 transition-opacity"
                >
                  Process Drop point
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render optimized path */}
        {(roadPathPositions.length > 1 || pathPositions.length > 1) && (
          <Polyline
            positions={roadPathPositions.length > 1 ? roadPathPositions : pathPositions}
            color="#3b82f6"
            weight={4}
            opacity={0.6}
            dashArray="10, 10"
          />
        )}
      </MapContainer>

      {/* Empty state when we have shipments but no drop points (e.g. no coords yet) */}
      {dropPoints.length === 0 && shipments.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 dark:bg-background/80 z-[800] pointer-events-none">
          <p className="text-sm text-muted-foreground px-4 py-2 rounded-lg bg-card/90 border border-border/50 shadow-sm">
            No drop points with location yet. Addresses are being geocoded.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg z-[1000] border border-border/50">
        <div className="text-xs font-bold mb-2 uppercase tracking-wider">Route Info</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-[10px]">Your Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-[10px]">Drop Point (with count)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 border-t-2 border-dashed border-blue-500"></div>
            <span className="text-[10px]">Shortest Path</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withChartErrorBoundary(DropPointMap, {
  componentName: 'DropPointMap'
});
