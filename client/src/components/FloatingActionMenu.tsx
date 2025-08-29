import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { 
  Menu, 
  BarChart3, 
  List, 
  User, 
  LogOut, 
  Phone,
  Mail,
  Sun,
  Moon,
  X
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();

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
    }
  ];

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
          className="h-auto max-h-[80vh] rounded-t-3xl border-0 bg-background shadow-2xl p-0"
        >
          <div className="space-y-4 pb-6 pt-2 px-4">
            {/* Drag Handle */}
            <div className="flex justify-center">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Profile Section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                    <User className="text-white h-6 w-6" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-foreground truncate">John Rider</h3>
                  <p className="text-sm text-primary font-medium">Delivery Executive</p>
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Navigation</h4>
              <div className="grid grid-cols-2 gap-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      className={cn(
                        "justify-center h-16 text-center flex-row rounded-xl transition-all duration-200 hover:scale-105",
                        "border-2 border-transparent hover:border-primary/20",
                        active 
                          ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-md border-primary/30" 
                          : "hover:bg-primary/5"
                      )}
                      onClick={() => handleNavigation(item.href)}
                      data-testid={item.testId}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center mb-1 transition-colors",
                        active ? "bg-white/20" : "bg-primary/10"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          active ? "text-white" : "text-primary"
                        )} />
                      </div>
                      <span className={cn(
                        "text-xs font-medium",
                        active ? "text-white" : "text-foreground"
                      )}>{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Action Buttons */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  className="justify-center h-16 text-center flex-row rounded-xl transition-all duration-200 hover:scale-105 border-2 border-transparent hover:border-primary/20 hover:bg-primary/5"
                  onClick={toggleTheme}
                  data-testid="button-theme-toggle"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1 bg-primary/10">
                    {theme === 'light' ? 
                      <Moon className="h-4 w-4 text-primary" /> : 
                      <Sun className="h-4 w-4 text-primary" />
                    }
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </Button>
                
                <Button
                  variant="ghost"
                  className="justify-center h-16 text-center flex-row rounded-xl transition-all duration-200 hover:scale-105 border-2 border-transparent hover:border-red-200 group"
                  data-testid="button-logout"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-1">
                    <LogOut className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-red-600 group-hover:text-red-700">
                    Logout
                  </span>
                </Button>
              </div>
            </div>


          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}