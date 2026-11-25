// ---------- desenho dos robos: estado -> instancias ----------
const MESH = {};
const _m = new Float32Array(16 * 4);
const DRAW = {
  // escreve uma instancia: matriz ja em R.I[o..o+15]
  put(slot, mesh, tint, mk, decal, hl, hw, wear, burn, glow, spin, seed) { const I = R.I, o = slot * INST_F; R.im[slot] = mesh; I[o + 32] = tint[0]; I[o + 33] = tint[1]; I[o + 34] = tint[2]; I[o + 35] = mk; I[o + 36] = decal; I[o + 37] = hl; I[o + 38] = hw; I[o + 39] = wear; I[o + 40] = burn; I[o + 41] = glow; I[o + 42] = spin; I[o + 43] = seed; },
  dents(slot, src, so) { const I = R.I, o = slot * INST_F + 44; if (!src) { for (let k = 0; k < 16; k++) I[o + k] = 0; return; } for (let k = 0; k < 16; k++) I[o + k] = src[so + k]; },
  hide(base) { for (let k = 0; k < SLOT.ROBOT_N; k++) R.im[base + k] = -1; },
  // B: {b, L, hp, hpMax, dent, wang, wa, cor, burn, glow, ycm}; pose px..qw (CM); an: Float32Array(4) deslocamentos de animacao por encaixe (ou null)
  bot(base, B, px, py, pz, qx, qy, qz, qw, decal, an) {
    const I = R.I, L = B.L, b = B.b, c = CHASSIS[b[0]], mk = BLIND[b[2]].metal, hl = c.L / 2, hw = c.W / 2 + .012, seed = base * 1.7;
    M4.fromQT(_m, 0, qx, qy, qz, qw, px, py, pz); M4.mulTR(_m, 16, _m, 0, 0, -B.ycm, 0, 1, 0); // _m[16..] = origem do robo
    const a0 = an ? an[0] : 0, a1 = an ? an[1] : 0, a2 = an ? an[2] : 0, a3 = an ? an[3] : 0, hp = B.hp, hm = B.hpMax, burn = B.burn || 0, glow = B.glow || 0;
    let s = base; M4.mulTR(I, s * INST_F, _m, 16, 0, a0, 0, 1, 0); this.put(s, MESH['ch' + b[0]].id, B.cor, 0, -1, hl, hw, 1 - hp[0] / hm[0], burn, glow, 0, seed); this.dents(s, B.dent, 80);
    // rodas
    const nw = L.nw, wm = MESH['wh' + b[1]].id;
    for (let q = 0; q < 4; q++) { s = base + 1 + q; if (hp[1 + q] <= 0 || (nw === 2 && q > 1)) { R.im[s] = -1; continue; }
      const zs = (q & 1) ? 1 : -1, x = nw === 2 ? (L.wx0 + L.wx1) / 2 : (q < 2 ? L.wx0 : L.wx1), z = zs * (L.wz + a1);
      if (zs > 0) M4.mulTR(I, s * INST_F, _m, 16, x, AXLE_Y, z, 2, nw === 2 ? 0 : -B.wang[q]); else { M4.mulTR(_m, 32, _m, 16, x, AXLE_Y, z, 1, PI); M4.mulTR(I, s * INST_F, _m, 32, 0, 0, 0, 2, nw === 2 ? 0 : B.wang[q]); }
      this.put(s, wm, B.cor, 0, -1, hl, hw, 1 - hp[1 + q] / hm[1 + q], burn, 0, nw === 2 ? B.wang[q] * zs : 0, seed + q); this.dents(s, null, 0); }
    // blindagem
    for (let p = 0; p < 5; p++) { s = base + 5 + p; if (hp[5 + p] <= 0) { R.im[s] = -1; continue; }
      const dx = p === 0 ? a2 : p === 1 ? -a2 : 0, dz = p === 2 ? -a2 : p === 3 ? a2 : 0, dy = p === 4 ? a2 : 0; M4.mulTR(I, s * INST_F, _m, 16, dx, dy, dz, 1, 0);
      this.put(s, MESH[`ar${b[0]}_${b[2]}_${p}`].id, B.cor, mk, decal, hl, hw, 1 - hp[5 + p] / hm[5 + p], burn, glow, 0, seed + p * 3.1); this.dents(s, B.dent, p * 16); }
    // arma
    s = base + 10; M4.mulTR(I, s * INST_F, _m, 16, 0, a3, 0, 1, 0); this.put(s, MESH[`wb${b[0]}_${b[3]}`].id, B.cor, 0, -1, hl, hw, 1 - hp[10] / hm[10], burn, 0, 0, seed + 20); this.dents(s, null, 0);
    s = base + 11; if (hp[10] <= 0) R.im[s] = -1; else { M4.mulTR(I, s * INST_F, _m, 16, L.px, L.py + a3, 0, b[3] === 0 ? 1 : 2, B.wa); this.put(s, MESH[`wm${b[0]}_${b[3]}`].id, B.cor, 0, -1, hl, hw, 1 - hp[10] / hm[10], burn, 0, 0, seed + 21); this.dents(s, null, 0); }
    for (let k = 12; k < SLOT.ROBOT_N; k++) R.im[base + k] = -1;
  },
};
