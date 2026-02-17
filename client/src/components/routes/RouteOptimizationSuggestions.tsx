import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RouteData, OptimizationSuggestion } from '@shared/types';
import StatCard from '@/components/ui/StatCard';
import {
  Target,
  Route,
  Clock,
  MapPin,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Fuel,
  Users
} from 'lucide-react';

interface RouteOptimizationSuggestionsProps {
  route_data: RouteData[];
  on_implement_suggestion?: (suggestionId: string) => void;
  on_view_route_details?: (routeId: string) => void;
}

export default function RouteOptimizationSuggestions({
  route_data,
  on_implement_suggestion,
  on_view_route_details: _on_view_route_details
}: RouteOptimizationSuggestionsProps) {
  const [selected_priority, set_selected_priority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selected_type] = useState<'all' | OptimizationSuggestion['type']>('all');
  const [implemented_suggestions, set_implemented_suggestions] = useState<Set<string>>(new Set());

  const suggestions = useMemo((): OptimizationSuggestion[] => {
    if (route_data.length === 0) return [];

    const suggestions: OptimizationSuggestion[] = [];

    // Analyze route efficiency patterns
    const employee_stats = route_data.reduce((acc, route) => {
      if (!acc[route.employee_id]) {
        acc[route.employee_id] = {
          name: route.employee_name,
          routes: [],
          total_distance: 0,
          total_time: 0,
          total_shipments: 0,
          total_fuel: 0
        };
      }

      acc[route.employee_id].routes.push(route);
      acc[route.employee_id].total_distance += route.total_distance;
      acc[route.employee_id].total_time += route.total_time;
      acc[route.employee_id].total_shipments += route.shipments_completed;
      acc[route.employee_id].total_fuel += route.fuel_consumption;

      return acc;
    }, {} as Record<string, {
      name: string;
      routes: RouteData[];
      total_distance: number;
      total_time: number;
      total_shipments: number;
      total_fuel: number;
    }>);

    const employees = Object.values(employee_stats);

    // Calculate averages for benchmarking
    const avg_efficiency = route_data.reduce((sum, route) => sum + route.efficiency, 0) / route_data.length;
    const avg_speed = route_data.reduce((sum, route) => sum + route.average_speed, 0) / route_data.length;
    const avg_fuel_per_km = route_data.reduce((sum, route) => sum + (route.fuel_consumption / route.total_distance), 0) / route_data.length;

    // 1. Route Consolidation Opportunities
    employees.forEach(employee => {
      const avgRouteDistance = employee.total_distance / employee.routes.length;
      const avgShipmentsPerRoute = employee.total_shipments / employee.routes.length;

      if (avgRouteDistance < 5 && avgShipmentsPerRoute < 3) {
        suggestions.push({
          id: `consolidation_${employee.name}`,
          type: 'route_consolidation',
          priority: 'high',
          title: `Consolidate ${employee.name}'s Short Routes`,
          description: `${employee.name} has multiple short routes (avg ${avgRouteDistance.toFixed(1)}km) with few shipments. Consolidating could reduce total distance by 15-25%.`,
          potential_savings: {
            distance: employee.total_distance * 0.2,
            time: (employee.total_time * 0.15) / 60,
            fuel: employee.total_fuel * 0.2,
            cost: employee.total_fuel * 0.2 * 1.5 // Assuming $1.5 per liter
          },
          confidence: 85,
          affected_employees: [employee.name],
          implementation: 'Combine nearby deliveries into single routes, optimize pickup sequences',
          effort: 'medium'
        });
      }
    });

    // 2. Speed Optimization
    employees.forEach(employee => {
      const employeeAvgSpeed = employee.routes.reduce((sum: number, route: RouteData) => sum + route.average_speed, 0) / employee.routes.length;

      if (employeeAvgSpeed < avg_speed * 0.8) {
        const speed_diff = avg_speed - employeeAvgSpeed;
        suggestions.push({
          id: `speed_${employee.name}`,
          type: 'speed_optimization',
          priority: speed_diff > 5 ? 'high' : 'medium',
          title: `Improve ${employee.name}'s Route Speed`,
          description: `${employee.name}'s average speed (${employeeAvgSpeed.toFixed(1)} km/h) is ${speed_diff.toFixed(1)} km/h below average. Route optimization could improve efficiency.`,
          potential_savings: {
            time: (employee.total_time * 0.1) / 60,
            fuel: employee.total_fuel * 0.05
          },
          confidence: 70,
          affected_employees: [employee.name],
          implementation: 'Analyze traffic patterns, suggest optimal departure times, review route planning',
          effort: 'low'
        });
      }
    });

    // 3. Fuel Efficiency Improvements
    employees.forEach(employee => {
      const employeeFuelPerKm = employee.total_fuel / employee.total_distance;

      if (employeeFuelPerKm > avg_fuel_per_km * 1.15) {
        suggestions.push({
          id: `fuel_${employee.name}`,
          type: 'fuel_efficiency',
          priority: 'medium',
          title: `Reduce ${employee.name}'s Fuel Consumption`,
          description: `${employee.name} uses ${((employeeFuelPerKm / avg_fuel_per_km - 1) * 100).toFixed(1)}% more fuel per km than average. Driver training and route optimization could help.`,
          potential_savings: {
            fuel: employee.total_fuel * 0.15,
            cost: employee.total_fuel * 0.15 * 1.5
          },
          confidence: 65,
          affected_employees: [employee.name],
          implementation: 'Eco-driving training, vehicle maintenance check, route smoothness analysis',
          effort: 'low'
        });
      }
    });

    // 4. Distance Reduction Opportunities
    const inefficientRoutes = route_data.filter(route => route.efficiency > avg_efficiency * 1.2);
    if (inefficientRoutes.length > 0) {
      const affected_employees = Array.from(new Set(inefficientRoutes.map(r => r.employee_name)));
      const totalExcessDistance = inefficientRoutes.reduce((sum, route) =>
        sum + (route.total_distance - (route.shipments_completed * avg_efficiency)), 0
      );

      suggestions.push({
        id: 'distance_reduction_global',
        type: 'distance_reduction',
        priority: 'high',
        title: 'Optimize High-Distance Routes',
        description: `${inefficientRoutes.length} routes show excessive distance per shipment. Geographic clustering could reduce total distance by ${totalExcessDistance.toFixed(1)}km.`,
        potential_savings: {
          distance: totalExcessDistance,
          fuel: totalExcessDistance * avg_fuel_per_km,
          cost: totalExcessDistance * avg_fuel_per_km * 1.5
        },
        confidence: 80,
        affected_employees,
        implementation: 'Implement geographic clustering algorithm, redistribute shipments by location',
        effort: 'high'
      });
    }

    // 5. Time Management Optimization
    const longDurationRoutes = route_data.filter(route => route.total_time > 8 * 3600); // > 8 hours
    if (longDurationRoutes.length > 0) {
      suggestions.push({
        id: 'time_management',
        type: 'time_management',
        priority: 'medium',
        title: 'Optimize Long Duration Routes',
        description: `${longDurationRoutes.length} routes exceed 8 hours. Breaking these into multiple shorter routes could improve efficiency and driver satisfaction.`,
        potential_savings: {
          time: longDurationRoutes.reduce((sum, route) => sum + Math.max(0, route.total_time - 8 * 3600), 0) / 60
        },
        confidence: 75,
        affected_employees: Array.from(new Set(longDurationRoutes.map(r => r.employee_name))),
        implementation: 'Split long routes, add intermediate breaks, optimize delivery windows',
        effort: 'medium'
      });
    }

    return suggestions;
  }, [route_data]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => {
      if (selected_priority !== 'all' && suggestion.priority !== selected_priority) {
        return false;
      }
      if (selected_type !== 'all' && suggestion.type !== selected_type) {
        return false;
      }
      return true;
    });
  }, [suggestions, selected_priority, selected_type]);

  const total_potential_savings = useMemo(() => {
    return filteredSuggestions.reduce((acc, suggestion) => {
      return {
        distance: (acc.distance || 0) + (suggestion.potential_savings.distance || 0),
        time: (acc.time || 0) + (suggestion.potential_savings.time || 0),
        fuel: (acc.fuel || 0) + (suggestion.potential_savings.fuel || 0),
        cost: (acc.cost || 0) + (suggestion.potential_savings.cost || 0)
      };
    }, {
      distance: 0,
      time: 0,
      fuel: 0,
      cost: 0
    });
  }, [filteredSuggestions]);

  const handle_implement_suggestion = (suggestionId: string) => {
    set_implemented_suggestions(prev => new Set(Array.from(prev).concat(suggestionId)));
    on_implement_suggestion?.(suggestionId);
  };

  const get_suggestion_icon = (type: OptimizationSuggestion['type']) => {
    switch (type) {
      case 'route_consolidation':
        return <Route className="h-4 w-4" />;
      case 'speed_optimization':
        return <Navigation className="h-4 w-4" />;
      case 'fuel_efficiency':
        return <Fuel className="h-4 w-4" />;
      case 'time_management':
        return <Clock className="h-4 w-4" />;
      case 'distance_reduction':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const get_priority_color = (priority: OptimizationSuggestion['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const get_effort_color = (effort: OptimizationSuggestion['effort']) => {
    switch (effort) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <span>Route Optimization Suggestions</span>
            </div>
            <Badge variant="outline">
              {filteredSuggestions.length} suggestions
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Potential Savings Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              title="Distance Savings"
              value={`${total_potential_savings.distance?.toFixed(1) || '0'}km`}
              valueColor="text-2xl font-bold text-blue-600"
              titleColor="text-sm text-gray-600"
              testId="stat-distance-savings"
            />
            <StatCard
              title="Time Savings"
              value={`${total_potential_savings.time?.toFixed(0) || '0'}min`}
              valueColor="text-2xl font-bold text-green-600"
              titleColor="text-sm text-gray-600"
              testId="stat-time-savings"
            />
            <StatCard
              title="Fuel Savings"
              value={`${total_potential_savings.fuel?.toFixed(1) || '0'}L`}
              valueColor="text-2xl font-bold text-orange-600"
              titleColor="text-sm text-gray-600"
              testId="stat-fuel-savings"
            />
            <StatCard
              title="Cost Savings"
              value={`$${total_potential_savings.cost?.toFixed(0) || '0'}`}
              valueColor="text-2xl font-bold text-purple-600"
              titleColor="text-sm text-gray-600"
              testId="stat-cost-savings"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex gap-2">
              <span className="text-sm font-medium">Priority:</span>
              {['all', 'high', 'medium', 'low'].map((priority) => (
                <Button
                  key={priority}
                  variant={selected_priority === priority ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => set_selected_priority(priority as 'all' | 'high' | 'medium' | 'low')}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <div className="space-y-4">
        {filteredSuggestions.map((suggestion) => (
          <Card key={suggestion.id} className={implemented_suggestions.has(suggestion.id) ? 'opacity-60' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-md">
                    {get_suggestion_icon(suggestion.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{suggestion.title}</h3>
                      <Badge className={get_priority_color(suggestion.priority)}>
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>

                    {/* Potential Savings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {suggestion.potential_savings.distance && (
                        <div className="text-xs">
                          <span className="text-gray-500">Distance:</span>
                          <span className="ml-1 font-medium">{suggestion.potential_savings.distance.toFixed(1)}km</span>
                        </div>
                      )}
                      {suggestion.potential_savings.time && (
                        <div className="text-xs">
                          <span className="text-gray-500">Time:</span>
                          <span className="ml-1 font-medium">{suggestion.potential_savings.time.toFixed(0)}min</span>
                        </div>
                      )}
                      {suggestion.potential_savings.fuel && (
                        <div className="text-xs">
                          <span className="text-gray-500">Fuel:</span>
                          <span className="ml-1 font-medium">{suggestion.potential_savings.fuel.toFixed(1)}L</span>
                        </div>
                      )}
                      {suggestion.potential_savings.cost && (
                        <div className="text-xs">
                          <span className="text-gray-500">Cost:</span>
                          <span className="ml-1 font-medium">${suggestion.potential_savings.cost.toFixed(0)}</span>
                        </div>
                      )}
                    </div>

                    {/* Implementation Details */}
                    <div className="text-xs text-gray-600 mb-2">
                      <strong>Implementation:</strong> {suggestion.implementation}
                    </div>

                    {/* Affected Employees */}
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        Affects: {suggestion.affected_employees.join(', ')}
                      </span>
                    </div>

                    {/* Effort Level */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Effort:</span>
                      <span className={`text-xs font-medium ${get_effort_color(suggestion.effort)}`}>
                        {suggestion.effort.charAt(0).toUpperCase() + suggestion.effort.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {implemented_suggestions.has(suggestion.id) ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Implemented
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handle_implement_suggestion(suggestion.id)}
                    >
                      Implement
                    </Button>
                  )}

                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Confidence</div>
                    <Progress value={suggestion.confidence} className="w-16 h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Suggestions State */}
      {filteredSuggestions.length === 0 && suggestions.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No suggestions match the current filters. Try adjusting the priority or type filters.
          </AlertDescription>
        </Alert>
      )}

      {/* No Data State */}
      {suggestions.length === 0 && (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            No optimization suggestions available. Complete more routes with GPS tracking to generate insights and recommendations.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}