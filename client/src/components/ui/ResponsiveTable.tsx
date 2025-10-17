import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface ResponsiveTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  mobileRender?: (item: T) => React.ReactNode;
  className?: string;
  mobileClassName?: string;
}

export interface ResponsiveTableProps<T> {
  title?: string;
  subtitle?: string;
  data: T[];
  columns: ResponsiveTableColumn<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  sortField?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: keyof T) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
  mobileCardClassName?: string;
  rightAction?: React.ReactNode;
}

export function ResponsiveTable<T extends Record<string, any>>({
  title,
  subtitle,
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  sortField,
  sortDirection,
  onSort,
  emptyMessage = "No data found",
  loading = false,
  className = "",
  mobileCardClassName = "",
  rightAction
}: ResponsiveTableProps<T>) {
  const getSortIcon = (field: keyof T) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  const renderMobileCard = (item: T, index: number) => {
    const primaryColumn = columns[0];
    const secondaryColumns = columns.slice(1, 3); // Show first 2 additional columns
    const actionColumns = columns.slice(3); // Remaining columns as actions

    return (
      <div key={index} className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${mobileCardClassName}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {primaryColumn.render ? 
                primaryColumn.render(item[primaryColumn.key], item) : 
                String(item[primaryColumn.key] || 'N/A')
              }
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col space-y-1">
            {secondaryColumns.map((column) => {
              const value = item[column.key];
              if (column.key === 'status' || column.key === 'is_active' || column.key === 'is_approved') {
                const isActive = value === true || value === 'active' || value === 'approved';
                return (
                  <span
                    key={String(column.key)}
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                );
              }
              if (column.key === 'role' || column.key === 'is_super_user') {
                const isAdmin = value === 'admin' || value === 'super_user' || value === true;
                return (
                  <span
                    key={String(column.key)}
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      isAdmin
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {isAdmin ? 'Admin' : 'User'}
                  </span>
                );
              }
              return null;
            })}
          </div>
        </div>
        
        <div className="space-y-2 text-xs text-gray-600">
          {columns.slice(1).map((column) => {
            if (column.mobileRender) {
              return (
                <div key={String(column.key)} className="flex justify-between">
                  <span>{column.label}:</span>
                  <span className="truncate ml-2">
                    {column.mobileRender(item)}
                  </span>
                </div>
              );
            }
            const value = item[column.key];
            if (value !== undefined && value !== null && value !== '') {
              return (
                <div key={String(column.key)} className="flex justify-between">
                  <span>{column.label}:</span>
                  <span className="truncate ml-2">
                    {column.render ? 
                      column.render(value, item) : 
                      String(value)
                    }
                  </span>
                </div>
              );
            }
            return null;
          })}
        </div>
        
        {actionColumns.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actionColumns.map((column) => {
              if (column.render) {
                return (
                  <div key={String(column.key)}>
                    {column.render(item[column.key], item)}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {(title || rightAction) && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {rightAction && <div>{rightAction}</div>}
          </div>
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </CardHeader>
      )}
      <CardContent>
        {/* Mobile Card Layout */}
        <div className="block sm:hidden space-y-4">
          {data.length > 0 ? (
            data.map((item, index) => renderMobileCard(item, index))
          ) : (
            <div className="text-center py-8 text-sm text-gray-500">
              {emptyMessage}
            </div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden sm:block overflow-hidden shadow ring-1 ring-border/20 rounded-xl">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`py-3.5 px-3 text-left text-sm font-semibold text-gray-900 ${
                      column.className || ''
                    }`}
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => onSort?.(column.key)}
                        className="flex items-center gap-2 hover:text-gray-700"
                      >
                        {column.label}
                        {getSortIcon(column.key)}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.length > 0 ? (
                data.map((item, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`whitespace-nowrap py-4 px-3 text-sm ${
                          column.className || 'text-gray-500'
                        }`}
                      >
                        {column.render ? 
                          column.render(item[column.key], item) : 
                          String(item[column.key] || 'N/A')
                        }
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default ResponsiveTable;
