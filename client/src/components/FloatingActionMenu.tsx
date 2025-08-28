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
  Settings,
  Phone,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function FloatingActionMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();

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
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
            data-testid="button-floating-menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl border-0">
          <div className="space-y-6 pb-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">John Rider</h3>
                  <p className="text-sm text-muted-foreground">Delivery Executive</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>+91-9876543210</span>
                </div>
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>john@riderpro.com</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Navigation Menu */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Navigation</h4>
              <div className="grid gap-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.href}
                      variant={isActive(item.href) ? "default" : "ghost"}
                      className={cn(
                        "justify-start h-12 text-left",
                        isActive(item.href) && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => handleNavigation(item.href)}
                      data-testid={item.testId}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Actions</h4>
              <div className="grid gap-2">
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-left"
                  data-testid="button-settings"
                >
                  <Settings className="h-5 w-5 mr-3" />
                  Settings
                </Button>
                
                <Button
                  variant="ghost"
                  className="justify-start h-12 text-left text-red-600 hover:text-red-600 hover:bg-red-50"
                  data-testid="button-logout"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}