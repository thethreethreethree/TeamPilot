// ExecOS Landing Page JS

document.addEventListener('DOMContentLoaded', () => {

  // ── Smooth scroll for nav links ──────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Fade-in on scroll (Intersection Observer) ────────────────────────────
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // ── Product showcase tab switching ───────────────────────────────────────
  const showcaseTabs   = document.querySelectorAll('.showcase-tab');
  const showcasePanels = document.querySelectorAll('.showcase-panel');

  function activateTab(tabEl) {
    const target = tabEl.dataset.tab;
    showcaseTabs.forEach(t => t.classList.remove('active'));
    showcasePanels.forEach(p => p.classList.remove('active'));
    tabEl.classList.add('active');
    const panel = document.getElementById('panel-' + target);
    if (panel) panel.classList.add('active');
  }

  showcaseTabs.forEach(tab => {
    tab.addEventListener('click', () => activateTab(tab));
  });

  // Activate first tab on load
  if (showcaseTabs.length > 0) activateTab(showcaseTabs[0]);

  // ── Sticky nav shadow on scroll ──────────────────────────────────────────
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  // ── Animated count-up for stats ──────────────────────────────────────────
  function countUp(el, end, suffix = '') {
    const duration = 1200;
    const start    = 0;
    const step     = 16;
    const total    = Math.ceil(duration / step);
    let count      = 0;
    const inc      = end / total;

    const timer = setInterval(() => {
      count += inc;
      if (count >= end) {
        el.textContent = end + suffix;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(count) + suffix;
      }
    }, step);
  }

  const statsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const statEls = entry.target.querySelectorAll('.stat-num[data-count]');
        statEls.forEach(el => {
          const end    = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || '';
          countUp(el, end, suffix);
        });
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) statsObserver.observe(statsBar);

});
