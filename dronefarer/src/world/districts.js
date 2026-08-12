/**
 * Os cinco distritos. Cada um muda a PILOTAGEM, nao so a cor:
 * altura e espacamento dos predios definem se voce voa rapido, se voa
 * apertado, ou se voa em tres dimensoes de verdade.
 */
import { hash32 } from '../core/rng.js';

export const DISTRICTS = {
  centro: {
    id: 'centro',
    name: 'CENTRO',
    hint: 'Canyons de vidro. Perder altura entre duas torres e claustrofobico.',
    color: 0x5aa6d8,
    // predios
    floors: [12, 34], footprint: [22, 40], gap: [7, 16],
    variants: [2, 5, 1],
    density: 0.92,
    streetWidth: 20,
    // atmosfera
    fog: 0xc4d2e0, fogDensity: 0.0010,
    windScale: 1.45,          // corredor de vento entre torres
    rooftopProps: 0.9,        // heliponto, antena, caixa d'agua
    trees: 0,
  },

  portuaria: {
    id: 'portuaria',
    name: 'ZONA PORTUARIA',
    hint: 'Espaco aberto com obstaculos altos. E aqui que se abre o gas.',
    color: 0xd8a24a,
    floors: [1, 4], footprint: [26, 52], gap: [22, 46],
    variants: [1, 6, 0],
    density: 0.45,
    streetWidth: 26,
    fog: 0xd9c6a8, fogDensity: 0.0013,
    windScale: 1.15,
    rooftopProps: 0.25,
    trees: 0,
    cranes: true,
    containers: true,
  },

  antigo: {
    id: 'antigo',
    name: 'BAIRRO ANTIGO',
    hint: 'Rua estreita, sacada e fio por todo lado. Voo tecnico, de precisao.',
    color: 0xc4784a,
    floors: [3, 7], footprint: [12, 20], gap: [2.5, 7],
    variants: [4, 7, 6],
    density: 0.96,
    streetWidth: 9,
    fog: 0xd8bfa4, fogDensity: 0.0016,
    windScale: 0.7,
    rooftopProps: 0.7,
    balconies: true,
    wires: 2.4,               // multiplicador de fios cruzando a rua
    trees: 0.1,
  },

  morro: {
    id: 'morro',
    name: 'MORRO',
    hint: 'Encosta com lajes em niveis. Pilotagem em tres dimensoes de verdade.',
    color: 0xc95f5f,
    floors: [1, 4], footprint: [8, 15], gap: [1.5, 5],
    variants: [7, 6, 4],
    density: 1.0,
    streetWidth: 7,
    fog: 0xd6b89c, fogDensity: 0.0015,
    windScale: 1.25,
    rooftopProps: 1.0,        // caixa d'agua em toda laje
    slope: 0.42,              // metros de subida por metro em X
    stairs: true,
    trees: 0.15,
  },

  parque: {
    id: 'parque',
    name: 'PARQUE E ORLA',
    hint: 'Respiro aberto. E onde se recupera velocidade entre distritos.',
    color: 0x5fbf7a,
    floors: [1, 3], footprint: [10, 18], gap: [40, 90],
    variants: [3, 0, 1],
    density: 0.12,
    streetWidth: 16,
    fog: 0xbfd6c8, fogDensity: 0.0011,
    windScale: 1.0,
    rooftopProps: 0.1,
    trees: 1.0,
    water: true,
  },
};

export const DISTRICT_LIST = Object.values(DISTRICTS);

/**
 * Distrito de um chunk. Deterministico e estavel: mesma coordenada => mesmo
 * distrito, independente da ordem de carregamento.
 *
 * O mapa e composto por regioes em vez de ruido puro pra cada distrito ficar
 * CONTIGUO — um bairro antigo espalhado em manchas nao daria identidade.
 */
export function districtAt(cx, cz) {
  const r = Math.max(Math.abs(cx), Math.abs(cz));

  // O CENTRO vai ate r=3 de proposito. Os chunks -2..1 sao ocupados pelo
  // quarteirao da Fase 1 e nao sao gerados; se o centro parasse em r=1, o
  // distrito de arranha-ceus — o cartao postal do jogo — nunca existiria de
  // fato. Com r<=3 o jogador sai do quarteirao e ja cai nos canyons de vidro.
  if (r <= 3) return DISTRICTS.centro;
  if (cz <= -5) return DISTRICTS.portuaria;            // porto ao norte
  if (cz >= 5) return DISTRICTS.parque;                // orla ao sul
  if (cx <= -4) return DISTRICTS.antigo;               // bairro antigo a oeste
  if (cx >= 4) return DISTRICTS.morro;                 // morro a leste

  // anel de transicao: mistura estavel por hash (nunca aleatoria por frame)
  const h = hash32(`dist|${cx}|${cz}`) % 100;
  if (h < 40) return DISTRICTS.centro;
  if (h < 60) return DISTRICTS.antigo;
  if (h < 80) return DISTRICTS.morro;
  return DISTRICTS.portuaria;
}

/** Altura do terreno. So o morro tem relevo; o resto e plano. */
export function groundHeightAt(x, z) {
  const cx = Math.floor(x / 120), cz = Math.floor(z / 120);
  const d = districtAt(cx, cz);
  if (!d.slope) return 0;
  // A encosta sobe pro leste e amacia nas bordas do distrito.
  const local = Math.max(0, x - 480);
  const fade = Math.min(1, local / 90);
  return local * d.slope * fade * 0.55;
}
