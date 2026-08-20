/**
 * Fauna hostil.
 *
 * A IA e de proposito burra e legivel: perceber (visao + barulho), lembrar por
 * alguns segundos, andar contornando pedra com "bigodes" e atacar. Nada de A*
 * — o vale e aberto o bastante pra isso ficar caro sem melhorar a leitura do
 * combate, e um bicho que trava numa quina por meio segundo parece bicho.
 */
import { swapRemove, dist2, angDamp, clamp, TAU } from '../core/mathx.js';
import { desenharInimigo } from '../render/art.js';

export const TIPOS = {
  rastejante: {
    vida: 42, vel: 154, raio: 13, dano: 12, ataqueCd: 0.85, percepcao: 640,
    ritmo: 13, empurravel: 1,
  },
  cuspidor: {
    vida: 60, vel: 100, raio: 15, dano: 15, ataqueCd: 2.1, percepcao: 760,
    ritmo: 8, empurravel: 0.85, distIdeal: 300,
  },
  ariete: {
    vida: 150, vel: 92, raio: 21, dano: 30, ataqueCd: 1.5, percepcao: 660,
    ritmo: 6, empurravel: 0.35,
  },
  enxame: {
    vida: 18, vel: 250, raio: 8, dano: 7, ataqueCd: 0.55, percepcao: 820,
    ritmo: 22, empurravel: 1.4, voa: true,
  },
  rainha: {
    vida: 2800, vel: 96, raio: 46, dano: 34, ataqueCd: 1.2, percepcao: 1600,
    ritmo: 5, empurravel: 0.08, chefe: true,
  },
};

let proximoId = 1;

export function criarInimigo(jogo, tipo, x, y, opts = {}) {
  const t = TIPOS[tipo];
  const escala = 1 + jogo.dificuldade * 0.12;
  const e = {
    id: proximoId++,
    tipo, x, y, vx: 0, vy: 0,
    raio: t.raio,
    vida: t.vida * escala, vidaMax: t.vida * escala,
    vel: t.vel * (0.94 + Math.random() * 0.12),
    dano: t.dano, ataqueCd: 0, percepcao: t.percepcao,
    ang: Math.random() * TAU, fase: Math.random() * TAU, ritmo: t.ritmo,
    flash: 0, morto: false, voa: !!t.voa, chefe: !!t.chefe,
    corSangue: tipo === 'cuspidor' ? '#8dff5a' : tipo === 'ariete' ? '#ffb03a' : '#ff7ad4',
    estado: 'vagando', tempoEstado: 0,
    alvoX: x, alvoY: y, viuAgora: false, memoria: 0,
    giro: Math.random() < 0.5 ? -1 : 1,
    travado: 0,
    carga: 0,
    ninho: opts.ninho || null,
    cerco: !!opts.cerco,
    ...opts,
  };
  return e;
}

function livre(jogo, e, ang, alcance) {
  const x1 = e.x + Math.cos(ang) * alcance;
  const y1 = e.y + Math.sin(ang) * alcance;
  if (jogo.mundo.solidoMundo(x1, y1)) return false;
  const xm = e.x + Math.cos(ang) * alcance * 0.55;
  const ym = e.y + Math.sin(ang) * alcance * 0.55;
  return !jogo.mundo.solidoMundo(xm, ym);
}

/** Escolhe a direcao: alvo direto, ou o desvio mais barato que estiver livre. */
function rumo(jogo, e, alvoX, alvoY) {
  const desejado = Math.atan2(alvoY - e.y, alvoX - e.x);
  if (e.voa) return desejado;
  const alcance = e.raio + 40;
  if (livre(jogo, e, desejado, alcance)) return desejado;
  for (const off of [0.45, 0.95, 1.5, 2.1, 2.8]) {
    if (livre(jogo, e, desejado + off * e.giro, alcance)) return desejado + off * e.giro;
    if (livre(jogo, e, desejado - off * e.giro, alcance)) return desejado - off * e.giro;
  }
  return desejado + Math.PI * 0.5 * e.giro;
}

function acelerar(e, dt, ang, vel, taxa = 9) {
  e.ang = angDamp(e.ang, ang, taxa, dt);
  const tx = Math.cos(e.ang) * vel, ty = Math.sin(e.ang) * vel;
  const k = 1 - Math.exp(-6 * dt);
  e.vx += (tx - e.vx) * k;
  e.vy += (ty - e.vy) * k;
}

export function createInimigos(jogo) {
  const lista = jogo.inimigos;

  function atualizar(dt) {
    const jog = jogo.jogador;
    for (let i = lista.length - 1; i >= 0; i--) {
      const e = lista[i];
      if (e.morto) { swapRemove(lista, i); continue; }
      passo(e, dt, jog);
    }
    separar(dt);
  }

  /** Empurrao mutuo: evita meia duzia de bichos virarem um pixel so. */
  function separar(dt) {
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      for (let j = i + 1; j < lista.length; j++) {
        const b = lista[j];
        const rr = (a.raio + b.raio) * 0.92;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 > rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        const forca = (rr - d) * 14 * dt;
        const ka = a.chefe ? 0.05 : 1, kb = b.chefe ? 0.05 : 1;
        a.vx -= nx * forca * ka; a.vy -= ny * forca * ka;
        b.vx += nx * forca * kb; b.vy += ny * forca * kb;
      }
    }
  }

  function passo(e, dt, jog) {
    e.tempoEstado += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.ataqueCd > 0) e.ataqueCd -= dt;
    if (e.travado > 0) e.travado -= dt;

    const dxJ = jog.x - e.x, dyJ = jog.y - e.y;
    const distJ = Math.hypot(dxJ, dyJ);

    // ------------------------------------------------------- percepcao
    const podeVer = distJ < e.percepcao && !jog.morto
      && (e.voa || jogo.mundo.linhaLivre(e.x, e.y, jog.x, jog.y));
    if (podeVer) {
      e.viuAgora = true;
      e.memoria = 4.5;
      e.alvoX = jog.x; e.alvoY = jog.y;
      if (e.estado === 'vagando') {
        e.estado = 'cacando';
        e.tempoEstado = 0;
        if (Math.random() < 0.35) jogo.audio.tocar('grito', 0.5, distJ);
      }
    } else {
      e.viuAgora = false;
      e.memoria -= dt;
      if (e.memoria <= 0 && e.estado === 'cacando') { e.estado = 'vagando'; e.tempoEstado = 0; }
    }

    switch (e.tipo) {
      case 'rastejante': ia_rastejante(e, dt, jog, distJ); break;
      case 'cuspidor': ia_cuspidor(e, dt, jog, distJ); break;
      case 'ariete': ia_ariete(e, dt, jog, distJ); break;
      case 'enxame': ia_enxame(e, dt, jog, distJ); break;
      case 'rainha': ia_rainha(e, dt, jog, distJ); break;
      default: ia_rastejante(e, dt, jog, distJ);
    }

    // ------------------------------------------------------- fisica
    const atrito = Math.exp(-(e.voa ? 3.5 : 7) * dt);
    e.vx *= atrito; e.vy *= atrito;
    const antesX = e.x, antesY = e.y;
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (e.voa) {
      // Voa por cima da pedra, mas nao sai do vale.
    } else {
      const bateu = jogo.mundo.resolverCirculo(e);
      if (bateu) {
        // Preso na mesma pedra: inverte o lado preferido pra contornar.
        if (Math.hypot(e.x - antesX, e.y - antesY) < 0.4) {
          e.travado += dt;
          if (e.travado > 0.5) { e.giro *= -1; e.travado = 0; }
        }
        if (e.estado === 'carregando') fimDaCarga(e, true);
      }
    }

    // Cinto de seguranca: nenhum bicho existe fora do vale. Uma coordenada
    // absurda aqui contamina colisao, IA e desenho de uma vez so.
    e.x = clamp(e.x, 20, jogo.mundo.largura - 20);
    e.y = clamp(e.y, 20, jogo.mundo.altura - 20);

    // acido machuca todo mundo, inclusive quem mora aqui
    const terreno = jogo.mundo.terrenoEm(e.x, e.y);
    if (terreno.dano > 0 && !e.voa) danificar(e, terreno.dano * 0.35 * dt, 0, 0, true);

    // ------------------------------------------------------- contato
    if (!jog.morto && e.ataqueCd <= 0 && e.estado !== 'preparando') {
      const rr = e.raio + jog.raio + 2;
      if (dist2(e.x, e.y, jog.x, jog.y) < rr * rr) {
        const ang = Math.atan2(dyJ, dxJ);
        const dano = e.estado === 'carregando' ? e.dano * 1.6 : e.dano;
        if (jogo.danificarJogador(dano, 'contato', false, e)) {
          jog.vx += Math.cos(ang) * (e.chefe ? 380 : 190);
          jog.vy += Math.sin(ang) * (e.chefe ? 380 : 190);
          jogo.fx.sangue(jog.x, jog.y, ang, 5, '#ff3d6e');
        }
        e.ataqueCd = TIPOS[e.tipo].ataqueCd;
        e.vx -= Math.cos(ang) * 120;
        e.vy -= Math.sin(ang) * 120;
        if (e.estado === 'carregando') fimDaCarga(e, false);
      }
    }
  }

  // ------------------------------------------------------------- por tipo
  function vagar(e, dt) {
    if (e.tempoEstado > 2.2 || (e.alvoX === undefined)) {
      e.tempoEstado = 0;
      const p = jogo.mundo.pontoLivre(jogo.rngFx, e.x, e.y, 90, 260, 8);
      if (p) { e.alvoX = p.x; e.alvoY = p.y; }
    }
    acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel * 0.34, 4);
  }

  function ia_rastejante(e, dt, jog, distJ) {
    if (e.estado === 'saltando') {
      if (e.tempoEstado > 0.42) { e.estado = 'cacando'; e.tempoEstado = 0; }
      return;
    }
    if (e.estado === 'cacando' || e.memoria > 0) {
      // Salto curto pra fechar distancia: e o que torna o rastejante perigoso.
      if (distJ < 190 && distJ > 60 && e.ataqueCd <= 0 && e.viuAgora && Math.random() < dt * 1.6) {
        const a = Math.atan2(jog.y - e.y, jog.x - e.x);
        e.vx = Math.cos(a) * 520; e.vy = Math.sin(a) * 520;
        e.estado = 'saltando'; e.tempoEstado = 0;
        jogo.audio.tocar('salto', 0.45, distJ);
        return;
      }
      acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel);
    } else vagar(e, dt);
  }

  function ia_cuspidor(e, dt, jog, distJ) {
    if (e.estado === 'cuspindo') {
      e.carga += dt / 0.65;
      acelerar(e, dt, Math.atan2(jog.y - e.y, jog.x - e.x), 0, 7);
      if (e.carga >= 1) {
        const a = Math.atan2(jog.y - e.y, jog.x - e.x) + (Math.random() - 0.5) * 0.09;
        jogo.projeteis.criar({
          x: e.x + Math.cos(a) * e.raio, y: e.y + Math.sin(a) * e.raio,
          vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          dano: e.dano, dono: 'inimigo', raio: 5, cor: '#8dff5a', tipo: 'acido',
          alcance: 760, luz: 0.5,
        });
        jogo.audio.tocar('cuspe', 0.6, distJ);
        e.carga = 0;
        e.ataqueCd = TIPOS.cuspidor.ataqueCd;
        e.estado = 'cacando'; e.tempoEstado = 0;
      }
      return;
    }
    if (e.estado === 'cacando' || e.memoria > 0) {
      const ideal = TIPOS.cuspidor.distIdeal;
      if (e.viuAgora && e.ataqueCd <= 0 && distJ < 520 && distJ > 90) {
        e.estado = 'cuspindo'; e.tempoEstado = 0; e.carga = 0;
        return;
      }
      // mantem distancia: aproxima se longe, recua se colado
      const dir = distJ > ideal * 1.25 ? 1 : distJ < ideal * 0.7 ? -1 : 0;
      const base = Math.atan2(jog.y - e.y, jog.x - e.x);
      if (dir === 0) {
        acelerar(e, dt, base + Math.PI * 0.5 * e.giro, e.vel * 0.8, 5);
      } else if (dir > 0) {
        acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel);
      } else {
        acelerar(e, dt, base + Math.PI, e.vel * 0.9, 7);
      }
    } else vagar(e, dt);
  }

  function fimDaCarga(e, bateuParede) {
    e.estado = 'cacando';
    e.tempoEstado = 0;
    e.ataqueCd = TIPOS.ariete.ataqueCd;
    if (bateuParede) {
      e.estado = 'atordoado';
      jogo.fx.tremor(5);
      jogo.fx.faiscas(e.x + Math.cos(e.ang) * e.raio, e.y + Math.sin(e.ang) * e.raio, e.ang, 10, '#ffb03a');
      jogo.audio.tocar('impactoPesado', 0.7, Math.hypot(jogo.jogador.x - e.x, jogo.jogador.y - e.y));
      danificar(e, 18, e.ang + Math.PI, 0);
    }
  }

  function ia_ariete(e, dt, jog, distJ) {
    if (e.estado === 'atordoado') {
      if (e.tempoEstado > 1.35) { e.estado = 'cacando'; e.tempoEstado = 0; }
      return;
    }
    if (e.estado === 'preparando') {
      acelerar(e, dt, Math.atan2(jog.y - e.y, jog.x - e.x), 0, 3.2);
      if (e.tempoEstado > 0.75) {
        e.estado = 'carregando'; e.tempoEstado = 0;
        const a = e.ang;
        e.vx = Math.cos(a) * 660; e.vy = Math.sin(a) * 660;
        jogo.audio.tocar('investida', 0.7, distJ);
      }
      return;
    }
    if (e.estado === 'carregando') {
      const a = e.ang;
      e.vx = Math.cos(a) * 660; e.vy = Math.sin(a) * 660;
      jogo.fx.particula({
        x: e.x - Math.cos(a) * e.raio, y: e.y - Math.sin(a) * e.raio,
        vx: 0, vy: 0, vida: 0.35, raio: 6, cor: 'rgba(180,140,110,', tipo: 'fumaca',
      });
      if (e.tempoEstado > 0.95) fimDaCarga(e, false);
      return;
    }
    if (e.estado === 'cacando' || e.memoria > 0) {
      if (e.viuAgora && e.ataqueCd <= 0 && distJ < 460 && distJ > 110) {
        e.estado = 'preparando'; e.tempoEstado = 0;
        jogo.audio.tocar('rugido', 0.6, distJ);
        return;
      }
      acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel);
    } else vagar(e, dt);
  }

  function ia_enxame(e, dt, jog, distJ) {
    if (e.estado === 'cacando' || e.memoria > 0) {
      // Voo em espiral: dificil de acertar e horrivel de ignorar.
      const base = Math.atan2(e.alvoY - e.y, e.alvoX - e.x);
      const oscila = Math.sin(jogo.tempo * 6 + e.fase) * (distJ > 180 ? 0.55 : 0.95);
      acelerar(e, dt, base + oscila, e.vel, 12);
    } else {
      vagar(e, dt);
    }
  }

  function ia_rainha(e, dt, jog, distJ) {
    if (e.estado === 'salva') {
      if (e.tempoEstado > 1.1) { e.estado = 'cacando'; e.tempoEstado = 0; }
      acelerar(e, dt, Math.atan2(jog.y - e.y, jog.x - e.x), 0, 4);
      return;
    }
    if (e.estado === 'ninhada') {
      acelerar(e, dt, Math.atan2(jog.y - e.y, jog.x - e.x), 0, 4);
      if (e.tempoEstado > 1.0) {
        for (let i = 0; i < 3; i++) {
          const a = e.fase + (i / 3) * TAU + jogo.tempo;
          const p = { x: e.x + Math.cos(a) * (e.raio + 26), y: e.y + Math.sin(a) * (e.raio + 26) };
          if (jogo.mundo.solidoMundo(p.x, p.y)) continue;
          const f = criarInimigo(jogo, 'rastejante', p.x, p.y, { cerco: true });
          f.estado = 'cacando';
          lista.push(f);
          jogo.fx.sangue(p.x, p.y, a, 8, '#ff7ad4');
        }
        jogo.audio.tocar('ninhada', 0.7, distJ);
        e.estado = 'cacando'; e.tempoEstado = 0; e.ataqueCd = 2.6;
      }
      return;
    }
    if (e.estado === 'cacando' || e.memoria > 0 || e.cerco) {
      if (e.ataqueCd <= 0 && e.viuAgora) {
        const sorteio = Math.random();
        if (distJ > 260 && sorteio < 0.45) {
          // salva de acido em leque
          e.estado = 'salva'; e.tempoEstado = 0;
          const base = Math.atan2(jog.y - e.y, jog.x - e.x);
          for (let i = -2; i <= 2; i++) {
            const a = base + i * 0.19;
            jogo.projeteis.criar({
              x: e.x + Math.cos(a) * e.raio, y: e.y + Math.sin(a) * e.raio,
              vx: Math.cos(a) * 400, vy: Math.sin(a) * 400,
              dano: 16, dono: 'inimigo', raio: 6, cor: '#ff7ad4', tipo: 'acido',
              alcance: 900, luz: 0.6,
            });
          }
          jogo.audio.tocar('cuspe', 0.8, distJ);
          e.ataqueCd = 3.2;
          return;
        }
        if (sorteio < 0.75) {
          e.estado = 'ninhada'; e.tempoEstado = 0;
          jogo.audio.tocar('rugido', 0.8, distJ);
          return;
        }
      }
      acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel, 4);
    } else {
      e.alvoX = jogo.jogador.x; e.alvoY = jogo.jogador.y;
      acelerar(e, dt, rumo(jogo, e, e.alvoX, e.alvoY), e.vel * 0.7, 4);
    }
  }

  // ------------------------------------------------------------- dano/morte
  function danificar(e, dano, ang, empurrao, silencioso = false) {
    if (e.morto) return;
    e.vida -= dano;
    e.flash = 0.07;
    if (!silencioso) {
      e.memoria = 5;
      e.alvoX = jogo.jogador.x; e.alvoY = jogo.jogador.y;
      if (e.estado === 'vagando') e.estado = 'cacando';
      const emp = empurrao * TIPOS[e.tipo].empurravel;
      e.vx += Math.cos(ang) * emp;
      e.vy += Math.sin(ang) * emp;
    }
    if (e.vida <= 0) matar(e, ang);
  }

  function matar(e, ang) {
    e.morto = true;
    const t = TIPOS[e.tipo];
    jogo.fx.sangue(e.x, e.y, ang, 14 + t.raio, e.corSangue);
    jogo.fx.mancha(e.x, e.y, e.raio * 1.4, e.corSangue, 0.22);
    jogo.audio.tocar(e.chefe ? 'morteChefe' : 'morte', 0.7, Math.hypot(jogo.jogador.x - e.x, jogo.jogador.y - e.y));
    if (e.chefe) {
      jogo.fx.explosao(e.x, e.y, 150, '#ff7ad4');
      jogo.fx.parar(0.16);
      jogo.fx.clarao(0.5, '#ff7ad4');
    } else if (e.raio > 18) {
      jogo.fx.tremor(3);
    }
    jogo.aoMatar(e);
  }

  /** O jogo desenha um por um: a ordem e por Y, decidida la fora. */
  function desenharUm(ctx, e) {
    desenharInimigo(ctx, e, jogo.tempo);
  }

  function luzes(out) {
    for (const e of lista) {
      if (!jogo.cam.visivel(e.x, e.y, 60)) continue;
      if (e.tipo === 'cuspidor') out.push({ x: e.x, y: e.y, r: 60, cor: '#8dff5a', i: 0.25 + e.carga * 0.5 });
      else if (e.tipo === 'ariete' && e.estado === 'preparando') out.push({ x: e.x, y: e.y, r: 90, cor: '#ff9a3d', i: 0.6 });
      else if (e.tipo === 'rainha') out.push({ x: e.x, y: e.y, r: 170, cor: '#ff7ad4', i: 0.5 });
      else if (e.tipo === 'enxame') out.push({ x: e.x, y: e.y, r: 40, cor: '#ff7ad4', i: 0.22 });
    }
  }

  return { atualizar, desenharUm, luzes, danificar, matar, criar: (tipo, x, y, o) => {
    const e = criarInimigo(jogo, tipo, x, y, o);
    lista.push(e);
    return e;
  } };
}
