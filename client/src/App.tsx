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
import { PageLoader } from "@/components/ui/Loader";

function Router() {
  const { isAuthenticated, isLoading, user, isAdmin } = useAuth();

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
  if (user && !user.isApproved && !isAdmin) {
    return <ApprovalPending />;
  }

  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/shipments" component={ShipmentsWithTracking} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/route-analytics" component={RouteAnalytics} />
        <Route path="/route-visualization" component={RouteVisualizationPage} />
        <Route path="/settings" component={Settings} />
        <Route path="/signup" component={RiderSignupForm} />
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
