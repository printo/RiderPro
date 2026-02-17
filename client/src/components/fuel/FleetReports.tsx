// /client/src/components/fuel/FleetReports.tsx
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { ReportData, ReportColumn, RouteFilters } from '@shared/types';
import { analyticsApi } from '@/apiClient/analytics';

type ReportType = 'monthly' | 'vehicle' | 'city';

interface FleetReportsProps {
  dateRange: [Date, Date];
  city?: string;
  vehicleType?: string;
}

export const FleetReports: React.FC<FleetReportsProps> = ({
  dateRange,
  city,
  vehicleType
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'vehicle' | 'city'>('monthly');
  const [loading, setLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReportData();
  }, [reportType, dateRange, city, vehicleType]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      setError(null);

      const filters: RouteFilters = {
        ...(city ? { city } : {}),
        ...(dateRange && dateRange[0] && dateRange[1]
          ? {
            start_date: dateRange[0].toISOString().split('T')[0],
            end_date: dateRange[1].toISOString().split('T')[0],
          }
          : {}),
      };

      // For now, reuse route metrics/time-based metrics to build simple reports.
      // This avoids mock data while still giving meaningful summaries.
      const metrics = await analyticsApi.getTimeBasedMetrics('month', filters);

      const mapped: ReportData[] = metrics.map((m, index) => ({
        key: index,
        month: new Date(m.period).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        total_distance: m.total_distance,
        total_fuel_consumed: m.total_fuel_consumed ?? 0,
        total_fuel_cost: m.total_fuel_cost ?? 0,
        average_efficiency: m.efficiency ?? 0,
        cost_per_km: m.total_distance > 0 && m.total_fuel_cost != null
          ? (m.total_fuel_cost / m.total_distance)
          : 0,
      }));

      setReportData(mapped);
    } catch (error) {
      console.error('Error fetching report data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = getColumns().map(col => col.title);
    const csvContent = [
      headers.join(','),
      ...reportData.map(row =>
        getColumns().map(col => {
          const value = row[col.data_index as string];
          return typeof value === 'number' ? value : `"${value}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fleet-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('CSV export started!');
    // In a real app, you might want to show a toast notification here
  };

  const getColumns = (): ReportColumn[] => {
    return [
      {
        title: reportType === 'monthly' ? 'Month' : reportType === 'vehicle' ? 'Vehicle Type' : 'City',
        data_index: reportType === 'monthly' ? 'month' : reportType === 'vehicle' ? 'vehicleType' : 'city',
        key: 'name',
        render: (value) => <span className="font-medium">{value}</span>,
      },
      {
        title: 'Total Distance (km)',
        data_index: 'total_distance',
        key: 'distance',
        render: (value) => (value as number).toLocaleString(),
      },
      {
        title: 'Fuel Consumed (L)',
        data_index: 'total_fuel_consumed',
        key: 'fuel',
        render: (value) => (value as number).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      {
        title: 'Fuel Cost (₹)',
        data_index: 'total_fuel_cost',
        key: 'cost',
        render: (value) => `₹${(value as number).toLocaleString()}`,
      },
      {
        title: 'Avg. Efficiency (km/L)',
        data_index: 'average_efficiency',
        key: 'efficiency',
        render: (value) => (value as number).toFixed(2),
      },
      {
        title: 'Cost per km (₹/km)',
        data_index: 'cost_per_km',
        key: 'costPerKm',
        render: (value) => `₹${(value as number).toFixed(2)}`,
      },
    ];
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Fleet Reports</h2>
            <Select.Root value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
              <Select.Trigger className="flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-48">
                <Select.Value placeholder="Select report type" />
                <Select.Icon className="ml-2">
                  <ChevronDown size={16} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                  <Select.Viewport className="p-1">
                    <Select.Item value="monthly" className="relative flex items-center px-8 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                      <Select.ItemText>Monthly Summary</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-2">
                        <Check size={16} />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="vehicle" className="relative flex items-center px-8 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                      <Select.ItemText>By Vehicle Type</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-2">
                        <Check size={16} />
                      </Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="city" className="relative flex items-center px-8 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                      <Select.ItemText>By City</Select.ItemText>
                      <Select.ItemIndicator className="absolute left-2">
                        <Check size={16} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchReportData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <Tabs.Root defaultValue="summary" className="w-full">
          <Tabs.List className="flex border-b border-gray-200">
            <Tabs.Trigger
              value="summary"
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300 focus:outline-none data-[state=active]:border-blue-500 data-[state=active]:text-blue-600"
            >
              Summary
            </Tabs.Trigger>
            <Tabs.Trigger
              value="detailed"
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent hover:border-gray-300 focus:outline-none data-[state=active]:border-blue-500 data-[state=active]:text-blue-600"
            >
              Detailed View
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="summary" className="py-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {getColumns().map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((row, rowIndex) => (
                    <tr key={row.key || rowIndex}>
                      {getColumns().map((column) => (
                        <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {column.render
                            ? column.render(row[column.data_index as string] as string | number)
                            : row[column.data_index as string]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tabs.Content>
          <Tabs.Content value="detailed" className="py-4">
            <div className="py-4 text-sm text-gray-500">
              Detailed view with additional metrics and visualizations would be shown here.
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
};