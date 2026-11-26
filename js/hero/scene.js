// Scene: renderer, camera, the double orange ring, lights, bloom, intro timeline, the poster
// planes (grid and headline), pointer tilt and eye tracking, and the scroll exit (the dragon loops
// away to the left while FORGED IN slides off left and LEGEND off right).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createDragon } from './dragon.js';
import { createDragon as createClassicDragon } from './dragon-classic.js'; // previous ring-coiled dragon, kept but hidden (?dragon=classic)
import { createParticles } from './particles.js';
import { createPoster } from './poster.js';

const ORANGE = new THREE.Color('#F7991F');
const BLOOM = 1; // layer for the glowing parts: ring, eyes, clouds
const DIST = 12, FOV = 30;
const NEED = 8.2; // world size of the whole dragon and ring, fitted to the .dragon-anchor box
const BASE_TILT = { x: 0.1, y: -0.3 };

// A ring built as a tube so its index order runs around the circle: drawRange draws it in
function ring(radius, thickness, glow, segs = 320) {
  const curve = new THREE.Curve();
  curve.getPoint = (t, out = new THREE.Vector3()) => out.set(Math.cos(t * Math.PI * 2 + Math.PI / 2) * radius, Math.sin(t * Math.PI * 2 + Math.PI / 2) * radius, 0);
  const geo = new THREE.TubeGeometry(curve, segs, thickness, 8, true);
  const mat = new THREE.MeshBasicMaterial({ color: ORANGE.clone().multiplyScalar(glow), toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.total = geo.index.count;
  mesh.layers.enable(BLOOM);
  return mesh;
}

// exit(): 0..1 scroll progress through the hero (0 at the top of the page)
export function startScene(host, { lite = false, still = false, root = host.parentElement, exit = () => 0 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: !lite, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // The camera stays put so the poster planes line up with the HTML panels; parallax tilts the dragon
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, DIST); camera.lookAt(0, 0, 0);

  // Lights: cool key from upper left, light-gray rims from behind, orange practicals from ring and eyes
  scene.add(new THREE.HemisphereLight(0xbfbfbf, 0x000000, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 5, 6); scene.add(key);
  const rimA = new THREE.DirectionalLight(0xa0a0a0, 3.4); rimA.position.set(5, 3, -6); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0xa0a0a0, 1.6); rimB.position.set(-6, -2, -5); scene.add(rimB);
  const ringLight = new THREE.PointLight(ORANGE, 0, 9, 1.6); ringLight.position.set(0, -1.2, 1.4);
  const eyeLight = new THREE.PointLight(ORANGE, 0, 2.4, 2);

  const stage = new THREE.Group(); scene.add(stage);
  const outer = ring(2.0, 0.022, 1.15), inner = ring(2.17, 0.009, 0.9);
  // Orange from the ring onto the underside of the body and claws
  const underLight = new THREE.PointLight(ORANGE, 3, 7, 1.6); underLight.position.set(0.6, -2.3, 0.9);
  stage.add(outer, inner, ringLight, underLight);

  const classic = new URLSearchParams(location.search).get('dragon') === 'classic';
  const dragon = (classic ? createClassicDragon : createDragon)({ lite });
  stage.add(dragon.group);
  dragon.eyes[0].add(eyeLight);
  dragon.eyes.forEach(e => e.layers.enable(BLOOM));
  stage.rotation.set(BASE_TILT.x, BASE_TILT.y, 0);

  const particles = still ? null : createParticles({ clusters: lite ? 4 : 7 });
  if (particles) { particles.points.layers.enable(BLOOM); stage.add(particles.points); }

  const poster = createPoster({ scene, host, root, dist: DIST, fov: FOV });

  // Selective bloom: a pass renders only the glowing parts (everything else drawn black so the
  // dragon and the headline still hide what is behind them), then that glow is added over the render.
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), lite ? 0.55 : 0.62, 0.38, 0);
  bloomComposer.addPass(bloom);

  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: lite ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const mix = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture, vUv) + vec4(texture2D(bloomTexture, vUv).rgb, 0.0); }',
  }), 'baseTexture');
  mix.needsSwap = true;
  composer.addPass(mix);
  composer.addPass(new OutputPass());

  const blackout = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const blackoutCut = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, alphaTest: 0.5 });
  const bloomLayer = new THREE.Layers(); bloomLayer.set(BLOOM);
  const saved = new Map();
  const darken = o => {
    if (o.isMesh && !bloomLayer.test(o.layers)) {
      saved.set(o, o.material);
      // The headline keeps its letter shapes (alpha) so glow shows between the letters
      if (o.material.alphaTest > 0 && o.material.map) { blackoutCut.map = o.material.map; o.material = blackoutCut; }
      else o.material = blackout;
    }
  };
  const restore = () => { for (const [o, m] of saved) o.material = m; saved.clear(); };
  function renderFrame() {
    scene.traverse(darken);
    const env = scene.environment; scene.environment = null;
    bloomComposer.render();
    scene.environment = env;
    restore();
    composer.render();
  }

  // Framing: CSS places an invisible .dragon-anchor box; the dragon is fitted into it
  const anchor = root.querySelector('.dragon-anchor');
  let w = 1, h = 1, s = 1;
  function resize() {
    const box = host.getBoundingClientRect();
    w = box.width || 1; h = box.height || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloomComposer.setSize(w * (lite ? 0.5 : 1), h * (lite ? 0.5 : 1));
    bloom.resolution.set(w * (lite ? 0.5 : 1), h * (lite ? 0.5 : 1));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2)), viewW = viewH * camera.aspect;
    const a = anchor ? anchor.getBoundingClientRect() : { left: box.left, top: box.top, width: w, height: h };
    const cx = (a.left - box.left + a.width / 2) / w, cy = (a.top - box.top + a.height / 2) / h;
    s = Math.min(a.width / w * viewW, a.height / h * viewH) / NEED;
    stage.position.set((cx - 0.5) * viewW, (0.5 - cy) * viewH, 0);
    stage.scale.setScalar(s);
    // Resizing clears the canvas; the still (reduced-motion) pose has no loop, so draw it again
    if (still) requestAnimationFrame(() => render(0, 9));
  }
  let posterTimer = 0;
  const rebuildPoster = () => { clearTimeout(posterTimer); posterTimer = setTimeout(() => poster.rebuild().then(() => { if (still) render(0, 9); }), 120); };

  // ---- Pointer: the head turns a little, the eyes follow the cursor ----
  const look = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  let active = false, lastTap = -1e9;
  const setAim = e => {
    const r = host.getBoundingClientRect();
    aim.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.2, 1.2);
    aim.y = THREE.MathUtils.clamp(-(((e.clientY - r.top) / r.height) * 2 - 1), -1.2, 1.2);
  };
  if (!still) {
    window.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; setAim(e); active = true; }, { passive: true });
    window.addEventListener('pointerdown', e => { setAim(e); active = true; if (e.pointerType === 'touch') lastTap = performance.now(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { active = false; });
    window.addEventListener('blur', () => { active = false; });
  }
  const ray = new THREE.Vector3(), eyeTarget = new THREE.Vector3();
  function updateAim(t) {
    // Touch: follow the last tap for a few seconds, then a slow idle look-around
    if (coarse && performance.now() - lastTap > 3000) {
      active = true;
      aim.x = Math.sin(t * 0.35) * 0.7; aim.y = Math.sin(t * 0.23 + 1) * 0.4;
    }
    const tx = active ? aim.x : 0, ty = active ? aim.y : 0;
    look.x += (tx - look.x) * 0.05; look.y += (ty - look.y) * 0.05;
    if (active) {
      // Cast from the camera through the cursor onto a plane in front of the dragon
      ray.set(aim.x, aim.y, 0.5).unproject(camera).sub(camera.position).normalize();
      eyeTarget.copy(camera.position).addScaledVector(ray, (4 - camera.position.z) / ray.z);
    } else {
      eyeTarget.copy(camera.position); // look back at the viewer
    }
  }

  // Intro: ring draws in (0-0.9s), the dragon rises from below the frame and coils round the ring into
  // place (0.3-3.7s), eyes ignite as it settles (3.1-3.7s). The previous dragon coiled in faster.
  const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  const ease = x => 1 - Math.pow(1 - x, 3);
  const T_ARRIVE = classic ? [0.4, 2.0] : [0.3, 3.7], T_EYES = classic ? [2.0, 2.5] : [3.1, 3.7];
  // Scroll exit, eased toward the scroll position so wheel steps don't jerk it
  let leave = still ? 0 : exit(), lastT = 0;
  let sized = '';
  function render(t, introT) {
    // Keep camera and poster in step with the stage size, however it changed
    const r = host.getBoundingClientRect(), key = Math.round(r.width) + 'x' + Math.round(r.height);
    if (key !== sized) { sized = key; resize(); }
    if (poster.stale()) poster.rebuild();
    const ringP = ease(seg(introT, 0, 0.9));
    for (const r of [outer, inner]) {
      const per = 8 * 6, n = Math.floor((r.userData.total / per) * ringP) * per;
      r.geometry.setDrawRange(0, n);
    }
    const arrive = seg(introT, ...T_ARRIVE), eyes = ease(seg(introT, ...T_EYES));
    const dt = THREE.MathUtils.clamp(t - lastT, 0, 0.1); lastT = t;
    if (!still) leave += (exit() - leave) * (1 - Math.exp(-dt * 7));
    if (Math.abs(leave) < 1e-4) leave = 0;
    // The headline clears out over the first three quarters of the scroll, the dragon over all of it
    const words = still ? 0 : THREE.MathUtils.smoothstep(leave / 0.75, 0, 1);
    poster.slide(words);
    if (!still) updateAim(t); else eyeTarget.copy(camera.position);
    // Parallax: the dragon and ring tilt a few degrees with the pointer
    stage.rotation.y = BASE_TILT.y + look.x * 0.1;
    stage.rotation.x = BASE_TILT.x - look.y * 0.07;
    dragon.update(t, arrive, look, still, eyeTarget, active ? aim : null, leave);
    dragon.setEyes(eyes);
    eyeLight.intensity = eyes * 1.4;
    ringLight.intensity = ringP * 2.2;
    if (particles) particles.update(t, ease(seg(introT, 1.2, classic ? 2.5 : 3.2)), s * renderer.getPixelRatio() * (h / 900));
    renderFrame();
  }

  let raf = 0, running = false, start = 0, visible = true;
  const loop = now => {
    if (!start) start = now;
    const t = (now - start) / 1000;
    render(t, t);
    raf = requestAnimationFrame(loop);
  };
  const play = () => { if (!running && !still && visible && !document.hidden) { running = true; raf = requestAnimationFrame(loop); } };
  const pause = () => { running = false; cancelAnimationFrame(raf); };

  // Any change to the stage size (window, orientation, layout) re-fits the camera and repaints the poster
  let lastSize = '';
  new ResizeObserver(() => {
    const r = host.getBoundingClientRect(), key = Math.round(r.width) + 'x' + Math.round(r.height);
    if (key === lastSize) return;
    lastSize = key; resize(); rebuildPoster();
  }).observe(host);
  resize();

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); });
  io.observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  const ready = poster.rebuild().then(() => {
    if (still) render(0, 9); // final pose, eyes lit, no particles
    else play();
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  return { canvas: renderer.domElement, ready };
}
