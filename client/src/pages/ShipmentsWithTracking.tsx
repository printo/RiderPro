import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { shipmentsApi, type PaginatedResponse } from "@/apiClient/shipments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, RotateCcw, MapPin, AlertCircle } from "lucide-react";
import ShipmentCardWithTracking from "@/components/shipments/ShipmentCardWithTracking";
import ShipmentDetailModalWithTracking from "@/components/ui/forms/ShipmentDetailModalWithTracking";
import BatchUpdateModal from "@/components/ui/forms/BatchUpdateModal";
import BatchRiderAllocationModal from "@/components/ui/forms/BatchRiderAllocationModal";
import Filters from "@/components/Filters";
import { Shipment, ShipmentFilters } from "@shared/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import ActiveRouteTracking from "@/components/routes/ActiveRouteTracking";
import { useRouteSessionContext } from "@/contexts/RouteSessionContext";

// Lazy load the shipments list component
// const ShipmentsList = lazy(() => import("@/components/shipments/ShipmentsList"));
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

type ExtendedShipmentFilters = ShipmentFilters & { employeeId?: string };

function ShipmentsWithTracking() {
  const [filters, setFilters] = useState<ExtendedShipmentFilters>({});
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchRiderModal, setShowBatchRiderModal] = useState(false);
  const { toast } = useToast();
  const { user: currentUser, isAuthenticated, authenticatedFetch: _authenticatedFetch, getAuthHeaders } = useAuth();

  // Debug: Log component mount and auth state
  useEffect(() => {
    const authHeaders = getAuthHeaders();
    console.log('🚢 ShipmentsWithTracking mounted');
    console.log('📊 Current auth state:', {
      isAuthenticated,
      user: currentUser,
      hasAuthHeaders: !!authHeaders.Authorization,
      userRole: currentUser?.role,
      employeeId: currentUser?.employeeId || currentUser?.username
    });

  }, [isAuthenticated, currentUser, getAuthHeaders]);

  // Monitor auth state changes
  useEffect(() => {
    const authHeaders = getAuthHeaders();
    console.log('🔄 Auth state changed in ShipmentsWithTracking:', {
      isAuthenticated,
      hasUser: !!currentUser,
      hasAuthHeaders: !!authHeaders.Authorization,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, currentUser, getAuthHeaders]);

  const employeeId = currentUser?.employeeId || currentUser?.username || "";

  // Memoize effective filters so query key is stable
  // Managers/Admins see all shipments, Riders see only their own
  const isManager = currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.isSuperUser || currentUser?.isOpsTeam;

  const effectiveFilters = useMemo<ExtendedShipmentFilters>(() => {
    return {
      ...filters,
      // Only filter by employeeId if user is NOT a manager/admin
      ...(!isManager && employeeId ? { employeeId } : {}),
    };
  }, [filters, isManager, employeeId]);

  // Lazy loading
  const [shouldLoadShipments, setShouldLoadShipments] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setShouldLoadShipments(true);
      return;
    }
    if (!("IntersectionObserver" in window)) {
      setShouldLoadShipments(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoadShipments(true);
            obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "300px", threshold: 0.05 }
    );

    if (sentinelRef.current) {
      obs.observe(sentinelRef.current);
    } else {
      const t = setTimeout(() => setShouldLoadShipments(true), 1000);
      return () => clearTimeout(t);
    }

    return () => obs.disconnect();
  }, []);

  // State for pagination
  const [pagination, _setPagination] = useState({
    page: 1,
    limit: 20,
  });

  // Combine filters with pagination
  const queryParams = useMemo(() => ({
    ...effectiveFilters,
    page: pagination.page,
    limit: pagination.limit,
  }), [effectiveFilters, pagination.page, pagination.limit]);

  // Default paginated response
  const defaultPaginatedResponse: PaginatedResponse<Shipment> = {
    data: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  // Use the useQuery hook with the new paginated response type
  const {
    data: shipmentsData = defaultPaginatedResponse,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<PaginatedResponse<Shipment>, Error>({
    queryKey: ["shipments", queryParams],
    queryFn: () => shipmentsApi.getShipments(queryParams),
    enabled: shouldLoadShipments,
    refetchInterval: 120000, // Reduced from 30s to 120s (2 minutes) to reduce continuous GET calls
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    // Use placeholderData to prevent undefined data
    placeholderData: defaultPaginatedResponse
  });

  // Type guard to check if the data is a paginated response
  const isPaginatedResponse = (data: unknown): data is PaginatedResponse<Shipment> => {
    return Boolean(
      data &&
      typeof data === 'object' &&
      'data' in data &&
      Array.isArray((data as PaginatedResponse<Shipment>).data) &&
      'total' in data
    );
  };

  // Extract data from paginated response with proper type safety
  const paginatedData = isPaginatedResponse(shipmentsData)
    ? shipmentsData
    : defaultPaginatedResponse;

  const {
    data: shipments = [],
    total: _total = 0,
    page: _page = 1,
    limit: _pageSize = 20,
    totalPages: _totalPages = 1,
    hasNextPage: _hasNextPage = false,
    hasPreviousPage: _hasPreviousPage = false
  } = paginatedData;

  const {
    session: activeSessionState,
    coordinates: sessionCoordinates
  } = useRouteSessionContext();

  const hasActiveSession = !!activeSessionState;

  const currentLocation = useMemo(() => {
    if (sessionCoordinates.length > 0) {
      const lastCoord = sessionCoordinates[sessionCoordinates.length - 1];
      return { latitude: lastCoord.latitude, longitude: lastCoord.longitude };
    }

    if (activeSessionState?.startLatitude && activeSessionState?.startLongitude) {
      return {
        latitude: activeSessionState.startLatitude,
        longitude: activeSessionState.startLongitude
      };
    }

    return undefined;
  }, [sessionCoordinates, activeSessionState]);

  // Show welcome toast when shipments are loaded
  useEffect(() => {
    if (shipments?.length > 0 && !isLoading && !error) {
      const userName = currentUser?.fullName?.split?.(' ')?.[0] || currentUser?.username || 'User';
      toast({
        title: `Welcome back, ${userName}! 👋`,
        description: `You have ${shipments.length} shipment${shipments.length !== 1 ? 's' : ''} to manage today.`,
      });
    }
  }, [shipments?.length, isLoading, error, currentUser, toast]);

  const handleShipmentSelect = (shipmentId: string, selected: boolean) => {
    setSelectedShipmentIds((prev) =>
      selected ? [...prev, shipmentId] : prev.filter((id) => id !== shipmentId)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && shipments?.length > 0) {
      setSelectedShipmentIds(shipments.map((s: Shipment) => s?.shipment_id).filter(Boolean));
    } else {
      setSelectedShipmentIds([]);
    }
  };

  // Handle page change
  // const _handlePageChange = (newPage: number) => {
  //   setPagination(prev => ({
  //     ...prev,
  //     page: newPage,
  //   }));
  // };

  // Handle page size change
  // const _handlePageSizeChange = (newSize: number) => {
  //   setPagination(prev => ({
  //     page: 1, // Reset to first page when changing page size
  //     limit: newSize,
  //   }));
  // };

  const handleBatchUpdate = () => {
    if (selectedShipmentIds.length === 0) return;
    setShowBatchModal(true);
  };

  const handleBatchRiderAllocation = () => {
    if (selectedShipmentIds.length === 0 || !isManager) return;
    setShowBatchRiderModal(true);
  };

  const handleRefresh = () => {
    if (!shouldLoadShipments) {
      setShouldLoadShipments(true);
    } else {
      refetch();
    }
  };



  // Debounce filter changes to prevent excessive API calls
  const debouncedFilters = useDebounce(effectiveFilters, 500);

  // Update query params when debounced filters change
  useEffect(() => {
    if (!shouldLoadShipments) return;
    refetch();
  }, [debouncedFilters, refetch, shouldLoadShipments]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ExtendedShipmentFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset to first page when filters change
      page: 1
    }));
  }, []);

  // Add missing toggleRouteControls function
  const [showRouteControls, setShowRouteControls] = useState(true);
  const toggleRouteControls = () => {
    setShowRouteControls(prev => !prev);
  };



  // Initial loading skeleton
  if (isLoading && shouldLoadShipments && !isFetching) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6" data-testid="card-filters">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h2 className="text-xl font-semibold text-foreground" data-testid="text-shipments-title">
                Shipments
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleBatchUpdate}
                  disabled={selectedShipmentIds.length === 0}
                  className="bg-primary text-primary-foreground"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Batch Update ({selectedShipmentIds.length})
                </Button>
                <Button variant="outline" onClick={toggleRouteControls}>
                  <MapPin className="h-4 w-4 mr-2" />
                  {showRouteControls ? "Hide" : "Show"} Tracking
                </Button>
                <Button variant="secondary" onClick={handleRefresh}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            <Filters filters={filters} onFiltersChange={setFilters} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-20 w-full mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 mt-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }



  // Render error state
  const renderErrorState = () => (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex flex-col space-y-2">
        <span>Failed to load shipments. {error?.message || 'Please try again.'}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="w-fit mt-2"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );



  return (
    <div className="container mx-auto p-4 space-y-6">


      {/* Filters Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              Shipments
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleBatchUpdate}
                disabled={selectedShipmentIds.length === 0}
                className="bg-primary text-primary-foreground"
              >
                <Edit className="h-4 w-4 mr-2" />
                Batch Update ({selectedShipmentIds.length})
              </Button>
              {isManager && (
                <Button
                  onClick={handleBatchRiderAllocation}
                  disabled={selectedShipmentIds.length === 0}
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Allocate to Rider ({selectedShipmentIds.length})
                </Button>
              )}
              <Button variant="secondary" onClick={handleRefresh}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh
                {isFetching && (
                  <span className="ml-2 w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                )}
              </Button>
            </div>
          </div>
          <Filters filters={filters} onFiltersChange={handleFilterChange} />
        </CardContent>
      </Card>

      {/* Active Route Tracking Section - Only show for riders or if session is active */}
      {showRouteControls && hasActiveSession && (
        <div className="mb-8">
          <ActiveRouteTracking
            sessionId={activeSessionState.id}
            currentLocation={currentLocation}
          />
        </div>
      )}

      {/* Shipments Content */}
      {!shouldLoadShipments ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Shipments will load when this section scrolls into view. You can also load them now.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => setShouldLoadShipments(true)}>Load Shipments</Button>
              <Button variant="outline" onClick={() => setShouldLoadShipments(true)}>
                Load & Keep Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        renderErrorState()
      ) : !shipments || shipments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-no-shipments">
              {filters.status || filters.type || filters.routeName || filters.date || filters.employeeId
                ? "No shipments match the current filters. Try adjusting your filters."
                : "No shipments available at the moment. Please check back later."}
            </p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={shipments?.length > 0 && selectedShipmentIds.length === shipments.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              Select all ({shipments?.length || 0} shipments)
            </span>
            {hasActiveSession && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-4">
                • GPS tracking active - locations will be recorded automatically
              </span>
            )}
            {isFetching && (
              <span className="text-xs text-blue-500 ml-auto">
                Loading...
                <span className="ml-1 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"></span>
              </span>
            )}
          </div>

          {/* Shipment Cards */}
          {shipments?.map?.((shipment: Shipment) =>
            shipment?.shipment_id ? (
              <ShipmentCardWithTracking
                key={shipment.shipment_id}
                shipment={shipment}
                selected={selectedShipmentIds.includes(shipment.shipment_id)}
                onSelect={(selected) => handleShipmentSelect(shipment.shipment_id, selected)}
                onViewDetails={() => setSelectedShipment(shipment)}
                employeeId={employeeId}
                showTrackingControls={true}
              />
            ) : null
          )}
        </div>
      )}

      {/* Sentinel for lazy loading */}
      <div ref={sentinelRef} />

      {/* Modals */}
      {selectedShipment && (
        <ShipmentDetailModalWithTracking
          shipment={selectedShipment}
          isOpen={true}
          onClose={() => setSelectedShipment(null)}
          employeeId={employeeId}
        />
      )}

      {showBatchModal && (
        <BatchUpdateModal
          selectedCount={selectedShipmentIds.length}
          selectedIds={selectedShipmentIds}
          selectedShipments={shipments.filter((shipment) => selectedShipmentIds.includes(shipment.shipment_id))}
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setSelectedShipmentIds([]);
            setShowBatchModal(false);
            refetch();
          }}
        />
      )}

      {showBatchRiderModal && (
        <BatchRiderAllocationModal
          selectedCount={selectedShipmentIds.length}
          selectedIds={selectedShipmentIds}
          isOpen={showBatchRiderModal}
          onClose={() => setShowBatchRiderModal(false)}
          onSuccess={() => {
            setSelectedShipmentIds([]);
            setShowBatchRiderModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default withPageErrorBoundary(ShipmentsWithTracking, 'Shipments with Tracking');