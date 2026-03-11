import { useState } from "react";
import { ShipmentFilters } from "@shared/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import { withComponentErrorBoundary } from "@/components/ErrorBoundary";

interface FiltersProps {
  filters: ShipmentFilters;
  onFiltersChange: (filters: ShipmentFilters) => void;
  onClear?: () => void;
}

function Filters({ filters, onFiltersChange, onClear: _onClear }: FiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof ShipmentFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? undefined : value,
    });
  };

  const hasActiveFilters = filters.status || filters.type || filters.route_name || filters.employee_id || filters.pops_order_id || filters.created_at__gte || filters.created_at__lt;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between h-10"
          data-testid="button-toggle-filters"
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <div className="w-2 h-2 bg-primary rounded-full"></div>
            )}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) => updateFilter("status", value)}
            >
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Assigned">Assigned</SelectItem>
                <SelectItem value="Collected">Collected</SelectItem>
                <SelectItem value="In Transit">In Transit</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Picked Up">Picked Up</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Type</label>
            <Select
              value={filters.type || "all"}
              onValueChange={(value) => updateFilter("type", value as "delivery" | "pickup")}
            >
              <SelectTrigger data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Store Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Store</label>
            <Select
              value={filters.route_name || "all"}
              onValueChange={(value) => updateFilter("route_name", value)}
            >
              <SelectTrigger data-testid="select-filter-store">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                <SelectItem value="Brigade Road">Brigade Road</SelectItem>
                <SelectItem value="Electronic City">Electronic City</SelectItem>
                <SelectItem value="Frazer Town">Frazer Town</SelectItem>
                <SelectItem value="HSR Layout">HSR Layout</SelectItem>
                <SelectItem value="Indiranagar">Indiranagar</SelectItem>
                <SelectItem value="Jayanagar">Jayanagar</SelectItem>
                <SelectItem value="J.P. Nagar">J.P. Nagar</SelectItem>
                <SelectItem value="Koramangala">Koramangala</SelectItem>
                <SelectItem value="Kammanahalli">Kammanahalli</SelectItem>
                <SelectItem value="Malleshwaram">Malleshwaram</SelectItem>
                <SelectItem value="Varthur Main Road">Varthur Main Road</SelectItem>
                <SelectItem value="Whitefield">Whitefield</SelectItem>
                <SelectItem value="Yelahanka">Yelahanka</SelectItem>
                <SelectItem value="New BEL Road">New BEL Road</SelectItem>
                <SelectItem value="Bommanahalli">Bommanahalli</SelectItem>
                <SelectItem value="Adyar">Adyar</SelectItem>
                <SelectItem value="Nungambakkam">Nungambakkam</SelectItem>
                <SelectItem value="Thoraipakkam">Thoraipakkam</SelectItem>
                <SelectItem value="Anna Nagar">Anna Nagar</SelectItem>
                <SelectItem value="Kottivakkam">Kottivakkam</SelectItem>
                <SelectItem value="Gurugram">Gurugram</SelectItem>
                <SelectItem value="Sohna Road">Sohna Road</SelectItem>
                <SelectItem value="Udyog Vihar">Udyog Vihar</SelectItem>
                <SelectItem value="Gachibowli">Gachibowli</SelectItem>
                <SelectItem value="Madhapur">Madhapur</SelectItem>
                <SelectItem value="Somajiguda">Somajiguda</SelectItem>
                <SelectItem value="Kukatpally">Kukatpally</SelectItem>
                <SelectItem value="Hinjewadi">Hinjewadi</SelectItem>
                <SelectItem value="South Campus">South Campus</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rider ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Rider ID</label>
            <input
              type="text"
              value={filters.employee_id || ""}
              onChange={(e) => updateFilter("employee_id", e.target.value)}
              placeholder="Filter by rider ID"
              className="w-full h-9 px-3 py-2 border rounded-md bg-background text-foreground text-sm"
              data-testid="input-filter-rider"
            />
          </div>

          {/* Pia Order ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Pia Order ID</label>
            <input
              type="text"
              value={filters.pops_order_id?.toString() || ""}
              onChange={(e) => {
                const value = e.target.value.trim();
                onFiltersChange({
                  ...filters,
                  pops_order_id: value ? (isNaN(Number(value)) ? value : Number(value)) : undefined,
                });
              }}
              placeholder="Filter by Pia order ID"
              className="w-full h-9 px-3 py-2 border rounded-md bg-background text-foreground text-sm"
              data-testid="input-filter-order-id"
            />
          </div>

          {/* Created Date From */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Date From</label>
            <input
              type="date"
              value={filters.created_at__gte ? new Date(filters.created_at__gte).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const value = e.target.value;
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const threeDaysAgo = new Date(today);
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                if (selectedDate < threeDaysAgo) {
                  alert('Data older than 3 days is not available due to cleanup policy.');
                  return;
                }

                onFiltersChange({
                  ...filters,
                  created_at__gte: value ? new Date(value).toISOString() : undefined,
                });
              }}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-9 px-3 py-2 border rounded-md bg-background text-foreground text-sm"
              data-testid="input-filter-date-from"
            />
            <p className="text-xs text-muted-foreground">Max 3 days back</p>
          </div>

          {/* Created Date To */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Date To</label>
            <input
              type="date"
              value={filters.created_at__lt ? new Date(filters.created_at__lt).toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value) {
                  const toDate = new Date(value);
                  toDate.setDate(toDate.getDate() + 1);
                  onFiltersChange({
                    ...filters,
                    created_at__lt: toDate.toISOString(),
                  });
                } else {
                  onFiltersChange({
                    ...filters,
                    created_at__lt: undefined,
                  });
                }
              }}
              max={new Date().toISOString().split('T')[0]}
              className="w-full h-9 px-3 py-2 border rounded-md bg-background text-foreground text-sm"
              data-testid="input-filter-date-to"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
export default withComponentErrorBoundary(Filters, {
  componentVariant: 'inline',
  componentName: 'Filters'
});