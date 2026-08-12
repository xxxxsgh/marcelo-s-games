/**
 * Dano por partes. O risco real do jogo nao e "morrer": e voltar pra base com
 * o drone torto, a carga perdida e a conta do conserto.
 *
 * Cada parte falha de um jeito que se SENTE pilotando:
 *   helice   -> torque parasita, o drone puxa pra um lado sozinho
 *   camera   -> imagem com artefato (atrapalha inspecao e vigilancia)
 *   bateria  -> drena mais rapido
 *   estrutura-> agilidade cai, arrasto sobe
 */
import { clamp01 } from '../core/mathx.js';

export const REPAIR_COST = {
  helice: 90, camera: 260, bateria: 220, estrutura: 340,
};

export function createDamage(bus, drone) {
  const parts = {
    helice: 0,      // 0 = intacta, 1 = destruida
    camera: 0,
    bateria: 0,
    estrutura: 0,
  };

  const state = {
    parts,
    noRisk: false,
    cargoLost: false,
    repairBill: 0,
    shockTimer: 0,   // choque de fio de alta tensao
  };

  /** Aplica dano a partir de um impacto. */
  function applyImpact(impact, tag) {
    if (state.noRisk) return;
    // Abaixo de 10 m/s so arranha; acima, escolhe a parte pelo tipo de batida.
    const sev = clamp01((impact - 8) / 26);
    if (sev <= 0) return;

    // Fio e antena tendem a pegar helice; queda no chao pega estrutura.
    const weights = tag === 'poste' || tag === 'fio'
      ? { helice: 0.6, camera: 0.15, estrutura: 0.2, bateria: 0.05 }
      : tag === 'chao'
        ? { helice: 0.3, camera: 0.2, estrutura: 0.4, bateria: 0.1 }
        : { helice: 0.4, camera: 0.25, estrutura: 0.25, bateria: 0.1 };

    let r = Math.random();
    let picked = 'estrutura';
    for (const [k, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) { picked = k; break; }
    }
    parts[picked] = clamp01(parts[picked] + sev * 0.75);
    state.repairBill += Math.round(REPAIR_COST[picked] * sev);

    // Batida forte perde a carga da missao — este e o risco de verdade.
    if (sev > 0.45 && drone.status.payload > 0) {
      drone.status.payload = 0;
      state.cargoLost = true;
      bus.emit('damage:cargo', null);
    }
    bus.emit('damage:part', { part: picked, level: parts[picked], severity: sev });
    sync();
  }

  /** Choque de alta tensao: perde o controle por alguns instantes. */
  function shock(seconds = 1.4) {
    if (state.noRisk) return;
    state.shockTimer = Math.max(state.shockTimer, seconds);
    bus.emit('damage:shock', seconds);
  }

  /** Traduz o dano em multiplicadores que a fisica usa. */
  function sync() {
    const st = drone.state;
    // helice quebrada = torque constante pra um lado
    st.torqueBias.set(0, parts.helice * 0.9, parts.helice * 1.7);
    st.agilityScale *= 1;                        // recalculado pelo hangar
    drone.status.drainScale *= 1;
  }

  /**
   * Aplica os efeitos por frame (depois do hangar, que define a base).
   * Multiplicar aqui e nao no hangar evita que os dois se sobrescrevam.
   */
  function modulate(dt) {
    const st = drone.state;
    if (state.shockTimer > 0) {
      state.shockTimer -= dt;
      // Durante o choque, a eletronica reinicia: sem empuxo util e girando.
      st.thrustScale *= 0.25;
      st.angVel.x += (Math.random() - 0.5) * 8 * dt;
      st.angVel.z += (Math.random() - 0.5) * 8 * dt;
    }
    if (parts.estrutura > 0) {
      st.agilityScale *= 1 - parts.estrutura * 0.35;
      st.dragScale *= 1 + parts.estrutura * 0.4;
    }
    if (parts.helice > 0) {
      st.torqueBias.set(0, parts.helice * 0.9, parts.helice * 1.7);
      st.thrustScale *= 1 - parts.helice * 0.22;
    }
    if (parts.bateria > 0) drone.status.drainScale *= 1 + parts.bateria * 0.8;
  }

  function repairAll(save) {
    const bill = state.repairBill;
    if (bill > 0) save.addMoney(-Math.min(bill, save.data.money));
    for (const k of Object.keys(parts)) parts[k] = 0;
    state.repairBill = 0;
    state.cargoLost = false;
    state.shockTimer = 0;
    drone.state.torqueBias.set(0, 0, 0);
    bus.emit('damage:repair', bill);
    return bill;
  }

  bus.on('drone:crash', ({ impact, tag }) => applyImpact(impact, tag));
  bus.on('drone:graze', ({ impact, tag }) => {
    if (impact > 9) applyImpact(impact * 0.6, tag);
  });
  bus.on('drone:reset', () => {
    // Reiniciar corrida/missao devolve o drone inteiro: o custo do risco esta
    // na economia, nao em travar o loop de tentar de novo.
    for (const k of Object.keys(parts)) parts[k] = 0;
    state.shockTimer = 0;
    state.cargoLost = false;
    drone.state.torqueBias.set(0, 0, 0);
  });

  return {
    state, parts, applyImpact, shock, modulate, repairAll,
    setNoRisk(v) { state.noRisk = v; drone.status.noRisk = v; return v; },
    get totalDamage() {
      return clamp01((parts.helice + parts.camera + parts.bateria + parts.estrutura) / 4);
    },
    get cameraGlitch() { return parts.camera; },
  };
}
