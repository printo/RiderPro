import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Target,
  TrendingUp,
  Route,
  Clock,
  Zap,
  MapPin,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Navigation,
  Fuel,
  Users
} from 'lucide-react';

interface RouteData {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  distance: number;
  duration: number;
  shipmentsCompleted: number;
  fuelConsumption: number;
  averageSpeed: number;
  efficiency: number; // km per shipment
  points: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
}

interface OptimizationSuggestion {
  id: string;
  type: 'route_consolidation' | 'speed_optimization' | 'fuel_efficiency' | 'time_management' | 'distance_reduction';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSavings: {
    distance?: number; // km
    time?: number; // minutes
    fuel?: number; // liters
    cost?: number; // currency
  };
  confidence: number; // 0-100
  affectedEmployees: string[];
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

interface RouteOptimizationSuggestionsProps {
  routeData: RouteData[];
  onImplementSuggestion?: (suggestionId: string) => void;
  onViewRouteDetails?: (routeId: string) => void;
}

export default function RouteOptimizationSuggestions({
  routeData,
  onImplementSuggestion,
  onViewRouteDetails
}: RouteOptimizationSuggestionsProps) {
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedType, setSelectedType] = useState<'all' | OptimizationSuggestion['type']>('all');
  const [implementedSuggestions, setImplementedSuggestions] = useState<Set<string>>(new Set());

  const suggestions = useMemo((): OptimizationSuggestion[] => {
    if (routeData.length === 0) return [];

    const suggestions: OptimizationSuggestion[] = [];

    // Analyze route efficiency patterns
    const employeeStats = routeData.reduce((acc, route) => {
      if (!acc[route.employeeId]) {
        acc[route.employeeId] = {
          name: route.employeeName,
          routes: [],
          totalDistance: 0,
          totalTime: 0,
          totalShipments: 0,
          totalFuel: 0
        };
      }

      acc[route.employeeId].routes.push(route);
      acc[route.employeeId].totalDistance += route.distance;
      acc[route.employeeId].totalTime += route.duration;
      acc[route.employeeId].totalShipments += route.shipmentsCompleted;
      acc[route.employeeId].totalFuel += route.fuelConsumption;

      return acc;
    }, {} as Record<string, any>);

    const employees = Object.values(employeeStats);

    // Calculate averages for benchmarking
    const avgEfficiency = routeData.reduce((sum, route) => sum + route.efficiency, 0) / routeData.length;
    const avgSpeed = routeData.reduce((sum, route) => sum + route.averageSpeed, 0) / routeData.length;
    const avgFuelPerKm = routeData.reduce((sum, route) => sum + (route.fuelConsumption / route.distance), 0) / routeData.length;

    // 1. Route Consolidation Opportunities
    employees.forEach(employee => {
      const avgRouteDistance = employee.totalDistance / employee.routes.length;
      const avgShipmentsPerRoute = employee.totalShipments / employee.routes.length;

      if (avgRouteDistance < 5 && avgShipmentsPerRoute < 3) {
        suggestions.push({
          id: `consolidation_${employee.name}`,
          type: 'route_consolidation',
          priority: 'high',
          title: `Consolidate ${employee.name}'s Short Routes`,
          description: `${employee.name} has multiple short routes (avg ${avgRouteDistance.toFixed(1)}km) with few shipments. Consolidating could reduce total distance by 15-25%.`,
          potentialSavings: {
            distance: employee.totalDistance * 0.2,
            time: (employee.totalTime * 0.15) / 60,
            fuel: employee.totalFuel * 0.2,
            cost: employee.totalFuel * 0.2 * 1.5 // Assuming $1.5 per liter
          },
          confidence: 85,
          affectedEmployees: [employee.name],
          implementation: 'Combine nearby deliveries into single routes, optimize pickup sequences',
          effort: 'medium'
        });
      }
    });

    // 2. Speed Optimization
    employees.forEach(employee => {
      const employeeAvgSpeed = employee.routes.reduce((sum: number, route: RouteData) => sum + route.averageSpeed, 0) / employee.routes.length;

      if (employeeAvgSpeed < avgSpeed * 0.8) {
        const speedDiff = avgSpeed - employeeAvgSpeed;
        suggestions.push({
          id: `speed_${employee.name}`,
          type: 'speed_optimization',
          priority: speedDiff > 5 ? 'high' : 'medium',
          title: `Improve ${employee.name}'s Route Speed`,
          description: `${employee.name}'s average speed (${employeeAvgSpeed.toFixed(1)} km/h) is ${speedDiff.toFixed(1)} km/h below average. Route optimization could improve efficiency.`,
          potentialSavings: {
            time: (employee.totalTime * 0.1) / 60,
            fuel: employee.totalFuel * 0.05
          },
          confidence: 70,
          affectedEmployees: [employee.name],
          implementation: 'Analyze traffic patterns, suggest optimal departure times, review route planning',
          effort: 'low'
        });
      }
    });

    // 3. Fuel Efficiency Improvements
    employees.forEach(employee => {
      const employeeFuelPerKm = employee.totalFuel / employee.totalDistance;

      if (employeeFuelPerKm > avgFuelPerKm * 1.15) {
        suggestions.push({
          id: `fuel_${employee.name}`,
          type: 'fuel_efficiency',
          priority: 'medium',
          title: `Reduce ${employee.name}'s Fuel Consumption`,
          description: `${employee.name} uses ${((employeeFuelPerKm / avgFuelPerKm - 1) * 100).toFixed(1)}% more fuel per km than average. Driver training and route optimization could help.`,
          potentialSavings: {
            fuel: employee.totalFuel * 0.15,
            cost: employee.totalFuel * 0.15 * 1.5
          },
          confidence: 65,
          affectedEmployees: [employee.name],
          implementation: 'Eco-driving training, vehicle maintenance check, route smoothness analysis',
          effort: 'low'
        });
      }
    });

    // 4. Distance Reduction Opportunities
    const inefficientRoutes = routeData.filter(route => route.efficiency > avgEfficiency * 1.2);
    if (inefficientRoutes.length > 0) {
      const affectedEmployees = Array.from(new Set(inefficientRoutes.map(r => r.employeeName)));
      const totalExcessDistance = inefficientRoutes.reduce((sum, route) =>
        sum + (route.distance - (route.shipmentsCompleted * avgEfficiency)), 0
      );

      suggestions.push({
        id: 'distance_reduction_global',
        type: 'distance_reduction',
        priority: 'high',
        title: 'Optimize High-Distance Routes',
        description: `${inefficientRoutes.length} routes show excessive distance per shipment. Geographic clustering could reduce total distance by ${totalExcessDistance.toFixed(1)}km.`,
        potentialSavings: {
          distance: totalExcessDistance,
          fuel: totalExcessDistance * avgFuelPerKm,
          cost: totalExcessDistance * avgFuelPerKm * 1.5
        },
        confidence: 80,
        affectedEmployees,
        implementation: 'Implement geographic clustering algorithm, redistribute shipments by location',
        effort: 'high'
      });
    }

    // 5. Time Management Optimization
    const longDurationRoutes = routeData.filter(route => route.duration > 8 * 3600); // > 8 hours
    if (longDurationRoutes.length > 0) {
      suggestions.push({
        id: 'time_management',
        type: 'time_management',
        priority: 'medium',
        title: 'Optimize Long Duration Routes',
        description: `${longDurationRoutes.length} routes exceed 8 hours. Breaking these into multiple shorter routes could improve efficiency and driver satisfaction.`,
        potentialSavings: {
          time: longDurationRoutes.reduce((sum, route) => sum + Math.max(0, route.duration - 8 * 3600), 0) / 60
        },
        confidence: 75,
        affectedEmployees: Array.from(new Set(longDurationRoutes.map(r => r.employeeName))),
        implementation: 'Split long routes, add intermediate breaks, optimize delivery windows',
        effort: 'medium'
      });
    }

    return suggestions;
  }, [routeData]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(suggestion => {
      if (selectedPriority !== 'all' && suggestion.priority !== selectedPriority) {
        return false;
      }
      if (selectedType !== 'all' && suggestion.type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [suggestions, selectedPriority, selectedType]);

  const totalPotentialSavings = useMemo(() => {
    return filteredSuggestions.reduce((acc, suggestion) => {
      return {
        distance: (acc.distance || 0) + (suggestion.potentialSavings.distance || 0),
        time: (acc.time || 0) + (suggestion.potentialSavings.time || 0),
        fuel: (acc.fuel || 0) + (suggestion.potentialSavings.fuel || 0),
        cost: (acc.cost || 0) + (suggestion.potentialSavings.cost || 0)
      };
    }, {} as any);
  }, [filteredSuggestions]);

  const handleImplementSuggestion = (suggestionId: string) => {
    setImplementedSuggestions(prev => new Set(Array.from(prev).concat(suggestionId)));
    onImplementSuggestion?.(suggestionId);
  };

  const getSuggestionIcon = (type: OptimizationSuggestion['type']) => {
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

  const getPriorityColor = (priority: OptimizationSuggestion['priority']) => {
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

  const getEffortColor = (effort: OptimizationSuggestion['effort']) => {
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
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalPotentialSavings.distance?.toFixed(1) || '0'}km
              </div>
              <div className="text-sm text-gray-600">Distance Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {totalPotentialSavings.time?.toFixed(0) || '0'}min
              </div>
              <div className="text-sm text-gray-600">Time Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {totalPotentialSavings.fuel?.toFixed(1) || '0'}L
              </div>
              <div className="text-sm text-gray-600">Fuel Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${totalPotentialSavings.cost?.toFixed(0) || '0'}
              </div>
              <div className="text-sm text-gray-600">Cost Savings</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex gap-2">
              <span className="text-sm font-medium">Priority:</span>
              {['all', 'high', 'medium', 'low'].map((priority) => (
                <Button
                  key={priority}
                  variant={selectedPriority === priority ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPriority(priority as any)}
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
          <Card key={suggestion.id} className={implementedSuggestions.has(suggestion.id) ? 'opacity-60' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-md">
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{suggestion.title}</h3>
                      <Badge className={getPriorityColor(suggestion.priority)}>
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>

                    {/* Potential Savings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {suggestion.potentialSavings.distance && (
                        <div className="text-xs">
                          <span className="text-gray-500">Distance:</span>
                          <span className="ml-1 font-medium">{suggestion.potentialSavings.distance.toFixed(1)}km</span>
                        </div>
                      )}
                      {suggestion.potentialSavings.time && (
                        <div className="text-xs">
                          <span className="text-gray-500">Time:</span>
                          <span className="ml-1 font-medium">{suggestion.potentialSavings.time.toFixed(0)}min</span>
                        </div>
                      )}
                      {suggestion.potentialSavings.fuel && (
                        <div className="text-xs">
                          <span className="text-gray-500">Fuel:</span>
                          <span className="ml-1 font-medium">{suggestion.potentialSavings.fuel.toFixed(1)}L</span>
                        </div>
                      )}
                      {suggestion.potentialSavings.cost && (
                        <div className="text-xs">
                          <span className="text-gray-500">Cost:</span>
                          <span className="ml-1 font-medium">${suggestion.potentialSavings.cost.toFixed(0)}</span>
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
                        Affects: {suggestion.affectedEmployees.join(', ')}
                      </span>
                    </div>

                    {/* Effort Level */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Effort:</span>
                      <span className={`text-xs font-medium ${getEffortColor(suggestion.effort)}`}>
                        {suggestion.effort.charAt(0).toUpperCase() + suggestion.effort.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {implementedSuggestions.has(suggestion.id) ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Implemented
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleImplementSuggestion(suggestion.id)}
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