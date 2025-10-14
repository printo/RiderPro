# Shipment Testing Guide

## Overview

This guide covers comprehensive testing of the RiderPro shipment management system, including GPS tracking, offline functionality, and real-time synchronization features.

## Test Environment Setup

### Prerequisites
- Node.js 18+ installed
- Modern browser with GPS support
- Network connectivity for external API testing
- Mobile device or browser dev tools for mobile testing

### Starting the Application
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Application will be available at http://localhost:5000
```

### Test Data
The system uses mock data for development testing:
- **Employee IDs**: EMP001, EMP002, EMP003
- **Routes**: Route A, Route B, Route C
- **Shipment Types**: delivery, pickup
- **Statuses**: pending, assigned, in_transit, delivered, picked_up, cancelled, returned

## Authentication Testing

### Login Flow Testing

#### Test Case 1: Valid Credentials
```bash
# Test with operations team member
Employee ID: Any valid employee ID from your Printo system
Password: Your Printo password
Expected: Successful login with ops_team role
```

#### Test Case 2: Driver Credentials
```bash
# Test with driver account
Employee ID: Driver employee ID
Password: Driver password
Expected: Successful login with driver role, limited permissions
```

#### Test Case 3: Invalid Credentials
```bash
Employee ID: invalid_user
Password: wrong_password
Expected: Login failure with appropriate error message
```

### Role-Based Access Testing

#### Operations Team Access
- ✅ View all shipments
- ✅ Access analytics dashboard
- ✅ Export data functionality
- ✅ Batch update shipments
- ✅ Live tracking dashboard

#### Driver Access
- ✅ View assigned shipments only
- ✅ Update shipment status
- ✅ GPS tracking functionality
- ❌ Analytics dashboard (should redirect)
- ❌ Export functionality (should be hidden)

## Shipment Management Testing

### Viewing Shipments

#### Test Case 1: Shipment List Display
1. Navigate to `/shipments`
2. Verify shipments are displayed in card format
3. Check pagination if more than 20 shipments
4. Verify responsive design on mobile

**Expected Results:**
- Shipments displayed with customer name, address, status
- GPS status indicator (green if coordinates available)
- Clickable cards for details
- Mobile-friendly layout

#### Test Case 2: Filtering Functionality
1. Use filter options in the shipments page
2. Test status filter (pending, delivered, etc.)
3. Test type filter (delivery, pickup)
4. Test route filter
5. Test date range filter

**Expected Results:**
- Filters applied correctly
- Results update in real-time
- Filter state preserved on page refresh
- Clear filter option works

#### Test Case 3: Search Functionality
1. Use search box to find specific shipments
2. Search by customer name
3. Search by shipment ID
4. Search by address

**Expected Results:**
- Relevant results displayed
- Search is case-insensitive
- No results message when appropriate

### Shipment Status Updates

#### Test Case 1: Single Shipment Update
1. Click on a shipment card
2. Open shipment details modal
3. Update status from dropdown
4. Add notes if required
5. Save changes

**Expected Results:**
- Status updated immediately in UI
- Changes reflected in shipment list
- Timestamp updated
- Notes saved correctly

#### Test Case 2: Batch Update
1. Select multiple shipments using checkboxes
2. Click "Batch Update" button
3. Choose new status
4. Add batch notes
5. Confirm update

**Expected Results:**
- All selected shipments updated
- Batch operation completed successfully
- Individual shipment timestamps updated
- Success notification displayed

## GPS Tracking Testing

### Route Session Management

#### Test Case 1: Start Route Session
1. Navigate to Dashboard
2. Click "Start Route" in Route Tracking section
3. Allow GPS permissions when prompted
4. Verify session starts successfully

**Expected Results:**
- GPS permission granted
- Route session created with unique ID
- Session status shows "Active"
- GPS coordinates being recorded

#### Test Case 2: GPS Point Recording
1. With active route session
2. Move to different locations (or simulate in dev tools)
3. Verify GPS points are recorded every 30 seconds
4. Check accuracy and timestamp data

**Expected Results:**
- GPS points stored locally in IndexedDB
- Points include latitude, longitude, accuracy, timestamp
- Background sync attempts to upload points
- Points queued for sync if offline

#### Test Case 3: Shipment Event Recording
1. With active route session
2. Navigate to shipments page
3. Find shipment with "Assigned" status
4. Click "Record Pickup" or "Record Delivery" button
5. Verify GPS coordinates are captured

**Expected Results:**
- Current GPS position captured
- Shipment event stored with coordinates
- Status updated appropriately
- Event synced to server when online

### Smart Route Completion

#### Test Case 1: Route Completion Detection
1. Start route session at a location
2. Travel away from start location
3. Return to within 100 meters of start location
4. Wait for completion detection (after minimum duration)

**Expected Results:**
- Smart completion dialog appears
- Shows distance from start, duration, shipments completed
- Auto-confirm countdown starts
- Option to manually confirm or cancel

#### Test Case 2: Manual Route Completion
1. With active route session
2. Click "Stop Route" button
3. Confirm completion in dialog
4. Verify session ends properly

**Expected Results:**
- Route session marked as completed
- Final GPS coordinates recorded
- Session summary displayed
- All data synced to server

## Offline Functionality Testing

### Offline Data Storage

#### Test Case 1: Work Offline
1. Start route session while online
2. Disconnect from internet (airplane mode or dev tools)
3. Continue recording GPS points
4. Update shipment statuses
5. Record pickup/delivery events

**Expected Results:**
- All actions work normally
- Data stored in IndexedDB
- UI shows offline indicator
- Sync queue builds up pending items

#### Test Case 2: Return Online
1. With pending offline data
2. Reconnect to internet
3. Verify automatic sync begins
4. Check all data is uploaded correctly

**Expected Results:**
- Sync status indicator shows progress
- GPS points uploaded in batches
- Shipment updates synchronized
- Conflict resolution handles duplicates
- Success notifications displayed

### Sync Conflict Resolution

#### Test Case 1: Shipment Status Conflicts
1. Update shipment status offline
2. Have another user update same shipment online
3. Come back online and sync
4. Verify conflict resolution

**Expected Results:**
- Server status takes precedence for status updates
- GPS coordinates from client preserved
- User notified of conflicts resolved
- No data loss occurs

## Mobile Testing

### Responsive Design

#### Test Case 1: Mobile Layout
1. Open application on mobile device or use dev tools
2. Test all pages in portrait and landscape
3. Verify touch targets are appropriate size
4. Check floating menu functionality

**Expected Results:**
- All content fits screen properly
- Touch targets minimum 44px
- Floating menu full-width on mobile
- Navigation works with touch gestures

#### Test Case 2: GPS on Mobile
1. Use actual mobile device with GPS
2. Test GPS accuracy and updates
3. Verify battery optimization features
4. Test background GPS tracking

**Expected Results:**
- GPS coordinates accurate within 10 meters
- Battery optimization reduces frequency when low
- Background tracking continues when app minimized
- Location permissions handled properly

### Performance Testing

#### Test Case 1: Large Dataset
1. Generate or load large number of shipments (100+)
2. Test scrolling performance
3. Verify pagination works correctly
4. Check memory usage

**Expected Results:**
- Smooth scrolling with virtual scrolling
- Pagination loads quickly
- Memory usage remains reasonable
- No performance degradation

#### Test Case 2: GPS Data Volume
1. Run route session for extended period (2+ hours)
2. Generate many GPS points
3. Test sync performance
4. Verify storage limits

**Expected Results:**
- GPS points stored efficiently
- Batch sync handles large volumes
- Storage cleanup prevents overflow
- Performance remains good

## Analytics Testing

### Dashboard Metrics

#### Test Case 1: Dashboard Data
1. Navigate to Dashboard
2. Verify metrics display correctly
3. Check real-time updates
4. Test different user roles

**Expected Results:**
- Metrics show current data
- Charts render properly
- Data updates automatically
- Role-based data filtering works

#### Test Case 2: Route Analytics
1. Navigate to Route Analytics page
2. Test date range filtering
3. Verify employee performance data
4. Check export functionality

**Expected Results:**
- Analytics data loads correctly
- Filters work as expected
- Performance metrics accurate
- Export generates correct data

## API Testing

### Manual API Testing

#### Test Authentication
```bash
# Login request
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "your_employee_id",
    "password": "your_password"
  }'
```

#### Test Shipments API
```bash
# Get shipments (requires auth token)
curl -X GET http://localhost:5000/api/shipments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Test GPS Data
```bash
# Start route session
curl -X POST http://localhost:5000/api/routes/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "startLatitude": 40.7128,
    "startLongitude": -74.0060
  }'

# Record GPS point
curl -X POST http://localhost:5000/api/routes/sessions/SESSION_ID/points \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 40.7130,
    "longitude": -74.0062,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "accuracy": 5.0,
    "speed": 25.5
  }'
```

## Error Handling Testing

### Network Error Scenarios

#### Test Case 1: API Unavailable
1. Stop the server while using the app
2. Try to perform various actions
3. Verify graceful error handling

**Expected Results:**
- Appropriate error messages displayed
- Offline mode activated
- Data queued for later sync
- User can continue working

#### Test Case 2: Authentication Errors
1. Use expired or invalid token
2. Try to access protected resources
3. Verify automatic token refresh

**Expected Results:**
- Token refresh attempted automatically
- User redirected to login if refresh fails
- No data loss during re-authentication
- Seamless user experience

### Data Validation Testing

#### Test Case 1: Invalid GPS Coordinates
1. Try to submit invalid latitude/longitude
2. Test boundary values (>90, <-90 for lat)
3. Verify validation messages

**Expected Results:**
- Invalid coordinates rejected
- Clear validation error messages
- Form prevents submission
- User guided to correct input

## Performance Benchmarks

### Expected Performance Metrics

#### Load Times
- **Initial Page Load**: < 3 seconds
- **Shipment List Load**: < 2 seconds
- **GPS Point Recording**: < 500ms
- **Status Update**: < 1 second

#### GPS Accuracy
- **Urban Areas**: 3-5 meters
- **Suburban Areas**: 5-10 meters
- **Rural Areas**: 10-20 meters

#### Battery Usage
- **Normal Mode**: 5-10% per hour
- **Battery Saver**: 2-5% per hour
- **Background Mode**: 1-3% per hour

## Troubleshooting Common Issues

### GPS Not Working
1. Check browser permissions
2. Verify HTTPS connection (required for GPS)
3. Test on different devices
4. Check console for error messages

### Sync Issues
1. Verify network connectivity
2. Check authentication status
3. Review sync queue in dev tools
4. Test with smaller data sets

### Performance Issues
1. Clear browser cache and storage
2. Check available device memory
3. Reduce GPS tracking frequency
4. Enable battery optimization

## Test Automation

### Unit Tests
```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Test specific features
npm run test -- --grep "GPS tracking"
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e

# Run specific test suite
npm run test:e2e -- --spec "shipment-management.spec.ts"
```

## Reporting Issues

When reporting issues, include:
1. **Environment**: Browser, OS, device type
2. **Steps to Reproduce**: Detailed steps
3. **Expected vs Actual**: What should happen vs what happens
4. **Screenshots**: Visual evidence of issues
5. **Console Logs**: Any error messages
6. **Network Logs**: API request/response data

### Issue Template
```markdown
## Bug Report

**Environment:**
- Browser: Chrome 120.0
- OS: Windows 11
- Device: Desktop

**Steps to Reproduce:**
1. Navigate to shipments page
2. Click on shipment card
3. Try to update status

**Expected Behavior:**
Status should update successfully

**Actual Behavior:**
Error message appears: "Failed to update status"

**Screenshots:**
[Attach screenshots]

**Console Logs:**
```
Error: Network request failed
  at updateShipmentStatus (shipments.ts:45)
```

**Additional Context:**
Issue occurs only with specific shipment IDs
```