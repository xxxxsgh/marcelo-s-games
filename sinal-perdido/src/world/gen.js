/**
 * Geracao do vale onde a capsula cai.
 *
 * Tudo sai de uma seed: bioma, rocha, acido, cristal e a posicao dos ninhos.
 * A ordem e sempre: ruido -> biomas -> solidos -> clareiras dos pontos de
 * interesse -> corredores -> verificacao de alcance. As duas ultimas etapas sao
 * o que garante que o mapa e jogavel: o ruido sozinho fecha bolsoes.
 */
import { createRng, fbm, fbmWarp, hash2 } from '../core/rng.js';
import { MAPA, T, BIOMA, SOLIDO_MIN } from '../config.js';

const idx = (x, y) => y * MAPA.w + x;

/** Limiar de rocha por bioma — quanto menor, mais fechado o terreno. */
const LIMIAR_ROCHA = {
  [BIOMA.PLANICIE]: 0.70,
  [BIOMA.FUNGAL]: 0.63,
  [BIOMA.PEDREGAL]: 0.53,
  [BIOMA.PANTANO]: 0.68,
  [BIOMA.CRISTALINO]: 0.60,
};

export function gerarMundo(seedTxt) {
  const rng = createRng(seedTxt);
  const seed = (rng.int(0, 0x7fffffff)) >>> 0;
  const { w, h, tile, borda } = MAPA;

  const tiles = new Uint8Array(w * h);
  const bioma = new Uint8Array(w * h);

  // --- 1. biomas em manchas grandes -------------------------------------
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = fbmWarp(seed + 11, x / 30, y / 30, 4, 1.1);
      const m = fbmWarp(seed + 29, x / 26 + 40, y / 26 + 40, 4, 1.1);
      let b = BIOMA.PLANICIE;
      if (m > 0.62 && t < 0.52) b = BIOMA.PANTANO;
      else if (m > 0.55) b = BIOMA.FUNGAL;
      else if (t > 0.63) b = BIOMA.PEDREGAL;
      else if (t < 0.36) b = BIOMA.CRISTALINO;
      bioma[idx(x, y)] = b;
    }
  }

  // --- 2. solidos e liquidos --------------------------------------------
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const b = bioma[i];
      const r = fbmWarp(seed + 71, x / 9.5, y / 9.5, 4, 1.4);
      const d = fbmWarp(seed + 97, x / 4.5, y / 4.5, 3, 1.2);
      let tipo = T.CHAO;

      if (r > LIMIAR_ROCHA[b]) {
        tipo = (b === BIOMA.CRISTALINO && d > 0.58) ? T.CRISTAL : T.ROCHA;
      } else if (b === BIOMA.PANTANO && d > 0.60 && r < 0.55) {
        tipo = T.ACIDO;
      } else if (b === BIOMA.FUNGAL && d > 0.52) {
        tipo = T.FUNGO;
      } else if (b === BIOMA.CRISTALINO && d > 0.80) {
        tipo = T.CRISTAL;
      }
      tiles[i] = tipo;
    }
  }

  // Muralha da borda: o vale e uma cratera fechada, nao existe "sair do mapa".
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d < borda) tiles[idx(x, y)] = T.ROCHA;
      else if (d < borda + 2 && hash2(seed, x, y) > 0.45) tiles[idx(x, y)] = T.ROCHA;
    }
  }

  // --- 3. pontos de interesse -------------------------------------------
  const cx = w >> 1, cy = h >> 1;
  const nave = { tx: cx + rng.int(-6, 6), ty: cy + rng.int(-6, 6) };
  nave.x = (nave.tx + 0.5) * tile;
  nave.y = (nave.ty + 0.5) * tile;

  const ninhos = [];
  const minSep = 26;                       // tiles entre ninhos
  const raioMin = 34, raioMax = Math.min(w, h) / 2 - borda - 12;
  for (let n = 0; n < MAPA.ninhos; n++) {
    let melhor = null, melhorNota = -1;
    for (let tent = 0; tent < 300; tent++) {
      const ang = rng.ang();
      const raio = rng.float(raioMin, raioMax);
      const tx = Math.round(nave.tx + Math.cos(ang) * raio);
      const ty = Math.round(nave.ty + Math.sin(ang) * raio);
      if (tx < borda + 8 || ty < borda + 8 || tx > w - borda - 9 || ty > h - borda - 9) continue;
      // Nota = distancia ao vizinho mais proximo (espalha os ninhos pelo vale).
      let nota = 1e9;
      for (const o of ninhos) nota = Math.min(nota, Math.hypot(tx - o.tx, ty - o.ty));
      if (ninhos.length === 0) nota = raio;
      if (nota > melhorNota) { melhorNota = nota; melhor = { tx, ty }; }
      if (melhorNota > minSep) break;
    }
    ninhos.push({
      tx: melhor.tx, ty: melhor.ty,
      x: (melhor.tx + 0.5) * tile, y: (melhor.ty + 0.5) * tile,
      bioma: bioma[idx(melhor.tx, melhor.ty)],
    });
  }

  const capsulas = [];
  for (let c = 0; c < MAPA.capsulas; c++) {
    for (let tent = 0; tent < 200; tent++) {
      const tx = rng.int(borda + 8, w - borda - 9);
      const ty = rng.int(borda + 8, h - borda - 9);
      const dNave = Math.hypot(tx - nave.tx, ty - nave.ty);
      if (dNave < 14) continue;
      let perto = false;
      for (const o of [...capsulas, ...ninhos]) {
        if (Math.hypot(tx - o.tx, ty - o.ty) < 16) { perto = true; break; }
      }
      if (perto) continue;
      capsulas.push({ tx, ty, x: (tx + 0.5) * tile, y: (ty + 0.5) * tile });
      break;
    }
  }

  // --- 4. clareiras e corredores ----------------------------------------
  const limpar = (tx, ty, raio, deixarFungo = false) => {
    const r2 = raio * raio;
    for (let y = Math.max(0, ty - raio); y <= Math.min(h - 1, ty + raio); y++) {
      for (let x = Math.max(0, tx - raio); x <= Math.min(w - 1, tx + raio); x++) {
        const d2 = (x - tx) * (x - tx) + (y - ty) * (y - ty);
        if (d2 > r2) continue;
        const i = idx(x, y);
        if (tiles[i] >= SOLIDO_MIN || tiles[i] === T.ACIDO) {
          tiles[i] = (deixarFungo && hash2(seed + 3, x, y) > 0.7) ? T.FUNGO : T.CHAO;
        }
      }
    }
  };

  /** Corredor serpenteante entre dois tiles — nunca em linha reta perfeita. */
  const cavarCaminho = (ax, ay, bx, by, largura = 2) => {
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    const passos = Math.ceil(len);
    const nx = -dy / len, ny = dx / len;
    for (let s = 0; s <= passos; s++) {
      const t = s / passos;
      const desvio = (fbm(seed + 401, (ax + t * len) / 12, (ay + t * len) / 12, 2) - 0.5) * 16;
      const x = Math.round(ax + dx * t + nx * desvio);
      const y = Math.round(ay + dy * t + ny * desvio);
      const lg = largura + (hash2(seed + 5, x, y) > 0.7 ? 1 : 0);
      limpar(x, y, lg);
    }
  };

  limpar(nave.tx, nave.ty, 9);
  for (const n of ninhos) limpar(n.tx, n.ty, 8, true);
  for (const c of capsulas) limpar(c.tx, c.ty, 3);

  for (const n of ninhos) cavarCaminho(nave.tx, nave.ty, n.tx, n.ty, 2);
  // Anel de trilhas entre os ninhos: da rotas alternativas pra fuga.
  for (let i = 0; i < ninhos.length; i++) {
    const a = ninhos[i], b = ninhos[(i + 1) % ninhos.length];
    cavarCaminho(a.tx, a.ty, b.tx, b.ty, 2);
  }
  for (const c of capsulas) {
    // Liga cada capsula ao ponto de interesse mais proximo.
    let alvo = nave, melhor = Math.hypot(c.tx - nave.tx, c.ty - nave.ty);
    for (const n of ninhos) {
      const d = Math.hypot(c.tx - n.tx, c.ty - n.ty);
      if (d < melhor) { melhor = d; alvo = n; }
    }
    cavarCaminho(c.tx, c.ty, alvo.tx, alvo.ty, 1);
  }

  // --- 5. verificacao de alcance ----------------------------------------
  // Flood fill a partir da nave. Se algum ponto ficou ilhado (o ruido pode
  // fechar um corredor logo depois de cavado), abre na marra em linha reta.
  const alcance = floodFill(tiles, nave.tx, nave.ty);
  for (const p of [...ninhos, ...capsulas]) {
    if (!alcance[idx(p.tx, p.ty)]) {
      cavarCaminho(nave.tx, nave.ty, p.tx, p.ty, 3);
    }
  }

  return {
    seed: seedTxt, seedNum: seed,
    w, h, tile,
    largura: w * tile, altura: h * tile,
    tiles, bioma,
    nave, ninhos, capsulas,
    alcancavel: floodFill(tiles, nave.tx, nave.ty),
  };
}

/** Marca todos os tiles nao solidos alcancaveis a partir de (sx, sy). */
function floodFill(tiles, sx, sy) {
  const { w, h } = MAPA;
  const visto = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  let cabeca = 0, cauda = 0;
  fila[cauda++] = sy * w + sx;
  visto[sy * w + sx] = 1;
  while (cabeca < cauda) {
    const i = fila[cabeca++];
    const x = i % w, y = (i / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (visto[j] || tiles[j] >= SOLIDO_MIN) continue;
      visto[j] = 1;
      fila[cauda++] = j;
    }
  }
  return visto;
}
