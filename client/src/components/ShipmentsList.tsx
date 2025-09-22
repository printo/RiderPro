import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi, type PaginatedResponse } from '@/api/shipments';
import { Shipment } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import ShipmentCardWithTracking from './ShipmentCardWithTracking';

interface ShipmentsListProps {
  filters: any;
  onShipmentSelect: (shipment: Shipment) => void;
  selectedShipmentIds: string[];
  onSelectShipment: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

const ShipmentsList: React.FC<ShipmentsListProps> = ({
  filters,
  onShipmentSelect,
  selectedShipmentIds,
  onSelectShipment,
  onSelectAll,
  onRefresh,
  isLoading: externalLoading
}) => {
  const {
    data: shipmentsData = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 },
    isLoading: isQueryLoading,
    error,
    refetch
  } = useQuery<PaginatedResponse<Shipment>, Error>({
    queryKey: ['shipments', filters],
    queryFn: () => shipmentsApi.getShipments(filters),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: shipments = [], total, page, limit, totalPages } = shipmentsData;
  const isLoading = externalLoading || isQueryLoading;

  // Handle refresh by calling both the local refetch and the parent's refresh
  const handleRefresh = () => {
    refetch();
    onRefresh();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Failed to load shipments. {error.message}
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No shipments found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          Showing {shipments.length} of {total} shipments
        </div>
        <button
          onClick={handleRefresh}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          disabled={isLoading}
        >
          <svg
            className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {shipments.map((shipment) => (
          <ShipmentCardWithTracking
            key={shipment.id}
            shipment={shipment}
            isSelected={selectedShipmentIds.includes(shipment.id)}
            onSelect={(selected) => onSelectShipment(shipment.id, selected)}
            onClick={() => onShipmentSelect(shipment)}
          />
        ))}
      </div>

      {/* Pagination would go here */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => {
                  // Handle page change
                }}
                className={`px-3 py-1 rounded ${
                  page === pageNum
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShipmentsList;
