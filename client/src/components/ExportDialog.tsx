import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { DatePickerWithRange } from './ui/date-range-picker';
import { withModalErrorBoundary } from '@/components/ErrorBoundary';
import {
  Download,
  FileText,
  Database,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { RouteAnalytics } from '../../../shared/schema';
import { DataExporter, ExportOptions, ExportResult } from '../services/DataExporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: RouteAnalytics[];
  availableEmployees: Array<{ id: string; name: string }>;
}

type ExportType = 'analytics' | 'coordinates' | 'employee-performance';
type ExportFormat = 'csv' | 'json';

interface ExportState {
  type: ExportType;
  format: ExportFormat;
  dateRange: DateRange | undefined;
  selectedEmployees: string[];
  includeHeaders: boolean;
  isExporting: boolean;
  progress: number;
  result: ExportResult | null;
  error: string | null;
}

function ExportDialog({
  isOpen,
  onClose,
  data,
  availableEmployees
}: ExportDialogProps) {
  const [exportState, setExportState] = useState<ExportState>({
    type: 'analytics',
    format: 'csv',
    dateRange: undefined,
    selectedEmployees: [],
    includeHeaders: true,
    isExporting: false,
    progress: 0,
    result: null,
    error: null
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setExportState(prev => ({
        ...prev,
        isExporting: false,
        progress: 0,
        result: null,
        error: null
      }));
    }
  }, [isOpen]);

  const handleExport = async () => {
    setExportState(prev => ({
      ...prev,
      isExporting: true,
      progress: 0,
      result: null,
      error: null
    }));

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }));
      }, 200);

      // Convert DateRange to the expected format for ExportOptions
      let processedDateRange: { from: Date; to: Date; } | undefined = undefined;
      if (exportState.dateRange?.from && exportState.dateRange?.to) {
        processedDateRange = {
          from: exportState.dateRange.from,
          to: exportState.dateRange.to
        };
      }

      const exportOptions: ExportOptions = {
        dateRange: processedDateRange,
        employeeIds: exportState.selectedEmployees.length > 0 ? exportState.selectedEmployees : undefined,
        includeHeaders: exportState.includeHeaders,
        format: exportState.format
      };

      let result: ExportResult;

      switch (exportState.type) {
        case 'analytics':
          result = await DataExporter.exportAnalyticsToCSV(data, exportOptions);
          break;
        case 'employee-performance':
          result = await DataExporter.exportEmployeePerformanceToCSV(data, exportOptions);
          break;
        case 'coordinates':
          // This would need coordinate data, for now we'll use analytics data
          result = await DataExporter.exportAnalyticsToCSV(data, exportOptions);
          break;
        default:
          throw new Error('Invalid export type');
      }

      clearInterval(progressInterval);

      setExportState(prev => ({
        ...prev,
        isExporting: false,
        progress: 100,
        result
      }));

    } catch (error) {
      setExportState(prev => ({
        ...prev,
        isExporting: false,
        progress: 0,
        error: (error as Error).message
      }));
    }
  };

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    setExportState(prev => ({
      ...prev,
      selectedEmployees: checked
        ? [...prev.selectedEmployees, employeeId]
        : prev.selectedEmployees.filter(id => id !== employeeId)
    }));
  };

  const selectAllEmployees = () => {
    setExportState(prev => ({
      ...prev,
      selectedEmployees: availableEmployees.map(emp => emp.id)
    }));
  };

  const clearAllEmployees = () => {
    setExportState(prev => ({
      ...prev,
      selectedEmployees: []
    }));
  };

  const getExportStats = () => {
    return DataExporter.getExportStats(data);
  };

  const stats = getExportStats();

  const getExportTypeDescription = (type: ExportType) => {
    switch (type) {
      case 'analytics':
        return 'Daily route analytics with distance, time, fuel, and shipment data';
      case 'coordinates':
        return 'Raw GPS coordinates with timestamps and session information';
      case 'employee-performance':
        return 'Aggregated employee performance metrics and comparisons';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Route Data
          </DialogTitle>
          <DialogDescription>
            Export your route analytics data in various formats for analysis and reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total Records</p>
                  <p className="font-semibold">{stats.totalRecords}</p>
                </div>
                <div>
                  <p className="text-gray-600">Employees</p>
                  <p className="font-semibold">{stats.employeeCount}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Distance</p>
                  <p className="font-semibold">{stats.totalDistance} km</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Fuel Cost</p>
                  <p className="font-semibold">${stats.totalFuelCost}</p>
                </div>
              </div>
              {stats.dateRange && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Data Range: {stats.dateRange.from} to {stats.dateRange.to}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Type & Format */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Export Type</Label>
                <Select
                  value={exportState.type}
                  onValueChange={(value: ExportType) =>
                    setExportState(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analytics">Route Analytics</SelectItem>
                    <SelectItem value="employee-performance">Employee Performance</SelectItem>
                    <SelectItem value="coordinates">GPS Coordinates</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {getExportTypeDescription(exportState.type)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={exportState.format}
                  onValueChange={(value: ExportFormat) =>
                    setExportState(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Comma Separated)</SelectItem>
                    <SelectItem value="json">JSON (JavaScript Object)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHeaders"
                  checked={exportState.includeHeaders}
                  onCheckedChange={(checked) =>
                    setExportState(prev => ({ ...prev, includeHeaders: !!checked }))
                  }
                />
                <Label htmlFor="includeHeaders" className="text-sm">
                  Include column headers
                </Label>
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date Range (optional)</Label>
                <DatePickerWithRange
                  date={exportState.dateRange}
                  onDateChange={(dateRange) =>
                    setExportState(prev => ({ ...prev, dateRange }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Employees (optional)</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllEmployees}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllEmployees}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-2">
                  {availableEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`employee-${employee.id}`}
                        checked={exportState.selectedEmployees.includes(employee.id)}
                        onCheckedChange={(checked) =>
                          handleEmployeeToggle(employee.id, !!checked)
                        }
                      />
                      <Label htmlFor={`employee-${employee.id}`} className="text-sm">
                        {employee.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {exportState.selectedEmployees.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {exportState.selectedEmployees.length} employee(s) selected
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {exportState.isExporting && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Exporting data...</span>
                  </div>
                  <Progress value={exportState.progress} className="w-full" />
                  <p className="text-xs text-gray-500">
                    {exportState.progress}% complete
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Result */}
          {exportState.result && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>Export completed successfully!</p>
                  <p className="text-sm">
                    <strong>File:</strong> {exportState.result.filename}
                  </p>
                  <p className="text-sm">
                    <strong>Records:</strong> {exportState.result.recordCount}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Export Error */}
          {exportState.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Export failed: {exportState.error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exportState.isExporting}>
            {exportState.result ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exportState.isExporting || data.length === 0}
          >
            {exportState.isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} export default withModalErrorBoundary(ExportDialog, {
  componentName: 'ExportDialog'
});