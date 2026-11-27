// The dragon's spine: one long track the body slides along, and a solver that keeps the body clear
// of the ring and of its own coils.
//
// The track runs from far below the frame, up into the coil around the ring (the rest pose, tail to
// head), then out of the head into a loop that spirals away to the left. The body always occupies a
// stretch of the track as long as itself, so moving that stretch forward makes every part of the body
// pass where the head has been, like a snake. The intro (rise from below and coil in) and the scroll
// exit (loop away to the left) therefore follow the same collision-free path. The solver handles what
// the track alone cannot: the head is wider than the body, and the idle ripple and the cursor turn bend
// the body off the track.
import * as THREE from 'three';

const smooth = THREE.MathUtils.smoothstep;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The ring band the body keeps clear of (z = 0): inner edge of the outer ring to the outer edge of the inner ring
export const RING_IN = 2.0 - 0.022, RING_OUT = 2.17 + 0.009;
const RING_GAP = 0.07, SELF_GAP = 0.09, HEAD_GAP = 0.1; // the head spheres are rough, so it keeps more room

// Body radius along the body, s = 0 tail .. 1 head. The neck widens again into the back of the skull.
export function bodyRadius(s, breath = 0) {
  const base = 0.04 + 0.2 * smooth(s, 0, 0.38);
  const chest = 0.036 * Math.exp(-(((s - 0.72) / 0.1) ** 2)) * (1 + breath * 0.7);
  return (base + chest) * 1.1 * (1 - 0.05 * smooth(s, 0.86, 0.94)) + 0.05 * smooth(s, 0.94, 1);
}

// Rest pose, tail (lower left) to head (upper left): the body sweeps along the bottom in front of the
// ring, rises behind it on the right, passes behind the ring into the centre, loops low, crosses behind
// the ring again, climbs outside it on the right into an arch over the top, and the neck comes down to
// the head, which faces the viewer. Every crossing of the ring or of the body has room for both.
export const REST = [
  [-2.70, -2.55, 0.35], [-1.75, -2.45, 0.60], [-0.35, -2.45, 0.85], [1.15, -2.15, 0.60], [2.30, -1.40, -0.46],
  [2.84, -0.32, -0.50], [2.50, 0.63, 0.22], [1.38, 0.76, 0.57], [0.29, 0.15, 0.73], [-0.00, -0.85, 0.45],
  [0.80, -1.31, -0.34], [1.87, -0.53, -0.84], [2.78, 0.89, -0.70], [2.41, 2.05, 0.47], [1.10, 2.75, 0.60],
  [-0.25, 2.55, 0.75], [-1.31, 2.25, 0.99], [-1.73, 1.87, 1.37], [-1.80, 1.35, 1.80],
].map(k => V(...k));
// Direction the neck travels into the head at rest (down toward the viewer); sets the head's facing
export const NECK_END = V(-0.306, -0.724, 0.618).normalize();

// Up from far below the frame (x = -4.7, under the "ENDLESS" headline), then a quarter turn into the
// tail, which points right along the bottom. GATE_IN is where the head waits before the intro: below the frame.
function entryKeys() {
  return [V(-4.7, -40, 0.6), V(-4.7, -26, 0.6), V(-4.7, -14, 0.6), V(-4.7, -8.5, 0.6), V(-4.7, -5.6, 0.57),
    V(-4.48, -3.9, 0.47), V(-3.72, -2.82, 0.38)];
}
const GATE_IN = 3; // index into entryKeys

// Out of the head: down and to the left, then a full clockwise loop facing the viewer (left, up, over,
// down), widening as it goes and drifting toward the viewer so the second pass clears the first, then
// straight off to the left. GATE_OUT is past the left edge of the frame on any screen.
function exitKeys(head) {
  const out = [], step = 0.34;
  let x = head.x, y = head.y, z = head.z, th = Math.atan2(NECK_END.y, NECK_END.x), turned = 0, s = 0;
  if (th < 0) th += Math.PI * 2; // heading as 0..2pi, so turning down to pi means heading left
  const total = th - Math.PI + Math.PI * 2; // clockwise from the neck's heading round to heading left, plus a full turn
  const climb = NECK_END.z / Math.hypot(NECK_END.x, NECK_END.y); // z per unit of on-screen travel at the start
  while (turned < total) {
    const R = 1.25 + 1.6 * Math.exp(-turned / 0.55) + 0.55 * (turned / total);
    const d = Math.min(step / R, total - turned);
    th -= d; turned += d; s += step;
    x += Math.cos(th) * step; y += Math.sin(th) * step;
    z = head.z + climb * 1.6 * (1 - Math.exp(-s / 1.6));
    out.push(V(x, y, z));
  }
  for (const gx of [-17, -26, -42, -70]) out.push(V(Math.min(gx, x - 3), y, z));
  return { keys: out, gate: out.length - 4 };
}

// ---------- Track ----------
export function createTrack({ divisions = 2400 } = {}) {
  const entry = entryKeys();
  const exit = exitKeys(REST[REST.length - 1]);
  const keys = [...entry, ...REST, ...exit.keys].map(k => k.clone());
  const restBase = REST.map(k => k.clone());
  const i0 = entry.length, i1 = entry.length + REST.length - 1;
  const iGateIn = GATE_IN, iGateOut = i1 + 1 + exit.gate;
  const curve = new THREE.CatmullRomCurve3(keys, false, 'centripetal');
  const n = keys.length - 1;
  const len = new Float32Array(divisions + 1), a = new THREE.Vector3(), b = new THREE.Vector3();
  const marks = { total: 0, restStart: 0, restEnd: 0, gateIn: 0, gateOut: 0 };
  const arcOfKey = k => {
    const f = (k / n) * divisions, lo = Math.floor(f), hi = Math.min(divisions, lo + 1);
    return len[lo] + (len[hi] - len[lo]) * (f - lo);
  };
  function measure() {
    curve.getPoint(0, a); len[0] = 0;
    for (let p = 1; p <= divisions; p++) { curve.getPoint(p / divisions, b); len[p] = len[p - 1] + b.distanceTo(a); a.copy(b); }
    marks.total = len[divisions];
    marks.restStart = arcOfKey(i0); marks.restEnd = arcOfKey(i1);
    marks.gateIn = arcOfKey(iGateIn); marks.gateOut = arcOfKey(iGateOut);
  }
  measure();
  const restLength = marks.restEnd - marks.restStart;
  return {
    marks, restLength, keys, restBase, i0, i1, curve,
    // offset(i, out): per rest key displacement (ripple, head bob); null resets to the rest pose
    update(offset) {
      for (let k = 0; k < REST.length; k++) {
        keys[i0 + k].copy(restBase[k]);
        if (offset) offset(k, keys[i0 + k]);
      }
      measure();
    },
    // Point at arc length sigma along the track (clamped to the ends)
    pointAt(sigma, out) {
      const target = THREE.MathUtils.clamp(sigma, 0, marks.total);
      let lo = 0, hi = divisions;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (len[mid] < target) lo = mid + 1; else hi = mid; }
      const i = Math.max(1, lo), seg = len[i] - len[i - 1];
      const t = (i - 1 + (seg > 0 ? (target - len[i - 1]) / seg : 0)) / divisions;
      return curve.getPoint(t, out);
    },
  };
}

// ---------- Body frames ----------
// T tangent, D belly, B side. The back (dorsal plates, mane) faces up and away from the ring centre, a
// little toward the viewer; the frame follows that target smoothly from the tail, and near the head the
// belly turns down so the head sits upright.
export const HEAD_DOWN = V(0, -1, 0.25).normalize();
// headDown: where the belly faces right behind the head (defaults to down and a little toward the viewer)
export function bodyFrames(P, T, D, B, headDown = HEAD_DOWN) {
  const L = P.length - 1, want = new THREE.Vector3(), outv = new THREE.Vector3();
  for (let i = 0; i <= L; i++) T[i].subVectors(P[Math.min(L, i + 1)], P[Math.max(0, i - 1)]).normalize();
  for (let i = 0; i <= L; i++) {
    outv.set(P[i].x, P[i].y, 0); if (outv.lengthSq() > 1e-6) outv.normalize();
    want.set(0, 1, 0).addScaledVector(outv, 0.8); want.z += 0.25; want.negate();
    want.addScaledVector(T[i], -want.dot(T[i]));
    if (want.lengthSq() < 1e-4) want.copy(i ? D[i - 1] : V(0, -1, 0));
    want.normalize();
    if (i === 0) { D[0].copy(want); continue; }
    D[i].copy(D[i - 1]).addScaledVector(T[i], -D[i - 1].dot(T[i]));
    if (D[i].lengthSq() < 1e-8) D[i].copy(want);
    D[i].normalize().lerp(want, 0.12).normalize();
  }
  for (let i = 0; i <= L; i++) {
    const w = smooth(i / L, 0.9, 0.99);
    if (w > 0) {
      want.copy(headDown).addScaledVector(T[i], -headDown.dot(T[i]));
      if (want.lengthSq() > 1e-4) D[i].lerp(want.normalize(), w);
      D[i].addScaledVector(T[i], -D[i].dot(T[i])).normalize();
    }
    B[i].crossVectors(T[i], D[i]).normalize();
  }
}

// The head sits on the end of the neck. Its forward is the neck direction tipped up toward the back by
// HEAD_TILT, so the neck always enters the skull at the same place (the nape) and the head moves with it.
export const HEAD_TILT = THREE.MathUtils.degToRad(32);
export function headBasis(T, D, X, Y, Z) {
  const c = Math.cos(HEAD_TILT), s = Math.sin(HEAD_TILT);
  Z.copy(T).multiplyScalar(c).addScaledVector(D, -s).normalize();
  Y.copy(D).multiplyScalar(-c).addScaledVector(T, -s).normalize();
  X.crossVectors(Y, Z).normalize();
}
// Spheres that stand in for the head when checking collisions: [x, y, z, radius] in the head frame
export const HEAD_SPHERES = [[0, 0.1, -0.05, 0.6], [0, 0.05, 0.62, 0.4], [0, 0.08, 1.15, 0.28], [0, -0.58, 0.55, 0.3]];

// ---------- Collision solver ----------
// Nodes q (targets) are moved to p: out of the ring band, apart from each other, and the head spheres
// (riding on the last node) out of both. Corrections are smoothed along the body so it bends instead of
// kinking. Stateless: the same targets always give the same result, whatever the frame rate.
export function createSolver(n, arcLen) {
  const dx = new Float32Array(n), dy = new Float32Array(n), dz = new Float32Array(n);
  const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  const hc = HEAD_SPHERES.map(() => new THREE.Vector3());
  let pairs = null;
  const ring = (x, y, z, r, side, out) => {
    // closest point of the band to (x, y, z), and the push that clears it by r
    const rho = Math.hypot(x, y), cr = THREE.MathUtils.clamp(rho, RING_IN, RING_OUT);
    const ux = rho > 1e-6 ? x / rho : 1, uy = rho > 1e-6 ? y / rho : 0;
    let ex = x - ux * cr, ey = y - uy * cr, ez = z;
    let d = Math.hypot(ex, ey, ez);
    if (d >= r) return false;
    if (d < 1e-5) { ex = 0; ey = 0; ez = side; d = 1; }
    const k = (r - d) / d;
    out.x = ex * k; out.y = ey * k; out.z = ez * k;
    return true;
  };
  const push = new THREE.Vector3();
  const smoothField = () => {
    for (const f of [dx, dy, dz]) {
      for (let pass = 0; pass < 2; pass++) {
        let prev = f[0];
        for (let i = 1; i < n - 1; i++) { const cur = f[i]; f[i] = (prev + 2 * cur + f[i + 1]) * 0.25; prev = cur; }
        f[n - 1] = (f[n - 1] * 3 + f[n - 2]) * 0.25; f[0] = (f[0] * 3 + f[1]) * 0.25;
      }
    }
  };
  // q: Vector3 targets; r: radii; head: { offsets: Vector3[] (world offsets of HEAD_SPHERES from the last node), side }
  // Writes the displacement of node i into disp[i]
  return function solve(q, r, s, head, disp, { iterations = 9, settleIterations = 3 } = {}) {
    if (!pairs) {
      // Pairs of nodes far enough apart along the body to be able to touch
      pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if ((s[j] - s[i]) * arcLen > (r[i] + r[j]) * 1.6 + 0.6) pairs.push(i, j);
      }
      pairs = Int32Array.from(pairs);
    }
    dx.fill(0); dy.fill(0); dz.fill(0);
    const last = n - 1;
    for (let it = 0; it < iterations + settleIterations; it++) {
      for (let i = 0; i < n; i++) { px[i] = q[i].x + dx[i]; py[i] = q[i].y + dy[i]; pz[i] = q[i].z + dz[i]; }
      sx.fill(0); sy.fill(0); sz.fill(0);
      // Ring
      for (let i = 0; i < n; i++) {
        if (ring(px[i], py[i], pz[i], r[i] + RING_GAP, Math.sign(q[i].z) || 1, push)) { sx[i] += push.x; sy[i] += push.y; sz[i] += push.z; }
      }
      // Body against body
      for (let k = 0; k < pairs.length; k += 2) {
        const i = pairs[k], j = pairs[k + 1], min = r[i] + r[j] + SELF_GAP;
        const ex = px[i] - px[j]; if (ex > min || ex < -min) continue;
        const ey = py[i] - py[j]; if (ey > min || ey < -min) continue;
        const ez = pz[i] - pz[j];
        const d2 = ex * ex + ey * ey + ez * ez;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4, h = (min - d) / d * 0.5;
        sx[i] += ex * h; sy[i] += ey * h; sz[i] += ez * h;
        sx[j] -= ex * h; sy[j] -= ey * h; sz[j] -= ez * h;
      }
      // Head against the ring and against the body (the neck itself excluded)
      if (head) {
        for (let h = 0; h < HEAD_SPHERES.length; h++) {
          const hr = HEAD_SPHERES[h][3];
          hc[h].set(px[last], py[last], pz[last]).add(head.offsets[h]);
          if (ring(hc[h].x, hc[h].y, hc[h].z, hr + HEAD_GAP, head.side, push)) { sx[last] += push.x; sy[last] += push.y; sz[last] += push.z; }
          for (let j = 0; j < n; j++) {
            if (s[j] > 0.8) break;
            const min = hr + r[j] + HEAD_GAP;
            const ex = hc[h].x - px[j], ey = hc[h].y - py[j], ez = hc[h].z - pz[j];
            const d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2) || 1e-4, k = (min - d) / d * 0.5;
            sx[last] += ex * k; sy[last] += ey * k; sz[last] += ez * k;
            sx[j] -= ex * k; sy[j] -= ey * k; sz[j] -= ez * k;
          }
        }
      }
      for (let i = 0; i < n; i++) { dx[i] += sx[i]; dy[i] += sy[i]; dz[i] += sz[i]; }
      if (it < iterations) smoothField();
    }
    for (let i = 0; i < n; i++) disp[i].set(dx[i], dy[i], dz[i]);
  };
}
