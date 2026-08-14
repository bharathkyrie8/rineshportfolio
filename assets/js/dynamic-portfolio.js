/**
 * Dynamic Portfolio Synchronizer
 * Connects the public portfolio (index.html & works.html) to the live Supabase / Backend API (/api/data)
 * Updates all sections in real-time: Branding, Hero, About, Works Grid, Skills, Experience, Contact & Socials.
 */

(function () {
  'use strict';

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDynamicPortfolio);
  } else {
    initDynamicPortfolio();
  }

  function initDynamicPortfolio() {
    loadPortfolioData();

    // 1. Listen for cross-tab BroadcastChannel sync from Admin Panel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const syncChannel = new BroadcastChannel('rinesh_portfolio_sync');
        syncChannel.onmessage = function (event) {
          if (event.data && event.data.data) {
            console.log('⚡ [SYNC] Live data update received from Admin Panel.');
            applyAllData(event.data.data);
          }
        };
      } catch (_) {}
    }

    // 2. Listen for localStorage changes
    window.addEventListener('storage', function (e) {
      if (e.key === 'rk_portfolio_sync_trigger' || e.key === 'rk_offline_pending') {
        const cached = localStorage.getItem('rk_offline_pending');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            applyAllData(parsed);
          } catch (_) {}
        } else {
          loadPortfolioData();
        }
      }
    });
  }

  const SUPABASE_CLOUD_URL = 'https://yiqdieaknynuhncycgid.supabase.co';
  const SUPABASE_CLOUD_KEY = 'sb_publishable_IzCiPG3dn4nhA3v0qrxUiA_N9sx7LQ2';

  let directSupabase = null;
  function getDirectSupabase() {
    if (!directSupabase && typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      try {
        directSupabase = window.supabase.createClient(SUPABASE_CLOUD_URL, SUPABASE_CLOUD_KEY, {
          auth: { persistSession: false }
        });
      } catch (_) {}
    }
    return directSupabase;
  }

  async function loadPortfolioData() {
    // 1. Check cached offline data first for instant render
    try {
      const cached = localStorage.getItem('rk_offline_pending');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          applyAllData(parsed);
        }
      }
    } catch (_) {}

    // 2. Fetch live data from backend server / Supabase API
    let loadedFromApi = false;
    try {
      const res = await fetch('/api/data?_t=' + Date.now());
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          applyAllData(result.data);
          loadedFromApi = true;
        }
      }
    } catch (err) {
      console.log('ℹ️ [PORTFOLIO] Backend Express API not reachable, attempting direct Supabase connection...');
    }

    // 2.5 Try Direct Supabase Cloud connection if Express API is not running
    if (!loadedFromApi) {
      const sb = getDirectSupabase();
      if (sb) {
        try {
          const { data, error } = await sb
            .from('portfolio_data')
            .select('content')
            .eq('id', 'master')
            .single();

          if (!error && data && data.content) {
            applyAllData(data.content);
            loadedFromApi = true;
            console.log('⚡ [PORTFOLIO] Loaded live portfolio data directly from Supabase Cloud Database!');
          }
        } catch (_) {}
      }
    }

    // 3. Fallback: Fetch static data.json file if API server & Supabase are unreachable
    if (!loadedFromApi) {
      const paths = ['data.json', '../data.json', './data.json', '/data.json'];
      for (const p of paths) {
        try {
          const staticRes = await fetch(p + '?_t=' + Date.now());
          if (staticRes.ok) {
            const staticData = await staticRes.json();
            if (staticData && typeof staticData === 'object') {
              applyAllData(staticData);
              console.log('✅ [PORTFOLIO] Successfully loaded portfolio from static data.json');
              break;
            }
          }
        } catch (_) {}
      }
    }
  }

  function applyAllData(data) {
    if (!data || typeof data !== 'object') return;

    updateBranding(data.branding, data.profile);
    updateHero(data.hero, data.profile);
    updateAbout(data.about, data.profile);
    updateWorks(data.works);
    updateContactAndSocials(data.contact, data.socialLinks, data.socials, data.profile, data.footer, data.cv);
  }

  /* ─────────────────────────────────────────────────────────────
     1. BRANDING & TITLES
  ───────────────────────────────────────────────────────────── */
  function updateBranding(b, p) {
    const branding = b || {};
    const profile = p || {};

    const topTitle = branding.logoTop || profile.topTitle || 'RINESH';
    const botTitle = branding.logoBottom || profile.bottomTitle || 'KUMAR';
    const siteTitle = branding.siteTitle || (profile.name ? `${profile.name} | Sound Designer & Audio Engineer` : null);

    // Update Logo texts across headers, offcanvases, sidebars
    document.querySelectorAll('.logo-top, .s-logo-top, #authLogoTop, #sbLogoTop').forEach(el => {
      el.textContent = topTitle;
    });
    document.querySelectorAll('.logo-bottom, .s-logo-bot, #authLogoBot, #sbLogoBot').forEach(el => {
      el.textContent = botTitle;
    });

    // Update document title if on public portfolio
    if (siteTitle && !window.location.pathname.includes('/admin')) {
      document.title = siteTitle;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     2. HERO SECTION
  ───────────────────────────────────────────────────────────── */
  function updateHero(h, p) {
    const hero = h || {};
    const profile = p || {};

    // Hero title banner (e.g. "sound engineer")
    if (hero.title) {
      document.querySelectorAll('.banner-three-title').forEach(el => {
        el.textContent = hero.title;
      });
    }

    // Hero subtitle headline
    if (hero.subtitle) {
      document.querySelectorAll('.banner-three-left-title, .banner-three-mobile-heading').forEach(el => {
        el.innerHTML = hero.subtitle.replace(/\n/g, '<br/>');
      });
    }

    // Hero center tagline / description
    const tagline = hero.centerTagline || hero.description;
    if (tagline) {
      document.querySelectorAll('.banner-three-center-title').forEach(el => {
        el.textContent = tagline;
      });
    }

    // Hero Video Player source
    if (hero.videoPath) {
      const videoEl = document.querySelector('.intro-video');
      if (videoEl) {
        const sourceEl = videoEl.querySelector('source');
        if (sourceEl && sourceEl.getAttribute('src') !== hero.videoPath) {
          sourceEl.setAttribute('src', hero.videoPath);
          videoEl.load();
        }
      }
    }

    // Hero CTA Button
    if (hero.ctaLabel) {
      document.querySelectorAll('.banner-three-button a').forEach(el => {
        const dot = el.querySelector('.tw-hover-btn-circle-dot');
        el.innerHTML = hero.ctaLabel;
        if (dot) el.appendChild(dot);
      });
    }
    if (hero.ctaLink) {
      document.querySelectorAll('.banner-three-button a').forEach(el => {
        el.setAttribute('href', hero.ctaLink);
      });
    }

    // Hero Skills List
    if (hero.skills && Array.isArray(hero.skills) && hero.skills.length > 0) {
      const skillsUl = document.getElementById('heroSkillsList');
      if (skillsUl) {
        skillsUl.innerHTML = hero.skills.map(s => `
          <li class="tw-text-lg fw-medium d-inline-flex align-items-center tw-gap-2 tw-mb-4">
            <span><img src="assets/images/icons/banner-three-pluse.svg" alt="pluse" /></span>
            ${escapeHtml(s)}
          </li>
        `).join('');
      }
    }

    // Hero Stats Counters
    if (hero.stats) {
      const counters = document.querySelectorAll('.banner-three-area .banner-three-counter-item .purecounter');
      if (counters[0] && hero.stats.clientSatisfaction !== undefined) {
        counters[0].setAttribute('data-purecounter-end', hero.stats.clientSatisfaction);
        counters[0].textContent = hero.stats.clientSatisfaction;
      }
      if (counters[1] && hero.stats.projectsCompleted !== undefined) {
        counters[1].setAttribute('data-purecounter-end', hero.stats.projectsCompleted);
        counters[1].textContent = hero.stats.projectsCompleted;
      }
      if (counters[2] && hero.stats.globalClients !== undefined) {
        counters[2].setAttribute('data-purecounter-end', hero.stats.globalClients);
        counters[2].textContent = hero.stats.globalClients;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     3. ABOUT SECTION
  ───────────────────────────────────────────────────────────── */
  function updateAbout(a, p) {
    const about = a || {};
    const profile = p || {};

    // Section title
    if (about.sectionTitle) {
      document.querySelectorAll('.about-three-title').forEach(el => {
        el.textContent = about.sectionTitle;
      });
    }

    // Biography paragraphs
    if (about.bio && Array.isArray(about.bio) && about.bio.length > 0) {
      const bioContainer = document.getElementById('aboutBioText');
      if (bioContainer) {
        bioContainer.innerHTML = about.bio.map(para => `
          <p class="tw-text-xl tw-mb-10">${escapeHtml(para)}</p>
        `).join('');
      }
    } else if (profile.bio) {
      const bioContainer = document.getElementById('aboutBioText');
      if (bioContainer) {
        bioContainer.innerHTML = `<p class="tw-text-xl tw-mb-10">${escapeHtml(profile.bio)}</p>`;
      }
    }

    // Years of experience badge
    const years = about.yearsExperience || '5+';
    document.querySelectorAll('.tw-btn-circle-icon').forEach(el => {
      el.textContent = years;
    });

    // Profile & About Images (including GSAP clip-mask layers)
    const imgUrl = about.profileImage || profile.profileImage || profile.avatarUrl;
    if (imgUrl) {
      document.querySelectorAll('#aboutSectionImage, .about-three-thumb img, .about-three-img img, .tw-anim-img, .footer-three-top-thumb img').forEach(el => {
        el.src = imgUrl;
        el.setAttribute('src', imgUrl);
      });
      document.querySelectorAll('.tw-clip-anim .mask').forEach(mask => {
        mask.style.backgroundImage = `url("${imgUrl}")`;
      });
    }

    // About Satisfaction & Scored Counters
    if (about.stats) {
      const aboutCounters = document.querySelectorAll('.about-three-wrap-shape .banner-three-counter-item .purecounter');
      if (aboutCounters[0] && about.stats.clientSatisfaction !== undefined) {
        aboutCounters[0].setAttribute('data-purecounter-end', about.stats.clientSatisfaction);
        aboutCounters[0].textContent = about.stats.clientSatisfaction;
      }
      if (aboutCounters[1] && about.stats.filmsAlbumsScored !== undefined) {
        aboutCounters[1].setAttribute('data-purecounter-end', about.stats.filmsAlbumsScored);
        aboutCounters[1].textContent = about.stats.filmsAlbumsScored;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     4. WORKS / PROJECTS GALLERY (works.html & index.html)
  ───────────────────────────────────────────────────────────── */
  function updateWorks(works) {
    if (!works || !Array.isArray(works) || works.length === 0) return;

    const worksGrid = document.getElementById('dynamicWorksGrid');
    if (!worksGrid) return;

    let html = '';
    works.forEach(work => {
      const category = work.category || 'short-film';
      const badge = work.categoryBadge || work.subtitle || formatCategoryBadge(category);
      const imageSrc = work.image || 'works/manga.webp';
      const mediaHref = work.mediaUrl ? work.mediaUrl : imageSrc;
      const desc = work.description || '';

      html += `
        <div class="col-xl-4 col-lg-4 col-md-6 col-sm-12 d-flex portfolio-three-item portfolio-wrapper" data-category="${escapeHtml(category)}">
          <a href="${escapeHtml(mediaHref)}" class="open-image-popup works-card" target="_blank" rel="noopener">
            <div class="works-img-container">
              <span class="works-category-badge">${escapeHtml(badge)}</span>
              <img class="works-img" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(work.title)}" loading="lazy" />
              <div class="works-overlay-play">
                <div class="play-btn-circle"><i class="ph-bold ph-play"></i></div>
              </div>
            </div>
            <div class="works-info">
              <h3 class="works-title">${escapeHtml(work.title)}</h3>
              <p class="works-desc">${escapeHtml(desc)}</p>
            </div>
          </a>
        </div>
      `;
    });

    worksGrid.innerHTML = html;

    // Attach filter button interactions
    setupFilterButtons();

    // Re-initialize Magnific Popup if available
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.magnificPopup) {
      try {
        window.jQuery('.open-image-popup').magnificPopup({
          type: 'image',
          gallery: { enabled: true },
          callbacks: {
            elementParse: function(item) {
              const url = item.src;
              if (url && (url.includes('youtube.com') || url.includes('vimeo.com') || url.endsWith('.mp4') || url.endsWith('.mov'))) {
                item.type = 'iframe';
              } else {
                item.type = 'image';
              }
            }
          }
        });
      } catch (_) {}
    }
  }

  function setupFilterButtons() {
    const filterBtns = document.querySelectorAll('.portfolio-filter-buttons .filter-btn');
    const items = document.querySelectorAll('#dynamicWorksGrid .portfolio-three-item');

    filterBtns.forEach(btn => {
      btn.onclick = function () {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const filterValue = this.getAttribute('data-filter');
        items.forEach(item => {
          const itemCat = item.getAttribute('data-category');
          if (filterValue === 'all' || itemCat === filterValue) {
            item.style.display = 'flex';
          } else {
            item.style.display = 'none';
          }
        });
      };
    });
  }

  function formatCategoryBadge(cat) {
    if (cat === 'short-film') return 'Short Film';
    if (cat === 'web-series') return 'Web Series';
    if (cat === 'youtube-release') return 'YouTube Release';
    return cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /* ─────────────────────────────────────────────────────────────
     5. CONTACT, SOCIAL LINKS & FOOTER
  ───────────────────────────────────────────────────────────── */
  function updateContactAndSocials(c, socialLinksList, socialsObj, p, f, cvObj) {
    const contact = c || {};
    const profile = p || {};
    const footer = f || {};
    const cv = cvObj || {};

    const email = contact.email || profile.email || 'rineshsoundscraft@gmail.com';
    const phone = contact.phone || profile.phone || '+91 93602 37280';
    const whatsapp = contact.whatsapp || profile.whatsapp || '919360237280';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    // Contact Section Title
    if (contact.sectionTitle) {
      document.querySelectorAll('.footer-three-top-left h2, #contact h2').forEach(el => {
        el.textContent = contact.sectionTitle;
      });
    }

    // Email links & text
    document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
      el.href = `mailto:${email}`;
      if (el.textContent.includes('@')) el.textContent = email;
    });
    document.querySelectorAll('.contact-details-box .contact-detail-item:first-child .contact-detail-value').forEach(el => {
      el.textContent = email;
    });

    // Phone / WhatsApp links & text
    document.querySelectorAll('a[href^="tel:"]').forEach(el => {
      el.href = `tel:${cleanPhone}`;
      if (el.textContent.replace(/[^0-9+]/g, '').length > 5) el.textContent = phone;
    });
    document.querySelectorAll('.contact-details-box .contact-detail-item:last-child .contact-detail-value').forEach(el => {
      el.textContent = phone;
    });
    document.querySelectorAll('a[href*="wa.me"]').forEach(el => {
      el.href = `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`;
    });

    // Mobile contact box links
    document.querySelectorAll('.footer-contact-links a[href^="mailto:"]').forEach(el => {
      el.href = `mailto:${email}`;
      el.innerHTML = `<i class="ph ph-envelope tw-me-1"></i> ${escapeHtml(email)}`;
    });
    document.querySelectorAll('.footer-contact-links a[href^="tel:"]').forEach(el => {
      el.href = `tel:${cleanPhone}`;
      el.innerHTML = `<i class="ph ph-phone tw-me-1"></i> ${escapeHtml(phone)}`;
    });

    // Footer Copyright Name & Year
    const cpName = footer.copyrightName || profile.name || 'Rinesh Kumar';
    const cpYear = footer.copyrightYear || new Date().getFullYear();

    document.querySelectorAll('.footer-three-middile h4').forEach(el => {
      el.textContent = `${cpName} Portfolio`;
    });
    document.querySelectorAll('.footer-three-middile p').forEach(el => {
      el.textContent = `© ${cpYear} ${cpName}. All rights reserved`;
    });

    // CV Download Buttons
    const cvPath = cv.filePath || profile.cvUrl || 'assets/Rinesh_CV.pdf';
    const cvName = cv.downloadName || 'Rinesh_Kumar_Resume.pdf';

    document.querySelectorAll('.mobile-header-cv-btn, .tw-offcanvas-cv-btn-wrap a, .header-three-button a').forEach(el => {
      el.setAttribute('href', cvPath);
      el.setAttribute('download', cvName);
    });

    // Dynamic Social Links
    const rawLinks = socialLinksList && socialLinksList.length > 0 ? socialLinksList : formatSocialsObject(socialsObj);
    if (rawLinks && rawLinks.length > 0) {
      // 1. Update Footer Card Socials (Icons only)
      const footerSocialUl = document.querySelector('.footer-three-social ul');
      if (footerSocialUl) {
        footerSocialUl.innerHTML = rawLinks.map(s => `
          <li>
            <a class="tw-w-11 tw-h-101 lh-1 d-inline-flex align-items-center justify-content-center tw-rounded-lg tw-text-xl text-heading hover-bg-main-600 hover-text-heading"
               href="${escapeHtml(s.url)}" target="_blank" rel="noopener" title="${escapeHtml(s.name || '')}">
              <i class="ph ${escapeHtml(s.icon || 'ph-arrow-square-out')}"></i>
            </a>
          </li>
        `).join('');
      }

      // 2. Update Offcanvas / Sidebar Socials (With label and arrow)
      const sidebarSocialUl = document.querySelector('.footer-social ul');
      if (sidebarSocialUl) {
        sidebarSocialUl.innerHTML = rawLinks.map(s => `
          <li>
            <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">
              <span class="active-media d-flex align-items-center tw-gap-1">
                ${escapeHtml(s.name || 'Link')} <i class="ph ph-arrow-bend-up-right"></i>
              </span>
              <span class="hover-media">
                <i class="ph ${escapeHtml(s.icon || 'ph-arrow-square-out')}"></i>
              </span>
            </a>
          </li>
        `).join('');
      }
    }
  }

  function formatSocialsObject(s) {
    if (!s || typeof s !== 'object') return [];
    const list = [];
    if (s.instagram) list.push({ name: 'Instagram', icon: 'ph-instagram-logo', url: s.instagram });
    if (s.whatsapp) list.push({ name: 'WhatsApp', icon: 'ph-whatsapp-logo', url: s.whatsapp });
    if (s.linkedin) list.push({ name: 'LinkedIn', icon: 'ph-linkedin-logo', url: s.linkedin });
    if (s.youtube) list.push({ name: 'YouTube', icon: 'ph-youtube-logo', url: s.youtube });
    if (s.spotify) list.push({ name: 'Spotify', icon: 'ph-spotify-logo', url: s.spotify });
    if (s.twitter) list.push({ name: 'Twitter / X', icon: 'ph-x-logo', url: s.twitter });
    return list;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
