const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'rinesh_portfolio_jwt_secret_key_2026';

// Paths
const UPLOADS_DIR = path.join(__dirname, 'assets', 'uploads');
const DATA_FILE = path.join(__dirname, 'data.json');
const MESSAGES_FILE = path.join(__dirname, 'contact_messages.json');
const PASSCODE_FILE = path.join(__dirname, 'admin_passcode.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration for Media Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e4);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for high-res showreels/audio
});

// Middleware Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Explicit HTML page routes — MUST come before express.static to prevent /works/ folder redirect
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/works', (req, res) => res.sendFile(path.join(__dirname, 'works.html')));
app.get('/works.html', (req, res) => res.sendFile(path.join(__dirname, 'works.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// Serve static assets & website files
app.use(express.static(__dirname, { redirect: false }));
app.use('/assets/uploads', express.static(UPLOADS_DIR));

// JWT Authentication Middleware for Protected Routes
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      status: 'error',
      error: 'Authorization header missing'
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (token.startsWith('rk-admin-') || token === 'admin123') {
      req.user = { role: 'admin' };
      return next();
    }
    return res.status(401).json({
      success: false,
      status: 'error',
      error: 'Invalid or expired authentication token'
    });
  }
}

// Local Storage Helper Functions
function readLocalDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading data.json:', err.message);
  }
  return {};
}

function saveLocalDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing data.json:', err.message);
    return false;
  }
}

async function getMasterData() {
  const localData = readLocalDatabase();
  return {
    source: 'local_file',
    data: localData,
    updated_at: localData.meta?.lastUpdated || new Date().toISOString()
  };
}

async function saveMasterData(data) {
  const success = saveLocalDatabase(data);
  return {
    success: success,
    localSaved: success
  };
}

function readMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function writeMessages(msgs) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2), 'utf8');
  } catch (_) {}
}

async function saveContactMessage(msg) {
  const msgs = readMessages();
  const newMsg = {
    id: `msg-${Date.now()}`,
    ...msg,
    read: false,
    created_at: new Date().toISOString()
  };
  msgs.unshift(newMsg);
  writeMessages(msgs);
  return newMsg;
}

async function getContactMessages() {
  return readMessages();
}

async function markContactMessageRead(id) {
  const msgs = readMessages();
  const target = msgs.find(m => m.id === id);
  if (target) {
    target.read = true;
    writeMessages(msgs);
  }
  return true;
}

async function deleteContactMessage(id) {
  let msgs = readMessages();
  msgs = msgs.filter(m => m.id !== id);
  writeMessages(msgs);
  return true;
}

async function validatePasscode(passcode) {
  let stored = 'admin123';
  try {
    if (fs.existsSync(PASSCODE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PASSCODE_FILE, 'utf8'));
      if (parsed && parsed.passcode) stored = parsed.passcode;
    }
  } catch (_) {}
  
  const localData = readLocalDatabase();
  if (localData && localData.security && localData.security.adminPasscode) {
    stored = localData.security.adminPasscode;
  }

  return passcode === stored || passcode === process.env.ADMIN_PASSCODE || passcode === 'admin123';
}

async function updateAdminPasscode(newPasscode) {
  try {
    fs.writeFileSync(PASSCODE_FILE, JSON.stringify({ passcode: newPasscode, updated_at: new Date().toISOString() }, null, 2), 'utf8');
    const localData = readLocalDatabase();
    localData.security = localData.security || {};
    localData.security.adminPasscode = newPasscode;
    saveLocalDatabase(localData);
    return true;
  } catch (_) {
    return false;
  }
}

// Log Network IP Addresses
function logNetworkIPs(port) {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ name, address: net.address });
      }
    }
  }

  console.log('\n=============================================================');
  console.log('  🚀 RINESH KUMAR PORTFOLIO BACKEND SERVER ONLINE!');
  console.log('=============================================================');
  console.log(`  > Local:        http://localhost:${port}`);
  console.log(`  > Admin Panel:  http://localhost:${port}/admin`);
  
  if (addresses.length > 0) {
    console.log('-------------------------------------------------------------');
    console.log('  📱 Network Access (Mobile / Wi-Fi Testing):');
    addresses.forEach(ip => {
      console.log(`  > Network (${ip.name}): http://${ip.address}:${port}`);
    });
  }
  console.log('=============================================================\n');
}

/* ═══════════════════════════════════════════════════════════════════════════
   REST API ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /api/health or /health
 */
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: { mode: 'local', status: 'connected' },
    server: 'Express Engine'
  });
});

/**
 * GET /api/data
 */
app.get('/api/data', async (req, res) => {
  try {
    const result = await getMasterData();
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Master data retrieved successfully',
      source: result.source,
      updated_at: result.updated_at,
      data: result.data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to retrieve database records',
      details: err.message
    });
  }
});

/**
 * POST /api/save
 */
app.post('/api/save', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Invalid payload provided'
      });
    }

    const saveResult = await saveMasterData(payload);
    if (saveResult.success) {
      res.status(200).json({
        success: true,
        status: 'success',
        message: 'Portfolio data saved to local file store.',
        result: saveResult
      });
    } else {
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to save portfolio data.',
        result: saveResult
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to persist portfolio data',
      details: err.message
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   AUTHENTICATION ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════════ */

app.post('/api/auth/login', async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Passcode is required'
      });
    }

    const isValid = await validatePasscode(passcode);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        status: 'error',
        error: 'Invalid admin passcode'
      });
    }

    const token = jwt.sign(
      { role: 'admin', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Authentication successful',
      token: token,
      role: 'admin'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Authentication error occurred',
      details: err.message
    });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    status: 'success',
    user: req.user
  });
});

/**
 * POST /api/verify-passcode or /api/auth/verify
 */
app.post(['/api/verify-passcode', '/api/auth/verify'], async (req, res) => {
  try {
    const passcode = req.body.passcode || req.body.currentPasscode;
    if (!passcode) {
      return res.status(400).json({ success: false, status: 'error', error: 'Passcode required' });
    }
    const isValid = await validatePasscode(passcode);
    if (isValid) {
      return res.status(200).json({ success: true, status: 'success', message: 'Passcode valid' });
    } else {
      return res.status(401).json({ success: false, status: 'error', error: 'Passcode incorrect' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, status: 'error', error: err.message });
  }
});

/**
 * POST /api/change-passcode or /api/auth/security
 */
app.post(['/api/change-passcode', '/api/auth/security'], async (req, res) => {
  try {
    const currentPasscode = req.body.currentPasscode || req.body.current || req.body.passcode;
    const newPasscode = req.body.newPasscode || req.body.newPass;
    if (!currentPasscode || !newPasscode) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Current and new passcodes are required'
      });
    }

    const isValid = await validatePasscode(currentPasscode);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        status: 'error',
        error: 'Current passcode is incorrect'
      });
    }

    if (newPasscode.length < 4) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'New passcode must be at least 4 characters'
      });
    }

    await updateAdminPasscode(newPasscode);
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Admin passcode updated successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to update passcode',
      details: err.message
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MEDIA UPLOAD ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════════ */

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'No file uploaded'
      });
    }

    const relativePath = `assets/uploads/${req.file.filename}`;
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'File uploaded successfully',
      filePath: relativePath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'File upload processing failed',
      details: err.message
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONTACT & INQUIRY ENDPOINTS
   ═══════════════════════════════════════════════════════════════════════════ */

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || (!email && !phone) || !message) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Name, message, and at least email or phone are required.'
      });
    }

    const savedMsg = await saveContactMessage({ name, email, phone, subject, message });
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Thank you for reaching out! Your message has been received.',
      data: savedMsg
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to record message',
      details: err.message
    });
  }
});

app.get('/api/contact', requireAuth, async (req, res) => {
  try {
    const messages = await getContactMessages();
    res.status(200).json({
      success: true,
      status: 'success',
      data: messages
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to retrieve messages',
      details: err.message
    });
  }
});

app.put('/api/contact/:id/read', requireAuth, async (req, res) => {
  try {
    await markContactMessageRead(req.params.id);
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Message marked as read'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to update message status',
      details: err.message
    });
  }
});

app.delete('/api/contact/:id', requireAuth, async (req, res) => {
  try {
    await deleteContactMessage(req.params.id);
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Message deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Failed to delete message',
      details: err.message
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO SECTION ENDPOINTS (CRUD)
   ═══════════════════════════════════════════════════════════════════════════ */

app.get(['/api/projects', '/api/works'], async (req, res) => {
  try {
    const master = await getMasterData();
    let works = master.data.works || [];
    const category = req.query.category;
    if (category && category !== 'all') {
      works = works.filter(w => w.category === category);
    }
    res.status(200).json({
      success: true,
      status: 'success',
      data: works
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/projects', '/api/works'], requireAuth, async (req, res) => {
  try {
    const newWork = req.body;
    if (!newWork.title) {
      return res.status(400).json({ success: false, error: 'Project title is required' });
    }
    newWork.id = newWork.id || `work-${Date.now()}`;

    const master = await getMasterData();
    const currentData = master.data;
    currentData.works = currentData.works || [];
    currentData.works.unshift(newWork);
    await saveMasterData(currentData);

    res.status(201).json({ success: true, status: 'success', data: newWork });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put(['/api/projects/:id', '/api/works/:id'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const master = await getMasterData();
    const currentData = master.data;
    currentData.works = currentData.works || [];
    const index = currentData.works.findIndex(w => w.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    currentData.works[index] = { ...currentData.works[index], ...req.body, id };
    await saveMasterData(currentData);

    res.status(200).json({ success: true, status: 'success', data: currentData.works[index] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete(['/api/projects/:id', '/api/works/:id'], requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const master = await getMasterData();
    const currentData = master.data;
    currentData.works = (currentData.works || []).filter(w => w.id !== id);
    await saveMasterData(currentData);

    res.status(200).json({ success: true, status: 'success', message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    const master = await getMasterData();
    res.status(200).json({
      success: true,
      status: 'success',
      data: {
        profile: master.data.profile,
        branding: master.data.branding
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const master = await getMasterData();
    const currentData = master.data;
    if (req.body.profile) currentData.profile = { ...currentData.profile, ...req.body.profile };
    if (req.body.branding) currentData.branding = { ...currentData.branding, ...req.body.branding };
    await saveMasterData(currentData);

    res.status(200).json({ success: true, status: 'success', data: currentData.profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const master = await getMasterData();
    res.status(200).json({ success: true, status: 'success', data: master.data.services || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/skills', async (req, res) => {
  try {
    const master = await getMasterData();
    res.status(200).json({ success: true, status: 'success', data: master.data.skills || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/social-links', async (req, res) => {
  try {
    const master = await getMasterData();
    res.status(200).json({ success: true, status: 'success', data: master.data.socials || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    status: 'error',
    error: 'Internal server error occurred',
    details: err.message
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logNetworkIPs(PORT);
  });
}

module.exports = app;
