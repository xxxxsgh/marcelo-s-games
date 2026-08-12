/**
 * Pontos de interesse, zonas restritas, recarga e alcance de radio.
 *
 * Sao estes sistemas que transformam "cidade bonita" em "cidade com aposta":
 * ir longe custa sinal, entrar onde nao devia custa perseguicao, e a bateria
 * so volta em lugar que voce precisa ter descoberto.
 */
import * as THREE from 'three';
import { BATTERY } from '../config.js';
import { clamp01, damp } from '../core/mathx.js';

const S = 120;

/** POIs com posicao fixa: a cidade e sempre a mesma, o mapa tambem. */
export const POIS = [
  { id: 'torre-tv', name: 'TORRE DE TV', x: 60, z: 60, y: 96, district: 'centro',
    challenge: 'Circule a antena sem tocar nos cabos.' },
  { id: 'mirante', name: 'MIRANTE', x: 430, z: 40, y: 78, district: 'morro',
    challenge: 'Chegue ao mirante em 40 s partindo da base.' },
  { id: 'estadio', name: 'ESTADIO', x: -260, z: 300, y: 34, district: 'parque',
    challenge: 'Passe por dentro do vao central.' },
  { id: 'ponte', name: 'PONTE', x: 120, z: 400, y: 26, district: 'parque',
    challenge: 'Voe por baixo do tabuleiro.' },
  { id: 'farol', name: 'FAROL', x: -80, z: -430, y: 42, district: 'portuaria',
    challenge: 'Toque o feixe de luz no topo.' },
  { id: 'terminal', name: 'TERMINAL DE CARGA', x: 180, z: -380, y: 20, district: 'portuaria',
    challenge: 'Slalom entre os guindastes.' },
  { id: 'mercado', name: 'MERCADO', x: -300, z: 90, y: 14, district: 'antigo',
    challenge: 'Atravesse o corredor de toldos sem raspar.' },
];

/** Zonas restritas: entrar dispara alerta, timer e perseguicao. */
export const RESTRICTED = [
  { id: 'aeroporto', name: 'AEROPORTO', x: 330, z: -420, r: 150, tolerance: 3.0 },
  { id: 'presidio', name: 'PRESIDIO', x: -420, z: -180, r: 105, tolerance: 2.0 },
  { id: 'corporativa', name: 'SEDE CORPORATIVA', x: 40, z: -60, r: 78, tolerance: 4.0 },
];

/** Pontos de recarga — precisam ser descobertos. */
export const RECHARGE = [
  { id: 'base', name: 'BASE', x: 0, z: 0, y: 26, r: 9 },
  { id: 'rec-norte', name: 'SUBESTACAO NORTE', x: 90, z: -260, y: 18, r: 7 },
  { id: 'rec-oeste', name: 'POSTE OESTE', x: -340, z: 20, y: 12, r: 7 },
  { id: 'rec-morro', name: 'LAJE DO MORRO', x: 400, z: 120, y: 46, r: 7 },
  { id: 'rec-orla', name: 'QUIOSQUE DA ORLA', x: -60, z: 420, y: 10, r: 7 },
];

export const RADIO = {
  base: new THREE.Vector3(0, 26, 0),
  range: 520,          // m de sinal limpo
  falloff: 340,        // m de degradacao ate perder de vez
  indoorPenalty: 0.55, // quanto o sinal cai dentro de garagem/tunel
  antennaBonus: 0,     // aumentado pelos upgrades (Fase 5)
};

export function createPoiSystem(scene, bus, save, colliders) {
  const root = new THREE.Group();
  root.name = 'pois';
  scene.add(root);

  const discovered = new Set(save.get('discovered', []));
  const markers = [];

  // --- marcadores visuais dos POIs (feixe vertical, visivel de longe) ---
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 60, 6, 1, true);
  for (const p of POIS) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x37d5ff, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, mat);
    beam.position.set(p.x, p.y + 20, p.z);
    beam.visible = discovered.has(p.id);
    root.add(beam);
    markers.push({ poi: p, beam, mat });
  }

  // --- recarga: anel no chao ---
  const ringGeo = new THREE.TorusGeometry(3.0, 0.18, 6, 24);
  ringGeo.rotateX(-Math.PI / 2);
  for (const r of RECHARGE) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x5be08a, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(r.x, r.y, r.z);
    root.add(ring);
    r.mesh = ring;
    r.mat = mat;
  }

  const state = {
    signal: 1,             // 1 = limpo, 0 = perdido
    indoor: false,
    inRestricted: null,
    alertLevel: 0,         // 0..1 — passa de 1 e dispara perseguicao
    alertTimer: 0,
    chasing: false,
    recharging: null,
    nearestPoi: null,
    discovered,
  };

  const _v = new THREE.Vector3();

  function discover(poi) {
    if (discovered.has(poi.id)) return false;
    discovered.add(poi.id);
    save.set('discovered', [...discovered]);
    const m = markers.find((x) => x.poi.id === poi.id);
    if (m) m.beam.visible = true;
    bus.emit('poi:discovered', poi);
    return true;
  }

  /**
   * @param pos posicao do drone
   * @param dt  delta do passo fixo
   * @param los true se ha linha de visada razoavel (usado pra descoberta)
   */
  function update(dt, pos, drone) {
    // --- sinal de radio ---
    const distBase = pos.distanceTo(RADIO.base);
    const range = RADIO.range + RADIO.antennaBonus;
    let sig = 1 - clamp01((distBase - range) / RADIO.falloff);
    // dentro de estrutura fechada (garagem/tunel): o teto come o sinal
    state.indoor = !colliders.hasGroundAt(pos.x, pos.z) && pos.y < 0.5;
    if (state.indoor) sig *= 1 - RADIO.indoorPenalty;
    state.signal = damp(state.signal, clamp01(sig), 3.5, dt);

    // --- POIs: descobre por proximidade/avistamento ---
    let nearest = null, nd = Infinity;
    for (const { poi } of markers) {
      _v.set(poi.x, poi.y, poi.z);
      const d = _v.distanceTo(pos);
      if (d < nd) { nd = d; nearest = poi; }
      if (d < 130) discover(poi);
    }
    state.nearestPoi = nearest ? { poi: nearest, distance: nd } : null;

    // --- zona restrita ---
    let inside = null;
    for (const z of RESTRICTED) {
      const dx = pos.x - z.x, dz = pos.z - z.z;
      if (dx * dx + dz * dz < z.r * z.r) { inside = z; break; }
    }
    if (inside !== state.inRestricted) {
      state.inRestricted = inside;
      if (inside) bus.emit('zone:enter', inside);
      else bus.emit('zone:exit', null);
    }
    if (inside) {
      // tolerancia: da alguns segundos antes do alerta virar perseguicao
      state.alertTimer += dt;
      state.alertLevel = clamp01(state.alertTimer / inside.tolerance);
      if (state.alertLevel >= 1 && !state.chasing) {
        state.chasing = true;
        bus.emit('zone:alarm', inside);
      }
    } else {
      state.alertTimer = Math.max(0, state.alertTimer - dt * 1.6);
      state.alertLevel = clamp01(state.alertTimer / 3);
      if (state.chasing && state.alertTimer <= 0) {
        state.chasing = false;
        bus.emit('zone:clear', null);
      }
    }

    // --- recarga ---
    state.recharging = null;
    for (const r of RECHARGE) {
      _v.set(r.x, r.y, r.z);
      if (_v.distanceTo(pos) < r.r) {
        state.recharging = r;
        drone.recharge(dt);
        if (!discovered.has(r.id)) {
          discovered.add(r.id);
          save.set('discovered', [...discovered]);
          bus.emit('poi:discovered', r);
        }
        break;
      }
    }
  }

  /** Animacao dos marcadores (render, nao passo fixo). */
  function animate(dt, t) {
    for (const m of markers) {
      if (!m.beam.visible) continue;
      m.mat.opacity = 0.10 + Math.sin(t * 1.6 + m.poi.x) * 0.06;
    }
    for (const r of RECHARGE) {
      if (!r.mat) continue;
      const pulse = 0.4 + Math.sin(t * 3 + r.x) * 0.2;
      r.mat.opacity = state.recharging === r ? 0.9 : pulse;
      r.mesh.rotation.y += dt * (state.recharging === r ? 2.4 : 0.4);
    }
  }

  return {
    root, state, update, animate, discover,
    isDiscovered: (id) => discovered.has(id),
    pois: POIS, restricted: RESTRICTED, recharge: RECHARGE,
    resetAlert() { state.alertTimer = 0; state.alertLevel = 0; state.chasing = false; },
    dispose() { scene.remove(root); beamGeo.dispose(); ringGeo.dispose(); },
  };
}

/**
 * Drones de seguranca: perseguem quando o alarme dispara.
 * Comportamento simples de proposito — a tensao vem de estar sendo seguido
 * enquanto se pilota apertado, nao de uma IA elaborada.
 */
export function createSecurity(scene, bus, droneModel) {
  const units = [];
  const root = new THREE.Group();
  scene.add(root);
  const _dir = new THREE.Vector3();

  function spawn(zone, count = 3) {
    despawn();
    for (let i = 0; i < count; i++) {
      const mesh = droneModel.makeGhost(0.95);
      mesh.traverse((o) => {
        if (o.isMesh && o.material) o.material.color.setHex(0xff3d5a);
      });
      const a = (i / count) * Math.PI * 2;
      mesh.position.set(zone.x + Math.cos(a) * zone.r * 0.6, 26,
        zone.z + Math.sin(a) * zone.r * 0.6);
      root.add(mesh);
      units.push({ mesh, vel: new THREE.Vector3(), speed: 17 + i * 2.5 });
    }
    bus.emit('security:spawn', { zone, count });
  }

  function despawn() {
    for (const u of units) root.remove(u.mesh);
    units.length = 0;
  }

  function update(dt, target) {
    if (!units.length) return null;
    let closest = Infinity;
    for (const u of units) {
      _dir.copy(target).sub(u.mesh.position);
      const d = _dir.length();
      closest = Math.min(closest, d);
      if (d > 0.01) _dir.divideScalar(d);
      // persegue com aceleracao limitada: da pra despistar em curva apertada
      u.vel.addScaledVector(_dir, u.speed * dt * 1.8);
      if (u.vel.length() > u.speed) u.vel.setLength(u.speed);
      u.vel.multiplyScalar(0.985);
      u.mesh.position.addScaledVector(u.vel, dt);
      u.mesh.lookAt(target);
    }
    return closest;
  }

  return { spawn, despawn, update, get count() { return units.length; } };
}
