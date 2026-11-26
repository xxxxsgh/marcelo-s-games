// ---------- som procedural (Web Audio): tudo sintetizado, nenhum arquivo ----------
// As vozes sao criadas uma unica vez e ficam tocando; durante a luta so se mexe em AudioParams (sem alocar).
const AU = {
  ctx: null, on: false, vol: .6, eng: null, wpn: null, hits: [], nh: 0, crowd: null, ui: null, cheer: 0,
  init() { // precisa de um gesto do usuario (tecla ou clique)
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let c; try { c = this.ctx = new AC(); } catch (e) { return; }
    const master = c.createGain(); master.gain.value = this.vol; const comp = c.createDynamicsCompressor(); master.connect(comp); comp.connect(c.destination); this.master = master;
    // ruido branco em laco (base de impactos, plateia e faiscas)
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
    const noise = () => { const n = c.createBufferSource(); n.buffer = nb; n.loop = true; n.start(); return n; };
    const voice = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); g.gain.value = 0; o.connect(g); g.connect(master); o.start(); return { o, g }; };
    // motores dos dois robos e gemido das armas
    this.eng = [0, 1].map(i => { const v = voice('sawtooth', 50 + i * 7), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; v.o.disconnect(); v.o.connect(lp); lp.connect(v.g); return v; });
    this.wpn = [0, 1].map(i => voice('triangle', 120));
    // impactos: 4 vozes de ruido filtrado + 1 pancada grave
    for (let i = 0; i < 4; i++) { const n = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + i * 900; bp.Q.value = .8; const g = c.createGain(); g.gain.value = 0; n.connect(bp); bp.connect(g); g.connect(master); this.hits.push({ g, bp }); }
    this.thump = voice('sine', 60);
    // plateia: ruido com passa-faixa lento
    { const n = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = .5; const g = c.createGain(); g.gain.value = 0; n.connect(bp); bp.connect(g); g.connect(master); this.crowd = { g, bp }; }
    this.ui = voice('square', 440); this.on = true;
  },
  hitR() { if (!this.on) return; const dmg = _k[11], c = this.ctx, t = c.currentTime, v = this.hits[this.nh], a = Math.min(1, .15 + dmg / 45); this.nh = (this.nh + 1) & 3;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(a, t); v.g.gain.exponentialRampToValueAtTime(.001, t + .12 + a * .25);
    const th = this.thump; th.o.frequency.cancelScheduledValues(t); th.o.frequency.setValueAtTime(110, t); th.o.frequency.exponentialRampToValueAtTime(38, t + .18); th.g.gain.cancelScheduledValues(t); th.g.gain.setValueAtTime(a * .9, t); th.g.gain.exponentialRampToValueAtTime(.001, t + .3);
    if (dmg > 14) this.cheer = Math.min(1, this.cheer + dmg / 60); },
  blip(f) { if (!this.on) return; const t = this.ctx.currentTime, u = this.ui; u.o.frequency.setValueAtTime(f, t); u.g.gain.cancelScheduledValues(t); u.g.gain.setValueAtTime(.08, t); u.g.gain.exponentialRampToValueAtTime(.001, t + .07); },
  // chamado a cada quadro da luta: so ajusta parametros
  update(S, ativo) { if (!this.on || (S.frame % 6)) return; const t = this.ctx.currentTime; // a 10 Hz: as chamadas da API de audio recebem numeros e o navegador os encaixota
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s, sp = Math.sqrt(s[7] * s[7] + s[9] * s[9]), k = ARMAS[B.b[3]], e = this.eng[i], w = this.wpn[i], a = ativo && !B.dead ? 1 : 0;
      e.o.frequency.setTargetAtTime(46 + sp * 26 + Math.abs(B.thr) * 30, t, .05); e.g.gain.setTargetAtTime(a * (.035 + Math.abs(B.thr) * .05), t, .08);
      const fr = k.spin ? B.wspin / k.wmax : 0; w.o.frequency.setTargetAtTime(90 + fr * 620, t, .05); w.g.gain.setTargetAtTime(a * fr * .06, t, .08); }
    this.cheer *= .985; this.crowd.g.gain.setTargetAtTime(ativo ? .035 + this.cheer * .16 : .012, t, .2); this.crowd.bp.frequency.setTargetAtTime(600 + this.cheer * 900, t, .3); },
  calar() { if (!this.on) return; const t = this.ctx.currentTime; for (let i = 0; i < 2; i++) { this.eng[i].g.gain.setTargetAtTime(0, t, .1); this.wpn[i].g.gain.setTargetAtTime(0, t, .1); } this.crowd.g.gain.setTargetAtTime(.01, t, .3); },
};
