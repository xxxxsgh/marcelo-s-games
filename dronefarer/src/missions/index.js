/**
 * Runner de missoes. Cinco tipos, todos em cima da cidade que ja existe.
 *
 * Cada tipo expoe o mesmo contrato — setup / step / cleanup — e escreve UMA
 * linha de objetivo. Falhar nunca abre tela de game over: reinicia rapido.
 */
import * as THREE from 'three';
import { MISSIONS, getMission, MISSION_TYPES } from './defs.js';
import { createRng } from '../core/rng.js';
import { clamp01 } from '../core/mathx.js';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/** Marcador flutuante reutilizavel. */
function makeMarker(color, radius = 1.2) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.11, 6, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  g.add(ring, core);
  g.userData.ring = ring;
  return g;
}

export function createMissions(scene, bus, save, drone, camera, race) {
  const root = new THREE.Group();
  root.name = 'missions';
  scene.add(root);

  const state = {
    active: null,           // definicao da missao
    objective: '',          // UMA linha, sempre
    progress: 0,            // 0..1
    detail: '',             // numero/curto (ex "2/4")
    status: 'idle',         // 'idle' | 'running' | 'done' | 'failed'
    elapsed: 0,
    payload: 0,
    heat: 0,                // busca: 0..1 de proximidade
    holdMeter: 0,           // inspecao/vigilancia
  };

  let markers = [];
  let targets = [];
  let captured = 0;
  let targetCar = null;
  let carT = 0;

  function clearVisuals() {
    for (const m of markers) root.remove(m);
    markers = [];
    if (targetCar) { root.remove(targetCar); targetCar = null; }
    targets = [];
  }

  /** True quando `point` esta enquadrado: dentro do cone e da faixa de distancia. */
  function framed(point, minDist, maxDist, coneDeg) {
    _v.copy(point).sub(camera.position);
    const d = _v.length();
    if (d < minDist || d > maxDist) return { ok: false, d, reason: d < minDist ? 'perto' : 'longe' };
    _v.divideScalar(d);
    camera.getWorldDirection(_fwd);
    const cos = _fwd.dot(_v);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    return { ok: ang <= coneDeg, d, angle: ang, reason: 'mira' };
  }

  // ------------------------------------------------------------------
  // SETUP por tipo
  // ------------------------------------------------------------------
  const setup = {
    corrida(m) {
      race.load(m.circuit);
      state.objective = m.brief;
      state.detail = `0/${race.gates.length}`;
    },

    inspecao(m) {
      captured = 0;
      for (const p of m.points) {
        const mk = makeMarker(0x5be08a, 1.3);
        mk.position.set(p.x, p.y, p.z);
        root.add(mk);
        markers.push(mk);
        targets.push({ pos: new THREE.Vector3(p.x, p.y, p.z), done: false, meter: 0 });
      }
      state.objective = m.brief;
      state.detail = `0/${m.points.length}`;
    },

    entrega(m) {
      state.payload = 0;
      const pick = makeMarker(0xffb03a, m.pickup.r * 0.6);
      pick.position.set(m.pickup.x, m.pickup.y, m.pickup.z);
      const drop = makeMarker(0x37d5ff, m.dropoff.r);
      drop.position.set(m.dropoff.x, m.dropoff.y, m.dropoff.z);
      drop.visible = false;
      root.add(pick, drop);
      markers.push(pick, drop);
      targets.push({ phase: 'pickup', pick, drop });
      state.objective = 'Pegue a encomenda no ponto marcado.';
      state.detail = 'COLETA';
    },

    busca(m) {
      // O alvo fica num dos candidatos, sorteado com semente estavel por
      // missao: a mesma missao esconde no mesmo lugar entre tentativas.
      const rng = createRng(`busca-${m.id}`);
      const idx = rng.int(0, m.candidates - 1);
      let hidden = null;
      for (let i = 0; i < m.candidates; i++) {
        const a = rng.float(0, Math.PI * 2);
        const r = rng.float(m.area.r * 0.25, m.area.r);
        const p = new THREE.Vector3(
          m.area.x + Math.cos(a) * r, 2.5, m.area.z + Math.sin(a) * r,
        );
        if (i === idx) hidden = p;
      }
      const mk = makeMarker(0xc08aff, 2.2);
      mk.position.copy(hidden);
      mk.visible = false;             // so aparece quando esta perto
      root.add(mk);
      markers.push(mk);
      targets.push({ pos: hidden, marker: mk });
      state.objective = m.brief;
      state.detail = 'SEM SINAL';
    },

    vigilancia(m) {
      // Carro-alvo com rota propria: um retangulo pelas ruas do centro.
      const geo = new THREE.BoxGeometry(1.9, 1.5, 4.4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.7, roughness: 0.35 });
      targetCar = new THREE.Mesh(geo, mat);
      targetCar.castShadow = true;
      root.add(targetCar);
      carT = 0;
      targets.push({ hold: 0, detected: 0 });
      state.objective = m.brief;
      state.detail = `0/${m.holdTotal}s`;
    },
  };

  // ------------------------------------------------------------------
  // STEP por tipo
  // ------------------------------------------------------------------
  const step = {
    corrida(m, dt) {
      state.detail = `${race.state.gateIndex}/${race.gates.length}`;
      state.progress = race.progress;
      if (race.state.status === 'finished') {
        if (race.state.medal) complete(m);
        else fail('Fora do tempo de bronze.');
      }
    },

    inspecao(m, dt) {
      let best = null;
      for (const t of targets) {
        if (t.done) continue;
        const f = framed(t.pos, m.minDist, m.maxDist, m.coneDeg);
        if (f.ok) {
          t.meter = Math.min(m.holdTime, t.meter + dt);
          if (t.meter >= m.holdTime) {
            t.done = true;
            captured++;
            bus.emit('mission:capture', { index: captured, total: targets.length });
          }
        } else {
          t.meter = Math.max(0, t.meter - dt * 1.6);
        }
        if (!best || t.meter > best.meter) best = t;
      }
      state.holdMeter = best ? best.meter / m.holdTime : 0;
      state.detail = `${captured}/${targets.length}`;
      state.progress = captured / targets.length;

      // marcador vira "capturado"
      targets.forEach((t, i) => {
        const mk = markers[i];
        if (!mk) return;
        mk.userData.ring.material.color.setHex(t.done ? 0x2f7a4a : 0x5be08a);
        mk.scale.setScalar(1 + (t.meter / m.holdTime) * 0.35);
      });

      if (captured >= targets.length) complete(m);
    },

    entrega(m, dt) {
      const t = targets[0];
      const p = drone.state.pos;
      if (t.phase === 'pickup') {
        _v.set(m.pickup.x, m.pickup.y, m.pickup.z);
        state.detail = `${_v.distanceTo(p).toFixed(0)} M`;
        if (_v.distanceTo(p) < m.pickup.r) {
          t.phase = 'carry';
          state.payload = m.payload;
          drone.status.payload = m.payload;
          t.pick.visible = false;
          t.drop.visible = true;
          state.objective = `Pouse na laje marcada abaixo de ${m.landSpeed} m/s.`;
          bus.emit('mission:pickup', m);
        }
      } else {
        _v.set(m.dropoff.x, m.dropoff.y, m.dropoff.z);
        const d = _v.distanceTo(p);
        state.detail = `${d.toFixed(0)} M`;
        state.progress = clamp01(1 - d / 400);
        if (d < m.dropoff.r && drone.state.speed < m.landSpeed) {
          drone.status.payload = 0;
          state.payload = 0;
          complete(m);
        }
      }
    },

    busca(m, dt) {
      const t = targets[0];
      const d = t.pos.distanceTo(drone.state.pos);
      // "sinal termico": esquenta perto. E a unica pista — nao ha seta.
      state.heat = clamp01(1 - d / (m.area.r * 1.1));
      state.progress = state.heat;
      state.detail = state.heat < 0.25 ? 'SEM SINAL'
        : state.heat < 0.55 ? 'SINAL FRACO'
          : state.heat < 0.85 ? 'ESQUENTANDO' : 'MUITO PERTO';
      t.marker.visible = d < 60;
      if (d < m.findRadius) complete(m);
    },

    vigilancia(m, dt) {
      const t = targets[0];
      // rota retangular pelas ruas
      carT += dt * 0.055;
      const u = carT % 1;
      const L = 300;
      let x, z, ang;
      if (u < 0.25) { x = -L / 2 + (u / 0.25) * L; z = -L / 2; ang = Math.PI / 2; }
      else if (u < 0.5) { x = L / 2; z = -L / 2 + ((u - 0.25) / 0.25) * L; ang = Math.PI; }
      else if (u < 0.75) { x = L / 2 - ((u - 0.5) / 0.25) * L; z = L / 2; ang = -Math.PI / 2; }
      else { x = -L / 2; z = L / 2 - ((u - 0.75) / 0.25) * L; ang = 0; }
      targetCar.position.set(x, 0.8, z);
      targetCar.rotation.y = ang;

      const f = framed(targetCar.position, m.minDist, m.maxDist, m.coneDeg);
      const dist = f.d;
      if (dist < m.detectDist) {
        // chegou perto demais: o motorista percebe
        t.detected += dt;
        state.detail = 'PERTO DEMAIS';
        if (t.detected > 2.5) fail('Voce foi detectado.');
      } else {
        t.detected = Math.max(0, t.detected - dt * 0.5);
        if (f.ok) {
          t.hold += dt;
          state.detail = `${t.hold.toFixed(0)}/${m.holdTotal}s`;
        } else {
          state.detail = f.reason === 'longe' ? 'LONGE DEMAIS' : 'PERDEU O ENQUADRAMENTO';
        }
      }
      state.holdMeter = clamp01(t.hold / m.holdTotal);
      state.progress = state.holdMeter;
      if (t.hold >= m.holdTotal) complete(m);
    },
  };

  // ------------------------------------------------------------------
  function start(id) {
    const m = getMission(id);
    if (!m) return null;
    abort();
    state.active = m;
    state.status = 'running';
    state.elapsed = 0;
    state.progress = 0;
    state.heat = 0;
    state.holdMeter = 0;
    setup[m.type](m);
    bus.emit('mission:start', m);
    return m;
  }

  function complete(m) {
    if (state.status !== 'running') return;
    state.status = 'done';
    state.progress = 1;
    const record = save.data.missions[m.id] || {};
    const first = !record.done;
    save.data.missions[m.id] = {
      done: true,
      best: record.best === undefined ? state.elapsed : Math.min(record.best, state.elapsed),
    };
    // primeira vez paga cheio; repetir paga metade
    const paid = Math.round(m.reward * (first ? 1 : 0.5));
    save.addMoney(paid);
    drone.status.payload = 0;
    bus.emit('mission:complete', { mission: m, reward: paid, first, time: state.elapsed });
  }

  function fail(reason) {
    if (state.status !== 'running') return;
    state.status = 'failed';
    drone.status.payload = 0;
    state.payload = 0;
    bus.emit('mission:fail', { mission: state.active, reason });
  }

  function abort() {
    clearVisuals();
    captured = 0;
    drone.status.payload = 0;
    state.payload = 0;
    state.active = null;
    state.status = 'idle';
    state.objective = '';
    state.detail = '';
    state.progress = 0;
  }

  /** Refaz a missao atual do zero (R durante missao). */
  function retry() {
    const m = state.active;
    if (!m) return null;
    return start(m.id);
  }

  function update(dt) {
    if (state.status !== 'running' || !state.active) return;
    state.elapsed += dt;
    step[state.active.type](state.active, dt);
  }

  function animate(dt, t) {
    for (const m of markers) {
      if (!m.visible) continue;
      m.rotation.y += dt * 0.9;
      m.userData.ring.material.opacity = 0.55 + Math.sin(t * 2.4) * 0.3;
    }
  }

  /** Missoes liberadas pelos upgrades que o jogador tem. */
  function available() {
    const up = save.data.upgrades || {};
    return MISSIONS.map((m) => ({
      ...m,
      locked: !!m.requires && !up[m.requires.replace(/\d+$/, '')],
      done: !!(save.data.missions[m.id] || {}).done,
    }));
  }

  return {
    state, root, start, abort, retry, update, animate, available,
    missions: MISSIONS, types: MISSION_TYPES,
    get isActive() { return state.status === 'running'; },
    dispose() { clearVisuals(); scene.remove(root); },
  };
}
