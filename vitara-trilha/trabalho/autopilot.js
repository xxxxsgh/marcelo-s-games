// autopilot.js — piloto automático: perseguição pura no eixo da trilha + perfil de velocidade.
// Script simples (usa só World, Physics e Math); escreve um "gamepad virtual": rt, lt, sx (direita positiva).
const Autopilot = (() => {
  const A = { rt: 0, lt: 0, sx: 0, vT: null, off: null, vTarget: 0, ALAT: 7.0, ABRK: 5.2, VCAP: 30, DEAD: 0.12 };
  const st = new Float64Array(2); // 0: esterço filtrado, 1: acelerador filtrado
  let n = 0;

  A.init = function () {
    const T = World.trk, B = World.bridge, sf = World.sf, ds = T.ds; n = T.n;
    const vT = A.vT = new Float32Array(n), off = A.off = new Float32Array(n), k = new Float32Array(n), tmp = new Float32Array(n);
    // curvatura suavizada (janela ~6 m)
    for (let i = 0; i < n; i++) k[i] = T.curv[i];
    for (let it = 0; it < 2; it++) { for (let i = 0; i < n; i++) { let s = 0; for (let j = -8; j <= 8; j++) s += k[(i + j + n) % n]; tmp[i] = s / 17; } k.set(tmp); }
    // linha: desloca um pouco para dentro da curva (o centro do carro nunca passa de hw - 1.45)
    for (let i = 0; i < n; i++) {
      const s = i * ds, inBr = s > B.s0 - 14 && s < B.s1 + 10, gate = Math.abs(s - World.gateS) < 10;
      let o = k[i] * 34; const m = Math.max(0, T.hw[i] - 1.75); o = o > m ? m : o < -m ? -m : o; off[i] = inBr || gate ? 0 : o;
    }
    for (let it = 0; it < 150; it++) { for (let i = 0; i < n; i++) tmp[i] = (off[(i + n - 1) % n] + 2 * off[i] + off[(i + 1) % n]) / 4; off.set(tmp); }
    // limite por curva, piso, lombadas e trechos especiais
    for (let i = 0; i < n; i++) {
      const s = i * ds, a = (i + n - 8) % n, b = (i + 8) % n;
      World.surfaceAt(T.x[i], T.z[i]);
      let v = Math.sqrt(A.ALAT * Math.pow(sf.grip, 1.5) / (Math.abs(k[i]) + 1e-4));
      const kv = -(T.y[a] - 2 * T.y[i] + T.y[b]) / (16 * ds * ds); // curvatura vertical (crista > 0)
      if (kv > 0.002) v = Math.min(v, Math.sqrt(5.5 / kv));
      if (sf.type === 6) v = Math.min(v, 15.5);          // pedra: irregular
      if (sf.type === 3) v = Math.min(v, 11);            // vau do riacho
      if (s > B.s0 - 6 && s < B.s1 + 2) v = Math.min(v, 13.5); // ponte estreita
      vT[i] = Math.min(v, A.VCAP);
    }
    // frenagem: varre para trás (duas voltas por causa do fechamento)
    for (let it = 0; it < 2; it++) for (let i = n - 1; i >= 0; i--) {
      const j = (i + 1) % n; World.surfaceAt(T.x[i], T.z[i]);
      const slope = (T.y[j] - T.y[i]) / ds, ab = Math.max(2.5, A.ABRK * sf.grip + 9.81 * slope * 0.8);
      const v = Math.sqrt(vT[j] * vT[j] + 2 * ab * ds); if (v < vT[i]) vT[i] = v;
    }
    st[0] = 0; st[1] = 0;
  };

  A.drive = function () {
    const T = World.trk, P = Physics, p = P.pos, q = P.quat, tq = World.tq;
    const v = P.speed, fx = 2 * (q[0] * q[2] + q[3] * q[1]), fz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
    if (!World.trackQ(p[0], p[2])) { A.rt = 0; A.lt = 0; A.sx = 0; return; }
    const idx = tq.idx, va = v > 0 ? v : 0;
    // ponto-alvo à frente
    let Ld = 3.2 + 0.36 * va; if (Ld < 4.5) Ld = 4.5; if (Ld > 15) Ld = 15;
    const j = (idx + Math.round(Ld / T.ds)) % n, o = A.off[j];
    const dx = T.x[j] + T.tz[j] * o - p[0], dz = T.z[j] - T.tx[j] * o - p[2];
    const fl = Math.hypot(fx, fz) + 1e-9, lz = (dx * fx + dz * fz) / fl, lxx = (dx * fz - dz * fx) / fl; // frente / esquerda
    const d2 = lz * lz + lxx * lxx, kap = 2 * lxx / (d2 > 1 ? d2 : 1);
    let steer = Math.atan(P.WB * kap) * 1.12 / P.steerMax; steer = steer > 1 ? 1 : steer < -1 ? -1 : steer;
    st[0] += (steer - st[0]) * 0.3; steer = st[0];
    // velocidade: olha um pouco adiante no perfil
    const vt = A.vT[(idx + Math.round(va * 0.12 / T.ds)) % n]; A.vTarget = vt;
    const e = vt - v; let rt = 0, lt = 0;
    if (e > 0) rt = e * 0.7 + 0.12; else if (e < -0.4 && v > 2.5) lt = (-e - 0.4) * 0.3; else rt = 0.08;
    rt = rt > 1 ? 1 : rt; lt = lt > 1 ? 1 : lt;
    st[1] += (rt - st[1]) * 0.4; rt = lt > 0 ? 0 : st[1]; if (lt > 0) st[1] = 0;
    A.rt = rt; A.lt = lt;
    const as = steer < 0 ? -steer : steer; // desfaz a zona morta do Input
    A.sx = as < 0.004 ? 0 : -(steer < 0 ? -1 : 1) * (A.DEAD + (1 - A.DEAD) * as);
  };
  return A;
})();
