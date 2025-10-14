# Implementation Plan

- [x] 1. Database Schema Migration and Updates
  - Create database migration script to add missing columns to shipments table
  - Add priority, pickupAddress, weight, dimensions, specialInstructions, actualDeliveryTime columns
  - Create indexes for external integration fields
  - Update database connection initialization to run migrations
  - _Requirements: 1.5, 1.8, 3.3, 3.8_

- [x] 2. Field Mapping Service Implementation
  - [x] 2.1 Create FieldMappingService class for external-internal data conversion
    - Implement mapExternalToInternal method to convert external payload to database format
    - Map recipientName to customerName, recipientPhone to customerMobile, deliveryAddress to address
    - Implement mapInternalToExternal method to convert database format to external update format
    - Add validation for required fields and data types
    - Handle field aliases and mapping between different naming conventions
    - _Requirements: 1.3, 1.5, 2.3_

  - [x] 2.2 Create validation service for external payloads
    - Implement payload structure validation for single shipments
    - Implement payload structure validation for batch shipments
    - Add field-level validation (latitude/longitude ranges, phone number formats, etc.)
    - Create comprehensive error messages for validation failures
    - _Requirements: 1.2, 1.6, 4.5_

- [x] 3. External Shipment Reception API Implementation
  - [x] 3.1 Implement POST /api/shipments/receive endpoint
    - Create route handler for receiving external shipment data
    - Support both single shipment object and array of shipments formats
    - Integrate with FieldMappingService for data conversion
    - Implement database insertion with proper error handling
    - _Requirements: 1.1, 1.4, 1.7_

  - [x] 3.2 Add batch processing capabilities
    - Handle array of shipments in single request
    - Implement transaction handling for batch operations
    - Add duplicate detection using piashipmentid
    - Create detailed response with per-shipment status
    - _Requirements: 1.4, 4.6_

  - [x] 3.3 Implement webhook authentication and security
    - Add webhook token validation for external system requests
    - Implement rate limiting for external endpoints
    - Add request logging and monitoring
    - Create security headers and CORS configuration
    - _Requirements: 4.4, 4.5_

- [x] 4. External Update Sending API Implementation
  - [x] 4.1 Implement POST /api/shipments/update/external endpoint
    - Create route handler for sending single shipment updates to external systems
    - Integrate with FieldMappingService for data conversion
    - Implement webhook sending functionality to external system endpoints
    - Add response handling and error management
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 4.2 Implement POST /api/shipments/update/external/batch endpoint
    - Create route handler for sending batch shipment updates
    - Support array of updates with metadata
    - Implement parallel webhook sending with proper error handling
    - Add comprehensive batch response with per-update status
    - _Requirements: 2.2, 2.3, 2.6_

  - [x] 4.3 Enhance ExternalSyncService for webhook communication
    - Update existing external sync service to handle new webhook patterns
    - Add retry mechanisms for failed webhook deliveries
    - Implement webhook endpoint configuration management
    - Add logging and monitoring for external communications
    - _Requirements: 2.4, 4.7, 4.8_

- [x] 5. Update Shared Schema and Type Definitions
  - [x] 5.1 Update shared/schema.ts with new interfaces
    - Add ExternalShipmentPayload interface matching required payload structure
    - Add ExternalShipmentBatch interface for array processing
    - Add ExternalUpdatePayload interface for outgoing updates
    - Update existing Shipment interface to include all new fields
    - _Requirements: 1.3, 2.3, 3.3_

  - [x] 5.2 Update validation schemas
    - Create validation schema for external shipment reception
    - Create validation schema for external update sending
    - Update existing shipment validation to handle new fields
    - Add proper TypeScript types for all new interfaces
    - _Requirements: 1.6, 2.5, 4.5_

- [x] 6. Fix Internal API Endpoints
  - [x] 6.1 Update existing shipment endpoints to handle new fields
    - Modify GET /api/shipments to return new fields
    - Update POST /api/shipments (internal creation) to handle new fields
    - Update PATCH /api/shipments/:id to support new fields
    - Ensure backward compatibility with existing client code
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 6.2 Update client API service
    - Modify client/src/api/shipments.ts to handle new field structure
    - Update API request/response interfaces
    - Add new methods for external integration endpoints
    - Ensure proper error handling for new validation rules
    - _Requirements: 3.1, 3.5_

- [x] 7. Update API Documentation
  - [x] 7.1 Fix shipment data reception documentation
    - Replace incorrect GET endpoints with proper POST endpoints
    - Update payload examples to use correct field mapping (id, recipientName->customerName, etc.)
    - Add both single shipment and array format examples
    - Include proper Indian addresses, phone numbers, and currency
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 7.2 Add external system integration documentation
    - Document POST /api/shipments/receive endpoint with examples
    - Document POST /api/shipments/update/external endpoints
    - Add webhook authentication documentation
    - Include error handling and response format documentation
    - _Requirements: 2.1, 2.2, 4.4, 4.5_

  - [x] 7.3 Update data format examples
    - Update all payload examples to match actual implementation and field mapping
    - Document field mapping between external payload and database schema
    - Add comprehensive field mapping documentation
    - Include integration flow diagrams and examples
    - _Requirements: 3.2, 3.4, 4.9_

- [ ] 8. Integration Testing and Validation
  - [ ] 8.1 Create integration tests for external endpoints
    - Test POST /api/shipments/receive with single shipment payload
    - Test POST /api/shipments/receive with batch shipment payload
    - Test external update endpoints with proper payload formats
    - Test error handling and validation scenarios
    - _Requirements: 1.7, 2.6, 4.6_

  - [ ]* 8.2 Create unit tests for field mapping and validation
    - Test FieldMappingService conversion methods
    - Test validation service with various payload formats
    - Test edge cases and error conditions
    - Test database migration and schema updates
    - _Requirements: 1.5, 2.3, 4.5_

  - [ ] 8.3 Test end-to-end external system integration
    - Create mock external system for testing
    - Test complete flow: receive data → process → send updates
    - Test webhook authentication and security
    - Validate data integrity throughout the process
    - _Requirements: 4.1, 4.2, 4.7_

- [x] 9. Fix Health Check Performance Issues
  - [x] 9.1 Investigate and fix excessive health check calls
    - Analyze server logs to identify health check call frequency
    - Check client-side code for unnecessary polling or repeated calls
    - Identify root cause of excessive health check requests
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 9.2 Implement health check optimization
    - Add caching to health check endpoints to reduce database load
    - Implement rate limiting for health check endpoints
    - Fix any client-side polling that calls health checks too frequently
    - Optimize health check endpoint implementation for better performance
    - _Requirements: 5.5, 5.6, 5.7, 5.8_