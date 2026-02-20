import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { shipmentsApi, type PaginatedResponse } from "@/apiClient/shipments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, RotateCcw, MapPin, AlertCircle } from "lucide-react";
import ShipmentCard from "@/components/shipments/ShipmentCard";
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

type ExtendedShipmentFilters = ShipmentFilters & { employee_id?: string };

function ShipmentsWithTracking() {
  // Set default filter to show only today's orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Calculate 3 days ago for max date range
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const [filters, setFilters] = useState<ExtendedShipmentFilters>({
    created_at__gte: today.toISOString(),
    created_at__lt: tomorrow.toISOString()
  });
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selected_shipment_ids, set_selected_shipment_ids] = useState<string[]>([]);
  const [show_batch_modal, set_show_batch_modal] = useState(false);
  const [show_batch_rider_modal, set_show_batch_rider_modal] = useState(false);
  const { toast } = useToast();
  const { user: current_user, isAuthenticated, getAuthHeaders } = useAuth();

  // Debug: Log component mount and auth state
  useEffect(() => {
    const authHeaders = getAuthHeaders();
    console.log('🚢 ShipmentsWithTracking mounted');
    console.log('📊 Current auth state:', {
      isAuthenticated,
      user: current_user,
      hasAuthHeaders: !!authHeaders.Authorization,
      userRole: current_user?.role,
      employee_id: current_user?.employee_id || current_user?.username
    });

  }, [isAuthenticated, current_user, getAuthHeaders]);

  // Monitor auth state changes
  useEffect(() => {
    const authHeaders = getAuthHeaders();
    console.log('🔄 Auth state changed in ShipmentsWithTracking:', {
      isAuthenticated,
      hasUser: !!current_user,
      hasAuthHeaders: !!authHeaders.Authorization,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, current_user, getAuthHeaders]);

  const employee_id = current_user?.employee_id || current_user?.username || "";

  // Memoize effective filters so query key is stable
  // Managers/Admins see all shipments, Riders see only their own
  const is_manager = current_user?.role === "admin" || current_user?.role === "manager" || current_user?.is_super_user || current_user?.is_ops_team;

  const effectiveFilters = useMemo<ExtendedShipmentFilters>(() => {
    return {
      ...filters,
      // Only filter by employee_id if user is NOT a manager/admin
      ...(!is_manager && employee_id ? { employee_id } : {}),
    };
  }, [filters, is_manager, employee_id]);

  // Lazy loading
  const [should_load_shipments, set_should_load_shipments] = useState(false);
  const sentinel_ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      set_should_load_shipments(true);
      return;
    }
    if (!("IntersectionObserver" in window)) {
      set_should_load_shipments(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            set_should_load_shipments(true);
            obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: "300px", threshold: 0.05 }
    );

    if (sentinel_ref.current) {
      obs.observe(sentinel_ref.current);
    } else {
      const t = setTimeout(() => set_should_load_shipments(true), 1000);
      return () => clearTimeout(t);
    }

    return () => obs.disconnect();
  }, []);

  // State for pagination
  const [pagination] = useState({
    page: 1,
    limit: 20,
  });

  // Combine filters with pagination
  const query_params = useMemo(() => ({
    ...effectiveFilters,
    page: pagination.page,
    limit: pagination.limit,
  }), [effectiveFilters, pagination.page, pagination.limit]);

  // Default paginated response
  const default_paginated_response: PaginatedResponse<Shipment> = {
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
    data: shipments_data = default_paginated_response,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<PaginatedResponse<Shipment>, Error>({
    queryKey: ["shipments", query_params],
    queryFn: () => shipmentsApi.getShipments(query_params),
    enabled: should_load_shipments,
    refetchInterval: 120000, // Reduced from 30s to 120s (2 minutes) to reduce continuous GET calls
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    // Use placeholderData to prevent undefined data
    placeholderData: default_paginated_response
  });

  // Type guard to check if the data is a paginated response
  const is_paginated_response = (data: unknown): data is PaginatedResponse<Shipment> => {
    return Boolean(
      data &&
      typeof data === 'object' &&
      'data' in data &&
      Array.isArray((data as PaginatedResponse<Shipment>).data) &&
      'total' in data
    );
  };

  // Extract data from paginated response with proper type safety
  const paginated_data = is_paginated_response(shipments_data)
    ? shipments_data
    : default_paginated_response;

  const {
    data: shipments = [],
  } = paginated_data;

  const {
    session: active_session_state,
    coordinates: session_coordinates
  } = useRouteSessionContext();

  const has_active_session = !!active_session_state;

  const current_location = useMemo(() => {
    if (session_coordinates.length > 0) {
      const last_coord = session_coordinates[session_coordinates.length - 1];
      return { latitude: last_coord.latitude, longitude: last_coord.longitude };
    }

    if (active_session_state?.start_latitude && active_session_state?.start_longitude) {
      return {
        latitude: active_session_state.start_latitude,
        longitude: active_session_state.start_longitude
      };
    }

    return undefined;
  }, [session_coordinates, active_session_state]);

  // Show welcome toast when shipments are loaded
  useEffect(() => {
    if (shipments?.length > 0 && !isLoading && !error) {
      const userName = current_user?.full_name?.split?.(' ')?.[0] || current_user?.username || 'User';
      toast({
        title: `Welcome back, ${userName}! 👋`,
        description: `You have ${shipments.length} shipment${shipments.length !== 1 ? 's' : ''} to manage today.`,
      });
    }
  }, [shipments?.length, isLoading, error, current_user, toast]);

  const handleShipmentSelect = (shipment_id: string, selected: boolean) => {
    set_selected_shipment_ids((prev) =>
      selected ? [...prev, shipment_id] : prev.filter((id) => id !== shipment_id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && shipments?.length > 0) {
      set_selected_shipment_ids(shipments.map((s: Shipment) => s?.id).filter(Boolean));
    } else {
      set_selected_shipment_ids([]);
    }
  };

  const handleBatchUpdate = () => {
    if (selected_shipment_ids.length === 0) return;
    set_show_batch_modal(true);
  };

  const handleBatchRiderAllocation = () => {
    if (selected_shipment_ids.length === 0 || !is_manager) return;
    set_show_batch_rider_modal(true);
  };

  const handleRefresh = () => {
    if (!should_load_shipments) {
      set_should_load_shipments(true);
    } else {
      refetch();
    }
  };

  // Debounce filter changes to prevent excessive API calls
  const debounced_filters = useDebounce(effectiveFilters, 500);

  // Update query params when debounced filters change
  useEffect(() => {
    if (!should_load_shipments) return;
    refetch();
  }, [debounced_filters, refetch, should_load_shipments]);

  // Handle filter changes
  const handleFilterChange = useCallback((new_filters: Partial<ExtendedShipmentFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...new_filters,
      // Reset to first page when filters change
      page: 1
    }));
  }, []);

  const [show_route_controls, set_show_route_controls] = useState(true);
  const toggleRouteControls = () => {
    set_show_route_controls(prev => !prev);
  };

  // Initial loading skeleton
  if (isLoading && should_load_shipments && !isFetching) {
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
                  disabled={selected_shipment_ids.length === 0}
                  className="bg-primary text-primary-foreground"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Batch Update ({selected_shipment_ids.length})
                </Button>
                <Button variant="outline" onClick={toggleRouteControls}>
                  <MapPin className="h-4 w-4 mr-2" />
                  {show_route_controls ? "Hide" : "Show"} Tracking
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
  const render_error_state = () => (
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
                disabled={selected_shipment_ids.length === 0}
                className="bg-primary text-primary-foreground"
              >
                <Edit className="h-4 w-4 mr-2" />
                Batch Update ({selected_shipment_ids.length})
              </Button>
              {is_manager && (
                <Button
                  onClick={handleBatchRiderAllocation}
                  disabled={selected_shipment_ids.length === 0}
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Allocate to Rider ({selected_shipment_ids.length})
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
      {show_route_controls && has_active_session && (
        <div className="mb-8">
          <ActiveRouteTracking
            sessionId={active_session_state.id}
            currentLocation={current_location}
          />
        </div>
      )}

      {/* Shipments Content */}
      {!should_load_shipments ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Shipments will load when this section scrolls into view. You can also load them now.
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => set_should_load_shipments(true)}>Load Shipments</Button>
              <Button variant="outline" onClick={() => set_should_load_shipments(true)}>
                Load & Keep Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        render_error_state()
      ) : !shipments || shipments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-no-shipments">
              {filters.status || filters.type || filters.route_name || filters.date || filters.employee_id || filters.pops_order_id
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
              checked={shipments?.length > 0 && selected_shipment_ids.length === shipments.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
              data-testid="checkbox-select-all"
            />
            <span className="text-sm text-muted-foreground">
              Select all ({shipments?.length || 0} shipments)
            </span>
            {has_active_session && (
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
            shipment?.id ? (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                selected={selected_shipment_ids.includes(shipment.id)}
                onSelect={(selected: boolean) => handleShipmentSelect(shipment.id, selected)}
                onViewDetails={() => setSelectedShipment(shipment)}
                employeeId={employee_id}
                variant="list"
                showTrackingControls={true}
                showIndividualActions={true}
              />
            ) : null
          )}
        </div>
      )}

      {/* Sentinel for lazy loading */}
      <div ref={sentinel_ref} />

      {/* Modals */}
      {selectedShipment && (
        <ShipmentDetailModalWithTracking
          shipment={selectedShipment}
          is_open={true}
          on_close={() => setSelectedShipment(null)}
          employee_id={employee_id}
        />
      )}

      {show_batch_modal && (
        <BatchUpdateModal
          selectedCount={selected_shipment_ids.length}
          selectedIds={selected_shipment_ids}
          isOpen={show_batch_modal}
          onClose={() => set_show_batch_modal(false)}
          onSuccess={() => {
            set_selected_shipment_ids([]);
            set_show_batch_modal(false);
            refetch();
          }}
        />
      )}

      {show_batch_rider_modal && (
        <BatchRiderAllocationModal
          selectedCount={selected_shipment_ids.length}
          selectedIds={selected_shipment_ids}
          isOpen={show_batch_rider_modal}
          onClose={() => set_show_batch_rider_modal(false)}
          onSuccess={() => {
            set_selected_shipment_ids([]);
            set_show_batch_rider_modal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default withPageErrorBoundary(ShipmentsWithTracking, 'Shipments with Tracking');