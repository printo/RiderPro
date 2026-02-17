import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Navigation, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GPSLocationDisplayProps {
  latitude?: number;
  longitude?: number;
  start_latitude?: number;
  start_longitude?: number;
  stop_latitude?: number;
  stop_longitude?: number;
  km_travelled?: number;
  show_directions?: boolean;
  /** When coords are missing, show this address and note that they are added when starting a route */
  address_display?: string;
  className?: string;
}

export default function GPSLocationDisplay({
  latitude,
  longitude,
  start_latitude,
  start_longitude,
  stop_latitude,
  stop_longitude,
  km_travelled,
  show_directions = true,
  address_display,
  className
}: GPSLocationDisplayProps) {
  const { toast } = useToast();

  const handleCopyCoordinates = () => {
    if (latitude && longitude) {
      const coordinates = `${latitude},${longitude}`;
      navigator.clipboard.writeText(coordinates);
      toast({
        title: "Coordinates copied!",
        description: `${coordinates} copied to clipboard`,
      });
    }
  };

  const handleOpenDirections = (service: 'google' | 'apple' | 'waze' = 'google') => {
    if (!latitude || !longitude) return;

    const urls = {
      google: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
      apple: `https://maps.apple.com/?daddr=${latitude},${longitude}`,
      waze: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
    };

    window.open(urls[service], '_blank');
  };

  if (!latitude || !longitude) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-1">
          <p>GPS coordinates not available for this shipment.</p>
          {address_display && (
            <p className="text-xs mt-2 text-muted-foreground">
              Address: {address_display}
            </p>
          )}
          <p className="text-xs mt-1 text-muted-foreground">
            Coordinates are added when you start a route from the Dashboard (address is geocoded).
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">GPS Location</span>
        </div>
        {show_directions && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCoordinates}
              className="h-8 px-3 text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDirections('google')}
              className="h-8 px-3 text-xs"
            >
              <Navigation className="h-3 w-3 mr-1" />
              Directions
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Latitude:</span> {latitude.toFixed(6)}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Longitude:</span> {longitude.toFixed(6)}
        </p>
      </div>

      {start_latitude && start_longitude && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Start Location:</span>{' '}
            <span className="font-mono">{start_latitude.toFixed(6)}, {start_longitude.toFixed(6)}</span>
          </p>
        </div>
      )}

      {stop_latitude && stop_longitude && (
        <div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Stop Location:</span>{' '}
            <span className="font-mono">{stop_latitude.toFixed(6)}, {stop_longitude.toFixed(6)}</span>
          </p>
        </div>
      )}

      {km_travelled && km_travelled > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Distance Travelled:</span> {km_travelled.toFixed(2)} km
          </p>
        </div>
      )}
    </div>
  );
}
