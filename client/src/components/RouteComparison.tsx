import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { withChartErrorBoundary } from '@/components/ErrorBoundary';
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

interface RouteMetrics {
  distance: number;
  duration: number;
  averageSpeed: number;
  shipmentsCompleted: number;
  fuelConsumption: number;
  efficiency: number; // km per shipment
  startTime: string;
  endTime: string;
}

interface RouteSession {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  metrics: RouteMetrics;
  points: number;
  status: 'completed' | 'active' | 'paused';
}

interface ComparisonMetric {
  name: string;
  icon: React.ReactNode;
  unit: string;
  getValue: (session: RouteSession) => number;
  format: (value: number) => string;
  higherIsBetter: boolean;
}

interface RouteComparisonProps {
  sessions: RouteSession[];
  onSessionSelect?: (sessionId: string) => void;
  onOptimizationSuggestion?: (suggestion: string) => void;
}

function RouteComparison({
  sessions,
  onSessionSelect,
  onOptimizationSuggestion
}: RouteComparisonProps) {
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [sortBy, setSortBy] = useState<'efficiency' | 'distance' | 'duration' | 'speed'>('efficiency');
  const [filterBy, setFilterBy] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const comparisonMetrics: ComparisonMetric[] = [
    {
      name: 'Distance',
      icon: <Route className="h-4 w-4" />,
      unit: 'km',
      getValue: (session) => session.metrics.distance,
      format: (value) => `${value.toFixed(1)} km`,
      higherIsBetter: false
    },
    {
      name: 'Duration',
      icon: <Clock className="h-4 w-4" />,
      unit: 'hours',
      getValue: (session) => session.metrics.duration / 3600,
      format: (value) => {
        const hours = Math.floor(value);
        const minutes = Math.floor((value % 1) * 60);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      },
      higherIsBetter: false
    },
    {
      name: 'Average Speed',
      icon: <Gauge className="h-4 w-4" />,
      unit: 'km/h',
      getValue: (session) => session.metrics.averageSpeed,
      format: (value) => `${value.toFixed(1)} km/h`,
      higherIsBetter: true
    },
    {
      name: 'Shipments',
      icon: <MapPin className="h-4 w-4" />,
      unit: 'count',
      getValue: (session) => session.metrics.shipmentsCompleted,
      format: (value) => `${Math.round(value)}`,
      higherIsBetter: true
    },
    {
      name: 'Efficiency',
      icon: <Target className="h-4 w-4" />,
      unit: 'km/shipment',
      getValue: (session) => session.metrics.efficiency,
      format: (value) => `${value.toFixed(2)} km/shipment`,
      higherIsBetter: false
    },
    {
      name: 'Fuel Consumption',
      icon: <Zap className="h-4 w-4" />,
      unit: 'L',
      getValue: (session) => session.metrics.fuelConsumption,
      format: (value) => `${value.toFixed(1)} L`,
      higherIsBetter: false
    }
  ];

  const filteredSessions = useMemo(() => {
    let filtered = sessions.filter(session => session.status === 'completed');

    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (filterBy) {
      case 'today':
        filtered = filtered.filter(session => new Date(session.date) >= today);
        break;
      case 'week':
        filtered = filtered.filter(session => new Date(session.date) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(session => new Date(session.date) >= monthAgo);
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'efficiency':
          return a.metrics.efficiency - b.metrics.efficiency;
        case 'distance':
          return a.metrics.distance - b.metrics.distance;
        case 'duration':
          return a.metrics.duration - b.metrics.duration;
        case 'speed':
          return b.metrics.averageSpeed - a.metrics.averageSpeed;
        default:
          return 0;
      }
    });

    return filtered;
  }, [sessions, filterBy, sortBy]);

  const selectedSessionsData = useMemo(() => {
    return selectedSessions.map(id => filteredSessions.find(s => s.id === id)).filter(Boolean) as RouteSession[];
  }, [selectedSessions, filteredSessions]);

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions(prev => {
      if (prev.includes(sessionId)) {
        return prev.filter(id => id !== sessionId);
      } else if (prev.length < 4) { // Limit to 4 sessions for comparison
        return [...prev, sessionId];
      }
      return prev;
    });
  };

  const getComparisonValue = (session: RouteSession, metric: ComparisonMetric, baseline?: RouteSession) => {
    const value = metric.getValue(session);
    if (!baseline) return { value, trend: 'neutral' as const, percentage: 0 };

    const baselineValue = metric.getValue(baseline);
    const percentage = baselineValue !== 0 ? ((value - baselineValue) / baselineValue) * 100 : 0;

    let trend: 'better' | 'worse' | 'neutral' = 'neutral';
    if (Math.abs(percentage) > 5) { // 5% threshold for significance
      if (metric.higherIsBetter) {
        trend = percentage > 0 ? 'better' : 'worse';
      } else {
        trend = percentage < 0 ? 'better' : 'worse';
      }
    }

    return { value, trend, percentage };
  };

  const getTrendIcon = (trend: 'better' | 'worse' | 'neutral') => {
    switch (trend) {
      case 'better':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'worse':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };

  const generateOptimizationSuggestions = (): string[] => {
    if (selectedSessionsData.length < 2) return [];

    const suggestions: string[] = [];
    const bestSession = selectedSessionsData.reduce((best, current) =>
      current.metrics.efficiency < best.metrics.efficiency ? current : best
    );

    const worstSession = selectedSessionsData.reduce((worst, current) =>
      current.metrics.efficiency > worst.metrics.efficiency ? current : worst
    );

    if (bestSession.id !== worstSession.id) {
      const efficiencyDiff = ((worstSession.metrics.efficiency - bestSession.metrics.efficiency) / bestSession.metrics.efficiency) * 100;

      if (efficiencyDiff > 20) {
        suggestions.push(`${worstSession.employeeName} could improve efficiency by ${efficiencyDiff.toFixed(1)}% by following ${bestSession.employeeName}'s route patterns`);
      }

      if (bestSession.metrics.averageSpeed > worstSession.metrics.averageSpeed * 1.15) {
        suggestions.push(`Consider route optimization for ${worstSession.employeeName} - average speed is ${((bestSession.metrics.averageSpeed / worstSession.metrics.averageSpeed - 1) * 100).toFixed(1)}% higher in best performing routes`);
      }

      if (worstSession.metrics.distance > bestSession.metrics.distance * 1.2) {
        suggestions.push(`${worstSession.employeeName}'s routes are ${((worstSession.metrics.distance / bestSession.metrics.distance - 1) * 100).toFixed(1)}% longer - consider route consolidation`);
      }
    }

    return suggestions;
  };

  const optimizationSuggestions = generateOptimizationSuggestions();

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
              {selectedSessions.length}/4 selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Date</label>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
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
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
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
              <Select value={comparisonMode} onValueChange={(value: any) => setComparisonMode(value)}>
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
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 border rounded-md cursor-pointer transition-colors ${selectedSessions.includes(session.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => handleSessionToggle(session.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-sm">{session.employeeName}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {session.metrics.efficiency.toFixed(1)} km/shipment
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(session.date).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Distance:</span>
                    <span className="ml-1 font-medium">{session.metrics.distance.toFixed(1)}km</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Shipments:</span>
                    <span className="ml-1 font-medium">{session.metrics.shipmentsCompleted}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {selectedSessionsData.length > 1 && (
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
                    {selectedSessionsData.map((session, index) => {
                      const baseline = index === 0 ? undefined : selectedSessionsData[0];
                      const comparison = getComparisonValue(session, metric, baseline);

                      return (
                        <div
                          key={session.id}
                          className={`p-3 rounded-md border ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{session.employeeName}</span>
                            {index > 0 && getTrendIcon(comparison.trend)}
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
      {optimizationSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optimizationSuggestions.map((suggestion, index) => (
                <Alert key={index}>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>{suggestion}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOptimizationSuggestion?.(suggestion)}
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
      {filteredSessions.length === 0 && (
        <Alert>
          <BarChart3 className="h-4 w-4" />
          <AlertDescription>
            No completed route sessions available for comparison. Complete some routes with GPS tracking to analyze performance.
          </AlertDescription>
        </Alert>
      )}

      {/* Selection Prompt */}
      {filteredSessions.length > 0 && selectedSessions.length < 2 && (
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