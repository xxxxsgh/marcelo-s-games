/**
 * Som 100% sintetizado no WebAudio — nenhum arquivo, nenhum download.
 *
 * Cada efeito e uma receita curta de osciladores e ruido filtrado. Tiro e
 * ruido com passa-baixa caindo (o "corpo") somado a um clique curto (o
 * "estalo"); bicho e onda dente-de-serra com vibrato. Distancia vira volume,
 * entao da pra ouvir de onde vem o problema.
 */
import { AUDIO } from '../config.js';
import { clamp01 } from '../core/mathx.js';

export function createAudio() {
  let ctx = null;
  let master = null, ganhoSfx = null, ganhoAmb = null;
  let ruidoBuf = null;
  let ambiente = null;
  let ligado = true;
  let iniciado = false;
  let intensidade = 0;   // 0 calmo, 1 cerco
  let noite = 0;

  function garantir() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = AUDIO.master;
    master.connect(ctx.destination);
    ganhoSfx = ctx.createGain();
    ganhoSfx.gain.value = AUDIO.sfx;
    ganhoSfx.connect(master);
    ganhoAmb = ctx.createGain();
    ganhoAmb.gain.value = 0;
    ganhoAmb.connect(master);

    const n = ctx.sampleRate * 2;
    ruidoBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function retomar() {
    garantir();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (!iniciado && ctx) { iniciado = true; iniciarAmbiente(); }
  }

  // ------------------------------------------------------------ tijolos
  function env(g, t0, ataque, sustento, queda, pico) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t0 + ataque);
    g.gain.setValueAtTime(Math.max(0.0002, pico), t0 + ataque + sustento);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + sustento + queda);
  }

  function tom({ f0, f1, dur = 0.2, tipo = 'sine', vol = 0.3, atraso = 0, curva = 'exp', destino }) {
    const t0 = ctx.currentTime + atraso;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) {
      if (curva === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      else o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    }
    env(g, t0, Math.min(0.012, dur * 0.2), dur * 0.15, dur, vol);
    o.connect(g); g.connect(destino || ganhoSfx);
    o.start(t0); o.stop(t0 + dur + 0.08);
  }

  function ruido({ dur = 0.2, f0 = 2000, f1 = 300, q = 1, vol = 0.3, tipo = 'lowpass', atraso = 0, destino }) {
    const t0 = ctx.currentTime + atraso;
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, 0.004, dur * 0.1, dur, vol);
    s.connect(f); f.connect(g); g.connect(destino || ganhoSfx);
    s.start(t0); s.stop(t0 + dur + 0.06);
  }

  // ------------------------------------------------------------ receitas
  const RECEITAS = {
    pistola: (v) => { ruido({ dur: 0.14, f0: 3200, f1: 420, vol: 0.34 * v }); tom({ f0: 320, f1: 90, dur: 0.1, tipo: 'square', vol: 0.16 * v }); },
    fuzil: (v) => { ruido({ dur: 0.1, f0: 4200, f1: 700, vol: 0.28 * v }); tom({ f0: 520, f1: 140, dur: 0.08, tipo: 'sawtooth', vol: 0.14 * v }); },
    espingarda: (v) => { ruido({ dur: 0.34, f0: 2200, f1: 160, vol: 0.5 * v }); tom({ f0: 140, f1: 48, dur: 0.28, tipo: 'square', vol: 0.24 * v }); },
    plasma: (v) => { tom({ f0: 880, f1: 120, dur: 0.34, tipo: 'sawtooth', vol: 0.3 * v }); ruido({ dur: 0.3, f0: 1800, f1: 200, vol: 0.2 * v }); },
    vazio: (v) => { tom({ f0: 1800, f1: 900, dur: 0.05, tipo: 'square', vol: 0.1 * v }); },
    impacto: (v) => { ruido({ dur: 0.08, f0: 5000, f1: 900, vol: 0.2 * v }); },
    impactoPesado: (v) => { ruido({ dur: 0.4, f0: 900, f1: 80, vol: 0.42 * v }); tom({ f0: 90, f1: 40, dur: 0.35, tipo: 'sine', vol: 0.3 * v }); },
    explosao: (v) => {
      ruido({ dur: 0.7, f0: 1400, f1: 60, vol: 0.6 * v });
      tom({ f0: 120, f1: 34, dur: 0.6, tipo: 'sine', vol: 0.45 * v });
      ruido({ dur: 0.25, f0: 5000, f1: 1200, vol: 0.25 * v });
    },
    morte: (v) => { tom({ f0: 420, f1: 90, dur: 0.3, tipo: 'sawtooth', vol: 0.22 * v }); ruido({ dur: 0.3, f0: 1200, f1: 200, vol: 0.22 * v }); },
    morteChefe: (v) => {
      tom({ f0: 220, f1: 40, dur: 1.4, tipo: 'sawtooth', vol: 0.4 * v });
      ruido({ dur: 1.2, f0: 900, f1: 60, vol: 0.4 * v });
    },
    grito: (v) => { tom({ f0: 620, f1: 940, dur: 0.16, tipo: 'sawtooth', vol: 0.12 * v }); tom({ f0: 900, f1: 500, dur: 0.2, tipo: 'square', vol: 0.08 * v, atraso: 0.12 }); },
    salto: (v) => { tom({ f0: 260, f1: 720, dur: 0.14, tipo: 'triangle', vol: 0.14 * v }); },
    cuspe: (v) => { ruido({ dur: 0.22, f0: 900, f1: 2600, vol: 0.24 * v, tipo: 'bandpass', q: 3 }); },
    rugido: (v) => {
      tom({ f0: 90, f1: 190, dur: 0.7, tipo: 'sawtooth', vol: 0.34 * v });
      tom({ f0: 130, f1: 62, dur: 0.9, tipo: 'square', vol: 0.2 * v, atraso: 0.1 });
    },
    investida: (v) => { ruido({ dur: 0.5, f0: 400, f1: 1600, vol: 0.25 * v, tipo: 'bandpass', q: 2 }); },
    ninhada: (v) => { tom({ f0: 320, f1: 120, dur: 0.5, tipo: 'square', vol: 0.2 * v }); ruido({ dur: 0.4, f0: 700, f1: 200, vol: 0.2 * v }); },
    ninhoCospe: (v) => { ruido({ dur: 0.3, f0: 500, f1: 1400, vol: 0.18 * v, tipo: 'bandpass', q: 2 }); },
    onda: (v) => { tom({ f0: 160, f1: 320, dur: 0.9, tipo: 'sawtooth', vol: 0.22 * v }); },
    passo: (v) => { ruido({ dur: 0.07, f0: 900, f1: 200, vol: 0.12 * v }); },
    esquiva: (v) => { ruido({ dur: 0.22, f0: 1600, f1: 400, vol: 0.2 * v, tipo: 'bandpass', q: 1.4 }); },
    recarregarInicio: (v) => { tom({ f0: 700, f1: 500, dur: 0.06, tipo: 'square', vol: 0.12 * v }); ruido({ dur: 0.1, f0: 2600, f1: 800, vol: 0.14 * v, atraso: 0.05 }); },
    recarregar: (v) => { tom({ f0: 480, f1: 820, dur: 0.07, tipo: 'square', vol: 0.14 * v }); ruido({ dur: 0.07, f0: 3200, f1: 1200, vol: 0.14 * v }); },
    trocar: (v) => { tom({ f0: 900, f1: 1300, dur: 0.06, tipo: 'triangle', vol: 0.12 * v }); },
    pegar: (v) => { tom({ f0: 900, f1: 1500, dur: 0.09, tipo: 'triangle', vol: 0.16 * v }); },
    curar: (v) => { tom({ f0: 600, f1: 1200, dur: 0.22, tipo: 'sine', vol: 0.2 * v }); tom({ f0: 900, f1: 1800, dur: 0.2, tipo: 'sine', vol: 0.12 * v, atraso: 0.08 }); },
    melhoria: (v) => { [660, 880, 1320].forEach((f, i) => tom({ f0: f, f1: f * 1.5, dur: 0.16, tipo: 'triangle', vol: 0.16 * v, atraso: i * 0.07 })); },
    armaNova: (v) => { [440, 660, 990].forEach((f, i) => tom({ f0: f, f1: f, dur: 0.14, tipo: 'square', vol: 0.14 * v, atraso: i * 0.06 })); },
    nucleo: (v) => { tom({ f0: 300, f1: 900, dur: 0.5, tipo: 'sine', vol: 0.26 * v }); tom({ f0: 450, f1: 1350, dur: 0.5, tipo: 'triangle', vol: 0.14 * v }); },
    entregar: (v) => { [523, 659, 784, 1046].forEach((f, i) => tom({ f0: f, f1: f, dur: 0.24, tipo: 'sine', vol: 0.2 * v, atraso: i * 0.1 })); },
    ui: (v) => { tom({ f0: 1200, f1: 1200, dur: 0.04, tipo: 'square', vol: 0.08 * v }); },
    escudo: (v) => { tom({ f0: 700, f1: 1500, dur: 0.3, tipo: 'sine', vol: 0.13 * v }); },
    dano: (v) => { ruido({ dur: 0.18, f0: 700, f1: 120, vol: 0.3 * v }); tom({ f0: 180, f1: 70, dur: 0.2, tipo: 'square', vol: 0.16 * v }); },
    coronhada: (v) => { ruido({ dur: 0.16, f0: 1400, f1: 200, vol: 0.3 * v }); tom({ f0: 200, f1: 80, dur: 0.14, tipo: 'square', vol: 0.16 * v }); },
    coronhadaVazia: (v) => { ruido({ dur: 0.1, f0: 2000, f1: 700, vol: 0.14 * v }); },
    alarme: (v) => { [880, 660].forEach((f, i) => tom({ f0: f, f1: f, dur: 0.18, tipo: 'square', vol: 0.16 * v, atraso: i * 0.2 })); },
    morteJogador: (v) => {
      tom({ f0: 320, f1: 40, dur: 1.6, tipo: 'sawtooth', vol: 0.34 * v });
      ruido({ dur: 1.4, f0: 800, f1: 60, vol: 0.3 * v });
    },
    decolagem: (v) => {
      ruido({ dur: 3.2, f0: 300, f1: 2600, vol: 0.5 * v, tipo: 'lowpass' });
      tom({ f0: 80, f1: 420, dur: 3.0, tipo: 'sawtooth', vol: 0.3 * v });
    },
    vitoria: (v) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tom({ f0: f, f1: f, dur: 0.4, tipo: 'triangle', vol: 0.18 * v, atraso: i * 0.14 })); },
    queda: (v) => {
      ruido({ dur: 2.6, f0: 2600, f1: 300, vol: 0.5 * v });
      tom({ f0: 300, f1: 60, dur: 2.4, tipo: 'sawtooth', vol: 0.2 * v });
    },
  };

  // ------------------------------------------------------------ ambiente
  function iniciarAmbiente() {
    if (!ctx || ambiente) return;
    const vento = ctx.createBufferSource();
    vento.buffer = ruidoBuf;
    vento.loop = true;
    const fVento = ctx.createBiquadFilter();
    fVento.type = 'bandpass';
    fVento.frequency.value = 320;
    fVento.Q.value = 0.6;
    const gVento = ctx.createGain();
    gVento.gain.value = 0.5;
    vento.connect(fVento); fVento.connect(gVento); gVento.connect(ganhoAmb);
    vento.start();

    // LFO no filtro do vento: rajada em vez de chiado constante
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 160;
    lfo.connect(lfoG); lfoG.connect(fVento.frequency);
    lfo.start();

    // drone grave do planeta
    const d1 = ctx.createOscillator(), d2 = ctx.createOscillator();
    const gDrone = ctx.createGain();
    d1.type = 'sine'; d2.type = 'sine';
    d1.frequency.value = 47; d2.frequency.value = 47 * 1.006;
    gDrone.gain.value = 0.5;
    d1.connect(gDrone); d2.connect(gDrone); gDrone.connect(ganhoAmb);
    d1.start(); d2.start();

    // pulso de tensao: so aparece quando `intensidade` sobe
    const pulso = ctx.createOscillator();
    const gPulso = ctx.createGain();
    pulso.type = 'triangle';
    pulso.frequency.value = 88;
    gPulso.gain.value = 0;
    pulso.connect(gPulso); gPulso.connect(ganhoAmb);
    pulso.start();

    ambiente = { gVento, gDrone, gPulso, pulso, d1, d2, fVento };
  }

  let batida = 0;
  function atualizar(dt, estado) {
    if (!ctx || !ambiente) return;
    intensidade = estado.intensidade;
    noite = estado.noite;
    const alvo = ligado ? AUDIO.ambiente : 0;
    ganhoAmb.gain.value += (alvo - ganhoAmb.gain.value) * Math.min(1, dt * 2);
    ambiente.gVento.gain.value = 0.22 + noite * 0.2;
    ambiente.gDrone.gain.value = 0.3 + intensidade * 0.35;
    ambiente.d1.frequency.value = 47 + intensidade * 12;

    // batimento cardiaco quando a vida esta baixa
    if (estado.perigo > 0) {
      batida -= dt;
      if (batida <= 0) {
        batida = 0.42 + (1 - estado.perigo) * 0.5;
        tom({ f0: 62, f1: 34, dur: 0.16, tipo: 'sine', vol: 0.26 * estado.perigo });
        tom({ f0: 58, f1: 30, dur: 0.14, tipo: 'sine', vol: 0.18 * estado.perigo, atraso: 0.19 });
      }
    }
    if (intensidade > 0.3) {
      ambiente.gPulso.gain.value = 0.04 + Math.max(0, Math.sin(ctx.currentTime * 3.4)) * 0.06 * intensidade;
      ambiente.pulso.frequency.value = 66 + Math.sin(ctx.currentTime * 0.7) * 10;
    } else {
      ambiente.gPulso.gain.value *= 0.9;
    }
  }

  function tocar(nome, vol = 1, dist = 0) {
    if (!ligado) return;
    if (!ctx) return;
    if (ctx.state === 'suspended') return;
    const r = RECEITAS[nome];
    if (!r) return;
    const atenua = dist > 0 ? clamp01(1 - dist / 1500) ** 1.5 : 1;
    if (atenua <= 0.02) return;
    try { r(vol * atenua); } catch (e) { /* contexto morreu; ignora */ }
  }

  return {
    tocar, retomar, atualizar,
    get ligado() { return ligado; },
    alternar() {
      ligado = !ligado;
      if (master) master.gain.value = ligado ? AUDIO.master : 0;
      return ligado;
    },
    get pronto() { return !!ctx && ctx.state === 'running'; },
  };
}
