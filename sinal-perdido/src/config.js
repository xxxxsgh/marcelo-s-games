/**
 * Todo numero que da "sensacao" ao jogo mora aqui.
 * Unidade do mundo = 1 pixel com zoom 1. Tempo em segundos, angulo em radianos
 * (os poucos valores em graus estao marcados com `Deg` no nome).
 */

export const GAME = {
  fixedHz: 60,
  maxSubSteps: 5,
  /** Altura do mundo visivel, em unidades. A escala se ajusta a janela. */
  viewH: 560,
  zoomMin: 0.62,
  zoomMax: 1.9,
};

export const MAPA = {
  tile: 40,
  w: 176,
  h: 176,
  /** Espessura da muralha de rocha na borda (o vale e fechado). */
  borda: 4,
  ninhos: 3,
  capsulas: 9,
};

/** Tipos de tile. Os solidos sao >= SOLIDO_MIN. */
export const T = {
  CHAO: 0,
  FUNGO: 1,   // chao macio, brilha de leve
  ACIDO: 2,   // atravessa, mas queima e freia
  ROCHA: 3,   // solido
  CRISTAL: 4, // solido, emite luz
  RUINA: 5,   // solido, metal do naufragio
};
export const SOLIDO_MIN = T.ROCHA;

/** Biomas — mudam paleta, densidade de rocha e quem nasce ali. */
export const BIOMA = {
  PLANICIE: 0,
  FUNGAL: 1,
  PEDREGAL: 2,
  PANTANO: 3,
  CRISTALINO: 4,
};

export const PALETA = {
  // [chao base, chao variacao, detalhe]
  chao: [
    ['#5d5569', '#6a6178', '#7d738c'],   // planicie de cinza vulcanica
    ['#525d69', '#5c6a76', '#6e7c8b'],   // floresta fungal
    ['#665951', '#71645b', '#84756a'],   // pedregal
    ['#565e54', '#606a5d', '#707c69'],   // pantano
    ['#565278', '#605c87', '#726da2'],   // campo de cristal
  ],
  rocha: '#241d31',
  rochaTopo: '#8478ad',
  cristal: '#7cf6ff',
  acido: '#5cff9a',
  fungo: '#b96cff',
  sangue: '#7bff5a',
  ui: '#e6f2ff',
  ok: '#79ffd0',
  aviso: '#ff7a3d',
  perigo: '#ff3d6e',
};

export const JOGADOR = {
  raio: 12,
  aceleracao: 3000,
  velMax: 238,
  atrito: 13,
  vida: 100,
  escudo: 60,
  escudoAtraso: 4.2,   // s sem tomar dano ate o escudo voltar
  escudoTaxa: 26,      // pontos/s
  esquiva: {
    vel: 620,
    dur: 0.2,
    invul: 0.28,
    recarga: 0.85,
    custoEstamina: 0,
  },
  coronhada: { dano: 46, alcance: 52, arcoDeg: 110, recarga: 0.55, empurrao: 340 },
  lanterna: { alcance: 430, arcoDeg: 62 },
  /** O nucleo e pesado: carregar custa velocidade e chama atencao. */
  cargaLentidao: 0.86,
};

export const CICLO = {
  /** Duracao de um dia completo. A queda acontece no fim da tarde. */
  duracao: 240,
  // A queda acontece de manha: da tempo de aprender o vale antes da primeira
  // noite, que e quando o planeta cobra o aprendizado.
  inicio: 0.20,
  ambienteDia: 0.95,
  ambienteNoite: 0.28,
};

export const DIRETOR = {
  /** Populacao viva perseguindo o jogador, sem contar ninho e cerco. */
  vivosBase: 14,
  vivosPorNucleo: 6,
  vivosNoite: 8,
  intervaloBase: 3.4,
  raioSpawnMin: 620,
  raioSpawnMax: 900,
  /** Enquanto carrega nucleo o planeta reage. */
  fatorCarga: 0.55,
};

export const CERCO = {
  duracao: 105,
  ondaIntervalo: 7.5,
  rainhaEm: 12,
};

export const AUDIO = {
  master: 0.55,
  sfx: 0.9,
  ambiente: 0.5,
};
