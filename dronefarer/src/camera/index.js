/**
 * Camera do jogo. Duas cabecas na mesma PerspectiveCamera:
 *
 *  CHASE (principal) — braco com mola atras do drone. Segue a DIRECAO DE VOO,
 *  nao o nariz: em derrapagem o drone aparece atravessado na tela, que e o que
 *  faz a 3a pessoa ficar bonita. Recua com a velocidade, recua mais em ACRO,
 *  antecipa a curva e nunca atravessa parede.
 *
 *  FPV (toggle na tecla C) — colada no corpo, com tilt e FOV largo.
 */
import * as THREE from 'three';
import { CAMERA, DRONE } from '../config.js';
import { clamp, clamp01, damp, dampVec, invLerp, smoothstep, lerp } from '../core/mathx.js';

const _fwd = new THREE.Vector3();
const _velDir = new THREE.Vector3();
const _boom = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _aimTarget = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _qTilt = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _shake = new THREE.Vector3();

export function createCameraRig(camera, colliders) {
  const cfg = CAMERA.chase;

  const rig = {
    mode: CAMERA.mode,               // 'chase' | 'fpv'
    pos: new THREE.Vector3(0, 3, 8),
    aim: new THREE.Vector3(),
    fov: cfg.fov,
    roll: 0,
    shake: 0,
    orbitYaw: 0,
    orbitPitch: 0,
    boomDistance: cfg.distance,      // distancia efetiva apos colisao
    collisionActive: false,
    fpvTilt: CAMERA.fpv.tilt,
    lensDistortion: 0,               // consumido pelo pass de lente
  };

  let orbitIdle = 0;

  /** Braço da camera a partir do estado do drone. */
  function chaseUpdate(dt, drone, mouse) {
    const st = drone.state;
    const isAcro = st.mode === 'acro';

    // --- 1. direcao de referencia: mistura nariz + vetor velocidade ---
    _fwd.set(0, 0, -1).applyQuaternion(st.quat);
    const speed = st.speed;
    let ref = _fwd;
    if (speed > cfg.flightDirMinSpeed) {
      _velDir.copy(st.vel).divideScalar(speed || 1);
      const t = smoothstep(invLerp(cfg.flightDirMinSpeed, cfg.flightDirFullSpeed, speed))
        * cfg.flightDirBlend;
      _tmp.copy(_fwd).lerp(_velDir, t);
      if (_tmp.lengthSq() > 1e-6) ref = _tmp.normalize();
    }

    // --- 2. braço pra tras, achatado e com teto de inclinacao ---
    _boom.copy(ref).multiplyScalar(-1);
    _boom.y = lerp(_boom.y, 0, cfg.boomFlatten);
    if (_boom.lengthSq() < 1e-6) _boom.set(0, 0, 1);
    _boom.normalize();

    // Teto duro: subindo na vertical o braço tentaria ficar embaixo do drone
    // e a tela viraria so ceu. Limita a inclinacao e reprojeta na horizontal.
    const yLimit = Math.sin(THREE.MathUtils.degToRad(cfg.boomPitchLimit));
    if (Math.abs(_boom.y) > yLimit) {
      _boom.y = clamp(_boom.y, -yLimit, yLimit);
      let hx = _boom.x, hz = _boom.z;
      let hLen = Math.hypot(hx, hz);
      if (hLen < 1e-4) {
        // Voo puramente vertical: nao ha direcao horizontal no vetor
        // velocidade, entao cai pro nariz do drone como referencia.
        hx = -_fwd.x; hz = -_fwd.z;
        hLen = Math.hypot(hx, hz);
        if (hLen < 1e-4) { hx = 0; hz = 1; hLen = 1; }  // nariz apontando pra cima
      }
      const want = Math.sqrt(Math.max(0, 1 - _boom.y * _boom.y)) / hLen;
      _boom.x = hx * want;
      _boom.z = hz * want;
    }

    // --- 3. orbita do mouse por cima do braço ---
    if (mouse && (mouse.dx || mouse.dy)) {
      rig.orbitYaw = clamp(
        rig.orbitYaw - mouse.dx * cfg.orbitSensitivity,
        -THREE.MathUtils.degToRad(cfg.orbitYawLimit),
        THREE.MathUtils.degToRad(cfg.orbitYawLimit),
      );
      rig.orbitPitch = clamp(
        rig.orbitPitch - mouse.dy * cfg.orbitSensitivity,
        -THREE.MathUtils.degToRad(cfg.orbitPitchLimit),
        THREE.MathUtils.degToRad(cfg.orbitPitchLimit),
      );
      orbitIdle = 0;
    } else {
      orbitIdle += dt;
      // Recentra sozinho depois de um tempinho sem mouse.
      if (orbitIdle > 0.6) {
        rig.orbitYaw = damp(rig.orbitYaw, 0, cfg.orbitRecenter, dt);
        rig.orbitPitch = damp(rig.orbitPitch, 0, cfg.orbitRecenter, dt);
      }
    }
    if (rig.orbitYaw || rig.orbitPitch) {
      _right.crossVectors(_boom, _up).normalize();
      _q.setFromAxisAngle(_up, rig.orbitYaw);
      _boom.applyQuaternion(_q);
      _q.setFromAxisAngle(_right, rig.orbitPitch);
      _boom.applyQuaternion(_q);
    }

    // --- 4. distancia e altura crescem com a velocidade ---
    const sp = clamp01(speed / cfg.fovSpeedRef);
    let dist = lerp(cfg.distance, cfg.distanceMax, sp);
    if (isAcro) dist += cfg.distanceAcroBonus;
    const height = lerp(cfg.height, cfg.heightMax, sp);

    _desired.copy(st.pos).addScaledVector(_boom, dist).addScaledVector(_up, height);

    // --- 5. colisao: nao deixa a camera entrar na parede ---
    _rayDir.copy(_desired).sub(st.pos);
    const wanted = _rayDir.length();
    if (wanted > 1e-4) {
      _rayDir.divideScalar(wanted);
      const hit = colliders ? colliders.raycast(st.pos, _rayDir, wanted + cfg.collisionPad) : null;
      if (hit && hit.hit) {
        const allowed = Math.max(cfg.collisionMin, hit.distance - cfg.collisionPad);
        // Encolhe na hora (nao pode atravessar), volta devagar.
        rig.boomDistance = Math.min(rig.boomDistance, allowed);
        rig.collisionActive = true;
      } else {
        rig.collisionActive = false;
      }
      rig.boomDistance = damp(rig.boomDistance, wanted, cfg.collisionRecover, dt);
      rig.boomDistance = clamp(rig.boomDistance, cfg.collisionMin, wanted);
      _desired.copy(st.pos).addScaledVector(_rayDir, rig.boomDistance);
    }

    // --- 6. mola de posicao (mais solta em ACRO, le melhor a rotacao) ---
    const posDamp = isAcro ? cfg.posDampAcro : cfg.posDamp;
    dampVec(rig.pos, _desired, posDamp, dt);
    // Nao deixa a camera afundar no chao — MAS so quando o drone esta acima
    // dele. Em garagem/tunel o drone voa abaixo do nivel da rua, e um clamp
    // incondicional arrancaria a camera pra fora pelo teto.
    const floor = DRONE.groundY + 0.35;
    if (st.pos.y > floor && rig.pos.y < floor) rig.pos.y = floor;

    // --- 7. mira com look-ahead: antecipa o voo e a curva ---
    _aimTarget.copy(st.pos);
    if (speed > 0.5) {
      _velDir.copy(st.vel).divideScalar(speed);
      _aimTarget.addScaledVector(_velDir, cfg.lookAhead * sp);
    }
    // yaw rate joga a mira pro lado de dentro da curva
    _right.set(1, 0, 0).applyQuaternion(st.quat);
    _aimTarget.addScaledVector(_right, -st.angVel.y * cfg.lookAheadTurn * 0.25);
    dampVec(rig.aim, _aimTarget, cfg.aimDamp, dt);

    // --- 8. FOV pela velocidade, com easing ---
    const fovTarget = lerp(cfg.fov, cfg.fovMax, sp);
    rig.fov = damp(rig.fov, fovTarget, cfg.fovDamp, dt);

    // --- 9. um tico de roll do drone, so pra dar estilo ---
    _tmp.set(1, 0, 0).applyQuaternion(st.quat);
    const rollAmount = Math.asin(clamp(_tmp.y, -1, 1));
    rig.roll = damp(rig.roll, rollAmount * cfg.rollInfluence, 6.0, dt);
    rig.lensDistortion = damp(rig.lensDistortion, 0, 8, dt);

    // --- 10. aplica na camera ---
    camera.position.copy(rig.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(rig.aim);
    if (rig.roll) camera.rotateZ(rig.roll);
  }

  /** FPV: colada no corpo, com tilt pra cima e FOV largo. */
  function fpvUpdate(dt, drone) {
    const st = drone.state;
    const f = CAMERA.fpv;

    _tmp.set(f.offset.x, f.offset.y, f.offset.z).applyQuaternion(st.quat).add(st.pos);
    dampVec(rig.pos, _tmp, f.damp, dt);

    // A camera FPV aponta ACIMA do eixo de avanco (tilt do drone real).
    _qTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(rig.fpvTilt));
    _q.copy(st.quat).multiply(_qTilt);

    camera.position.copy(rig.pos);
    camera.quaternion.slerp(_q, 1 - Math.exp(-f.damp * dt));

    const sp = clamp01(st.speed / cfg.fovSpeedRef);
    rig.fov = damp(rig.fov, lerp(f.fov, f.fovMax, sp * 0.6), 4.0, dt);
    rig.lensDistortion = damp(rig.lensDistortion, f.lensDistortion, 8, dt);
    rig.aim.copy(st.pos);
  }

  function update(dt, drone, mouse) {
    if (rig.mode === 'fpv') fpvUpdate(dt, drone);
    else chaseUpdate(dt, drone, mouse);

    // --- screen shake por cima de tudo ---
    if (rig.shake > 0.001) {
      const a = rig.shake;
      _shake.set(
        (Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a,
      ).multiplyScalar(0.42);
      camera.position.add(_shake);
      camera.rotateZ((Math.random() * 2 - 1) * a * 0.05);
      rig.shake = damp(rig.shake, 0, CAMERA.shakeDecay, dt);
    } else rig.shake = 0;

    if (Math.abs(camera.fov - rig.fov) > 0.01) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    rig,
    update,
    addShake(a) { rig.shake = Math.min(1.6, rig.shake + a); },
    toggleMode() {
      rig.mode = rig.mode === 'chase' ? 'fpv' : 'chase';
      rig.orbitYaw = 0; rig.orbitPitch = 0;
      return rig.mode;
    },
    setMode(m) { rig.mode = m; return rig.mode; },
    /** Reposiciona instantaneamente (respawn/restart, sem varrer o mapa). */
    snap(drone) {
      const st = drone.state;
      _fwd.set(0, 0, -1).applyQuaternion(st.quat);
      rig.pos.copy(st.pos).addScaledVector(_fwd, -cfg.distance).addScaledVector(_up, cfg.height);
      rig.aim.copy(st.pos);
      rig.boomDistance = cfg.distance;
      rig.shake = 0; rig.roll = 0;
      rig.orbitYaw = 0; rig.orbitPitch = 0;
      camera.position.copy(rig.pos);
      camera.up.set(0, 1, 0);
      camera.lookAt(rig.aim);
    },
  };
}
