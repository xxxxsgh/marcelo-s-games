// meshes.js — construtor de malhas e geometria procedural (árvores, pedras, estruturas). Roda só na carga.
// Vértice (40 bytes): pos f32x3, normal f32x3, uv f32x2, cor rgba8 (a = oclusão), mat rgba8 (camada, rugosidade, vento, tipo)
// tipo: 0 uv, 1 cartão de folhas (alfa), 2 triplanar, 3 cor lisa
class MeshB {
  constructor() { this.f = []; this.b = []; this.idx = []; this.n = 0; }
  v(x, y, z, nx, ny, nz, u, vv, r, g, b, a, layer, rough, wind, kind) {
    this.f.push(x, y, z, nx, ny, nz, u, vv); this.b.push(clamp(r, 0, 1) * 255, clamp(g, 0, 1) * 255, clamp(b, 0, 1) * 255, clamp(a, 0, 1) * 255, layer, rough * 255, clamp(wind, 0, 1) * 255, kind); return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  build() {
    const n = this.n, buf = new ArrayBuffer(n * 40), f = new Float32Array(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < n; i++) { for (let k = 0; k < 8; k++) f[i * 10 + k] = this.f[i * 8 + k]; for (let k = 0; k < 8; k++) u8[i * 40 + 32 + k] = this.b[i * 8 + k]; }
    return { vb: mkBuf(new Uint8Array(buf), 0x20), ib: mkBuf(new Uint32Array(this.idx), 0x10), n: this.idx.length, nv: n };
  }
  // caixa orientada: centro c, eixos (ax = comprimento, ay, az) com meias-medidas; uv ao longo do comprimento
  box(cx, cy, cz, ax, ay, az, hx, hy, hz, col, layer, vOff, kind) {
    const A = [ax, ay, az], H = [hx, hy, hz], rgb = col || [1, 1, 1], kd = kind || 0; vOff = vOff || 0;
    const P = (sx, sy, sz) => [cx + ax[0] * hx * sx + ay[0] * hy * sy + az[0] * hz * sz, cy + ax[1] * hx * sx + ay[1] * hy * sy + az[1] * hz * sz, cz + ax[2] * hx * sx + ay[2] * hy * sy + az[2] * hz * sz];
    for (let d = 0; d < 3; d++) for (const s of [-1, 1]) {
      const d1 = (d + 1) % 3, d2 = (d + 2) % 3, nrm = [A[d][0] * s, A[d][1] * s, A[d][2] * s], ids = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const sg = [0, 0, 0]; sg[d] = s; sg[d1] = a; sg[d2] = b; const p = P(sg[0], sg[1], sg[2]);
        // u: ao longo do eixo de comprimento (x) quando houver; v: uma tábua
        let u, v; if (d === 0) { u = a * H[d1] / 1.6; v = vOff + (b * 0.5 + 0.5) * 0.25; } else { const along = d1 === 0 ? a : b, other = d1 === 0 ? b : a; u = along * hx / 1.6 + vOff * 7; v = vOff + (other * 0.5 + 0.5) * 0.25; }
        ids.push(this.v(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], u, v, rgb[0], rgb[1], rgb[2], 1, layer, 0, 0, kd));
      }
      if (s > 0) this.quad(ids[0], ids[1], ids[2], ids[3]); else this.quad(ids[0], ids[3], ids[2], ids[1]);
    }
  }
  // tubo entre dois pontos com raios r0/r1 (lados = sd)
  tube(p0, p1, r0, r1, sd, col, layer, kind, w0, w1, vs) {
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2]; const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
    let ux = Math.abs(dy) > 0.9 ? 1 : 0, uy = Math.abs(dy) > 0.9 ? 0 : 1, uz = 0;
    let sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux; let l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
    const tx = sy * dz - sz * dy, ty = sz * dx - sx * dz, tz = sx * dy - sy * dx; const base = this.n; vs = vs || 1;
    for (let k = 0; k <= 1; k++) for (let i = 0; i <= sd; i++) {
      const a = i / sd * 6.2832, c = Math.cos(a), s = Math.sin(a), r = k ? r1 : r0, p = k ? p1 : p0, nx = sx * c + tx * s, ny = sy * c + ty * s, nz = sz * c + tz * s;
      this.v(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r, nx, ny, nz, i / sd * Math.max(1, Math.round(r0 * 9)), (k ? len : 0) * vs * 0.8 + (p0[1] * 0.8), col[0], col[1], col[2], col[3] === undefined ? 1 : col[3], layer, 0, k ? (w1 || 0) : (w0 || 0), kind || 0);
    }
    for (let i = 0; i < sd; i++) this.quad(base + i, base + i + 1, base + sd + 1 + i + 1, base + sd + 1 + i);
  }
  // cartão de folhas voltado para n, com normal "esférica" ns
  card(c, right, up, size, ns, col, ao, layer, wind, seed) {
    const h = size * 0.5, ids = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      ids.push(this.v(c[0] + right[0] * a * h + up[0] * b * h, c[1] + right[1] * a * h + up[1] * b * h, c[2] + right[2] * a * h + up[2] * b * h, ns[0], ns[1], ns[2], a * 0.5 + 0.5, 0.5 - b * 0.5, col[0], col[1], col[2], ao, layer, 0, wind, 1));
    this.quad(ids[0], ids[1], ids[2], ids[3]);
  }
}
function _rndDir(r) { const z = r() * 2 - 1, a = r() * 6.2832, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), z, s * Math.sin(a)]; }
function _cardsAt(m, r, c, n, spread, size, crownC, layer, windBase, tint) {
  for (let i = 0; i < n; i++) {
    const d = _rndDir(r), rr = Math.cbrt(r()) * spread, p = [c[0] + d[0] * rr, c[1] + d[1] * rr * 0.75, c[2] + d[2] * rr];
    const nrm = _rndDir(r); nrm[1] = Math.abs(nrm[1]) * 0.6 + 0.25; let l = Math.hypot(nrm[0], nrm[1], nrm[2]); nrm[0] /= l; nrm[1] /= l; nrm[2] /= l;
    let rx = nrm[1], ry = -nrm[0], rz = 0; l = Math.hypot(rx, ry, rz) || 1; rx /= l; ry /= l; const a = r() * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
    const ux = nrm[1] * rz - nrm[2] * ry, uy = nrm[2] * rx - nrm[0] * rz, uz = nrm[0] * ry - nrm[1] * rx;
    const R = [rx * ca + ux * sa, ry * ca + uy * sa, rz * ca + uz * sa], U = [-rx * sa + ux * ca, -ry * sa + uy * ca, -rz * sa + uz * ca];
    let sx = p[0] - crownC[0], sy = p[1] - crownC[1], sz = p[2] - crownC[2]; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const ns = [sx * 0.75 + nrm[0] * 0.25, sy * 0.75 + nrm[1] * 0.25 + 0.15, sz * 0.75 + nrm[2] * 0.25]; l = Math.hypot(ns[0], ns[1], ns[2]); ns[0] /= l; ns[1] /= l; ns[2] /= l;
    const ao = clamp(0.30 + 0.7 * Math.min(1, sl / crownC[3]) * (0.55 + 0.45 * (sy * 0.5 + 0.5)), 0.2, 1), t = 0.8 + r() * 0.4;
    m.card(p, R, U, size * (0.75 + r() * 0.5), ns, [tint[0] * t, tint[1] * t, tint[2] * (0.8 + r() * 0.4)], ao, layer, windBase + r() * 0.15, r());
  }
}
// folhosa: tronco torto, galhos e maciços de folhas. lod 0..2
function makeBroadleaf(seed, lod, squat) {
  const r = mulberry32(seed), m = new MeshB(), H = (squat ? 5.2 : 7.2) + r() * 1.6, sd = lod === 0 ? 9 : lod === 1 ? 6 : 4, bark = [0.9, 0.85, 0.8, 1];
  const pts = [[0, -0.3, 0]]; let lx = (r() - 0.5) * 0.5, lz = (r() - 0.5) * 0.5; const NS = lod === 2 ? 2 : 5;
  for (let i = 1; i <= NS; i++) pts.push([lx * i / NS * (1 + r() * 0.6) + Math.sin(i * 1.7 + seed) * 0.12, H * 0.62 * i / NS, lz * i / NS * (1 + r() * 0.6) + Math.cos(i * 1.3 + seed) * 0.12]);
  const R0 = 0.30 + r() * 0.08;
  for (let i = 0; i < NS; i++) { const f0 = i / NS, f1 = (i + 1) / NS; m.tube(pts[i], pts[i + 1], R0 * (1 - f0 * 0.5) * (i === 0 ? 1.35 : 1), R0 * (1 - f1 * 0.5), sd, bark, 5, 0, f0 * f0 * 0.12, f1 * f1 * 0.12, 1); }
  const top = pts[NS], crownC = [top[0], H * 0.80, top[2], H * 0.42], tint = squat ? [1.0, 0.98, 0.72] : [0.82, 1.0, 0.86];
  const NB = squat ? 6 : 5, clusters = [];
  for (let b = 0; b < NB; b++) {
    const a = b / NB * 6.2832 + r() * 0.7, el = 0.25 + r() * 0.55, len = H * (0.30 + r() * 0.18) * (squat ? 1.25 : 1), st = pts[Math.max(1, NS - 1 - (b % 2))];
    const start = [lerp(st[0], top[0], r()), lerp(st[1], top[1], r()), lerp(st[2], top[2], r())], end = [start[0] + Math.cos(a) * Math.cos(el) * len, start[1] + Math.sin(el) * len, start[2] + Math.sin(a) * Math.cos(el) * len];
    const mid = [(start[0] + end[0]) / 2 + (r() - 0.5) * 0.4, (start[1] + end[1]) / 2 + 0.25, (start[2] + end[2]) / 2 + (r() - 0.5) * 0.4];
    if (lod < 2) { m.tube(start, mid, R0 * 0.42, R0 * 0.26, lod === 0 ? 6 : 4, bark, 5, 0, 0.12, 0.3, 1); m.tube(mid, end, R0 * 0.26, R0 * 0.08, lod === 0 ? 5 : 3, bark, 5, 0, 0.3, 0.55, 1); }
    clusters.push(end, mid);
    for (let k = 0; k < 2; k++) { const e2 = [mid[0] + (r() - 0.5) * len * 0.9, mid[1] + r() * len * 0.55, mid[2] + (r() - 0.5) * len * 0.9]; if (lod === 0) m.tube(mid, e2, R0 * 0.14, R0 * 0.05, 4, bark, 5, 0, 0.3, 0.6, 1); clusters.push(e2); }
  }
  clusters.push([top[0], H * 0.98, top[2]], [top[0] + 0.5, H * 0.86, top[2] - 0.4]);
  const per = lod === 0 ? 11 : lod === 1 ? 4 : 1, size = lod === 0 ? 1.55 : lod === 1 ? 2.3 : 3.6, spread = lod === 2 ? 0.9 : 1.15;
  for (let i = 0; i < clusters.length; i++) { if (lod === 2 && i % 2 === 1) continue; const c = clusters[i]; _cardsAt(m, r, c, per, spread, size, crownC, 7, 0.55 + 0.25 * clamp(c[1] / H, 0, 1), tint); }
  return m.build();
}
// araucária: tronco reto e alto, copa em candelabro
function makeAraucaria(seed, lod) {
  const r = mulberry32(seed), m = new MeshB(), H = 15 + r() * 4, sd = lod === 0 ? 9 : lod === 1 ? 6 : 4, bark = [0.75, 0.68, 0.66, 1], R0 = 0.36;
  const NS = lod === 2 ? 1 : 4; for (let i = 0; i < NS; i++) { const f0 = i / NS, f1 = (i + 1) / NS; m.tube([0, -0.3 + (H + 0.3) * f0, 0], [0, -0.3 + (H + 0.3) * f1, 0], R0 * (1 - f0 * 0.55) * (i === 0 ? 1.25 : 1), R0 * (1 - f1 * 0.55), sd, bark, 5, 0, f0 * f0 * 0.10, f1 * f1 * 0.10, 1); }
  const crownC = [0, H * 0.93, 0, H * 0.32], NW = 4, tint = [0.9, 1.0, 0.95];
  for (let w = 0; w < NW; w++) {
    const y0 = H * (0.74 + 0.075 * w), nb = lod === 2 ? 5 : 9 - w, len = H * (0.34 - w * 0.055) * (0.9 + r() * 0.2);
    for (let b = 0; b < nb; b++) {
      const a = b / nb * 6.2832 + w * 0.5 + r() * 0.25, ca = Math.cos(a), sa = Math.sin(a), NSeg = lod === 0 ? 4 : 2; let prev = [0, y0, 0];
      for (let s = 1; s <= NSeg; s++) {
        const f = s / NSeg, rr = len * f, y = y0 - len * 0.05 * Math.sin(f * 3.14) + len * 0.42 * f * f * f, p = [ca * rr, y, sa * rr];
        if (lod < 2) m.tube(prev, p, 0.085 * (1 - f * 0.6) + 0.02, 0.085 * (1 - (f + 1 / NSeg) * 0.6) + 0.02, lod === 0 ? 5 : 3, bark, 5, 0, 0.1 + f * 0.2, 0.1 + f * 0.3, 1);
        if (f > 0.45) _cardsAt(m, r, [p[0], p[1] + 0.25, p[2]], lod === 0 ? 5 : lod === 1 ? 2 : 1, len * 0.11 + 0.25, (lod === 0 ? 1.25 : lod === 1 ? 1.7 : 2.6) * (0.75 + f * 0.5), crownC, 8, 0.3 + f * 0.3, tint);
        prev = p;
      }
    }
  }
  _cardsAt(m, r, [0, H + 0.3, 0], lod === 0 ? 14 : lod === 1 ? 6 : 2, 0.9, lod === 0 ? 1.3 : 2.0, crownC, 8, 0.4, tint);
  return m.build();
}
function makeBush(seed, lod) {
  const r = mulberry32(seed), m = new MeshB(), crownC = [0, 0.5, 0, 1.3], n = lod === 0 ? 5 : 3;
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + r(), d = 0.35 + r() * 0.5, c = [Math.cos(a) * d, 0.55 + r() * 0.75, Math.sin(a) * d];
    if (lod === 0) m.tube([0, -0.1, 0], c, 0.035, 0.012, 4, [0.8, 0.75, 0.7, 1], 5, 0, 0, 0.4, 1);
    _cardsAt(m, r, c, lod === 0 ? 9 : lod === 1 ? 4 : 2, 0.55, lod === 0 ? 0.85 : lod === 1 ? 1.2 : 1.7, crownC, 7, 0.5, [0.95, 1.0, 0.7]); }
  return m.build();
}
// pedra: icosfera deformada
function makeRock(seed, sub) {
  const r = mulberry32(seed), m = new MeshB(); const t = (1 + Math.sqrt(5)) / 2;
  let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; });
  let Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) { const mid = new Map(), nf = []; const M = (a, b) => { const k = a < b ? a * 100000 + b : b * 100000 + a; let i = mid.get(k); if (i === undefined) { const p = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]], l = Math.hypot(p[0], p[1], p[2]); V.push([p[0] / l, p[1] / l, p[2] / l]); i = V.length - 1; mid.set(k, i); } return i; };
    for (const f of Fc) { const a = M(f[0], f[1]), b = M(f[1], f[2]), c = M(f[2], f[0]); nf.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]); } Fc = nf; }
  const ox = r() * 50, oy = r() * 50, planes = []; for (let i = 0; i < 7; i++) { const d = _rndDir(r); planes.push([d[0], d[1], d[2], 0.62 + r() * 0.3]); }
  const P = V.map((v) => { let rad = 1 + fbm2(v[0] * 1.3 + ox, v[1] * 1.3 + v[2] * 0.9 + oy, 3) * 0.5 + noise2(v[0] * 4 + ox, v[2] * 4 + v[1] * 3) * 0.06;
    for (const p of planes) { const d = v[0] * p[0] + v[1] * p[1] + v[2] * p[2]; if (d * rad > p[3]) rad = p[3] / d; } return [v[0] * rad, v[1] * rad * 0.72, v[2] * rad]; });
  const Nn = P.map(() => [0, 0, 0]);
  for (const f of Fc) { const a = P[f[0]], b = P[f[1]], c = P[f[2]], e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const i of f) { Nn[i][0] += n[0]; Nn[i][1] += n[1]; Nn[i][2] += n[2]; } }
  P.forEach((p, i) => { const n = Nn[i], l = Math.hypot(n[0], n[1], n[2]) || 1; m.v(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, 0, 0, 1, 1, 1, clamp(0.55 + p[1] * 0.6, 0.35, 1), 3, 0, 0, 2); });
  for (const f of Fc) m.tri(f[0], f[1], f[2]);
  return m.build();
}
// estruturas fixas em espaço de mundo: ponte, porteira, mirante, mourões, marcos de checkpoint
function makeStructures() {
  const W = World, T = W.trk, m = new MeshB(), r = mulberry32(77), Y = [0, 1, 0], wood = () => { const t = 0.6 + r() * 0.38; return [t, t * (0.94 + r() * 0.06), t * 0.92]; };
  // --- ponte ---
  { const B = W.bridge, ax = [B.tx, (B.y1 - B.y0) / B.len, B.tz], az = [B.tz, 0, -B.tx], ext = 0.7, L = B.len + ext * 2;
    const at = (d, l, h) => [B.x0 + B.tx * d + B.tz * l, B.y0 + (B.y1 - B.y0) * clamp(d / B.len, 0, 1) + h, B.z0 + B.tz * d - B.tx * l];
    for (let d = -ext + 0.12; d < B.len + ext; d += 0.25) { const c = at(d, 0, -0.045 + (r() - 0.5) * 0.012), sk = (r() - 0.5) * 0.02; m.box(c[0], c[1], c[2], [az[0] + ax[0] * sk, 0, az[2] + ax[2] * sk], Y, ax, B.hw + 0.12 + r() * 0.06, 0.04, 0.115, wood(), 6, Math.floor(r() * 4) * 0.25); }
    for (const l of [-1.5, 0, 1.5]) { const c = at(B.len / 2, l, -0.26); m.box(c[0], c[1], c[2], ax, Y, az, L / 2, 0.17, 0.12, [0.6, 0.55, 0.5], 6, 0.25); }
    for (const sd of [-1, 1]) {
      for (let d = -ext + 0.2; d <= B.len + ext; d += (L - 0.4) / 6) { const c = at(d, sd * (B.hw + 0.1), 0.45); m.box(c[0], c[1], c[2], Y, ax, az, 0.62, 0.07, 0.07, wood(), 6, 0.5); }
      for (const h of [1.0, 0.55]) { const c = at(B.len / 2, sd * (B.hw + 0.1), h); m.box(c[0], c[1], c[2], ax, Y, az, L / 2, 0.05, 0.035, wood(), 6, 0.75); }
    }
    for (const d of [B.len * 0.22, B.len * 0.78]) for (const l of [-1.6, 1.6]) { const c = at(d, l, 0), g = W.heightRaw(c[0], c[2]) - 0.5, h = (c[1] - 0.3 - g) / 2; m.tube([c[0], g, c[2]], [c[0], c[1] - 0.3, c[2]], 0.16, 0.14, 8, [0.7, 0.66, 0.62, 1], 5, 0, 0, 0, 1); }
    for (const d of [B.len * 0.22, B.len * 0.78]) { const c = at(d, 0, -0.5); m.box(c[0], c[1], c[2], az, Y, ax, 1.9, 0.1, 0.1, [0.6, 0.55, 0.5], 6, 0); }
  }
  // --- porteira ---
  { const G = W.gate, az = [G.tz, 0, -G.tx], ax = [G.tx, 0, G.tz];
    for (const sd of [-1, 1]) { const x = G.x + az[0] * G.hw * sd, z = G.z + az[2] * G.hw * sd, y = W.heightRaw(x, z);
      m.tube([x, y - 0.4, z], [x, y + 4.3, z], 0.21, 0.17, 10, [0.75, 0.7, 0.66, 1], 5, 0, 0, 0, 1);
      // folha da porteira aberta, encostada para fora ao longo da trilha
      const ga = [ax[0] * 0.94 + az[0] * 0.34 * sd, 0, ax[2] * 0.94 + az[2] * 0.34 * sd], gl = 1.75, gn = [ga[2], 0, -ga[0]], cx = x + ga[0] * (gl + 0.2) + az[0] * 0.15 * sd, cz = z + ga[2] * (gl + 0.2) + az[2] * 0.15 * sd;
      for (let k = 0; k < 5; k++) m.box(cx, y + 0.32 + k * 0.24, cz, ga, Y, gn, gl, 0.05, 0.022, wood(), 6, 0.25 * (k % 4));
      for (const e of [-1, 0, 1]) m.box(cx + ga[0] * gl * e * 0.97, y + 0.78, cz + ga[2] * gl * e * 0.97, Y, ga, gn, 0.66, 0.05, 0.03, wood(), 6, 0.5);
      const dg = [ga[0] * 0.93, 0.36, ga[2] * 0.93]; m.box(cx, y + 0.8, cz, dg, [-dg[0] * 0.36, 0.93, -dg[2] * 0.36], gn, gl * 0.98, 0.04, 0.028, wood(), 6, 0.75);
    }
    m.box(G.x, W.heightRaw(G.x, G.z) + 4.05, G.z, az, Y, ax, G.hw + 0.5, 0.13, 0.13, [0.72, 0.68, 0.62], 6, 0.25);
    m.box(G.x, W.heightRaw(G.x, G.z) + 3.52, G.z, az, Y, ax, 1.5, 0.32, 0.03, [0.85, 0.8, 0.7], 6, 0.5);
  }
  // --- mirante ---
  { const L = W.lookout, i = L.i, ax = [T.tx[i], 0, T.tz[i]], az = [L.fx, 0, L.fz], hx = 3.3, hz = 2.4, y = L.y;
    const at = (a, b, h) => [L.x + ax[0] * a + az[0] * b, y + h, L.z + ax[2] * a + az[2] * b];
    for (let b = -hz + 0.1; b < hz; b += 0.21) { const c = at(0, b, -0.04); m.box(c[0], c[1], c[2], ax, Y, az, hx, 0.035, 0.098, wood(), 6, Math.floor(r() * 4) * 0.25); }
    for (const a of [-hx + 0.15, 0, hx - 0.15]) for (const b of [-hz + 0.15, hz - 0.15]) { const c = at(a, b, 0), g = W.heightRaw(c[0], c[2]) - 0.6; m.tube([c[0], g, c[2]], [c[0], y + (b > 0 || Math.abs(a) > 1 ? 1.05 : -0.08), c[2]], 0.1, 0.09, 8, [0.75, 0.7, 0.66, 1], 5, 0, 0, 0, 1); }
    for (const b of [-hz + 0.15, hz - 0.15]) { const c = at(0, b, -0.2); m.box(c[0], c[1], c[2], ax, Y, az, hx, 0.12, 0.07, [0.6, 0.55, 0.5], 6, 0); }
    for (const h of [1.05, 0.55]) { let c = at(0, hz - 0.15, h); m.box(c[0], c[1], c[2], ax, Y, az, hx, 0.045, 0.035, wood(), 6, 0.5); for (const sd of [-1, 1]) { c = at(sd * (hx - 0.15), 0.6, h); m.box(c[0], c[1], c[2], az, Y, ax, hz - 0.75, 0.045, 0.035, wood(), 6, 0.75); } }
    for (let a = -hx + 0.6; a < hx; a += 0.95) { const c = at(a, hz - 0.15, 0.5); m.box(c[0], c[1], c[2], Y, ax, az, 0.52, 0.035, 0.03, wood(), 6, 0.25); }
    // banco e degrau
    let c = at(0, 0.6, 0.45); m.box(c[0], c[1], c[2], ax, Y, az, 1.1, 0.03, 0.2, wood(), 6, 0.25); for (const a of [-0.9, 0.9]) { c = at(a, 0.6, 0.21); m.box(c[0], c[1], c[2], Y, ax, az, 0.21, 0.04, 0.16, wood(), 6, 0.5); }
    c = at(0, -hz - 0.25, -0.22); m.box(c[0], c[1], c[2], ax, Y, az, 1.2, 0.07, 0.22, wood(), 6, 0.75);
  }
  // --- mourões da cerca ---
  for (let k = 0; k < W.nPosts; k++) { const p = W.posts, o = k * 8, h = 1.32 * p[o + 6], up = [p[o + 4], 1, p[o + 5]], l = Math.hypot(up[0], 1, up[2]); up[0] /= l; up[1] /= l; up[2] /= l;
    m.tube([p[o], p[o + 1] - 0.35, p[o + 2]], [p[o] + up[0] * h, p[o + 1] + up[1] * h, p[o + 2] + up[2] * h], 0.062, 0.05, 6, [0.8, 0.76, 0.7, 1], 5, 0, 0, 0, 2.5); }
  // --- marcos de checkpoint: par de estacas com topo pintado ---
  for (let k = 1; k < W.checkpoints.length; k++) { const i = Math.round(W.checkpoints[k] / T.ds) % T.n;
    for (const sd of [-1, 1]) { const o = (T.hw[i] + 0.9) * sd, x = T.x[i] + T.tz[i] * o, z = T.z[i] - T.tx[i] * o, y = W.heightRaw(x, z);
      m.tube([x, y - 0.3, z], [x, y + 1.25, z], 0.07, 0.06, 8, [0.8, 0.76, 0.7, 1], 5, 0, 0, 0, 2); m.tube([x, y + 1.25, z], [x, y + 1.6, z], 0.062, 0.062, 8, [0.95, 0.33, 0.06, 1], 5, 0, 0, 0, 0.1);
      m.b[(m.n - 1) * 8 + 7] = 3; for (let q = m.n - 18; q < m.n; q++) m.b[q * 8 + 7] = 3; } }
  return m.build();
}
