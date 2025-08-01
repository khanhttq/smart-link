const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const API_ROUTES = {
  HEALTH: `${BASE_URL}/health`,
  AUTH: {
    REGISTER: `${BASE_URL}/api/auth/register`,
    LOGIN: `${BASE_URL}/api/auth/login`,
  },
  LINKS: {
    CREATE: `${BASE_URL}/api/links`,
    LIST: `${BASE_URL}/api/links`,
    UPDATE: (id) => `${BASE_URL}/api/links/${id}`,
    DELETE: (id) => `${BASE_URL}/api/links/${id}`,
  },
  ANALYTICS: {
    STATS: `${BASE_URL}/api/analytics/stats`,
  },
  USERS: {
    PROFILE: `${BASE_URL}/api/users/profile`,
    UPDATE: `${BASE_URL}/api/users/profile`,
  },
  REDIRECT: (shortCode) => `${BASE_URL}/${shortCode}`,
};

const testEmail = `test_${Date.now()}@example.com`;
const testPassword = 'Test@12345678';
const testName = 'Test User';
const testLink = 'https://example.com';
const testShortCode = `test${Date.now().toString().slice(-4)}`;

const testConfig = {
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

const runTests = async () => {
  console.log('🧪 Starting Shortlink API Test Suite...\n');
  let token = null;
  let linkId = null;
  let testPassed = 0;
  let testFailed = 0;

  // Helper function to track test results
  const trackResult = (passed, message) => {
    console.log(passed ? `✅ ${message}` : `❌ ${message}`);
    passed ? testPassed++ : testFailed++;
  };

  // Test 1: Health Check
  console.log('=== Test 1: Health Check ===');
  try {
    const res = await axios.get(API_ROUTES.HEALTH, { timeout: testConfig.timeout });
    trackResult(res.status === 200, 'Health check passed');
  } catch (err) {
    trackResult(false, `Health check error: ${err.message}`);
  }

  // Test 2: Register New User
  console.log('\n=== Test 2: Register New User ===');
  try {
    const res = await axios.post(
      API_ROUTES.AUTH.REGISTER,
      { email: testEmail, password: testPassword, name: testName },
      { timeout: testConfig.timeout, headers: testConfig.headers }
    );
    trackResult(res.status === 201 && res.data?.data?.tokens?.accessToken, 'Registration successful');
    token = res.data?.data?.tokens?.accessToken;
  } catch (err) {
    trackResult(false, `Registration error: ${err.response?.data?.message || err.message}`);
  }

  // Test 3: Login
  console.log('\n=== Test 3: Login ===');
  try {
    const res = await axios.post(
      API_ROUTES.AUTH.LOGIN,
      { email: testEmail, password: testPassword },
      { timeout: testConfig.timeout, headers: testConfig.headers }
    );
    trackResult(res.status === 200 && res.data?.data?.tokens?.accessToken, 'Login successful');
    token = res.data?.data?.tokens?.accessToken;
  } catch (err) {
    trackResult(false, `Login error: ${err.response?.data?.message || err.message}`);
  }

  // Test 4: Create Short Link
  console.log('\n=== Test 4: Create Short Link ===');
  if (token) {
    try {
      const res = await axios.post(
        API_ROUTES.LINKS.CREATE,
        { originalUrl: testLink, shortCode: testShortCode },
        {
          timeout: testConfig.timeout,
          headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
        }
      );
      trackResult(res.status === 201 && res.data?.data?.id, 'Short link creation successful');
      linkId = res.data?.data?.id;
    } catch (err) {
      trackResult(false, `Short link creation error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping short link creation: No token available');
  }

  // Test 5: List Links
  console.log('\n=== Test 5: List Links ===');
  if (token) {
    try {
      const res = await axios.get(API_ROUTES.LINKS.LIST, {
        timeout: testConfig.timeout,
        headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
      });
      trackResult(res.status === 200, 'Link listing successful');
    } catch (err) {
      trackResult(false, `Link listing error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping link listing: No token available');
  }

  // Test 6: Update Link
  console.log('\n=== Test 6: Update Link ===');
  if (token && linkId) {
    try {
      const res = await axios.put(
        API_ROUTES.LINKS.UPDATE(linkId),
        { originalUrl: 'https://updated-example.com' },
        {
          timeout: testConfig.timeout,
          headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
        }
      );
      trackResult(res.status === 200, 'Link update successful');
    } catch (err) {
      trackResult(false, `Link update error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping link update: No token or link ID available');
  }

  // Test 7: Redirect Short Link
  console.log('\n=== Test 7: Redirect Short Link ===');
  try {
    const res = await axios.get(API_ROUTES.REDIRECT(testShortCode), {
      timeout: testConfig.timeout,
      maxRedirects: 0,
      validateStatus: (status) => status === 302,
    });
    trackResult(res.status === 302, 'Short link redirect successful');
  } catch (err) {
    trackResult(false, `Short link redirect error: ${err.response?.data?.message || err.message}`);
  }

  // Test 8: Analytics Stats
  console.log('\n=== Test 8: Analytics Stats ===');
  if (token) {
    try {
      const res = await axios.get(API_ROUTES.ANALYTICS.STATS, {
        timeout: testConfig.timeout,
        headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
      });
      trackResult(res.status === 200, 'Analytics stats retrieval successful');
    } catch (err) {
      trackResult(false, `Analytics stats error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping analytics stats: No token available');
  }

  // Test 9: User Profile
  console.log('\n=== Test 9: User Profile ===');
  if (token) {
    try {
      const res = await axios.get(API_ROUTES.USERS.PROFILE, {
        timeout: testConfig.timeout,
        headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
      });
      trackResult(res.status === 200, 'User profile retrieval successful');
    } catch (err) {
      trackResult(false, `User profile error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping user profile: No token available');
  }

  // Test 10: Update User Profile
  console.log('\n=== Test 10: Update User Profile ===');
  if (token) {
    try {
      const res = await axios.put(
        API_ROUTES.USERS.UPDATE,
        { name: 'Updated Test User' },
        {
          timeout: testConfig.timeout,
          headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
        }
      );
      trackResult(res.status === 200, 'User profile update successful');
    } catch (err) {
      trackResult(false, `User profile update error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping user profile update: No token available');
  }

  // Test 11: Delete Link
  console.log('\n=== Test 11: Delete Link ===');
  if (token && linkId) {
    try {
      const res = await axios.delete(API_ROUTES.LINKS.DELETE(linkId), {
        timeout: testConfig.timeout,
        headers: { ...testConfig.headers, Authorization: `Bearer ${token}` },
      });
      trackResult(res.status === 204, 'Link deletion successful');
    } catch (err) {
      trackResult(false, `Link deletion error: ${err.response?.data?.message || err.message}`);
    }
  } else {
    trackResult(false, 'Skipping link deletion: No token or link ID available');
  }

  // Test Summary
  console.log('\n=== Test Summary ===');
  console.log(`✅ Tests Passed: ${testPassed}`);
  console.log(`❌ Tests Failed: ${testFailed}`);
  console.log(`🎯 Total Tests: ${testPassed + testFailed}`);
  console.log(`📈 Success Rate: ${((testPassed / (testPassed + testFailed)) * 100).toFixed(2)}%`);
};

(async () => {
  try {
    await runTests();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test suite failed:', err.message);
    process.exit(1);
  }
})();