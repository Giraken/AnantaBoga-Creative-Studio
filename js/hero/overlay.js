// UI overlay: staged text entrance and the swap from the static logo fallback to the live scene.
export function createOverlay(hero) {
  const fallback = hero.querySelector('.hero3d-fallback');
  const stageEl = hero.querySelector('.hero3d-stage');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The fallback is sized from the real section height, which is clamped in CSS
  const measure = () => hero.style.setProperty('--hero-h', hero.clientHeight + 'px');
  measure();
  window.addEventListener('resize', measure);

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
    // Called once the scene has drawn its first frames
    showScene(canvas) {
      canvas.setAttribute('aria-hidden', 'true');
      hero.classList.add('has-scene');
      if (reduce) fallback.remove();
      else fallback.addEventListener('transitionend', () => fallback.remove(), { once: true });
    },
    // WebGL unavailable or the scene failed: keep the logo fallback in place
    keepFallback() { hero.classList.add('no-scene'); },
  };
}
