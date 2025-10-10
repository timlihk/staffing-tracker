const axios = require('axios');

// Test different user tokens
const tokens = {
  admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTk5MjExMDAsImV4cCI6MTc2MDUyNTkwMH0.lBvaX9z6t7cqj0mQR1rqY5m4aYbV_8eDte5G23oWnzU',
  viewer: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoidGVzdF91c2VyIiwicm9sZSI6InZpZXdlciIsImlhdCI6MTc1OTkyMTEwMCwiZXhwIjoxNzYwNTI1OTAwfQ.test_viewer_token_placeholder'
};

const BASE_URL = 'http://localhost:3000/api';

async function testBillingAccess(role, token) {
  console.log(`\n=== Testing Billing Access for ${role} role ===`);

  try {
    // Test billing projects endpoint
    const response = await axios.get(`${BASE_URL}/billing/projects`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ ${role} can access billing projects`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Projects count: ${response.data.length}`);

  } catch (error) {
    if (error.response) {
      console.log(`❌ ${role} cannot access billing projects`);
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error || 'Access denied'}`);
    } else {
      console.log(`❌ ${role} - Network error: ${error.message}`);
    }
  }
}

async function testBillingSettingsAccess(role, token) {
  console.log(`\n=== Testing Billing Settings Access for ${role} role ===`);

  try {
    // Test billing settings endpoint
    const response = await axios.get(`${BASE_URL}/billing/settings/access`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ ${role} can access billing settings`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Settings:`, response.data);

  } catch (error) {
    if (error.response) {
      console.log(`❌ ${role} cannot access billing settings`);
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.error || 'Access denied'}`);
    } else {
      console.log(`❌ ${role} - Network error: ${error.message}`);
    }
  }
}

async function runTests() {
  console.log('Testing Billing Module Access Controls...');
  console.log('Current billing settings: access_level = null (default: admin_only)');

  // Test admin access
  await testBillingAccess('admin', tokens.admin);
  await testBillingSettingsAccess('admin', tokens.admin);

  // Test viewer access (should be denied)
  await testBillingAccess('viewer', tokens.viewer);
  await testBillingSettingsAccess('viewer', tokens.viewer);
}

runTests().catch(console.error);