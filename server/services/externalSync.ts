import axios from 'axios';
import { Shipment, Acknowledgment } from '@shared/schema';
import { log } from '../vite.js';

interface ExternalSyncPayload {
  shipmentId: string;
  status: string;
  syncedAt: string;
  acknowledgement?: {
    signatureUrl?: string;
    photoUrl?: string;
    capturedAt: string;
  };
}

class ExternalSyncService {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private readonly externalApiUrl: string;

  constructor() {
    // Get external API URL from environment variable
    this.externalApiUrl = process.env.EXTERNAL_API_URL || process.env.SYNC_API_URL || 'https://api.example.com/sync';
  }

  async syncShipmentUpdate(
    shipment: Shipment, 
    acknowledgment?: Acknowledgment | null
  ): Promise<boolean> {
    const payload: ExternalSyncPayload = {
      shipmentId: shipment.id,
      status: shipment.status,
      syncedAt: new Date().toISOString(),
    };

    if (acknowledgment) {
      payload.acknowledgement = {
        signatureUrl: acknowledgment.signatureUrl,
        photoUrl: acknowledgment.photoUrl,
        capturedAt: acknowledgment.capturedAt,
      };
    }

    return this.sendWithRetry(payload);
  }

  private async sendWithRetry(payload: ExternalSyncPayload, attempt = 1): Promise<boolean> {
    try {
      log(`Syncing shipment ${payload.shipmentId} (attempt ${attempt})`, 'external-sync');
      
      const response = await axios.post(this.externalApiUrl, payload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXTERNAL_API_KEY || process.env.API_KEY || ''}`,
        },
      });

      if (response.status >= 200 && response.status < 300) {
        log(`Successfully synced shipment ${payload.shipmentId}`, 'external-sync');
        return true;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      log(`Sync failed for shipment ${payload.shipmentId} (attempt ${attempt}): ${error.message}`, 'external-sync');
      
      if (attempt < this.maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.sendWithRetry(payload, attempt + 1);
      }

      // All retries failed
      log(`All sync attempts failed for shipment ${payload.shipmentId}`, 'external-sync');
      return false;
    }
  }

  // Batch sync for multiple shipments
  async batchSyncShipments(shipments: Shipment[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in parallel but with limited concurrency
    const concurrencyLimit = 5;
    const chunks = [];
    for (let i = 0; i < shipments.length; i += concurrencyLimit) {
      chunks.push(shipments.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (shipment) => {
        try {
          const result = await this.syncShipmentUpdate(shipment);
          return result ? 'success' : 'failed';
        } catch {
          return 'failed';
        }
      });

      const results = await Promise.all(promises);
      success += results.filter(r => r === 'success').length;
      failed += results.filter(r => r === 'failed').length;
    }

    return { success, failed };
  }
}

export const externalSync = new ExternalSyncService();
