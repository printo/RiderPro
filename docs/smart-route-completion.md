# Smart Route Completion

The Smart Route Completion feature automatically detects when a driver returns to their starting location and prompts them to complete their route. This helps ensure accurate route tracking and reduces the need for manual route completion.

## Features

### Geofencing Detection
- **Automatic Detection**: Uses GPS coordinates to detect when the driver returns to within a configurable radius of the starting position
- **Configurable Radius**: Set detection radius from 25m to 500m (default: 100m)
- **Real-time Monitoring**: Continuously monitors GPS position during active route sessions

### Smart Completion Logic
- **Minimum Session Duration**: Prevents accidental completion for very short routes (configurable: 5-60 minutes)
- **Minimum Distance Requirement**: Optional requirement to travel a minimum distance before allowing completion
- **Condition Validation**: Ensures all completion criteria are met before triggering

### User Experience
- **Popup Confirmation**: Shows a dialog when completion conditions are met
- **Auto-completion**: Configurable countdown timer (15-120 seconds) for automatic completion
- **Manual Override**: Users can confirm immediately or cancel the completion
- **Visual Indicators**: Shows distance from start and completion zone status

## Components

### Core Components

#### `useSmartRouteCompletion` Hook
The main hook that manages smart completion logic.

```typescript
const smartCompletion = useSmartRouteCompletion({
  sessionId: 'current-session-id',
  startPosition: { latitude: 40.7128, longitude: -74.0060, timestamp: '...', accuracy: 10 },
  currentPosition: { latitude: 40.7129, longitude: -74.0061, timestamp: '...', accuracy: 8 },
  sessionStartTime: new Date(),
  totalDistance: 5.2, // km
  shipmentsCompleted: 3,
  config: {
    enabled: true,
    radius: 100, // meters
    minSessionDuration: 300, // seconds
    autoConfirmDelay: 30, // seconds
    requireMinDistance: true,
    minDistanceKm: 0.5
  },
  onRouteCompletionDetected: (data) => console.log('Completion detected:', data),
  onRouteCompleted: () => console.log('Route completed')
});
```

#### `RouteCompletionDialog` Component
Modal dialog that appears when completion is detected.

```typescript
<RouteCompletionDialog
  isOpen={smartCompletion.showCompletionDialog}
  onClose={smartCompletion.handleCompletionCancel}
  onConfirm={smartCompletion.handleRouteCompletion}
  onCancel={smartCompletion.handleCompletionCancel}
  data={smartCompletion.completionData}
  autoConfirmSeconds={30}
/>
```

#### `SmartCompletionSettings` Component
Configuration interface for smart completion settings.

```typescript
<SmartCompletionSettings
  config={smartCompletion.config}
  onConfigChange={smartCompletion.updateConfig}
  isActive={sessionActive}
  currentDistance={smartCompletion.distanceFromStart}
/>
```

#### `GeofencingService` Class
Core service for geofence management and distance calculations.

```typescript
const geofencingService = new GeofencingService();

// Create a completion geofence
const geofenceId = geofencingService.createRouteCompletionGeofence(
  startPosition,
  100, // radius in meters
  'Route Completion Zone'
);

// Listen for events
geofencingService.addEventListener(geofenceId, (event) => {
  if (event.type === 'enter') {
    console.log('Entered completion zone');
  }
});
```

## Configuration Options

### SmartCompletionConfig Interface

```typescript
interface SmartCompletionConfig {
  enabled: boolean;                // Enable/disable smart completion
  radius: number;                  // Detection radius in meters (25-500)
  minSessionDuration: number;      // Minimum session duration in seconds
  autoConfirmDelay: number;        // Auto-confirm countdown in seconds
  requireMinDistance: boolean;     // Require minimum distance traveled
  minDistanceKm: number;          // Minimum distance in kilometers
}
```

### Preset Configurations

#### Precise Mode
- **Radius**: 50m
- **Min Duration**: 5 minutes
- **Auto-confirm**: 15 seconds
- **Min Distance**: 200m required
- **Use Case**: Urban deliveries with precise location requirements

#### Balanced Mode (Default)
- **Radius**: 100m
- **Min Duration**: 10 minutes
- **Auto-confirm**: 30 seconds
- **Min Distance**: 500m required
- **Use Case**: General delivery routes

#### Relaxed Mode
- **Radius**: 200m
- **Min Duration**: 5 minutes
- **Auto-confirm**: 60 seconds
- **Min Distance**: Not required
- **Use Case**: Rural or less precise location requirements

## Integration Guide

### Basic Integration

1. **Add the hook to your route component**:
```typescript
import { useSmartRouteCompletion } from '@/hooks/useSmartRouteCompletion';

const smartCompletion = useSmartRouteCompletion({
  sessionId: currentSession?.id,
  startPosition: currentSession?.startPosition,
  currentPosition: gpsTracker.currentPosition,
  sessionStartTime: currentSession?.startTime,
  totalDistance: routeMetrics.totalDistance,
  shipmentsCompleted: completedShipments.length,
  onRouteCompleted: handleRouteCompletion
});
```

2. **Add the completion dialog**:
```typescript
{smartCompletion.showCompletionDialog && smartCompletion.completionData && (
  <RouteCompletionDialog
    isOpen={smartCompletion.showCompletionDialog}
    onClose={smartCompletion.handleCompletionCancel}
    onConfirm={smartCompletion.handleRouteCompletion}
    onCancel={smartCompletion.handleCompletionCancel}
    data={smartCompletion.completionData}
  />
)}
```

3. **Add visual indicators**:
```typescript
{smartCompletion.isInCompletionZone && (
  <Badge className="bg-green-100 text-green-800">
    <Target className="h-3 w-3 mr-1" />
    Near Start ({Math.round(smartCompletion.distanceFromStart)}m)
  </Badge>
)}
```

### Advanced Integration

#### Custom Configuration
```typescript
const [config, setConfig] = useState({
  enabled: true,
  radius: 150,
  minSessionDuration: 600, // 10 minutes
  autoConfirmDelay: 45,
  requireMinDistance: true,
  minDistanceKm: 1.0
});

const smartCompletion = useSmartRouteCompletion({
  // ... other props
  config,
  onRouteCompletionDetected: (data) => {
    // Custom logic when completion is detected
    analytics.track('route_completion_detected', {
      sessionId: data.sessionId,
      distance: data.distanceFromStart,
      duration: data.sessionDuration
    });
  }
});
```

#### Settings Interface
```typescript
const [showSettings, setShowSettings] = useState(false);

// Add settings button
<Button onClick={() => setShowSettings(true)}>
  <Settings className="h-4 w-4" />
</Button>

// Add settings modal/panel
{showSettings && (
  <SmartCompletionSettings
    config={smartCompletion.config}
    onConfigChange={(updates) => {
      smartCompletion.updateConfig(updates);
      // Optionally save to localStorage or API
      localStorage.setItem('smartCompletionConfig', JSON.stringify({
        ...smartCompletion.config,
        ...updates
      }));
    }}
    isActive={sessionActive}
    currentDistance={smartCompletion.distanceFromStart}
  />
)}
```

## Technical Details

### Geofencing Algorithm
- Uses the **Haversine formula** for accurate distance calculations
- Accounts for Earth's curvature for precise GPS measurements
- Optimized for frequent position updates (every 30 seconds)

### Performance Considerations
- **Efficient Calculations**: Distance calculations are optimized for real-time use
- **Memory Management**: Automatic cleanup of geofences when sessions end
- **Battery Optimization**: Works with existing GPS tracking intervals

### Error Handling
- **GPS Failures**: Graceful degradation when GPS is unavailable
- **Permission Issues**: Continues normal operation if location access is denied
- **Network Issues**: Works offline with cached position data

## Testing

### Unit Tests
```bash
npm test SmartRouteCompletion.test.tsx
```

### Integration Testing
```typescript
// Test completion detection
const mockPosition = { latitude: 40.7128, longitude: -74.0060, timestamp: '...', accuracy: 10 };
geofencingService.updatePosition(mockPosition);
expect(completionCallback).toHaveBeenCalled();

// Test configuration changes
smartCompletion.updateConfig({ radius: 150 });
expect(smartCompletion.config.radius).toBe(150);
```

### Manual Testing
1. Start a route session
2. Move away from starting location (> configured radius)
3. Return to starting location (within configured radius)
4. Verify completion dialog appears
5. Test auto-completion countdown
6. Test manual confirmation and cancellation

## Troubleshooting

### Common Issues

#### Completion Not Detected
- **Check GPS accuracy**: Ensure GPS has sufficient accuracy (< 20m)
- **Verify radius**: Increase detection radius if needed
- **Check session duration**: Ensure minimum duration requirements are met
- **Validate distance**: Check if minimum distance requirement is satisfied

#### False Positives
- **Reduce radius**: Use smaller detection radius (50-75m)
- **Increase minimum duration**: Require longer session before allowing completion
- **Add distance requirement**: Ensure minimum travel distance

#### Performance Issues
- **Reduce update frequency**: Increase GPS tracking interval
- **Optimize geofence count**: Limit number of active geofences
- **Check memory usage**: Monitor for memory leaks in long sessions

### Debug Information
```typescript
// Enable debug logging
console.log('Smart Completion Status:', {
  enabled: smartCompletion.isEnabled,
  inZone: smartCompletion.isInCompletionZone,
  distance: smartCompletion.distanceFromStart,
  config: smartCompletion.config
});

// Check geofence status
const status = smartCompletion.getStatus();
console.log('Geofence Status:', status);
```

## Future Enhancements

### Planned Features
- **Multiple Completion Zones**: Support for multiple valid completion locations
- **Route Optimization**: Suggest optimal return routes
- **Historical Analysis**: Learn from completion patterns
- **Integration with Navigation**: Work with turn-by-turn navigation apps

### API Extensions
- **Webhook Support**: Notify external systems of route completions
- **Analytics Integration**: Enhanced metrics and reporting
- **Custom Validation**: Pluggable validation logic for completion criteria

## Requirements Satisfied

This implementation satisfies **Requirement 1.2** from the route tracking specification:

> "IF the system detects that the rider has returned to the starting position (or close to it), THEN it SHALL prompt the rider with a popup asking if they want to stop the GPS tracking, with an option to either confirm or cancel the stop."

### Key Features Implemented:
- ✅ **Geofencing logic** to detect return to starting position
- ✅ **Popup confirmation dialog** for automatic route completion  
- ✅ **Distance-based detection** with configurable radius
- ✅ **Confirm/cancel options** in the completion dialog
- ✅ **Configurable settings** for different use cases
- ✅ **Real-time monitoring** during active route sessions