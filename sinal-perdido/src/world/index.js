/**
 * Mundo em runtime: consultas de tile, colisao, linha de visada e desenho do
 * terreno.
 *
 * O terreno e pintado UMA vez por bloco de 8x8 tiles num canvas offscreen e
 * reaproveitado enquanto o bloco estiver por perto. Repintar 600 tiles com
 * manchas e pedras a 144 fps seria o gargalo do jogo; assim o custo por frame
 * vira um punhado de `drawImage`.
 */
import { T, SOLIDO_MIN, PALETA, MAPA } from '../config.js';
import { hash2, fbmWarp } from '../core/rng.js';
import { clamp, clamp01 } from '../core/mathx.js';

const CH = 8;                  // tiles por bloco de cache
const MAX_CACHE = 90;          // blocos mantidos (LRU)

/** '#rrggbb' -> [r,g,b]. So roda na criacao do mundo. */
function paraRgb(hex) {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function createWorld(mapa) {
  const { w, h, tile, tiles, bioma, seedNum } = mapa;
  const cache = new Map();

  // ---------------------------------------------------------------- consultas
  const dentro = (tx, ty) => tx >= 0 && ty >= 0 && tx < w && ty < h;
  const tileEm = (tx, ty) => (dentro(tx, ty) ? tiles[ty * w + tx] : T.ROCHA);
  const tileMundo = (x, y) => tileEm(Math.floor(x / tile), Math.floor(y / tile));
  const solido = (tx, ty) => tileEm(tx, ty) >= SOLIDO_MIN;
  const solidoMundo = (x, y) => solido(Math.floor(x / tile), Math.floor(y / tile));
  const biomaEm = (x, y) => {
    const tx = clamp(Math.floor(x / tile), 0, w - 1), ty = clamp(Math.floor(y / tile), 0, h - 1);
    return bioma[ty * w + tx];
  };

  /** Acido queima e freia; fungo so freia um tico. */
  function terrenoEm(x, y) {
    const t = tileMundo(x, y);
    if (t === T.ACIDO) return { dano: 9, freio: 0.62 };
    if (t === T.FUNGO) return { dano: 0, freio: 0.93 };
    return { dano: 0, freio: 1 };
  }

  /**
   * Empurra um circulo pra fora dos tiles solidos.
   * Resolve eixo a eixo pelo menor afastamento — e o suficiente pra grade e
   * nao gruda em quina, que e o defeito classico do "recuar tudo".
   */
  function resolverCirculo(e) {
    const r = e.raio;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return false;
    let bateu = false;
    // Os limites SEMPRE ficam dentro da grade. Fora da grade o `for` de tile
    // poderia nem avancar (float grande demais) e travar o jogo inteiro.
    const tx0 = clamp(Math.floor((e.x - r) / tile), 0, w - 1);
    const tx1 = clamp(Math.floor((e.x + r) / tile), 0, w - 1);
    const ty0 = clamp(Math.floor((e.y - r) / tile), 0, h - 1);
    const ty1 = clamp(Math.floor((e.y + r) / tile), 0, h - 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!solido(tx, ty)) continue;
        const bx = tx * tile, by = ty * tile;
        const px = clamp(e.x, bx, bx + tile);
        const py = clamp(e.y, by, by + tile);
        const dx = e.x - px, dy = e.y - py;
        const d = Math.hypot(dx, dy);
        let nx, ny, pen;
        if (d > 1e-6) {
          if (d > r) continue;
          nx = dx / d; ny = dy / d;
          pen = r - d;
        } else {
          // Centro DENTRO do tile: sai inteiro pelo lado mais curto.
          // A normal aqui e escrita a mao — dividir por uma distancia quase
          // zero geraria uma normal gigante, e foi exatamente isso que uma vez
          // multiplicou a velocidade por um milhao e travou a simulacao.
          const esq = e.x - bx, dir = bx + tile - e.x;
          const cima = e.y - by, baixo = by + tile - e.y;
          const m = Math.min(esq, dir, cima, baixo);
          if (m === esq) { nx = -1; ny = 0; pen = esq + r; }
          else if (m === dir) { nx = 1; ny = 0; pen = dir + r; }
          else if (m === cima) { nx = 0; ny = -1; pen = cima + r; }
          else { nx = 0; ny = 1; pen = baixo + r; }
        }
        e.x += nx * pen;
        e.y += ny * pen;
        // Mata a componente da velocidade que aponta pra parede (desliza).
        if (e.vx !== undefined) {
          const vn = e.vx * nx + e.vy * ny;
          if (vn < 0) { e.vx -= vn * nx; e.vy -= vn * ny; }
        }
        bateu = true;
      }
    }
    return bateu;
  }

  /** Linha de visada por DDA. true = nada solido no caminho. */
  function linhaLivre(x0, y0, x1, y1) {
    let tx = Math.floor(x0 / tile), ty = Math.floor(y0 / tile);
    const txf = Math.floor(x1 / tile), tyf = Math.floor(y1 / tile);
    const dx = x1 - x0, dy = y1 - y0;
    const passoX = Math.sign(dx), passoY = Math.sign(dy);
    const invX = dx === 0 ? Infinity : tile / Math.abs(dx);
    const invY = dy === 0 ? Infinity : tile / Math.abs(dy);
    let tMaxX = dx === 0 ? Infinity
      : ((passoX > 0 ? (tx + 1) * tile - x0 : x0 - tx * tile) / Math.abs(dx));
    let tMaxY = dy === 0 ? Infinity
      : ((passoY > 0 ? (ty + 1) * tile - y0 : y0 - ty * tile) / Math.abs(dy));
    for (let i = 0; i < 512; i++) {
      if (solido(tx, ty)) return false;
      if (tx === txf && ty === tyf) return true;
      if (tMaxX < tMaxY) { tMaxX += invX; tx += passoX; }
      else { tMaxY += invY; ty += passoY; }
    }
    return true;
  }

  /** Ponto livre num anel ao redor de (x, y). null se nao achou. */
  function pontoLivre(rng, x, y, rMin, rMax, tentativas = 40) {
    for (let i = 0; i < tentativas; i++) {
      const a = rng.ang();
      const r = rng.float(rMin, rMax);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (px < tile * 2 || py < tile * 2 || px > mapa.largura - tile * 2 || py > mapa.altura - tile * 2) continue;
      const tx = Math.floor(px / tile), ty = Math.floor(py / tile);
      if (solido(tx, ty)) continue;
      if (!mapa.alcancavel[ty * w + tx]) continue;
      return { x: px, y: py };
    }
    return null;
  }

  // ------------------------------------------------------------------ desenho
  function chaveChunk(cx, cy) { return cy * 1000 + cx; }

  // Paleta em RGB pra poder modular brilho por ruido sem custar parse por tile.
  const PAL_RGB = PALETA.chao.map((tri) => tri.map(paraRgb));
  const ROCHA_RGB = paraRgb(PALETA.rocha);
  const TOPO_RGB = paraRgb(PALETA.rochaTopo);

  /**
   * Cor do chao com a fronteira de bioma borrada.
   *
   * Sem isso o mapa vira colcha de retalhos: dois biomas vizinhos trocam de
   * cor no meio de um tile. A media 3x3 (com o centro pesando o dobro) custa
   * nove leituras de array uma unica vez, na criacao do bloco.
   */
  const _pal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  function paletaSuave(tx, ty) {
    for (let k = 0; k < 3; k++) { _pal[k][0] = 0; _pal[k][1] = 0; _pal[k][2] = 0; }
    let peso = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = clamp(tx + dx, 0, w - 1), y = clamp(ty + dy, 0, h - 1);
        const p = PAL_RGB[bioma[y * w + x]];
        const pk = (dx === 0 && dy === 0) ? 2 : 1;
        for (let k = 0; k < 3; k++) {
          _pal[k][0] += p[k][0] * pk; _pal[k][1] += p[k][1] * pk; _pal[k][2] += p[k][2] * pk;
        }
        peso += pk;
      }
    }
    for (let k = 0; k < 3; k++) {
      _pal[k][0] /= peso; _pal[k][1] /= peso; _pal[k][2] /= peso;
    }
    return _pal;
  }

  function pintarChunk(cx, cy) {
    const px = CH * tile;
    const cv = document.createElement('canvas');
    cv.width = px; cv.height = px;
    const c = cv.getContext('2d');
    const bx = cx * CH, by = cy * CH;

    // 1o passe: chao. Cor do bioma modulada por um ruido de escala grande, pra
    // o terreno ter manchas de luz e sombra em vez de xadrez de tile.
    for (let ty = by; ty < by + CH; ty++) {
      for (let tx = bx; tx < bx + CH; tx++) {
        const ox = (tx - bx) * tile, oy = (ty - by) * tile;
        const pal = paletaSuave(tx, ty);
        const grande = fbmWarp(seedNum + 55, tx / 7, ty / 7, 3, 1.5);
        const fino = hash2(seedNum + 1, tx, ty);
        // Mistura continua entre os dois tons do bioma: com limiar duro, cada
        // tile virava um quadrado visivel de outra cor.
        const k = clamp01((grande - 0.34) / 0.36);
        const kk = k * k * (3 - 2 * k);
        const m = 0.97 + fino * 0.06;
        const r = (pal[0][0] + (pal[1][0] - pal[0][0]) * kk) * m;
        const g = (pal[0][1] + (pal[1][1] - pal[0][1]) * kk) * m;
        const b2 = (pal[0][2] + (pal[1][2] - pal[0][2]) * kk) * m;
        c.fillStyle = `rgb(${r | 0},${g | 0},${b2 | 0})`;
        c.fillRect(ox, oy, tile, tile);

        // cascalho: pontinhos do tom de detalhe, fracos
        if (fino > 0.5) {
          const det = pal[2];
          c.fillStyle = `rgba(${det[0]},${det[1]},${det[2]},0.35)`;
          const n1 = hash2(seedNum + 3, tx, ty), n2 = hash2(seedNum + 4, tx, ty);
          c.fillRect(ox + n1 * (tile - 8), oy + n2 * (tile - 8), 2 + fino * 3, 2);
          c.fillRect(ox + n2 * (tile - 5), oy + fino * (tile - 5), 2, 2);
        }
      }
    }

    // 2o passe: manchas suaves maiores que o tile. Sao elas que apagam de vez
    // a grade — o olho passa a ver relevo, nao celulas.
    for (let i = 0; i < 12; i++) {
      const hx = hash2(seedNum + 300 + i, cx, cy);
      const hy = hash2(seedNum + 400 + i, cx, cy);
      const hr = hash2(seedNum + 500 + i, cx, cy);
      const mx = hx * px, my = hy * px, mr = 26 + hr * 96;
      const escuro = hash2(seedNum + 600 + i, cx, cy) > 0.5;
      const g = c.createRadialGradient(mx, my, 0, mx, my, mr);
      const a = 0.05 + hr * 0.07;
      g.addColorStop(0, escuro ? `rgba(12,8,20,${a})` : `rgba(224,214,255,${a * 0.8})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }

    // 3o passe: liquidos, fungo e solidos, ja com as bordas contra o vizinho.
    for (let ty = by; ty < by + CH; ty++) {
      for (let tx = bx; tx < bx + CH; tx++) {
        const ox = (tx - bx) * tile, oy = (ty - by) * tile;
        const t = tileEm(tx, ty);
        const n = hash2(seedNum + 7, tx, ty);
        if (t === T.ACIDO) pintarAcido(c, ox, oy, tx, ty, n);
        else if (t === T.FUNGO) pintarFungo(c, ox, oy, tx, ty, n);
        else if (t >= SOLIDO_MIN) desenharSolido(c, ox, oy, tx, ty, t, n);
      }
    }
    return cv;
  }

  function pintarAcido(c, ox, oy, tx, ty, n) {
    c.fillStyle = `rgb(${30 + n * 10 | 0},${74 + n * 18 | 0},${52 + n * 12 | 0})`;
    c.fillRect(ox, oy, tile, tile);
    // Borda clara so onde a poca encosta em terra firme: da volume ao liquido.
    c.fillStyle = 'rgba(120,255,170,0.12)';
    const e = 4;
    if (tileEm(tx, ty - 1) !== T.ACIDO) c.fillRect(ox, oy, tile, e);
    if (tileEm(tx, ty + 1) !== T.ACIDO) c.fillRect(ox, oy + tile - e, tile, e);
    if (tileEm(tx - 1, ty) !== T.ACIDO) c.fillRect(ox, oy, e, tile);
    if (tileEm(tx + 1, ty) !== T.ACIDO) c.fillRect(ox + tile - e, oy, e, tile);
    if (n > 0.62) {
      c.fillStyle = 'rgba(150,255,190,0.16)';
      c.beginPath();
      c.arc(ox + tile * (0.3 + n * 0.4), oy + tile * (0.7 - n * 0.4), 3 + n * 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  function pintarFungo(c, ox, oy, tx, ty, n) {
    c.fillStyle = 'rgba(110,55,170,0.16)';
    c.fillRect(ox, oy, tile, tile);
    const hx = hash2(seedNum + 11, tx, ty), hy = hash2(seedNum + 12, tx, ty);
    c.fillStyle = 'rgba(198,132,255,0.55)';
    c.beginPath();
    c.arc(ox + hx * tile, oy + hy * tile, 1.6 + n * 2.4, 0, Math.PI * 2);
    c.fill();
    if (n > 0.7) {
      c.fillStyle = 'rgba(150,86,225,0.35)';
      c.beginPath();
      c.arc(ox + hy * tile, oy + hx * tile, 1.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  /**
   * Solido = bloco cheio + faixa clara em cada lado que encosta no chao.
   * O contorno claro e o que faz a pedra ler como COBERTURA numa olhada — sem
   * ele o jogador so descobre a parede quando esbarra nela.
   */
  function desenharSolido(c, ox, oy, tx, ty, t, n) {
    const ruina = t === T.RUINA;
    const corpo = ruina ? [36, 29, 37] : ROCHA_RGB;
    const topo = ruina ? [74, 65, 82] : TOPO_RGB;
    const som = 0.88 + n * 0.24;
    c.fillStyle = `rgb(${(corpo[0] * som) | 0},${(corpo[1] * som) | 0},${(corpo[2] * som) | 0})`;
    c.fillRect(ox, oy, tile, tile);

    const livre = {
      cima: !solido(tx, ty - 1), baixo: !solido(tx, ty + 1),
      esq: !solido(tx - 1, ty), dir: !solido(tx + 1, ty),
    };
    const rgbTopo = (a) => `rgba(${topo[0]},${topo[1]},${topo[2]},${a})`;
    // O "topo" da pedra e mais grosso em cima (a luz do planeta vem de cima).
    if (livre.cima) { c.fillStyle = rgbTopo(0.95); c.fillRect(ox, oy, tile, 7 + n * 3); }
    if (livre.baixo) { c.fillStyle = rgbTopo(0.35); c.fillRect(ox, oy + tile - 4, tile, 4); }
    if (livre.esq) { c.fillStyle = rgbTopo(0.55); c.fillRect(ox, oy, 4, tile); }
    if (livre.dir) { c.fillStyle = rgbTopo(0.55); c.fillRect(ox + tile - 4, oy, 4, tile); }

    // sombra projetada no proprio bloco, embaixo da aresta de cima
    if (livre.cima) {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(ox, oy + 7 + n * 3, tile, 5);
    }

    if (t === T.CRISTAL) {
      const cxp = ox + tile / 2, cyp = oy + tile / 2;
      const r = tile * (0.3 + n * 0.14);
      c.fillStyle = 'rgba(124,246,255,0.9)';
      c.beginPath();
      c.moveTo(cxp, cyp - r * 1.5);
      c.lineTo(cxp + r, cyp);
      c.lineTo(cxp + r * 0.4, cyp + r * 1.2);
      c.lineTo(cxp - r * 0.7, cyp + r * 0.8);
      c.lineTo(cxp - r * 0.9, cyp - r * 0.2);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath();
      c.moveTo(cxp, cyp - r * 1.5);
      c.lineTo(cxp + r * 0.25, cyp - r * 0.1);
      c.lineTo(cxp - r * 0.25, cyp + r * 0.2);
      c.closePath();
      c.fill();
    } else if (n > 0.78) {
      c.strokeStyle = 'rgba(140,120,175,0.30)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(ox + 7, oy + tile * 0.72);
      c.lineTo(ox + tile * 0.62, oy + tile * 0.4);
      c.stroke();
    }
  }

  function pegarChunk(cx, cy) {
    const k = chaveChunk(cx, cy);
    let cv = cache.get(k);
    if (cv) {
      // LRU: reinserir joga pro fim da ordem do Map.
      cache.delete(k); cache.set(k, cv);
      return cv;
    }
    cv = pintarChunk(cx, cy);
    cache.set(k, cv);
    if (cache.size > MAX_CACHE) {
      const primeiro = cache.keys().next().value;
      cache.delete(primeiro);
    }
    return cv;
  }

  /** Desenha o terreno visivel. `cam` ja aplicou a transformacao no ctx. */
  function desenhar(ctx, cam) {
    const px = CH * tile;
    const x0 = Math.floor(cam.esq / px), x1 = Math.floor(cam.dir / px);
    const y0 = Math.floor(cam.topo / px), y1 = Math.floor(cam.base / px);
    const cxMax = Math.ceil(w / CH) - 1, cyMax = Math.ceil(h / CH) - 1;
    for (let cy = Math.max(0, y0); cy <= Math.min(cyMax, y1); cy++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(cxMax, x1); cx++) {
        ctx.drawImage(pegarChunk(cx, cy), cx * px, cy * px);
      }
    }
  }

  /**
   * Luzes que vem do proprio terreno (cristal e fungo).
   * Amostra 1 tile a cada 2 pra segurar a contagem — o brilho e ambiente, nao
   * precisa de precisao por tile.
   */
  function luzesTerreno(cam, out) {
    const tx0 = Math.max(0, Math.floor(cam.esq / tile));
    const tx1 = Math.min(w - 1, Math.ceil(cam.dir / tile));
    const ty0 = Math.max(0, Math.floor(cam.topo / tile));
    const ty1 = Math.min(h - 1, Math.ceil(cam.base / tile));
    for (let ty = ty0; ty <= ty1; ty += 2) {
      for (let tx = tx0; tx <= tx1; tx += 2) {
        const t = tiles[ty * w + tx];
        if (t === T.CRISTAL) {
          out.push({ x: (tx + 0.5) * tile, y: (ty + 0.5) * tile, r: 130, cor: PALETA.cristal, i: 0.55 });
        } else if (t === T.FUNGO && hash2(seedNum + 8, tx, ty) > 0.55) {
          out.push({ x: (tx + 0.5) * tile, y: (ty + 0.5) * tile, r: 95, cor: PALETA.fungo, i: 0.4 });
        } else if (t === T.ACIDO && hash2(seedNum + 9, tx, ty) > 0.6) {
          out.push({ x: (tx + 0.5) * tile, y: (ty + 0.5) * tile, r: 110, cor: PALETA.acido, i: 0.35 });
        }
      }
    }
  }

  return {
    mapa, tile, w, h,
    largura: mapa.largura, altura: mapa.altura,
    tileEm, tileMundo, solido, solidoMundo, biomaEm, terrenoEm,
    resolverCirculo, linhaLivre, pontoLivre,
    desenhar, luzesTerreno,
    limparCache() { cache.clear(); },
  };
}
