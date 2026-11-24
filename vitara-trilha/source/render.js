// render.js — recursos de GPU e o quadro. Nada aqui aloca por quadro: descritores, arrays e grupos são criados na carga.
const R = {
  cut: 0,
  dbg: 0,
  fb: new Float32Array(192), sfb: [new Float32Array(192), new Float32Array(192), new Float32Array(192)],
  view: new Float32Array(16), proj: new Float32Array(16), projJ: new Float32Array(16), vpNJ: new Float32Array(16), vp: new Float32Array(16), pvp: new Float32Array(16), ivp: new Float32Array(16),
  lview: new Float32Array(16), lproj: new Float32Array(16),
  eye: new Float32Array(3), fwd: new Float32Array(3), fov: 1.0, near: 0.12, frame: 0, time: 0, ptime: 0, dt: 1 / 60, exposure: 0.88,
  splits: new Float32Array([13, 52, 210]), shTex: new Float32Array(4), SH: 2048,
  clip: new Float32Array(10 * 4), NL: 10,
  gDraw: [], sDraw: [], fDraw: [], pre: [], hudDraw: null,
  passNames: ['sombra0', 'sombra1', 'sombra2', 'gbuffer', 'ao', 'luz', 'nevoa', 'frente', 'taa', 'mblur', 'bloom', 'final'], gpuMs: new Float64Array(12), gpuTotal: 0, tsBusy: false, perf: false,
  camMode: 0,
};
function _tileNoise2D(n, seed) {
  const out = new Uint8Array(n * n * 4), rnd = mulberry32(seed);
  for (let ch = 0; ch < 4; ch++) {
    const acc = new Float32Array(n * n); let amp = 0.5, tot = 0;
    const base = [4, 8, 16, 64][ch], octs = ch === 3 ? 1 : 5;
    for (let o = 0; o < octs; o++) {
      const per = base << o, lat = new Float32Array(per * per); for (let i = 0; i < per * per; i++) lat[i] = rnd();
      for (let y = 0; y < n; y++) { const fy = y * per / n, iy = Math.floor(fy), vy = fy - iy, sy = vy * vy * (3 - 2 * vy), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
        for (let x = 0; x < n; x++) { const fx = x * per / n, ix = Math.floor(fx), vx = fx - ix, sx = vx * vx * (3 - 2 * vx), x0 = ix % per, x1 = (ix + 1) % per;
          acc[y * n + x] += amp * ((lat[y0 + x0] * (1 - sx) + lat[y0 + x1] * sx) * (1 - sy) + (lat[y1 + x0] * (1 - sx) + lat[y1 + x1] * sx) * sy); } }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < n * n; i++) { let v = acc[i] / tot; if (ch < 3) v = (v - 0.5) * 1.9 + 0.5; out[i * 4 + ch] = clamp(v, 0, 1) * 255; }
  }
  return out;
}
function _noise3D(n) {
  const out = new Uint8Array(n * n * n * 4), rnd = mulberry32(99);
  const fb = (base, octs, ch) => {
    const acc = new Float32Array(n * n * n); let amp = 0.5, tot = 0;
    for (let o = 0; o < octs; o++) {
      const per = base << o, lat = new Float32Array(per * per * per); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      for (let z = 0; z < n; z++) { const fz = z * per / n, iz = Math.floor(fz), vz = fz - iz, sz = vz * vz * (3 - 2 * vz), z0 = (iz % per) * per * per, z1 = ((iz + 1) % per) * per * per;
        for (let y = 0; y < n; y++) { const fy = y * per / n, iy = Math.floor(fy), vy = fy - iy, sy = vy * vy * (3 - 2 * vy), y0 = (iy % per) * per, y1 = ((iy + 1) % per) * per;
          for (let x = 0; x < n; x++) { const fx = x * per / n, ix = Math.floor(fx), vx = fx - ix, sx = vx * vx * (3 - 2 * vx), x0 = ix % per, x1 = (ix + 1) % per;
            const a = (lat[z0 + y0 + x0] * (1 - sx) + lat[z0 + y0 + x1] * sx) * (1 - sy) + (lat[z0 + y1 + x0] * (1 - sx) + lat[z0 + y1 + x1] * sx) * sy;
            const b = (lat[z1 + y0 + x0] * (1 - sx) + lat[z1 + y0 + x1] * sx) * (1 - sy) + (lat[z1 + y1 + x0] * (1 - sx) + lat[z1 + y1 + x1] * sx) * sy;
            acc[(z * n + y) * n + x] += amp * (a * (1 - sz) + b * sz); } } }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < acc.length; i++) out[i * 4 + ch] = clamp((acc[i] / tot - 0.5) * 2.1 + 0.5, 0, 1) * 255;
  };
  const wor = (per, ch) => {
    const pts = new Float32Array(per * per * per * 3); for (let i = 0; i < pts.length; i++) pts[i] = rnd();
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x * per / n, fy = y * per / n, fz = z * per / n, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz); let md = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, cz = iz + dz, k = ((((cz + per) % per) * per + (cy + per) % per) * per + (cx + per) % per) * 3;
        const ex = cx + pts[k] - fx, ey = cy + pts[k + 1] - fy, ez = cz + pts[k + 2] - fz, d = ex * ex + ey * ey + ez * ez; if (d < md) md = d;
      }
      out[((z * n + y) * n + x) * 4 + ch] = clamp(1 - Math.sqrt(md), 0, 1) * 255;
    }
  };
  fb(4, 4, 0); fb(8, 3, 1); wor(6, 2); wor(12, 3);
  return out;
}

function renderInit() {
  const dev = GPU.dev, W = GPU.W, H = GPU.H, hw = W >> 1, hh = H >> 1;
  R.sRep = dev.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat' });
  R.sAni = dev.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat', maxAnisotropy: 4 });
  R.sClamp = dev.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' });
  R.sPano = dev.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat' });
  R.sShadow = dev.createSampler({ minFilter: 'linear', magFilter: 'linear', compare: 'less-equal' });
  // ---- uniformes ----
  R.ubo = dev.createBuffer({ size: 768, usage: 0x40 | 8 }); R.subo = [0, 1, 2].map(() => dev.createBuffer({ size: 768, usage: 0x40 | 8 }));
  // ---- ruído ----
  R.noiseT = texFromData(512, 512, 'rgba8unorm', _tileNoise2D(512, 7), 4, { mips: 10 }); genMips(R.noiseT, 'rgba8unorm', 1, 10);
  R.noise3T = texFromData(64, 64, 'rgba8unorm', _noise3D(64), 4, { layers: 64, dim: '3d' });
  R.L0 = mkBGL(['u', 's', 's', 't', 't3', 's']);
  R.bg0 = mkBG(R.L0, [R.ubo, R.sRep, R.sClamp, R.noiseT.createView(), R.noise3T.createView(), R.sAni]);
  R.bgS = R.subo.map((b) => mkBG(R.L0, [b, R.sRep, R.sClamp, R.noiseT.createView(), R.noise3T.createView(), R.sAni]));
  // ---- dados do mundo ----
  const Wd = World;
  R.hNearT = texFromData(NEAR_N, NEAR_N, 'r32float', Wd.hNear, 4); R.hFarT = texFromData(FAR_N, FAR_N, 'r32float', Wd.hFar, 4);
  R.nrmNearT = texFromData(NEAR_N, NEAR_N, 'rgba8unorm', Wd.nrmNear, 4, { mips: 12 }); genMips(R.nrmNearT, 'rgba8unorm', 1, 12);
  R.maskT = texFromData(NEAR_N, NEAR_N, 'rgba8unorm', Wd.mask, 4, { mips: 12 }); genMips(R.maskT, 'rgba8unorm', 1, 12);
  { const hf = new Uint16Array(FLD_N * FLD_N * 4), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    const toH = (v) => { f32[0] = v; const x = u32[0], s = (x >> 16) & 0x8000; let e = ((x >> 23) & 0xff) - 112, m = (x >> 12) & 0x7ff; if (e <= 0) return s; if (e >= 31) return s | 0x7bff; return s | (e << 10) | (m >> 1); };
    for (let i = 0; i < hf.length; i++) hf[i] = toH(Wd.field[i]);
    R.fieldT = texFromData(FLD_N, FLD_N, 'rgba16float', hf, 8); }
  R.rutT = mkTex(4096, 4096, 'r8unorm', TU | RA, { label: 'sulcos' });
  // ---- materiais procedurais ----
  const ML = 10, MS = 1024, MM = 11;
  { const ta = mkTex(MS, MS, 'rgba16float', TU | RA, { layers: ML }), tb = mkTex(MS, MS, 'rgba16float', TU | RA, { layers: ML });
    R.matA = mkTex(MS, MS, 'rgba8unorm-srgb', TU | RA, { layers: ML, mips: MM }); R.matN = mkTex(MS, MS, 'rgba8unorm', TU | RA, { layers: ML, mips: MM });
    const p1 = mkPipe({ label: 'matbake', code: WG_MATBAKE, layouts: [R.L0], targets: [{ format: 'rgba16float' }, { format: 'rgba16float' }] });
    const l2 = mkBGL(['ta', 'ta']), p2 = mkPipe({ label: 'matfin', code: WG_MATFIN, layouts: [l2], targets: [{ format: 'rgba8unorm-srgb' }, { format: 'rgba8unorm' }] });
    const lv = (t, L) => t.createView({ dimension: '2d', baseArrayLayer: L, arrayLayerCount: 1, baseMipLevel: 0, mipLevelCount: 1 });
    let enc = dev.createCommandEncoder();
    for (let L = 0; L < ML; L++) { const ps = enc.beginRenderPass({ colorAttachments: [{ view: lv(ta, L), loadOp: 'clear', storeOp: 'store' }, { view: lv(tb, L), loadOp: 'clear', storeOp: 'store' }] }); ps.setPipeline(p1); ps.setBindGroup(0, R.bg0); ps.draw(3, 1, 0, L); ps.end(); }
    const bg2 = mkBG(l2, [ta.createView(), tb.createView()]);
    for (let L = 0; L < ML; L++) { const ps = enc.beginRenderPass({ colorAttachments: [{ view: lv(R.matA, L), loadOp: 'clear', storeOp: 'store' }, { view: lv(R.matN, L), loadOp: 'clear', storeOp: 'store' }] }); ps.setPipeline(p2); ps.setBindGroup(0, bg2); ps.draw(3, 1, 0, L); ps.end(); }
    dev.queue.submit([enc.finish()]);
    genMips(R.matA, 'rgba8unorm-srgb', ML, MM); genMips(R.matN, 'rgba8unorm', ML, MM); R.matTmp = [ta, tb];
  }
  R.LT = mkBGL(['tu', 'tu', 't', 't', 't', 'ta', 'ta', 't']);
  R.bgT = mkBG(R.LT, [R.hNearT.createView(), R.hFarT.createView(), R.nrmNearT.createView(), R.maskT.createView(), R.fieldT.createView(), R.matA.createView(), R.matN.createView(), R.rutT.createView()]);
  // ---- alvos ----
  const mk = (w, h, f, l) => mkTex(w, h, f, TU | RA | CS | CD, { label: l });
  R.gA = mk(W, H, 'rgba8unorm', 'gA'); R.gN = mk(W, H, 'rgba16float', 'gN'); R.gM = mk(W, H, 'rgba8unorm', 'gM'); R.gV = mk(W, H, 'rg16float', 'gV');
  R.depth = mk(W, H, 'depth32float', 'depth'); R.hdr = mk(W, H, 'rgba16float', 'hdr'); R.hdrCopy = mk(W, H, 'rgba16float', 'hdrCopy');
  R.hist = [mk(W, H, 'rgba16float', 'h0'), mk(W, H, 'rgba16float', 'h1')]; R.mb = mk(W, H, 'rgba16float', 'mb');
  R.aoT = mk(hw, hh, 'r8unorm', 'ao'); R.fogT = mk(hw, hh, 'rgba16float', 'fog');
  R.shadow = mkTex(R.SH, R.SH, 'depth32float', TU | RA, { layers: 3, label: 'sombra' });
  R.bloom = []; for (let i = 0, w = hw, h = hh; i < 6; i++, w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) R.bloom.push(mk(w, h, 'rgba16float', 'bloom' + i));
  R.skyT = mkTex(4096, 2048, 'rgba16float', TU | RA, { mips: 12, label: 'ceu' }); R.envT = mkTex(1024, 512, 'rgba16float', TU | RA, { mips: 10, label: 'amb' });
  const V = (t) => t.createView();
  R.vDepth = V(R.depth); R.vHdr = V(R.hdr); R.vHist = R.hist.map(V); R.vShadowL = [0, 1, 2].map((i) => R.shadow.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 })); R.vShadow = R.shadow.createView({ dimension: '2d-array' });
  // ---- pipelines ----
  const G_T = [{ format: 'rgba8unorm' }, { format: 'rgba16float' }, { format: 'rgba8unorm' }, { format: 'rg16float' }];
  R.G_T = G_T;
  const tbuf = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }, { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] }];
  R.pTerr = mkPipe({ label: 'terreno', code: WG_TERRAIN, layouts: [R.L0, R.LT], targets: G_T, depth: { write: true, compare: 'greater' }, buffers: tbuf });
  R.pTerrS = mkPipe({ label: 'terreno-sombra', code: WG_TERRAIN, vs: 'vsShadow', layouts: [R.L0, R.LT], depth: { write: true, compare: 'less', bias: 2, slope: 2.5 }, buffers: tbuf });
  // malha do clipmap
  { const N = 128, hN = 64, vb = new Float32Array((N + 1) * (N + 1) * 2); let k = 0;
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) { vb[k++] = x - hN; vb[k++] = z - hN; }
    const full = [], ring = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const a = z * (N + 1) + x, b = a + 1, c = a + N + 1, d = c + 1, q = [a, c, b, b, c, d]; full.push(...q); if (!(x >= hN - 28 && x < hN + 28 && z >= hN - 28 && z < hN + 28)) ring.push(...q); }
    R.clipVB = mkBuf(vb, 0x20); R.clipIBf = mkBuf(new Uint32Array(full), 0x10); R.clipIBr = mkBuf(new Uint32Array(ring), 0x10); R.clipNf = full.length; R.clipNr = ring.length;
    R.clipInst = dev.createBuffer({ size: R.NL * 16, usage: 0x20 | 8 }); }
  // céu
  { const pS = mkPipe({ label: 'ceu', code: WG_SKYBAKE, layouts: [R.L0], targets: [{ format: 'rgba16float' }] });
    const le = mkBGL(['t']), pE = mkPipe({ label: 'amb', code: WG_ENVBAKE, layouts: [R.L0, le], targets: [{ format: 'rgba16float' }] });
    R.bakeSky = () => {
      let enc = dev.createCommandEncoder(); let ps = enc.beginRenderPass({ colorAttachments: [{ view: R.skyT.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] });
      ps.setPipeline(pS); ps.setBindGroup(0, R.bg0); ps.draw(3); ps.end(); dev.queue.submit([enc.finish()]); genMips(R.skyT, 'rgba16float', 1, 12);
      enc = dev.createCommandEncoder(); ps = enc.beginRenderPass({ colorAttachments: [{ view: R.envT.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] });
      ps.setPipeline(pE); ps.setBindGroup(0, R.bg0); ps.setBindGroup(1, mkBG(le, [R.skyT.createView()])); ps.draw(3); ps.end(); dev.queue.submit([enc.finish()]); genMips(R.envT, 'rgba16float', 1, 10);
    }; }
  // passadas de tela cheia
  const lAO = mkBGL(['td', 't']); R.pAO = mkPipe({ label: 'ao', code: WG_AO, layouts: [R.L0, lAO], targets: [{ format: 'r8unorm' }] }); R.bgAO = mkBG(lAO, [R.vDepth, V(R.gN)]);
  const lL = mkBGL(['t', 't', 't', 'td', 't', 'tda', 'sc', 't', 't', 's', 't', 't']); R.pLight = mkPipe({ label: 'luz', code: WG_LIGHT, layouts: [R.L0, lL], targets: [{ format: 'rgba16float' }] });
  R.bgLight = [0, 1].map((i) => mkBG(lL, [V(R.gA), V(R.gN), V(R.gM), R.vDepth, V(R.gV), R.vShadow, R.sShadow, V(R.skyT), V(R.envT), R.sPano, V(R.aoT), R.vHist[1 - i]]));
  const lF = mkBGL(['td', 'tda', 'sc', 't', 's']); R.pFog = mkPipe({ label: 'nevoa', code: WG_FOG, layouts: [R.L0, lF], targets: [{ format: 'rgba16float' }] }); R.bgFog = mkBG(lF, [R.vDepth, R.vShadow, R.sShadow, V(R.envT), R.sPano]);
  const lFC = mkBGL(['t', 'td']); R.pFogC = mkPipe({ label: 'nevoa-comp', code: WG_FOGC, layouts: [R.L0, lFC], targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }], depth: { write: false, compare: 'always' } });
  R.bgFogC = mkBG(lFC, [V(R.fogT), R.vDepth]);
  const lTA = mkBGL(['t', 't', 't', 'td']); R.pTAA = mkPipe({ label: 'taa', code: WG_TAA, layouts: [R.L0, lTA], targets: [{ format: 'rgba16float' }] });
  R.bgTAA = [0, 1].map((i) => mkBG(lTA, [R.vHdr, R.vHist[1 - i], V(R.gV), R.vDepth]));
  const lMB = mkBGL(['t', 't', 'td']); R.pMB = mkPipe({ label: 'mblur', code: WG_MB, layouts: [R.L0, lMB], targets: [{ format: 'rgba16float' }] }); R.bgMB = [0, 1].map((i) => mkBG(lMB, [R.vHist[i], V(R.gV), R.vDepth]));
  const lB = mkBGL(['t', 's']); R.pBd0 = mkPipe({ label: 'bloom-d0', code: WG_BLOOM, fs: 'fsDown0', layouts: [lB], targets: [{ format: 'rgba16float' }] });
  R.pBd = mkPipe({ label: 'bloom-d', code: WG_BLOOM, fs: 'fsDown', layouts: [lB], targets: [{ format: 'rgba16float' }] });
  R.pBu = mkPipe({ label: 'bloom-u', code: WG_BLOOM, fs: 'fsUp', layouts: [lB], targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'zero' } } }] });
  R.bgBsrc = [mkBG(lB, [V(R.mb), R.sClamp])].concat(R.bloom.map((t) => mkBG(lB, [V(t), R.sClamp]))); R.vBloom = R.bloom.map(V);
  const lFi = mkBGL(['t', 't']); R.pFinal = mkPipe({ label: 'final', code: WG_FINAL, layouts: [R.L0, lFi], targets: [{ format: GPU.fmt }] }); R.bgFinal = mkBG(lFi, [V(R.mb), R.vBloom[0]]);
  // ---- consultas de tempo ----
  const NP = R.passNames.length;
  if (GPU.hasTS) { R.qs = dev.createQuerySet({ type: 'timestamp', count: NP * 2 }); R.qres = dev.createBuffer({ size: NP * 16, usage: 0x200 | 4 }); R.qread = dev.createBuffer({ size: NP * 16, usage: 1 | 8 }); R.qmapped = () => { const a = new BigInt64Array(R.qread.getMappedRange()); let tot = 0; for (let i = 0; i < NP; i++) { const ms = Number(a[i * 2 + 1] - a[i * 2]) * 1e-6; R.gpuMs[i] = ms; tot += ms; } R.gpuTotal = tot; R.qread.unmap(); R.tsBusy = false; R.tsFrames = (R.tsFrames | 0) + 1; }; }
  const tw = (i) => (GPU.hasTS ? { querySet: R.qs, beginningOfPassWriteIndex: i * 2, endOfPassWriteIndex: i * 2 + 1 } : undefined);
  // ---- descritores de passada (reutilizados) ----
  const ca = (view, clear) => ({ view, loadOp: clear ? 'clear' : 'load', storeOp: 'store', clearValue: clear || undefined });
  R.dShadow = [0, 1, 2].map((i) => ({ colorAttachments: [], depthStencilAttachment: { view: R.vShadowL[i], depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 }, timestampWrites: tw(i) }));
  R.dG = { colorAttachments: [ca(V(R.gA), [0, 0, 0, 1]), ca(V(R.gN), [0, 1, 0, 0]), ca(V(R.gM), [0, 1, 0, 0]), ca(V(R.gV), [0, 0, 0, 0])], depthStencilAttachment: { view: R.vDepth, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0 }, timestampWrites: tw(3) };
  R.dAO = { colorAttachments: [ca(V(R.aoT), [1, 1, 1, 1])], timestampWrites: tw(4) };
  R.dLight = { colorAttachments: [ca(R.vHdr, [0, 0, 0, 1])], timestampWrites: tw(5) };
  R.dFog = { colorAttachments: [ca(V(R.fogT), [0, 0, 0, 1])], timestampWrites: tw(6) };
  R.dFwd = { colorAttachments: [ca(R.vHdr, null)], depthStencilAttachment: { view: R.vDepth, depthReadOnly: true }, timestampWrites: tw(7) };
  R.dTAA = [0, 1].map((i) => ({ colorAttachments: [ca(R.vHist[i], [0, 0, 0, 1])], timestampWrites: tw(8) }));
  R.dMB = { colorAttachments: [ca(V(R.mb), [0, 0, 0, 1])], timestampWrites: tw(9) };
  R.dBd = R.vBloom.map((v, i) => ({ colorAttachments: [ca(v, [0, 0, 0, 1])], timestampWrites: i === 0 ? { querySet: R.qs, beginningOfPassWriteIndex: 20 } : undefined }));
  R.dBu = R.vBloom.map((v, i) => ({ colorAttachments: [ca(v, null)], timestampWrites: i === 0 ? { querySet: R.qs, endOfPassWriteIndex: 21 } : undefined }));
  if (!GPU.hasTS) { for (const d of R.dBd) d.timestampWrites = undefined; for (const d of R.dBu) d.timestampWrites = undefined; }
  R.dFinal = { colorAttachments: [{ view: null, loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }], timestampWrites: tw(11) };
  if (GPU.off) { R.offT = mkTex(W, H, 'rgba8unorm', RA | CS, { label: 'saida' }); R.offV = R.offT.createView(); R.offBuf = dev.createBuffer({ size: W * H * 4, usage: 1 | 8 }); }
  R.cmds = [null]; R.copySrc = { texture: R.hdr }; R.copyDst = { texture: R.hdrCopy }; R.copySize = [W, H, 1];
  // sol e céu
  const s = World.sun, sl = Math.hypot(s[0], s[1], s[2]); R.sun = new Float32Array([s[0] / sl, s[1] / sl, s[2] / sl]); R.sunCol = new Float32Array([9.2, 6.3, 3.7]);
  R.setCamera(0, 30, 0, 0, 30, 1, 1.0); renderUniforms(); R.bakeSky();
}
const _hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const _jx = new Float32Array(16), _jy = new Float32Array(16); for (let i = 0; i < 16; i++) { _jx[i] = _hal(i + 1, 2) - 0.5; _jy[i] = _hal(i + 1, 3) - 0.5; }
R.setCamera = function (ex, ey, ez, tx, ty, tz, fov) {
  R.eye[0] = ex; R.eye[1] = ey; R.eye[2] = ez; let fx = tx - ex, fy = ty - ey, fz = tz - ez; const l = 1 / Math.hypot(fx, fy, fz); R.fwd[0] = fx * l; R.fwd[1] = fy * l; R.fwd[2] = fz * l; R.fov = fov;
  m4look(R.view, 0, ex, ey, ez, tx, ty, tz, 0, 1, 0);
};
function _cascade(c, n, f) {
  const asp = GPU.W / GPU.H, th = Math.tan(R.fov / 2), k2 = th * th * (1 + asp * asp);
  const d = Math.min(f, (n + f) * 0.5 * (1 + k2)), rad0 = Math.sqrt((f - d) * (f - d) + f * f * k2), rad = Math.ceil(rad0 * 1.02 + 1), S = R.sun, ts = 2 * rad / R.SH;
  let cx = R.eye[0] + R.fwd[0] * d, cy = R.eye[1] + R.fwd[1] * d, cz = R.eye[2] + R.fwd[2] * d;
  // base da luz: direita = up x dir, e arredonda o centro ao texel para a sombra não cintilar
  let rx = S[2], rz = -S[0]; const rl = 1 / Math.hypot(rx, rz); rx *= rl; rz *= rl;
  const ux = S[1] * rz, uy = S[2] * rx - S[0] * rz, uz = -S[1] * rx;
  let lx = cx * rx + cz * rz, ly = cx * ux + cy * uy + cz * uz; const lz = cx * S[0] + cy * S[1] + cz * S[2];
  lx = Math.round(lx / ts) * ts; ly = Math.round(ly / ts) * ts;
  cx = rx * lx + ux * ly + S[0] * lz; cy = uy * ly + S[1] * lz; cz = rz * lx + uz * ly + S[2] * lz;
  const D = 420;
  m4look(R.lview, 0, cx + S[0] * D, cy + S[1] * D, cz + S[2] * D, cx, cy, cz, 0, 1, 0); m4ortho(R.lproj, 0, -rad, rad, -rad, rad, 0, D + rad + 60);
  m4mul(R.fb, 96 + c * 16, R.lproj, 0, R.lview, 0); R.shTex[c] = ts;
}
function renderUniforms() {
  const f = R.fb, W = GPU.W, H = GPU.H, j = R.frame & 15;
  m4persp(R.proj, 0, R.fov, W / H, R.near);
  for (let i = 0; i < 16; i++) R.projJ[i] = R.proj[i];
  R.projJ[8] = _jx[j] * 2 / W; R.projJ[9] = _jy[j] * 2 / H;
  for (let i = 0; i < 16; i++) R.pvp[i] = R.vpNJ[i];
  m4mul(R.vpNJ, 0, R.proj, 0, R.view, 0); m4mul(R.vp, 0, R.projJ, 0, R.view, 0); m4inv(R.ivp, 0, R.vp, 0);
  if (R.frame === 0 || R.cut > 0) { for (let i = 0; i < 16; i++) R.pvp[i] = R.vpNJ[i]; if (typeof CarD !== 'undefined') CarD.u.copyWithin(80, 0, 80); }
  f[187] = R.cut > 0 ? 1 : 0; if (R.cut > 0) R.cut--;
  f.set(R.vp, 0); f.set(R.pvp, 16); f.set(R.vpNJ, 32); f.set(R.ivp, 48); f.set(R.view, 64); f.set(R.projJ, 80);
  _cascade(0, R.near, R.splits[0]); if (R.frame < 2 || !(R.frame & 1)) _cascade(1, R.splits[0] * 0.9, R.splits[1]); if (R.frame < 2 || (R.frame & 1)) _cascade(2, R.splits[1] * 0.9, R.splits[2]);
  f[144] = R.eye[0]; f[145] = R.eye[1]; f[146] = R.eye[2]; f[147] = R.time;
  f[148] = R.sun[0]; f[149] = R.sun[1]; f[150] = R.sun[2]; f[151] = R.ptime;
  f[152] = R.sunCol[0]; f[153] = R.sunCol[1]; f[154] = R.sunCol[2]; f[155] = R.exposure;
  f[156] = W; f[157] = H; f[158] = 1 / W; f[159] = 1 / H;
  f[160] = _jx[j] / W; f[161] = _jy[j] / H;
  f[164] = R.splits[0]; f[165] = R.splits[1]; f[166] = R.splits[2]; f[167] = World.trk ? World.trk.L : 1;
  f[168] = R.frame; f[169] = R.dt; f[170] = R.near; f[171] = Math.tan(R.fov / 2);
  f[172] = 0.8; f[173] = 0.6; f[174] = 1.0; f[175] = R.camMode;
  f[184] = R.dbgView || 0;
  f[176] = R.shTex[0]; f[177] = R.shTex[1]; f[178] = R.shTex[2];
  GPU.dev.queue.writeBuffer(R.ubo, 0, f);
  for (let c = 0; c < 3; c++) { const s = R.sfb[c]; s.set(f); for (let i = 0; i < 16; i++) s[i] = f[96 + c * 16 + i]; GPU.dev.queue.writeBuffer(R.subo[c], 0, s); }
  // níveis do clipmap
  for (let L = 0; L < R.NL; L++) { const d = 0.25 * (1 << L), g = 2 * d; R.clip[L * 4] = Math.round(R.eye[0] / g) * g; R.clip[L * 4 + 1] = Math.round(R.eye[2] / g) * g; R.clip[L * 4 + 2] = d; R.clip[L * 4 + 3] = L; }
  GPU.dev.queue.writeBuffer(R.clipInst, 0, R.clip);
}
function _terrain(p, shadow, c) {
  p.setPipeline(shadow ? R.pTerrS : R.pTerr); p.setBindGroup(1, R.bgT); p.setVertexBuffer(0, R.clipVB); p.setVertexBuffer(1, R.clipInst);
  if (!shadow) { p.setIndexBuffer(R.clipIBf, 'uint32'); p.drawIndexed(R.clipNf, 1, 0, 0, 0); p.setIndexBuffer(R.clipIBr, 'uint32'); p.drawIndexed(R.clipNr, R.NL - 1, 0, 0, 1); }
  else { const a = c === 0 ? 0 : c === 1 ? 1 : 3, b = c === 0 ? 5 : c === 1 ? 7 : 9; if (a === 0) { p.setIndexBuffer(R.clipIBf, 'uint32'); p.drawIndexed(R.clipNf, 1, 0, 0, 0); } p.setIndexBuffer(R.clipIBr, 'uint32'); p.drawIndexed(R.clipNr, b - Math.max(a, 1), 0, 0, Math.max(a, 1)); }
}
function _fs(enc, desc, pipe, bg1) { const p = enc.beginRenderPass(desc); p.setPipeline(pipe); p.setBindGroup(0, R.bg0); p.setBindGroup(1, bg1); p.draw(3); p.end(); }
function renderFrame() {
  const dev = GPU.dev, hi = R.frame & 1;
  renderUniforms();
  if (typeof scenePre !== 'undefined') scenePre();
  const enc = dev.createCommandEncoder();
  if (typeof sceneEnc !== 'undefined') sceneEnc(enc);
  for (let c = 0; c < 3; c++) {
    if (R.frame >= 2 && c > 0 && ((R.frame & 1) === 0) !== (c === 1)) continue;
    const p = enc.beginRenderPass(R.dShadow[c]); p.setBindGroup(0, R.bgS[c]); _terrain(p, true, c);
    for (let i = 0; i < R.sDraw.length; i++) R.sDraw[i](p, c);
    p.end();
  }
  { const p = enc.beginRenderPass(R.dG); p.setBindGroup(0, R.bg0); for (let i = 0; i < R.gDraw.length; i++) R.gDraw[i](p); if (!(R.dbg & 4)) _terrain(p, false, 0); p.end(); }
  _fs(enc, R.dAO, R.pAO, R.bgAO);
  _fs(enc, R.dLight, R.pLight, R.bgLight[hi]);
  _fs(enc, R.dFog, R.pFog, R.bgFog);
  enc.copyTextureToTexture(R.copySrc, R.copyDst, R.copySize);
  { const p = enc.beginRenderPass(R.dFwd); p.setBindGroup(0, R.bg0);
    for (let i = 0; i < R.fDraw.length; i++) if (R.fDraw[i].early) R.fDraw[i](p);
    p.setPipeline(R.pFogC); p.setBindGroup(1, R.bgFogC); p.draw(3);
    for (let i = 0; i < R.fDraw.length; i++) if (!R.fDraw[i].early) R.fDraw[i](p);
    p.end(); }
  _fs(enc, R.dTAA[hi], R.pTAA, R.bgTAA[hi]);
  _fs(enc, R.dMB, R.pMB, R.bgMB[hi]);
  for (let i = 0; i < 6; i++) { const p = enc.beginRenderPass(R.dBd[i]); p.setPipeline(i === 0 ? R.pBd0 : R.pBd); p.setBindGroup(0, R.bgBsrc[i]); p.draw(3); p.end(); }
  for (let i = 4; i >= 0; i--) { const p = enc.beginRenderPass(R.dBu[i]); p.setPipeline(R.pBu); p.setBindGroup(0, R.bgBsrc[i + 2]); p.draw(3); p.end(); }
  R.dFinal.colorAttachments[0].view = GPU.off ? R.offV : GPU.ctx.getCurrentTexture().createView();
  { const p = enc.beginRenderPass(R.dFinal); p.setPipeline(R.pFinal); p.setBindGroup(0, R.bg0); p.setBindGroup(1, R.bgFinal); p.draw(3); if (R.hudDraw) R.hudDraw(p); p.end(); }
  const doTS = GPU.hasTS && R.perf && !R.tsBusy;
  if (GPU.hasTS) enc.resolveQuerySet(R.qs, 0, R.passNames.length * 2, R.qres, 0);
  if (doTS) enc.copyBufferToBuffer(R.qres, 0, R.qread, 0, R.passNames.length * 16);
  R.cmds[0] = enc.finish(); dev.queue.submit(R.cmds);
  if (doTS) { R.tsBusy = true; R.qread.mapAsync(1).then(R.qmapped); }
  R.frame++;
}
