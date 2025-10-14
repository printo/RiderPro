import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";
import {
  Menu,
  BarChart3,
  List,
  Settings,
  Route,
  Map,
  Sun,
  Moon,
  LogOut,
  X
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      href: "/",
      icon: BarChart3,
      label: "Dashboard",
      testId: "menu-dashboard"
    },
    {
      href: "/shipments",
      icon: List,
      label: "Shipments",
      testId: "menu-shipments"
    },
    {
      href: "/route-analytics",
      icon: BarChart3,
      label: "Route Analytics",
      testId: "menu-route-analytics"
    },
    {
      href: "/route-visualization",
      icon: Map,
      label: "Route Visualization",
      testId: "menu-route-visualization"
    }
  ];

  // Admin menu items - only show for super admin users
  const adminMenuItems = user?.isSuperAdmin ? [
    {
      href: "/admin",
      icon: Settings,
      label: "Admin",
      testId: "menu-admin"
    }
  ] : [];

  // Settings menu item - available to all users
  const settingsMenuItem = {
    href: "/settings",
    icon: Settings,
    label: "Settings",
    testId: "menu-settings"
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
    setIsOpen(false);
  };

  const isActive = (path: string) => {
    if (path === "/" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === path;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-16 w-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105",
              "bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
              "border-2 border-white/20 backdrop-blur-sm",
              isOpen && "rotate-45"
            )}
            data-testid="button-floating-menu"
          >
            {isOpen ? <X className="h-6 w-6 text-white" /> : <Menu className="h-6 w-6 text-white" />}
          </Button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className={cn(
            "border border-border/50 bg-background shadow-2xl p-0 rounded-t-2xl ring-1 ring-border/20",
            // Mobile: full width with optimal height, Desktop: max width with right alignment and different height
            "w-full h-[70vh] sm:max-w-sm sm:ml-auto sm:mr-4 sm:h-[80vh]"
          )}
        >
          {/* Handle bar for visual indication */}
          <div className="flex justify-center py-3">
            <div className="w-8 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          <div className="px-4 pb-4 h-[calc(100%-28px)] flex flex-col overflow-hidden">
            {/* Profile Section */}
            <div className="flex items-center space-x-4 pb-6">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground text-xl font-bold shadow-md">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center shadow-sm">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-foreground truncate mb-1">
                  {user?.fullName || 'User'}
                </h3>
                <p className="text-sm text-primary font-medium capitalize">
                  {user?.role?.replace('_', ' ') || 'User'}
                </p>
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pb-4">
              {/* Navigation Menu */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Navigation
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {[...menuItems, ...adminMenuItems, settingsMenuItem].map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Button
                        key={item.href}
                        variant="ghost"
                        className={cn(
                          "h-14 flex items-center justify-start gap-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
                          "border border-transparent p-3 group",
                          active
                            ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-md border-blue-500/20"
                            : "hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:border-primary/20"
                        )}
                        onClick={() => handleNavigation(item.href)}
                        data-testid={item.testId}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0",
                          active
                            ? "bg-white/20 shadow-sm"
                            : "bg-gradient-to-br from-primary/10 to-primary/20 group-hover:from-primary/20 group-hover:to-primary/30 group-hover:shadow-sm"
                        )}>
                          <Icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            active ? "text-white" : "text-primary group-hover:text-primary/80"
                          )} />
                        </div>
                        <span className={cn(
                          "text-sm font-medium leading-tight transition-colors duration-200 flex-1",
                          active ? "text-white" : "text-foreground group-hover:text-foreground/80"
                        )}>
                          {item.label}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    className="h-14 flex items-center justify-start gap-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border border-transparent p-3 group hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:border-primary/20"
                    onClick={toggleTheme}
                    data-testid="button-theme-toggle"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/20 group-hover:from-primary/20 group-hover:to-primary/30 group-hover:shadow-sm transition-all duration-200 flex-shrink-0">
                      {theme === 'light' ?
                        <Moon className="h-4 w-4 text-primary group-hover:text-primary/80 transition-colors duration-200" /> :
                        <Sun className="h-4 w-4 text-primary group-hover:text-primary/80 transition-colors duration-200" />
                      }
                    </div>
                    <span className="text-sm font-medium text-foreground group-hover:text-foreground/80 leading-tight transition-colors duration-200 flex-1">
                      {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-14 flex items-center justify-start gap-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border border-transparent hover:border-red-200 group p-3 hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100"
                    data-testid="button-logout"
                    onClick={async () => {
                      await logout();
                      window.location.href = '/login';
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 group-hover:from-red-100 group-hover:to-red-200 group-hover:shadow-sm transition-all duration-200 flex-shrink-0">
                      <LogOut className="h-4 w-4 text-red-600 group-hover:text-red-700 transition-colors duration-200" />
                    </div>
                    <span className="text-sm font-medium text-red-600 group-hover:text-red-700 leading-tight transition-colors duration-200 flex-1">
                      Logout
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default withComponentErrorBoundary(FloatingActionMenu, {
  componentVariant: 'minimal',
  componentName: 'FloatingActionMenu'
});