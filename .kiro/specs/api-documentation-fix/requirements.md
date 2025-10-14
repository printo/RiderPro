# Requirements Document

## Introduction

The RiderPro system has misalignment between the API documentation and the actual API implementation for external system integration. The system needs to be updated to support the two main communication patterns: receiving shipment data from external systems with the correct payload structure and sending shipment updates back to external systems. Key issues include incorrect payload formats, wrong HTTP methods, missing critical endpoints, field mapping inconsistencies, and excessive health check calls causing performance issues.

## Requirements

### Requirement 1: Verify and Fix Shipment Data Reception API Implementation

**User Story:** As an external system integrator, I want the RiderPro API to correctly receive shipment data with the proper payload structure, so that external systems can successfully send shipment data to RiderPro.

#### Acceptance Criteria

1. WHEN checking the API implementation THEN the system SHALL verify if POST /api/shipments/receive endpoint exists and works correctly
2. WHEN checking payload handling THEN the system SHALL verify the API accepts the external payload format with id field "TRK1760428242357azj0q"
3. WHEN checking field mapping THEN the system SHALL verify all required fields are properly mapped: id (external tracking), status, priority, type, pickupAddress, deliveryAddress, customerName (maps to recipientName), customerMobile (maps to recipientPhone), weight, dimensions, specialInstructions, estimatedDeliveryTime, address, latitude, longitude, cost, deliveryTime, routeName, employeeId
4. WHEN checking array processing THEN the system SHALL verify both single shipment object and array of shipments formats are supported
5. WHEN checking database storage THEN the system SHALL verify received shipments are properly stored with correct field mapping to existing database schema
6. WHEN checking response format THEN the system SHALL verify proper success/error responses are returned
7. IF the API implementation is incorrect THEN the system SHALL fix the implementation to match the required payload structure
8. IF the API endpoint is missing THEN the system SHALL create the proper endpoint with correct payload handling

### Requirement 2: Verify and Implement External System Update API

**User Story:** As a RiderPro system administrator, I want the system to properly send shipment updates to external systems, so that external systems receive real-time status updates from RiderPro.

#### Acceptance Criteria

1. WHEN checking update endpoints THEN the system SHALL verify if "/api/shipments/update/external" endpoint exists and functions correctly
2. WHEN checking batch updates THEN the system SHALL verify if "/api/shipments/update/external/batch" endpoint exists and handles arrays properly
3. WHEN checking update payload THEN the system SHALL verify the API sends correct fields using existing database fields: id (as external tracking), status, actualDeliveryTime, latitude, longitude, employeeId, deliveryNotes, signature, photo
4. WHEN checking external communication THEN the system SHALL verify updates are actually sent to external system webhooks
5. WHEN checking response handling THEN the system SHALL verify external system responses are properly processed
6. IF update endpoints are missing THEN the system SHALL implement the endpoints with proper payload structure
7. IF external communication is not working THEN the system SHALL implement webhook functionality to send updates to external systems
8. IF payload format is incorrect THEN the system SHALL fix the payload to use existing database field structure

### Requirement 3: Audit and Fix API Implementation vs Documentation Alignment

**User Story:** As a developer using the RiderPro system, I want the API implementation and documentation to be perfectly aligned, so that I can rely on accurate information for integration.

#### Acceptance Criteria

1. WHEN auditing shipment endpoints THEN the system SHALL verify which endpoints actually exist in the implementation vs documentation
2. WHEN checking payload formats THEN the system SHALL verify the implementation uses existing database schema fields and fix documentation inconsistencies
3. WHEN checking field mapping THEN the system SHALL verify the database schema supports the external payload structure with proper field mapping
4. WHEN checking authentication THEN the system SHALL verify if Printo API integration uses employee_id or email and fix accordingly
5. WHEN checking internal endpoints THEN the system SHALL verify if POST /api/shipments (internal creation) vs POST /api/shipments/receive (external reception) are properly separated
6. IF implementation doesn't match requirements THEN the system SHALL fix the implementation code
7. IF documentation doesn't match implementation THEN the system SHALL update the documentation
8. IF database schema needs additional fields THEN the system SHALL add them while maintaining existing structure

### Requirement 4: Implement Complete External System Integration Flow

**User Story:** As a system integrator, I want a fully functional two-way communication system between RiderPro and external systems, so that data flows seamlessly in both directions.

#### Acceptance Criteria

1. WHEN implementing integration patterns THEN the system SHALL support the complete two-way communication flow
2. WHEN implementing webhook reception THEN the system SHALL properly receive and process data from external systems
3. WHEN implementing status updates THEN the system SHALL actively send updates to external system webhooks
4. WHEN implementing authentication THEN the system SHALL include proper webhook authentication methods
5. WHEN implementing error handling THEN the system SHALL provide proper error responses and retry mechanisms
6. WHEN implementing batch processing THEN the system SHALL handle both single and batch operations efficiently
7. IF webhook functionality is missing THEN the system SHALL implement webhook sending capabilities
8. IF error handling is inadequate THEN the system SHALL implement proper error handling and logging
9. WHEN updating documentation THEN the system SHALL ensure documentation accurately reflects the implemented functionality
#
## Requirement 5: Fix Performance Issues with Health Check Endpoints

**User Story:** As a system administrator, I want to eliminate excessive health check calls that are causing performance issues, so that the system runs efficiently.

#### Acceptance Criteria

1. WHEN checking health check frequency THEN the system SHALL identify excessive health check calls per second
2. WHEN reviewing health check implementation THEN the system SHALL verify if health checks are being called unnecessarily
3. WHEN checking client-side code THEN the system SHALL identify any polling or repeated health check calls
4. WHEN checking server logs THEN the system SHALL measure the frequency of health check requests
5. IF health checks are called too frequently THEN the system SHALL implement proper caching or rate limiting
6. IF client code is polling health checks THEN the system SHALL fix the client implementation
7. IF health check endpoints are inefficient THEN the system SHALL optimize the endpoint implementation
8. WHEN implementing fixes THEN the system SHALL ensure health checks are only called when necessary