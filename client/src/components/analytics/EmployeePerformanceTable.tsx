import React, { useMemo, useState } from 'react';
import ResponsiveTable, { ResponsiveTableColumn } from '@/components/ui/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  MapPin,
  Clock,
  Fuel,
  TrendingUp
} from 'lucide-react';
import { RouteAnalytics } from '@shared/schema';
import { DateRange } from 'react-day-picker';

interface EmployeePerformanceTableProps {
  data: RouteAnalytics[];
  dateRange?: DateRange;
}

type SortField = 'employeeId' | 'totalDistance' | 'totalTime' | 'averageSpeed' | 'fuelConsumed' | 'fuelCost' | 'shipmentsCompleted' | 'efficiency' | 'fuelEfficiency';
type SortDirection = 'asc' | 'desc';

interface EmployeeMetrics {
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  averageSpeed: number;
  fuelConsumed: number;
  fuelCost: number;
  shipmentsCompleted: number;
  efficiency: number;
  workingDays: number;
  avgDistancePerDay: number;
  avgShipmentsPerDay: number;
  fuelEfficiency: number;
}

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
    }, {} as Record<string, any>);

    return Object.values(employeeData).map((employee: any): EmployeeMetrics => {
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
      const aValue = a[sortField];
      const bValue = b[sortField];

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

  const columns: ResponsiveTableColumn<EmployeeMetrics>[] = [
    {
      key: 'employeeId',
      label: 'Employee ID',
      sortable: true,
      className: 'font-medium text-gray-900',
      render: (value) => `Employee ${value}`
    },
    {
      key: 'totalDistance',
      label: 'Distance',
      sortable: true,
      render: (value, item) => (
        <div className="flex flex-col">
          <span className="font-medium">{value.toFixed(1)} km</span>
          <span className="text-xs text-muted-foreground">
            {item.avgDistancePerDay.toFixed(1)} km/day
          </span>
        </div>
      ),
      mobileRender: (item) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-medium">{item.totalDistance.toFixed(1)} km</p>
            <p className="text-xs text-muted-foreground">{item.avgDistancePerDay.toFixed(1)} km/day</p>
          </div>
        </div>
      )
    },
    {
      key: 'totalTime',
      label: 'Time',
      sortable: true,
      render: (value, item) => (
        <div className="flex flex-col">
          <span className="font-medium">{Math.round(value / 3600)} hrs</span>
          <span className="text-xs text-muted-foreground">
            {Math.round(value / 3600 / item.workingDays)} hrs/day
          </span>
        </div>
      ),
      mobileRender: (item) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-sm font-medium">{Math.round(item.totalTime / 3600)} hrs</p>
            <p className="text-xs text-muted-foreground">{Math.round(item.totalTime / 3600 / item.workingDays)} hrs/day</p>
          </div>
        </div>
      )
    },
    {
      key: 'averageSpeed',
      label: 'Avg Speed',
      sortable: true,
      render: (value) => (
        <Badge variant={getPerformanceBadge(value, 'averageSpeed')}>
          {value.toFixed(1)} km/h
        </Badge>
      ),
      mobileRender: (item) => (
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-600" />
          <div>
            <Badge variant={getPerformanceBadge(item.averageSpeed, 'averageSpeed')} className="text-xs">
              {item.averageSpeed.toFixed(1)} km/h
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Avg Speed</p>
          </div>
        </div>
      )
    },
    {
      key: 'shipmentsCompleted',
      label: 'Shipments',
      sortable: true,
      render: (value, item) => (
        <div className="flex flex-col">
          <span className="font-medium">{value}</span>
          <span className="text-xs text-muted-foreground">
            {item.avgShipmentsPerDay.toFixed(1)}/day
          </span>
        </div>
      )
    },
    {
      key: 'fuelCost',
      label: 'Fuel Cost',
      sortable: true,
      render: (value, item) => (
        <div className="flex flex-col">
          <span className="font-medium">${value.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">
            {item.fuelConsumed.toFixed(1)}L
          </span>
        </div>
      ),
      mobileRender: (item) => (
        <div className="flex items-center gap-2">
          <Fuel className="h-4 w-4 text-orange-600" />
          <div>
            <p className="text-sm font-medium">${item.fuelCost.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{item.fuelConsumed.toFixed(1)}L</p>
          </div>
        </div>
      )
    },
    {
      key: 'efficiency',
      label: 'Efficiency',
      sortable: true,
      render: (value) => (
        <Badge variant={getPerformanceBadge(value, 'efficiency')}>
          {value.toFixed(1)} km/shipment
        </Badge>
      )
    },
    {
      key: 'workingDays',
      label: 'Working Days',
      render: (value) => (
        <Badge variant="outline">
          {value} days
        </Badge>
      )
    },
    {
      key: 'fuelEfficiency',
      label: 'Performance',
      render: (value) => (
        <Badge
          variant={getPerformanceBadge(value, 'fuelEfficiency')}
          className="text-xs"
        >
          {value.toFixed(1)} km/L
        </Badge>
      )
    }
  ];

  return (
    <ResponsiveTable
      title="Employee Performance Analysis"
      subtitle={dateRange ? 
        `Performance data from ${dateRange.from?.toLocaleDateString()} to ${dateRange.to?.toLocaleDateString()}` : 
        undefined
      }
      data={filteredAndSortedData}
      columns={columns}
      searchable
      searchPlaceholder="Search employees..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
      emptyMessage="No employee data found"
    />
  );
}