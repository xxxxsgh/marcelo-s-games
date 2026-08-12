/**
 * Clima e hora do dia. Nao e "a mesma missao com filtro": chuva muda peso e
 * visibilidade, neblina esconde o topo das torres, noite troca a fonte de luz
 * inteira e vento forte canaliza entre os predios.
 *
 * O ciclo dia/noite e POR MISSAO, nao global — assim o jogador escolhe o
 * cenario em vez de esperar o relogio.
 */
import * as THREE from 'three';
import { WORLD, WIND } from '../config.js';
import { clamp01, damp } from '../core/mathx.js';

export const PRESETS = {
  claro: {
    name: 'CEU LIMPO', time: 'tarde',
    rain: 0, wetness: 0, fog: 1.0, windScale: 1.0, night: 0,
  },
  chuva: {
    name: 'CHUVA', time: 'tarde',
    rain: 1.0, wetness: 1.0, fog: 2.6, windScale: 1.5, night: 0.25,
    payloadPenalty: 0.25,       // agua no chassis = peso extra
  },
  neblina: {
    name: 'NEBLINA BAIXA', time: 'amanhecer',
    rain: 0, wetness: 0.35, fog: 5.5, windScale: 0.8, night: 0.1,
    ceiling: 46,                // acima disto a visibilidade despenca
  },
  vendaval: {
    name: 'VENDAVAL', time: 'tarde',
    rain: 0.35, wetness: 0.6, fog: 1.8, windScale: 2.6, night: 0.1,
  },
  noite: {
    name: 'NOITE', time: 'noite',
    rain: 0, wetness: 0.2, fog: 1.4, windScale: 0.9, night: 1.0,
  },
  'noite-chuva': {
    name: 'NOITE COM CHUVA', time: 'noite',
    rain: 1.0, wetness: 1.0, fog: 3.0, windScale: 1.6, night: 1.0,
    payloadPenalty: 0.25,
  },
};

export function createWeather(scene, env, mats, city, life, settings) {
  const state = {
    preset: 'claro',
    rain: 0, wetness: 0, night: 0, fogMul: 1, windScale: 1, ceiling: 0,
  };

  // --- chuva: linhas verticais ao redor do drone, recicladas ---
  const COUNT = Math.max(200, Math.round(1600 * settings.particleScale));
  const positions = new Float32Array(COUNT * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xa9c4dd, transparent: true, opacity: 0, depthWrite: false,
  });
  const rain = new THREE.LineSegments(geo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const px = new Float32Array(COUNT);
  const py = new Float32Array(COUNT);
  const pz = new Float32Array(COUNT);
  const AREA = 46, TOP = 34;
  let seeded = false;

  function seed(i, c) {
    px[i] = c.x + (Math.random() - 0.5) * 2 * AREA;
    py[i] = c.y + Math.random() * TOP;
    pz[i] = c.z + (Math.random() - 0.5) * 2 * AREA;
  }

  function setPreset(id) {
    const p = PRESETS[id] || PRESETS.claro;
    state.preset = id;
    state.rain = p.rain;
    state.wetness = p.wetness;
    state.night = p.night;
    state.fogMul = p.fog;
    state.windScale = p.windScale;
    state.ceiling = p.ceiling || 0;

    env.setTimeOfDay(p.time);
    mats.setWetness(p.wetness);
    // O env map mudou de hora: quem guarda referencia precisa reapontar.
    mats.setEnvMap(env.envMap);
    city.setEnvMap(env.envMap);
    life.setEnvMap(env.envMap);

    // janelas e faroletes acendem a noite
    const lit = p.night;
    city.setWindowLight(lit * 1.5);
    mats.setWindowLight(lit * 1.5);
    life.setNight(lit > 0.4);

    rain.visible = p.rain > 0;
    WIND.enabled = true;
    return p;
  }

  /** Ajusta a nevoa por altura: neblina baixa cobre o topo das torres. */
  function update(dt, dronePos) {
    const base = WORLD.fogDensity * state.fogMul;
    let density = base;
    if (state.ceiling > 0) {
      // acima do teto de neblina a visibilidade despenca
      const above = clamp01((dronePos.y - state.ceiling) / 30);
      density = base * (1 + above * 3.2);
    }
    scene.fog.density = damp(scene.fog.density, density, 2.0, dt);

    if (state.rain > 0) {
      if (!seeded) { for (let i = 0; i < COUNT; i++) seed(i, dronePos); seeded = true; }
      const fall = 26 + state.rain * 12;
      for (let i = 0; i < COUNT; i++) {
        py[i] -= fall * dt;
        px[i] += 3.5 * dt * state.windScale;
        if (py[i] < dronePos.y - 6
          || Math.abs(px[i] - dronePos.x) > AREA
          || Math.abs(pz[i] - dronePos.z) > AREA) {
          seed(i, dronePos);
          py[i] = dronePos.y + TOP;
        }
        const o = i * 6;
        positions[o] = px[i]; positions[o + 1] = py[i]; positions[o + 2] = pz[i];
        positions[o + 3] = px[i] + 0.25;
        positions[o + 4] = py[i] - 1.1 - state.rain * 0.5;
        positions[o + 5] = pz[i];
      }
      geo.attributes.position.needsUpdate = true;
      rainMat.opacity = 0.16 + state.rain * 0.24;
    }
  }

  /** Multiplicador de vento do clima, combinado com o do distrito. */
  function windMultiplier(district) {
    return state.windScale * (district?.windScale || 1);
  }

  setPreset('claro');

  return {
    state, setPreset, update, windMultiplier,
    presets: PRESETS,
    get isNight() { return state.night > 0.5; },
    get payloadPenalty() { return (PRESETS[state.preset]?.payloadPenalty) || 0; },
    dispose() { scene.remove(rain); geo.dispose(); rainMat.dispose(); },
  };
}
