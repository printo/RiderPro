import { Link, useLocation } from "wouter";
import { Truck, LogOut } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/button";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

function Navigation() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === "/" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === path;
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" data-testid="link-home" className="flex items-center space-x-4 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="bg-primary rounded-lg p-2">
                <Truck className="text-primary-foreground h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-foreground hover:text-primary transition-colors">RiderPro</h1>
            </Link>
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <span className="text-sm text-foreground hidden sm:inline">
                    {user.fullName}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground capitalize">
                    {user.role}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

    </>
  );
}
export default withComponentErrorBoundary(Navigation, {
  componentVariant: 'inline',
  componentName: 'Navigation'
});