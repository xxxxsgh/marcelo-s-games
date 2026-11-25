// sh_scene.js — passadas de geometria: terreno (clipmap), malhas instanciadas, capim, carro
const WG_TERRAIN = WG_COMMON + WG_TERRAIN_DATA + /* wgsl */`
struct TV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) nf: vec3f, @location(2) cur: vec4f, @location(3) prv: vec4f };
fn tvert(g: vec2f, L: vec4f) -> vec3f {
  var p = g * L.z + L.xy;
  let cd = max(abs(p.x - F.cam.x), abs(p.y - F.cam.z)) / (64.0 * L.z);
  let pc = floor(p / (2.0 * L.z) + 0.25) * 2.0 * L.z;
  p = mix(p, pc, smoothstep(0.70, 0.86, cd));
  return vec3f(p.x, terrainH(p), p.y);
}
@vertex fn vs(@location(0) g: vec2f, @location(1) L: vec4f) -> TV {
  var o: TV; let wp = tvert(g, L); o.wp = wp; o.nf = vec3f(0.0, 1.0, 0.0);
  if (L.z >= 3.9) { let e = L.z; let p = wp.xz; o.nf = normalize(vec3f(terrainH(p - vec2f(e, 0.0)) - terrainH(p + vec2f(e, 0.0)), 2.0 * e, terrainH(p - vec2f(0.0, e)) - terrainH(p + vec2f(0.0, e)))); }
  o.pos = F.vp * vec4f(wp, 1.0); o.cur = F.vpNJ * vec4f(wp, 1.0); o.prv = F.pvp * vec4f(wp, 1.0); return o;
}
@vertex fn vsShadow(@location(0) g: vec2f, @location(1) L: vec4f) -> @builtin(position) vec4f { return F.vp * vec4f(tvert(g, L), 1.0); }
struct Mat { a: vec4f, n: vec4f };
var<private> gDetail: bool = true;
var<private> gBlur: f32 = 1.0;
fn smp2(L: i32, xz: vec2f, sc: f32, gx: vec2f, gy: vec2f, far: f32) -> Mat { // albedo sempre; normal/rugosidade só perto
  var m: Mat; m.a = textureSampleGrad(matA, sAni, xz * sc, L, gx * sc * gBlur, gy * sc * gBlur); m.n = vec4f(0.5, 0.5, 0.88, 0.9);
  if (gDetail) { m.n = textureSampleGrad(matN, sAni, xz * sc, L, gx * sc, gy * sc); }
  return m;
}
fn hblend(a: Mat, b: Mat, w: f32) -> Mat {
  if (w <= 0.001) { return a; } if (w >= 0.999) { return b; }
  let f = smoothstep(0.32, 0.68, sat(w + (b.a.w - a.a.w) * 0.9 * (1.0 - abs(2.0 * w - 1.0))));
  var m: Mat; m.a = mix(a.a, b.a, f); m.n = mix(a.n, b.n, f); return m;
}
@fragment fn fs(v: TV) -> GOut {
  let p = v.wp; let xz = p.xz; let dist = length(p - F.cam.xyz); let e = max(abs(xz.x), abs(xz.y)); let r = length(xz);
  let gx = dpdx(xz); let gy = dpdy(xz);
  let uvn = nearUV(xz); let inNear = 1.0 - smoothstep(470.0, 500.0, e);
  var mk = textureSample(maskT, sClamp, uvn) * inNear; var fl = textureSample(fieldT, sClamp, uvn);
  let nN = textureSample(nrmNearT, sClamp, uvn).xyz * 2.0 - 1.0;
  var N = normalize(mix(v.nf, nN, inNear));
  let nzA = textureSample(noiseT, sRep, xz / 37.0); let nzB = textureSample(noiseT, sRep, xz / 3.1);
  let at = abs(fl.x) + (1.0 - inNear) * 60.0; let far = 0.0; gDetail = dist < 55.0; gBlur = 1.0 + smoothstep(15.0, 60.0, dist) * 0.8;
  let slope = 1.0 - N.y;
  // --- pesos ---
  let track = 1.0 - smoothstep(2.45, 4.1, at + (nzB.x - 0.5) * 1.6 + (nzA.z - 0.5) * 0.8);
  let hard = max(mk.r, max(mk.g, mk.a));
  var wDirt = track; let wMud = mk.r; let wGrav = max(mk.g, mk.a * 0.9); let wRock = max(mk.a * smoothstep(0.42, 0.62, nzB.y * 0.6 + nzA.z * 0.5), smoothstep(0.30, 0.48, slope + (nzB.y - 0.5) * 0.15));
  let strip = (1.0 - smoothstep(0.05, 0.60, at + (nzB.z - 0.5) * 0.9)) * (1.0 - hard) * track * 0.0;
  let bed = smoothstep(0.9, -0.5, fl.w + (nzB.x - 0.5) * 0.8) * inNear;
  let litter = smoothstep(0.56, 0.72, nzA.y + (nzB.y - 0.5) * 0.25) * (1.0 - track);
  // --- camadas ---
  var m = smp2(4, xz, 0.42, gx, gy, far);
  if (litter > 0.01) { m = hblend(m, smp2(9, xz, 0.55, gx, gy, far), litter); }
  if (wDirt > 0.01) { var d = smp2(0, xz, 0.40, gx, gy, far); if (strip > 0.01) { d = hblend(d, m, strip); } m = hblend(m, d, wDirt); }
  if (wGrav > 0.01 || bed > 0.01) { var gv = smp2(1, xz, 1.05, gx, gy, far); gv.a = vec4f(gv.a.rgb * 0.78, gv.a.w); m = hblend(m, gv, max(wGrav, bed)); }
  if (wMud > 0.01) { m = hblend(m, smp2(2, xz, 0.33, gx, gy, far), wMud); }
  if (wRock > 0.01) { m = hblend(m, smp2(3, xz, 0.37, gx, gy, far), wRock); }
  var alb = m.a.rgb; var rough = m.n.z; var ao = m.n.w; var nt = (m.n.xy * 2.0 - 1.0);
  alb *= 0.78 + 0.44 * nzA.x; alb = mix(alb, alb * vec3f(1.12, 0.96, 0.82), nzA.z * 0.5);
  // --- sulcos de uso (procedurais) ---
  let wob = (textureSampleLevel(noiseT, sRep, vec2f(atan2(fl.z, fl.y) * 3.0, 0.21), 0.0).x - 0.5) * 0.35;
  let rb = (at - 0.80 - wob) / 0.27; let rut = exp(-rb * rb) * track * (1.0 - mk.a) * (0.55 + 0.45 * nzB.y);
  alb *= 1.0 - 0.30 * rut; rough = mix(rough, rough * 0.72, rut); ao *= 1.0 - 0.15 * rut;
  // gradiente lateral do campo para inclinar a normal dentro do sulco
  let ftx = textureSampleLevel(fieldT, sClamp, uvn + vec2f(1.0 / 1024.0, 0.0), 0.0).x - fl.x; let ftz = textureSampleLevel(fieldT, sClamp, uvn + vec2f(0.0, 1.0 / 1024.0), 0.0).x - fl.x;
  let lat = normalize(vec2f(ftx, ftz) + 1e-5) * sign(fl.x);
  var bend = lat * (rb * rut * 0.30);
  // --- sulcos dinâmicos dos pneus ---
  let ruv = (xz + 150.0) / 300.0;
  if (max(abs(xz.x), abs(xz.y)) < 149.0 && dist < 120.0) {
    let o = 2.5 / 8192.0; let c0 = textureSampleLevel(rutT, sClamp, ruv, 0.0).r;
    if (c0 > 0.002) {
      let dx = textureSampleLevel(rutT, sClamp, ruv + vec2f(o, 0.0), 0.0).r - textureSampleLevel(rutT, sClamp, ruv - vec2f(o, 0.0), 0.0).r;
      let dz = textureSampleLevel(rutT, sClamp, ruv + vec2f(0.0, o), 0.0).r - textureSampleLevel(rutT, sClamp, ruv - vec2f(0.0, o), 0.0).r;
      let soft = 0.35 + 0.65 * max(mk.r, 0.45 * (1.0 - hard) * track) + (1.0 - track) * 0.3;
      let tread = 1.0;
      alb *= 1.0 - c0 * (0.42 * soft + 0.08) * tread; rough = mix(rough, mix(0.5, 0.22, mk.r), c0 * 0.6 * soft); bend += vec2f(dx, dz) * (1.3 * soft); ao *= 1.0 - c0 * 0.25 * soft;
    }
  }
  // --- umidade e poças ---
  let wetE = max(smoothstep(0.10, 0.50, mk.b), smoothstep(1.4, 0.1, fl.w) * inNear);
  alb *= mix(1.0, 0.50, wetE); rough = mix(rough, 0.30, wetE * 0.75);
  let pud = smoothstep(0.50, 0.62, mk.b + (nzB.z - 0.5) * 0.22 + (m.a.w - 0.5) * -0.25);
  // --- normal final ---
  let T = normalize(cross(vec3f(0.0, 0.0, 1.0), N)); let B = cross(N, T);
  let det = 1.0 - smoothstep(60.0, 220.0, dist) * 0.7;
  var Nw = normalize(T * (nt.x * det + bend.x) + B * (nt.y * det + bend.y) + N * 1.0);
  if (pud > 0.0) {
    let rp = (textureSampleLevel(noiseT, sRep, xz * 1.7 + F.cam.w * vec2f(0.05, 0.03), 1.0).xy + textureSampleLevel(noiseT, sRep, xz * 3.1 - F.cam.w * vec2f(0.04, 0.06), 1.0).yz - 1.0) * 0.012 * F.wind.z;
    alb = mix(alb, vec3f(0.045, 0.034, 0.024), pud * 0.9); rough = mix(rough, 0.09, pud); Nw = normalize(mix(Nw, vec3f(rp.x, 1.0, rp.y), pud)); ao = mix(ao, 1.0, pud);
  }
  // --- copa da mata ao longe ---
  let can = smoothstep(385.0, 445.0, r);
  if (can > 0.0) {
    let c1 = textureSampleGrad(noiseT, sRep, xz / 19.0, gx / 19.0, gy / 19.0); let c2 = textureSampleGrad(noiseT, sRep, xz / 7.3 + 0.3, gx / 7.3, gy / 7.3);
    var cc = mix(vec3f(0.022, 0.050, 0.014), vec3f(0.075, 0.125, 0.030), sat(c1.z * 0.7 + c2.y * 0.5)) * (0.75 + 0.5 * nzA.x);
    cc = mix(cc, vec3f(0.16, 0.14, 0.11), smoothstep(0.34, 0.5, 1.0 - v.nf.y) * smoothstep(700.0, 1500.0, r));
    alb = mix(alb, cc, can); rough = mix(rough, 0.75, can); ao = mix(ao, 0.45 + 0.55 * c1.z, can);
    Nw = normalize(mix(Nw, normalize(v.nf + vec3f(c1.x - 0.5, 0.0, c1.y - 0.5) * 1.3 + vec3f(c2.x - 0.5, 0.0, c2.z - 0.5) * 0.6), can));
  }
  // oclusão sob o carro (assenta o carro no chão)
  { let dc = xz - F.car.xz; let fw = F.pad1.yz; let e = pow(dot(dc, fw) / 2.45, 2.0) + pow((dc.x * fw.y - dc.y * fw.x) / 1.08, 2.0); ao *= 1.0 - 0.72 * (1.0 - smoothstep(0.35, 1.15, e)) * (1.0 - smoothstep(0.2, 1.2, abs(p.y - F.car.y))) * step(0.5, dot(fw, fw)); }
  var o: GOut; o.alb = vec4f(alb, rough); o.nrm = vec4f(Nw, 0.0); o.misc = vec4f(0.0, ao, 0.0, pud); o.mv = motionOf(v.cur, v.prv); return o;
}
`;
// ---- malhas instanciadas (árvores, pedras, estruturas) ----
const WG_PROP = WG_COMMON + /* wgsl */`
@group(1) @binding(0) var matA: texture_2d_array<f32>;
@group(1) @binding(1) var matN: texture_2d_array<f32>;
struct PV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) col: vec4f, @location(4) @interpolate(flat) mat: vec4f, @location(5) cur: vec4f, @location(6) prv: vec4f, @location(7) @interpolate(flat) seed: f32 };
fn xf(pos: vec3f, I0: vec4f, I1: vec4f) -> vec3f { let c = cos(I1.x); let s = sin(I1.x); let l = pos * vec3f(I0.w, I0.w * I1.z, I0.w); return vec3f(l.x * c + l.z * s, l.y, -l.x * s + l.z * c) + I0.xyz; }
@vertex fn vs(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) col: vec4f, @location(4) mat: vec4f, @location(5) I0: vec4f, @location(6) I1: vec4f) -> PV {
  var o: PV; var wp = xf(pos, I0, I1); var pw = wp; let c = cos(I1.x); let s = sin(I1.x);
  if (mat.z > 0.0 && I1.w < 0.5) { let w = mat.z * I0.w; wp += windOff(wp, w, I1.y, F.cam.w); pw += windOff(pw, w, I1.y, F.sun.w); }
  o.wp = wp; o.n = normalize(vec3f(nrm.x * c + nrm.z * s, nrm.y / I1.z, -nrm.x * s + nrm.z * c)); o.uv = uv; o.col = col; o.mat = mat; o.seed = I1.y;
  o.pos = F.vp * vec4f(wp, 1.0); o.cur = F.vpNJ * vec4f(wp, 1.0); o.prv = F.pvp * vec4f(pw, 1.0); return o;
}
struct SV { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) mat: vec4f };
@vertex fn vsShadow(@location(0) pos: vec3f, @location(2) uv: vec2f, @location(4) mat: vec4f, @location(5) I0: vec4f, @location(6) I1: vec4f) -> SV {
  var o: SV; var wp = xf(pos, I0, I1); if (mat.z > 0.0 && I1.w < 0.5) { wp += windOff(wp, mat.z * I0.w, I1.y, F.cam.w); }
  o.pos = F.vp * vec4f(wp, 1.0); o.uv = uv; o.mat = mat; return o;
}
@fragment fn fsShadow(v: SV) { if (v.mat.w * 255.0 > 0.5 && v.mat.w * 255.0 < 1.5) { let a = textureSampleLevel(matA, sRep, v.uv, i32(v.mat.x * 255.0 + 0.5), 1.0).a; if (a < 0.38) { discard; } } }
@fragment fn fs(v: PV, @builtin(front_facing) ff: bool) -> GOut {
  let layer = i32(v.mat.x * 255.0 + 0.5); let kind = i32(v.mat.w * 255.0 + 0.5);
  let gx = dpdx(v.uv); let gy = dpdy(v.uv); let dpx = dpdx(v.wp); let dpy = dpdy(v.wp);
  var N = normalize(v.n); var alb = v.col.rgb; var rough = 0.8; var ao = v.col.a; var mid = 0.0; var tr = 0.0; var o: GOut;
  if (kind == 1) {
    let a = textureSampleGrad(matA, sRep, v.uv, layer, gx, gy); let dist = length(v.wp - F.cam.xyz);
    let ng = normalize(cross(dpx, dpy)); let edge = smoothstep(0.04, 0.32, abs(dot(ng, normalize(F.cam.xyz - v.wp))));
    let cov = a.a * (1.0 + smoothstep(12.0, 90.0, dist) * 0.9) * mix(1.0, edge, 1.0 - smoothstep(60.0, 140.0, dist));
    if (cov < 0.36 + (ign(v.pos.xy, F.misc.x) - 0.5) * 0.22) { discard; }
    let hue = 0.85 + 0.3 * fract(v.seed * 7.3); alb = a.rgb * v.col.rgb * vec3f(hue, 1.0, 0.9) * 1.25; rough = 0.78; mid = 1.0; tr = 1.0;
  } else if (kind == 2) {
    let w0 = pow(abs(N), vec3f(4.0)); let w = w0 / (w0.x + w0.y + w0.z); let sc = 0.42;
    let ax = textureSampleGrad(matA, sRep, v.wp.zy * sc, 3, dpx.zy * sc, dpy.zy * sc); let ay = textureSampleGrad(matA, sRep, v.wp.xz * sc, 3, dpx.xz * sc, dpy.xz * sc); let az = textureSampleGrad(matA, sRep, v.wp.xy * sc, 3, dpx.xy * sc, dpy.xy * sc);
    let nx = textureSampleGrad(matN, sRep, v.wp.zy * sc, 3, dpx.zy * sc, dpy.zy * sc); let ny = textureSampleGrad(matN, sRep, v.wp.xz * sc, 3, dpx.xz * sc, dpy.xz * sc); let nz = textureSampleGrad(matN, sRep, v.wp.xy * sc, 3, dpx.xy * sc, dpy.xy * sc);
    let a = ax * w.x + ay * w.y + az * w.z; let tx = nx.xy * 2.0 - 1.0; let ty = ny.xy * 2.0 - 1.0; let tz = nz.xy * 2.0 - 1.0;
    N = normalize(N + vec3f(0.0, tx.y, tx.x) * w.x * 1.2 + vec3f(ty.x, 0.0, ty.y) * w.y * 1.2 + vec3f(tz.x, tz.y, 0.0) * w.z * 1.2);
    alb = a.rgb * (0.72 + 0.3 * fract(v.seed * 5.1)); alb = mix(alb, alb * vec3f(0.72, 0.62, 0.5), smoothstep(0.35, 0.0, v.col.a - 0.35)); rough = 0.86; ao *= (nx.w * w.x + ny.w * w.y + nz.w * w.z);
    alb = mix(alb, vec3f(0.07, 0.11, 0.03), smoothstep(0.6, 0.95, N.y) * 0.45 * step(0.5, fract(v.seed * 3.3)));
  } else if (kind == 3) { rough = 0.6; }
  else {
    let a = textureSampleGrad(matA, sRep, v.uv, layer, gx, gy); let nt = textureSampleGrad(matN, sRep, v.uv, layer, gx, gy);
    // base tangente a partir das derivadas
    let d1 = cross(dpy, N); let d2 = cross(N, dpx); let T = d1 * gx.x + d2 * gy.x; let B = d1 * gx.y + d2 * gy.y; let im = inverseSqrt(max(dot(T, T), dot(B, B)) + 1e-12);
    let t2 = nt.xy * 2.0 - 1.0; N = normalize(N + (T * t2.x + B * t2.y) * im * 1.3);
    alb = a.rgb * v.col.rgb; rough = nt.z; ao *= nt.w;
  }
  o.alb = vec4f(alb, rough); o.nrm = vec4f(N, mid); o.misc = vec4f(0.0, ao, tr, 0.0); o.mv = motionOf(v.cur, v.prv); return o;
}
`;
// ---- capim: um compute shader decide cada lâmina (posição, altura, cor) e o vertex shader só a estica ----
const WG_GRASSC = WG_COMMON + WG_TERRAIN_DATA + /* wgsl */`
struct Blade { p: vec4f, q: vec4f, c: vec4f };
@group(2) @binding(0) var<storage, read_write> blades: array<Blade>;
struct Ind { vc: u32, ic: atomic<u32>, fv: u32, fi: u32 };
@group(2) @binding(1) var<storage, read_write> ind: Ind;
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x; if (idx >= 87040u) { return; }
  var b: Blade; b.p = vec4f(0.0); b.q = vec4f(0.0); b.c = vec4f(0.0); var live = false;
  let ring = select(0u, 1u, idx >= 36864u); let k = idx - ring * 36864u; let cell = select(0.11, 0.34, ring == 1u); let GN = select(192u, 224u, ring == 1u); let hn = f32(GN) * 0.5;
  let fw = normalize(vec2f(-F.view[0][2], -F.view[2][2]) + 1e-5); let ctr = F.cam.xz + fw * (hn * cell * 0.62);
  let ci = floor(ctr / cell) + vec2f(f32(k % GN) - hn, f32(k / GN) - hn);
  let h = hash22(ci + f32(ring) * 91.7); let h2 = hash22(ci * 1.37 + 5.1); let xz = (ci + h) * cell;
  let d = distance(xz, F.cam.xz); let Rr = (hn - 1.0) * cell; let dc0 = distance(xz, ctr);
  var fade = 1.0 - smoothstep(Rr * 0.80, Rr * 0.98, dc0); if (ring == 1u) { fade *= smoothstep(11.0, 15.5, d + (h.y - 0.5) * 2.0); } else { fade *= 1.0 - smoothstep(13.0, 16.5, d + (h.y - 0.5) * 2.0); }
  // fora do campo de visão (com folga) não vale o custo
  let toB = normalize(xz - F.cam.xz + 1e-5); if (dot(toB, fw) < 0.15 && d > 3.0) { fade = 0.0; }
  if (fade > 0.001 && max(abs(xz.x), abs(xz.y)) < 460.0) {
    let uv = nearUV(xz); let fl = textureSampleLevel(fieldT, sClamp, uv, 0.0); let mk = textureSampleLevel(maskT, sClamp, uv, 0.0);
    let nz = textureSampleLevel(noiseT, sRep, xz / 3.1, 0.0); let nA = textureSampleLevel(noiseT, sRep, xz / 37.0, 0.0);
    let at = abs(fl.x); let track = 1.0 - smoothstep(2.45, 4.1, at + (nz.x - 0.5) * 1.6 + (nA.z - 0.5) * 0.8); let hard = max(mk.r, max(mk.g, mk.a));
    let strip = (1.0 - smoothstep(0.05, 0.60, at + (nz.z - 0.5) * 0.9)) * (1.0 - hard) * track * 0.0;
    var dens = max((1.0 - track) * (1.0 - smoothstep(0.56, 0.72, nA.y + (nz.y - 0.5) * 0.25) * 0.7), strip * 0.8) * smoothstep(0.5, 1.6, fl.w) * (1.0 - mk.b);
    let nrm = textureSampleLevel(nrmNearT, sClamp, uv, 0.0).xyz * 2.0 - 1.0; dens *= smoothstep(0.62, 0.8, nrm.y);
    if (h2.x <= dens) {
      let tall = smoothstep(0.42, 0.62, nA.z + (nz.x - 0.5) * 0.2) * smoothstep(3.6, 5.5, at);
      var hgt = mix(0.16 + 0.22 * h2.y, 0.50 + 0.55 * h2.y, tall) * fade; if (strip > 0.2) { hgt = 0.06 + 0.10 * h2.y; }
      if (ring == 1u) { hgt *= 1.15; }
      let dry = smoothstep(0.35, 0.75, nA.x + (h2.y - 0.5) * 0.5);
      b.p = vec4f(xz.x, terrainH(xz), xz.y, hgt); b.q = vec4f(h.x * 6.2832, h.y, tall, dry); b.c = vec4f(nrm.x, nrm.z, nA.x, h2.x + f32(ring) * 2.0); live = hgt > 0.004;
    }
  }
  if (live) { let slot = atomicAdd(&ind.ic, 1u); blades[slot] = b; }
}
`;
const WG_GRASS = WG_COMMON + /* wgsl */`
struct Blade { p: vec4f, q: vec4f, c: vec4f };
@group(1) @binding(0) var<storage, read> blades: array<Blade>;
struct GV { @builtin(position) pos: vec4f, @location(0) n: vec3f, @location(1) col: vec3f, @location(2) ao: f32, @location(3) cur: vec4f, @location(4) prv: vec4f };
const BT = array<f32, 7>(0.0, 0.0, 0.36, 0.36, 0.70, 0.70, 1.0);
const BS = array<f32, 7>(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 0.0);
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> GV {
  var o: GV; o.pos = vec4f(0.0, 0.0, -1.0, 1.0); o.n = vec3f(0.0, 1.0, 0.0); o.col = vec3f(0.0); o.ao = 1.0; o.cur = o.pos; o.prv = o.pos;
  let b = blades[ii]; var hgt = b.p.w; if (hgt <= 0.0) { return o; }
  hgt *= smoothstep(0.5, 1.8, distance(b.p.xyz, F.cam.xyz)); // lâminas coladas na câmera encolhem
  let ring = b.c.w >= 2.0; let h2x = b.c.w - select(0.0, 2.0, ring); let tall = b.q.z; let dry = b.q.w; let base = b.p.xyz;
  let d = distance(base.xz, F.cam.xz); let t = BT[vi]; let sd = BS[vi]; let a = b.q.x; let dir = vec2f(cos(a), sin(a)); let perp = vec2f(-dir.y, dir.x);
  let wdt = select(0.008, 0.012, ring) * (1.0 + tall * 0.5) * (1.0 - t * t * t * 0.96) * (1.0 + d * 0.035);
  let bend = (0.18 + fract(h2x * 7.7) * 0.45) * hgt * t * t;
  let loc = vec3f(perp.x * sd * wdt + dir.x * bend, hgt * t * (1.0 - 0.12 * t), perp.y * sd * wdt + dir.y * bend);
  let ww = t * t * (0.10 + hgt * 0.42); let wp = base + loc + windOff(base, ww, b.q.y, F.cam.w) * vec3f(1.0, 0.25, 1.0); let pw = base + loc + windOff(base, ww, b.q.y, F.sun.w) * vec3f(1.0, 0.25, 1.0);
  let dc = wp.xz - F.car.xz; let push = (1.0 - smoothstep(0.9, 1.7, length(dc))) * t; let wpp = wp + vec3f(normalize(dc + 1e-4).x, -0.6, normalize(dc + 1e-4).y) * push * hgt * 0.7;
  var c0 = mix(vec3f(0.065, 0.12, 0.026), vec3f(0.095, 0.14, 0.034), h2x); var c1 = mix(vec3f(0.13, 0.21, 0.045), vec3f(0.20, 0.24, 0.06), b.q.y);
  c1 = mix(c1, vec3f(0.36, 0.30, 0.13), dry * 0.55 + tall * 0.25 * t); c0 = mix(c0, vec3f(0.12, 0.10, 0.04), dry * 0.4);
  o.col = mix(c0, c1, t) * (0.7 + 0.6 * b.c.z) * (0.8 + 0.4 * fract(h2x * 13.7)); o.ao = mix(0.45, 1.0, t);
  let nrm = vec3f(b.c.x, sqrt(max(1.0 - b.c.x * b.c.x - b.c.y * b.c.y, 0.0)), b.c.y); o.n = normalize(nrm + vec3f(dir.x, 0.0, dir.y) * 0.35 * t);
  o.pos = F.vp * vec4f(wpp, 1.0); o.cur = F.vpNJ * vec4f(wpp, 1.0); o.prv = F.pvp * vec4f(pw + (wpp - wp), 1.0); return o;
}
@fragment fn fs(v: GV) -> GOut { var o: GOut; o.alb = vec4f(v.col, 0.62); o.nrm = vec4f(normalize(v.n), 1.0); o.misc = vec4f(0.0, v.ao, 0.55, 0.0); o.mv = motionOf(v.cur, v.prv); return o; }
`;
