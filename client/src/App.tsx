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
            const role = authService.getUser()?.role;
            if (role === 'admin' || role === 'isops') {
              return <AdminPage />;
            }
            window.location.href = '/dashboard';
            return null;
          }}
        </Route>
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
