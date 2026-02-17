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
  employee_id: string;
  employee_name?: string;
  date?: string;
  total_distance?: number;
  total_time?: number;
  average_speed?: number;
  shipments_completed?: number;
  fuel_consumption?: number;
  fuel_cost?: number;
  efficiency?: number;
  start_time?: string;
  end_time?: string;
  status?: string;
}

interface RouteDataTableProps {
  data: RouteAnalytics[] | RouteSession[] | RouteData[];
  data_type: 'analytics' | 'sessions' | 'routeData';
  title?: string;
  on_row_click?: (item: any) => void;
  show_search?: boolean;
  show_sorting?: boolean;
  page_size?: number;
}

type SortField = 'employee_id' | 'date' | 'total_distance' | 'total_time' | 'shipments' | 'efficiency' | 'fuel';
type SortDirection = 'asc' | 'desc';

export default function RouteDataTable({
  data,
  data_type,
  title,
  on_row_click,
  show_search = true,
  show_sorting = true,
  page_size = 10
}: RouteDataTableProps) {
  const [search_term, set_search_term] = useState('');
  const [sort_field, set_sort_field] = useState<SortField>('date');
  const [sort_direction, set_sort_direction] = useState<SortDirection>('desc');
  const [current_page, set_current_page] = useState(1);

  // Normalize data to unified format
  const normalized_data: UnifiedRouteData[] = useMemo(() => {
    return data.map((item: any) => {
      if (data_type === 'analytics') {
        const analytics = item as RouteAnalytics;
        return {
          id: analytics.route_id || `analytics-${analytics.employee_id}`,
          employee_id: analytics.employee_id,
          employee_name: `Employee ${analytics.employee_id}`,
          date: analytics.date,
          total_distance: analytics.total_distance,
          total_time: analytics.total_time,
          average_speed: analytics.average_speed,
          shipments_completed: analytics.shipments_completed,
          fuel_consumption: analytics.fuel_consumption,
          fuel_cost: analytics.fuel_cost,
          efficiency: analytics.efficiency
        };
      } else if (data_type === 'sessions') {
        const session = item as RouteSession;
        return {
          id: session.id,
          employee_id: session.employee_id,
          employee_name: session.employee_name || `Employee ${session.employee_id}`,
          date: session.start_time?.split('T')[0],
          total_distance: session.total_distance,
          total_time: session.total_time,
          average_speed: session.average_speed,
          shipments_completed: session.shipments_completed,
          efficiency: session.total_distance && session.shipments_completed
            ? session.total_distance / session.shipments_completed
            : 0,
          start_time: session.start_time,
          end_time: session.end_time,
          status: session.status
        };
      } else {
        const routeData = item as RouteData;
        return {
          id: routeData.id,
          employee_id: routeData.employee_id,
          employee_name: routeData.employee_name || `Employee ${routeData.employee_id}`,
          date: routeData.date,
          total_distance: routeData.total_distance,
          total_time: routeData.total_time,
          average_speed: routeData.average_speed,
          shipments_completed: routeData.shipments_completed,
          fuel_consumption: routeData.fuel_consumption,
          efficiency: routeData.efficiency
        };
      }
    });
  }, [data, data_type]);

  // Filter and sort data
  const filtered_and_sorted_data = useMemo(() => {
    let filtered = normalized_data;

    // Apply search filter
    if (search_term) {
      filtered = filtered.filter(item => {
        const employee_id = item.employee_id || '';
        const employee_name = item.employee_name || '';
        const date = item.date || '';

        return (
          employee_id.toLowerCase().includes(search_term.toLowerCase()) ||
          employee_name.toLowerCase().includes(search_term.toLowerCase()) ||
          date.toLowerCase().includes(search_term.toLowerCase())
        );
      });
    }

    // Apply sorting
    if (show_sorting) {
      filtered.sort((a, b) => {
        const get_value = (item: UnifiedRouteData, field: SortField): number | string => {
          switch (field) {
            case 'employee_id':
              return item.employee_id || '';
            case 'date':
              return item.date || '';
            case 'total_distance':
              return item.total_distance || 0;
            case 'total_time':
              return item.total_time || 0;
            case 'shipments':
              return item.shipments_completed || 0;
            case 'efficiency':
              return item.efficiency || 0;
            case 'fuel':
              return item.fuel_consumption || 0;
            default:
              return 0;
          }
        };

        const aValue = get_value(a, sort_field);
        const bValue = get_value(b, sort_field);

        if (sort_direction === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [normalized_data, search_term, sort_field, sort_direction, show_sorting]);

  // Pagination
  const paginated_data = useMemo(() => {
    const startIndex = (current_page - 1) * page_size;
    return filtered_and_sorted_data.slice(startIndex, startIndex + page_size);
  }, [filtered_and_sorted_data, current_page, page_size]);

  const total_pages = Math.ceil(filtered_and_sorted_data.length / page_size);

  const handle_sort = (field: SortField) => {
    if (sort_field === field) {
      set_sort_direction(sort_direction === 'asc' ? 'desc' : 'asc');
    } else {
      set_sort_field(field);
      set_sort_direction('desc');
    }
  };

  const get_sort_icon = (field: SortField) => {
    if (sort_field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sort_direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const format_cell_value = (value: any, field: string): string => {
    if (value === null || value === undefined) return 'N/A';

    switch (field) {
      case 'total_distance':
        return typeof value === 'number' ? `${value.toFixed(1)} km` : value;
      case 'total_time':
        return typeof value === 'number' ? `${Math.round(value / 3600)}h ${Math.round((value % 3600) / 60)}m` : value;
      case 'efficiency':
        return typeof value === 'number' ? `${value.toFixed(1)} km/shipment` : value;
      case 'fuel':
        return typeof value === 'number' ? `${value.toFixed(1)} L` : value;
      case 'average_speed':
        return typeof value === 'number' ? `${value.toFixed(1)} km/h` : value;
      default:
        return String(value);
    }
  };

  const get_performance_badge = (value: number, field: string) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";

    switch (field) {
      case 'average_speed':
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

  const render_table_content = () => {
    if (paginated_data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={show_sorting ? 8 : 7} className="text-center py-8 text-muted-foreground">
            {search_term ? 'No data found matching your search' : 'No route data available'}
          </TableCell>
        </TableRow>
      );
    }

    return paginated_data.map((item, index) => (
      <TableRow
        key={item.id || `${item.employee_id}-${index}`}
        className={on_row_click ? 'cursor-pointer hover:bg-muted/50' : ''}
        onClick={() => on_row_click?.(item)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div>{item.employee_name || `Employee ${item.employee_id}`}</div>
              <div className="text-xs text-muted-foreground">{item.employee_id}</div>
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
            {format_cell_value(item.total_distance, 'total_distance')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            {format_cell_value(item.total_time, 'total_time')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            {format_cell_value(item.average_speed, 'average_speed')}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.shipments_completed || 0}</span>
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-orange-600" />
            {format_cell_value(item.fuel_consumption, 'fuel')}
          </div>
        </TableCell>

        <TableCell>
          <Badge variant={get_performance_badge(item.efficiency || 0, 'efficiency')}>
            {format_cell_value(item.efficiency, 'efficiency')}
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
            {title || `Route ${data_type.charAt(0).toUpperCase() + data_type.slice(1)}`}
          </CardTitle>

          {show_search && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search routes..."
                value={search_term}
                onChange={(e) => set_search_term(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          )}
        </div>

        {data.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Showing {paginated_data.length} of {filtered_and_sorted_data.length} routes
            {filtered_and_sorted_data.length !== data.length && ` (filtered from ${data.length} total)`}
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
                  {show_sorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handle_sort('date')}
                      className="h-auto p-0 font-semibold"
                    >
                      Date
                      {get_sort_icon('date')}
                    </Button>
                  )}
                  {!show_sorting && 'Date'}
                </TableHead>
                <TableHead>
                  {show_sorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handle_sort('total_distance')}
                      className="h-auto p-0 font-semibold"
                    >
                      Distance
                      {get_sort_icon('total_distance')}
                    </Button>
                  )}
                  {!show_sorting && 'Distance'}
                </TableHead>
                <TableHead>
                  {show_sorting && (
                    <Button
                      variant="ghost"
                      onClick={() => handle_sort('total_time')}
                      className="h-auto p-0 font-semibold"
                    >
                      Duration
                      {get_sort_icon('total_time')}
                    </Button>
                  )}
                  {!show_sorting && 'Duration'}
                </TableHead>
                <TableHead>Avg Speed</TableHead>
                <TableHead>Shipments</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead>Efficiency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {render_table_content()}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {paginated_data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search_term ? 'No data found matching your search' : 'No route data available'}
            </div>
          ) : (
            paginated_data.map((item, index) => (
              <Card
                key={item.id || `${item.employee_id}-${index}`}
                className="p-4"
                onClick={() => on_row_click?.(item)}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-semibold">
                        {item.employee_name || `Employee ${item.employee_id}`}
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
                          {format_cell_value(item.total_distance, 'total_distance')}
                        </p>
                        <p className="text-xs text-muted-foreground">Distance</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {format_cell_value(item.total_time, 'total_time')}
                        </p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {format_cell_value(item.average_speed, 'average_speed')}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Speed</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {item.shipments_completed || 0}
                      </span>
                      <p className="text-xs text-muted-foreground">Shipments</p>
                    </div>
                  </div>

                  {/* Performance Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={get_performance_badge(item.efficiency || 0, 'efficiency')} className="text-xs">
                      {format_cell_value(item.efficiency, 'efficiency')}
                    </Badge>
                    {item.fuel_consumption ? (
                      <Badge variant="outline" className="text-xs">
                        {format_cell_value(item.fuel_consumption, 'fuel')}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {total_pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {current_page} of {total_pages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => set_current_page(prev => Math.max(1, prev - 1))}
                disabled={current_page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => set_current_page(prev => Math.min(total_pages, prev + 1))}
                disabled={current_page === total_pages}
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
