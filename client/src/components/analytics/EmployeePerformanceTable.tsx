import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Users,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  Fuel,
  TrendingUp
} from 'lucide-react';
import { RouteAnalytics, EmployeeMetrics } from '@shared/types';
import { DateRange } from 'react-day-picker';

interface EmployeePerformanceTableProps {
  data: RouteAnalytics[];
  dateRange?: DateRange;
}

interface EmployeeAggregateData {
  employee_id: string;
  total_distance: number;
  total_time: number;
  fuel_consumption: number;
  fuel_cost: number;
  shipments_completed: number;
  working_days: Set<string>;
  records: RouteAnalytics[];
}

type SortField = 'employee_id' | 'total_distance' | 'total_time' | 'average_speed' | 'fuel_consumption' | 'fuel_cost' | 'shipments_completed' | 'efficiency' | 'fuel_efficiency';
type SortDirection = 'asc' | 'desc';

export default function EmployeePerformanceTable({
  data,
  dateRange
}: EmployeePerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_distance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Aggregate employee performance data
  const employeeMetrics = useMemo(() => {
    const employeeData = data.reduce((acc, item) => {
      const id = item.employee_id || 'unknown';
      if (!acc[id]) {
        acc[id] = {
          employee_id: id,
          total_distance: 0,
          total_time: 0,
          fuel_consumption: 0,
          fuel_cost: 0,
          shipments_completed: 0,
          working_days: new Set<string>(),
          records: []
        };
      }

      acc[id].total_distance += item.total_distance || 0;
      acc[id].total_time += item.total_time || 0;
      acc[id].fuel_consumption += (item.fuel_consumption || 0);
      acc[id].fuel_cost += item.fuel_cost || 0;
      acc[id].shipments_completed += item.shipments_completed || 0;
      acc[id].working_days.add(item.date);
      acc[id].records.push(item);

      return acc;
    }, {} as Record<string, EmployeeAggregateData>);

    return Object.values(employeeData).map((employee): EmployeeMetrics => {
      const working_days = employee.working_days.size;
      return {
        employee_id: employee.employee_id,
        total_distance: employee.total_distance,
        total_time: employee.total_time,
        average_speed: employee.total_time > 0 ? (employee.total_distance / (employee.total_time / 3600)) : 0,
        fuel_consumption: employee.fuel_consumption,
        fuel_cost: employee.fuel_cost,
        shipments_completed: employee.shipments_completed,
        efficiency: employee.shipments_completed > 0 ? (employee.total_distance / employee.shipments_completed) : 0,
        working_days,
        average_distance_per_day: working_days > 0 ? (employee.total_distance / working_days) : 0,
        average_shipments_per_day: working_days > 0 ? (employee.shipments_completed / working_days) : 0,
        fuel_efficiency: employee.fuel_consumption > 0 ? (employee.total_distance / employee.fuel_consumption) : 0
      };
    });
  }, [data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = employeeMetrics;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(employee =>
        employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = (a as any)[sortField] ?? 0;
      const bValue = (b as any)[sortField] ?? 0;

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [employeeMetrics, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const getPerformanceBadge = (value: number, field: SortField) => {
    // Simple performance categorization based on field
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";

    switch (field) {
      case 'average_speed':
        if (value > 40) variant = "default";
        else if (value > 25) variant = "secondary";
        else variant = "destructive";
        break;
      case 'fuel_efficiency':
        if (value > 12) variant = "default";
        else if (value > 8) variant = "secondary";
        else variant = "destructive";
        break;
      case 'efficiency':
        if (value < 15) variant = "default";
        else if (value < 25) variant = "secondary";
        else variant = "destructive";
        break;
      default:
        variant = "outline";
    }

    return variant;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Performance Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
        {dateRange && (
          <p className="text-sm text-muted-foreground">
            Performance data from {dateRange.from?.toLocaleDateString()} to {dateRange.to?.toLocaleDateString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden lg:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('employee_id')}
                    className="h-auto p-0 font-semibold"
                  >
                    Employee ID
                    {getSortIcon('employee_id')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('total_distance')}
                    className="h-auto p-0 font-semibold"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Distance
                    {getSortIcon('total_distance')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('total_time')}
                    className="h-auto p-0 font-semibold"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Time
                    {getSortIcon('total_time')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('average_speed')}
                    className="h-auto p-0 font-semibold"
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Avg Speed
                    {getSortIcon('average_speed')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('shipments_completed')}
                    className="h-auto p-0 font-semibold"
                  >
                    Shipments
                    {getSortIcon('shipments_completed')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('fuel_cost')}
                    className="h-auto p-0 font-semibold"
                  >
                    <Fuel className="h-4 w-4 mr-1" />
                    Fuel Cost
                    {getSortIcon('fuel_cost')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('efficiency')}
                    className="h-auto p-0 font-semibold"
                  >
                    Efficiency
                    {getSortIcon('efficiency')}
                  </Button>
                </TableHead>
                <TableHead>Working Days</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No employee data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((employee) => (
                  <TableRow key={employee.employee_id}>
                    <TableCell className="font-medium">
                      Employee {employee.employee_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.total_distance.toFixed(1)} km</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.average_distance_per_day ?? 0).toFixed(1)} km/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{Math.round((employee.total_time ?? 0) / 3600)} hrs</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((employee.total_time ?? 0) / 3600 / (employee.working_days ?? 1))} hrs/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPerformanceBadge(employee.average_speed ?? 0, 'average_speed')}>
                        {(employee.average_speed ?? 0).toFixed(1)} km/h
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.shipments_completed ?? 0}</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.average_shipments_per_day ?? 0).toFixed(1)}/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">${(employee.fuel_cost ?? 0).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.fuel_consumption ?? 0).toFixed(1)}L
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPerformanceBadge(employee.efficiency ?? 0, 'efficiency')}>
                        {(employee.efficiency ?? 0).toFixed(1)} km/shipment
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {employee.working_days ?? 0} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={getPerformanceBadge(employee.fuel_efficiency ?? 0, 'fuel_efficiency')}
                          className="text-xs"
                        >
                          {(employee.fuel_efficiency ?? 0).toFixed(1)} km/L
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {filteredAndSortedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employee data found
            </div>
          ) : (
            filteredAndSortedData.map((employee) => (
              <Card key={employee.employee_id} className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Employee {employee.employee_id}</h3>
                    <Badge variant="outline">{employee.working_days ?? 0} days</Badge>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">{employee.total_distance.toFixed(1)} km</p>
                        <p className="text-xs text-muted-foreground">{(employee.average_distance_per_day ?? 0).toFixed(1)} km/day</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{Math.round((employee.total_time ?? 0) / 3600)} hrs</p>
                        <p className="text-xs text-muted-foreground">{Math.round((employee.total_time ?? 0) / 3600 / (employee.working_days ?? 1))} hrs/day</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <div>
                        <Badge variant={getPerformanceBadge(employee.average_speed ?? 0, 'average_speed')} className="text-xs">
                          {(employee.average_speed ?? 0).toFixed(1)} km/h
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Avg Speed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium">${(employee.fuel_cost ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{(employee.fuel_consumption ?? 0).toFixed(1)}L</p>
                      </div>
                    </div>
                  </div>

                  {/* Performance Badges */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Shipments:</span>
                      <span className="text-sm font-medium">{employee.shipments_completed ?? 0}</span>
                      <span className="text-xs text-muted-foreground">({(employee.average_shipments_per_day ?? 0).toFixed(1)}/day)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getPerformanceBadge(employee.efficiency ?? 0, 'efficiency')} className="text-xs">
                      {(employee.efficiency ?? 0).toFixed(1)} km/shipment
                    </Badge>
                    <Badge variant={getPerformanceBadge(employee.fuel_efficiency ?? 0, 'fuel_efficiency')} className="text-xs">
                      {(employee.fuel_efficiency ?? 0).toFixed(1)} km/L
                    </Badge>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {filteredAndSortedData.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedData.length} of {employeeMetrics.length} employees
            </span>
            <span>
              Total: {employeeMetrics.reduce((sum, emp) => sum + emp.total_distance, 0).toFixed(1)} km,
              ${employeeMetrics.reduce((sum, emp) => sum + (emp.fuel_cost ?? 0), 0).toFixed(2)} fuel cost
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}