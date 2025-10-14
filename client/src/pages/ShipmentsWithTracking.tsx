import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { shipmentsApi, type PaginatedResponse } from "@/api/shipments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, RotateCcw, Navigation, MapPin, AlertCircle } from "lucide-react";
import ShipmentCardWithTracking from "@/components/ShipmentCardWithTracking";
import ShipmentDetailModalWithTracking from "@/components/ShipmentDetailModalWithTracking";
import BatchUpdateModal from "@/components/BatchUpdateModal";
import RouteSessionControls from "@/components/RouteSessionControls";
import Filters from "@/components/Filters";
import { Shipment, ShipmentFilters } from "@shared/schema";
import { useRouteTracking } from "@/hooks/useRouteAPI";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { withPageErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load the shipments list component
const ShipmentsList = lazy(() => import("@/components/ShipmentsList"));
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";

function ShipmentsWithTracking() {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const { logout } = useAuth();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const { toast } = useToast();

  const { user: currentUser, isAuthenticated, authState } = useAuth();

  // Debug: Log component mount and auth state
  useEffect(() => {
    console.log('🚢 ShipmentsWithTracking mounted');
    console.log('📊 Current auth state:', {
      isAuthenticated,
      user: currentUser,
      hasAccessToken: !!authState.accessToken,
      hasRefreshToken: !!authState.refreshToken,
      userRole: currentUser?.role,
      employeeId: currentUser?.employeeId || currentUser?.username
    });

    // Check localStorage directly
    const directTokenCheck = {
      accessToken: localStorage.getItem('access_token'),
      refreshToken: localStorage.getItem('refresh_token'),
      authUser: localStorage.getItem('auth_user')
    };
    console.log('💾 Direct localStorage check:', {
      hasAccessToken: !!directTokenCheck.accessToken,
      hasRefreshToken: !!directTokenCheck.refreshToken,
      hasAuthUser: !!directTokenCheck.authUser,
      accessTokenLength: directTokenCheck.accessToken?.length,
      refreshTokenLength: directTokenCheck.refreshToken?.length
    });

    // Add logout detection
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token' && e.newValue === null) {
        console.log('🚨 LOGOUT DETECTED: access_token removed from localStorage');
        console.log('Storage event details:', {
          key: e.key,
          oldValue: e.oldValue ? 'present' : 'null',
          newValue: e.newValue,
          url: e.url
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('🚢 ShipmentsWithTracking unmounted');
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isAuthenticated, currentUser, authState]);

  // Monitor auth state changes
  useEffect(() => {
    console.log('🔄 Auth state changed in ShipmentsWithTracking:', {
      isAuthenticated,
      hasUser: !!currentUser,
      hasAccessToken: !!authState.accessToken,
      timestamp: new Date().toISOString()
    });

    // If we lose authentication while on this page, log it
    if (!isAuthenticated && currentUser === null && !authState.accessToken) {
      console.log('🚨 AUTHENTICATION LOST while on shipments page');
      console.log('Current URL:', window.location.href);
      console.log('Referrer:', document.referrer);
    }
  }, [isAuthenticated, currentUser, authState.accessToken]);

  const employeeId = currentUser?.employeeId || currentUser?.username || "";

  // Memoize effective filters so query key is stable
  const effectiveFilters = useMemo(() => {
    return {
      ...filters,
      ...(currentUser?.role !== "admin" &&
        currentUser?.role !== "super_admin" &&
        employeeId
        ? { employeeId }
        : {}),
    } as ShipmentFilters;
  }, [filters, currentUser?.role, employeeId]);

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
  const [pagination, setPagination] = useState({
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
    refetchInterval: 30000,
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
    total = 0,
    page = 1,
    limit: pageSize = 20,
    totalPages = 1,
    hasNextPage = false,
    hasPreviousPage = false
  } = paginatedData;

  const { hasActiveSession, activeSession } = useRouteTracking(employeeId);

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
      setSelectedShipmentIds(shipments.map((s: Shipment) => s?.id).filter(Boolean));
    } else {
      setSelectedShipmentIds([]);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage,
    }));
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({
      page: 1, // Reset to first page when changing page size
      limit: newSize,
    }));
  };

  const handleBatchUpdate = () => {
    if (selectedShipmentIds.length === 0) return;
    setShowBatchModal(true);
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
  const handleFilterChange = useCallback((newFilters: Partial<ShipmentFilters>) => {
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

  // Error banner
  const renderErrorBanner = () => {
    if (!error) return null;

    console.error("Shipments error:", error);

    let errorMessage = "Failed to load shipments. Please try again.";
    let showRetry = true;

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        errorMessage = "Your session has expired. Please log in again.";
        showRetry = false;
      } else if (error.message.includes("NetworkError")) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.message.includes("500")) {
        errorMessage = "Server error. Please try again later.";
      }
    }

    return (
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{errorMessage}</h3>
                {process.env.NODE_ENV === "development" && (
                  <div className="mt-2 text-sm text-red-700">
                    <details>
                      <summary className="cursor-pointer text-sm">
                        Show error details
                      </summary>
                      <pre className="mt-2 p-2 bg-red-100 rounded overflow-auto text-xs">
                        {error instanceof Error ? error.message : JSON.stringify(error, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  {showRetry ? (
                    <Button
                      onClick={handleRefresh}
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      data-testid="button-retry"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Retry Loading Shipments
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        logout().finally(() => {
                          window.location.href = "/login";
                        });
                      }}
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                    >
                      Go to Login
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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

  // Render filter section
  const renderFilterSection = () => (
    <Card className="shadow-sm mb-6">
      <CardContent className="p-4">
        <Filters
          filters={filters}
          onFiltersChange={handleFilterChange}
          onClear={() => setFilters({})}
        />
      </CardContent>
    </Card>
  );

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

  // Render loading state
  const renderLoadingState = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
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
              {filters.status || filters.type || filters.routeName || filters.date || (filters as any).employeeId
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
            shipment?.id ? (
              <ShipmentCardWithTracking
                key={shipment.id}
                shipment={shipment}
                selected={selectedShipmentIds.includes(shipment.id)}
                onSelect={(selected) => handleShipmentSelect(shipment.id, selected)}
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
          isOpen={showBatchModal}
          onClose={() => setShowBatchModal(false)}
          onSuccess={() => {
            setSelectedShipmentIds([]);
            setShowBatchModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default withPageErrorBoundary(ShipmentsWithTracking, 'Shipments with Tracking');