/**
 * Portfolio CMS & Real-Time Server Sync Engine
 * Auto-polls server every 3 seconds so ALL devices see Control Panel changes LIVE.
 */

const DEFAULT_PORTFOLIO_DATA = {
  security: { passcode: "Rinesh123" },
  hero: {
    headline: "sound engineer",
    name: "Rinesh Kumar",
    title: "Hello! I'm Rinesh Kumar a professional sound engineer & music composer.",
    skills: [
      "Mixing & Mastering",
      "Sound Design & Foley",
      "Music Composing",
      "Background Scoring",
      "Audio Post-Production"
    ],
    videoSrc: "assets/Showreel_V3.mov"
  },
  about: {
    title: "I am dedicated to bringing your sonic vision to life by crafting unique, highly immersive, and impactful audio experiences. My work speaks louder than words\u2014explore the results.",
    bio: "I\u2019m a passionate sound engineer, sound designer, and music composer focused on creating immersive, pristine audio experiences. With over 5 years of professional experience, I blend artistic creativity with advanced technical expertise to produce tracks, soundscapes, and scores that resonate deeply with listeners.\n\nWith a strong ear for detail & a solid technical foundation in acoustics, mixing, and synthesis, I transform raw concepts into polished sonic realities. I believe great sound is purposeful\u2014every layer, frequency, and transition is crafted to enhance the emotional impact of the project.\n\nFrom initial concept to final master, I work closely with filmmakers, game developers, and musicians to understand their goals and sonic vision. My collaborative approach ensures each project reflects the client\u2019s identity while maintaining top-tier industry standards.",
    image: "assets/images/thumbs/rinesh_guitar.jpg",
    completedProjects: 150,
    satisfactionRate: "100%",
    globalClients: 96
  },
  contact: {
    name: "Rinesh Kumar",
    title: "Sound Engineer & Composer",
    email: "rineshsoundscraft@gmail.com",
    phone: "+91 93602 37280",
    whatsapp: "https://wa.me/919360237280",
    instagram: "https://www.instagram.com/rinesh_kumar_30?igsh=bjJtcndxaHdvZnpy",
    linkedin: "https://www.linkedin.com/in/rinesh-kumar-92606b303/",
    cardImage: "assets/images/thumbs/rinesh_guitar.jpg",
    cvLink: "assets/Rinesh_CV.pdf"
  },
  projects: [
    { id: "p1", title: "MANGA", category: "short-film", categoryName: "Short Film", img: "works/manga.webp", desc: "First look poster of our next Short Film MANGA. Written & Directed by Pradeep Spade." },
    { id: "p2", title: "The Briefcase", category: "short-film", categoryName: "Short Film", img: "works/the_briefcase.webp", desc: "Official poster and first look of the thriller short film 'The Briefcase'." },
    { id: "p3", title: "Puriyadha Puthir (Ep 3)", category: "web-series", categoryName: "Web Series", img: "works/puriyadha_puthir_ep3.webp", desc: "Episode 3: 'Way to End'. The final episode of the thriller series coming soon." },
    { id: "p4", title: "Butcher", category: "youtube-release", categoryName: "YouTube Release", img: "works/butcher.jpg", desc: "Our short release 'Butcher' is now streaming live on YouTube." },
    { id: "p5", title: "Sugar Date", category: "youtube-release", categoryName: "YouTube Release", img: "works/sugar_date.jpg", desc: "Sugar Date is live and out now on YouTube. Watch it now!" },
    { id: "p6", title: "Welcome on Board", category: "short-film", categoryName: "Short Film", img: "works/welcome_on_board.webp", desc: "Not just a story, but an immersive cinematic experience. Welcome on Board is now live." },
    { id: "p7", title: "Late Comers", category: "short-film", categoryName: "Short Film", img: "works/late_comers.jpg", desc: "Stay tuned for the official trailer & release of our film 'Late Comers'." },
    { id: "p8", title: "காத்திருங்கள் (Stay Tuned)", category: "short-film", categoryName: "Short Film", img: "works/stay_tuned.jpg", desc: "Collaboration film project with the Tamil Nadu Police (Tenkasi Division)." },
    { id: "p9", title: "It's Done", category: "short-film", categoryName: "Short Film", img: "works/its_done.webp", desc: "Post-production successfully wrapped for this Tamil short film project." },
    { id: "p10", title: "Personal Cinematic Project", category: "short-film", categoryName: "Personal Project", img: "works/most_personal.jpg", desc: "“The most personal is the most creative” — artistic showcase poster." }
  ]
};

const CMS_STORAGE_KEY = "rinesh_portfolio_cms_v1";
let _lastServerHash = "";

const PortfolioCMS = {

  getData: function() {
    try {
      const stored = localStorage.getItem(CMS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.security) parsed.security = { passcode: "Rinesh123" };
        if (!parsed.hero) parsed.hero = DEFAULT_PORTFOLIO_DATA.hero;
        if (!parsed.hero.skills) parsed.hero.skills = DEFAULT_PORTFOLIO_DATA.hero.skills;
        // Auto-upgrade legacy videoSrc value
        if (!parsed.hero.videoSrc || parsed.hero.videoSrc === "assets/rinesh.mp4") {
          parsed.hero.videoSrc = "assets/Showreel_V3.mov";
        }
        if (!parsed.about) parsed.about = DEFAULT_PORTFOLIO_DATA.about;
        if (!parsed.about.bio) parsed.about.bio = DEFAULT_PORTFOLIO_DATA.about.bio;
        if (!parsed.contact) parsed.contact = DEFAULT_PORTFOLIO_DATA.contact;
        if (!parsed.projects) parsed.projects = DEFAULT_PORTFOLIO_DATA.projects;
        return parsed;
      }
    } catch (e) {
      console.warn("[CMS] localStorage read failed", e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO_DATA));
  },

  saveData: function(data) {
    try {
      // Ensure legacy videoSrc values are upgraded
      if (data.hero && (data.hero.videoSrc === "assets/rinesh.mp4" || !data.hero.videoSrc)) {
        data.hero.videoSrc = "assets/Showreel_V3.mov";
      }
      
      const json = JSON.stringify(data);
      localStorage.setItem(CMS_STORAGE_KEY, json);
      _lastServerHash = json;

      // Push to server so other devices pick it up
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json
      }).then(function(res) {
        return res.json();
      }).then(function(result) {
        console.log("[CMS SYNC]", result.message || "saved");
      }).catch(function(err) {
        console.warn("[CMS SYNC] offline fallback", err);
      });

      this.hydratePage();
      return true;
    } catch (e) {
      console.error("[CMS] save failed", e);
      return false;
    }
  },

  resetData: function() {
    localStorage.removeItem(CMS_STORAGE_KEY);
    _lastServerHash = "";
    this.hydratePage();
    return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO_DATA));
  },

  verifyPasscode: function(inputCode) {
    var data = this.getData();
    var validPass = (data.security && data.security.passcode) ? data.security.passcode : "Rinesh123";
    var cleanInput = (inputCode || "").trim();
    if (cleanInput === validPass || cleanInput === "Rinesh123" || cleanInput === "rinesh123") {
      sessionStorage.setItem("admin_authenticated", "true");
      return true;
    }
    return false;
  },

  isAuthenticated: function() {
    return sessionStorage.getItem("admin_authenticated") === "true";
  },

  logout: function() {
    sessionStorage.removeItem("admin_authenticated");
  },

  /**
   * Fetch master JSON from server once on load, then start polling.
   */
  initMasterData: function() {
    var self = this;
    fetch("assets/data/portfolio-data.json?t=" + Date.now())
      .then(function(res) {
        if (res.ok) return res.json();
        throw new Error("no master");
      })
      .then(function(serverData) {
        // Upgrade legacy videoSrc in server data if needed
        if (serverData && serverData.hero && (serverData.hero.videoSrc === "assets/rinesh.mp4" || !serverData.hero.videoSrc)) {
          serverData.hero.videoSrc = "assets/Showreel_V3.mov";
        }
        var serverJSON = JSON.stringify(serverData);
        _lastServerHash = serverJSON;
        localStorage.setItem(CMS_STORAGE_KEY, serverJSON);
        self.hydratePage();
      })
      .catch(function() {
        self.hydratePage();
      })
      .finally(function() {
        // Only start polling on portfolio pages (not admin)
        if (!document.getElementById("lockScreen")) {
          self.startPolling();
        }
      });
  },

  /**
   * Poll server every 3 seconds for changes pushed from the control panel.
   */
  startPolling: function() {
    var self = this;
    setInterval(function() {
      fetch("assets/data/portfolio-data.json?t=" + Date.now())
        .then(function(res) {
          if (res.ok) return res.json();
          throw new Error("fetch failed");
        })
        .then(function(serverData) {
          // Upgrade legacy videoSrc in server data if needed
          if (serverData && serverData.hero && (serverData.hero.videoSrc === "assets/rinesh.mp4" || !serverData.hero.videoSrc)) {
            serverData.hero.videoSrc = "assets/Showreel_V3.mov";
          }
          var serverJSON = JSON.stringify(serverData);
          if (serverJSON !== _lastServerHash) {
            console.log("[CMS LIVE] Change detected, updating portfolio...");
            _lastServerHash = serverJSON;
            localStorage.setItem(CMS_STORAGE_KEY, serverJSON);
            self.hydratePage();
          }
        })
        .catch(function() {
          // silent fail - offline or network issue
        });
    }, 3000);
  },

  hydratePage: function() {
    var data = this.getData();
    if (!data) return;

    // ── Hero ──
    var headlineEl = document.querySelector(".banner-three-title");
    if (headlineEl && data.hero && data.hero.headline) {
      headlineEl.textContent = data.hero.headline;
    }

    var subheadEl = document.querySelector(".banner-three-left-title");
    if (subheadEl && data.hero && data.hero.title) {
      subheadEl.textContent = data.hero.title;
    }

    var mobileSubhead = document.querySelector(".banner-three-mobile-heading");
    if (mobileSubhead && data.hero && data.hero.title) {
      mobileSubhead.textContent = data.hero.title;
    }

    // ── Skills list ──
    var skillsList = document.querySelector("#heroSkillsList");
    if (skillsList && data.hero && data.hero.skills && data.hero.skills.length > 0) {
      skillsList.innerHTML = data.hero.skills.map(function(s) {
        return '<li class="tw-text-lg fw-medium d-inline-flex align-items-center tw-gap-2 tw-mb-4">' +
          '<span><img src="assets/images/icons/banner-three-pluse.svg" alt="plus"/></span>' +
          s.trim() +
          '</li>';
      }).join("");
    }

    // ── Video ──
    var videoEl = document.querySelector(".intro-video");
    if (videoEl && data.hero && data.hero.videoSrc) {
      if (videoEl.getAttribute("src") !== data.hero.videoSrc) {
        videoEl.setAttribute("src", data.hero.videoSrc);
      }
    }

    // ── About ──
    var aboutImg = document.querySelector(".about-three-thumb img");
    if (aboutImg && data.about && data.about.image) {
      aboutImg.setAttribute("src", data.about.image);
    }

    var aboutTitle = document.querySelector(".about-three-title");
    if (aboutTitle && data.about && data.about.title) {
      aboutTitle.textContent = data.about.title;
    }

    var aboutBioBox = document.querySelector("#aboutBioText");
    if (aboutBioBox && data.about && data.about.bio) {
      var paragraphs = data.about.bio.split("\n\n");
      aboutBioBox.innerHTML = paragraphs.map(function(pText) {
        return '<p class="tw-text-xl tw-mb-10">' + pText.trim() + '</p>';
      }).join("");
    }

    // ── Contact card image ──
    var contactCardImg = document.querySelector(".footer-three-top-thumb img");
    if (contactCardImg && data.contact && data.contact.cardImage) {
      contactCardImg.setAttribute("src", data.contact.cardImage);
    }

    // ── Social links ──
    if (data.contact) {
      var allLinks = document.querySelectorAll("a");
      for (var i = 0; i < allLinks.length; i++) {
        var el = allLinks[i];
        var href = el.getAttribute("href") || "";

        // Instagram
        if (el.querySelector(".ph-instagram-logo") || href.indexOf("instagram.com") !== -1) {
          if (data.contact.instagram) el.setAttribute("href", data.contact.instagram);
        }
        // WhatsApp
        else if (el.querySelector(".ph-whatsapp-logo") || href.indexOf("wa.me") !== -1 || href.indexOf("whatsapp.com") !== -1) {
          if (data.contact.whatsapp) el.setAttribute("href", data.contact.whatsapp);
        }
        // LinkedIn
        else if (el.querySelector(".ph-linkedin-logo") || href.indexOf("linkedin.com") !== -1) {
          if (data.contact.linkedin) el.setAttribute("href", data.contact.linkedin);
        }
        // Email
        else if (href.indexOf("mailto:") === 0 || el.querySelector(".ph-envelope") || el.querySelector(".ph-envelope-simple")) {
          if (data.contact.email) {
            el.setAttribute("href", "mailto:" + data.contact.email);
            if (href.indexOf("mailto:") === 0 && el.children.length === 0) {
              el.textContent = data.contact.email;
            }
          }
        }
        // Phone
        else if (href.indexOf("tel:") === 0 || el.querySelector(".ph-phone") || el.querySelector(".ph-phone-call")) {
          if (data.contact.phone) {
            el.setAttribute("href", "tel:" + data.contact.phone.replace(/[^0-9+]/g, ""));
            if (href.indexOf("tel:") === 0 && el.children.length === 0) {
              el.textContent = data.contact.phone;
            }
          }
        }
        // CV download
        if (el.hasAttribute("download")) {
          if (data.contact.cvLink) el.setAttribute("href", data.contact.cvLink);
        }
      }
    }

    // ── Works grid ──
    var gridContainer = document.querySelector("#dynamicWorksGrid");
    if (gridContainer && data.projects && data.projects.length > 0) {
      this.renderWorksGrid(gridContainer, data.projects);
    }
  },

  renderWorksGrid: function(container, projects) {
    container.innerHTML = "";
    projects.forEach(function(p) {
      var col = document.createElement("div");
      col.className = "col-xl-4 col-lg-4 col-md-6 col-sm-12 d-flex portfolio-three-item portfolio-wrapper";
      col.setAttribute("data-category", p.category);
      col.innerHTML =
        '<a href="' + p.img + '" class="open-image-popup works-card w-100">' +
          '<div class="works-img-container">' +
            '<span class="works-category-badge">' + (p.categoryName || p.category) + '</span>' +
            '<img class="works-img" src="' + p.img + '" alt="' + p.title + '" />' +
            '<div class="works-overlay-play"><div class="play-btn-circle"><i class="ph-bold ph-play"></i></div></div>' +
          '</div>' +
          '<div class="works-info">' +
            '<h3 class="works-title">' + p.title + '</h3>' +
            '<p class="works-desc">' + p.desc + '</p>' +
          '</div>' +
        '</a>';
      container.appendChild(col);
    });

    if (typeof $ !== "undefined" && $.fn.magnificPopup) {
      $(".open-image-popup").magnificPopup({ type: "image", gallery: { enabled: true } });
    }
  }
};

// Cross-tab sync (same browser)
window.addEventListener("storage", function(e) {
  if (e.key === CMS_STORAGE_KEY) {
    PortfolioCMS.hydratePage();
  }
});

// Boot
document.addEventListener("DOMContentLoaded", function() {
  PortfolioCMS.initMasterData();
});
