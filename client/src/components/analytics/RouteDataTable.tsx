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
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Clock,
  Fuel,
  TrendingUp,
  User,
  Calendar
} from 'lucide-react';
import { RouteAnalytics, RouteSession, RouteData } from '@shared/types';

// Unified interface for route data display
interface UnifiedRouteData {
  id: string;
  employeeId: string;
  employeeName?: string;
  date?: string;
  totalDistance?: number;
  distance?: number;
  totalTime?: number;
  duration?: number;
  averageSpeed?: number;
  shipmentsCompleted?: number;
  fuelConsumption?: number;
  fuelConsumed?: number;
  fuelCost?: number;
  efficiency?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
}

interface RouteDataTableProps {
  data: RouteAnalytics[] | RouteSession[] | RouteData[];
  dataType: 'analytics' | 'sessions' | 'routeData';
  title?: string;
  onRowClick?: (item: any) => void;
  showSearch?: boolean;
  showSorting?: boolean;
  pageSize?: number;
}

type SortField = 'employeeId' | 'date' | 'distance' | 'duration' | 'shipments' | 'efficiency' | 'fuel';
type SortDirection = 'asc' | 'desc';

export default function RouteDataTable({
  data,
  dataType,
  title,
  onRowClick,
  showSearch = true,
  showSorting = true,
  pageSize = 10
}: RouteDataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Normalize data to unified format
  const normalizedData: UnifiedRouteData[] = useMemo(() => {
    return data.map((item: any) => {
      if (dataType === 'analytics') {
        const analytics = item as RouteAnalytics;
        return {
          id: analytics.routeId || `analytics-${analytics.employeeId}`,
          employeeId: analytics.employeeId,
          employeeName: `Employee ${analytics.employeeId}`,
          date: analytics.date,
          totalDistance: analytics.totalDistance,
          distance: analytics.totalDistance,
          totalTime: analytics.totalTime,
          duration: analytics.totalTime,
          averageSpeed: analytics.averageSpeed,
          shipmentsCompleted: analytics.shipmentsCompleted,
          fuelConsumption: analytics.fuelConsumption,
          fuelConsumed: analytics.fuelConsumed,
          fuelCost: analytics.fuelCost,
          efficiency: analytics.efficiency
        };
      } else if (dataType === 'sessions') {
        const session = item as RouteSession;
        return {
          id: session.id,
          employeeId: session.employeeId,
          employeeName: session.employeeName || `Employee ${session.employeeId}`,
          date: session.startTime?.split('T')[0],
          totalDistance: session.totalDistance,
          distance: session.totalDistance,
          totalTime: session.totalTime,
          duration: session.totalTime,
          averageSpeed: session.averageSpeed,
          shipmentsCompleted: session.shipmentsCompleted,
          efficiency: session.totalDistance && session.shipmentsCompleted 
            ? session.totalDistance / session.shipmentsCompleted 
            : 0,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status
        };
      } else {
        const routeData = item as RouteData;
        return {
          id: routeData.id,
          employeeId: routeData.employeeId,
          employeeName: routeData.employeeName || `Employee ${routeData.employeeId}`,
          date: routeData.date,
          distance: routeData.distance,
          totalDistance: routeData.distance,
          duration: routeData.duration,
          totalTime: routeData.duration,
          averageSpeed: routeData.averageSpeed,
          shipmentsCompleted: routeData.shipmentsCompleted,
          fuelConsumption: routeData.fuelConsumption,
          efficiency: routeData.efficiency
        };
      }
    });
  }, [data, dataType]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = normalizedData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item => {
        const employeeId = item.employeeId || '';
        const employeeName = item.employeeName || '';
        const date = item.date || '';
        
        return (
          employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          date.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Apply sorting
    if (showSorting) {
      filtered.sort((a, b) => {
        const getValue = (item: UnifiedRouteData, field: SortField): number | string => {
          switch (field) {
            case 'employeeId':
              return item.employeeId || '';
            case 'date':
              return item.date || '';
            case 'distance':
              return item.totalDistance || item.distance || 0;
            case 'duration':
              return item.totalTime || item.duration || 0;
            case 'shipments':
              return item.shipmentsCompleted || 0;
            case 'efficiency':
              return item.efficiency || 0;
            case 'fuel':
              return item.fuelConsumption || item.fuelConsumed || 0;
            default:
              return 0;
          }
        };

        const aValue = getValue(a, sortField);
        const bValue = getValue(b, sortField);

        if (sortDirection === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [normalizedData, searchTerm, sortField, sortDirection, showSorting]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize);

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

  const formatCellValue = (value: any, field: string): string => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (field) {
      case 'distance':
        return typeof value === 'number' ? `${value.toFixed(1)} km` : value;
      case 'duration':
        return typeof value === 'number' ? `${Math.round(value / 3600)}h ${Math.round((value % 3600) / 60)}m` : value;
      case 'efficiency':
        return typeof value === 'number' ? `${value.toFixed(1)} km/shipment` : value;
      case 'fuel':
        return typeof value === 'number' ? `${value.toFixed(1)} L` : value;
      case 'averageSpeed':
        return typeof value === 'number' ? `${value.toFixed(1)} km/h` : value;
      default:
        return String(value);
    }
  };

  const getPerformanceBadge = (value: number, field: string) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";

    switch (field) {
      case 'averageSpeed':
        if (value > 40) variant = "default";
        else if (value > 25) variant = "secondary";
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

  const renderTableContent = () => {
    if (paginatedData.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={showSorting ? 8 : 7} className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'No data found matching your search' : 'No route data available'}
          </TableCell>
        </TableRow>
      );
    }

    return paginatedData.map((item, index) => (
      <TableRow 
        key={item.id || `${item.employeeId}-${index}`}
        className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
        onClick={() => onRowClick?.(item)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div>{item.employeeName || `Employee ${item.employeeId}`}</div>
              <div className="text-xs text-muted-foreground">{item.employeeId}</div>
            </div>
          </div>
        </TableCell>
        
        <TableCell>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {item.date || 'N/A'}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            {formatCellValue(item.totalDistance || item.distance, 'distance')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            {formatCellValue(item.totalTime || item.duration, 'duration')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            {formatCellValue(item.averageSpeed, 'averageSpeed')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.shipmentsCompleted || 0}</span>
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-orange-600" />
            {formatCellValue(item.fuelConsumption || item.fuelConsumed, 'fuel')}
          </div>
        </TableCell>

        <TableCell>
          <Badge variant={getPerformanceBadge(item.efficiency || 0, 'efficiency')}>
            {formatCellValue(item.efficiency, 'efficiency')}
          </Badge>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {title || `Route ${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`}
          </CardTitle>
          
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          )}
        </div>
        
        {data.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {paginatedData.length} of {filteredAndSortedData.length} routes 
            {filteredAndSortedData.length !== data.length && ` (filtered from ${data.length} total)`}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Desktop Table View */}
        <div className="hidden lg:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>
                  {showSorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('date')}
                      className="h-auto p-0 font-semibold"
                    >
                      Date
                      {getSortIcon('date')}
                    </Button>
                  )}
                  {!showSorting && 'Date'}
                </TableHead>
                <TableHead>
                  {showSorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('distance')}
                      className="h-auto p-0 font-semibold"
                    >
                      Distance
                      {getSortIcon('distance')}
                    </Button>
                  )}
                  {!showSorting && 'Distance'}
                </TableHead>
                <TableHead>
                  {showSorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('duration')}
                      className="h-auto p-0 font-semibold"
                    >
                      Duration
                      {getSortIcon('duration')}
                    </Button>
                  )}
                  {!showSorting && 'Duration'}
                </TableHead>
                <TableHead>Avg Speed</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Efficiency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderTableContent()}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {paginatedData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No data found matching your search' : 'No route data available'}
            </div>
          ) : (
            paginatedData.map((item, index) => (
              <Card 
                key={item.id || `${item.employeeId}-${index}`}
                className="p-4"
                onClick={() => onRowClick?.(item)}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">
                        {item.employeeName || `Employee ${item.employeeId}`}
                      </h3>
                    </div>
                    <Badge variant="outline">
                      {item.date || 'N/A'}
                    </Badge>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCellValue(item.totalDistance || item.distance, 'distance')}
                        </p>
                        <p className="text-xs text-muted-foreground">Distance</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCellValue(item.totalTime || item.duration, 'duration')}
                        </p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {formatCellValue(item.averageSpeed, 'averageSpeed')}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Speed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {item.shipmentsCompleted || 0}
                      </span>
                      <p className="text-xs text-muted-foreground">Shipments</p>
                    </div>
                  </div>

                  {/* Performance Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getPerformanceBadge(item.efficiency || 0, 'efficiency')} className="text-xs">
                      {formatCellValue(item.efficiency, 'efficiency')}
                    </Badge>
                    {item.fuelConsumption || item.fuelConsumed ? (
                      <Badge variant="outline" className="text-xs">
                        {formatCellValue(item.fuelConsumption || item.fuelConsumed, 'fuel')}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
