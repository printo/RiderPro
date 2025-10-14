import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../styles/mobile.css';

interface RiderLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'paused' | 'offline';
  lastUpdate: string;
  accuracy?: number;
  speed?: number;
  sessionId?: string;
}

interface MobileLiveTrackingProps {
  className?: string;
}

// Custom hook for map interactions
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({
  center,
  zoom
}) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);

  return null;
};

export const MobileLiveTracking: React.FC<MobileLiveTrackingProps> = ({
  className = ''
}) => {
  const [riders, setRiders] = useState<RiderLocation[]>([]);
  const [selectedRider, setSelectedRider] = useState<RiderLocation | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.006]);
  const [mapZoom, setMapZoom] = useState(13);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoCenter, setAutoCenter] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Custom marker icons
  const createRiderIcon = (status: string, isSelected = false) => {
    const colors = {
      active: '#10b981',
      paused: '#f59e0b',
      offline: '#6b7280'
    };

    const size = isSelected ? 40 : 30;
    const color = colors[status as keyof typeof colors] || colors.offline;

    return L.divIcon({
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${size * 0.4}px;
          color: white;
          font-weight: bold;
        ">
          ${status === 'active' ? '🚚' : status === 'paused' ? '⏸️' : '📍'}
        </div>
      `,
      className: 'custom-rider-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  };

  // WebSocket connection management
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-tracking`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setError(null);

      // Subscribe to all rider updates
      wsRef.current?.send(JSON.stringify({ type: 'subscribe_all' }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection lost. Attempting to reconnect...');
    };
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'location_update':
        updateRiderLocation(data);
        break;
      case 'rider_status':
        updateRiderStatus(data);
        break;
      case 'riders_list':
        setRiders(data.riders || []);
        setLoading(false);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }

    setLastUpdate(new Date());
  };

  const updateRiderLocation = (data: any) => {
    setRiders((prev) => {
      const updated = prev.map((rider) =>
        rider.id === data.employeeId
          ? {
            ...rider,
            latitude: data.latitude,
            longitude: data.longitude,
            lastUpdate: data.timestamp,
            accuracy: data.accuracy,
            speed: data.speed,
            status: 'active' as const
          }
          : rider
      );

      if (!updated.find((r) => r.id === data.employeeId)) {
        updated.push({
          id: data.employeeId,
          name: data.employeeId,
          latitude: data.latitude,
          longitude: data.longitude,
          status: 'active',
          lastUpdate: data.timestamp,
          accuracy: data.accuracy,
          speed: data.speed,
          sessionId: data.sessionId
        });
      }

      return updated;
    });
  };

  const updateRiderStatus = (data: any) => {
    setRiders((prev) =>
      prev.map((rider) =>
        rider.id === data.employeeId
          ? { ...rider, status: data.status, lastUpdate: data.timestamp }
          : rider
      )
    );
  };

  // Auto-center map on riders
  const centerMapOnRiders = () => {
    if (riders.length === 0) return;

    if (riders.length === 1) {
      const rider = riders[0];
      setMapCenter([rider.latitude, rider.longitude]);
      setMapZoom(15);
    } else {
      const lats = riders.map((r) => r.latitude);
      const lngs = riders.map((r) => r.longitude);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      setMapCenter([centerLat, centerLng]);

      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);

      let zoom = 13;
      if (maxDiff > 0.1) zoom = 10;
      else if (maxDiff > 0.05) zoom = 11;
      else if (maxDiff > 0.01) zoom = 12;
      else zoom = 14;

      setMapZoom(zoom);
    }
  };

  const focusOnRider = (rider: RiderLocation) => {
    setSelectedRider(rider);
    setMapCenter([rider.latitude, rider.longitude]);
    setMapZoom(16);
    setAutoCenter(false);
    setPanelExpanded(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'paused':
        return '#f59e0b';
      case 'offline':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active':
        return '🟢';
      case 'paused':
        return '🟡';
      case 'offline':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const formatLastUpdate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, []);

  // Auto-center when riders change
  useEffect(() => {
    if (autoCenter && riders.length > 0) centerMapOnRiders();
  }, [riders, autoCenter]);

  // Periodic status updates
  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      setRiders((prev) =>
        prev.map((rider) => {
          const lastUpdateTime = new Date(rider.lastUpdate).getTime();
          const now = Date.now();
          const diffMins = (now - lastUpdateTime) / 60000;

          return {
            ...rider,
            status: diffMins > 5 ? 'offline' : rider.status
          };
        })
      );
    }, 30000);

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className={`live-tracking-container ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Connecting to live tracking...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`live-tracking-container ${className}`}>
      {/* Header */}
      <div className="tracking-header">
        <div className="header-content">
          <h2>Live Tracking</h2>
          <div className="header-controls">
            <div className="status-indicator">
              <span className={`connection-dot ${error ? 'offline' : 'online'}`} />
              <span className="rider-count">{riders.length} riders</span>
            </div>
            <button
              className="center-btn"
              onClick={() => {
                setAutoCenter(true);
                centerMapOnRiders();
              }}
            >
              🎯
            </button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="last-update">
          Last update: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Map */}
      <div className="tracking-map">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          zoomControl
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <MapController center={mapCenter} zoom={mapZoom} />

          {riders.map((rider) => (
            <Marker
              key={rider.id}
              position={[rider.latitude, rider.longitude]}
              icon={createRiderIcon(rider.status, selectedRider?.id === rider.id)}
              eventHandlers={{ click: () => focusOnRider(rider) }}
            >
              <Popup>
                <div className="rider-popup">
                  <h4>{rider.name}</h4>
                  <div className="popup-status">
                    {getStatusIcon(rider.status)} {rider.status}
                  </div>
                  <div className="popup-details">
                    <div>Last update: {formatLastUpdate(rider.lastUpdate)}</div>
                    {rider.speed && (
                      <div>Speed: {Math.round(rider.speed * 3.6)} km/h</div>
                    )}
                    {rider.accuracy && (
                      <div>Accuracy: {Math.round(rider.accuracy)}m</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Rider Panel */}
      <div className={`rider-panel ${panelExpanded ? 'expanded' : ''}`}>
        <div
          className="panel-handle"
          onClick={() => setPanelExpanded(!panelExpanded)}
        />
        <div className="panel-header">
          <h3>Active Riders ({riders.filter((r) => r.status === 'active').length})</h3>
        </div>

        <div className="rider-list">
          {riders.map((rider) => (
            <div
              key={rider.id}
              className={`rider-item ${selectedRider?.id === rider.id ? 'selected' : ''}`}
              onClick={() => focusOnRider(rider)}
            >
              <div className="rider-avatar">{rider.name.charAt(0).toUpperCase()}</div>

              <div className="rider-info">
                <div className="rider-name">{rider.name}</div>
                <div className="rider-status">
                  <span
                    className="status-dot"
                    style={{ backgroundColor: getStatusColor(rider.status) }}
                  />
                  {rider.status} • {formatLastUpdate(rider.lastUpdate)}
                </div>
                {rider.speed && (
                  <div className="rider-speed">
                    {Math.round(rider.speed * 3.6)} km/h
                  </div>
                )}
              </div>

              <button
                className="rider-location-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  focusOnRider(rider);
                }}
              >
                📍
              </button>
            </div>
          ))}

          {riders.length === 0 && (
            <div className="empty-riders">
              <div className="empty-icon">🚚</div>
              <p>No active riders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileLiveTracking;
