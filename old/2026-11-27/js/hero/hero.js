// Entry point for the 3D hero. Shows the static logo first, then lazy-loads Three.js and the scene
// once the page has loaded and the browser is idle.
import { createOverlay } from './overlay.js';

const hero = document.querySelector('.hero3d');
if (hero) {
  // ?capture hides the copy so a clean still of the dragon can be saved as the fallback image
  if (new URLSearchParams(location.search).has('capture')) hero.classList.add('is-capture');
  const overlay = createOverlay(hero);
  const lite = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  // Which dragon to show: 'gray' (default, the brand-gray version), 'gold' or 'classic'.
  // Change DRAGON here to switch for good, or add ?dragon=gold to the address to try one.
  const DRAGON = 'gray';
  const variant = new URLSearchParams(location.search).get('dragon') || DRAGON;

  const supportsWebGL = () => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch { return false; }
  };

  const boot = async () => {
    if (!supportsWebGL()) return overlay.keepFallback();
    try {
      const { startScene } = await import('./scene.js');
      const scene = startScene(overlay.stageEl, { lite, still: overlay.reduce, exit: overlay.exitProgress, variant });
      await scene.ready;
      overlay.showScene(scene.canvas);
      // Start the intro once the canvas has faded in over the still image
      setTimeout(scene.begin, overlay.reduce ? 0 : 700);
    } catch (err) {
      console.warn('3D hero unavailable, keeping the static image.', err && (err.name + ': ' + err.message + ' ' + (err.stack || '')));
      overlay.keepFallback();
    }
  };

  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
  const later = () => idle(boot, { timeout: 1500 });
  document.readyState === 'complete' ? later() : window.addEventListener('load', later, { once: true });
}
