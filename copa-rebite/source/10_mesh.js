// ---------- construtor de malhas procedurais (so roda na carga) ----------
// vertice: pos(3) normal(3) cor rgb + material (4 x u8) aux(1 float) = 32 bytes
const MAT = { PAINT: 0, PAINT2: 1, STEEL: 2, ALU: 3, TITAN: 4, RUBBER: 5, DARK: 6, WIRE: 7, BATT: 8, EMIS: 9, FLOOR: 10, CONC: 11, CLOTH: 12, TRUSS: 13, HAZ: 14, SEAT: 15, SCREEN: 16, BRASS: 17, LENS: 18, WOOD: 19, PEG: 20, ARMOR: 21, SKIN: 22, BANNER: 23, SPIN: 24, FRAME: 25 };

class MB {
  constructor() { this.p = []; this.n = []; this.c = []; this.a = []; this.i = []; this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; this.st = []; this.col = [1, 1, 1]; this.mat = 0; this.aux = 0; this.meshes = {}; this.i0 = 0; }
  push() { this.st.push(this.m.slice()); return this; } pop() { this.m = this.st.pop(); return this; }
  _mul(b) { const a = this.m, o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; this.m = o; return this; }
  tr(x, y, z) { return this._mul([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); }
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return this._mul([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  sc(x, y, z) { return this._mul([x, 0, 0, 0, 0, y === undefined ? x : y, 0, 0, 0, 0, z === undefined ? x : z, 0, 0, 0, 0, 1]); }
  set(mat, r, g, b, aux) { this.mat = mat; if (r !== undefined) this.col = [r, g, b]; this.aux = aux || 0; return this; }
  v(x, y, z, nx, ny, nz, aux) {
    const m = this.m;
    this.p.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    let a = m[0] * nx + m[4] * ny + m[8] * nz, b = m[1] * nx + m[5] * ny + m[9] * nz, c = m[2] * nx + m[6] * ny + m[10] * nz; const l = 1 / (Math.hypot(a, b, c) || 1);
    this.n.push(a * l, b * l, c * l); this.c.push(this.col[0], this.col[1], this.col[2], this.mat); this.a.push(aux === undefined ? this.aux : aux);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { // orienta pelo normal dos vertices
    const p = this.p, n = this.n, ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const d = gx * (n[a * 3] + n[b * 3] + n[c * 3]) + gy * (n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1]) + gz * (n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2]);
    if (d >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  // caixa centrada com chanfro; sub = [nx,ny,nz] subdivisoes das faces (para amassar)
  box(sx, sy, sz, bev, sub) {
    const h = [sx / 2, sy / 2, sz / 2]; bev = Math.min(bev === undefined ? 0.004 : bev, h[0] * .49, h[1] * .49, h[2] * .49); const s = sub || [1, 1, 1], ax = this.aux;
    for (let w = 0; w < 3; w++) {
      const u = (w + 1) % 3, vv = (w + 2) % 3;
      for (let sg = -1; sg <= 1; sg += 2) {
        const nu = s[u], nv = s[vv], base = this.p.length / 3, P = [0, 0, 0], N = [0, 0, 0]; N[w] = sg;
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
          P[w] = sg * h[w]; P[u] = lerp(-(h[u] - bev), h[u] - bev, i / nu); P[vv] = lerp(-(h[vv] - bev), h[vv] - bev, j / nv);
          const e = (i === 0 || i === nu || j === 0 || j === nv) ? Math.max(ax, .55) : ax; this.v(P[0], P[1], P[2], N[0], N[1], N[2], e);
        }
        for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * (nu + 1) + i; this.quad(a, a + 1, a + nu + 2, a + nu + 1); }
      }
    }
    if (bev > 0) {
      for (let w = 0; w < 3; w++) { // arestas ao longo de w
        const u = (w + 1) % 3, vv = (w + 2) % 3;
        for (let su = -1; su <= 1; su += 2) for (let sv = -1; sv <= 1; sv += 2) {
          const N = [0, 0, 0]; N[u] = su * .7071; N[vv] = sv * .7071; const id = [];
          for (let k = 0; k < 4; k++) { const P = [0, 0, 0]; P[w] = (k === 0 || k === 3 ? -1 : 1) * (h[w] - bev); if (k < 2) { P[u] = su * h[u]; P[vv] = sv * (h[vv] - bev); } else { P[u] = su * (h[u] - bev); P[vv] = sv * h[vv]; } id.push(this.v(P[0], P[1], P[2], N[0], N[1], N[2], 1)); }
          this.quad(id[0], id[1], id[2], id[3]);
        }
      }
      for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) for (let c = -1; c <= 1; c += 2) {
        const i0 = this.v(a * h[0], b * (h[1] - bev), c * (h[2] - bev), a * .577, b * .577, c * .577, 1), i1 = this.v(a * (h[0] - bev), b * h[1], c * (h[2] - bev), a * .577, b * .577, c * .577, 1), i2 = this.v(a * (h[0] - bev), b * (h[1] - bev), c * h[2], a * .577, b * .577, c * .577, 1);
        this.tri(i0, i1, i2);
      }
    }
    return this;
  }
  // caixa posicionada: centro + tamanho
  bx(cx, cy, cz, sx, sy, sz, bev, sub) { this.push().tr(cx, cy, cz).box(sx, sy, sz, bev, sub); return this.pop(); }
  // cilindro/tronco ao longo de Y local, centrado; o = {r2, cap0, cap1, bev, auxSide}
  cyl(r, h, seg, o) {
    o = o || {}; const r2 = o.r2 === undefined ? r : o.r2, bev = Math.min(o.bev === undefined ? Math.min(r, h) * .08 : o.bev, h * .45, Math.min(r, r2) * .6), hh = h / 2, sl = (r - r2) / h, ax = this.aux;
    const ring = (rad, y, nx, ny, aux) => { const b = this.p.length / 3; for (let i = 0; i <= seg; i++) { const t = i / seg * TAU, c = Math.cos(t), s = Math.sin(t); this.v(c * rad, y, s * rad, c * nx, ny, s * nx, aux); } return b; };
    const band = (a, b) => { for (let i = 0; i < seg; i++) this.quad(a + i, a + i + 1, b + i + 1, b + i); };
    band(ring(r, -hh + bev, 1, sl, o.auxSide === undefined ? ax : o.auxSide), ring(r2, hh - bev, 1, sl, o.auxSide === undefined ? ax : o.auxSide));
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      if ((sgn < 0 && o.cap0 === false) || (sgn > 0 && o.cap1 === false)) continue;
      const rr = sgn < 0 ? r : r2;
      if (bev > 0) band(ring(rr, sgn * (hh - bev), .7071, sgn * .7071, 1), ring(rr - bev, sgn * hh, .7071, sgn * .7071, 1));
      const b = ring(rr - bev, sgn * hh, 0, sgn, Math.max(ax, .4)), c = this.v(0, sgn * hh, 0, 0, sgn, 0, ax);
      for (let i = 0; i < seg; i++) this.tri(c, b + i, b + i + 1);
    }
    return this;
  }
  cy(cx, cy, cz, r, h, seg, axis, o) { this.push().tr(cx, cy, cz); if (axis === 0) this.rz(-PI / 2); else if (axis === 2) this.rx(PI / 2); this.cyl(r, h, seg, o); return this.pop(); }
  // anel (tubo oco) ao longo de Y
  ring(ro, ri, h, seg, auxO) {
    const hh = h / 2, bev = Math.min((ro - ri) * .25, h * .25), ax = this.aux, me = this;
    const prof = [[ri, -hh + bev, -1, 0], [ri, hh - bev, -1, 0], [ri + bev, hh, 0, 1], [ro - bev, hh, 0, 1], [ro, hh - bev, 1, 0], [ro, -hh + bev, 1, 0], [ro - bev, -hh, 0, -1], [ri + bev, -hh, 0, -1]];
    for (let k = 0; k < 8; k++) {
      const a = prof[k], b = prof[(k + 1) % 8], flat = k % 2 === 0, nx = flat ? a[2] : (a[2] + b[2]) * .7071, ny = flat ? a[3] : (a[3] + b[3]) * .7071, base = this.p.length / 3;
      const aux = (k === 4 && auxO !== undefined) ? auxO : (flat ? ax : 1);
      for (let i = 0; i <= seg; i++) { const t = i / seg * TAU, c = Math.cos(t), s = Math.sin(t); me.v(c * a[0], a[1], s * a[0], c * nx, ny, s * nx, aux); me.v(c * b[0], b[1], s * b[0], c * nx, ny, s * nx, aux); }
      for (let i = 0; i < seg; i++) { const q = base + i * 2; this.quad(q, q + 1, q + 3, q + 2); }
    }
    return this;
  }
  torus(R, r, seg, rs, arc) {
    arc = arc || 1; const base = this.p.length / 3;
    for (let i = 0; i <= seg; i++) { const t = i / seg * TAU * arc, ct = Math.cos(t), st = Math.sin(t); for (let j = 0; j <= rs; j++) { const u = j / rs * TAU, cu = Math.cos(u), su = Math.sin(u); this.v((R + r * cu) * ct, r * su, (R + r * cu) * st, cu * ct, su, cu * st); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = base + i * (rs + 1) + j; this.quad(a, a + 1, a + rs + 2, a + rs + 1); }
    return this;
  }
  sphere(r, seg, rings, sy) {
    sy = sy || 1; const base = this.p.length / 3;
    for (let j = 0; j <= rings; j++) { const ph = j / rings * PI, sp = Math.sin(ph), cp = Math.cos(ph); for (let i = 0; i <= seg; i++) { const t = i / seg * TAU; this.v(r * sp * Math.cos(t), r * cp * sy, r * sp * Math.sin(t), sp * Math.cos(t), cp, sp * Math.sin(t)); } }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = base + j * (seg + 1) + i; if (j > 0) this.tri(a, a + 1, a + seg + 1); if (j < rings - 1) this.tri(a + 1, a + seg + 2, a + seg + 1); }
    return this;
  }
  // prisma: poligono [[x,y],...] estrelado em relacao a (0,0), extrudado em Z (centrado), com chanfro
  extrude(poly, depth, bev, smooth) {
    const n = poly.length, hd = depth / 2, ax = this.aux; bev = Math.min(bev === undefined ? .003 : bev, hd * .45);
    const en = k => { const a = poly[k], b = poly[(k + 1) % n]; let x = b[1] - a[1], y = -(b[0] - a[0]); const l = Math.hypot(x, y) || 1; x /= l; y /= l; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; return (x * mx + y * my < 0) ? [-x, -y] : [x, y]; };
    const ens = []; for (let k = 0; k < n; k++) ens.push(en(k));
    for (let k = 0; k < n; k++) {
      const a = poly[k], b = poly[(k + 1) % n]; let na = ens[k], nb = ens[k];
      if (smooth) { const p = ens[(k + n - 1) % n], q = ens[(k + 1) % n]; na = [na[0] + p[0], na[1] + p[1]]; nb = [nb[0] + q[0], nb[1] + q[1]]; }
      const i0 = this.v(a[0], a[1], -hd + bev, na[0], na[1], 0), i1 = this.v(b[0], b[1], -hd + bev, nb[0], nb[1], 0), i2 = this.v(b[0], b[1], hd - bev, nb[0], nb[1], 0), i3 = this.v(a[0], a[1], hd - bev, na[0], na[1], 0);
      this.quad(i0, i1, i2, i3);
    }
    for (let sg = -1; sg <= 1; sg += 2) {
      const sh = p => { const l = Math.hypot(p[0], p[1]) || 1, f = Math.max(0, 1 - bev / l); return [p[0] * f, p[1] * f]; };
      if (bev > 0) for (let k = 0; k < n; k++) { const a = poly[k], b = poly[(k + 1) % n], e = ens[k], a2 = sh(a), b2 = sh(b); const i0 = this.v(a[0], a[1], sg * (hd - bev), e[0] * .7, e[1] * .7, sg * .7, 1), i1 = this.v(b[0], b[1], sg * (hd - bev), e[0] * .7, e[1] * .7, sg * .7, 1), i2 = this.v(b2[0], b2[1], sg * hd, e[0] * .7, e[1] * .7, sg * .7, 1), i3 = this.v(a2[0], a2[1], sg * hd, e[0] * .7, e[1] * .7, sg * .7, 1); this.quad(i0, i1, i2, i3); }
      const c = this.v(0, 0, sg * hd, 0, 0, sg, ax), b0 = this.p.length / 3;
      for (let k = 0; k < n; k++) { const q = bev > 0 ? sh(poly[k]) : poly[k]; this.v(q[0], q[1], sg * hd, 0, 0, sg, Math.max(ax, .5)); }
      for (let k = 0; k < n; k++) this.tri(c, b0 + k, b0 + (k + 1) % n);
    }
    return this;
  }
  // poligono convexo qualquer (nao centrado): recentraliza e extruda
  prism(poly, depth, bev) { let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length; this.push().tr(cx, cy, 0).extrude(poly.map(p => [p[0] - cx, p[1] - cy]), depth, bev); return this.pop(); }
  // tubo ao longo de pontos [[x,y,z],...]
  path(pts, r, sides, closed) {
    const n = pts.length, base = this.p.length / 3; let ux = 0, uy = 1, uz = 0;
    for (let k = 0; k < n; k++) {
      const a = pts[closed ? (k + n - 1) % n : Math.max(k - 1, 0)], b = pts[closed ? (k + 1) % n : Math.min(k + 1, n - 1)]; let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const l = 1 / (Math.hypot(tx, ty, tz) || 1); tx *= l; ty *= l; tz *= l;
      if (Math.abs(ux * tx + uy * ty + uz * tz) > .95) { ux = 1; uy = 0; uz = 0; if (Math.abs(tx) > .95) { ux = 0; uz = 1; } }
      let sx = uy * tz - uz * ty, sy = uz * tx - ux * tz, sz = ux * ty - uy * tx; const sl = 1 / Math.hypot(sx, sy, sz); sx *= sl; sy *= sl; sz *= sl; ux = ty * sz - tz * sy; uy = tz * sx - tx * sz; uz = tx * sy - ty * sx;
      for (let j = 0; j <= sides; j++) { const t = j / sides * TAU, c = Math.cos(t), s = Math.sin(t), nx = sx * c + ux * s, ny = sy * c + uy * s, nz = sz * c + uz * s; this.v(pts[k][0] + nx * r, pts[k][1] + ny * r, pts[k][2] + nz * r, nx, ny, nz); }
    }
    const m = closed ? n : n - 1; for (let k = 0; k < m; k++) for (let j = 0; j < sides; j++) { const a = base + k * (sides + 1) + j, b = base + ((k + 1) % n) * (sides + 1) + j; this.quad(a, a + 1, b + 1, b); }
    return this;
  }
  // curva suave por pontos de controle (Catmull-Rom) -> cabo
  cable(ctrl, r, sides, sub) {
    const pts = [], n = ctrl.length; sub = sub || 5;
    for (let k = 0; k < n - 1; k++) { const p0 = ctrl[Math.max(k - 1, 0)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(k + 2, n - 1)]; for (let s = 0; s < sub; s++) { const t = s / sub, t2 = t * t, t3 = t2 * t, q = []; for (let d = 0; d < 3; d++) q.push(.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)); pts.push(q); } }
    pts.push(ctrl[n - 1]); return this.path(pts, r, sides || 5);
  }
  // corrente em volta de dois pinhoes no plano XY (eixo Z), centros (x0,y0) (x1,y1)
  chain(x0, y0, r0, x1, y1, r1, link) {
    const d = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0), pts = [], add = (x, y) => pts.push([x, y]);
    const steps0 = Math.max(4, Math.round(PI * r0 / link)), steps1 = Math.max(4, Math.round(PI * r1 / link)), sl = Math.max(2, Math.round(d / link));
    for (let i = 0; i <= steps0; i++) { const t = ang + PI / 2 + i / steps0 * PI; add(x0 + Math.cos(t) * r0, y0 + Math.sin(t) * r0); }
    for (let i = 1; i < sl; i++) { const f = i / sl, t = ang - PI / 2; add(lerp(x0 + Math.cos(t) * r0, x1 + Math.cos(t) * r1, f), lerp(y0 + Math.sin(t) * r0, y1 + Math.sin(t) * r1, f)); }
    for (let i = 0; i <= steps1; i++) { const t = ang - PI / 2 + i / steps1 * PI; add(x1 + Math.cos(t) * r1, y1 + Math.sin(t) * r1); }
    for (let i = 1; i < sl; i++) { const f = i / sl, t = ang + PI / 2; add(lerp(x1 + Math.cos(t) * r1, x0 + Math.cos(t) * r0, f), lerp(y1 + Math.sin(t) * r1, y0 + Math.sin(t) * r0, f)); }
    for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length], t = Math.atan2(b[1] - a[1], b[0] - a[0]), L = Math.hypot(b[0] - a[0], b[1] - a[1]); this.push().tr((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (k & 1) ? .0035 : -.0035).rz(t); this.box(L * 1.25, link * .42, .0035, .0012); this.tr(0, 0, (k & 1) ? -.007 : .007); this.box(L * 1.25, link * .42, .0035, .0012); this.pop(); this.cy(a[0], a[1], 0, link * .2, .016, 6, 2, { bev: 0 }); }
    return this;
  }
  bolt(x, y, z, r, axis, sgn) { this.push().tr(x, y, z); if (axis === 0) this.rz(-sgn * PI / 2); else if (axis === 2) this.rx(sgn * PI / 2); else if (sgn < 0) this.rx(PI); const om = this.mat, oa = this.aux, oc = this.col; this.set(MAT.STEEL, .55, .55, .57, .3); this.tr(0, r * .3, 0).cyl(r, r * .6, 6, { bev: r * .15 }); this.mat = om; this.aux = oa; this.col = oc; return this.pop(); }
  // fecha a malha atual com um nome
  end(name) {
    const i1 = this.i.length; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; const seen = new Set();
    for (let k = this.i0; k < i1; k++) { const v = this.i[k]; if (seen.has(v)) continue; seen.add(v); for (let d = 0; d < 3; d++) { const q = this.p[v * 3 + d]; if (q < mn[d]) mn[d] = q; if (q > mx[d]) mx[d] = q; } }
    this.meshes[name] = { first: this.i0, count: i1 - this.i0, mn, mx, id: Object.keys(this.meshes).length, name }; this.i0 = i1; this.m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; this.st = []; return this.meshes[name];
  }
  pack() {
    const nv = this.p.length / 3, buf = new ArrayBuffer(nv * 32), f = new Float32Array(buf), u = new Uint8Array(buf);
    for (let k = 0; k < nv; k++) { f[k * 8] = this.p[k * 3]; f[k * 8 + 1] = this.p[k * 3 + 1]; f[k * 8 + 2] = this.p[k * 3 + 2]; f[k * 8 + 3] = this.n[k * 3]; f[k * 8 + 4] = this.n[k * 3 + 1]; f[k * 8 + 5] = this.n[k * 3 + 2]; u[k * 32 + 24] = clamp(this.c[k * 4], 0, 1) * 255; u[k * 32 + 25] = clamp(this.c[k * 4 + 1], 0, 1) * 255; u[k * 32 + 26] = clamp(this.c[k * 4 + 2], 0, 1) * 255; u[k * 32 + 27] = this.c[k * 4 + 3]; f[k * 8 + 7] = this.a[k]; }
    return { vb: buf, ib: new Uint32Array(this.i), nv };
  }
}
