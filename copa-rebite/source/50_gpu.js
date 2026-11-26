// ---------- renderizador WebGPU (diferido + TAA + pos) ----------
const INST_MAX = 160, INST_F = 64, PMAX_A = 384, PMAX_B = 3072, MARK_MAX = 256, SH_RES = 2048, ENV_RES = 128, ENV_MIPS = 6;
const SLOT = { WORLD: 0, GLASS: 1, AUX0: 2, AUX1: 3, AUX2: 4, AUX3: 5, ROBOT: 8, ROBOT_N: 20, DEBRIS: 48, DEBRIS_N: 40 };
const R = {
  ok: false, w: 0, h: 0, frameNo: 0, scene: -1, exposure: 1, fog: .02, mblur: 1, flash: 0, quality: 1, reset: 1, amb: 1,
  I: new Float32Array(INST_MAX * INST_F), im: new Int16Array(INST_MAX).fill(-1),
  eye: new Float32Array([0, 3, 8]), tgt: new Float32Array([0, 0, 0]), up: new Float32Array([0, 1, 0]), cp: new Float32Array([.9, 0, 0, 0]), tm: new Float64Array(1), near: .045, far: 120,
  dl: new Float32Array(6 * 8), ndl: 0,
  pA: new Float32Array(PMAX_A * 12), nA: 0, pB: new Float32Array(PMAX_B * 12), nB: 0, mk: new Float32Array(MARK_MAX * 8), nmk: 0,
  U: new Float32Array(428), view: new Float32Array(16), proj: new Float32Array(16), vp: new Float32Array(16), pvp: new Float32Array(16), tmp: new Float32Array(16), tmp2: new Float32Array(16),
  gpuMs: -1, tsBusy: false, perf: false,

  async init(canvas, mb) {
    if (!navigator.gpu) throw new Error('WebGPU indisponível neste navegador.');
    const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!ad) throw new Error('Nenhum adaptador WebGPU encontrado.');
    const hasTs = ad.features.has('timestamp-query');
    const dev = this.dev = await ad.requestDevice({ requiredFeatures: hasTs ? ['timestamp-query'] : [] });
    this.adapterInfo = ad.info || {}; this.hasTs = hasTs;
    dev.addEventListener('uncapturederror', e => { console.error('GPU: ' + e.error.message); this.lastError = e.error.message; });
    const ctx = this.ctx = canvas.getContext('webgpu'); this.canvas = canvas; this.fmt = navigator.gpu.getPreferredCanvasFormat(); ctx.configure({ device: dev, format: this.fmt, alphaMode: 'opaque' });
    // geometria
    const pk = mb.pack(); this.meshes = []; for (const k in mb.meshes) this.meshes[mb.meshes[k].id] = mb.meshes[k];
    this.vb = dev.createBuffer({ size: pk.vb.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(this.vb, 0, pk.vb);
    this.ib = dev.createBuffer({ size: pk.ib.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(this.ib, 0, pk.ib);
    this.triCount = pk.ib.length / 3; this.vertCount = pk.nv;
    const B = GPUBufferUsage;
    this.ubo = dev.createBuffer({ size: this.U.byteLength, usage: B.UNIFORM | B.COPY_DST });
    this.ibuf = dev.createBuffer({ size: this.I.byteLength, usage: B.STORAGE | B.COPY_DST });
    this.pbufA = dev.createBuffer({ size: this.pA.byteLength, usage: B.VERTEX | B.COPY_DST }); this.pbufB = dev.createBuffer({ size: this.pB.byteLength, usage: B.VERTEX | B.COPY_DST });
    this.mbuf = dev.createBuffer({ size: this.mk.byteLength, usage: B.VERTEX | B.COPY_DST });
    for (let i = 0; i < INST_MAX; i++) { M4.ident(this.I, i * INST_F); M4.ident(this.I, i * INST_F + 16); this.I[i * INST_F + 36] = -1; }
    const T = GPUTextureUsage;
    this.atlas = dev.createTexture({ size: [2048, 2048], format: 'rgba8unorm', mipLevelCount: 8, usage: T.TEXTURE_BINDING | T.COPY_DST | T.RENDER_ATTACHMENT });
    this.marks = dev.createTexture({ size: [2048, 2048], format: 'rgba8unorm', usage: T.TEXTURE_BINDING | T.RENDER_ATTACHMENT }); this.marksV = this.marks.createView();
    this.shStat = dev.createTexture({ size: [SH_RES, SH_RES, 4], format: 'depth32float', usage: T.RENDER_ATTACHMENT | T.COPY_SRC });
    this.shDyn = dev.createTexture({ size: [SH_RES, SH_RES, 4], format: 'depth32float', usage: T.RENDER_ATTACHMENT | T.COPY_DST | T.TEXTURE_BINDING });
    this.shStatV = []; this.shDynV = []; for (let i = 0; i < 4; i++) { this.shStatV.push(this.shStat.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 })); this.shDynV.push(this.shDyn.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 })); }
    this.env = []; for (let s = 0; s < 2; s++) this.env.push(dev.createTexture({ size: [ENV_RES, ENV_RES, 6], format: 'rgba16float', mipLevelCount: ENV_MIPS, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING }));
    this.envBlack = dev.createTexture({ size: [4, 4, 6], format: 'rgba16float', usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
    this.dummy = dev.createTexture({ size: [4, 4], format: 'rgba16float', usage: T.TEXTURE_BINDING | T.RENDER_ATTACHMENT }); this.dummyV = this.dummy.createView();
    this.sLin = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.sRep = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', maxAnisotropy: 4 });
    this.sCmp = dev.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    // layouts
    const S = GPUShaderStage;
    this.lScene = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.VERTEX | S.FRAGMENT, buffer: {} }, { binding: 1, visibility: S.VERTEX | S.FRAGMENT, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: S.FRAGMENT, texture: {} }, { binding: 3, visibility: S.FRAGMENT, texture: {} }, { binding: 4, visibility: S.FRAGMENT, sampler: {} }, { binding: 5, visibility: S.FRAGMENT, texture: {} }, { binding: 6, visibility: S.FRAGMENT, texture: {} }, { binding: 7, visibility: S.FRAGMENT, sampler: {} }] });
    this.lShadow = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.VERTEX, buffer: {} }] });
    this.lEnvG = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.FRAGMENT, texture: { viewDimension: 'cube' } }, { binding: 1, visibility: S.FRAGMENT, sampler: {} }] });
    this.lPost = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: S.FRAGMENT, buffer: {} }, { binding: 1, visibility: S.FRAGMENT, texture: {} }, { binding: 2, visibility: S.FRAGMENT, texture: {} }, { binding: 3, visibility: S.FRAGMENT, texture: {} }, { binding: 4, visibility: S.FRAGMENT, texture: { sampleType: 'depth' } }, { binding: 5, visibility: S.FRAGMENT, sampler: {} }] });
    const mod = async (code, name) => { const m = dev.createShaderModule({ code }); const info = await m.getCompilationInfo(); for (const msg of info.messages) if (msg.type === 'error') { const ln = code.split('\n')[msg.lineNum - 1]; throw new Error(`WGSL ${name}:${msg.lineNum}: ${msg.message}\n${ln}`); } return m; };
    const mScene = await mod(WGSL_SCENE, 'scene'), mShadow = await mod(WGSL_SHADOW, 'shadow'), mLight = await mod(WGSL_LIGHT, 'light'), mVol = await mod(WGSL_VOL, 'vol'), mPost = await mod(WGSL_POST, 'post'), mFx = await mod(WGSL_FX, 'fx'), mEnv = await mod(WGSL_ENV, 'env');
    const vbl = [{ arrayStride: 32, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'unorm8x4' }, { shaderLocation: 3, offset: 28, format: 'float32' }] }];
    const plScene = dev.createPipelineLayout({ bindGroupLayouts: [this.lScene] }), plShadow = dev.createPipelineLayout({ bindGroupLayouts: [this.lScene, this.lShadow] }), plGlass = dev.createPipelineLayout({ bindGroupLayouts: [this.lScene, this.lEnvG] }), plPost = dev.createPipelineLayout({ bindGroupLayouts: [this.lPost] });
    this.pShadow = dev.createRenderPipeline({ layout: plShadow, vertex: { module: mShadow, entryPoint: 'vsShadow', buffers: vbl }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.2 } });
    this.pG = dev.createRenderPipeline({ layout: plScene, vertex: { module: mScene, entryPoint: 'vs', buffers: vbl }, fragment: { module: mScene, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }, { format: 'rgba16float' }, { format: 'rgba16float' }] }, primitive: { cullMode: 'back' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' } });
    const pm = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } }, addB = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    this.pGF = dev.createRenderPipeline({ layout: plScene, vertex: { module: mScene, entryPoint: 'vs', buffers: vbl }, fragment: { module: mScene, entryPoint: 'fsFlat', targets: [{ format: 'rgba8unorm' }, { format: 'rgba16float' }, { format: 'rgba16float' }] }, primitive: { cullMode: 'back' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' } });
    this.pGT = dev.createRenderPipeline({ layout: plScene, vertex: { module: mScene, entryPoint: 'vs', buffers: vbl }, fragment: { module: mScene, entryPoint: 'fsTear', targets: [{ format: 'rgba8unorm' }, { format: 'rgba16float' }, { format: 'rgba16float' }] }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' } });
    this.pGlass = dev.createRenderPipeline({ layout: plGlass, vertex: { module: mScene, entryPoint: 'vs', buffers: vbl }, fragment: { module: mScene, entryPoint: 'fsGlass', targets: [{ format: 'rgba16float', blend: pm }] }, primitive: { cullMode: 'none' }, depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'less' } });
    const fsq = (m, ep, fmt, blend, layout, ds) => dev.createRenderPipeline({ layout: layout || 'auto', vertex: { module: m, entryPoint: 'vsFS' }, fragment: { module: m, entryPoint: ep, targets: [{ format: fmt, blend }] }, depthStencil: ds });
    this.pLight = fsq(mLight, 'fs', 'rgba16float'); this.pVol = fsq(mVol, 'fs', 'rgba16float'); this.pVolUp = fsq(mPost, 'fsVolUp', 'rgba16float', addB, plPost, { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' });
    this.pTAA = fsq(mPost, 'fsTAA', 'rgba16float', undefined, plPost); this.pB0 = fsq(mPost, 'fsBloom0', 'rgba16float', undefined, plPost); this.pBD = fsq(mPost, 'fsBloomD', 'rgba16float', undefined, plPost); this.pBU = fsq(mPost, 'fsBloomU', 'rgba16float', addB, plPost); this.pFinal = fsq(mPost, 'fsFinal', this.fmt, undefined, plPost);
    this.pEnv = fsq(mEnv, 'fs', 'rgba16float');
    const pvb = [{ arrayStride: 48, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }, { shaderLocation: 2, offset: 32, format: 'float32x4' }] }];
    const mkP = ds => dev.createRenderPipeline({ layout: 'auto', vertex: { module: mFx, entryPoint: 'vsP', buffers: pvb }, fragment: { module: mFx, entryPoint: 'fsP', targets: [{ format: 'rgba16float', blend: pm }] }, primitive: { topology: 'triangle-strip' }, depthStencil: ds });
    this.pPartD = mkP({ format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' }); this.pPart = mkP(undefined);
    this.pMark = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mFx, entryPoint: 'vsM', buffers: [{ arrayStride: 32, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }] }] }, fragment: { module: mFx, entryPoint: 'fsM', targets: [{ format: 'rgba8unorm', blend: { color: { operation: 'max', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'max', srcFactor: 'one', dstFactor: 'one' } } }] }, primitive: { topology: 'triangle-strip' } });
    // piso assado: albedo+metal e normal+rugosidade, com mips
    { const FR = 4096, mips = 12, mF = await mod(WGSL_FLOOR, 'floor'), mB = await mod(WGSL_BLIT, 'blit');
      this.floorA = dev.createTexture({ size: [FR, FR], format: 'rgba8unorm', mipLevelCount: mips, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING }); this.floorB = dev.createTexture({ size: [FR, FR], format: 'rgba8unorm', mipLevelCount: mips, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING });
      const pF = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mF, entryPoint: 'vsFS' }, fragment: { module: mF, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }, { format: 'rgba8unorm' }] } });
      const pD = this.pBlit = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mB, entryPoint: 'vsFS' }, fragment: { module: mB, entryPoint: 'fsDown', targets: [{ format: 'rgba8unorm' }] } });
      const e = dev.createCommandEncoder(); let p = e.beginRenderPass({ colorAttachments: [{ view: this.floorA.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }, { view: this.floorB.createView({ baseMipLevel: 0, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] }); p.setPipeline(pF); p.draw(3); p.end();
      for (const tx of [this.floorA, this.floorB]) for (let m = 1; m < mips; m++) { const bg = dev.createBindGroup({ layout: pD.getBindGroupLayout(0), entries: [{ binding: 0, resource: tx.createView({ baseMipLevel: m - 1, mipLevelCount: 1 }) }, { binding: 1, resource: this.sLin }] }); p = e.beginRenderPass({ colorAttachments: [{ view: tx.createView({ baseMipLevel: m, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] }); p.setPipeline(pD); p.setBindGroup(0, bg); p.draw(3); p.end(); }
      dev.queue.submit([e.finish()]); this.sAni = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 4 }); }
    // bind groups fixos
    this.bgScene = dev.createBindGroup({ layout: this.lScene, entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: { buffer: this.ibuf } }, { binding: 2, resource: this.atlas.createView() }, { binding: 3, resource: this.marksV }, { binding: 4, resource: this.sRep }, { binding: 5, resource: this.floorA.createView() }, { binding: 6, resource: this.floorB.createView() }, { binding: 7, resource: this.sAni }] });
    this.shUbo = []; this.bgSh = []; for (let i = 0; i < 4; i++) { const b = dev.createBuffer({ size: 64, usage: B.UNIFORM | B.COPY_DST }); this.shUbo.push(b); this.bgSh.push(dev.createBindGroup({ layout: this.lShadow, entries: [{ binding: 0, resource: { buffer: b } }] })); }
    this.envV = this.env.map(t => t.createView({ dimension: 'cube' })); this.envBlackV = this.envBlack.createView({ dimension: 'cube' });
    this.bgEnvG = this.envV.map(v => dev.createBindGroup({ layout: this.lEnvG, entries: [{ binding: 0, resource: v }, { binding: 1, resource: this.sLin }] }));
    this.shArrV = this.shDyn.createView({ dimension: '2d-array' });
    this.envUbo = dev.createBuffer({ size: 16, usage: B.UNIFORM | B.COPY_DST });
    // descritores de passe reutilizados
    const ca = (view, load, clr) => ({ view, loadOp: load ? 'load' : 'clear', storeOp: 'store', clearValue: clr || { r: 0, g: 0, b: 0, a: 0 } });
    this.dShadow = this.shDynV.map(v => ({ colorAttachments: [], depthStencilAttachment: { view: v, depthLoadOp: 'load', depthStoreOp: 'store' } }));
    this.dMark = { colorAttachments: [ca(this.marksV, true)] };
    this.dFinal = { colorAttachments: [ca(null, false)] };
    this.ca = ca;
    // limpa marcas e cubos
    { const e = dev.createCommandEncoder(); e.beginRenderPass({ colorAttachments: [ca(this.marksV, false)] }).end(); for (let f = 0; f < 6; f++) e.beginRenderPass({ colorAttachments: [ca(this.envBlack.createView({ dimension: '2d', baseArrayLayer: f, arrayLayerCount: 1 }), false)] }).end(); e.beginRenderPass({ colorAttachments: [ca(this.dummyV, false)] }).end(); dev.queue.submit([e.finish()]); }
    if (hasTs) { this.qs = dev.createQuerySet({ type: 'timestamp', count: 2 }); this.qres = dev.createBuffer({ size: 16, usage: B.QUERY_RESOLVE | B.COPY_SRC }); this.qread = dev.createBuffer({ size: 16, usage: B.MAP_READ | B.COPY_DST }); }
    this.ok = true;
  },
  clearMarks() { const e = this.dev.createCommandEncoder(); e.beginRenderPass({ colorAttachments: [this.ca(this.marksV, false)] }).end(); this.dev.queue.submit([e.finish()]); },
  targets(w, h, small) {
    const dev = this.dev, T = GPUTextureUsage, mk = (fmt, ww, hh, extra) => dev.createTexture({ size: [ww || w, hh || h], format: fmt, usage: T.RENDER_ATTACHMENT | T.TEXTURE_BINDING | (extra || 0) });
    const t = { w, h }; t.gA = mk('rgba8unorm'); t.gN = mk('rgba16float'); t.gV = mk('rgba16float'); t.gD = mk('depth32float');
    t.gAV = t.gA.createView(); t.gNV = t.gN.createView(); t.gVV = t.gV.createView(); t.gDV = t.gD.createView();
    t.dG = { colorAttachments: [this.ca(t.gAV), this.ca(t.gNV), this.ca(t.gVV)], depthStencilAttachment: { view: t.gDV, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } };
    const lightBG = (envV, prevV) => dev.createBindGroup({ layout: this.pLight.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: t.gAV }, { binding: 2, resource: t.gNV }, { binding: 3, resource: t.gVV }, { binding: 4, resource: t.gDV }, { binding: 5, resource: this.shArrV }, { binding: 6, resource: this.sCmp }, { binding: 7, resource: envV }, { binding: 8, resource: this.sLin }, { binding: 9, resource: prevV }] });
    if (small) { t.bgLightBlack = lightBG(this.envBlackV, this.dummyV); t.bgLightEnv = this.envV.map(v => lightBG(v, this.dummyV)); return t; }
    t.hdr = mk('rgba16float'); t.hdrV = t.hdr.createView(); t.hist = [mk('rgba16float', 0, 0, T.COPY_SRC), mk('rgba16float', 0, 0, T.COPY_SRC)]; t.histV = t.hist.map(x => x.createView()); t.post = mk('rgba16float', 0, 0, T.COPY_DST); t.postV = t.post.createView();
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2); t.vol = mk('rgba16float', hw, hh); t.volV = t.vol.createView();
    t.bloom = []; t.bloomV = []; let bw = hw, bh = hh; for (let i = 0; i < 6; i++) { const b = mk('rgba16float', bw, bh); t.bloom.push(b); t.bloomV.push(b.createView()); bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); }
    t.bgLight = this.envV.map(v => lightBG(v, t.postV));
    t.bgVol = dev.createBindGroup({ layout: this.pVol.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: t.gDV }, { binding: 2, resource: this.shArrV }, { binding: 3, resource: this.sCmp }] });
    const post = (a, b, c) => dev.createBindGroup({ layout: this.lPost, entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: a }, { binding: 2, resource: b || this.dummyV }, { binding: 3, resource: c || this.dummyV }, { binding: 4, resource: t.gDV }, { binding: 5, resource: this.sLin }] });
    t.bgVolUp = post(t.volV); t.bgTAA = [post(t.hdrV, t.histV[1], t.gVV), post(t.hdrV, t.histV[0], t.gVV)];
    t.bgB0 = post(t.postV); t.bgBD = t.bloomV.map(v => post(v)); t.bgFinal = post(t.postV, t.bloomV[0], t.gVV);
    t.bgPart = dev.createBindGroup({ layout: this.pPart.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: t.gDV }] });
    t.bgPartD = dev.createBindGroup({ layout: this.pPartD.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: t.gDV }] });
    t.dVol = { colorAttachments: [this.ca(t.volV)] }; t.dLight = { colorAttachments: [this.ca(t.hdrV)] };
    t.dFwd = { colorAttachments: [this.ca(t.hdrV, true)], depthStencilAttachment: { view: t.gDV, depthReadOnly: true } };
    t.dTAA = t.histV.map(v => ({ colorAttachments: [this.ca(v)] })); t.dPost = { colorAttachments: [this.ca(t.postV, true)] };
    t.dBloom = t.bloomV.map(v => ({ colorAttachments: [this.ca(v)] })); t.dBloomU = t.bloomV.map(v => ({ colorAttachments: [this.ca(v, true)] }));
    t.cpSrc = t.hist.map(x => ({ texture: x })); t.cpDst = { texture: t.post }; t.cpSize = [w, h];
    return t;
  },
  resize(w, h) { if (w === this.w && h === this.h) return; this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h; this.T = this.targets(w, h, false); this.reset = 1; },
  // ---- luzes da cena ----
  setLights(list) {
    this.sceneLights = list; this.nsl = list.length; const U = this.U; let si = 0;
    for (let i = 0; i < list.length; i++) {
      const L = list[i], o = 100 + i * 16, dx = L.t[0] - L.p[0], dy = L.t[1] - L.p[1], dz = L.t[2] - L.p[2], l = 1 / Math.hypot(dx, dy, dz), a = L.a * PI / 180;
      U[o] = L.p[0]; U[o + 1] = L.p[1]; U[o + 2] = L.p[2]; U[o + 3] = 60; U[o + 4] = dx * l; U[o + 5] = dy * l; U[o + 6] = dz * l; U[o + 7] = Math.cos(a);
      U[o + 8] = L.c[0] * L.I; U[o + 9] = L.c[1] * L.I; U[o + 10] = L.c[2] * L.I; U[o + 11] = Math.cos(a * .62); U[o + 12] = L.s ? si : -1; U[o + 13] = 0; U[o + 14] = (L.s || i < 6) && L.vol !== 0 ? 1 : 0; U[o + 15] = 0;
      if (L.s) { const P = new Float32Array(16), V = new Float32Array(16), O = new Float32Array(16); M4.persp(P, 2 * (a + .05), 1, .4, 40); M4.lookAt(V, L.p[0], L.p[1], L.p[2], L.t[0], L.t[1], L.t[2], Math.abs(dy * l) > .98 ? 1 : 0, Math.abs(dy * l) > .98 ? 0 : 1, 0); M4.mul(O, 0, P, 0, V, 0); U.set(O, 356 + si * 16); this.dev.queue.writeBuffer(this.shUbo[si], 0, O); si++; }
    }
    this.nsh = si; this.baseL = new Float32Array(48); for (let i = 0; i < list.length; i++) for (let c = 0; c < 3; c++) this.baseL[i * 3 + c] = U[100 + i * 16 + 8 + c];
  },
  // desenha as instancias visiveis de [a,b)
  drawRange(p, a, b) { const im = this.im, ms = this.meshes; for (let i = a; i < b; i++) { const m = im[i]; if (m < 0) continue; const q = ms[m]; p.drawIndexed(q.count, 1, q.first, 0, i); } },
  bake(sceneId, staticMesh, lights, envPos) { // sombras estaticas + cubo de ambiente (na troca de cena)
    const dev = this.dev; this.setLights(lights); this.scene = sceneId; this.im[SLOT.WORLD] = staticMesh; this.staticMesh = staticMesh;
    dev.queue.writeBuffer(this.ibuf, 0, this.I);
    let e = dev.createCommandEncoder();
    for (let s = 0; s < 4; s++) { const p = e.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.shStatV[s], depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } }); if (s < this.nsh) { p.setPipeline(this.pShadow); p.setBindGroup(0, this.bgScene); p.setBindGroup(1, this.bgSh[s]); p.setVertexBuffer(0, this.vb); p.setIndexBuffer(this.ib, 'uint32'); this.drawRange(p, 0, 1); } p.end(); }
    e.copyTextureToTexture({ texture: this.shStat }, { texture: this.shDyn }, [SH_RES, SH_RES, 4]); dev.queue.submit([e.finish()]);
    if (this.envDone && this.envDone[sceneId]) return; (this.envDone = this.envDone || [])[sceneId] = 1;
    // captura do cubo (2 rebatidas)
    if (!this.ct) this.ct = this.targets(ENV_RES, ENV_RES, true); const ct = this.ct, U = this.U;
    const dirs = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, -1], [0, 0, -1, 0, 1, 0], [0, 0, 1, 0, 1, 0]];
    const sv = { q: this.quality, n: this.ndl }; this.quality = 0; this.ndl = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let f = 0; f < 6; f++) {
        const d = dirs[f]; M4.persp(this.proj, PI / 2, 1, .1, 120); M4.lookAt(this.view, envPos[0], envPos[1], envPos[2], envPos[0] + d[0], envPos[1] + d[1], envPos[2] + d[2], d[3], d[4], d[5]);
        this.fillFrame(ENV_RES, ENV_RES, envPos, 0, 0, true); dev.queue.writeBuffer(this.ubo, 0, U);
        e = dev.createCommandEncoder(); let p = e.beginRenderPass(ct.dG); p.setPipeline(this.pG); p.setBindGroup(0, this.bgScene); p.setVertexBuffer(0, this.vb); p.setIndexBuffer(this.ib, 'uint32'); this.drawRange(p, 0, 1); p.end();
        p = e.beginRenderPass({ colorAttachments: [this.ca(this.env[sceneId].createView({ dimension: '2d', baseArrayLayer: f, arrayLayerCount: 1, baseMipLevel: 0, mipLevelCount: 1 }))] }); p.setPipeline(this.pLight); p.setBindGroup(0, pass === 0 ? ct.bgLightBlack : ct.bgLightEnv[1 - sceneId]); p.draw(3); p.end(); dev.queue.submit([e.finish()]);
      }
      // mips borrados
      for (let m = 1; m < ENV_MIPS; m++) {
        const src = this.env[sceneId].createView({ dimension: 'cube', baseMipLevel: m - 1, mipLevelCount: 1 });
        for (let f = 0; f < 6; f++) {
          const ub = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(ub, 0, new Float32Array([f, m === 1 ? .12 : m < 4 ? .3 : .75, 0, 0]));
          const bg = dev.createBindGroup({ layout: this.pEnv.getBindGroupLayout(0), entries: [{ binding: 0, resource: src }, { binding: 1, resource: this.sLin }, { binding: 2, resource: { buffer: ub } }] });
          e = dev.createCommandEncoder(); const p = e.beginRenderPass({ colorAttachments: [this.ca(this.env[sceneId].createView({ dimension: '2d', baseArrayLayer: f, arrayLayerCount: 1, baseMipLevel: m, mipLevelCount: 1 }))] }); p.setPipeline(this.pEnv); p.setBindGroup(0, bg); p.draw(3); p.end(); dev.queue.submit([e.finish()]);
        }
      }
      if (pass === 0) { // a 2a rebatida le o proprio cubo: copia para o cubo da outra cena temporariamente nao e possivel; usa o outro slot como fonte
        const o = 1 - sceneId; e = dev.createCommandEncoder();
        for (let m = 0; m < ENV_MIPS; m++) for (let f = 0; f < 6; f++) { const ub = dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(ub, 0, new Float32Array([f, 0, m, 0]));
          const bg = dev.createBindGroup({ layout: this.pEnv.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.env[sceneId].createView({ dimension: 'cube' }) }, { binding: 1, resource: this.sLin }, { binding: 2, resource: { buffer: ub } }] });
          const p = e.beginRenderPass({ colorAttachments: [this.ca(this.env[o].createView({ dimension: '2d', baseArrayLayer: f, arrayLayerCount: 1, baseMipLevel: m, mipLevelCount: 1 }))] }); p.setPipeline(this.pEnv); p.setBindGroup(0, bg); p.draw(3); p.end(); }
        dev.queue.submit([e.finish()]); this.envDone[o] = 0;
      }
    }
    this.quality = sv.q; this.ndl = sv.n; this.reset = 1;
  },
  fillFrame(w, h, eye, jx, jy, first) {
    const U = this.U; M4.mul(this.vp, 0, this.proj, 0, this.view, 0);
    if (first) this.pvp.set(this.vp);
    U.set(this.pvp, 32); U.set(this.vp, 16);
    this.proj[8] += jx; this.proj[9] += jy; M4.mul(this.tmp, 0, this.proj, 0, this.view, 0); this.proj[8] -= jx; this.proj[9] -= jy;
    U.set(this.tmp, 0); M4.invert(this.tmp2, this.tmp); U.set(this.tmp2, 48); U.set(this.view, 64);
    U[80] = eye[0]; U[81] = eye[1]; U[82] = eye[2]; U[83] = this.tm[0]; U[84] = w; U[85] = h; U[86] = 1 / w; U[87] = 1 / h;
    U[88] = this.exposure; U[89] = this.frameNo; U[90] = this.scene; U[91] = this.amb; U[92] = this.mblur; U[93] = this.nsl + this.ndl; U[94] = this.quality; U[95] = this.reset;
    U[96] = jx; U[97] = jy; U[420] = this.flash; U[421] = this.proj[5]; U[422] = this.near; U[423] = this.far; U[424] = this.fog; U[425] = this.debug || 0;
    if (this.baseL) { const kd = this.keyDim === undefined ? 1 : this.keyDim; for (let i = 0; i < this.nsl; i++) { const o = 100 + i * 16, k = i < 4 ? kd : 1; U[o + 8] = this.baseL[i * 3] * k; U[o + 9] = this.baseL[i * 3 + 1] * k; U[o + 10] = this.baseL[i * 3 + 2] * k; } }
    // luzes dinamicas (pontuais)
    for (let i = 0; i < this.ndl; i++) { const o = 100 + (this.nsl + i) * 16, d = this.dl, k = i * 8; U[o] = d[k]; U[o + 1] = d[k + 1]; U[o + 2] = d[k + 2]; U[o + 3] = d[k + 3]; U[o + 4] = 0; U[o + 5] = -1; U[o + 6] = 0; U[o + 7] = -1; U[o + 8] = d[k + 4]; U[o + 9] = d[k + 5]; U[o + 10] = d[k + 6]; U[o + 11] = -1; U[o + 12] = -1; U[o + 13] = 1; U[o + 14] = 0; U[o + 15] = 0; }
    this.pvpNext = this.vp;
  },
  frame() {
    if (!this.ok || !this.T) return; const dev = this.dev, t = this.T, w = this.w, h = this.h, q = dev.queue, par = this.frameNo & 1;
    // jitter Halton(2,3)
    let n = (this.frameNo % 8) + 1, jx = 0, jy = 0, f = .5, k = n; while (k > 0) { jx += f * (k & 1); k >>= 1; f *= .5; } f = 1 / 3; k = n; while (k > 0) { jy += f * (k % 3); k = (k / 3) | 0; f /= 3; }
    jx = (jx - .5) * 2 / w; jy = (jy - .5) * 2 / h;
    M4.persp(this.proj, this.cp[0], w / h, this.near, this.far); M4.lookAt(this.view, this.eye[0], this.eye[1], this.eye[2], this.tgt[0], this.tgt[1], this.tgt[2], this.up[0], this.up[1], this.up[2]);
    this.fillFrame(w, h, this.eye, jx, jy, this.reset > 0);
    q.writeBuffer(this.ubo, 0, this.U); q.writeBuffer(this.ibuf, 0, this.I);
    if (this.nA > 0) q.writeBuffer(this.pbufA, 0, this.pA, 0, this.nA * 12); if (this.nB > 0) q.writeBuffer(this.pbufB, 0, this.pB, 0, this.nB * 12);
    const e = dev.createCommandEncoder(); let p;
    const ts = this.perf && this.hasTs && !this.tsBusy;
    if (this.nmk > 0) { q.writeBuffer(this.mbuf, 0, this.mk, 0, this.nmk * 8); p = e.beginRenderPass(this.dMark); p.setPipeline(this.pMark); p.setVertexBuffer(0, this.mbuf); p.draw(4, this.nmk); p.end(); this.nmk = 0; }
    // sombras
    e.copyTextureToTexture(this.cpShS || (this.cpShS = { texture: this.shStat }), this.cpShD || (this.cpShD = { texture: this.shDyn }), this.cpShZ || (this.cpShZ = [SH_RES, SH_RES, 4]));
    for (let s = 0; s < this.nsh; s++) { const d = this.dShadow[s]; if (ts && s === 0) d.timestampWrites = this.tsW0 || (this.tsW0 = { querySet: this.qs, beginningOfPassWriteIndex: 0 }); else if (d.timestampWrites) d.timestampWrites = undefined;
      p = e.beginRenderPass(d); p.setPipeline(this.pShadow); p.setBindGroup(0, this.bgScene); p.setBindGroup(1, this.bgSh[s]); p.setVertexBuffer(0, this.vb); p.setIndexBuffer(this.ib, 'uint32'); this.drawRange(p, 2, INST_MAX); p.end(); }
    // G-buffer
    p = e.beginRenderPass(t.dG); p.setPipeline(this.flatWorld ? this.pGF : this.pG); p.setBindGroup(0, this.bgScene); p.setVertexBuffer(0, this.vb); p.setIndexBuffer(this.ib, 'uint32'); this.drawRange(p, 0, 1); p.setPipeline(this.pG); this.drawRange(p, 2, SLOT.ROBOT); p.setPipeline(this.pGT); this.drawRange(p, SLOT.ROBOT, INST_MAX); p.end();
    // volumetrico
    p = e.beginRenderPass(t.dVol); if (this.fog > 0) { p.setPipeline(this.pVol); p.setBindGroup(0, t.bgVol); p.draw(3); } p.end();
    // iluminacao
    p = e.beginRenderPass(t.dLight); p.setPipeline(this.pLight); p.setBindGroup(0, t.bgLight[this.scene]); p.draw(3); p.end();
    // transparentes antes do TAA
    p = e.beginRenderPass(t.dFwd); p.setPipeline(this.pVolUp); p.setBindGroup(0, t.bgVolUp); p.draw(3);
    if (this.im[SLOT.GLASS] >= 0) { p.setPipeline(this.pGlass); p.setBindGroup(0, this.bgScene); p.setBindGroup(1, this.bgEnvG[this.scene]); p.setVertexBuffer(0, this.vb); p.setIndexBuffer(this.ib, 'uint32'); this.drawRange(p, 1, 2); }
    if (this.nA > 0) { p.setPipeline(this.pPartD); p.setBindGroup(0, t.bgPartD); p.setVertexBuffer(0, this.pbufA); p.draw(4, this.nA); }
    p.end();
    // TAA
    p = e.beginRenderPass(t.dTAA[par]); p.setPipeline(this.pTAA); p.setBindGroup(0, t.bgTAA[par]); p.draw(3); p.end();
    e.copyTextureToTexture(t.cpSrc[par], t.cpDst, t.cpSize);
    p = e.beginRenderPass(t.dPost); if (this.nB > 0) { p.setPipeline(this.pPart); p.setBindGroup(0, t.bgPart); p.setVertexBuffer(0, this.pbufB); p.draw(4, this.nB); } p.end();
    // bloom
    p = e.beginRenderPass(t.dBloom[0]); p.setPipeline(this.pB0); p.setBindGroup(0, t.bgB0); p.draw(3); p.end();
    for (let i = 1; i < 6; i++) { p = e.beginRenderPass(t.dBloom[i]); p.setPipeline(this.pBD); p.setBindGroup(0, t.bgBD[i - 1]); p.draw(3); p.end(); }
    for (let i = 4; i >= 0; i--) { p = e.beginRenderPass(t.dBloomU[i]); p.setPipeline(this.pBU); p.setBindGroup(0, t.bgBD[i + 1]); p.draw(3); p.end(); }
    // final
    this.dFinal.colorAttachments[0].view = this.capture ? this.capV : this.ctx.getCurrentTexture().createView();
    this.dFinal.timestampWrites = ts ? (this.tsW1 || (this.tsW1 = { querySet: this.qs, endOfPassWriteIndex: 1 })) : undefined;
    p = e.beginRenderPass(this.dFinal); p.setPipeline(this.pFinal); p.setBindGroup(0, t.bgFinal); p.draw(3); p.end();
    if (ts) { e.resolveQuerySet(this.qs, 0, 2, this.qres, 0); e.copyBufferToBuffer(this.qres, 0, this.qread, 0, 16); }
    q.submit([e.finish()]);
    if (ts) { this.tsBusy = true; this.qread.mapAsync(GPUMapMode.READ).then(() => { const v = new BigInt64Array(this.qread.getMappedRange()); this.gpuMs = Number(v[1] - v[0]) / 1e6; this.qread.unmap(); this.tsBusy = false; if (this.onGpuMs) this.onGpuMs(this.gpuMs); }); }
    // matrizes anteriores
    this.pvp.set(this.vp); const I = this.I; for (let i = 0; i < INST_MAX; i++) { if (this.im[i] < 0) continue; const o = i * INST_F; for (let j = 0; j < 16; j++) I[o + 16 + j] = I[o + j]; }
    this.frameNo++; this.reset = 0;
  },
  // modo de captura: renderiza fora da tela e copia os pixels para um canvas 2D (funciona sem swapchain)
  setCapture(cv2) { const dev = this.dev, T = GPUTextureUsage; this.capture = true; this.cv2 = cv2; cv2.width = this.w; cv2.height = this.h; this.c2 = cv2.getContext('2d');
    this.capTex = dev.createTexture({ size: [this.w, this.h], format: this.fmt, usage: T.RENDER_ATTACHMENT | T.COPY_SRC }); this.capV = this.capTex.createView();
    this.capBpr = Math.ceil(this.w * 4 / 256) * 256; this.capBuf = dev.createBuffer({ size: this.capBpr * this.h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); this.capImg = this.c2.createImageData(this.w, this.h); },
  async grab() { const dev = this.dev, e = dev.createCommandEncoder(); e.copyTextureToBuffer({ texture: this.capTex }, { buffer: this.capBuf, bytesPerRow: this.capBpr }, [this.w, this.h]); dev.queue.submit([e.finish()]);
    await this.capBuf.mapAsync(GPUMapMode.READ); const src = new Uint8Array(this.capBuf.getMappedRange()), dst = this.capImg.data, w = this.w, h = this.h, bgra = this.fmt === 'bgra8unorm';
    for (let y = 0; y < h; y++) { const so = y * this.capBpr, d0 = y * w * 4; if (!bgra) dst.set(src.subarray(so, so + w * 4), d0); else for (let x = 0; x < w * 4; x += 4) { dst[d0 + x] = src[so + x + 2]; dst[d0 + x + 1] = src[so + x + 1]; dst[d0 + x + 2] = src[so + x]; dst[d0 + x + 3] = 255; } }
    this.capBuf.unmap(); this.c2.putImageData(this.capImg, 0, 0); },
  flushMarks() { if (this.nmk <= 0) return; const dev = this.dev, e = dev.createCommandEncoder(); dev.queue.writeBuffer(this.mbuf, 0, this.mk, 0, this.nmk * 8); const p = e.beginRenderPass(this.dMark); p.setPipeline(this.pMark); p.setVertexBuffer(0, this.mbuf); p.draw(4, this.nmk); p.end(); this.nmk = 0; dev.queue.submit([e.finish()]); },
  snap(i) { const I = this.I, o = i * INST_F; for (let j = 0; j < 16; j++) I[o + 16 + j] = I[o + j]; },
  uploadAtlas(cv) { // canvas 2048x2048 -> textura + mips (so em eventos: inicio de luta, troca de pintura)
    const dev = this.dev; dev.queue.copyExternalImageToTexture({ source: cv }, { texture: this.atlas, mipLevel: 0 }, [2048, 2048]);
    const e = dev.createCommandEncoder();
    for (let m = 1; m < 8; m++) { const bg = dev.createBindGroup({ layout: this.pBlit.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.atlas.createView({ baseMipLevel: m - 1, mipLevelCount: 1 }) }, { binding: 1, resource: this.sLin }] }); const p = e.beginRenderPass({ colorAttachments: [{ view: this.atlas.createView({ baseMipLevel: m, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store' }] }); p.setPipeline(this.pBlit); p.setBindGroup(0, bg); p.draw(3); p.end(); }
    dev.queue.submit([e.finish()]);
  },
};
