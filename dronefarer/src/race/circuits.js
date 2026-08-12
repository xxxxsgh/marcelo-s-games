/**
 * Tres circuitos no mesmo quarteirao, com pilotagem diferente em cada um.
 *
 * `yaw` e a DIRECAO DE PASSAGEM em graus: 0 = atravessa indo pro -Z,
 * 90 = indo pro -X, 180 = indo pro +Z, 270 = indo pro +X.
 *
 * Os tempos de ouro sao apertados de proposito: em ANGLE o drone perde tempo
 * nivelando a cada curva, entao o ouro pede ACRO.
 */

export const CIRCUITS = [
  {
    id: 'aberto',
    name: 'ABERTO',
    subtitle: 'Avenida e cruzamento — linha limpa e velocidade',
    color: 0x37d5ff,
    start: { x: 0, y: 5, z: 62, heading: 180 },
    target: { gold: 21.5, silver: 25.4, bronze: 30.5 },
    gates: [
      { x: 0, y: 6, z: 46, yaw: 0 },
      { x: 0, y: 8, z: 14, yaw: 0 },
      { x: -34, y: 7, z: 0, yaw: 90 },
      { x: -72, y: 9, z: 0, yaw: 90 },
      { x: -104, y: 12, z: 0, yaw: 90 },
      { x: -134, y: 9, z: 0, yaw: 90 },
    ],
  },

  {
    id: 'tecnico',
    name: 'TECNICO',
    subtitle: 'Baixo, apertado, costurando poste e passando sob os fios',
    color: 0xffb03a,
    start: { x: 4, y: 3.2, z: 70, heading: 180 },
    target: { gold: 27.0, silver: 32.0, bronze: 38.5 },
    gates: [
      { x: 5, y: 3.4, z: 54, yaw: 0, radius: 2.4 },
      { x: -5, y: 3.0, z: 36, yaw: 0, radius: 2.4 },
      { x: 5, y: 2.8, z: 18, yaw: 0, radius: 2.2 },
      { x: -5, y: 3.2, z: -18, yaw: 0, radius: 2.2 },
      { x: 5, y: 3.0, z: -36, yaw: 0, radius: 2.4 },
      { x: 0, y: 4.2, z: -54, yaw: 0, radius: 2.6 },
      { x: -30, y: 4.0, z: -76, yaw: 60, radius: 2.6 },
      { x: -64, y: 3.4, z: -88, yaw: 78, radius: 2.4 },
    ],
  },

  {
    id: 'vertical',
    name: 'VERTICAL',
    subtitle: 'Sobe ate o telhado, mergulha e entra na garagem',
    color: 0xff6ad5,
    start: { x: 0, y: 5, z: 56, heading: 180 },
    target: { gold: 38.0, silver: 45.0, bronze: 54.0 },
    gates: [
      { x: 0, y: 6, z: 40, yaw: 0 },
      { x: 0, y: 22, z: 10, yaw: 0 },
      { x: 0, y: 34, z: -20, yaw: 0 },
      { x: 0, y: 14, z: -42, yaw: 0 },
      // boca da rampa: estreita, obriga a descer com a linha certa
      { x: -4.2, y: 2.6, z: -52, yaw: 0, radius: 2.0 },
      // dentro da garagem: pe direito de 2.9 m, gate pequeno de proposito
      { x: -4.2, y: -1.75, z: -66, yaw: 0, radius: 1.2 },
      { x: -14, y: -1.75, z: -73, yaw: 52, radius: 1.2 },
      // sai de re pela rampa
      { x: -4.2, y: 2.6, z: -50, yaw: 180, radius: 2.0 },
      { x: 0, y: 12, z: -18, yaw: 180 },
    ],
  },
];

export function getCircuit(id) {
  return CIRCUITS.find((c) => c.id === id) || CIRCUITS[0];
}

/** Medalha a partir do tempo. Devolve 'gold' | 'silver' | 'bronze' | null. */
export function medalFor(circuit, time) {
  if (!Number.isFinite(time)) return null;
  if (time <= circuit.target.gold) return 'gold';
  if (time <= circuit.target.silver) return 'silver';
  if (time <= circuit.target.bronze) return 'bronze';
  return null;
}

export const MEDAL_LABEL = { gold: 'OURO', silver: 'PRATA', bronze: 'BRONZE' };
export const MEDAL_COLOR = { gold: '#ffcf4a', silver: '#cfd8e3', bronze: '#d08a52' };
