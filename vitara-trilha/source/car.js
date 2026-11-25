// car.js — Suzuki Grand Vitara (3ª geração, 5 portas) procedural: carroceria por seções, rodas, estepe, interior.
// Espaço do carro: +Z frente, +X esquerda, +Y cima; origem no chão, no meio do entre-eixos.
// tipos (mat.w): 10 casca da carroceria, 11 peça pintada, 12 plástico preto, 13 interior, 14 liga da roda, 15 pneu, 16 cromado, 17 espelho, 18 capa do estepe
const CarD = {
  AXF: 1.32, AXR: -1.32, TRK: 0.775, RW: 0.362, ARCH: 0.435,
  u: new Float32Array(160 + 8), body: new Float32Array(16), prevBody: new Float32Array(16), tmp: new Float32Array(16), tmp2: new Float32Array(16), first: true,
  dust: 0, mud: 0, brake: 0,
};
// ---- perfis da carroceria (as mesmas fórmulas existem no shader para as máscaras) ----
function _carProfile(z) {
  const D = CarD, hoodT = smooth(0.80, 0.98, z), wsT = sat((z - 0.32) / 0.60), inWS = z > 0.32 && z < 0.92;
  const taper = 1 - 0.035 * smooth(0.6, 2.0, z) - 0.012 * smooth(-1.2, -2.0, z);
  const yF = 0.30 + 0.07 * smooth(1.55, 2.0, z) + 0.10 * smooth(-1.6, -2.05, z);
  const da = Math.min(Math.abs(z - D.AXF), Math.abs(z - D.AXR));
  const yS = 0.335 + 0.05 * smooth(1.6, 2.0, z) + 0.07 * smooth(-1.7, -2.05, z);
  const yA = da < D.ARCH ? Math.max(yS, D.RW + 0.015 + Math.sqrt(D.ARCH * D.ARCH - da * da)) : yS;
  const flare = 0.052 * Math.exp(-Math.pow(da / 0.55, 8));
  const wS = (0.885 + flare) * taper;
  const yBelt = z > 0.92 ? lerp(1.025, 1.005, Math.pow(sat((z - 0.92) / 1.0), 1.5)) : 1.035 - 0.012 * z;
  const wB = (0.872 - 0.02 * hoodT) * taper;
  let yR, wR, yRe;
  if (z >= 0.92) { yR = lerp(1.105, 1.060, Math.pow(sat((z - 0.92) / 1.1), 1.6)); wR = wB - 0.13; yRe = yBelt + 0.035; }
  else if (z > 0.32) { yR = lerp(1.645, 1.105, Math.pow(wsT, 1.12)); wR = lerp(0.675, 0.775, wsT) * taper; yRe = lerp(1.585, 1.045, Math.pow(wsT, 1.05)); }
  else { yR = 1.645 + 0.022 * Math.sin(sat((0.32 - z) / 2.2) * Math.PI); wR = (0.675 + 0.012 * smooth(0.2, -0.6, z)) * taper; yRe = yR - 0.062; }
  return { yF, yS, yA, wS, yBelt, wB, yR, wR, yRe, xIn: 0.535, taper };
}
function _zTipF(y) { // perfil da frente (vista lateral): para-choque saliente, grade e capô recuando
  const k = [[0.30, 1.955], [0.40, 2.085], [0.52, 2.135], [0.68, 2.130], [0.76, 2.110], [0.86, 2.100], [0.98, 2.085], [1.04, 2.045], [1.12, 1.97]];
  for (let i = 0; i < k.length - 1; i++) if (y <= k[i + 1][0]) { const t = sat((y - k[i][0]) / (k[i + 1][0] - k[i][0])); return lerp(k[i][1], k[i + 1][1], t * t * (3 - 2 * t)); } return k[k.length - 1][1];
}
function _zTipR(y) {
  const k = [[0.30, -1.96], [0.42, -2.085], [0.52, -2.115], [0.70, -2.115], [0.76, -2.075], [1.05, -2.062], [1.66, -2.005], [1.8, -2.0]];
  for (let i = 0; i < k.length - 1; i++) if (y <= k[i + 1][0]) { const t = sat((y - k[i][0]) / (k[i + 1][0] - k[i][0])); return lerp(k[i][1], k[i + 1][1], t * t * (3 - 2 * t)); } return k[k.length - 1][1];
}
function makeCarBody() {
  const m = new MeshB(), fr = [0.997, 0.988, 0.972, 0.95, 0.92, 0.88, 0.83, 0.765, 0.69, 0.60, 0.50, 0.39, 0.27, 0.14, 0.0];
  // estações: fecho traseiro, miolo, fecho dianteiro
  const st = []; const ZR = -1.80, ZFm = 1.76, CR = 0.30, CF = 0.38, nR = 4.2, nF = 3.0;
  for (let k = fr.length - 1; k >= 0; k--) st.push({ z: ZR - CR * (1 - Math.pow(1 - Math.pow(fr[k], nR), 1 / nR)) * 1, zp: ZR, f: fr[k], end: -1 });
  const NM = 120; for (let i = 0; i <= NM; i++) st.push({ z: lerp(ZR, ZFm, i / NM), f: 1, end: 0 });
  for (let k = 0; k < fr.length; k++) st.push({ z: ZFm + CF * (1 - Math.pow(1 - Math.pow(fr[k], nF), 1 / nF)), zp: ZFm, f: fr[k], end: 1 });
  // corrige: nos fechos, a profundidade a partir da ponta é d(f) = C*(1-(1-f^n)^(1/n)); z = ponta -+ ... (ponta em f=0)
  for (const s of st) if (s.end === -1) s.z = (ZR - CR) + CR * (1 - Math.pow(1 - Math.pow(s.f, nR), 1 / nR)); else if (s.end === 1) s.z = (ZFm + CF) - CF * (1 - Math.pow(1 - Math.pow(s.f, nF), 1 / nF));
  const segs = [3, 3, 4, 5, 7, 10, 10], NJ = segs.reduce((a, b) => a + b, 0) + 1, P = [];
  for (const s of st) {
    const zq = s.end === 0 ? s.z : s.zp + (s.z - s.zp) * 0.35, p = _carProfile(zq), f = s.f;
    const d2y = Math.max(0.64, p.yA + 0.05);
    const key = [[0, p.yF], [p.xIn, p.yF], [p.xIn, p.yA], [p.wS - 0.012, p.yA], [p.wS, d2y], [p.wB, p.yBelt], [p.wR, p.yRe], [0, p.yR]];
    let row = [];
    for (let k = 0; k < 7; k++) for (let j = 0; j < segs[k]; j++) { const t = j / segs[k]; row.push([lerp(key[k][0], key[k + 1][0], t), lerp(key[k][1], key[k + 1][1], t), k === 3 && j === 0 ? 1 : 0]); }
    row.push([0, p.yR, 1]); row[0][2] = 1;
    // lado da carroceria levemente abaulado e teto com coroa
    for (let j = 0; j < row.length; j++) { const y = row[j][1]; if (j >= 10 + 5 && j <= 10 + 5 + 7) row[j][0] += 0.006 * Math.sin(sat((y - d2y) / (p.yBelt - d2y)) * Math.PI); }
    for (let it = 0; it < 3; it++) { const r0 = row.map((q) => [q[0], q[1]]); for (let j = 1; j < row.length - 1; j++) if (!row[j][2] && j > 10) { row[j][0] = (r0[j - 1][0] + 2 * r0[j][0] + r0[j + 1][0]) / 4; row[j][1] = (r0[j - 1][1] + 2 * r0[j][1] + r0[j + 1][1]) / 4; } }
    // fechos: escala em x e cisalhamento em z conforme o perfil da ponta
    P.push(row.map((q) => { let z = s.z; if (s.z > 1.25) z += (_zTipF(q[1]) - 2.14) * smooth(1.25, 2.02, s.z); if (s.z < -1.35) z += (_zTipR(q[1]) + 2.10) * smooth(-1.35, -1.98, s.z); return [q[0] * f, q[1], z]; }));
  }
  const NI = st.length, id = (i, j) => i * NJ + j;
  for (const side of [1, -1]) {
    const base = m.n;
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      const a = P[Math.max(0, i - 1)][j], b = P[Math.min(NI - 1, i + 1)][j], c = P[i][Math.max(0, j - 1)], d = P[i][Math.min(NJ - 1, j + 1)];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
      let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux; let l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) { nx = 0; ny = 0; nz = i < NI / 2 ? -1 : 1; l = 1; }
      if (j === 0 || j === NJ - 1) nx = 0; l = Math.hypot(nx, ny, nz) || 1;
      const p = P[i][j]; m.v(p[0] * side, p[1], p[2], nx / l * side, ny / l, nz / l, j / (NJ - 1), i / (NI - 1), 1, 1, 1, 1, 0, 0, 0, 10);
    }
    for (let i = 0; i < NI - 1; i++) for (let j = 0; j < NJ - 1; j++) { const a = base + id(i, j), b = base + id(i, j + 1), c = base + id(i + 1, j + 1), d = base + id(i + 1, j); if (side > 0) m.quad(a, b, c, d); else m.quad(a, d, c, b); }
  }
  return m;
}
// revolução de um perfil [(a, r)] em torno de um eixo (ax = 0: X, 2: Z), centro c
function _revolve(m, prof, n, axis, c, kind, col, flip) {
  const base = m.n, np = prof.length;
  for (let i = 0; i <= n; i++) { const a = i / n * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < np; k++) { const p = prof[k], q = prof[Math.min(np - 1, k + 1)], o = prof[Math.max(0, k - 1)]; let da = q[0] - o[0], dr = q[1] - o[1]; const l = Math.hypot(da, dr) || 1; let na = dr / l, nr = -da / l; if (flip) { na = -na; nr = -nr; }
      let x, y, z, nx, ny, nz; if (axis === 0) { x = p[0]; y = p[1] * ca; z = p[1] * sa; nx = na; ny = nr * ca; nz = nr * sa; } else { z = p[0]; x = p[1] * ca; y = p[1] * sa; nz = na; nx = nr * ca; ny = nr * sa; }
      m.v(c[0] + x, c[1] + y, c[2] + z, nx, ny, nz, i / n, k / (np - 1), col[0], col[1], col[2], 1, 0, 0, 0, kind); } }
  for (let i = 0; i < n; i++) for (let k = 0; k < np - 1; k++) { const a = base + i * np + k, b = a + 1, c2 = a + np + 1, d = a + np; if (flip ^ (axis === 2)) m.quad(a, b, c2, d); else m.quad(a, d, c2, b); }
}
function makeWheel() {
  const m = new MeshB(), R = CarD.RW;
  // pneu (perfil: posição ao longo do eixo x, raio) — face externa em +x
  const tp = [[-0.108, 0.236], [-0.118, 0.262], [-0.121, 0.300], [-0.112, 0.338], [-0.098, 0.354], [-0.080, R], [-0.04, R + 0.002], [0, R + 0.003], [0.04, R + 0.002], [0.080, R], [0.098, 0.354], [0.112, 0.338], [0.121, 0.300], [0.118, 0.262], [0.108, 0.236]];
  _revolve(m, tp, 72, 0, [0, 0, 0], 15, [1, 1, 1], true);
  // aro: grade polar com 5 raios em relevo; uv = (raio, ângulo)
  const NA = 150, NR = 16, RR = 0.238, base = m.n;
  const depth = (r, a) => { const rn = r / RR; let x = 0.066;
    const k = ((a / 6.2832 * 5) % 1 + 1) % 1, ad = Math.abs(k - 0.5) * 2 * (Math.PI / 5) * r; // distância angular (m) ao eixo do raio mais próximo... centro do raio em k=0.5
    const sw = 0.030 + 0.016 * rn, spoke = 1 - smooth(sw, sw + 0.014, ad), hub = 1 - smooth(0.052, 0.066, r), lip = smooth(0.185, 0.197, r);
    const face = Math.max(spoke, hub); x = lerp(-0.035, 0.070 - 0.022 * Math.sin(rn * 2.6), face); x = lerp(x, 0.088, lip); if (r < 0.03) x += 0.006; return x; };
  for (let i = 0; i <= NA; i++) for (let j = 0; j <= NR; j++) { const a = i / NA * 6.2832, r = RR * Math.pow(j / NR, 0.8), e = 0.004;
    const x = depth(r, a), dxr = (depth(r + e, a) - depth(Math.max(0, r - e), a)) / (2 * e), dxa = (depth(r, a + 0.01) - depth(r, a - 0.01)) / (0.02 * Math.max(r, 0.02));
    const ca = Math.cos(a), sa = Math.sin(a); let nx = 1, ny = -(dxr * ca - dxa * sa), nz = -(dxr * sa + dxa * ca); const l = Math.hypot(nx, ny, nz);
    m.v(x, r * ca, r * sa, nx / l, ny / l, nz / l, r / RR, a, 1, 1, 1, 1, 0, 0, 0, 14); }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) { const a = base + i * (NR + 1) + j, b = a + 1, c = a + NR + 2, d = a + NR + 1; m.quad(a, d, c, b); }
  // tambor interno do aro e disco de freio
  _revolve(m, [[0.088, RR], [0.02, RR - 0.006], [-0.10, RR - 0.004]], 40, 0, [0, 0, 0], 12, [0.5, 0.5, 0.5], false);
  _revolve(m, [[-0.012, 0.03], [-0.012, 0.16], [-0.03, 0.16], [-0.03, 0.03]], 32, 0, [0, 0, 0], 16, [0.35, 0.35, 0.36], true);
  _revolve(m, [[-0.10, 0.0], [-0.10, RR]], 24, 0, [0, 0, 0], 12, [0.3, 0.3, 0.3], true);
  return m;
}
function makeCarParts() {
  const m = new MeshB(), Y = [0, 1, 0], X = [1, 0, 0], Z = [0, 0, 1];
  const boxK = (c, h, kind, col, ax, ay, az) => { const n0 = m.n; m.box(c[0], c[1], c[2], ax || X, ay || Y, az || Z, h[0], h[1], h[2], col || [1, 1, 1], 0, 0, kind); return n0; };
  const tubeK = (a, b, r0, r1, sd, kind, col) => { m.tube(a, b, r0, r1, sd, col || [1, 1, 1, 1], 0, kind, 0, 0, 1); };
  // estepe: capa rígida na cor do carro, deslocada para a direita (-X), na tampa traseira
  { const c = [-0.08, 0.955, -2.335]; // eixo Z; perfil (z, r) do fundo (junto à tampa) até a face traseira
    _revolve(m, [[0.262, 0.33], [0.235, 0.372], [0.06, 0.378], [0.022, 0.368], [0.004, 0.345], [0.0, 0.30], [0.0, 0.0]], 64, 2, c, 18, [1, 1, 1], true);
    boxK([c[0], c[1], c[2] + 0.27], [0.09, 0.09, 0.03], 12, [0.2, 0.2, 0.2]); }
  // longarinas de teto (pretas) com pés
  for (const sd of [1, -1]) { const x = 0.565 * sd, pts = [[x, 1.612, 0.03], [x, 1.668, -0.04], [x, 1.685, -0.16], [x, 1.692, -0.85], [x, 1.685, -1.55], [x, 1.672, -1.70], [x, 1.612, -1.78]];
    for (let i = 0; i < pts.length - 1; i++) tubeK(pts[i], pts[i + 1], 0.021, 0.021, 8, 12, [0.05, 0.05, 0.055, 1]);
    for (const z of [-0.12, -1.60]) boxK([x, 1.655, z], [0.02, 0.03, 0.06], 12, [0.05, 0.05, 0.055]); }
  // antena no fim do teto
  tubeK([0.0, 1.66, -1.78], [0.0, 1.69, -1.80], 0.03, 0.016, 8, 12, [0.05, 0.05, 0.055, 1]); tubeK([0.0, 1.685, -1.80], [0.0, 1.95, -2.03], 0.009, 0.008, 6, 12, [0.05, 0.05, 0.055, 1]);
  // retrovisores
  for (const sd of [1, -1]) { const c = [0.985 * sd, 1.105, 0.70];
    const n0 = m.n, prof = []; for (let k = 0; k <= 8; k++) { const t = k / 8; prof.push([lerp(-0.055, 0.075, t), 0.085 * Math.sqrt(Math.max(0, 1 - Math.pow(t * 0.92, 2.6))) + 0.0]); }
    _revolve(m, prof, 20, 2, c, 11, [1, 1, 1], true);
    for (let q = n0; q < m.n; q++) { m.f[q * 8] = c[0] + (m.f[q * 8] - c[0]) * 1.28; m.f[q * 8 + 1] = c[1] + (m.f[q * 8 + 1] - c[1]) * 0.86; }
    boxK([c[0], c[1], c[2] - 0.058], [0.098, 0.062, 0.003], 17, [1, 1, 1]);
    boxK([0.905 * sd, 1.04, 0.72], [0.05, 0.022, 0.045], 12, [0.05, 0.05, 0.055]); }
  // maçanetas na cor do carro
  for (const sd of [1, -1]) for (const z of [-0.03, -0.95]) boxK([(0.877 - 0.012 * 0) * sd, 0.985 + (z < -0.5 ? 0.012 : 0), z], [0.014, 0.017, 0.085], 11, [1, 1, 1]);
  // maçaneta da tampa traseira (lado esquerdo: a tampa abre para o lado) e dobradiças à direita
  boxK([0.60, 0.99, -2.075], [0.07, 0.022, 0.012], 12, [0.06, 0.06, 0.065]);
  for (const y of [0.92, 1.30]) boxK([-0.735, y, -2.07], [0.02, 0.05, 0.012], 12, [0.06, 0.06, 0.065]);
  // limpador traseiro e saída de escape
  // ---- interior ----
  const g1 = [0.075, 0.075, 0.08], g2 = [0.12, 0.12, 0.125], g3 = [0.035, 0.035, 0.04];
  boxK([0, 0.44, -0.3], [0.80, 0.02, 1.55], 13, g3);
  boxK([0, 0.93, 0.80], [0.80, 0.11, 0.17], 13, g1); boxK([0, 1.035, 0.90], [0.80, 0.02, 0.12], 13, g3); boxK([0.36, 0.99, 0.69], [0.17, 0.065, 0.06], 13, g3);
  boxK([0, 0.66, 0.15], [0.13, 0.12, 0.42], 13, g1);
  for (const sd of [1, -1]) { const x = 0.37 * sd;
    boxK([x, 0.60, -0.02], [0.24, 0.065, 0.25], 13, g2); const by = [0, 0.975, -0.22], bz = [0, 0.22, 0.975];
    boxK([x, 0.93, -0.33], [0.235, 0.31, 0.055], 13, g2, X, by, bz); boxK([x, 1.33, -0.405], [0.11, 0.085, 0.045], 13, g1, X, by, bz);
    boxK([x * 2.28, 0.80, -0.1], [0.02, 0.26, 1.2], 13, g1); }
  boxK([0, 0.62, -1.02], [0.66, 0.07, 0.24], 13, g2); boxK([0, 0.96, -1.30], [0.66, 0.30, 0.055], 13, g2, X, [0, 0.98, -0.2], [0, 0.2, 0.98]);
  for (const x of [0.36, -0.36]) boxK([x, 1.34, -1.37], [0.10, 0.075, 0.04], 13, g1);
  boxK([0, 0.86, -1.72], [0.70, 0.02, 0.30], 13, g3);
  // volante (lado esquerdo) e coluna
  { const c = [0.37, 1.045, 0.565], n0 = m.n, RT = 0.185, rt = 0.017, NA = 28, NB = 8, tilt = 0.42, ct = Math.cos(tilt), st2 = Math.sin(tilt);
    for (let i = 0; i <= NA; i++) for (let j = 0; j <= NB; j++) { const a = i / NA * 6.2832, b = j / NB * 6.2832, rr = RT + rt * Math.cos(b), lx = rr * Math.cos(a), ly = rr * Math.sin(a), lz = rt * Math.sin(b);
      const nx = Math.cos(b) * Math.cos(a), ny = Math.cos(b) * Math.sin(a), nz = Math.sin(b);
      m.v(c[0] + lx, c[1] + ly * ct - lz * st2, c[2] + ly * st2 + lz * ct, nx, ny * ct - nz * st2, ny * st2 + nz * ct, 0, 0, 0.03, 0.03, 0.035, 1, 0, 0, 0, 13); }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NB; j++) { const a = n0 + i * (NB + 1) + j; m.quad(a, a + NB + 1, a + NB + 2, a + 1); }
    boxK([c[0], c[1], c[2] + 0.01], [0.17, 0.02, 0.012], 13, g3, X, [0, ct, st2], [0, -st2, ct]); boxK([c[0], c[1] - 0.075, c[2] + 0.02], [0.02, 0.085, 0.012], 13, g3, X, [0, ct, st2], [0, -st2, ct]);
    tubeK([c[0], c[1] - 0.01, c[2] + 0.01], [c[0], c[1] - 0.10, c[2] + 0.22], 0.035, 0.035, 8, 13, [0.035, 0.035, 0.04, 1]); }
  return m;
}
function _decals() { // atlas de letreiros gerado com canvas 2D (nenhum arquivo): SUZUKI, GRAND VITARA, placa genérica, emblema
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 78px "Arial Black", "Helvetica Neue", Arial, sans-serif'; if (g.letterSpacing !== undefined) g.letterSpacing = '10px'; g.fillText('SUZUKI', 256, 66);
  g.font = 'italic 800 50px Arial, sans-serif'; if (g.letterSpacing !== undefined) g.letterSpacing = '3px'; g.fillText('GRAND VITARA', 768, 66);
  g.font = '800 92px "Arial Narrow", Arial, sans-serif'; if (g.letterSpacing !== undefined) g.letterSpacing = '8px'; g.fillText('TRL 4X4', 256, 196);
  // emblema: "S" anguloso estilizado
  g.save(); g.translate(576, 192); g.transform(1, 0, -0.18, 1, 0, 0); g.font = '900 150px "Arial Black", Impact, Arial, sans-serif'; if (g.letterSpacing !== undefined) g.letterSpacing = '0px'; g.fillText('S', 0, 8); g.restore();
  const d = g.getImageData(0, 0, 1024, 256).data, out = new Uint8Array(1024 * 256 * 4); out.set(d);
  const t = texFromData(1024, 256, 'rgba8unorm', out, 4, { mips: 6 }); genMips(t, 'rgba8unorm', 1, 6); return t;
}
function carInit() {
  const dev = GPU.dev, D = CarD;
  const body = makeCarBody(), parts = makeCarParts(), wheel = makeWheel();
  D.mBody = body.build(); D.mParts = parts.build(); D.mWheel = wheel.build();
  D.ubo = dev.createBuffer({ size: 168 * 4, usage: 0x40 | 8 }); D.decT = _decals();
  D.L = mkBGL(['u', 't', 't', 's', 'ta', 'ta']); D.bg = mkBG(D.L, [D.ubo, D.decT.createView(), R.envT.createView(), R.sPano, R.matA.createView(), R.matN.createView()]);
  const vb = [S.vbl[0]];
  D.pG = mkPipe({ label: 'carro', code: WG_CAR, layouts: [R.L0, D.L], targets: R.G_T, depth: { write: true, compare: 'greater' }, buffers: vb });
  D.pS = mkPipe({ label: 'carro-sombra', code: WG_CAR, vs: 'vsShadow', layouts: [R.L0, D.L], depth: { write: true, compare: 'less', bias: 2, slope: 2.5 }, buffers: vb });
  D.pF = mkPipe({ label: 'carro-vidro', code: WG_CAR, fs: 'fsGlass', layouts: [R.L0, D.L], targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }], depth: { write: false, compare: 'greater' }, buffers: vb, cull: 'back' });
  m4fromQT(D.body, 0, 0, 0, 0, 1, 0, 0, 0);
}
const _wm = new Float32Array(16), _wr = new Float32Array(16);
function carUpdate(dt) {
  const D = CarD, u = D.u; if (!D.ubo) return;
  const hasP = typeof Physics !== 'undefined';
  for (let i = 0; i < 80; i++) u[80 + i] = u[i];
  if (hasP) { const P = Physics; m4fromQT(D.body, 0, P.quat[0], P.quat[1], P.quat[2], P.quat[3], P.pos[0], P.pos[1], P.pos[2]); }
  else if (D.pose) m4trs(D.body, 0, D.pose[0], D.pose[1], D.pose[2], 0, D.pose[3], 0);
  u.set(D.body, 0);
  for (let w = 0; w < 4; w++) {
    const left = (w & 1) === 0, front = w < 2, wy = hasP ? Physics.wy[w] : D.RW, spin = hasP ? Physics.spin[w] : 0, steer = front && hasP ? Physics.steerAngle : 0;
    m4trs(_wm, 0, (left ? 1 : -1) * D.TRK, wy, front ? D.AXF : D.AXR, left ? spin : -spin, steer + (left ? 0 : Math.PI), 0);
    m4mul(u, 16 + w * 16, D.body, 0, _wm, 0);
  }
  if (D.first) { for (let i = 0; i < 80; i++) u[80 + i] = u[i]; D.first = false; }
  // sujeira acumulada
  if (hasP && !Game.paused) { const P = Physics, sp = Math.abs(P.speed); let du = 0, mu = 0;
    for (let w = 0; w < 4; w++) if (P.contact[w] > 0.5) { const s = P.surf[w]; if (P.wet[w] > 0.35 || s === SURF_AGUA) mu += (0.004 + P.slip[w] * 0.02) * sp; else if (s !== SURF_MADEIRA && s !== SURF_GRAMA) du += 0.0005 * sp; }
    D.dust = Math.min(1, D.dust + du * dt * 0.25); D.mud = Math.min(1, D.mud + mu * dt * 0.25); D.brake += ((P.brakeLight ? 1 : 0) - D.brake) * Math.min(1, dt * 30); D.rev = P.reverse ? 1 : 0;
    R.fb[180] = P.pos[0]; R.fb[181] = P.pos[1]; R.fb[182] = P.pos[2]; R.fb[183] = sp; R.fb[185] = D.body[8]; R.fb[186] = D.body[10]; }
  else if (D.pose) { R.fb[180] = D.pose[0]; R.fb[181] = D.pose[1]; R.fb[182] = D.pose[2]; }
  u[160] = D.dust; u[161] = D.mud; u[162] = D.brake; u[163] = D.rev || 0;
}
function carPre() { GPU.dev.queue.writeBuffer(CarD.ubo, 0, CarD.u); }
function _carDraw(p) {
  const D = CarD; p.setBindGroup(1, D.bg);
  p.setVertexBuffer(0, D.mBody.vb); p.setIndexBuffer(D.mBody.ib, 'uint32'); p.drawIndexed(D.mBody.n, 1, 0, 0, 0);
  p.setVertexBuffer(0, D.mParts.vb); p.setIndexBuffer(D.mParts.ib, 'uint32'); p.drawIndexed(D.mParts.n, 1, 0, 0, 0);
  p.setVertexBuffer(0, D.mWheel.vb); p.setIndexBuffer(D.mWheel.ib, 'uint32'); for (let w = 0; w < 4; w++) p.drawIndexed(D.mWheel.n, 1, 0, 0, 1 + w);
}
function carG(p) { p.setPipeline(CarD.pG); _carDraw(p); }
function carShadow(p, c) { if (c > 1) return; p.setPipeline(CarD.pS); _carDraw(p); }
function carFwd(p) { const D = CarD; p.setPipeline(D.pF); p.setBindGroup(1, D.bg); p.setVertexBuffer(0, D.mBody.vb); p.setIndexBuffer(D.mBody.ib, 'uint32'); p.drawIndexed(D.mBody.n, 1, 0, 0, 0); }
