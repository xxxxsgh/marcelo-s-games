// ---------- arena, galpao e garagem (malhas estaticas procedurais) ----------
const AR = 7, WALL_H = 3.3;
const PIT = { x: -4.3, z: 4.3, h: 1.1, d: 1.3 };
const SAWS = [{ x: 3.7, z: -4.3 }, { x: 4.9, z: -4.3 }], SAW_R = .3;
const AHAM = { x: 6.25, z: 6.25, y: .55, len: 1.7, hx: 5.05, hz: 5.05, r: .75 };
const FLAME = { x: -4.3, z: -4.3, r: 1.15, n: [[-4.9, -4.3], [-4.3, -4.3], [-3.7, -4.3]] };
const START = [[-5, 0], [5, 0]];
// refletores: p posicao, t alvo, c cor, I intensidade, a meio-angulo (graus), s sombra
const ARENA_LIGHTS = [
  { p: [5.6, 7.0, 5.6], t: [-.8, 0, -.8], c: [1, .93, .82], I: 720, a: 43, s: 1 },
  { p: [-5.6, 7.0, -5.6], t: [.8, 0, .8], c: [.82, .9, 1], I: 720, a: 43, s: 1 },
  { p: [5.6, 7.0, -5.6], t: [-.8, 0, .8], c: [1, .96, .9], I: 640, a: 43, s: 1 },
  { p: [-5.6, 7.0, 5.6], t: [.8, 0, -.8], c: [.9, .95, 1], I: 640, a: 43, s: 1 },
  { p: [-7.6, 6.2, 0], t: [-4.2, 0, 0], c: [1, .12, .06], I: 420, a: 26, s: 0 },
  { p: [7.6, 6.2, 0], t: [4.2, 0, 0], c: [.08, .25, 1], I: 420, a: 26, s: 0 },
  { p: [0, 7.3, 9.5], t: [0, 2, 15], c: [1, .8, .6], I: 16, a: 48, s: 0, vol: 0 },
  { p: [0, 7.3, -9.5], t: [0, 2, -15], c: [1, .8, .6], I: 16, a: 48, s: 0, vol: 0 },
  { p: [9.5, 7.3, 0], t: [15, 2, 0], c: [.7, .8, 1], I: 15, a: 48, s: 0, vol: 0 },
  { p: [0, 7.4, .01], t: [0, 0, 0], c: [.9, .95, 1], I: 380, a: 62, s: 0, vol: 0 },
];
const GAR_LIGHTS = [
  { p: [1.5, 3.1, 1.9], t: [0, .7, 0], c: [1, .9, .74], I: 150, a: 38, s: 1 },
  { p: [-1.9, 3.1, 1.0], t: [0, .7, 0], c: [.78, .88, 1], I: 95, a: 38, s: 1 },
  { p: [0.2, 3.1, -1.9], t: [0, .7, 0], c: [1, .96, .9], I: 120, a: 40, s: 1 },
  { p: [-2.6, 2.6, -2.2], t: [-2.6, 1, -3.2], c: [1, .85, .6], I: 16, a: 60, s: 1 },
  { p: [2.6, 2.6, -2.2], t: [2.4, 1, -3.2], c: [1, .85, .6], I: 14, a: 60, s: 0 },
];
const BENCH_Y = .62;

function buildWorldMeshes(mb) {
  const rng = new Rng(4242);
  const tube = (a, b, r, sides) => mb.path([a, b], r, sides || 6);
  // trelica quadrada entre dois pontos (eixo alinhado em x, y ou z)
  const truss = (a, b, s) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]), ax = Math.abs(d[0]) > .5 * L ? 0 : Math.abs(d[1]) > .5 * L ? 1 : 2, u = (ax + 1) % 3, v = (ax + 2) % 3, n = Math.max(1, Math.round(L / (s * 1.6)));
    mb.set(MAT.TRUSS, .78, .78, .8, .3);
    const P = (t, su, sv) => { const p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; p[u] += su * s / 2; p[v] += sv * s / 2; return p; };
    for (const su of [-1, 1]) for (const sv of [-1, 1]) tube(P(0, su, sv), P(1, su, sv), .028, 6);
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, f = i & 1 ? -1 : 1; tube(P(t0, -1, f), P(t1, -1, -f), .013, 4); tube(P(t0, 1, -f), P(t1, 1, f), .013, 4); tube(P(t0, f, -1), P(t1, -f, -1), .013, 4); tube(P(t0, -f, 1), P(t1, f, 1), .013, 4); }
    for (let i = 0; i <= n; i += 2) { const t = i / n; tube(P(t, -1, -1), P(t, 1, -1), .012, 4); tube(P(t, -1, 1), P(t, 1, 1), .012, 4); tube(P(t, -1, -1), P(t, -1, 1), .012, 4); tube(P(t, 1, -1), P(t, 1, 1), .012, 4); }
  };
  const fixture = (L, big) => { // corpo do refletor apontando para o alvo
    const d = [L.t[0] - L.p[0], L.t[1] - L.p[1], L.t[2] - L.p[2]], l = Math.hypot(d[0], d[1], d[2]), yaw = Math.atan2(-d[2], d[0]), pit = Math.asin(d[1] / l), s = big ? 1 : .7;
    mb.push().tr(L.p[0], L.p[1], L.p[2]).ry(yaw).rz(pit);
    mb.set(MAT.DARK, .05, .05, .055, .4); mb.cy(-.2 * s, 0, 0, .15 * s, .38 * s, 14, 0); mb.cy(-.02 * s, 0, 0, .17 * s, .06 * s, 14, 0);
    for (let i = 0; i < 4; i++) { mb.push().rx(i * PI / 2 + PI / 4).tr(.06 * s, .2 * s, 0).rz(-.5).box(.16 * s, .006, .2 * s, 0); mb.pop(); }
    mb.set(MAT.EMIS, L.c[0], L.c[1], L.c[2], big ? 60 : 40); mb.cy(.012 * s, 0, 0, .13 * s, .004, 16, 0, { bev: 0 });
    mb.pop();
    mb.set(MAT.DARK, .06, .06, .065, .4); tube([L.p[0], L.p[1] + .16 * s, L.p[2]], [L.p[0], L.p[1] + .4, L.p[2]], .02, 6);
  };
  const person = (x, y, z, face, seated, raise, shirt, hi) => {
    const sk = [[.6, .44, .34], [.42, .29, .21], [.7, .56, .45], [.28, .19, .14]][Math.floor(rng.u() * 4)], pal = [[.2, .05, .05], [.05, .08, .2], [.28, .28, .27], [.04, .04, .05], [.3, .2, .06], [.07, .14, .08], [.14, .05, .16], [.1, .1, .12], [.2, .2, .22], [.04, .05, .09]], sh = shirt || pal[Math.floor(rng.u() * pal.length)], sc = rng.r(.9, 1.1), sg = hi ? 12 : 7, lean = rng.s1() * .18, tw = rng.s1() * .3;
    mb.push().tr(x, y, z).ry(face + tw).sc(sc);
    const hip = seated ? .0 : .82;
    mb.set(MAT.CLOTH, .05 + rng.u() * .07, .05 + rng.u() * .06, .07 + rng.u() * .08, 0);
    if (seated) { for (const s of [-1, 1]) { mb.cy(.2, .07, s * .09, .075, .42, 6, 0, { bev: .02 }); mb.cy(.41, -.14, s * .09, .06, .42, 6, 1, { bev: .02 }); } }
    else for (const s of [-1, 1]) mb.cy(0, .41, s * .09, .075, .82, 6, 1, { bev: .02 });
    mb.push().tr(0, hip, 0).rz(-lean);
    mb.set(MAT.CLOTH, sh[0], sh[1], sh[2], 0); mb.push().tr(0, .3, 0).sc(.62, 1, 1).cyl(.2, .56, sg, { r2: .17, bev: .06 }); mb.pop();
    const up = raise ? 2.5 + rng.u() * .6 : (seated ? .35 + rng.u() * .5 : .1 + rng.u() * .2);
    for (const s of [-1, 1]) { mb.push().tr(0, .53, s * .22).rx(s * -.12).rz(up * (raise && s > 0 && rng.u() < .4 ? .3 : 1)).tr(0, -.26, 0).cyl(.05, .54, 6, { bev: .02 }); mb.set(MAT.SKIN, sk[0], sk[1], sk[2], 0); mb.tr(0, -.3, 0).sphere(.05, 6, 4); mb.set(MAT.CLOTH, sh[0], sh[1], sh[2], 0); mb.pop(); }
    mb.set(MAT.SKIN, sk[0], sk[1], sk[2], 0); mb.cy(0, .6, 0, .045, .1, 6, 1, { bev: 0 }); mb.push().tr(.01, .74, 0).rz(rng.s1() * .2).sphere(.1, sg, hi ? 8 : 5, 1.18); mb.pop();
    const hc = rng.u() * .18; mb.set(MAT.CLOTH, hc, hc * .8, hc * .6, 0); mb.push().tr(-.014, .775, 0).sphere(.104, sg, hi ? 6 : 4, .9); mb.pop();
    mb.pop(); mb.pop();
  };
  const banner = (cx, cy, cz, w, h, yaw, region) => { mb.push().tr(cx, cy, cz).ry(yaw); mb.mat = MAT.BANNER; const q = []; for (const [u, v] of [[0, 1], [1, 1], [1, 0], [0, 0]]) { mb.col = [u, v, 0]; q.push(mb.v((u - .5) * w, (.5 - v) * h, 0, 0, 0, 1, region)); } mb.quad(q[0], q[1], q[2], q[3]); mb.pop(); };
  const screen = (cx, cy, cz, w, h, yaw, region) => { mb.push().tr(cx, cy, cz).ry(yaw); mb.set(MAT.DARK, .03, .03, .035, .3); mb.bx(0, 0, -.08, w + .2, h + .2, .14, .02); mb.mat = MAT.SCREEN; const q = []; for (const [u, v] of [[0, 1], [1, 1], [1, 0], [0, 0]]) { mb.col = [u, v, 0]; q.push(mb.v((u - .5) * w, (.5 - v) * h, 0, 0, 0, 1, region)); } mb.quad(q[0], q[1], q[2], q[3]); mb.pop(); };
  const tvcam = (x, z, yaw, h) => {
    mb.push().tr(x, 0, z).ry(yaw);
    mb.set(MAT.DARK, .07, .07, .08, .3); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; tube([Math.cos(a) * .5, 0, Math.sin(a) * .5], [0, h - .15, 0], .02, 6); }
    mb.cy(0, h - .08, 0, .05, .16, 10, 1); mb.bx(.05, h + .12, 0, .46, .22, .2, .02); mb.bx(-.22, h + .2, .0, .12, .12, .16, .01);
    mb.cy(.36, h + .12, 0, .075, .2, 14, 0); mb.set(MAT.LENS, .02, .03, .05, 0); mb.cy(.465, h + .12, 0, .06, .008, 14, 0, { bev: 0 });
    mb.set(MAT.EMIS, 1, .05, .02, 6); mb.bx(.26, h + .24, .06, .02, .015, .02, 0);
    mb.pop();
    person(x - Math.cos(yaw) * .45, 0, z + Math.sin(yaw) * .45, yaw, false, false, [.06, .06, .07], true);
  };

  // ===================== ARENA =====================
  // piso da caixa com buraco do fosso
  mb.set(MAT.FLOOR, .5, .5, .5, 0);
  { const xs = [-AR, PIT.x - PIT.h, PIT.x + PIT.h, AR], zs = [-AR, PIT.z - PIT.h, PIT.z + PIT.h, AR];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { if (i === 0 && j === 2 ? false : (i === 1 && j === 1 && false)) continue; if (xs[i] === PIT.x - PIT.h && zs[j] === PIT.z - PIT.h) continue; const a = mb.v(xs[i], 0, zs[j], 0, 1, 0), b = mb.v(xs[i + 1], 0, zs[j], 0, 1, 0), c = mb.v(xs[i + 1], 0, zs[j + 1], 0, 1, 0), d = mb.v(xs[i], 0, zs[j + 1], 0, 1, 0); mb.quad(a, b, c, d); } }
  // fosso
  mb.set(MAT.STEEL, .3, .3, .31, .5);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) mb.bx(PIT.x + dx * (PIT.h + .02), -PIT.d / 2, PIT.z + dz * (PIT.h + .02), dx ? .04 : PIT.h * 2 + .08, PIT.d, dz ? .04 : PIT.h * 2 + .08, 0);
  mb.set(MAT.DARK, .03, .03, .03, .2); mb.bx(PIT.x, -PIT.d - .02, PIT.z, PIT.h * 2, .04, PIT.h * 2, 0);
  mb.set(MAT.STEEL, .4, .4, .42, .5); for (let i = 0; i < 6; i++) mb.cy(PIT.x - PIT.h + .2 + i * .36, -PIT.d + .05, PIT.z, .06, PIT.h * 1.9, 8, 2);
  mb.set(MAT.EMIS, 1, .25, .02, 2.5); for (const s of [-1, 1]) { mb.bx(PIT.x, -.25, PIT.z + s * (PIT.h - .005), PIT.h * 1.8, .03, .01, 0); mb.bx(PIT.x + s * (PIT.h - .005), -.25, PIT.z, .01, .03, PIT.h * 1.8, 0); }
  // rodape de aco, postes e travessas
  for (let k = 0; k < 4; k++) {
    mb.push().ry(k * PI / 2);
    mb.set(MAT.STEEL, .42, .42, .44, .3); mb.bx(0, .21, AR + .04, AR * 2 + .16, .42, .08, .01, [28, 2, 1]);
    mb.set(MAT.HAZ, 1, .8, 0, 0); mb.bx(0, .445, AR + .04, AR * 2 + .16, .05, .1, .005);
    for (let i = 0; i <= 28; i++) mb.bolt(lerp(-AR + .2, AR - .2, i / 28), .32, AR, .016, 2, -1);
    mb.set(MAT.PAINT2, .09, .09, .1, .5);
    for (let i = 0; i <= 4; i++) { const x = -AR + i * 3.5; mb.bx(x === -AR ? x - .07 : x, WALL_H / 2 + .1, AR + .16, .16, WALL_H + .2, .16, .012); mb.set(MAT.STEEL, .4, .4, .42, .4); mb.bx(x === -AR ? x - .07 : x, .03, AR + .2, .34, .06, .34, .01); mb.set(MAT.PAINT2, .09, .09, .1, .5); }
    mb.bx(0, WALL_H + .14, AR + .16, AR * 2 + .3, .14, .14, .012); mb.bx(0, 1.75, AR + .12, AR * 2, .05, .05, .006);
    // contraventamento em X no topo
    for (let i = 0; i < 4; i++) { const x0 = -AR + i * 3.5; mb.set(MAT.STEEL, .3, .3, .32, .3); tube([x0 + .1, WALL_H + .2, AR + .16], [x0 + 3.4, WALL_H + .75, AR + .16], .018, 5); tube([x0 + .1, WALL_H + .75, AR + .16], [x0 + 3.4, WALL_H + .2, AR + .16], .018, 5); }
    mb.set(MAT.PAINT2, .09, .09, .1, .5); mb.bx(0, WALL_H + .8, AR + .16, AR * 2 + .3, .1, .1, .01);
    mb.pop();
  }
  // vigas do teto da caixa
  mb.set(MAT.PAINT2, .09, .09, .1, .5); for (const q of [-3.5, 0, 3.5]) { mb.bx(q, WALL_H + .8, 0, .08, .08, AR * 2 + .3, .008); mb.bx(0, WALL_H + .8, q, AR * 2 + .3, .08, .08, .008); }
  // armadilhas: fendas das serras, bicos de fogo, base do martelo
  mb.set(MAT.DARK, .02, .02, .02, .2); for (const s of SAWS) mb.bx(s.x, -.1, s.z, SAW_R * 2 + .12, .2, .05, 0);
  mb.set(MAT.STEEL, .45, .45, .47, .5); for (const s of SAWS) for (const d of [-1, 1]) { mb.bx(s.x, .004, s.z + d * .05, SAW_R * 2 + .16, .008, .05, .002); }
  for (const n of FLAME.n) { mb.set(MAT.STEEL, .35, .33, .3, .6); mb.cy(n[0], .012, n[1], .11, .024, 16, 1); mb.set(MAT.DARK, .02, .02, .02, .2); mb.cy(n[0], .022, n[1], .06, .01, 12, 1, { bev: 0 }); for (let i = 0; i < 6; i++) mb.bolt(n[0] + Math.cos(i / 6 * TAU) * .09, .024, n[1] + Math.sin(i / 6 * TAU) * .09, .01, 1, 1); }
  mb.push().tr(AHAM.x, 0, AHAM.z).ry(-PI * .75 + PI); mb.set(MAT.HAZ, 1, .8, 0, 0); mb.bx(0, .32, 0, .7, .64, .7, .02); mb.set(MAT.STEEL, .4, .4, .42, .5); for (const s of [-1, 1]) mb.bx(0, .62, s * .2, .3, .5, .05, .01); mb.set(MAT.DARK, .06, .06, .07, .5); mb.cy(0, AHAM.y + .1, 0, .07, .52, 12, 2); mb.pop();
  // sinalizadores das armadilhas e dos cantos
  mb.set(MAT.DARK, .05, .05, .06, .4); mb.bx(-AR + .06, .6, 0, .1, .2, 1.9, .01); mb.bx(AR - .06, .6, 0, .1, .2, 1.9, .01); mb.set(MAT.EMIS, 1, .2, .05, 2.5); mb.bx(-AR + .115, .6, 0, .01, .06, 1.7, 0); mb.set(MAT.EMIS, .08, .3, 1, 2.5); mb.bx(AR - .115, .6, 0, .01, .06, 1.7, 0);

  // grade de trelica dos refletores + torres
  const RG = 8.6, RY = 7.6;
  for (const s of [-1, 1]) { truss([-RG, RY, s * RG], [RG, RY, s * RG], .4); truss([s * RG, RY, -RG], [s * RG, RY, RG], .4); truss([s * RG, 0, s * RG], [s * RG, RY, s * RG], .4); truss([s * RG, 0, -s * RG], [s * RG, RY, -s * RG], .4); }
  truss([-RG, RY, 0], [RG, RY, 0], .4); truss([0, RY, -RG], [0, RY, RG], .4);
  truss([-RG, RY, 5.6], [RG, RY, 5.6], .3); truss([-RG, RY, -5.6], [RG, RY, -5.6], .3);
  for (const s of [-1, 1]) for (const t of [-1, 1]) { mb.set(MAT.STEEL, .3, .3, .32, .4); mb.bx(s * RG, .03, t * RG, .9, .06, .9, .01); }
  ARENA_LIGHTS.forEach((L, i) => { fixture(L, i < 4); mb.set(MAT.DARK, .06, .06, .065, .4); tube([L.p[0], L.p[1] + .4, L.p[2]], [L.p[0], RY - .2, L.p[2]], .02, 5); });
  // refletores extras apagados/fracos na grade (densidade)
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + .3, L = { p: [Math.cos(a) * 7.9, 7.1, Math.sin(a) * 7.9], t: [Math.cos(a) * 2, 0, Math.sin(a) * 2], c: [.9, .85, .8] }; if (Math.abs(L.p[0]) > 8.5 || Math.abs(L.p[2]) > 8.5) continue; const d = ARENA_LIGHTS.some(q => Math.hypot(q.p[0] - L.p[0], q.p[2] - L.p[2]) < 1.2); if (d) continue; L.p[0] = clamp(L.p[0], -8.4, 8.4); mb.push(); fixture(L, false); mb.pop(); }
  // cabos pendurados na grade
  mb.set(MAT.WIRE, .03, .03, .03, 0);
  for (let i = 0; i < 8; i++) { const a = rng.r(-8, 8), s = i & 1 ? 1 : -1; mb.cable([[a, RY - .25, s * RG], [a + 1, RY - .7, s * RG + .1], [a + 2.2, RY - .3, s * RG]], .02, 5, 6); }
  mb.cable([[RG, RY - .2, RG], [RG + .3, 4, RG + .2], [RG + .25, .6, RG + .3], [RG + 1.5, .03, RG + 1]], .03, 6, 8);

  // arquibancadas com plateia (norte, sul, leste)
  const stand = (yaw, wid, d0) => {
    mb.push().ry(yaw);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const z = d0 + r * .85, y = .5 + r * .46;
      mb.set(MAT.CONC, .1, .1, .11, .5); mb.bx(0, y / 2, z + .42, wid, y, .85, 0);
      mb.set(MAT.SEAT, .1 + (r % 2) * .03, .1, .12, 0); mb.bx(0, y + .2, z + .55, wid - .4, .06, .4, .02);
      const n = Math.floor(wid / .6);
      for (let i = 0; i < n; i++) { if (rng.u() < .13) continue; const x = -wid / 2 + .5 + i * .6 + rng.s1() * .12, st = rng.u() < .12; person(x, y + (st ? -.18 : .23), z + .5 + rng.s1() * .08, PI / 2 + rng.s1() * .3, !st, rng.u() < .2); }
    }
    mb.set(MAT.DARK, .08, .08, .09, .4); for (let i = 0; i <= wid / 2; i++) { const x = -wid / 2 + i * 2; tube([x, .5, d0 - .05], [x, 1.5, d0 - .05], .025, 6); } tube([-wid / 2, 1.5, d0 - .05], [wid / 2, 1.5, d0 - .05], .03, 6); tube([-wid / 2, 1.05, d0 - .05], [wid / 2, 1.05, d0 - .05], .02, 6);
    mb.set(MAT.CONC, .08, .08, .09, .5); mb.bx(0, .25, d0 - .1, wid, .5, .2, 0);
    for (let i = 0; i < Math.floor(wid / 6); i++) banner(-wid / 2 + 3 + i * 6, .98, d0 - .09, 5.6, .7, PI, 2 + (i & 1));
    mb.pop();
  };
  stand(0, 26, 11); stand(PI, 26, 11); stand(PI / 2, 22, 11.2);
  // placar
  screen(11.4, 7.9, 0, 7.2, 3.6, -PI / 2, 0); mb.set(MAT.DARK, .06, .06, .065, .4); for (const s of [-1, 1]) tube([11.5, 9.7, s * 3], [11.5, 14, s * 3], .03, 5);
  screen(0, 7.2, -10.6, 6, 1.5, 0, 1); screen(0, 7.2, 10.6, 6, 1.5, PI, 1);
  for (const s of [-1, 1]) for (const q of [-2.5, 2.5]) tube([q, 8, s * 10.65], [q, 14, s * 10.65], .025, 5);
  // mesa dos juizes (lado oeste)
  mb.set(MAT.DARK, .05, .05, .06, .3); mb.bx(-9.4, .12, 0, 2.2, .24, 5.2, .01);
  mb.set(MAT.WOOD, .2, .13, .08, 0); mb.bx(-9.0, .98, 0, .9, .06, 4.6, .01);
  mb.set(MAT.DARK, .04, .04, .05, .3); mb.bx(-8.6, .6, 0, .05, .74, 4.6, .005); banner(-8.57, .62, 0, 4.4, .62, PI / 2, 4);
  for (let i = -1; i <= 1; i++) { person(-9.55, .47, i * 1.4, 0, true, false, [[.12, .12, .14], [.5, .5, .52], [.1, .1, .25]][i + 1], true); mb.set(MAT.DARK, .05, .05, .06, .3); mb.bx(-9.6, .58, i * 1.4, .45, .06, .45, .02); mb.bx(-9.83, .9, i * 1.4, .05, .6, .45, .02); screen(-8.95, 1.2, i * 1.4 + .3, .42, .26, PI / 2 + .3, 5); mb.set(MAT.EMIS, 1, .9, .7, 3); mb.bx(-8.8, 1.03, i * 1.4 - .4, .05, .02, .12, 0); mb.set(MAT.PAINT2, .8, .8, .78, .2); mb.bx(-9.1, 1.02, i * 1.4 - .1, .28, .01, .2, 0); }
  // cameras de TV
  tvcam(-8.6, 8.4, -.75, 1.5); tvcam(8.7, -8.7, 2.35, 1.5); tvcam(-8.5, -8.5, .8, 1.5); tvcam(0, 9.2, PI / 2, 1.45);
  // grua de camera
  mb.set(MAT.DARK, .07, .07, .08, .4); mb.bx(8.9, .15, 8.9, .9, .3, .9, .02); tube([8.9, .3, 8.9], [8.9, 2.2, 8.9], .05, 8); mb.set(MAT.TRUSS, .7, .7, .72, .3); tube([9.6, 1.8, 9.6], [6.3, 4.6, 6.3], .04, 6); tube([9.6, 2.0, 9.6], [6.3, 4.8, 6.3], .02, 6);
  mb.set(MAT.DARK, .06, .06, .07, .4); mb.bx(6.3, 4.5, 6.3, .3, .25, .3, .02); mb.set(MAT.LENS, .02, .03, .05, 0); mb.push().tr(6.15, 4.4, 6.15).sphere(.07, 8, 6); mb.pop(); mb.set(MAT.DARK, .06, .06, .07, .4); mb.bx(9.7, 1.75, 9.7, .4, .3, .4, .02);
  // boxes das equipes (oeste, atras dos juizes)
  for (const s of [-1, 1]) {
    const tc = s < 0 ? [.7, .07, .05] : [.05, .18, .65], pz = s * 6.6, px = -13;
    mb.set(MAT.DARK, .035, .035, .04, .9); mb.bx(px, .005, pz, 5, .012, 4.6, 0);
    banner(px - 2.45, 1.7, pz, 4.4, 2.2, PI / 2, s < 0 ? 6 : 7); mb.set(MAT.TRUSS, .7, .7, .72, .3); for (const q of [-2.25, 2.25]) tube([px - 2.5, 0, pz + q], [px - 2.5, 2.9, pz + q], .03, 6); tube([px - 2.5, 2.9, pz - 2.25], [px - 2.5, 2.9, pz + 2.25], .03, 6);
    mb.set(MAT.WOOD, .32, .22, .13, 0); mb.bx(px - 1, .88, pz, 1.9, .06, .85, .01); mb.set(MAT.STEEL, .3, .3, .32, .4); for (const a of [-1, 1]) for (const b of [-1, 1]) mb.bx(px - 1 + a * .88, .43, pz + b * .36, .05, .86, .05, .005); mb.bx(px - 1, .25, pz, 1.8, .03, .75, .005);
    mb.set(MAT.PAINT2, tc[0], tc[1], tc[2], .3); mb.bx(px + 1.1, .5, pz - s * 1.5, .9, .9, .5, .02); mb.set(MAT.STEEL, .5, .5, .52, .3); for (let i = 0; i < 5; i++) mb.bx(px + 1.1, .18 + i * .16, pz - s * 1.5 + s * .255, .7, .02, .02, .004); mb.set(MAT.DARK, .03, .03, .03, .2); for (const a of [-1, 1]) mb.cy(px + 1.1 + a * .35, .05, pz - s * 1.5, .05, .04, 8, 2);
    // pecas sobre a bancada
    mb.set(MAT.RUBBER, .03, .03, .03, .3); for (let i = 0; i < 3; i++) { mb.push().tr(px + 1.6, .09 + i * .16, pz + s * 1.6).rx(0).torus(.2, .08, 14, 8); mb.pop(); }
    mb.set(MAT.DARK, .05, .05, .06, .5); mb.cy(px - 1.5, .97, pz + .1, .05, .14, 10, 0); mb.set(MAT.BATT, .9, .6, .05, 0); mb.bx(px - .7, .96, pz - .15, .22, .09, .14, .01); mb.set(MAT.STEEL, .6, .6, .62, .3); mb.bx(px - 1.1, .93, pz + .2, .3, .02, .04, .004); mb.bx(px - .4, .93, pz + .25, .04, .02, .25, .004);
    mb.set(MAT.DARK, .05, .09, .05, .3); mb.bx(px - .3, .98, pz - .2, .2, .12, .16, .01); mb.set(MAT.EMIS, .2, 1, .2, 4); mb.bx(px - .22, 1.0, pz - .118, .012, .012, .006, 0);
    mb.set(MAT.WIRE, .8, .35, .02, 0); mb.cable([[px - .3, .95, pz - .3], [px - .2, .5, pz - .9 * s - .3], [px + .6, .02, pz - s * 1.2], [px + 2.2, .02, pz - s * 2.2], [-9.5, .02, s * 3.5]], .014, 5, 8);
    person(px - 1.1, 0, pz - .75, PI / 2, false, false, tc, true); person(px + .3, 0, pz + .9, -.6, false, rng.u() < .5, tc, true); person(px + 1.6, 0, pz - .3, PI, false, false, tc, true);
    mb.set(MAT.EMIS, tc[0], tc[1], tc[2], 5); mb.bx(px - 2.4, 2.95, pz, .04, .04, 4.4, 0);
  }
  // barreiras em volta
  mb.set(MAT.DARK, .07, .07, .08, .4); for (let i = 0; i < 9; i++) { const z = -8 + i * 2; mb.bx(-10.9, .5, z, .04, 1, .04, .005); } tube([-10.9, 1, -8], [-10.9, 1, 8], .02, 5); tube([-10.9, .55, -8], [-10.9, .55, 8], .015, 5);
  // cabos no chao
  mb.set(MAT.WIRE, .03, .03, .03, 0); mb.cable([[-8.6, .02, 8.4], [-9.6, .02, 7], [-10.2, .02, 3.2], [-10.3, .02, 0], [-10.2, .02, -4], [-8.5, .02, -8.5]], .018, 5, 8); mb.cable([[8.7, .02, -8.7], [9.4, .02, -4], [9.2, .02, 2], [8.9, .02, 8.9]], .018, 5, 8); mb.cable([[0, .02, 9.2], [-3, .02, 9.6], [-8.6, .02, 8.4]], .018, 5, 8);
  // piso do galpao
  mb.set(MAT.CONC, .16, .16, .17, 0); { const a = mb.v(-45, -.01, -34, 0, 1, 0), b = mb.v(45, -.01, -34, 0, 1, 0), c = mb.v(45, -.01, 34, 0, 1, 0), d = mb.v(-45, -.01, 34, 0, 1, 0); mb.quad(a, b, c, d); }
  // paredes e teto do galpao (escuros)
  mb.set(MAT.CONC, .05, .05, .055, 1); mb.bx(0, 8, -34, 90, 16, .5, 0); mb.bx(0, 8, 34, 90, 16, .5, 0); mb.bx(45, 8, 0, .5, 16, 68, 0); mb.bx(-45, 8, 0, .5, 16, 68, 0); mb.bx(0, 16, 0, 90, .5, 68, 0);

  mb.end('arena');

  // tampa do fosso (desce quando o fosso abre)
  mb.set(MAT.STEEL, .36, .36, .38, .15); mb.bx(0, -.02, 0, PIT.h * 2 - .01, .04, PIT.h * 2 - .01, .004, [6, 1, 6]); mb.set(MAT.HAZ, 1, .8, 0, 0); for (const s of [-1, 1]) { mb.bx(0, .001, s * (PIT.h - .12), PIT.h * 2 - .02, .004, .2, 0); mb.bx(s * (PIT.h - .12), .001, 0, .2, .004, PIT.h * 2 - .44, 0); } for (const a of [-1, 1]) for (const b of [-1, 1]) mb.bolt(a * (PIT.h - .3), 0, b * (PIT.h - .3), .02, 1, 1); mb.end('pitlid');
  // paredes de policarbonato
  mb.set(MAT.LENS, 1, 1, 1, 0);
  for (let k = 0; k < 4; k++) { mb.push().ry(k * PI / 2); for (let i = 0; i < 4; i++) { const x0 = -AR + i * 3.5 + .06, x1 = x0 + 3.38; const a = mb.v(x0, .47, AR + .06, 0, 0, -1), b = mb.v(x1, .47, AR + .06, 0, 0, -1), c = mb.v(x1, WALL_H + .08, AR + .06, 0, 0, -1), d = mb.v(x0, WALL_H + .08, AR + .06, 0, 0, -1); mb.quad(a, b, c, d); } mb.pop(); }
  mb.end('glass');

  // serra (eixo Z, gira), martelo da arena (braco em +X a partir do pivo)
  mb.set(MAT.STEEL, .66, .66, .68, .3); { const poly = [], N = 72; for (let i = 0; i < N; i++) { const t = -i / N * TAU, f = (i / N * 24) % 1, r = SAW_R - .03 + .03 * f; poly.push([Math.cos(t) * r, Math.sin(t) * r]); } mb.extrude(poly, .012, .002); mb.set(MAT.DARK, .1, .1, .11, .3); mb.cy(0, 0, 0, .07, .03, 12, 2); } mb.end('saw');
  mb.set(MAT.HAZ, 1, .8, 0, 0); mb.bx(AHAM.len / 2, 0, 0, AHAM.len, .12, .12, .012); mb.set(MAT.STEEL, .5, .5, .52, .6); mb.bx(AHAM.len, -.12, 0, .3, .36, .36, .03); mb.cy(AHAM.len, -.36, 0, .1, .14, 10, 1, { r2: .02, bev: 0 }); mb.end('ahammer');

  // ===================== GARAGEM =====================
  mb.set(MAT.CONC, .2, .2, .21, 0); { const a = mb.v(-6, 0, -3.4, 0, 1, 0), b = mb.v(6, 0, -3.4, 0, 1, 0), c = mb.v(6, 0, 6, 0, 1, 0), d = mb.v(-6, 0, 6, 0, 1, 0); mb.quad(a, b, c, d); }
  mb.set(MAT.CONC, .22, .23, .24, .6); mb.bx(0, 2, -3.5, 12, 4, .2, 0); mb.bx(-6, 2, 1, .2, 4, 10, 0); mb.bx(6, 2, 1, .2, 4, 10, 0); mb.set(MAT.CONC, .07, .07, .08, 1); mb.bx(0, 3.9, 1, 12, .2, 10, 0); mb.bx(0, 2, 6.1, 12, 4, .2, 0);
  mb.set(MAT.PAINT2, .1, .12, .14, .2); mb.bx(0, .55, -3.38, 12, 1.1, .05, 0);
  // tapete e base da bancada
  mb.set(MAT.RUBBER, .03, .03, .03, .2); mb.cy(0, .006, 0, 1.6, .012, 40, 1, { bev: .004 });
  mb.set(MAT.HAZ, 1, .8, 0, 0); mb.cy(0, .06, 0, 1.02, .12, 40, 1);
  mb.set(MAT.STEEL, .34, .34, .36, .4); mb.cy(0, .33, 0, .42, .46, 24, 1); mb.set(MAT.DARK, .06, .06, .07, .5); mb.cy(0, .54, 0, .6, .05, 28, 1);
  for (let i = 0; i < 8; i++) mb.bolt(Math.cos(i / 8 * TAU) * .5, .12, Math.sin(i / 8 * TAU) * .5, .02, 1, 1);
  // painel perfurado com ferramentas
  mb.set(MAT.PEG, .45, .36, .24, 0); mb.bx(0, 1.95, -3.34, 4.6, 1.5, .03, .004);
  const hang = (x, y, kind) => { mb.push().tr(x, y, -3.31);
    if (kind === 0) { mb.set(MAT.STEEL, .7, .7, .72, .3); mb.box(.035, .42, .012, .004); mb.tr(0, .22, 0).rx(PI / 2).ring(.045, .026, .012, 12); mb.tr(0, 0, .44).ring(.035, .02, .012, 6); }
    else if (kind === 1) { mb.set(MAT.WOOD, .4, .26, .12, 0); mb.box(.035, .4, .03, .008); mb.set(MAT.STEEL, .35, .35, .37, .5); mb.tr(0, .2, 0).box(.16, .07, .06, .01); }
    else if (kind === 2) { mb.set(MAT.PAINT2, .8, .5, .05, .2); mb.cyl(.018, .14, 8); mb.set(MAT.STEEL, .7, .7, .72, .3); mb.tr(0, -.17, 0).cyl(.006, .2, 6); }
    else { mb.set(MAT.PAINT2, .7, .08, .05, .3); mb.box(.2, .1, .04, .01); mb.set(MAT.STEEL, .6, .6, .62, .3); mb.tr(.14, 0, 0).rz(PI / 2).cyl(.012, .1, 6); }
    mb.pop(); };
  for (let i = 0; i < 7; i++) hang(-2.0 + i * .22, 2.3 - (i % 3) * .03, 0); hang(-.2, 2.3, 1); hang(.1, 2.28, 1); for (let i = 0; i < 6; i++) hang(.5 + i * .12, 2.42, 2); hang(1.6, 2.35, 3); hang(2.0, 2.3, 3);
  for (let i = 0; i < 5; i++) hang(-1.9 + i * .3, 1.55, i % 2 ? 2 : 0); for (let i = 0; i < 9; i++) hang(-.9 + i * .16, 1.9 + (i % 2) * .05, i % 3 === 0 ? 2 : 0); for (let i = 0; i < 4; i++) hang(1.3 + i * .24, 1.9, 3 - (i % 2) * 2); hang(-1.4, 1.95, 1); hang(-1.65, 1.92, 1);
  mb.set(MAT.WOOD, .3, .2, .12, 0); mb.bx(0, 1.12, -3.2, 4.6, .04, .3, .006); for (let i = 0; i < 10; i++) { const x = -2.1 + i * .46; if (i % 3 === 0) { mb.set(MAT.PAINT2, [.6, .1, .08][i % 3], .3, .1, .3); mb.cy(x, 1.25, -3.2, .06, .22, 12, 1, { bev: .01 }); } else if (i % 3 === 1) { mb.set(MAT.DARK, .05, .05, .06, .5); mb.bx(x, 1.2, -3.2, .22, .12, .16, .01); } else { mb.set(MAT.ALU, .75, .75, .78, .3); mb.cy(x, 1.19, -3.2, .05, .16, 12, 0); mb.set(MAT.BRASS, .8, .6, .3, .2); mb.cy(x + .14, 1.17, -3.2, .035, .06, 10, 2); } } mb.set(MAT.STEEL, .66, .66, .68, .3); mb.push().tr(.9, 1.6, -3.31).rx(0); { const poly = [], N = 48; for (let i = 0; i < N; i++) { const t = i / N * TAU, r = .2 + .03 * ((i / N * 12) % 1); poly.push([Math.cos(t) * r, Math.sin(t) * r]); } mb.extrude(poly, .012, .002); } mb.pop(); mb.push().tr(1.6, 1.62, -3.31); mb.set(MAT.RUBBER, .03, .03, .03, .5); mb.rx(PI / 2).ring(.16, .1, .07, 20, .9); mb.pop();
  banner(-3.9, 2.3, -3.37, 2.6, 1.3, 0, 1); banner(3.9, 2.2, -3.37, 1.8, 1.8, 0, 8);
  // bancada de trabalho + torno
  mb.set(MAT.WOOD, .34, .23, .13, 0); mb.bx(-3.6, .9, -2.7, 3.2, .07, .9, .01); mb.set(MAT.STEEL, .25, .25, .27, .4); for (const a of [-1, 1]) for (const b of [-1, 1]) mb.bx(-3.6 + a * 1.5, .43, -2.7 + b * .38, .06, .86, .06, .006); mb.bx(-3.6, .3, -2.7, 3.0, .03, .8, .006);
  mb.set(MAT.PAINT2, .08, .22, .5, .4); mb.bx(-2.5, 1.0, -2.45, .2, .14, .3, .02); mb.set(MAT.STEEL, .6, .6, .62, .3); mb.bx(-2.5, 1.1, -2.3, .16, .08, .04, .008); mb.bx(-2.5, 1.1, -2.52, .16, .08, .04, .008); mb.cy(-2.5, 1.02, -2.2, .012, .3, 6, 2);
  mb.set(MAT.DARK, .05, .05, .06, .5); mb.cy(-3.4, .99, -2.6, .05, .14, 12, 0); mb.cy(-3.8, .99, -2.8, .04, .12, 12, 2); mb.set(MAT.BATT, .9, .6, .05, 0); mb.bx(-4.4, .99, -2.7, .26, .1, .16, .01); mb.set(MAT.STEEL, .66, .66, .68, .25); mb.bx(-4.0, .95, -2.4, .3, .012, .2, .003);
  mb.set(MAT.WIRE, .7, .05, .04, 0); mb.cable([[-4.4, 1.04, -2.62], [-4.2, 1.1, -2.5], [-3.9, .96, -2.45], [-3.5, .95, -2.4]], .006, 5, 6);
  // armario de ferramentas
  mb.set(MAT.PAINT2, .62, .07, .05, .3); mb.bx(3.3, .62, -2.85, 1.3, 1.1, .6, .02); mb.set(MAT.STEEL, .6, .6, .62, .3); for (let i = 0; i < 6; i++) mb.bx(3.3, .22 + i * .17, -2.54, 1.1, .02, .02, .005); mb.set(MAT.DARK, .03, .03, .03, .2); for (const a of [-1, 1]) for (const b of [-1, 1]) mb.cy(3.3 + a * .55, .04, -2.85 + b * .22, .04, .04, 8, 2);
  mb.set(MAT.PAINT2, .62, .07, .05, .3); mb.bx(3.3, 1.3, -2.9, 1.1, .26, .45, .02);
  // prateleira com caixas e pecas
  mb.set(MAT.STEEL, .25, .25, .27, .4); for (const a of [-1, 1]) for (const b of [-1, 1]) mb.bx(5.2 + a * .35, 1.2, -1.2 + b * .9, .04, 2.4, .04, .004); for (let i = 0; i < 4; i++) mb.bx(5.2, .25 + i * .7, -1.2, .74, .03, 1.84, .004);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const t = rng.u(); if (t < .4) { mb.set(MAT.PEG, .42, .32, .2, .2); mb.bx(5.2, .25 + i * .7 + .17, -1.9 + j * .7, .5, .3, .5 * rng.r(.8, 1.1), .008); } else if (t < .7) { mb.set(MAT.RUBBER, .03, .03, .03, .5); mb.push().tr(5.2, .25 + i * .7 + .1, -1.9 + j * .7).torus(.17, .075, 14, 8); mb.pop(); } else { mb.set(MAT.DARK, .05, .05, .06, .5); mb.cy(5.2, .25 + i * .7 + .08, -1.9 + j * .7, .06, .2, 12, 2); mb.set(MAT.ALU, .8, .8, .82, .3); mb.cy(5.1, .25 + i * .7 + .06, -1.75 + j * .7, .045, .14, 12, 0); } }
  // carrinho de solda e cilindros
  mb.set(MAT.PAINT2, .1, .3, .12, .3); mb.cy(-5.1, .75, -.6, .13, 1.4, 16, 1, { bev: .05 }); mb.set(MAT.PAINT2, .6, .1, .05, .3); mb.cy(-5.1, .65, -1.0, .11, 1.2, 16, 1, { bev: .05 }); mb.set(MAT.BRASS, .8, .6, .3, .2); mb.cy(-5.1, 1.5, -.6, .03, .1, 8, 1); mb.cy(-5.1, 1.3, -1.0, .03, .1, 8, 1);
  mb.set(MAT.STEEL, .25, .25, .27, .4); mb.bx(-5.1, .04, -.8, .5, .04, .9, .01); mb.set(MAT.WIRE, .03, .03, .03, 0); mb.cable([[-5.1, 1.5, -.6], [-4.8, 1.2, -.3], [-4.6, .3, .2], [-4.0, .03, .8], [-3.0, .03, 1.2]], .012, 5, 8);
  // pilha de pneus, tambor de oleo, banco
  mb.set(MAT.RUBBER, .03, .03, .03, .5); for (let i = 0; i < 4; i++) { mb.push().tr(4.6, .1 + i * .19, 1.6 + (i & 1) * .03).torus(.24, .095, 18, 9); mb.pop(); }
  mb.set(MAT.PAINT2, .08, .2, .45, .5); mb.cy(-4.9, .45, 1.6, .29, .9, 20, 1, { bev: .02 }); mb.set(MAT.STEEL, .4, .4, .42, .4); mb.push().tr(-4.9, .3, 1.6).torus(.293, .012, 20, 5); mb.tr(0, .3, 0).torus(.293, .012, 20, 5); mb.pop();
  mb.set(MAT.STEEL, .3, .3, .32, .4); mb.cy(2.6, .3, 1.9, .03, .6, 8, 1); mb.set(MAT.DARK, .04, .04, .04, .3); mb.cy(2.6, .62, 1.9, .17, .06, 16, 1); mb.cy(2.6, .02, 1.9, .2, .03, 12, 1);
  // luminarias pendentes
  GAR_LIGHTS.forEach((L, i) => { if (i > 3) return; mb.set(MAT.DARK, .05, .06, .05, .3); mb.push().tr(L.p[0], L.p[1] + .13, L.p[2]); mb.cyl(.3, .22, 18, { r2: .07, cap0: false }); mb.pop(); mb.set(MAT.EMIS, L.c[0], L.c[1], L.c[2], i < 3 ? 30 : 14); mb.push().tr(L.p[0], L.p[1] + .06, L.p[2]).sphere(.07, 10, 6); mb.pop(); mb.set(MAT.WIRE, .03, .03, .03, 0); tube([L.p[0], L.p[1] + .24, L.p[2]], [L.p[0], 3.85, L.p[2]], .012, 5); });
  // dutos e eletrocalha
  mb.set(MAT.ALU, .6, .6, .62, .5); mb.cy(0, 3.5, -2.6, .22, 11.6, 14, 0); mb.set(MAT.STEEL, .3, .3, .32, .4); mb.bx(0, 3.0, -3.3, 11.8, .06, .12, .005); mb.set(MAT.WIRE, .03, .03, .03, 0); mb.cable([[-5.8, 3.05, -3.3], [-2, 2.9, -3.3], [0, 3.05, -3.3], [2.5, 2.92, -3.3], [5.8, 3.05, -3.3]], .014, 5, 6);
  // cabos no piso ate a bancada giratoria
  mb.set(MAT.WIRE, .8, .35, .02, 0); mb.cable([[3.0, .02, -2.5], [2.2, .02, -1.4], [1.6, .02, -.2], [1.05, .02, .1]], .013, 5, 8); mb.set(MAT.WIRE, .03, .03, .03, 0); mb.cable([[-2.2, .02, -2.4], [-1.8, .02, -1.2], [-1.3, .02, -.5], [-1.0, .03, -.3]], .012, 5, 8);
  mb.end('garage');
  // tampo giratorio da bancada
  mb.set(MAT.STEEL, .5, .5, .52, .15); mb.cy(0, -.03, 0, .98, .06, 120, 1, { bev: .008 }); mb.set(MAT.DARK, .05, .05, .06, .4); mb.cy(0, -.075, 0, .9, .03, 32, 1);
  for (let i = 0; i < 12; i++) mb.bolt(Math.cos(i / 12 * TAU) * .9, 0, Math.sin(i / 12 * TAU) * .9, .014, 1, 1);
  mb.end('bench');
}
