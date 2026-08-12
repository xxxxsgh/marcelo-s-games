/**
 * RNG deterministico. Mesma seed => mesma cidade, sempre.
 * NUNCA use Math.random() em geracao procedural.
 */

/** Hash de string/numero para inteiro 32 bits. */
export function hash32(v) {
  let h = 2166136261 >>> 0;
  const s = String(v);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Gerador mulberry32 — rapido e de qualidade suficiente. */
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
    /** Escolhe por peso: pick([[a,3],[b,1]]) */
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

/** RNG estavel por coordenada de chunk — nao depende da ordem de carregamento. */
export function rngAt(seed, x, y = 0, z = 0) {
  return createRng(hash32(`${seed}|${x}|${y}|${z}`));
}

/** Ruido de valor 2D suave (para vento, sujeira, variacao de fachada). */
export function valueNoise2(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => (hash32(`${seed}|${a}|${b}`) >>> 0) / 4294967296;
  const n00 = h(xi, yi), n10 = h(xi + 1, yi);
  const n01 = h(xi, yi + 1), n11 = h(xi + 1, yi + 1);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}
