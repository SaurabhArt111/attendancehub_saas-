// AttendanceHub marketing site — small, dependency-free interactions.
(function () {
  'use strict';

  var root = document.documentElement;

  /* ── Theme toggle (mirrors the real product's Light/Dark/System setting) ── */
  var themeBtn = document.getElementById('themeBtn');
  var iconMoon = document.getElementById('themeIconMoon');
  var iconSun = document.getElementById('themeIconSun');

  function applyTheme(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      iconMoon.style.display = 'none';
      iconSun.style.display = 'block';
    } else {
      root.removeAttribute('data-theme');
      iconMoon.style.display = 'block';
      iconSun.style.display = 'none';
    }
  }

  var savedTheme = null;
  try { savedTheme = localStorage.getItem('ah-landing-theme'); } catch (e) { /* private mode */ }
  if (savedTheme) applyTheme(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem('ah-landing-theme', next); } catch (e) { /* ignore */ }
    });
  }

  /* ── Sticky nav background on scroll ── */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 12) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile menu ── */
  var menuToggle = document.getElementById('menuToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      mobileMenu.classList.toggle('open');
    });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobileMenu.classList.remove('open'); });
    });
  }

  /* ── Scroll reveal ── */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ── Count-up stats ── */
  var counters = document.querySelectorAll('.stat-num[data-count]');
  function animateCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10) || 0;
    var duration = 1100;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && counters.length) {
    var cIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cIo.observe(el); });
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (other) {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        a.style.maxHeight = null;
      } else {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ── Gallery lightbox ── */
  var lightbox = document.getElementById('lightbox');
  var lightboxBox = document.getElementById('lightboxBox');
  var lightboxTitle = document.getElementById('lightboxTitle');
  var lightboxClose = document.getElementById('lightboxClose');

  function openLightbox(item) {
    var crop = item.querySelector('.crop');
    lightboxBox.innerHTML = '';
    if (crop) {
      var clone = crop.cloneNode(true);
      clone.style.border = '1px solid var(--border)';
      clone.style.boxShadow = 'var(--shadow-lg)';
      lightboxBox.appendChild(clone);
    }
    var title = item.getAttribute('data-title') || '';
    var desc = item.getAttribute('data-desc') || '';
    lightboxTitle.innerHTML = title + (desc ? '<span>' + desc + '</span>' : '');
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('.gallery-item').forEach(function (item) {
    item.addEventListener('click', function () { openLightbox(item); });
  });
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

})();
