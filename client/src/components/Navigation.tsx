import { Link } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

function Navigation() {
  const { user } = useAuth();

  return (
    <>
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" data-testid="link-home" className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img src="/favicon.png" alt="RiderPro Logo" className="h-10 w-10 rounded-lg shadow-sm" />
              <h1 className="text-xl font-bold text-foreground hover:text-primary transition-colors tracking-tight">RiderPro</h1>
            </Link>
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <span className="text-sm text-foreground hidden sm:inline">
                    {user.full_name}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium capitalize">
                    {user.is_super_user ? 'Admin' : user.role}
                  </span>
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