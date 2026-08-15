const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 Creating lightweight deployment zip...');

const zipPath = path.join(__dirname, 'site.zip');
if (fs.existsSync(zipPath)) {
  try { fs.unlinkSync(zipPath); } catch (_) {}
}

try {
  execSync(`tar.exe --exclude="*.mov" --exclude="*.mp4" -caf site.zip index.html works.html admin assets data.json netlify.toml`, { cwd: __dirname, stdio: 'inherit' });
  console.log('✅ site.zip created successfully!');
} catch (err) {
  console.error('❌ Zip creation failed:', err.message);
}
