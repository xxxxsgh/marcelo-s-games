/**
 * Texturas procedurais em canvas. Zero asset externo — tudo gerado em runtime
 * e cacheado por chave, entao a mesma fachada nunca e gerada duas vezes.
 *
 * Cada superficie devolve pelo menos albedo + normal + roughness. Sem mapa de
 * normal e sem variacao de roughness, PBR nao aparece: fica tudo plastico.
 */
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(c, { repeat = 1, srgb = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Ruido fractal simples desenhado por pixel. */
function fbmCanvas(size, rng, { octaves = 4, base = 128, amp = 60, scale = 0.05 } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  // Grade de valores aleatorios por oitava, interpolada — tileavel por modulo.
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(2, Math.round(size * scale * Math.pow(2, o)));
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    grids.push({ n, g });
  }
  const sample = ({ n, g }, x, y) => {
    const fx = x * n, fy = y * n;
    const x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const cc = g[y1 * n + x0], d = g[y1 * n + x1];
    return (a * (1 - ux) + b * ux) * (1 - uy) + (cc * (1 - ux) + d * ux) * uy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, a = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        v += sample(grids[o], x / size, y / size) * a;
        norm += a; a *= 0.5;
      }
      v = v / norm;
      const px = base + (v - 0.5) * 2 * amp;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = px;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Deriva um normal map de um canvas de altura (Sobel). */
export function normalFromHeight(src, strength = 2.0) {
  const size = src.width;
  const sctx = src.getContext('2d');
  const h = sctx.getImageData(0, 0, size, size).data;
  const out = canvas(size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const at = (x, y) => h[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * ASFALTO — grao, remendo, poca. Roughness varia: e ela que faz a rua
 * molhada refletir em faixas em vez de virar espelho uniforme.
 * ------------------------------------------------------------------ */
export function asphaltTextures(size = 512) {
  return cached(`asphalt${size}`, () => {
    const rng = createRng('asphalt');
    const height = fbmCanvas(size, rng, { octaves: 5, base: 128, amp: 52, scale: 0.09 });

    const alb = canvas(size);
    const actx = alb.getContext('2d');
    actx.drawImage(height, 0, 0);
    const img = actx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i] / 255;
      const g = 26 + v * 34;
      img.data[i] = g; img.data[i + 1] = g + 1; img.data[i + 2] = g + 4;
    }
    actx.putImageData(img, 0, 0);
    // remendos de asfalto mais novo
    for (let i = 0; i < 5; i++) {
      actx.globalAlpha = 0.16 + rng.next() * 0.12;
      actx.fillStyle = rng.bool() ? '#181a1e' : '#33363c';
      const w = 60 + rng.next() * 160, h2 = 40 + rng.next() * 120;
      actx.fillRect(rng.next() * size, rng.next() * size, w, h2);
    }
    actx.globalAlpha = 1;

    // roughness: escuro = liso (poca/desgaste), claro = aspero
    const rough = canvas(size);
    const rctx = rough.getContext('2d');
    rctx.drawImage(fbmCanvas(size, createRng('asphalt-r'), {
      octaves: 3, base: 208, amp: 38, scale: 0.02,
    }), 0, 0);

    return {
      map: toTexture(alb, { srgb: true, repeat: 1 }),
      normalMap: toTexture(normalFromHeight(height, 1.6)),
      roughnessMap: toTexture(rough),
    };
  });
}

/* ------------------------------------------------------------------ *
 * CONCRETO — calcada, muro, laje.
 * ------------------------------------------------------------------ */
export function concreteTextures(size = 512, slabs = true) {
  return cached(`concrete${size}${slabs}`, () => {
    const rng = createRng('concrete');
    const height = fbmCanvas(size, rng, { octaves: 4, base: 140, amp: 34, scale: 0.06 });
    const hctx = height.getContext('2d');
    if (slabs) {
      // juntas das placas de calcada
      hctx.strokeStyle = '#4a4a4a';
      hctx.lineWidth = 3;
      const step = size / 4;
      for (let i = 0; i <= 4; i++) {
        hctx.beginPath(); hctx.moveTo(i * step, 0); hctx.lineTo(i * step, size); hctx.stroke();
        hctx.beginPath(); hctx.moveTo(0, i * step); hctx.lineTo(size, i * step); hctx.stroke();
      }
    }
    const alb = canvas(size);
    const actx = alb.getContext('2d');
    actx.drawImage(height, 0, 0);
    const img = actx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = img.data[i] / 255;
      img.data[i] = 108 + v * 74; img.data[i + 1] = 106 + v * 72; img.data[i + 2] = 100 + v * 68;
    }
    actx.putImageData(img, 0, 0);
    // manchas de chuva escorrida
    for (let i = 0; i < 14; i++) {
      actx.globalAlpha = 0.05 + rng.next() * 0.07;
      actx.fillStyle = '#3c3a34';
      actx.fillRect(rng.next() * size, rng.next() * size, 3 + rng.next() * 10, 40 + rng.next() * 140);
    }
    actx.globalAlpha = 1;
    return {
      map: toTexture(alb, { srgb: true }),
      normalMap: toTexture(normalFromHeight(height, 1.3)),
      roughnessMap: toTexture(fbmCanvas(size, createRng('concrete-r'), {
        octaves: 3, base: 196, amp: 42, scale: 0.03,
      })),
    };
  });
}

/* ------------------------------------------------------------------ *
 * FACHADA — a textura que mais importa. Janela por andar, com variacao
 * de andar pra andar. O emissive vira janela acesa a noite.
 * ------------------------------------------------------------------ */
export function facadeTextures(variant = 0, floors = 8, size = 512) {
  return cached(`facade${variant}-${floors}-${size}`, () => {
    const rng = createRng(`facade-${variant}`);
    const cols = 4 + (variant % 3);
    const rows = floors;

    const alb = canvas(size);
    const ctx = alb.getContext('2d');
    const height = canvas(size);
    const hctx = height.getContext('2d');
    const emi = canvas(size);
    const ectx = emi.getContext('2d');

    // parede base
    const wallTones = ['#8d8577', '#9aa0a4', '#7d7468', '#a8a094', '#6f7a82'];
    const wall = wallTones[variant % wallTones.length];
    ctx.fillStyle = wall; ctx.fillRect(0, 0, size, size);
    ctx.drawImage(fbmCanvas(size, rng, { octaves: 4, base: 128, amp: 26, scale: 0.07 }), 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wall; ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000'; ectx.fillRect(0, 0, size, size);

    const cw = size / cols, ch = size / rows;
    const winW = cw * 0.56, winH = ch * 0.52;

    for (let r = 0; r < rows; r++) {
      // cada andar tem seu "clima": cortina, persiana, vidro limpo
      const floorLit = rng.next();
      for (let c = 0; c < cols; c++) {
        const x = c * cw + (cw - winW) / 2;
        const y = r * ch + (ch - winH) / 2;

        // caixilho rebaixado -> altura escura
        hctx.fillStyle = '#3a3a3a';
        hctx.fillRect(x - 2, y - 2, winW + 4, winH + 4);
        hctx.fillStyle = '#9a9a9a';
        hctx.fillRect(x - 4, y - 4, winW + 8, 4);          // peitoril saliente

        // vidro: azul escuro com reflexo do ceu falso
        const g = ctx.createLinearGradient(x, y, x, y + winH);
        g.addColorStop(0, '#2b3d52');
        g.addColorStop(0.55, '#1b2836');
        g.addColorStop(1, '#243447');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, winW, winH);
        // caixilho
        ctx.strokeStyle = '#43474b'; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, winW, winH);
        ctx.beginPath();
        ctx.moveTo(x + winW / 2, y); ctx.lineTo(x + winW / 2, y + winH); ctx.stroke();

        // janela acesa (emissive) — nem todas, e mais no andar "vivo"
        if (rng.next() < 0.22 + floorLit * 0.3) {
          const warm = rng.bool(0.75);
          ectx.fillStyle = warm ? '#ffcf8a' : '#bfe0ff';
          ectx.globalAlpha = 0.5 + rng.next() * 0.5;
          ectx.fillRect(x, y, winW, winH);
          ectx.globalAlpha = 1;
        }
      }
    }

    // sujeira/escorrido por cima — predio limpo demais parece maquete
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#2e2a22';
    for (let i = 0; i < 26; i++) {
      const x = rng.next() * size;
      ctx.fillRect(x, rng.next() * size * 0.6, 2 + rng.next() * 7, 60 + rng.next() * 180);
    }
    ctx.globalAlpha = 1;

    const repeat = 1;
    return {
      map: toTexture(alb, { srgb: true, repeat }),
      normalMap: toTexture(normalFromHeight(height, 2.4), { repeat }),
      emissiveMap: toTexture(emi, { srgb: true, repeat }),
      roughnessMap: toTexture(fbmCanvas(size, createRng(`facade-r${variant}`), {
        octaves: 3, base: 168, amp: 54, scale: 0.04,
      }), { repeat }),
    };
  });
}

/** Faixa de pedestre / sinalizacao de solo, com desgaste. */
export function roadMarkTexture(size = 256) {
  return cached(`roadmark${size}`, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const rng = createRng('mark');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(size * 0.42, 0, size * 0.16, size);
    // desgaste: apaga pedacos
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 120; i++) {
      ctx.globalAlpha = rng.next() * 0.5;
      ctx.fillRect(rng.next() * size, rng.next() * size, rng.next() * 14, rng.next() * 14);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const t = toTexture(c, { srgb: true });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

export function clearTextureCache() {
  for (const v of cache.values()) {
    if (v?.map?.dispose) Object.values(v).forEach((t) => t?.dispose?.());
    else v?.dispose?.();
  }
  cache.clear();
}
