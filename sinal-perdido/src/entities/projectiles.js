/**
 * Projeteis do jogador e dos bichos.
 *
 * O passo e subdividido pra bala nenhuma atravessar parede: com 1750 u/s e
 * dt=1/60 um tiro anda 29 unidades, quase um tile inteiro. Aqui cada bala anda
 * no maximo 10 unidades por teste.
 */
import { swapRemove, dist2 } from '../core/mathx.js';
import { desenharProjetil } from '../render/art.js';

const PASSO_MAX = 10;

export function createProjeteis(jogo) {
  const lista = [];

  function criar(o) {
    lista.push({
      x: o.x, y: o.y, vx: o.vx, vy: o.vy,
      dano: o.dano, dono: o.dono, raio: o.raio ?? 3,
      cor: o.cor ?? '#ffe9a8', tipo: o.tipo ?? 'bala',
      restante: o.alcance ?? 800, empurrao: o.empurrao ?? 60,
      splash: o.splash || null, luz: o.luz || 0,
      perfura: o.perfura || 0,
      atingidos: null,
    });
  }

  function impacto(b, x, y, alvo) {
    const ang = Math.atan2(b.vy, b.vx);
    if (b.splash) {
      jogo.explodir(x, y, b.splash.raio, b.splash.dano, b.dono, b.cor);
    } else if (alvo) {
      jogo.fx.sangue(x, y, ang, 6, alvo.corSangue || '#7bff5a');
    } else {
      jogo.fx.faiscas(x, y, ang + Math.PI, 5, b.tipo === 'acido' ? '#8dff5a' : '#ffd08a');
      if (b.tipo === 'acido') jogo.fx.mancha(x, y, 9, 'rgba(90,200,110,', 0.35);
    }
  }

  function update(dt) {
    const jog = jogo.jogador;
    for (let i = lista.length - 1; i >= 0; i--) {
      const b = lista[i];
      const v = Math.hypot(b.vx, b.vy);
      const passoTotal = v * dt;
      const n = Math.max(1, Math.ceil(passoTotal / PASSO_MAX));
      const sdt = dt / n;
      let morreu = false;

      for (let s = 0; s < n && !morreu; s++) {
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.restante -= v * sdt;

        if (b.restante <= 0) { impacto(b, b.x, b.y, null); morreu = true; break; }
        if (jogo.mundo.solidoMundo(b.x, b.y)) { impacto(b, b.x, b.y, null); morreu = true; break; }

        if (b.dono === 'jogador') {
          for (let k = 0; k < jogo.inimigos.length; k++) {
            const e = jogo.inimigos[k];
            if (e.morto) continue;
            const rr = e.raio + b.raio;
            if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
            if (b.perfura && b.atingidos && b.atingidos.has(e.id)) continue;
            impacto(b, b.x, b.y, e);
            jogo.danificarInimigo(e, b.dano, Math.atan2(b.vy, b.vx), b.empurrao);
            if (b.perfura > 0) {
              b.perfura--;
              (b.atingidos ||= new Set()).add(e.id);
              b.dano *= 0.75;
            } else morreu = true;
            break;
          }
          if (morreu) break;
          for (const nin of jogo.ninhos) {
            if (nin.destruido) continue;
            const rr = nin.raio + b.raio;
            if (dist2(b.x, b.y, nin.x, nin.y) > rr * rr) continue;
            impacto(b, b.x, b.y, { corSangue: '#ff7ad4' });
            jogo.danificarNinho(nin, b.dano);
            morreu = true;
            break;
          }
        } else {
          const rr = jog.raio + b.raio;
          if (!jog.morto && dist2(b.x, b.y, jog.x, jog.y) <= rr * rr) {
            impacto(b, b.x, b.y, { corSangue: '#ff3d6e' });
            jogo.danificarJogador(b.dano, b.tipo === 'acido' ? 'cuspe' : 'tiro', false, b);
            morreu = true;
          }
        }
      }

      if (morreu) swapRemove(lista, i);
    }
  }

  function desenhar(ctx) {
    for (const b of lista) {
      if (!jogo.cam.visivel(b.x, b.y, 40)) continue;
      desenharProjetil(ctx, b);
    }
  }

  function luzes(out) {
    for (const b of lista) {
      if (!b.luz) continue;
      out.push({ x: b.x, y: b.y, r: 90 * b.luz, cor: b.cor, i: 0.75 });
    }
  }

  return {
    lista, criar, update, desenhar, luzes,
    limpar() { lista.length = 0; },
    get contagem() { return lista.length; },
  };
}
