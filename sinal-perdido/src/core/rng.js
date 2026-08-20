/**
 * RNG deterministico. Mesma seed => mesmo planeta, sempre.
 * NUNCA use Math.random() na geracao do mundo — so em efeito visual puro.
 */

export function hash32(v) {
  let h = 2166136261 >>> 0;
  const s = String(v);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — rapido e bom o bastante. */
export function createRng(seed) {
  let a = (typeof seed === 'number' ? seed : hash32(seed)) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (min = 0, max = 1) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    ang: () => next() * Math.PI * 2,
    weighted: (pairs) => {
      let total = 0;
      for (const p of pairs) total += p[1];
      let r = next() * total;
      for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle: (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a2[i], a2[j]] = [a2[j], a2[i]];
      }
      return a2;
    },
  };
}

/** Valor pseudo-aleatorio estavel por coordenada — usado no detalhe do terreno. */
export function hash2(seed, x, y) {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor 2D suave. */
export function valueNoise2(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = hash2(seed, xi, yi), n10 = hash2(seed, xi + 1, yi);
  const n01 = hash2(seed, xi, yi + 1), n11 = hash2(seed, xi + 1, yi + 1);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

/**
 * fbm com DISTORCAO DE DOMINIO.
 *
 * Value noise puro tem features alinhadas aos eixos — em terreno isso vira
 * retangulo visivel na tela. Deslocar a coordenada de amostragem por outro
 * ruido custa duas amostras a mais e quebra o alinhamento de vez.
 */
export function fbmWarp(seed, x, y, oitavas = 4, forca = 1.6) {
  const wx = x + (valueNoise2(seed + 991, x * 0.55, y * 0.55) - 0.5) * forca * 2;
  const wy = y + (valueNoise2(seed + 997, x * 0.55 + 31, y * 0.55 + 17) - 0.5) * forca * 2;
  return fbm(seed, wx, wy, oitavas);
}

/** fbm: varias oitavas de valueNoise2, resultado em 0..1. */
export function fbm(seed, x, y, oitavas = 4, lac = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oitavas; i++) {
    sum += amp * valueNoise2(seed + i * 7919, x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lac;
  }
  return sum / norm;
}
