import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAuth } from "./hooks/useAuth";
import LoginForm from "@/components/LoginForm";
import ApprovalPending from "@/pages/ApprovalPending";
import Navigation from "@/components/Navigation";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import Dashboard from "@/pages/Dashboard";
import ShipmentsWithTracking from "@/pages/ShipmentsWithTracking";
import RoleBasedShipments from "@/pages/RoleBasedShipments";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/Admin";
import RouteAnalytics from "@/pages/RouteAnalytics";
import RouteVisualizationPage from "@/pages/RouteVisualizationPage";
import Settings from "@/pages/Settings";
import RiderSignupForm from "@/pages/RiderSignupForm";
import AdminRiderManagement from "@/pages/AdminRiderManagement";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginForm} />
        <Route path="/approval-pending" component={ApprovalPending} />
        <Route component={LoginForm} />
      </Switch>
    );
  }

  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/shipments" component={RoleBasedShipments} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/route-analytics" component={RouteAnalytics} />
        <Route path="/route-visualization" component={RouteVisualizationPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/signup" component={RiderSignupForm} />
        <Route path="/admin-riders" component={AdminRiderManagement} />
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
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
