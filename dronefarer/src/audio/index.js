/**
 * Audio inteiro sintetizado em Web Audio. Zero sample, zero download.
 *
 * O som do motor e metade da sensacao de pilotar, entao ele nao e um loop com
 * pitch: sao quatro parciais (uma por helice) mais ruido de passagem de pa,
 * com frequencia ligada ao RPM, volume ligado ao throttle e timbre ligado a
 * CARGA (o quanto o motor esta empurrando contra a gravidade).
 *
 * Doppler e feito na mao: a spec do Web Audio removeu o dopplerFactor do
 * PannerNode, entao a velocidade radial em relacao a camera desloca a
 * frequencia diretamente.
 */
import { AUDIO } from '../config.js';
import { clamp01, damp, lerp } from '../core/mathx.js';

const SPEED_OF_SOUND = 343;

export function createAudio(bus) {
  let ctx = null;
  let started = false;

  const mix = {
    master: AUDIO.master, engine: AUDIO.engine, wind: AUDIO.wind,
    sfx: AUDIO.sfx, music: AUDIO.music,
  };

  const nodes = {};
  const state = {
    rpm: 0, load: 0, airspeed: 0, wallProximity: 1,
    context: 'explore',       // 'explore' | 'race' | 'mission' | 'critical'
    muted: false,
  };

  /** Ruido branco em buffer curto, reaproveitado por todas as fontes. */
  function noiseBuffer(seconds = 2) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function build() {
    const master = ctx.createGain();
    master.gain.value = mix.master;
    master.connect(ctx.destination);

    // --- barramentos ---
    const busEngine = ctx.createGain(); busEngine.gain.value = mix.engine;
    const busWind = ctx.createGain(); busWind.gain.value = mix.wind;
    const busSfx = ctx.createGain(); busSfx.gain.value = mix.sfx;
    const busMusic = ctx.createGain(); busMusic.gain.value = mix.music;
    for (const b of [busEngine, busWind, busSfx, busMusic]) b.connect(master);

    // ------------------------------------------------------------ motor
    // Filtro que a parede "fecha": perto de parede o som encorpa e abafa.
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 8000;
    engineFilter.Q.value = 0.7;
    engineFilter.connect(busEngine);

    // reforco grave quando ha parede perto (reflexao barata)
    const engineBoost = ctx.createBiquadFilter();
    engineBoost.type = 'peaking';
    engineBoost.frequency.value = 180;
    engineBoost.gain.value = 0;
    engineBoost.Q.value = 1.0;
    engineBoost.connect(engineFilter);

    const partials = [];
    for (let i = 0; i < AUDIO.engineHarmonics; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'square';
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g); g.connect(engineBoost);
      osc.start();
      // cada motor um pouco fora de fase do outro: e isso que da o "bate"
      partials.push({ osc, gain: g, ratio: 1 + i * 0.503, detune: (i - 1.5) * 7 });
    }

    // passagem de pa: ruido com bandpass seguindo o RPM
    const bladeSrc = ctx.createBufferSource();
    bladeSrc.buffer = noiseBuffer();
    bladeSrc.loop = true;
    const bladeFilter = ctx.createBiquadFilter();
    bladeFilter.type = 'bandpass';
    bladeFilter.Q.value = 3.2;
    const bladeGain = ctx.createGain();
    bladeGain.gain.value = 0;
    bladeSrc.connect(bladeFilter); bladeFilter.connect(bladeGain);
    bladeGain.connect(engineBoost);
    bladeSrc.start();

    // ------------------------------------------------------------ vento
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer();
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(busWind);
    windSrc.start();

    // ----------------------------------------------------------- musica
    // Quatro camadas que entram por contexto. Cada uma e um acorde sustentado
    // com filtro proprio; o que muda entre contextos e QUEM esta audivel.
    const layers = {};
    const CHORDS = {
      explore: [110, 164.81, 220, 329.63],
      race: [98, 146.83, 196, 293.66],
      mission: [103.83, 155.56, 207.65, 311.13],
      critical: [92.5, 138.59, 185, 233.08],
    };
    for (const [name, freqs] of Object.entries(CHORDS)) {
      const g = ctx.createGain();
      g.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = name === 'critical' ? 900 : 1600;
      g.connect(f); f.connect(busMusic);
      const oscs = freqs.map((hz, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = hz;
        o.detune.value = (i - 1.5) * 4;
        const og = ctx.createGain();
        og.gain.value = 0.18 / freqs.length;
        o.connect(og); og.connect(g);
        o.start();
        return o;
      });
      layers[name] = { gain: g, oscs, filter: f };
    }

    Object.assign(nodes, {
      master, busEngine, busWind, busSfx, busMusic,
      engineFilter, engineBoost, partials, bladeFilter, bladeGain,
      windFilter, windGain, layers,
    });
  }

  /** Web Audio exige gesto do usuario; chamamos no primeiro clique/tecla. */
  function start() {
    if (started) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      build();
      started = true;
      bus.emit('audio:started');
      return true;
    } catch (e) {
      console.warn('[audio] indisponivel:', e.message);
      return false;
    }
  }

  function resume() {
    if (!started) return start();
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ------------------------------------------------------------------ SFX
  function blip(freq, duration, type = 'sine', vol = 0.3, sweep = 0) {
    if (!started || state.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) o.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + sweep), ctx.currentTime + duration,
    );
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.connect(g); g.connect(nodes.busSfx);
    o.start();
    o.stop(ctx.currentTime + duration + 0.02);
  }

  function noiseBurst(duration, freq, vol = 0.4) {
    if (!started || state.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.3);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(f); f.connect(g); g.connect(nodes.busSfx);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
  }

  const SFX = {
    gate: () => { blip(880, 0.14, 'sine', 0.32, 520); },
    gateCenter: () => { blip(1320, 0.2, 'sine', 0.36, 660); blip(1760, 0.16, 'triangle', 0.2); },
    graze: () => noiseBurst(0.12, 2400, 0.3),
    crash: () => { noiseBurst(0.45, 260, 0.75); blip(70, 0.4, 'sawtooth', 0.4, -30); },
    alert: () => { blip(440, 0.12, 'square', 0.3); setTimeout(() => blip(330, 0.16, 'square', 0.3), 130); },
    signalLost: () => noiseBurst(0.5, 900, 0.35),
    complete: () => {
      [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.3), i * 110));
    },
    fail: () => { blip(220, 0.4, 'sawtooth', 0.3, -80); },
    ui: () => blip(1200, 0.05, 'sine', 0.14),
    capture: () => { blip(1600, 0.07, 'square', 0.2); blip(2400, 0.05, 'sine', 0.12); },
    discover: () => {
      [659.25, 987.77].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sine', 0.26), i * 130));
    },
  };

  // --------------------------------------------------------- batt critica
  let beepTimer = 0;
  function batteryBeep(dt, ratio) {
    if (ratio > BATTERY_CRITICAL) { beepTimer = 0; return; }
    beepTimer -= dt;
    if (beepTimer <= 0) {
      // Intervalo encurta conforme a bateria cai: da pra reconhecer sem olhar.
      const urgency = 1 - clamp01(ratio / BATTERY_CRITICAL);
      beepTimer = lerp(AUDIO.batteryBeepInterval, 0.32, urgency);
      blip(AUDIO.batteryBeepHz, 0.09, 'square', 0.22 + urgency * 0.16);
    }
  }
  const BATTERY_CRITICAL = 0.18;

  // ------------------------------------------------------------- update
  const prevRel = { d: 0 };

  /**
   * @param st       estado do drone
   * @param camPos   posicao da camera (ouvinte)
   * @param wallDist distancia ate a parede mais proxima
   * @param batteryRatio 0..1
   */
  function update(dt, st, camPos, wallDist, batteryRatio) {
    if (!started || state.muted) return;
    const t = ctx.currentTime;

    // --- RPM e carga ---
    state.rpm = damp(state.rpm, clamp01(0.12 + st.motor * 0.88), 12, dt);
    // carga = quanto do empuxo esta sendo gasto so pra nao cair
    state.load = damp(state.load, clamp01(st.thrustAccel / 30), 5, dt);

    // --- doppler manual pela velocidade radial em relacao a camera ---
    const dx = st.pos.x - camPos.x, dy = st.pos.y - camPos.y, dz = st.pos.z - camPos.z;
    const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
    const radial = (st.vel.x * dx + st.vel.y * dy + st.vel.z * dz) / dist;
    const doppler = 1 - (radial / SPEED_OF_SOUND) * AUDIO.dopplerFactor * 40;

    const baseHz = lerp(AUDIO.engineBaseHz, AUDIO.engineTopHz, state.rpm)
      * Math.max(0.4, Math.min(2.2, doppler));

    for (const p of nodes.partials) {
      p.osc.frequency.setTargetAtTime(baseHz * p.ratio, t, 0.02);
      p.osc.detune.setTargetAtTime(p.detune, t, 0.05);
      // carga suja o timbre: os parciais altos sobem quando o motor forca
      const share = p.ratio === 1 ? 0.34 : 0.13 * (1 + state.load * AUDIO.engineLoadTimbre);
      p.gain.gain.setTargetAtTime(share * (0.25 + state.rpm * 0.75) / dist ** 0.35, t, 0.05);
    }

    nodes.bladeFilter.frequency.setTargetAtTime(
      baseHz * AUDIO.engineBladeRatio * 2.6, t, 0.03,
    );
    nodes.bladeGain.gain.setTargetAtTime(0.12 * state.rpm / dist ** 0.35, t, 0.05);

    // --- parede perto muda o som ---
    const prox = clamp01(1 - wallDist / AUDIO.wallProximity);
    state.wallProximity = damp(state.wallProximity, prox, 6, dt);
    nodes.engineBoost.gain.setTargetAtTime(state.wallProximity * 9, t, 0.08);
    nodes.engineFilter.frequency.setTargetAtTime(
      lerp(9000, 2600, state.wallProximity), t, 0.08,
    );

    // --- vento pela velocidade DO AR, nao a do solo ---
    state.airspeed = damp(state.airspeed, st.airspeed, 6, dt);
    const w = clamp01(state.airspeed / AUDIO.windSpeedRef);
    nodes.windGain.gain.setTargetAtTime(w * w * 0.5, t, 0.08);
    nodes.windFilter.frequency.setTargetAtTime(400 + w * 2200, t, 0.08);

    // --- musica por contexto ---
    for (const [name, layer] of Object.entries(nodes.layers)) {
      const target = name === state.context ? 0.5 : 0.0;
      layer.gain.gain.setTargetAtTime(target, t, 0.9);
    }

    batteryBeep(dt, batteryRatio);
    prevRel.d = dist;
  }

  function setContext(c) { state.context = c; }

  function setMix(key, value) {
    mix[key] = value;
    if (!started) return;
    const map = {
      master: nodes.master, engine: nodes.busEngine, wind: nodes.busWind,
      sfx: nodes.busSfx, music: nodes.busMusic,
    };
    if (map[key]) map[key].gain.setTargetAtTime(value, ctx.currentTime, 0.05);
  }

  // --- liga os eventos do jogo aos sons ---
  bus.on('race:gate', (g) => (g.centered ? SFX.gateCenter() : SFX.gate()));
  bus.on('drone:crash', () => SFX.crash());
  bus.on('drone:graze', ({ impact }) => { if (impact > 1.5) SFX.graze(); });
  bus.on('zone:alarm', () => SFX.alert());
  bus.on('poi:discovered', () => SFX.discover());
  bus.on('mission:complete', () => SFX.complete());
  bus.on('mission:fail', () => SFX.fail());
  bus.on('mission:capture', () => SFX.capture());
  bus.on('race:finish', () => SFX.complete());
  bus.on('damage:part', () => SFX.graze());
  bus.on('damage:shock', () => SFX.signalLost());

  return {
    start, resume, update, setContext, setMix, sfx: SFX, mix, state,
    get running() { return started && ctx && ctx.state === 'running'; },
    get context() { return ctx; },
    setMuted(v) {
      state.muted = v;
      if (started) nodes.master.gain.setTargetAtTime(v ? 0 : mix.master, ctx.currentTime, 0.05);
      return v;
    },
  };
}
