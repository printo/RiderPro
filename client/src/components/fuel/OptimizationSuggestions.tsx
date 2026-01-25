import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader } from '@/components/ui/Loader';
import { 
  Lightbulb, 
  CheckCircle, 
  AlertCircle, 
  Info,
  TrendingUp,
  Leaf,
  DollarSign
} from 'lucide-react';

interface OptimizationSuggestionsProps {
  dateRange: [Date, Date];
  city?: string;
  vehicleType?: string;
}

interface Suggestion {
  id: string;
  type: 'efficiency' | 'cost' | 'emissions';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSaving: {
    fuel?: number;
    cost?: number;
    co2?: number;
    distance?: number;
  };
  recommendation: string;
  status: 'pending' | 'in-progress' | 'completed';
}

interface Stats {
  totalPotentialSavings: number;
  fuelSavings: number;
  co2Reduction: number;
  efficiencyImprovement: number;
  totalSuggestions: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export const OptimizationSuggestions: React.FC<OptimizationSuggestionsProps> = ({ 
  dateRange, 
  city, 
  vehicleType 
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchOptimizationData();
  }, [dateRange, city, vehicleType]);

  const fetchOptimizationData = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data - in a real app, this would come from an API
      const mockSuggestions: Suggestion[] = [
        {
          id: '1',
          type: 'efficiency',
          severity: 'high',
          title: 'Improve Fuel Efficiency',
          description: 'Some vehicles are showing below average fuel efficiency',
          potentialSaving: { 
            fuel: 125, 
            cost: 12500,
            co2: 375 
          },
          recommendation: 'Consider driver training programs and regular vehicle maintenance to improve fuel efficiency.',
          status: 'pending',
        },
        {
          id: '2',
          type: 'cost',
          severity: 'medium',
          title: 'Optimize Fuel Purchase',
          description: 'Fuel prices vary significantly by location and time of day',
          potentialSaving: { 
            cost: 8500 
          },
          recommendation: 'Implement a fuel card program with preferred stations and track purchases to identify cost-saving opportunities.',
          status: 'in-progress',
        },
        {
          id: '3',
          type: 'emissions',
          severity: 'low',
          title: 'Reduce Idling Time',
          description: 'Excessive idling is increasing fuel consumption and emissions',
          potentialSaving: { 
            fuel: 75, 
            cost: 7500,
            co2: 225 
          },
          recommendation: 'Implement an anti-idling policy and provide training to drivers on the impact of idling on fuel consumption.',
          status: 'pending',
        },
        {
          id: '4',
          type: 'efficiency',
          severity: 'medium',
          title: 'Optimize Vehicle Routing',
          description: 'Inefficient routing is leading to increased distance traveled',
          potentialSaving: { 
            fuel: 200, 
            cost: 20000,
            distance: 1000 
          },
          recommendation: 'Implement route optimization software to reduce unnecessary mileage and improve delivery efficiency.',
          status: 'pending',
        },
      ];

      const mockStats: Stats = {
        totalPotentialSavings: 48500,
        fuelSavings: 400,
        co2Reduction: 1200, // kg
        efficiencyImprovement: 15, // percentage
        totalSuggestions: 4,
        completed: 1,
        inProgress: 1,
        pending: 2
      };

      setSuggestions(mockSuggestions);
      setStats(mockStats);
    } catch (error) {
      console.error('Error fetching optimization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': 
        return <Badge variant="destructive" className="capitalize">{severity}</Badge>;
      case 'medium': 
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 capitalize">{severity}</Badge>;
      case 'low': 
        return <Badge variant="outline" className="capitalize">{severity}</Badge>;
      default: 
        return <Badge variant="secondary" className="capitalize">{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">
            <CheckCircle className="h-3 w-3" /> Completed
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 gap-1">
            <AlertCircle className="h-3 w-3" /> In Progress
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Info className="h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'efficiency': return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'cost': return <DollarSign className="h-5 w-5 text-green-500" />;
      case 'emissions': return <Leaf className="h-5 w-5 text-green-600" />;
      default: return <Lightbulb className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getSavingText = (saving: Suggestion['potentialSaving']) => {
    const parts = [];
    if (saving.fuel) parts.push(`Save ${saving.fuel}L fuel`);
    if (saving.cost) parts.push(`Save ₹${saving.cost.toLocaleString()}`);
    if (saving.co2) parts.push(`Reduce ${saving.co2}kg CO₂`);
    if (saving.distance) parts.push(`Save ${saving.distance}km`);
    return parts.join(' • ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Suggestions List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <div>
                  <CardTitle>Optimization Opportunities</CardTitle>
                  <CardDescription>
                    {stats?.totalSuggestions || 0} suggestions available
                  </CardDescription>
                </div>
              </div>
              {stats && (
                <Badge variant="secondary" className="text-sm">
                  {stats.totalSuggestions} suggestions
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-muted rounded-full">
                        {getTypeIcon(suggestion.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-base">{suggestion.title}</h4>
                          {getSeverityBadge(suggestion.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(suggestion.status)}
                    </div>
                  </div>

                  <div className="pl-12 space-y-3">
                    {suggestion.potentialSaving && (Object.keys(suggestion.potentialSaving).length > 0) && (
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-md w-fit">
                        <TrendingUp className="h-4 w-4" />
                        {getSavingText(suggestion.potentialSaving)}
                      </div>
                    )}
                    
                    <div className="text-sm bg-muted/50 p-3 rounded-md">
                      <span className="font-medium">Recommendation: </span>
                      {suggestion.recommendation}
                    </div>
                    
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {stats && (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Completion Rate</span>
                      <span className="font-medium">
                        {Math.round((stats.completed / stats.totalSuggestions) * 100)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.round((stats.completed / stats.totalSuggestions) * 100)} 
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Completed</span>
                      <Badge variant="default" className="bg-green-500">
                        {stats.completed} of {stats.totalSuggestions}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">In Progress</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {stats.inProgress}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Pending</span>
                      <Badge variant="outline">
                        {stats.pending}
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Optimization Tip</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Regularly review and implement these suggestions to maximize your fleet's fuel efficiency and reduce operational costs.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Potential Savings</CardTitle>
              <CardDescription>Estimated monthly impact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && (
                <>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">Total Savings</span>
                    <span className="text-lg font-bold text-green-700">₹{stats.totalPotentialSavings.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Fuel</div>
                      <div className="font-semibold">{stats.fuelSavings}L</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">CO₂</div>
                      <div className="font-semibold">{stats.co2Reduction}kg</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
