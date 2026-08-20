/** Utilitarios de matematica usados por todo mundo. */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** Interpolacao independente de framerate ("exponencial"). */
export const damp = (a, b, taxa, dt) => lerp(a, b, 1 - Math.exp(-taxa * dt));

export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** Menor diferenca angular entre a e b, em -PI..PI. */
export function angDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angLerp(a, b, t) { return a + angDelta(a, b) * t; }
export function angDamp(a, b, taxa, dt) { return a + angDelta(a, b) * (1 - Math.exp(-taxa * dt)); }

/** Roda um vetor. */
export function rot(x, y, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

/** Remove o item `i` do array trocando com o ultimo (O(1), nao preserva ordem). */
export function swapRemove(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

/** Menor distancia entre o ponto p e o segmento ab. */
export function distPontoSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Formata segundos como M:SS. */
export function tempoStr(s) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
