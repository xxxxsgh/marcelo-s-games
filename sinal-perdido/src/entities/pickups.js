/**
 * Itens no chao. Tudo e pego encostando — em combate de cima, apertar tecla
 * pra pegar municao so faz o jogador morrer olhando pro chao.
 */
import { swapRemove, dist2, clamp01 } from '../core/mathx.js';
import { desenharItem } from '../render/art.js';
import { MUNICAO, ARMAS, darMunicao } from '../combat/weapons.js';

const MELHORIAS = [
  { id: 'dano', nome: 'CALIBRACAO DE CANO', desc: '+12% de dano' },
  { id: 'vida', nome: 'SELANTE DE TRAJE', desc: '+20 de vida maxima' },
  { id: 'velocidade', nome: 'SERVO DAS PERNAS', desc: '+8% de velocidade' },
  { id: 'escudo', nome: 'CAPACITOR DE ESCUDO', desc: '+25 de escudo maximo' },
];

export function createItens(jogo) {
  const lista = [];

  function criar(tipo, x, y, dados = {}) {
    const it = {
      tipo, x, y, vx: dados.vx || 0, vy: dados.vy || 0,
      fase: Math.random() * 6.283, t: 0, raio: 14, ...dados,
    };
    if (tipo === 'municao') {
      it.cor = MUNICAO[it.municao].cor;
      it.rotulo = MUNICAO[it.municao].nome.slice(0, 4);
    }
    if (tipo === 'arma') it.cor = ARMAS[it.arma].cor;
    lista.push(it);
    return it;
  }

  /** Sorteio de drop ao matar um bicho. */
  function drop(e) {
    const r = Math.random();
    const jog = jogo.jogador;
    const chance = e.chefe ? 1 : e.raio > 18 ? 0.42 : 0.20;
    if (r > chance) return;
    const faltaVida = jog.vida < jog.vidaMax * 0.65;
    if (e.chefe) {
      criar('vida', e.x + 20, e.y, { qtd: 45 });
      criar('municao', e.x - 20, e.y, { municao: 'celula', qtd: 4 });
      return;
    }
    if (faltaVida && Math.random() < 0.45) { criar('vida', e.x, e.y, { qtd: 22 }); return; }
    const ars = jog.arsenal;
    const opcoes = [];
    if (ars.posse.espingarda) opcoes.push(['cartucho', 5]);
    if (ars.posse.fuzil) opcoes.push(['pulso', 20]);
    if (ars.posse.plasma) opcoes.push(['celula', 2]);
    if (!opcoes.length) { criar('vida', e.x, e.y, { qtd: 15 }); return; }
    const [mun, qtd] = opcoes[Math.floor(Math.random() * opcoes.length)];
    criar('municao', e.x, e.y, { municao: mun, qtd });
  }

  /** Conteudo de uma capsula de suprimento. */
  function abrirCapsula(c) {
    const rng = jogo.rngFx;
    const jog = jogo.jogador;
    const semArma = ['espingarda', 'fuzil', 'plasma'].filter((a) => !jog.arsenal.posse[a]);
    // A primeira capsula sempre da arma: sair da pistola muda o jogo.
    if (semArma.length && (jogo.capsulasAbertas === 0 || rng.next() < 0.55)) {
      const arma = semArma[0] === 'plasma' && semArma.length > 1 ? semArma[rng.int(0, semArma.length - 2)] : semArma[0];
      criar('arma', c.x, c.y - 6, { arma });
    } else if (rng.next() < 0.35) {
      criar('melhoria', c.x, c.y - 6, { melhoria: rng.pick(MELHORIAS) });
    } else {
      criar('vida', c.x - 14, c.y + 8, { qtd: 35 });
    }
    // sempre um pouco de municao do que da pra usar
    const ars = jog.arsenal;
    const mun = [];
    if (ars.posse.espingarda) mun.push(['cartucho', 10]);
    if (ars.posse.fuzil) mun.push(['pulso', 45]);
    if (ars.posse.plasma) mun.push(['celula', 4]);
    if (mun.length) {
      const [m, q] = mun[rng.int(0, mun.length - 1)];
      criar('municao', c.x + 16, c.y + 8, { municao: m, qtd: q });
    } else {
      criar('vida', c.x + 16, c.y + 8, { qtd: 20 });
    }
  }

  function pegar(it) {
    const jog = jogo.jogador;
    const ars = jog.arsenal;
    switch (it.tipo) {
      case 'vida': {
        const ganho = jog.curar(it.qtd);
        if (ganho <= 0) return false;
        jogo.fx.texto(jog.x, jog.y - 20, `+${Math.round(ganho)}`, '#ff6b8a');
        jogo.mensagem(`Estabilizador aplicado. +${Math.round(ganho)} de vida.`);
        jogo.audio.tocar('curar');
        break;
      }
      case 'municao': {
        if (!darMunicao(ars, it.municao, it.qtd)) return false;
        jogo.fx.texto(jog.x, jog.y - 20, `+${it.qtd} ${MUNICAO[it.municao].nome}`, it.cor, 11);
        jogo.audio.tocar('pegar');
        break;
      }
      case 'arma': {
        const nova = !ars.posse[it.arma];
        const a = ARMAS[it.arma];
        ars.posse[it.arma] = true;
        if (nova) {
          ars.mag[it.arma] = a.mag;
          ars.reserva[a.municao] += a.mag * 3;
          ars.atual = it.arma;
          jogo.mensagem(`${a.nome} recuperada.`, 'ok');
          jogo.audio.tocar('armaNova');
        } else {
          darMunicao(ars, a.municao, a.mag * 2);
          jogo.audio.tocar('pegar');
        }
        break;
      }
      case 'melhoria': {
        const m = it.melhoria;
        if (m.id === 'dano') ars.danoMult *= 1.12;
        if (m.id === 'vida') { jog.vidaMax += 20; jog.vida += 20; }
        if (m.id === 'velocidade') jog.velMax *= 1.08;
        if (m.id === 'escudo') { jog.escudoMax += 25; jog.escudo += 25; }
        jogo.mensagem(`${m.nome}: ${m.desc}`, 'ok');
        jogo.audio.tocar('melhoria');
        jogo.fx.clarao(0.25, '#ffb03a');
        break;
      }
      case 'nucleo': {
        if (jog.carregando) {
          if (!it.avisou) { jogo.mensagem('Voce ja carrega um nucleo. Leve pra nave.', 'aviso'); it.avisou = true; }
          return false;
        }
        jog.carregando = true;
        jogo.audio.tocar('nucleo');
        jogo.mensagem('Nucleo de plasma recuperado. A colmeia sentiu isso.', 'aviso');
        jogo.aoPegarNucleo();
        break;
      }
      default: return false;
    }
    jog.stats.itens++;
    return true;
  }

  function atualizar(dt) {
    const jog = jogo.jogador;
    for (let i = lista.length - 1; i >= 0; i--) {
      const it = lista[i];
      it.t += dt;
      if (it.vx || it.vy) {
        it.x += it.vx * dt; it.y += it.vy * dt;
        const k = Math.exp(-6 * dt);
        it.vx *= k; it.vy *= k;
        jogo.mundo.resolverCirculo(it);
      }
      const d2 = dist2(it.x, it.y, jog.x, jog.y);
      // ima: puxa o item quando o jogador chega perto
      if (d2 < 90 * 90 && !jog.morto) {
        const d = Math.sqrt(d2) || 1;
        const forca = (1 - clamp01(d / 90)) * 520;
        it.x += ((jog.x - it.x) / d) * forca * dt;
        it.y += ((jog.y - it.y) / d) * forca * dt;
      }
      const rr = it.raio + jog.raio;
      if (d2 < rr * rr && !jog.morto && it.t > 0.25) {
        if (pegar(it)) swapRemove(lista, i);
      }
    }
  }

  function desenhar(ctx) {
    for (const it of lista) {
      if (!jogo.cam.visivel(it.x, it.y, 30)) continue;
      desenharItem(ctx, it, jogo.tempo);
    }
  }

  function luzes(out) {
    for (const it of lista) {
      if (!jogo.cam.visivel(it.x, it.y, 60)) continue;
      if (it.tipo === 'nucleo') out.push({ x: it.x, y: it.y, r: 170, cor: '#79ffd0', i: 0.75 });
      else if (it.tipo === 'melhoria') out.push({ x: it.x, y: it.y, r: 90, cor: '#ffb03a', i: 0.5 });
      else if (it.tipo === 'arma') out.push({ x: it.x, y: it.y, r: 80, cor: it.cor, i: 0.4 });
      else out.push({ x: it.x, y: it.y, r: 55, cor: it.cor || '#e8eefb', i: 0.28 });
    }
  }

  return {
    lista, criar, drop, abrirCapsula, atualizar, desenhar, luzes,
    limpar() { lista.length = 0; },
  };
}
