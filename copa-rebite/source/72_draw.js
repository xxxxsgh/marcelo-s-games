// ---------- desenho dos robos: estado -> instancias ----------
const MESH = {};
const _m = new Float32Array(16 * 4);
const DRAW = {
  blurH: 0, blurV: 0,
  // escreve uma instancia: matriz ja em R.I[o..o+15]
  putR(slot, mesh, tint) { const mk = _d[0], decal = _d[1], hl = _d[2], hw = _d[3], wear = _d[4], burn = _d[5], glow = _d[6], spin = _d[7], seed = _d[8], I = R.I, o = slot * INST_F; R.im[slot] = mesh; I[o + 32] = tint[0]; I[o + 33] = tint[1]; I[o + 34] = tint[2]; I[o + 35] = mk; I[o + 36] = decal; I[o + 37] = hl; I[o + 38] = hw; I[o + 39] = wear; I[o + 40] = burn; I[o + 41] = glow; I[o + 42] = spin; I[o + 43] = seed; },
  dents(slot, src, so) { const I = R.I, o = slot * INST_F + 44; if (!src) { for (let k = 0; k < 16; k++) I[o + k] = 0; return; } for (let k = 0; k < 16; k++) I[o + k] = src[so + k]; },
  hide(base) { for (let k = 0; k < SLOT.ROBOT_N; k++) R.im[base + k] = -1; },
  // B: {b, L, hp, hpMax, dent, wang, wa, cor, burn, glow, ycm}; pose px..qw (CM); an: Float32Array(4) deslocamentos de animacao por encaixe (ou null)
  botR(base, B, decal, an) {
    const px = _q[0], py = _q[1], pz = _q[2], qx = _q[3], qy = _q[4], qz = _q[5], qw = _q[6];
    const I = R.I, L = B.L, b = B.b, c = CHASSIS[b[0]], mk = BLIND[b[2]].metal, hl = c.L / 2, hw = c.W / 2 + .012, seed = base * 1.7;
    (_q[0] = qx, _q[1] = qy, _q[2] = qz, _q[3] = qw, _q[4] = px, _q[5] = py, _q[6] = pz, M4.fromQTr(_m, 0)); (_t[0] = 0, _t[1] = -B.ycm, _t[2] = 0, _t[3] = 0, M4.mulTRr(_m, 16, _m, 0, 1)); // _m[16..] = origem do robo
    const a0 = an ? an[0] : 0, a1 = an ? an[1] : 0, a2 = an ? an[2] : 0, a3 = an ? an[3] : 0, hp = B.hp, hm = B.hpMax, burn = B.burn || 0, glow = B.glow || 0;
    let s = base; (_t[0] = 0, _t[1] = a0, _t[2] = 0, _t[3] = 0, M4.mulTRr(I, s * INST_F, _m, 16, 1)); (_d[0] = 0, _d[1] = -1, _d[2] = hl, _d[3] = hw, _d[4] = 1 - hp[0] / hm[0], _d[5] = burn, _d[6] = glow, _d[7] = 0, _d[8] = seed, this.putR(s, B.mid[0], B.cor)); this.dents(s, B.dent, 80);
    // rodas
    const nw = L.nw, wm = B.mid[1];
    for (let q = 0; q < 4; q++) { s = base + 1 + q; if (hp[1 + q] <= 0 || (nw === 2 && q > 1)) { R.im[s] = -1; continue; }
      const zs = (q & 1) ? 1 : -1, x = nw === 2 ? (L.wx0 + L.wx1) / 2 : (q < 2 ? L.wx0 : L.wx1), z = zs * (L.wz + a1);
      if (zs > 0) (_t[0] = x, _t[1] = AXLE_Y, _t[2] = z, _t[3] = nw === 2 ? 0 : -B.wang[q], M4.mulTRr(I, s * INST_F, _m, 16, 2)); else { (_t[0] = x, _t[1] = AXLE_Y, _t[2] = z, _t[3] = PI, M4.mulTRr(_m, 32, _m, 16, 1)); (_t[0] = 0, _t[1] = 0, _t[2] = 0, _t[3] = nw === 2 ? 0 : B.wang[q], M4.mulTRr(I, s * INST_F, _m, 32, 2)); }
      (_d[0] = 0, _d[1] = -1, _d[2] = hl, _d[3] = hw, _d[4] = 1 - hp[1 + q] / hm[1 + q], _d[5] = burn, _d[6] = 0, _d[7] = nw === 2 ? B.wang[q] * zs : 0, _d[8] = seed + q, this.putR(s, wm, B.cor)); this.dents(s, null, 0); }
    // blindagem
    for (let p = 0; p < 5; p++) { s = base + 5 + p; if (hp[5 + p] <= 0) { R.im[s] = -1; continue; }
      const dx = p === 0 ? a2 : p === 1 ? -a2 : 0, dz = p === 2 ? -a2 : p === 3 ? a2 : 0, dy = p === 4 ? a2 : 0; (_t[0] = dx, _t[1] = dy, _t[2] = dz, _t[3] = 0, M4.mulTRr(I, s * INST_F, _m, 16, 1));
      (_d[0] = mk, _d[1] = decal, _d[2] = hl, _d[3] = hw, _d[4] = 1 - hp[5 + p] / hm[5 + p], _d[5] = burn, _d[6] = glow, _d[7] = 0, _d[8] = seed + p * 3.1, this.putR(s, B.mid[2 + p], B.cor)); this.dents(s, B.dent, p * 16); }
    // arma
    s = base + 10; (_t[0] = 0, _t[1] = a3, _t[2] = 0, _t[3] = 0, M4.mulTRr(I, s * INST_F, _m, 16, 1)); (_d[0] = 0, _d[1] = -1, _d[2] = hl, _d[3] = hw, _d[4] = 1 - hp[10] / hm[10], _d[5] = burn, _d[6] = 0, _d[7] = 0, _d[8] = seed + 20, this.putR(s, B.mid[7], B.cor)); this.dents(s, null, 0);
    s = base + 11; if (hp[10] <= 0) R.im[s] = -1; else { const spinning = b[3] < 2 && B.wspin > ARMAS[b[3]].wmax * .32; (_t[0] = L.px, _t[1] = L.py + a3, _t[2] = 0, _t[3] = (b[3] < 3 ? B.wav : B.wa), M4.mulTRr(I, s * INST_F, _m, 16, b[3] === 0 ? 1 : 2)); (_d[0] = 0, _d[1] = -1, _d[2] = hl, _d[3] = hw, _d[4] = 1 - hp[10] / hm[10], _d[5] = burn, _d[6] = 0, _d[7] = 0, _d[8] = seed + 21, this.putR(s, spinning ? (b[3] === 0 ? DRAW.blurH : DRAW.blurV) : B.mid[8], B.cor)); this.dents(s, null, 0); }
    for (let k = 12; k < SLOT.ROBOT_N; k++) R.im[base + k] = -1;
  },
};
