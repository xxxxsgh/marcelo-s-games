// ---------- catalogo de pecas (numeros de jogo) e geometria procedural dos robos ----------
// referencial do robo: +X frente, +Y cima, +Z direita. origem no centro do chassi, y=0 no fundo do chassi.
const PESO_MAX = 110;
const AXLE_Y = 0.07, WALL_GAP = 0.028;
const CHASSIS = [
  { id: 'cunha', nome: 'Cunha Rasteira', desc: 'Baixo, em cunha. Entra por baixo do adversário.', kg: 26, hp: 95, pot: 1.08, giro: 1.12, L: 1.0, W: .62, H: .15, wx: [-.32, .16], mx: -.06, wedge: 1,
    prof: [[-.5, 0], [.5, 0], [.5, .025], [.02, .15], [-.5, .15]], role: [null, 'f', 'f', 't', 'r'], tops: [[-.14, .02], [-.5, -.38]], win: [-.38, -.14] },
  { id: 'caixa', nome: 'Caixa Padrão', desc: 'Caixa média, equilibrada.', kg: 36, hp: 125, pot: 1.0, giro: 1.0, L: .9, W: .64, H: .21, wx: [-.28, .28], mx: .18, wedge: 0,
    prof: [[-.45, 0], [.45, 0], [.45, .14], [.38, .21], [-.45, .21]], role: [null, 'f', 'f', 't', 'r'], tops: [[-.02, .38], [-.45, -.30]], win: [-.30, -.02] },
  { id: 'largo', nome: 'Mamute Largo', desc: 'Largo e pesado. Difícil de virar e de empurrar.', kg: 50, hp: 170, pot: .95, giro: .86, L: 1.0, W: .84, H: .25, wx: [-.32, .32], mx: .2, wedge: 0,
    prof: [[-.5, 0], [.5, 0], [.5, .12], [.40, .25], [-.42, .25], [-.5, .17]], role: [null, 'f', 'f', 't', 'r', 'r'], tops: [[0, .40], [-.42, -.28]], win: [-.28, 0] },
];
const RODAS = [
  { id: 'rapidas', nome: 'Pequenas Rápidas', desc: 'Leves e velozes, pouca garra.', kg: 10, hp: 42, vmax: 7.6, forca: 880, mu: .85, giro: 1.25, r: .085, w: .05, n: 4 },
  { id: 'garra', nome: 'Grandes com Garra', desc: 'Pneu com cravo. Anda de cabeça para baixo.', kg: 18, hp: 72, vmax: 5.6, forca: 1180, mu: 1.3, giro: 1.0, r: .14, w: .09, n: 4 },
  { id: 'esteiras', nome: 'Esteiras', desc: 'Tração máxima, lentas para girar.', kg: 26, hp: 115, vmax: 4.1, forca: 1550, mu: 1.7, giro: .78, r: .10, w: .10, n: 2 },
];
const BLIND = [
  { id: 'aluminio', nome: 'Alumínio Leve', desc: 'Rebitada, leve, amassa fácil.', kg: 10, hp: 46, t: .008, metal: 1 },
  { id: 'aco', nome: 'Aço', desc: 'Chapa grossa parafusada. Pesada.', kg: 30, hp: 112, t: .014, metal: 0 },
  { id: 'titanio', nome: 'Titânio', desc: 'Forte e de peso médio.', kg: 19, hp: 86, t: .010, metal: 2 },
];
// tipo: 0 disco H, 1 disco V, 2 tambor, 3 lancador, 4 martelo, 5 garra
const ARMAS = [
  { id: 'discoh', nome: 'Disco Horizontal', desc: 'Golpe lateral brutal. Joga o próprio robô de lado.', kg: 24, hp: 80, dano: 36, spin: 1, wmax: 300, sup: 2.6, R: .215 },
  { id: 'discov', nome: 'Disco Vertical', desc: 'Arranca peças e joga o adversário para cima.', kg: 22, hp: 75, dano: 31, spin: 1, wmax: 330, sup: 2.2, R: .20 },
  { id: 'tambor', nome: 'Tambor', desc: 'Compacto, acelera rápido, golpes em sequência.', kg: 20, hp: 90, dano: 22, spin: 1, wmax: 420, sup: 1.1, R: .10 },
  { id: 'lancador', nome: 'Lançador Pneumático', desc: 'Arremessa o adversário para o alto.', kg: 18, hp: 85, dano: 9, spin: 0, cd: 2.4 },
  { id: 'martelo', nome: 'Martelo', desc: 'Golpe de cima, fura a blindagem do teto.', kg: 16, hp: 70, dano: 27, spin: 0, cd: 1.5 },
  { id: 'garra', nome: 'Garra Esmagadora', desc: 'Prende e esmaga. Arrasta para as armadilhas.', kg: 21, hp: 95, dano: 15, spin: 0, cd: 2.0 },
];
const PARTES = ['Chassi', 'Rodas', 'Blindagem', 'Arma'];
const CORES = [[.75, .06, .04], [.03, .19, .62], [.95, .55, .02], [.06, .42, .12], [.82, .82, .78], [.07, .07, .08], [.45, .05, .5], [.0, .45, .5], [.85, .25, .0], [.55, .62, .05]];

// geometria derivada de uma montagem [chassi, rodas, blindagem, arma]
function layoutOf(b, o) {
  o = o || {}; const c = CHASSIS[b[0]], w = RODAS[b[1]], a = BLIND[b[2]];
  o.clear = w.r - AXLE_Y; o.hx = c.L / 2 + .012; o.hz = c.W / 2 + WALL_GAP + w.w; o.hy0 = 0; o.hy1 = c.H + .016;
  o.wz = c.W / 2 + WALL_GAP + w.w / 2; o.wx0 = c.wx[0]; o.wx1 = c.wx[1]; o.wr = w.r; o.nw = w.n;
  const wp = weaponGeo(b[0], b[3]); o.px = wp.px; o.py = wp.py; o.hitx = wp.hx; o.hity = wp.hy; o.hitr = wp.hr; o.my = c.H; o.mx = c.mx;
  return o;
}
function statsOf(b, o) {
  o = o || {}; const c = CHASSIS[b[0]], w = RODAS[b[1]], a = BLIND[b[2]], k = ARMAS[b[3]];
  const kg = c.kg + w.kg + a.kg + k.kg; o.kg = kg; o.ok = kg <= PESO_MAX;
  o.forca = w.forca * c.pot; o.vmax = w.vmax * (1.12 - kg / 500) * (c.wedge ? 1.04 : 1); o.acc = o.forca / kg; o.giro = w.giro * c.giro * Math.sqrt(85 / kg); o.mu = w.mu;
  o.hp = c.hp + a.hp * 5 * .45 + w.hp * 1.2; o.dano = k.dano + (kg - 60) * .12 + (c.wedge ? 3 : 0);
  // barras 0..1
  o.bKg = kg / 140; o.bVel = clamp((o.vmax - 2.5) / 6, 0, 1); o.bAcc = clamp((o.acc - 6) / 12, 0, 1); o.bGiro = clamp((o.giro - .55) / .95, 0, 1); o.bHp = clamp((o.hp - 180) / 420, 0, 1); o.bDano = clamp((o.dano - 8) / 38, 0, 1);
  return o;
}
// pontos de montagem da arma por chassi
function weaponGeo(ci, k) {
  const c = CHASSIS[ci], nose = c.L / 2, my = c.H + .016;
  if (k === 0) return { px: nose + .245, py: Math.min(my - .05, .13), hx: nose + .245, hy: Math.min(my - .05, .13), hr: .215 };
  if (k === 1) return { px: nose + .225, py: .215, hx: nose + .225, hy: .215, hr: .20 };
  if (k === 2) return { px: nose + .125, py: .108, hx: nose + .125, hy: .108, hr: .10 };
  if (k === 3) return { px: c.mx - .12, py: my + .03, hx: nose + .02, hy: .1, hr: .22 };
  if (k === 4) return { px: Math.max(c.mx, nose - .52), py: my + .11, hx: Math.max(c.mx, nose - .52) + .6, hy: .12, hr: .13 };
  return { px: c.mx + .02, py: my + .12, hx: nose + .2, hy: .1, hr: .16 };
}

function buildRobotMeshes(mb) {
  const beam = (x0, y0, x1, y1, z, w, h, bev) => { const L = Math.hypot(x1 - x0, y1 - y0); mb.push().tr((x0 + x1) / 2, (y0 + y1) / 2, z).rz(Math.atan2(y1 - y0, x1 - x0)).box(L + h * .6, h, w, bev === undefined ? .004 : bev); mb.pop(); };
  const topY = (c, x) => { const p = c.prof; let y = 0; for (let k = 1; k < p.length - 1; k++) { const a = p[k], b = p[k + 1]; if (a[0] === b[0]) { if (Math.abs(x - a[0]) < 1e-6) y = Math.max(y, a[1], b[1]); continue; } const t = (x - a[0]) / (b[0] - a[0]); if (t >= 0 && t <= 1) y = Math.max(y, lerp(a[1], b[1], t)); } return y; };

  // ----- chassis -----
  CHASSIS.forEach((c, ci) => {
    const P = c.prof, W = c.W, t = .006;
    mb.set(MAT.STEEL, .5, .5, .52, .2);
    // paredes seguindo o perfil
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      if (c.role[k] === 't') continue;
      mb.push().tr((a[0] + b[0]) / 2 - nx * t / 2, (a[1] + b[1]) / 2 - ny * t / 2, 0).rz(Math.atan2(ny, nx) - PI / 2).box(L, t, W - .004, .002); mb.pop();
    }
    // tampo: longarinas e travessas na janela
    const yT = c.H;
    for (const s of [-1, 1]) mb.bx((P[P.length - 1][0] + c.tops[0][1]) / 2 - (ci === 2 ? -.04 : 0), yT - .012, s * (W / 2 - .02), Math.abs(c.tops[0][1] - P[P.length - 1][0]) - (ci === 2 ? .08 : 0), .024, .03, .004);
    for (const x of [c.win[0], c.win[1]]) mb.bx(x, yT - .012, 0, .03, .024, W - .06, .004);
    // laterais (perfil)
    for (const s of [-1, 1]) { mb.push().tr(0, 0, s * (W / 2 - t / 2)); mb.prism(P, t, .002); mb.pop(); }
    // anteparo
    mb.bx(c.win[1] + .02, yT * .5, 0, .006, Math.max(.03, topY(c, c.win[1] + .02) - .02), W - .03, .002);
    // grade sobre a janela
    mb.set(MAT.DARK, .08, .08, .09, .1);
    const nb = 5; for (let i = 0; i < nb; i++) { const z = lerp(-W / 2 + .07, W / 2 - .07, i / (nb - 1)); mb.cy((c.win[0] + c.win[1]) / 2, yT - .004, z, .005, c.win[1] - c.win[0], 6, 0, { bev: 0 }); }
    // bateria
    const bx = (c.win[0] + c.win[1]) / 2, bh = Math.min(yT - .05, .11), bw = Math.min(.30, W - .3), bl = (c.win[1] - c.win[0]) - .05;
    mb.set(MAT.BATT, .9, .62, .05, 0); mb.bx(bx, .012 + bh / 2, 0, bl, bh, bw, .008);
    mb.set(MAT.DARK, .05, .05, .06, .3); mb.bx(bx, .012 + bh + .004, 0, bl * .5, .008, bw + .012, .002); // cinta
    mb.set(MAT.BRASS, .85, .6, .3, .2); mb.cy(bx + bl * .3, .012 + bh + .008, bw * .3, .008, .016, 8, 1); mb.cy(bx + bl * .3, .012 + bh + .008, -bw * .3, .008, .016, 8, 1);
    // motores + caixas de reducao + correntes para os eixos
    const mxs = [c.wx[0], c.wx[1]];
    for (const s of [-1, 1]) for (let q = 0; q < 2; q++) {
      const x = mxs[q] + (q === 0 ? .075 : -.075), zc = s * (W / 2 - .085);
      const yM = Math.min(AXLE_Y, topY(c, x + .04) - .05);
      if (yM < .03) continue;
      mb.set(MAT.DARK, .06, .06, .07, .6); mb.cy(x, yM, zc, .034, .10, 14, 2);
      mb.set(MAT.BRASS, .8, .45, .2, .3); mb.cy(x, yM, zc - s * .058, .028, .016, 12, 2);
      mb.set(MAT.ALU, .8, .8, .82, .3); mb.cy(x, yM, zc + s * .06, .024, .02, 10, 2);
      mb.set(MAT.STEEL, .35, .35, .37, .4);
      if (topY(c, mxs[q]) > AXLE_Y + .03) { mb.push().tr(0, 0, zc + s * .066); mb.chain(x, yM, .016, mxs[q], AXLE_Y, .026, .014); mb.pop(); mb.cy(mxs[q], AXLE_Y, zc + s * .066, .024, .008, 10, 2); }
    }
    // eixos atravessando
    mb.set(MAT.STEEL, .6, .6, .62, .2);
    for (const x of mxs) if (topY(c, x) > AXLE_Y + .02) mb.cy(x, AXLE_Y, 0, .011, W + .01, 8, 2, { bev: 0 });
    // controladores + receptor
    mb.set(MAT.DARK, .04, .09, .05, .2); mb.bx(c.win[1] - .06, .03, -W / 2 + .2, .09, .03, .06, .004); mb.bx(c.win[1] - .06, .03, W / 2 - .2, .09, .03, .06, .004);
    mb.set(MAT.ALU, .7, .7, .72, .6); mb.bx(c.win[0] + .05, .022, 0, .06, .02, .08, .003);
    mb.set(MAT.EMIS, .1, 1, .2, 3); mb.bx(c.win[0] + .05, .034, .02, .008, .006, .008, 0);
    // fiacao
    const wire = (col, pts, r) => { mb.set(MAT.WIRE, col[0], col[1], col[2], 0); mb.cable(pts, r || .0045, 5, 4); };
    const by = .012 + bh + .012;
    for (const s of [-1, 1]) {
      wire([.7, .04, .03], [[bx + bl * .3, by, s * bw * .3], [bx + bl * .45, by + .012, s * (bw * .3 + .03)], [c.win[1] - .03, yT - .03, s * (W / 2 - .17)], [c.win[1] - .06, .05, s * (W / 2 - .2)]], .006);
      wire([.03, .03, .03], [[bx + bl * .1, by - .01, s * bw * .45], [bx + bl * .4, by + .004, s * (bw * .5 + .04)], [c.win[1] - .05, yT - .045, s * (W / 2 - .22)], [c.win[1] - .08, .05, s * (W / 2 - .21)]], .006);
      wire([.9, .75, .05], [[c.win[1] - .06, .05, s * (W / 2 - .2)], [c.win[1] - .1, .075, s * (W / 2 - .13)], [c.wx[0] + .12, .085, s * (W / 2 - .12)], [c.wx[0] + .075, .08, s * (W / 2 - .085)]]);
      wire([.1, .3, .8], [[c.win[1] - .05, .05, s * (W / 2 - .19)], [c.win[1] - .1, .07, s * (W / 2 - .15)], [c.wx[0] + .14, .07, s * (W / 2 - .14)], [c.wx[0] + .09, .06, s * (W / 2 - .1)]]);
    }
    wire([.9, .9, .9], [[c.win[0] + .05, .035, -.02], [c.win[0] + .1, .07, -.08], [c.win[1] - .1, .06, -.1], [c.win[1] - .06, .05, -W / 2 + .2]], .003);
    wire([.9, .4, .0], [[c.win[0] + .05, .035, .0], [c.win[0] + .12, .06, .1], [c.win[1] - .1, .055, .12], [c.win[1] - .06, .05, W / 2 - .2]], .003);
    mb.end('ch' + ci);

    // ----- blindagens deste chassi -----
    BLIND.forEach((ar, ai) => {
      const th = ar.t;
      const plate = (len, wid, sub) => { // chapa no plano XZ local, face externa em +Y
        mb.set(MAT.ARMOR, 1, 1, 1, .12); mb.push().tr(0, th / 2, 0).box(len, th, wid, Math.min(.003, th * .3), sub); mb.pop();
        const ex = len / 2 - .022, ez = wid / 2 - .022;
        if (ai === 0) { // rebites + nervuras
          const n = Math.max(2, Math.round(len / .05)), m = Math.max(2, Math.round(wid / .05));
          mb.set(MAT.ALU, .8, .8, .82, .2);
          for (let i = 0; i <= n; i++) for (const s of [-1, 1]) mb.cy(lerp(-ex, ex, i / n), th + .0015, s * ez, .0055, .003, 6, 1, { bev: .0012 });
          for (let i = 1; i < m; i++) for (const s of [-1, 1]) mb.cy(s * ex, th + .0015, lerp(-ez, ez, i / m), .0055, .003, 6, 1, { bev: .0012 });
          mb.set(MAT.ARMOR, 1, 1, 1, .5); if (len > .14 && wid > .2) for (const s of [-1, 1]) mb.bx(0, th + .002, s * wid * .2, len - .08, .004, .016, .002);
        } else if (ai === 1) { // parafusos grandes + reforco de borda
          mb.set(MAT.ARMOR, 1, 1, 1, .7); for (const s of [-1, 1]) { mb.bx(0, th + .003, s * (wid / 2 - .02), len - .004, .006, .034, .002); }
          const n = Math.max(1, Math.round(len / .11));
          for (let i = 0; i <= n; i++) for (const s of [-1, 1]) mb.bolt(lerp(-ex, ex, i / n), th + .006, s * (wid / 2 - .02), .0095, 1, 1);
        } else { // titanio: parafusos escareados, tira de reforco diagonal
          mb.set(MAT.DARK, .1, .1, .11, .3); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.cy(sx * ex, th + .0006, sz * ez, .007, .0012, 8, 1, { bev: 0 });
          if (wid > .2) for (const sz of [-1, 0, 1]) mb.cy(0, th + .0006, sz * ez, .007, .0012, 8, 1, { bev: 0 });
        }
      };
      const edgePanels = (role, name) => {
        let any = false;
        for (let k = 0; k < P.length; k++) {
          if (c.role[k] !== role) continue; const a = P[k], b = P[(k + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .05) continue;
          const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L; any = true;
          mb.push().tr((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0).rz(Math.atan2(ny, nx) - PI / 2); plate(L - .012, W + .012, [Math.max(2, Math.round(L / .05)), 1, 10]); mb.pop();
        }
        if (role === 'f') { // para-choque
          const a = P[1]; mb.set(MAT.STEEL, .5, .5, .52, .6); mb.bx(a[0] + th + .004, Math.max(.014, P[2][1] * .5), 0, .012, Math.max(.022, P[2][1] * .7), W + .02, .004);
        }
        mb.end(name);
      };
      edgePanels('f', `ar${ci}_${ai}_0`); edgePanels('r', `ar${ci}_${ai}_1`);
      // laterais: grade deformavel seguindo o perfil
      for (const s of [-1, 1]) {
        const x0 = -c.L / 2 + .012, x1 = c.L / 2 - .012, nx = 16, ny = 4, z0 = s * (W / 2 + .001), z1 = s * (W / 2 + .001 + th);
        mb.set(MAT.ARMOR, 1, 1, 1, .12);
        for (const zz of [z0, z1]) { const base = mb.p.length / 3, out = zz === z1; for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = lerp(x0, x1, i / nx), yt = Math.max(.02, topY(c, x) - .004); mb.v(x, lerp(.004, yt, j / ny), zz, 0, 0, out ? s : -s, (i === 0 || i === nx || j === 0 || j === ny) ? .7 : .12); } for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = base + j * (nx + 1) + i; mb.quad(q, q + 1, q + nx + 2, q + nx + 1); } }
        // borda
        const rim = []; for (let i = 0; i <= nx; i++) rim.push([lerp(x0, x1, i / nx), .004]); for (let i = nx; i >= 0; i--) { const x = lerp(x0, x1, i / nx); rim.push([x, Math.max(.02, topY(c, x) - .004)]); }
        for (let k = 0; k < rim.length; k++) { const a = rim[k], b = rim[(k + 1) % rim.length]; let ex = b[1] - a[1], ey = -(b[0] - a[0]); const l = Math.hypot(ex, ey) || 1; ex /= l; ey /= l; const i0 = mb.v(a[0], a[1], z0, ex, ey, 0, 1), i1 = mb.v(b[0], b[1], z0, ex, ey, 0, 1), i2 = mb.v(b[0], b[1], z1, ex, ey, 0, 1), i3 = mb.v(a[0], a[1], z1, ex, ey, 0, 1); mb.quad(i0, i1, i2, i3); }
        // fixadores e recorte dos eixos
        const nbt = ai === 1 ? 4 : ai === 0 ? 9 : 3;
        for (let i = 0; i <= nbt; i++) { const x = lerp(x0 + .03, x1 - .05, i / nbt), yt = topY(c, x) - .02; if (yt < .03) continue; if (ai === 1) mb.bolt(x, yt, z1, .009, 2, s); else { mb.set(ai === 0 ? MAT.ALU : MAT.DARK, .7, .7, .72, .2); mb.cy(x, yt, z1 + s * .001, .0055, .003, 6, 2, { bev: .001 }); } }
        mb.set(MAT.STEEL, .45, .45, .47, .5); for (const x of c.wx) if (topY(c, x) > AXLE_Y + .03) mb.cy(x, AXLE_Y, z1 + s * .003, .026, .008, 12, 2);
        mb.end(`ar${ci}_${ai}_${s < 0 ? 2 : 3}`);
      }
      // teto
      for (const tp of c.tops) { mb.push().tr((tp[0] + tp[1]) / 2, c.H, 0); plate(tp[1] - tp[0] - .006, W + .012, [Math.max(3, Math.round((tp[1] - tp[0]) / .04)), 1, 12]); mb.pop(); }
      mb.end(`ar${ci}_${ai}_4`);
    });

    // ----- armas deste chassi -----
    const nose = c.L / 2, my = c.H + .016, mx = c.mx;
    const pad = (w) => { mb.set(MAT.STEEL, .42, .42, .44, .5); mb.bx(mx, my + .012, 0, .15, .024, w, .004); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.bolt(mx + sx * .06, my + .024, sz * (w / 2 - .02), .008, 1, 1); };
    const armL = (z, y0, x1, y1, w, h) => { const xk = nose + .05; beam(mx - .04, y0, xk, y0, z, w, h); beam(xk, y0, x1, y1, z, w, h); };
    const motor = (x, y, z, axis, r, l) => { mb.set(MAT.DARK, .05, .05, .06, .6); mb.cy(x, y, z, r, l, 14, axis); mb.set(MAT.BRASS, .8, .45, .2, .3); const o = [0, 0, 0]; o[axis] = l / 2 + .006; mb.cy(x + o[0], y + o[1], z + o[2], r * .8, .012, 12, axis); };
    for (let k = 0; k < 6; k++) {
      const g = weaponGeo(ci, k);
      if (k === 0) { // disco horizontal
        pad(.22); const ya = my + .045;
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) armL(s * .07, ya, g.px, g.py + .085, .028, .03);
        mb.set(MAT.STEEL, .5, .5, .52, .4); mb.bx(g.px, g.py + .085, 0, .09, .03, .17, .005); mb.cy(g.px, g.py + .03, 0, .022, .14, 12, 1);
        motor(mx + .01, ya + .05, 0, 1, .042, .07);
        mb.set(MAT.STEEL, .3, .3, .32, .4); mb.push().tr(0, ya + .1, 0).rx(PI / 2); mb.chain(mx + .01, 0, .02, g.px, 0, .03, .016); mb.pop(); mb.cy(g.px, ya + .1, 0, .028, .01, 12, 1);
        mb.end(`wb${ci}_0`);
        mb.set(MAT.STEEL, .3, .3, .32, .25); const poly = []; const N = 64; for (let i = 0; i < N; i++) { const t = i / N * TAU, f = (i / N * 4) % 1, r = .165 + .05 * Math.pow(f, 2.2) * (f > .96 ? 0 : 1); poly.push([Math.cos(t) * r, Math.sin(t) * r]); }
        mb.push().rx(PI / 2).extrude(poly, .026, .005); mb.pop();
        mb.set(MAT.DARK, .07, .07, .08, .3); mb.cy(0, 0, 0, .06, .04, 16, 1); mb.set(MAT.PAINT, 1, 1, 1, .4); mb.cy(0, 0, 0, .1, .03, 20, 1, { bev: .003 });
        for (let i = 0; i < 6; i++) mb.bolt(Math.cos(i / 6 * TAU) * .08, .015, Math.sin(i / 6 * TAU) * .08, .008, 1, 1);
        mb.end(`wm${ci}_0`);
      } else if (k === 1) { // disco vertical
        pad(.2); const ya = my + .04;
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) armL(s * .045, ya, g.px, g.py, .022, .04);
        mb.set(MAT.STEEL, .5, .5, .52, .4); mb.cy(g.px, g.py, 0, .016, .13, 10, 2);
        motor(mx, ya + .055, -.02, 2, .04, .07);
        mb.set(MAT.STEEL, .3, .3, .32, .4); mb.push().tr(0, 0, .062); mb.chain(mx, ya + .055, .02, nose + .05, ya + .01, .02, .016); mb.pop();
        mb.end(`wb${ci}_1`);
        mb.set(MAT.STEEL, .3, .3, .32, .25); const poly = []; const N = 60; for (let i = 0; i < N; i++) { const t = -i / N * TAU, f = (i / N * 2) % 1, r = .14 + .06 * Math.pow(f, 2.5) * (f > .97 ? 0 : 1); poly.push([Math.cos(t) * r, Math.sin(t) * r]); }
        mb.extrude(poly, .032, .006);
        mb.set(MAT.PAINT, 1, 1, 1, .4); mb.cy(0, 0, 0, .075, .04, 18, 2, { bev: .003 }); for (let i = 0; i < 5; i++) { mb.bolt(Math.cos(i / 5 * TAU) * .055, Math.sin(i / 5 * TAU) * .055, .02, .007, 2, 1); mb.bolt(Math.cos(i / 5 * TAU) * .055, Math.sin(i / 5 * TAU) * .055, -.02, .007, 2, -1); }
        mb.end(`wm${ci}_1`);
      } else if (k === 2) { // tambor
        pad(.44); const ya = my + .035;
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) armL(s * .2, ya, g.px, g.py, .024, .045);
        motor(mx, ya + .05, .1, 2, .036, .08);
        mb.set(MAT.STEEL, .3, .3, .32, .4); mb.push().tr(0, 0, .228); mb.chain(mx, ya + .05, .018, nose + .05, ya + .02, .018, .016); mb.chain(nose + .05, ya + .02, .018, g.px, g.py, .03, .016); mb.pop();
        mb.set(MAT.STEEL, .5, .5, .52, .4); mb.cy(mx, ya + .05, .18, .012, .11, 8, 2); mb.cy(nose + .05, ya + .02, .214, .012, .04, 8, 2);
        mb.end(`wb${ci}_2`);
        mb.set(MAT.STEEL, .32, .32, .34, .3); mb.cy(0, 0, 0, .078, .35, 24, 2, { bev: .008 });
        mb.set(MAT.PAINT, 1, 1, 1, .5); for (const z of [-.12, 0, .12]) mb.cy(0, 0, z, .08, .03, 24, 2, { bev: .002 });
        mb.set(MAT.STEEL, .7, .7, .72, .5); for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const t = i * PI + j * .5, z = (j - 1) * .1 + (i ? .03 : -.03); mb.push().tr(0, 0, z).rz(t).tr(.082, 0, 0).box(.036, .03, .05, .005); mb.pop(); }
        mb.cy(0, 0, 0, .014, .40, 8, 2);
        mb.end(`wm${ci}_2`);
      } else if (k === 3) { // lancador
        pad(.3);
        mb.set(MAT.STEEL, .5, .5, .52, .4); for (const s of [-1, 1]) mb.bx(g.px, my + .02, s * .19, .05, .04, .02, .004); mb.cy(g.px, g.py, 0, .01, .42, 8, 2);
        mb.set(MAT.PAINT2, .75, .08, .05, .3); mb.cy(mx - .2 > -c.L / 2 + .1 ? mx - .2 : mx - .12, my + .075, 0, .038, .22, 16, 2, { bev: .015 });
        mb.set(MAT.BRASS, .8, .6, .3, .2); mb.cy(mx - .2 > -c.L / 2 + .1 ? mx - .2 : mx - .12, my + .075, .125, .014, .03, 8, 2);
        mb.set(MAT.WIRE, .05, .05, .05, 0); const bxx = mx - .2 > -c.L / 2 + .1 ? mx - .2 : mx - .12; mb.cable([[bxx, my + .075, .14], [bxx + .03, my + .1, .17], [mx - .02, my + .06, .13], [mx, my + .03, .08]], .007, 6, 5);
        mb.set(MAT.ALU, .75, .75, .78, .3); for (const s of [-1, 1]) mb.cy(mx + .02, my + .034, s * .08, .022, .1, 12, 0);
        mb.end(`wb${ci}_3`);
        // braco (pivo na origem): parte plana + pa descendo ate o nariz
        const te = c.tops[0][1], kx = te + .06 - g.px, ky = 0, tx = nose + .1 - g.px, ty = .03 - g.py;
        mb.set(MAT.PAINT, 1, 1, 1, .3); beam(.0, ky, kx, ky, 0, .36, .014); beam(kx, ky, tx, ty, 0, .36, .014);
        mb.set(MAT.STEEL, .55, .55, .57, .6); beam(tx - .03, ty + .008, tx + .012, ty - .006, 0, .38, .01);
        mb.set(MAT.PAINT, 1, 1, 1, .5); for (const s of [-1, 1]) { beam(0, ky + .016, kx, ky + .016, s * .12, .016, .02); mb.bolt(kx * .5, ky + .028, s * .12, .007, 1, 1); }
        mb.end(`wm${ci}_3`);
      } else if (k === 4) { // martelo
        pad(.2);
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) { mb.push().tr(g.px, 0, s * .05); mb.prism([[-.07, my + .02], [.07, my + .02], [.03, g.py + .035], [-.03, g.py + .035]], .014, .003); mb.pop(); }
        mb.set(MAT.STEEL, .5, .5, .52, .4); mb.cy(g.px, g.py, 0, .014, .14, 10, 2);
        if (g.px - mx > .05) { mb.set(MAT.STEEL, .42, .42, .44, .5); mb.bx((g.px + mx) / 2 + .04, my + .012, 0, g.px - mx + .1, .022, .16, .004); }
        motor(g.px - .075, my + .06, 0, 2, .036, .08);
        mb.set(MAT.BRASS, .75, .55, .25, .4); mb.cy(g.px, g.py, .072, .05, .012, 20, 2);
        mb.end(`wb${ci}_4`);
        mb.set(MAT.STEEL, .5, .5, .52, .3); beam(0, 0, .56, 0, 0, .03, .035);
        mb.set(MAT.DARK, .08, .08, .09, .3); mb.cy(0, 0, 0, .03, .07, 12, 2);
        mb.set(MAT.STEEL, .62, .62, .64, .5); mb.bx(.6, -.01, 0, .09, .10, .11, .01); mb.cy(.6, -.085, 0, .03, .05, 10, 1, { r2: .004, bev: 0 });
        mb.set(MAT.PAINT, 1, 1, 1, .5); mb.bx(.6, .03, 0, .094, .02, .114, .004);
        mb.end(`wm${ci}_4`);
      } else { // garra
        pad(.3);
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) { armL(s * .13, my + .04, nose + .07, .035, .022, .035); }
        mb.set(MAT.STEEL, .55, .55, .57, .5); for (const s of [-1, 1]) { beam(nose + .06, .028, nose + .27, .018, s * .1, .03, .024); beam(nose + .06, .03, nose + .07, .03, s * .115, .06, .03); }
        mb.bx(nose + .09, .03, 0, .03, .028, .24, .004);
        mb.set(MAT.PAINT, 1, 1, 1, .3); for (const s of [-1, 1]) { mb.push().tr(g.px, 0, s * .04); mb.prism([[-.07, my + .02], [.06, my + .02], [.03, g.py + .035], [-.03, g.py + .035]], .014, .003); mb.pop(); }
        mb.set(MAT.STEEL, .5, .5, .52, .4); mb.cy(g.px, g.py, 0, .014, .12, 10, 2);
        mb.set(MAT.ALU, .75, .75, .78, .3); mb.push().tr(g.px - .1, my + .07, 0).rz(.5).rz(-PI / 2).cyl(.026, .14, 12); mb.pop();
        mb.set(MAT.WIRE, .05, .05, .05, 0); mb.cable([[g.px - .15, my + .05, .03], [g.px - .12, my + .1, .08], [mx - .02, my + .05, .1], [mx - .04, my + .03, .06]], .006, 6, 5);
        mb.end(`wb${ci}_5`);
        // bico (pivo na origem), fechado quando ang=0: ponta em (hx, .06)
        const tx = g.hx + .02 - g.px, ty = .075 - g.py, ex = tx - .02, ey = .13;
        mb.set(MAT.PAINT, 1, 1, 1, .3); mb.prism([[-.05, -.03], [-.06, .04], [ex * .55, ey + .03], [ex * .6, ey - .03]], .05, .005); mb.prism([[ex * .5, ey - .03], [ex * .5, ey + .03], [ex + .04, ey - .02], [ex - .01, ey - .06]], .05, .005);
        mb.set(MAT.STEEL, .6, .6, .62, .5); mb.prism([[ex - .03, ey - .05], [ex + .045, ey - .02], [tx + .012, ty + .06], [tx, ty], [tx - .03, ty + .07]], .04, .005);
        mb.set(MAT.DARK, .08, .08, .09, .3); mb.cy(0, 0, 0, .03, .07, 12, 2);
        mb.set(MAT.STEEL, .7, .7, .72, .2); beam(-.04, .02, -.11, -.045, 0, .016, .016);
        mb.end(`wm${ci}_5`);
      }
    }
  });

  // ----- rodas (eixo Z, lado de fora em +Z) -----
  { // pequenas
    const w = RODAS[0];
    mb.set(MAT.RUBBER, .03, .03, .03, 0); mb.push().rx(PI / 2).ring(w.r, w.r * .62, w.w, 28, .9); mb.pop();
    mb.set(MAT.STEEL, .34, .34, .36, .25); mb.cy(0, 0, 0, w.r * .63, w.w * .8, 20, 2, { bev: .004 });
    mb.set(MAT.PAINT, 1, 1, 1, .4); mb.cy(0, 0, w.w * .42, w.r * .3, .008, 12, 2);
    for (let i = 0; i < 5; i++) mb.bolt(Math.cos(i / 5 * TAU) * w.r * .45, Math.sin(i / 5 * TAU) * w.r * .45, w.w * .4, .006, 2, 1);
    mb.set(MAT.STEEL, .5, .5, .52, .3); mb.cy(0, 0, -w.w / 2 - .016, .012, .04, 8, 2);
    mb.end('wh0');
  }
  { // grandes com cravos
    const w = RODAS[1];
    mb.set(MAT.RUBBER, .03, .03, .03, 0); mb.push().rx(PI / 2).ring(w.r - .022, w.r * .6, w.w, 32, .2); mb.pop();
    const nl = 20; for (let i = 0; i < nl; i++) { const t = i / nl * TAU; for (const s of [-1, 1]) { mb.push().rz(t + (s > 0 ? PI / nl : 0)).tr(w.r - .0195, 0, s * w.w * .25).ry(s * .3).box(.022, .026, w.w * .5, .004); mb.pop(); } }
    mb.set(MAT.ALU, .78, .78, .8, .25); mb.push().rx(PI / 2).ring(w.r * .62, w.r * .5, w.w * .75, 24); mb.pop();
    mb.set(MAT.STEEL, .5, .5, .52, .4); for (let i = 0; i < 5; i++) { mb.push().rz(i / 5 * TAU).tr(w.r * .3, 0, w.w * .1).box(w.r * .46, .026, .02, .004); mb.pop(); }
    mb.set(MAT.ALU, .8, .8, .82, .3); mb.cy(0, 0, w.w * .1, w.r * .2, .04, 14, 2); mb.bolt(0, 0, w.w * .1 + .02, .012, 2, 1);
    mb.set(MAT.STEEL, .5, .5, .52, .3); mb.cy(0, 0, -w.w / 2 - .014, .014, .05, 8, 2);
    mb.end('wh1');
  }
  { // esteira (unidade de um lado, comprimento em X)
    const w = RODAS[2], hl = .21, r = w.r - .012, np = 44, per = 2 * hl * 2 + TAU * r;
    mb.set(MAT.RUBBER, .03, .03, .03, .9);
    for (let i = 0; i < np; i++) {
      let d = i / np * per, x, y, a;
      if (d < 2 * hl) { x = -hl + d; y = -r; a = 0; } else if (d < 2 * hl + PI * r) { const t = (d - 2 * hl) / r; x = hl + Math.sin(t) * r; y = -Math.cos(t) * r; a = t; } else if (d < 4 * hl + PI * r) { x = hl - (d - 2 * hl - PI * r); y = r; a = PI; } else { const t = (d - 4 * hl - PI * r) / r; x = -hl - Math.sin(t) * r; y = Math.cos(t) * r; a = PI + t; }
      mb.push().tr(x, y, 0).rz(a).tr(0, -.004, 0).box(per / np * .82, .016, w.w, .003); mb.pop();
      mb.push().tr(x, y, 0).rz(a).tr(0, .005, 0).box(per / np * 1.02, .006, w.w * .9, 0); mb.pop();
    }
    mb.set(MAT.DARK, .1, .1, .11, .4); for (const s of [-1, 1]) { mb.cy(s * hl, 0, 0, r - .008, w.w * .6, 16, 2); }
    mb.set(MAT.ALU, .75, .75, .78, .3); for (const x of [-.105, 0, .105]) mb.cy(x, -r + .042, 0, .034, w.w * .7, 12, 2);
    mb.set(MAT.PAINT, 1, 1, 1, .35); mb.bx(0, .005, w.w / 2 - .004, 2 * hl + .02, .06, .008, .003); mb.bx(0, .005, -w.w / 2 + .004, 2 * hl + .02, .06, .008, .003);
    for (const x of [-hl, 0, hl]) mb.bolt(x, .005, w.w / 2, .009, 2, 1);
    mb.set(MAT.STEEL, .5, .5, .52, .3); for (const x of [-hl + .03, hl - .03]) mb.cy(x, AXLE_Y - w.r + .03, -w.w / 2 - .014, .014, .05, 8, 2);
    mb.end('wh2');
  }
  // pequenos destrocos genericos
  mb.set(MAT.STEEL, .5, .5, .52, .8); mb.box(.05, .008, .035, .002); mb.end('lasca');
}
