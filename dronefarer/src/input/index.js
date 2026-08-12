/**
 * Input unificado: teclado + gamepad + mouse (orbita da camera).
 * Saida normalizada em `state`: throttle 0..1, pitch/roll/yaw -1..1.
 * Teclado e digital, entao passa por uma rampa pra virar analogico decente.
 */
import { INPUT } from '../config.js';
import { clamp, clamp01, damp, applyExpo, applyDeadzone } from '../core/mathx.js';
import { DEFAULT_BINDINGS, GAMEPAD_AXES, GAMEPAD_BUTTONS } from './bindings.js';

export function createInput(bus, canvas) {
  const bindings = structuredClone(DEFAULT_BINDINGS);
  const tuning = {
    deadzone: INPUT.deadzone,
    expo: INPUT.expo,
    mouseSensitivity: INPUT.mouseSensitivity,
    invertPitch: INPUT.invertPitch,
  };

  const down = new Set();
  // Eixos crus do teclado, com rampa aplicada (o que da o "analogico").
  const kb = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };

  const state = {
    throttle: 0, pitch: 0, roll: 0, yaw: 0,
    brake: false,
    source: 'keyboard',        // 'keyboard' | 'gamepad'
    mouseDX: 0, mouseDY: 0,    // delta acumulado do frame (orbita)
    mouseActive: false,
    pointerLocked: false,
  };

  // --- mapa tecla -> acao (invertido pra lookup O(1)) ---
  let keyToAction = new Map();
  function rebuildMap() {
    keyToAction = new Map();
    for (const [action, keys] of Object.entries(bindings)) {
      for (const k of keys) keyToAction.set(k, action);
    }
  }
  rebuildMap();

  // Acoes de toque unico (nao seguram): emitidas pelo bus.
  const TAP_ACTIONS = new Set([
    'toggleMode', 'toggleView', 'restart', 'respawn', 'map',
    'photo', 'options', 'debug', 'lights', 'interact',
    'nextCircuit', 'toggleGhost',
  ]);

  function onKeyDown(e) {
    const action = keyToAction.get(e.code);
    if (!action) return;
    // Tab e F3 tem comportamento padrao do browser que atrapalha o jogo.
    if (action === 'debug' || action === 'options' || action === 'nextCircuit') e.preventDefault();
    if (down.has(e.code)) return;       // ignora auto-repeat
    down.add(e.code);
    state.source = 'keyboard';
    if (TAP_ACTIONS.has(action)) bus.emit(`action:${action}`);
  }
  function onKeyUp(e) { down.delete(e.code); }
  function onBlur() { down.clear(); }

  function held(action) {
    const keys = bindings[action];
    if (!keys) return false;
    for (const k of keys) if (down.has(k)) return true;
    return false;
  }

  // --- mouse: orbita da camera com pointer lock ---
  function onMouseMove(e) {
    if (!state.pointerLocked) return;
    state.mouseDX += e.movementX * tuning.mouseSensitivity;
    state.mouseDY += e.movementY * tuning.mouseSensitivity;
    state.mouseActive = true;
  }
  function onPointerLockChange() {
    state.pointerLocked = document.pointerLockElement === canvas;
    bus.emit('pointerlock', state.pointerLocked);
  }
  function requestLock() {
    if (!state.pointerLocked) canvas.requestPointerLock?.();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  canvas.addEventListener('mousedown', requestLock);

  // --- gamepad ---
  const prevButtons = [];
  function pollGamepad(dt) {
    const pads = navigator.getGamepads?.() || [];
    const pad = pads[INPUT.gamepadIndex] || pads.find((p) => p && p.connected);
    if (!pad) return false;

    const ax = pad.axes;
    const raw = (i) => (typeof ax[i] === 'number' ? ax[i] : 0);
    const shape = (v) => applyExpo(applyDeadzone(v, tuning.deadzone), tuning.expo);

    // Throttle: eixo Y do stick esquerdo, invertido, mapeado de -1..1 pra 0..1.
    const th = clamp01((-raw(GAMEPAD_AXES.throttle) + 1) * 0.5);
    const yaw = shape(raw(GAMEPAD_AXES.yaw));
    const roll = shape(raw(GAMEPAD_AXES.roll));
    const pitch = shape(-raw(GAMEPAD_AXES.pitch));

    // So assume o controle se o jogador realmente mexeu nele.
    const active = Math.abs(yaw) + Math.abs(roll) + Math.abs(pitch) > 0.02
      || Math.abs(th - 0.5) > 0.06 || pad.buttons.some((b) => b.pressed);
    if (!active && state.source === 'keyboard') return false;

    state.source = 'gamepad';
    state.throttle = damp(state.throttle, th, 26, dt);
    state.yaw = yaw; state.roll = roll; state.pitch = pitch;
    state.brake = !!pad.buttons[GAMEPAD_BUTTONS.brake]?.pressed;

    for (const [action, idx] of Object.entries(GAMEPAD_BUTTONS)) {
      const pressed = !!pad.buttons[idx]?.pressed;
      if (pressed && !prevButtons[idx] && TAP_ACTIONS.has(action)) {
        bus.emit(`action:${action}`);
      }
      prevButtons[idx] = pressed;
    }
    return true;
  }

  /** Rampa do teclado: tecla digital vira eixo com aceleracao e volta ao centro. */
  function rampAxis(cur, target, dt) {
    const rate = target === 0 ? INPUT.keyboardRelease : INPUT.keyboardRamp;
    return damp(cur, target, rate, dt);
  }

  function update(dt) {
    if (pollGamepad(dt)) return state;

    state.source = 'keyboard';
    // Throttle e acumulativo (segura pra subir), nao mola.
    const thDir = (held('throttleUp') ? 1 : 0) - (held('throttleDown') ? 1 : 0);
    kb.throttle = clamp01(kb.throttle + thDir * INPUT.throttleRamp * dt);
    // Sem input de throttle o valor SEGURA — e um drone, nao um carro.
    state.throttle = kb.throttle;

    const pitchTarget = (held('pitchForward') ? 1 : 0) - (held('pitchBack') ? 1 : 0);
    const rollTarget = (held('rollRight') ? 1 : 0) - (held('rollLeft') ? 1 : 0);
    const yawTarget = (held('yawRight') ? 1 : 0) - (held('yawLeft') ? 1 : 0);

    kb.pitch = rampAxis(kb.pitch, pitchTarget, dt);
    kb.roll = rampAxis(kb.roll, rollTarget, dt);
    kb.yaw = rampAxis(kb.yaw, yawTarget, dt);

    state.pitch = applyExpo(kb.pitch, tuning.expo) * (tuning.invertPitch ? -1 : 1);
    state.roll = applyExpo(kb.roll, tuning.expo);
    state.yaw = applyExpo(kb.yaw, tuning.expo);
    state.brake = held('brake');
    return state;
  }

  /** Consome o delta do mouse (zera depois de ler). */
  function consumeMouse() {
    const dx = state.mouseDX, dy = state.mouseDY;
    state.mouseDX = 0; state.mouseDY = 0;
    return { dx, dy };
  }

  return {
    state, tuning, bindings, update, consumeMouse, requestLock,
    isHeld: held,
    setThrottle(v) { kb.throttle = clamp01(v); state.throttle = kb.throttle; },
    rebind(action, keys) { bindings[action] = keys; rebuildMap(); },
    resetBindings() {
      Object.assign(bindings, structuredClone(DEFAULT_BINDINGS));
      rebuildMap();
    },
    loadBindings(saved) {
      if (!saved) return;
      for (const [a, k] of Object.entries(saved)) {
        if (bindings[a] && Array.isArray(k)) bindings[a] = k;
      }
      rebuildMap();
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('mousedown', requestLock);
    },
    _clampUnused: clamp,
  };
}
