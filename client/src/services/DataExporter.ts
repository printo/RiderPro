import { 
  RouteAnalytics, 
  RouteTracking,
  ExportOptions,
  ExportResult
} from '@shared/types';
import { format } from 'date-fns';

interface EmployeePerformanceAggregate {
  employeeId: string;
  totalDistance: number;
  totalTime: number;
  totalFuelConsumed: number;
  totalFuelCost: number;
  totalShipments: number;
  workingDays: Set<string>;
}

export class DataExporter {
  /**
   * Export route analytics data to CSV
   */
  static async exportAnalyticsToCSV(
    data: RouteAnalytics[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const {
        filename = `route-analytics-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`,
        includeHeaders = true
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.dateRange) {
        const { from, to } = options.dateRange;
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employeeIds && options.employeeIds.length > 0) {
        filteredData = filteredData.filter(item => {
          const employeeId = item.employeeId;
          if (!employeeId) {
            return false;
          }
          return options.employeeIds!.includes(employeeId);
        });
      }

      // Define CSV headers
      const headers = [
        'Employee ID',
        'Date',
        'Total Distance (km)',
        'Total Time (hours)',
        'Average Speed (km/h)',
        'Fuel Consumed (L)',
        'Fuel Cost ($)',
        'Shipments Completed',
        'Efficiency (km/shipment)'
      ];

      // Convert data to CSV rows
      const rows = filteredData.map(item => [
        item.employeeId,
        item.date,
        item.totalDistance?.toFixed(2) || '0',
        item.totalTime ? (item.totalTime / 3600).toFixed(2) : '0',
        item.averageSpeed?.toFixed(2) || '0',
        item.fuelConsumed?.toFixed(2) || '0',
        item.fuelCost?.toFixed(2) || '0',
        item.shipmentsCompleted?.toString() || '0',
        item.efficiency?.toFixed(2) || '0'
      ]);

      // Create CSV content
      const csvContent = [
        ...(includeHeaders ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        recordCount: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export analytics data:', error);
      return {
        success: false,
        filename: '',
        recordCount: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export route tracking coordinates to CSV
   */
  static async exportCoordinatesToCSV(
    data: RouteTracking[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const {
        filename = `route-coordinates-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`,
        includeHeaders = true
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.dateRange) {
        const { from, to } = options.dateRange;
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employeeIds && options.employeeIds.length > 0) {
        filteredData = filteredData.filter(item => {
          const employeeId = item.employeeId;
          if (!employeeId) {
            return false;
          }
          return options.employeeIds!.includes(employeeId);
        });
      }

      // Define CSV headers
      const headers = [
        'ID',
        'Session ID',
        'Employee ID',
        'Latitude',
        'Longitude',
        'Timestamp',
        'Accuracy (m)',
        'Speed (km/h)',
        'Shipment ID',
        'Event Type',
        'Date'
      ];

      // Convert data to CSV rows
      const rows = filteredData.map(item => [
        item.id,
        item.sessionId,
        item.employeeId,
        item.latitude.toString(),
        item.longitude.toString(),
        item.timestamp,
        item.accuracy?.toString() || '',
        item.speed?.toString() || '',
        item.shipmentId || '',
        item.eventType || '',
        item.date
      ]);

      // Create CSV content
      const csvContent = [
        ...(includeHeaders ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        recordCount: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export coordinates data:', error);
      return {
        success: false,
        filename: '',
        recordCount: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export employee performance summary to CSV
   */
  static async exportEmployeePerformanceToCSV(
    data: RouteAnalytics[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const {
        filename = `employee-performance-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`,
        includeHeaders = true
      } = options;

      // Aggregate data by employee
      const employeeData = data.reduce<Record<string, EmployeePerformanceAggregate>>((acc, item) => {
        if (!acc[item.employeeId]) {
          acc[item.employeeId] = {
            employeeId: item.employeeId,
            totalDistance: 0,
            totalTime: 0,
            totalFuelConsumed: 0,
            totalFuelCost: 0,
            totalShipments: 0,
            workingDays: new Set<string>()
          };
        }

        acc[item.employeeId].totalDistance += item.totalDistance || 0;
        acc[item.employeeId].totalTime += item.totalTime || 0;
        acc[item.employeeId].totalFuelConsumed += item.fuelConsumed || 0;
        acc[item.employeeId].totalFuelCost += item.fuelCost || 0;
        acc[item.employeeId].totalShipments += item.shipmentsCompleted || 0;
        acc[item.employeeId].workingDays.add(item.date);

        return acc;
      }, {});

      // Define CSV headers
      const headers = [
        'Employee ID',
        'Total Distance (km)',
        'Total Time (hours)',
        'Average Speed (km/h)',
        'Total Fuel Consumed (L)',
        'Total Fuel Cost ($)',
        'Total Shipments',
        'Working Days',
        'Avg Distance/Day (km)',
        'Avg Shipments/Day',
        'Fuel Efficiency (km/L)',
        'Overall Efficiency (km/shipment)'
      ];

      // Convert data to CSV rows
      const rows = Object.values(employeeData).map(employee => {
        const workingDays = employee.workingDays.size;
        const avgSpeed = employee.totalTime > 0 ? (employee.totalDistance / (employee.totalTime / 3600)) : 0;
        const fuelEfficiency = employee.totalFuelConsumed > 0 ? (employee.totalDistance / employee.totalFuelConsumed) : 0;
        const overallEfficiency = employee.totalShipments > 0 ? (employee.totalDistance / employee.totalShipments) : 0;

        return [
          employee.employeeId,
          employee.totalDistance.toFixed(2),
          (employee.totalTime / 3600).toFixed(2),
          avgSpeed.toFixed(2),
          employee.totalFuelConsumed.toFixed(2),
          employee.totalFuelCost.toFixed(2),
          employee.totalShipments.toString(),
          workingDays.toString(),
          workingDays > 0 ? (employee.totalDistance / workingDays).toFixed(2) : '0',
          workingDays > 0 ? (employee.totalShipments / workingDays).toFixed(2) : '0',
          fuelEfficiency.toFixed(2),
          overallEfficiency.toFixed(2)
        ];
      });

      // Create CSV content
      const csvContent = [
        ...(includeHeaders ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        recordCount: rows.length
      };

    } catch (error) {
      console.error('Failed to export employee performance data:', error);
      return {
        success: false,
        filename: '',
        recordCount: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export data to JSON format
   */
  static async exportToJSON<T extends { date?: string; timestamp?: string; employeeId?: string }>(
    data: T[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const {
        filename = `route-data-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.dateRange) {
        const { from, to } = options.dateRange;
        filteredData = filteredData.filter(item => {
          const dateValue = item.date ?? item.timestamp;
          if (!dateValue) {
            return false;
          }
          const itemDate = new Date(dateValue);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employeeIds && options.employeeIds.length > 0) {
        filteredData = filteredData.filter(item => {
          const employeeId = item.employeeId;
          if (!employeeId) {
            return false;
          }
          return options.employeeIds!.includes(employeeId);
        });
      }

      // Create JSON content
      const jsonContent = JSON.stringify({
        exportDate: new Date().toISOString(),
        recordCount: filteredData.length,
        filters: {
          dateRange: options.dateRange,
          employeeIds: options.employeeIds
        },
        data: filteredData
      }, null, 2);

      // Download the file
      this.downloadFile(jsonContent, filename, 'application/json');

      return {
        success: true,
        filename,
        recordCount: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export JSON data:', error);
      return {
        success: false,
        filename: '',
        recordCount: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Download file to user's device
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Get export statistics
   */
  static getExportStats(data: RouteAnalytics[]): {
    totalRecords: number;
    dateRange: { from: string; to: string } | null;
    employeeCount: number;
    totalDistance: number;
    totalFuelCost: number;
  } {
    if (data.length === 0) {
      return {
        totalRecords: 0,
        dateRange: null,
        employeeCount: 0,
        totalDistance: 0,
        totalFuelCost: 0
      };
    }

    const dates = data.map(item => item.date).sort();
    const employees = Array.from(new Set(data.map(item => item.employeeId)));
    const totalDistance = data.reduce((sum, item) => sum + (item.totalDistance || 0), 0);
    const totalFuelCost = data.reduce((sum, item) => sum + (item.fuelCost || 0), 0);

    return {
      totalRecords: data.length,
      dateRange: {
        from: dates[0],
        to: dates[dates.length - 1]
      },
      employeeCount: employees.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100
    };
  }
}