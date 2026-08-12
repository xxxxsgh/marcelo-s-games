/**
 * Hangar: chassis + cinco linhas de upgrade, tres tiers cada.
 *
 * REGRA: nenhum upgrade e so beneficio. Todo tier paga em alguma coisa que o
 * jogador sente no ar. Sem isso, progressao vira "numero maior" e a escolha
 * de build deixa de existir.
 */
import { BATTERY } from '../config.js';
import { RADIO } from '../world/pois.js';

export const CHASSIS = [
  {
    id: 'leve', name: 'LEVE', cost: 0,
    desc: 'Acrobatico. Vira num palito, mas o vento leva.',
    mass: 0.82, thrust: 1.06, agility: 1.28, drag: 0.94, windSens: 1.45, capacity: 0.85,
  },
  {
    id: 'equilibrado', name: 'EQUILIBRADO', cost: 0,
    desc: 'O padrao. Nada excepcional, nada ruim.',
    mass: 1.0, thrust: 1.0, agility: 1.0, drag: 1.0, windSens: 1.0, capacity: 1.0,
  },
  {
    id: 'cargueiro', name: 'CARGUEIRO', cost: 2400,
    desc: 'Pesado e estavel. Carrega carga sem reclamar, mas nao dança.',
    mass: 1.38, thrust: 1.22, agility: 0.72, drag: 1.14, windSens: 0.62, capacity: 1.45,
  },
];

export const LINES = [
  {
    id: 'motores', name: 'MOTORES', maxed: 'Empuxo no maximo.',
    tiers: [
      { cost: 450, thrust: 1.10, drain: 1.12,
        desc: '+10% de empuxo', tradeoff: 'consome 12% mais bateria' },
      { cost: 1100, thrust: 1.20, drain: 1.26,
        desc: '+20% de empuxo', tradeoff: 'consome 26% mais bateria' },
      { cost: 2300, thrust: 1.34, drain: 1.46,
        desc: '+34% de empuxo', tradeoff: 'consome 46% mais bateria' },
    ],
  },
  {
    id: 'bateria', name: 'BATERIA', maxed: 'Autonomia no maximo.',
    tiers: [
      { cost: 400, capacity: 1.18, mass: 1.06,
        desc: '+18% de autonomia', tradeoff: '+6% de peso (mais inercia)' },
      { cost: 950, capacity: 1.38, mass: 1.13,
        desc: '+38% de autonomia', tradeoff: '+13% de peso (mais inercia)' },
      { cost: 2000, capacity: 1.62, mass: 1.22,
        desc: '+62% de autonomia', tradeoff: '+22% de peso (mais inercia)' },
    ],
  },
  {
    id: 'helices', name: 'HELICES', maxed: 'Agilidade no maximo.',
    tiers: [
      { cost: 380, agility: 1.12, windSens: 1.15,
        desc: '+12% de agilidade', tradeoff: '15% mais sensivel ao vento' },
      { cost: 900, agility: 1.24, windSens: 1.34,
        desc: '+24% de agilidade', tradeoff: '34% mais sensivel ao vento' },
      { cost: 1850, agility: 1.40, windSens: 1.60,
        desc: '+40% de agilidade', tradeoff: '60% mais sensivel ao vento' },
    ],
  },
  {
    id: 'camera', name: 'CAMERA', maxed: 'Otica no maximo.',
    tiers: [
      { cost: 500, zoom: 1.25, mass: 1.04, agility: 0.97,
        desc: 'zoom 1.25x, enquadra de mais longe', tradeoff: 'peso na frente: -3% de agilidade' },
      { cost: 1200, zoom: 1.6, mass: 1.08, agility: 0.93,
        desc: 'zoom 1.6x', tradeoff: 'peso na frente: -7% de agilidade' },
      { cost: 2500, zoom: 2.1, mass: 1.13, agility: 0.88,
        desc: 'zoom 2.1x', tradeoff: 'peso na frente: -12% de agilidade' },
    ],
  },
  {
    id: 'antena', name: 'ANTENA', maxed: 'Alcance no maximo.',
    tiers: [
      { cost: 420, range: 180, drag: 1.05,
        desc: '+180 m de alcance', tradeoff: '+5% de arrasto (perde ponta)' },
      { cost: 1000, range: 400, drag: 1.11,
        desc: '+400 m de alcance', tradeoff: '+11% de arrasto' },
      { cost: 2100, range: 700, drag: 1.18,
        desc: '+700 m de alcance', tradeoff: '+18% de arrasto' },
    ],
  },
];

export function createHangar(save, bus) {
  const stats = {
    thrust: 1, mass: 1, agility: 1, drag: 1, windSens: 1,
    capacity: 1, drain: 1, zoom: 1, range: 0,
  };

  const tierOf = (lineId) => save.data.upgrades[lineId] || 0;

  function nextTier(lineId) {
    const line = LINES.find((l) => l.id === lineId);
    const t = tierOf(lineId);
    return t < line.tiers.length ? line.tiers[t] : null;
  }

  /** Recalcula tudo do zero a partir do chassis + tiers comprados. */
  function recompute() {
    const ch = CHASSIS.find((c) => c.id === save.data.chassis) || CHASSIS[1];
    stats.thrust = ch.thrust;
    stats.mass = ch.mass;
    stats.agility = ch.agility;
    stats.drag = ch.drag;
    stats.windSens = ch.windSens;
    stats.capacity = ch.capacity;
    stats.drain = 1;
    stats.zoom = 1;
    stats.range = 0;

    for (const line of LINES) {
      const t = tierOf(line.id);
      if (!t) continue;
      const mod = line.tiers[t - 1];
      if (mod.thrust) stats.thrust *= mod.thrust;
      if (mod.mass) stats.mass *= mod.mass;
      if (mod.agility) stats.agility *= mod.agility;
      if (mod.drag) stats.drag *= mod.drag;
      if (mod.windSens) stats.windSens *= mod.windSens;
      if (mod.capacity) stats.capacity *= mod.capacity;
      if (mod.drain) stats.drain *= mod.drain;
      if (mod.zoom) stats.zoom *= mod.zoom;
      if (mod.range) stats.range += mod.range;
    }
    return stats;
  }

  /** Aplica no drone e nos sistemas que dependem da build. */
  function apply(drone) {
    recompute();
    const st = drone.state;
    st.thrustScale = stats.thrust;
    st.massScale = stats.mass;
    // Peso maior => mesma agilidade custa mais: a inercia entra aqui.
    st.agilityScale = stats.agility / Math.sqrt(stats.mass);
    st.dragScale = stats.drag;
    RADIO.antennaBonus = stats.range;
    drone.status.capacityScale = stats.capacity;
    drone.status.drainScale = stats.drain;
    drone.status.windSens = stats.windSens;
    return stats;
  }

  function buy(lineId) {
    const next = nextTier(lineId);
    if (!next) return false;
    if (save.data.money < next.cost) return false;
    save.addMoney(-next.cost);
    save.data.upgrades[lineId] = tierOf(lineId) + 1;
    save.save();
    bus.emit('hangar:upgrade', { line: lineId, tier: save.data.upgrades[lineId] });
    return true;
  }

  function setChassis(id) {
    const ch = CHASSIS.find((c) => c.id === id);
    if (!ch) return false;
    const owned = save.data.ownedChassis || ['leve', 'equilibrado'];
    if (!owned.includes(id)) {
      if (save.data.money < ch.cost) return false;
      save.addMoney(-ch.cost);
      owned.push(id);
      save.data.ownedChassis = owned;
    }
    save.data.chassis = id;
    save.save();
    bus.emit('hangar:chassis', ch);
    return true;
  }

  /** Presets de build salvaveis. */
  function savePreset(name) {
    save.data.presets[name] = {
      chassis: save.data.chassis,
      upgrades: { ...save.data.upgrades },
    };
    save.save();
  }
  function loadPreset(name) {
    const p = save.data.presets[name];
    if (!p) return false;
    save.data.chassis = p.chassis;
    save.data.upgrades = { ...p.upgrades };
    save.save();
    return true;
  }

  /** Frase em portugues do que a build faz no ar. */
  function summary() {
    const s = stats;
    const bits = [];
    bits.push(s.agility > 1.1 ? 'Vira rapido' : s.agility < 0.9 ? 'Vira devagar' : 'Giro neutro');
    bits.push(s.thrust > 1.15 ? 'sobe forte' : s.thrust < 0.95 ? 'sobe fraco' : 'empuxo normal');
    bits.push(s.capacity / s.drain > 1.2 ? 'aguenta voo longo'
      : s.capacity / s.drain < 0.85 ? 'bateria acaba rapido' : 'autonomia media');
    bits.push(s.windSens > 1.25 ? 'e o vento incomoda muito'
      : s.windSens < 0.8 ? 'e ignora o vento' : 'e o vento incomoda pouco');
    return `${bits.join(', ')}.`;
  }

  recompute();

  return {
    stats, lines: LINES, chassisList: CHASSIS,
    get chassis() { return save.data.chassis; },
    tierOf, nextTier, buy, setChassis, apply, recompute, summary,
    savePreset, loadPreset,
    get capacity() { return BATTERY.capacity * stats.capacity; },
  };
}
