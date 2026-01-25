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
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
  workingDays: Set<string>;
  records: RouteAnalytics[];
}

type SortField = 'employeeId' | 'totalDistance' | 'totalTime' | 'averageSpeed' | 'fuelConsumed' | 'fuelCost' | 'shipmentsCompleted' | 'efficiency' | 'fuelEfficiency';
type SortDirection = 'asc' | 'desc';

export default function EmployeePerformanceTable({
  data,
  dateRange
}: EmployeePerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalDistance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Aggregate employee performance data
  const employeeMetrics = useMemo(() => {
    const employeeData = data.reduce((acc, item) => {
      if (!acc[item.employeeId]) {
        acc[item.employeeId] = {
          employeeId: item.employeeId,
          totalDistance: 0,
          totalTime: 0,
          fuelConsumed: 0,
          fuelCost: 0,
          shipmentsCompleted: 0,
          workingDays: new Set<string>(),
          records: []
        };
      }

      acc[item.employeeId].totalDistance += item.totalDistance || 0;
      acc[item.employeeId].totalTime += item.totalTime || 0;
      acc[item.employeeId].fuelConsumed += item.fuelConsumed || 0;
      acc[item.employeeId].fuelCost += item.fuelCost || 0;
      acc[item.employeeId].shipmentsCompleted += item.shipmentsCompleted || 0;
      acc[item.employeeId].workingDays.add(item.date);
      acc[item.employeeId].records.push(item);

      return acc;
    }, {} as Record<string, EmployeeAggregateData>);

    return Object.values(employeeData).map((employee): EmployeeMetrics => {
      const workingDays = employee.workingDays.size;
      return {
        employeeId: employee.employeeId,
        totalDistance: employee.totalDistance,
        totalTime: employee.totalTime,
        averageSpeed: employee.totalTime > 0 ? (employee.totalDistance / (employee.totalTime / 3600)) : 0,
        fuelConsumed: employee.fuelConsumed,
        fuelCost: employee.fuelCost,
        shipmentsCompleted: employee.shipmentsCompleted,
        efficiency: employee.shipmentsCompleted > 0 ? (employee.totalDistance / employee.shipmentsCompleted) : 0,
        workingDays,
        avgDistancePerDay: workingDays > 0 ? (employee.totalDistance / workingDays) : 0,
        avgShipmentsPerDay: workingDays > 0 ? (employee.shipmentsCompleted / workingDays) : 0,
        fuelEfficiency: employee.fuelConsumed > 0 ? (employee.totalDistance / employee.fuelConsumed) : 0
      };
    });
  }, [data]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = employeeMetrics;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(employee =>
        employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField] ?? 0;
      const bValue = b[sortField] ?? 0;

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
      case 'averageSpeed':
        if (value > 40) variant = "default";
        else if (value > 25) variant = "secondary";
        else variant = "destructive";
        break;
      case 'fuelEfficiency':
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
                    onClick={() => handleSort('employeeId')}
                    className="h-auto p-0 font-semibold"
                  >
                    Employee ID
                    {getSortIcon('employeeId')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('totalDistance')}
                    className="h-auto p-0 font-semibold"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Distance
                    {getSortIcon('totalDistance')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('totalTime')}
                    className="h-auto p-0 font-semibold"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Time
                    {getSortIcon('totalTime')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('averageSpeed')}
                    className="h-auto p-0 font-semibold"
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Avg Speed
                    {getSortIcon('averageSpeed')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('shipmentsCompleted')}
                    className="h-auto p-0 font-semibold"
                  >
                    Shipments
                    {getSortIcon('shipmentsCompleted')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('fuelCost')}
                    className="h-auto p-0 font-semibold"
                  >
                    <Fuel className="h-4 w-4 mr-1" />
                    Fuel Cost
                    {getSortIcon('fuelCost')}
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
                  <TableRow key={employee.employeeId}>
                    <TableCell className="font-medium">
                      Employee {employee.employeeId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.totalDistance.toFixed(1)} km</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.avgDistancePerDay ?? 0).toFixed(1)} km/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{Math.round((employee.totalTime ?? 0) / 3600)} hrs</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((employee.totalTime ?? 0) / 3600 / (employee.workingDays ?? 1))} hrs/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPerformanceBadge(employee.averageSpeed ?? 0, 'averageSpeed')}>
                        {(employee.averageSpeed ?? 0).toFixed(1)} km/h
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee.shipmentsCompleted ?? 0}</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.avgShipmentsPerDay ?? 0).toFixed(1)}/day
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">${(employee.fuelCost ?? 0).toFixed(2)}</span>
                        <span className="text-xs text-muted-foreground">
                          {(employee.fuelConsumed ?? 0).toFixed(1)}L
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
                        {employee.workingDays ?? 0} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={getPerformanceBadge(employee.fuelEfficiency ?? 0, 'fuelEfficiency')}
                          className="text-xs"
                        >
                          {(employee.fuelEfficiency ?? 0).toFixed(1)} km/L
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
              <Card key={employee.employeeId} className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Employee {employee.employeeId}</h3>
                    <Badge variant="outline">{employee.workingDays ?? 0} days</Badge>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">{employee.totalDistance.toFixed(1)} km</p>
                        <p className="text-xs text-muted-foreground">{(employee.avgDistancePerDay ?? 0).toFixed(1)} km/day</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{Math.round((employee.totalTime ?? 0) / 3600)} hrs</p>
                        <p className="text-xs text-muted-foreground">{Math.round((employee.totalTime ?? 0) / 3600 / (employee.workingDays ?? 1))} hrs/day</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <div>
                        <Badge variant={getPerformanceBadge(employee.averageSpeed ?? 0, 'averageSpeed')} className="text-xs">
                          {(employee.averageSpeed ?? 0).toFixed(1)} km/h
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Avg Speed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium">${(employee.fuelCost ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{(employee.fuelConsumed ?? 0).toFixed(1)}L</p>
                      </div>
                    </div>
                  </div>

                  {/* Performance Badges */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Shipments:</span>
                      <span className="text-sm font-medium">{employee.shipmentsCompleted ?? 0}</span>
                      <span className="text-xs text-muted-foreground">({(employee.avgShipmentsPerDay ?? 0).toFixed(1)}/day)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getPerformanceBadge(employee.efficiency ?? 0, 'efficiency')} className="text-xs">
                      {(employee.efficiency ?? 0).toFixed(1)} km/shipment
                    </Badge>
                    <Badge variant={getPerformanceBadge(employee.fuelEfficiency ?? 0, 'fuelEfficiency')} className="text-xs">
                      {(employee.fuelEfficiency ?? 0).toFixed(1)} km/L
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
              Total: {employeeMetrics.reduce((sum, emp) => sum + emp.totalDistance, 0).toFixed(1)} km,
              ${employeeMetrics.reduce((sum, emp) => sum + (emp.fuelCost ?? 0), 0).toFixed(2)} fuel cost
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}