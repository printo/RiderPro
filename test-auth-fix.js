#!/usr/bin/env node

/**
 * Test script to verify authentication fixes
 * Run with: node test-auth-fix.js
 */

async function testAuth() {
  console.log('🔐 Testing Authentication Fixes');
  console.log('===============================');
  
  try {
    // Test 1: Dashboard endpoint (should work without auth)
    console.log('1️⃣ Testing dashboard endpoint...');
    const dashboardResponse = await fetch('http://localhost:5000/api/dashboard');
    console.log(`Dashboard: ${dashboardResponse.status} ${dashboardResponse.statusText}`);
    
    if (dashboardResponse.ok) {
      const data = await dashboardResponse.json();
      console.log(`✅ Dashboard data received: ${data.totalShipments} total shipments`);
    }
    
    // Test 2: Shipments endpoint (should require auth)
    console.log('\n2️⃣ Testing shipments endpoint without auth...');
    const shipmentsResponse = await fetch('http://localhost:5000/api/shipments');
    console.log(`Shipments: ${shipmentsResponse.status} ${shipmentsResponse.statusText}`);
    
    if (shipmentsResponse.status === 401) {
      console.log('✅ Correctly requires authentication');
    } else {
      console.log('❌ Should require authentication');
    }
    
    // Test 3: Login endpoint
    console.log('\n3️⃣ Testing login endpoint structure...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'test' })
    });
    
    console.log(`Login: ${loginResponse.status} ${loginResponse.statusText}`);
    
    if (loginResponse.status === 401) {
      console.log('✅ Login endpoint is working (invalid credentials expected)');
    }
    
    // Test 4: Refresh endpoint
    console.log('\n4️⃣ Testing refresh endpoint structure...');
    const refreshResponse = await fetch('http://localhost:5000/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: 'test-token' })
    });
    
    console.log(`Refresh: ${refreshResponse.status} ${refreshResponse.statusText}`);
    
    if (refreshResponse.status === 401 || refreshResponse.status === 400) {
      console.log('✅ Refresh endpoint is working (invalid token expected)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on localhost:5000');
  }
  
  console.log('\n📋 Summary of Fixes:');
  console.log('✅ Fixed login response parsing to handle actual Printo API format');
  console.log('✅ Fixed role mapping: ops_team → ops_team (not isops)');
  console.log('✅ Fixed getUserFromToken to use external API only');
  console.log('✅ Fixed refresh endpoint URL and field names');
  console.log('✅ Updated role-based filtering: driver role for delivery users');
  console.log('\n🎯 Expected Login Response:');
  console.log('- accessToken: JWT token');
  console.log('- refreshToken: JWT refresh token');
  console.log('- user.role: "ops_team" (for employee 12180)');
  console.log('- user.employeeId: "12180"');
  console.log('\n🔧 Next steps:');
  console.log('1. Restart the server: npm run dev');
  console.log('2. Try logging in with employee ID 12180');
  console.log('3. Check if shipments page works without auto-logout');
  console.log('4. Verify role-based access (ops_team should see all shipments)');
}

testAuth();