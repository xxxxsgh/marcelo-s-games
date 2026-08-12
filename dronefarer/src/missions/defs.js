/**
 * Definicao das missoes. Cinco tipos, todos usando a cidade ja construida.
 *
 * Regra de comunicacao: `brief` tem que caber numa linha e responder "o que eu
 * faco" em 2 segundos. Se precisa de duas linhas, a missao esta mal desenhada.
 */

export const MISSION_TYPES = {
  corrida: { label: 'CORRIDA', color: '#37d5ff' },
  inspecao: { label: 'INSPECAO', color: '#5be08a' },
  entrega: { label: 'ENTREGA', color: '#ffb03a' },
  busca: { label: 'BUSCA', color: '#c08aff' },
  vigilancia: { label: 'VIGILANCIA', color: '#ff6ad5' },
};

export const MISSIONS = [
  // ------------------------------------------------------------ corrida
  {
    id: 'race-aberto', type: 'corrida', name: 'Entrega expressa pela avenida',
    brief: 'Complete o circuito ABERTO antes do tempo de bronze.',
    difficulty: 1, reward: 320, circuit: 'aberto', requires: null,
    district: 'centro',
  },
  {
    id: 'race-vertical', type: 'corrida', name: 'Descida da garagem',
    brief: 'Complete o circuito VERTICAL, incluindo o subsolo.',
    difficulty: 3, reward: 780, circuit: 'vertical', requires: 'motores1',
    district: 'centro',
  },

  // ---------------------------------------------------------- inspecao
  {
    id: 'insp-fachada', type: 'inspecao', name: 'Vistoria de fachada',
    brief: 'Fotografe os 4 pontos marcados na fachada, entre 6 e 20 m.',
    difficulty: 1, reward: 420, requires: null, district: 'centro',
    // Pontos na FACE do predio voltada pra rua (x=11.4): assim o drone tem
    // ar livre na frente pra enquadrar sem entrar na geometria.
    minDist: 6, maxDist: 20, coneDeg: 20, holdTime: 0.9,
    approach: { x: -11, y: 0, z: 0 },
    points: [
      { x: 11.4, y: 8, z: 44 }, { x: 11.4, y: 14, z: 44 },
      { x: 11.4, y: 20, z: 44 }, { x: 11.4, y: 26, z: 44 },
    ],
  },
  {
    id: 'insp-antena', type: 'inspecao', name: 'Laudo da torre',
    brief: 'Fotografe os 3 pontos da torre de TV, entre 8 e 24 m.',
    difficulty: 2, reward: 660, requires: 'camera1', district: 'centro',
    minDist: 8, maxDist: 24, coneDeg: 20, holdTime: 1.0,
    approach: { x: 0, y: 0, z: 14 },
    points: [
      { x: 0, y: 62, z: 60 }, { x: 0, y: 84, z: 60 }, { x: 0, y: 104, z: 60 },
    ],
  },

  // ----------------------------------------------------------- entrega
  {
    id: 'ent-sacada', type: 'entrega', name: 'Encomenda para a sacada',
    brief: 'Pegue a encomenda e pouse na laje marcada. Peso extra a bordo.',
    difficulty: 2, reward: 540, requires: null, district: 'antigo',
    payload: 0.9,
    pickup: { x: -30, y: 3, z: 60, r: 5 },
    dropoff: { x: -300, y: 22, z: 90, r: 3.2 },
    landSpeed: 2.2,
  },
  {
    id: 'ent-morro', type: 'entrega', name: 'Remedio no morro',
    brief: 'Leve a caixa ate a laje do morro sem passar de 2 m/s no pouso.',
    difficulty: 3, reward: 880, requires: 'bateria1', district: 'morro',
    payload: 1.4,
    pickup: { x: 30, y: 3, z: -30, r: 5 },
    dropoff: { x: 400, y: 46, z: 120, r: 3.0 },
    landSpeed: 2.0,
  },

  // ------------------------------------------------------------- busca
  {
    id: 'busca-carro', type: 'busca', name: 'Carro abandonado',
    brief: 'Ache o carro abandonado na zona portuaria. O sinal esquenta perto.',
    difficulty: 2, reward: 620, requires: null, district: 'portuaria',
    area: { x: 60, z: -420, r: 260 }, findRadius: 14, candidates: 5,
  },
  {
    id: 'busca-vazamento', type: 'busca', name: 'Vazamento no bairro antigo',
    brief: 'Localize o vazamento no bairro antigo seguindo o sinal termico.',
    difficulty: 3, reward: 900, requires: 'antena1', district: 'antigo',
    area: { x: -380, z: 60, r: 220 }, findRadius: 12, candidates: 6,
  },

  // -------------------------------------------------------- vigilancia
  {
    id: 'vig-carro', type: 'vigilancia', name: 'Siga o carro',
    brief: 'Mantenha o carro enquadrado por 25 s, entre 12 e 45 m, sem ser visto.',
    difficulty: 3, reward: 1050, requires: 'camera1', district: 'centro',
    holdTotal: 25, minDist: 12, maxDist: 45, detectDist: 9, coneDeg: 22,
  },

  // ------------------------------------------- zona restrita (alto risco)
  {
    id: 'risco-corporativa', type: 'inspecao', name: 'Dossie corporativo',
    brief: 'Fotografe 3 pontos DENTRO da zona restrita. Pagamento alto, risco alto.',
    difficulty: 5, reward: 2600, requires: 'antena1', district: 'centro',
    restricted: true,
    minDist: 5, maxDist: 22, coneDeg: 20, holdTime: 0.8,
    approach: { x: 0, y: 0, z: 12 },
    points: [
      { x: 0, y: 40, z: -60 }, { x: 4, y: 52, z: -74 }, { x: -4, y: 46, z: -46 },
    ],
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}
