// The imperial dragon (Anantaboga) in a double-looping S threaded through the ring. Built like the logo: a heavy scaled body coiled
// around the ring, a scowling roaring head with beard and mane, and two clawed front legs
// (one raised toward the viewer, one gripping the ring). The body skin and the legs are
// re-solved every frame so breathing, coiling and the load-in are real geometry.
import * as THREE from 'three';

const ORANGE = new THREE.Color('#F7991F');
const GRAY = new THREE.Color('#7A7A7A');
const LIGHT_GRAY = new THREE.Color('#A0A0A0');
const BONE = new THREE.Color('#E8E2D6');
const smooth = THREE.MathUtils.smoothstep;

// ---------- Engraved scale texture: height -> normal map + cavity (AO) map ----------
function scaleMaps(size = 256) {
  const cols = 6, rows = 4, w = size / cols, h = size / rows, rho = w * 0.86;
  const height = new Float32Array(size * size);
  const wrap = (v, m) => ((v % m) + m) % m;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let found = false, bestD = 0;
      const c0 = Math.floor(x / w);
      // The scale nearer the head lies on top, so each crescent edge stays visible
      for (let c = c0 + 1; c >= c0 - 1 && !found; c--) {
        const cx = c * w, off = (wrap(c, cols) & 1) * 0.5, r0 = Math.round(y / h - off);
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          let dx = x - cx, dy = y - (r + off) * h;
          dx = wrap(dx + size / 2, size) - size / 2; dy = wrap(dy + size / 2, size) - size / 2;
          const d = Math.hypot(dx, dy) / rho;
          if (d < 1 && dx <= rho * 0.3) { found = true; bestD = d; break; }
        }
      }
      const dome = found ? Math.pow(1 - bestD * bestD, 0.6) : 0;
      // Engraved hatching across each scale, denser toward its edge, like the logo
      const hatch = 0.07 * Math.sin((x * 0.8 + y * 0.45) * 1.1) * smooth(bestD, 0.35, 0.95);
      height[y * size + x] = dome + hatch;
    }
  }
  const nrm = new Uint8Array(size * size * 4), cav = new Uint8Array(size * size * 4);
  const H = (x, y) => height[wrap(y, size) * size + wrap(x, size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2, dy = (H(x, y + 1) - H(x, y - 1)) * 3.2;
      const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
      const edge = Math.min(1, Math.hypot(dx, dy) * 1.2);
      const v = Math.max(0, Math.min(1, 0.32 + 0.68 * H(x, y) - edge * 0.55)) * 255;
      cav[i] = cav[i + 1] = cav[i + 2] = v; cav[i + 3] = 255;
    }
  }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true; return t;
  };
  return { normal: make(nrm, false), cavity: make(cav, true) };
}

// Matte dark metal with a strong light-gray rim that outlines the silhouette on black
function rimify(m, rim) {
  m.onBeforeCompile = shader => {
    shader.uniforms.uRim = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;')
      .replace('#include <opaque_fragment>',
        'float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.6);\n' +
        'outgoingLight += vec3(0.36) * fres * uRim;\n#include <opaque_fragment>');
  };
  return m;
}
function scaleMaterial(maps, { repeat = [1, 1], color = '#ffffff', rim = 0.75, vertexColors = false, normal = 1.5 } = {}) {
  const normalMap = maps.normal.clone(); normalMap.repeat.set(...repeat); normalMap.needsUpdate = true;
  const map = maps.cavity.clone(); map.repeat.set(...repeat); map.needsUpdate = true;
  return rimify(new THREE.MeshStandardMaterial({
    color, map, normalMap, normalScale: new THREE.Vector2(normal, normal),
    metalness: 0.5, roughness: 0.68, envMapIntensity: 0.4, vertexColors, transparent: true,
  }), rim);
}

// A static tube with a radius function along its length (horns, whiskers, talons, tongue)
function sweep(points, radius, segs = 24, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); nor.push(n.x, n.y, n.z); uv.push(t * 3, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
const taper = (r0, r1, ridges = 0) => t => THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.85)) * (1 + (ridges ? 0.12 * Math.max(0, Math.sin(t * ridges * Math.PI * 2)) : 0));

// A pointed hair tuft, dragon gray at the root to light gray at the tip (beard and mane)
function tuftGeometry(radial, flame = false) {
  const g = new THREE.ConeGeometry(1, 1, radial, flame ? 8 : 3);
  g.translate(0, 0.5, 0);
  if (flame) { // curl back and flick at the tip, like a flame tendril
    const fp = g.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); fp.setZ(i, fp.getZ(i) - 0.9 * y * y + 0.35 * Math.sin(y * Math.PI) * y); }
    g.computeVertexNormals();
  }
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(GRAY).multiplyScalar(0.55).lerp(LIGHT_GRAY.clone().multiplyScalar(0.85), smooth(p.getY(i), 0.6, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------- Head ----------
function buildHead(mats, lite) {
  const head = new THREE.Group();
  const SEG = lite ? 16 : 26;
  const sphere = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.7));
  const add = (parent, geo, mat, s, p, r = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...p); m.rotation.set(...r); parent.add(m); return m;
  };
  const blob = (s, p, r, mat = mats.skin, parent = head) => add(parent, sphere, mat, s, p, r);

  // Skull, jowls, long snout and flat nose pad (forward is +Z, up is +Y)
  blob([0.2, 0.2, 0.26], [0, 0.0, -0.2]);   // nape and throat: blends the skull into the neck
  blob([0.17, 0.17, 0.22], [0, -0.03, -0.38]);
  blob([0.27, 0.22, 0.3], [0, 0.05, -0.03]);
  blob([0.24, 0.16, 0.22], [0, -0.04, 0.05]);
  blob([0.15, 0.1, 0.32], [0, 0.02, 0.33]);
  blob([0.115, 0.05, 0.075], [0, 0.05, 0.6]);
  // Wrinkled snout: ridges across the bridge
  for (let k = 0; k < 4; k++) blob([0.13 - k * 0.01, 0.02, 0.026], [0, 0.112 - k * 0.006, 0.2 + k * 0.08], [0.1, 0, 0]);
  // Flared nostrils
  const ring = new THREE.TorusGeometry(1, 0.42, 8, lite ? 10 : 16);
  for (const s of [-1, 1]) {
    blob([0.033, 0.022, 0.045], [s * 0.06, 0.075, 0.58], [0.2, 0, s * 0.35]); // flared nostril wing
    blob([0.026, 0.01, 0.03], [s * 0.07, 0.11, 0.625], [0.4, 0, s * 0.35], mats.dark);
  }
  // Heavy brow ridges angled down toward the snout: the scowl
  for (const s of [-1, 1]) {
    blob([0.12, 0.055, 0.17], [s * 0.125, 0.165, 0.12], [0.35, -s * 0.35, s * 0.55]);
    blob([0.06, 0.04, 0.1], [s * 0.2, 0.12, 0.02], [0, -s * 0.5, s * 0.3]);
  }
  blob([0.05, 0.03, 0.12], [0, 0.17, 0.2], [0.2, 0, 0]); // furrow between the brows
  // Eyes: a socket turned slightly outward holds an eyeball that rotates to follow the cursor.
  // The iris is emissive orange, the pupil a black vertical slit; the brow hoods the top.
  const eyes = [], eyeballs = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Group(); socket.position.set(s * 0.15, 0.088, 0.17); socket.rotation.set(0.05, s * 0.42, 0); head.add(socket);
    const ball = new THREE.Group(); socket.add(ball);
    const globe = new THREE.Mesh(sphere, mats.sclera); globe.scale.setScalar(0.056); ball.add(globe);
    const iris = new THREE.Mesh(sphere, mats.eye); iris.scale.set(0.046, 0.046, 0.016); iris.position.z = 0.046; ball.add(iris);
    const pupil = new THREE.Mesh(sphere, mats.dark); pupil.scale.set(0.009, 0.038, 0.008); pupil.position.z = 0.061; ball.add(pupil);
    blob([0.075, 0.03, 0.06], [s * 0.15, 0.138, 0.18], [0.15, s * 0.42, s * 0.35]); // heavy upper lid under the brow
    eyes.push(iris); eyeballs.push({ socket, ball });
  }
  // Dark inner mouth
  blob([0.12, 0.022, 0.27], [0, -0.068, 0.3], [0, 0, 0], mats.mouth); // dark roof of the mouth (thin, so the open jaw shows the tongue)
  // Upper teeth with long fangs
  const tooth = new THREE.ConeGeometry(1, 1, lite ? 5 : 7);
  const teethPer = lite ? 3 : 5;
  for (const s of [-1, 1]) {
    add(head, tooth, mats.tooth, [0.024, 0.19, 0.024], [s * 0.085, -0.15, 0.52], [Math.PI - 0.12, 0, 0]);
    for (let k = 0; k < teethPer; k++) {
      const z = 0.22 + k * (0.24 / teethPer);
      add(head, tooth, mats.tooth, [0.014, 0.06, 0.014], [s * (0.115 - k * 0.006), -0.085, z], [Math.PI, 0, 0]);
    }
  }
  // Lower jaw, hinged and open in a roar, with fangs and a tongue
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.0); head.add(jaw);
  blob([0.14, 0.06, 0.33], [0, -0.05, 0.3], [0, 0, 0], mats.skin, jaw);
  blob([0.11, 0.035, 0.26], [0, -0.012, 0.3], [0, 0, 0], mats.mouth, jaw);
  for (const s of [-1, 1]) {
    add(jaw, tooth, mats.tooth, [0.022, 0.15, 0.022], [s * 0.08, 0.04, 0.55], [0.15, 0, 0]);
    for (let k = 0; k < teethPer; k++) add(jaw, tooth, mats.tooth, [0.013, 0.05, 0.013], [s * (0.1 - k * 0.006), 0.0, 0.22 + k * (0.24 / teethPer)]);
  }
  // Tongue: a small flat tongue lying on the floor of the lower jaw, tip slightly raised
  blob([0.07, 0.022, 0.16], [0, 0.032, 0.27], [-0.04, 0, 0], mats.tongue, jaw);
  blob([0.045, 0.016, 0.06], [0, 0.04, 0.42], [-0.15, 0, 0], mats.tongue, jaw);
  blob([0.006, 0.012, 0.15], [0, 0.047, 0.29], [-0.06, 0, 0], mats.mouth, jaw); // groove down the middle of the tongue

  // Two thick, short, back-swept horns with ridges
  const hornSegs = lite ? 16 : 30;
  for (const s of [-1, 1]) {
    head.add(new THREE.Mesh(sweep([[s * 0.1, 0.17, -0.04], [s * 0.14, 0.24, -0.2], [s * 0.18, 0.31, -0.36], [s * 0.21, 0.42, -0.47], [s * 0.22, 0.56, -0.5]], taper(0.058, 0.007, 8), hornSegs, lite ? 8 : 12), mats.horn));
    // Cheek spikes
    for (let k = 0; k < 3; k++) add(head, tooth, mats.fin, [0.045 - k * 0.008, 0.15 - k * 0.03, 0.045], [s * 0.24, -0.02 - k * 0.07, -0.08 - k * 0.03], [-1.9, 0, s * (0.75 + k * 0.2)]);
  }

  // Beard: a thick, shaggy mass of layered pointed tufts under the chin and lower jaw,
  // hanging down and back (it moves with the jaw)
  const tuft = tuftGeometry(lite ? 4 : 6);
  const beard = new THREE.Group(); jaw.add(beard);
  const rows = lite ? [[5, 0.0], [4, 0.05]] : [[9, 0.0], [8, 0.05], [6, 0.1]];
  rows.forEach(([n, depth], layer) => {
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1);
      const x = (u - 0.5) * (0.24 - layer * 0.04), z = 0.08 + u * 0.06 + (1 - Math.abs(u - 0.5) * 2) * 0.34 - depth;
      const len = 0.2 + (1 - Math.abs(u - 0.5) * 1.6) * 0.16 - layer * 0.03 + ((k * 7) % 3) * 0.02;
      const m = add(beard, tuft, mats.hair, [0.05, len, 0.034], [x, -0.065 - layer * 0.015, z], [Math.PI - 0.55 - layer * 0.15, 0, x * 2.4]);
      m.userData.base = m.rotation.x;
    }
  });
  // Cheek mane: tufts along each cheek flowing back toward the neck
  const cheeks = new THREE.Group(); head.add(cheeks);
  const cheekN = lite ? 5 : 10;
  for (const s of [-1, 1]) for (let k = 0; k < cheekN; k++) {
    const u = k / Math.max(1, cheekN - 1);
    const m = add(cheeks, tuft, mats.hair, [0.05, 0.32 + (k % 2) * 0.12, 0.03], [s * (0.21 + u * 0.04), 0.12 - u * 0.26, 0.06 - u * 0.14], [-2.05 + u * 0.45, 0, s * (0.9 + u * 0.5)]);
    m.userData.base = m.rotation.z;
  }
  // Mane: tufts around the back of the skull, flowing back
  const mane = new THREE.Group(); head.add(mane);
  const maneN = lite ? 8 : 16;
  for (let k = 0; k < maneN; k++) {
    const a = -1.5 + (k / (maneN - 1)) * 3.0;
    const m = add(mane, tuft, mats.hair, [0.05, 0.2 + (k % 2) * 0.07, 0.035], [Math.sin(a) * 0.2, Math.cos(a) * 0.15 + 0.02, -0.18], [-1.95 + Math.abs(a) * 0.1, 0, -a * 0.75]);
    m.userData.base = m.rotation.z;
  }
  return { head, eyes, eyeballs, jaw, beard, mane, cheeks };
}

// ---------- Leg: a smooth muscular limb swept from inside the chest to the wrist, ending in a
// dragon foot: three long forward toes and a dewclaw, each a bony chain tipped with a hooked talon ----------
function buildLeg(mats, lite) {
  const g = new THREE.Group();
  const N = lite ? 18 : 30, RADIAL = lite ? 10 : 16;
  // Dynamic limb skin, rebuilt along root -> shoulder -> elbow -> wrist every frame
  const count = (N + 1) * (RADIAL + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < RADIAL; j++) {
    const a = i * (RADIAL + 1) + j, b = a + RADIAL + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= RADIAL; j++) uv.set([i / N * 2, j / RADIAL], (i * (RADIAL + 1) + j) * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const arm = new THREE.Mesh(geo, mats.limb); arm.frustumCulled = false; g.add(arm);
  // Fin tuft at the elbow, fanning back from the bend
  const elbowTufts = new THREE.Group(); g.add(elbowTufts);
  const tuftG = tuftGeometry(lite ? 4 : 5);
  for (let k = 0; k < (lite ? 2 : 4); k++) {
    const m = new THREE.Mesh(tuftG, mats.hair); m.scale.set(0.028, 0.2 + (k % 2) * 0.07, 0.016); m.rotation.z = -0.55 + k * 0.35; elbowTufts.add(m);
  }
  // Radius along the limb: buried root, heavy shoulder, bicep, elbow, forearm swell, wrist
  const profile = [[0, 1.5], [0.18, 1.25], [0.38, 1.0], [0.55, 0.72], [0.68, 0.8], [0.84, 0.66], [1, 0.5]];
  const radiusAt = t => {
    for (let k = 1; k < profile.length; k++) if (t <= profile[k][0]) {
      const [t0, r0] = profile[k - 1], [t1, r1] = profile[k];
      return THREE.MathUtils.lerp(r0, r1, smooth(t, t0, t1));
    }
    return profile[profile.length - 1][1];
  };

  // Foot: sole faces +Z, toes point +Y; curling a toe bends it toward the sole
  const SEG = lite ? 8 : 14;
  const sphere = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.7));
  const foot = new THREE.Group(); g.add(foot);
  const pad = new THREE.Mesh(sphere, mats.toe); pad.scale.set(0.09, 0.085, 0.05); pad.position.y = 0.04; foot.add(pad);
  const bone = new THREE.CylinderGeometry(0.017, 0.023, 1, lite ? 6 : 9); bone.translate(0, 0.5, 0);
  const talon = sweep([[0, 0, 0], [0, 0.07, 0.008], [0, 0.13, 0.04], [0, 0.165, 0.095], [0, 0.16, 0.15]], taper(0.03, 0.002), lite ? 10 : 18, lite ? 6 : 9);
  const toes = [];
  const makeToe = (x, y, spread, lens, dew) => {
    const root = new THREE.Group(); root.position.set(x, y, 0.012); root.rotation.z = -spread; foot.add(root);
    let parent = root;
    const joints = [];
    lens.forEach((len, k) => {
      const knuckle = new THREE.Mesh(sphere, mats.toe); knuckle.scale.setScalar(0.027 - k * 0.003); parent.add(knuckle);
      const b = new THREE.Mesh(bone, mats.toe); b.scale.set(1 - k * 0.12, len, 1 - k * 0.12); parent.add(b);
      const next = new THREE.Group(); next.position.y = len; parent.add(next);
      joints.push(parent); parent = next;
    });
    parent.add(new THREE.Mesh(talon, mats.talon));
    if (dew) parent.scale.setScalar(0.85);
    toes.push({ joints, dew });
  };
  makeToe(-0.07, 0.1, 0.6, [0.12, 0.1], false);
  makeToe(-0.024, 0.114, 0.2, [0.14, 0.115], false);
  makeToe(0.024, 0.114, -0.2, [0.14, 0.115], false);
  makeToe(0.07, 0.1, -0.6, [0.12, 0.1], false);
  // Dewclaw: a thumb-like toe set low on the inner side, opposing the three
  makeToe(-0.085, -0.02, 2.2, [0.08], true);

  const tmp = new THREE.Vector3(), ref = new THREE.Vector3(), Nv = new THREE.Vector3(), Bv = new THREE.Vector3(), basis = new THREE.Matrix4();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
  return {
    group: g,
    // root inside the body, S shoulder, E elbow, W wrist; toeDir and soleNormal orient the foot; curl 0 open .. 1.4 closed
    pose(root, S, E, W, toeDir, soleNormal, curl, scale) {
      curve.points[0].copy(root); curve.points[1].copy(S); curve.points[2].copy(E); curve.points[3].copy(W);
      const r0 = 0.1 * scale;
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = curve.getPointAt(t), T = curve.getTangentAt(t);
        ref.set(0, 0, 1); if (Math.abs(T.dot(ref)) > 0.9) ref.set(0, 1, 0);
        Nv.copy(ref).addScaledVector(T, -ref.dot(T)).normalize(); Bv.crossVectors(T, Nv);
        const r = r0 * radiusAt(t);
        for (let j = 0; j <= RADIAL; j++) {
          const a = (j / RADIAL) * Math.PI * 2, k = (i * (RADIAL + 1) + j) * 3;
          tmp.copy(Nv).multiplyScalar(Math.cos(a)).addScaledVector(Bv, Math.sin(a));
          nor[k] = tmp.x; nor[k + 1] = tmp.y; nor[k + 2] = tmp.z;
          pos[k] = p.x + tmp.x * r; pos[k + 1] = p.y + tmp.y * r; pos[k + 2] = p.z + tmp.z * r;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
      const z = soleNormal.clone().addScaledVector(toeDir, -soleNormal.dot(toeDir)).normalize();
      const x = new THREE.Vector3().crossVectors(toeDir, z).normalize();
      basis.makeBasis(x, toeDir, z);
      foot.quaternion.setFromRotationMatrix(basis);
      foot.position.copy(W); foot.scale.setScalar(scale * 2.1);
      // Elbow tuft points out of the bend, away from both bones
      const out = E.clone().sub(W).normalize().add(E.clone().sub(S).normalize()).normalize();
      elbowTufts.position.copy(E); elbowTufts.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out); elbowTufts.scale.setScalar(scale);
      for (const t of toes) t.joints.forEach((j, k) => { j.rotation.x = curl * (t.dew ? 0.55 : (k === 0 ? 0.5 : 0.85)); });
    },
  };
}

// Two-bone IK: elbow position for shoulder S reaching wrist target T with segment lengths a, b
function solveElbow(S, T, a, b, pole) {
  const d = new THREE.Vector3().subVectors(T, S);
  let len = d.length();
  len = THREE.MathUtils.clamp(len, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  d.normalize();
  const W = S.clone().addScaledVector(d, len);
  const along = (a * a - b * b + len * len) / (2 * len), h = Math.sqrt(Math.max(0, a * a - along * along));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  return { E: S.clone().addScaledVector(d, along).addScaledVector(p, h), W };
}

// ---------- The dragon ----------
export function createDragon({ lite = false } = {}) {
  const L = lite ? 150 : 260;      // rings along the body
  const RAD = lite ? 14 : 24;      // vertices around the body
  const R = 2.0;                   // ring radius the body coils around
  const COIL = 0.52, TURNS = 1.6, SPAN = Math.PI * 1.5, THETA_END = Math.PI * 0.62, NECK = 0.78;
  const HEAD_SCALE = 2.4;

  const maps = scaleMaps(lite ? 128 : 256);
  const mats = {
    body: scaleMaterial(maps, { repeat: lite ? [30, 4] : [46, 6], vertexColors: true }),
    skin: scaleMaterial(maps, { repeat: [5, 4], color: '#6a6a6a', normal: 1.2 }),
    horn: rimify(new THREE.MeshStandardMaterial({ color: '#7A7A7A', metalness: 0.45, roughness: 0.55, envMapIntensity: 0.35, transparent: true }), 0.35),
    whisker: rimify(new THREE.MeshStandardMaterial({ color: '#7d7d7d', metalness: 0.35, roughness: 0.6, transparent: true }), 0.45),
    hair: rimify(new THREE.MeshStandardMaterial({ color: '#9a9a9a', vertexColors: true, metalness: 0.25, roughness: 0.85, transparent: true }), 0.3),
    tooth: new THREE.MeshStandardMaterial({ color: BONE, metalness: 0.05, roughness: 0.38, transparent: true }),
    talon: rimify(new THREE.MeshStandardMaterial({ color: BONE, metalness: 0.1, roughness: 0.32, transparent: true }), 0.4),
    limb: scaleMaterial(maps, { repeat: [7, 3], color: '#6a6a6a', normal: 1.3 }),
    toe: scaleMaterial(maps, { repeat: [3, 3], color: '#626262', normal: 1.6 }),
    sclera: new THREE.MeshStandardMaterial({ color: '#1a0e05', roughness: 0.35, metalness: 0.1, transparent: true }),
    tongue: new THREE.MeshStandardMaterial({ color: '#7e3328', roughness: 0.55, transparent: true }),
    mouth: new THREE.MeshStandardMaterial({ color: '#0e0603', roughness: 0.95, transparent: true }),
    dark: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true }),
    eye: new THREE.MeshBasicMaterial({ color: ORANGE.clone(), toneMapped: false, transparent: true }),
    fin: rimify(new THREE.MeshStandardMaterial({ color: '#5a5a5a', metalness: 0.5, roughness: 0.6, envMapIntensity: 0.4, flatShading: true, transparent: true }), 0.7),
  };
  const fadeable = Object.values(mats);

  // ---- Body buffers (index built once, positions rewritten per frame) ----
  const count = (L + 1) * (RAD + 1);
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const idx = [];
  for (let i = 0; i < L; i++) for (let j = 0; j < RAD; j++) {
    const a = i * (RAD + 1) + j, b = a + RAD + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  bodyGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  bodyGeo.setIndex(idx);
  const body = new THREE.Mesh(bodyGeo, mats.body); body.frustumCulled = false;

  // Dark back, lighter ribbed belly plates (like the logo's neck)
  const back = GRAY.clone().multiplyScalar(0.62), bellyC = LIGHT_GRAY.clone().multiplyScalar(0.78), c = new THREE.Color();
  for (let i = 0; i <= L; i++) {
    const rib = (Math.floor(i / (lite ? 3 : 5)) % 2) ? 0.82 : 1;
    for (let j = 0; j <= RAD; j++) {
      const k = i * (RAD + 1) + j, a = (j / RAD) * Math.PI * 2;
      const belly = smooth(Math.cos(a), 0.45, 0.85);
      c.copy(back).lerp(bellyC.clone().multiplyScalar(rib), belly);
      col.set([c.r, c.g, c.b], k * 3); uv.set([i / L, j / RAD], k * 2);
    }
  }

  // Radius: gradual tail, the most mass at chest and neck root, slightly slimmer behind the head
  const state = { coil: 1, theta: 0, phase: 0.9, sway: 0, breath: 0, snarl: 0, flex: 0 };
  const radiusAt = s => {
    const base = 0.04 + 0.2 * smooth(s, 0, 0.38);
    const chest = 0.036 * Math.exp(-Math.pow((s - 0.72) / 0.1, 2)) * (1 + state.breath * 0.7);
    return (base + chest) * 1.1 * (1 - 0.04 * smooth(s, 0.9, 1));
  };

  // Dorsal plates: short, thick, jagged triangles
  const FINS = lite ? 26 : 46;
  const finGeo = new THREE.ConeGeometry(0.075, 0.22, 4, 5); finGeo.translate(0, 0.11, 0);
  { // bend each spike back toward the tail (local -Z) so it reads as a curved fin
    const fp = finGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i) / 0.22; fp.setZ(i, fp.getZ(i) - 0.16 * y * y); }
    finGeo.computeVertexNormals();
  }
  const fins = new THREE.InstancedMesh(finGeo, mats.fin, FINS); fins.frustumCulled = false;
  // Neck mane: tufts along the back of the neck, flowing toward the tail
  const NMANE = lite ? 12 : 26;
  const neckMane = new THREE.InstancedMesh(tuftGeometry(lite ? 4 : 6, true), mats.hair, NMANE); neckMane.frustumCulled = false;

  const { head, eyes, eyeballs, jaw, beard, mane, cheeks } = buildHead(mats, lite);
  head.scale.setScalar(HEAD_SCALE);
  const headPivot = new THREE.Group(); headPivot.add(head);
  const headRoot = new THREE.Group(); headRoot.add(headPivot); headRoot.matrixAutoUpdate = false;

  const tuftG = tuftGeometry(lite ? 4 : 6, true);
  // Flame-shaped fan at the tail tip
  const tailFan = new THREE.Group(); tailFan.matrixAutoUpdate = false;
  const FAN = lite ? 5 : 9;
  for (let k = 0; k < FAN; k++) {
    const u = k / (FAN - 1), mid = 1 - Math.abs(u - 0.5) * 2;
    const m = new THREE.Mesh(tuftG, mats.hair); m.scale.set(0.075, 0.95 + mid * 0.85 + (k % 2) * 0.18, 0.15);
    m.rotation.z = -1.3 + u * 2.6; m.userData.base = m.rotation.z; tailFan.add(m);
  }
  // Small fin tufts along both sides of the tail
  const TAILF = lite ? 6 : 14;
  const tailFins = new THREE.InstancedMesh(tuftG, mats.hair, TAILF); tailFins.frustumCulled = false;
  // Four legs: front raised + front grip, rear grip + rear trailing
  const raised = buildLeg(mats, lite), grip = buildLeg(mats, lite), rearGrip = buildLeg(mats, lite), rearTrail = buildLeg(mats, lite);

  const group = new THREE.Group();
  group.add(body, fins, neckMane, headRoot, raised.group, grip.group, rearGrip.group, rearTrail.group, tailFan, tailFins);

  // ---- Path: a double-looping S threaded through the ring ----
  // Hand-placed spine, tail (lower-left) to head (upper-left): the body sweeps along the bottom
  // in front of the ring, rises behind it on the right, coils in through the centre into a lower
  // loop, climbs into a large arch over the top in front of the ring, and the neck descends to
  // the head, which leans down toward the viewer. The z values alternate where the body crosses
  // the ring's circle, so it passes in front of the ring in some places and behind it in others.
  const P = [], T = [], D = [], B = [];
  for (let i = 0; i <= L; i++) { P.push(new THREE.Vector3()); T.push(new THREE.Vector3()); D.push(new THREE.Vector3()); B.push(new THREE.Vector3()); }
  const v = new THREE.Vector3(), core = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), down = new THREE.Vector3(0, -1, 0.25).normalize();
  const faceDir = new THREE.Vector3(-0.4, -0.3, 1).normalize();
  const turn = { headYaw: 0, headPitch: 0, neckYaw: 0, neckPitch: 0 };
  const NECK_BASE = 0.86, neckQ = new THREE.Quaternion(), neckE = new THREE.Euler(), pivot = new THREE.Vector3();
  const KEYS = [
    [-3.05, -2.55, 0.35], [-2.1, -2.45, 0.6], [-0.7, -2.45, 0.85], [0.8, -2.15, 0.6], [1.95, -1.4, -0.45],
    [2.45, -0.3, -0.65], [2.05, 0.65, -0.35], [1.0, 0.75, 0.35], [-0.05, 0.15, 0.75], [-0.35, -0.85, 0.45],
    [0.45, -1.3, -0.35], [1.55, -0.55, -0.7], [2.45, 0.85, -0.45], [2.05, 2.05, 0.45], [0.75, 2.75, 0.6],
    [-0.6, 2.55, 0.75], [-1.65, 2.25, 1.0], [-2.25, 1.85, 1.35], [-2.15, 1.35, 1.8],
  ].map(k => new THREE.Vector3(k[0] + 0.35, k[1], k[2])); // shifted so the whole sculpture centres on the ring
  const spine = new THREE.CatmullRomCurve3(KEYS.map(k => k.clone()), false, 'centripetal');
  function updateSpine() {
    // Intro: the body unfurls from a smaller, rotated pose; idle: a slow ripple along the coils
    const e = THREE.MathUtils.clamp((state.coil - 0.2) / 0.8, 0, 1);
    const ang = (1 - e) * -0.9, sc = 0.55 + 0.45 * e, c = Math.cos(ang), sn = Math.sin(ang);
    KEYS.forEach((k, i) => {
      const x = k.x * sc, y = k.y * sc;
      const ripple = Math.sin(state.sway * 0.45 + i * 0.9) * 0.06 * (i === KEYS.length - 1 ? 0 : 1);
      spine.points[i].set(x * c - y * sn, x * sn + y * c, k.z * sc + ripple);
    });
    const h = spine.points[KEYS.length - 1];
    h.x += Math.sin(state.sway * 0.5) * 0.04; h.y += Math.sin(state.sway * 0.7) * 0.05;
    spine.updateArcLengths();
  }

  function rebuild(t, look) {
    updateSpine();
    for (let i = 0; i <= L; i++) spine.getPointAt(i / L, P[i]);
    // The top of the neck rotates progressively toward the cursor (roughly 10/15/25/40% of the
    // head's turn per segment, accumulating along the neck), so the head is carried, not swivelled
    const i0 = Math.round(NECK_BASE * L); pivot.copy(P[i0]);
    for (let i = i0 + 1; i <= L; i++) {
      const w = Math.pow((i - i0) / (L - i0), 1.6) * 0.6;
      neckE.set(-turn.neckPitch * w, turn.neckYaw * w, 0); neckQ.setFromEuler(neckE);
      P[i].sub(pivot).applyQuaternion(neckQ).add(pivot);
    }
    // Body frame carried from the tail without twisting; the belly starts facing down and turns
    // down again behind the head
    for (let i = 0; i <= L; i++) T[i].subVectors(P[Math.min(L, i + 1)], P[Math.max(0, i - 1)]).normalize();
    // The back (dorsal spikes, mane) faces up and away from the ring centre, a little toward the
    // viewer; the belly faces the opposite way. The frame follows that target smoothly along the body.
    const want = new THREE.Vector3(), outv = new THREE.Vector3();
    for (let i = 0; i <= L; i++) {
      outv.set(P[i].x, P[i].y, 0); if (outv.lengthSq() > 1e-6) outv.normalize();
      want.set(0, 1, 0).addScaledVector(outv, 0.8).add(new THREE.Vector3(0, 0, 0.25)).negate();
      want.addScaledVector(T[i], -want.dot(T[i]));
      if (want.lengthSq() < 1e-4) want.copy(i ? D[i - 1] : new THREE.Vector3(0, -1, 0));
      want.normalize();
      if (i === 0) { D[0].copy(want); continue; }
      D[i].copy(D[i - 1]).addScaledVector(T[i], -D[i - 1].dot(T[i])).normalize().lerp(want, 0.12).normalize();
    }
    for (let i = 0; i <= L; i++) {
      const w = smooth(i / L, 0.9, 0.99);
      if (w > 0) D[i].lerp(down, w).addScaledVector(T[i], -D[i].dot(T[i])).normalize();
      B[i].crossVectors(T[i], D[i]).normalize();
    }
    for (let i = 0; i <= L; i++) {
      const r = radiusAt(i / L);
      for (let j = 0; j <= RAD; j++) {
        const a = (j / RAD) * Math.PI * 2, k = (i * (RAD + 1) + j) * 3;
        v.copy(D[i]).multiplyScalar(Math.cos(a)).addScaledVector(B[i], Math.sin(a));
        nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
        pos[k] = P[i].x + v.x * r; pos[k + 1] = P[i].y + v.y * r; pos[k + 2] = P[i].z + v.z * r;
      }
    }
    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.attributes.normal.needsUpdate = true;

    // Dorsal plates on the back, raked toward the tail, alternating heights for a jagged ridge
    const dir = new THREE.Vector3(), z = new THREE.Vector3(), base = new THREE.Vector3();
    for (let f = 0; f < FINS; f++) {
      const s = 0.06 + (f / (FINS - 1)) * 0.86, i = Math.round(s * L), r = radiusAt(s);
      dir.copy(D[i]).negate().addScaledVector(T[i], -0.35).normalize();
      z.crossVectors(B[i], dir).normalize();
      base.copy(P[i]).addScaledVector(D[i], -r * 0.86);
      const k = 1.6 * Math.max(0.35, r / 0.2) * (f % 2 ? 0.85 : 1);
      m4.makeBasis(B[i].clone().multiplyScalar(0.45 * k), dir.clone().multiplyScalar(k), z.multiplyScalar(k)).setPosition(base);
      fins.setMatrixAt(f, m4);
    }
    fins.instanceMatrix.needsUpdate = true;

    // Neck mane: two staggered rows of tufts flowing back and swaying
    for (let n = 0; n < NMANE; n++) {
      const s = 0.74 + (n / (NMANE - 1)) * 0.24, i = Math.round(s * L), r = radiusAt(s), side = n % 2 ? 1 : -1;
      const sway = Math.sin(t * 1.3 + n * 0.7) * 0.12;
      dir.copy(D[i]).negate().multiplyScalar(0.55).addScaledVector(T[i], -1).addScaledVector(B[i], side * 0.35 + sway).normalize();
      z.crossVectors(B[i], dir).normalize();
      base.copy(P[i]).addScaledVector(D[i], -r * 0.8).addScaledVector(B[i], side * r * 0.3);
      const len = 0.36 + (n % 3) * 0.1 + smooth(s, 0.74, 0.98) * 0.22;
      m4.makeBasis(B[i].clone().multiplyScalar(0.055), dir.clone().multiplyScalar(len), z.multiplyScalar(len * 0.35)).setPosition(base);
      neckMane.setMatrixAt(n, m4);
    }
    neckMane.instanceMatrix.needsUpdate = true;

    // Tail: side fins, and the flame fan at the tip pointing out along the tail
    for (let n = 0; n < TAILF; n++) {
      const sT = 0.05 + Math.floor(n / 2) / Math.max(1, TAILF / 2 - 1) * 0.28, i = Math.round(sT * L), r = radiusAt(sT), side = n % 2 ? 1 : -1;
      dir.copy(T[i]).negate().multiplyScalar(0.8).addScaledVector(B[i], side * 0.75).addScaledVector(D[i], -0.25).normalize();
      z.crossVectors(B[i], dir).normalize();
      base.copy(P[i]).addScaledVector(B[i], side * r * 0.8);
      m4.makeBasis(B[i].clone().multiplyScalar(0.035), dir.clone().multiplyScalar(0.16 + (1 - sT * 3) * 0.06), z.multiplyScalar(0.012)).setPosition(base);
      tailFins.setMatrixAt(n, m4);
    }
    tailFins.instanceMatrix.needsUpdate = true;
    const tOut = T[0].clone().negate();
    tailFan.matrix.makeBasis(B[0], tOut, new THREE.Vector3().crossVectors(B[0], tOut).normalize()).setPosition(P[0]);
    tailFan.matrixWorldNeedsUpdate = true;
    for (const m of tailFan.children) m.rotation.z = m.userData.base + Math.sin(t * 1.5 + m.userData.base * 3) * 0.06;

    // Head on the neck end, turned mostly toward the viewer at a slight 3/4 angle
    const e = L, fwd = T[e].clone().multiplyScalar(0.25).add(faceDir).normalize();
    const hu = new THREE.Vector3(0, 1, 0), rt = new THREE.Vector3().crossVectors(hu, fwd).normalize();
    hu.crossVectors(fwd, rt).normalize();
    headRoot.matrix.makeBasis(rt, hu, fwd).setPosition(P[e].clone().addScaledVector(fwd, -0.04));
    headRoot.matrixWorldNeedsUpdate = true;

    // ---- Four legs ----
    const legScale = radiusAt(0.8) / 0.24;
    const nearAt = i => (B[i].z >= 0 ? 1 : -1);
    const shoulder = (sx, side) => {
      const i = Math.round(sx * L), r = radiusAt(sx);
      return { i, S: P[i].clone().addScaledVector(B[i], side * r * 0.8).addScaledVector(D[i], r * 0.3) };
    };
    // A foot that grips the ring at the point of the circle nearest its shoulder
    const gripRing = (leg, sx, side, ls) => {
      const { i, S } = shoulder(sx, side);
      const th = Math.atan2(S.y, S.x) + 0.15 * side;
      const rp = new THREE.Vector3(Math.cos(th) * R, Math.sin(th) * R, 0), radial = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
      const target = rp.clone().addScaledVector(radial, 0.08).add(new THREE.Vector3(0, 0, Math.sign(S.z || 1) * 0.2 * ls));
      const k = solveElbow(S, target, 0.62 * ls, 0.56 * ls, radial.clone().add(new THREE.Vector3(0, 0, 0.6)));
      const sole = rp.clone().sub(k.W).normalize(), toes = radial.clone().negate();
      toes.addScaledVector(sole, -toes.dot(sole)).normalize();
      leg.pose(P[i], S, k.E, k.W, toes, sole, 1.65, ls);
    };
    // Front: one claw reaches forward toward the viewer, open and grasping; the other grips the ring
    const fi = Math.round(0.8 * L), fSide = nearAt(fi);
    const F1 = shoulder(0.8, fSide);
    const T1 = F1.S.clone().add(new THREE.Vector3(-0.55, -0.45, 1.0).multiplyScalar(legScale));
    const k1 = solveElbow(F1.S, T1, 0.62 * legScale, 0.56 * legScale, new THREE.Vector3(0.4, -0.7, 0.1));
    raised.pose(P[F1.i], F1.S, k1.E, k1.W, new THREE.Vector3(-0.45, 0.8, 0.5).normalize(), new THREE.Vector3(-0.2, -0.35, 1).normalize(), 1.0 + state.flex * 0.5, legScale);
    gripRing(grip, 0.77, -fSide, legScale);
    // Rear, a little smaller: one grips the ring, the other trails back along the body
    const rs = 0.85 * legScale, ri = Math.round(0.4 * L), rSide = nearAt(ri);
    gripRing(rearGrip, 0.4, rSide, rs);
    const R4 = shoulder(0.43, -rSide);
    const T4 = R4.S.clone().addScaledVector(T[R4.i], -0.85 * rs).addScaledVector(D[R4.i], 0.25 * rs).addScaledVector(B[R4.i], -rSide * 0.2 * rs);
    const k4 = solveElbow(R4.S, T4, 0.62 * rs, 0.56 * rs, D[R4.i].clone().negate());
    rearTrail.pose(P[R4.i], R4.S, k4.E, k4.W, T[R4.i].clone().negate(), D[R4.i].clone(), 0.5, rs);
  }

  // Snarl every 6-8 s: jaw opens wider and the eyes flare
  let nextSnarl = 4, snarlStart = -10;
  return {
    group, eyes, jaw,
    eyeMaterial: mats.eye,
    // t: seconds; intro: 0..1 coil-in progress; look: {x,y} -1..1 smoothed pointer;
    // eyeTarget: world point the eyes should look at (the cursor, or the viewer)
    // aim: {x,y} -1..1 raw cursor target (0,0 = facing the viewer); smoothed here per part
    update(t, intro, look, still = false, eyeTarget = null, aim = null) {
      const ax = still || !aim ? 0 : THREE.MathUtils.clamp(aim.x, -1, 1), ay = still || !aim ? 0 : THREE.MathUtils.clamp(aim.y, -1, 1);
      const yawT = ax * THREE.MathUtils.degToRad(35), pitchT = ay * THREE.MathUtils.degToRad(20);
      const k = still ? 1 : 1;
      turn.headYaw += (yawT - turn.headYaw) * (still ? 1 : 0.08 * k); turn.headPitch += (pitchT - turn.headPitch) * (still ? 1 : 0.08);
      turn.neckYaw += (yawT - turn.neckYaw) * (still ? 1 : 0.05); turn.neckPitch += (pitchT - turn.neckPitch) * (still ? 1 : 0.05);
      const e = 1 - Math.pow(1 - intro, 3);
      state.coil = 0.2 + 0.8 * e;
      state.theta = (1 - e) * -1.0;
      state.phase = 0.9 + (still ? 0 : Math.sin(t * 0.22) * 0.22);
      state.sway = still ? 0 : t;
      state.breath = still ? 0 : Math.sin(t * 1.15);
      if (!still && intro >= 1 && t > nextSnarl) { snarlStart = t; nextSnarl = t + 6 + Math.random() * 2; }
      const st = t - snarlStart;
      state.snarl = still ? 0 : (st >= 0 && st < 1.3 ? Math.sin((st / 1.3) * Math.PI) : 0);
      // The raised claw flexes now and then (a slow pulse)
      state.flex = still ? 0.2 : Math.pow(Math.max(0, Math.sin(t * 0.55)), 6);
      rebuild(t, look);

      const o = Math.min(1, intro * 1.6);
      for (const m of fadeable) {
        if (m === mats.eye) continue;
        m.opacity = o;
        const want = o < 1;
        if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; }
      }
      // Head turns slightly toward the pointer and rears back on a snarl
      // The head turns gently toward the cursor; the eyes do most of the looking
      // The neck carries part of the turn; the head adds the rest so the total reaches about ±35° / ±20°
      headPivot.rotation.y = turn.headYaw * 0.45;
      headPivot.rotation.x = -turn.headPitch * 0.5 - state.snarl * 0.12;
      if (eyeTarget) {
        group.updateMatrixWorld(true);
        for (const { socket, ball } of eyeballs) {
          const l = socket.worldToLocal(eyeTarget.clone());
          const yaw = THREE.MathUtils.clamp(Math.atan2(l.x, l.z), -0.6, 0.6);
          const pitch = THREE.MathUtils.clamp(-Math.atan2(l.y, Math.hypot(l.x, l.z)), -0.4, 0.4);
          ball.rotation.y += (yaw - ball.rotation.y) * 0.12;
          ball.rotation.x += (pitch - ball.rotation.x) * 0.12;
        }
      }
      jaw.rotation.x = 0.5 + state.snarl * 0.28 + (still ? 0 : Math.sin(t * 0.9) * 0.03);
      // Beard and mane sway a little
      for (const m of beard.children) m.rotation.x = m.userData.base + (still ? 0 : Math.sin(t * 1.4 + m.position.z * 9) * 0.06);
      for (const m of mane.children) m.rotation.z = m.userData.base + (still ? 0 : Math.sin(t * 1.2 + m.position.x * 10) * 0.07);
      for (const m of cheeks.children) m.rotation.z = m.userData.base + (still ? 0 : Math.sin(t * 1.1 + m.position.y * 12) * 0.05);
    },
    setEyes(level) {
      // level 0..1: dark to lit; a snarl flares the glow
      mats.eye.color.copy(ORANGE).multiplyScalar((0.06 + level * 1.5) * (1 + state.snarl * 0.9));
    },
  };
}
