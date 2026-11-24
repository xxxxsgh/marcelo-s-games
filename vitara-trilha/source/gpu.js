// gpu.js — inicialização do WebGPU e utilitários de criação de recursos (só usados na carga)
const GPU = { dev: null, ctx: null, fmt: 'bgra8unorm', W: 1920, H: 1080, hasTS: false, canvas: null };
const TU = 0x04 /*TEXTURE_BINDING*/, RA = 0x10 /*RENDER_ATTACHMENT*/, CD = 0x02 /*COPY_DST*/, CS = 0x01;

async function gpuInit(canvas) {
  if (!navigator.gpu) throw new Error('Este navegador não tem WebGPU.');
  const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) throw new Error('Nenhum adaptador WebGPU disponível.');
  GPU.hasTS = ad.features.has('timestamp-query');
  const dev = await ad.requestDevice({ requiredFeatures: GPU.hasTS ? ['timestamp-query'] : [] });
  GPU.dev = dev; GPU.canvas = canvas; GPU.ctx = canvas.getContext('webgpu'); GPU.fmt = navigator.gpu.getPreferredCanvasFormat();
  GPU.off = new URLSearchParams(location.search).has('offscreen');
  if (GPU.off) GPU.fmt = 'rgba8unorm'; else GPU.ctx.configure({ device: dev, format: GPU.fmt, alphaMode: 'opaque' });
  GPU.W = canvas.width; GPU.H = canvas.height;
  dev.addEventListener('uncapturederror', (e) => { console.error('GPU: ' + e.error.message); GPU.err = (GPU.err || 0) + 1; });
  return dev;
}
function mkTex(w, h, format, usage, opt) {
  opt = opt || {};
  return GPU.dev.createTexture({ size: [w, h, opt.layers || 1], format, usage, mipLevelCount: opt.mips || 1, dimension: opt.dim || '2d', label: opt.label });
}
function mipCount(w, h) { return 1 + Math.floor(Math.log2(Math.max(w, h))); }
function texFromData(w, h, format, data, bpp, opt) {
  opt = opt || {};
  const t = mkTex(w, h, format, TU | CD | (opt.mips ? RA : 0), opt);
  GPU.dev.queue.writeTexture({ texture: t }, data, { bytesPerRow: w * bpp, rowsPerImage: h }, [w, h, opt.layers || 1]);
  return t;
}
function mkBuf(data, usage) {
  const b = GPU.dev.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | 8 /*COPY_DST*/, mappedAtCreation: true });
  new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)); b.unmap(); return b;
}
// layout compacto: 'u' uniforme, 's' sampler, 'sc' sampler de comparação, 'sn' sampler sem filtro,
// 't' 2d float, 'tu' 2d float não filtrável, 'ta' array 2d, 't3' 3d, 'td' profundidade, 'tda' array de profundidade
function mkBGL(spec) {
  const entries = spec.map((k, i) => {
    const e = { binding: i, visibility: (k === 'st') ? 4 : 7 };
    if (k === 'u') e.buffer = { type: 'uniform' };
    else if (k === 's') e.sampler = { type: 'filtering' };
    else if (k === 'sc') e.sampler = { type: 'comparison' };
    else if (k === 'sn') e.sampler = { type: 'non-filtering' };
    else if (k === 't') e.texture = { sampleType: 'float' };
    else if (k === 'tu') e.texture = { sampleType: 'unfilterable-float' };
    else if (k === 'ta') e.texture = { sampleType: 'float', viewDimension: '2d-array' };
    else if (k === 't3') e.texture = { sampleType: 'float', viewDimension: '3d' };
    else if (k === 'td') e.texture = { sampleType: 'depth' };
    else if (k === 'st') e.buffer = { type: 'storage' };
    else if (k === 'sr') { e.buffer = { type: 'read-only-storage' }; e.visibility = 1; }
    else if (k === 'tda') e.texture = { sampleType: 'depth', viewDimension: '2d-array' };
    return e;
  });
  return GPU.dev.createBindGroupLayout({ entries });
}
function mkBG(layout, res) {
  return GPU.dev.createBindGroup({ layout, entries: res.map((r, i) => ({ binding: i, resource: (r instanceof GPUBuffer) ? { buffer: r } : r })) });
}
const _modCache = new Map();
function mkModule(code, label) {
  let m = _modCache.get(code); if (m) return m;
  m = GPU.dev.createShaderModule({ code, label }); _modCache.set(code, m);
  m.getCompilationInfo().then((info) => { for (const msg of info.messages) if (msg.type === 'error') console.error('WGSL [' + label + '] ' + msg.lineNum + ':' + msg.linePos + ' ' + msg.message + '\n  > ' + (code.split('\n')[msg.lineNum - 1] || '')); });
  return m;
}
// o: {label, code, layouts[], targets[], depth:{format,write,compare,bias?}, buffers[], cull, topology, vs, fs}
function mkPipe(o) {
  const mod = mkModule(o.code, o.label);
  const d = {
    label: o.label, layout: GPU.dev.createPipelineLayout({ bindGroupLayouts: o.layouts }),
    vertex: { module: mod, entryPoint: o.vs || 'vs', buffers: o.buffers || [] },
    primitive: { topology: o.topology || 'triangle-list', cullMode: o.cull || 'none', frontFace: 'ccw' },
  };
  if (o.targets) d.fragment = { module: mod, entryPoint: o.fs || 'fs', targets: o.targets };
  if (o.depth) d.depthStencil = { format: o.depth.format || 'depth32float', depthWriteEnabled: !!o.depth.write, depthCompare: o.depth.compare || 'greater', depthBias: o.depth.bias || 0, depthBiasSlopeScale: o.depth.slope || 0 };
  return GPU.dev.createRenderPipeline(d);
}
const FS_TRI = `
struct FsV { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) inst: u32 };
@vertex fn vs(@builtin(vertex_index) i: u32, @builtin(instance_index) ii: u32) -> FsV {
  var o: FsV; let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0); o.uv = vec2f(p.x, 1.0 - p.y); o.inst = ii; return o; }
`;
// geração de mips por blit (linear), para texturas 2d e arrays
const _mipPipes = new Map();
function genMips(tex, format, layers, mips, w) {
  const dev = GPU.dev; let P = _mipPipes.get(format);
  if (!P) {
    const l = mkBGL(['t', 's']);
    P = { l, p: mkPipe({ label: 'mip', code: FS_TRI + `@group(0) @binding(0) var t: texture_2d<f32>; @group(0) @binding(1) var s: sampler;
      @fragment fn fs(i: FsV) -> @location(0) vec4f { return textureSampleLevel(t, s, i.uv, 0.0); }`, layouts: [l], targets: [{ format }] }), s: dev.createSampler({ minFilter: 'linear', magFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' }) };
    _mipPipes.set(format, P);
  }
  const enc = dev.createCommandEncoder();
  for (let L = 0; L < layers; L++) for (let m = 1; m < mips; m++) {
    const src = tex.createView({ dimension: '2d', baseArrayLayer: L, arrayLayerCount: 1, baseMipLevel: m - 1, mipLevelCount: 1 });
    const dst = tex.createView({ dimension: '2d', baseArrayLayer: L, arrayLayerCount: 1, baseMipLevel: m, mipLevelCount: 1 });
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: dst, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(P.p); pass.setBindGroup(0, mkBG(P.l, [src, P.s])); pass.draw(3); pass.end();
  }
  dev.queue.submit([enc.finish()]);
}
