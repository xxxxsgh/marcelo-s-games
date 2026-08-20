/**
 * O nautrago: quem cai, atira e carrega os nucleos de volta pra nave.
 *
 * Movimento em aceleracao + atrito (nao "velocidade = input"): dá peso sem
 * deixar o controle mole, e a esquiva vira um estado que ignora a entrada
 * durante o mergulho. Mira e corpo giram separados — e o que faz um shooter de
 * cima parecer twin-stick e nao carrinho de controle remoto.
 */
import { JOGADOR } from '../config.js';
import { clamp, clamp01, angDamp } from '../core/mathx.js';
import {
  criarArsenal, armaAtual, podeAtirar, recarregar, concluirRecarga,
  trocarArma, proximaArma, precisaRecarregar,
} from '../combat/weapons.js';

const TECLA_ARMA = { Digit1: 'pistola', Digit2: 'espingarda', Digit3: 'fuzil', Digit4: 'plasma' };

export function createJogador(jogo, x, y) {
  const p = {
    x, y, vx: 0, vy: 0,
    raio: JOGADOR.raio,
    ang: 0, angCorpo: 0, faseAndar: 0,
    vida: JOGADOR.vida, vidaMax: JOGADOR.vida,
    escudo: JOGADOR.escudo, escudoMax: JOGADOR.escudo,
    semDano: 99,
    esquivando: 0, esquivaCd: 0, invul: 0, esqX: 0, esqY: 0,
    morto: false,
    arsenal: criarArsenal(),
    arma: 'pistola',
    recuoVis: 0,
    coronhadaCd: 0, coronhadaVis: 0,
    lanternaLigada: true,
    carregando: false,
    passoT: 0,
    claraoT: 0, claraoTam: 0, claraoCor: '#ffe9a8',
    velMax: JOGADOR.velMax,
    danoMult: 1,
    mira: { x, y },
    stats: { tiros: 0, acertos: 0, mortes: 0, danoTomado: 0, itens: 0, passos: 0 },
  };

  /** Ponto de onde a bala sai (ponta do cano). */
  function boca() {
    return { x: p.x + Math.cos(p.ang) * 26, y: p.y + Math.sin(p.ang) * 26 };
  }

  function atirar() {
    const ars = p.arsenal;
    const a = armaAtual(ars);
    const b = boca();
    // Cano dentro da parede: o tiro morre ali mesmo, sem atravessar.
    if (jogo.mundo.solidoMundo(b.x, b.y)) {
      jogo.fx.faiscas(b.x, b.y, p.ang + Math.PI, 4);
      jogo.audio.tocar('impacto', 0.5);
      ars.esfriando = 1 / a.cadencia;
      ars.mag[a.id]--;
      return;
    }
    for (let i = 0; i < a.projeteis; i++) {
      const esp = (Math.random() - 0.5) * 2 * a.espalha;
      const ang = p.ang + esp;
      const vel = a.vel * (0.94 + Math.random() * 0.12);
      jogo.projeteis.criar({
        x: b.x, y: b.y,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
        dano: a.dano * p.danoMult * ars.danoMult,
        dono: 'jogador', raio: a.raio, cor: a.cor, tipo: a.id === 'plasma' ? 'plasma' : 'bala',
        alcance: a.alcance, empurrao: a.empurrao, splash: a.splash, luz: a.luz || 0,
      });
    }
    ars.mag[a.id]--;
    ars.esfriando = 1 / a.cadencia;
    if (a.tipoTiro === 'semi') ars.travado = true;

    // recuo, clarao, tremor e som
    p.vx -= Math.cos(p.ang) * a.recuo;
    p.vy -= Math.sin(p.ang) * a.recuo;
    p.recuoVis = Math.min(7, 2 + a.recuo * 0.03);
    p.claraoT = 0.055;
    p.claraoTam = 10 + a.projeteis * 1.2 + a.dano * 0.08;
    p.claraoCor = a.cor;
    jogo.fx.tremor(a.tremor);
    jogo.fx.fumaca(b.x, b.y, 1, 'rgba(190,180,200,', 0.45);
    jogo.audio.tocar(a.som);
    p.stats.tiros++;
    jogo.barulho(p.x, p.y, a.id === 'espingarda' || a.id === 'plasma' ? 900 : 620);
  }

  function coronhada() {
    p.coronhadaCd = JOGADOR.coronhada.recarga;
    p.coronhadaVis = 0.18;
    const alc = JOGADOR.coronhada.alcance;
    const arco = (JOGADOR.coronhada.arcoDeg * Math.PI) / 180;
    let acertou = false;
    for (const e of jogo.inimigos) {
      if (e.morto) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > alc + e.raio) continue;
      let dA = Math.atan2(dy, dx) - p.ang;
      dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      if (Math.abs(dA) > arco / 2) continue;
      jogo.danificarInimigo(e, JOGADOR.coronhada.dano * p.danoMult, Math.atan2(dy, dx), JOGADOR.coronhada.empurrao);
      acertou = true;
    }
    const b = boca();
    jogo.fx.faiscas(b.x, b.y, p.ang, acertou ? 8 : 3, '#cbd5f5');
    jogo.audio.tocar(acertou ? 'coronhada' : 'coronhadaVazia');
    if (acertou) { jogo.fx.tremor(3); jogo.fx.parar(0.045); }
  }

  function esquivar(ix, iy) {
    let dx = ix, dy = iy;
    if (dx === 0 && dy === 0) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); }
    const m = Math.hypot(dx, dy) || 1;
    p.esqX = dx / m; p.esqY = dy / m;
    p.esquivando = JOGADOR.esquiva.dur;
    p.invul = Math.max(p.invul, JOGADOR.esquiva.invul);
    p.esquivaCd = JOGADOR.esquiva.recarga;
    jogo.audio.tocar('esquiva');
    jogo.fx.fumaca(p.x, p.y, 4, 'rgba(160,150,180,', 0.6);
  }

  p.update = function update(dt, input) {
    if (p.morto) return;
    const ars = p.arsenal;

    // ------------------------------------------------------------ mira
    if (input.dispositivo === 'pad' && (Math.abs(input.pad.miraX) + Math.abs(input.pad.miraY)) > 0.2) {
      p.ang = Math.atan2(input.pad.miraY, input.pad.miraX);
      p.mira.x = p.x + Math.cos(p.ang) * 320;
      p.mira.y = p.y + Math.sin(p.ang) * 320;
    } else {
      const m = jogo.mouseMundo();
      p.mira.x = m.x; p.mira.y = m.y;
      p.ang = Math.atan2(m.y - p.y, m.x - p.x);
    }

    // ------------------------------------------------------------ movimento
    const eixo = input.eixo();
    if (p.esquivando > 0) {
      p.esquivando -= dt;
      const k = clamp01(p.esquivando / JOGADOR.esquiva.dur);
      const vel = JOGADOR.esquiva.vel * (0.35 + k * 0.65);
      p.vx = p.esqX * vel;
      p.vy = p.esqY * vel;
    } else {
      const acel = JOGADOR.aceleracao;
      p.vx += eixo.x * acel * dt;
      p.vy += eixo.y * acel * dt;
      const k = Math.exp(-JOGADOR.atrito * dt);
      p.vx *= k; p.vy *= k;
      let vmax = p.velMax * (p.carregando ? JOGADOR.cargaLentidao : 1);
      const terreno = jogo.mundo.terrenoEm(p.x, p.y);
      vmax *= terreno.freio;
      const v = Math.hypot(p.vx, p.vy);
      if (v > vmax) { p.vx = (p.vx / v) * vmax; p.vy = (p.vy / v) * vmax; }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    jogo.mundo.resolverCirculo(p);
    p.x = clamp(p.x, p.raio, jogo.mundo.largura - p.raio);
    p.y = clamp(p.y, p.raio, jogo.mundo.altura - p.raio);

    // acido queima
    const terreno = jogo.mundo.terrenoEm(p.x, p.y);
    if (terreno.dano > 0) {
      jogo.danificarJogador(terreno.dano * dt, 'acido', true);
      if (Math.random() < dt * 12) {
        jogo.fx.particula({
          x: p.x + (Math.random() - 0.5) * 16, y: p.y + (Math.random() - 0.5) * 16,
          vx: 0, vy: -30, vida: 0.5, raio: 2, cor: '#8dff5a', luz: 0.2,
        });
      }
    }

    // passos e giro do corpo
    const vel = Math.hypot(p.vx, p.vy);
    if (vel > 22) {
      p.angCorpo = angDamp(p.angCorpo, Math.atan2(p.vy, p.vx), 10, dt);
      p.faseAndar += dt * (2.5 + vel * 0.045) * 3;
      p.passoT -= dt * (vel / p.velMax);
      if (p.passoT <= 0) {
        p.passoT = 0.34;
        jogo.audio.tocar('passo', 0.35);
        p.stats.passos++;
        const tr = jogo.mundo.terrenoEm(p.x, p.y);
        if (tr.dano > 0) jogo.fx.particula({ x: p.x, y: p.y + 6, vx: 0, vy: -20, vida: 0.4, raio: 3, cor: '#8dff5a' });
      }
    } else {
      p.faseAndar *= 0.9;
    }

    // ------------------------------------------------------------ acoes
    if (p.esquivaCd > 0) p.esquivaCd -= dt;
    if (p.invul > 0) p.invul -= dt;
    if (p.coronhadaCd > 0) p.coronhadaCd -= dt;
    if (p.coronhadaVis > 0) p.coronhadaVis -= dt;
    if (p.claraoT > 0) p.claraoT -= dt;
    p.recuoVis *= Math.exp(-14 * dt);

    const querEsquivar = input.pressed('Space') || (input.pad.ativo && input.pad.esquiva && p.esquivaCd <= 0);
    if (querEsquivar && p.esquivaCd <= 0 && p.esquivando <= 0) esquivar(eixo.x, eixo.y);

    if (input.pressed('KeyF') && p.coronhadaCd <= 0) coronhada();
    if (input.pressed('KeyL')) {
      p.lanternaLigada = !p.lanternaLigada;
      jogo.audio.tocar('ui');
      jogo.mensagem(p.lanternaLigada ? 'Lanterna ligada.' : 'Lanterna desligada.');
    }

    // troca de arma
    for (const [tecla, id] of Object.entries(TECLA_ARMA)) {
      if (input.pressed(tecla) && trocarArma(ars, id)) jogo.audio.tocar('trocar');
    }
    if (input.pressed('KeyQ') || input.mouse.roda !== 0 || (input.pad.ativo && input.pad.troca)) {
      const dir = input.mouse.roda !== 0 ? Math.sign(input.mouse.roda) : 1;
      if (proximaArma(ars, dir)) jogo.audio.tocar('trocar');
    }
    p.arma = ars.atual;

    // recarga
    if (ars.recarregando > 0) {
      ars.recarregando -= dt;
      if (ars.recarregando <= 0) {
        concluirRecarga(ars);
        ars.recarregando = 0;
        jogo.audio.tocar('recarregar');
      }
    } else if (input.pressed('KeyR') || (input.pad.ativo && input.pad.recarga)) {
      if (recarregar(ars)) jogo.audio.tocar('recarregarInicio');
    }
    if (ars.esfriando > 0) ars.esfriando -= dt;

    // gatilho
    const a = armaAtual(ars);
    const gatilho = input.mouse.esq || (input.pad.ativo && input.pad.gatilho > 0.45);
    if (!gatilho) ars.travado = false;
    if (gatilho && !ars.travado && p.esquivando <= 0) {
      if (podeAtirar(ars)) atirar();
      else if (ars.esfriando <= 0 && ars.recarregando <= 0 && ars.mag[a.id] <= 0) {
        if (precisaRecarregar(ars)) { recarregar(ars); jogo.audio.tocar('recarregarInicio'); }
        else { jogo.audio.tocar('vazio'); ars.esfriando = 0.35; ars.travado = true; }
      }
    }
    // Recarga automatica quando o pente zera e o gatilho esta solto.
    if (ars.mag[a.id] <= 0 && ars.recarregando <= 0 && !gatilho && precisaRecarregar(ars)) {
      recarregar(ars);
      jogo.audio.tocar('recarregarInicio');
    }

    // ------------------------------------------------------------ escudo
    p.semDano += dt;
    if (p.semDano > JOGADOR.escudoAtraso && p.escudo < p.escudoMax) {
      const antes = p.escudo;
      p.escudo = Math.min(p.escudoMax, p.escudo + JOGADOR.escudoTaxa * dt);
      if (antes <= 0.01 && p.escudo > 0.01) jogo.audio.tocar('escudo');
    }
  };

  p.lanterna = function lanterna() {
    return {
      x: p.x, y: p.y, ang: p.ang,
      arco: (JOGADOR.lanterna.arcoDeg * Math.PI) / 180,
      alcance: JOGADOR.lanterna.alcance,
      ligada: p.lanternaLigada,
      i: 1,
    };
  };

  p.luzes = function luzes(out) {
    out.push({ x: p.x, y: p.y, r: 120, cor: '#9fd8ff', i: 0.42 });
    if (p.claraoT > 0) out.push({ x: p.x + Math.cos(p.ang) * 30, y: p.y + Math.sin(p.ang) * 30, r: 220, cor: p.claraoCor, i: 1 });
    if (p.carregando) out.push({ x: p.x, y: p.y, r: 150, cor: '#79ffd0', i: 0.5 });
  };

  p.curar = function curar(v) {
    const antes = p.vida;
    p.vida = Math.min(p.vidaMax, p.vida + v);
    return p.vida - antes;
  };

  p.reposicionar = function reposicionar(nx, ny) {
    p.x = nx; p.y = ny; p.vx = 0; p.vy = 0;
  };

  return p;
}
