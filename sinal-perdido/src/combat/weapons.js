/**
 * Arsenal. Cada arma e so uma tabela de numeros — quem puxa o gatilho e o
 * jogador, quem cria a bala e `entities/projectiles.js`.
 *
 * Regra de equilibrio: a pistola nunca fica sem reserva. Ficar desarmado num
 * planeta hostil nao e tensao, e castigo.
 */

export const MUNICAO = {
  pistola: { nome: 'CAL .30', max: Infinity, cor: '#cbd5f5' },
  cartucho: { nome: 'CARTUCHO', max: 60, cor: '#ffb03a' },
  pulso: { nome: 'PULSO', max: 260, cor: '#79ffd0' },
  celula: { nome: 'CELULA', max: 24, cor: '#7cf6ff' },
};

export const ARMAS = {
  pistola: {
    id: 'pistola', nome: 'PISTOLA DE SERVICO', curto: 'PISTOLA',
    tipoTiro: 'semi', dano: 17, cadencia: 5.2, mag: 14, recarga: 1.05,
    espalha: 0.030, projeteis: 1, vel: 1500, alcance: 760, municao: 'pistola',
    empurrao: 90, tremor: 1.1, recuo: 26, cor: '#ffe9a8', raio: 3, som: 'pistola',
  },
  espingarda: {
    id: 'espingarda', nome: 'ESPINGARDA DE MINERACAO', curto: 'ESPINGARDA',
    tipoTiro: 'semi', dano: 11, cadencia: 1.35, mag: 6, recarga: 2.0,
    espalha: 0.155, projeteis: 9, vel: 1180, alcance: 430, municao: 'cartucho',
    empurrao: 240, tremor: 4.2, recuo: 150, cor: '#ffc178', raio: 3.4, som: 'espingarda',
  },
  fuzil: {
    id: 'fuzil', nome: 'FUZIL DE PULSO NV-4', curto: 'FUZIL',
    tipoTiro: 'auto', dano: 13, cadencia: 10.5, mag: 32, recarga: 1.65,
    espalha: 0.055, projeteis: 1, vel: 1750, alcance: 900, municao: 'pulso',
    empurrao: 70, tremor: 1.0, recuo: 22, cor: '#8ffff0', raio: 3, som: 'fuzil',
  },
  plasma: {
    id: 'plasma', nome: 'LANCA-PLASMA MK II', curto: 'PLASMA',
    tipoTiro: 'semi', dano: 62, cadencia: 0.95, mag: 5, recarga: 2.3,
    espalha: 0.012, projeteis: 1, vel: 720, alcance: 1000, municao: 'celula',
    empurrao: 320, tremor: 5.5, recuo: 120, cor: '#7cf6ff', raio: 8, som: 'plasma',
    splash: { raio: 108, dano: 78 }, luz: 1,
  },
};

export const ORDEM_ARMAS = ['pistola', 'espingarda', 'fuzil', 'plasma'];

export function criarArsenal() {
  return {
    posse: { pistola: true, espingarda: false, fuzil: false, plasma: false },
    atual: 'pistola',
    mag: { pistola: ARMAS.pistola.mag, espingarda: 0, fuzil: 0, plasma: 0 },
    reserva: { pistola: Infinity, cartucho: 0, pulso: 0, celula: 0 },
    esfriando: 0,      // tempo ate poder atirar de novo
    recarregando: 0,   // tempo restante de recarga
    travado: false,    // trava do semi-auto: exige soltar o gatilho
    /** Bonus de dano acumulado por upgrades. */
    danoMult: 1,
  };
}

export function armaAtual(ars) { return ARMAS[ars.atual]; }

export function podeAtirar(ars) {
  return ars.esfriando <= 0 && ars.recarregando <= 0 && ars.mag[ars.atual] > 0;
}

export function precisaRecarregar(ars) {
  const a = armaAtual(ars);
  return ars.mag[a.id] <= 0 && ars.reserva[a.municao] > 0;
}

/** Comeca a recarga se fizer sentido. Retorna true se comecou. */
export function recarregar(ars) {
  const a = armaAtual(ars);
  if (ars.recarregando > 0) return false;
  if (ars.mag[a.id] >= a.mag) return false;
  if (ars.reserva[a.municao] <= 0) return false;
  ars.recarregando = a.recarga;
  return true;
}

/** Fim da recarga: transfere da reserva pro pente. */
export function concluirRecarga(ars) {
  const a = armaAtual(ars);
  const falta = a.mag - ars.mag[a.id];
  const tem = ars.reserva[a.municao];
  const n = Math.min(falta, tem);
  ars.mag[a.id] += n;
  if (tem !== Infinity) ars.reserva[a.municao] = tem - n;
}

export function trocarArma(ars, id) {
  if (!ars.posse[id] || ars.atual === id) return false;
  ars.atual = id;
  ars.recarregando = 0;
  ars.esfriando = Math.max(ars.esfriando, 0.28);
  ars.travado = true;
  return true;
}

export function proximaArma(ars, dir = 1) {
  const tenho = ORDEM_ARMAS.filter((id) => ars.posse[id]);
  if (tenho.length < 2) return false;
  const i = tenho.indexOf(ars.atual);
  return trocarArma(ars, tenho[(i + dir + tenho.length) % tenho.length]);
}

/** Municao ganha ao pegar uma caixa daquele tipo. */
export function darMunicao(ars, tipo, qtd) {
  if (tipo === 'pistola') return false;
  const antes = ars.reserva[tipo];
  ars.reserva[tipo] = Math.min(MUNICAO[tipo].max, antes + qtd);
  return ars.reserva[tipo] > antes;
}
