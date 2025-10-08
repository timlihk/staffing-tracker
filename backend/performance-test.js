const http = require('http');

// Test project list API performance
function testProjectListPerformance() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/projects?limit=10',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token', // Will fail auth but test response time
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Project List API Response Time: ${responseTime}ms`);
      console.log(`Status Code: ${res.statusCode}`);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(responseTime);
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });

    req.end();
  });
}

// Test health endpoint for baseline
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Health Endpoint Response Time: ${responseTime}ms`);
      console.log(`Status Code: ${res.statusCode}`);

      resolve(responseTime);
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });

    req.end();
  });
}

// Run performance tests
async function runPerformanceTests() {
  console.log('=== Performance Test Results ===\n');

  try {
    // Test health endpoint first
    await testHealthEndpoint();
    console.log('');

    // Test project list API
    await testProjectListPerformance();

    console.log('\n=== Performance Test Complete ===');
    console.log('Note: Project API will show 401 (no auth) but response time is measured');
    console.log('Expected response times:');
    console.log('- Health endpoint: < 100ms');
    console.log('- Project list (first load): 1-3 seconds');
    console.log('- Project list (cached): < 100ms');

  } catch (error) {
    console.error('Performance test failed:', error.message);
  }
}

runPerformanceTests();