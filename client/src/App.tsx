import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Navigation from "@/components/Navigation";
import FloatingActionMenu from "@/components/FloatingActionMenu";
import Dashboard from "@/pages/Dashboard";
import Shipments from "@/pages/Shipments";
import Login from "@/pages/Login";
import authService from "@/services/AuthService";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/Admin";
import RouteAnalytics from "@/pages/RouteAnalytics";
import RouteVisualizationPage from "@/pages/RouteVisualizationPage";

function Router({ isLoggedIn, onLogin }: { isLoggedIn: boolean; onLogin: () => void }) {
  if (!isLoggedIn) {
    return <Login onLogin={onLogin} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/admin">
          {(params) => {
            const user = authService.getUser();
            if (user && (user.isAdmin || user.isSuperAdmin)) {
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
        <Route component={NotFound} />
      </Switch>
      <FloatingActionMenu />
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(authService.isAuthenticated());

  useEffect(() => {
    const unsubscribe = authService.subscribe((s) => setIsLoggedIn(s.isAuthenticated));
    return unsubscribe;
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router isLoggedIn={isLoggedIn} onLogin={() => setIsLoggedIn(true)} />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
