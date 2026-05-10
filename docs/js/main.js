// ExecOS Landing Page JS

// ── Showcase tab switching ────────────────────────────────
function showTab(id, btn) {
  document.querySelectorAll('.showcase-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.showcase-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll fade-up animations ─────────────────────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

  // ── Smooth scroll nav links ───────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Nav shadow on scroll ──────────────────────────────────
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.style.borderBottomColor = window.scrollY > 20 ? 'rgba(30,34,54,.8)' : '';
  }, { passive: true });

});
