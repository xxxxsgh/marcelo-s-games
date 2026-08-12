/**
 * Modelo de voo do drone — arcade, nao simulador, mas com as causas certas.
 *
 * Convencoes (espaco local do drone):
 *   frente = -Z   |   cima = +Y   |   direita = +X
 *   angVel e em rad/s no espaco do CORPO (x = pitch, y = yaw, z = roll)
 *
 * A mecanica central "inclinar pra frente ganha velocidade e perde altura" NAO
 * e roteirizada: o empuxo sempre aponta no +Y do corpo, entao inclinar rouba
 * componente vertical (cos do angulo) e doa componente horizontal (sen). Perder
 * sustentacao em angulo alto e consequencia, nao regra especial.
 *
 * Controle de atitude em cascata, igual a um flight controller de verdade:
 *   ANGLE -> erro de atitude vira comando de RATE -> loop de rate persegue
 *   ACRO  -> o stick E o comando de rate, sem loop externo
 */
import * as THREE from 'three';
import { DRONE, deg } from '../config.js';
import { clamp, clamp01 } from '../core/mathx.js';

const _up = new THREE.Vector3(0, 1, 0);
const _bodyUp = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _air = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _qTarget = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _qErr = new THREE.Quaternion();
const _errBody = new THREE.Vector3();
const _targetOmega = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _prevVel = new THREE.Vector3();

/**
 * Throttle que sustenta o drone parado no ar.
 * empuxo = throttle^gamma * twr * g  =>  peso quando throttle^gamma = 1/twr.
 * Nascer aqui evita que o drone despenque no instante em que a partida comeca.
 */
export function hoverThrottle() {
  return Math.pow(1 / DRONE.twr, 1 / DRONE.motorGamma);
}

export function createDronePhysics() {
  const s = {
    pos: new THREE.Vector3(0, DRONE.spawnHeight, 0),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    angVel: new THREE.Vector3(),
    motor: 0,               // throttle ja com spool-up (0..1)
    mode: 'angle',          // 'angle' | 'acro'
    yawTarget: 0,           // heading desejado em ANGLE (rad)

    // --- telemetria (HUD, camera, audio, fx) ---
    speed: 0, hSpeed: 0, vSpeed: 0, airspeed: 0,
    altitude: 0, tilt: 0, gforce: 1,
    thrustAccel: 0, throttleIn: 0,
    grounded: false,
    // multiplicadores externos (upgrades da Fase 5, dano da Fase 6)
    massScale: 1, thrustScale: 1, agilityScale: 1, dragScale: 1,
    torqueBias: new THREE.Vector3(), // helice quebrada puxa pra um lado
  };

  const maxAcro = new THREE.Vector3(
    deg(DRONE.acroRates.pitch), deg(DRONE.acroRates.yaw), deg(DRONE.acroRates.roll),
  );

  /** Curva de expo dos rates: precisao no centro sem perder o extremo. */
  function rateCurve(v, expo) {
    const a = Math.abs(v);
    return Math.sign(v) * (a * a * a * expo + a * (1 - expo));
  }

  /** Integra o quaternion com a velocidade angular do CORPO. */
  function integrateRotation(dt) {
    const { x: wx, y: wy, z: wz } = s.angVel;
    const q = s.quat;
    // dq = 0.5 * q (x) omega
    const dx = q.w * wx + q.y * wz - q.z * wy;
    const dy = q.w * wy + q.z * wx - q.x * wz;
    const dz = q.w * wz + q.x * wy - q.y * wx;
    const dw = -(q.x * wx + q.y * wy + q.z * wz);
    const h = 0.5 * dt;
    q.set(q.x + dx * h, q.y + dy * h, q.z + dz * h, q.w + dw * h).normalize();
  }

  /** Calcula o rate alvo conforme o modo de voo. */
  function computeTargetOmega(cmd, dt) {
    const agility = DRONE.acroAgility * s.agilityScale;

    if (s.mode === 'acro') {
      // O stick E o rate. Rotacao livre, sem auto-nivelamento, 360 graus.
      _targetOmega.set(
        -rateCurve(cmd.pitch, DRONE.acroExpo) * maxAcro.x,
        -rateCurve(cmd.yaw, DRONE.acroExpo) * maxAcro.y,
        -rateCurve(cmd.roll, DRONE.acroExpo) * maxAcro.z,
      );
      // Mantem o heading de referencia sincronizado, pra troca ACRO->ANGLE
      // nao dar um solavanco de yaw.
      _euler.setFromQuaternion(s.quat, 'YXZ');
      s.yawTarget = _euler.y;
      return agility;
    }

    // --- ANGLE: auto-nivela ---
    const yawRate = -cmd.yaw * deg(DRONE.angleYawRate);
    s.yawTarget += yawRate * dt;

    const maxTilt = deg(DRONE.angleMaxTilt);
    // euler.x > 0 = nariz pra cima; euler.z > 0 = rola pra esquerda.
    _euler.set(-cmd.pitch * maxTilt, s.yawTarget, -cmd.roll * maxTilt, 'YXZ');
    _qTarget.setFromEuler(_euler);

    // Erro como quaternion -> eixo-angulo -> vetor no espaco do corpo.
    _qInv.copy(s.quat).invert();
    _qErr.copy(_qTarget).multiply(_qInv);
    if (_qErr.w < 0) { _qErr.x *= -1; _qErr.y *= -1; _qErr.z *= -1; _qErr.w *= -1; }
    const sinHalf = Math.sqrt(Math.max(0, 1 - _qErr.w * _qErr.w));
    const angle = 2 * Math.acos(clamp(_qErr.w, -1, 1));
    if (sinHalf > 1e-6) {
      _errBody.set(_qErr.x, _qErr.y, _qErr.z).multiplyScalar(angle / sinHalf);
    } else {
      _errBody.set(0, 0, 0);
    }
    _errBody.applyQuaternion(_qInv); // erro do mundo -> corpo

    // PD externo: erro de atitude vira comando de rate.
    _targetOmega.copy(_errBody).multiplyScalar(DRONE.angleP)
      .addScaledVector(s.angVel, -DRONE.angleD);
    // Yaw ganha feedforward do stick: resposta imediata, sem esperar o erro.
    _targetOmega.y += yawRate;

    _targetOmega.x = clamp(_targetOmega.x, -maxAcro.x, maxAcro.x);
    _targetOmega.y = clamp(_targetOmega.y, -maxAcro.y, maxAcro.y);
    _targetOmega.z = clamp(_targetOmega.z, -maxAcro.z, maxAcro.z);
    return agility;
  }

  /**
   * Um passo de fisica. `cmd` = {throttle, pitch, roll, yaw, brake}.
   * `wind` = THREE.Vector3 de velocidade do ar no mundo (pode ser null).
   */
  function step(dt, cmd, wind) {
    _prevVel.copy(s.vel);
    s.throttleIn = clamp01(cmd.throttle);

    // --- 1. motor com spool-up: nao responde instantaneo ---
    const demanded = Math.pow(s.throttleIn, DRONE.motorGamma);
    const spool = 1 - Math.exp(-dt / DRONE.motorSpool);
    s.motor += (demanded - s.motor) * spool;

    // --- 2. atitude -> rate alvo -> velocidade angular ---
    const agility = computeTargetOmega(cmd, dt);
    const k = 1 - Math.exp(-agility * dt);
    s.angVel.lerp(_targetOmega, k);
    // Inercia residual: a rotacao continua um pouco depois de soltar o stick.
    const residual = Math.pow(DRONE.angularDamping, dt * 60);
    s.angVel.multiplyScalar(residual + (1 - residual) * 1.0);
    // Helice danificada (Fase 6) empurra um torque parasita constante.
    s.angVel.addScaledVector(s.torqueBias, dt);

    integrateRotation(dt);

    // --- 3. forcas ---
    _bodyUp.copy(_up).applyQuaternion(s.quat);
    // Empuxo SEMPRE no eixo do corpo: inclinar troca sustentacao por avanco.
    s.thrustAccel = s.motor * DRONE.twr * DRONE.gravity * s.thrustScale / s.massScale;
    _accel.copy(_bodyUp).multiplyScalar(s.thrustAccel);
    _accel.y -= DRONE.gravity;

    // --- 4. arrasto sobre a velocidade DO AR, nao a do solo ---
    _air.copy(s.vel);
    if (wind) _air.sub(wind);
    s.airspeed = _air.length();
    _tmp.copy(_air).applyQuaternion(_qInv.copy(s.quat).invert()); // ar no corpo
    const brakeMul = cmd.brake ? 3.0 : 1.0;
    const dl = DRONE.dragLinear, dq = DRONE.dragQuadratic;
    const dragScale = s.dragScale * brakeMul;
    _tmp.set(
      -(dl.x * _tmp.x + dq.x * Math.abs(_tmp.x) * _tmp.x) * dragScale,
      -(dl.y * _tmp.y + dq.y * Math.abs(_tmp.y) * _tmp.y) * dragScale,
      -(dl.z * _tmp.z + dq.z * Math.abs(_tmp.z) * _tmp.z) * dragScale,
    );
    _tmp.applyQuaternion(s.quat); // arrasto de volta pro mundo
    _accel.add(_tmp);

    // --- 5. integracao semi-implicita (velocidade antes da posicao) ---
    s.vel.addScaledVector(_accel, dt);
    if (s.vel.lengthSq() > DRONE.maxSpeed * DRONE.maxSpeed) {
      s.vel.setLength(DRONE.maxSpeed);
    }
    s.pos.addScaledVector(s.vel, dt);

    // --- 6. telemetria ---
    s.speed = s.vel.length();
    s.hSpeed = Math.hypot(s.vel.x, s.vel.z);
    s.vSpeed = s.vel.y;
    s.altitude = s.pos.y - DRONE.groundY;
    s.tilt = Math.acos(clamp(_bodyUp.dot(_up), -1, 1));
    _tmp.copy(s.vel).sub(_prevVel).divideScalar(Math.max(dt, 1e-5));
    s.gforce = _tmp.length() / DRONE.gravity;
    return s;
  }

  /** Vetores de orientacao — usados por camera, audio e fx. */
  function basis(out = {}) {
    out.forward = _fwd.set(0, 0, -1).applyQuaternion(s.quat).clone();
    out.up = _bodyUp.set(0, 1, 0).applyQuaternion(s.quat).clone();
    out.right = _right.set(1, 0, 0).applyQuaternion(s.quat).clone();
    return out;
  }

  function reset(pos, headingRad = 0) {
    s.pos.copy(pos);
    s.vel.set(0, 0, 0);
    s.angVel.set(0, 0, 0);
    s.yawTarget = headingRad;
    _euler.set(0, headingRad, 0, 'YXZ');
    s.quat.setFromEuler(_euler);
    s.motor = 0;
    s.speed = s.hSpeed = s.vSpeed = s.airspeed = 0;
    s.gforce = 1; s.tilt = 0;
    s.torqueBias.set(0, 0, 0);
  }

  function setMode(mode) {
    if (mode === s.mode) return s.mode;
    s.mode = mode;
    // Ao voltar pra ANGLE, adota o heading atual como alvo (sem solavanco).
    _euler.setFromQuaternion(s.quat, 'YXZ');
    s.yawTarget = _euler.y;
    return s.mode;
  }

  function toggleMode() {
    return setMode(s.mode === 'angle' ? 'acro' : 'angle');
  }

  return { state: s, step, reset, basis, setMode, toggleMode };
}
