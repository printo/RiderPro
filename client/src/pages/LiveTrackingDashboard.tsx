import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withPageErrorBoundary } from '@/components/ErrorBoundary';
import {
  MapPin,
  Users,
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import LiveTrackingMap from '@/components/tracking/LiveTrackingMap';
import RiderStatusPanel from '@/components/ui/status/RiderStatusPanel';
import { useLiveTracking } from '@/hooks/useLiveTracking';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

function LiveTrackingDashboard() {
  const [selectedRider, setSelectedRider] = useState<string | undefined>();
  const [showRoutes, setShowRoutes] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>();

  const {
    riders,
    connectionStatus,
    error,
    connect,
    disconnect,
    isConnected
  } = useLiveTracking();

  const handleRiderSelect = useCallback((riderId: string) => {
    setSelectedRider(prev => prev === riderId ? undefined : riderId);
  }, []);

  const handleCenterOnRider = useCallback((riderId: string) => {
    const rider = riders.find(r => r.employee_id === riderId);
    if (rider) {
      setMapCenter([rider.latitude, rider.longitude]);
      setSelectedRider(riderId);
    }
  }, [riders]);

  const handleReconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 1000);
  }, [connect, disconnect]);

  const getConnectionStatusBadge = () => {
    const isConnected = connectionStatus === 'connected';
    const isPending = connectionStatus === 'connecting';
    const hasError = connectionStatus === 'error';

    return (
      <ConnectionStatus
        type="live-tracking"
        isConnected={isConnected}
        isPending={isPending}
        hasError={hasError}
        variant="badge"
      />
    );
  };

  const activeRiders = riders.filter(r => r.status === 'active');
  const totalRiders = riders.length;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6 text-blue-600" />
              Live Tracking Dashboard
            </h1>

            <div className="flex items-center gap-3">
              {getConnectionStatusBadge()}

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>{activeRiders.length} active of {totalRiders} total</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRoutes(!showRoutes)}
            >
              {showRoutes ? 'Hide Routes' : 'Show Routes'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={connectionStatus === 'connecting'}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
              Reconnect
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mx-6 mt-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={handleReconnect}
              className="ml-2 p-0 h-auto text-red-800 underline"
            >
              Try reconnecting
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-6 min-h-0">
        {/* Sidebar - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="w-80 flex-shrink-0">
            <RiderStatusPanel
              riders={riders}
              selectedRider={selectedRider}
              onRiderSelect={handleRiderSelect}
              onCenterOnRider={handleCenterOnRider}
            />
          </div>
        )}

        {/* Map */}
        <div className="flex-1 min-h-0">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              {riders.length > 0 ? (
                <LiveTrackingMap
                  riders={riders}
                  selectedRider={selectedRider}
                  onRiderSelect={handleRiderSelect}
                  showRoutes={showRoutes}
                  center={mapCenter}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">
                      No Active Riders
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {!isConnected
                        ? 'Connect to see live rider locations'
                        : 'Riders will appear here when they start route tracking'
                      }
                    </p>
                    {!isConnected && (
                      <Button onClick={connect} variant="outline">
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-white border-t px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-6">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span>Active sessions: {activeRiders.length}</span>
            <span>Total riders: {totalRiders}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Real-time updates</span>
            <ConnectionStatus
              type="live-tracking"
              isConnected={isConnected}
              variant="inline"
              showLabel={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
} export
  default withPageErrorBoundary(LiveTrackingDashboard, 'Live Tracking Dashboard');