/** Helpers numericos usados em todo lugar. */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : clamp01((v - a) / (b - a)));
export const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

/**
 * Damping exponencial independente de framerate.
 * Substitui `a += (b-a)*0.1` que muda de comportamento com o fps.
 */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Damping exponencial em Vector3-like (mutavel, sem alocar). */
export function dampVec(out, target, rate, dt) {
  const t = 1 - Math.exp(-rate * dt);
  out.x += (target.x - out.x) * t;
  out.y += (target.y - out.y) * t;
  out.z += (target.z - out.z) * t;
  return out;
}

/** Curva de expo dos sticks: mantem precisao no centro, mantem o extremo em 1. */
export function applyExpo(v, expo) {
  if (!expo) return v;
  const a = Math.abs(v);
  return sign(v) * (a * a * a * expo + a * (1 - expo));
}

/** Deadzone re-escalada: sem degrau na saida da zona morta. */
export function applyDeadzone(v, dz) {
  const a = Math.abs(v);
  if (a <= dz) return 0;
  return sign(v) * ((a - dz) / (1 - dz));
}

/** Diferenca angular no menor caminho (radianos). */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Formata segundos como M:SS.mmm (cronometro da corrida). */
export function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return '--:--.---';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${m}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** Formata delta com sinal (+0.42 / -1.10). */
export function formatDelta(s) {
  if (!Number.isFinite(s)) return '';
  const sgn = s >= 0 ? '+' : '-';
  const a = Math.abs(s);
  return `${sgn}${a.toFixed(2)}`;
}
