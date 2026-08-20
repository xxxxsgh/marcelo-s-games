/**
 * Camada de luz.
 *
 * Desenha um buffer em MEIA resolucao onde o ambiente e um cinza (o quanto o
 * mundo enxerga sozinho) e cada luz e um sprite radial somado por cima. No fim
 * o buffer entra na cena com `multiply`. E o truque classico de 2D: uma
 * multiplicacao de tela inteira substitui iluminacao por objeto, e a meia
 * resolucao ainda deixa a borda da luz macia de graca.
 */
import { clamp01, lerp } from '../core/mathx.js';

const spriteCache = new Map();

function spriteLuz(cor) {
  let s = spriteCache.get(cor);
  if (s) return s;
  const R = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = R * 2;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(R, R, 0, R, R, R);
  const [r, gg, b] = paraRgb(cor);
  g.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  g.addColorStop(0.42, `rgba(${r},${gg},${b},0.45)`);
  g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, R * 2, R * 2);
  spriteCache.set(cor, cv);
  return cv;
}

function paraRgb(cor) {
  if (cor.startsWith('#')) {
    const h = cor.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = cor.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
}

export function createLighting() {
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d');
  let escala = 0.5;
  let w = 1, h = 1;

  function redimensionar(largura, altura) {
    w = Math.max(1, Math.floor(largura * escala));
    h = Math.max(1, Math.floor(altura * escala));
    cv.width = w; cv.height = h;
  }

  /**
   * @param {number} ambiente 0..1 — 1 e dia aberto, 0 e escuridao total
   * @param {Array} luzes lista {x,y,r,cor,i} em coordenadas de mundo
   * @param {object} lanterna {x,y,ang,arco,alcance,ligada}
   */
  function render(ctx, cam, ambiente, luzes, lanterna) {
    const amb = clamp01(ambiente);
    // A noite puxa pro azul: cinza puro deixa o planeta morto.
    const r = Math.round(lerp(38, 255, amb ** 0.9));
    const g = Math.round(lerp(44, 250, amb ** 0.9));
    const b = Math.round(lerp(72, 240, amb ** 0.9));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = `rgb(${r},${g},${b})`;
    c.fillRect(0, 0, w, h);

    const k = cam.escala * escala;
    const cxs = w / 2, cys = h / 2;
    const px = (x) => (x - cam.x - cam.sacudirX) * k + cxs;
    const py = (y) => (y - cam.y - cam.sacudirY) * k + cys;

    c.globalCompositeOperation = 'lighter';

    if (lanterna && lanterna.ligada) {
      const lx = px(lanterna.x), ly = py(lanterna.y);
      const alc = lanterna.alcance * k;
      const grad = c.createRadialGradient(lx, ly, 6, lx, ly, alc);
      const inten = lanterna.i ?? 1;
      grad.addColorStop(0, `rgba(255,244,214,${0.85 * inten})`);
      grad.addColorStop(0.55, `rgba(255,232,190,${0.34 * inten})`);
      grad.addColorStop(1, 'rgba(255,225,180,0)');
      c.fillStyle = grad;
      // O borrao tira a aresta dura do cone — feixe de lanterna nao tem quina.
      c.filter = `blur(${Math.max(2, alc * 0.05).toFixed(1)}px)`;
      c.beginPath();
      c.moveTo(lx, ly);
      c.arc(lx, ly, alc, lanterna.ang - lanterna.arco / 2, lanterna.ang + lanterna.arco / 2);
      c.closePath();
      c.fill();
      c.filter = 'none';
    }

    for (const l of luzes) {
      const raio = l.r * k;
      if (raio < 1) continue;
      const x = px(l.x), y = py(l.y);
      if (x < -raio || y < -raio || x > w + raio || y > h + raio) continue;
      c.globalAlpha = clamp01(l.i ?? 1);
      const s = spriteLuz(l.cor || '#ffffff');
      c.drawImage(s, x - raio, y - raio, raio * 2, raio * 2);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // aplica na cena
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(cv, 0, 0, cam.largura, cam.altura);
    ctx.globalCompositeOperation = 'source-over';
  }

  return {
    redimensionar, render,
    set qualidade(v) { escala = v; },
    get qualidade() { return escala; },
  };
}
