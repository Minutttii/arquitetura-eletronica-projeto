/* ================================================================
   LuxControl — Site Técnico | Scripts
   Scroll animations, nav active state, mobile menu
   ================================================================ */
(() => {
  'use strict';

  // ─── Scroll Reveal (Intersection Observer) ─────────────────
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  // ─── Header Scroll Effect ─────────────────────────────────
  const header = document.querySelector('.site-header');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 60) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    lastScroll = y;
  }, { passive: true });

  // ─── Active Nav Link ──────────────────────────────────────
  const navLinks = document.querySelectorAll('.header-nav a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY + 120;
    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');
      const link = document.querySelector(`.header-nav a[href="#${id}"]`);
      if (link) {
        if (scrollY >= top && scrollY < top + height) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    });
  }
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  // ─── Mobile Menu Toggle ───────────────────────────────────
  const mobileToggle = document.querySelector('.mobile-toggle');
  const headerNav = document.querySelector('.header-nav');
  if (mobileToggle && headerNav) {
    mobileToggle.addEventListener('click', () => {
      headerNav.classList.toggle('open');
      mobileToggle.textContent = headerNav.classList.contains('open') ? '✕' : '☰';
    });
    // Close on link click
    headerNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        headerNav.classList.remove('open');
        mobileToggle.textContent = '☰';
      });
    });
  }

  // ─── Smooth Scroll for anchor links ───────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();
