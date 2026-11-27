// Orange swirl clouds drifting behind the dragon, drawn like the curls in the logo.
import * as THREE from 'three';

function swirlTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  // A tight spiral curl with two trailing strokes, like a wayang cloud
  const spiral = (turns, r0, r1, w) => {
    g.lineWidth = w; g.beginPath();
    for (let k = 0; k <= 120; k++) {
      const t = k / 120, a = t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  };
  spiral(1.6, 2, size * 0.34, size * 0.05);
  g.globalAlpha = 0.55;
  spiral(1.1, size * 0.12, size * 0.44, size * 0.025);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createParticles({ clusters = 7 } = {}) {
  // Clouds gather in a few billowing clusters around the ring, like the logo: one large curl
  // with smaller ones tucked around it.
  const list = [];
  for (let c = 0; c < clusters; c++) {
    const a = (c / clusters) * Math.PI * 2 + Math.random() * 0.5, r = 1.95 + Math.random() * 0.7;
    const cx = Math.cos(a) * r, cy = Math.sin(a) * r, cz = -0.35 - Math.random() * 1.1;
    const n = 6 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const big = k === 0, d = big ? 0 : 0.18 + Math.random() * 0.42, t = Math.random() * Math.PI * 2;
      list.push([cx + Math.cos(t) * d, cy + Math.sin(t) * d * 0.8, cz - Math.random() * 0.25, big ? 1.15 + Math.random() * 0.35 : 0.3 + Math.random() * 0.5]);
    }
  }
  const count = list.length;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
  list.forEach(([x, y, z, sz], i) => { pos.set([x, y, z], i * 3); seed[i] = Math.random() * 100; size[i] = sz; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uFade: { value: 0 }, uMap: { value: swirlTexture() },
      uScale: { value: 1 }, uColor: { value: new THREE.Color('#FF9800').multiplyScalar(1.2) },
    },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aSize;
      uniform float uTime; uniform float uScale;
      varying float vRot; varying float vAlpha;
      void main() {
        vec3 p = position;
        // slow orbit around the ring centre plus a gentle rise
        float a = uTime * 0.018;
        p.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xy;
        p.y += sin(uTime * 0.3 + aSeed) * 0.12;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale * 520.0 / -mv.z;
        vRot = aSeed + uTime * (0.08 + 0.1 * fract(aSeed * 7.0)) * (mod(aSeed, 2.0) > 1.0 ? 1.0 : -1.0);
        vAlpha = 0.55 + 0.45 * fract(aSeed * 3.7);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uFade;
      varying float vRot; varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        c = mat2(cos(vRot), -sin(vRot), sin(vRot), cos(vRot)) * c;
        float m = texture2D(uMap, c + 0.5).a;
        if (m < 0.02) discard;
        gl_FragColor = vec4(uColor, m * vAlpha * uFade * 0.9);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(t, fade, scale) { mat.uniforms.uTime.value = t; mat.uniforms.uFade.value = fade; mat.uniforms.uScale.value = scale; },
  };
}
