// ---------- simulacao deterministica: fisica, armas, armadilhas, dano, IA, juizes ----------
// pecas: 0 chassi, 1-4 rodas, 5 frente, 6 tras, 7 esquerda(-z), 8 direita(+z), 9 teto, 10 arma, 11 bateria
const P_CH = 0, P_W = 1, P_AF = 5, P_AR = 6, P_AL = 7, P_ARI = 8, P_AT = 9, P_WP = 10, P_BAT = 11, NPART = 12;
const PIT_T = 75, SUB = 4, DT = 1 / 60, HDT = DT / SUB, GRAV = 9.81, LUTA_T = 180, KO_T = 10;
const EV = { HIT: 1, DETACH: 2, GRIND: 3, SAW: 4, AHAM: 5, FLIP: 6, KO: 7, SCRAPE: 8, LAND: 9, HAMMER: 10, FLAME: 11, RESET: 12, SKID: 13, GRAB: 14 };
const ESTILOS = [ // agress, distancia preferida, usa armadilha, recua apos golpe, flanqueia
  { nome: 'vai direto para cima', ag: 1.0, dist: 0, trap: .2, back: 0, flank: .15 },
  { nome: 'só empurra', ag: .9, dist: 0, trap: 1.0, back: 0, flank: .35 },
  { nome: 'foge e contra-ataca', ag: .45, dist: 3.2, trap: .3, back: 1.0, flank: .6 },
  { nome: 'caça o ponto fraco', ag: .8, dist: 1.4, trap: .4, back: .4, flank: 1.0 },
];
const DEB_N = SLOT.DEBRIS_N, DEB_F = 20;
const _c = new Float64Array(16);

class Bot {
  constructor(id) {
    this.id = id; this.s = new Float64Array(13); this.R = new Float64Array(9); this.hp = new Float32Array(NPART); this.hpMax = new Float32Array(NPART);
    this.dent = new Float32Array(6 * 16); this.dentN = new Uint8Array(6); this.wl = new Float64Array(12); this.wang = new Float32Array(4); this.wcon = new Uint8Array(4); this.wslip = new Float32Array(4);
    this.F = new Float64Array(3); this.T = new Float64Array(3); this.Ii = new Float64Array(3); this.hpt = new Float64Array(20 * 3);
    this.b = [0, 0, 0, 0]; this.L = {}; this.S = {}; this.cor = [1, 0, 0]; this.nome = ''; this.num = 0;
    this.thr = 0; this.steer = 0; this.fire = 0; this.flipB = 0; this.resetB = 0; this.pfire = 0;
    this.ai = { estilo: 0, t: 0, mode: 0, mt: 0, stuck: 0, sx: 0, sz: 0, jit: 0, side: 1, lastHit: 0 };
    this.jd = new Float32Array(4); // dano causado, agressividade, controle, resets
    this.reset0();
  }
  reset0() { this.wspin = 0; this.wa = 0; this.wst = 0; this.wt = 0; this.wcd = 0; this.won = 0; this.grab = 0; this.hitcd = 0; this.imm = 0; this.ax = 0; this.az = 0; this.at = 0; this.flipCd = 0; this.resetCd = 0; this.burn = 0; this.fireOn = 0; this.dead = 0; this.ko = 0; this.sawCd = 0; this.heat = 0; this.air = 0; this.lastHitBy = 0; this.pitted = 0; this.glow = 0; }
}

class Sim {
  constructor() {
    this.bots = [new Bot(0), new Bot(1)]; this.rng = new Rng(1); this.t = 0; this.frame = 0; this.over = 0; this.winner = -1; this.koBy = '';
    this.deb = new Float64Array(DEB_N * DEB_F); this.debMesh = new Int16Array(DEB_N).fill(-1); this.debNext = 0; this.debInfo = new Float32Array(DEB_N * 8);
    this.ev = new Float32Array(96 * 8); this.nev = 0; this.sawH = new Float32Array(2); this.sawA = 0; this.ahA = 1.25; this.ahSt = 0; this.ahT = 0; this.ahCd = 2; this.flameOn = 0; this.dur = LUTA_T;
    this.best = 0; this.bestFrame = -1; this.scores = new Float32Array(3 * 2 * 3); this.judgeTot = new Float32Array(6); this.ptsA = 0; this.ptsB = 0;
  }
  emit(type, x, y, z, dx, dy, dz, mag) { if (this.nev >= 96) return; const e = this.ev, o = this.nev++ * 8; e[o] = type; e[o + 1] = x; e[o + 2] = y; e[o + 3] = z; e[o + 4] = dx; e[o + 5] = dy; e[o + 6] = dz; e[o + 7] = mag; }
  // b: montagem, hp: Float32Array(12) ou null (novo), cfg {nome,cor,num,estilo}
  setupBot(i, build, hp, cfg) {
    const B = this.bots[i]; B.reset0(); B.b[0] = build[0]; B.b[1] = build[1]; B.b[2] = build[2]; B.b[3] = build[3]; layoutOf(build, B.L); statsOf(build, B.S);
    B.nome = cfg.nome; B.cor = cfg.cor; B.num = cfg.num; B.ai.estilo = cfg.estilo || 0; B.ai.t = 0; B.ai.mode = 0; B.ai.mt = 0; B.ai.stuck = 0; B.ai.side = i ? -1 : 1; B.jd.fill(0);
    const L = B.L, c = CHASSIS[build[0]], w = RODAS[build[1]], a = BLIND[build[2]], k = ARMAS[build[3]];
    B.ycm = L.hy1 * .36; B.m = B.S.kg; const sx = 2 * L.hx, sy = L.hy1 + L.clear, sz = 2 * L.hz;
    B.Ii[0] = 1 / (B.m / 12 * (sy * sy + sz * sz) * 1.5); B.Ii[1] = 1 / (B.m / 12 * (sx * sx + sz * sz) * 1.25); B.Ii[2] = 1 / (B.m / 12 * (sx * sx + sy * sy) * 1.5);
    const hm = B.hpMax; hm[0] = c.hp * 1.6; for (let q = 1; q <= 4; q++) hm[q] = w.hp * 1.35; for (let q = 5; q <= 9; q++) hm[q] = a.hp * 1.4; hm[P_AT] = a.hp * 1.25; hm[P_WP] = k.hp * 1.5; hm[P_BAT] = 115;
    for (let q = 0; q < NPART; q++) B.hp[q] = hp ? Math.min(hp[q], hm[q]) : hm[q];
    if (w.n === 2) { B.hp[3] = B.hp[1]; B.hp[4] = B.hp[2]; } // esteiras: 1 = lado -z, 2 = lado +z
    B.dent.fill(0); B.dentN.fill(0);
    // rodas: 0 (-z,tras) 1 (+z,tras) 2 (-z,frente) 3 (+z,frente)
    const wl = B.wl; for (let q = 0; q < 4; q++) { wl[q * 3] = q < 2 ? L.wx0 : L.wx1; wl[q * 3 + 1] = AXLE_Y - B.ycm; wl[q * 3 + 2] = (q & 1) ? L.wz : -L.wz; }
    // pontos do casco (relativos ao CM)
    let n = 0; const hp_ = B.hpt, y0 = -B.ycm, y1 = L.hy1 - B.ycm;
    for (const yy of [y0, y1]) { for (const xx of [-L.hx, L.hx]) for (const zz of [-L.hz, L.hz]) { hp_[n++] = xx; hp_[n++] = yy; hp_[n++] = zz; } for (const [xx, zz] of [[0, -L.hz], [0, L.hz], [-L.hx, 0], [L.hx, 0]]) { hp_[n++] = xx; hp_[n++] = yy; hp_[n++] = zz; } }
    // cunha: os cantos da frente em cima descem
    if (c.wedge) { for (let q = 0; q < 16; q++) if (hp_[q * 3] > 0 && hp_[q * 3 + 1] > 0) hp_[q * 3 + 1] = .045 - B.ycm; }
    B.nhp = 16; B.wedge = c.wedge;
    const s = B.s; s[0] = START[i][0]; s[1] = L.clear + B.ycm + .01; s[2] = START[i][1]; s[3] = 0; s[4] = i ? 1 : 0; s[5] = 0; s[6] = i ? 0 : 1; for (let q = 7; q < 13; q++) s[q] = 0;
    B.ax = s[0]; B.az = s[2]; this.updR(B);
  }
  start(seed, dur) { this.rng.seed(seed); this.t = 0; this.frame = 0; this.over = 0; this.winner = -1; this.koBy = ''; this.debMesh.fill(-1); this.debNext = 0; this.nev = 0; this.sawH.fill(0); this.ahA = 1.25; this.ahSt = 0; this.ahCd = 2; this.flameOn = 0; this.dur = dur || LUTA_T; this.best = 0; this.bestFrame = -1; this.pitY = 0; }
  updR(B) { const s = B.s, x = s[3], y = s[4], z = s[5], w = s[6], R = B.R; R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y); R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x); R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y); }
  // impulso J aplicado no ponto mundial P
  impulse(B, px, py, pz, jx, jy, jz) {
    const s = B.s, R = B.R, im = 1 / B.m; s[7] += jx * im; s[8] += jy * im; s[9] += jz * im;
    const rx = px - s[0], ry = py - s[1], rz = pz - s[2], tx = ry * jz - rz * jy, ty = rz * jx - rx * jz, tz = rx * jy - ry * jx;
    const lx = (R[0] * tx + R[3] * ty + R[6] * tz) * B.Ii[0], ly = (R[1] * tx + R[4] * ty + R[7] * tz) * B.Ii[1], lz = (R[2] * tx + R[5] * ty + R[8] * tz) * B.Ii[2];
    s[10] += R[0] * lx + R[1] * ly + R[2] * lz; s[11] += R[3] * lx + R[4] * ly + R[5] * lz; s[12] += R[6] * lx + R[7] * ly + R[8] * lz;
  }
  force(B, px, py, pz, fx, fy, fz) { const s = B.s; B.F[0] += fx; B.F[1] += fy; B.F[2] += fz; const rx = px - s[0], ry = py - s[1], rz = pz - s[2]; B.T[0] += ry * fz - rz * fy; B.T[1] += rz * fx - rx * fz; B.T[2] += rx * fy - ry * fx; }
  // contato de um ponto com piso/fosso/paredes. devolve penetracao e normal em _c[0..3]; raio r
  env(x, y, z, r) {
    let pen = 0, nx = 0, ny = 1, nz = 0;
    const dx = Math.abs(x - PIT.x) - PIT.h, dz = Math.abs(z - PIT.z) - PIT.h;
    if (dx < 0 && dz < 0) { pen = this.pitY - (y - r); if (pen <= 0 && y - r < 0) { // paredes do fosso
        const ex = -dx - r, ez = -dz - r; if (ex < 0 && ex < ez) { pen = -ex; nx = x > PIT.x ? -1 : 1; ny = 0; } else if (ez < 0) { pen = -ez; nz = z > PIT.z ? -1 : 1; ny = 0; } } }
    else { pen = r - y; if (pen > 0) { const out = Math.max(dx, dz); if (out < pen && out < .25) { pen = out + r * .5; ny = 0; if (dx > dz) nx = x > PIT.x ? -1 : 1; else nz = z > PIT.z ? -1 : 1; } } }
    let p2 = Math.abs(x) + r - AR; if (p2 > pen && p2 > 0) { pen = p2; nx = x > 0 ? -1 : 1; ny = 0; nz = 0; }
    p2 = Math.abs(z) + r - AR; if (p2 > pen && p2 > 0) { pen = p2; nz = z > 0 ? -1 : 1; ny = 0; nx = 0; }
    p2 = y + r - (WALL_H + .7); if (p2 > pen && p2 > 0) { pen = p2; nx = 0; ny = -1; nz = 0; }
    _c[0] = pen; _c[1] = nx; _c[2] = ny; _c[3] = nz; return pen;
  }
  // ponto mundial -> local do casco (relativo ao CM) em _c[4..6]
  toLocal(B, x, y, z) { const s = B.s, R = B.R, dx = x - s[0], dy = y - s[1], dz = z - s[2]; _c[4] = R[0] * dx + R[3] * dy + R[6] * dz; _c[5] = R[1] * dx + R[4] * dy + R[7] * dz; _c[6] = R[2] * dx + R[5] * dy + R[8] * dz; }
  // ponto do casco de B mais proximo de um ponto mundial -> _c[8..10] mundo, devolve distancia
  closest(B, x, y, z) { this.toLocal(B, x, y, z); const L = B.L, lx = clamp(_c[4], -L.hx, L.hx), ly = clamp(_c[5], -B.ycm, L.hy1 - B.ycm), lz = clamp(_c[6], -L.hz, L.hz), s = B.s, R = B.R;
    _c[8] = s[0] + R[0] * lx + R[1] * ly + R[2] * lz; _c[9] = s[1] + R[3] * lx + R[4] * ly + R[5] * lz; _c[10] = s[2] + R[6] * lx + R[7] * ly + R[8] * lz; _c[11] = lx; _c[12] = ly; _c[13] = lz;
    return Math.hypot(_c[8] - x, _c[9] - y, _c[10] - z); }
  wpt(B, lx, ly, lz) { const s = B.s, R = B.R; _c[0] = s[0] + R[0] * lx + R[1] * ly + R[2] * lz; _c[1] = s[1] + R[3] * lx + R[4] * ly + R[5] * lz; _c[2] = s[2] + R[6] * lx + R[7] * ly + R[8] * lz; }

  // ---------- dano ----------
  damage(B, lx, ly, lz, amt, mode, by) {
    if (amt <= 0 || this.over) return; const L = B.L, hy = (L.hy1) * .5, fx = lx / L.hx, fz = lz / L.hz, fy = (ly + B.ycm - hy) / hy;
    let face = P_AT; const ax = Math.abs(fx), ay = Math.abs(fy), az = Math.abs(fz);
    if (mode === 1) face = P_AT; else if (mode === 2) face = -1; else if (ax >= ay && ax >= az) face = fx > 0 ? P_AF : P_AR; else if (az >= ay) face = fz > 0 ? P_ARI : P_AL; else face = fy > 0 ? P_AT : -1;
    let rest = amt; const A = this.bots[1 - B.id];
    // rodas expostas na lateral
    if (face === P_AL || face === P_ARI) { const wi = (lx > (L.wx0 + L.wx1) / 2 ? 2 : 0) + (face === P_ARI ? 1 : 0), wx = lx > (L.wx0 + L.wx1) / 2 ? L.wx1 : L.wx0; if (Math.abs(lx - wx) < L.wr + .09) { this.hurt(B, P_W + wi, amt * .5, by); rest *= .5; } }
    if (face >= 0 && B.hp[face] > 0) { this.addDent(B, face - P_AF, lx, ly + B.ycm, lz, amt); this.hurt(B, face, rest * .82, by); rest *= .18; }
    else if (face >= 0) this.addDent(B, 5, lx, ly + B.ycm, lz, amt * .5);
    if (face === P_AL || face === P_ARI) { const wi = (lx > (L.wx0 + L.wx1) / 2 ? 2 : 0) + (face === P_ARI ? 1 : 0); if (B.hp[P_W + wi] > 0) { this.hurt(B, P_W + wi, rest * .6, by); rest *= .4; } this.hurt(B, P_CH, rest, by); }
    else if (face === P_AF) { if (B.hp[P_WP] > 0) { this.hurt(B, P_WP, rest * .5, by); rest *= .5; } this.hurt(B, P_CH, rest, by); }
    else if (face === P_AR) { this.hurt(B, P_BAT, rest * .55, by); this.hurt(B, P_CH, rest * .45, by); }
    else if (face === P_AT) { if (Math.abs(lx - L.mx) < .16 && B.hp[P_WP] > 0) { this.hurt(B, P_WP, rest * .45, by); rest *= .55; } this.hurt(B, P_BAT, rest * .5, by); this.hurt(B, P_CH, rest * .5, by); }
    else this.hurt(B, P_CH, rest, by);
    B.glow = 1;
  }
  addDent(B, panel, lx, ly, lz, amt) { // ate 4 mossas por painel; a mais proxima acumula
    const d = B.dent, o = panel * 16; let best = -1, bd = .012;
    for (let k = 0; k < B.dentN[panel]; k++) { const q = o + k * 4, dd = (d[q] - lx) * (d[q] - lx) + (d[q + 1] - ly) * (d[q + 1] - ly) + (d[q + 2] - lz) * (d[q + 2] - lz); if (dd < bd) { bd = dd; best = k; } }
    if (best < 0) { if (B.dentN[panel] < 4) best = B.dentN[panel]++; else { best = 0; for (let k = 1; k < 4; k++) if (d[o + k * 4 + 3] < d[o + best * 4 + 3]) best = k; d[o + best * 4 + 3] = 0; } d[o + best * 4] = lx; d[o + best * 4 + 1] = ly; d[o + best * 4 + 2] = lz; }
    d[o + best * 4 + 3] = Math.min(2, d[o + best * 4 + 3] + amt / 34);
  }
  hurt(B, part, amt, by) {
    if (B.hp[part] <= 0 || amt <= 0) return; const two = B.L.nw === 2 && part >= 1 && part <= 4; if (two && part > 2) part -= 2;
    const before = B.hp[part]; B.hp[part] = Math.max(0, before - amt); if (two) B.hp[part + 2] = B.hp[part];
    if (by >= 0) this.bots[by].jd[0] += before - B.hp[part];
    if (B.hp[part] <= 0) { // peca destruida
      if (part >= P_W && part <= P_AT || part === P_WP) this.detach(B, part);
      if (part === P_CH || part === P_BAT) { B.dead = 1; if (part === P_BAT) B.fireOn = 1; }
      if (part === P_WP) { B.wspin = 0; B.won = 0; B.grab = 0; }
    }
    if (part === P_BAT && B.hp[P_BAT] < B.hpMax[P_BAT] * .3) B.fireOn = 1;
  }
  detach(B, part) {
    const L = B.L, s = B.s; let lx = 0, ly = L.hy1 * .5, lz = 0, mesh = -1, flat = 1;
    if (part >= P_W && part <= 4) { const q = part - 1; if (L.nw === 2) { lx = (L.wx0 + L.wx1) / 2; lz = q === 0 ? -L.wz : L.wz; } else { lx = q < 2 ? L.wx0 : L.wx1; lz = (q & 1) ? L.wz : -L.wz; } ly = AXLE_Y; mesh = MESH['wh' + B.b[1]].id; flat = 2; }
    else if (part === P_WP) { lx = L.px; ly = L.py; mesh = MESH[`wm${B.b[0]}_${B.b[3]}`].id; flat = B.b[3] === 0 ? 1 : 2; }
    else { const p = part - P_AF; mesh = MESH[`ar${B.b[0]}_${B.b[2]}_${p}`].id; if (p === 0) lx = L.hx; else if (p === 1) lx = -L.hx; else if (p === 2) lz = -L.hz + .1; else if (p === 3) lz = L.hz - .1; else ly = L.hy1; flat = p >= 2 && p < 4 ? 2 : (p === 4 ? 1 : 0); }
    this.wpt(B, lx, ly - B.ycm, lz); const ox = _c[0] - s[0], oy = _c[1] - s[1], oz = _c[2] - s[2], l = 1 / (Math.hypot(ox, oy, oz) || 1), r = this.rng;
    const i = this.debNext; this.debNext = (this.debNext + 1) % DEB_N; const d = this.deb, o = i * DEB_F; this.debMesh[i] = mesh;
    const cxw = _c[0], cyw = _c[1], czw = _c[2];
    if (part >= P_AF && part <= P_AT) { // blindagem: malha no referencial do robo
      this.wpt(B, 0, -B.ycm, 0); d[o] = _c[0]; d[o + 1] = _c[1]; d[o + 2] = _c[2]; d[o + 3] = s[3]; d[o + 4] = s[4]; d[o + 5] = s[5]; d[o + 6] = s[6]; }
    else { d[o] = cxw; d[o + 1] = cyw; d[o + 2] = czw; if (part <= 4 && lz < 0) { d[o + 3] = -s[5]; d[o + 4] = s[6]; d[o + 5] = s[3]; d[o + 6] = -s[4]; } else { d[o + 3] = s[3]; d[o + 4] = s[4]; d[o + 5] = s[5]; d[o + 6] = s[6]; } lx = 0; ly = 0; lz = 0; }
    d[o + 7] = s[7] + ox * l * r.r(2, 4.5) + r.s1(); d[o + 8] = s[8] + r.r(2.5, 5); d[o + 9] = s[9] + oz * l * r.r(2, 4.5) + r.s1(); d[o + 10] = r.s1() * 9; d[o + 11] = r.s1() * 9; d[o + 12] = r.s1() * 9;
    d[o + 13] = lx; d[o + 14] = ly; d[o + 15] = lz; d[o + 16] = flat; d[o + 17] = B.id; d[o + 18] = part; d[o + 19] = 0;
    this.emit(EV.DETACH, cxw, cyw, czw, ox * l, 1, oz * l, part + B.id * 100);
  }

  // ---------- IA ----------
  think(B, A) {
    const ai = B.ai, st = ESTILOS[ai.estilo], s = B.s, R = B.R, as = A.s, r = this.rng; ai.t += DT;
    let thr = 0, steer = 0, fire = 0; const up = R[4];
    B.flipB = (up < .2 && B.flipCd <= 0) ? 1 : 0; B.resetB = 0;
    if (B.dead) { B.thr = 0; B.steer = 0; B.fire = 0; return; }
    const dx = as[0] - s[0], dz = as[2] - s[2], dist = Math.hypot(dx, dz) || 1e-3;
    // alvo: ponto fraco do adversario (painel com menos vida, evitando a frente armada)
    let tx = as[0], tz = as[2]; ai.mt -= DT;
    if (ai.mt <= 0) { ai.mt = r.r(.5, 1.1); ai.jit = r.s1();
      let bestF = 0, bestV = 9; const AR_ = A.R; // 0 frente 1 tras 2 esq 3 dir
      for (let f = 0; f < 4; f++) { let v = A.hp[P_AF + f] / A.hpMax[P_AF + f]; if (f === 0 && A.hp[P_WP] > 0) v += .9; if (f === 1) v -= .12; if (f >= 2) { const w0 = A.hp[P_W + (f - 2)], w1 = A.hp[P_W + 2 + (f - 2)]; v -= .18 * (1 - (w0 + w1) / (2 * A.hpMax[P_W])) + .05; }
        const nx = f === 0 ? AR_[0] : f === 1 ? -AR_[0] : f === 2 ? -AR_[2] : AR_[2], nz = f === 0 ? AR_[6] : f === 1 ? -AR_[6] : f === 2 ? -AR_[8] : AR_[8]; v += (1 - (-(dx * nx + dz * nz) / dist)) * .25 * (1.2 - st.flank); if (v < bestV) { bestV = v; bestF = f; } }
      ai.face = bestF;
      // modo
      const hpMe = (B.hp[P_CH] / B.hpMax[P_CH]), wpUp = B.hp[P_WP] > 0 && (!ARMAS[B.b[3]].spin || B.wspin > ARMAS[B.b[3]].wmax * .55);
      if (ai.mode === 2 && ai.t < ai.until) { } else if (st.back > .5 && ((ARMAS[B.b[3]].spin && !wpUp && B.hp[P_WP] > 0) || ai.t - ai.lastHit < 1.2 * st.back)) { ai.mode = 1; } else ai.mode = 0;
    }
    const AR_ = A.R, f = ai.face | 0, fnx = f === 0 ? AR_[0] : f === 1 ? -AR_[0] : f === 2 ? -AR_[2] : AR_[2], fnz = f === 0 ? AR_[6] : f === 1 ? -AR_[6] : f === 2 ? -AR_[8] : AR_[8];
    const off = clamp(dist - .9, 0, 1.6) * st.flank; tx = as[0] + fnx * off; tz = as[2] + fnz * off;
    // empurrar para a armadilha: se o adversario esta entre mim e uma armadilha, vai reto
    let trapPush = 0;
    if (st.trap > 0) for (let h = 0; h < 4; h++) { const hx = h === 0 ? PIT.x : h === 1 ? 4.3 : h === 2 ? FLAME.x : AHAM.hx, hz = h === 0 ? PIT.z : h === 1 ? -4.3 : h === 2 ? FLAME.z : AHAM.hz; const ax = hx - as[0], az = hz - as[2], ad = Math.hypot(ax, az) || 1; if ((h !== 0 || this.t > PIT_T) && ad < 5.5 && (ax * dx + az * dz) / (ad * dist) > .8 - st.trap * .25) { trapPush = Math.max(trapPush, st.trap * (h === 0 ? 1 : .7)); tx = as[0] - ax / ad * .3; tz = as[2] - az / ad * .3; } }
    if (ai.mode === 1) { // recua / orbita mantendo distancia
      const want = Math.max(st.dist, 2.6), ox = -dx / dist, oz = -dz / dist, px = -oz * ai.side, pz = ox * ai.side; tx = as[0] + ox * want + px * 1.8; tz = as[2] + oz * want + pz * 1.8; if (Math.abs(tx) > AR - 1.4 || Math.abs(tz) > AR - 1.4) { ai.side = -ai.side; tx = clamp(tx, -AR + 1.6, AR - 1.6); tz = clamp(tz, -AR + 1.6, AR - 1.6); } }
    // fuga das armadilhas: repulsao
    let pitNear = 0;
    let gx = tx - s[0], gz = tz - s[2]; const gl = Math.hypot(gx, gz) || 1e-3; gx /= gl; gz /= gl;
    for (let h = 0; h < 4; h++) { const hx = h === 0 ? PIT.x : h === 1 ? 4.3 : h === 2 ? FLAME.x : AHAM.hx, hz = h === 0 ? PIT.z : h === 1 ? -4.3 : h === 2 ? FLAME.z : AHAM.hz, rad = h === 0 ? (this.t > PIT_T - 4 ? 3.1 : 0) : h === 2 ? (this.flameOn ? 2.2 : 1.3) : 1.9; const ex = s[0] - hx, ez = s[2] - hz, ed = Math.hypot(ex, ez) || 1e-3; if (ed < rad) { const k = (1 - ed / rad) * (h === 0 ? 5.5 : 2.0) * (trapPush > 0 && dist < 1.6 && h !== 0 ? .5 : 1); gx += ex / ed * k; gz += ez / ed * k; if (h === 0 && ed < 2.0) pitNear = 1; } }
    // paredes
    if (Math.abs(s[0]) > AR - .9) gx -= Math.sign(s[0]) * .6; if (Math.abs(s[2]) > AR - .9) gz -= Math.sign(s[2]) * .6;
    const fwx = R[0], fwz = R[6], rtx = R[2], rtz = R[8], sgnUp = up < 0 ? -1 : 1;
    let ang = Math.atan2(gx * rtx + gz * rtz, gx * fwx + gz * fwz) * sgnUp;
    let rev = 0; if (Math.abs(ang) > 2.3 && gl < 2.2 && ai.mode === 1) { rev = 1; ang = wrapPi(ang + PI); }
    steer = clamp(ang * 2.2, -1, 1); thr = clamp(1.15 - Math.abs(ang) * .75, .15, 1) * (.55 + .45 * st.ag) * (rev ? -1 : 1);
    if (trapPush > 0 && dist < 1.8 && !pitNear) thr = 1; if (pitNear) { const vx = s[7], vz = s[9], px = PIT.x - s[0], pz = PIT.z - s[2]; if (vx * px + vz * pz > .4) thr = Math.min(thr, .25) * (rev ? -1 : 1); }
    // preso: da re girando
    const mv = Math.hypot(s[0] - ai.sx, s[2] - ai.sz); if (mv > .25) { ai.sx = s[0]; ai.sz = s[2]; ai.stuck = 0; } else ai.stuck += DT;
    if (ai.mode === 2) { thr = -.9; steer = ai.side * .8; if (ai.t > ai.until) { ai.mode = 0; ai.stuck = 0; } }
    else if (ai.stuck > 1.3) { ai.mode = 2; ai.until = ai.t + r.r(.5, .9); ai.side = r.u() < .5 ? -1 : 1; }
    // arma
    const k = ARMAS[B.b[3]], facing = (dx * fwx + dz * fwz) / dist;
    if (B.hp[P_WP] > 0 && ai.estilo !== 1) { if (k.spin) fire = B.won ? 0 : 1; else if (B.b[3] === 5) fire = (B.wst === 0 && B.wcd <= 0 && dist < B.L.hitx + A.L.hx * .9 + .12 && facing > .86) ? 1 : 0; else fire = (B.wst === 0 && B.wcd <= 0 && dist < B.L.hitx + Math.max(A.L.hx, A.L.hz) * .8 + .05 && facing > .8) ? 1 : 0; }
    else if (B.hp[P_WP] > 0 && k.spin && B.won) fire = 1; // o que so empurra desliga
    if (fire && k.spin) { B.fire = B.pfire ? 0 : 1; } else B.fire = fire;
    B.thr = thr; B.steer = steer;
  }

  // ---------- passo de 1/60 s ----------
  step() {
    if (this.over === 2) return; this.nev = 0; const b0 = this.bots[0], b1 = this.bots[1];
    // armadilhas
    const t = this.t; this.pitY = -PIT.d * sstep(PIT_T, PIT_T + 2.5, t); for (let i = 0; i < 2; i++) { const ph = (t + i * 3.6) % 7.2, up = ph < 2.4 && t > 4 ? 1 : 0; this.sawH[i] += clamp(up - this.sawH[i], -DT * 3.5, DT * 3.5); } this.sawA += DT * 55;
    this.flameOn = ((t + 1.5) % 6.5) < 1.9 && t > 3 ? 1 : 0;
    this.ahCd -= DT; if (this.ahSt === 0) { this.ahA += clamp(1.25 - this.ahA, -1, DT * 1.2); if (this.ahCd <= 0) for (let i = 0; i < 2; i++) { const s = this.bots[i].s; if (Math.hypot(s[0] - AHAM.hx, s[2] - AHAM.hz) < AHAM.r + .25 && s[1] < .6) { this.ahSt = 1; this.ahT = 0; } } }
    else if (this.ahSt === 1) { this.ahT += DT; if (this.ahT > .4) { this.ahA -= DT * 14; if (this.ahA <= -.16) { this.ahA = -.16; this.ahSt = 0; this.ahCd = 3.6; this.emit(EV.AHAM, AHAM.hx, .05, AHAM.hz, 0, 1, 0, 1);
          for (let i = 0; i < 2; i++) { const B = this.bots[i], s = B.s; if (Math.hypot(s[0] - AHAM.hx, s[2] - AHAM.hz) < AHAM.r + B.L.hx * .6 && s[1] < .7) { this.toLocal(B, AHAM.hx, s[1] + .2, AHAM.hz); this.damage(B, clamp(_c[4], -B.L.hx, B.L.hx), B.L.hy1 - B.ycm, clamp(_c[6], -B.L.hz, B.L.hz), 30, 1, -1); this.impulse(B, AHAM.hx, s[1], AHAM.hz, 0, -B.m * 2.5, 0); this.bots[1 - i].jd[2] += 6; this.emit(EV.HIT, AHAM.hx, s[1] + .1, AHAM.hz, 0, 1, 0, 60 + i * 1000); } } } } }
    for (let i = 0; i < 2; i++) { const B = this.bots[i], A = this.bots[1 - i]; if (B.isAI && !this.over) this.think(B, A); if (this.over) { B.thr = 0; B.steer = 0; B.fire = 0; } }
    for (let sub = 0; sub < SUB; sub++) { this.physics(b0); this.physics(b1); this.pair(b0, b1); this.pair(b1, b0); this.integrate(b0); this.integrate(b1); }
    this.weapon(b0, b1); this.weapon(b1, b0); this.hazards(b0, b1); this.hazards(b1, b0); this.debris();
    // contagem de nocaute, estatisticas dos juizes
    for (let i = 0; i < 2 && !this.over; i++) {
      const B = this.bots[i], A = this.bots[1 - i], s = B.s; B.pfire = B.fire;
      const noW = B.hp[1] <= 0 && B.hp[2] <= 0 && B.hp[3] <= 0 && B.hp[4] <= 0, moved = Math.hypot(s[0] - B.ax, s[2] - B.az) > .3;
      if (moved && !B.dead && !noW) { B.ax = s[0]; B.az = s[2]; B.at = 0; B.imm = 0; } else { B.at += DT; if (B.at > 1.5 || B.dead || noW) B.imm += DT; }
      if (s[1] < -.55 && !B.pitted) { B.pitted = 1; this.emit(EV.KO, s[0], s[1], s[2], 0, 1, 0, i); this.finish(1 - i, 'fosso'); }
      else if (B.imm >= KO_T) { this.emit(EV.KO, s[0], s[1], s[2], 0, 1, 0, i); this.finish(1 - i, 'nocaute'); }
      // agressividade: aproximando-se; controle: adversario perto de armadilha/parede e eu empurrando
      const dx = A.s[0] - s[0], dz = A.s[2] - s[2], d = Math.hypot(dx, dz) || 1, vr = (s[7] * dx + s[9] * dz) / d; if (vr > .6 && d < 6) B.jd[1] += DT * (.6 + vr * .15); if (d < 1.6 && vr > .3 && (Math.abs(A.s[0]) > AR - 1.5 || Math.abs(A.s[2]) > AR - 1.5)) B.jd[2] += DT * 1.5; if (A.R[4] < .2) B.jd[2] += DT * .8;
    }
    this.t += DT; this.frame++;
    if (!this.over && this.t >= this.dur) this.judge();
  }
  finish(w, how) { if (this.over) return; this.over = 1; this.winner = w; this.koBy = how; }
  judge() { // tres juizes: dano (5), agressividade (3), controle (3)
    const a = this.bots[0].jd, b = this.bots[1].jd, sc = this.scores; let va = 0, vb = 0; this.ptsA = 0; this.ptsB = 0;
    for (let j = 0; j < 3; j++) { let ta = 0, tb = 0;
      for (let c = 0; c < 3; c++) { const max = c === 0 ? 5 : 3, bias = 1 + (j - 1) * (c === 0 ? .1 : c === 1 ? -.12 : .08), xa = (a[c] - (c === 2 ? a[3] * 3 : 0)) * bias + .01, xb = (b[c] - (c === 2 ? b[3] * 3 : 0)) / bias + .01; let pa = Math.round(max * Math.max(xa, 0) / (Math.max(xa, 0) + Math.max(xb, 0) + 1e-6)); pa = clamp(pa, 0, max); sc[j * 6 + c] = pa; sc[j * 6 + 3 + c] = max - pa; ta += pa; tb += max - pa; }
      this.judgeTot[j * 2] = ta; this.judgeTot[j * 2 + 1] = tb; if (ta > tb) va++; else vb++; this.ptsA += ta; this.ptsB += tb; }
    this.over = 1; this.winner = va > vb ? 0 : 1; this.koBy = 'juizes';
  }

  physics(B) {
    const s = B.s, R = B.R, L = B.L, S = B.S, F = B.F, T = B.T, m = B.m; this.updR(B);
    F[0] = 0; F[1] = -GRAV * m; F[2] = 0; T[0] = 0; T[1] = 0; T[2] = 0;
    const up = R[4], sgnUp = up < 0 ? -1 : 1, batt = B.dead ? 0 : (B.hp[P_BAT] < B.hpMax[P_BAT] * .3 ? .6 : 1);
    let fwx = R[0], fwz = R[6], fl = Math.hypot(fwx, fwz); if (fl > 1e-4) { fwx /= fl; fwz /= fl; }
    const sdx = -fwz, sdz = fwx; // lateral no plano
    const axisY = Math.abs(R[5]), trac = clamp(1.25 - axisY * 2.2, 0, 1) * fl;
    const wd = S.giro * 3.7 * B.steer, kw = 420 * m, cw = 14 * m; let nAlive = 0; for (let q = 0; q < 4; q++) if (B.hp[P_W + q] > 0) nAlive++;
    let anyCon = 0;
    for (let q = 0; q < 4; q++) {
      B.wcon[q] = 0; B.wslip[q] = 0; if (B.hp[P_W + q] <= 0) continue;
      const lx = B.wl[q * 3], ly = B.wl[q * 3 + 1], lz = B.wl[q * 3 + 2], rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz, px = s[0] + rx, py = s[1] + ry, pz = s[2] + rz;
      const pen = this.env(px, py, pz, L.wr); const szn = lz > 0 ? 1 : -1, vt = (B.thr * S.vmax * batt - szn * sgnUp * wd * L.wz);
      if (pen <= 0) { B.wang[q] += vt / L.wr * HDT * sgnUp; continue; }
      const nx = _c[1], ny = _c[2], nz = _c[3], cx = px - nx * L.wr, cy = py - ny * L.wr, cz = pz - nz * L.wr;
      const vx = s[7] + s[11] * rz - s[12] * ry, vy = s[8] + s[12] * rx - s[10] * rz, vz = s[9] + s[10] * ry - s[11] * rx, vn = vx * nx + vy * ny + vz * nz;
      let fn = kw * pen - cw * vn; if (fn < 0) fn = 0; if (fn > m * 60) fn = m * 60;
      let fx = nx * fn, fy = ny * fn, fz = nz * fn;
      if (ny > .7) { anyCon = 1; B.wcon[q] = 1;
        const vl = vx * fwx + vz * fwz, vs = vx * sdx + vz * sdz, fmaxW = S.forca / 4 * batt * (nAlive < 4 ? 1.15 : 1);
        let flong = clamp((vt - vl) * m * 5, -fmaxW, fmaxW) * trac, flat = -vs * m * 9 * trac; const lim = S.mu * fn, mag = Math.hypot(flong, flat);
        if (mag > lim) { const k = lim / mag; flong *= k; flat *= k; B.wslip[q] = mag - lim; }
        B.wslip[q] = Math.max(B.wslip[q], Math.abs(vs) > 1.6 ? Math.abs(vs) * m : 0) / m;
        fx += fwx * flong + sdx * flat; fz += fwz * flong + sdz * flat; B.wang[q] += vl / L.wr * HDT * sgnUp;
      } else { const tvx = vx - nx * vn, tvy = vy - ny * vn, tvz = vz - nz * vn, tl = Math.hypot(tvx, tvy, tvz) + .05, k = Math.min(.6 * fn / tl, m * 6); fx -= tvx * k; fy -= tvy * k; fz -= tvz * k; }
      this.force(B, cx, cy, cz, fx, fy, fz);
    }
    B.grounded = anyCon;
    // casco contra piso e paredes
    const kh = 1300 * m, chh = 30 * m, hp = B.hpt; let land = 0, lx_ = 0, ly_ = 0, lz_ = 0, scr = 0, sx_ = 0, sz_ = 0, hcon = 0;
    for (let q = 0; q < B.nhp; q++) {
      const lx = hp[q * 3], ly = hp[q * 3 + 1], lz = hp[q * 3 + 2], rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz, px = s[0] + rx, py = s[1] + ry, pz = s[2] + rz;
      const pen = this.env(px, py, pz, 0); if (pen <= 0) continue; hcon++;
      const nx = _c[1], ny = _c[2], nz = _c[3], vx = s[7] + s[11] * rz - s[12] * ry, vy = s[8] + s[12] * rx - s[10] * rz, vz = s[9] + s[10] * ry - s[11] * rx, vn = vx * nx + vy * ny + vz * nz;
      let fn = kh * Math.min(pen, .08) - chh * vn; if (fn < 0) fn = 0; if (fn > m * 400) fn = m * 400;
      const tvx = vx - nx * vn, tvy = vy - ny * vn, tvz = vz - nz * vn, tl = Math.hypot(tvx, tvy, tvz), k = Math.min(.42 * fn / (tl + .08), m * 8);
      this.force(B, px, py, pz, nx * fn - tvx * k, ny * fn - tvy * k, nz * fn - tvz * k);
      if (-vn > land) { land = -vn; lx_ = lx; ly_ = ly; lz_ = lz; } if (tl > scr && ny > .5) { scr = tl; sx_ = px; sz_ = pz; }
    }
    B.hcon = hcon;
    if (land > 3.4 && B.hitcd <= 0) { B.hitcd = .15; this.damage(B, lx_, ly_, lz_, (land - 3.4) * 4.5, 0, B.lastHitBy > 0 ? 1 - B.id : -1); this.wpt(B, lx_, ly_, lz_); this.emit(EV.LAND, _c[0], Math.max(_c[1], .02), _c[2], 0, 1, 0, land); }
    if (scr > 1.6) { B.scrX = sx_; B.scrZ = sz_; B.scr = scr; } else B.scr = 0;
    // desvirar (X) e voltar ao canto (B)
    B.flipCd -= HDT; B.resetCd -= HDT; B.hitcd -= HDT; B.sawCd -= HDT;
    if (B.flipB && B.flipCd <= 0 && up < .35 && !B.dead && (hcon > 0 || anyCon)) { B.flipCd = 2.2; s[8] += 3.4; const k = 7.5; s[10] += R[0] * k; s[11] += R[3] * k; s[12] += R[6] * k; this.emit(EV.FLIP, s[0], s[1], s[2], 0, 1, 0, B.id); }
    if (B.resetB && B.resetCd <= 0 && !B.dead && !this.over) { B.resetCd = 8; B.jd[3] += 1; s[0] = START[B.id][0]; s[1] = L.clear + B.ycm + .05; s[2] = START[B.id][1]; s[3] = 0; s[4] = B.id ? 1 : 0; s[5] = 0; s[6] = B.id ? 0 : 1; for (let q = 7; q < 13; q++) s[q] = 0; B.grab = 0; this.bots[1 - B.id].grab = 0; this.updR(B); B.teleport = 1; this.emit(EV.RESET, s[0], s[1], s[2], 0, 1, 0, B.id); }
  }
  // pontos do casco de A dentro do casco de B
  pair(A, B) {
    const as = A.s, AR_ = A.R, hp = A.hpt, L = B.L, bs = B.s, BR = B.R, mm = (A.m + B.m) * .5, kc = 1000 * mm, cc = 22 * mm, y0 = -B.ycm, y1 = L.hy1 - B.ycm;
    if (Math.hypot(as[0] - bs[0], as[1] - bs[1], as[2] - bs[2]) > 2.2) return;
    for (let q = 0; q < A.nhp; q++) {
      const ax = hp[q * 3], ay = hp[q * 3 + 1], az = hp[q * 3 + 2], rx = AR_[0] * ax + AR_[1] * ay + AR_[2] * az, ry = AR_[3] * ax + AR_[4] * ay + AR_[5] * az, rz = AR_[6] * ax + AR_[7] * ay + AR_[8] * az, px = as[0] + rx, py = as[1] + ry, pz = as[2] + rz;
      const dx = px - bs[0], dy = py - bs[1], dz = pz - bs[2], lx = BR[0] * dx + BR[3] * dy + BR[6] * dz, ly = BR[1] * dx + BR[4] * dy + BR[7] * dz, lz = BR[2] * dx + BR[5] * dy + BR[8] * dz;
      let top = y1, snx = 0, sny = 1; if (B.wedge && lx > .02) { const f = (lx - .02) / (L.hx - .02); top = lerp(y1, .03 - B.ycm, clamp(f, 0, 1)); snx = .262; sny = .965; }
      if (lx < -L.hx || lx > L.hx || lz < -L.hz || lz > L.hz || ly < y0 || ly > top) continue;
      // face de menor penetracao
      let pen = top - ly, nx = snx, ny = sny, nz = 0; const wedgeFront = B.wedge && lx > .02 && pen < .1;
      if (!wedgeFront) { let p = L.hx - lx; if (p < pen) { pen = p; nx = 1; ny = 0; nz = 0; } p = lx + L.hx; if (p < pen) { pen = p; nx = -1; ny = 0; nz = 0; } p = L.hz - lz; if (p < pen) { pen = p; nx = 0; ny = 0; nz = 1; } p = lz + L.hz; if (p < pen) { pen = p; nx = 0; ny = 0; nz = -1; } p = ly - y0; if (p < pen) { pen = p; nx = 0; ny = -1; nz = 0; } }
      const wx = BR[0] * nx + BR[1] * ny + BR[2] * nz, wy = BR[3] * nx + BR[4] * ny + BR[5] * nz, wz = BR[6] * nx + BR[7] * ny + BR[8] * nz;
      const bx = px - bs[0], by = py - bs[1], bz = pz - bs[2];
      const vx = (as[7] + as[11] * rz - as[12] * ry) - (bs[7] + bs[11] * bz - bs[12] * by), vy = (as[8] + as[12] * rx - as[10] * rz) - (bs[8] + bs[12] * bx - bs[10] * bz), vz = (as[9] + as[10] * ry - as[11] * rx) - (bs[9] + bs[10] * by - bs[11] * bx), vn = vx * wx + vy * wy + vz * wz;
      let fn = kc * Math.min(pen, .06) - cc * vn; if (fn < 0) fn = 0; if (fn > mm * 300) fn = mm * 300;
      const tvx = vx - wx * vn, tvy = vy - wy * vn, tvz = vz - wz * vn, tl = Math.hypot(tvx, tvy, tvz), k = Math.min(.35 * fn / (tl + .1), mm * 5), fx = wx * fn - tvx * k, fy = wy * fn - tvy * k, fz = wz * fn - tvz * k;
      this.force(A, px, py, pz, fx, fy, fz); this.force(B, px, py, pz, -fx, -fy, -fz);
      if (-vn > 2.2 && A.hitcd <= 0 && B.hitcd <= 0) { // trombada
        A.hitcd = .2; B.hitcd = .2; const d = (-vn - 2.2) * 3.2 * (1 + (A.m - 80) / 200); this.toLocal(B, px, py, pz); const blx = _c[4], bly = _c[5], blz = _c[6]; this.damage(B, blx, bly, blz, d, 0, A.id); this.damage(A, ax, ay, az, d * .45, 0, B.id); B.lastHitBy = 2; this.emit(EV.HIT, px, py, pz, wx, wy, wz, d * 1.4 + B.id * 1000);
      } else if (tl > 2 && this.rng.u() < .04) this.emit(EV.GRIND, px, py, pz, wx, wy, wz, tl);
    }
  }
  integrate(B) {
    const s = B.s, R = B.R, F = B.F, T = B.T, im = 1 / B.m; s[7] += F[0] * im * HDT; s[8] += F[1] * im * HDT; s[9] += F[2] * im * HDT;
    const lx = (R[0] * T[0] + R[3] * T[1] + R[6] * T[2]) * B.Ii[0], ly = (R[1] * T[0] + R[4] * T[1] + R[7] * T[2]) * B.Ii[1], lz = (R[2] * T[0] + R[5] * T[1] + R[8] * T[2]) * B.Ii[2];
    s[10] += (R[0] * lx + R[1] * ly + R[2] * lz) * HDT; s[11] += (R[3] * lx + R[4] * ly + R[5] * lz) * HDT; s[12] += (R[6] * lx + R[7] * ly + R[8] * lz) * HDT;
    const ad = B.grounded ? .9985 : .9995; s[10] *= ad; s[11] *= ad; s[12] *= ad; const wl = Math.hypot(s[10], s[11], s[12]); if (wl > 28) { const k = 28 / wl; s[10] *= k; s[11] *= k; s[12] *= k; }
    const vl = Math.hypot(s[7], s[8], s[9]); if (vl > 16) { const k = 16 / vl; s[7] *= k; s[8] *= k; s[9] *= k; }
    s[0] += s[7] * HDT; s[1] += s[8] * HDT; s[2] += s[9] * HDT;
    const wx = s[10] * HDT * .5, wy = s[11] * HDT * .5, wz = s[12] * HDT * .5, x = s[3], y = s[4], z = s[5], w = s[6];
    s[3] = x + wx * w + wy * z - wz * y; s[4] = y + wy * w + wz * x - wx * z; s[5] = z + wz * w + wx * y - wy * x; s[6] = w - wx * x - wy * y - wz * z;
    const l = 1 / Math.hypot(s[3], s[4], s[5], s[6]); s[3] *= l; s[4] *= l; s[5] *= l; s[6] *= l;
    // trava de seguranca: nunca atravessa a caixa
    const lim = AR - .12; if (s[0] > lim) { s[0] = lim; if (s[7] > 0) s[7] *= -.3; } else if (s[0] < -lim) { s[0] = -lim; if (s[7] < 0) s[7] *= -.3; } if (s[2] > lim) { s[2] = lim; if (s[9] > 0) s[9] *= -.3; } else if (s[2] < -lim) { s[2] = -lim; if (s[9] < 0) s[9] *= -.3; }
    if (s[1] > WALL_H + .5) { s[1] = WALL_H + .5; if (s[8] > 0) s[8] = 0; } if (s[1] < -PIT.d + .05) { s[1] = -PIT.d + .05; s[8] = 0; }
    if (s[1] < -.25) { const q = PIT.h - .5; s[0] = clamp(s[0], PIT.x - q, PIT.x + q); s[2] = clamp(s[2], PIT.z - q, PIT.z + q); s[7] *= .9; s[9] *= .9; }
    this.updR(B);
  }
  weapon(A, B) {
    const k = ARMAS[A.b[3]], ty = A.b[3], L = A.L, s = A.s, R = A.R, r = this.rng; A.wcd -= DT; A.glow = Math.max(0, A.glow - DT * 1.2);
    if (A.hp[P_WP] <= 0) { A.wspin *= .97; A.wa += A.wspin * DT; A.wst = 0; A.grab = 0; return; }
    const press = A.fire && !A.pfire, alive = !A.dead;
    this.wpt(A, L.hitx, L.hity - A.ycm, 0); const hx = _c[0], hy = _c[1], hz = _c[2];
    if (k.spin) {
      if (press) A.won = A.won ? 0 : 1; if (!alive) A.won = 0;
      const batt = A.hp[P_BAT] < A.hpMax[P_BAT] * .3 ? .6 : 1;
      if (A.won) A.wspin = Math.min(k.wmax * batt, A.wspin + k.wmax / k.sup * DT); else A.wspin *= .985;
      A.wa += A.wspin * DT;
      if (A.wspin > 8 && A.hitcd <= 0 && !this.over) {
        const d = this.closest(B, hx, hy, hz), cx = _c[8], cy = _c[9], cz = _c[10], blx = _c[11], bly = _c[12], blz = _c[13];
        this.toLocal(A, cx, cy, cz); const vx = _c[4] - L.hitx, vy = _c[5] - (L.hity - A.ycm), vz = _c[6];
        let hit = false; if (ty === 0) hit = Math.hypot(vx, vz) < k.R && Math.abs(vy) < .05; else if (ty === 1) hit = Math.hypot(vx, vy) < k.R && Math.abs(vz) < .045; else hit = Math.hypot(vx, vy) < k.R && Math.abs(vz) < .19;
        // disco contra o piso/parede nao conta
        if (hit) {
          const fr = A.wspin / k.wmax;
          if (fr > .22) {
            // direcao tangencial na borda: eixo x r
            let tx, ty_, tz; if (ty === 0) { tx = vz; ty_ = 0; tz = -vx; } else { tx = -vy; ty_ = vx; tz = 0; } const tl = Math.hypot(tx, ty_, tz) || 1; tx /= tl; ty_ /= tl; tz /= tl;
            const wx = R[0] * tx + R[1] * ty_ + R[2] * tz, wy = R[3] * tx + R[4] * ty_ + R[5] * tz, wz = R[6] * tx + R[7] * ty_ + R[8] * tz;
            const Iw = ty === 2 ? .1 : .2, J = Math.min(Iw * A.wspin / k.R * r.r(.7, 1), 330) * (ty === 2 ? 1.3 : 1);
            this.impulse(B, cx, cy, cz, wx * J, wy * J + J * (ty === 0 ? .3 : .1), wz * J); this.impulse(A, cx, cy, cz, -wx * J * .8, -wy * J * .5, -wz * J * .8);
            if (ty === 0) { const kR = J / B.m * 2.0; B.s[10] += -wz * kR; B.s[12] += wx * kR; }
            const dmg = k.dano * (.35 + .65 * fr * fr) * r.r(.85, 1.15); this.damage(B, blx, bly, blz, dmg, 0, A.id); this.hurt(A, P_WP, dmg * .05, -1);
            A.wspin *= ty === 2 ? .45 : .28; A.hitcd = ty === 2 ? .1 : .16; B.lastHitBy = 2; A.ai.lastHit = A.ai.t; A.jd[1] += 2;
            this.emit(EV.HIT, cx, cy, cz, wx, wy + .3, wz, dmg + B.id * 1000);
          } else { A.hitcd = .1; this.emit(EV.GRIND, cx, cy, cz, 0, 1, 0, 2); A.wspin *= .9; }
        }
      }
      return;
    }
    if (ty === 3) { // lancador: wa = angulo do braco
      if (A.wst === 0) { A.wa = Math.max(0, A.wa - DT * 2.2); if (press && A.wcd <= 0 && alive && A.wa < .05) { A.wst = 1; A.wt = 0; A.wcd = k.cd;
          const d = this.closest(B, hx, hy + .1, hz); this.emit(EV.FLIP, hx, hy, hz, 0, 1, 0, A.id + 10);
          if (d < .26 && !this.over) { const cx = _c[8], cy = _c[9], cz = _c[10], blx = _c[11], bly = _c[12], blz = _c[13], J = B.m * 5.4 * (A.hp[P_BAT] < A.hpMax[P_BAT] * .3 ? .7 : 1); this.impulse(B, cx, cy, cz, R[1] * J * .9 + R[0] * J * .34, R[4] * J * .9 + R[3] * J * .34, R[7] * J * .9 + R[6] * J * .34); this.impulse(A, hx, hy, hz, 0, -J * .25, 0);
            this.damage(B, blx, bly, blz, k.dano, 2, A.id); B.lastHitBy = 2; A.ai.lastHit = A.ai.t; A.jd[1] += 2; A.jd[2] += 3; this.emit(EV.HIT, cx, cy, cz, 0, 1, 0, 18 + B.id * 1000); } } }
      else { A.wt += DT; A.wa = Math.min(1.15, A.wa + DT * 11); if (A.wt > .45) A.wst = 0; }
      return;
    }
    if (ty === 4) { // martelo: wa = angulo (1.95 repouso -> -.42 golpe)
      if (A.wst === 0) { A.wa = Math.min(1.95, A.wa + DT * 3.4); if (press && A.wcd <= 0 && alive && A.wa > 1.9) { A.wst = 1; A.wcd = k.cd; } }
      else { A.wa -= DT * 15; const end = -Math.asin(clamp((L.py + L.clear - .05) / .6, 0, .9));
        // bate no adversario?
        this.wpt(A, L.px + Math.cos(A.wa) * .6, L.py - A.ycm + Math.sin(A.wa) * .6 - .08, 0); const mx = _c[0], my = _c[1], mz = _c[2], d = this.closest(B, mx, my, mz);
        if (d < .07 && A.wa < 1.2 && !this.over) { const cx = _c[8], cy = _c[9], cz = _c[10], blx = _c[11], bly = _c[12], blz = _c[13]; A.wst = 0; const dmg = k.dano * r.r(.9, 1.15); this.damage(B, blx, bly, blz, dmg, 1, A.id); this.impulse(B, cx, cy, cz, R[0] * 40, -150, R[6] * 40); B.lastHitBy = 2; A.ai.lastHit = A.ai.t; A.jd[1] += 2; this.emit(EV.HIT, cx, cy, cz, 0, 1, 0, dmg + B.id * 1000); }
        else if (A.wa <= end) { A.wa = end; A.wst = 0; this.emit(EV.HAMMER, mx, .02, mz, 0, 1, 0, 6); } }
      return;
    }
    // garra: wa = abertura (0.75 aberta -> 0 fechada)
    if (A.wst === 0) { A.wa = Math.min(.75, A.wa + DT * 2.5); if (press && A.wcd <= 0 && alive && A.wa > .7) A.wst = 1; }
    else if (A.wst === 1) { A.wa = Math.max(0, A.wa - DT * 3.2); const d = this.closest(B, hx, hy, hz);
      if (d < .1 && A.wa < .5 && !this.over) { A.wst = 2; A.wt = 0; A.grab = 1; A.gx = _c[11]; A.gy = _c[12]; A.gz = _c[13]; A.jd[1] += 2; this.emit(EV.GRAB, _c[8], _c[9], _c[10], 0, 1, 0, 10 + B.id * 1000); }
      else if (A.wa <= 0) { A.wst = 0; A.wcd = k.cd * .6; } }
    else { A.wt += DT; // prendendo: mola entre a garra e o ponto agarrado + dano continuo
      this.wpt(B, A.gx, A.gy, A.gz); const gx = _c[0], gy = _c[1], gz = _c[2], ex = hx - gx, ey = hy - gy, ez = hz - gz, el = Math.hypot(ex, ey, ez);
      const kk = Math.min(A.m, B.m) * 9; this.impulse(B, gx, gy, gz, ex * kk, ey * kk * .4, ez * kk); this.impulse(A, hx, hy, hz, -ex * kk, -ey * kk * .4, -ez * kk);
      const rvx = B.s[7] - s[7], rvz = B.s[9] - s[9], km = Math.min(A.m, B.m) * .12; this.impulse(B, gx, gy, gz, -rvx * km, 0, -rvz * km); this.impulse(A, hx, hy, hz, rvx * km, 0, rvz * km);
      this.damage(B, A.gx, A.gy, A.gz, k.dano * DT, 1, A.id); A.jd[2] += DT * 2; if (this.rng.u() < .25) this.emit(EV.GRIND, gx, gy, gz, 0, 1, 0, 3);
      if (A.wt > 2.6 || el > .45 || press || !alive || this.over) { A.wst = 0; A.grab = 0; A.wcd = k.cd; } }
  }
  hazards(B, A) {
    const s = B.s, L = B.L;
    for (let i = 0; i < 2; i++) { if (this.sawH[i] < .6 || B.sawCd > 0) continue; const sw = SAWS[i], d = this.closest(B, sw.x, this.sawH[i] * .2 - .08, sw.z); if (d < SAW_R * .75) { B.sawCd = .3; const cx = _c[8], cy = _c[9], cz = _c[10]; this.damage(B, _c[11], _c[12], _c[13], 11, 2, -1); this.impulse(B, cx, cy, cz, B.m * 1.6, B.m * 2.6, 0); A.jd[2] += 4; B.lastHitBy = 2; this.emit(EV.SAW, cx, .05, cz, 1, 1.2, 0, 14 + B.id * 1000); } }
    if (this.flameOn) { const d = Math.hypot(s[0] - FLAME.x, s[2] - FLAME.z); if (d < FLAME.r + .2 && s[1] < 1.2) { B.burn = Math.min(1, B.burn + DT * .5); this.hurt(B, P_BAT, 7 * DT, -1); this.hurt(B, B.hp[P_AT] > 0 ? P_AT : P_CH, 3 * DT, -1); A.jd[2] += DT * 3; } }
    if (B.fireOn && !B.dead) this.hurt(B, P_BAT, .8 * DT, -1);
    // marcas e riscos
    for (let q = 0; q < 4; q++) if (B.wcon[q] && B.wslip[q] > 1.2) { this.wpt(B, B.wl[q * 3], B.wl[q * 3 + 1], B.wl[q * 3 + 2]); this.emit(EV.SKID, _c[0], 0, _c[2], s[7], 0, s[9], RODAS[B.b[1]].w + B.id * 1000 + q * 10); }
    if (B.scr > 0) this.emit(EV.SCRAPE, B.scrX, .01, B.scrZ, s[7], 0, s[9], B.scr);
    if (B.lastHitBy > 0) B.lastHitBy -= DT;
  }
  debris() {
    const d = this.deb;
    for (let i = 0; i < DEB_N; i++) {
      if (this.debMesh[i] < 0) continue; const o = i * DEB_F; d[o + 19] += DT;
      // posicao do centro da peca (pivo local girado)
      const x = d[o + 3], y = d[o + 4], z = d[o + 5], w = d[o + 6], lx = d[o + 13], ly = d[o + 14], lz = d[o + 15];
      const R0 = 1 - 2 * (y * y + z * z), R1 = 2 * (x * y - w * z), R2 = 2 * (x * z + w * y), R3 = 2 * (x * y + w * z), R4 = 1 - 2 * (x * x + z * z), R5 = 2 * (y * z - w * x), R6 = 2 * (x * z - w * y), R7 = 2 * (y * z + w * x), R8 = 1 - 2 * (x * x + y * y);
      let cx = d[o] + R0 * lx + R1 * ly + R2 * lz, cy = d[o + 1] + R3 * lx + R4 * ly + R5 * lz, cz = d[o + 2] + R6 * lx + R7 * ly + R8 * lz;
      d[o + 8] -= GRAV * DT; let nx = cx + d[o + 7] * DT, ny = cy + d[o + 8] * DT, nz = cz + d[o + 9] * DT;
      const inPit = Math.abs(nx - PIT.x) < PIT.h && Math.abs(nz - PIT.z) < PIT.h, gy = (inPit ? this.pitY : 0) + .03; let rest = false;
      if (ny < gy) { ny = gy; if (d[o + 8] < -1.2) { d[o + 8] *= -.32; d[o + 10] += this.rng.s1() * 3; d[o + 12] += this.rng.s1() * 3; } else { d[o + 8] = 0; rest = true; } d[o + 7] *= .93; d[o + 9] *= .93;
        // deita: alinha o eixo fino com a vertical
        const f = d[o + 16], ax = f === 0 ? R3 : f === 1 ? R4 : R5; // componente y do eixo local f
        const ex = f === 0 ? R0 : f === 1 ? R1 : R2, ez = f === 0 ? R6 : f === 1 ? R7 : R8, sg = ax < 0 ? -1 : 1; // eixo no mundo = (ex, ax, ez); torque = eixo x (0,sg,0)
        const tx = -ez * sg, tz = ex * sg, kk = 14; d[o + 10] = d[o + 10] * .85 + tx * kk * (1 - Math.abs(ax)) ; d[o + 12] = d[o + 12] * .85 + tz * kk * (1 - Math.abs(ax)); d[o + 11] *= .9; if (Math.abs(ax) > .995 && rest) { d[o + 10] = 0; d[o + 12] = 0; d[o + 11] *= .8; } }
      if (!inPit || ny > 0) { if (Math.abs(nx) > AR - .15) { nx = Math.sign(nx) * (AR - .15); d[o + 7] *= -.4; } if (Math.abs(nz) > AR - .15) { nz = Math.sign(nz) * (AR - .15); d[o + 9] *= -.4; } } else { nx = clamp(nx, PIT.x - PIT.h + .15, PIT.x + PIT.h - .15); nz = clamp(nz, PIT.z - PIT.h + .15, PIT.z + PIT.h - .15); }
      // robos chutam os destrocos
      for (let b = 0; b < 2; b++) { const B = this.bots[b]; if (d[o + 19] < .4 && d[o + 17] === b) continue; this.toLocal(B, nx, ny, nz); const L = B.L, mgn = .12; if (Math.abs(_c[4]) < L.hx + mgn && Math.abs(_c[6]) < L.hz + mgn && _c[5] > -B.ycm - .1 && _c[5] < L.hy1 - B.ycm + .1) { const ox = nx - B.s[0], oz = nz - B.s[2], ol = Math.hypot(ox, oz) || 1; d[o + 7] = B.s[7] * 1.1 + ox / ol * 1.8; d[o + 9] = B.s[9] * 1.1 + oz / ol * 1.8; d[o + 8] = Math.max(d[o + 8], .8); nx += ox / ol * .03; nz += oz / ol * .03; } }
      // integra rotacao
      const hx = d[o + 10] * DT * .5, hy = d[o + 11] * DT * .5, hz = d[o + 12] * DT * .5; let qx = x + hx * w + hy * z - hz * y, qy = y + hy * w + hz * x - hx * z, qz = z + hz * w + hx * y - hy * x, qw = w - hx * x - hy * y - hz * z; const l = 1 / Math.hypot(qx, qy, qz, qw); qx *= l; qy *= l; qz *= l; qw *= l;
      d[o + 3] = qx; d[o + 4] = qy; d[o + 5] = qz; d[o + 6] = qw;
      const S0 = 1 - 2 * (qy * qy + qz * qz), S1 = 2 * (qx * qy - qw * qz), S2 = 2 * (qx * qz + qw * qy), S3 = 2 * (qx * qy + qw * qz), S4 = 1 - 2 * (qx * qx + qz * qz), S5 = 2 * (qy * qz - qw * qx), S6 = 2 * (qx * qz - qw * qy), S7 = 2 * (qy * qz + qw * qx), S8 = 1 - 2 * (qx * qx + qy * qy);
      d[o] = nx - (S0 * lx + S1 * ly + S2 * lz); d[o + 1] = ny - (S3 * lx + S4 * ly + S5 * lz); d[o + 2] = nz - (S6 * lx + S7 * ly + S8 * lz);
    }
  }
  // soma de verificacao do estado (determinismo)
  hash() { let h = 0; for (let i = 0; i < 2; i++) { const s = this.bots[i].s; for (let q = 0; q < 13; q++) h = (Math.imul(h, 31) + Math.round(s[q] * 1e4)) | 0; for (let q = 0; q < NPART; q++) h = (Math.imul(h, 31) + Math.round(this.bots[i].hp[q] * 100)) | 0; } return h; }
}
