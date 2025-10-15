import { log } from '../vite.js';

// External payload interfaces based on requirements
export interface ExternalShipmentPayload {
  id: string;                    // External tracking ID
  status: string;
  priority?: string;
  type: string;
  pickupAddress?: string;
  deliveryAddress: string;       // Maps to address in database
  recipientName: string;         // Maps to customerName in database
  recipientPhone: string;        // Maps to customerMobile in database
  weight?: number;
  dimensions?: string;
  specialInstructions?: string;
  estimatedDeliveryTime: string; // Maps to deliveryTime in database
  latitude?: number;
  longitude?: number;
  cost: number;
  routeName: string;
  employeeId: string;
}

export interface ExternalShipmentBatch {
  shipments: ExternalShipmentPayload[];
  metadata?: {
    source?: string;
    batchId?: string;
    timestamp?: string;
  };
}

export interface ExternalUpdatePayload {
  id: string;                    // External tracking ID (piashipmentid)
  status: string;
  statusTimestamp: string;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };
  employeeId: string;
  employeeName?: string;
  deliveryDetails?: {
    actualDeliveryTime?: string;
    recipientName?: string;
    deliveryNotes?: string;
    signature?: string;
    photo?: string;
  };
  routeInfo?: {
    routeName: string;
    sessionId?: string;
    totalDistance?: number;
    travelTime?: number;
  };
}

// Internal database format (matches current schema)
export interface InternalShipment {
  shipment_id: string;           // Primary key identifier
  type: string;
  customerName: string;          // Maps from recipientName
  customerMobile: string;        // Maps from recipientPhone
  address: string;               // Maps from deliveryAddress
  latitude?: number;
  longitude?: number;
  cost: number;
  deliveryTime: string;          // Maps from estimatedDeliveryTime
  routeName: string;
  employeeId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  // Additional fields that may be missing from current schema
  priority?: string;
  pickupAddress?: string;
  weight?: number;
  dimensions?: string;
  specialInstructions?: string;
  actualDeliveryTime?: string;
  piashipmentid?: string;        // External tracking ID for reference
}

export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

/**
 * Service for mapping data between external API format and internal database format
 * Handles field name conversions, data validation, and type conversions
 */
export class FieldMappingService {
  private readonly requiredExternalFields = [
    'id', 'status', 'type', 'deliveryAddress', 'recipientName',
    'recipientPhone', 'estimatedDeliveryTime', 'cost', 'routeName', 'employeeId'
  ];

  private readonly requiredInternalFields = [
    'type', 'customerName', 'customerMobile', 'address',
    'deliveryTime', 'cost', 'routeName', 'employeeId', 'status'
  ];

  /**
   * Maps external payload to internal database format
   * Handles field name conversions and data type validation
   */
  mapExternalToInternal(external: ExternalShipmentPayload): InternalShipment {
    try {
      log(`Mapping external payload to internal format for shipment ${external.id}`, 'field-mapping');

      // Validate required fields first
      const validation = this.validateExternalPayload(external);
      if (!validation.isValid) {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      // Generate internal ID (UUID)
      const internalId = this.generateInternalId();

      // Map fields with proper conversions
      const internal: InternalShipment = {
        shipment_id: internalId,
        type: this.sanitizeString(external.type),
        customerName: this.sanitizeString(external.recipientName),     // recipientName -> customerName
        customerMobile: this.sanitizePhoneNumber(external.recipientPhone), // recipientPhone -> customerMobile
        address: this.sanitizeString(external.deliveryAddress),        // deliveryAddress -> address
        latitude: this.sanitizeCoordinate(external.latitude, 'latitude'),
        longitude: this.sanitizeCoordinate(external.longitude, 'longitude'),
        cost: this.sanitizeNumber(external.cost, 'cost'),
        deliveryTime: this.sanitizeDateTime(external.estimatedDeliveryTime), // estimatedDeliveryTime -> deliveryTime
        routeName: this.sanitizeString(external.routeName),
        employeeId: this.sanitizeString(external.employeeId),
        status: this.sanitizeStatus(external.status),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Additional fields (may not exist in current schema)
        priority: external.priority ? this.sanitizeString(external.priority) : undefined,
        pickupAddress: external.pickupAddress ? this.sanitizeString(external.pickupAddress) : undefined,
        weight: external.weight ? this.sanitizeNumber(external.weight, 'weight') : undefined,
        dimensions: external.dimensions ? this.sanitizeString(external.dimensions) : undefined,
        specialInstructions: external.specialInstructions ? this.sanitizeString(external.specialInstructions) : undefined,
        piashipmentid: this.sanitizeString(external.id), // Store external ID for reference
      };

      log(`Successfully mapped external shipment ${external.id} to internal ID ${internalId}`, 'field-mapping');
      return internal;

    } catch (error: any) {
      log(`Error mapping external to internal for shipment ${external.id}: ${error.message}`, 'field-mapping');
      throw new Error(`Field mapping failed: ${error.message}`);
    }
  }

  /**
   * Maps internal database format to external update format
   * Used when sending status updates back to external systems
   */
  mapInternalToExternal(internal: InternalShipment, additionalData?: any): ExternalUpdatePayload {
    try {
      log(`Mapping internal shipment ${internal.shipment_id} to external update format`, 'field-mapping');

      const external: ExternalUpdatePayload = {
        id: internal.piashipmentid || internal.shipment_id, // Use external ID if available, fallback to internal
        status: internal.status,
        statusTimestamp: internal.updatedAt || new Date().toISOString(),
        employeeId: internal.employeeId,
      };

      // Add location data if available
      if (internal.latitude !== undefined && internal.longitude !== undefined) {
        external.location = {
          latitude: internal.latitude,
          longitude: internal.longitude,
        };
      }

      // Add delivery details if available
      if (internal.actualDeliveryTime || internal.customerName || additionalData?.deliveryNotes) {
        external.deliveryDetails = {
          actualDeliveryTime: internal.actualDeliveryTime,
          recipientName: internal.customerName, // customerName -> recipientName
          deliveryNotes: additionalData?.deliveryNotes,
          signature: additionalData?.signature,
          photo: additionalData?.photo,
        };
      }

      // Add route information
      external.routeInfo = {
        routeName: internal.routeName,
        sessionId: additionalData?.sessionId,
        totalDistance: additionalData?.totalDistance,
        travelTime: additionalData?.travelTime,
      };

      log(`Successfully mapped internal shipment ${internal.shipment_id} to external update`, 'field-mapping');
      return external;

    } catch (error: any) {
      log(`Error mapping internal to external for shipment ${internal.shipment_id}: ${error.message}`, 'field-mapping');
      throw new Error(`Field mapping failed: ${error.message}`);
    }
  }

  /**
   * Validates external shipment payload structure and required fields
   */
  validateExternalPayload(payload: ExternalShipmentPayload): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      // Check required fields
      for (const field of this.requiredExternalFields) {
        if (!payload[field as keyof ExternalShipmentPayload]) {
          errors.push({
            field,
            value: payload[field as keyof ExternalShipmentPayload],
            message: `Required field '${field}' is missing or empty`,
            code: 'REQUIRED_FIELD_MISSING'
          });
        }
      }

      // Validate field types and formats
      if (payload.id && typeof payload.id !== 'string') {
        errors.push({
          field: 'id',
          value: payload.id,
          message: 'ID must be a string',
          code: 'INVALID_TYPE'
        });
      }

      if (payload.cost !== undefined && (typeof payload.cost !== 'number' || payload.cost < 0)) {
        errors.push({
          field: 'cost',
          value: payload.cost,
          message: 'Cost must be a non-negative number',
          code: 'INVALID_VALUE'
        });
      }

      if (payload.weight !== undefined && (typeof payload.weight !== 'number' || payload.weight <= 0)) {
        errors.push({
          field: 'weight',
          value: payload.weight,
          message: 'Weight must be a positive number',
          code: 'INVALID_VALUE'
        });
      }

      // Validate coordinates if provided
      if (payload.latitude !== undefined) {
        const lat = Number(payload.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          errors.push({
            field: 'latitude',
            value: payload.latitude,
            message: 'Latitude must be a number between -90 and 90',
            code: 'INVALID_COORDINATE'
          });
        }
      }

      if (payload.longitude !== undefined) {
        const lng = Number(payload.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          errors.push({
            field: 'longitude',
            value: payload.longitude,
            message: 'Longitude must be a number between -180 and 180',
            code: 'INVALID_COORDINATE'
          });
        }
      }

      // Validate phone number format (basic validation)
      if (payload.recipientPhone && !this.isValidPhoneNumber(payload.recipientPhone)) {
        errors.push({
          field: 'recipientPhone',
          value: payload.recipientPhone,
          message: 'Invalid phone number format',
          code: 'INVALID_PHONE_FORMAT'
        });
      }

      // Validate status
      if (payload.status && !this.isValidStatus(payload.status)) {
        errors.push({
          field: 'status',
          value: payload.status,
          message: 'Invalid status value',
          code: 'INVALID_STATUS'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: errors.length === 0 ? payload : undefined
      };

    } catch (error: any) {
      log(`Validation error for external payload: ${error.message}`, 'field-mapping');
      return {
        isValid: false,
        errors: [{
          field: 'general',
          value: payload,
          message: `Validation failed: ${error.message}`,
          code: 'VALIDATION_ERROR'
        }]
      };
    }
  }

  /**
   * Validates batch shipment payload
   */
  validateExternalBatch(batch: ExternalShipmentBatch): ValidationResult {
    const errors: ValidationError[] = [];

    if (!batch.shipments || !Array.isArray(batch.shipments)) {
      errors.push({
        field: 'shipments',
        value: batch.shipments,
        message: 'Shipments must be an array',
        code: 'INVALID_TYPE'
      });
      return { isValid: false, errors };
    }

    if (batch.shipments.length === 0) {
      errors.push({
        field: 'shipments',
        value: batch.shipments,
        message: 'Shipments array cannot be empty',
        code: 'EMPTY_ARRAY'
      });
      return { isValid: false, errors };
    }

    // Validate each shipment in the batch
    batch.shipments.forEach((shipment, index) => {
      const validation = this.validateExternalPayload(shipment);
      if (!validation.isValid) {
        validation.errors.forEach(error => {
          errors.push({
            ...error,
            field: `shipments[${index}].${error.field}`,
            message: `Shipment ${index}: ${error.message}`
          });
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? batch : undefined
    };
  }

  // Private helper methods for data sanitization and validation

  private generateInternalId(): string {
    // Generate UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private sanitizeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private sanitizeNumber(value: any, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number for field ${fieldName}: ${value}`);
    }
    return num;
  }

  private sanitizeCoordinate(value: any, type: 'latitude' | 'longitude'): number | undefined {
    if (value === null || value === undefined) return undefined;

    const num = Number(value);
    if (isNaN(num)) return undefined;

    if (type === 'latitude' && (num < -90 || num > 90)) return undefined;
    if (type === 'longitude' && (num < -180 || num > 180)) return undefined;

    return num;
  }

  private sanitizeDateTime(value: any): string {
    if (!value) return new Date().toISOString();

    // Try to parse the date
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }

    return date.toISOString();
  }

  private sanitizePhoneNumber(value: any): string {
    if (!value) return '';

    // Basic phone number sanitization - remove non-digits except +
    const cleaned = String(value).replace(/[^\d+]/g, '');
    return cleaned;
  }

  private sanitizeStatus(value: any): string {
    const validStatuses = ['Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled'];
    const status = String(value).trim();

    // Check if status is valid
    if (validStatuses.includes(status)) {
      return status;
    }

    // Try to match case-insensitive
    const matchedStatus = validStatuses.find(s => s.toLowerCase() === status.toLowerCase());
    if (matchedStatus) {
      return matchedStatus;
    }

    // Default to 'Assigned' if invalid
    log(`Invalid status '${status}', defaulting to 'Assigned'`, 'field-mapping');
    return 'Assigned';
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone validation - should contain digits and optionally start with +
    const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(phone);
  }

  private isValidStatus(status: string): boolean {
    const validStatuses = ['Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled'];
    return validStatuses.some(s => s.toLowerCase() === status.toLowerCase());
  }

  /**
   * Maps field aliases for backward compatibility
   * Handles cases where external systems use different field names
   */
  mapFieldAliases(payload: any): ExternalShipmentPayload {
    const mapped = { ...payload };

    // Handle common field aliases
    if (payload.customerName && !payload.recipientName) {
      mapped.recipientName = payload.customerName;
    }
    if (payload.customerMobile && !payload.recipientPhone) {
      mapped.recipientPhone = payload.customerMobile;
    }
    if (payload.address && !payload.deliveryAddress) {
      mapped.deliveryAddress = payload.address;
    }
    if (payload.deliveryTime && !payload.estimatedDeliveryTime) {
      mapped.estimatedDeliveryTime = payload.deliveryTime;
    }

    return mapped as ExternalShipmentPayload;
  }

  /**
   * Gets field mapping documentation for API documentation
   */
  getFieldMappingDocumentation(): Record<string, string> {
    return {
      'External Field': 'Internal Database Field',
      'id': 'piashipmentid (stored as reference), generates new internal id',
      'recipientName': 'customerName',
      'recipientPhone': 'customerMobile',
      'deliveryAddress': 'address',
      'estimatedDeliveryTime': 'deliveryTime',
      'status': 'status (validated against allowed values)',
      'type': 'type',
      'cost': 'cost',
      'routeName': 'routeName',
      'employeeId': 'employeeId',
      'latitude': 'latitude',
      'longitude': 'longitude',
      'priority': 'priority (new field)',
      'pickupAddress': 'pickupAddress (new field)',
      'weight': 'weight (new field)',
      'dimensions': 'dimensions (new field)',
      'specialInstructions': 'specialInstructions (new field)'
    };
  }
}

// Export singleton instance
export const fieldMappingService = new FieldMappingService();