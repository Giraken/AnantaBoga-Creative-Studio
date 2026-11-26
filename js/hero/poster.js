// Poster planes: the editorial grid and the "FORGED IN / LEGEND" headline are painted from the real
// HTML layout into textures that live inside the 3D scene. That lets the dragon sit in front of some
// letters and behind others, while CSS still decides where everything goes at every width. Each headline
// line (.ph-row, with its orange block) is its own plane, so on scroll FORGED IN can slide off to the
// left and LEGEND off to the right.
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
  // One plane per headline row: x = where CSS put it, dir = which way it leaves (-1 left, +1 right)
  const rowEls = [...root.querySelectorAll('.ph-row')];
  const rows = rowEls.map((el, k) => ({ el, mesh: mk(fgZ, { transparent: true, alphaTest: 0.5 }), x: 0, away: 0, dir: k === 0 ? -1 : 1 }));

  const canvasFor = (w, h, dpr) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); return c; };
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

  // One headline row: its orange block, the line in white, and black where the line crosses the block.
  // Painted into a canvas just big enough for the row (with room for the glyphs that overhang the line box).
  function paintRow(row, dpr, box) {
    const blockEl = row.querySelector('.poster-block'), lineEl = row.querySelector('.ph-line');
    const cs = getComputedStyle(lineEl), lr = rel(lineEl, box);
    const block = blockEl ? { ...rel(blockEl, box), color: getComputedStyle(blockEl).backgroundColor } : null;
    const pad = parseFloat(cs.fontSize) * 0.3;
    const x0 = Math.floor(Math.min(lr.x, block ? block.x : lr.x) - pad), y0 = Math.floor(Math.min(lr.y, block ? block.y : lr.y) - pad);
    const x1 = Math.ceil(Math.max(lr.x + lr.w, block ? block.x + block.w : -1e9) + pad), y1 = Math.ceil(Math.max(lr.y + lr.h, block ? block.y + block.h : -1e9) + pad);
    const c = canvasFor(x1 - x0, y1 - y0, dpr), g = c.getContext('2d');
    g.scale(dpr, dpr); g.translate(-x0, -y0);
    if (block && block.w > 0 && block.h > 0) { g.fillStyle = block.color; g.fillRect(block.x, block.y, block.w, block.h); }
    const text = cs.textTransform === 'uppercase' ? lineEl.textContent.toUpperCase() : lineEl.textContent;
    const drawLine = color => {
      g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      if ('fontStretch' in g) g.fontStretch = STRETCH[cs.fontStretch] || 'normal';
      if ('letterSpacing' in g) g.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      g.textBaseline = 'alphabetic';
      const m = g.measureText(text), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
      // Fit the line to the width the browser actually laid it out at (covers canvases that
      // ignore fontStretch), so the painted headline lines up with the HTML one exactly
      const sx = m.width > 0 ? lr.w / m.width : 1;
      g.save(); g.translate(lr.x, 0); g.scale(sx, 1);
      g.fillStyle = color;
      g.fillText(text, 0, lr.y + (lr.h - (asc + desc)) / 2 + asc);
      g.restore();
    };
    drawLine('#ffffff');
    if (block) { g.save(); g.beginPath(); g.rect(block.x, block.y, block.w, block.h); g.clip(); drawLine('#000000'); g.restore(); }
    // How far the row travels to clear the frame: its own width plus the page margin (as in the CSS)
    const rowBox = rel(row, box);
    return { canvas: c, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, away: rowBox.w + Math.max(0, rowBox.x) };
  }

  const worldPerPx = (z, h) => 2 * (dist - z) * Math.tan(THREE.MathUtils.degToRad(fov / 2)) / h;
  let ready = false, builtFor = '', busy = false, slid = 0, scaleFg = 1;
  const sizeKey = () => { const r = host.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
  const texture = canvas => { const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex; };
  const setMap = (mesh, tex) => { mesh.material.map?.dispose(); mesh.material.map = tex; mesh.material.needsUpdate = true; mesh.visible = true; };
  async function rebuild() {
    if (busy) return;
    busy = true;
    try { await document.fonts.ready; } catch { /* draw with what we have */ }
    const box = host.getBoundingClientRect(), w = box.width, h = box.height;
    if (!w || !h) { busy = false; return; }
    builtFor = sizeKey();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Measure the layout as CSS places it, without the scroll slide
    root.classList.add('is-measuring');
    setMap(bg, texture(paintBg(w, h, dpr, box)));
    let k = worldPerPx(bgZ, h); bg.scale.set(w * k, h * k, 1);
    k = scaleFg = worldPerPx(fgZ, h);
    for (const row of rows) {
      const { canvas, rect, away } = paintRow(row.el, dpr, box);
      setMap(row.mesh, texture(canvas));
      row.mesh.scale.set(rect.w * k, rect.h * k, 1);
      row.x = (rect.x + rect.w / 2 - w / 2) * k;
      row.mesh.position.y = (h / 2 - (rect.y + rect.h / 2)) * k;
      row.away = away;
    }
    root.classList.remove('is-measuring');
    ready = true; busy = false;
    slide(slid);
  }
  // amount 0..1: rows slide out sideways, FORGED IN to the left and LEGEND to the right
  function slide(amount) {
    slid = amount;
    for (const row of rows) row.mesh.position.x = row.x + row.dir * row.away * amount * scaleFg;
  }
  // True when the stage has changed size since the poster was last painted
  const stale = () => ready && !busy && sizeKey() !== builtFor;
  return { rebuild, stale, slide, get ready() { return ready; } };
}
