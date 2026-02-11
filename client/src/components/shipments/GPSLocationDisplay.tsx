import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Navigation, Copy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GPSLocationDisplayProps {
  latitude?: number;
  longitude?: number;
  startLatitude?: number;
  startLongitude?: number;
  stopLatitude?: number;
  stopLongitude?: number;
  kmTravelled?: number;
  showDirections?: boolean;
  /** When coords are missing, show this address and note that they are added when starting a route */
  addressDisplay?: string;
  className?: string;
}

export default function GPSLocationDisplay({
  latitude,
  longitude,
  startLatitude,
  startLongitude,
  stopLatitude,
  stopLongitude,
  kmTravelled,
  showDirections = true,
  addressDisplay,
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
          {addressDisplay && (
            <p className="text-xs mt-2 text-muted-foreground">
              Address: {addressDisplay}
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
        {showDirections && (
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

      {startLatitude && startLongitude && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Start Location:</span>{' '}
            <span className="font-mono">{startLatitude.toFixed(6)}, {startLongitude.toFixed(6)}</span>
          </p>
        </div>
      )}

      {stopLatitude && stopLongitude && (
        <div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Stop Location:</span>{' '}
            <span className="font-mono">{stopLatitude.toFixed(6)}, {stopLongitude.toFixed(6)}</span>
          </p>
        </div>
      )}

      {kmTravelled && kmTravelled > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Distance Travelled:</span> {kmTravelled.toFixed(2)} km
          </p>
        </div>
      )}
    </div>
  );
}

