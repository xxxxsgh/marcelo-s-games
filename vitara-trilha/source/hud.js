// hud.js — interface desenhada na GPU: atlas de glifos gerado com canvas 2D na carga; por quadro só aritmética inteira
const Hud = { MAX: 128, inst: null, n: 0, g: {}, words: {}, lastPause: -1, flash: 0 };
const WG_HUD = /* wgsl */`
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
struct HV { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) r: vec4f, @location(1) uvr: vec4f, @location(2) col: vec4f) -> HV {
  var o: HV; let c = vec2f(f32((0x2Cu >> vi) & 1u), f32((0x1Au >> vi) & 1u)); let p = r.xy + c * r.zw;
  o.pos = vec4f(p.x / 960.0 - 1.0, 1.0 - p.y / 540.0, 0.0, 1.0); o.uv = mix(uvr.xy, uvr.zw, c); o.col = col; return o;
}
@fragment fn fs(v: HV) -> @location(0) vec4f { let a = textureSample(t, s, v.uv).r; return vec4f(v.col.rgb, v.col.a * a); }
`;
function hudInit() {
  const dev = GPU.dev, AW = 1024, AH = 512, c = document.createElement('canvas'); c.width = AW; c.height = AH; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, AW, AH); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.fillRect(1000, 488, 20, 20); Hud.solid = [1004 / AW, 492 / AH, 1016 / AW, 504 / AH];
  // dígitos de largura fixa (itálico condensado)
  g.font = 'italic 700 84px "DIN Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  const chars = '0123456789:.-/'; let x = 4;
  for (const ch of chars) { const w = ch === ':' || ch === '.' ? 26 : 50; g.fillText(ch, x + (w - g.measureText(ch).width) / 2, 92); Hud.g[ch.charCodeAt(0)] = [x / AW, 16 / AH, (x + w) / AW, 108 / AH, w, 92]; x += w + 6; }
  g.font = '700 34px "Arial Narrow", "Roboto Condensed", Arial, sans-serif'; if (g.letterSpacing !== undefined) g.letterSpacing = '3px';
  let wx = 4, wy = 160;
  for (const w of ['VOLTA', 'MELHOR', 'ANTERIOR', 'KM/H', 'CHECKPOINT', 'VOLTA COMPLETA', 'NOVO RECORDE', 'DE VOLTA À TRILHA', 'FORA DA TRILHA', 'CÂMERA: PERSEGUIÇÃO', 'CÂMERA: CAPÔ', 'CÂMERA: BEIRA DA TRILHA', 'RÉ', 'GAMEPAD CONECTADO', 'LARGADA']) {
    const tw = Math.ceil(g.measureText(w).width) + 6; if (wx + tw > AW - 30) { wx = 4; wy += 50; }
    g.fillText(w, wx + 2, wy); Hud.words[w] = [wx / AW, (wy - 34) / AH, (wx + tw) / AW, (wy + 10) / AH, tw, 44]; wx += tw + 10; }
  const d = g.getImageData(0, 0, AW, AH).data, out = new Uint8Array(AW * AH * 4); out.set(d);
  Hud.tex = texFromData(AW, AH, 'rgba8unorm', out, 4, { mips: 4 }); genMips(Hud.tex, 'rgba8unorm', 1, 4);
  const l = mkBGL(['t', 's']); Hud.bg = mkBG(l, [Hud.tex.createView(), R.sClamp]);
  Hud.pipe = mkPipe({ label: 'hud', code: WG_HUD, layouts: [l], targets: [{ format: GPU.fmt, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }],
    buffers: [{ arrayStride: 48, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x4' }, { shaderLocation: 1, offset: 16, format: 'float32x4' }, { shaderLocation: 2, offset: 32, format: 'float32x4' }] }] });
  Hud.inst = new Float32Array(Hud.MAX * 12); Hud.buf = dev.createBuffer({ size: Hud.MAX * 48, usage: 0x20 | 8 });
  Hud.pauseEl = document.getElementById('pause');
  R.hudDraw = hudDraw; Hud.off = QS.has('nohud');
}
function _hq(x, y, w, h, uv, r, g, b, a) { if (Hud.n >= Hud.MAX) return; const o = Hud.n++ * 12, f = Hud.inst; f[o] = x; f[o + 1] = y; f[o + 2] = w; f[o + 3] = h; f[o + 4] = uv[0]; f[o + 5] = uv[1]; f[o + 6] = uv[2]; f[o + 7] = uv[3]; f[o + 8] = r; f[o + 9] = g; f[o + 10] = b; f[o + 11] = a; }
function _hword(name, x, y, sc, r, g, b, a) { const w = Hud.words[name]; _hq(x, y, w[4] * sc, w[5] * sc, w, r, g, b, a); return w[4] * sc; }
function _hch(code, x, y, sc, r, g, b, a) { const c = Hud.g[code]; _hq(x, y, c[4] * sc, c[5] * sc, c, r, g, b, a); return (c[4] + 2) * sc; }
function _hnum(v, digits, x, y, sc, r, g, b, a) { let div = 1; for (let i = 1; i < digits; i++) div *= 10; for (let i = 0; i < digits; i++) { x += _hch(48 + (Math.floor(v / div) % 10), x, y, sc, r, g, b, a); div /= 10; } return x; }
function _htime(ms, x, y, sc, r, g, b, a) { // m:ss.mmm
  if (ms < 0) { for (let i = 0; i < 3; i++) x += _hch(45, x, y, sc, r, g, b, a * 0.6); return x; }
  const t = Math.floor(ms), m = Math.floor(t / 60000), s = Math.floor(t / 1000) % 60, mm = t % 1000;
  x = _hnum(m % 10, 1, x, y, sc, r, g, b, a); x += _hch(58, x, y, sc, r, g, b, a); x = _hnum(s, 2, x, y, sc, r, g, b, a); x += _hch(46, x, y, sc, r, g, b, a); return _hnum(mm, 3, x, y, sc * 0.78, r, g, b, a);
}
function hudUpdate(dt) {
  Hud.n = 0; if (typeof Game === 'undefined' || Hud.off) return;
  const G = Game, S0 = Hud.solid;
  if (G.paused !== Hud.lastPause) { Hud.lastPause = G.paused; if (Hud.pauseEl) Hud.pauseEl.style.display = G.paused ? 'flex' : 'none'; }
  // painel de tempos (alto à esquerda)
  _hq(36, 30, 372, 150, S0, 0.02, 0.025, 0.03, 0.42); _hq(36, 30, 5, 150, S0, 1.0, 0.55, 0.12, 0.95);
  _hword('VOLTA', 58, 42, 0.62, 1, 1, 1, 0.75); _htime(G.lapActive ? G.timeMs : 0, 56, 62, 0.72, 1, 1, 1, 1);
  _hword('MELHOR', 58, 134, 0.5, 1, 0.72, 0.35, 0.9); _htime(G.bestMs, 150, 126, 0.34, 1, 0.82, 0.55, 1);
  _hword('ANTERIOR', 58, 158, 0.42, 1, 1, 1, 0.55); _htime(G.lastMs, 150, 152, 0.27, 1, 1, 1, 0.75);
  // checkpoints (pontos)
  for (let i = 0; i < G.nCp; i++) { const done = G.lapActive && ((i < G.cp) || (G.cp === 0 && false)); _hq(58 + i * 26, 192, 18, 6, S0, done ? 1.0 : 1, done ? 0.55 : 1, done ? 0.12 : 1, done ? 1 : 0.35); }
  // velocímetro (baixo à direita)
  const kmh = Math.min(999, Math.round(Math.abs(G.speedKmh))); _hq(1620, 936, 264, 112, S0, 0.02, 0.025, 0.03, 0.42); _hq(1879, 936, 5, 112, S0, 1.0, 0.55, 0.12, 0.95);
  let x = 1640; if (kmh < 100) x += 52; if (kmh < 10) x += 52; _hnum(kmh, kmh >= 100 ? 3 : kmh >= 10 ? 2 : 1, x, 942, 1.0, 1, 1, 1, 1); _hword('KM/H', 1800, 1004, 0.62, 1, 1, 1, 0.75);
  if (typeof Physics !== 'undefined' && Physics.reverse) _hword('RÉ', 1800, 956, 0.7, 1, 0.4, 0.3, 1);
  // mensagens
  if (G.msg > 0 && G.msgT > 0) { const nm = G.msg === 1 ? 'CHECKPOINT' : G.msg === 2 ? 'VOLTA COMPLETA' : G.msg === 3 ? 'NOVO RECORDE' : G.msg === 4 ? 'DE VOLTA À TRILHA' : 'FORA DA TRILHA', w = Hud.words[nm], sc = 1.25, a = Math.min(1, G.msgT * 3);
    _hq(960 - w[4] * sc / 2 - 24, 96, w[4] * sc + 48, 70, S0, 0.02, 0.025, 0.03, 0.45 * a); _hword(nm, 960 - w[4] * sc / 2, 104, sc, 1, G.msg === 5 ? 0.45 : 0.85, G.msg === 3 ? 0.3 : G.msg === 5 ? 0.3 : 0.6, a);
    if (G.msg === 2 || G.msg === 3) _htime(G.lastMs, 960 - 120, 172, 0.5, 1, 1, 1, a); }
  else if (!G.lapActive && G.laps === 0) { const w = Hud.words.LARGADA; _hword('LARGADA', 960 - w[4] * 0.5, 104, 1.0, 1, 1, 1, 0.8); }
}
function hudDraw(p) { if (Hud.n === 0) return; GPU.dev.queue.writeBuffer(Hud.buf, 0, Hud.inst, 0, Hud.n * 12); p.setPipeline(Hud.pipe); p.setBindGroup(0, Hud.bg); p.setVertexBuffer(0, Hud.buf); p.draw(6, Hud.n); }
