$(document).ready(function() {
  // 1. Portfolio dynamic filtering
  $('.filter-btn').on('click', function() {
    $('.filter-btn').removeClass('active');
    $(this).addClass('active');
    
    var filterValue = $(this).attr('data-filter');
    
    if (filterValue === 'all') {
      $('.portfolio-three-item').fadeIn(400);
    } else {
      $('.portfolio-three-item').hide();
      $('.portfolio-three-item').each(function() {
        var categories = $(this).attr('data-category');
        if (categories && categories.split(' ').indexOf(filterValue) > -1) {
          $(this).fadeIn(400);
        }
      });
    }
    // Refresh ScrollTrigger since items hiding/showing changes page height
    if (typeof ScrollTrigger !== 'undefined') {
      setTimeout(function() {
        ScrollTrigger.refresh();
      }, 450);
    }
  });

  // 2. Close mobile drawer on navigation click
  $(document).on('click', '.tw-main-menu-mobile a', function() {
    $('.tw-offcanvas-2-area').removeClass('opened');
    $('.body-overlay').removeClass('opened');
    $('.body-overlay').removeClass('apply');
    $('.twoffcanvas').removeClass('opened');
  });

  // 3. Spotlight Navbar Logic
  const spotNav = document.querySelector('.spotlight-nav');
  if (spotNav) {
    const hoverLayer = spotNav.querySelector('.spotlight-hover-layer');
    const activeLayer = spotNav.querySelector('.spotlight-active-layer');
    const navLinks = spotNav.querySelectorAll('.spotlight-nav-link');
    
    // Determine active index from DOM or default to 0
    let activeIndex = 0;
    navLinks.forEach((link, idx) => {
      if (link.classList.contains('active')) {
        activeIndex = idx;
      }
    });
    
    let isScrolling = false;

    // Function to update ambience (active element highlight) position
    function updateAmbience(index, immediate = false) {
      const activeLink = spotNav.querySelector(`.spotlight-nav-link[data-index="${index}"]`) || navLinks[index];
      if (!activeLink) return;

      const navRect = spotNav.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const targetX = linkRect.left - navRect.left + linkRect.width / 2;

      if (immediate) {
        spotNav.style.setProperty('--ambience-x', `${targetX}px`);
        spotNav.style.setProperty('--spotlight-x', `${targetX}px`);
      } else if (typeof gsap !== 'undefined') {
        gsap.to(spotNav, {
          '--ambience-x': targetX,
          duration: 0.5,
          ease: 'power2.out'
        });
      }
    }

    // Initialize position on load
    setTimeout(() => {
      updateAmbience(activeIndex, true);
    }, 600);

    // Handle window resize
    window.addEventListener('resize', () => {
      updateAmbience(activeIndex, true);
    });

    // Handle mouse move (spotlight follow)
    spotNav.addEventListener('mousemove', (e) => {
      const navRect = spotNav.getBoundingClientRect();
      const x = e.clientX - navRect.left;
      if (hoverLayer) hoverLayer.style.opacity = '1';
      spotNav.style.setProperty('--spotlight-x', `${x}px`);
    });

    // Handle mouse leave (spring back to active)
    spotNav.addEventListener('mouseleave', () => {
      if (hoverLayer) hoverLayer.style.opacity = '0';

      const activeLink = spotNav.querySelector(`.spotlight-nav-link[data-index="${activeIndex}"]`) || navLinks[activeIndex];
      if (activeLink) {
        const navRect = spotNav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        const targetX = linkRect.left - navRect.left + linkRect.width / 2;

        if (typeof gsap !== 'undefined') {
          gsap.to(spotNav, {
            '--spotlight-x': targetX,
            duration: 0.4,
            ease: 'power2.out'
          });
        }
      }
    });

    // Handle link click & scroll
    navLinks.forEach((link, idx) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (!targetId || targetId.indexOf('.html') > -1) {
          return;
        }
        e.preventDefault();
        activeIndex = idx;
        isScrolling = true;

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        updateAmbience(idx);

        const smoother = window.smoother || (typeof ScrollSmoother !== 'undefined' ? ScrollSmoother.get() : null);
        
        if (smoother) {
          let offset = (targetId === "#works" ? "top 10px" : "top 100px");
          smoother.scrollTo(targetId, true, offset);
          setTimeout(() => {
            isScrolling = false;
          }, 1000);
        } else {
          const targetElement = document.querySelector(targetId);
          if (targetElement) {
            const offset = (targetId === "#works" ? 20 : 80);
            const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });

            setTimeout(() => {
              isScrolling = false;
            }, 800);
          } else {
            isScrolling = false;
          }
        }
      });
    });

    // Auto-scroll to section if hash is present in URL on page load (e.g. works.html#works)
    if (window.location.hash && window.location.hash.length > 1) {
      const hash = window.location.hash;
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        setTimeout(() => {
          const smoother = window.smoother || (typeof ScrollSmoother !== 'undefined' ? ScrollSmoother.get() : null);
          if (smoother) {
            let offset = (hash === "#works" ? "top 10px" : "top 100px");
            smoother.scrollTo(hash, true, offset);
          } else {
            const offset = (hash === "#works" ? 20 : 80);
            const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
              top: elementPosition - offset,
              behavior: 'smooth'
            });
          }
        }, 600);
      }
    }

    // Scroll Spy implementation (active if section elements exist)
    if (document.querySelector('#about')) {
      const sections = [
        { id: '#smooth-content', index: 0 },
        { id: '#about', index: 1 },
        { id: '#contact', index: 3 }
      ];

      window.addEventListener('scroll', () => {
        if (isScrolling) return;

        let currentActive = activeIndex;
        const scrollPos = window.scrollY + 180;

        sections.forEach((sec) => {
          const el = document.querySelector(sec.id);
          if (el && scrollPos >= el.offsetTop) {
            currentActive = sec.index;
          }
        });

        if (currentActive !== activeIndex) {
          activeIndex = currentActive;
          navLinks.forEach((l, i) => {
            if (i === activeIndex) {
              l.classList.add('active');
            } else {
              l.classList.remove('active');
            }
          });
          updateAmbience(activeIndex);
        }
      });
    }
  }

  // 4. Hero Video Custom Controls
  const introVideo = document.querySelector('.intro-video');
  const playPauseBtn = document.getElementById('video-play-pause');
  const muteUnmuteBtn = document.getElementById('video-mute-unmute');
  const skipBackBtn = document.getElementById('video-skip-back');
  const skipForwardBtn = document.getElementById('video-skip-forward');
  const timeDisplay = document.getElementById('video-time');

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  if (introVideo && introVideo.tagName === 'VIDEO') {
    introVideo.muted = false;
    introVideo.volume = 1.0;

    // Handle browser autoplay policy (play unmuted when allowed, or unmute on first user click)
    const enableSoundOnUserInteraction = () => {
      introVideo.muted = false;
      introVideo.volume = 1.0;
      if (introVideo.paused) {
        introVideo.play().catch(() => {});
      }
      document.removeEventListener('click', enableSoundOnUserInteraction);
      document.removeEventListener('keydown', enableSoundOnUserInteraction);
      document.removeEventListener('touchstart', enableSoundOnUserInteraction);
    };

    // Attempt unmuted play, fallback to muted if blocked by browser policy
    const promise = introVideo.play();
    if (promise !== undefined) {
      promise.catch(() => {
        introVideo.muted = true;
        introVideo.play().catch(() => {});
        document.addEventListener('click', enableSoundOnUserInteraction, { once: true });
        document.addEventListener('keydown', enableSoundOnUserInteraction, { once: true });
        document.addEventListener('touchstart', enableSoundOnUserInteraction, { once: true });
      });
    }

    if (timeDisplay) {
      introVideo.addEventListener('timeupdate', () => {
        timeDisplay.textContent = formatTime(introVideo.currentTime) + ' / ' + formatTime(introVideo.duration);
      });
      introVideo.addEventListener('loadedmetadata', () => {
        timeDisplay.textContent = '0:00 / ' + formatTime(introVideo.duration);
      });
    }

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        introVideo.muted = false;
        introVideo.volume = 1.0;
        if (introVideo.paused) {
          introVideo.play();
          playPauseBtn.innerHTML = '<i class="ph-bold ph-pause"></i>';
        } else {
          introVideo.pause();
          playPauseBtn.innerHTML = '<i class="ph-bold ph-play"></i>';
        }
      });
    }

    if (muteUnmuteBtn) {
      muteUnmuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (introVideo.muted) {
          introVideo.muted = false;
          introVideo.volume = 1.0;
          muteUnmuteBtn.innerHTML = '<i class="ph-bold ph-speaker-high"></i>';
        } else {
          introVideo.muted = true;
          muteUnmuteBtn.innerHTML = '<i class="ph-bold ph-speaker-slash"></i>';
        }
      });
    }

    if (skipBackBtn) {
      skipBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        introVideo.currentTime = Math.max(0, introVideo.currentTime - 10);
      });
    }

    if (skipForwardBtn) {
      skipForwardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        introVideo.currentTime = Math.min(introVideo.duration || introVideo.currentTime, introVideo.currentTime + 10);
      });
    }
  }

  // 5. Contact Form AJAX Handling with Web3Forms & Toast Feedback
  $('form[action*="web3forms"]').on('submit', function(e) {
    e.preventDefault();
    var $form = $(this);
    var $submitBtn = $form.find('button[type="submit"]');
    var originalBtnContent = $submitBtn.html();

    // Disable button & set loading state
    $submitBtn.prop('disabled', true).css('opacity', '0.7').html('<i class="ph ph-spinner tw-spin tw-me-2"></i> Sending Message...');

    var formData = new FormData(this);

    fetch($form.attr('action'), {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        $submitBtn.html('<i class="ph ph-check-circle tw-me-2"></i> Message Sent!');
        showToast('Message Sent!', 'Thank you for reaching out. Rinesh will get back to you soon.', 'success');
        $form[0].reset();
      } else {
        $submitBtn.prop('disabled', false).css('opacity', '1').html(originalBtnContent);
        showToast('Submission Failed', data.message || 'Something went wrong. Please try again.', 'error');
      }
    })
    .catch(function(err) {
      $submitBtn.prop('disabled', false).css('opacity', '1').html(originalBtnContent);
      showToast('Error', 'An error occurred while sending your message. Please try again.', 'error');
    })
    .finally(function() {
      setTimeout(function() {
        $submitBtn.prop('disabled', false).css('opacity', '1').html(originalBtnContent);
      }, 4000);
    });
  });

  // Helper Function for Displaying Floating Toasts
  function showToast(title, message, type) {
    var $container = $('#toast-container');
    if ($container.length === 0) {
      $('body').append('<div id="toast-container"></div>');
      $container = $('#toast-container');
    }

    var isSuccess = (type === 'success');
    var iconClass = isSuccess ? 'ph-check-circle' : 'ph-warning-circle';
    var borderColor = isSuccess ? '#b5ef2f' : '#dc2626';
    var iconColor = isSuccess ? '#b5ef2f' : '#dc2626';

    var toastHtml = `
      <div class="toast-message active" style="border-inline-start-color: ${borderColor}; background-color: #1a1a1a; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div class="toast-message__content" style="display: flex; align-items: center; gap: 12px;">
          <div class="toast-message__icon" style="color: ${iconColor}; font-size: 24px; line-height: 1;">
            <i class="ph ${iconClass}"></i>
          </div>
          <div style="flex-grow: 1;">
            <h5 class="toast-message__title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">${title}</h5>
            <p class="toast-message__text" style="margin: 2px 0 0; font-size: 13px; color: #ccc;">${message}</p>
          </div>
          <button type="button" class="toast-message__close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px;" onclick="$(this).closest('.toast-message').removeClass('active').fadeOut(300, function(){ $(this).remove(); });">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
    `;

    var $toast = $(toastHtml);
    $container.append($toast);

    setTimeout(function() {
      $toast.removeClass('active');
      setTimeout(function() {
        $toast.remove();
      }, 400);
    }, 4500);
  }
});

