/**
 * Mapa de teclas padrao (Mode 2, canhoto = throttle/yaw, destro = pitch/roll).
 * Rebindavel na tela de opcoes; o mapa do jogador vive no save.
 */
export const DEFAULT_BINDINGS = {
  throttleUp:   ['KeyW'],
  throttleDown: ['KeyS'],
  yawLeft:      ['KeyA'],
  yawRight:     ['KeyD'],
  pitchForward: ['ArrowUp'],
  pitchBack:    ['ArrowDown'],
  rollLeft:     ['ArrowLeft'],
  rollRight:    ['ArrowRight'],

  toggleMode:   ['KeyM'],      // ANGLE <-> ACRO
  toggleView:   ['KeyC'],      // 3a pessoa <-> FPV
  restart:      ['KeyR'],      // reinicio instantaneo
  respawn:      ['KeyT'],
  map:          ['KeyN'],
  nextCircuit:  ['Tab'],       // troca de circuito
  toggleGhost:  ['KeyG'],
  photo:        ['KeyP'],
  options:      ['Escape'],
  debug:        ['F3'],
  brake:        ['ShiftLeft'], // freio aerodinamico
  lights:       ['KeyL'],
  interact:     ['KeyE'],
};

export const ACTION_LABELS = {
  throttleUp: 'Acelerar', throttleDown: 'Desacelerar',
  yawLeft: 'Girar esquerda', yawRight: 'Girar direita',
  pitchForward: 'Inclinar frente', pitchBack: 'Inclinar tras',
  rollLeft: 'Rolar esquerda', rollRight: 'Rolar direita',
  toggleMode: 'Modo ANGLE/ACRO', toggleView: 'Camera 3a pessoa/FPV',
  restart: 'Reiniciar corrida', respawn: 'Respawn', map: 'Mapa',
  photo: 'Photo mode', options: 'Opcoes', debug: 'Debug',
  nextCircuit: 'Trocar circuito', toggleGhost: 'Mostrar fantasma',
  brake: 'Freio', lights: 'Luzes', interact: 'Interagir',
};

/** Gamepad Mode 2: stick esquerdo = throttle/yaw, direito = pitch/roll. */
export const GAMEPAD_AXES = { yaw: 0, throttle: 1, roll: 2, pitch: 3 };
export const GAMEPAD_BUTTONS = {
  toggleMode: 3,   // Y / Triangulo
  toggleView: 2,   // X / Quadrado
  restart: 1,      // B / Circulo
  brake: 6,        // LT
  interact: 0,     // A / X
};
