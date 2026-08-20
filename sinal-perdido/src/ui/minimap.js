/**
 * Minimapa com neblina de guerra.
 *
 * O vale inteiro cabe num canvas de 1 pixel por tile. Ele so e repintado nos
 * tiles recem-descobertos (o jogo entrega a lista), entao o custo por frame e
 * um `drawImage` mais os pontinhos vivos.
 */
import { T, PALETA } from '../config.js';
import { clamp01, TAU } from '../core/mathx.js';
import { hexA } from '../fx/index.js';

let cache = null;

function garantirCache(jogo) {
  if (cache && cache.mapa === jogo.mapa) return cache;
  const cv = document.createElement('canvas');
  cv.width = jogo.mapa.w;
  cv.height = jogo.mapa.h;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  cache = { mapa: jogo.mapa, cv, c };
  return cache;
}

const COR_TILE = {
  [T.CHAO]: '#3a3346',
  [T.FUNGO]: '#513a6b',
  [T.ACIDO]: '#2f6b45',
  [T.ROCHA]: '#15111d',
  [T.CRISTAL]: '#2c6b78',
  [T.RUINA]: '#2a2430',
};

export function desenharMinimapa(ctx, jogo, x, y, tam) {
  const { cv, c } = garantirCache(jogo);
  const mapa = jogo.mapa;

  // pinta o que foi descoberto desde o ultimo frame
  if (jogo.tilesNovos.length) {
    for (const i of jogo.tilesNovos) {
      const tx = i % mapa.w, ty = (i / mapa.w) | 0;
      const t = mapa.tiles[i];
      c.fillStyle = COR_TILE[t] || COR_TILE[T.CHAO];
      c.fillRect(tx, ty, 1, 1);
    }
    jogo.tilesNovos.length = 0;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(8,6,12,0.72)';
  ctx.fillRect(x, y, tam, tam);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, x, y, tam, tam);
  ctx.imageSmoothingEnabled = true;

  const k = tam / (mapa.w * mapa.tile);
  const px = (wx) => x + wx * k;
  const py = (wy) => y + wy * k;

  // nave
  const nave = jogo.nave;
  ctx.fillStyle = jogo.jogador.carregando ? '#79ffd0' : '#4ec9a8';
  ctx.beginPath();
  ctx.arc(px(nave.x), py(nave.y), 3.5, 0, TAU);
  ctx.fill();
  if (jogo.jogador.carregando) {
    ctx.strokeStyle = hexA('#79ffd0', 0.4 + Math.sin(jogo.tempo * 5) * 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px(nave.x), py(nave.y), 7, 0, TAU);
    ctx.stroke();
  }

  // ninhos conhecidos
  for (const n of jogo.ninhos) {
    if (!n.descoberto) continue;
    ctx.fillStyle = n.destruido ? '#4a3040' : '#ff3d6e';
    ctx.beginPath();
    ctx.arc(px(n.x), py(n.y), n.destruido ? 2.5 : 3.5, 0, TAU);
    ctx.fill();
  }

  // capsulas conhecidas
  for (const cap of jogo.capsulas) {
    if (!cap.descoberta || cap.aberta) continue;
    ctx.fillStyle = PALETA.aviso;
    ctx.fillRect(px(cap.x) - 1.5, py(cap.y) - 1.5, 3, 3);
  }

  // nucleos soltos no chao
  for (const it of jogo.itens.lista) {
    if (it.tipo !== 'nucleo') continue;
    ctx.fillStyle = '#79ffd0';
    ctx.beginPath();
    ctx.arc(px(it.x), py(it.y), 2.5, 0, TAU);
    ctx.fill();
  }

  // bichos por perto (o traje so detecta o que esta a 900 unidades)
  for (const e of jogo.inimigos) {
    const d = Math.hypot(e.x - jogo.jogador.x, e.y - jogo.jogador.y);
    if (d > 900) continue;
    ctx.fillStyle = hexA(e.chefe ? '#ff3d6e' : '#ff7a3d', clamp01(1 - d / 900) * 0.9);
    ctx.fillRect(px(e.x) - 1, py(e.y) - 1, e.chefe ? 4 : 2, e.chefe ? 4 : 2);
  }

  // jogador
  const jog = jogo.jogador;
  ctx.save();
  ctx.translate(px(jog.x), py(jog.y));
  ctx.rotate(jog.ang);
  ctx.fillStyle = '#e6f2ff';
  ctx.beginPath();
  ctx.moveTo(5, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-3, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(140,160,200,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, tam - 1, tam - 1);
  ctx.restore();
}
