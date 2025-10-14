import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Navigation from "@/components/Navigation";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import Dashboard from "@/pages/Dashboard";
import ShipmentsWithTracking from "@/pages/ShipmentsWithTracking";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/Admin";
import RouteAnalytics from "@/pages/RouteAnalytics";
import RouteVisualizationPage from "@/pages/RouteVisualizationPage";
import Settings from "@/pages/Settings";
import { useIsAuthenticated, useIsAdmin, useIsSuperAdmin } from "@/hooks/useAuth";
import RiderSignupForm from "@/pages/RiderSignupForm";
import AdminRiderManagement from "@/pages/AdminRiderManagement";

function Router() {
  const isAuthenticated = useIsAuthenticated();
  const isAdmin = useIsAdmin();
  const isSuperAdmin = useIsSuperAdmin();

  // Debug logging for authentication state in Router
  console.log('🛣️ Router render:', {
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    currentPath: window.location.pathname,
    timestamp: new Date().toISOString()
  });

  if (!isAuthenticated) {
    console.log('🚨 Router: User not authenticated, redirecting to login');
    console.log('Current URL:', window.location.href);
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/shipments" component={ShipmentsWithTracking} />
        <Route path="/admin">
          {() => {
            if (isAdmin || isSuperAdmin) {
              return <AdminPage />;
            }
            return (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>You do not have permission to access the admin dashboard. Only administrators can access this area.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </Route>
        <Route path="/route-analytics" component={RouteAnalytics} />
        <Route path="/route-visualization" component={RouteVisualizationPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <FloatingActionMenu />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
