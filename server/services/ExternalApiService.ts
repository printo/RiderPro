import { Shipment } from '@shared/schema';
import { log } from "../../shared/utils/logger.js";
import { API_KEYS } from '../config/apiKeys.js';

export interface ExternalSyncData {
  shipment_id: string;
  status: string;
  tracking: {
    start_latitude?: number;
    start_longitude?: number;
    stop_latitude?: number;
    stop_longitude?: number;
    km_travelled?: number;
  };
  delivery_time?: string;
  updated_at: string;
  // Additional fields for external system
  customer_info?: {
    name: string;
    phone: string;
    address: string;
  };
  package_info?: {
    weight: number;
    dimensions: string;
    special_instructions?: string;
  };
  route_info?: {
    route_name: string;
    employee_id: string;
    priority: string;
  };
}

export interface ExternalApiResponse {
  success: boolean;
  message: string;
  external_id?: string;
  synced_at?: string;
  error?: string;
}

export class ExternalApiService {
  private static instance: ExternalApiService;
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.EXTERNAL_API_URL || 'https://api.external-system.com';
    this.apiKey = process.env.EXTERNAL_API_KEY || '';
    this.timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT || '30000');
  }

  /**
   * Get access token for external API calls
   * Rotates between available tokens for load balancing
   */
  private getAccessToken(): string {

    // Use a simple round-robin approach
    const tokens = [API_KEYS.ACCESS_TOKEN_1, API_KEYS.ACCESS_TOKEN_2];
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }

  static getInstance(): ExternalApiService {
    if (!ExternalApiService.instance) {
      ExternalApiService.instance = new ExternalApiService();
    }
    return ExternalApiService.instance;
  }

  /**
   * Prepare optimized JSON payload for external API
   * Removes null/undefined values and optimizes structure for performance
   */
  prepareSyncData(shipment: Shipment): ExternalSyncData {
    // Clean and optimize the data structure
    const syncData: ExternalSyncData = {
      shipment_id: shipment.shipment_id || shipment.trackingNumber || 'unknown',
      status: shipment.status,
      tracking: {},
      updated_at: shipment.updatedAt
    };

    // Only include tracking data if it exists
    if (shipment.start_latitude !== null && shipment.start_latitude !== undefined) {
      syncData.tracking.start_latitude = shipment.start_latitude;
    }
    if (shipment.start_longitude !== null && shipment.start_longitude !== undefined) {
      syncData.tracking.start_longitude = shipment.start_longitude;
    }
    if (shipment.stop_latitude !== null && shipment.stop_latitude !== undefined) {
      syncData.tracking.stop_latitude = shipment.stop_latitude;
    }
    if (shipment.stop_longitude !== null && shipment.stop_longitude !== undefined) {
      syncData.tracking.stop_longitude = shipment.stop_longitude;
    }
    if (shipment.km_travelled !== null && shipment.km_travelled !== undefined && shipment.km_travelled > 0) {
      syncData.tracking.km_travelled = shipment.km_travelled;
    }

    // Include delivery time if available
    if (shipment.expectedDeliveryTime) {
      syncData.delivery_time = shipment.expectedDeliveryTime;
    } else if (shipment.deliveryTime) {
      syncData.delivery_time = shipment.deliveryTime;
    }

    // Include customer info for external system
    if (shipment.customerName || shipment.recipientName) {
      syncData.customer_info = {
        name: shipment.customerName || shipment.recipientName || '',
        phone: shipment.customerMobile || shipment.recipientPhone || '',
        address: shipment.address || shipment.deliveryAddress || ''
      };
    }

    // Include package info
    if (shipment.weight || shipment.dimensions) {
      syncData.package_info = {
        weight: shipment.weight || 0,
        dimensions: shipment.dimensions || '',
        special_instructions: shipment.specialInstructions || undefined
      };
    }

    // Include route info
    if (shipment.routeName || shipment.employeeId || shipment.priority) {
      syncData.route_info = {
        route_name: shipment.routeName || '',
        employee_id: shipment.employeeId || '',
        priority: shipment.priority || 'medium'
      };
    }

    return syncData;
  }

  /**
   * Send shipment data to external API with optimized JSON format
   */
  async syncShipment(shipment: Shipment): Promise<ExternalApiResponse> {
    try {
      const syncData = this.prepareSyncData(shipment);

      // Validate required fields
      if (!syncData.shipment_id) {
        throw new Error('Shipment ID is required for external sync');
      }

      // Create optimized JSON payload
      const payload = JSON.stringify(syncData, null, 0); // Compact JSON for performance

      log.dev(`Syncing shipment ${syncData.shipment_id} to external API...`);
      log.dev('Payload size:', payload.length, 'bytes');

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const accessToken = this.getAccessToken();
      log.dev(`Using access token: ${accessToken.substring(0, 10)}...`);

      const response = await fetch(`${this.baseUrl}/shipments/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Version': '1.0',
          'X-Request-ID': `riderpro-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        },
        body: payload,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`External API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      return {
        success: true,
        message: 'Shipment synced successfully',
        external_id: result.external_id || syncData.shipment_id,
        synced_at: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('External API sync failed:', error);

      return {
        success: false,
        message: 'Failed to sync to external system',
        error: error.message
      };
    }
  }

  /**
   * Batch sync multiple shipments for better performance
   */
  async batchSyncShipments(shipments: Shipment[]): Promise<ExternalApiResponse[]> {
    const results: ExternalApiResponse[] = [];

    // Process in batches of 10 for optimal performance
    const batchSize = 10;
    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);

      try {
        const batchPayload = {
          shipments: batch.map(shipment => this.prepareSyncData(shipment))
        };

        const payload = JSON.stringify(batchPayload, null, 0);
        log.dev(`Batch syncing ${batch.length} shipments...`);
        log.dev('Batch payload size:', payload.length, 'bytes');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2); // Longer timeout for batch

        const accessToken = this.getAccessToken();
        log.dev(`Using access token for batch sync: ${accessToken.substring(0, 10)}...`);

        const response = await fetch(`${this.baseUrl}/shipments/batch-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-API-Version': '1.0',
            'X-Request-ID': `riderpro-batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          },
          body: payload,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`External API batch error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Process batch results
        batch.forEach((shipment, index) => {
          results.push({
            success: result.results?.[index]?.success || false,
            message: result.results?.[index]?.message || 'Batch sync completed',
            external_id: result.results?.[index]?.external_id || shipment.shipment_id,
            synced_at: new Date().toISOString()
          });
        });

      } catch (error: any) {
        console.error('Batch sync failed:', error);

        // Mark all in batch as failed
        batch.forEach(() => {
          results.push({
            success: false,
            message: 'Batch sync failed',
            error: error.message
          });
        });
      }
    }

    return results;
  }

  /**
   * Validate JSON payload size and structure for performance
   */
  validatePayload(syncData: ExternalSyncData): { valid: boolean; size: number; warnings: string[] } {
    const payload = JSON.stringify(syncData, null, 0);
    const size = Buffer.byteLength(payload, 'utf8');
    const warnings: string[] = [];

    // Check payload size (warn if > 1MB)
    if (size > 1024 * 1024) {
      warnings.push(`Large payload size: ${Math.round(size / 1024)}KB`);
    }

    // Check for required fields
    if (!syncData.shipment_id) {
      warnings.push('Missing shipment_id');
    }

    if (!syncData.status) {
      warnings.push('Missing status');
    }

    return {
      valid: warnings.length === 0,
      size,
      warnings
    };
  }
}

export default ExternalApiService;
