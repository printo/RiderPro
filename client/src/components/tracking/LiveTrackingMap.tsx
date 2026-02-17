import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different rider states
const createRiderIcon = (status: 'active' | 'idle' | 'offline') => {
  const colors = {
    active: '#22c55e', // green
    idle: '#f59e0b',   // amber
    offline: '#6b7280' // gray
  };

  return L.divIcon({
    html: `
      <div style="
        background-color: ${colors[status]};
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    className: 'custom-rider-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

export interface RiderLocation {
  employee_id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  status: 'active' | 'idle' | 'offline';
  employee_name?: string;
  route?: Array<{ lat: number; lng: number }>;
  dropPoints?: Array<{
    id: string;
    shipmentId: string;
    status?: string;
    type?: string;
    lat: number;
    lng: number;
    address?: string;
  }>;
}

interface LiveTrackingMapProps {
  riders: RiderLocation[];
  selectedRider?: string;
  onRiderSelect?: (riderId: string) => void;
  showRoutes?: boolean;
  center?: [number, number];
  zoom?: number;
}

const ROUTE_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#ca8a04', // amber
  '#be185d', // pink
];

const getRiderRouteColor = (employeeId: string) => {
  let hash = 0;
  for (let i = 0; i < employeeId.length; i++) {
    hash = (hash * 31 + employeeId.charCodeAt(i)) >>> 0;
  }
  return ROUTE_PALETTE[hash % ROUTE_PALETTE.length];
};

const createDropPointIcon = (color: string) =>
  L.divIcon({
    html: `
      <div style="
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.35);
      "></div>
    `,
    className: 'live-drop-point-icon',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

// Component to handle map updates
function MapUpdater({ riders, selectedRider }: { riders: RiderLocation[], selectedRider?: string }) {
  const map = useMap();

  useEffect(() => {
    if (riders.length > 0 && !selectedRider) {
      // Fit map to show all riders
      const bounds = L.latLngBounds(
        riders.map(rider => [rider.latitude, rider.longitude])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (selectedRider) {
      // Center on selected rider
      const rider = riders.find(r => r.employee_id === selectedRider);
      if (rider) {
        map.setView([rider.latitude, rider.longitude], 15);
      }
    }
  }, [map, riders, selectedRider]);

  return null;
}

function LiveTrackingMap({
  riders,
  selectedRider,
  onRiderSelect,
  showRoutes = true,
  center = [40.7128, -74.0060], // Default to NYC
  zoom = 10
}: LiveTrackingMapProps) {
  const [mapReady, setMapReady] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'idle': return 'Idle';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'idle': return 'text-amber-600';
      case 'offline': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="w-full h-full relative">
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

        {mapReady && <MapUpdater riders={riders} selectedRider={selectedRider} />}

        {/* Render rider markers */}
        {riders.map((rider) => (
          <Marker
            key={rider.employee_id}
            position={[rider.latitude, rider.longitude]}
            icon={createRiderIcon(rider.status)}
            eventHandlers={{
              click: () => onRiderSelect?.(rider.employee_id)
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="font-semibold text-lg mb-2">
                  {rider.employee_name || `Employee ${rider.employee_id}`}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${getStatusColor(rider.status)}`}>
                      {getStatusText(rider.status)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Update:</span>
                    <span>{formatTimestamp(rider.timestamp)}</span>
                  </div>

                  {rider.speed !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Speed:</span>
                      <span>{Math.round(rider.speed)} km/h</span>
                    </div>
                  )}

                  {rider.accuracy !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accuracy:</span>
                      <span>{Math.round(rider.accuracy)}m</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="text-xs">
                      {rider.latitude.toFixed(4)}, {rider.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onRiderSelect?.(rider.employee_id)}
                  className="mt-3 w-full bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render routes if enabled */}
        {showRoutes && riders.map((rider) => {
          if (!rider.route || rider.route.length < 2) return null;
          const routeColor = getRiderRouteColor(rider.employeeId);

          return (
            <Polyline
              key={`route-${rider.employee_id}`}
              positions={rider.route.map(point => [point.lat, point.lng])}
              color={routeColor}
              weight={selectedRider === rider.employeeId ? 5 : 3}
              opacity={selectedRider && selectedRider !== rider.employeeId ? 0.45 : 0.8}
              dashArray={selectedRider === rider.employeeId ? undefined : '8, 6'}
            />
          );
        })}

        {/* Render drop points for each rider (same color family as route) */}
        {showRoutes && riders.flatMap((rider) => {
          if (!rider.dropPoints || rider.dropPoints.length === 0) return [];
          const routeColor = getRiderRouteColor(rider.employeeId);
          return rider.dropPoints.map((point) => (
            <Marker
              key={`drop-${rider.employeeId}-${point.id}`}
              position={[point.lat, point.lng]}
              icon={createDropPointIcon(routeColor)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold mb-1">{rider.employeeName || rider.employeeId}</div>
                  <div className="text-xs text-gray-600 mb-1">Drop Point</div>
                  <div>Shipment: {point.shipmentId}</div>
                  {point.status && <div>Status: {point.status}</div>}
                  {point.address && <div className="mt-1 text-xs">{point.address}</div>}
                </div>
              </Popup>
            </Marker>
          ));
        })}
      </MapContainer>

      {/* Map legend */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000] max-w-[220px]">
        <h3 className="font-semibold text-sm mb-2">Rider Status</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Offline</span>
          </div>
          <div className="mt-2 pt-2 border-t text-[11px] text-gray-600">
            Route lines and drop points are color-coded per rider.
          </div>
        </div>
      </div>
    </div>
  );
}

export default withChartErrorBoundary(LiveTrackingMap, {
  componentName: 'LiveTrackingMap'
});