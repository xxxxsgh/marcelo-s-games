// ---------- matematica sem alocacao: tudo escreve em arrays ja existentes ----------
const PI = Math.PI, TAU = PI * 2;
const hyp = (a, b, c = 0, d = 0) => Math.sqrt(a * a + b * b + c * c + d * d);
// Registradores pre-alocados. Convencao do codigo quente (luta): nenhuma funcao recebe ou devolve double;
// os valores vao por estes arrays, porque o V8 encaixota doubles (HeapNumber) em chamadas nao embutidas.
// _c simulacao (0-14 saidas, 32-63 entradas), _f efeitos, _d instancia, _t translacao+angulo, _q pose, _k camera/vibracao, _u aleatorio
const _c = new Float64Array(64), _f = new Float32Array(16), _d = new Float32Array(12), _t = new Float64Array(4), _q = new Float64Array(8), _k = new Float32Array(12), _u = new Float64Array(1);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const sign = x => x < 0 ? -1 : 1;
const wrapPi = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };

class Rng {
  constructor(seed) { this.s = new Uint32Array(1); this.s[0] = seed >>> 0; }
  seed(v) { this.s[0] = v >>> 0; }
  u() { // mulberry32
    const s = this.s; s[0] += 0x6D2B79F5; let t = s[0];
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uR() { const s = this.s; s[0] += 0x6D2B79F5; let t = s[0]; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); _u[0] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  r(a, b) { return a + (b - a) * this.u(); }
  s1() { return this.u() * 2 - 1; }
}

const M4 = {
  ident(o, i) { o.fill(0, i, i + 16); o[i] = o[i + 5] = o[i + 10] = o[i + 15] = 1; },
  copy(o, i, a, j) { for (let k = 0; k < 16; k++) o[i + k] = a[j + k]; },
  // o = a*b (coluna-maior). o nao pode ser a nem b
  mul(o, i, a, j, b, k) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[k + c * 4], b1 = b[k + c * 4 + 1], b2 = b[k + c * 4 + 2], b3 = b[k + c * 4 + 3];
      o[i + c * 4] = a[j] * b0 + a[j + 4] * b1 + a[j + 8] * b2 + a[j + 12] * b3;
      o[i + c * 4 + 1] = a[j + 1] * b0 + a[j + 5] * b1 + a[j + 9] * b2 + a[j + 13] * b3;
      o[i + c * 4 + 2] = a[j + 2] * b0 + a[j + 6] * b1 + a[j + 10] * b2 + a[j + 14] * b3;
      o[i + c * 4 + 3] = a[j + 3] * b0 + a[j + 7] * b1 + a[j + 11] * b2 + a[j + 15] * b3;
    }
  },
  persp(o, fovy, asp, n, f) { // profundidade 0..1
    const t = 1 / Math.tan(fovy / 2); o.fill(0, 0, 16);
    o[0] = t / asp; o[5] = t; o[10] = f / (n - f); o[11] = -1; o[14] = n * f / (n - f);
  },
  ortho(o, l, r, b, t, n, f) {
    o.fill(0, 0, 16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = 1 / (n - f);
    o[12] = (l + r) / (l - r); o[13] = (t + b) / (b - t); o[14] = n / (n - f); o[15] = 1;
  },
  lookAt(o, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
    let zx = ex - tx, zy = ey - ty, zz = ez - tz; let l = 1 / hyp(zx, zy, zz); zx *= l; zy *= l; zz *= l;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; l = 1 / (hyp(xx, xy, xz) || 1); xx *= l; xy *= l; xz *= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
  },
  invert(o, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  },
  // matriz a partir de quaternio + posicao (escala 1)
  fromQTr(o, i) {
    const x = _q[0], y = _q[1], z = _q[2], w = _q[3], px = _q[4], py = _q[5], pz = _q[6];
    const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    o[i] = 1 - yy - zz; o[i + 1] = xy + wz; o[i + 2] = xz - wy; o[i + 3] = 0;
    o[i + 4] = xy - wz; o[i + 5] = 1 - xx - zz; o[i + 6] = yz + wx; o[i + 7] = 0;
    o[i + 8] = xz + wy; o[i + 9] = yz - wx; o[i + 10] = 1 - xx - yy; o[i + 11] = 0;
    o[i + 12] = px; o[i + 13] = py; o[i + 14] = pz; o[i + 15] = 1;
  },
  // o = a * T(tx,ty,tz) * R(eixo 0|1|2, ang)
  mulTRr(o, i, a, j, axis) {
    const tx = _t[0], ty = _t[1], tz = _t[2], ang = _t[3], c = Math.cos(ang), s = Math.sin(ang), t = M4._t; t.fill(0); t[0] = t[5] = t[10] = t[15] = 1;
    if (axis === 0) { t[5] = c; t[6] = s; t[9] = -s; t[10] = c; } else if (axis === 1) { t[0] = c; t[2] = -s; t[8] = s; t[10] = c; } else { t[0] = c; t[1] = s; t[4] = -s; t[5] = c; }
    t[12] = tx; t[13] = ty; t[14] = tz; M4.mul(o, i, a, j, t, 0);
  },
  _t: new Float32Array(16),
};
