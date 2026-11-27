// Surface detail for the dragon: procedural scale textures with per-scale variation, a wet clear-coat
// skin material, a rim + backlight-translucency finish, curved fangs, and lumpy skin geometry so the
// head is not built from perfect spheres. Everything is generated in code: no image files to load.
import * as THREE from 'three';

const smooth = THREE.MathUtils.smoothstep;
// Small deterministic hash and value noise (no Math.random, so every visit looks the same)
const hash = (a, b, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v),
    L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15;

// ---------- Scale textures ----------
// Overlapping keeled scales (the scale nearer the head lies on top). Each scale gets its own height,
// tone and gloss, so the tiling never reads as a printed pattern. Returns normal, colour (with the
// cavities darkened) and roughness maps that tile.
export function scaleMaps(size = 512) {
  const cols = 6, rows = 4, w = size / cols, h = size / rows, rho = w * 0.86;
  const height = new Float32Array(size * size), tone = new Float32Array(size * size), gloss = new Float32Array(size * size);
  const wrap = (v, m) => ((v % m) + m) % m;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let found = false, bestD = 0, ky = 0, id = 0;
      const c0 = Math.floor(x / w);
      for (let c = c0 + 1; c >= c0 - 1 && !found; c--) {
        const cx = c * w, off = (wrap(c, cols) & 1) * 0.5, r0 = Math.round(y / h - off);
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          let dx = x - cx, dy = y - (r + off) * h;
          dx = wrap(dx + size / 2, size) - size / 2; dy = wrap(dy + size / 2, size) - size / 2;
          const d = Math.hypot(dx, dy) / rho;
          if (d < 1 && dx <= rho * 0.3) { found = true; bestD = d; ky = dy / rho; id = hash(wrap(c, cols), wrap(r, rows)); break; }
        }
      }
      const i = y * size + x, rnd = found ? id : 0.5;
      const dome = found ? Math.pow(1 - bestD * bestD, 0.6) * (0.85 + rnd * 0.3) : 0;
      // A low ridge (keel) down the middle of each scale, fading toward its edge
      const keel = found ? 0.16 * Math.max(0, 1 - Math.abs(ky) / 0.22) * smooth(bestD, 0.95, 0.2) : 0;
      // Fine pitting and wear across the surface
      const pit = (noise3(x * 0.35, y * 0.35, 3.1) - 0.5) * 0.05;
      height[i] = dome + keel + pit;
      tone[i] = 0.86 + rnd * 0.26 + (noise3(x * 0.05, y * 0.05, 9) - 0.5) * 0.12;
      gloss[i] = rnd;
    }
  }
  const nrm = new Uint8Array(size * size * 4), col = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  const H = (x, y) => height[wrap(y, size) * size + wrap(x, size)];
  const k = 3.2 * size / 256;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k;
      const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4, p = y * size + x;
      nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
      const edge = Math.min(1, Math.hypot(dx, dy) * 1.2 / (size / 256));
      const v = Math.max(0, Math.min(1, (0.3 + 0.7 * H(x, y) - edge * 0.6) * tone[p])) * 255;
      col[i] = col[i + 1] = col[i + 2] = v; col[i + 3] = 255;
      // Raised scale tops are polished, the cracks between them dull
      const r = Math.max(0.12, Math.min(1, 0.3 + 0.45 * (1 - H(x, y)) + edge * 0.25 + (gloss[p] - 0.5) * 0.16));
      rough[i] = rough[i + 1] = rough[i + 2] = r * 255; rough[i + 3] = 255;
    }
  }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  };
  return { normal: make(nrm, false), color: make(col, true), rough: make(rough, false) };
}

// ---------- Finish: rim light and translucency ----------
// rim: a light Fresnel edge that outlines the silhouette on the dark page. trans: light from behind
// shows through thin parts (fins, mane, membranes), tinted by their own colour.
export function finish(m, { rim = 0, tint = [0.36, 0.36, 0.36], trans = 0 } = {}) {
  m.onBeforeCompile = shader => {
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uTint = { value: new THREE.Vector3(...tint) };
    shader.uniforms.uTrans = { value: trans };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uTint;\nuniform float uTrans;')
      .replace('#include <opaque_fragment>', `
        vec3 vdir = normalize(vViewPosition);
        float fres = pow(1.0 - saturate(dot(normal, vdir)), 2.6);
        outgoingLight += uTint * fres * uRim;
        #if NUM_DIR_LIGHTS > 0
        if (uTrans > 0.0) {
          for (int li = 0; li < NUM_DIR_LIGHTS; li++) {
            float back = pow(saturate(dot(-vdir, directionalLights[li].direction)), 3.0);
            float thin = 0.35 + 0.65 * fres;
            outgoingLight += diffuseColor.rgb * directionalLights[li].color * back * thin * uTrans;
          }
        }
        #endif
        #include <opaque_fragment>`);
  };
  return m;
}

// ---------- Scaled skin ----------
// Wet reptile skin: scale textures, a thin clear coat that catches sharp highlights over the duller
// scale surface, and the rim finish
export function skinMaterial(maps, { repeat = [1, 1], color = '#ffffff', rim = 0.75, vertexColors = false, normal = 1.5,
  metalness = 0.35, roughness = 1, clearcoat = 0.4, clearcoatRoughness = 0.32, envMapIntensity = 0.6 } = {}) {
  const tex = t => { const c = t.clone(); c.repeat.set(...repeat); c.needsUpdate = true; return c; };
  return finish(new THREE.MeshPhysicalMaterial({
    color, map: tex(maps.color), normalMap: tex(maps.normal), roughnessMap: tex(maps.rough),
    normalScale: new THREE.Vector2(normal, normal), metalness, roughness, envMapIntensity, vertexColors,
    clearcoat, clearcoatRoughness,
  }), { rim });
}

// ---------- Geometry ----------
// A unit sphere whose surface has soft lumps, folds and wrinkles (for the skull, brows, jowls)
export function lumpySphere(seg, amount = 0.045) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const lump = (fbm(v.x * 2.2 + 5, v.y * 2.2, v.z * 2.2) - 0.5) * 2;
    const wrinkle = Math.sin(v.z * 22 + fbm(v.x * 3, v.y * 3, v.z * 3) * 6) * 0.25;
    v.multiplyScalar(1 + amount * (lump + wrinkle));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// A fang: round at the base, curving back slightly and tapering to a sharp point. Same footprint as
// ConeGeometry(1, 1): base radius 1 at y = -0.5, tip at y = 0.5, so it drops in where a cone was.
export function fangGeometry(radial = 12, segs = 10, curve = 0.14) {
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t - 0.5, r = Math.pow(1 - t, 0.75) * (1 - 0.15 * t), z = curve * t * t;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a);
      pos.push(cx * r, y, z + sz * r); nor.push(cx, 0.45, sz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
