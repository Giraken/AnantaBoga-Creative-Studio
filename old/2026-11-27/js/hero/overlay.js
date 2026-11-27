// UI overlay: staged text entrance, the swap from the static logo fallback to the live scene, and the
// scroll progress through the hero that drives the exit (the dragon loops away to the left, FORGED IN
// slides off left, LEGEND off right).
export function createOverlay(hero) {
  const fallback = hero.querySelector('.hero3d-fallback');
  const stageEl = hero.querySelector('.hero3d-stage');
  const stageWrap = hero.querySelector('.hero-stage-wrap');
  const pin = hero.closest('.hero-pin');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The fallback is sized from the real section height, which is clamped in CSS
  const measure = () => hero.style.setProperty('--hero-h', hero.clientHeight + 'px');
  measure();
  window.addEventListener('resize', measure);

  // Exit progress 0..1. On wide screens the hero is pinned (CSS) for a stretch of scrolling and the
  // exit plays across it; on phones it plays over the first ~60% of the stage scrolling away.
  let exit = 0;
  pin?.classList.add('is-live');
  const read = () => {
    if (reduce) return 0;
    const top = (pin || hero).getBoundingClientRect().top;
    const span = pin ? pin.offsetHeight - hero.offsetHeight : 0;
    const range = span > 40 ? span : stageWrap.offsetHeight * 0.6;
    return Math.min(1, Math.max(0, -top / range));
  };
  let enter = 0; // 1..0 while the HTML headline slides in (no-WebGL fallback only)
  const onScroll = () => {
    exit = read();
    // For the HTML copy of the headline and the still image (shown without WebGL)
    let words = Math.min(1, exit / 0.75);
    words = Math.max(words * words * (3 - 2 * words), enter);
    hero.style.setProperty('--exit', exit.toFixed(4));
    hero.style.setProperty('--words', words.toFixed(4));
  };
  // FORGED IN slides in from the left and LEGEND from the right
  const wordsIn = () => {
    if (reduce) return;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 1200);
      enter = Math.pow(1 - k, 3); onScroll();
      if (k < 1) requestAnimationFrame(step);
    };
    enter = 1; onScroll(); requestAnimationFrame(step);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // Text comes in on load whether or not WebGL is available
  requestAnimationFrame(() => hero.classList.add('is-in'));

  // The services list highlights one item at a time; hovering picks one
  const items = [...hero.querySelectorAll('.hero-services li')];
  let current = 0, timer = 0;
  const setActive = i => { items.forEach((li, k) => li.classList.toggle('is-active', k === i)); current = i; };
  const cycle = () => { clearInterval(timer); if (!reduce && items.length > 1) timer = setInterval(() => setActive((current + 1) % items.length), 3200); };
  items.forEach((li, i) => li.addEventListener('mouseenter', () => { setActive(i); cycle(); }));
  cycle();

  return {
    reduce,
    stageEl,
    exitProgress: () => exit,
    // Called once the scene has drawn its first frames
    showScene(canvas) {
      canvas.setAttribute('aria-hidden', 'true');
      hero.classList.add('has-scene');
      if (reduce) fallback.remove();
      else fallback.addEventListener('transitionend', () => fallback.remove(), { once: true });
    },
    // WebGL unavailable or the scene failed: keep the logo fallback in place
    keepFallback() { hero.classList.add('no-scene'); wordsIn(); },
  };
}
