import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  DollarSign, 
  LineChart, 
  Lightbulb, 
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";

import { FuelCalculator } from '@/services/FuelCalculator';
import { FuelPriceManagement } from './FuelPriceManagement';
import { FuelAnalytics } from './FuelAnalytics';
import { FleetReports } from './FleetReports';
import { OptimizationSuggestions } from './OptimizationSuggestions';

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

export const FuelManagementDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [fuelCalculator] = useState<FuelCalculator>(new FuelCalculator());
  const [refreshKey, setRefreshKey] = useState(0);

  // Get available cities and vehicle types from the calculator
  const cities = ['Delhi', 'Bangalore', 'Chennai'];
  const vehicleTypes = fuelCalculator.getVehicleTypes();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Helper to convert DateRange to [Date, Date] for child components
  const getDateRangeArray = (): [Date, Date] => {
    return [
      dateRange?.from || new Date(), 
      dateRange?.to || new Date()
    ];
  };

  return (
    <div className="fuel-management-dashboard space-y-6">
      <div className="dashboard-header">
        <div className="flex flex-col space-y-4 w-full">
          <h3 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" /> 
            Fuel Management Dashboard
          </h3>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-[300px]">
              <DatePickerWithRange 
                date={dateRange}
                onDateChange={setDateRange}
              />
            </div>

            <div className="w-[150px]">
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Vehicle Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicleTypes.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="analytics" className="gap-2">
            <LineChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="prices" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Fuel Prices
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="optimization" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Optimization
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6">
          <FuelAnalytics 
            dateRange={getDateRangeArray()} 
            city={selectedCity === 'all' ? undefined : selectedCity}
            vehicleType={selectedVehicle === 'all' ? undefined : selectedVehicle}
            refreshKey={refreshKey}
          />
        </TabsContent>

        <TabsContent value="prices" className="mt-6">
          <FuelPriceManagement 
            fuelCalculator={fuelCalculator} 
            onPriceUpdate={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <FleetReports 
            dateRange={getDateRangeArray()}
            city={selectedCity === 'all' ? undefined : selectedCity}
            vehicleType={selectedVehicle === 'all' ? undefined : selectedVehicle}
          />
        </TabsContent>

        <TabsContent value="optimization" className="mt-6">
          <OptimizationSuggestions 
            dateRange={getDateRangeArray()}
            city={selectedCity === 'all' ? undefined : selectedCity}
            vehicleType={selectedVehicle === 'all' ? undefined : selectedVehicle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
