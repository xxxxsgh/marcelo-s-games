/**
 * Camera 2D: segue o jogador com folga, olha um pouco na direcao da mira e
 * nunca mostra o lado de fora do vale.
 *
 * A escala vem da ALTURA da janela: todo mundo enxerga a mesma faixa vertical,
 * independente da resolucao. Monitor ultrawide ganha visao lateral, que num
 * shooter de cima e vantagem aceitavel (e evita distorcer o campo de jogo).
 */
import { GAME } from '../config.js';
import { clamp, damp } from '../core/mathx.js';

export function createCamera() {
  const cam = {
    x: 0, y: 0, zoom: 1, escala: 1,
    largura: 0, altura: 0,       // do canvas, em px de CSS
    esq: 0, dir: 0, topo: 0, base: 0,
    sacudirX: 0, sacudirY: 0,
  };

  cam.redimensionar = (w, h) => { cam.largura = w; cam.altura = h; };

  cam.seguir = (alvo, miraX, miraY, dt, mundo) => {
    const antX = clamp((miraX - alvo.x) * 0.22, -130, 130);
    const antY = clamp((miraY - alvo.y) * 0.22, -110, 110);
    const tx = alvo.x + antX;
    const ty = alvo.y + antY;
    cam.x = damp(cam.x, tx, 7.5, dt);
    cam.y = damp(cam.y, ty, 7.5, dt);
    cam.limitar(mundo);
  };

  cam.irPara = (x, y, mundo) => { cam.x = x; cam.y = y; cam.limitar(mundo); };

  cam.limitar = (mundo) => {
    if (!mundo) return;
    const meiaL = cam.largura / (2 * cam.escala);
    const meiaA = cam.altura / (2 * cam.escala);
    cam.x = mundo.largura > meiaL * 2 ? clamp(cam.x, meiaL, mundo.largura - meiaL) : mundo.largura / 2;
    cam.y = mundo.altura > meiaA * 2 ? clamp(cam.y, meiaA, mundo.altura - meiaA) : mundo.altura / 2;
  };

  /** Recalcula escala e retangulo visivel. Chame antes de desenhar. */
  cam.atualizar = (fx) => {
    cam.escala = (cam.altura / GAME.viewH) * cam.zoom;
    cam.sacudirX = fx ? fx.tremorX : 0;
    cam.sacudirY = fx ? fx.tremorY : 0;
    const meiaL = cam.largura / (2 * cam.escala);
    const meiaA = cam.altura / (2 * cam.escala);
    cam.esq = cam.x - meiaL - 40;
    cam.dir = cam.x + meiaL + 40;
    cam.topo = cam.y - meiaA - 40;
    cam.base = cam.y + meiaA + 40;
  };

  cam.aplicar = (ctx) => {
    ctx.setTransform(cam.escala, 0, 0, cam.escala,
      cam.largura / 2 - (cam.x + cam.sacudirX) * cam.escala,
      cam.altura / 2 - (cam.y + cam.sacudirY) * cam.escala);
  };

  cam.telaParaMundo = (sx, sy) => ({
    x: (sx - cam.largura / 2) / cam.escala + cam.x + cam.sacudirX,
    y: (sy - cam.altura / 2) / cam.escala + cam.y + cam.sacudirY,
  });

  cam.mundoParaTela = (wx, wy) => ({
    x: (wx - cam.x - cam.sacudirX) * cam.escala + cam.largura / 2,
    y: (wy - cam.y - cam.sacudirY) * cam.escala + cam.altura / 2,
  });

  /** Culling barato pro loop de desenho. */
  cam.visivel = (x, y, margem = 60) =>
    x > cam.esq - margem && x < cam.dir + margem && y > cam.topo - margem && y < cam.base + margem;

  return cam;
}
