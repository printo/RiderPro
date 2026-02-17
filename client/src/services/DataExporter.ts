import {
  RouteAnalytics,
  RouteTracking,
  ExportOptions,
  ExportResult
} from '@shared/types';
import { format } from 'date-fns';

interface EmployeePerformanceAggregate {
  employee_id: string;
  total_distance: number;
  total_time: number;
  total_fuel_consumed: number;
  total_fuel_cost: number;
  total_shipments: number;
  working_days: Set<string>;
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
        include_headers = true
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.date_range) {
        const { from, to } = options.date_range;
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employee_ids && options.employee_ids.length > 0) {
        filteredData = filteredData.filter(item => {
          const employee_id = item.employee_id;
          if (!employee_id) {
            return false;
          }
          return options.employee_ids!.includes(employee_id);
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
        item.employee_id,
        item.date,
        item.total_distance?.toFixed(2) || '0',
        item.total_time ? (item.total_time / 3600).toFixed(2) : '0',
        item.average_speed?.toFixed(2) || '0',
        item.fuel_consumed?.toFixed(2) || '0',
        item.fuel_cost?.toFixed(2) || '0',
        item.shipments_completed?.toString() || '0',
        item.efficiency?.toFixed(2) || '0'
      ]);

      // Create CSV content
      const csvContent = [
        ...(include_headers ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        record_count: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export analytics data:', error);
      return {
        success: false,
        filename: '',
        record_count: 0,
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
        include_headers = true
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.date_range) {
        const { from, to } = options.date_range;
        filteredData = filteredData.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employee_ids && options.employee_ids.length > 0) {
        filteredData = filteredData.filter(item => {
          const employee_id = item.employee_id;
          if (!employee_id) {
            return false;
          }
          return options.employee_ids!.includes(employee_id);
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
        item.session, // RouteTracking has 'session' in schema.ts
        item.employee_id,
        item.latitude.toString(),
        item.longitude.toString(),
        item.timestamp,
        item.accuracy?.toString() || '',
        item.speed?.toString() || '',
        item.shipment_id || '',
        item.event_type || '',
        item.date
      ]);

      // Create CSV content
      const csvContent = [
        ...(include_headers ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        record_count: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export coordinates data:', error);
      return {
        success: false,
        filename: '',
        record_count: 0,
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
        include_headers = true
      } = options;

      // Aggregate data by employee
      const employeeData = data.reduce<Record<string, EmployeePerformanceAggregate>>((acc, item) => {
        if (!acc[item.employee_id]) {
          acc[item.employee_id] = {
            employee_id: item.employee_id,
            total_distance: 0,
            total_time: 0,
            total_fuel_consumed: 0,
            total_fuel_cost: 0,
            total_shipments: 0,
            working_days: new Set<string>()
          };
        }

        acc[item.employee_id].total_distance += item.total_distance || 0;
        acc[item.employee_id].total_time += item.total_time || 0;
        acc[item.employee_id].total_fuel_consumed += item.fuel_consumed || 0;
        acc[item.employee_id].total_fuel_cost += item.fuel_cost || 0;
        acc[item.employee_id].total_shipments += item.shipments_completed || 0;
        acc[item.employee_id].working_days.add(item.date);

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
        const working_days = employee.working_days.size;
        const avg_speed = employee.total_time > 0 ? (employee.total_distance / (employee.total_time / 3600)) : 0;
        const fuel_efficiency = employee.total_fuel_consumed > 0 ? (employee.total_distance / employee.total_fuel_consumed) : 0;
        const overall_efficiency = employee.total_shipments > 0 ? (employee.total_distance / employee.total_shipments) : 0;

        return [
          employee.employee_id,
          employee.total_distance.toFixed(2),
          (employee.total_time / 3600).toFixed(2),
          avg_speed.toFixed(2),
          employee.total_fuel_consumed.toFixed(2),
          employee.total_fuel_cost.toFixed(2),
          employee.total_shipments.toString(),
          working_days.toString(),
          working_days > 0 ? (employee.total_distance / working_days).toFixed(2) : '0',
          working_days > 0 ? (employee.total_shipments / working_days).toFixed(2) : '0',
          fuel_efficiency.toFixed(2),
          overall_efficiency.toFixed(2)
        ];
      });

      // Create CSV content
      const csvContent = [
        ...(include_headers ? [headers] : []),
        ...rows
      ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

      // Download the file
      this.downloadFile(csvContent, filename, 'text/csv');

      return {
        success: true,
        filename,
        record_count: rows.length
      };

    } catch (error) {
      console.error('Failed to export employee performance data:', error);
      return {
        success: false,
        filename: '',
        record_count: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export data to JSON format
   */
  static async exportToJSON<T extends { date?: string; timestamp?: string; employee_id?: string }>(
    data: T[],
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    try {
      const {
        filename = `route-data-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
      } = options;

      // Filter data based on options
      let filteredData = data;

      if (options.date_range) {
        const { from, to } = options.date_range;
        filteredData = filteredData.filter(item => {
          const dateValue = item.date ?? item.timestamp;
          if (!dateValue) {
            return false;
          }
          const itemDate = new Date(dateValue);
          return itemDate >= from && itemDate <= to;
        });
      }

      if (options.employee_ids && options.employee_ids.length > 0) {
        filteredData = filteredData.filter(item => {
          const employee_id = item.employee_id;
          if (!employee_id) {
            return false;
          }
          return options.employee_ids!.includes(employee_id);
        });
      }

      // Create JSON content
      const jsonContent = JSON.stringify({
        export_date: new Date().toISOString(),
        record_count: filteredData.length,
        filters: {
          date_range: options.date_range,
          employee_ids: options.employee_ids
        },
        data: filteredData
      }, null, 2);

      // Download the file
      this.downloadFile(jsonContent, filename, 'application/json');

      return {
        success: true,
        filename,
        record_count: filteredData.length
      };

    } catch (error) {
      console.error('Failed to export JSON data:', error);
      return {
        success: false,
        filename: '',
        record_count: 0,
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
    total_records: number;
    date_range: { from: string; to: string } | null;
    employee_count: number;
    total_distance: number;
    total_fuel_cost: number;
  } {
    if (data.length === 0) {
      return {
        total_records: 0,
        date_range: null,
        employee_count: 0,
        total_distance: 0,
        total_fuel_cost: 0
      };
    }

    const dates = data.map(item => item.date).sort();
    const employees = Array.from(new Set(data.map(item => item.employee_id)));
    const total_distance = data.reduce((sum, item) => sum + (item.total_distance || 0), 0);
    const total_fuel_cost = data.reduce((sum, item) => sum + (item.fuel_cost || 0), 0);

    return {
      total_records: data.length,
      date_range: {
        from: dates[0],
        to: dates[dates.length - 1]
      },
      employee_count: employees.length,
      total_distance: Math.round(total_distance * 100) / 100,
      total_fuel_cost: Math.round(total_fuel_cost * 100) / 100
    };
  }
}