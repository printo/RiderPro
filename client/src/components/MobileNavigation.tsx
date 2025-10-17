import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '@/types/User';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import '../styles/mobile.css';

interface NavigationItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

interface MobileNavigationProps {
  className?: string;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  className = ''
}) => {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeRiders, setActiveRiders] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { user, logout } = useAuth();

  const mobileOptimization = useMobileOptimization({
    enableGestures: true
  });

  const navigationItems: NavigationItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: '🏠'
    },
    {
      path: '/shipments',
      label: 'Shipments',
      icon: '📦'
    },
    {
      path: '/live-tracking',
      label: 'Live Tracking',
      icon: '🗺️',
      badge: activeRiders
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: '⚙️'
    },
    ...(user?.role === UserRole.ADMIN ? [{
      path: '/admin',
      label: 'Admin',
      icon: '⚙️'
    }] : []),
    {
      path: '/route-visualization',
      label: 'Routes',
      icon: '🛣️'
    }
  ];

  // Register gesture callbacks for navigation
  useEffect(() => {
    mobileOptimization.registerGestureCallbacks({
      onSwipe: (gesture) => {
        if (gesture.direction === 'right' && gesture.startX < 50) {
          // Swipe from left edge to open menu
          setIsMenuOpen(true);
        } else if (gesture.direction === 'left' && isMenuOpen) {
          // Swipe left to close menu
          setIsMenuOpen(false);
        }
      }
    });
  }, [mobileOptimization, isMenuOpen]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  // Real-time data updates from WebSocket or API
  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        // Fetch active riders count
        const ridersResponse = await fetch('/api/riders/active-count');
        const ridersData = await ridersResponse.json();
        if (ridersData.success) {
          setActiveRiders(ridersData.count);
        }

        // Fetch unread notifications
        const notificationsResponse = await fetch('/api/notifications/unread-count');
        const notificationsData = await notificationsResponse.json();
        if (notificationsData.success) {
          setUnreadNotifications(notificationsData.count);
        }
      } catch (error) {
        console.error('Failed to fetch real-time data:', error);
      }
    };

    // Fetch initial data
    fetchRealTimeData();

    // Set up polling for real-time updates
    const interval = setInterval(fetchRealTimeData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    console.log('Logout button clicked');
    try {
      logout();
      console.log('Redirecting to login page...');
      // Use window.location to ensure a full page reload
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // In case of any error, still try to redirect to login page
      window.location.href = '/login';
    }
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);

    // Provide haptic feedback
    mobileOptimization.vibrate(50);
  };

  const handleNavItemClick = (path: string) => {
    setIsMenuOpen(false);

    // Provide haptic feedback
    mobileOptimization.vibrate(30);
  };

  const isActive = (path: string): boolean => {
    if (path === '/dashboard' && (location === '/' || location === '/dashboard')) {
      return true;
    }
    return location === path;
  };

  // Desktop/tablet navigation (horizontal)
  if (mobileOptimization.deviceCapabilities.screenSize !== 'small') {
    return (
      <nav className={`desktop-navigation ${className}`}>
        <div className="nav-container">
          <div className="nav-brand">
            <h1>RiderPro</h1>
          </div>

          <div className="nav-items">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </Link>
            ))}
          </div>

          <div className="nav-status">
            {!mobileOptimization.networkInfo.isOnline && (
              <div className="status-indicator offline">
                📶 Offline
              </div>
            )}
            {unreadNotifications > 0 && (
              <div className="notification-indicator">
                🔔 {unreadNotifications}
              </div>
            )}
          </div>
        </div>
      </nav>
    );
  }

  // Mobile navigation (bottom tabs + hamburger menu)
  return (
    <>
      {/* Top Header */}
      <header className={`mobile-header ${className}`}>
        <button
          className="menu-toggle"
          onClick={handleMenuToggle}
          aria-label="Toggle menu"
        >
          <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        <div className="header-title">
          <h1>RiderPro</h1>
        </div>

        <div className="header-actions">
          {!mobileOptimization.networkInfo.isOnline && (
            <div className="status-indicator offline" title="Offline">
              📶
            </div>
          )}
          {unreadNotifications > 0 && (
            <div className="notification-indicator" title={`${unreadNotifications} notifications`}>
              🔔
              <span className="notification-count">{unreadNotifications}</span>
            </div>
          )}
          {mobileOptimization.batteryInfo.level !== null &&
            mobileOptimization.batteryInfo.level < 0.2 && (
              <div className="battery-indicator low" title="Low battery">
                🔋
              </div>
            )}
        </div>
      </header>

      {/* Slide-out Menu */}
      <div className={`mobile-menu-overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)} />

      <nav className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <h2>Navigation</h2>
          <button
            className="menu-close"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="menu-items">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`menu-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => handleNavItemClick(item.path)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="menu-badge">{item.badge}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="menu-footer">
          <div className="device-info">
            <div className="info-item">
              <span>Connection:</span>
              <span className={mobileOptimization.networkInfo.isOnline ? 'online' : 'offline'}>
                {mobileOptimization.networkInfo.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {mobileOptimization.batteryInfo.level !== null && (
              <div className="info-item">
                <span>Battery:</span>
                <span className={mobileOptimization.batteryInfo.level < 0.2 ? 'low' : 'normal'}>
                  {Math.round(mobileOptimization.batteryInfo.level * 100)}%
                </span>
              </div>
            )}
            <div className="info-item">
              <span>Orientation:</span>
              <span>{mobileOptimization.orientation}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Tab Navigation */}
      <nav className="bottom-navigation">
        <div className="bottom-nav-container">
          {navigationItems.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => handleNavItemClick(item.path)}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="bottom-nav-badge">{item.badge}</span>
              )}
            </Link>
          ))}

          {/* More button for additional items */}
          <button
            className={`bottom-nav-item more-button ${isMenuOpen ? 'active' : ''}`}
            onClick={handleMenuToggle}
          >
            <span className="bottom-nav-icon">⋯</span>
            <span className="bottom-nav-label">More</span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default withComponentErrorBoundary(MobileNavigation, {
  componentVariant: 'inline',
  componentName: 'MobileNavigation'
});