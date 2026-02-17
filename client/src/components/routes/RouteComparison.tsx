import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
import { RouteSession } from '@shared/types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Route,
  Clock,
  Gauge,
  MapPin,
  Zap,
  Target,
  BarChart3,
  Calendar,
  User
} from 'lucide-react';

interface ComparisonMetric {
  name: string;
  icon: React.ReactNode;
  unit: string;
  get_value: (session: RouteSession) => number;
  format: (value: number) => string;
  higher_is_better: boolean;
}

interface RouteComparisonProps {
  sessions: RouteSession[];
  on_session_select?: (sessionId: string) => void;
  on_optimization_suggestion?: (suggestion: string) => void;
}

function RouteComparison({
  sessions,
  on_session_select: _on_session_select,
  on_optimization_suggestion
}: RouteComparisonProps) {
  const [selected_sessions, set_selected_sessions] = useState<string[]>([]);
  const [comparison_mode, set_comparison_mode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [sort_by, set_sort_by] = useState<'efficiency' | 'distance' | 'duration' | 'speed'>('efficiency');
  const [filter_by, set_filter_by] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const comparisonMetrics: ComparisonMetric[] = [
    {
      name: 'Distance',
      icon: <Route className="h-4 w-4" />,
      unit: 'km',
      get_value: (session) => session.total_distance || 0,
      format: (value) => `${value.toFixed(1)} km`,
      higher_is_better: false
    },
    {
      name: 'Duration',
      icon: <Clock className="h-4 w-4" />,
      unit: 'hours',
      get_value: (session) => (session.total_time || 0) / 3600,
      format: (value) => {
        const hours = Math.floor(value);
        const minutes = Math.floor((value % 1) * 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      },
      higher_is_better: false
    },
    {
      name: 'Average Speed',
      icon: <Gauge className="h-4 w-4" />,
      unit: 'km/h',
      get_value: (session) => session.average_speed || 0,
      format: (value) => `${value.toFixed(1)} km/h`,
      higher_is_better: true
    },
    {
      name: 'Shipments',
      icon: <MapPin className="h-4 w-4" />,
      unit: 'count',
      get_value: (session) => session.shipments_completed || 0,
      format: (value) => `${Math.round(value)}`,
      higher_is_better: true
    },
    {
      name: 'Efficiency',
      icon: <Target className="h-4 w-4" />,
      unit: 'km/shipment',
      get_value: (session) => {
        const distance = session.total_distance || 0;
        const shipments = session.shipments_completed || 1;
        return distance / shipments;
      },
      format: (value) => `${value.toFixed(2)} km/shipment`,
      higher_is_better: false
    },
    {
      name: 'Fuel Consumption',
      icon: <Zap className="h-4 w-4" />,
      unit: 'L',
      get_value: (session) => {
        // Calculate estimated fuel consumption based on distance and average efficiency
        const distance = session.total_distance || 0;
        const estimatedFuelEfficiency = 8; // km per liter (default estimate)
        return distance / estimatedFuelEfficiency;
      },
      format: (value) => `${value.toFixed(1)} L`,
      higher_is_better: false
    }
  ];

  const filtered_sessions = useMemo(() => {
    let filtered = sessions.filter(session => session.status === 'completed');

    // Apply date filter using start_time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (filter_by) {
      case 'today':
        filtered = filtered.filter(session => new Date(session.start_time) >= today);
        break;
      case 'week':
        filtered = filtered.filter(session => new Date(session.start_time) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(session => new Date(session.start_time) >= monthAgo);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort_by) {
        case 'efficiency': {
          const aEfficiency = (a.total_distance || 0) / (a.shipments_completed || 1);
          const bEfficiency = (b.total_distance || 0) / (b.shipments_completed || 1);
          return aEfficiency - bEfficiency;
        }
        case 'distance':
          return (a.total_distance || 0) - (b.total_distance || 0);
        case 'duration':
          return (a.total_time || 0) - (b.total_time || 0);
        case 'speed':
          return (b.average_speed || 0) - (a.average_speed || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [sessions, filter_by, sort_by]);

  const selected_sessions_data = useMemo(() => {
    return selected_sessions.map(id => filtered_sessions.find(s => s.id === id)).filter(Boolean) as RouteSession[];
  }, [selected_sessions, filtered_sessions]);

  const handle_session_toggle = (sessionId: string) => {
    set_selected_sessions(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId);
      } else if (prev.length < 4) { // Limit to 4 sessions for comparison
        return [...prev, sessionId];
      }
      return prev;
    });
  };

  const get_comparison_value = (session: RouteSession, metric: ComparisonMetric, baseline?: RouteSession) => {
    const value = metric.get_value(session);
    if (!baseline) return { value, trend: 'neutral' as const, percentage: 0 };

    const baselineValue = metric.get_value(baseline);
    const percentage = baselineValue !== 0 ? ((value - baselineValue) / baselineValue) * 100 : 0;

    let trend: 'better' | 'worse' | 'neutral' = 'neutral';
    if (Math.abs(percentage) > 5) { // 5% threshold for significance
      if (metric.higher_is_better) {
        trend = percentage > 0 ? 'better' : 'worse';
      } else {
        trend = percentage < 0 ? 'better' : 'worse';
      }
    }

    return { value, trend, percentage };
  };

  const get_trend_icon = (trend: 'better' | 'worse' | 'neutral') => {
    switch (trend) {
      case 'better':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'worse':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const generate_optimization_suggestions = (): string[] => {
    if (selected_sessions_data.length < 2) return [];

    const suggestions: string[] = [];

    // Calculate efficiency for each session
    const sessionsWithEfficiency = selected_sessions_data.map(session => ({
      ...session,
      efficiency: (session.total_distance || 0) / (session.shipments_completed || 1)
    }));

    const bestSession = sessionsWithEfficiency.reduce((best, current) =>
      current.efficiency < best.efficiency ? current : best
    );

    const worstSession = sessionsWithEfficiency.reduce((worst, current) =>
      current.efficiency > worst.efficiency ? current : worst
    );

    if (bestSession.id !== worstSession.id) {
      const efficiencyDiff = ((worstSession.efficiency - bestSession.efficiency) / bestSession.efficiency) * 100;

      if (efficiencyDiff > 20) {
        suggestions.push(`${worstSession.employee_name || 'Employee'} could improve efficiency by ${efficiencyDiff.toFixed(1)}% by following ${bestSession.employee_name || 'best performer'}'s route patterns`);
      }

      const bestSpeed = bestSession.average_speed || 0;
      const worstSpeed = worstSession.average_speed || 0;

      if (bestSpeed > worstSpeed * 1.15) {
        suggestions.push(`Consider route optimization for ${worstSession.employee_name || 'employee'} - average speed is ${((bestSpeed / (worstSpeed || 1) - 1) * 100).toFixed(1)}% higher in best performing routes`);
      }

      if ((worstSession.total_distance || 0) > (bestSession.total_distance || 0) * 1.2) {
        suggestions.push(`${worstSession.employee_name || 'Employee'}'s routes are ${(((worstSession.total_distance || 0) / (bestSession.total_distance || 1) - 1) * 100).toFixed(1)}% longer - consider route consolidation`);
      }
    }

    return suggestions;
  };

  const optimization_suggestions = generate_optimization_suggestions();

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span>Route Comparison</span>
            </div>
            <Badge variant="outline">
              {selected_sessions.length}/4 selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Date</label>
              <Select value={filter_by} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => set_filter_by(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Sort by</label>
              <Select value={sort_by} onValueChange={(value: 'efficiency' | 'distance' | 'duration' | 'speed') => set_sort_by(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efficiency">Efficiency</SelectItem>
                  <SelectItem value="distance">Distance</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="speed">Speed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Comparison Mode</label>
              <Select value={comparison_mode} onValueChange={(value: 'side-by-side' | 'overlay') => set_comparison_mode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="side-by-side">Side by Side</SelectItem>
                  <SelectItem value="overlay">Overlay</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Routes to Compare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {filtered_sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${selected_sessions.includes(session.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => handle_session_toggle(session.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-sm">{session.employee_name || 'Unknown'}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {((session.total_distance || 0) / (session.shipments_completed || 1)).toFixed(1)} km/shipment
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(session.start_time).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Distance:</span>
                    <span className="ml-1 font-medium">{(session.total_distance || 0).toFixed(1)}km</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Shipments:</span>
                    <span className="ml-1 font-medium">{session.shipments_completed || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {selected_sessions_data.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Comparison Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {comparisonMetrics.map((metric) => (
                <div key={metric.name} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {metric.icon}
                    <h4 className="font-medium">{metric.name}</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {selected_sessions_data.map((session, index) => {
                      const baseline = index === 0 ? undefined : selected_sessions_data[0];
                      const comparison = get_comparison_value(session, metric, baseline);

                      return (
                        <div
                          key={session.id}
                          className={`p-3 rounded-md border ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{session.employee_name}</span>
                            {index > 0 && get_trend_icon(comparison.trend)}
                          </div>
                          <div className="text-lg font-bold">
                            {metric.format(comparison.value)}
                          </div>
                          {index > 0 && Math.abs(comparison.percentage) > 1 && (
                            <div className={`text-xs ${comparison.trend === 'better' ? 'text-green-600' :
                              comparison.trend === 'worse' ? 'text-red-600' :
                                'text-gray-500'
                              }`}>
                              {comparison.percentage > 0 ? '+' : ''}{comparison.percentage.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Suggestions */}
      {optimization_suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optimization_suggestions.map((suggestion, index) => (
                <Alert key={index}>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{suggestion}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => on_optimization_suggestion?.(suggestion)}
                    >
                      Apply
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {filtered_sessions.length === 0 && (
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            No completed route sessions available for comparison. Complete some routes with GPS tracking to analyze performance.
          </AlertDescription>
        </Alert>
      )}

      {/* Selection Prompt */}
      {filtered_sessions.length > 0 && selected_sessions.length < 2 && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            Select at least 2 routes to start comparing performance metrics and get optimization suggestions.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} export default withChartErrorBoundary(RouteComparison, {
  componentName: 'RouteComparison'
});