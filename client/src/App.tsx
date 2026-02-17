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
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/Admin";
import RouteAnalytics from "@/pages/RouteAnalytics";
import RouteVisualizationPage from "@/pages/RouteVisualizationPage";
import Settings from "@/pages/Settings";
import RiderSignupForm from "@/pages/RiderSignupForm";
import AdminRiderManagement from "@/pages/AdminRiderManagement";
import LiveTrackingDashboard from "@/pages/LiveTrackingDashboard";
import { PageLoader } from "@/components/ui/Loader";
import { RouteSessionProvider } from "@/contexts/RouteSessionContext";
import { isManagerUser } from "@/lib/roles";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return <PageLoader text="Loading..." />;
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginForm} />
        <Route path="/signup" component={RiderSignupForm} />
        <Route path="/approval-pending" component={ApprovalPending} />
        <Route component={LoginForm} />
      </Switch>
    );
  }

  // Check if user needs approval (for local users only)
  if (user && !user.is_approved && !user.is_super_user && !user.is_ops_team && !user.is_staff) {
    return <ApprovalPending />;
  }

  // Show main app if authenticated
  const empId = user?.employee_id || user?.username || "default-user";
  const hasManagerAccess = isManagerUser(user);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <RouteSessionProvider employeeId={empId}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/shipments" component={ShipmentsWithTracking} />
          <Route path="/admin-dashboard" component={AdminPage} />
          <Route path="/route-analytics" component={hasManagerAccess ? RouteAnalytics : Dashboard} />
          <Route path="/route-visualization" component={hasManagerAccess ? RouteVisualizationPage : Dashboard} />
          <Route path="/live-tracking" component={hasManagerAccess ? LiveTrackingDashboard : Dashboard} />
          <Route path="/settings" component={Settings} />
          <Route path="/signup" component={RiderSignupForm} />
          <Route path="/admin-riders" component={AdminRiderManagement} />
          <Route component={NotFound} />
        </Switch>
      </RouteSessionProvider>
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
