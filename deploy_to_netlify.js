/**
 * Direct Netlify API Deployer — Rinesh Kumar Portfolio
 * Uploads site to Netlify directly via Netlify HTTP REST API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const token = process.argv[2] || process.env.NETLIFY_AUTH_TOKEN;

if (!token) {
  console.log('\n=============================================================');
  console.log(' 🚀 RINESH KUMAR PORTFOLIO — DIRECT NETLIFY DEPLOYER');
  console.log('=============================================================');
  console.log('\nTo deploy directly from terminal:');
  console.log('1. Get a token from: https://app.netlify.com/user/applications#personal-access-tokens');
  console.log('2. Run: node deploy_to_netlify.js <YOUR_TOKEN>\n');
  console.log('Or Drag & Drop site.zip to: https://app.netlify.com/drop\n');
  process.exit(0);
}

console.log('⚡ Contacting Netlify API for deployment...');

const zipPath = path.join(__dirname, 'site.zip');
if (!fs.existsSync(zipPath)) {
  console.error('❌ site.zip not found. Please wait for zip creation.');
  process.exit(1);
}

const fileData = fs.readFileSync(zipPath);

const req = https.request('https://api.netlify.com/api/v1/sites', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/zip',
    'Content-Length': fileData.length
  }
}, (res) => {
  let responseBody = '';
  res.on('data', chunk => responseBody += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(responseBody);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
        console.log(`👉 Live Website URL: ${json.ssl_url || json.url}`);
        console.log(`👉 Admin Panel URL: ${(json.ssl_url || json.url)}/admin`);
        console.log(`👉 Netlify Site Dashboard: ${json.admin_url}\n`);
      } else {
        console.error('\n❌ Netlify API Error:', json.message || responseBody);
      }
    } catch (e) {
      console.error('\n❌ Failed to parse Netlify response:', responseBody);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(fileData);
req.end();
