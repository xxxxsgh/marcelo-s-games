/**
 * O drone como entidade de jogo: fisica + modelo + colisao + bateria + crash.
 * Junta as pecas e e a unica coisa que o main precisa conhecer.
 */
import * as THREE from 'three';
import { createDronePhysics } from './physics.js';
import { createDroneModel } from './model.js';
import { DRONE, BATTERY } from '../config.js';
import { clamp01 } from '../core/mathx.js';

const _accel = new THREE.Vector3();
const _prevVel = new THREE.Vector3();
const _safe = new THREE.Vector3();

export function createDrone(scene, bus, envMap) {
  const physics = createDronePhysics();
  const model = createDroneModel(envMap);
  scene.add(model.root);

  const st = physics.state;

  const status = {
    battery: BATTERY.capacity,
    crashed: false,
    respawnTimer: 0,
    lastSafe: new THREE.Vector3(0, DRONE.spawnHeight, 0),
    lastSafeHeading: 0,
    payload: 0,          // kg de carga (Fase 4)
    noRisk: false,       // modo treino (Fase 6)
    crashCount: 0,
    distanceFlown: 0,
    contact: null,       // ultimo contato do passo
  };

  let safeTimer = 0;

  /** Um passo de fisica + colisao. Chamado no timestep fixo. */
  function step(dt, cmd, wind, colliders) {
    if (status.crashed) {
      status.respawnTimer -= dt;
      if (status.respawnTimer <= 0) respawn();
      return st;
    }

    _prevVel.copy(st.vel);
    physics.step(dt, cmd, wind);

    // --- bateria ---
    const th = Math.pow(st.throttleIn, BATTERY.throttleGamma);
    const drain = BATTERY.idleDrain + th * BATTERY.throttleDrain
      + status.payload * BATTERY.payloadDrain;
    status.battery = Math.max(0, status.battery - drain * dt);
    if (status.battery <= BATTERY.deadLevel) {
      // Sem bateria nao ha empuxo: o drone cai de verdade.
      st.motor = 0;
      cmd.throttle = 0;
    }

    status.distanceFlown += st.vel.length() * dt;

    // --- chao (respeitando aberturas: rampa de garagem, boca de tunel) ---
    status.contact = null;
    const overGround = !colliders?.hasGroundAt
      || colliders.hasGroundAt(st.pos.x, st.pos.z);
    if (overGround && st.pos.y - DRONE.radius < DRONE.groundY) {
      const impact = -st.vel.y;
      st.pos.y = DRONE.groundY + DRONE.radius;
      if (impact > DRONE.crashSpeed) { crash('chao', impact); return st; }
      st.vel.y = Math.abs(st.vel.y) * DRONE.crashRestitution;
      // atrito com o chao
      st.vel.x *= 0.92; st.vel.z *= 0.92;
      st.grounded = true;
    } else {
      st.grounded = false;
    }

    // --- geometria do mundo ---
    if (colliders) {
      const hit = colliders.resolveSphere(st.pos, DRONE.radius);
      if (hit.hit) {
        // velocidade de aproximacao ao longo da normal, ANTES da correcao
        const approach = -(_prevVel.x * hit.normal.x
          + _prevVel.y * hit.normal.y + _prevVel.z * hit.normal.z);
        status.contact = { tag: hit.tag, impact: approach, normal: hit.normal.clone() };
        if (approach > DRONE.crashSpeed) { crash(hit.tag, approach); return st; }
        // Raspao: mata a componente normal e perde energia.
        const vn = st.vel.dot(hit.normal);
        if (vn < 0) st.vel.addScaledVector(hit.normal, -vn * (1 + DRONE.crashRestitution));
        st.vel.multiplyScalar(0.86);
        st.angVel.multiplyScalar(0.7);
        bus.emit('drone:graze', { tag: hit.tag, impact: approach });
      }
    }

    // --- memoria de ponto seguro pro respawn ---
    safeTimer += dt;
    if (safeTimer > 0.5 && !status.contact && st.altitude > 1.0 && st.altitude < 90
        && st.speed < 26) {
      safeTimer = 0;
      status.lastSafe.copy(st.pos);
      const e = new THREE.Euler().setFromQuaternion(st.quat, 'YXZ');
      status.lastSafeHeading = e.y;
    }

    return st;
  }

  function crash(tag, impact) {
    if (status.noRisk) {
      // Modo treino: nao morre, so leva um empurrao e perde velocidade.
      st.vel.multiplyScalar(-0.25);
      st.angVel.multiplyScalar(0.3);
      bus.emit('drone:graze', { tag, impact });
      return;
    }
    status.crashed = true;
    status.crashCount++;
    status.respawnTimer = DRONE.respawnDelay;
    st.vel.multiplyScalar(0.15);
    st.angVel.set(
      (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9,
    );
    bus.emit('drone:crash', { tag, impact, position: st.pos.clone() });
  }

  function respawn(pos, heading) {
    _safe.copy(pos || status.lastSafe);
    if (_safe.y < DRONE.groundY + 1.0) _safe.y = DRONE.groundY + 1.4;
    physics.reset(_safe, heading !== undefined ? heading : status.lastSafeHeading);
    status.crashed = false;
    status.respawnTimer = 0;
    status.contact = null;
    bus.emit('drone:respawn', { position: _safe.clone() });
  }

  /** Reinicio total (corrida, missao): zera bateria e estado. */
  function reset(pos, heading = 0) {
    physics.reset(pos, heading);
    status.battery = BATTERY.capacity;
    status.crashed = false;
    status.respawnTimer = 0;
    status.crashCount = 0;
    status.distanceFlown = 0;
    status.lastSafe.copy(pos);
    status.lastSafeHeading = heading;
    bus.emit('drone:reset', { position: pos.clone() });
  }

  /** Sincroniza o visual com a fisica. Chamado no render, nao no passo fixo. */
  function updateVisual(dt) {
    model.root.position.copy(st.pos);
    model.root.quaternion.copy(st.quat);
    _accel.copy(st.vel).sub(_prevVel).multiplyScalar(60);
    model.update(dt, st, _accel);
  }

  return {
    physics, model, status,
    get state() { return st; },
    step, updateVisual, reset, respawn, crash,
    toggleMode: () => physics.toggleMode(),
    setMode: (m) => physics.setMode(m),
    recharge(dt) {
      status.battery = Math.min(BATTERY.capacity, status.battery + BATTERY.rechargeRate * dt);
    },
    get batteryRatio() { return clamp01(status.battery / BATTERY.capacity); },
    setEnvMap(env) { model.setEnvMap(env); },
    toggleHeadlight() { return model.setHeadlight(!model.headlightOn); },
    setHeadlight(on) { return model.setHeadlight(on); },
  };
}
