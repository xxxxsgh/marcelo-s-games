// scene.js — objetos da cena: instâncias com culling/LOD, capim, riacho, cerca, partículas, sulcos, câmeras
const S = {
  dbg: 0,
  NT: 4, streams: null, cnt: new Int32Array(24), cap: 0, sbuf: null, sarr: null, meshes: null,
  planes: new Float32Array(16), plen: new Float32Array(4),
  NP: 4096, pf: null, pinst: null, pn: 0, pcur: 0, palive: 0,
  rut: new Float32Array(4 * 8), rutN: 0, lastC: new Float32Array(12), lastOk: new Uint8Array(4), rutClear: true,
  camE: new Float32Array(3), camT: new Float32Array(3), camYaw: 0, camInit: false, fixI: -1, fixCams: null, camPrev: -1,
  tmpM: new Float32Array(16),
};
function sceneInit() {
  const dev = GPU.dev, W = World;
  S.LM = mkBGL(['ta', 'ta']); S.bgM = mkBG(S.LM, [R.matA.createView(), R.matN.createView()]);
  const vbl = [{ arrayStride: 40, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' }, { shaderLocation: 3, offset: 32, format: 'unorm8x4' }, { shaderLocation: 4, offset: 36, format: 'unorm8x4' }] },
    { arrayStride: 32, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }, { shaderLocation: 6, offset: 16, format: 'float32x4' }] }];
  S.vbl = vbl;
  S.pProp = mkPipe({ label: 'malha', code: WG_PROP, layouts: [R.L0, S.LM], targets: R.G_T, depth: { write: true, compare: 'greater' }, buffers: vbl });
  S.pPropS = mkPipe({ label: 'malha-sombra', code: WG_PROP, vs: 'vsShadow', fs: 'fsShadow', layouts: [R.L0, S.LM], targets: [], depth: { write: true, compare: 'less', bias: 2, slope: 2.5 }, buffers: vbl });
  // ---- árvores: 4 tipos x 3 LODs ----
  S.meshes = [];
  const mk = [(l) => makeBroadleaf(11, l, false), (l) => makeBroadleaf(23, l, true), (l) => makeAraucaria(5, l), (l) => makeBush(9, l)];
  for (let t = 0; t < 4; t++) for (let l = 0; l < 3; l++) S.meshes.push(mk[t](l));
  const perType = [0, 0, 0, 0]; for (let i = 0; i < W.nTrees; i++) perType[W.trees[i * 8 + 5]]++;
  S.cap = Math.max(...perType); S.sarr = []; S.sbuf = [];
  for (let k = 0; k < 24; k++) { S.sarr.push(new Float32Array(S.cap * 8)); S.sbuf.push(dev.createBuffer({ size: S.cap * 32, usage: 0x20 | 8 })); }
  // ---- pedras (estáticas) ----
  S.rockM = [makeRock(1, 2), makeRock(2, 2), makeRock(3, 2), makeRock(4, 1), makeRock(5, 1), makeRock(6, 1)]; S.rockB = []; S.rockN = [];
  for (let g = 0; g < 6; g++) { const a = []; for (let i = 0; i < W.nRocks; i++) { const o = i * 8, big = W.rocks[o + 3] > 0.32; if ((big ? 0 : 3) + W.rocks[o + 5] !== g) continue; a.push(W.rocks[o], W.rocks[o + 1], W.rocks[o + 2], W.rocks[o + 3], W.rocks[o + 4], W.rocks[o + 6], W.rocks[o + 7], 0); }
    S.rockN.push(a.length / 8); S.rockB.push(mkBuf(new Float32Array(a.length ? a : [0, 0, 0, 0, 0, 0, 1, 0]), 0x20)); }
  S.structM = makeStructures(); S.identB = mkBuf(new Float32Array([0, 0, 0, 1, 0, 0, 1, 0]), 0x20);
  // ---- capim ----
  S.NB = 87040; S.bladeB = dev.createBuffer({ size: S.NB * 48, usage: 0x80 | 8 });
  S.indB = dev.createBuffer({ size: 16, usage: 0x80 | 0x100 | 8 }); S.indInit = new Uint32Array([7, 0, 0, 0]);
  const lgc = mkBGL(['st', 'st']), lgr = mkBGL(['sr']); S.bgGc = mkBG(lgc, [S.bladeB, S.indB]); S.bgGr = mkBG(lgr, [S.bladeB]);
  S.pGrassC = dev.createComputePipeline({ label: 'capim-c', layout: dev.createPipelineLayout({ bindGroupLayouts: [R.L0, R.LT, lgc] }), compute: { module: mkModule(WG_GRASSC, 'capim-c'), entryPoint: 'cs' } });
  S.pGrass = mkPipe({ label: 'capim', code: WG_GRASS, layouts: [R.L0, lgr], targets: R.G_T, depth: { write: true, compare: 'greater' }, topology: 'triangle-strip' });
  // ---- passadas diretas ----
  S.LF = mkBGL(['td', 't', 'tda', 'sc', 't', 's']); S.bgF = mkBG(S.LF, [R.vDepth, R.hdrCopy.createView(), R.vShadow, R.sShadow, R.envT.createView(), R.sPano]);
  const blA = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } }, blP = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } };
  S.blA = blA;
  { const St = W.str, a = []; let cnt = 0; const idx = [];
    for (let i = 0; i < St.n; i++) { if (Math.hypot(St.x[i], St.z[i]) > 400) continue; const w = St.w[i] + 3.2, y = St.bed[i] + 0.30;
      for (const sd of [-1, 1]) a.push(St.x[i] + St.tz[i] * w * sd, y, St.z[i] - St.tx[i] * w * sd, i * St.ds, sd, St.tx[i], St.tz[i]);
      if (cnt > 0) idx.push(cnt * 2 - 2, cnt * 2 - 1, cnt * 2, cnt * 2 - 1, cnt * 2 + 1, cnt * 2); cnt++; }
    S.waterVB = mkBuf(new Float32Array(a), 0x20); S.waterIB = mkBuf(new Uint32Array(idx), 0x10); S.waterN = idx.length;
    S.pWater = mkPipe({ label: 'riacho', code: WG_WATER, layouts: [R.L0, S.LF], targets: [{ format: 'rgba16float', blend: blA }], depth: { write: false, compare: 'greater' }, buffers: [{ arrayStride: 28, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }] }); }
  const ib2 = [{ arrayStride: 32, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }] }];
  S.wireB = mkBuf(W.wires, 0x20);
  S.pWire = mkPipe({ label: 'fios', code: WG_WIRE, layouts: [R.L0], targets: [{ format: 'rgba16float', blend: blA }], depth: { write: false, compare: 'greater' }, buffers: ib2 });
  S.pPart = mkPipe({ label: 'particulas', code: WG_PART, layouts: [R.L0, S.LF], targets: [{ format: 'rgba16float', blend: blP }], depth: { write: false, compare: 'greater' }, buffers: ib2 });
  S.pf = new Float32Array(S.NP * 16); S.pinst = new Float32Array(S.NP * 8); S.pB = dev.createBuffer({ size: S.NP * 32, usage: 0x20 | 8 });
  // ---- sulcos ----
  S.pRut = mkPipe({ label: 'sulcos', code: WG_RUT, layouts: [], targets: [{ format: 'r8unorm', blend: { color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } } }], buffers: ib2 });
  S.rutB = dev.createBuffer({ size: 4 * 32, usage: 0x20 | 8 }); S.dRut = { colorAttachments: [{ view: R.rutT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] };
  // ---- câmeras fixas à beira da trilha ----
  { const T = W.trk, a = []; for (let s = 22; s < T.L; s += 52) { const i = Math.round(s / T.ds) % T.n, sd = T.curv[i] > 0 ? -1 : 1, o = (T.hw[i] + 4.5) * sd, x = T.x[i] + T.tz[i] * o, z = T.z[i] - T.tx[i] * o; a.push(x, Math.max(W.heightRaw(x, z), W.waterAt(x, z)) + 1.5, z, s); }
    S.fixCams = new Float32Array(a); }
  R.gDraw.push(sceneG); R.sDraw.push(sceneShadow); const fe = (p) => sceneFwdEarly(p); fe.early = true; R.fDraw.push(fe); R.fDraw.push(sceneFwd);
  if (typeof carInit !== 'undefined') carInit();
  if (typeof hudInit !== 'undefined') hudInit();
}
function _push(k, o) { const a = S.sarr[k], n = S.cnt[k]++ * 8, t = World.trees; a[n] = t[o]; a[n + 1] = t[o + 1]; a[n + 2] = t[o + 2]; a[n + 3] = t[o + 3]; a[n + 4] = t[o + 4]; a[n + 5] = t[o + 6]; a[n + 6] = 1; a[n + 7] = (k >= 8 && k < 12) || k >= 20 ? 1 : 0; }
function scenePre() {
  const W = World, t = W.trees, n = W.nTrees, ex = R.eye[0], ey = R.eye[1], ez = R.eye[2], M = R.vpNJ, P = S.planes, dev = GPU.dev;
  // planos do frustum (esq, dir, baixo, cima)
  for (let k = 0; k < 4; k++) { const r = k >> 1, sg = (k & 1) ? -1 : 1; const a = M[3] + sg * M[r], b = M[7] + sg * M[4 + r], c = M[11] + sg * M[8 + r], d = M[15] + sg * M[12 + r]; P[k * 4] = a; P[k * 4 + 1] = b; P[k * 4 + 2] = c; P[k * 4 + 3] = d; S.plen[k] = Math.hypot(a, b, c); }
  S.cnt.fill(0);
  const c0x = ex + R.fwd[0] * 7, c0z = ez + R.fwd[2] * 7, c1x = ex + R.fwd[0] * 30, c1z = ez + R.fwd[2] * 30, c2x = ex + R.fwd[0] * 120, c2z = ez + R.fwd[2] * 120;
  for (let i = 0; i < n; i++) {
    const o = i * 8, x = t[o], y = t[o + 1], z = t[o + 2], sc = t[o + 3], ty = t[o + 5], dx = x - ex, dz = z - ez, d2 = dx * dx + dz * dz;
    const shr = ty === 3 ? 6 : 60;
    let q = (x - c0x) * (x - c0x) + (z - c0z) * (z - c0z); if (q < (12 + shr) * (12 + shr)) _push(12 + ty, o);
    q = (x - c1x) * (x - c1x) + (z - c1z) * (z - c1z); if (q < (34 + shr) * (34 + shr)) _push(16 + ty, o);
    if (ty !== 3) { q = (x - c2x) * (x - c2x) + (z - c2z) * (z - c2z); if (q < 180 * 180) _push(20 + ty, o); }
    if (ty === 3 && d2 > 200 * 200) continue;
    const rad = (ty === 2 ? 11 : ty === 3 ? 2 : 6.5) * sc, cy = y + rad; let vis = true;
    for (let k = 0; k < 4; k++) if (P[k * 4] * x + P[k * 4 + 1] * cy + P[k * 4 + 2] * z + P[k * 4 + 3] < -rad * S.plen[k]) { vis = false; break; }
    if (!vis) continue;
    if (d2 > 270 * 270 && (i & 1)) continue;
    const lod = d2 < 48 * 48 ? 0 : d2 < 135 * 135 ? 1 : 2; _push(lod * 4 + ty, o); if (d2 > 270 * 270) S.sarr[8 + ty][(S.cnt[8 + ty] - 1) * 8 + 3] *= 1.3;
  }
  for (let k = 0; k < 24; k++) if (S.cnt[k] > 0) dev.queue.writeBuffer(S.sbuf[k], 0, S.sarr[k], 0, S.cnt[k] * 8);
  // partículas -> instâncias
  let m = 0; const pf = S.pf, pi = S.pinst;
  for (let i = 0; i < S.NP; i++) { const o = i * 16; if (pf[o + 6] <= 0) continue; const k = m * 8, f = pf[o + 6] / pf[o + 7];
    pi[k] = pf[o]; pi[k + 1] = pf[o + 1]; pi[k + 2] = pf[o + 2]; pi[k + 3] = pf[o + 8]; pi[k + 4] = pf[o + 11]; pi[k + 5] = pf[o + 12]; pi[k + 6] = pf[o + 13];
    const kind = pf[o + 10]; pi[k + 7] = kind === 1 ? 2 + Math.min(1, f * 4) : pf[o + 14] * Math.min(1, f * 1.6) * Math.min(1, (1 - f) * 12 + 0.25); m++; }
  S.palive = m; if (m > 0) dev.queue.writeBuffer(S.pB, 0, pi, 0, m * 8);
  if (S.rutN > 0) dev.queue.writeBuffer(S.rutB, 0, S.rut, 0, S.rutN * 8);
  dev.queue.writeBuffer(S.indB, 0, S.indInit);
  if (typeof carPre !== 'undefined') carPre();
}
function _rutPass(enc) {
  if (S.rutN > 0 || S.rutClear) { const p = enc.beginRenderPass(S.dRut); if (S.rutN > 0) { p.setPipeline(S.pRut); p.setVertexBuffer(0, S.rutB); p.draw(6, S.rutN); } p.end(); S.rutClear = false; S.dRut.colorAttachments[0].loadOp = 'load'; S.rutN = 0; }
}
function sceneEnc(enc) {
  { const c = enc.beginComputePass(); c.setPipeline(S.pGrassC); c.setBindGroup(0, R.bg0); c.setBindGroup(1, R.bgT); c.setBindGroup(2, S.bgGc); c.dispatchWorkgroups(1360); c.end(); }
  _rutPass(enc);
}
// quadro só de simulação (testes): mantém os sulcos sem renderizar a cena
function sceneSimOnly() { if (S.rutN > 0) { GPU.dev.queue.writeBuffer(S.rutB, 0, S.rut, 0, S.rutN * 8); const enc = GPU.dev.createCommandEncoder(); _rutPass(enc); GPU.dev.queue.submit([enc.finish()]); } }
function _drawM(p, m, ib, n) { if (n <= 0) return; p.setVertexBuffer(0, m.vb); p.setVertexBuffer(1, ib); p.setIndexBuffer(m.ib, 'uint32'); p.drawIndexed(m.n, n); }
function sceneG(p) {
  p.setPipeline(S.pProp); p.setBindGroup(1, S.bgM);
  if (!(S.dbg & 2)) for (let l = 0; l < 3; l++) for (let t = 0; t < 4; t++) _drawM(p, S.meshes[t * 3 + l], S.sbuf[l * 4 + t], S.cnt[l * 4 + t]);
  for (let g = 0; g < 6; g++) _drawM(p, S.rockM[g], S.rockB[g], S.rockN[g]);
  _drawM(p, S.structM, S.identB, 1);
  if (typeof carG !== 'undefined') carG(p);
  if (S.dbg & 1) return;
  p.setPipeline(S.pGrass); p.setBindGroup(1, S.bgGr); p.drawIndirect(S.indB, 0);
}
function sceneShadow(p, c) {
  p.setPipeline(S.pPropS); p.setBindGroup(1, S.bgM);
  for (let t = 0; t < 4; t++) _drawM(p, S.meshes[t * 3 + (c === 2 ? 2 : 1)], S.sbuf[12 + c * 4 + t], S.cnt[12 + c * 4 + t]);
  if (c < 2) for (let g = 0; g < (c === 0 ? 6 : 3); g++) _drawM(p, S.rockM[g], S.rockB[g], S.rockN[g]);
  _drawM(p, S.structM, S.identB, 1);
  if (typeof carShadow !== 'undefined') carShadow(p, c);
}
function sceneFwdEarly(p) { p.setPipeline(S.pWater); p.setBindGroup(1, S.bgF); p.setVertexBuffer(0, S.waterVB); p.setIndexBuffer(S.waterIB, 'uint32'); p.drawIndexed(S.waterN); }
function sceneFwd(p) {
  p.setPipeline(S.pWire); p.setVertexBuffer(0, S.wireB); p.draw(24, World.nWires);
  if (typeof carFwd !== 'undefined') carFwd(p);
  if (S.palive > 0) { p.setPipeline(S.pPart); p.setBindGroup(1, S.bgF); p.setVertexBuffer(0, S.pB); p.draw(6, S.palive); }
}
// ---- partículas (CPU, sem alocação) ----  campos: 0-2 pos, 3-5 vel, 6 vida, 7 vida máx, 8 tamanho, 9 crescimento, 10 tipo, 11-13 cor, 14 alfa, 15 arrasto
function emit(kind, x, y, z, vx, vy, vz, size, grow, life, r, g, b, a, drag) {
  const o = S.pcur * 16, f = S.pf; S.pcur = (S.pcur + 1) % S.NP;
  f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = vx; f[o + 4] = vy; f[o + 5] = vz; f[o + 6] = life; f[o + 7] = life; f[o + 8] = size; f[o + 9] = grow; f[o + 10] = kind; f[o + 11] = r; f[o + 12] = g; f[o + 13] = b; f[o + 14] = a; f[o + 15] = drag;
}
let _ps = 12345; function prand() { _ps = (Math.imul(_ps, 1664525) + 1013904223) | 0; return (_ps >>> 0) / 4294967296; }
function particlesUpdate(dt) {
  const f = S.pf;
  for (let i = 0; i < S.NP; i++) { const o = i * 16; if (f[o + 6] <= 0) continue; f[o + 6] -= dt; const kind = f[o + 10], dr = Math.exp(-f[o + 15] * dt);
    f[o + 3] = f[o + 3] * dr + 0.5 * dt; f[o + 5] = f[o + 5] * dr + 0.35 * dt; f[o + 4] = f[o + 4] * dr - (kind === 0 ? -0.25 : kind === 3 ? 1.5 : 9.8) * dt;
    f[o] += f[o + 3] * dt; f[o + 1] += f[o + 4] * dt; f[o + 2] += f[o + 5] * dt; f[o + 8] += f[o + 9] * dt;
    if (kind !== 0 && kind !== 3 && f[o + 4] < 0) { const h = World.heightRaw(f[o], f[o + 2]); if (f[o + 1] < h) f[o + 6] = 0; } }
  if (typeof Physics === 'undefined') return;
  const P = Physics, sp = Math.abs(P.speed), q = P.quat; if (Game.paused) return;
  // eixo "para trás" do carro no mundo
  const fx = 2 * (q[0] * q[2] + q[3] * q[1]), fz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]), dirS = P.speed >= 0 ? -1 : 1;
  const lx = fz, lz = -fx; // esquerda
  for (let w = 0; w < 4; w++) {
    if (P.contact[w] < 0.5) { S.lastOk[w] = 0; continue; }
    const cx = P.cx[w], cy = P.cy[w], cz = P.cz[w], surf = P.surf[w], slip = P.slip[w], wet = P.wet[w], side = (w & 1) ? -1 : 1;
    // sulco: segmento do último ponto de contato até o atual
    if (surf !== SURF_MADEIRA && surf !== SURF_AGUA && sp > 0.3) {
      if (S.lastOk[w] && S.rutN < 4) { const k = S.rutN * 8, dx = cx - S.lastC[w * 3], dz = cz - S.lastC[w * 3 + 2];
        if (dx * dx + dz * dz < 9 && dx * dx + dz * dz > 0.0004) { S.rut[k] = S.lastC[w * 3]; S.rut[k + 1] = S.lastC[w * 3 + 2]; S.rut[k + 2] = cx; S.rut[k + 3] = cz; S.rut[k + 4] = 0.135; S.rut[k + 5] = clamp(0.55 + wet * 0.45 + slip * 0.3, 0, 1); S.rutN++; } }
      S.lastC[w * 3] = cx; S.lastC[w * 3 + 1] = cy; S.lastC[w * 3 + 2] = cz; S.lastOk[w] = 1;
    } else S.lastOk[w] = 0;
    const bx = fx * dirS, bz = fz * dirS, act = sp * 0.05 + Math.min(slip, 0.6) * 0.5;
    if (surf === SURF_AGUA || P.water[w] > 0.04) {
      const nsp = Math.min(6, (sp * 0.55 + slip * 3) | 0);
      for (let k = 0; k < nsp; k++) { const u = prand(), v = prand(), out = (0.6 + u * 2.6) * side * (0.25 + sp * 0.11);
        emit(2, cx + (v - 0.5) * 0.4, cy + 0.12, cz + (u - 0.5) * 0.4, lx * out + bx * sp * (0.15 + v * 0.3) + P.vel[0] * 0.55, 1.2 + prand() * (1.6 + sp * 0.28), lz * out + bz * sp * (0.15 + v * 0.3) + P.vel[2] * 0.55, 0.05 + prand() * 0.10, 0.25, 0.5 + prand() * 0.45, 2.3, 2.2, 2.1, 0.55, 0.8); }
      if (sp > 2 && prand() < 0.6) emit(3, cx, cy + 0.3, cz, lx * side * 1.2 + P.vel[0] * 0.5, 1.4 + prand(), lz * side * 1.2 + P.vel[2] * 0.5, 0.25, 0.9, 0.7 + prand() * 0.4, 1.5, 1.4, 1.3, 0.12, 1.2);
    } else if (wet > 0.35) {
      if (prand() < act * 1.6) for (let k = 0; k < 2; k++) emit(1, cx, cy + 0.08, cz, bx * sp * (0.2 + prand() * 0.35) + lx * side * (prand() - 0.3) * 2 + P.vel[0] * 0.3, 0.8 + prand() * (1.5 + sp * 0.2 + slip * 3), bz * sp * (0.2 + prand() * 0.35) + lz * side * (prand() - 0.3) * 2 + P.vel[2] * 0.3, 0.025 + prand() * 0.05, 0, 0.5 + prand() * 0.5, 0.09, 0.055, 0.032, 1, 0.3);
    } else if (surf !== SURF_MADEIRA) {
      const du = (surf === SURF_GRAMA ? 0.2 : surf === SURF_PEDRA ? 0.55 : 1) * (1 - wet);
      if (sp > 2.5 && prand() < act * du * 1.1 * (w >= 2 ? 1 : 0.45)) emit(0, cx + (prand() - 0.5) * 0.25, cy + 0.15, cz + (prand() - 0.5) * 0.25, bx * sp * 0.12 + P.vel[0] * 0.22 + (prand() - 0.5) * 0.8, 0.35 + prand() * 0.7, bz * sp * 0.12 + P.vel[2] * 0.22 + (prand() - 0.5) * 0.8, 0.16 + prand() * 0.14, 0.32 + sp * 0.02, 1.0 + prand() * 1.0, 0.95, 0.62, 0.40, 0.08 + Math.min(0.05, slip * 0.08), 0.9);
      if ((surf === SURF_CASCALHO || surf === SURF_PEDRA) && prand() < slip * 0.9 + sp * 0.004) emit(1, cx, cy + 0.05, cz, bx * sp * 0.4 + (prand() - 0.5) * 2, 0.8 + prand() * 2, bz * sp * 0.4 + (prand() - 0.5) * 2, 0.02 + prand() * 0.025, 0, 0.6, 0.30, 0.26, 0.22, 1, 0.2);
    }
  }
}
// ---- câmeras ----
const _cq = new Float32Array(3);
function _carLocal(x, y, z) { const q = Physics.quat, qx = q[0], qy = q[1], qz = q[2], qw = q[3]; // rotaciona (x,y,z) pelo quaternion do carro
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
  _cq[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy; _cq[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz; _cq[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx; }
function cameraUpdate(dt) {
  if (App.freeCam || typeof Physics === 'undefined') return;
  const P = Physics, px = P.pos[0], py = P.pos[1], pz = P.pos[2], mode = Game.cam, q = P.quat;
  const fx = 2 * (q[0] * q[2] + q[3] * q[1]), fz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]), yaw = Math.atan2(fx, fz);
  const snap = !S.camInit || S.camPrev !== mode; S.camPrev = mode; S.camInit = true; R.camMode = mode; if (snap) R.cut = 2;
  if (mode === 0) {
    let dy = yaw - S.camYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    S.camYaw += snap ? dy : dy * (1 - Math.exp(-dt * 4.2));
    const a = S.camYaw + Game.camYaw, sp = Math.abs(P.speed), dist = 6.0 + sp * 0.03, pit = 0.19 + Game.camPitch * 0.6, ch = Math.cos(pit);
    let ex = px - Math.sin(a) * dist * ch, ez = pz - Math.cos(a) * dist * ch, ey = py + 1.15 + Math.sin(pit) * dist;
    const g = Math.max(World.heightRaw(ex, ez), World.waterAt(ex, ez)) + 0.55; if (ey < g) ey = g;
    const k = snap ? 1 : 1 - Math.exp(-dt * 9); S.camE[0] += (ex - S.camE[0]) * k; S.camE[1] += (ey - S.camE[1]) * (snap ? 1 : 1 - Math.exp(-dt * 5)); S.camE[2] += (ez - S.camE[2]) * k;
    const kt = snap ? 1 : 1 - Math.exp(-dt * 14); S.camT[0] += (px - S.camT[0]) * kt; S.camT[1] += (py + 1.25 - S.camT[1]) * kt; S.camT[2] += (pz - S.camT[2]) * kt;
    R.setCamera(S.camE[0], S.camE[1], S.camE[2], S.camT[0], S.camT[1], S.camT[2], 0.98 + Math.min(0.14, sp * 0.005));
  } else if (mode === 1) {
    _carLocal(0, 1.315, 0.86); const ex = px + _cq[0], ey = py + _cq[1], ez = pz + _cq[2]; _carLocal(0, 1.05, 9);
    const tx = px + _cq[0], ty = py + _cq[1], tz = pz + _cq[2]; _carLocal(0, 1, 0);
    R.setCamera(ex, ey, ez, tx, ty, tz, 1.12); m4look(R.view, 0, ex, ey, ez, tx, ty, tz, _cq[0] * 0.6, 0.8 + _cq[1] * 0.2, _cq[2] * 0.6);
    S.camYaw = yaw;
  } else {
    const F = S.fixCams, n = F.length / 4; let best = S.fixI, bd = 1e9;
    if (best >= 0) { const dx = F[best * 4] - px, dz = F[best * 4 + 2] - pz; bd = dx * dx + dz * dz; }
    if (best < 0 || bd > 58 * 58 || snap) { R.cut = 2; best = 0; bd = 1e9; const T = World.trk, sA = Game.trackS + 20;
      for (let i = 0; i < n; i++) { let ds = F[i * 4 + 3] - sA; if (ds > T.L / 2) ds -= T.L; if (ds < -T.L / 2) ds += T.L; const d = Math.abs(ds); if (d < bd) { bd = d; best = i; } } S.fixI = best; }
    const d = Math.hypot(F[best * 4] - px, F[best * 4 + 2] - pz);
    const kt = snap ? 1 : 1 - Math.exp(-dt * 10); S.camT[0] += (px - S.camT[0]) * kt; S.camT[1] += (py + 0.8 - S.camT[1]) * kt; S.camT[2] += (pz - S.camT[2]) * kt;
    R.setCamera(F[best * 4], F[best * 4 + 1], F[best * 4 + 2], S.camT[0], S.camT[1], S.camT[2], clamp(11 / (d + 4), 0.22, 0.95));
    S.camYaw = yaw;
  }
}
function sceneUpdate(dt) {
  // limite do mundo: quem se afasta demais da trilha é devolvido a ela, bem antes de enxergar o fim do cenário
  if (typeof Physics !== 'undefined' && (Math.hypot(Physics.pos[0], Physics.pos[2]) > 300 || Physics.pos[1] < 5)) Game.resetToTrack();
  particlesUpdate(dt); if (typeof carUpdate !== 'undefined') carUpdate(dt); cameraUpdate(dt); if (typeof hudUpdate !== 'undefined') hudUpdate(dt); }
