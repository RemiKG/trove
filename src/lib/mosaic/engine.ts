// @ts-nocheck
/* Trove mosaic engine — a deterministic photomosaic renderer. Every tessera is placed by code:
   a hand-authored vector base face is drawn to an offscreen canvas, sampled through a jittered
   tile grid, and each tile SNAPPED to a locked ~22-colour palette — a genuine photomosaic
   construction, seed-locked and reproducible, so the SAME person renders the SAME face on every
   recall (persistence made visible). Surface = status: unset → set → gilded (canon) → dusted
   (forgetting) → lit (recalled). Client-only (uses <canvas>).

   Typing is disabled (@ts-nocheck) for this self-contained renderer's untyped graphics code;
   the app's own logic is strictly typed. */

export const P = {
  plaster: '#EDE6D8', plasterHi: '#F6F1E7', plasterLo: '#E3DAC8', plaster2: '#D8CDB8', limewash: '#CFC3AC',
  grout: '#3B322A', grout70: '#5C5142', grout45: '#8B7E6A',
  gold: '#C9A227', goldHi: '#F0D888', goldMid: '#DFC066', goldCore: '#9A7A1E', goldDeep: '#7A5E12', goldSoft: '#E7D6A6',
  terra: '#B5643C', terraHi: '#CE8763', terraLo: '#8E4A2A',
  lapis: '#26456E', lapisHi: '#3E6296', lapisLo: '#1A3050',
  ash: '#9E978C', ashHi: '#B8B1A6', ashLo: '#837C72',
  unset: '#E4DBC9', unsetHi: '#EFE7D7',
};

/* deterministic RNG so every asset is seed-locked / reproducible */
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x9e3779b9; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ---------- the mosaic tessera palette (what tiles snap to) ---------- */
const SNAP = [
  { c: [201, 162, 39], role: 'gold', key: 'gold' },
  { c: [223, 192, 102], role: 'gold', key: 'goldMid' },
  { c: [240, 216, 136], role: 'gold', key: 'goldHi' },
  { c: [154, 122, 30], role: 'gold', key: 'goldCore' },
  { c: [236, 217, 178], role: 'flesh', key: 'cream' },
  { c: [214, 166, 116], role: 'flesh', key: 'fleshHi' },
  { c: [198, 144, 95], role: 'flesh', key: 'flesh' },
  { c: [182, 124, 80], role: 'flesh', key: 'fleshWarm' },
  { c: [154, 120, 78], role: 'flesh', key: 'olive' },
  { c: [124, 98, 64], role: 'flesh', key: 'fleshShadow' },
  { c: [92, 74, 52], role: 'flesh', key: 'deepShadow' },
  { c: [181, 100, 60], role: 'terra', key: 'terra' },
  { c: [206, 135, 99], role: 'terra', key: 'terraHi' },
  { c: [142, 74, 42], role: 'terra', key: 'terraLo' },
  { c: [38, 69, 110], role: 'lapis', key: 'lapis' },
  { c: [62, 98, 150], role: 'lapis', key: 'lapisHi' },
  { c: [26, 48, 80], role: 'lapis', key: 'lapisLo' },
  { c: [236, 220, 196], role: 'ivory', key: 'ivory' },
  { c: [210, 198, 176], role: 'ivory', key: 'ivoryLo' },
  { c: [196, 189, 172], role: 'ivory', key: 'silver' },
  { c: [59, 50, 42], role: 'dark', key: 'dark' },
  { c: [86, 72, 58], role: 'dark', key: 'darkHi' },
];
export function snap(r, g, b) {
  let best = SNAP[0], bd = 1e9;
  for (const s of SNAP) { const dr = r - s.c[0], dg = g - s.c[1], db = b - s.c[2];
    const d = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
    if (d < bd) { bd = d; best = s; } }
  return best;
}
const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
function jitterRGB(a, k) { return [clamp(a[0] + k), clamp(a[1] + k), clamp(a[2] + k)]; }
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function clampf(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/* ---------- shared <defs>: gold-leaf gradients, glint + dust filters, plaster grain ---------- */
export function defs() {
  return `<svg class="mos-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="leafA" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${P.goldHi}"/><stop offset="46%" stop-color="${P.gold}"/><stop offset="100%" stop-color="${P.goldCore}"/></linearGradient>
    <linearGradient id="leafB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${P.goldMid}"/><stop offset="55%" stop-color="${P.gold}"/><stop offset="100%" stop-color="${P.goldDeep}"/></linearGradient>
    <linearGradient id="leafC" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="#FBEFC0"/><stop offset="50%" stop-color="${P.goldHi}"/><stop offset="100%" stop-color="${P.gold}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${P.goldHi}" stop-opacity=".95"/>
      <stop offset="38%" stop-color="${P.gold}" stop-opacity=".5"/>
      <stop offset="100%" stop-color="${P.gold}" stop-opacity="0"/></radialGradient>
    <radialGradient id="haloGrad" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#F2DD9A" stop-opacity=".55"/>
      <stop offset="70%" stop-color="${P.gold}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vign" cx="50%" cy="44%" r="74%">
      <stop offset="58%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2c2114" stop-opacity=".17"/></radialGradient>
    <filter id="soft" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="dust" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.59  0 0 0 0 0.55  0 0 0 0.6 0" result="c"/>
      <feComposite operator="in" in2="SourceGraphic"/></filter>
    <filter id="grainTex" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.25 0 0 0 0 0.17  0 0 0 0.5 0"/>
      <feComposite operator="in" in2="SourceGraphic"/></filter>
    <filter id="trowel" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>
  </defs></svg>`;
}

/* ---------- limewashed plaster ground ---------- */
export function plaster(w, h, opts = {}) {
  const seed = opts.seed || 21, r = rng(seed), rad = opts.radius == null ? 0 : opts.radius;
  let bloom = '';
  const n = opts.bloom == null ? Math.round((w * h) / 60000) : opts.bloom;
  for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, rr = 20 + r() * 90, o = .02 + r() * .05;
    const col = r() > .5 ? '#FBF6EA' : '#DFD3BC';
    bloom += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="${col}" opacity="${o.toFixed(3)}"/>`; }
  let sweeps = '';
  for (let i = 0; i < Math.round(h / 90); i++) { const y = r() * h, o = .03 + r() * .05;
    sweeps += `<path d="M0 ${y.toFixed(0)} Q ${w * 0.5} ${(y + (r() - .5) * 30).toFixed(0)} ${w} ${(y + (r() - .5) * 20).toFixed(0)}" fill="none" stroke="#CFC3AC" stroke-width="${(8 + r() * 18).toFixed(0)}" opacity="${o.toFixed(3)}"/>`; }
  return `<svg class="plaster" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
    <rect width="${w}" height="${h}" rx="${rad}" fill="${P.plaster}"/>
    <g filter="url(#trowel)">${sweeps}${bloom}</g>
    <rect width="${w}" height="${h}" rx="${rad}" fill="#3b322a" opacity="${opts.grain == null ? 0.32 : opts.grain}" filter="url(#grainTex)"/>
    <rect width="${w}" height="${h}" rx="${rad}" fill="url(#vign)"/>
  </svg>`;
}

/* ---------- one tessera cell ---------- */
export function cellQuad(x, y, w, h, gap, jit, rf) {
  const g = gap / 2;
  const j = () => (rf() - .5) * 2 * jit;
  return [[x + g + j(), y + g + j()], [x + w - g + j(), y + g + j()], [x + w - g + j(), y + h - g + j()], [x + g + j(), y + h - g + j()]];
}
const dPoly = (p) => 'M' + p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ') + ' Z';
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }

/* render a single tile polygon in a given state */
export function tile(p, state, fill, rf, opts = {}) {
  const d = dPoly(p), c = centroid(p);
  if (state === 'unset') {
    const col = rf() > .5 ? P.unset : P.unsetHi;
    return `<g><path d="${dPoly(p.map((q) => [q[0] + 1.1, q[1] + 1.6]))}" fill="#00000022"/>`
      + `<path d="${d}" fill="${col}"/>`
      + `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="0.8" opacity=".5"/></g>`;
  }
  if (state === 'dust') {
    const base = jitterRGB([158, 151, 140], (rf() - .5) * 16);
    return `<g opacity="${(0.5 + rf() * 0.22).toFixed(2)}"><path d="${d}" fill="${rgb(base)}"/>`
      + `<path d="${d}" fill="${P.ashHi}" opacity=".5" filter="url(#dust)"/></g>`;
  }
  if (state === 'gild') {
    const r = rf();
    const grad = r < 0.2 ? 'leafC' : r < 0.72 ? 'leafA' : 'leafB';
    const flat = r > 0.86 ? P.goldHi : (r < 0.1 ? P.goldCore : null);
    const body = flat ? `<path d="${d}" fill="${flat}"/>` : `<path d="${d}" fill="url(#${grad})"/>`;
    const glint = rf() > 0.8 ? `<path d="${dPoly([p[0], [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2], [(p[0][0] + c[0]) / 2, (p[0][1] + c[1]) / 2]])}" fill="#FFF7DC" opacity=".55"/>` : '';
    return `<g>${body}${glint}</g>`;
  }
  if (state === 'lit') {
    return `<g><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(opts.litR || 16)}" fill="url(#glow)"/>`
      + `<path d="${d}" fill="url(#leafC)"/>`
      + `<path d="${dPoly([p[0], [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2], [(p[0][0] + c[0]) / 2, (p[0][1] + c[1]) / 2]])}" fill="#FFFBEA" opacity=".8"/></g>`;
  }
  // 'set'
  const f = jitterRGB(fill, (rf() - .5) * 14);
  const hi = [clamp(f[0] + 22), clamp(f[1] + 20), clamp(f[2] + 16)];
  const lo = [clamp(f[0] - 26), clamp(f[1] - 24), clamp(f[2] - 20)];
  const topEdge = `<path d="M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} L ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}" stroke="${rgb(hi)}" stroke-width="1" opacity=".55"/>`;
  const botEdge = `<path d="M${p[3][0].toFixed(1)} ${p[3][1].toFixed(1)} L ${p[2][0].toFixed(1)} ${p[2][1].toFixed(1)}" stroke="${rgb(lo)}" stroke-width="1" opacity=".5"/>`;
  return `<g><path d="${d}" fill="${rgb(f)}"/>${topEdge}${botEdge}</g>`;
}

/* a standalone single tessera (for legends, chips) */
export function tessera(state = 'gild', opts = {}) {
  const s = opts.size || 64, seed = opts.seed || 7, r = rng(seed), pad = s * 0.1;
  const p = cellQuad(pad, pad, s - 2 * pad, s - 2 * pad, s * 0.06, s * 0.05, r);
  const fill = opts.fill || [198, 144, 95];
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" style="overflow:visible;display:block">`
    + (state === 'gild' || state === 'lit' ? `<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.5}" fill="url(#glow)" opacity="${state === 'lit' ? .9 : .5}"/>` : '')
    + `<rect x="${pad - 2}" y="${pad - 2}" width="${s - 2 * pad + 4}" height="${s - 2 * pad + 4}" fill="${P.grout}" opacity="${state === 'unset' ? 0 : .9}" rx="2"/>`
    + tile(p, state, fill, r, { litR: s * 0.34 }) + `</svg>`;
}

/* ===================================================================================
   THE PORTRAIT — a life reconstructed as a mosaic, coalescing from the centre.
   =================================================================================== */
export function portrait(opts = {}) {
  if (typeof document === 'undefined') return ''; // client-only (needs <canvas>)
  const W = opts.w || 760, H = opts.h || 920, seed = opts.seed || 42;
  const coverage = opts.coverage == null ? 1 : opts.coverage;
  const CW = 820, CH = Math.round(CW * H / W);
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const ctx = cv.getContext('2d');
  (FACES[opts.face || 'nana'])(ctx, CW, CH);
  const img = ctx.getImageData(0, 0, CW, CH).data;
  const sx = CW / W, sy = CH / H;
  const sample = (x, y) => { let ix = Math.round(x * sx), iy = Math.round(y * sy); ix = ix < 0 ? 0 : ix >= CW ? CW - 1 : ix; iy = iy < 0 ? 0 : iy >= CH ? CH - 1 : iy; const o = (iy * CW + ix) * 4; return [img[o], img[o + 1], img[o + 2]]; };

  const D = (FACES[opts.face || 'nana']).detail(W, H);
  const inDetail = (x, y) => ((x - D.cx) / D.rx) ** 2 + ((y - D.cy) / D.ry) ** 2 <= 1;
  const cxc = W * 0.5, cyc = H * 0.42, maxR = Math.hypot(W, H) * 0.60;
  const dustList = opts.dust || []; const litList = opts.lit || [];
  const near = (x, y, list, rad) => { for (const q of list) { if (Math.hypot(x - q.x, y - q.y) <= (q.r || rad || 30)) return true; } return false; };

  const parts = [];
  function emit(T, insideTest, skipDetail) {
    for (let y = 0; y < H; y += T) {
      const row = Math.round(y / T);
      const off = (row % 2 ? T * 0.5 : 0) + (hash2(row, 7) - .5) * T * 0.16;
      for (let x = -T; x < W + T; x += T) {
        const cx = x + off + T / 2, cy = y + T / 2;
        if (cx < -1 || cx > W + 1 || cy < 0 || cy > H) continue;
        if (insideTest) { if (!inDetail(cx, cy)) continue; }
        else if (skipDetail && inDetail(cx, cy)) continue;
        const rf = rng((Math.round(cx) * 131 + Math.round(cy) * 977 + seed) >>> 0);
        const p = cellQuad(x + off, y, T, T, Math.max(1.4, T * 0.11), T * 0.11, rf);
        const s = sample(cx, cy);
        const sn = snap(s[0], s[1], s[2]);
        let state;
        if (near(cx, cy, dustList, 34)) state = 'dust';
        else if (near(cx, cy, litList, 26)) state = 'lit';
        else if (coverage >= 1) {
          state = (sn.role === 'gold') ? (opts.gildGround === false ? 'set' : 'gild') : 'set';
        } else {
          const rr = Math.hypot(cx - cxc, cy - cyc) / maxR;
          const pp = clampf(coverage * 1.18 - rr * 0.62);
          const hv = hash2(Math.round(cx) + 3, Math.round(cy) + 11);
          if (hv < pp) { state = (sn.role === 'gold') ? (opts.gildGround === false ? 'set' : 'gild') : 'set'; }
          else if (hv < pp + 0.20 && rr < coverage + 0.42) state = 'unset';
          else continue;
        }
        let fill = sn.c;
        if (state === 'gild' && sn.role !== 'gold') fill = [201, 162, 39];
        parts.push(tile(p, state, fill, rf, { litR: T * 1.0 }));
      }
    }
  }
  const T = opts.tile || 16, Tf = Math.max(5, Math.round(T * 0.5));
  emit(T, null, true);
  emit(Tf, true, false);

  const halo = `<circle cx="${(W * 0.5).toFixed(0)}" cy="${(H * 0.40).toFixed(0)}" r="${(W * 0.54).toFixed(0)}" fill="url(#haloGrad)"/>`;
  return `<svg class="mosaic" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">
    <rect width="${W}" height="${H}" fill="${P.grout}"/>
    ${halo}
    ${parts.join('')}
    <rect width="${W}" height="${H}" fill="url(#vign)"/>
  </svg>`;
}

/* ---------- the hand-authored vector BASE FACE (drawn to canvas, then tessellated) ---------- */
const FACES = {
  nana(ctx, W, H) {
    const cx = W * 0.5;
    ctx.fillStyle = '#C9A227'; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(cx, H * 0.40, W * 0.05, cx, H * 0.42, W * 0.66);
    g.addColorStop(0, '#E2C56B'); g.addColorStop(0.55, '#C9A227'); g.addColorStop(1, '#9A7A1E');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#26456E';
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * 0.94);
    ctx.quadraticCurveTo(W * 0.16, H * 0.75, W * 0.34, H * 0.72);
    ctx.quadraticCurveTo(cx, H * 0.67, W * 0.66, H * 0.72);
    ctx.quadraticCurveTo(W * 0.84, H * 0.75, W, H * 0.94); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1A3050';
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * 0.94); ctx.quadraticCurveTo(W * 0.14, H * 0.80, W * 0.28, H * 0.76); ctx.lineTo(W * 0.24, H); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H); ctx.lineTo(W, H * 0.94); ctx.quadraticCurveTo(W * 0.86, H * 0.80, W * 0.72, H * 0.76); ctx.lineTo(W * 0.76, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3E6296';
    ctx.beginPath(); ctx.moveTo(W * 0.42, H * 0.745); ctx.quadraticCurveTo(cx, H * 0.705, W * 0.58, H * 0.745); ctx.lineTo(W * 0.54, H * 0.87); ctx.quadraticCurveTo(cx, H * 0.83, W * 0.46, H * 0.87); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#BE895C';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.085, H * 0.585); ctx.lineTo(cx + W * 0.085, H * 0.585); ctx.lineTo(cx + W * 0.095, H * 0.70); ctx.lineTo(cx - W * 0.095, H * 0.70); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8A6A46';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.085, H * 0.585); ctx.lineTo(cx - W * 0.02, H * 0.60); ctx.lineTo(cx - W * 0.03, H * 0.69); ctx.lineTo(cx - W * 0.095, H * 0.70); ctx.closePath(); ctx.fill();
    const cy0 = H * 0.665;
    for (let i = -3; i <= 3; i++) { const gx = cx + i * W * 0.05, gy = cy0 + Math.abs(i) * H * 0.006;
      ctx.fillStyle = (i % 2 === 0) ? '#C9A227' : (i % 3 === 0 ? '#26456E' : '#B5643C');
      ctx.beginPath(); ctx.arc(gx, gy, W * 0.02, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7A5E12'; ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.fillStyle = '#B5643C';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.395, W * 0.285, H * 0.30, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - W * 0.285, H * 0.40); ctx.quadraticCurveTo(cx - W * 0.33, H * 0.60, cx - W * 0.25, H * 0.73); ctx.lineTo(cx - W * 0.10, H * 0.66); ctx.quadraticCurveTo(cx - W * 0.16, H * 0.52, cx - W * 0.145, H * 0.42); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + W * 0.285, H * 0.40); ctx.quadraticCurveTo(cx + W * 0.33, H * 0.60, cx + W * 0.25, H * 0.73); ctx.lineTo(cx + W * 0.10, H * 0.66); ctx.quadraticCurveTo(cx + W * 0.16, H * 0.52, cx + W * 0.145, H * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8E4A2A';
    ctx.beginPath(); ctx.ellipse(cx - W * 0.215, H * 0.32, W * 0.06, H * 0.12, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + W * 0.215, H * 0.32, W * 0.06, H * 0.12, 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#CE8763';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.165, W * 0.135, H * 0.055, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = W * 0.02;
    ctx.beginPath(); ctx.ellipse(cx, H * 0.405, W * 0.205, H * 0.238, 0, -1.05, Math.PI + 1.05); ctx.stroke();
    ctx.strokeStyle = '#CFC8B8'; ctx.lineWidth = W * 0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.305, W * 0.172, H * 0.088, 0, Math.PI + 0.24, 2 * Math.PI - 0.24); ctx.stroke();
    ctx.strokeStyle = '#B8B1A6'; ctx.lineWidth = W * 0.013;
    ctx.beginPath(); ctx.ellipse(cx, H * 0.318, W * 0.16, H * 0.078, 0, Math.PI + 0.3, 2 * Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = '#C6905F';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.405, W * 0.19, H * 0.223, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ECD9B2';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.332, W * 0.125, H * 0.05, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, H * 0.41, W * 0.03, H * 0.085, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - W * 0.10, H * 0.415, W * 0.06, H * 0.042, -0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + W * 0.10, H * 0.415, W * 0.06, H * 0.042, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#CE9A6E';
    ctx.beginPath(); ctx.ellipse(cx - W * 0.108, H * 0.442, W * 0.045, H * 0.03, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + W * 0.108, H * 0.442, W * 0.045, H * 0.03, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9A8A62';
    ctx.beginPath(); ctx.ellipse(cx - W * 0.166, H * 0.40, W * 0.028, H * 0.075, -0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + W * 0.166, H * 0.40, W * 0.028, H * 0.075, 0.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6E5A40'; ctx.lineWidth = W * 0.013; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.126, H * 0.362); ctx.quadraticCurveTo(cx - W * 0.08, H * 0.350, cx - W * 0.038, H * 0.360); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + W * 0.126, H * 0.362); ctx.quadraticCurveTo(cx + W * 0.08, H * 0.350, cx + W * 0.038, H * 0.360); ctx.stroke();
    function eye(ex, dir) {
      ctx.fillStyle = '#C29268'; ctx.beginPath(); ctx.ellipse(ex, H * 0.389, W * 0.062, H * 0.031, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#EADFC8'; ctx.beginPath(); ctx.ellipse(ex, H * 0.390, W * 0.055, H * 0.0275, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6E5636'; ctx.beginPath(); ctx.arc(ex, H * 0.391, W * 0.025, 0, 7); ctx.fill();
      ctx.fillStyle = '#3B322A'; ctx.beginPath(); ctx.arc(ex, H * 0.391, W * 0.011, 0, 7); ctx.fill();
      ctx.fillStyle = '#F3ECDC'; ctx.beginPath(); ctx.arc(ex - W * 0.008, H * 0.385, W * 0.006, 0, 7); ctx.fill();
      ctx.strokeStyle = '#4E4031'; ctx.lineWidth = W * 0.012; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - W * 0.058, H * 0.376); ctx.quadraticCurveTo(ex, H * 0.362, ex + W * 0.058, H * 0.376); ctx.stroke();
      ctx.strokeStyle = '#9A8158'; ctx.lineWidth = W * 0.007;
      ctx.beginPath(); ctx.moveTo(ex - W * 0.052, H * 0.404); ctx.quadraticCurveTo(ex, H * 0.413, ex + W * 0.052, H * 0.404); ctx.stroke();
      ctx.lineWidth = W * 0.005;
      ctx.beginPath(); ctx.moveTo(ex + dir * W * 0.06, H * 0.388); ctx.lineTo(ex + dir * W * 0.086, H * 0.381); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + dir * W * 0.06, H * 0.396); ctx.lineTo(ex + dir * W * 0.085, H * 0.401); ctx.stroke();
    }
    eye(cx - W * 0.089, -1); eye(cx + W * 0.089, 1);
    ctx.strokeStyle = '#9A7A52'; ctx.lineWidth = W * 0.009; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.004, H * 0.40); ctx.lineTo(cx - W * 0.015, H * 0.455); ctx.quadraticCurveTo(cx, H * 0.468, cx + W * 0.019, H * 0.455); ctx.stroke();
    ctx.fillStyle = '#B98C60';
    ctx.beginPath(); ctx.ellipse(cx - W * 0.026, H * 0.457, W * 0.011, H * 0.007, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + W * 0.026, H * 0.457, W * 0.011, H * 0.007, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#A85436';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.058, H * 0.503); ctx.quadraticCurveTo(cx - W * 0.022, H * 0.499, cx, H * 0.503);
    ctx.quadraticCurveTo(cx + W * 0.022, H * 0.499, cx + W * 0.058, H * 0.503); ctx.quadraticCurveTo(cx, H * 0.511, cx - W * 0.058, H * 0.503); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#BF6E4C';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.052, H * 0.509); ctx.quadraticCurveTo(cx, H * 0.526, cx + W * 0.052, H * 0.509); ctx.quadraticCurveTo(cx, H * 0.517, cx - W * 0.052, H * 0.509); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7A3E28'; ctx.lineWidth = W * 0.0055; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - W * 0.052, H * 0.506); ctx.quadraticCurveTo(cx, H * 0.513, cx + W * 0.052, H * 0.506); ctx.stroke();
    ctx.fillStyle = '#E6CFA4';
    ctx.beginPath(); ctx.ellipse(cx, H * 0.536, W * 0.03, H * 0.014, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#9A8158'; ctx.lineWidth = W * 0.006;
    ctx.beginPath(); ctx.moveTo(cx - W * 0.062, H * 0.478); ctx.quadraticCurveTo(cx - W * 0.078, H * 0.50, cx - W * 0.064, H * 0.52); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + W * 0.062, H * 0.478); ctx.quadraticCurveTo(cx + W * 0.078, H * 0.50, cx + W * 0.064, H * 0.52); ctx.stroke();
  },
};
FACES.nana.detail = (W, H) => ({ cx: W * 0.5, cy: H * 0.42, rx: W * 0.24, ry: H * 0.27 });

/* ---------- the wordmark "o": a single hand-cut gilded tessera ---------- */
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function vmul(a, k) { return [a[0] * k, a[1] * k]; }
function vnorm(a) { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; }
function roundedQuad(pts, rad) {
  let d = ''; const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a = vadd(p1, vmul(vnorm(vsub(p0, p1)), rad)), b = vadd(p1, vmul(vnorm(vsub(p2, p1)), rad));
    d += (i === 0 ? `M ${a[0].toFixed(1)} ${a[1].toFixed(1)}` : ` L ${a[0].toFixed(1)} ${a[1].toFixed(1)}`);
    d += ` Q ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  return d + ' Z';
}
export function wordO(opts) {
  opts = opts || {}; const s = opts.size || 100, seed = opts.seed || 9, r = rng(seed);
  const reverse = !!opts.reverse;
  const pad = s * 0.075, x = pad, y = pad, w = s - 2 * pad, h = s - 2 * pad, jit = s * 0.035;
  const jj = () => (r() - .5) * 2 * jit;
  const pts = [[x + jj(), y + jj()], [x + w + jj(), y + jj()], [x + w + jj(), y + h + jj()], [x + jj(), y + h + jj()]];
  const d = roundedQuad(pts, s * 0.19), sh = roundedQuad(pts.map((p) => [p[0] + s * 0.02, p[1] + s * 0.032]), s * 0.19);
  const cx = s / 2, cy = s / 2, tilt = (r() - .5) * 5;
  const m01 = vmul(vadd(pts[0], pts[1]), 0.5), m03 = vmul(vadd(pts[0], pts[3]), 0.5);
  const spec = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L ${m01[0].toFixed(1)} ${m01[1].toFixed(1)} L ${m03[0].toFixed(1)} ${m03[1].toFixed(1)} Z`;
  return `<svg viewBox="0 0 ${s} ${s}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="overflow:visible;display:block">
    <g transform="rotate(${tilt.toFixed(2)} ${cx} ${cy})">
      <path d="${sh}" fill="#3b322a" opacity="${reverse ? 0.34 : 0.20}"/>
      <path d="${d}" fill="url(#leafA)"/>
      <path d="${d}" fill="url(#leafC)" opacity=".38"/>
      <path d="${spec}" fill="#FFF6D6" opacity=".55"/>
      <path d="${d}" fill="none" stroke="#7A5E12" stroke-width="${(s * 0.03).toFixed(2)}" stroke-opacity="${reverse ? 0.35 : 0.5}"/>
      <path d="${d}" fill="none" stroke="#F4E6AE" stroke-width="${(s * 0.018).toFixed(2)}" stroke-opacity=".55"/>
    </g></svg>`;
}

/* ---------- the restorer's brush cursor (the ONE permitted "character" — a tool) ---------- */
export function brush(opts = {}) {
  const s = opts.size || 60;
  return `<svg viewBox="0 0 60 60" width="${s}" height="${s}" style="overflow:visible;display:block">
    <g transform="rotate(38 30 30)">
      <rect x="26" y="4" width="8" height="26" rx="3" fill="#8E4A2A"/>
      <rect x="26" y="4" width="3.5" height="26" rx="2" fill="#B5643C"/>
      <path d="M24 29 h12 l-1.5 5 h-9 Z" fill="#C9A227"/>
      <path d="M23.5 34 q6.5 4 13 0 l-2 12 q-4.5 3 -9 0 Z" fill="#EFE7D6"/>
      <g stroke="#DED3BE" stroke-width="1"><path d="M26 35 l-1 11"/><path d="M30 35 l0 12"/><path d="M34 35 l1 11"/></g>
    </g>
    <circle cx="14" cy="50" r="1.6" fill="#B8B1A6"/><circle cx="19" cy="53" r="1.1" fill="#B8B1A6"/><circle cx="10" cy="46" r="1" fill="#B8B1A6"/>
  </svg>`;
}
