// ---------- efeitos: faiscas, lascas, fumaca, fogo, luzes dinamicas, marcas no piso ----------
const FX = {
  N: PMAX_B - 64, NS: PMAX_A, rng: new Rng(99),
  p: new Float32Array((PMAX_B - 64) * 12), // x y z vx vy vz vida max tipo tam r g
  sm: new Float32Array(PMAX_A * 10), // x y z vx vy vz vida max tam semente/rot ; tipo em st
  st: new Uint8Array(PMAX_A), nx: 0, nxs: 0,
  pl: new Float32Array(6 * 9), // luzes de pulso: x y z raio r g b t dur
  fl: new Float32Array(6 * 7), nfl: 0, sh: new Float32Array(2),
  reset() { this.p.fill(0); this.sm.fill(0); this.pl.fill(0); this.nfl = 0; this.sh[0] = 0; this.rng.seed(99); R.nA = 0; R.nB = 0; R.ndl = 0; },
  sparksR(kind) {
    const x = _f[0], y = _f[1], z = _f[2], dx = _f[3], dy = _f[4], dz = _f[5], sp = _f[7], spread = _f[8], p = this.p, r = this.rng, n = Math.min(_f[6] | 0, 260);
    for (let i = 0; i < n; i++) { const o = this.nx * 12; this.nx = (this.nx + 1) % this.N; const s = sp * (0.25 + (r.uR(), _u[0]) * (r.uR(), _u[0]) * 1.3);
      p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = (dx + (r.uR(), _u[0] * 2 - 1) * spread) * s; p[o + 4] = (dy + (r.uR(), _u[0] * 2 - 1) * spread) * s + 1; p[o + 5] = (dz + (r.uR(), _u[0] * 2 - 1) * spread) * s;
      p[o + 7] = kind === 1 ? (r.uR(), (.5) + ((1.4) - (.5)) * _u[0]) : (r.uR(), (.15) + ((.7) - (.15)) * _u[0] * _u[0]); p[o + 6] = p[o + 7]; p[o + 8] = kind || 0; p[o + 9] = kind === 1 ? (r.uR(), (.002) + ((.005) - (.002)) * _u[0]) : (r.uR(), (.002) + ((.008) - (.002)) * _u[0] * _u[0]); p[o + 10] = (r.uR(), _u[0]); p[o + 11] = 0; }
  },
  smokeR(dark) { const x = _f[0], y = _f[1], z = _f[2], n = _f[3] | 0, size = _f[4], up = _f[5], m = this.sm, r = this.rng; for (let i = 0; i < n; i++) { const k = this.nxs; this.nxs = (this.nxs + 1) % this.NS; const o = k * 10; m[o] = x + (r.uR(), _u[0] * 2 - 1) * .08; m[o + 1] = y + (r.uR(), _u[0] * 2 - 1) * .05; m[o + 2] = z + (r.uR(), _u[0] * 2 - 1) * .08; m[o + 3] = (r.uR(), _u[0] * 2 - 1) * .35; m[o + 4] = (up || .8) * (r.uR(), (.6) + ((1.3) - (.6)) * _u[0]); m[o + 5] = (r.uR(), _u[0] * 2 - 1) * .35; m[o + 7] = (r.uR(), (1.4) + ((3.0) - (1.4)) * _u[0]); m[o + 6] = m[o + 7]; m[o + 8] = size * (r.uR(), (.7) + ((1.3) - (.7)) * _u[0]); m[o + 9] = (r.uR(), _u[0]) * 100; this.st[k] = dark ? 1 : 0; } },
  fireR() { const x = _f[0], y = _f[1], z = _f[2], n = _f[3] | 0, size = _f[4], up = _f[5], p = this.p, r = this.rng; for (let i = 0; i < n; i++) { const o = this.nx * 12; this.nx = (this.nx + 1) % this.N; p[o] = x + (r.uR(), _u[0] * 2 - 1) * .06; p[o + 1] = y; p[o + 2] = z + (r.uR(), _u[0] * 2 - 1) * .06; p[o + 3] = (r.uR(), _u[0] * 2 - 1) * .5; p[o + 4] = up * (r.uR(), (.6) + ((1.2) - (.6)) * _u[0]); p[o + 5] = (r.uR(), _u[0] * 2 - 1) * .5; p[o + 7] = (r.uR(), (.25) + ((.55) - (.25)) * _u[0]); p[o + 6] = p[o + 7]; p[o + 8] = 3; p[o + 9] = size * (r.uR(), (.7) + ((1.3) - (.7)) * _u[0]); p[o + 10] = (r.uR(), _u[0]) * 100; p[o + 11] = (r.uR(), _u[0]) * 6; } },
  lightR() { const x = _f[0], y = _f[1], z = _f[2], rad = _f[3], r = _f[4], g = _f[5], b = _f[6], dur = _f[7], l = this.pl; let k = 0, bt = 9; for (let i = 0; i < 6; i++) { const rem = l[i * 9 + 8] > 0 ? 1 - l[i * 9 + 7] / l[i * 9 + 8] : -1; if (rem < bt) { bt = rem; k = i; } } const o = k * 9; l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = rad; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; l[o + 7] = 0; l[o + 8] = dur; },
  flightR() { const x = _f[0], y = _f[1], z = _f[2], rad = _f[3], r = _f[4], g = _f[5], b = _f[6]; if (this.nfl >= 4) return; const o = this.nfl++ * 7, l = this.fl; l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = rad; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; },
  markR() { const x0 = _f[0], z0 = _f[1], x1 = _f[2], z1 = _f[3], w = _f[4], ch = _f[5], int = _f[6]; if (R.nmk >= MARK_MAX) return; const m = R.mk, o = R.nmk++ * 8; m[o] = x0; m[o + 1] = z0; m[o + 2] = x1; m[o + 3] = z1; m[o + 4] = w; m[o + 5] = ch; m[o + 6] = int; m[o + 7] = 0; },
  update(dt) {
    const p = this.p, B = R.pB; let nb = 0;
    for (let i = 0; i < this.N; i++) { const o = i * 12; if (p[o + 6] <= 0) continue; p[o + 6] -= dt; const kind = p[o + 8];
      if (kind < 2) { p[o + 4] -= 9.8 * dt * (kind === 1 ? 1 : .85); const dr = 1 - dt * (kind === 1 ? .6 : 1.6); p[o + 3] *= dr; p[o + 5] *= dr; }
      else { p[o + 4] += 2.5 * dt; p[o + 3] *= 1 - dt * 2; p[o + 5] *= 1 - dt * 2; }
      p[o] += p[o + 3] * dt; p[o + 1] += p[o + 4] * dt; p[o + 2] += p[o + 5] * dt;
      if (kind < 2 && p[o + 1] < .008) { const inPit = this.sh[1] < -.05 && Math.abs(p[o] - PIT.x) < PIT.h && Math.abs(p[o + 2] - PIT.z) < PIT.h; if (!inPit) { p[o + 1] = .008; p[o + 4] *= -.38; p[o + 3] *= .7; p[o + 5] *= .7; if (kind === 1 && Math.abs(p[o + 4]) < .4) { p[o + 4] = 0; p[o + 3] *= .5; p[o + 5] *= .5; } } }
      if (kind < 2) { if (Math.abs(p[o]) > AR - .03) { p[o] = Math.sign(p[o]) * (AR - .03); p[o + 3] *= -.4; } if (Math.abs(p[o + 2]) > AR - .03) { p[o + 2] = Math.sign(p[o + 2]) * (AR - .03); p[o + 5] *= -.4; } }
      if (p[o + 6] <= 0 || nb >= PMAX_B) continue; const q = nb++ * 12, f = p[o + 6] / p[o + 7];
      B[q] = p[o]; B[q + 1] = p[o + 1]; B[q + 2] = p[o + 2]; B[q + 3] = p[o + 9];
      if (kind === 0) { B[q + 4] = p[o + 3]; B[q + 5] = p[o + 4]; B[q + 6] = p[o + 5]; B[q + 7] = 0; const h = f * (.6 + .4 * p[o + 10]); B[q + 8] = 48 * h + 1; B[q + 9] = 48 * h * h * .8 + .25; B[q + 10] = 48 * h * h * h * .55; B[q + 11] = Math.min(1, f * 3); }
      else if (kind === 1) { B[q + 4] = p[o + 3]; B[q + 5] = p[o + 4]; B[q + 6] = p[o + 5]; B[q + 7] = 1; const g = .05 + p[o + 10] * .5; B[q + 8] = g; B[q + 9] = g; B[q + 10] = g * 1.05; B[q + 11] = Math.min(1, f * 4); }
      else { B[q + 3] = p[o + 9] * (.6 + (1 - f) * .9); B[q + 4] = p[o + 11] + (1 - f); B[q + 5] = p[o + 10]; B[q + 6] = 0; B[q + 7] = 3; B[q + 8] = 1; B[q + 9] = 1; B[q + 10] = 1; B[q + 11] = Math.sin(f * 3.1) * .9 + .1; }
    }
    R.nB = nb;
    const m = this.sm, A = R.pA; let na = 0;
    for (let i = 0; i < this.NS; i++) { const o = i * 10; if (m[o + 6] <= 0) continue; m[o + 6] -= dt; if (m[o + 6] <= 0) continue; m[o + 3] *= 1 - dt * .8; m[o + 5] *= 1 - dt * .8; m[o + 4] *= 1 - dt * .35; m[o] += m[o + 3] * dt; m[o + 1] += m[o + 4] * dt; m[o + 2] += m[o + 5] * dt;
      const q = na++ * 12, f = m[o + 6] / m[o + 7], dk = this.st[i];
      A[q] = m[o]; A[q + 1] = m[o + 1]; A[q + 2] = m[o + 2]; A[q + 3] = m[o + 8] * (.45 + (1 - f) * 1.5); A[q + 4] = m[o + 9] * .1 + (1 - f) * .6; A[q + 5] = m[o + 9]; A[q + 6] = 0; A[q + 7] = 2;
      const c = dk ? .1 : .5; A[q + 8] = c; A[q + 9] = c; A[q + 10] = c * 1.03; A[q + 11] = Math.min(1, (1 - f) * 5) * f * f * (dk ? .5 : .16); }
    R.nA = na;
    // luzes: primeiro as continuas, depois os pulsos
    const d = R.dl; let n = 0; for (let i = 0; i < this.nfl && n < 6; i++) { const o = i * 7, k = n++ * 8; d[k] = this.fl[o]; d[k + 1] = this.fl[o + 1]; d[k + 2] = this.fl[o + 2]; d[k + 3] = this.fl[o + 3]; d[k + 4] = this.fl[o + 4]; d[k + 5] = this.fl[o + 5]; d[k + 6] = this.fl[o + 6]; }
    const l = this.pl; for (let i = 0; i < 6; i++) { const o = i * 9; if (l[o + 8] <= 0) continue; l[o + 7] += dt; if (l[o + 7] >= l[o + 8]) { l[o + 8] = 0; continue; } if (n >= 6) continue; const f = 1 - l[o + 7] / l[o + 8], k = n++ * 8; d[k] = l[o]; d[k + 1] = l[o + 1]; d[k + 2] = l[o + 2]; d[k + 3] = l[o + 3]; d[k + 4] = l[o + 4] * f * f; d[k + 5] = l[o + 5] * f * f; d[k + 6] = l[o + 6] * f * f; }
    R.ndl = n; this.nfl = 0; this.sh[0] = Math.max(0, this.sh[0] - dt * 3);
  },
};
