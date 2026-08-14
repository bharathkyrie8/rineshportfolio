const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

try {
  if (typeof global.WebSocket === 'undefined') {
    global.WebSocket = require('ws');
  }
} catch (_) {}

const DATA_FILE = path.join(__dirname, 'data.json');

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || (SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : null);

let supabase = null;
let isSupabaseActive = false;

// Initialize Supabase Client
function initSupabase() {
  if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http') && SUPABASE_KEY.length > 10) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
      isSupabaseActive = true;
      console.log('⚡ [SUPABASE] Supabase Database Client initialized successfully!');
      console.log(`⚡ [SUPABASE] Target URL: ${SUPABASE_URL}`);
    } catch (err) {
      console.warn('⚠️ [SUPABASE] Failed to initialize Supabase client:', err.message);
      supabase = null;
      isSupabaseActive = false;
    }
  } else {
    supabase = null;
    isSupabaseActive = false;
    console.log('ℹ️ [DATABASE] Supabase credentials not found. Running in local JSON fallback mode (data.json).');
  }
}

// Initial client initialization
initSupabase();

/**
 * Check if Supabase is active & test connection
 */
async function checkSupabaseStatus() {
  if (!supabase) {
    return {
      connected: false,
      mode: 'local_file',
      message: 'Running in local file mode (data.json). Configure SUPABASE_URL and SUPABASE_KEY in .env to connect to Supabase.'
    };
  }

  try {
    const { data, error } = await supabase
      .from('portfolio_data')
      .select('id, updated_at')
      .limit(1);

    if (error && error.code !== 'PGRST116') {
      return {
        connected: false,
        mode: 'supabase_error',
        error: error.message,
        hint: error.hint || 'Make sure the "portfolio_data" table exists in your Supabase database. Run supabase_schema.sql to create it.'
      };
    }

    return {
      connected: true,
      mode: 'supabase',
      url: SUPABASE_URL,
      table: 'portfolio_data'
    };
  } catch (err) {
    return {
      connected: false,
      mode: 'supabase_error',
      error: err.message
    };
  }
}

/**
 * Read local fallback database (data.json)
 */
function readLocalDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      profile: {},
      branding: {},
      hero: {},
      about: {},
      socials: {},
      works: [],
      skills: [],
      services: [],
      experience: [],
      education: [],
      contact: {},
      messages: [],
      security: { adminPasscode: 'admin123' }
    };
  }

  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('❌ [ERROR] Failed reading local data.json:', err.message);
    throw err;
  }
}

/**
 * Save data to local fallback file (data.json)
 */
function saveLocalDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ [ERROR] Failed writing to local data.json:', err.message);
    throw err;
  }
}

/**
 * Get Master Portfolio Data (from Supabase or local fallback)
 */
async function getMasterData() {
  // Try Supabase first if active
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('portfolio_data')
        .select('content, updated_at')
        .eq('id', 'master')
        .single();

      if (!error && data && data.content) {
        return {
          source: 'supabase',
          data: data.content,
          updated_at: data.updated_at
        };
      }

      if (error && error.code === 'PGRST116') {
        // Record does not exist yet; seed from local data.json to Supabase
        console.log('ℹ️ [SUPABASE] "master" record not found in Supabase. Auto-seeding from data.json...');
        const localData = readLocalDatabase();
        await saveMasterData(localData);
        return {
          source: 'supabase_seeded',
          data: localData
        };
      }
    } catch (err) {
      console.warn('⚠️ [SUPABASE] Read failed, falling back to data.json:', err.message);
    }
  }

  // Fallback to local data.json
  const localData = readLocalDatabase();
  return {
    source: 'local_file',
    data: localData
  };
}

/**
 * Save Master Portfolio Data (to Supabase and keep local file in sync)
 */
async function saveMasterData(data) {
  // Always update local file as backup
  saveLocalDatabase(data);

  let supabaseSaved = false;
  let supabaseError = null;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('portfolio_data')
        .upsert({
          id: 'master',
          content: data,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        supabaseError = error.message;
        console.error('❌ [SUPABASE] Upsert error:', error.message);
      } else {
        supabaseSaved = true;
        console.log('✅ [SUPABASE] Master data successfully persisted to Supabase database!');
      }
    } catch (err) {
      supabaseError = err.message;
      console.error('❌ [SUPABASE] Save exception:', err.message);
    }
  }

  return {
    success: true,
    supabaseSaved,
    supabaseError,
    localSaved: true
  };
}

/**
 * Save a new Contact Message (to Supabase contact_messages table + master data inbox)
 */
async function saveContactMessage(msg) {
  const messageObj = {
    id: msg.id || `msg-${Date.now()}`,
    name: msg.name || 'Anonymous',
    email: msg.email || '',
    phone: msg.phone || '',
    subject: msg.subject || 'Portfolio Inquiry',
    message: msg.message || '',
    created_at: new Date().toISOString(),
    read: false
  };

  // 1. If Supabase is available, attempt insert into contact_messages table
  if (supabase) {
    try {
      await supabase
        .from('contact_messages')
        .insert([messageObj]);
      console.log('✅ [SUPABASE] Contact inquiry recorded in contact_messages table.');
    } catch (err) {
      console.warn('⚠️ [SUPABASE] Contact table insert failed:', err.message);
    }
  }

  // 2. Also append to master data messages array
  const master = await getMasterData();
  const currentData = master.data;
  currentData.messages = currentData.messages || [];
  currentData.messages.unshift(messageObj);
  await saveMasterData(currentData);

  return messageObj;
}

/**
 * Get all Contact Messages
 */
async function getContactMessages() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (_) {}
  }

  const master = await getMasterData();
  return master.data.messages || [];
}

/**
 * Mark a Contact Message as Read
 */
async function markContactMessageRead(id) {
  if (supabase) {
    try {
      await supabase
        .from('contact_messages')
        .update({ read: true })
        .eq('id', id);
    } catch (_) {}
  }

  const master = await getMasterData();
  const currentData = master.data;
  if (currentData.messages) {
    const target = currentData.messages.find(m => m.id === id);
    if (target) target.read = true;
    await saveMasterData(currentData);
  }
  return true;
}

/**
 * Delete a Contact Message
 */
async function deleteContactMessage(id) {
  if (supabase) {
    try {
      await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);
    } catch (_) {}
  }

  const master = await getMasterData();
  const currentData = master.data;
  if (currentData.messages) {
    currentData.messages = currentData.messages.filter(m => m.id !== id);
    await saveMasterData(currentData);
  }
  return true;
}

/**
 * Validate Admin Passcode (support plaintext & bcrypt)
 */
async function validatePasscode(inputPasscode) {
  const master = await getMasterData();
  const storedPasscode = master.data?.security?.adminPasscode || 'admin123';
  const passcodeHash = master.data?.security?.passcodeHash;

  if (!inputPasscode) return false;

  // Check direct string match
  if (inputPasscode === storedPasscode) return true;

  // Check bcrypt hash if stored
  if (passcodeHash) {
    try {
      const isMatch = await bcrypt.compare(inputPasscode, passcodeHash);
      if (isMatch) return true;
    } catch (_) {}
  }

  return false;
}

/**
 * Update Admin Passcode (store both plaintext/hash for convenience)
 */
async function updateAdminPasscode(newPasscode) {
  const master = await getMasterData();
  const currentData = master.data;

  currentData.security = currentData.security || {};
  currentData.security.adminPasscode = newPasscode;

  try {
    const salt = await bcrypt.genSalt(10);
    currentData.security.passcodeHash = await bcrypt.hash(newPasscode, salt);
  } catch (_) {}

  await saveMasterData(currentData);
  return true;
}

module.exports = {
  supabase,
  initSupabase,
  checkSupabaseStatus,
  getMasterData,
  saveMasterData,
  saveContactMessage,
  getContactMessages,
  markContactMessageRead,
  deleteContactMessage,
  validatePasscode,
  updateAdminPasscode,
  readLocalDatabase,
  saveLocalDatabase
};
