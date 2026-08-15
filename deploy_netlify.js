/**
 * Netlify Automatic Deployment Script — Rinesh Kumar Portfolio
 * Direct command-line deployer using Netlify API & CLI
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n=============================================================');
console.log(' 🚀 RINESH KUMAR PORTFOLIO — NETLIFY AUTOMATIC DEPLOYMENT');
console.log('=============================================================\n');

const tokenArg = process.argv[2] || process.env.NETLIFY_AUTH_TOKEN;

if (tokenArg) {
  process.env.NETLIFY_AUTH_TOKEN = tokenArg;
  console.log('🔑 Netlify Auth Token detected! Starting production deployment...\n');
  try {
    const output = execSync('npx netlify deploy --prod --dir=.', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log('\n🎉 Deployment completed successfully!');
  } catch (err) {
    console.error('❌ Deployment error:', err.message);
  }
} else {
  console.log('ℹ️ Starting interactive Netlify CLI deployment...\n');
  console.log('Please follow the prompt in your browser window to authorize your Netlify account:\n');
  try {
    execSync('npx netlify deploy --prod --dir=.', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'inherit'
    });
  } catch (err) {
    console.log('\n-------------------------------------------------------------');
    console.log('📌 Alternative Easy Option (Drag & Drop):');
    console.log('1. Open: https://app.netlify.com/teams/highkey531/projects');
    console.log('2. Drag this folder into Netlify:');
    console.log(`   ${__dirname}`);
    console.log('=============================================================\n');
  }
}
