/**
 * Vento com rajadas. Fase 1 entrega o vento base + rajada + gradiente de
 * altitude; a Fase 6 pluga a turbulencia urbana (canyon, esquina, termica).
 */
import * as THREE from 'three';
import { WIND, deg } from '../config.js';
import { valueNoise2 } from '../core/rng.js';
import { clamp01 } from '../core/mathx.js';

export function createWind(seed = 1) {
  const vec = new THREE.Vector3();
  let t = 0;
  const base = new THREE.Vector3(
    Math.cos(deg(WIND.baseDirection)), 0, Math.sin(deg(WIND.baseDirection)),
  );

  // Modificadores que a Fase 6 liga/desliga.
  const mods = { canyon: 0, corner: 0, thermal: 0, rotorWash: 0, stormScale: 1 };

  /** Vento no ponto `pos` no instante atual. Retorna vetor compartilhado. */
  function sample(pos) {
    if (!WIND.enabled) return vec.set(0, 0, 0);

    // Rajada: ruido lento no tempo, coerente no espaco.
    const gx = pos.x * 0.004 + t * WIND.gustFrequency;
    const gz = pos.z * 0.004 - t * WIND.gustFrequency * 0.7;
    const gust = valueNoise2(seed, gx, gz) * 2 - 1;
    // Turbulencia de alta frequencia por cima da rajada.
    const turb = (valueNoise2(seed + 7, gx * 6.1, gz * 6.1) * 2 - 1) * WIND.gustTurbulence;

    const alt = Math.max(0, pos.y);
    const altMul = 1 + alt * WIND.altitudeFactor;
    const strength = (WIND.baseSpeed + gust * WIND.gustSpeed) * altMul * mods.stormScale;

    vec.copy(base).multiplyScalar(strength);
    // A turbulencia sacode nos tres eixos, senao vira "empurrao" e nao rajada.
    vec.x += turb * WIND.gustSpeed * 0.5;
    vec.z += turb * WIND.gustSpeed * 0.5;
    vec.y += (valueNoise2(seed + 13, gx * 3.3, gz * 3.3) * 2 - 1) * WIND.gustSpeed * 0.35;

    // --- modificadores urbanos (Fase 6) ---
    if (mods.canyon > 0) vec.multiplyScalar(1 + mods.canyon * (WIND.canyonBoost - 1));
    if (mods.corner > 0) {
      vec.x += Math.cos(t * 2.1) * WIND.cornerGust * mods.corner;
      vec.z += Math.sin(t * 1.7) * WIND.cornerGust * mods.corner;
    }
    if (mods.thermal > 0) vec.y += WIND.thermalRise * mods.thermal;
    if (mods.rotorWash > 0) vec.y -= WIND.rotorWash * mods.rotorWash;
    return vec;
  }

  return {
    sample,
    mods,
    update(dt) { t += dt; },
    /** 0..1 — quanto do vento "sente-se" como rajada agora (HUD/audio). */
    gustiness(pos) {
      const g = valueNoise2(seed, pos.x * 0.004 + t * WIND.gustFrequency, pos.z * 0.004);
      return clamp01(Math.abs(g * 2 - 1));
    },
    get time() { return t; },
  };
}
