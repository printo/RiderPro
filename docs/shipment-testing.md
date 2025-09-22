# Shipment Testing Guide

## Overview

This guide explains how to test shipment creation and management in the RiderPro
system.

## Admin Dashboard Testing Tool

### Access

- **URL:** `http://localhost:5000/admin`
- **Requirements:** Admin user access (kanna.p@printo.in or employee ID 12180)

### Features

- **Single Textarea Interface:** Paste single JSON objects or JSON arrays for
  bulk testing
- **Automatic Payload Detection:** Automatically detects single vs multiple
  payloads
- **Sample Payload Generator:** Click "Sample" to auto-fill with valid test data
- **Real-time JSON Validation:** JSON syntax validation with visual feedback
- **Individual Result Tracking:** Clear success/failure reporting for each
  payload
- **Verification Links:** Direct link to view created shipments

## API Endpoint

### Single Shipment Creation

```bash
POST http://localhost:5000/api/shipments
Content-Type: application/json
Authorization: Bearer <access-token>
```

### Bulk Shipment Creation

Send multiple POST requests to the same endpoint, or use the Admin Dashboard
testing tool.

## Payload Format

### Required Fields

```json
{
  "trackingNumber": "TRK123456789",
  "status": "Assigned",
  "priority": "high",
  "type": "delivery",
  "pickupAddress": "123 Pickup Street, Mumbai, Maharashtra",
  "deliveryAddress": "456 Delivery Avenue, Mumbai, Maharashtra",
  "recipientName": "John Doe",
  "recipientPhone": "+91-9876543210",
  "weight": 2.5,
  "dimensions": "30x20x10 cm",
  "customerName": "John Doe",
  "customerMobile": "+91-9876543210",
  "address": "456 Delivery Avenue, Mumbai, Maharashtra",
  "cost": 500.00,
  "deliveryTime": "2025-09-23T15:00:00Z",
  "routeName": "Route A",
  "employeeId": "EMP123"
}
```

### Optional Fields

```json
{
  "specialInstructions": "Handle with care",
  "estimatedDeliveryTime": "2025-09-23T15:00:00Z",
  "actualDeliveryTime": null
}
```

## Testing Scenarios

### 1. Single Shipment Test

```json
{
  "trackingNumber": "TEST001",
  "status": "Assigned",
  "priority": "high",
  "type": "delivery",
  "pickupAddress": "Printo Office, Mumbai",
  "deliveryAddress": "Customer Location, Mumbai",
  "recipientName": "Test Customer",
  "recipientPhone": "+91-9876543210",
  "weight": 1.0,
  "dimensions": "20x15x5 cm",
  "customerName": "Test Customer",
  "customerMobile": "+91-9876543210",
  "address": "Customer Location, Mumbai",
  "cost": 250.00,
  "deliveryTime": "2025-09-23T16:00:00Z",
  "routeName": "Test Route",
  "employeeId": "12180"
}
```

### 2. Bulk Shipments Test (JSON Array)

Create multiple shipments using a JSON array format:

```json
[
  {
    "trackingNumber": "BULK001",
    "status": "Assigned",
    "priority": "high",
    "type": "delivery",
    "pickupAddress": "Warehouse A, Mumbai",
    "deliveryAddress": "Location 1, Mumbai",
    "recipientName": "Customer 1",
    "recipientPhone": "+91-9876543211",
    "weight": 1.5,
    "dimensions": "25x20x10 cm",
    "customerName": "Customer 1",
    "customerMobile": "+91-9876543211",
    "address": "Location 1, Mumbai",
    "cost": 300.00,
    "deliveryTime": "2025-09-23T14:00:00Z",
    "routeName": "Route A",
    "employeeId": "EMP001"
  },
  {
    "trackingNumber": "BULK002",
    "status": "Assigned",
    "priority": "medium",
    "type": "pickup",
    "pickupAddress": "Location 2, Mumbai",
    "deliveryAddress": "Warehouse B, Mumbai",
    "recipientName": "Customer 2",
    "recipientPhone": "+91-9876543212",
    "weight": 3.0,
    "dimensions": "40x30x15 cm",
    "customerName": "Customer 2",
    "customerMobile": "+91-9876543212",
    "address": "Location 2, Mumbai",
    "cost": 450.00,
    "deliveryTime": "2025-09-23T17:00:00Z",
    "routeName": "Route B",
    "employeeId": "EMP002"
  }
]
```

## Using the Admin Testing Tool

### Step-by-Step Process

1. **Login as Admin:**
   - Email: `kanna.p@printo.in` or Employee ID: `12180`
   - Password: Your Printo password

2. **Navigate to Admin Dashboard:**
   - Go to `http://localhost:5000/admin`
   - Scroll to "Shipment Testing" section

3. **Prepare Test Payload:**
   - **Single Shipment:** Paste a JSON object directly
   - **Bulk Shipments:** Paste a JSON array with multiple objects
   - **Sample Data:** Click "Sample" to auto-fill with test data
   - **Validation:** Watch for real-time JSON validation feedback

4. **Send Shipments:**
   - Ensure JSON is valid (green checkmark appears)
   - Click "Send X Shipment(s)" button
   - Watch individual results for each payload

5. **Verify Results:**
   - Check the "Test Results" section for detailed feedback
   - Click "View Shipments" to navigate to the shipments list
   - Verify all data fields are displayed correctly in the sqlite database

6. **Troubleshooting:**
   - Red validation errors indicate JSON syntax issues
   - Individual payload errors show specific validation failures
   - Check browser console for detailed debugging information

## Bulk Testing with cURL

### Single Shipment

```bash
curl -X POST http://localhost:5000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "trackingNumber": "CURL001",
    "status": "Assigned",
    "priority": "high",
    "type": "delivery",
    "pickupAddress": "Test Pickup Location",
    "deliveryAddress": "Test Delivery Location",
    "recipientName": "Test Recipient",
    "recipientPhone": "+91-9876543210",
    "weight": 2.0,
    "dimensions": "30x20x10 cm",
    "customerName": "Test Customer",
    "customerMobile": "+91-9876543210",
    "address": "Test Delivery Location",
    "cost": 400.00,
    "deliveryTime": "2025-09-23T15:00:00Z",
    "routeName": "Test Route",
    "employeeId": "12180"
  }'
```

### Bulk Shipments (Script)

```bash
#!/bin/bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE_URL="http://localhost:5000/api/shipments"

# Create multiple shipments
for i in {1..5}; do
  curl -X POST $BASE_URL \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"trackingNumber\": \"BULK00$i\",
      \"status\": \"Assigned\",
      \"priority\": \"medium\",
      \"type\": \"delivery\",
      \"pickupAddress\": \"Warehouse, Mumbai\",
      \"deliveryAddress\": \"Location $i, Mumbai\",
      \"recipientName\": \"Customer $i\",
      \"recipientPhone\": \"+91-987654321$i\",
      \"weight\": $(echo \"1.5 + $i * 0.5\" | bc),
      \"dimensions\": \"30x20x10 cm\",
      \"customerName\": \"Customer $i\",
      \"customerMobile\": \"+91-987654321$i\",
      \"address\": \"Location $i, Mumbai\",
      \"cost\": $(echo \"300 + $i * 50\" | bc),
      \"deliveryTime\": \"2025-09-23T$(printf %02d $((14 + $i))):00:00Z\",
      \"routeName\": \"Route $(echo $i | tr '12345' 'ABCDE')\",
      \"employeeId\": \"EMP00$i\"
    }"
  echo "Created shipment $i"
  sleep 1
done
```

## Validation Rules

### Required Fields

- `trackingNumber` (string, unique)
- `status` (string: "Assigned", "In Transit", "Delivered", "Picked Up",
  "Returned", "Cancelled")
- `priority` (string: "low", "medium", "high")
- `type` (string: "delivery", "pickup")
- `pickupAddress` (string)
- `deliveryAddress` (string)
- `recipientName` (string)
- `recipientPhone` (string, phone format)
- `weight` (number, positive)
- `dimensions` (string)
- `customerName` (string)
- `customerMobile` (string, phone format)
- `address` (string)
- `cost` (number, positive)
- `deliveryTime` (string, ISO date format)
- `routeName` (string)
- `employeeId` (string)

### Data Types

- **Dates:** ISO 8601 format (`2025-09-23T15:00:00Z`)
- **Phone Numbers:** Include country code (`+91-9876543210`)
- **Weight:** Decimal number in kg
- **Cost:** Decimal number in currency units

## Troubleshooting

### Common Errors

1. **"Invalid JSON format"**
   - Check JSON syntax with online validator
   - Ensure all quotes are properly escaped
   - Verify comma placement
   - Use the real-time validation feedback in the interface

2. **"Missing required fields"**
   - Ensure all required fields are present: trackingNumber, status, priority,
     pickupAddress, deliveryAddress, recipientName, recipientPhone, weight,
     dimensions
   - Check field names match exactly (case-sensitive)

3. **"insertShipmentSchema.parse is not a function"**
   - This error has been fixed in the latest version
   - Restart the server if you still see this error
   - The schema now properly validates all required fields

4. **"Invalid date format"**
   - Use ISO 8601 format: `2025-09-23T15:00:00Z`
   - Ensure dates are in the future for deliveries

5. **"Duplicate tracking number"**
   - Each shipment needs a unique tracking number
   - Use timestamp or counter for uniqueness
   - The sample generator automatically creates unique tracking numbers

6. **"Weight must be a positive number"**
   - Ensure weight field is a number, not a string
   - Weight must be greater than 0

### Debugging Tips

1. **Use Browser Console:**
   - Open Developer Tools (F12)
   - Check Console tab for detailed error messages

2. **Check Network Tab:**
   - Monitor API requests and responses
   - Verify payload structure and response codes

3. **Verify in Shipments List:**
   - Navigate to `/shipments` after creation
   - Confirm shipments appear with correct data

## Best Practices

1. **Use Unique Tracking Numbers:**
   ```javascript
   "trackingNumber": "TRK" + Date.now() + Math.random().toString(36).substr(2, 5)
   ```

2. **Set Realistic Delivery Times:**
   ```javascript
   "deliveryTime": new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
   ```

3. **Test Different Scenarios:**
   - Different shipment types (delivery vs pickup)
   - Various priorities (low, medium, high)
   - Different employee assignments
   - Multiple routes

4. **Validate Before Sending:**
   - Use JSON.parse() to validate syntax
   - Check all required fields are present
   - Verify data types match schema

## Integration Examples

### From External System

```javascript
// Example: Integrate with external order system
const createShipmentFromOrder = async (order) => {
  const shipmentPayload = {
    trackingNumber: `ORD-${order.id}`,
    status: "Assigned",
    priority: order.urgent ? "high" : "medium",
    type: "delivery",
    pickupAddress: order.warehouse.address,
    deliveryAddress: order.customer.address,
    recipientName: order.customer.name,
    recipientPhone: order.customer.phone,
    weight: order.totalWeight,
    dimensions: order.packageDimensions,
    customerName: order.customer.name,
    customerMobile: order.customer.phone,
    address: order.customer.address,
    cost: order.deliveryFee,
    deliveryTime: order.requestedDeliveryTime,
    routeName: order.assignedRoute,
    employeeId: order.assignedDriver,
  };

  const response = await fetch("http://localhost:5000/api/shipments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(shipmentPayload),
  });

  return response.json();
};
```

---

**Last Updated:** September 22, 2025 **Version:** 1.0.0
