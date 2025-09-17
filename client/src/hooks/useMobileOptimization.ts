import { useState, useEffect, useRef, useCallback } from 'react';

interface DeviceCapabilities {
  hasTouch: boolean;
  hasVibration: boolean;
  hasGeolocation: boolean;
  hasOrientation: boolean;
  hasNetworkInfo: boolean;
  hasBattery: boolean;
  isStandalone: boolean;
  pixelRatio: number;
  screenSize: 'small' | 'medium' | 'large';
}

interface NetworkInfo {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface BatteryInfo {
  level: number | null;
  charging: boolean | null;
  chargingTime: number | null;
  dischargingTime: number | null;
}

interface TouchGesture {
  type: 'tap' | 'longpress' | 'swipe' | 'pinch';
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  duration: number;
  distance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface UseMobileOptimizationOptions {
  enableGestures?: boolean;
  enableBatteryMonitoring?: boolean;
  enableNetworkMonitoring?: boolean;
  enableOrientationLock?: boolean;
  longPressDelay?: number;
  swipeThreshold?: number;
}

export const useMobileOptimization = (options: UseMobileOptimizationOptions = {}) => {
  const {
    enableGestures = true,
    enableBatteryMonitoring = true,
    enableNetworkMonitoring = true,
    enableOrientationLock = false,
    longPressDelay = 800,
    swipeThreshold = 50,
  } = options;

  const [deviceCapabilities, setDeviceCapabilities] = useState<DeviceCapabilities>({
    hasTouch: false,
    hasVibration: false,
    hasGeolocation: false,
    hasOrientation: false,
    hasNetworkInfo: false,
    hasBattery: false,
    isStandalone: false,
    pixelRatio: 1,
    screenSize: 'medium',
  });

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    isOnline: navigator.onLine,
  });

  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo>({
    level: null,
    charging: null,
    chargingTime: null,
    dischargingTime: null,
  });

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureCallbacksRef = useRef<{
    onTap?: (gesture: TouchGesture) => void;
    onLongPress?: (gesture: TouchGesture) => void;
    onSwipe?: (gesture: TouchGesture) => void;
    onPinch?: (gesture: TouchGesture) => void;
  }>({});

  /** Detect device capabilities */
  useEffect(() => {
    const capabilities: DeviceCapabilities = {
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasVibration: 'vibrate' in navigator,
      hasGeolocation: 'geolocation' in navigator,
      hasOrientation: 'orientation' in screen || 'mozOrientation' in screen,
      hasNetworkInfo:
        'connection' in navigator ||
        'mozConnection' in navigator ||
        'webkitConnection' in navigator,
      hasBattery: 'getBattery' in navigator,
      isStandalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true,
      pixelRatio: window.devicePixelRatio || 1,
      screenSize:
        window.innerWidth < 480 ? 'small' : window.innerWidth < 768 ? 'medium' : 'large',
    };

    setDeviceCapabilities(capabilities);
  }, []);

  /** Monitor network status */
  useEffect(() => {
    if (!enableNetworkMonitoring) return;

    const updateNetworkInfo = () => {
      const connection =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      setNetworkInfo({
        isOnline: navigator.onLine,
        connectionType: connection?.type,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
      });
    };

    const handleOnline = () => updateNetworkInfo();
    const handleOffline = () => updateNetworkInfo();
    const handleConnectionChange = () => updateNetworkInfo();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    updateNetworkInfo();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [enableNetworkMonitoring]);

  /** Monitor battery status */
  useEffect(() => {
    if (!enableBatteryMonitoring || !deviceCapabilities.hasBattery) return;

    const updateBatteryInfo = async () => {
      try {
        const battery = await (navigator as any).getBattery();

        const updateBattery = () => {
          setBatteryInfo({
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
          });
        };

        updateBattery();

        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
        battery.addEventListener('chargingtimechange', updateBattery);
        battery.addEventListener('dischargingtimechange', updateBattery);

        return () => {
          battery.removeEventListener('levelchange', updateBattery);
          battery.removeEventListener('chargingchange', updateBattery);
          battery.removeEventListener('chargingtimechange', updateBattery);
          battery.removeEventListener('dischargingtimechange', updateBattery);
        };
      } catch {
        console.log('Battery API not supported');
      }
    };

    updateBatteryInfo();
  }, [enableBatteryMonitoring, deviceCapabilities.hasBattery]);

  /** Monitor orientation changes */
  useEffect(() => {
    const updateOrientation = () => {
      const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      setOrientation(orientation);
    };

    const handleOrientationChange = () => {
      setTimeout(updateOrientation, 100); // delay for orientation change
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', updateOrientation);

    updateOrientation();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  /** Monitor accessibility preferences */
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const updateReducedMotion = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    const updateHighContrast = (e: MediaQueryListEvent) => setIsHighContrast(e.matches);

    setIsReducedMotion(reducedMotionQuery.matches);
    setIsHighContrast(highContrastQuery.matches);

    reducedMotionQuery.addEventListener('change', updateReducedMotion);
    highContrastQuery.addEventListener('change', updateHighContrast);

    return () => {
      reducedMotionQuery.removeEventListener('change', updateReducedMotion);
      highContrastQuery.removeEventListener('change', updateHighContrast);
    };
  }, []);

  /** Lock orientation if requested */
  useEffect(() => {
    if (!enableOrientationLock || !deviceCapabilities.hasOrientation) return;

    const lockOrientation = async () => {
      try {
        if (screen.orientation && 'lock' in screen.orientation) {
          await (screen.orientation as any).lock('portrait-primary');
        }
      } catch {
        console.log('Orientation lock not supported or failed');
      }
    };

    lockOrientation();
  }, [enableOrientationLock, deviceCapabilities.hasOrientation]);

  /** Touch gesture handlers */
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enableGestures || !deviceCapabilities.hasTouch) return;

      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      // Start long press timer
      longPressTimerRef.current = setTimeout(() => {
        if (touchStartRef.current && gestureCallbacksRef.current.onLongPress) {
          const gesture: TouchGesture = {
            type: 'longpress',
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            duration: Date.now() - touchStartRef.current.time,
          };
          gestureCallbacksRef.current.onLongPress(gesture);
        }
      }, longPressDelay);
    },
    [enableGestures, deviceCapabilities.hasTouch, longPressDelay],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enableGestures || !deviceCapabilities.hasTouch || !touchStartRef.current) return;

      // Clear long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const touch = e.changedTouches[0];
      const endTime = Date.now();
      const duration = endTime - touchStartRef.current.time;
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < 10 && duration < 300) {
        // Tap gesture
        if (gestureCallbacksRef.current.onTap) {
          const gesture: TouchGesture = {
            type: 'tap',
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touch.clientX,
            endY: touch.clientY,
            duration,
            distance,
          };
          gestureCallbacksRef.current.onTap(gesture);
        }
      } else if (distance > swipeThreshold) {
        // Swipe gesture
        if (gestureCallbacksRef.current.onSwipe) {
          let direction: 'up' | 'down' | 'left' | 'right';
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
          } else {
            direction = deltaY > 0 ? 'down' : 'up';
          }

          const gesture: TouchGesture = {
            type: 'swipe',
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touch.clientX,
            endY: touch.clientY,
            duration,
            distance,
            direction,
          };
          gestureCallbacksRef.current.onSwipe(gesture);
        }
      }

      touchStartRef.current = null;
    },
    [enableGestures, deviceCapabilities.hasTouch, swipeThreshold],
  );

  /** Utility functions */
  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (deviceCapabilities.hasVibration) {
        navigator.vibrate(pattern);
      }
    },
    [deviceCapabilities.hasVibration],
  );

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        return wakeLock;
      }
    } catch {
      console.log('Wake lock not supported or failed');
    }
    return null;
  }, []);

  const addToHomeScreen = useCallback(() => {
    // Typically triggered by beforeinstallprompt event
    console.log('Add to home screen functionality would be implemented here');
  }, []);

  const optimizeForBattery = useCallback(() => {
    if (batteryInfo.level !== null && batteryInfo.level < 0.2) {
      return {
        reduceAnimations: true,
        reducePollFrequency: true,
        disableNonEssentialFeatures: true,
        gpsTrackingInterval: 60000, // 1 minute
      };
    }
    return {
      reduceAnimations: false,
      reducePollFrequency: false,
      disableNonEssentialFeatures: false,
      gpsTrackingInterval: 30000, // 30 seconds
    };
  }, [batteryInfo.level]);

  const optimizeForNetwork = useCallback(() => {
    const isSlowConnection =
      networkInfo.effectiveType === 'slow-2g' ||
      networkInfo.effectiveType === '2g' ||
      (networkInfo.downlink && networkInfo.downlink < 0.5);

    return {
      useCompression: isSlowConnection,
      reducedImageQuality: isSlowConnection,
      batchRequests: isSlowConnection,
      prefetchDisabled: isSlowConnection,
    };
  }, [networkInfo]);

  /** Register gesture callbacks */
  const registerGestureCallbacks = useCallback(
    (callbacks: {
      onTap?: (gesture: TouchGesture) => void;
      onLongPress?: (gesture: TouchGesture) => void;
      onSwipe?: (gesture: TouchGesture) => void;
      onPinch?: (gesture: TouchGesture) => void;
    }) => {
      gestureCallbacksRef.current = callbacks;
    },
    [],
  );

  /** Attach touch event listeners */
  useEffect(() => {
    if (!enableGestures) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enableGestures, handleTouchStart, handleTouchEnd]);

  return {
    deviceCapabilities,
    networkInfo,
    batteryInfo,
    orientation,
    isReducedMotion,
    isHighContrast,
    vibrate,
    requestWakeLock,
    addToHomeScreen,
    optimizeForBattery,
    optimizeForNetwork,
    registerGestureCallbacks,
  };
};

export default useMobileOptimization;
