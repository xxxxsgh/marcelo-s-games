// ---------- inicializacao, laco principal e ganchos de teste ----------
const QS = new URLSearchParams(location.search), MBG = new MB();
const CR = window.CR = { G, GAR, SIM, BG, R, IN, UI, FX, Atlas, MESH, DRAW, statsOf, layoutOf, CHASSIS, RODAS, BLIND, ARMAS, PESO_MAX, pronto: false, erro: '',
  get TOR() { return TOR; },
  // avanca n quadros de 1/60 s sem desenhar na GPU
  advance(n) { for (let i = 0; i < n; i++) G.tick(DT); },
  // avanca 1 quadro e desenha; devolve promise quando os pixels estao no canvas
  async frame(n) { for (let i = 0; i < (n || 1); i++) { G.tick(DT); R.time += DT; Atlas.flush(); R.frame(); } if (R.capture) await R.grab(); else await R.dev.queue.onSubmittedWorkDone(); return R.lastError || 'ok'; },
  // luta avulsa (roteirizada ou automatica): montagens e semente fixas
  duel(ba, bb, seed, dur, opts) { opts = opts || {}; G.round = opts.round || 'LUTA ROTEIRIZADA'; G.auto = !!opts.auto; G.curMatch = null; const ea = { nome: opts.na || 'Fagulha', b: ba, cor: CORES[opts.ca === undefined ? 0 : opts.ca], num: 7, estilo: opts.ea === undefined ? 0 : opts.ea, hp: null, v: 0, d: 0 }, eb = { nome: opts.nb || 'Vespa 9', b: bb, cor: CORES[opts.cb === undefined ? 2 : opts.cb], num: 9, estilo: opts.eb === undefined ? 2 : opts.eb, hp: null, v: 0, d: 0 };
    G.setupFight(0, 1, seed, dur, ea, eb); G.script = opts.script || null; G.rec = opts.rec ? new Int8Array(opts.rec * 3) : null; G.startFight(); },
  roteiro() { const d = atob(ROTEIRO.dados), a = new Int8Array(d.length); for (let i = 0; i < d.length; i++) a[i] = (d.charCodeAt(i) << 24) >> 24; this.duel(ROTEIRO.a, ROTEIRO.b, ROTEIRO.seed, LUTA_T, { script: a, ea: 0, eb: ROTEIRO.eb, nb: ROTEIRO.nb, cb: ROTEIRO.cb }); },
  // medicao de desempenho: tempos de quadro (rAF) e de GPU (timestamp-query)
  perfStart(n) { this.pf = new Float32Array(n); this.pg = new Float32Array(n); this.npg = 0; G.frameLog = this.pf; G.nlog = 0; R.perf = true; R.onGpuMs = v => { if (this.npg < n) this.pg[this.npg++] = v; }; },
  perfEnd() { const st = a => { const v = Array.from(a).sort((x, y) => x - y), n = v.length; if (!n) return null; return { n, media: v.reduce((s, x) => s + x, 0) / n, p50: v[n >> 1], p99: v[Math.min(n - 1, Math.floor(n * .99))], max: v[n - 1], acima16_7: v.filter(x => x > 16.7).length }; }; return { quadro: st(this.pf.subarray(1, G.nlog)), gpu: st(this.pg.subarray(0, this.npg)), adaptador: R.adapterInfo ? (R.adapterInfo.vendor + ' ' + R.adapterInfo.architecture + ' ' + (R.adapterInfo.description || '')) : '', res: R.w + 'x' + R.h, timestampQuery: R.hasTs }; },
  // conta pixels do robo na bancada (diferenca contra a bancada vazia)
  async visPixels(hide) { if (hide) DRAW.hide(SLOT.ROBOT); const keep = hide; G.tick(DT); if (keep) DRAW.hide(SLOT.ROBOT); R.frame(); G.tick(DT); if (keep) DRAW.hide(SLOT.ROBOT); R.frame(); await R.grab(); const d = R.capImg.data; if (hide) { this.base = new Uint8ClampedArray(d); return 0; } let n = 0; const b = this.base; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - b[i]) + Math.abs(d[i + 1] - b[i + 1]) + Math.abs(d[i + 2] - b[i + 2]) > 36) n++; return n; },
  // verificacao geometrica de uma montagem: pecas apoiadas, sem flutuar e sem atravessar o chassi
  checkBuild(b) {
    const c = CHASSIS[b[0]], w = RODAS[b[1]], L = layoutOf(b), P = MBG.p, IX = MBG.i, err = [];
    const verts = (name, f) => { const m = MESH[name], seen = new Set(); for (let k = m.first; k < m.first + m.count; k++) { const v = IX[k]; if (seen.has(v)) continue; seen.add(v); f(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); } };
    const bb = (name, tx, ty, tz, rot) => { const o = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; verts(name, (x, y, z) => { if (rot) { const c_ = Math.cos(rot), s_ = Math.sin(rot), nx = x * c_ - y * s_, ny = x * s_ + y * c_; x = nx; y = ny; } x += tx; y += ty; z += tz; o[0] = Math.min(o[0], x); o[1] = Math.min(o[1], y); o[2] = Math.min(o[2], z); o[3] = Math.max(o[3], x); o[4] = Math.max(o[4], y); o[5] = Math.max(o[5], z); }); return o; };
    const gap = (A, B) => Math.max(A[0] - B[3], B[0] - A[3], A[1] - B[4], B[1] - A[4], A[2] - B[5], B[2] - A[5]);
    const inside = (x, y, z, sh) => { if (Math.abs(z) > c.W / 2 - sh) return false; const p = c.prof; let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins; } if (!ins) return false; // distancia minima as arestas
      let dmin = 1e9; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const ex = p[i][0] - p[j][0], ey = p[i][1] - p[j][1], t = clamp(((x - p[j][0]) * ex + (y - p[j][1]) * ey) / (ex * ex + ey * ey), 0, 1); dmin = Math.min(dmin, Math.hypot(x - p[j][0] - ex * t, y - p[j][1] - ey * t)); } return dmin > sh; };
    const ch = bb('ch' + b[0], 0, 0, 0); let low = 1e9;
    // rodas
    const wn = 'wh' + b[1];
    for (let q = 0; q < (w.n === 2 ? 2 : 4); q++) { const zs = (w.n === 2 ? q : (q & 1)) ? 1 : -1, x = w.n === 2 ? (L.wx0 + L.wx1) / 2 : (q < 2 ? L.wx0 : L.wx1); const B0 = bb(wn, 0, 0, 0); const B = [x + B0[0], AXLE_Y + B0[1], zs > 0 ? L.wz + B0[2] : -L.wz - B0[5], x + B0[3], AXLE_Y + B0[4], zs > 0 ? L.wz + B0[5] : -L.wz - B0[2]];
      low = Math.min(low, B[1]); if (gap(B, ch) > .006) err.push('roda ' + q + ' flutuando ' + gap(B, ch).toFixed(3)); const inner = zs > 0 ? L.wz - w.w / 2 : -(L.wz - w.w / 2); if (Math.abs(inner) < c.W / 2 + BLIND[b[2]].t) err.push('roda ' + q + ' atravessa a lateral'); }
    if (Math.abs(low + L.clear) > .005) err.push('rodas nao tocam o piso: ' + (low + L.clear).toFixed(3));
    if (ch[1] < -1e-4) err.push('chassi abaixo do fundo');
    // blindagem
    let top = ch;
    for (let p = 0; p < 5; p++) { const n = `ar${b[0]}_${b[2]}_${p}`, B = bb(n, 0, 0, 0); if (gap(B, ch) > .006) err.push('blindagem ' + p + ' flutuando ' + gap(B, ch).toFixed(3)); if (B[1] < -.001) err.push('blindagem ' + p + ' abaixo do chassi'); let bad = 0; verts(n, (x, y, z) => { if (inside(x, y, z, .012)) bad++; }); if (bad) err.push('blindagem ' + p + ' atravessa o chassi (' + bad + ' vertices)'); if (p === 4) top = B; }
    // arma: base apoiada no teto, parte movel ligada a base, nada dentro do chassi nem abaixo do piso
    const wb = bb(`wb${b[0]}_${b[3]}`, 0, 0, 0), rest = b[3] === 4 ? 1.95 : b[3] === 5 ? .75 : 0, wm = bb(`wm${b[0]}_${b[3]}`, L.px, L.py, 0, b[3] >= 3 ? rest : 0);
    if (gap(wb, top) > .006) err.push('base da arma flutuando ' + gap(wb, top).toFixed(3)); if (gap(wm, wb) > .02) err.push('arma solta da base ' + gap(wm, wb).toFixed(3));
    if (Math.min(wb[1], wm[1]) < -L.clear + .002) err.push('arma atravessa o piso ' + (Math.min(wb[1], wm[1]) + L.clear).toFixed(3));
    let bad = 0; verts(`wb${b[0]}_${b[3]}`, (x, y, z) => { if (inside(x, y, z, .012)) bad++; }); if (bad) err.push('base da arma atravessa o chassi (' + bad + ')');
    for (const ang of b[3] === 3 ? [0, 1.15] : b[3] === 4 ? [1.95, -.3] : b[3] === 5 ? [.75, 0] : [0]) { bad = 0; const c_ = Math.cos(ang), s_ = Math.sin(ang); verts(`wm${b[0]}_${b[3]}`, (x, y, z) => { let X = x, Y = y, Z = z; if (b[3] === 0) { } else if (b[3] >= 3) { X = x * c_ - y * s_; Y = x * s_ + y * c_; } if (inside(X + L.px, Y + L.py, Z, .012)) bad++; }); if (bad) err.push('arma atravessa o chassi (' + bad + ' vertices, angulo ' + ang + ')'); }
    return err;
  },
};
async function boot() {
  UI.build(); IN.init(); Atlas.init();
  buildRobotMeshes(MBG); buildWorldMeshes(MBG); Object.assign(MESH, MBG.meshes);
  const cv = $('cv'); await R.init(cv, MBG);
  const fit = () => { let w = +QS.get('w') || Math.round(innerWidth * Math.min(devicePixelRatio || 1, 2)), h = +QS.get('h') || Math.round(innerHeight * Math.min(devicePixelRatio || 1, 2)); const k = Math.min(1, 1920 / w, 1080 / h) * (+QS.get('rs') || 1); w = Math.max(320, Math.round(w * k / 2) * 2); h = Math.max(180, Math.round(h * k / 2) * 2); R.resize(w, h); };
  fit(); if (!QS.get('cap')) addEventListener('resize', fit);
  if (QS.get('cap')) { const c2 = document.createElement('canvas'); c2.id = 'cv2'; cv.after(c2); R.setCapture(c2); }
  if (QS.get('q') === '0') R.quality = 0;
  R.perf = !!QS.get('perf'); Atlas.flush();
  G.load(); GAR.pre = GAR.com.slice();
  if (TOR && TOR.ativo && TOR.lutas > 0 && TOR.vivo) GAR.enter(true); else if (TOR && TOR.ativo && TOR.lutas === 0) { GAR.enter(false); } else { if (TOR && !TOR.ativo) TOR = null; GAR.enter(false); }
  $('carga').remove(); CR.pronto = true; document.title = 'Copa Rebite';
  if (QS.get('roteiro')) CR.roteiro();
  if (QS.get('cap')) return;
  let last = performance.now();
  const loop = now => { requestAnimationFrame(loop); let dt = (now - last) / 1000; last = now; if (G.frameLog && G.nlog < G.frameLog.length) G.frameLog[G.nlog++] = dt * 1000; if (dt > .1) dt = .1;
    // passo fixo de simulacao (1/60 s); em telas de 60 Hz e exatamente 1 passo por quadro
    G.acc += dt; let n = Math.abs(dt - DT) < .004 ? 1 : Math.floor(G.acc / DT); if (n > 3) n = 3; if (n < 1 && G.st !== 'luta' && G.st !== 'fim') n = 1; G.acc = Math.max(0, Math.min(G.acc - n * DT, DT));
    for (let i = 0; i < n; i++) G.tick(DT); R.time += dt; Atlas.flush(); if (!G.skipRender) R.frame(); };
  requestAnimationFrame(loop);
}
boot().catch(e => { console.error(e); CR.erro = String(e && e.message || e); UI.fatal('Não foi possível iniciar: ' + CR.erro + ' — este jogo precisa de um navegador com WebGPU (Chrome atualizado).'); });
