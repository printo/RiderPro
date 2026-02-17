import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useMobileOptimization } from '../hooks/useMobileOptimization';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '@shared/types';
import { isManagerUser } from '@/lib/roles';
import { withComponentErrorBoundary } from '@/components/ErrorBoundary';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
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
  const { user } = useAuth();
  const hasManagerAccess = isManagerUser(user);

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
      path: '/settings',
      label: 'Settings',
      icon: '⚙️'
    },
    ...(user?.role === UserRole.ADMIN ? [{
      path: '/admin-dashboard',
      label: 'Admin',
      icon: '⚙️'
    }] : []),
    ...(hasManagerAccess ? [{
      path: '/route-visualization',
      label: 'Routes',
      icon: '🛣️'
    }, {
      path: '/live-tracking',
      label: 'Live Tracking',
      icon: '🗺️',
      badge: activeRiders
    }] : [])
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

  // Mock data updates (in real app, this would come from WebSocket or API)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate active riders count
      setActiveRiders(Math.floor(Math.random() * 5) + 1);

      // Simulate notifications
      setUnreadNotifications(Math.floor(Math.random() * 3));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);

    // Provide haptic feedback
    mobileOptimization.vibrate(50);
  };

  const handleNavItemClick = () => {
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
          <div className="nav-brand flex items-center gap-2">
            <img src="/favicon.png" alt="RiderPro Logo" className="h-8 w-8 rounded-md" />
            <h1 className="text-lg font-bold">RiderPro</h1>
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
            <ConnectionStatus
              type="local"
              isConnected={mobileOptimization.networkInfo.isOnline}
              variant="compact"
              showLabel={true}
              className="text-sm"
            />
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

        <div className="header-title flex items-center gap-2">
          <img src="/favicon.png" alt="RiderPro Logo" className="h-6 w-6 rounded-sm" />
          <h1 className="text-base font-bold">RiderPro</h1>
        </div>

        <div className="header-actions">
          <ConnectionStatus
            type="local"
            isConnected={mobileOptimization.networkInfo.isOnline}
            variant="inline"
            showLabel={false}
            className="status-indicator"
          />
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
              onClick={handleNavItemClick}
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
              <ConnectionStatus
                type="local"
                isConnected={mobileOptimization.networkInfo.isOnline}
                variant="compact"
                showLabel={true}
                className="text-xs"
              />
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
              onClick={handleNavItemClick}
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