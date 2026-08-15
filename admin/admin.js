/**
 * Admin Panel JavaScript — Rinesh Kumar Portfolio Control Panel
 * Handles: Auth, Dynamic API Auto-Discovery, Form Binding, Dynamic Works, Dynamic Social Links (+), Branding & Uploads
 */

/* ─────────────────────────────────────
   STATE & API CONFIGURATION
───────────────────────────────────── */
let portfolioData = {};
let authToken = null;
let currentSection = 'dashboard';
let cachedApiBase = sessionStorage.getItem('rk_active_api') || null;
let isServerOnline = false;
let heartbeatInterval = null;

let latestServerInfo = null;

async function pingCandidate(url, timeoutMs = 600) {
  if (url === null || url === undefined) return { ok: false };
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;

  // 1. Test /api/health
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${cleanUrl}/api/health`, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.status === 'ok' || data.success)) {
        latestServerInfo = data;
        updateDeviceHub(data, cleanUrl);
        return { ok: true, data, endpoint: cleanUrl };
      }
    }
  } catch (_) {}

  // 2. Test /api/data
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${cleanUrl}/api/data`, { method: 'GET', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      updateDeviceHub(latestServerInfo, cleanUrl);
      return { ok: true, endpoint: cleanUrl };
    }
  } catch (_) {}

  return { ok: false };
}

async function getApiBase(forceProbe = false) {
  // 1. Check custom user-configured API URL from localStorage
  const customApi = localStorage.getItem('rk_custom_api');
  if (customApi) {
    const check = await pingCandidate(customApi, 800);
    if (check.ok) {
      cachedApiBase = customApi;
      sessionStorage.setItem('rk_active_api', customApi);
      updateServerStatus(true, customApi);
      return customApi;
    }
  }

  // 2. Check cached API base if valid
  const activeSessionApi = sessionStorage.getItem('rk_active_api');
  const checkTarget = (!forceProbe && (cachedApiBase || activeSessionApi)) || null;
  if (checkTarget) {
    const check = await pingCandidate(checkTarget, 500);
    if (check.ok) {
      cachedApiBase = checkTarget;
      updateServerStatus(true, checkTarget);
      return checkTarget;
    }
  }

  const isHttps = window.location.protocol === 'https:';
  const candidates = [];

  // Local dev server ports — ALWAYS prioritize port 5000 first on HTTP / local file
  if (!isHttps) {
    candidates.push('http://localhost:5000');
    candidates.push('http://127.0.0.1:5000');
    if (window.location.origin && window.location.origin !== 'null') {
      candidates.push(window.location.origin);
    }
    candidates.push('');
  } else {
    if (window.location.origin && window.location.origin !== 'null') {
      candidates.push(window.location.origin);
    }
    candidates.push('');
  }

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];

  for (const origin of uniqueCandidates) {
    const check = await pingCandidate(origin, 600);
    if (check.ok) {
      cachedApiBase = origin;
      sessionStorage.setItem('rk_active_api', origin);
      updateServerStatus(true, origin);
      return origin;
    }
  }

  // Default fallback if server is offline (Static / GitHub Pages mode)
  updateServerStatus(false);
  return (isHttps) ? window.location.origin : 'http://localhost:5000';
}

let hasLoadedData = false;

// Periodic heartbeat to auto-detect when server turns on or off
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(async () => {
    const base = cachedApiBase || (window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:5500');
    const check = await pingCandidate(base, 1000);
    if (check.ok) {
      if (!isServerOnline) {
        updateServerStatus(true, base);
        showToast('🟢 Server connected!', 'success');
        if (authToken && !hasLoadedData) {
          loadData();
        }
      }
    } else {
      if (isServerOnline) {
        updateServerStatus(false);
        showToast('⚠️ Server connection lost. Running in local cache mode.', 'error');
      }
    }
  }, 8000);
}

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupNavigation();
  setupSidebar();
  setupDragAndDropZones();
  setupStatusClickHandlers();

  // Initial API probe & heartbeat start
  getApiBase().then(() => {
    startHeartbeat();
  });
});

function setupStatusClickHandlers() {
  const topbarStatus = document.getElementById('serverStatus');
  if (topbarStatus) {
    topbarStatus.addEventListener('click', openConnModal);
  }

  const authServerStatus = document.getElementById('authServerStatus');
  if (authServerStatus) {
    authServerStatus.addEventListener('click', openConnModal);
  }
}

/* ─────────────────────────────────────
   AUTH (WITH STATIC & OFFLINE FALLBACK)
───────────────────────────────────── */
function setupAuth() {
  const saved = sessionStorage.getItem('rk_admin_token');
  if (saved) {
    authToken = saved;
    grantAccess();
    return;
  }

  const toggleBtn = document.getElementById('togglePass');
  const passInput = document.getElementById('passcodeInput');
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      toggleBtn.innerHTML = isPass ? '<i class="ph ph-eye-slash"></i>' : '<i class="ph ph-eye"></i>';
    });

    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });
  }

  document.getElementById('loginBtn')?.addEventListener('click', attemptLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

async function attemptLogin() {
  const passcode = document.getElementById('passcodeInput').value.trim();
  const errEl = document.getElementById('authError');
  const btnText = document.getElementById('loginBtnText');
  const spinner = document.getElementById('loginSpinner');

  if (!passcode) {
    errEl.textContent = '⛔ Please enter your passcode.';
    errEl.style.display = 'block';
    return;
  }

  btnText.style.display = 'none';
  spinner.style.display = 'inline-block';
  errEl.style.display = 'none';

  let loginSuccess = false;

  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success') {
        authToken = json.token || `rk-admin-${Date.now()}`;
        sessionStorage.setItem('rk_admin_token', authToken);
        loginSuccess = true;
        grantAccess();
        return;
      }
    } else if (res.status === 401) {
      errEl.textContent = '⛔ Invalid passcode. Try again.';
      errEl.style.display = 'block';
      document.getElementById('passcodeInput').value = '';
      document.getElementById('passcodeInput').focus();
      return;
    }
  } catch (_) {
    // Server offline or static hosting (e.g. GitHub Pages) — proceed to offline static auth fallback
  }

  if (!loginSuccess) {
    // ── OFFLINE / STATIC HOSTING FALLBACK ──
    let validPass = 'admin123';
    try {
      // Try reading passcode from static data.json file
      const staticRes = await fetch('../data.json');
      if (staticRes.ok) {
        const sData = await staticRes.json();
        if (sData?.security?.adminPasscode) {
          validPass = sData.security.adminPasscode;
        }
      }
    } catch (_) {}

    // Check cached offline data as well
    const offlinePending = localStorage.getItem('rk_offline_pending');
    if (offlinePending) {
      try {
        const parsed = JSON.parse(offlinePending);
        if (parsed?.security?.adminPasscode) validPass = parsed.security.adminPasscode;
      } catch (_) {}
    }

    if (passcode === validPass) {
      authToken = `static-admin-${Date.now()}`;
      sessionStorage.setItem('rk_admin_token', authToken);
      grantAccess();
      showToast('🌐 Logged in (Static / Offline Cache Mode)', 'info');
    } else {
      errEl.textContent = '⛔ Invalid passcode. (Default is admin123)';
      errEl.style.display = 'block';
      document.getElementById('passcodeInput').value = '';
      document.getElementById('passcodeInput').focus();
    }
  }

  btnText.style.display = 'inline';
  spinner.style.display = 'none';
}

function grantAccess() {
  const overlay = document.getElementById('authOverlay');
  overlay.classList.add('hidden');
  loadData();
  restoreActiveSection();
}

function logout() {
  sessionStorage.removeItem('rk_admin_token');
  sessionStorage.removeItem('rk_active_section');
  authToken = null;
  document.getElementById('passcodeInput').value = '';
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('authError').style.display = 'none';
}

/* ─────────────────────────────────────
   DATA: LOAD FROM API (WITH STATIC DATA.JSON FALLBACK)
───────────────────────────────────── */
async function loadData() {
  let loadedSuccessfully = false;

  // 1. Try fetching from dynamic API endpoint
  try {
    const apiBase = await getApiBase();
    const targetUrl = apiBase ? `${apiBase}/api/data` : '/api/data';
    const res = await fetch(targetUrl);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        portfolioData = json.data;
        loadedSuccessfully = true;
        updateServerStatus(true, apiBase);
        const dataBadge = document.getElementById('api-data-badge');
        if (dataBadge) {
          dataBadge.textContent = 'online (server)';
          dataBadge.className = 'api-badge ok';
        }
      }
    }
  } catch (_) {}

  // 2. If API fails, try fetching static data.json from web root
  if (!loadedSuccessfully) {
    try {
      const candidates = ['../data.json', 'data.json', '/data.json'];
      for (const path of candidates) {
        try {
          const res = await fetch(path);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.hero || data.about || data.works || data.branding)) {
              portfolioData = data;
              loadedSuccessfully = true;
              break;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 3. If both fail, fallback to default template structure
  if (!loadedSuccessfully && (!portfolioData || !portfolioData.hero)) {
    portfolioData = getDefaultData();
    updateServerStatus(false);
  }

  hasLoadedData = true;

  // 4. Only restore unsynced changes if server load failed; otherwise clear stale offline cache
  if (!loadedSuccessfully) {
    const offlinePending = localStorage.getItem('rk_offline_pending');
    if (offlinePending) {
      try {
        const parsed = JSON.parse(offlinePending);
        if (parsed && typeof parsed === 'object') {
          const fallbackWorks = (portfolioData.works && portfolioData.works.length > 0)
            ? portfolioData.works
            : getDefaultData().works;

          portfolioData = Object.assign({}, portfolioData, parsed);

          if (!portfolioData.works || portfolioData.works.length === 0) {
            portfolioData.works = fallbackWorks;
          }
        }
      } catch (_) {}
    }
  } else {
    localStorage.removeItem('rk_offline_pending');
  }

  // Ensure works list always has the 10 works if empty
  if (!portfolioData.works || portfolioData.works.length === 0) {
    portfolioData.works = getDefaultData().works;
  }

  bindAllForms();
  updateDashboardCards();

  const dataBadge = document.getElementById('api-data-badge');
  if (dataBadge) {
    dataBadge.textContent = isServerOnline ? 'online (server)' : 'cached (static/local)';
    dataBadge.className = isServerOnline ? 'api-badge ok' : 'api-badge info';
  }
}

function getDefaultData() {
  return {
    branding: { panelTitle: 'Control Panel', logoTop: 'RINESH', logoBottom: 'KUMAR', siteTitle: 'Rinesh Portfolio' },
    hero: {
      title: 'sound engineer',
      subtitle: "Hello! I'm Rinesh Kumar,\na professional sound engineer & music composer.",
      description: 'Sound engineering, design and music scoring made better.',
      videoPath: 'https://drive.google.com/file/d/1DrSEZ0NhLijo8nKydmF4wHoQM620O6tT/view?usp=sharing',
      skills: ['Mixing & Mastering', 'Sound Design & Foley', 'Music Composing', 'Background Scoring', 'Audio Post-Production'],
      stats: { clientSatisfaction: 98, projectsCompleted: 150, globalClients: 96 },
      centerTagline: 'Sound engineering, design and music scoring made better.',
      ctaLabel: 'view projects',
      ctaLink: 'works.html#works'
    },
    about: {
      name: 'Rinesh Kumar',
      role: 'Sound Engineer & Composer',
      yearsExperience: '5+',
      profileImage: 'assets/images/thumbs/rinesh_guitar.jpg',
      bio: [
        'I’m a passionate sound engineer, sound designer, and music composer focused on creating immersive, pristine audio experiences. With over 5 years of professional experience, I blend artistic creativity with advanced technical expertise to produce tracks, soundscapes, and scores that resonate deeply with listeners.',
        'With a strong ear for detail & a solid technical foundation in acoustics, mixing, and synthesis, I transform raw concepts into polished sonic realities. I believe great sound is purposeful—every layer, frequency, and transition is crafted to enhance the emotional impact of the project.',
        'From initial concept to final master, I work closely with filmmakers, game developers, and musicians to understand their goals and sonic vision.'
      ],
      sectionTitle: 'I am dedicated to bringing your sonic vision to life by crafting unique, highly immersive, and impactful audio experiences. My work speaks louder than words—explore the results.',
      stats: { clientSatisfaction: 99, filmsAlbumsScored: 50 }
    },
    works: [
      {
        id: 'work-1',
        title: 'MANGA',
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/manga.webp',
        videoUrl: '',
        description: 'First look poster of our next Short Film MANGA. Written & Directed by Pradeep Spade.'
      },
      {
        id: 'work-2',
        title: 'The Briefcase',
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/the_briefcase.webp',
        videoUrl: '',
        description: "Official poster and first look of the thriller short film 'The Briefcase'."
      },
      {
        id: 'work-3',
        title: 'Puriyadha Puthir (Ep 3)',
        category: 'web-series',
        categoryBadge: 'Web Series',
        image: 'works/puriyadha_puthir_ep3.webp',
        videoUrl: '',
        description: "Episode 3: 'Way to End'. The final episode of the thriller series coming soon."
      },
      {
        id: 'work-4',
        title: 'Butcher',
        category: 'youtube-release',
        categoryBadge: 'YouTube Release',
        image: 'works/butcher.jpg',
        videoUrl: '',
        description: "Our short release 'Butcher' is now streaming live on YouTube."
      },
      {
        id: 'work-5',
        title: 'Sugar Date',
        category: 'youtube-release',
        categoryBadge: 'YouTube Release',
        image: 'works/sugar_date.jpg',
        videoUrl: '',
        description: 'Sugar Date is live and out now on YouTube. Watch it now!'
      },
      {
        id: 'work-6',
        title: 'Welcome on Board',
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/welcome_on_board.webp',
        videoUrl: '',
        description: 'Not just a story, but an immersive cinematic experience. Welcome on Board is now live.'
      },
      {
        id: 'work-7',
        title: 'Late Comers',
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/late_comers.jpg',
        videoUrl: '',
        description: "Stay tuned for the official trailer & release of our film 'Late Comers'."
      },
      {
        id: 'work-8',
        title: 'காத்திருங்கள் (Stay Tuned)',
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/stay_tuned.jpg',
        videoUrl: '',
        description: 'Collaboration film project with the Tamil Nadu Police (Tenkasi Division).'
      },
      {
        id: 'work-9',
        title: "It's Done",
        category: 'short-film',
        categoryBadge: 'Short Film',
        image: 'works/its_done.webp',
        videoUrl: '',
        description: 'Post-production successfully wrapped for this Tamil short film project.'
      },
      {
        id: 'work-10',
        title: 'Personal Cinematic Project',
        category: 'short-film',
        categoryBadge: 'Personal Project',
        image: 'works/most_personal.jpg',
        videoUrl: '',
        description: '“The most personal is the most creative” — artistic showcase poster.'
      }
    ],
    socialLinks: [
      { id: 'soc-1', name: 'Instagram', icon: 'ph-instagram-logo', url: 'https://www.instagram.com/rinesh_kumar_30?igsh=bjJtcndxaHdvZnpy' },
      { id: 'soc-2', name: 'WhatsApp', icon: 'ph-whatsapp-logo', url: 'https://wa.me/919360237280' },
      { id: 'soc-3', name: 'LinkedIn', icon: 'ph-linkedin-logo', url: 'https://www.linkedin.com/in/rinesh-kumar-92606b303/' }
    ],
    contact: {
      email: 'rineshsoundscraft@gmail.com',
      phone: '+91 93602 37280',
      whatsapp: '919360237280',
      sectionTitle: 'Let’s create something meaningful'
    },
    footer: { copyrightName: 'Rinesh Kumar', copyrightYear: '2026', portfolioTitle: 'Rinesh Kumar Portfolio' },
    cv: { filePath: 'assets/Rinesh_CV.pdf', downloadName: 'Rinesh_Kumar_Resume.pdf' },
    security: { adminPasscode: 'admin123' }
  };
}

/* ─────────────────────────────────────
   DATA: SAVE TO API & LOCAL STORAGE
───────────────────────────────────── */
async function saveAllData(e, clickedBtn) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    e.stopPropagation();
  }

  collectFormData();

  // Keep a temporary copy in case server save fails
  try {
    localStorage.setItem('rk_portfolio_sync_trigger', String(Date.now()));
  } catch (_) {}

  const topBtn = document.getElementById('topbarSaveBtn');
  const targetBtn = clickedBtn || topBtn;
  const originalTargetContent = targetBtn ? targetBtn.innerHTML : '';
  const originalTopContent = topBtn ? topBtn.innerHTML : '';

  if (topBtn) {
    topBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:rgba(0,0,0,0.3);border-top-color:#000"></span> Saving...';
    topBtn.disabled = true;
  }
  if (targetBtn && targetBtn !== topBtn) {
    targetBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:rgba(0,0,0,0.3);border-top-color:#000"></span> Saving...';
    targetBtn.disabled = true;
  }

  let serverSaveSuccess = false;

  // 2. Try POSTing to backend server API (/api/save) with fallback candidates
  const saveTargets = [];
  try {
    const apiBase = await getApiBase();
    if (apiBase) saveTargets.push(`${apiBase}/api/save`);
  } catch (_) {}

  if (!saveTargets.includes('/api/save')) saveTargets.push('/api/save');
  if (!saveTargets.includes('http://localhost:5000/api/save')) saveTargets.push('http://localhost:5000/api/save');
  if (!saveTargets.includes('http://127.0.0.1:5000/api/save')) saveTargets.push('http://127.0.0.1:5000/api/save');

  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  for (const targetUrl of saveTargets) {
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(portfolioData)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' || json.status === 'partial' || json.success) {
          serverSaveSuccess = true;
          break;
        }
      }
    } catch (err) {
      console.warn(`⚠️ Save attempt failed for ${targetUrl}:`, err.message);
    }
  }

  // 3. Update UI Feedback Toast & Badges
  if (serverSaveSuccess) {
    // Server saved OK — clear all stale caches and broadcast live update
    localStorage.removeItem('rk_offline_pending');
    // Now broadcast to portfolio website tabs after confirmed server save
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('rinesh_portfolio_sync');
        bc.postMessage({ type: 'SYNC_DATA', data: portfolioData });
        setTimeout(() => bc.close(), 500);
      }
    } catch (_) {}
    const saveBadge = document.getElementById('api-save-badge');
    if (saveBadge) {
      saveBadge.textContent = 'saved (server)';
      saveBadge.className = 'api-badge ok';
    }
    updateDashboardCards();
    updateServerStatus(true, 'Express Server');
    showToast('⚡ Saved! Portfolio website updated instantly!', 'success');
  } else {
    // Server offline — save to localStorage as backup only
    try {
      localStorage.setItem('rk_offline_pending', JSON.stringify(portfolioData));
    } catch (_) {}
    updateServerStatus(false);
    showToast('⚠️ Server offline. Data saved locally — start the server and save again!', 'error');
    const saveBadge = document.getElementById('api-save-badge');
    if (saveBadge) {
      saveBadge.textContent = 'offline — save failed';
      saveBadge.className = 'api-badge warn';
    }
  }

  if (topBtn) {
    topBtn.style.background = '#22c55e';
    setTimeout(() => { topBtn.style.background = ''; }, 1200);
  }
  if (targetBtn && targetBtn !== topBtn) {
    targetBtn.style.background = '#22c55e';
    setTimeout(() => { targetBtn.style.background = ''; }, 1200);
  }

  setTimeout(() => {
    if (topBtn) {
      topBtn.innerHTML = originalTopContent;
      topBtn.disabled = false;
    }
    if (targetBtn && targetBtn !== topBtn) {
      targetBtn.innerHTML = originalTargetContent;
      targetBtn.disabled = false;
    }
  }, 1200);
}

/* ─────────────────────────────────────
   FORM BINDING: POPULATE UI FROM DATA
───────────────────────────────────── */
function bindAllForms() {
  const d = portfolioData;

  // Branding
  const b = d.branding || {};
  setVal('branding-panel-title', b.panelTitle || 'Control Panel');
  setVal('branding-site-title', b.siteTitle || 'Rinesh Portfolio');
  setVal('branding-logo-top', b.logoTop || 'RINESH');
  setVal('branding-logo-bottom', b.logoBottom || 'KUMAR');
  applyBrandingUI(b);

  // Hero
  setVal('hero-title', d.hero?.title);
  setVal('hero-subtitle', d.hero?.subtitle);
  setVal('hero-description', d.hero?.description);
  setVal('hero-video-path', d.hero?.videoPath || 'https://drive.google.com/file/d/1DrSEZ0NhLijo8nKydmF4wHoQM620O6tT/view?usp=sharing');
  updateHeroVideoPreview(d.hero?.videoPath || 'https://drive.google.com/file/d/1DrSEZ0NhLijo8nKydmF4wHoQM620O6tT/view?usp=sharing');
  setVal('hero-tagline', d.hero?.centerTagline);
  setVal('hero-cta-label', d.hero?.ctaLabel);
  setVal('hero-cta-link', d.hero?.ctaLink);
  setVal('hero-stat-satisfaction', d.hero?.stats?.clientSatisfaction);
  setVal('hero-stat-projects', d.hero?.stats?.projectsCompleted);
  setVal('hero-stat-clients', d.hero?.stats?.globalClients);
  renderSkillsList(d.hero?.skills || []);

  // About
  setVal('about-name', d.about?.name);
  setVal('about-role', d.about?.role);
  setVal('about-years', d.about?.yearsExperience);
  setVal('about-profile-image', d.about?.profileImage);
  updateAboutImgPreview(d.about?.profileImage);
  setVal('about-section-title', d.about?.sectionTitle);
  setVal('about-stat-satisfaction', d.about?.stats?.clientSatisfaction);
  setVal('about-stat-films', d.about?.stats?.filmsAlbumsScored);
  renderBioParagraphs(d.about?.bio || []);

  // Works
  renderWorksEditor(d.works || []);

  // Dynamic Social Links
  renderSocialLinksEditor(d.socialLinks || (d.social ? formatLegacySocials(d.social) : []));

  // Contact
  setVal('contact-section-title', d.contact?.sectionTitle);
  setVal('contact-email', d.contact?.email);
  setVal('contact-phone', d.contact?.phone);
  setVal('contact-whatsapp', d.contact?.whatsapp);
  setVal('footer-copyright-name', d.footer?.copyrightName);
  setVal('footer-copyright-year', d.footer?.copyrightYear);
  setVal('cv-filepath', d.cv?.filePath);
  setVal('cv-downloadname', d.cv?.downloadName);
}

function formatLegacySocials(s) {
  if (!s) return [];
  const list = [];
  if (s.instagram) list.push({ id: 'soc-1', name: 'Instagram', icon: 'ph-instagram-logo', url: s.instagram });
  if (s.whatsapp)  list.push({ id: 'soc-2', name: 'WhatsApp', icon: 'ph-whatsapp-logo', url: s.whatsapp });
  if (s.linkedin)  list.push({ id: 'soc-3', name: 'LinkedIn', icon: 'ph-linkedin-logo', url: s.linkedin });
  return list;
}

function applyBrandingUI(b) {
  if (!b) return;
  const pTitle = b.panelTitle || 'Control Panel';
  const topText = b.logoTop || 'RINESH';
  const botText = b.logoBottom || 'KUMAR';

  setElText('topbarPanelName', pTitle);
  setElText('authPanelTitle', pTitle);
  setElText('authLogoTop', topText);
  setElText('authLogoBot', botText);
  setElText('sbLogoTop', topText);
  setElText('sbLogoBot', botText);

  document.title = `${pTitle} — Rinesh Kumar Portfolio`;
}

function setElText(id, val) {
  const el = document.getElementById(id);
  if (el && val) el.textContent = val;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

/* ─────────────────────────────────────
   FORM COLLECT: READ UI BACK TO DATA
───────────────────────────────────── */
function collectFormData() {
  // Branding
  portfolioData.branding = {
    panelTitle: getVal('branding-panel-title'),
    siteTitle: getVal('branding-site-title'),
    logoTop: getVal('branding-logo-top'),
    logoBottom: getVal('branding-logo-bottom')
  };
  applyBrandingUI(portfolioData.branding);

  // Hero
  portfolioData.hero = portfolioData.hero || {};
  portfolioData.hero.title = getVal('hero-title');
  portfolioData.hero.subtitle = getVal('hero-subtitle');
  portfolioData.hero.description = getVal('hero-description');
  portfolioData.hero.videoPath = getVal('hero-video-path');
  portfolioData.hero.centerTagline = getVal('hero-tagline');
  portfolioData.hero.ctaLabel = getVal('hero-cta-label');
  portfolioData.hero.ctaLink = getVal('hero-cta-link');
  portfolioData.hero.stats = {
    clientSatisfaction: +getVal('hero-stat-satisfaction'),
    projectsCompleted:  +getVal('hero-stat-projects'),
    globalClients:      +getVal('hero-stat-clients')
  };
  portfolioData.hero.skills = collectSkills();

  // About
  portfolioData.about = portfolioData.about || {};
  portfolioData.about.name = getVal('about-name');
  portfolioData.about.role = getVal('about-role');
  portfolioData.about.yearsExperience = getVal('about-years');
  portfolioData.about.profileImage = getVal('about-profile-image');
  portfolioData.about.sectionTitle = getVal('about-section-title');
  portfolioData.about.stats = {
    clientSatisfaction: +getVal('about-stat-satisfaction'),
    filmsAlbumsScored:  +getVal('about-stat-films')
  };
  portfolioData.about.bio = collectBioParagraphs();

  // Works
  portfolioData.works = collectWorksData();

  // Dynamic Social Links
  portfolioData.socialLinks = collectSocialLinks();

  // Contact
  portfolioData.contact = portfolioData.contact || {};
  portfolioData.contact.sectionTitle = getVal('contact-section-title');
  portfolioData.contact.email = getVal('contact-email');
  portfolioData.contact.phone = getVal('contact-phone');
  portfolioData.contact.whatsapp = getVal('contact-whatsapp');

  // Footer
  portfolioData.footer = portfolioData.footer || {};
  portfolioData.footer.copyrightName = getVal('footer-copyright-name');
  portfolioData.footer.copyrightYear = getVal('footer-copyright-year');

  // CV
  portfolioData.cv = portfolioData.cv || {};
  portfolioData.cv.filePath = getVal('cv-filepath');
  portfolioData.cv.downloadName = getVal('cv-downloadname');

  portfolioData.meta = { lastUpdated: new Date().toISOString(), version: portfolioData.meta?.version || '1.2.0' };
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* ─────────────────────────────────────
   DYNAMIC SOCIAL MEDIA MANAGER WITH (+) BUTTON
───────────────────────────────────── */
let socialLinksData = [];

function renderSocialLinksEditor(links) {
  socialLinksData = [...links];
  const container = document.getElementById('social-links-list');
  if (!container) return;

  const iconOptions = [
    { value: 'ph-instagram-logo', label: 'Instagram' },
    { value: 'ph-whatsapp-logo', label: 'WhatsApp' },
    { value: 'ph-linkedin-logo', label: 'LinkedIn' },
    { value: 'ph-youtube-logo', label: 'YouTube' },
    { value: 'ph-spotify-logo', label: 'Spotify' },
    { value: 'ph-twitter-logo', label: 'Twitter / X' },
    { value: 'ph-facebook-logo', label: 'Facebook' },
    { value: 'ph-music-notes', label: 'Soundcloud / Music' },
    { value: 'ph-globe', label: 'Website / Other' }
  ];

  container.innerHTML = socialLinksData.map((item, idx) => `
    <div class="work-card-editor" data-social-idx="${idx}" style="padding:16px;">
      <div class="work-card-header" style="margin-bottom:12px;">
        <span class="work-card-number">Social Link #${idx + 1}</span>
        <button type="button" class="work-card-delete" onclick="deleteSocialLink(${idx}, event)">
          <i class="ph ph-trash"></i> Remove
        </button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Platform Name</label>
          <input type="text" class="social-field-name" value="${escapeHtml(item.name || '')}" placeholder="e.g. Instagram, Spotify..." />
        </div>
        <div class="form-group">
          <label>Platform Icon</label>
          <select class="social-field-icon">
            ${iconOptions.map(opt => `<option value="${opt.value}" ${item.icon === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Profile URL / Link</label>
          <input type="url" class="social-field-url" value="${escapeHtml(item.url || '')}" placeholder="https://..." />
        </div>
      </div>
    </div>
  `).join('');

  const countEl = document.getElementById('dc-total-socials');
  if (countEl) countEl.textContent = socialLinksData.length;
}

function addNewSocialLink(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  socialLinksData.push({
    id: `soc-${Date.now()}`,
    name: 'New Platform',
    icon: 'ph-globe',
    url: 'https://'
  });
  renderSocialLinksEditor(socialLinksData);
  showToast('➕ Added new Social Media link field', 'info');
}

function deleteSocialLink(idx, e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  socialLinksData.splice(idx, 1);
  renderSocialLinksEditor(socialLinksData);
  showToast('🗑️ Social media link removed', 'info');
}

function collectSocialLinks() {
  const cards = document.querySelectorAll('[data-social-idx]');
  return Array.from(cards).map((card, idx) => ({
    id: socialLinksData[idx]?.id || `soc-${idx + 1}`,
    name: card.querySelector('.social-field-name')?.value.trim() || 'Social',
    icon: card.querySelector('.social-field-icon')?.value || 'ph-globe',
    url: card.querySelector('.social-field-url')?.value.trim() || ''
  }));
}

/* ─────────────────────────────────────
   WORKS / PROJECTS MANAGER
───────────────────────────────────── */
let worksData = [];

function renderWorksEditor(works) {
  worksData = [...works];
  const container = document.getElementById('works-list');
  if (!container) return;

  container.innerHTML = worksData.map((item, idx) => {
    const imgSrc = (item.image && item.image.trim())
      ? (item.image.startsWith('data:') || item.image.startsWith('http') ? item.image : (item.image.startsWith('/') ? '..' + item.image : '../' + item.image))
      : '../works/manga.webp';

    return `
    <div class="work-card-editor" data-work-idx="${idx}">
      <div class="work-card-header">
        <span class="work-card-number">Project #${idx + 1}</span>
        <button type="button" class="work-card-delete" onclick="deleteWorkItem(${idx}, event)">
          <i class="ph ph-trash"></i> Delete
        </button>
      </div>
      <div class="work-card-body">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="work-field-title" value="${escapeHtml(item.title || '')}" placeholder="e.g. MANGA" />
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Filter Category</label>
            <select class="work-field-category">
              <option value="short-film" ${item.category === 'short-film' ? 'selected' : ''}>Short Film</option>
              <option value="web-series" ${item.category === 'web-series' ? 'selected' : ''}>Web Series</option>
              <option value="youtube-release" ${item.category === 'youtube-release' ? 'selected' : ''}>YouTube Release</option>
            </select>
          </div>
          <div class="form-group">
            <label>Badge Label</label>
            <input type="text" class="work-field-badge" value="${escapeHtml(item.categoryBadge || 'Short Film')}" placeholder="e.g. Short Film" />
          </div>
        </div>
        <div class="form-group">
          <label>Thumbnail Poster Image (Drag & Drop Auto-Optimized)</label>
          <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
            <img class="work-card-thumb-preview" src="${escapeHtml(imgSrc)}" alt="Project thumbnail" style="width:70px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border); background:#000;" onerror="this.src='../works/manga.webp'" />
            <div class="drop-target-box mini-drop" id="workImgDrop_${idx}" style="flex:1; margin:0; padding:12px;">
              <p class="drop-text" style="font-size:12px;">Drag & Drop <strong>Image</strong> or <span class="browse-link">click</span></p>
              <input type="file" id="workImgFile_${idx}" accept="image/*" style="display:none;" />
            </div>
          </div>
          <input type="text" class="work-field-image" id="workImgPath_${idx}" value="${escapeHtml(item.image || '')}" placeholder="e.g. works/manga.webp or data:image/..." oninput="const p=this.closest('.work-card-editor').querySelector('.work-card-thumb-preview'); if(p) p.src=(this.value.startsWith('data:')||this.value.startsWith('http'))?this.value:'../'+this.value.replace(/^\\//,'');" />
        </div>
        <div class="form-group">
          <label>Popup Video URL (YouTube, Vimeo, or Video Link)</label>
          <input type="text" class="work-field-video" value="${escapeHtml(item.videoUrl || '')}" placeholder="e.g. https://www.youtube.com/watch?v=... (optional)" />
        </div>
        <div class="form-group">
          <label>Project Description</label>
          <textarea class="work-field-desc" rows="2" placeholder="Brief project description...">${escapeHtml(item.description || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  }).join('');

  worksData.forEach((_, idx) => {
    bindDropZone(`workImgDrop_${idx}`, `workImgFile_${idx}`, `workImgPath_${idx}`);
  });

  const totalEl = document.getElementById('dc-total-works');
  if (totalEl) totalEl.textContent = worksData.length;
}

function addNewWorkItem(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  worksData.unshift({
    id: `work-${Date.now()}`,
    title: 'New Project',
    category: 'short-film',
    categoryBadge: 'Short Film',
    image: '',
    description: ''
  });
  renderWorksEditor(worksData);
  showToast('✨ Added new project item card', 'info');
}

function deleteWorkItem(idx, e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  worksData.splice(idx, 1);
  renderWorksEditor(worksData);
  showToast('🗑️ Project item removed', 'info');
}

function collectWorksData() {
  const cards = document.querySelectorAll('.work-card-editor[data-work-idx]');
  return Array.from(cards).map((card, idx) => ({
    id: worksData[idx]?.id || `work-${idx + 1}`,
    title: card.querySelector('.work-field-title')?.value.trim() || '',
    category: card.querySelector('.work-field-category')?.value || 'short-film',
    categoryBadge: card.querySelector('.work-field-badge')?.value.trim() || 'Short Film',
    image: card.querySelector('.work-field-image')?.value.trim() || '',
    videoUrl: card.querySelector('.work-field-video')?.value.trim() || worksData[idx]?.videoUrl || '',
    description: card.querySelector('.work-field-desc')?.value.trim() || ''
  }));
}

/* ─────────────────────────────────────
   CLIENT-SIDE IMAGE COMPRESSION & BASE64
───────────────────────────────────── */
function compressAndConvertImage(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to parse image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────
   UNIVERSAL DRAG AND DROP SETUP
───────────────────────────────────── */
function setupDragAndDropZones() {
  bindDropZone('aboutImgDropZone', 'aboutImgFileInput', 'about-profile-image');
  bindDropZone('cvDropZone', 'cvFileInput', 'cv-filepath');
}

function bindDropZone(zoneId, fileInputId, targetInputId) {
  const zone = document.getElementById(zoneId);
  const fileInput = document.getElementById(fileInputId);
  const targetInput = document.getElementById(targetInputId);
  if (!zone || !fileInput) return;

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadSingleFile(files[0], targetInput, zone);
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    if (files.length) uploadSingleFile(files[0], targetInput, zone);
    fileInput.value = '';
  });
}

async function uploadSingleFile(file, targetInput, zone) {
  if (!file) return;

  // 1. IMAGE FILES: Convert to compressed Base64 Data URL (100% works on Vercel/Netlify without server disk!)
  if (file.type.startsWith('image/')) {
    showToast(`⏳ Optimizing image: ${file.name}...`, 'info');
    try {
      const dataUrl = await compressAndConvertImage(file, 1200, 0.85);
      if (targetInput) {
        targetInput.value = dataUrl;
        if (targetInput.id === 'about-profile-image') {
          updateAboutImgPreview(dataUrl);
          if (portfolioData.about) portfolioData.about.profileImage = dataUrl;
        } else if (targetInput.classList.contains('work-field-image')) {
          const card = targetInput.closest('.work-card-editor');
          if (card) {
            const preview = card.querySelector('.work-card-thumb-preview');
            if (preview) preview.src = dataUrl;
          }
        }
      }
      if (zone) {
        zone.style.borderColor = '#22c55e';
        setTimeout(() => { zone.style.borderColor = ''; }, 1500);
      }
      showToast(`✅ Image optimized & ready! Click "Save Changes" to publish.`, 'success');

      // Attempt background server upload if server is online
      if (isServerOnline) {
        try {
          const apiBase = await getApiBase();
          const formData = new FormData();
          formData.append('file', file);
          fetch(`${apiBase}/api/upload`, { method: 'POST', body: formData })
            .then(r => r.json())
            .then(j => {
              if (j.status === 'success') {
                console.log('📁 Server backup file created:', j.filePath);
              }
            }).catch(() => {});
        } catch (_) {}
      }
      return;
    } catch (err) {
      console.warn('Fallback to direct file read:', err);
    }
  }

  // 2. PDF FILES (CV):
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    showToast(`⏳ Attaching PDF: ${file.name}...`, 'info');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (targetInput) targetInput.value = dataUrl;
      const dlNameInput = document.getElementById('cv-downloadname');
      if (dlNameInput && !dlNameInput.value) dlNameInput.value = file.name;
      if (zone) {
        zone.style.borderColor = '#22c55e';
        setTimeout(() => { zone.style.borderColor = ''; }, 1500);
      }
      showToast(`✅ PDF attached successfully! Click "Save Changes" to publish.`, 'success');
      return;
    } catch (_) {}
  }

  // 3. VIDEO FILES (Accept any size, instant live preview, seamless save)
  if (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov') || file.name.endsWith('.webm')) {
    const videoName = file.name;
    const targetPath = (videoName.startsWith('assets/') || videoName.startsWith('/')) ? videoName : `assets/${videoName}`;

    // Create instant local blob URL for immediate live preview
    try {
      const blobUrl = URL.createObjectURL(file);
      updateHeroVideoPreview(blobUrl);
    } catch (_) {}

    if (targetInput) {
      targetInput.value = targetPath;
    }
    if (portfolioData.hero) {
      portfolioData.hero.videoPath = targetPath;
    }
    if (zone) {
      zone.style.borderColor = '#22c55e';
      setTimeout(() => { zone.style.borderColor = ''; }, 1500);
    }
    showToast(`🎬 Video added: ${videoName}! Click "Save Changes" to publish.`, 'success');

    // If local server is running, upload file in background without blocking
    if (isServerOnline) {
      try {
        const apiBase = await getApiBase();
        const formData = new FormData();
        formData.append('file', file);
        fetch(`${apiBase}/api/upload`, { method: 'POST', body: formData })
          .then(r => r.json())
          .then(json => {
            if (json.status === 'success' && targetInput) {
              targetInput.value = json.filePath;
              if (portfolioData.hero) portfolioData.hero.videoPath = json.filePath;
              console.log('✅ Server video saved:', json.filePath);
            }
          }).catch(() => {});
      } catch (_) {}
    }
    return;
  }
}

function updateAboutImgPreview(path) {
  const img = document.getElementById('aboutImgPreviewSrc');
  if (!img) return;
  if (!path || !path.trim()) {
    img.src = '../assets/images/thumbs/rinesh_guitar.jpg';
    return;
  }
  const clean = path.trim();
  if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://')) {
    img.src = clean;
  } else {
    const rel = clean.startsWith('/') ? clean.slice(1) : clean;
    img.src = '../' + rel;
  }
}

function resolveVideoUrlAdmin(url) {
  if (!url || typeof url !== 'string') return url;
  const clean = url.trim();
  if (/^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/blob\//i.test(clean)) {
    return clean.replace(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/(.+)$/i, 'https://raw.githubusercontent.com/$1/$2/$3');
  }
  if (/^https?:\/\/github\.com\/[^\/]+\/[^\/]+\/raw\//i.test(clean)) {
    return clean.replace(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/raw\/(.+)$/i, 'https://raw.githubusercontent.com/$1/$2/$3');
  }
  return clean;
}

function updateHeroVideoPreview(url) {
  const inner = document.getElementById('heroVideoPreviewInner');
  if (!inner) return;
  if (!url || !url.trim()) {
    inner.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:40px;">No video URL set. Paste a YouTube link, GitHub video link, or video path above.</div>';
    return;
  }

  const clean = resolveVideoUrlAdmin(url.trim());

  // 1. Google Drive Video Link Parser (e.g. https://drive.google.com/file/d/1DrSEZ0NhLijo8nKydmF4wHoQM620O6tT/view?usp=sharing)
  if (/drive\.google\.com/i.test(clean)) {
    const match = clean.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
    const id = match ? match[1] : '';
    const embedUrl = id ? `https://drive.google.com/file/d/${id}/preview` : clean;
    inner.innerHTML = `<iframe src="${embedUrl}" title="Google Drive Video Player" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;display:block;"></iframe>`;
    return;
  }

  // 2. Kapwing Video Link Parser (e.g. https://www.kapwing.com/w/UzUvelKcen or /e/UzUvelKcen)
  if (/kapwing\.com/i.test(clean)) {
    const match = clean.match(/kapwing\.com\/(?:w|e|videos)\/([a-zA-Z0-9_-]+)/i);
    const id = match ? match[1] : '';
    const embedUrl = id ? `https://www.kapwing.com/e/${id}` : clean;
    inner.innerHTML = `<iframe src="${embedUrl}" title="Kapwing Video Player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;display:block;"></iframe>`;
    return;
  }

  // 2. YouTube
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(clean)) {
    const match = clean.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    if (match && match[2].length === 11) {
      const id = match[2];
      inner.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
      return;
    }
  }

  // 3. Vimeo
  if (/^(https?:\/\/)?(www\.)?vimeo\.com\//i.test(clean)) {
    const match = clean.match(/vimeo\.com\/(\d+)/);
    if (match && match[1]) {
      inner.innerHTML = `<iframe src="https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1&loop=1" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;border-radius:12px;"></iframe>`;
      return;
    }
  }

  // 3. HTML5 Video / Local Blob URL / Direct URL / GitHub Raw URL
  const src = (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:') || clean.startsWith('blob:'))
    ? clean
    : '../' + (clean.startsWith('/') ? clean.slice(1) : clean);

  const isMov = clean.toLowerCase().endsWith('.mov');
  const mimeType = isMov ? 'video/quicktime' : 'video/mp4';

  inner.innerHTML = `<video autoplay muted loop playsinline controls preload="auto" poster="../assets/images/shapes/rinesh_hero.png" src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` +
    `<source src="${escapeHtml(src)}" type="${mimeType}">` +
    `<source src="${escapeHtml(src)}" type="video/mp4">` +
    `Your browser does not support HTML5 video.` +
    `</video>`;
}

function setVideoPreset(url) {
  const input = document.getElementById('hero-video-path');
  if (input) input.value = url;
  updateHeroVideoPreview(url);
  if (portfolioData.hero) portfolioData.hero.videoPath = url;
  showToast(`🎬 Video preset applied! Click "Save Changes" to publish.`, 'info');
}

function setImagePreset(url) {
  const input = document.getElementById('about-profile-image');
  if (input) input.value = url;
  updateAboutImgPreview(url);
  if (portfolioData.about) portfolioData.about.profileImage = url;
  showToast(`📸 Photo preset applied! Click "Save Changes" to publish.`, 'info');
}

/* ─────────────────────────────────────
   SKILLS TAG LIST
───────────────────────────────────── */
let skillsList = [];

function renderSkillsList(skills) {
  skillsList = [...skills];
  const container = document.getElementById('hero-skills-list');
  if (!container) return;
  container.innerHTML = skillsList.map((skill, i) => `
    <div class="tag-item">
      <span>${escapeHtml(skill)}</span>
      <button type="button" onclick="removeSkill(${i}, event)" title="Remove">×</button>
    </div>
  `).join('');
}

function addSkill(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const input = document.getElementById('hero-skill-input');
  const val = input.value.trim();
  if (!val) return;
  skillsList.push(val);
  renderSkillsList(skillsList);
  input.value = '';
  input.focus();
}

function removeSkill(i, e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  skillsList.splice(i, 1);
  renderSkillsList(skillsList);
}

function collectSkills() { return [...skillsList]; }

document.addEventListener('DOMContentLoaded', () => {
  const si = document.getElementById('hero-skill-input');
  if (si) si.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(e); } });
});

/* ─────────────────────────────────────
   BIO PARAGRAPHS
───────────────────────────────────── */
function renderBioParagraphs(paras) {
  const container = document.getElementById('bio-paragraphs-list');
  if (!container) return;
  container.innerHTML = '';
  paras.forEach((para, i) => {
    const div = document.createElement('div');
    div.className = 'bio-para-item';
    div.innerHTML = `
      <textarea data-bio-index="${i}" rows="3" placeholder="Paragraph ${i + 1}...">${escapeHtml(para)}</textarea>
      <button type="button" class="bio-para-remove" onclick="removeBioParagraph(${i}, event)" title="Remove paragraph">
        <i class="ph ph-trash"></i>
      </button>
    `;
    container.appendChild(div);
  });
}

function addBioParagraph(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const paras = collectBioParagraphs();
  paras.push('');
  portfolioData.about = portfolioData.about || {};
  portfolioData.about.bio = paras;
  renderBioParagraphs(paras);
  const textareas = document.querySelectorAll('[data-bio-index]');
  if (textareas.length) textareas[textareas.length - 1].focus();
}

function removeBioParagraph(index, e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const paras = collectBioParagraphs();
  paras.splice(index, 1);
  portfolioData.about = portfolioData.about || {};
  portfolioData.about.bio = paras;
  renderBioParagraphs(paras);
}

function collectBioParagraphs() {
  return Array.from(document.querySelectorAll('[data-bio-index]'))
    .map(el => el.value.trim())
    .filter(v => v.length > 0);
}

/* ─────────────────────────────────────
   DASHBOARD CARDS
───────────────────────────────────── */
function updateDashboardCards() {
  const d = portfolioData;
  setDashCard('dc-total-works', (d.works?.length || 0));
  setDashCard('dc-total-socials', (d.socialLinks?.length || 0));
  setDashCard('dc-satisfaction', (d.about?.stats?.clientSatisfaction || d.hero?.stats?.clientSatisfaction || '–') + '%');
  setDashCard('dc-projects', (d.hero?.stats?.projectsCompleted || '–') + '+');
}

function setDashCard(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─────────────────────────────────────
   NAVIGATION
───────────────────────────────────── */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.getAttribute('data-section');
      switchSection(section);
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && document.getElementById(`sec-${hash}`) && hash !== currentSection) {
      switchSection(hash);
    }
  });
}

function switchSection(name) {
  if (!name) name = 'dashboard';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.panel-section').forEach(el => el.classList.remove('active'));

  const navEl = document.querySelector(`.nav-item[data-section="${name}"]`);
  const secEl = document.getElementById(`sec-${name}`);
  if (navEl) navEl.classList.add('active');
  if (secEl) secEl.classList.add('active');

  currentSection = name;
  try {
    sessionStorage.setItem('rk_active_section', name);
    if (window.location.hash !== '#' + name) {
      history.replaceState(null, '', '#' + name);
    }
  } catch (_) {}

  const labels = {
    dashboard: 'Dashboard',
    branding: 'Branding & Titles',
    works: 'Works & Projects',
    hero: 'Hero & Video',
    about: 'About & Image',
    cv: 'CV / Resume',
    contact: 'Contact & Socials',
    security: 'Security'
  };
  const bc = document.getElementById('breadcrumbSection');
  if (bc) bc.textContent = labels[name] || name;
}

function restoreActiveSection() {
  const hash = window.location.hash.replace(/^#/, '');
  const savedSection = hash || sessionStorage.getItem('rk_active_section') || 'dashboard';
  if (savedSection && document.getElementById(`sec-${savedSection}`)) {
    switchSection(savedSection);
  } else {
    switchSection('dashboard');
  }
}

/* ─────────────────────────────────────
   SIDEBAR TOGGLE (MOBILE)
───────────────────────────────────── */
function setupSidebar() {
  const toggleBtn = document.getElementById('sidebarToggle');
  const closeBtn = document.getElementById('sidebarClose');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
}

/* ─────────────────────────────────────
   GENERAL MEDIA UPLOAD
───────────────────────────────────── */
function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('mediaFileInput');
  if (!zone || !fileInput) return;

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) uploadFiles(files);
  });

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    if (files.length) uploadFiles(files);
    fileInput.value = '';
  });
}

async function uploadFiles(files) {
  const progressEl = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  progressEl.style.display = 'block';
  progressFill.style.width = '0%';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(((i) / files.length) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `Processing ${file.name} (${i + 1}/${files.length})...`;

    // If image, create compressed Data URL
    if (file.type.startsWith('image/')) {
      try {
        const dataUrl = await compressAndConvertImage(file, 1200, 0.85);
        addUploadedFileItem(file.name, dataUrl);
        showToast(`📎 Image ready: ${file.name}`, 'success');
      } catch (_) {}
    }

    // Also attempt server upload if online
    if (isServerOnline) {
      try {
        const apiBase = await getApiBase();
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', body: formData });
        const json = await res.json();
        if (json.status === 'success' && !file.type.startsWith('image/')) {
          addUploadedFileItem(file.name, json.filePath);
          showToast(`📎 Uploaded: ${file.name}`, 'success');
        }
      } catch (_) {}
    } else if (!file.type.startsWith('image/')) {
      addUploadedFileItem(file.name, `assets/${file.name}`);
      showToast(`📁 File queued: assets/${file.name}`, 'info');
    }
  }

  progressFill.style.width = '100%';
  progressText.textContent = 'Upload complete!';
  setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
}

function addUploadedFileItem(name, path) {
  const container = document.getElementById('uploadedFiles');
  if (!container) return;
  const iconMap = {
    jpg: 'ph-image', jpeg: 'ph-image', png: 'ph-image', gif: 'ph-image',
    webp: 'ph-image', svg: 'ph-image-square',
    mp4: 'ph-video', mov: 'ph-video',
    mp3: 'ph-music-note', wav: 'ph-music-note',
    pdf: 'ph-file-pdf'
  };
  const ext = name.split('.').pop().toLowerCase();
  const iconClass = iconMap[ext] || 'ph-file';

  const div = document.createElement('div');
  div.className = 'uploaded-file-item';
  div.innerHTML = `
    <i class="ph ${iconClass} uploaded-file-icon"></i>
    <div class="uploaded-file-info">
      <div class="uploaded-file-name">${escapeHtml(name)}</div>
      <div class="uploaded-file-path" title="Click to copy path" onclick="copyPath('${path}')">${path}</div>
    </div>
    <button class="copy-btn" onclick="copyPath('${path}')">
      <i class="ph ph-copy"></i> Copy Path
    </button>
  `;
  container.prepend(div);
}

function copyPath(path) {
  navigator.clipboard.writeText(path).then(() => {
    showToast('📋 Path copied: ' + path, 'info');
  }).catch(() => {
    showToast('Could not copy to clipboard.', 'error');
  });
}

/* ─────────────────────────────────────
   SECURITY: CHANGE PASSCODE
───────────────────────────────────── */
async function changePasscode(e, btn) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
    e.stopPropagation();
  }
  const current = document.getElementById('current-pass').value.trim();
  const newPass  = document.getElementById('new-pass').value.trim();
  const confirm  = document.getElementById('confirm-pass').value.trim();
  const msgEl    = document.getElementById('security-msg');

  msgEl.style.display = 'none';
  msgEl.className = 'security-msg';

  if (!current || !newPass || !confirm) {
    showSecurityMsg('Please fill in all fields.', 'error');
    return;
  }
  if (newPass.length < 4) {
    showSecurityMsg('New passcode must be at least 4 characters.', 'error');
    return;
  }
  if (newPass !== confirm) {
    showSecurityMsg('New passcodes do not match.', 'error');
    return;
  }

  let verified = false;
  let isOffline = false;

  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/verify-passcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: current })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' || json.success) {
        verified = true;
      }
    } else if (res.status === 401) {
      showSecurityMsg('❌ Current passcode is incorrect.', 'error');
      return;
    } else {
      isOffline = true;
    }
  } catch (err) {
    isOffline = true;
  }

  if (isOffline && !verified) {
    let storedPass = portfolioData.security?.adminPasscode;
    if (!storedPass) {
      const offlinePending = localStorage.getItem('rk_offline_pending');
      if (offlinePending) {
        try {
          const parsed = JSON.parse(offlinePending);
          if (parsed?.security?.adminPasscode) storedPass = parsed.security.adminPasscode;
        } catch (_) {}
      }
    }
    if (!storedPass) storedPass = 'admin123';

    if (current === storedPass) {
      verified = true;
    } else {
      showSecurityMsg('❌ Current passcode is incorrect.', 'error');
      return;
    }
  }

  if (verified) {
    portfolioData.security = portfolioData.security || {};
    portfolioData.security.adminPasscode = newPass;

    const saved = await trySave();
    if (saved) {
      showSecurityMsg('✅ Passcode updated successfully on server! Logging out...', 'success');
    } else {
      localStorage.setItem('rk_offline_pending', JSON.stringify(portfolioData));
      showSecurityMsg('✅ Passcode updated in local cache! Logging out...', 'success');
    }

    document.getElementById('current-pass').value = '';
    document.getElementById('new-pass').value = '';
    document.getElementById('confirm-pass').value = '';
    setTimeout(logout, 2200);
  }
}

async function trySave() {
  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(portfolioData)
    });
    const json = await res.json();
    return json.status === 'success';
  } catch {
    try {
      localStorage.setItem('rk_offline_pending', JSON.stringify(portfolioData));
    } catch (_) {}
    return false;
  }
}

function showSecurityMsg(msg, type) {
  const el = document.getElementById('security-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'security-msg ' + type;
  el.style.display = 'block';
}

function togglePassField(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ─────────────────────────────────────
   SERVER STATUS & TOAST
───────────────────────────────────── */
function updateServerStatus(online, origin = null) {
  isServerOnline = online;
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.topbar-status span:last-child');
  const authDot = document.querySelector('#authServerStatus .status-dot');
  const authText = document.getElementById('authServerStatusText');

  if (dot && text) {
    if (online) {
      dot.classList.add('online');
      const port = origin ? (origin.split(':').pop() || '5500') : '5500';
      text.textContent = `Server Online (:${port})`;
      text.title = `Connected to ${origin || 'http://localhost:5500'}. Click to test connection.`;
    } else {
      dot.classList.remove('online');
      text.textContent = 'Server Offline (Click to retry)';
      text.title = 'Server is offline. Click to test connection or run "node server.js".';
    }
  }

  if (authDot && authText) {
    if (online) {
      authDot.classList.add('online');
      authText.textContent = '🟢 Server Online';
      authText.style.color = '#22c55e';
    } else {
      authDot.classList.remove('online');
      authText.textContent = '⚠️ Server Offline — run: node server.js';
      authText.style.color = '#f59e0b';
    }
  }

  updateDeviceHub(latestServerInfo, origin);
}

function updateDeviceHub(serverInfo, origin = null) {
  if (serverInfo) latestServerInfo = serverInfo;
  const localSpan = document.getElementById('hub-local-url');
  const mobileSpan = document.getElementById('hub-mobile-url');
  const mobileSiteSpan = document.getElementById('hub-mobile-site-url');
  const cloudSpan = document.getElementById('hub-cloud-url');
  const cloudStatus = document.getElementById('hub-cloud-status');
  const liveBadge = document.getElementById('hub-live-badge');

  const currOrigin = origin || window.location.origin;
  const isHttps = window.location.protocol === 'https:';

  if (localSpan) {
    if (serverInfo && serverInfo.localUrls && serverInfo.localUrls.portfolio) {
      localSpan.textContent = serverInfo.localUrls.portfolio;
    } else {
      localSpan.textContent = (currOrigin && currOrigin !== 'null') ? currOrigin : 'http://localhost:5500';
    }
  }

  if (mobileSpan) {
    if (serverInfo && serverInfo.networkUrls && serverInfo.networkUrls.admin) {
      mobileSpan.textContent = serverInfo.networkUrls.admin;
      if (mobileSiteSpan) mobileSiteSpan.textContent = serverInfo.networkUrls.portfolio;
    } else if (serverInfo && serverInfo.localIp) {
      const port = serverInfo.port || 5500;
      mobileSpan.textContent = `http://${serverInfo.localIp}:${port}/admin`;
      if (mobileSiteSpan) mobileSiteSpan.textContent = `http://${serverInfo.localIp}:${port}`;
    } else if (!isHttps && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      mobileSpan.textContent = `${window.location.origin}/admin`;
      if (mobileSiteSpan) mobileSiteSpan.textContent = window.location.origin;
    } else {
      mobileSpan.textContent = 'http://192.168.x.x:5500/admin';
      if (mobileSiteSpan) mobileSiteSpan.textContent = 'http://192.168.x.x:5500';
    }
  }

  if (cloudSpan) {
    const customApi = localStorage.getItem('rk_custom_api');
    if (customApi) {
      cloudSpan.textContent = customApi;
      if (cloudStatus) cloudStatus.textContent = 'Custom API Connected';
    } else if (isHttps) {
      cloudSpan.textContent = window.location.origin;
      if (cloudStatus) cloudStatus.textContent = 'Cloud Deployed (Netlify Cloud)';
    } else {
      cloudSpan.textContent = 'Ready for Netlify Cloud';
      if (cloudStatus) cloudStatus.textContent = 'Netlify Cloud Ready';
    }
  }

  if (liveBadge) {
    liveBadge.innerHTML = isServerOnline
      ? '<i class="ph ph-broadcast"></i> Live Server Sync Active'
      : '<i class="ph ph-check-circle"></i> Local Cache Active';
    liveBadge.className = isServerOnline ? 'device-hub-badge live' : 'device-hub-badge';
  }
}

function copyHubUrl(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent.trim();
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`📋 Copied to clipboard: ${text}`, 'success');
    }).catch(() => {
      window.prompt('Copy URL:', text);
    });
  } else {
    window.prompt('Copy URL:', text);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="ph ${icons[type] || 'ph-info'}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 4500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

/* ─────────────────────────────────────
   CONNECTION MODAL & DATA BACKUP / SYNC
───────────────────────────────────── */
function openConnModal() {
  const modal = document.getElementById('connectionModal');
  if (!modal) return;
  modal.classList.add('open');

  const banner = document.getElementById('modalConnBanner');
  const bannerText = document.getElementById('modalConnStatusText');
  const urlInput = document.getElementById('customApiUrlInput');

  if (urlInput) {
    urlInput.value = localStorage.getItem('rk_custom_api') || cachedApiBase || '';
  }

  if (banner && bannerText) {
    if (isServerOnline) {
      banner.className = 'conn-status-banner online';
      bannerText.textContent = `🟢 Server Online — Connected to ${cachedApiBase || window.location.origin}`;
    } else {
      banner.className = 'conn-status-banner offline';
      bannerText.textContent = '🟡 Static / Offline Mode — Edits saved to browser cache';
    }
  }
}

function closeConnModal() {
  const modal = document.getElementById('connectionModal');
  if (modal) modal.classList.remove('open');
}

async function saveCustomApi() {
  const urlInput = document.getElementById('customApiUrlInput');
  const val = (urlInput ? urlInput.value.trim() : '').replace(/\/+$/, '');
  if (!val) {
    localStorage.removeItem('rk_custom_api');
    cachedApiBase = null;
    sessionStorage.removeItem('rk_active_api');
    showToast('Reset to auto-detecting backend URL.', 'info');
    await getApiBase(true);
    closeConnModal();
    return;
  }

  showToast('🔍 Testing custom API connection...', 'info');
  const check = await pingCandidate(val, 2500);
  if (check.ok) {
    localStorage.setItem('rk_custom_api', val);
    cachedApiBase = val;
    sessionStorage.setItem('rk_active_api', val);
    updateServerStatus(true, val);
    showToast(`🟢 Successfully connected to: ${val}`, 'success');
    closeConnModal();
    loadData();
  } else {
    showToast(`⚠️ Could not reach ${val}. If using a local backend, ensure your server is running.`, 'error');
  }
}

async function resetApiAutoDetect() {
  localStorage.removeItem('rk_custom_api');
  cachedApiBase = null;
  sessionStorage.removeItem('rk_active_api');
  showToast('Reset to auto-detect. Probing...', 'info');
  await getApiBase(true);
  openConnModal();
}

function exportDataJson() {
  try {
    collectFormData();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(portfolioData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'data.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('📥 data.json exported successfully!', 'success');
  } catch (err) {
    showToast('❌ Export failed: ' + err.message, 'error');
  }
}

function importDataJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
      portfolioData = Object.assign({}, getDefaultData(), parsed);
      bindAllForms();
      updateDashboardCards();
      localStorage.setItem('rk_offline_pending', JSON.stringify(portfolioData));
      showToast('📤 data.json imported successfully! Click "Save Changes" to sync.', 'success');
    } catch (err) {
      showToast('❌ Failed to parse data.json file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}
