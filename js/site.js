// Site motion: word-by-word statements, counters, the eye-pattern bands, the CUK*-ture title, the pinned
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

  // Packages: a pill switch between the three kinds of package (graduation, events, live streaming).
  // The cream thumb slides under the chosen tab and the new cards rise in. Without JS all three show.
  const tabs = [...document.querySelectorAll('.pkg-tab')];
  const thumb = document.querySelector('.pkg-thumb');
  const pricing = document.querySelector('.pricing');
  const placeThumb = () => {
    const t = tabs.find(x => x.classList.contains('is-active'));
    if (!t || !thumb) return;
    thumb.parentElement.style.setProperty('--tx', t.offsetLeft + 'px');
    thumb.parentElement.style.setProperty('--tw', t.offsetWidth + 'px');
  };
  const enter = pane => {
    if (!pane || !pricing?.classList.contains('is-in')) return;
    pane.classList.remove('is-entering'); void pane.offsetWidth; pane.classList.add('is-entering');
    clearTimeout(pane._t); pane._t = setTimeout(() => pane.classList.remove('is-entering'), 1300);
  };
  const showPkg = (tab, focus) => {
    tabs.forEach(t => {
      const on = t === tab, pane = document.getElementById(t.getAttribute('aria-controls'));
      t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      if (pane) { pane.hidden = !on; if (on) enter(pane); }
    });
    placeThumb();
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { if (!t.classList.contains('is-active')) showPkg(t); });
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); showPkg(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  if (tabs.length) {
    showPkg(tabs[0]);
    window.addEventListener('resize', placeThumb);
    document.fonts?.ready.then(placeThumb);
  }

  // Work: an accordion of the five kinds of film. Pointing at a strip (or clicking, tapping, or
  // pressing Enter on it) opens it; the open one shows its photo, what it is and what it includes.
  const accItems = [...document.querySelectorAll('.acc-item')];
  const openAcc = item => accItems.forEach(it => {
    const on = it === item;
    it.classList.toggle('is-open', on);
    it.querySelector('.acc-tab')?.setAttribute('aria-expanded', on);
  });
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let accTimer = 0;
  accItems.forEach(it => {
    it.querySelector('.acc-tab')?.addEventListener('click', () => openAcc(it));
    it.addEventListener('pointerenter', () => {
      if (!fine.matches || window.innerWidth <= 760) return;
      clearTimeout(accTimer); accTimer = setTimeout(() => openAcc(it), 90);
    });
    it.addEventListener('pointerleave', () => clearTimeout(accTimer));
  });

  // Split statements into words
  const statements = [...document.querySelectorAll('[data-words]')];
  statements.forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  });

  // Services: which panel (service name and copy) is showing
  const panels = [...document.querySelectorAll('.svc-panel')];
  const no = document.querySelector('[data-svc-no]');
  let cur = -1;
  const setSvc = i => {
    if (i === cur) return;
    cur = i;
    panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    if (no) no.textContent = String(i + 1).padStart(2, '0');
  };

  if (!motion) {
    statements.forEach(el => el.querySelectorAll('.w').forEach(w => w.classList.add('on')));
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  // Statements light up word by word as they come up the screen, and are fully lit by the time
  // they sit in view (their middle a little below the centre of the screen)
  // How much of a statement is lit, by scroll progress (top of the text from 96% down the screen to 29%).
  // Tuned by eye: about a third lit with its top 70% down, 17 of 27 words halfway, 23 at 35%, all at 29%.
  const LIT = [[0, 0], [0.388, 0.36], [0.687, 0.61], [0.91, 0.84], [1, 1]];
  const lit = p => {
    for (let i = 1; i < LIT.length; i++) {
      const [x0, y0] = LIT[i - 1], [x1, y1] = LIT[i];
      if (p <= x1) return y0 + (y1 - y0) * (p - x0) / (x1 - x0);
    }
    return 1;
  };
  statements.forEach(el => {
    const words = [...el.querySelectorAll('.w')];
    ScrollTrigger.create({
      trigger: el, start: 'top 96%', end: 'top 29%', scrub: true,
      onUpdate: self => {
        const p = self.progress, f = lit(p);
        const n = p > 0.97 ? words.length : Math.ceil(f * words.length);
        words.forEach((w, k) => w.classList.toggle('on', k < n));
      },
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
  gsap.utils.toArray('.about-shot, .about-copy, .contact-cols > div, .clients, .stats, .mf-top > div, .cuk li').forEach(el => {
    el.classList.add('reveal');
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-shown') });
  });
  // Images drift a little slower than the page
  gsap.utils.toArray('.about-shot img').forEach(img => {
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // The eye pattern bands drift a little with the scroll, on top of their slow CSS drift
  gsap.utils.toArray('.eye-band').forEach(band => {
    gsap.fromTo(band, { backgroundPositionY: '0px' }, { backgroundPositionY: '-140px', ease: 'none', scrollTrigger: { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // The CUK*-ture Supremacy lines slide in from opposite sides
  const mf = document.querySelector('.mf-title');
  if (mf) {
    gsap.fromTo(mf.querySelector('.mf-l1'), { xPercent: -18, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: mf, start: 'top 95%', end: 'center 60%', scrub: 0.6 } });
    gsap.fromTo(mf.querySelector('.mf-l2'), { xPercent: 18, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: mf, start: 'top 95%', end: 'center 60%', scrub: 0.6 } });
  }

  // Packages: the cards rise in the first time the section comes into view
  if (pricing) {
    ScrollTrigger.create({ trigger: pricing.querySelector('.pkg-intro') || pricing, start: 'top 70%', once: true, onEnter: () => {
      pricing.classList.add('is-in');
      enter(pricing.querySelector('.pkg-group:not([hidden])'));
    } });
  }

  // Services: a 3D fly-through. The section is pinned; scrolling moves a camera forward through the
  // three photos of each service, which hang in depth around the service name. The cards are plain
  // DOM elements with their own perspective, so no WebGL is needed; cards in front of the title
  // draw over it, cards behind it draw under it.
  const pin = document.querySelector('.svc-pin');
  const stage = document.querySelector('.svc-stage');
  const bar = document.querySelector('.svc-progress');
  const hint = document.querySelector('.svc-hint');
  // The photos come in waves of three: the hero's fifteen shots are five waves
  const shots = stage ? [...stage.querySelectorAll('.svc-shots img')] : [];
  if (pin && stage && shots.length) {
    const N = Math.ceil(shots.length / 3);
    const warp = document.createElement('div');
    warp.className = 'warp'; warp.setAttribute('aria-hidden', 'true');
    stage.prepend(warp);
    // Where each of a service's three shots hangs: angle round the title, distance out, size, tilt
    const SLOTS = [
      { a: -2.5, r: 1.0, w: 1.0, rot: -6, wide: false },
      { a: -0.45, r: 0.95, w: 0.86, rot: 5, wide: true },
      { a: 1.55, r: 1.05, w: 0.92, rot: -3, wide: false },
    ];
    const label = src => decodeURIComponent(src.split('/').pop().replace(/\.\w+$/, '')).replace(/[-_]+/g, ' ');
    const cards = [];
    shots.forEach((img, n) => {
      {
        const i = Math.floor(n / 3), k = n % 3;
        const slot = SLOTS[k];
        const fig = document.createElement('figure');
        fig.className = 'warp-card' + (slot.wide ? ' wide' : '');
        const im = document.createElement('img');
        im.src = img.getAttribute('src'); im.alt = ''; im.decoding = 'async';
        const cap = document.createElement('figcaption');
        cap.textContent = label(img.getAttribute('src'));
        fig.append(im, cap);
        warp.append(fig);
        // Turn each service's ring of shots a little so the five clusters don't line up
        cards.push({ el: fig, i, k, a: slot.a + i * 0.95, r: slot.r, w: slot.w * (slot.wide ? 1.25 : 1), rot: slot.rot, shown: false });
      }
    });

    const P = 1000;        // perspective, px
    const GAP = 1500;      // depth between one service and the next
    let target = 0, cam = 0, last = 0, raf = 0, live = false;
    let mx = 0, my = 0, px = 0, py = 0;
    let W = 0, H = 0, R = 0, RY = 0;
    const measure = () => {
      W = stage.clientWidth; H = stage.clientHeight;
      const base = Math.min(W, H);
      warp.style.setProperty('--cw', Math.round(Math.max(110, Math.min(300, base * (W < 700 ? 0.34 : 0.27)))) + 'px');
      R = W * (W < 700 ? 0.42 : 0.31); RY = H * (W < 700 ? 0.33 : 0.28);
    };
    measure();
    window.addEventListener('resize', measure);
    pin.addEventListener('pointermove', e => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; });

    const frame = now => {
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      cam += (target - cam) * (1 - Math.exp(-dt * 6));
      px += (mx - px) * (1 - Math.exp(-dt * 4)); py += (my - py) * (1 - Math.exp(-dt * 4));
      const t = now / 1000;
      for (const c of cards) {
        // Each service's cluster starts a GAP further away; its first shot reaches the title plane
        // as the camera gets a quarter of the way into that service
        const z = cam - (c.i * GAP + c.k * GAP / 3) - GAP * 0.25;
        const far = Math.min(1, Math.max(0, (z + 3600) / 1500));
        const near = Math.min(1, Math.max(0, (P * 0.8 - z) / (P * 0.35)));
        // Shots behind the title stay a little dimmer, so the front ones read as closer
        const o = far * near * (z < 0 ? 0.55 + 0.45 * Math.max(0, 1 + z / 1500) : 1);
        if (o <= 0.001) { if (c.shown) { c.el.style.visibility = 'hidden'; c.shown = false; } continue; }
        if (!c.shown) { c.el.style.visibility = 'visible'; c.shown = true; }
        const a = c.a + Math.sin(t * 0.25 + c.i + c.k) * 0.04;
        const x = Math.cos(a) * R * c.r - px * 60 * (1 + z / P);
        const y = Math.sin(a) * RY * c.r - py * 40 * (1 + z / P);
        c.el.style.width = 'calc(var(--cw) * ' + c.w + ')';
        c.el.style.transform = `translate(-50%, -50%) perspective(${P}px) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotate(${c.rot}deg)`;
        c.el.style.opacity = o.toFixed(3);
        c.el.style.zIndex = z > -60 ? 3 : 1;
      }
      if (panels.length > 1) setSvc(Math.max(0, Math.min(panels.length - 1, Math.floor(cam / GAP))));
      if (hint) hint.style.opacity = Math.max(0, 1 - cam / (GAP * 0.35)).toFixed(3);
      raf = live || Math.abs(target - cam) > 0.5 ? requestAnimationFrame(frame) : 0;
    };
    const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

    ScrollTrigger.create({
      trigger: pin, start: 'top top', end: () => '+=' + window.innerHeight * (N - 0.2), pin: true, invalidateOnRefresh: true,
      refreshPriority: 1, // measured first: everything below starts after its pinned stretch
      onUpdate: self => {
        bar?.style.setProperty('--p', self.progress.toFixed(3));
        // Run a little past the last service, so its shots fly off before the pin lets go
        target = self.progress * (N + 0.35) * GAP;
        run();
      },
      onToggle: self => { live = self.isActive; run(); },
    });
    // Keep the cards drifting while the section is on screen, even when the pin isn't active
    new IntersectionObserver(([e]) => { live = e.isIntersecting; if (live) run(); }).observe(pin);
    setSvc(0); run();
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

  // Re-measure whenever the page height changes after load (late fonts, images, the hero settling),
  // so pinned sections never start early and cover the content above them
  if ('ResizeObserver' in window) {
    let last = 0, timer = 0;
    new ResizeObserver(() => {
      const h = document.body.scrollHeight;
      if (Math.abs(h - last) < 2) return;
      last = h; clearTimeout(timer); timer = setTimeout(() => ScrollTrigger.refresh(), 200);
    }).observe(document.body);
  }
  // Re-measure once the 3D hero has settled its pin height and fonts are in
  // Measure in page order now that every trigger exists (the hero pin first), then again after load
  ScrollTrigger.sort(); ScrollTrigger.refresh();
  window.addEventListener('load', () => setTimeout(() => ScrollTrigger.refresh(), 400));
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
