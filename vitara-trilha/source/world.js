// world.js — trilha, relevo, máscaras e objetos. JS puro (roda também no node para os testes).
// Convenções: metros, Y para cima, sistema destro. Lateral t > 0 = esquerda do sentido da volta.
const SC = 0.72;
const NEAR_N = 2048, NEAR_SIZE = 1024, NEAR_TX = NEAR_SIZE / NEAR_N, NEAR_HALF = NEAR_SIZE / 2;
const FLD_N = 1024, FLD_R = 40;
const FAR_N = 1024, FAR_SIZE = 16384;
const SURF_TERRA = 0, SURF_CASCALHO = 1, SURF_LAMA = 2, SURF_AGUA = 3, SURF_GRAMA = 4, SURF_MADEIRA = 5, SURF_PEDRA = 6;

const World = {
  ready: false,
  trk: null, str: null,
  hNear: null, nrmNear: null, mask: null, field: null, hFar: null,
  fIdx: null, sIdx: null,
  bridge: { s0: 0, s1: 0, hw: 2.3, y0: 0, y1: 0, cx: 0, cz: 0, tx: 1, tz: 0, len: 0 },
  gateS: 18, startS: 6, checkpoints: null,
  trees: null, nTrees: 0, rocks: null, nRocks: 0, posts: null, nPosts: 0, wires: null, nWires: 0,
  col: null, nCol: 0, colGridStart: null, colGridIdx: null,
  lookout: { x: 0, y: 0, z: 0, yaw: 0 },
  tq: { s: 0, t: 0, hw: 3.2, idx: 0, on: false },
  sf: { type: 0, grip: 1, drag: 0, rumble: 0, wet: 0, water: 0, dust: 0 },
  sun: [-0.74, 0.27, -0.62],
};

function farH(x, z) {
  const r = Math.hypot(x, z);
  const bowl = smooth(300, 2200, r);
  let h = 24 + (ridge2(x / 1500 + 3.1, z / 1500 - 1.7, 5) * 560 - 70) * Math.pow(bowl, 1.15);
  h += fbm2(x / 330 + 7, z / 330 + 2, 4) * 46 * smooth(220, 900, r);
  h += ridge2(x / 260, z / 260, 4) * 30 * smooth(150, 480, r) * (1 - bowl * 0.6);
  return h;
}

function _spline(pts, closed, step, dim) {
  // Catmull-Rom uniforme; devolve arrays reamostrados com passo ~step
  const n = pts.length, tmp = [];
  const P = (i) => closed ? pts[((i % n) + n) % n] : pts[i < 0 ? 0 : i >= n ? n - 1 : i];
  const segs = closed ? n : n - 1, SUB = 48;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < SUB; k++) {
      const u = k / SUB, u2 = u * u, u3 = u2 * u, o = [i + u];
      for (let d = 0; d < dim; d++)
        o.push(0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3));
      tmp.push(o);
    }
  }
  if (closed) tmp.push([segs, ...tmp[0].slice(1)]); else tmp.push([segs, ...pts[n - 1].slice(0, dim)]);
  const cum = [0];
  for (let i = 1; i < tmp.length; i++) cum.push(cum[i - 1] + Math.hypot(tmp[i][1] - tmp[i - 1][1], tmp[i][2] - tmp[i - 1][2]));
  const L = cum[cum.length - 1], N = Math.round(L / step), ds = L / N;
  const cnt = closed ? N : N + 1, out = [];
  for (let d = 0; d <= dim; d++) out.push(new Float32Array(cnt));
  let j = 0;
  for (let i = 0; i < cnt; i++) {
    const s = i * ds;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    for (let d = 0; d <= dim; d++) out[d][i] = tmp[j][d] + (tmp[j + 1][d] - tmp[j][d]) * f;
  }
  return { n: cnt, L, ds, u: out[0], c: out.slice(1) };
}

function worldInit() {
  const W = World;
  // ---------- traçado ----------
  const CP = [
    [-10, -120, 21.0, 3.3], [70, -120, 20.6, 3.3], [130, -105, 20.4, 3.3], [160, -60, 20.4, 3.2], [150, -10, 19.6, 3.4],
    [165, 40, 18.70, 3.6], [140, 90, 20.8, 3.2], [90, 110, 24.5, 3.1], [40, 100, 33.0, 3.1], [-10, 115, 39.5, 3.1],
    [-60, 105, 42.0, 3.4], [-110, 70, 40.5, 3.2], [-120, 20, 34.5, 3.1], [-95, -25, 28.5, 3.1], [-125, -70, 24.0, 3.2],
    [-105, -108, 22.3, 3.0], [-70, -119, 22.0, 2.6], [-40, -120, 21.8, 2.6],
  ].map((p) => [p[0] * SC, p[1] * SC, p[2], p[3]]);
  const sp = _spline(CP, true, 0.5, 4);
  const n = sp.n, T = { n, L: sp.L, ds: sp.ds, x: sp.c[0], z: sp.c[1], y: sp.c[2], hw: sp.c[3], tx: new Float32Array(n), tz: new Float32Array(n), u: sp.u, curv: new Float32Array(n) };
  // suaviza o perfil vertical
  for (let it = 0; it < 6; it++) { const y0 = Float32Array.from(T.y); for (let i = 0; i < n; i++) T.y[i] = (y0[(i + n - 1) % n] + 2 * y0[i] + y0[(i + 1) % n]) / 4; }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n; let dx = T.x[b] - T.x[a], dz = T.z[b] - T.z[a]; const l = Math.hypot(dx, dz);
    T.tx[i] = dx / l; T.tz[i] = dz / l;
  }
  for (let i = 0; i < n; i++) { const a = (i + n - 4) % n, b = (i + 4) % n; T.curv[i] = (T.tx[a] * T.tz[b] - T.tz[a] * T.tx[b]) / (8 * T.ds); }
  W.trk = T;
  const sOfCtrl = (ci) => { // s do parâmetro de controle ci (pode ser fracionário)
    let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(T.u[i] - ci); if (d < bd) { bd = d; best = i; } } return best * T.ds;
  };
  // zonas de piso (em s)
  const Z = (a, b, type) => ({ a: sOfCtrl(a), b: sOfCtrl(b), type });
  const zones = [Z(1.5, 3.45, 1), Z(3.6, 4.55, 2), Z(7.0, 9.3, 6), Z(9.3, 13.2, 1), Z(13.45, 14.5, 2)];
  W.zones = zones;
  const zoneW = (s, type) => { let w = 0; for (const z of zones) if (z.type === type) w = Math.max(w, smooth(z.a - 4, z.a + 4, s) * (1 - smooth(z.b - 4, z.b + 4, s))); return w; };

  // ---------- riacho ----------
  const SP = [[-200, -330], [-120, -230], [-75, -165], [-55, -119.5], [-45, -75], [0, -35], [70, -5], [125, 20], [165, 40], [230, 60], [320, 78], [420, 90]].map((p) => [p[0] * SC, p[1] * SC]);
  const ss = _spline(SP, false, 1.0, 2);
  const S = { n: ss.n, L: ss.L, ds: ss.ds, x: ss.c[0], z: ss.c[1], bed: new Float32Array(ss.n), w: new Float32Array(ss.n), tx: new Float32Array(ss.n), tz: new Float32Array(ss.n) };
  const iBridge = (() => { let b = 0, bd = 1e9; for (let i = 0; i < S.n; i++) { const d = Math.abs(ss.u[i] - 3); if (d < bd) { bd = d; b = i; } } return b; })();
  const iFord = (() => { let b = 0, bd = 1e9; for (let i = 0; i < S.n; i++) { const d = Math.abs(ss.u[i] - 8); if (d < bd) { bd = d; b = i; } } return b; })();
  const bedB = 19.45, bedF = 18.62;
  for (let i = 0; i < S.n; i++) {
    if (i < iBridge) S.bed[i] = bedB + (iBridge - i) * S.ds * 0.022;
    else if (i <= iFord) S.bed[i] = bedB + (bedF - bedB) * (i - iBridge) / (iFord - iBridge);
    else S.bed[i] = bedF - (i - iFord) * S.ds * 0.008;
    const fd = Math.abs(i - iFord) * S.ds;
    S.w[i] = 2.6 + 2.6 * (1 - smooth(4, 16, fd)) + 0.5 * Math.sin(i * 0.21);
    const a = Math.max(0, i - 1), b = Math.min(S.n - 1, i + 1), dx = S.x[b] - S.x[a], dz = S.z[b] - S.z[a], l = Math.hypot(dx, dz);
    S.tx[i] = dx / l; S.tz[i] = dz / l;
  }
  W.str = S; S.iFord = iFord; S.iBridge = iBridge;

  // ---------- campos de distância (1 m) ----------
  const F = FLD_N, fD = new Float32Array(F * F).fill(1e9), fI = new Int32Array(F * F).fill(-1);
  const sD = new Float32Array(F * F).fill(1e9), sI = new Int32Array(F * F).fill(-1);
  const splat = (px, pz, idx, D, I, R) => {
    const cx = px + NEAR_HALF, cz = pz + NEAR_HALF;
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(F - 1, Math.ceil(cx + R)), z0 = Math.max(0, Math.floor(cz - R)), z1 = Math.min(F - 1, Math.ceil(cz + R));
    for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - cx, dz = zz + 0.5 - cz, d = dx * dx + dz * dz, k = zz * F + xx;
      if (d < D[k]) { D[k] = d; I[k] = idx; }
    }
  };
  for (let i = 0; i < n; i += 2) splat(T.x[i], T.z[i], i, fD, fI, FLD_R);
  for (let i = 0; i < S.n; i++) splat(S.x[i], S.z[i], i, sD, sI, 26);
  W.fIdx = fI; W.sIdx = sI;

  // ---------- ponte ----------
  {
    let i0 = -1, i1 = -1;
    const c16 = Math.round(sOfCtrl(15.6) / T.ds), c17 = Math.round(sOfCtrl(17.4) / T.ds);
    for (let i = c16; i <= c17; i++) {
      let md = 1e9; for (let j = Math.max(0, iBridge - 30); j < Math.min(S.n, iBridge + 30); j++) md = Math.min(md, Math.hypot(S.x[j] - T.x[i % n], S.z[j] - T.z[i % n]));
      if (md < 7.0) { if (i0 < 0) i0 = i; i1 = i; }
    }
    const B = W.bridge; B.s0 = i0 * T.ds; B.s1 = i1 * T.ds; B.i0 = i0; B.i1 = i1;
    B.x0 = T.x[i0]; B.z0 = T.z[i0]; B.x1 = T.x[i1 % n]; B.z1 = T.z[i1 % n]; B.y0 = T.y[i0]; B.y1 = T.y[i1 % n];
    B.len = Math.hypot(B.x1 - B.x0, B.z1 - B.z0); B.tx = (B.x1 - B.x0) / B.len; B.tz = (B.z1 - B.z0) / B.len;
  }
  const B = W.bridge;

  // ---------- malha macro relaxada (8 m) ----------
  const G = 129, gs = NEAR_SIZE / (G - 1), gH = new Float32Array(G * G), gFix = new Uint8Array(G * G), gSum = new Float32Array(G * G), gCnt = new Float32Array(G * G);
  const gAdd = (x, z, y, wgt) => { const gx = Math.round((x + NEAR_HALF) / gs), gz = Math.round((z + NEAR_HALF) / gs); if (gx < 0 || gz < 0 || gx >= G || gz >= G) return; gSum[gz * G + gx] += y * wgt; gCnt[gz * G + gx] += wgt; };
  for (let i = 0; i < n; i++) gAdd(T.x[i], T.z[i], T.y[i] + 0.4, 1);
  for (let i = 0; i < S.n; i++) gAdd(S.x[i], S.z[i], S.bed[i] + 0.8, 0.5);
  const hints = [[-40, 200, 66], [50, -215, 40], [270, -60, 36], [-250, 20, 52], [20, 35, 23.5], [60, 190, 50], [-170, 150, 60], [230, 160, 40], [-200, -160, 38], [-20, 60, 30], [-55, 35, 30], [250, 40, 21], [70, 70, 27]];
  for (const h of hints) gAdd(h[0] * SC, h[1] * SC, h[2], 50);
  for (let k = 0; k < G * G; k++) {
    const gx = k % G, gz = (k / G) | 0;
    if (gx === 0 || gz === 0 || gx === G - 1 || gz === G - 1) { gH[k] = farH(gx * gs - NEAR_HALF, gz * gs - NEAR_HALF); gFix[k] = 1; }
    else if (gCnt[k] > 0) { gH[k] = gSum[k] / gCnt[k]; gFix[k] = 1; } else gH[k] = 26;
  }
  for (let it = 0; it < 900; it++) for (let gz = 1; gz < G - 1; gz++) for (let gx = 1; gx < G - 1; gx++) {
    const k = gz * G + gx; if (gFix[k]) continue;
    gH[k] += 1.88 * ((gH[k - 1] + gH[k + 1] + gH[k - G] + gH[k + G]) * 0.25 - gH[k]);
  }
  const bs = (t, o) => { const t2 = t * t, t3 = t2 * t; o[0] = (1 - 3 * t + 3 * t2 - t3) / 6; o[1] = (4 - 6 * t2 + 3 * t3) / 6; o[2] = (1 + 3 * t + 3 * t2 - 3 * t3) / 6; o[3] = t3 / 6; };
  const wx = [0, 0, 0, 0], wz = [0, 0, 0, 0];
  const macro = (x, z) => {
    const fx = (x + NEAR_HALF) / gs, fz = (z + NEAR_HALF) / gs, ix = Math.floor(fx), iz = Math.floor(fz);
    bs(fx - ix, wx); bs(fz - iz, wz); let s = 0;
    for (let j = 0; j < 4; j++) { const zz = clamp(iz - 1 + j, 0, G - 1); for (let i = 0; i < 4; i++) s += wx[i] * wz[j] * gH[zz * G + clamp(ix - 1 + i, 0, G - 1)]; }
    return s;
  };
  // passada grossa (2 m): macro + ruído largo
  const C = 513, cH = new Float32Array(C * C);
  for (let cz = 0; cz < C; cz++) for (let cx = 0; cx < C; cx++) {
    const x = cx * 2 - NEAR_HALF, z = cz * 2 - NEAR_HALF, r = Math.hypot(x, z);
    cH[cz * C + cx] = macro(x, z) + ridge2(x / 260, z / 260, 4) * 30 * smooth(150, 480, r) - 12 * smooth(150, 480, r) + fbm2(x / 70 + 11, z / 70 - 5, 4) * 9;
  }

  // ---------- consulta de trilha ----------
  const tq = W.tq;
  const trackQ = (x, z) => {
    const fx = Math.floor(x + NEAR_HALF), fz = Math.floor(z + NEAR_HALF);
    tq.on = false; tq.t = 99; tq.idx = -1;
    if (fx < 0 || fz < 0 || fx >= F || fz >= F) return false;
    let i = fI[fz * F + fx]; if (i < 0) return false;
    let best = i, bd = 1e9;
    for (let k = -3; k <= 3; k++) { const j = (i + k + n) % n, dx = x - T.x[j], dz = z - T.z[j], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } }
    const dx = x - T.x[best], dz = z - T.z[best];
    const along = dx * T.tx[best] + dz * T.tz[best];
    tq.t = dx * T.tz[best] - dz * T.tx[best]; tq.s = best * T.ds + along; if (tq.s < 0) tq.s += T.L; if (tq.s >= T.L) tq.s -= T.L;
    tq.idx = best; tq.hw = T.hw[best]; tq.y = T.y[best] + (T.y[(best + 1) % n] - T.y[best]) * (along / T.ds);
    tq.on = Math.abs(tq.t) <= tq.hw; return true;
  };
  W.trackQ = trackQ;
  const stq = { d: 99, idx: -1, bed: 0, w: 3 };
  const streamQ = (x, z) => {
    const fx = Math.floor(x + NEAR_HALF), fz = Math.floor(z + NEAR_HALF); stq.d = 99; stq.idx = -1;
    if (fx < 0 || fz < 0 || fx >= F || fz >= F) return false;
    const i = sI[fz * F + fx]; if (i < 0) return false;
    let best = i, bd = 1e9;
    for (let k = -2; k <= 2; k++) { const j = clamp(i + k, 0, S.n - 1), dx = x - S.x[j], dz = z - S.z[j], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } }
    const dx = x - S.x[best], dz = z - S.z[best], al = clamp(dx * S.tx[best] + dz * S.tz[best], -S.ds, S.ds);
    stq.d = Math.abs(dx * S.tz[best] - dz * S.tx[best]); if (bd > 9 && Math.abs(al) >= S.ds) stq.d = Math.sqrt(bd);
    const j2 = clamp(best + (al > 0 ? 1 : -1), 0, S.n - 1), f = Math.abs(al) / S.ds;
    stq.bed = S.bed[best] + (S.bed[j2] - S.bed[best]) * f; stq.w = S.w[best]; stq.idx = best; return true;
  };
  W.streamQ = streamQ; W.stq = stq;

  // ---------- passada fina (0.5 m): alturas + máscara + campo ----------
  const N = NEAR_N, H = new Float32Array(N * N), M = new Uint8Array(N * N * 4);
  const FT = new Float32Array(F * F * 4); // campo p/ GPU: t, cos s, sin s, distância ao riacho
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const x = (ix + 0.5) * NEAR_TX - NEAR_HALF, z = (iz + 0.5) * NEAR_TX - NEAR_HALF, k = iz * N + ix;
    const cfx = (x + NEAR_HALF) / 2, cfz = (z + NEAR_HALF) / 2, cx = Math.min(C - 2, Math.floor(cfx)), cz = Math.min(C - 2, Math.floor(cfz)), ux = cfx - cx, uz = cfz - cz;
    let h = lerp(lerp(cH[cz * C + cx], cH[cz * C + cx + 1], ux), lerp(cH[(cz + 1) * C + cx], cH[(cz + 1) * C + cx + 1], ux), uz);
    const hasT = trackQ(x, z), at = Math.abs(tq.t), dEdge = hasT ? Math.max(0, at - tq.hw) : FLD_R;
    const hasS = streamQ(x, z), sd = hasS ? stq.d : 99;
    h += (fbm2(x / 9 + 3, z / 9 + 8, 3) * 0.7 + fbm2(x / 2.3, z / 2.3, 2) * 0.12) * smooth(1.5, 14, dEdge) * smooth(1, 10, sd);
    let mud = 0, grav = 0, rock = 0, pud = 0;
    if (hasS && sd < stq.w + 9) { // calha do riacho
      const q = sd / stq.w, target = stq.bed + q * q * 0.45 + fbm2(x / 1.7, z / 1.7, 2) * 0.10;
      h = lerp(h, Math.min(h, target + Math.max(0, sd - stq.w) * 0.55), 1 - smooth(stq.w + 1.5, stq.w + 9, sd));
    }
    if (hasT && at < tq.hw + 9) {
      const s = tq.s;
      let wC = 1 - smooth(tq.hw + 0.2, tq.hw + 8, at);
      const inBr = s > B.s0 - 3 && s < B.s1 + 3;
      const inSpan = s > B.s0 && s < B.s1;
      rock = zoneW(s, 6); mud = zoneW(s, 2); grav = zoneW(s, 1);
      const und = fbm2(s / 3.1, tq.t / 1.7 + 5, 2) * (0.07 + 0.2 * rock) + fbm2(s / 9, tq.t / 4, 2) * 0.08 - (at / tq.hw) * (at / tq.hw) * 0.05;
      h = inSpan ? lerp(h, Math.min(h, tq.y - 0.35), wC) : lerp(h, tq.y + und, wC);
      const inT = 1 - smooth(tq.hw - 0.3, tq.hw + 1.2, at);
      const pn = fbm2(x / 4.2 + 31, z / 4.2 - 17, 3) + 0.5;
      const thr = lerp(lerp(0.80, 0.50, mud), 1.5, Math.max(rock, grav * 0.8));
      pud = sat((pn - thr) * 5) * inT * (inBr ? 0 : 1);
      h -= pud * 0.06;
      mud *= inT; grav *= inT; rock *= inT;
    }
    const e = Math.max(Math.abs(x), Math.abs(z));
    if (e > NEAR_HALF - 64) h = lerp(h, farH(x, z), smooth(NEAR_HALF - 64, NEAR_HALF - 8, e));
    H[k] = h; M[k * 4] = mud * 255; M[k * 4 + 1] = grav * 255; M[k * 4 + 2] = pud * 255; M[k * 4 + 3] = rock * 255;
  }
  for (let iz = 0; iz < F; iz++) for (let ix = 0; ix < F; ix++) {
    const x = ix + 0.5 - NEAR_HALF, z = iz + 0.5 - NEAR_HALF, k = (iz * F + ix) * 4;
    if (trackQ(x, z)) { const a = tq.s / T.L * 6.283185307; FT[k] = tq.t; FT[k + 1] = Math.cos(a); FT[k + 2] = Math.sin(a); } else { FT[k] = 60; FT[k + 1] = 1; FT[k + 2] = 0; }
    FT[k + 3] = streamQ(x, z) ? stq.d - stq.w : 40;
  }
  W.hNear = H; W.mask = M; W.field = FT;
  // normais
  const NR = new Uint8Array(N * N * 4);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
    const xa = Math.max(0, ix - 1), xb = Math.min(N - 1, ix + 1), za = Math.max(0, iz - 1), zb = Math.min(N - 1, iz + 1);
    const dx = (H[iz * N + xb] - H[iz * N + xa]) / ((xb - xa) * NEAR_TX), dz = (H[zb * N + ix] - H[za * N + ix]) / ((zb - za) * NEAR_TX);
    const l = 1 / Math.hypot(dx, 1, dz), k = (iz * N + ix) * 4;
    NR[k] = (-dx * l * 0.5 + 0.5) * 255; NR[k + 1] = (l * 0.5 + 0.5) * 255; NR[k + 2] = (-dz * l * 0.5 + 0.5) * 255; NR[k + 3] = 255;
  }
  W.nrmNear = NR;
  // longe
  const HF = new Float32Array(FAR_N * FAR_N), ft = FAR_SIZE / FAR_N;
  for (let iz = 0; iz < FAR_N; iz++) for (let ix = 0; ix < FAR_N; ix++) HF[iz * FAR_N + ix] = farH((ix + 0.5) * ft - FAR_SIZE / 2, (iz + 0.5) * ft - FAR_SIZE / 2);
  W.hFar = HF;

  // ---------- objetos ----------
  const rnd = mulberry32(4242);
  const cols = []; // x, z, r, h
  // árvores: x,y,z,escala,rot,tipo(0,1 folhosas; 2 araucária; 3 arbusto),seed,_
  const trees = [];
  const TR = 440, cell = 4.6;
  for (let gz = -TR; gz < TR; gz += cell) for (let gx = -TR; gx < TR; gx += cell) {
    const x = gx + rnd() * cell, z = gz + rnd() * cell, r = Math.hypot(x, z); const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
    if (r > TR) continue;
    const hasT = trackQ(x, z), dE = hasT ? Math.abs(tq.t) - tq.hw : 40; if (dE < 3.4) continue;
    const hasS = streamQ(x, z); if (hasS && stq.d < stq.w + 2.0) continue;
    // mantém a vista do mirante e o miolo como campo aberto com capões
    const dens = fbm2(x / 85 + 20, z / 85 + 4, 3) + 0.5;
    let p = smooth(0.34, 0.62, dens) * 0.85 + 0.03;
    p *= 0.2 + 0.8 * smooth(4, 22, dE); if (hasS) p *= 0.35 + 0.65 * smooth(3, 12, stq.d - stq.w);
    p = Math.max(p, smooth(230, 300, r) * 0.8);
    if (r1 > p) continue;
    const y = W.heightRaw(x, z);
    let type = r2 < 0.42 ? 0 : r2 < 0.74 ? 1 : 2; if (dE < 9 && r3 < 0.6) type = 3; else if (r3 < 0.14) type = 3;
    if (type === 2 && y < 21.5 && r4 < 0.7) type = 0;
    const sc = type === 3 ? 0.7 + rnd() * 0.7 : 0.75 + rnd() * 0.6;
    trees.push(x, y - 0.12, z, sc, rnd() * 6.283, type, rnd(), 0);
    if (type !== 3 && dE < 34) cols.push(x, z, (type === 2 ? 0.34 : 0.3) * sc, 3);
  }
  W.trees = new Float32Array(trees); W.nTrees = trees.length / 8;
  // pedras: x,y,z,escala,rot,tipo(0..2),seed,achatamento
  const rocks = [];
  const addRock = (x, z, sc, sink, col) => { const y = W.heightRaw(x, z); rocks.push(x, y - sc * sink, z, sc, rnd() * 6.283, (rnd() * 3) | 0, rnd(), 0.6 + rnd() * 0.5); if (col && sc > 0.45) cols.push(x, z, sc * 0.8, sc * 0.7); };
  for (let i = 0; i < n; i += 2) {
    const s = i * T.ds, rk = zoneW(s, 6), gv = zoneW(s, 1);
    const inBr = s > B.s0 - 2 && s < B.s1 + 2; if (inBr) continue;
    const cnt = rk > 0.5 ? 3 : gv > 0.5 ? 1 : (rnd() < 0.25 ? 1 : 0);
    for (let k = 0; k < cnt; k++) {
      const side = rnd() < 0.5 ? -1 : 1, big = rnd() < (rk > 0.5 ? 0.22 : 0.06);
      const off = big ? T.hw[i] + 1.4 + rnd() * 6 : T.hw[i] - 0.5 + rnd() * 3.5, sc = big ? 0.5 + rnd() * 1.1 : 0.07 + rnd() * 0.2;
      addRock(T.x[i] + T.tz[i] * off * side + (rnd() - 0.5), T.z[i] - T.tx[i] * off * side + (rnd() - 0.5), sc, big ? 0.35 : 0.3, true);
    }
    if (rk > 0.5 && rnd() < 0.5) { const off = (rnd() * 2 - 1) * (T.hw[i] - 0.4); addRock(T.x[i] + T.tz[i] * off, T.z[i] - T.tx[i] * off, 0.05 + rnd() * 0.09, 0.45, false); }
  }
  for (let i = 4; i < S.n - 4; i++) {
    if (Math.hypot(S.x[i], S.z[i]) > 330) continue;
    for (let k = 0; k < 2; k++) {
      const side = rnd() < 0.5 ? -1 : 1, off = S.w[i] * (0.25 + rnd() * 1.1), x = S.x[i] + S.tz[i] * off * side, z = S.z[i] - S.tx[i] * off * side;
      if (trackQ(x, z) && Math.abs(tq.t) < tq.hw + 1.2) continue;
      addRock(x, z, rnd() < 0.2 ? 0.4 + rnd() * 0.7 : 0.08 + rnd() * 0.25, 0.4, true);
    }
  }
  for (let k = 0; k < 500; k++) { const a = rnd() * 6.283, r = 30 + rnd() * 330, x = Math.cos(a) * r, z = Math.sin(a) * r; if (trackQ(x, z) && Math.abs(tq.t) < tq.hw + 3) continue; addRock(x, z, 0.3 + rnd() * rnd() * 2.2, 0.4, true); }
  W.rocks = new Float32Array(rocks); W.nRocks = rocks.length / 8;

  // cerca: mourões (x,y,z,yaw) e fios (segmentos entre mourões consecutivos)
  const posts = [], wires = [];
  const fence = (sA, sB, side, off) => {
    let prev = null;
    for (let s = sA; s <= sB; s += 2.6) {
      const i = ((Math.round(s / T.ds) % n) + n) % n, o = (T.hw[i] + off) * side;
      const x = T.x[i] + T.tz[i] * o, z = T.z[i] - T.tx[i] * o;
      if (streamQ(x, z) && stq.d < stq.w + 1.5) { prev = null; continue; }
      const y = W.heightRaw(x, z), p = [x, y, z, Math.atan2(T.tx[i], T.tz[i]) + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.07, (rnd() - 0.5) * 0.07, 0.92 + rnd() * 0.14, rnd()];
      posts.push(...p); cols.push(x, z, 0.11, 1.3);
      if (prev) wires.push(prev[0], prev[1], prev[2], prev[6], x, y, z, p[6]);
      prev = p;
    }
  };
  fence(-70, 150, 1, 2.2); fence(-52, 132, -1, 2.4);
  fence(sOfCtrl(9.2), sOfCtrl(11.6), -1, 2.0); fence(sOfCtrl(12.2), sOfCtrl(14.8), 1, 2.2); fence(sOfCtrl(5.6), sOfCtrl(6.9), 1, 2.4);
  W.posts = new Float32Array(posts); W.nPosts = posts.length / 8; W.wires = new Float32Array(wires); W.nWires = wires.length / 8;

  // porteira (mourões grossos) e guarda-corpo da ponte como colisores
  {
    const i = Math.round(W.gateS / T.ds), o = T.hw[i] + 0.55;
    W.gate = { x: T.x[i], z: T.z[i], y: T.y[i], tx: T.tx[i], tz: T.tz[i], hw: o };
    cols.push(T.x[i] + T.tz[i] * o, T.z[i] - T.tx[i] * o, 0.24, 4, T.x[i] - T.tz[i] * o, T.z[i] + T.tx[i] * o, 0.24, 4);
    for (let d = 0; d <= B.len + 0.01; d += 0.55) for (const sd of [-1, 1]) cols.push(B.x0 + B.tx * d + B.tz * (B.hw + 0.1) * sd, B.z0 + B.tz * d - B.tx * (B.hw + 0.1) * sd, 0.14, 1.1);
  }
  // mirante: no alto, do lado de dentro (direita) do ponto de controle 10
  {
    const i = Math.round(sOfCtrl(10.15) / T.ds), o = -(T.hw[i] + 5.2);
    const L = W.lookout; L.x = T.x[i] + T.tz[i] * o; L.z = T.z[i] - T.tx[i] * o; L.yaw = Math.atan2(-T.tz[i], T.tx[i]); L.y = T.y[i] + 0.25; L.i = i;
    L.fx = -T.tz[i]; L.fz = T.tx[i]; // direção "para fora" (olhando o vale)
    for (const a of [[-3, -2.2], [3, -2.2], [-3, 2.2], [3, 2.2]]) cols.push(L.x + T.tx[i] * a[0] + L.fx * a[1], L.z + T.tz[i] * a[0] + L.fz * a[1], 0.16, 3);
  }
  W.col = new Float32Array(cols); W.nCol = cols.length / 4;
  // grade de colisores (8 m)
  {
    const GC = 96, cs = 8, half = GC * cs / 2, cnt = new Int32Array(GC * GC + 1);
    const cellOf = (x, z) => clamp(Math.floor((x + half) / cs), 0, GC - 1) + clamp(Math.floor((z + half) / cs), 0, GC - 1) * GC;
    for (let i = 0; i < W.nCol; i++) cnt[cellOf(W.col[i * 4], W.col[i * 4 + 1]) + 1]++;
    for (let i = 0; i < GC * GC; i++) cnt[i + 1] += cnt[i];
    const idx = new Int32Array(W.nCol), fill = new Int32Array(GC * GC);
    for (let i = 0; i < W.nCol; i++) { const c = cellOf(W.col[i * 4], W.col[i * 4 + 1]); idx[cnt[c] + fill[c]++] = i; }
    W.colGridStart = cnt; W.colGridIdx = idx; W.colGC = GC; W.colCS = cs; W.colHalf = half;
  }
  W.checkpoints = new Float32Array([W.gateS, sOfCtrl(3.2), sOfCtrl(6.3), sOfCtrl(9.6), sOfCtrl(12.5), sOfCtrl(15.3)]);
  W.sOfCtrl = sOfCtrl;
  W.ready = true;
}

// altura do terreno (sem ponte): bilinear no mapa próximo, idêntica à amostragem do shader
World.heightRaw = function (x, z) {
  const H = World.hNear, fx = (x + NEAR_HALF) / NEAR_TX - 0.5, fz = (z + NEAR_HALF) / NEAR_TX - 0.5;
  if (fx < 0 || fz < 0 || fx >= NEAR_N - 1 || fz >= NEAR_N - 1) return farH(x, z);
  const ix = Math.floor(fx), iz = Math.floor(fz), ux = fx - ix, uz = fz - iz, k = iz * NEAR_N + ix;
  const a = H[k], b = H[k + 1], c = H[k + NEAR_N], d = H[k + NEAR_N + 1];
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uz;
};
// altura para a física: inclui o tabuleiro da ponte
World.heightAt = function (x, z) {
  const h = World.heightRaw(x, z), B = World.bridge;
  const dx = x - B.x0, dz = z - B.z0, al = dx * B.tx + dz * B.tz, la = dx * B.tz - dz * B.tx;
  if (al > -0.6 && al < B.len + 0.6 && la > -B.hw && la < B.hw) { const yd = B.y0 + (B.y1 - B.y0) * sat(al / B.len); if (yd > h) return yd; }
  return h;
};
World.onBridge = function (x, z) {
  const B = World.bridge, dx = x - B.x0, dz = z - B.z0, al = dx * B.tx + dz * B.tz, la = dx * B.tz - dz * B.tx;
  return al > -0.6 && al < B.len + 0.6 && la > -B.hw && la < B.hw;
};
// nível da água do riacho em (x,z); -1e9 se não houver
World.waterAt = function (x, z) {
  if (!World.streamQ(x, z)) return -1e9; const q = World.stq; if (q.d > q.w + 3) return -1e9; return q.bed + 0.30;
};
// piso em (x,z): preenche World.sf e devolve o tipo
World.surfaceAt = function (x, z) {
  const W = World, sf = W.sf, M = W.mask; let type = SURF_GRAMA;
  sf.wet = 0; sf.water = 0;
  const hasT = W.trackQ(x, z), on = hasT && Math.abs(W.tq.t) < W.tq.hw + 0.6;
  const wl = W.waterAt(x, z), h = W.heightRaw(x, z);
  if (W.onBridge(x, z) && W.heightAt(x, z) > h + 0.05) type = SURF_MADEIRA;
  else if (wl > h + 0.03) { type = SURF_AGUA; sf.water = wl - h; sf.wet = 1; }
  else if (on) {
    const ix = clamp(Math.floor((x + NEAR_HALF) / NEAR_TX), 0, NEAR_N - 1), iz = clamp(Math.floor((z + NEAR_HALF) / NEAR_TX), 0, NEAR_N - 1), k = (iz * NEAR_N + ix) * 4;
    const mud = M[k], grav = M[k + 1], pud = M[k + 2], rock = M[k + 3];
    type = SURF_TERRA; if (grav > 128) type = SURF_CASCALHO; if (rock > 128) type = SURF_PEDRA; if (mud > 128) type = SURF_LAMA;
    sf.wet = Math.max(mud / 255 * 0.7, pud / 255); if (pud > 128) sf.water = 0.05;
  }
  sf.type = type;
  //            terra  casc  lama  água  grama mad   pedra
  sf.grip = [1.00, 0.88, 0.62, 0.70, 0.78, 0.95, 0.92][type];
  sf.drag = [0.015, 0.03, 0.10, 0.16, 0.07, 0.012, 0.035][type];
  sf.rumble = [0.05, 0.30, 0.08, 0.55, 0.10, 0.18, 0.40][type];
  sf.dust = [1.0, 0.8, 0.0, 0.0, 0.15, 0.1, 0.5][type] * (1 - sf.wet);
  return type;
};
// pose sobre a trilha no comprimento s (out: x,y,z,yaw) — yaw tal que a frente (+Z local) aponta no sentido da volta
World.poseAt = function (s, out) {
  const T = World.trk, i = ((Math.round(s / T.ds) % T.n) + T.n) % T.n;
  out[0] = T.x[i]; out[2] = T.z[i]; out[1] = World.heightAt(T.x[i], T.z[i]); out[3] = Math.atan2(T.tx[i], T.tz[i]);
};
// colisores próximos: escreve índices em out (Int32Array) e devolve a contagem
World.queryCol = function (x, z, r, out) {
  const W = World, GC = W.colGC, cs = W.colCS, half = W.colHalf; let c = 0;
  const x0 = clamp(Math.floor((x - r + half) / cs), 0, GC - 1), x1 = clamp(Math.floor((x + r + half) / cs), 0, GC - 1), z0 = clamp(Math.floor((z - r + half) / cs), 0, GC - 1), z1 = clamp(Math.floor((z + r + half) / cs), 0, GC - 1);
  for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) { const k = zz * GC + xx; for (let j = W.colGridStart[k]; j < W.colGridStart[k + 1] && c < out.length; j++) out[c++] = W.colGridIdx[j]; }
  return c;
};
