// Poster planes: the editorial grid and the "FORGED IN / LEGEND" headline are painted from the real
// HTML layout into two textures that live inside the 3D scene. That lets the dragon sit in front of
// some letters and behind others, while CSS still decides where everything goes at every width.
import * as THREE from 'three';

const STRETCH = { '50%': 'ultra-condensed', '62.5%': 'extra-condensed', '75%': 'condensed', '87.5%': 'semi-condensed', '100%': 'normal' };

export function createPoster({ scene, host, root, dist, fov, bgZ = -4.5, fgZ = -0.12 }) {
  const mk = (z, opts) => {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, ...opts });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = z; mesh.visible = false; scene.add(mesh);
    return mesh;
  };
  const bg = mk(bgZ, { depthWrite: false });
  bg.renderOrder = -10;
  const fg = mk(fgZ, { transparent: true, alphaTest: 0.5 });

  const canvasFor = (w, h, dpr) => { const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); return c; };
  const rel = (el, box) => { const r = el.getBoundingClientRect(); return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height }; };

  function paintBg(w, h, dpr, box) {
    const c = canvasFor(w, h, dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (const el of root.querySelectorAll('.pg-circle')) {
      const r = rel(el, box), cs = getComputedStyle(el);
      if (r.w < 2) continue; // hidden at this width
      g.strokeStyle = cs.borderTopColor; g.lineWidth = parseFloat(cs.borderTopWidth) || 1;
      g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, Math.max(0, r.w / 2 - g.lineWidth / 2), 0, Math.PI * 2); g.stroke();
    }
    for (const el of root.querySelectorAll('.pg-line')) {
      const r = rel(el, box);
      if (!r.w && !r.h) continue;
      g.fillStyle = getComputedStyle(el).backgroundColor; g.fillRect(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h));
    }
    return c;
  }

  function paintFg(w, h, dpr, box) {
    const c = canvasFor(w, h, dpr), g = c.getContext('2d');
    g.scale(dpr, dpr);
    const blocks = [...root.querySelectorAll('.poster-block')].map(el => ({ ...rel(el, box), color: getComputedStyle(el).backgroundColor })).filter(b => b.w > 0 && b.h > 0);
    for (const b of blocks) { g.fillStyle = b.color; g.fillRect(b.x, b.y, b.w, b.h); }
    const lines = [...root.querySelectorAll('.ph-line')].map(el => {
      const cs = getComputedStyle(el), r = rel(el, box);
      return { r, text: cs.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent, cs };
    }).filter(l => l.r.w > 0);
    const drawLines = color => {
      for (const { r, text, cs } of lines) {
        g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if ('fontStretch' in g) g.fontStretch = STRETCH[cs.fontStretch] || 'normal';
        if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
        g.textBaseline = 'alphabetic';
        const m = g.measureText(text), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
        // Fit each line to the width the browser actually laid it out at (covers canvases that
        // ignore fontStretch), so the painted headline lines up with the HTML one exactly
        const sx = m.width > 0 ? r.w / m.width : 1;
        g.save(); g.translate(r.x, 0); g.scale(sx, 1);
        g.fillStyle = color;
        g.fillText(text, 0, r.y + (r.h - (asc + desc)) / 2 + asc);
        g.restore();
      }
    };
    drawLines('#ffffff');
    // Where the headline crosses an orange block, the letters turn black
    for (const b of blocks) { g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip(); drawLines('#000000'); g.restore(); }
    return c;
  }

  const fit = (mesh, z, aspect) => {
    const d = dist - z, viewH = 2 * d * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    mesh.scale.set(viewH * aspect, viewH, 1);
  };

  let ready = false, builtFor = '', busy = false;
  const sizeKey = () => { const r = host.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
  async function rebuild() {
    if (busy) return;
    busy = true;
    try { await document.fonts.ready; } catch { /* draw with what we have */ }
    const box = host.getBoundingClientRect(), w = box.width, h = box.height;
    if (!w || !h) { busy = false; return; }
    builtFor = sizeKey();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const [mesh, paint, z] of [[bg, paintBg, bgZ], [fg, paintFg, fgZ]]) {
      const tex = new THREE.CanvasTexture(paint(w, h, dpr, box));
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      mesh.material.map?.dispose();
      mesh.material.map = tex; mesh.material.needsUpdate = true;
      fit(mesh, z, w / h);
      mesh.visible = true;
    }
    ready = true; busy = false;
  }
  // True when the stage has changed size since the poster was last painted
  const stale = () => ready && !busy && sizeKey() !== builtFor;
  return { rebuild, stale, get ready() { return ready; } };
}
