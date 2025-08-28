import { Link, useLocation } from "wouter";
import { Truck, BarChart3, List, User } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location === path;
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-primary rounded-lg p-2">
                <Truck className="text-primary-foreground h-6 w-6" />
              </div>
              <Link href="/">
                <h1 className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors">RiderPro</h1>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">John Rider</span>
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <User className="text-muted-foreground h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8" role="tablist">
            <Link href="/shipments" data-testid="link-shipments">
              <button 
                className={`border-b-2 py-3 px-1 text-sm font-medium flex items-center gap-2 transition-colors ${
                  isActive("/shipments")
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-shipments-tab"
              >
                <List className="h-4 w-4" />
                Shipments
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
