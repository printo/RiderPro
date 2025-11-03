const log = console.log;
import {
  ExternalShipmentPayload,
  ExternalShipmentBatch,
  ValidationError,
  ValidationResult
} from './FieldMappingService.js';

/**
 * Comprehensive validation service for external payloads
 * Provides detailed validation for single shipments, batch shipments, and field-level validation
 */
export class PayloadValidationService {
  private readonly validStatuses = [
    'Assigned', 'In Transit', 'Delivered', 'Picked Up', 'Returned', 'Cancelled'
  ];

  private readonly validTypes = ['delivery', 'pickup'];
  private readonly validPriorities = ['high', 'medium', 'low'];

  // Indian phone number patterns
  private readonly indianPhonePatterns = [
    /^(\+91|91)?[6-9]\d{9}$/, // Standard Indian mobile
    /^(\+91|91)?\d{10}$/,     // 10-digit number
    /^(\+91|91)?\d{11}$/      // 11-digit with area code
  ];

  /**
   * Validates single shipment payload with comprehensive field validation
   */
  validateSingleShipment(payload: any): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      log(`Validating single shipment payload for ID: ${payload?.id || 'unknown'}`, 'payload-validation');

      // Basic structure validation
      if (!payload || typeof payload !== 'object') {
        return {
          isValid: false,
          errors: [{
            field: 'payload',
            value: payload,
            message: 'Payload must be a valid object',
            code: 'INVALID_PAYLOAD_STRUCTURE'
          }]
        };
      }

      // Required field validation
      this.validateRequiredFields(payload, errors);

      // Field-specific validation
      this.validateIdField(payload.id, errors);
      this.validateStatusField(payload.status, errors);
      this.validateTypeField(payload.type, errors);
      this.validatePriorityField(payload.priority, errors);
      this.validateAddressFields(payload, errors);
      this.validateContactFields(payload, errors);
      this.validateNumericFields(payload, errors);
      this.validateCoordinateFields(payload, errors);
      this.validateDateTimeFields(payload, errors);
      this.validateOptionalFields(payload, errors);

      const isValid = errors.length === 0;

      if (isValid) {
        log(`Single shipment validation passed for ID: ${payload.id}`, 'payload-validation');
      } else {
        log(`Single shipment validation failed for ID: ${payload?.id || 'unknown'} with ${errors.length} errors`, 'payload-validation');
      }

      return {
        isValid,
        errors,
        sanitizedData: isValid ? this.sanitizePayload(payload) : undefined
      };

    } catch (error: any) {
      log(`Validation error for single shipment: ${error.message}`, 'payload-validation');
      return {
        isValid: false,
        errors: [{
          field: 'general',
          value: payload,
          message: `Validation failed: ${error.message}`,
          code: 'VALIDATION_EXCEPTION'
        }]
      };
    }
  }

  /**
   * Validates batch shipment payload
   */
  validateBatchShipments(batch: any): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      log(`Validating batch shipment payload with ${batch?.shipments?.length || 0} shipments`, 'payload-validation');

      // Basic structure validation
      if (!batch || typeof batch !== 'object') {
        return {
          isValid: false,
          errors: [{
            field: 'batch',
            value: batch,
            message: 'Batch payload must be a valid object',
            code: 'INVALID_BATCH_STRUCTURE'
          }]
        };
      }

      // Validate shipments array
      if (!batch.shipments) {
        errors.push({
          field: 'shipments',
          value: batch.shipments,
          message: 'Shipments array is required',
          code: 'MISSING_SHIPMENTS_ARRAY'
        });
        return { isValid: false, errors };
      }

      if (!Array.isArray(batch.shipments)) {
        errors.push({
          field: 'shipments',
          value: batch.shipments,
          message: 'Shipments must be an array',
          code: 'INVALID_SHIPMENTS_TYPE'
        });
        return { isValid: false, errors };
      }

      if (batch.shipments.length === 0) {
        errors.push({
          field: 'shipments',
          value: batch.shipments,
          message: 'Shipments array cannot be empty',
          code: 'EMPTY_SHIPMENTS_ARRAY'
        });
        return { isValid: false, errors };
      }

      // Validate batch size limits
      if (batch.shipments.length > 100) {
        errors.push({
          field: 'shipments',
          value: batch.shipments.length,
          message: 'Batch size cannot exceed 100 shipments',
          code: 'BATCH_SIZE_EXCEEDED'
        });
      }

      // Validate metadata if present
      if (batch.metadata) {
        this.validateBatchMetadata(batch.metadata, errors);
      }

      // Validate each shipment in the batch
      const shipmentIds = new Set<string>();
      batch.shipments.forEach((shipment: any, index: number) => {
        const shipmentValidation = this.validateSingleShipment(shipment);

        // Get shipment ID for better error identification
        const shipmentId = shipment?.id ? String(shipment.id) : `index-${index}`;

        // Add index prefix to error fields and include shipment ID
        shipmentValidation.errors.forEach(error => {
          errors.push({
            ...error,
            field: `shipments[${index}].${error.field}`,
            message: `Shipment ID ${shipmentId} (${index + 1}): ${error.message}`
          });
        });

        // Check for duplicate IDs within batch (using shipment ID if available)
        if (shipment?.id) {
          const idForDuplicateCheck = String(shipment.id);
          if (shipmentIds.has(idForDuplicateCheck)) {
            // Don't fail on duplicates - just warn, they'll be handled during processing
            errors.push({
              field: `shipments[${index}].id`,
              value: idForDuplicateCheck,
              message: `Duplicate shipment ID '${idForDuplicateCheck}' found in batch - will be skipped`,
              code: 'DUPLICATE_SHIPMENT_ID_WARNING'
            });
          } else {
            shipmentIds.add(idForDuplicateCheck);
          }
        }
      });

      // Separate warnings from errors - duplicates are warnings, not errors
      const blockingErrors = errors.filter(e => e.code !== 'DUPLICATE_SHIPMENT_ID_WARNING');
      const warnings = errors.filter(e => e.code === 'DUPLICATE_SHIPMENT_ID_WARNING');

      const isValid = blockingErrors.length === 0;

      if (isValid) {
        if (warnings.length > 0) {
          log(`Batch validation passed with ${warnings.length} duplicate warnings for ${batch.shipments.length} shipments`, 'payload-validation');
        } else {
          log(`Batch validation passed for ${batch.shipments.length} shipments`, 'payload-validation');
        }
      } else {
        log(`Batch validation failed with ${blockingErrors.length} errors (and ${warnings.length} warnings) across ${batch.shipments.length} shipments`, 'payload-validation');
      }

      return {
        isValid,
        errors: blockingErrors, // Only return blocking errors
        warnings, // Include warnings separately
        sanitizedData: isValid ? this.sanitizeBatch(batch) : undefined
      };

    } catch (error: any) {
      log(`Validation error for batch shipments: ${error.message}`, 'payload-validation');
      return {
        isValid: false,
        errors: [{
          field: 'general',
          value: batch,
          message: `Batch validation failed: ${error.message}`,
          code: 'BATCH_VALIDATION_EXCEPTION'
        }]
      };
    }
  }

  // Private validation methods for specific field types

  private validateRequiredFields(payload: any, errors: ValidationError[]): void {
    const requiredFields = [
      'id', 'status', 'type', 'deliveryAddress', 'recipientName',
      'recipientPhone', 'estimatedDeliveryTime', 'cost', 'routeName', 'employeeId'
    ];

    requiredFields.forEach(field => {
      const value = payload[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          value,
          message: `Required field '${field}' is missing or empty`,
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    });
  }

  private validateIdField(id: any, errors: ValidationError[]): void {
    if (id !== undefined && id !== null) {
      if (typeof id !== 'string') {
        errors.push({
          field: 'id',
          value: id,
          message: 'ID must be a string',
          code: 'INVALID_ID_TYPE'
        });
      } else if (id.trim().length === 0) {
        errors.push({
          field: 'id',
          value: id,
          message: 'ID cannot be empty',
          code: 'EMPTY_ID'
        });
      } else if (id.length > 100) {
        errors.push({
          field: 'id',
          value: id,
          message: 'ID cannot exceed 100 characters',
          code: 'ID_TOO_LONG'
        });
      }
    }
  }

  private validateStatusField(status: any, errors: ValidationError[]): void {
    if (status !== undefined && status !== null) {
      if (typeof status !== 'string') {
        errors.push({
          field: 'status',
          value: status,
          message: 'Status must be a string',
          code: 'INVALID_STATUS_TYPE'
        });
      } else {
        const normalizedStatus = status.trim();
        const isValidStatus = this.validStatuses.some(
          validStatus => validStatus.toLowerCase() === normalizedStatus.toLowerCase()
        );

        if (!isValidStatus) {
          errors.push({
            field: 'status',
            value: status,
            message: `Invalid status. Must be one of: ${this.validStatuses.join(', ')}`,
            code: 'INVALID_STATUS_VALUE'
          });
        }
      }
    }
  }

  private validateTypeField(type: any, errors: ValidationError[]): void {
    if (type !== undefined && type !== null) {
      if (typeof type !== 'string') {
        errors.push({
          field: 'type',
          value: type,
          message: 'Type must be a string',
          code: 'INVALID_TYPE_TYPE'
        });
      } else {
        const normalizedType = type.trim().toLowerCase();
        if (!this.validTypes.includes(normalizedType)) {
          errors.push({
            field: 'type',
            value: type,
            message: `Invalid type. Must be one of: ${this.validTypes.join(', ')}`,
            code: 'INVALID_TYPE_VALUE'
          });
        }
      }
    }
  }

  private validatePriorityField(priority: any, errors: ValidationError[]): void {
    if (priority !== undefined && priority !== null) {
      if (typeof priority !== 'string') {
        errors.push({
          field: 'priority',
          value: priority,
          message: 'Priority must be a string',
          code: 'INVALID_PRIORITY_TYPE'
        });
      } else {
        const normalizedPriority = priority.trim().toLowerCase();
        if (!this.validPriorities.includes(normalizedPriority)) {
          errors.push({
            field: 'priority',
            value: priority,
            message: `Invalid priority. Must be one of: ${this.validPriorities.join(', ')}`,
            code: 'INVALID_PRIORITY_VALUE'
          });
        }
      }
    }
  }

  private validateAddressFields(payload: any, errors: ValidationError[]): void {
    // Validate delivery address
    if (payload.deliveryAddress !== undefined && payload.deliveryAddress !== null) {
      if (typeof payload.deliveryAddress !== 'string') {
        errors.push({
          field: 'deliveryAddress',
          value: payload.deliveryAddress,
          message: 'Delivery address must be a string',
          code: 'INVALID_ADDRESS_TYPE'
        });
      } else if (payload.deliveryAddress.trim().length < 10) {
        errors.push({
          field: 'deliveryAddress',
          value: payload.deliveryAddress,
          message: 'Delivery address must be at least 10 characters long',
          code: 'ADDRESS_TOO_SHORT'
        });
      } else if (payload.deliveryAddress.length > 500) {
        errors.push({
          field: 'deliveryAddress',
          value: payload.deliveryAddress,
          message: 'Delivery address cannot exceed 500 characters',
          code: 'ADDRESS_TOO_LONG'
        });
      }
    }

    // Validate pickup address (optional)
    if (payload.pickupAddress !== undefined && payload.pickupAddress !== null) {
      if (typeof payload.pickupAddress !== 'string') {
        errors.push({
          field: 'pickupAddress',
          value: payload.pickupAddress,
          message: 'Pickup address must be a string',
          code: 'INVALID_PICKUP_ADDRESS_TYPE'
        });
      } else if (payload.pickupAddress.trim().length < 10) {
        errors.push({
          field: 'pickupAddress',
          value: payload.pickupAddress,
          message: 'Pickup address must be at least 10 characters long',
          code: 'PICKUP_ADDRESS_TOO_SHORT'
        });
      }
    }
  }

  private validateContactFields(payload: any, errors: ValidationError[]): void {
    // Validate recipient name
    if (payload.recipientName !== undefined && payload.recipientName !== null) {
      if (typeof payload.recipientName !== 'string') {
        errors.push({
          field: 'recipientName',
          value: payload.recipientName,
          message: 'Recipient name must be a string',
          code: 'INVALID_NAME_TYPE'
        });
      } else if (payload.recipientName.trim().length < 2) {
        errors.push({
          field: 'recipientName',
          value: payload.recipientName,
          message: 'Recipient name must be at least 2 characters long',
          code: 'NAME_TOO_SHORT'
        });
      } else if (payload.recipientName.length > 100) {
        errors.push({
          field: 'recipientName',
          value: payload.recipientName,
          message: 'Recipient name cannot exceed 100 characters',
          code: 'NAME_TOO_LONG'
        });
      }
    }

    // Validate recipient phone with Indian phone number patterns
    if (payload.recipientPhone !== undefined && payload.recipientPhone !== null) {
      if (typeof payload.recipientPhone !== 'string') {
        errors.push({
          field: 'recipientPhone',
          value: payload.recipientPhone,
          message: 'Recipient phone must be a string',
          code: 'INVALID_PHONE_TYPE'
        });
      } else {
        const cleanPhone = payload.recipientPhone.replace(/[\s\-\(\)]/g, '');
        const isValidIndianPhone = this.indianPhonePatterns.some(pattern => pattern.test(cleanPhone));

        if (!isValidIndianPhone) {
          errors.push({
            field: 'recipientPhone',
            value: payload.recipientPhone,
            message: 'Invalid Indian phone number format. Expected format: +91XXXXXXXXXX or 10-digit number',
            code: 'INVALID_INDIAN_PHONE_FORMAT'
          });
        }
      }
    }
  }

  private validateNumericFields(payload: any, errors: ValidationError[]): void {
    // Validate cost
    if (payload.cost !== undefined && payload.cost !== null) {
      const cost = Number(payload.cost);
      if (isNaN(cost)) {
        errors.push({
          field: 'cost',
          value: payload.cost,
          message: 'Cost must be a valid number',
          code: 'INVALID_COST_TYPE'
        });
      } else if (cost < 0) {
        errors.push({
          field: 'cost',
          value: payload.cost,
          message: 'Cost cannot be negative',
          code: 'NEGATIVE_COST'
        });
      } else if (cost > 1000000) {
        errors.push({
          field: 'cost',
          value: payload.cost,
          message: 'Cost cannot exceed ₹10,00,000',
          code: 'COST_TOO_HIGH'
        });
      }
    }

    // Validate weight (optional)
    if (payload.weight !== undefined && payload.weight !== null) {
      const weight = Number(payload.weight);
      if (isNaN(weight)) {
        errors.push({
          field: 'weight',
          value: payload.weight,
          message: 'Weight must be a valid number',
          code: 'INVALID_WEIGHT_TYPE'
        });
      } else if (weight <= 0) {
        errors.push({
          field: 'weight',
          value: payload.weight,
          message: 'Weight must be greater than 0',
          code: 'INVALID_WEIGHT_VALUE'
        });
      } else if (weight > 10000) {
        errors.push({
          field: 'weight',
          value: payload.weight,
          message: 'Weight cannot exceed 10,000 kg',
          code: 'WEIGHT_TOO_HIGH'
        });
      }
    }
  }

  private validateCoordinateFields(payload: any, errors: ValidationError[]): void {
    // Validate latitude
    if (payload.latitude !== undefined && payload.latitude !== null) {
      const lat = Number(payload.latitude);
      if (isNaN(lat)) {
        errors.push({
          field: 'latitude',
          value: payload.latitude,
          message: 'Latitude must be a valid number',
          code: 'INVALID_LATITUDE_TYPE'
        });
      } else if (lat < -90 || lat > 90) {
        errors.push({
          field: 'latitude',
          value: payload.latitude,
          message: 'Latitude must be between -90 and 90 degrees',
          code: 'INVALID_LATITUDE_RANGE'
        });
      }
      // Additional validation for Indian coordinates
      else if (lat < 6 || lat > 37) {
        errors.push({
          field: 'latitude',
          value: payload.latitude,
          message: 'Latitude appears to be outside India (6°N to 37°N). Please verify coordinates.',
          code: 'LATITUDE_OUTSIDE_INDIA'
        });
      }
    }

    // Validate longitude
    if (payload.longitude !== undefined && payload.longitude !== null) {
      const lng = Number(payload.longitude);
      if (isNaN(lng)) {
        errors.push({
          field: 'longitude',
          value: payload.longitude,
          message: 'Longitude must be a valid number',
          code: 'INVALID_LONGITUDE_TYPE'
        });
      } else if (lng < -180 || lng > 180) {
        errors.push({
          field: 'longitude',
          value: payload.longitude,
          message: 'Longitude must be between -180 and 180 degrees',
          code: 'INVALID_LONGITUDE_RANGE'
        });
      }
      // Additional validation for Indian coordinates
      else if (lng < 68 || lng > 97) {
        errors.push({
          field: 'longitude',
          value: payload.longitude,
          message: 'Longitude appears to be outside India (68°E to 97°E). Please verify coordinates.',
          code: 'LONGITUDE_OUTSIDE_INDIA'
        });
      }
    }
  }

  private validateDateTimeFields(payload: any, errors: ValidationError[]): void {
    // Validate estimated delivery time
    if (payload.estimatedDeliveryTime !== undefined && payload.estimatedDeliveryTime !== null) {
      if (typeof payload.estimatedDeliveryTime !== 'string') {
        errors.push({
          field: 'estimatedDeliveryTime',
          value: payload.estimatedDeliveryTime,
          message: 'Estimated delivery time must be a string',
          code: 'INVALID_DATETIME_TYPE'
        });
      } else {
        const date = new Date(payload.estimatedDeliveryTime);
        if (isNaN(date.getTime())) {
          errors.push({
            field: 'estimatedDeliveryTime',
            value: payload.estimatedDeliveryTime,
            message: 'Invalid date format for estimated delivery time. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)',
            code: 'INVALID_DATETIME_FORMAT'
          });
        } else {
          // Check if date is in the past (with 1 hour tolerance)
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (date < oneHourAgo) {
            errors.push({
              field: 'estimatedDeliveryTime',
              value: payload.estimatedDeliveryTime,
              message: 'Estimated delivery time cannot be in the past',
              code: 'PAST_DELIVERY_TIME'
            });
          }

          // Check if date is too far in the future (1 year)
          const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          if (date > oneYearFromNow) {
            errors.push({
              field: 'estimatedDeliveryTime',
              value: payload.estimatedDeliveryTime,
              message: 'Estimated delivery time cannot be more than 1 year in the future',
              code: 'FUTURE_DELIVERY_TIME_TOO_FAR'
            });
          }
        }
      }
    }
  }

  private validateOptionalFields(payload: any, errors: ValidationError[]): void {
    // Validate dimensions (optional)
    if (payload.dimensions !== undefined && payload.dimensions !== null) {
      if (typeof payload.dimensions !== 'string') {
        errors.push({
          field: 'dimensions',
          value: payload.dimensions,
          message: 'Dimensions must be a string',
          code: 'INVALID_DIMENSIONS_TYPE'
        });
      } else if (payload.dimensions.length > 100) {
        errors.push({
          field: 'dimensions',
          value: payload.dimensions,
          message: 'Dimensions cannot exceed 100 characters',
          code: 'DIMENSIONS_TOO_LONG'
        });
      }
    }

    // Validate special instructions (optional)
    if (payload.specialInstructions !== undefined && payload.specialInstructions !== null) {
      if (typeof payload.specialInstructions !== 'string') {
        errors.push({
          field: 'specialInstructions',
          value: payload.specialInstructions,
          message: 'Special instructions must be a string',
          code: 'INVALID_INSTRUCTIONS_TYPE'
        });
      } else if (payload.specialInstructions.length > 1000) {
        errors.push({
          field: 'specialInstructions',
          value: payload.specialInstructions,
          message: 'Special instructions cannot exceed 1000 characters',
          code: 'INSTRUCTIONS_TOO_LONG'
        });
      }
    }

    // Validate route name
    if (payload.routeName !== undefined && payload.routeName !== null) {
      if (typeof payload.routeName !== 'string') {
        errors.push({
          field: 'routeName',
          value: payload.routeName,
          message: 'Route name must be a string',
          code: 'INVALID_ROUTE_NAME_TYPE'
        });
      } else if (payload.routeName.trim().length === 0) {
        errors.push({
          field: 'routeName',
          value: payload.routeName,
          message: 'Route name cannot be empty',
          code: 'EMPTY_ROUTE_NAME'
        });
      }
    }

    // Validate employee ID
    if (payload.employeeId !== undefined && payload.employeeId !== null) {
      if (typeof payload.employeeId !== 'string') {
        errors.push({
          field: 'employeeId',
          value: payload.employeeId,
          message: 'Employee ID must be a string',
          code: 'INVALID_EMPLOYEE_ID_TYPE'
        });
      } else if (payload.employeeId.trim().length === 0) {
        errors.push({
          field: 'employeeId',
          value: payload.employeeId,
          message: 'Employee ID cannot be empty',
          code: 'EMPTY_EMPLOYEE_ID'
        });
      }
    }
  }

  private validateBatchMetadata(metadata: any, errors: ValidationError[]): void {
    if (typeof metadata !== 'object') {
      errors.push({
        field: 'metadata',
        value: metadata,
        message: 'Metadata must be an object',
        code: 'INVALID_METADATA_TYPE'
      });
      return;
    }

    if (metadata.source && typeof metadata.source !== 'string') {
      errors.push({
        field: 'metadata.source',
        value: metadata.source,
        message: 'Metadata source must be a string',
        code: 'INVALID_METADATA_SOURCE'
      });
    }

    if (metadata.batchId && typeof metadata.batchId !== 'string') {
      errors.push({
        field: 'metadata.batchId',
        value: metadata.batchId,
        message: 'Metadata batchId must be a string',
        code: 'INVALID_METADATA_BATCH_ID'
      });
    }

    if (metadata.timestamp) {
      const date = new Date(metadata.timestamp);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'metadata.timestamp',
          value: metadata.timestamp,
          message: 'Invalid timestamp format in metadata',
          code: 'INVALID_METADATA_TIMESTAMP'
        });
      }
    }
  }

  private sanitizePayload(payload: ExternalShipmentPayload): ExternalShipmentPayload {
    return {
      ...payload,
      id: payload.id?.trim(),
      status: this.normalizeStatus(payload.status),
      type: payload.type?.toLowerCase(),
      priority: payload.priority?.toLowerCase(),
      deliveryAddress: payload.deliveryAddress?.trim(),
      recipientName: payload.recipientName?.trim(),
      recipientPhone: this.sanitizePhoneNumber(payload.recipientPhone),
      routeName: payload.routeName?.trim(),
      employeeId: payload.employeeId?.trim(),
      pickupAddress: payload.pickupAddress?.trim(),
      dimensions: payload.dimensions?.trim(),
      specialInstructions: payload.specialInstructions?.trim(),
    };
  }

  private sanitizeBatch(batch: ExternalShipmentBatch): ExternalShipmentBatch {
    return {
      ...batch,
      shipments: batch.shipments.map(shipment => this.sanitizePayload(shipment))
    };
  }

  private normalizeStatus(status: string): string {
    const normalized = status?.trim();
    const matchedStatus = this.validStatuses.find(
      s => s.toLowerCase() === normalized?.toLowerCase()
    );
    return matchedStatus || status;
  }

  private sanitizePhoneNumber(phone: string): string {
    if (!phone) return phone;

    // Remove spaces, dashes, parentheses
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');

    // Add +91 prefix if it's a 10-digit Indian number
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = '+91' + cleaned;
    }

    return cleaned;
  }

  /**
   * Gets validation rules documentation for API documentation
   */
  getValidationRulesDocumentation(): Record<string, any> {
    return {
      requiredFields: [
        'id', 'status', 'type', 'deliveryAddress', 'recipientName',
        'recipientPhone', 'estimatedDeliveryTime', 'cost', 'routeName', 'employeeId'
      ],
      fieldValidation: {
        id: 'String, max 100 characters',
        status: `One of: ${this.validStatuses.join(', ')}`,
        type: `One of: ${this.validTypes.join(', ')}`,
        priority: `Optional. One of: ${this.validPriorities.join(', ')}`,
        deliveryAddress: 'String, 10-500 characters',
        pickupAddress: 'Optional string, min 10 characters',
        recipientName: 'String, 2-100 characters',
        recipientPhone: 'Indian phone number format (+91XXXXXXXXXX or 10 digits)',
        cost: 'Number, 0 to ₹10,00,000',
        weight: 'Optional number, > 0, max 10,000 kg',
        latitude: 'Number, -90 to 90 (preferably 6°N to 37°N for India)',
        longitude: 'Number, -180 to 180 (preferably 68°E to 97°E for India)',
        estimatedDeliveryTime: 'ISO 8601 date string, future date within 1 year',
        dimensions: 'Optional string, max 100 characters',
        specialInstructions: 'Optional string, max 1000 characters',
        routeName: 'String, non-empty',
        employeeId: 'String, non-empty'
      },
      batchLimits: {
        maxBatchSize: 100,
        duplicateIdCheck: 'Enabled within batch'
      }
    };
  }
}

// Export singleton instance
export const payloadValidationService = new PayloadValidationService();