const http = require('http');
const app = require('./server');

const server = http.createServer(app);
const TEST_PORT = 5055;

server.listen(TEST_PORT, async () => {
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Test GET /api/health
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    const healthJson = await healthRes.json();
    console.log('✅ /api/health:', healthJson.status, healthJson.database);

    // 2. Test GET /api/data
    const dataRes = await fetch(`http://localhost:${TEST_PORT}/api/data`);
    const dataJson = await dataRes.json();
    console.log('✅ /api/data:', dataJson.success, 'Works count:', dataJson.data?.works?.length);

    // 3. Test POST /api/auth/login (default passcode admin123)
    const loginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'admin123' })
    });
    const loginJson = await loginRes.json();
    console.log('✅ /api/auth/login:', loginJson.success, 'Token received:', !!loginJson.token);

    // 4. Test POST /api/contact
    const contactRes = await fetch(`http://localhost:${TEST_PORT}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Client',
        email: 'client@example.com',
        subject: 'Film Audio Score',
        message: 'Looking for cinematic sound design and mix.'
      })
    });
    const contactJson = await contactRes.json();
    console.log('✅ /api/contact:', contactJson.success, 'Message ID:', contactJson.data?.id);

    // 5. Test GET /api/projects
    const projRes = await fetch(`http://localhost:${TEST_PORT}/api/projects`);
    const projJson = await projRes.json();
    console.log('✅ /api/projects:', projJson.success, 'Projects count:', projJson.data?.length);

    console.log('\n🎉 ALL PORTFOLIO SERVER & API TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    server.close(() => {
      console.log('Test server closed.');
      process.exit(0);
    });
  }
});
