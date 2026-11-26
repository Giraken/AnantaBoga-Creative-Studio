// Site motion: word-by-word statements, counters, the dragon curve drawn with the scroll, the pinned
// services scene, and the horizontal work reel. Without GSAP, or with reduced motion, the page falls
// back to a plain static layout (html.static).
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduce;
  if (!motion) document.documentElement.classList.add('static');

  // Local time in Kota Batu (WIB, UTC+7)
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }); };
    tick(); setInterval(tick, 20000);
  }

  // "See all 27 films" at the end of the reel opens the full index
  document.querySelector('[data-toggle-works-proxy]')?.addEventListener('click', () => {
    const t = document.querySelector('[data-toggle-works]');
    if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
    else document.getElementById('all-works')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Split statements into words
  const statements = [...document.querySelectorAll('[data-words]')];
  statements.forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  });

  // Services index follows the active panel
  const panels = [...document.querySelectorAll('.svc-panel')];
  const idx = [...document.querySelectorAll('.svc-index li')];
  const no = document.querySelector('[data-svc-no]');
  const setSvc = i => {
    panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    idx.forEach((li, k) => li.classList.toggle('is-active', k === i));
    if (no) no.textContent = String(i + 1).padStart(2, '0');
  };

  if (!motion) {
    statements.forEach(el => el.querySelectorAll('.w').forEach(w => w.classList.add('on')));
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Statements light up word by word as they scroll through the middle of the screen
  statements.forEach(el => {
    const words = [...el.querySelectorAll('.w')];
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', end: 'bottom 45%', scrub: true,
      onUpdate: self => { const n = Math.round(self.progress * words.length); words.forEach((w, k) => w.classList.toggle('on', k < n)); },
    });
  });

  // Counters
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, suf = el.dataset.suffix || '';
    const o = { v: 0 };
    el.textContent = '0' + suf;
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
  });

  // Gentle reveal for images and blocks
  gsap.utils.toArray('.about-shot, .about-copy, .plan, .contact-cols > div, .clients, .stats').forEach(el => {
    el.classList.add('reveal');
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-shown') });
  });
  // Images drift a little slower than the page
  gsap.utils.toArray('.about-shot img').forEach(img => {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // The dragon curve draws itself as it passes through the screen
  document.querySelectorAll('.curve-break').forEach(box => {
    box.querySelectorAll('path').forEach((path, k) => {
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: box, start: 'top 95%', end: 'bottom 25%', scrub: 0.6 + k * 0.4 } });
    });
  });

  // Services: pinned; each stretch of scrolling brings in the next service
  const pin = document.querySelector('.svc-pin');
  const bar = document.querySelector('.svc-progress');
  if (pin && panels.length) {
    let cur = 0;
    ScrollTrigger.create({
      trigger: pin, start: 'top top', end: () => '+=' + window.innerHeight * (panels.length - 0.2), pin: true, scrub: true,
      onUpdate: self => {
        bar?.style.setProperty('--p', self.progress.toFixed(3));
        const i = Math.min(panels.length - 1, Math.floor(self.progress * panels.length));
        if (i !== cur) { cur = i; setSvc(i); }
      },
    });
  }

  // Work: the reel moves sideways while the section is pinned (wide screens only)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const reelPin = document.querySelector('.reel-pin'), reel = document.querySelector('.reel');
    if (!reelPin || !reel) return;
    const dist = () => Math.max(0, reel.scrollWidth - window.innerWidth);
    const tween = gsap.to(reel, { x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: reelPin, start: 'center center', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true } });
    return () => tween.kill();
  });
  mm.add('(max-width: 760px)', () => { document.querySelector('.reel-pin')?.classList.add('swipe'); });

  // Re-measure once the 3D hero has settled its pin height and fonts are in
  window.addEventListener('load', () => setTimeout(() => ScrollTrigger.refresh(), 400));
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
