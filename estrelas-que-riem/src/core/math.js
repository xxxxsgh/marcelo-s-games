import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// amortecimento independente de framerate
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const dampV = (v, target, k, dt) => v.lerp(target, 1 - Math.exp(-k * dt));

const _up = new THREE.Vector3(0, 1, 0);
// quaternion que leva +Y pra dir e gira `yaw` em volta dele
export function surfaceQuat(dir, yaw = 0, out = new THREE.Quaternion()) {
  out.setFromUnitVectors(_up, dir);
  if (yaw) out.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, yaw));
  return out;
}

// direcao unitaria a partir de latitude/longitude (graus)
export function dirLL(lat, lon, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

// projeta v no plano tangente de normal n (in place)
export function tangent(v, n) { return v.addScaledVector(n, -v.dot(n)); }

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
