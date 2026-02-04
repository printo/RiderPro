# Batch Shipments Webhook Documentation

## Overview
The RiderPro system now supports batch processing of shipments through updated webhook endpoints. This allows external systems to send multiple shipments in a single API call.

## Authentication
All webhook endpoints support dual authentication:
- **API Key**: Include `x-api-key` header with your API key
- **JWT Token**: Include `Authorization: Bearer <token>` header
- **Optional**: `X-Service-Name` header for service identification

## Endpoints

### 1. `/api/v1/shipments/receive` (Updated)
**Method**: POST  
**Description**: Main webhook endpoint that supports both single order and batch shipments formats

#### Supported Formats:

**Legacy Single Order Format:**
```json
{
  "order": { 
    "id": "12345",
    "type": "delivery",
    // ... other order fields
  },
  "rider_id": "EMP001",
  "event": "order_assigned"
}
```

**New Batch Shipments Format:**
```json
{
  "shipments": [
    {
      "id": "12345",
      "type": "delivery",
      "status": "Assigned",
      "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
      "recipientName": "John Doe",
      "recipientPhone": "9876543210",
      "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
      "cost": 150.0,
      "routeName": "Route A",
      "employeeId": "EMP001",
      "pickupAddress": "..." // Optional for pickup orders
    }
  ]
}
```

### 2. `/api/v1/webhooks/receive-shipments-batch` (New)
**Method**: POST  
**Description**: Dedicated endpoint for batch shipments processing

**Payload Format:**
```json
{
  "shipments": [
    {
      "id": "12345",
      "type": "delivery",
      "status": "Assigned", 
      "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
      "recipientName": "John Doe",
      "recipientPhone": "9876543210",
      "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
      "cost": 150.0,
      "routeName": "Route A",
      "employeeId": "EMP001",
      "pickupAddress": "..." // Optional for pickup orders
    }
  ]
}
```

## Field Mapping

| Your Field | RiderPro Field | Required | Description |
|------------|----------------|----------|-------------|
| `id` | `id` | ✅ | Unique shipment identifier |
| `type` | `type` | ✅ | "delivery" or "pickup" |
| `status` | `status` | ✅ | Current shipment status |
| `deliveryAddress` | `address` | ✅ | Delivery/pickup address |
| `recipientName` | `customer_name` | ✅ | Customer name |
| `recipientPhone` | `customer_mobile` | ✅ | Customer phone |
| `estimatedDeliveryTime` | `delivery_time` | ✅ | ISO 8601 datetime |
| `cost` | `cost` | ✅ | Shipment cost (float) |
| `routeName` | `route_name` | ✅ | Route identifier |
| `employeeId` | `employee_id` | ✅ | Rider/driver ID |
| `pickupAddress` | `pickup_address` | ❌ | Optional pickup address |

## Response Formats

### Success Response (All Processed)
**Status**: 201 Created
```json
{
  "success": true,
  "message": "All 2 shipments processed successfully",
  "total_shipments": 2,
  "processed": 2,
  "failed": 0,
  "shipment_ids": ["12345", "12346"],
  "errors": []
}
```

### Partial Success Response
**Status**: 207 Multi-Status
```json
{
  "success": true,
  "message": "Partial success: 1 processed, 1 failed",
  "total_shipments": 2,
  "processed": 1,
  "failed": 1,
  "shipment_ids": ["12345"],
  "errors": [
    "Shipment 2 (ID: 12346): Missing required field 'employeeId'"
  ]
}
```

### Error Response (All Failed)
**Status**: 400 Bad Request
```json
{
  "success": false,
  "message": "All shipments failed to process",
  "total_shipments": 2,
  "processed": 0,
  "failed": 2,
  "shipment_ids": [],
  "errors": [
    "Shipment 1: Missing required field 'id'",
    "Shipment 2: Missing required field 'employeeId'"
  ]
}
```

## Authentication Errors

### Missing Authentication
**Status**: 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required. Provide x-api-key header or Authorization: Bearer <token>."
}
```

### Invalid Authentication
**Status**: 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication failed. Invalid API key or token."
}
```

## Role-Based Access

After shipments are processed and stored in the database, they are automatically filtered based on user roles when accessed through the frontend:

- **Admin/Manager/Ops Team**: Can see all shipments
- **Riders/Drivers**: Can only see shipments assigned to their `employeeId`

## Testing

Use the provided `test_batch_webhook.py` script to test the webhook:

```bash
# Set your API key
export RIDER_PRO_ACCESS_KEY=your_api_key_here

# Start Django server
python manage.py runserver

# Run test
python test_batch_webhook.py
```

## Example cURL Commands

### Test with API Key
```bash
curl -X POST http://localhost:8000/api/v1/shipments/receive \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -H "X-Service-Name: pops" \
  -d '{
    "shipments": [
      {
        "id": "12345",
        "type": "delivery",
        "status": "Assigned",
        "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
        "recipientName": "John Doe",
        "recipientPhone": "9876543210",
        "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
        "cost": 150.0,
        "routeName": "Route A",
        "employeeId": "EMP001"
      }
    ]
  }'
```

### Test with JWT Token
```bash
curl -X POST http://localhost:8000/api/v1/shipments/receive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token_here" \
  -H "X-Service-Name: pops" \
  -d '{
    "shipments": [
      {
        "id": "12345",
        "type": "delivery",
        "status": "Assigned",
        "deliveryAddress": "123 Main St, Bangalore, KA 560001, India",
        "recipientName": "John Doe",
        "recipientPhone": "9876543210",
        "estimatedDeliveryTime": "2023-10-27T10:00:00+00:00",
        "cost": 150.0,
        "routeName": "Route A",
        "employeeId": "EMP001"
      }
    ]
  }'
```

## Error Handling

The webhook implements robust error handling:

1. **Authentication Validation**: Checks for valid API key or JWT token
2. **Payload Validation**: Validates required fields for each shipment
3. **Individual Processing**: Each shipment is processed independently
4. **Detailed Error Reporting**: Specific error messages for each failed shipment
5. **Partial Success Support**: Returns detailed results even if some shipments fail

## Database Integration

Successfully processed shipments are:
1. **Stored** in the `Shipment` model with all provided fields
2. **Linked** to the assigned rider via `employee_id`
3. **Marked** as synced with `sync_status = 'synced'`
4. **Available** immediately in the frontend based on user role permissions