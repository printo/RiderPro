import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
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
  employeeId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
  status: 'active' | 'idle' | 'offline';
  employeeName?: string;
  route?: Array<{ lat: number; lng: number }>;
}

interface LiveTrackingMapProps {
  riders: RiderLocation[];
  selectedRider?: string;
  onRiderSelect?: (riderId: string) => void;
  showRoutes?: boolean;
  center?: [number, number];
  zoom?: number;
}

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
      const rider = riders.find(r => r.employeeId === selectedRider);
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
            key={rider.employeeId}
            position={[rider.latitude, rider.longitude]}
            icon={createRiderIcon(rider.status)}
            eventHandlers={{
              click: () => onRiderSelect?.(rider.employeeId)
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <div className="font-semibold text-lg mb-2">
                  {rider.employeeName || `Employee ${rider.employeeId}`}
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
                  onClick={() => onRiderSelect?.(rider.employeeId)}
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

          return (
            <Polyline
              key={`route-${rider.employeeId}`}
              positions={rider.route.map(point => [point.lat, point.lng])}
              color={rider.status === 'active' ? '#22c55e' : '#6b7280'}
              weight={3}
              opacity={0.7}
            />
          );
        })}
      </MapContainer>

      {/* Map legend */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
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
        </div>
      </div>
    </div>
  );
}

export default withChartErrorBoundary(LiveTrackingMap, {
  componentName: 'LiveTrackingMap'
});