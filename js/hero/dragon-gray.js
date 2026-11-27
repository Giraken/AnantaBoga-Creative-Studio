// GRAY VARIANT (brand gray, one horn per side, no whiskers). Kept as an alternative: ?dragon=gray or DRAGON in js/hero/hero.js.
// The imperial dragon (Anantaboga) threaded through the ring, built like the logo: a heavy scaled body,
// a scowling roaring head with beard and mane, and two clawed front legs at the top of the arch, one each
// side, both reaching toward the viewer. The body slides along a track (spine.js): it rises from below
// the frame and coils into place, and on scroll loops away to the left, never passing through the ring or
// itself. The body skin, the head on the end of the neck and the legs are re-solved every frame.
import * as THREE from 'three';
import { scaleMaps, finish, skinMaterial, lumpySphere, fangGeometry } from './realism.js';
import { REST, createTrack, createSolver, bodyRadius, bodyFrames, headBasis, HEAD_TILT, HEAD_SPHERES, HEAD_DOWN } from './spine.js';

const ORANGE = new THREE.Color('#FF9800');
const GRAY = new THREE.Color('#7A7A7A');
const LIGHT_GRAY = new THREE.Color('#A0A0A0');
const BONE = new THREE.Color('#E8E2D6');
const UP_X = new THREE.Vector3(1, 0, 0);
const VIEW = new THREE.Vector3(0, 0, 1); // toward the viewer
const smooth = THREE.MathUtils.smoothstep;

// Rim-lit finish (see realism.js); trans lets light from behind show through thin parts
const rimify = (m, rim, trans = 0) => finish(m, { rim, trans });
const scaleMaterial = skinMaterial;

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
// Forward is +Z, up is +Y. The origin is the nape, where the neck enters: the neck comes in from behind
// and above along NAPE (tipped by HEAD_TILT), so the back of the skull is built around that axis and the
// neck runs straight into it.
const NAPE = new THREE.Vector3(0, Math.sin(HEAD_TILT), -Math.cos(HEAD_TILT));
const UP = new THREE.Vector3(0, 1, 0);
function buildHead(mats, lite) {
  const head = new THREE.Group();
  const SEG = lite ? 16 : 40;
  const sphere = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.7));
  const lumpy = lumpySphere(SEG); // skin shapes get soft lumps and wrinkles instead of perfect spheres
  const add = (parent, geo, mat, s, p, r = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...p); m.rotation.set(...r); parent.add(m); return m;
  };
  const blob = (s, p, r, mat = mats.skin, parent = head) => add(parent, mat === mats.skin ? lumpy : sphere, mat, s, p, r);
  // Back of the skull: two swellings along the neck axis, so the neck widens into the head
  const nape = (s, d, lift = 0) => blob(s, [0, NAPE.y * d + lift, NAPE.z * d], [HEAD_TILT, 0, 0]);
  nape([0.19, 0.17, 0.2], 0.07);
  nape([0.15, 0.135, 0.19], 0.22);
  blob([0.15, 0.11, 0.17], [0, -0.1, -0.1], [-0.35, 0, 0]); // throat: from under the jaw hinge into the neck

  // Skull, jowls, long snout and flat nose pad
  blob([0.27, 0.22, 0.3], [0, 0.05, -0.03]);
  blob([0.24, 0.16, 0.22], [0, -0.04, 0.05]);
  blob([0.15, 0.1, 0.32], [0, 0.02, 0.33]);
  blob([0.115, 0.05, 0.075], [0, 0.05, 0.6]);
  // Wrinkled snout: ridges across the bridge
  for (let k = 0; k < 4; k++) blob([0.13 - k * 0.01, 0.02, 0.026], [0, 0.112 - k * 0.006, 0.2 + k * 0.08], [0.1, 0, 0]);
  // Flared nostrils
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
  const eyes = [], eyeballs = [], glass = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Group(); socket.position.set(s * 0.15, 0.088, 0.17); socket.rotation.set(0.05, s * 0.42, 0); head.add(socket);
    const ball = new THREE.Group(); socket.add(ball);
    const globe = new THREE.Mesh(sphere, mats.sclera); globe.scale.setScalar(0.056); ball.add(globe);
    const iris = new THREE.Mesh(sphere, mats.eye); iris.scale.set(0.046, 0.046, 0.016); iris.position.z = 0.046; ball.add(iris);
    const pupil = new THREE.Mesh(sphere, mats.dark); pupil.scale.set(0.009, 0.038, 0.008); pupil.position.z = 0.061; ball.add(pupil);
    // Wet cornea: a clear glossy shell over the eye that catches a sharp highlight
    const cornea = new THREE.Mesh(sphere, mats.cornea); cornea.scale.set(0.06, 0.06, 0.052); cornea.position.z = 0.012; ball.add(cornea);
    glass.push(cornea);
    blob([0.075, 0.03, 0.06], [s * 0.15, 0.138, 0.18], [0.15, s * 0.42, s * 0.35]); // heavy upper lid under the brow
    eyes.push(iris); eyeballs.push({ socket, ball });
  }
  // Dark inner mouth
  blob([0.12, 0.022, 0.27], [0, -0.068, 0.3], [0, 0, 0], mats.mouth); // dark roof of the mouth (thin, so the open jaw shows the tongue)
  // Upper teeth with long fangs
  const tooth = fangGeometry(lite ? 6 : 12, lite ? 6 : 10);
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
    for (let k = 0; k < 3; k++) add(head, tooth, mats.horn, [0.045 - k * 0.008, 0.15 - k * 0.03, 0.045], [s * 0.24, -0.02 - k * 0.07, -0.08 - k * 0.03], [-1.9, 0, s * (0.75 + k * 0.2)]);
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
  // Mane: a collar of tufts round the top and sides of the nape, flowing back along the neck, so the
  // join between head and neck sits under hair
  const mane = new THREE.Group(); head.add(mane);
  const maneN = lite ? 9 : 18;
  const across = new THREE.Vector3(0, Math.cos(HEAD_TILT), Math.sin(HEAD_TILT)); // up, square to the neck
  for (let k = 0; k < maneN; k++) {
    const a = -1.85 + (k / (maneN - 1)) * 3.7; // 0 = top of the neck
    const out = new THREE.Vector3(Math.sin(a), 0, 0).addScaledVector(across, Math.cos(a));
    const m = new THREE.Mesh(tuft, mats.hair);
    m.scale.set(0.05, 0.22 + (k % 2) * 0.08 + Math.cos(a) * 0.05, 0.035);
    m.position.copy(NAPE).multiplyScalar(0.1 + (k % 2) * 0.05).addScaledVector(out, 0.15);
    m.quaternion.setFromUnitVectors(UP, NAPE.clone().addScaledVector(out, 0.45).normalize());
    m.userData.q0 = m.quaternion.clone();
    mane.add(m);
  }
  return { head, eyes, eyeballs, glass, jaw, beard, mane, cheeks };
}

// ---------- Leg: a smooth muscular limb swept from inside the chest to the wrist, ending in a
// dragon hand: four long forward fingers and a shorter thumb, all pointing forward, each a bony chain
// tipped with a hooked talon ----------
function buildLeg(mats, lite) {
  const g = new THREE.Group();
  const N = lite ? 18 : 40, RADIAL = lite ? 10 : 22;
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

  // Hand: palm faces +Z, fingers point +Y; curling a finger bends it toward the palm
  const SEG = lite ? 8 : 20;
  const sphere = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.7));
  const foot = new THREE.Group(); g.add(foot);
  const pad = new THREE.Mesh(sphere, mats.toe); pad.scale.set(0.095, 0.085, 0.05); pad.position.y = 0.04; foot.add(pad);
  const bone = new THREE.CylinderGeometry(0.017, 0.023, 1, lite ? 6 : 9); bone.translate(0, 0.5, 0);
  const talon = sweep([[0, 0, 0], [0, 0.07, 0.008], [0, 0.13, 0.04], [0, 0.165, 0.095], [0, 0.16, 0.15]], taper(0.03, 0.0008), lite ? 10 : 26, lite ? 6 : 14);
  const toes = [];
  const makeToe = (x, y, spread, lens, thumb) => {
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
    if (thumb) root.scale.setScalar(0.88);
    toes.push({ joints, thumb });
  };
  makeToe(-0.068, 0.1, 0.5, [0.12, 0.1], false);
  makeToe(-0.023, 0.114, 0.17, [0.14, 0.115], false);
  makeToe(0.023, 0.114, -0.17, [0.14, 0.115], false);
  makeToe(0.068, 0.1, -0.5, [0.12, 0.1], false);
  // Thumb: the fifth finger, set lower on the inner edge of the palm, pointing forward with the rest
  makeToe(-0.095, 0.045, 0.62, [0.1, 0.085], true);

  const tmp = new THREE.Vector3(), ref = new THREE.Vector3(), Nv = new THREE.Vector3(), Bv = new THREE.Vector3(), basis = new THREE.Matrix4();
  const zf = new THREE.Vector3(), xf = new THREE.Vector3(), out = new THREE.Vector3(), out2 = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'centripetal');
  return {
    group: g,
    // root inside the body, S shoulder, E elbow, W wrist; toeDir and soleNormal orient the hand; curl 0 open .. 1.4 closed
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
      zf.copy(soleNormal).addScaledVector(toeDir, -soleNormal.dot(toeDir)).normalize();
      xf.crossVectors(toeDir, zf).normalize();
      basis.makeBasis(xf, toeDir, zf);
      foot.quaternion.setFromRotationMatrix(basis);
      foot.position.copy(W); foot.scale.setScalar(scale * 2.1);
      // Elbow tuft points out of the bend, away from both bones
      out.copy(E).sub(W).normalize().add(out2.copy(E).sub(S).normalize()).normalize();
      elbowTufts.position.copy(E); elbowTufts.quaternion.setFromUnitVectors(UP, out); elbowTufts.scale.setScalar(scale);
      for (const t of toes) t.joints.forEach((j, k) => { j.rotation.x = curl * (t.thumb ? 0.6 : (k === 0 ? 0.5 : 0.85)); });
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
  const L = lite ? 150 : 400;      // rings along the body
  const RAD = lite ? 14 : 36;      // vertices around the body
  const M = lite ? 64 : 96;        // collision nodes along the body
  const HEAD_SCALE = 2.4;
  const NECK_BASE = 0.86, NAPE_BEND = 0.95, NECK_SHARE = 0.6; // a head turn: 60% bends the neck, the rest the nape
  const FRONT = 0.85;              // where the front legs join the body: the top of the arch, just behind the neck

  const maps = scaleMaps(lite ? 256 : 512);
  const mats = {
    body: scaleMaterial(maps, { repeat: lite ? [30, 4] : [46, 6], vertexColors: true }),
    skin: scaleMaterial(maps, { repeat: [9, 7], color: '#6a6a6a', normal: 1.1 }),
    horn: rimify(new THREE.MeshPhysicalMaterial({ color: '#7A7A7A', metalness: 0.3, roughness: 0.45, envMapIntensity: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3 }), 0.35),
    hair: rimify(new THREE.MeshStandardMaterial({ color: '#9a9a9a', vertexColors: true, metalness: 0.15, roughness: 0.75 }), 0.3, 0.55),
    // Ivory: slightly translucent, wet
    tooth: rimify(new THREE.MeshPhysicalMaterial({ color: BONE, metalness: 0, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 }), 0.15, 0.35),
    talon: rimify(new THREE.MeshPhysicalMaterial({ color: '#cfc6b3', metalness: 0, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.15, envMapIntensity: 0.45 }), 0.3, 0.25),
    limb: scaleMaterial(maps, { repeat: [7, 3], color: '#6a6a6a', normal: 1.3 }),
    toe: scaleMaterial(maps, { repeat: [3, 3], color: '#626262', normal: 1.6 }),
    sclera: new THREE.MeshStandardMaterial({ color: '#1a0e05', roughness: 0.35, metalness: 0.1 }),
    cornea: new THREE.MeshPhysicalMaterial({ color: '#000000', transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.5, depthWrite: false }),
    tongue: rimify(new THREE.MeshPhysicalMaterial({ color: '#7e3328', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35 }), 0, 0.4),
    mouth: new THREE.MeshStandardMaterial({ color: '#0e0603', roughness: 0.95 }),
    dark: new THREE.MeshBasicMaterial({ color: '#000000' }),
    eye: new THREE.MeshBasicMaterial({ color: ORANGE.clone(), toneMapped: false }),
    fin: rimify(new THREE.MeshPhysicalMaterial({ color: '#5a5a5a', metalness: 0.2, roughness: 0.5, envMapIntensity: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, side: THREE.DoubleSide }), 0.7, 0.7),
  };

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

  // arrive: eased intro progress along the track; leave: scroll exit progress; settle: 1 when coiled in
  // place (idle motion, cursor turn and leg pose fade in with it)
  const state = { sway: 0, breath: 0, snarl: 0, flex: 0, arrive: 1, leave: 0, settle: 1, legs: 1 };
  const radiusAt = s => bodyRadius(s, state.breath);

  // Dorsal plates: short, thick, jagged triangles
  const FINS = lite ? 26 : 46;
  const finGeo = new THREE.ConeGeometry(0.075, 0.22, lite ? 5 : 10, lite ? 5 : 8); finGeo.scale(1, 1, 0.45); finGeo.translate(0, 0.11, 0);
  { // bend each spike back toward the tail (local -Z) so it reads as a curved fin
    const fp = finGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i) / 0.22; fp.setZ(i, fp.getZ(i) - 0.16 * y * y); }
    finGeo.computeVertexNormals();
  }
  const fins = new THREE.InstancedMesh(finGeo, mats.fin, FINS); fins.frustumCulled = false;
  // Neck mane: tufts along the back of the neck, flowing toward the tail
  const NMANE = lite ? 12 : 26;
  const neckMane = new THREE.InstancedMesh(tuftGeometry(lite ? 4 : 6, true), mats.hair, NMANE); neckMane.frustumCulled = false;

  const { head, eyes, eyeballs, glass, jaw, beard, mane, cheeks } = buildHead(mats, lite);
  head.scale.setScalar(HEAD_SCALE);
  const headRoot = new THREE.Group(); headRoot.add(head); headRoot.matrixAutoUpdate = false;

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
  // Two front legs, one each side of the chest just behind the neck, both reaching toward the viewer
  const nearLeg = buildLeg(mats, lite), farLeg = buildLeg(mats, lite);

  const group = new THREE.Group();
  group.add(body, fins, neckMane, headRoot, nearLeg.group, farLeg.group, tailFan, tailFins);

  // ---- Spine: the track the body slides along, and the collision solver ----
  const track = createTrack();
  const Lb = track.restLength;
  const solve = createSolver(M, Lb);
  const nodeS = Float32Array.from({ length: M }, (_, i) => i / (M - 1));
  const nodeR = nodeS.map(s => bodyRadius(s));
  const Q = [], disp = [], Pn = [];
  for (let i = 0; i < M; i++) { Q.push(new THREE.Vector3()); disp.push(new THREE.Vector3()); Pn.push(new THREE.Vector3()); }
  const headCol = { offsets: HEAD_SPHERES.map(() => new THREE.Vector3()), side: 1 };
  const P = [], T = [], D = [], B = [];
  for (let i = 0; i <= L; i++) { P.push(new THREE.Vector3()); T.push(new THREE.Vector3()); D.push(new THREE.Vector3()); B.push(new THREE.Vector3()); }

  const v = new THREE.Vector3(), tmp = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const hx = new THREE.Vector3(), hy = new THREE.Vector3(), hz = new THREE.Vector3(), tA = new THREE.Vector3(), dA = new THREE.Vector3();
  const pivot = new THREE.Vector3(), joint = new THREE.Vector3(), headDown = new THREE.Vector3();
  const qId = new THREE.Quaternion(), qNeck = new THREE.Quaternion(), qHead = new THREE.Quaternion(), qT = new THREE.Quaternion(), eul = new THREE.Euler();
  const TRAVEL_DOWN = new THREE.Vector3(0, -0.3, -1).normalize(); // flying, the back faces the viewer
  // Front claws at rest: where each wrist reaches from its shoulder (in leg lengths), where its fingers
  // point, which way its palm faces and which way its elbow bends
  // The near (left) claw reaches toward the viewer; the far (right) claw rises over the far side of the
  // body, up and forward over the arch toward the head, on its own side
  const CLAW_NEAR = new THREE.Vector3(-0.55, -0.45, 1.0), CLAW_FAR = new THREE.Vector3(-1.2, 0.45, -0.15);
  const TOES_NEAR = new THREE.Vector3(-0.45, 0.8, 0.5).normalize(), TOES_FAR = new THREE.Vector3(-0.75, 0.65, 0.1).normalize();
  const PALM_NEAR = new THREE.Vector3(-0.2, -0.35, 1).normalize(), PALM_FAR = new THREE.Vector3(-0.45, 0.1, 0.9).normalize();
  const POLE_NEAR = new THREE.Vector3(0.4, -0.7, 0.1), POLE_FAR = new THREE.Vector3(0.5, -0.1, -0.85);
  const turn = { yaw: 0, pitch: 0 };
  let turning = false, trackStill = false, F_SIDE = 1;

  // Bend the neck toward the cursor: from its base, then the last stretch into the head, so the head is
  // carried on the neck and the nape stays seated in the skull
  const bend = (p, s, nape = true) => {
    if (!turning || s <= NECK_BASE) return p;
    qT.slerpQuaternions(qId, qNeck, smooth(s, NECK_BASE, 1));
    p.sub(pivot).applyQuaternion(qT).add(pivot);
    if (nape && s > NAPE_BEND) { qT.slerpQuaternions(qId, qHead, smooth(s, NAPE_BEND, 1)); p.sub(joint).applyQuaternion(qT).add(joint); }
    return p;
  };
  // Uniform Catmull-Rom between b and c
  const catmull = (a, b, c, d, w, out) => {
    const w2 = w * w, w3 = w2 * w;
    return out.set(
      0.5 * (2 * b.x + (c.x - a.x) * w + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * w2 + (3 * b.x - a.x - 3 * c.x + d.x) * w3),
      0.5 * (2 * b.y + (c.y - a.y) * w + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * w2 + (3 * b.y - a.y - 3 * c.y + d.y) * w3),
      0.5 * (2 * b.z + (c.z - a.z) * w + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * w2 + (3 * b.z - a.z - 3 * c.z + d.z) * w3));
  };
  // How far a plate can stick out from o along d before it would pierce another stretch of the body
  const plateRoom = (o, d, len, s) => {
    let best = len;
    for (let j = 0; j < M; j++) {
      if (Math.abs(nodeS[j] - s) * Lb < 1.4) continue;
      const rr = nodeR[j] + 0.03, ox = o.x - Pn[j].x, oy = o.y - Pn[j].y, oz = o.z - Pn[j].z;
      const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - rr * rr;
      if (b > 0 && cc > 0) continue;
      const disc = b * b - cc;
      if (disc <= 0) continue;
      best = Math.min(best, Math.max(0, -b - Math.sqrt(disc)));
    }
    return Math.max(len * 0.12, best);
  };

  function rebuild(t) {
    const st = state.settle;
    // Idle: a slow ripple along the coils and a little head bob, only while coiled in place
    if (st > 0 || !trackStill) {
      track.update(st > 0 ? (k, key) => {
        if (k === REST.length - 1) { key.x += Math.sin(state.sway * 0.5) * 0.04 * st; key.y += Math.sin(state.sway * 0.7) * 0.05 * st; }
        else key.z += Math.sin(state.sway * 0.45 + k * 0.9) * 0.06 * st;
      } : null);
      trackStill = st === 0;
    }
    // The head's place on the track: up from below the frame into the coil, then on along the exit loop
    const mk = track.marks;
    const u = mk.gateIn + (mk.restEnd - mk.gateIn) * state.arrive + (mk.gateOut + Lb - mk.restEnd) * state.leave;
    const at = (s, out) => track.pointAt(u - Lb * (1 - s), out);

    const yaw = turn.yaw * st, pitch = turn.pitch * st, rear = state.snarl * 0.12 * st;
    turning = Math.abs(yaw) + Math.abs(pitch) + rear > 1e-4;
    if (turning) {
      at(NECK_BASE, pivot);
      qNeck.setFromEuler(eul.set(-pitch * NECK_SHARE, yaw * NECK_SHARE, 0));
      qHead.setFromEuler(eul.set(-pitch * (1 - NECK_SHARE) - rear, yaw * (1 - NECK_SHARE), 0));
      bend(at(1, joint), 1, false);
    }
    for (let i = 0; i < M; i++) bend(at(nodeS[i], Q[i]), nodeS[i]);
    for (let i = 0; i <= L; i++) bend(at(i / L, P[i]), i / L);

    // Collisions: the body against the ring and itself, the head (placed on the neck end) against both
    headDown.copy(TRAVEL_DOWN).lerp(HEAD_DOWN, st).normalize();
    tA.subVectors(Q[M - 1], Q[M - 2]).normalize();
    dA.copy(headDown).addScaledVector(tA, -headDown.dot(tA));
    if (dA.lengthSq() < 1e-6) dA.set(0, 0, -1).addScaledVector(tA, -tA.z);
    headBasis(tA, dA.normalize(), hx, hy, hz);
    HEAD_SPHERES.forEach(([x, y, z], k) => headCol.offsets[k].set(0, 0, 0).addScaledVector(hx, x).addScaledVector(hy, y).addScaledVector(hz, z));
    headCol.side = Math.sign(Q[M - 1].z) || 1;
    solve(Q, nodeR, nodeS, headCol, disp);
    for (let i = 0; i < M; i++) Pn[i].copy(Q[i]).add(disp[i]);
    // Spread the corrections smoothly over every ring of the skin
    for (let i = 0; i <= L; i++) {
      const f = (i / L) * (M - 1), k = Math.min(M - 2, Math.floor(f));
      P[i].add(catmull(disp[Math.max(0, k - 1)], disp[k], disp[k + 1], disp[Math.min(M - 1, k + 2)], f - k, tmp));
    }
    bodyFrames(P, T, D, B, headDown);

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

    // Dorsal plates on the back, raked toward the tail, alternating heights for a jagged ridge. Where a
    // plate would reach into another coil it folds down short instead.
    const dir = new THREE.Vector3(), z = new THREE.Vector3(), base = new THREE.Vector3();
    for (let f = 0; f < FINS; f++) {
      const s = 0.06 + (f / (FINS - 1)) * 0.86, i = Math.round(s * L), r = radiusAt(s);
      dir.copy(D[i]).negate().addScaledVector(T[i], -0.35).normalize();
      z.crossVectors(B[i], dir).normalize();
      base.copy(P[i]).addScaledVector(D[i], -r * 0.86);
      const k = 1.6 * Math.max(0.35, r / 0.2) * (f % 2 ? 0.85 : 1);
      const h = plateRoom(base, dir, 0.24 * k, s) / (0.24 * k);
      m4.makeBasis(B[i].clone().multiplyScalar(0.45 * k), dir.clone().multiplyScalar(k * h), z.multiplyScalar(k * (0.4 + 0.6 * h))).setPosition(base);
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
    // While travelling the fan opens toward the viewer, so it never shows edge-on as a flat blade
    const tOut = T[0].clone().negate(), fanX = B[0].clone();
    if (st < 1) {
      v.crossVectors(T[0], VIEW);
      if (v.lengthSq() > 1e-4) {
        if (v.dot(fanX) < 0) v.negate();
        fanX.lerp(v.normalize(), 1 - st).addScaledVector(tOut, -fanX.dot(tOut)).normalize();
      }
    }
    tailFan.matrix.makeBasis(fanX, tOut, new THREE.Vector3().crossVectors(fanX, tOut).normalize()).setPosition(P[0]);
    tailFan.matrixWorldNeedsUpdate = true;
    for (const m of tailFan.children) m.rotation.z = m.userData.base + Math.sin(t * 1.5 + m.userData.base * 3) * 0.06;

    // Head on the end of the neck: its frame is the neck's end frame tipped by HEAD_TILT
    headBasis(T[L], D[L], hx, hy, hz);
    headRoot.matrix.makeBasis(hx, hy, hz).setPosition(P[L]);
    headRoot.matrixWorldNeedsUpdate = true;

    // ---- Front legs ----
    // Coiled in place: both claws reach toward the viewer from the top of the arch, one each side of the
    // body, open and grasping. Travelling (arriving or flying off): both reach forward with the body's
    // movement, claws pointing ahead.
    const ls = bodyRadius(FRONT) / 0.24, lg = state.legs, fi = Math.round(FRONT * L), r = radiusAt(FRONT);
    // 'Forward' is the way the body is moving at the shoulder (toward the head along the body)
    const fwdT = T[fi].clone();
    for (const [leg, side, reach, toesTo, palm, pole] of [
      [nearLeg, F_SIDE, CLAW_NEAR, TOES_NEAR, PALM_NEAR, POLE_NEAR],
      [farLeg, -F_SIDE, CLAW_FAR, TOES_FAR, PALM_FAR, POLE_FAR],
    ]) {
      const S = P[fi].clone().addScaledVector(B[fi], side * r * 0.8).addScaledVector(D[fi], r * 0.3);
      const tucked = S.clone().addScaledVector(T[fi], 0.85 * ls).addScaledVector(D[fi], 0.35 * ls).addScaledVector(B[fi], side * 0.3 * ls);
      const W = tucked.lerp(S.clone().addScaledVector(reach, ls), lg);
      // reaching forward, the elbow bends back toward the tail
      const k = solveElbow(S, W, 0.62 * ls, 0.56 * ls, fwdT.clone().negate().lerp(pole, lg));
      leg.pose(P[fi], S, k.E, k.W, fwdT.clone().lerp(toesTo, lg).normalize(), D[fi].clone().lerp(palm, lg).normalize(),
        THREE.MathUtils.lerp(0.15, 1.0 + state.flex * 0.5, lg), ls);
    }
  }

  // Which side of the chest faces the viewer at rest: the near claw goes there
  rebuild(0);
  F_SIDE = B[Math.round(FRONT * L)].z >= 0 ? 1 : -1;

  // Snarl every 6-8 s: jaw opens wider and the eyes flare
  let nextSnarl = 4, snarlStart = -10, lastT = null;
  const arriveEase = a => 1 - Math.pow(1 - a, 2.3);
  return {
    group, eyes, jaw, glass,
    eyeMaterial: mats.eye,
    // t: seconds; intro: 0..1 arrival progress (linear in time); look: {x,y} -1..1 smoothed pointer;
    // eyeTarget: world point the eyes should look at (the cursor, or the viewer); aim: {x,y} -1..1 raw
    // cursor target (0,0 = facing the viewer); leave: 0..1 scroll exit progress
    update(t, intro, look, still = false, eyeTarget = null, aim = null, leave = 0) {
      const dt = lastT === null ? 1 / 60 : THREE.MathUtils.clamp(t - lastT, 0, 0.1); lastT = t;
      const a = still ? 1 : THREE.MathUtils.clamp(intro, 0, 1);
      state.arrive = arriveEase(a);
      state.leave = still ? 0 : THREE.MathUtils.clamp(leave, 0, 1);
      state.settle = smooth(a, 0.78, 1) * (1 - smooth(state.leave, 0, 0.1));
      state.legs = smooth(a, 0.86, 1) * (1 - smooth(state.leave, 0, 0.06));
      group.visible = state.leave < 0.999;
      if (!group.visible) return;

      const ax = still || !aim ? 0 : THREE.MathUtils.clamp(aim.x, -1, 1), ay = still || !aim ? 0 : THREE.MathUtils.clamp(aim.y, -1, 1);
      const yawT = ax * THREE.MathUtils.degToRad(35), pitchT = ay * THREE.MathUtils.degToRad(20);
      const kTurn = still ? 1 : 1 - Math.exp(-dt * 4.2);
      turn.yaw += (yawT - turn.yaw) * kTurn; turn.pitch += (pitchT - turn.pitch) * kTurn;
      state.sway = still ? 0 : t;
      state.breath = still ? 0 : Math.sin(t * 1.15);
      if (!still && state.settle > 0.99 && t > nextSnarl) { snarlStart = t; nextSnarl = t + 6 + Math.random() * 2; }
      const sn = t - snarlStart;
      state.snarl = still ? 0 : (sn >= 0 && sn < 1.3 ? Math.sin((sn / 1.3) * Math.PI) : 0);
      // The claws flex now and then (a slow pulse)
      state.flex = still ? 0.2 : Math.pow(Math.max(0, Math.sin(t * 0.55)), 6);
      rebuild(t);

      if (eyeTarget) {
        group.updateMatrixWorld(true);
        for (const { socket, ball } of eyeballs) {
          const l = socket.worldToLocal(eyeTarget.clone());
          const yaw = THREE.MathUtils.clamp(Math.atan2(l.x, l.z), -0.6, 0.6);
          const pitch = THREE.MathUtils.clamp(-Math.atan2(l.y, Math.hypot(l.x, l.z)), -0.4, 0.4);
          const ke = still ? 1 : 1 - Math.exp(-dt * 7.5);
          ball.rotation.y += (yaw - ball.rotation.y) * ke;
          ball.rotation.x += (pitch - ball.rotation.x) * ke;
        }
      }
      jaw.rotation.x = 0.5 + state.snarl * 0.28 + (still ? 0 : Math.sin(t * 0.9) * 0.03);
      // Beard and mane sway a little
      for (const m of beard.children) m.rotation.x = m.userData.base + (still ? 0 : Math.sin(t * 1.4 + m.position.z * 9) * 0.06);
      mane.children.forEach((m, k) => m.quaternion.copy(m.userData.q0).multiply(qT.setFromAxisAngle(UP_X, still ? 0 : Math.sin(t * 1.2 + k * 0.8) * 0.08)));
      for (const m of cheeks.children) m.rotation.z = m.userData.base + (still ? 0 : Math.sin(t * 1.1 + m.position.y * 12) * 0.05);
    },
    setEyes(level) {
      // level 0..1: dark to lit; a snarl flares the glow
      mats.eye.color.copy(ORANGE).multiplyScalar((0.06 + level * 1.5) * (1 + state.snarl * 0.9));
    },
  };
}
