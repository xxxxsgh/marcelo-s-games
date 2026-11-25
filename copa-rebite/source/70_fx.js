// ---------- efeitos: faiscas, lascas, fumaca, fogo, luzes dinamicas, marcas no piso ----------
const FX = {
  N: PMAX_B - 64, NS: PMAX_A, rng: new Rng(99),
  p: new Float32Array((PMAX_B - 64) * 12), // x y z vx vy vz vida max tipo tam r g
  sm: new Float32Array(PMAX_A * 10), // x y z vx vy vz vida max tam semente/rot ; tipo em st
  st: new Uint8Array(PMAX_A), nx: 0, nxs: 0,
  pl: new Float32Array(6 * 9), // luzes de pulso: x y z raio r g b t dur
  fl: new Float32Array(6 * 7), nfl: 0, shake: 0, pitY: 0,
  reset() { this.p.fill(0); this.sm.fill(0); this.pl.fill(0); this.nfl = 0; this.shake = 0; this.rng.seed(99); R.nA = 0; R.nB = 0; R.ndl = 0; },
  sparks(x, y, z, dx, dy, dz, n, sp, spread, kind) {
    const p = this.p, r = this.rng; n = Math.min(n | 0, 260);
    for (let i = 0; i < n; i++) { const o = this.nx * 12; this.nx = (this.nx + 1) % this.N; const s = sp * (0.25 + r.u() * r.u() * 1.3);
      p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = (dx + r.s1() * spread) * s; p[o + 4] = (dy + r.s1() * spread) * s + 1; p[o + 5] = (dz + r.s1() * spread) * s;
      p[o + 7] = kind === 1 ? r.r(.5, 1.4) : r.r(.25, 1.1); p[o + 6] = p[o + 7]; p[o + 8] = kind || 0; p[o + 9] = kind === 1 ? r.r(.004, .011) : r.r(.004, .009); p[o + 10] = r.u(); p[o + 11] = 0; }
  },
  smoke(x, y, z, n, size, dark, up) { const m = this.sm, r = this.rng; for (let i = 0; i < n; i++) { const k = this.nxs; this.nxs = (this.nxs + 1) % this.NS; const o = k * 10; m[o] = x + r.s1() * .08; m[o + 1] = y + r.s1() * .05; m[o + 2] = z + r.s1() * .08; m[o + 3] = r.s1() * .35; m[o + 4] = (up || .8) * r.r(.6, 1.3); m[o + 5] = r.s1() * .35; m[o + 7] = r.r(1.4, 3.0); m[o + 6] = m[o + 7]; m[o + 8] = size * r.r(.7, 1.3); m[o + 9] = r.u() * 100; this.st[k] = dark ? 1 : 0; } },
  fire(x, y, z, n, size, up) { const p = this.p, r = this.rng; for (let i = 0; i < n; i++) { const o = this.nx * 12; this.nx = (this.nx + 1) % this.N; p[o] = x + r.s1() * .06; p[o + 1] = y; p[o + 2] = z + r.s1() * .06; p[o + 3] = r.s1() * .5; p[o + 4] = up * r.r(.6, 1.2); p[o + 5] = r.s1() * .5; p[o + 7] = r.r(.25, .55); p[o + 6] = p[o + 7]; p[o + 8] = 3; p[o + 9] = size * r.r(.7, 1.3); p[o + 10] = r.u() * 100; p[o + 11] = r.u() * 6; } },
  light(x, y, z, rad, r, g, b, dur) { const l = this.pl; let k = 0, bt = 9; for (let i = 0; i < 6; i++) { const rem = l[i * 9 + 8] > 0 ? 1 - l[i * 9 + 7] / l[i * 9 + 8] : -1; if (rem < bt) { bt = rem; k = i; } } const o = k * 9; l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = rad; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; l[o + 7] = 0; l[o + 8] = dur; },
  flight(x, y, z, rad, r, g, b) { if (this.nfl >= 4) return; const o = this.nfl++ * 7, l = this.fl; l[o] = x; l[o + 1] = y; l[o + 2] = z; l[o + 3] = rad; l[o + 4] = r; l[o + 5] = g; l[o + 6] = b; },
  mark(x0, z0, x1, z1, w, ch, int) { if (R.nmk >= MARK_MAX) return; const m = R.mk, o = R.nmk++ * 8; m[o] = x0; m[o + 1] = z0; m[o + 2] = x1; m[o + 3] = z1; m[o + 4] = w; m[o + 5] = ch; m[o + 6] = int; m[o + 7] = 0; },
  update(dt) {
    const p = this.p, B = R.pB; let nb = 0;
    for (let i = 0; i < this.N; i++) { const o = i * 12; if (p[o + 6] <= 0) continue; p[o + 6] -= dt; const kind = p[o + 8];
      if (kind < 2) { p[o + 4] -= 9.8 * dt * (kind === 1 ? 1 : .85); const dr = 1 - dt * (kind === 1 ? .6 : 1.6); p[o + 3] *= dr; p[o + 5] *= dr; }
      else { p[o + 4] += 2.5 * dt; p[o + 3] *= 1 - dt * 2; p[o + 5] *= 1 - dt * 2; }
      p[o] += p[o + 3] * dt; p[o + 1] += p[o + 4] * dt; p[o + 2] += p[o + 5] * dt;
      if (kind < 2 && p[o + 1] < .008) { const inPit = this.pitY < -.05 && Math.abs(p[o] - PIT.x) < PIT.h && Math.abs(p[o + 2] - PIT.z) < PIT.h; if (!inPit) { p[o + 1] = .008; p[o + 4] *= -.38; p[o + 3] *= .7; p[o + 5] *= .7; if (kind === 1 && Math.abs(p[o + 4]) < .4) { p[o + 4] = 0; p[o + 3] *= .5; p[o + 5] *= .5; } } }
      if (kind < 2) { if (Math.abs(p[o]) > AR - .03) { p[o] = Math.sign(p[o]) * (AR - .03); p[o + 3] *= -.4; } if (Math.abs(p[o + 2]) > AR - .03) { p[o + 2] = Math.sign(p[o + 2]) * (AR - .03); p[o + 5] *= -.4; } }
      if (p[o + 6] <= 0 || nb >= PMAX_B) continue; const q = nb++ * 12, f = p[o + 6] / p[o + 7];
      B[q] = p[o]; B[q + 1] = p[o + 1]; B[q + 2] = p[o + 2]; B[q + 3] = p[o + 9];
      if (kind === 0) { B[q + 4] = p[o + 3]; B[q + 5] = p[o + 4]; B[q + 6] = p[o + 5]; B[q + 7] = 0; const h = f * (.6 + .4 * p[o + 10]); B[q + 8] = 26 * h + 1; B[q + 9] = 26 * h * h * .62 + .25; B[q + 10] = 26 * h * h * h * .3; B[q + 11] = Math.min(1, f * 3); }
      else if (kind === 1) { B[q + 4] = p[o + 3]; B[q + 5] = p[o + 4]; B[q + 6] = p[o + 5]; B[q + 7] = 1; const g = .05 + p[o + 10] * .5; B[q + 8] = g; B[q + 9] = g; B[q + 10] = g * 1.05; B[q + 11] = Math.min(1, f * 4); }
      else { B[q + 3] = p[o + 9] * (.6 + (1 - f) * .9); B[q + 4] = p[o + 11] + (1 - f); B[q + 5] = p[o + 10]; B[q + 6] = 0; B[q + 7] = 3; B[q + 8] = 1; B[q + 9] = 1; B[q + 10] = 1; B[q + 11] = Math.sin(f * 3.1) * .9 + .1; }
    }
    R.nB = nb;
    const m = this.sm, A = R.pA; let na = 0;
    for (let i = 0; i < this.NS; i++) { const o = i * 10; if (m[o + 6] <= 0) continue; m[o + 6] -= dt; if (m[o + 6] <= 0) continue; m[o + 3] *= 1 - dt * .8; m[o + 5] *= 1 - dt * .8; m[o + 4] *= 1 - dt * .35; m[o] += m[o + 3] * dt; m[o + 1] += m[o + 4] * dt; m[o + 2] += m[o + 5] * dt;
      const q = na++ * 12, f = m[o + 6] / m[o + 7], dk = this.st[i];
      A[q] = m[o]; A[q + 1] = m[o + 1]; A[q + 2] = m[o + 2]; A[q + 3] = m[o + 8] * (.45 + (1 - f) * 1.5); A[q + 4] = m[o + 9] * .1 + (1 - f) * .6; A[q + 5] = m[o + 9]; A[q + 6] = 0; A[q + 7] = 2;
      const c = dk ? .1 : .5; A[q + 8] = c; A[q + 9] = c; A[q + 10] = c * 1.03; A[q + 11] = Math.min(1, (1 - f) * 5) * f * f * (dk ? .6 : .26); }
    R.nA = na;
    // luzes: primeiro as continuas, depois os pulsos
    const d = R.dl; let n = 0; for (let i = 0; i < this.nfl && n < 6; i++) { const o = i * 7, k = n++ * 8; d[k] = this.fl[o]; d[k + 1] = this.fl[o + 1]; d[k + 2] = this.fl[o + 2]; d[k + 3] = this.fl[o + 3]; d[k + 4] = this.fl[o + 4]; d[k + 5] = this.fl[o + 5]; d[k + 6] = this.fl[o + 6]; }
    const l = this.pl; for (let i = 0; i < 6; i++) { const o = i * 9; if (l[o + 8] <= 0) continue; l[o + 7] += dt; if (l[o + 7] >= l[o + 8]) { l[o + 8] = 0; continue; } if (n >= 6) continue; const f = 1 - l[o + 7] / l[o + 8], k = n++ * 8; d[k] = l[o]; d[k + 1] = l[o + 1]; d[k + 2] = l[o + 2]; d[k + 3] = l[o + 3]; d[k + 4] = l[o + 4] * f * f; d[k + 5] = l[o + 5] * f * f; d[k + 6] = l[o + 6] * f * f; }
    R.ndl = n; this.nfl = 0; this.shake = Math.max(0, this.shake - dt * 3);
  },
};
