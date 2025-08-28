import { ShipmentFilters } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface FiltersProps {
  filters: ShipmentFilters;
  onFiltersChange: (filters: ShipmentFilters) => void;
}

export default function Filters({ filters, onFiltersChange }: FiltersProps) {
  const updateFilter = (key: keyof ShipmentFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Select 
        value={filters.status || ""} 
        onValueChange={(value) => updateFilter("status", value)}
      >
        <SelectTrigger data-testid="select-filter-status">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Status</SelectItem>
          <SelectItem value="Assigned">Assigned</SelectItem>
          <SelectItem value="In Transit">In Transit</SelectItem>
          <SelectItem value="Delivered">Delivered</SelectItem>
          <SelectItem value="Picked Up">Picked Up</SelectItem>
          <SelectItem value="Returned">Returned</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select 
        value={filters.type || ""} 
        onValueChange={(value) => updateFilter("type", value as "delivery" | "pickup")}
      >
        <SelectTrigger data-testid="select-filter-type">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Types</SelectItem>
          <SelectItem value="delivery">Delivery</SelectItem>
          <SelectItem value="pickup">Pickup</SelectItem>
        </SelectContent>
      </Select>

      <Select 
        value={filters.routeName || ""} 
        onValueChange={(value) => updateFilter("routeName", value)}
      >
        <SelectTrigger data-testid="select-filter-route">
          <SelectValue placeholder="All Routes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Routes</SelectItem>
          <SelectItem value="Route A">Route A</SelectItem>
          <SelectItem value="Route B">Route B</SelectItem>
          <SelectItem value="Route C">Route C</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date" 
        value={filters.date || ""}
        onChange={(e) => updateFilter("date", e.target.value)}
        placeholder="Select date"
        data-testid="input-filter-date"
      />
    </div>
  );
}
