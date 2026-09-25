// Todo o som e sintetizado: caixinha de musica generativa, pad de fundo,
// sinos das estrelas, vozes em "blip", passos, vento.

const SCALES = {
  major: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
  minor: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22],
  lydian: [0, 2, 4, 6, 7, 11, 12, 14, 16, 18],
  dorian: [0, 2, 3, 7, 9, 12, 14, 15, 19, 21],
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.mood = { root: 62, scale: 'major', tempo: 76, density: 0.55, pad: 0.5, wind: 0 };
    this.vol = { master: 0.8, music: 0.7, sfx: 0.9 };
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    // reverb de sala grande (resposta ao impulso gerada)
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.55;
    this.verbIn.connect(this.verb).connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.startPad();
    this.startWind();
    this.nextBeat = ctx.currentTime + 0.3;
    this.beat = 0;
    this.phrase = [];
    setInterval(() => this.schedule(), 60);
  }

  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  makeNoise() {
    const ctx = this.ctx, n = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  setMood(m) {
    Object.assign(this.mood, m);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.padGain && this.padGain.gain.setTargetAtTime(0.05 * this.mood.pad, t, 2);
    this.windGain && this.windGain.gain.setTargetAtTime(0.05 * (this.mood.wind || 0), t, 1.5);
    this.chordAt = 0;
  }

  setVolume(k, v) {
    this.vol[k] = v;
    if (!this.ctx) return;
    const node = k === 'master' ? this.master : k === 'music' ? this.music : this.sfx;
    node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // ---------------------------------------------------------------- musica
  startPad() {
    const ctx = this.ctx;
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.05 * this.mood.pad;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 350;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    this.padGain.connect(lp); lp.connect(this.music); lp.connect(this.verbIn);
    this.padOsc = [];
    for (let i = 0; i < 4; i++) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.detune.value = det;
        o.frequency.value = 220;
        o.connect(this.padGain); o.start();
        this.padOsc.push(o);
      }
    }
    this.chordAt = 0;
    this.chordIdx = 0;
  }

  setChord() {
    const s = SCALES[this.mood.scale];
    const progs = [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]];
    const deg = progs[this.chordIdx++ % progs.length];
    const notes = [this.mood.root - 12 + s[deg[0]], this.mood.root - 12 + s[deg[1]], this.mood.root - 12 + s[deg[2]], this.mood.root - 24 + s[deg[0]]];
    const t = this.ctx.currentTime;
    this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime(mtof(notes[Math.floor(i / 2)]), t, 1.2));
    this.curChord = deg;
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const spb = 60 / this.mood.tempo / 2; // colcheias
    while (this.nextBeat < ctx.currentTime + 0.2) {
      if (this.beat % 32 === 0) this.setChord();
      this.musicBeat(this.nextBeat, this.beat);
      this.nextBeat += spb * (this.beat % 2 ? 0.92 : 1.08); // balanco leve
      this.beat++;
    }
  }

  musicBeat(t, b) {
    if (this.mood.silent) return;
    const s = SCALES[this.mood.scale];
    const dens = this.mood.density;
    const strong = b % 4 === 0;
    const chord = this.curChord || [0, 2, 4];
    // melodia: passeio aleatorio preferindo notas do acorde
    if (Math.random() < (strong ? dens + 0.25 : dens * 0.55)) {
      this.mel = this.mel ?? 4;
      this.mel += Math.round((Math.random() - 0.5) * 3.2);
      this.mel = Math.max(0, Math.min(s.length - 1, this.mel));
      if (strong && Math.random() < 0.6) this.mel = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.5 ? 0 : 5) % s.length;
      const idx = Math.min(this.mel, s.length - 1);
      this.box(mtof(this.mood.root + 12 + s[idx]), t, 0.11 + Math.random() * 0.05);
    }
    // baixo suave
    if (b % 16 === 0) this.box(mtof(this.mood.root - 12 + s[chord[0]]), t, 0.09, 2.2);
    if (b % 16 === 8 && Math.random() < 0.6) this.box(mtof(this.mood.root - 12 + s[chord[2]]), t, 0.06, 1.8);
  }

  /** nota de caixinha de musica */
  box(freq, t = this.ctx.currentTime, vol = 0.1, dec = 1.5, out = this.music) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    g.connect(out); g.connect(this.verbIn);
    for (const [m, a] of [[1, 1], [2.0, 0.25], [3.01, 0.12], [5.4, 0.04]]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = freq * m;
      const og = ctx.createGain(); og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dec + 0.1);
    }
  }

  // ---------------------------------------------------------------- efeitos
  ok() { return this.ctx && this.ctx.state === 'running'; }

  chime(n = 0, vol = 0.12) {
    if (!this.ok()) return;
    const s = SCALES.major;
    const t = this.ctx.currentTime;
    this.box(mtof(this.mood.root + 24 + s[((n % s.length) + s.length) % s.length]), t, vol, 2.2, this.sfx);
  }

  success() {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((i, k) => this.box(mtof(this.mood.root + 12 + i), t + k * 0.09, 0.1, 2.4, this.sfx));
  }

  /** estrelas rindo: guizos aguidos, aleatorios */
  laugh(dur = 2.5, vol = 0.05) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime;
    const s = [0, 2, 4, 7, 9];
    for (let i = 0; i < dur * 14; i++) {
      const n = 84 + s[Math.floor(Math.random() * 5)] + 12 * Math.floor(Math.random() * 2);
      this.box(mtof(n), t + Math.random() * dur, vol * (0.4 + Math.random() * 0.6), 0.8, this.sfx);
    }
  }

  /** voz em blip, afinada por personagem */
  blip(pitch = 1, ch = 'a') {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const f = 280 * pitch * (1 + ((ch.charCodeAt(0) * 7) % 11) / 40);
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    o.connect(lp).connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.1);
  }

  noise(dur, freq, q, vol, type = 'bandpass', sweep = 1) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  step(soft = 1) { this.noise(0.09, 900 + Math.random() * 500, 1.2, 0.05 * soft, 'bandpass'); }
  jump() { this.noise(0.25, 500, 1, 0.04, 'bandpass', 3); }
  land() { this.noise(0.15, 300, 1, 0.07, 'lowpass'); }
  pull() { this.noise(0.4, 400, 2, 0.08, 'bandpass', 4); this.chime(3, 0.06); }
  poof() { this.noise(0.6, 1200, 0.6, 0.06, 'lowpass', 0.3); }
  clap() {
    this.noise(0.08, 1500, 0.8, 0.22, 'bandpass');
    setTimeout(() => this.noise(0.06, 1700, 0.8, 0.12, 'bandpass'), 12);
  }
  whoosh() { this.noise(0.9, 300, 0.7, 0.07, 'bandpass', 5); }
  sparkle() { if (!this.ok()) return; const t = this.ctx.currentTime; [0, 7, 12, 19].forEach((i, k) => this.box(mtof(88 + i), t + k * 0.05, 0.04, 0.9, this.sfx)); }

  startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg).connect(f.frequency); lfo.start();
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(f).connect(this.windGain).connect(this.sfx);
    src.start();
  }
}
