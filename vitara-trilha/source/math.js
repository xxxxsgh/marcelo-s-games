// math.js — utilitários numéricos sem alocação (tudo escreve em arrays pré-alocados)
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- ruído de gradiente 2D (Perlin) com tabela fixa ----
const _perm = new Uint8Array(512);
(function () {
  const r = mulberry32(1337);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
})();
function _g2(h, x, y) {
  switch (h & 7) {
    case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y;
    case 4: return x; case 5: return -x; case 6: return y; default: return -y;
  }
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = _perm[X] + Y, b = _perm[X + 1] + Y;
  const n00 = _g2(_perm[a], xf, yf), n10 = _g2(_perm[b], xf - 1, yf);
  const n01 = _g2(_perm[a + 1], xf, yf - 1), n11 = _g2(_perm[b + 1], xf - 1, yf - 1);
  return (n00 + (n10 - n00) * u) + ((n01 + (n11 - n01) * u) - (n00 + (n10 - n00) * u)) * v;
}
function fbm2(x, y, oct) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
function ridge2(x, y, oct) {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * f, y * f)); s += a * n * n; f *= 2.07; a *= 0.5; }
  return s;
}

// ---- mat4 (coluna-maior, Float32Array, offset) ----
function m4ident(o, k) { for (let i = 0; i < 16; i++) o[k + i] = 0; o[k] = o[k + 5] = o[k + 10] = o[k + 15] = 1; }
function m4mul(o, ok, a, ak, b, bk) { // o = a*b (o pode não ser a nem b)
  for (let c = 0; c < 4; c++) {
    const b0 = b[bk + c * 4], b1 = b[bk + c * 4 + 1], b2 = b[bk + c * 4 + 2], b3 = b[bk + c * 4 + 3];
    o[ok + c * 4] = a[ak] * b0 + a[ak + 4] * b1 + a[ak + 8] * b2 + a[ak + 12] * b3;
    o[ok + c * 4 + 1] = a[ak + 1] * b0 + a[ak + 5] * b1 + a[ak + 9] * b2 + a[ak + 13] * b3;
    o[ok + c * 4 + 2] = a[ak + 2] * b0 + a[ak + 6] * b1 + a[ak + 10] * b2 + a[ak + 14] * b3;
    o[ok + c * 4 + 3] = a[ak + 3] * b0 + a[ak + 7] * b1 + a[ak + 11] * b2 + a[ak + 15] * b3;
  }
}
// perspectiva Z invertido, far infinito, profundidade 0..1 (near -> 1)
function m4persp(o, k, fovy, aspect, near) {
  const f = 1 / Math.tan(fovy / 2);
  for (let i = 0; i < 16; i++) o[k + i] = 0;
  o[k] = f / aspect; o[k + 5] = f; o[k + 11] = -1; o[k + 14] = near;
}
// ortográfica (profundidade 0..1, normal: near=0)
function m4ortho(o, k, l, r, b, t, n, f) {
  for (let i = 0; i < 16; i++) o[k + i] = 0;
  o[k] = 2 / (r - l); o[k + 5] = 2 / (t - b); o[k + 10] = -1 / (f - n);
  o[k + 12] = -(r + l) / (r - l); o[k + 13] = -(t + b) / (t - b); o[k + 14] = -n / (f - n); o[k + 15] = 1;
}
function m4look(o, k, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
  let fx = tx - ex, fy = ty - ey, fz = tz - ez;
  let l = 1 / Math.hypot(fx, fy, fz); fx *= l; fy *= l; fz *= l;
  let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
  l = 1 / Math.hypot(sx, sy, sz); sx *= l; sy *= l; sz *= l;
  const vx = sy * fz - sz * fy, vy = sz * fx - sx * fz, vz = sx * fy - sy * fx;
  o[k] = sx; o[k + 1] = vx; o[k + 2] = -fx; o[k + 3] = 0;
  o[k + 4] = sy; o[k + 5] = vy; o[k + 6] = -fy; o[k + 7] = 0;
  o[k + 8] = sz; o[k + 9] = vz; o[k + 10] = -fz; o[k + 11] = 0;
  o[k + 12] = -(sx * ex + sy * ey + sz * ez); o[k + 13] = -(vx * ex + vy * ey + vz * ez); o[k + 14] = fx * ex + fy * ey + fz * ez; o[k + 15] = 1;
}
const _mi = new Float64Array(16);
function m4inv(o, ok, m, mk) {
  const a00 = m[mk], a01 = m[mk + 1], a02 = m[mk + 2], a03 = m[mk + 3], a10 = m[mk + 4], a11 = m[mk + 5], a12 = m[mk + 6], a13 = m[mk + 7],
    a20 = m[mk + 8], a21 = m[mk + 9], a22 = m[mk + 10], a23 = m[mk + 11], a30 = m[mk + 12], a31 = m[mk + 13], a32 = m[mk + 14], a33 = m[mk + 15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  _mi[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; _mi[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
  _mi[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; _mi[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  _mi[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; _mi[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
  _mi[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; _mi[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  _mi[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; _mi[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
  _mi[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; _mi[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  _mi[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; _mi[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
  _mi[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; _mi[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  for (let i = 0; i < 16; i++) o[ok + i] = _mi[i];
}
// matriz de modelo a partir de posição + quaternion (x,y,z,w)
function m4fromQT(o, k, qx, qy, qz, qw, px, py, pz) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  o[k] = 1 - (yy + zz); o[k + 1] = xy + wz; o[k + 2] = xz - wy; o[k + 3] = 0;
  o[k + 4] = xy - wz; o[k + 5] = 1 - (xx + zz); o[k + 6] = yz + wx; o[k + 7] = 0;
  o[k + 8] = xz + wy; o[k + 9] = yz - wx; o[k + 10] = 1 - (xx + yy); o[k + 11] = 0;
  o[k + 12] = px; o[k + 13] = py; o[k + 14] = pz; o[k + 15] = 1;
}
function m4trs(o, k, px, py, pz, rx, ry, rz) { // T * Ry * Rx * Rz (uso geral em montagem, fora do quadro)
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  o[k] = cy * cz + sy * sx * sz; o[k + 1] = cx * sz; o[k + 2] = -sy * cz + cy * sx * sz; o[k + 3] = 0;
  o[k + 4] = -cy * sz + sy * sx * cz; o[k + 5] = cx * cz; o[k + 6] = sy * sz + cy * sx * cz; o[k + 7] = 0;
  o[k + 8] = sy * cx; o[k + 9] = -sx; o[k + 10] = cy * cx; o[k + 11] = 0;
  o[k + 12] = px; o[k + 13] = py; o[k + 14] = pz; o[k + 15] = 1;
}
