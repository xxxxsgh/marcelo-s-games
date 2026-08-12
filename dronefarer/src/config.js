/**
 * DRONEFARER — config.js
 * ============================================================================
 * TODA constante de tuning mora aqui. Nada de numero magico solto no codigo.
 * Unidade: 1 unidade = 1 metro. Angulos em GRAUS no config, convertidos
 * para radianos no consumo. Tempo em segundos.
 * ============================================================================
 */

const D2R = Math.PI / 180;
export const deg = (d) => d * D2R;

/* ========================================================================== *
 * DRONE — massa, empuxo, rates, drag, modos de voo
 * ========================================================================== */
export const DRONE = {
  // --- massa e empuxo ---
  mass: 0.68,               // kg, quadcoptero 5" freestyle
  gravity: 9.81,            // m/s^2
  twr: 5.2,                 // thrust-to-weight a 100% throttle
  // aceleracao maxima = twr * gravity (~51 m/s^2). Hover fica em 1/twr (~19%).

  // Curva do motor: throttle^motorGamma. >1 da mais resolucao embaixo.
  motorGamma: 1.35,
  // Motor nao responde instantaneo — constante de tempo do spool-up (s).
  motorSpool: 0.055,

  // --- rates ACRO (graus/s a 100% de stick) ---
  acroRates: { pitch: 560, roll: 620, yaw: 320 },
  // Expoente de curva dos rates: 0 = linear, 1 = super suave no centro.
  acroExpo: 0.42,
  // Quao rapido a velocidade angular persegue o alvo (1/s). Baixo = pesado.
  acroAgility: 17.0,
  // Inercia residual: quanto a rotacao continua depois de soltar (0..1).
  angularDamping: 0.86,

  // --- modo ANGLE (auto-nivela) ---
  angleMaxTilt: 34,         // graus de inclinacao no stick cheio
  angleP: 9.2,              // ganho proporcional do PD de atitude
  angleD: 2.1,              // ganho derivativo (amortecimento)
  angleYawRate: 210,        // yaw continua sendo por rate mesmo em ANGLE

  // --- arrasto aerodinamico ---
  // F_drag = -(linear*v + quadratic*|v|*v), por eixo no espaco do CORPO.
  // Y (vertical do corpo) arrasta mais: o disco das helices freia na vertical.
  dragLinear: { x: 0.22, y: 0.42, z: 0.22 },
  dragQuadratic: { x: 0.026, y: 0.055, z: 0.026 },
  // Velocidade terminal horizontal fica ~35 m/s (126 km/h) com esses valores.

  // --- limites e seguranca ---
  maxSpeed: 62,             // m/s, teto absoluto (evita explodir a fisica)
  groundY: 0.0,             // altura do chao
  spawnHeight: 1.4,

  // --- colisao ---
  radius: 0.26,             // esfera de colisao do drone
  crashSpeed: 7.5,          // m/s de impacto que conta como crash
  crashRestitution: 0.28,   // quique quando bate abaixo do limiar
  respawnDelay: 1.15,       // s de killcam/parado antes de voltar
};

/* ========================================================================== *
 * CAMERA — 3a pessoa (principal) e FPV (alternativa)
 * ========================================================================== */
export const CAMERA = {
  mode: 'chase',            // 'chase' | 'fpv' — comeca em 3a pessoa

  chase: {
    distance: 4.6,          // m atras do drone, parado
    distanceMax: 7.4,       // m no topo da velocidade
    distanceAcroBonus: 1.5, // recua mais em ACRO
    height: 1.15,           // m acima do drone
    heightMax: 1.75,

    // Mola/damping. Valores por eixo: posicao e alvo de mira.
    posDamp: 7.2,           // 1/s — maior = mais colado (rigido)
    posDampAcro: 5.4,       // em ACRO deixa mais solto, le melhor a rotacao
    aimDamp: 11.0,

    // A camera segue a DIRECAO DE VOO, nao o nariz.
    // Abaixo de flightDirMinSpeed usa o nariz; acima, mistura pro vetor velocidade.
    flightDirMinSpeed: 3.0,
    flightDirFullSpeed: 12.0,
    flightDirBlend: 0.82,   // 1 = 100% direcao de voo, 0 = 100% nariz

    lookAhead: 5.2,         // m que o alvo de mira antecipa na direcao do voo
    lookAheadTurn: 3.4,     // m extra antecipando a curva (por yaw rate)

    // Colisao de camera: raycast do drone ate a posicao desejada.
    collisionPad: 0.42,     // m de folga da parede
    collisionMin: 1.25,     // m — distancia minima quando espremido
    collisionRecover: 3.0,  // 1/s de volta ao normal depois de sair do aperto

    fov: 74,                // graus, base
    fovMax: 92,             // no topo da velocidade
    fovDamp: 3.4,           // easing do FOV
    fovSpeedRef: 34,        // m/s que corresponde ao fovMax

    // Quanto o roll do drone contamina a camera. 0 = camera sempre no eixo do
    // mundo. Um pouco de contaminacao da estilo; muito da enjoo.
    rollInfluence: 0.14,
    // Achatamento vertical do braco da camera: impede que num mergulho a
    // camera va parar em cima do drone e perca a leitura do horizonte.
    boomFlatten: 0.55,
    // Teto duro de inclinacao do braco (graus). Sem isto, subir na vertical
    // joga a camera POR BAIXO do drone e a tela vira so ceu — perde-se toda
    // a referencia do mundo. E o limite, nao o achatamento, que resolve.
    boomPitchLimit: 24,

    // Orbita com mouse (pointer lock)
    orbitSensitivity: 0.0022,
    orbitYawLimit: 165,     // graus pra cada lado
    orbitPitchLimit: 68,
    orbitRecenter: 2.2,     // 1/s de auto-recentragem quando solta o mouse
  },

  fpv: {
    tilt: 28,               // graus de inclinacao da camera (15-45)
    tiltMin: 15,
    tiltMax: 45,
    fov: 112,               // graus (100-120)
    fovMin: 100,
    fovMax: 120,
    lensDistortion: 0.22,   // barril, 0 = desliga
    // FPV e rigida no corpo (e o ponto), mas um micro-damp tira o jitter.
    damp: 42.0,
    offset: { x: 0, y: 0.06, z: 0.09 },
  },

  near: 0.08,
  far: 4200,
  shakeDecay: 4.2,          // 1/s
  shakeCrash: 1.0,          // intensidade do shake no crash
};

/* ========================================================================== *
 * WORLD — quarteirao da Fase 1 e cidade das fases seguintes
 * ========================================================================== */
export const WORLD = {
  seed: 20260812,           // semente fixa: a cidade e sempre a mesma
  chunkSize: 120,           // m por quarteirao (chunk)
  streamRadius: 3,          // chunks carregados ao redor do jogador
  unloadRadius: 4,

  // Fase 1: um quarteirao urbano
  block: {
    streetWidth: 15,
    sidewalkWidth: 3.2,
    sidewalkHeight: 0.16,
    buildingMinFloors: 4,
    buildingMaxFloors: 10,
    floorHeight: 3.1,
    poleSpacing: 18,
    poleHeight: 8.4,
    wireSag: 1.1,
  },

  fogDensity: 0.0011,
  fogColor: 0x9fb4cf,

  dust: {
    count: 900,             // particulas de poeira/papel perto do chao
    area: 70,               // m de raio ao redor do drone
    height: 9,
    streakSpeed: 12,        // m/s onde vira streak
    streakLength: 0.9,
  },
};

/* ========================================================================== *
 * RACE — gates, medalhas, combo (Fase 2)
 * ========================================================================== */
export const RACE = {
  gateRadius: 3.1,
  gateThickness: 0.28,
  gateCenterBonusRadius: 1.0,   // passar dentro disso = bonus de centro
  grazeRadius: 0.55,            // raspar = penalidade visual, nao morte

  comboWindow: 4.2,             // s pra manter o combo vivo
  comboMax: 8,
  centerBonusPoints: 120,
  gatePoints: 100,

  arrowDistance: 2.4,           // m a frente da camera onde a seta guia mora
  nextGateDim: 0.35,            // opacidade do proximo gate

  ghostOpacity: 0.42,
  ghostSampleRate: 30,          // Hz de gravacao do fantasma

  medals: {                     // multiplicadores sobre o tempo-alvo do circuito
    gold: 1.0,
    silver: 1.18,
    bronze: 1.42,
  },
};

/* ========================================================================== *
 * BATTERY — bateria como recurso real
 * ========================================================================== */
export const BATTERY = {
  capacity: 100,            // unidades percentuais
  idleDrain: 0.42,          // %/s parado (eletronica + hover baixo)
  throttleDrain: 3.15,      // %/s adicional a 100% de throttle
  throttleGamma: 1.7,       // consumo cresce mais que linear com o throttle
  payloadDrain: 0.9,        // %/s extra por kg de carga (Fase 4)
  criticalLevel: 18,        // % que dispara alerta
  deadLevel: 0,             // % onde o drone cai
  rechargeRate: 26,         // %/s num ponto de recarga
};

/* ========================================================================== *
 * WIND — vento leve com rajadas e turbulencia urbana
 * ========================================================================== */
export const WIND = {
  enabled: true,
  baseSpeed: 2.1,           // m/s constante
  baseDirection: 118,       // graus (0 = +X)
  gustSpeed: 4.6,           // m/s de pico de rajada
  gustFrequency: 0.14,      // Hz de troca de rajada
  gustTurbulence: 0.55,     // ruido de alta frequencia
  altitudeFactor: 0.022,    // vento cresce com altura (por metro)

  // Turbulencia urbana (Fase 6)
  canyonBoost: 1.85,        // aceleracao do ar entre dois predios
  cornerGust: 3.2,          // rajada saindo de esquina
  thermalRise: 2.4,         // m/s de ar quente subindo de telhado
  rotorWash: 6.0,           // helicoptero passando
};

/* ========================================================================== *
 * QUALITY — 4 tiers, override por query param (?q=alto|medio|baixo|minimo)
 * ========================================================================== */
export const QUALITY = {
  tiers: {
    alto: {
      label: 'Alto',
      renderScale: 1.0,
      shadows: true, shadowMapSize: 2048, shadowCascades: 3, shadowDistance: 260,
      ssao: true, ssaoRadius: 0.55,
      bloom: true, bloomStrength: 0.30, bloomRadius: 0.42, bloomThreshold: 1.9,
      ssr: true,
      motionBlur: true, motionBlurStrength: 0.34,
      volumetrics: true,
      antialias: 'smaa',
      anisotropy: 8,
      drawDistance: 2400,
      instancedDetail: 1.0,
      particleScale: 1.0,
    },
    medio: {
      label: 'Medio',
      renderScale: 1.0,
      shadows: true, shadowMapSize: 1536, shadowCascades: 2, shadowDistance: 170,
      ssao: true, ssaoRadius: 0.5,
      bloom: true, bloomStrength: 0.28, bloomRadius: 0.40, bloomThreshold: 1.9,
      ssr: false,
      motionBlur: true, motionBlurStrength: 0.26,
      volumetrics: false,
      antialias: 'smaa',
      anisotropy: 4,
      drawDistance: 1500,
      instancedDetail: 0.72,
      particleScale: 0.7,
    },
    baixo: {
      label: 'Baixo',
      renderScale: 0.85,
      shadows: true, shadowMapSize: 1024, shadowCascades: 1, shadowDistance: 95,
      ssao: false, ssaoRadius: 0.4,
      bloom: true, bloomStrength: 0.24, bloomRadius: 0.38, bloomThreshold: 2.0,
      ssr: false,
      motionBlur: false, motionBlurStrength: 0,
      volumetrics: false,
      antialias: 'fxaa',
      anisotropy: 2,
      drawDistance: 900,
      instancedDetail: 0.45,
      particleScale: 0.4,
    },
    minimo: {
      label: 'Minimo',
      renderScale: 0.7,
      shadows: false, shadowMapSize: 512, shadowCascades: 1, shadowDistance: 60,
      ssao: false, ssaoRadius: 0.4,
      bloom: false, bloomStrength: 0, bloomRadius: 0, bloomThreshold: 1,
      ssr: false,
      motionBlur: false, motionBlurStrength: 0,
      volumetrics: false,
      antialias: 'none',
      anisotropy: 1,
      drawDistance: 560,
      instancedDetail: 0.28,
      particleScale: 0.2,
    },
  },
  // Render scale que o jogador pode forcar no menu (Fase 8): 0.5 .. 2.0
  renderScaleMin: 0.5,
  renderScaleMax: 2.0,
  // Exposicao base. O environment map do ceu ja ilumina bastante; acima
  // de ~0.9 as fachadas viradas pro sol estouram pra branco puro.
  exposure: 0.48,           // tone mapping ACES
  toneMapping: 'aces',
};

/* ========================================================================== *
 * AUDIO — mixer e sintese (Fase 7)
 * ========================================================================== */
export const AUDIO = {
  master: 0.75,
  engine: 0.62,
  wind: 0.5,
  sfx: 0.8,
  music: 0.42,

  engineBaseHz: 62,         // Hz na rotacao minima
  engineTopHz: 268,         // Hz a 100%
  engineHarmonics: 4,       // parciais do motor (4 helices)
  engineBladeRatio: 2.0,    // passagem de pa
  engineLoadTimbre: 0.55,   // quanto a carga suja o timbre

  dopplerFactor: 0.85,
  wallProximity: 3.4,       // m onde a parede comeca a colorir o som
  windSpeedRef: 30,         // m/s de airspeed pro vento em volume cheio

  batteryBeepHz: 1760,
  batteryBeepInterval: 1.1, // s no nivel critico
};

/* ========================================================================== *
 * INPUT — deadzone, expo, sensibilidade
 * ========================================================================== */
export const INPUT = {
  deadzone: 0.09,
  expo: 0.38,               // curva de expo dos sticks (0 = linear)
  keyboardRamp: 6.2,        // 1/s de rampa da tecla (digital -> analogico)
  keyboardRelease: 9.5,     // 1/s de volta ao centro
  // Rampa do throttle no teclado. Rapido o bastante pra W responder na hora;
  // o spool-up do motor ainda impede que fique digital.
  throttleRamp: 3.4,
  mouseSensitivity: 1.0,
  invertPitch: false,
  gamepadIndex: 0,
};

/* ========================================================================== *
 * GAME — regras gerais
 * ========================================================================== */
export const GAME = {
  fixedHz: 60,              // fisica em timestep fixo
  maxSubSteps: 5,           // teto de catch-up por frame
  saveKey: 'dronefarer.save.v1',
  saveVersion: 1,
};

export default { DRONE, CAMERA, WORLD, RACE, BATTERY, WIND, QUALITY, AUDIO, INPUT, GAME };
