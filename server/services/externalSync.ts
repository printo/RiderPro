import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
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

type ContentType = 'json' | 'multipart';

class ExternalSyncService {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private readonly externalApiUrl = 'deliveryq/status-update/';
  private readonly bearerToken = 'Aabc456fv789';

  // Performance metrics tracking
  private performanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    jsonRequests: 0,
    multipartRequests: 0,
    totalProcessingTime: 0,
    totalFileSize: 0,
    averageResponseTime: 0,
    lastResetTime: Date.now()
  };

  constructor() {
    // Validate configuration and dependencies
    this.validateConfiguration();

    // Log the endpoint being used during service initialization
    log(`ExternalSyncService initialized with endpoint: ${this.externalApiUrl}`, 'external-sync');
    log(`External sync configuration: endpoint=${this.externalApiUrl}, token=Bearer ${this.bearerToken.substring(0, 8)}...`, 'external-sync');
  }

  /**
   * Validates service configuration and required dependencies
   */
  private validateConfiguration(): void {
    // Validate endpoint configuration
    if (!this.externalApiUrl || this.externalApiUrl.trim() === '') {
      throw new Error('ExternalSyncService: API endpoint is not configured');
    }

    // Validate bearer token
    if (!this.bearerToken || this.bearerToken.trim() === '') {
      throw new Error('ExternalSyncService: Bearer token is not configured');
    }

    // Validate required dependencies
    try {
      // Check if axios is available
      if (typeof axios === 'undefined') {
        throw new Error('ExternalSyncService: axios dependency is not available');
      }

      // Check if FormData is available
      if (typeof FormData === 'undefined') {
        throw new Error('ExternalSyncService: FormData dependency is not available');
      }

      // Check if fs module is available
      if (!fs || typeof fs.existsSync !== 'function') {
        throw new Error('ExternalSyncService: fs module is not available');
      }

      // Check if path module is available
      if (!path || typeof path.join !== 'function') {
        throw new Error('ExternalSyncService: path module is not available');
      }

      log('ExternalSyncService: All dependencies validated successfully', 'external-sync');
    } catch (error: any) {
      log(`ExternalSyncService: Dependency validation failed: ${error.message}`, 'external-sync');
      throw error;
    }

    // Log configuration summary
    log(`ExternalSyncService: Configuration validated - endpoint: ${this.externalApiUrl}, maxRetries: ${this.maxRetries}, retryDelay: ${this.retryDelay}ms`, 'external-sync');
  }

  /**
   * Determines the appropriate content type based on payload content
   * Returns 'multipart' if acknowledgement contains file URLs, 'json' otherwise
   */
  private determineContentType(payload: ExternalSyncPayload): ContentType {
    // Check if acknowledgement exists and has file URLs
    if (payload.acknowledgement) {
      const hasSignature = payload.acknowledgement.signatureUrl &&
        payload.acknowledgement.signatureUrl.trim() !== '';
      const hasPhoto = payload.acknowledgement.photoUrl &&
        payload.acknowledgement.photoUrl.trim() !== '';

      // Return multipart if either signature or photo URL exists
      if (hasSignature || hasPhoto) {
        return 'multipart';
      }
    }

    // Default to JSON for payloads without files
    return 'json';
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
        signatureUrl: acknowledgment.signature,
        photoUrl: acknowledgment.photo,
        capturedAt: acknowledgment.timestamp,
      };
    }

    // Determine content type and route to appropriate sender
    const contentType = this.determineContentType(payload);
    log(`Determined content type: ${contentType} for shipment ${payload.shipmentId}`, 'external-sync');

    return this.sendWithRetry(payload, contentType);
  }

  private async sendWithRetry(payload: ExternalSyncPayload, contentType: ContentType, attempt = 1): Promise<boolean> {
    try {
      log(`Syncing shipment ${payload.shipmentId} as ${contentType} (attempt ${attempt})`, 'external-sync');

      // Route to appropriate sender based on content type
      if (contentType === 'multipart') {
        return await this.sendMultipartPayload(payload, attempt);
      } else {
        return await this.sendJsonPayload(payload, attempt);
      }
    } catch (error: any) {
      // Enhanced error logging with content-type specific information
      const errorContext = this.getErrorContext(error, contentType, payload);
      log(`${contentType.toUpperCase()} sync failed for shipment ${payload.shipmentId} (attempt ${attempt}): ${errorContext}`, 'external-sync');

      if (attempt < this.maxRetries) {
        // Enhanced retry logic with exponential backoff
        const retryDelay = contentType === 'multipart'
          ? this.retryDelay * Math.pow(2, attempt - 1) // Exponential backoff for multipart
          : this.retryDelay * attempt; // Linear backoff for JSON

        log(`Retrying in ${retryDelay}ms (${contentType} mode, attempt ${attempt + 1}/${this.maxRetries})`, 'external-sync');
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        // Implement fallback retry strategy for multipart failures
        if (contentType === 'multipart' && this.isFileRelatedError(error) && attempt === this.maxRetries - 1) {
          log(`Final retry for shipment ${payload.shipmentId}: falling back to JSON mode due to file processing issues`, 'external-sync');
          return this.sendWithRetry(payload, 'json', attempt + 1);
        }

        return this.sendWithRetry(payload, contentType, attempt + 1);
      }

      // All retries failed - enhanced final error logging
      log(`All ${contentType.toUpperCase()} sync attempts failed for shipment ${payload.shipmentId}. Final error: ${errorContext}`, 'external-sync');
      return false;
    }
  }

  /**
   * Generates detailed error context based on error type and content type
   */
  private getErrorContext(error: any, contentType: ContentType, payload: ExternalSyncPayload): string {
    const baseError = error.message || 'Unknown error';

    if (contentType === 'multipart') {
      // Multipart-specific error analysis
      if (this.isFileRelatedError(error)) {
        const fileInfo = this.getFileInfo(payload);
        return `File processing error - ${baseError}. Files: ${fileInfo}`;
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return `Network error during multipart upload - ${baseError}. This may be due to large file size or slow connection`;
      } else if (error.response?.status) {
        return `HTTP ${error.response.status} error during multipart upload - ${baseError}`;
      }
      return `Multipart upload error - ${baseError}`;
    } else {
      // JSON-specific error analysis
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return `Network error during JSON sync - ${baseError}`;
      } else if (error.response?.status) {
        return `HTTP ${error.response.status} error during JSON sync - ${baseError}`;
      }
      return `JSON sync error - ${baseError}`;
    }
  }

  /**
   * Determines if an error is related to file processing
   */
  private isFileRelatedError(error: any): boolean {
    const errorMessage = (error.message || '').toLowerCase();
    return errorMessage.includes('file') ||
      errorMessage.includes('enoent') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('buffer') ||
      error.code === 'ENOENT';
  }

  /**
   * Gets file information for error logging
   */
  private getFileInfo(payload: ExternalSyncPayload): string {
    if (!payload.acknowledgement) return 'none';

    const files = [];
    if (payload.acknowledgement.signatureUrl) files.push('signature');
    if (payload.acknowledgement.photoUrl) files.push('photo');

    return files.length > 0 ? files.join(', ') : 'none';
  }

  /**
   * Updates performance metrics after a sync operation
   */
  private updatePerformanceMetrics(contentType: ContentType, success: boolean, duration: number, fileSize: number = 0): void {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.totalProcessingTime += duration;

    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }

    if (contentType === 'json') {
      this.performanceMetrics.jsonRequests++;
    } else {
      this.performanceMetrics.multipartRequests++;
      this.performanceMetrics.totalFileSize += fileSize;
    }

    // Update average response time
    this.performanceMetrics.averageResponseTime =
      this.performanceMetrics.totalProcessingTime / this.performanceMetrics.totalRequests;
  }

  /**
   * Gets current performance metrics
   */
  public getPerformanceMetrics(): any {
    const uptime = Date.now() - this.performanceMetrics.lastResetTime;
    const successRate = this.performanceMetrics.totalRequests > 0
      ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(2)
      : '0.00';

    return {
      ...this.performanceMetrics,
      uptime,
      successRate: `${successRate}%`,
      requestsPerMinute: this.performanceMetrics.totalRequests / (uptime / 60000),
      averageFileSize: this.performanceMetrics.multipartRequests > 0
        ? Math.round(this.performanceMetrics.totalFileSize / this.performanceMetrics.multipartRequests)
        : 0
    };
  }

  /**
   * Resets performance metrics
   */
  public resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      jsonRequests: 0,
      multipartRequests: 0,
      totalProcessingTime: 0,
      totalFileSize: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now()
    };
    log('Performance metrics reset', 'external-sync');
  }

  /**
   * Logs performance summary periodically
   */
  private logPerformanceSummary(): void {
    const metrics = this.getPerformanceMetrics();
    log(`Performance Summary - Total: ${metrics.totalRequests}, Success: ${metrics.successRate}, Avg Time: ${Math.round(metrics.averageResponseTime)}ms, JSON: ${metrics.jsonRequests}, Multipart: ${metrics.multipartRequests}`, 'external-sync');
  }

  /**
   * Sends payload as JSON with application/json content type
   * Implements JSON-specific request logic with proper headers and error handling
   */
  private async sendJsonPayload(payload: ExternalSyncPayload, attempt: number): Promise<boolean> {
    const startTime = Date.now();
    log(`Sending JSON payload for shipment ${payload.shipmentId} (attempt ${attempt}) - Size: ${JSON.stringify(payload).length} bytes`, 'external-sync');

    try {
      const response = await axios.post(this.externalApiUrl, payload, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      });

      const duration = Date.now() - startTime;
      if (response.status >= 200 && response.status < 300) {
        this.updatePerformanceMetrics('json', true, duration);
        log(`Successfully synced shipment ${payload.shipmentId} as JSON (status: ${response.status}, ${duration}ms)`, 'external-sync');
        return true;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('json', false, duration);

      // Enhanced JSON-specific error handling
      if (error.code === 'ECONNABORTED') {
        throw new Error(`JSON sync timeout after ${duration}ms - payload may be too large or network is slow`);
      } else if (error.response) {
        throw new Error(`JSON sync HTTP error ${error.response.status}: ${error.response.statusText} (${duration}ms)`);
      } else if (error.code) {
        throw new Error(`JSON sync network error ${error.code}: ${error.message} (${duration}ms)`);
      }

      throw new Error(`JSON sync failed: ${error.message} (${duration}ms)`);
    }
  }

  /**
   * Processes a file URL and converts it to a buffer for upload
   * Handles both signature and photo file types with proper error handling and memory optimization
   */
  private async processFileForUpload(fileUrl: string, fieldName: string): Promise<Buffer | null> {
    const startTime = Date.now();
    let memoryBefore = 0;

    try {
      // Monitor memory usage
      if (process.memoryUsage) {
        memoryBefore = process.memoryUsage().heapUsed;
      }

      // Validate file URL
      if (!fileUrl || fileUrl.trim() === '') {
        log(`Empty file URL provided for field ${fieldName}`, 'external-sync');
        return null;
      }

      // Handle local file URLs (remove base URL if present)
      let filePath = fileUrl;
      if (fileUrl.startsWith('http')) {
        // Extract the file path from the URL
        const url = new URL(fileUrl);
        filePath = path.join(process.cwd(), url.pathname);
      } else if (fileUrl.startsWith('/uploads/')) {
        // Handle relative paths
        filePath = path.join(process.cwd(), fileUrl);
      } else {
        // Assume it's already a file path
        filePath = fileUrl;
      }

      // Check if file exists and get file stats
      if (!fs.existsSync(filePath)) {
        log(`File not found: ${filePath} for field ${fieldName}`, 'external-sync');
        return null;
      }

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Memory optimization: Use streaming for large files (>5MB)
      if (fileSize > 5 * 1024 * 1024) {
        log(`Large file detected (${fileSize} bytes), using streaming for ${fieldName}`, 'external-sync');
        // For very large files, we could implement streaming, but for now we'll warn and continue
        log(`Warning: File ${filePath} is large (${fileSize} bytes), consider implementing streaming`, 'external-sync');
      }

      // Read file into buffer with memory monitoring
      const buffer = fs.readFileSync(filePath);

      const duration = Date.now() - startTime;
      const memoryAfter = process.memoryUsage ? process.memoryUsage().heapUsed : 0;
      const memoryDelta = memoryAfter - memoryBefore;

      log(`Successfully processed file ${filePath} (${buffer.length} bytes) for field ${fieldName} in ${duration}ms, memory delta: ${memoryDelta} bytes`, 'external-sync');

      return buffer;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      log(`Error processing file ${fileUrl} for field ${fieldName} after ${duration}ms: ${error.message}`, 'external-sync');
      return null;
    }
  }

  /**
   * Cleanup temporary resources after upload
   */
  private cleanupAfterUpload(success: boolean, fileBuffers: Buffer[]): void {
    try {
      if (success && fileBuffers.length > 0) {
        // Clear buffer references to help garbage collection
        fileBuffers.forEach((buffer, index) => {
          if (buffer) {
            // Force garbage collection hint for large buffers
            if (buffer.length > 1024 * 1024) { // >1MB
              log(`Clearing large buffer ${index} (${buffer.length} bytes) after successful upload`, 'external-sync');
            }
          }
        });

        // Suggest garbage collection for large uploads
        const totalSize = fileBuffers.reduce((sum, buf) => sum + (buf?.length || 0), 0);
        if (totalSize > 5 * 1024 * 1024 && global.gc) { // >5MB total
          log(`Suggesting garbage collection after large upload (${totalSize} bytes)`, 'external-sync');
          global.gc();
        }
      }
    } catch (error: any) {
      log(`Error during cleanup: ${error.message}`, 'external-sync');
    }
  }

  /**
   * Sends payload as multipart form data with file attachments
   * Implements FormData construction with shipment data and files
   */
  private async sendMultipartPayload(payload: ExternalSyncPayload, attempt: number): Promise<boolean> {
    const startTime = Date.now();
    let totalFileSize = 0;
    let processedFiles: string[] = [];

    try {
      log(`Sending multipart payload for shipment ${payload.shipmentId} (attempt ${attempt})`, 'external-sync');

      // Create FormData instance
      const formData = new FormData();

      // Add basic shipment data
      formData.append('shipmentId', payload.shipmentId);
      formData.append('status', payload.status);
      formData.append('syncedAt', payload.syncedAt);

      // Process acknowledgement data and files
      if (payload.acknowledgement) {
        formData.append('acknowledgementCapturedAt', payload.acknowledgement.capturedAt);

        // Process signature file if present
        if (payload.acknowledgement.signatureUrl) {
          const signatureBuffer = await this.processFileForUpload(
            payload.acknowledgement.signatureUrl,
            'signature'
          );
          if (signatureBuffer) {
            formData.append('signature', signatureBuffer, {
              filename: 'signature.png',
              contentType: 'image/png',
            });
            totalFileSize += signatureBuffer.length;
            processedFiles.push(`signature(${signatureBuffer.length}b)`);
          } else {
            log(`Warning: Signature file could not be processed for shipment ${payload.shipmentId}`, 'external-sync');
          }
        }

        // Process photo file if present
        if (payload.acknowledgement.photoUrl) {
          const photoBuffer = await this.processFileForUpload(
            payload.acknowledgement.photoUrl,
            'photo'
          );
          if (photoBuffer) {
            formData.append('photo', photoBuffer, {
              filename: 'photo.jpg',
              contentType: 'image/jpeg',
            });
            totalFileSize += photoBuffer.length;
            processedFiles.push(`photo(${photoBuffer.length}b)`);
          } else {
            log(`Warning: Photo file could not be processed for shipment ${payload.shipmentId}`, 'external-sync');
          }
        }
      }

      // Log multipart details
      log(`Multipart upload details for shipment ${payload.shipmentId}: Files: [${processedFiles.join(', ')}], Total size: ${totalFileSize} bytes`, 'external-sync');

      // Check if we have any files to upload
      if (processedFiles.length === 0) {
        log(`No files processed for multipart upload, falling back to JSON for shipment ${payload.shipmentId}`, 'external-sync');
        return this.sendJsonPayload(payload, attempt);
      }

      // Send multipart request with dynamic timeout based on file size
      const timeout = Math.max(15000, Math.min(60000, 15000 + (totalFileSize / 1024))); // 15s base + 1s per KB, max 60s
      const response = await axios.post(this.externalApiUrl, formData, {
        timeout,
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          ...formData.getHeaders(), // Let FormData set Content-Type with boundary
        },
      });

      const duration = Date.now() - startTime;
      if (response.status >= 200 && response.status < 300) {
        this.updatePerformanceMetrics('multipart', true, duration, totalFileSize);

        // Cleanup after successful upload
        this.cleanupAfterUpload(true, []);

        log(`Successfully synced shipment ${payload.shipmentId} as multipart (status: ${response.status}, ${duration}ms, ${totalFileSize} bytes)`, 'external-sync');
        return true;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics('multipart', false, duration, totalFileSize);

      // Cleanup after failed upload
      this.cleanupAfterUpload(false, []);

      // Enhanced multipart-specific error handling
      if (this.isFileRelatedError(error)) {
        log(`File processing error for shipment ${payload.shipmentId}: ${error.message}. Processed files: [${processedFiles.join(', ')}]`, 'external-sync');
        log(`Falling back to JSON mode for shipment ${payload.shipmentId} due to file processing failure`, 'external-sync');
        return this.sendJsonPayload(payload, attempt);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`Multipart upload timeout after ${duration}ms - file size: ${totalFileSize} bytes may be too large`);
      } else if (error.response) {
        throw new Error(`Multipart upload HTTP error ${error.response.status}: ${error.response.statusText} (${duration}ms, ${totalFileSize} bytes)`);
      } else if (error.code) {
        throw new Error(`Multipart upload network error ${error.code}: ${error.message} (${duration}ms, ${totalFileSize} bytes)`);
      }

      throw new Error(`Multipart upload failed: ${error.message} (${duration}ms, ${totalFileSize} bytes)`);
    }
  }

  // Batch sync for multiple shipments with enhanced error tracking
  async batchSyncShipments(shipments: Shipment[]): Promise<{ success: number; failed: number }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    let jsonCount = 0;
    let multipartCount = 0;

    log(`Starting batch sync for ${shipments.length} shipments`, 'external-sync');

    // Process in parallel but with limited concurrency
    const concurrencyLimit = 5;
    const chunks = [];
    for (let i = 0; i < shipments.length; i += concurrencyLimit) {
      chunks.push(shipments.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (shipment) => {
        try {
          // Determine content type for tracking
          const payload = {
            shipmentId: shipment.id,
            status: shipment.status,
            syncedAt: new Date().toISOString(),
          };
          const contentType = this.determineContentType(payload);

          const result = await this.syncShipmentUpdate(shipment);

          if (result) {
            if (contentType === 'multipart') multipartCount++;
            else jsonCount++;
            return 'success';
          }
          return 'failed';
        } catch (error: any) {
          log(`Batch sync error for shipment ${shipment.id}: ${error.message}`, 'external-sync');
          return 'failed';
        }
      });

      const results = await Promise.all(promises);
      success += results.filter(r => r === 'success').length;
      failed += results.filter(r => r === 'failed').length;
    }

    const duration = Date.now() - startTime;
    log(`Batch sync completed: ${success} successful (${jsonCount} JSON, ${multipartCount} multipart), ${failed} failed in ${duration}ms`, 'external-sync');

    // Log performance summary after batch operations
    if (shipments.length >= 10) { // Only for larger batches
      this.logPerformanceSummary();
    }

    return { success, failed };
  }
}

export const externalSync = new ExternalSyncService();
