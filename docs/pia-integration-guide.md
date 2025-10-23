# PIA Integration Guide for RiderPro

## Overview
This document provides comprehensive instructions for the PIA team to integrate with RiderPro's shipment management system using API Key authentication.

## Quick Start
- **Endpoint:** `https://rider-pro.printo.in/api/shipments/receive`
- **Method:** `POST`
- **Authentication:** API Key
- **Content-Type:** `application/json`

## Authentication

### API Key Configuration
Use the following API key for all requests:

```
API Key: printo-api-key-2024
Header: x-api-key
```

### Example Request
```bash
curl -X POST https://rider-pro.printo.in/api/shipments/receive \
  -H "Content-Type: application/json" \
  -H "x-api-key: printo-api-key-2024" \
  -d '{"id": "PIA-SHIP-001", "status": "Assigned", ...}'
```

## API Reference

### Endpoint Details
- **URL:** `https://rider-pro.printo.in/api/shipments/receive`
- **Method:** `POST`
- **Authentication:** Required (API Key)
- **Rate Limit:** 100 requests per minute
- **Max Payload:** 1MB

### Request Headers
| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `x-api-key` | `printo-api-key-2024` | Yes |

## Data Models

### Single Shipment Payload
```json
{
  "id": "PIA-SHIP-001",
  "status": "Assigned",
  "priority": "High",
  "customerName": "John Doe",
  "customerMobile": "+1234567890",
  "address": "123 Main St, City, State",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "cost": 25.50,
  "deliveryTime": "2024-01-15T14:30:00Z",
  "employeeId": "EMP-001",
  "vehicleType": "Bike",
  "notes": "Fragile package"
}
```

### Batch Shipments Payload
```json
{
  "shipments": [
    {
      "id": "PIA-SHIP-001",
      "status": "Assigned",
      "priority": "High",
      "customerName": "John Doe",
      "customerMobile": "+1234567890",
      "address": "123 Main St, City, State",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "cost": 25.50,
      "deliveryTime": "2024-01-15T14:30:00Z",
      "employeeId": "EMP-001",
      "vehicleType": "Bike"
    },
    {
      "id": "PIA-SHIP-002",
      "status": "In Transit",
      "priority": "Medium",
      "customerName": "Jane Smith",
      "customerMobile": "+0987654321",
      "address": "456 Oak Ave, City, State",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "cost": 15.75,
      "deliveryTime": "2024-01-15T16:00:00Z",
      "employeeId": "EMP-002",
      "vehicleType": "Car"
    }
  ]
}
```

## Field Specifications

### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique shipment identifier from PIA system | `"PIA-SHIP-001"` |
| `status` | string | Current shipment status | `"Assigned"`, `"In Transit"`, `"Delivered"`, `"Cancelled"` |
| `customerName` | string | Full name of the customer | `"John Doe"` |
| `customerMobile` | string | Customer's mobile number with country code | `"+1234567890"` |
| `address` | string | Complete delivery address | `"123 Main St, City, State, ZIP"` |
| `latitude` | number | GPS latitude coordinate | `40.7128` |
| `longitude` | number | GPS longitude coordinate | `-74.0060` |
| `employeeId` | string | ID of assigned delivery person | `"EMP-001"` |

### Optional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `priority` | string | Priority level | `"High"`, `"Medium"`, `"Low"` |
| `cost` | number | Delivery cost in currency units | `25.50` |
| `deliveryTime` | string | Expected delivery time (ISO 8601) | `"2024-01-15T14:30:00Z"` |
| `vehicleType` | string | Type of vehicle for delivery | `"Bike"`, `"Car"`, `"Van"`, `"Truck"` |
| `notes` | string | Additional delivery instructions | `"Fragile package"` |
| `weight` | number | Package weight in kg | `2.5` |
| `dimensions` | string | Package dimensions | `"25x18x12 cm"` |
| `pickupAddress` | string | Pickup location if applicable | `"456 Warehouse St"` |
| `specialInstructions` | string | Special handling instructions | `"Handle with care"` |

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Shipment data received successfully",
  "data": {
    "shipmentId": "internal-shipment-id",
    "externalId": "PIA-SHIP-001",
    "status": "created"
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Batch Success Response
```json
{
  "success": true,
  "message": "Batch processing completed: 2 created, 0 updated, 0 failed",
  "results": {
    "created": 2,
    "updated": 0,
    "failed": 0
  },
  "processedShipments": [
    {
      "piashipmentid": "PIA-SHIP-001",
      "internalId": "internal-id-1",
      "status": "created",
      "message": "Shipment created successfully"
    },
    {
      "piashipmentid": "PIA-SHIP-002",
      "internalId": "internal-id-2",
      "status": "created",
      "message": "Shipment created successfully"
    }
  ],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Field 'customerName' is required",
    "Field 'latitude' must be a valid number"
  ],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Status Values

### Valid Status Values
| Status | Description |
|--------|-------------|
| `Assigned` | Shipment assigned to delivery person |
| `In Transit` | Shipment is out for delivery |
| `Delivered` | Shipment successfully delivered |
| `Failed` | Delivery attempt failed |
| `Cancelled` | Shipment cancelled |
| `Returned` | Shipment returned to sender |

### Priority Values
| Priority | Description |
|----------|-------------|
| `High` | Urgent delivery required |
| `Medium` | Standard delivery |
| `Low` | Non-urgent delivery |

### Vehicle Types
| Type | Description |
|------|-------------|
| `Bike` | Motorcycle or bicycle |
| `Car` | Small vehicle |
| `Van` | Medium vehicle |
| `Truck` | Large vehicle |

## Implementation Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const sendShipment = async (shipmentData) => {
  try {
    const response = await axios.post(
      'https://rider-pro.printo.in/api/shipments/receive',
      shipmentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'printo-api-key-2024'
        }
      }
    );
    
    console.log('Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
};

// Example usage
const shipment = {
  id: "PIA-SHIP-001",
  status: "Assigned",
  customerName: "John Doe",
  customerMobile: "+1234567890",
  address: "123 Main St, City, State",
  latitude: 40.7128,
  longitude: -74.0060,
  employeeId: "EMP-001"
};

sendShipment(shipment);
```

### Python
```python
import requests
import json

def send_shipment(shipment_data):
    url = "https://rider-pro.printo.in/api/shipments/receive"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": "printo-api-key-2024"
    }
    
    try:
        response = requests.post(url, json=shipment_data, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        raise

# Example usage
shipment = {
    "id": "PIA-SHIP-001",
    "status": "Assigned",
    "customerName": "John Doe",
    "customerMobile": "+1234567890",
    "address": "123 Main St, City, State",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "employeeId": "EMP-001"
}

result = send_shipment(shipment)
print(result)
```

### PHP
```php
<?php
function sendShipment($shipmentData) {
    $url = 'https://rider-pro.printo.in/api/shipments/receive';
    $headers = [
        'Content-Type: application/json',
        'x-api-key: printo-api-key-2024'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($shipmentData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        return json_decode($response, true);
    } else {
        throw new Exception("HTTP Error: " . $httpCode . " - " . $response);
    }
}

// Example usage
$shipment = [
    'id' => 'PIA-SHIP-001',
    'status' => 'Assigned',
    'customerName' => 'John Doe',
    'customerMobile' => '+1234567890',
    'address' => '123 Main St, City, State',
    'latitude' => 40.7128,
    'longitude' => -74.0060,
    'employeeId' => 'EMP-001'
];

try {
    $result = sendShipment($shipment);
    print_r($result);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
```

## Error Handling

### Common HTTP Status Codes
| Code | Description | Action |
|------|-------------|--------|
| `200` | Success | Process response data |
| `400` | Bad Request | Check payload format and required fields |
| `401` | Unauthorized | Verify API key is correct |
| `429` | Rate Limited | Wait and retry after rate limit window |
| `500` | Server Error | Contact support |

### Common Error Messages
| Error | Cause | Solution |
|-------|-------|----------|
| `Field 'customerName' is required` | Missing required field | Include all required fields |
| `Invalid latitude value` | Invalid coordinate | Ensure latitude is a valid number |
| `Invalid status value` | Invalid status | Use valid status values |
| `Rate limit exceeded` | Too many requests | Implement rate limiting |

## Testing

### Test Environment
- **URL:** Same as production (`https://rider-pro.printo.in/api/shipments/receive`)
- **Authentication:** Same API key
- **Data:** Use test data with clear identifiers

### Test Checklist
- [ ] Single shipment creation
- [ ] Batch shipment creation
- [ ] All required fields validation
- [ ] Optional fields handling
- [ ] Error response handling
- [ ] Rate limiting behavior
- [ ] Authentication verification

### Sample Test Data
```json
{
  "id": "PIA-TEST-001",
  "status": "Assigned",
  "customerName": "Test Customer",
  "customerMobile": "+1234567890",
  "address": "123 Test Street, Test City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "employeeId": "TEST-EMP-001",
  "priority": "Medium",
  "notes": "Test shipment - please ignore"
}
```

## Security Considerations

### API Key Security
- Keep API key confidential
- Do not expose in client-side code
- Rotate keys regularly
- Monitor usage for anomalies

### Data Security
- Use HTTPS for all requests
- Validate data before sending
- Sanitize customer information
- Implement proper error handling

### Rate Limiting
- Implement exponential backoff
- Monitor rate limit headers
- Queue requests during high load
- Consider batch processing for efficiency

## Support and Monitoring

### Logging
All requests are logged with:
- Timestamp
- Source IP
- Request payload (sanitized)
- Response status
- Processing time

### Monitoring
- Real-time request monitoring
- Error rate tracking
- Performance metrics
- Alert notifications

### Support Contact
- **Technical Issues:** Contact RiderPro development team
- **API Questions:** Refer to this documentation
- **Emergency:** Use admin panel for immediate assistance

## Changelog

### Version 1.0 (Current)
- Initial API specification
- API Key authentication
- Single and batch shipment support
- Comprehensive error handling

---

**Document Version:** 1.0  
**Last Updated:** January 2024  
**API Version:** 1.0
