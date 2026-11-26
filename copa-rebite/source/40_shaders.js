// ---------- shaders WGSL ----------
const WGSL_COMMON = /* wgsl */`
diagnostic(off, derivative_uniformity);
struct Light { pos: vec4f, dir: vec4f, col: vec4f, ext: vec4f }
struct Frame { vpJ: mat4x4f, vp: mat4x4f, pvp: mat4x4f, ivpJ: mat4x4f, view: mat4x4f, cam: vec4f, res: vec4f, misc: vec4f, misc2: vec4f, jit: vec4f,
  lights: array<Light,16>, svp: array<mat4x4f,4>, pp: vec4f, fx: vec4f }
const PI = 3.14159265;
fn h31(p: vec3f) -> f32 { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
fn h21(p: vec2f) -> f32 { var q = fract(vec3f(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
fn h22(p: vec2f) -> vec2f { var q = fract(vec3f(p.xyx) * vec3f(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
fn vn(p: vec3f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3f(1, 0, 0)), u.x), mix(h31(i + vec3f(0, 1, 0)), h31(i + vec3f(1, 1, 0)), u.x), u.y),
             mix(mix(h31(i + vec3f(0, 0, 1)), h31(i + vec3f(1, 0, 1)), u.x), mix(h31(i + vec3f(0, 1, 1)), h31(i + vec3f(1, 1, 1)), u.x), u.y), u.z); }
fn vn2(p: vec2f) -> f32 { let i = floor(p); let f = fract(p); let u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2f(1, 0)), u.x), mix(h21(i + vec2f(0, 1)), h21(i + vec2f(1, 1)), u.x), u.y); }
fn fbm(p: vec3f) -> f32 { return vn(p) * .5 + vn(p * 2.03 + 7.1) * .25 + vn(p * 4.1 + 13.7) * .125 + vn(p * 8.3 + 3.3) * .0625; }
fn fbm2(p: vec2f) -> f32 { return vn2(p) * .5 + vn2(p * 2.03 + 7.1) * .25 + vn2(p * 4.1 + 13.7) * .125 + vn2(p * 8.3 + 3.3) * .0625; }
fn ign(p: vec2f, fr: f32) -> f32 { let q = p + 5.588238 * (fr % 64.); return fract(52.9829189 * fract(.06711056 * q.x + .00583715 * q.y)); }
// riscos finos: uma linha aleatoria por celula
fn scratch(uv: vec2f, sd: f32) -> f32 {
  var m = 0.;
  for (var k = 0; k < 2; k++) {
    let p = uv * (1. + f32(k) * .73) + f32(k) * 17.3 + sd; let c = floor(p); let f = fract(p) - .5; let r = h22(c);
    let a = r.x * 6.283; let d = vec2f(cos(a), sin(a)); let dist = abs(dot(f - (r - .5) * .5, vec2f(-d.y, d.x)));
    let w = max(fwidth(p.x) + fwidth(p.y), .004) * .9;
    m = max(m, (1. - smoothstep(0., w, dist)) * step(.35, r.y) * min(1., .012 / w));
  }
  return m;
}
`;

const WGSL_SCENE_HEAD = WGSL_COMMON + /* wgsl */`
struct Inst { m: mat4x4f, pm: mat4x4f, tint: vec4f, p0: vec4f, p1: vec4f, d: array<vec4f,4>, pad: vec4f }
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read> I: array<Inst>;
@group(0) @binding(2) var atlas: texture_2d<f32>;
@group(0) @binding(3) var marks: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
@group(0) @binding(5) var floorA: texture_2d<f32>;
@group(0) @binding(6) var floorB: texture_2d<f32>;
@group(0) @binding(7) var smpA: sampler;
fn deform(ii: u32, p: vec3f, n: vec3f) -> vec4f { // xyz deslocamento, w influencia
  var o = vec3f(0.); var w = 0.; var tr = 0.;
  for (var k = 0; k < 4; k++) { let d = I[ii].d[k]; if (d.w <= 0.) { continue; } let v = p - d.xyz; let s = min(d.w, 1.); let rr = .012 + .02 * s;
    let f = exp(-dot(v, v) / rr) * s; o -= n * f * .055; o += (vec3f(h31(p * 91.), h31(p * 57. + 3.), h31(p * 73. + 9.)) - .5) * f * .02; w = max(w, f); }
  return vec4f(o, w);
}
`;
const WGSL_SHADOW = WGSL_SCENE_HEAD + /* wgsl */`
struct SIdx { m: mat4x4f }
@group(1) @binding(0) var<uniform> SI: SIdx;
@vertex fn vsShadow(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) col: vec4f, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let mat = u32(col.a * 255. + .5); var p = pos; if (mat == 21u || mat == 0u) { p += deform(ii, pos, nrm).xyz; }
  return SI.m * (I[ii].m * vec4f(p, 1.));
}
`;
const WGSL_SCENE = WGSL_SCENE_HEAD + /* wgsl */`
struct VO { @builtin(position) pos: vec4f, @location(0) op: vec3f, @location(1) wp: vec3f, @location(2) wn: vec3f, @location(3) col: vec3f, @location(4) aux: f32,
  @location(5) @interpolate(flat) mi: vec2u, @location(6) cc: vec4f, @location(7) pc: vec4f, @location(8) on: vec3f, @location(9) dent: vec2f }
@vertex fn vs(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) col: vec4f, @location(3) aux: f32, @builtin(instance_index) ii: u32) -> VO {
  var o: VO; let mat = u32(col.a * 255. + .5);
  var p = pos; var n = nrm; var dw = 0.;
  if (mat == 21u || mat == 0u) { let d = deform(ii, pos, nrm); p += d.xyz; dw = d.w;
    if (dw > .01) { let e = .012; let t1 = normalize(cross(nrm, vec3f(.31, .87, .37))); let t2 = cross(nrm, t1);
      let d1 = deform(ii, pos + t1 * e, nrm); let d2 = deform(ii, pos + t2 * e, nrm);
      n = normalize(cross(t1 * e + d1.xyz - d.xyz, t2 * e + d2.xyz - d.xyz)); if (dot(n, nrm) < 0.) { n = -n; } } }
  let w = I[ii].m * vec4f(p, 1.); let pw = I[ii].pm * vec4f(p, 1.);
  o.pos = F.vpJ * w; o.cc = F.vp * w; o.pc = F.pvp * pw; o.op = pos; o.wp = w.xyz; o.on = nrm;
  o.wn = normalize((I[ii].m * vec4f(n, 0.)).xyz); o.col = col.rgb; o.aux = aux; o.mi = vec2u(mat, ii); o.dent = vec2f(dw, 0.);
  return o;
}
struct GO { @location(0) a: vec4f, @location(1) n: vec4f, @location(2) v: vec4f }
fn bump(n: vec3f, p: vec3f, h: f32) -> vec3f {
  let dpx = dpdx(p); let dpy = dpdy(p); let r1 = cross(dpy, n); let r2 = cross(n, dpx); let det = dot(dpx, r1);
  let g = (r1 * dpdx(h) + r2 * dpdy(h)) * sign(det); return normalize(abs(det) * n - g);
}
fn region(i: i32) -> vec4f { // retangulos do atlas (u0,v0,du,dv)
  let R = array<vec4f, 9>(vec4f(0., .5, .5, .25), vec4f(0., .75, .5, .125), vec4f(0., .875, .5, .0625), vec4f(0., .9375, .5, .0625), vec4f(.5, 0., .25, .0625), vec4f(.75, 0., .125, .0625), vec4f(.5, .0625, .25, .125), vec4f(.5, .1875, .25, .125), vec4f(.75, .0625, .25, .25));
  return R[clamp(i, 0, 8)];
}
fn sdBox(p: vec2f, b: vec2f) -> f32 { let d = abs(p) - b; return length(max(d, vec2f(0.))) + min(max(d.x, d.y), 0.); }
fn shade(i: VO, ff: bool, tearOut: ptr<function, f32>) -> GO {
  let mat = i.mi.x; let ii = i.mi.y; let P = i.op; let inst = I[ii];
  var N = normalize(i.wn); if (!ff) { N = -N; }
  var alb = i.col; var metal = 0.; var rough = .5; var emis = 0.; var h = 0.;
  let an = abs(i.on); var uv = P.xz; if (an.x > an.y && an.x > an.z) { uv = P.zy; } else if (an.z > an.y) { uv = P.xy; }
  let wear = inst.p0.w; let dent = i.dent.x; let edge = i.aux;
  if (mat == 0u || mat == 1u || mat == 21u || mat == 14u) { // pinturas sobre metal
    let n3 = fbm(P * 26. + inst.p1.w); let nf = vn(P * 140.); let n1 = vn(P * 7. + 3.);
    var base = inst.tint.rgb; var mk = inst.tint.a; var cover = 1.;
    if (mat == 1u) { base = i.col; mk = 0.; }
    if (mat == 14u) { let s = fract((i.wp.x + i.wp.y * 1.2 + i.wp.z) * 2.2); base = mix(vec3f(.85, .6, .02), vec3f(.02, .02, .02), smoothstep(.48, .52, s) - smoothstep(.98, 1., s)); mk = 0.; }
    if (mat == 21u && mk > 1.5) { let s = fract((P.x - abs(P.z) * .7) * 2.4 + .1); cover = smoothstep(.0, .02, s) - smoothstep(.34, .36, s); }
    var sc = scratch(uv * 16., inst.p1.w) * (.3 + wear * 1.1);
    let wlow = fbm(P * 7. + inst.p1.w * 1.3);
    let wm = n3 * .28 + nf * .12 + vn(P * 60. + 5.) * .16 + edge * .56 + wear * wlow * .16 + dent * .9;
    var chip = smoothstep(.69, .73, wm); chip = max(chip, smoothstep(.84, .87, fbm(P * 11. + inst.p1.w * 3.) + wear * .05));
    chip = max(chip, smoothstep(.55, .85, sc)); let prim = clamp(smoothstep(.655, .70, wm) - chip, 0., 1.);
    var bare = vec3f(.52, .52, .54); var br = .34;
    if (mk > .5 && mk < 1.5) { bare = vec3f(.86, .87, .88); br = .3; } else if (mk > 1.5) { let tf = vn(P * 9. + 1.7); bare = mix(vec3f(.56, .52, .47), mix(vec3f(.35, .4, .62), vec3f(.62, .45, .3), tf), smoothstep(.45, .9, edge + tf * .5) * .55); br = .3; }
    let streak = vn(vec3f(uv.x * 3., uv.y * 260., 1.));
    let lum0 = dot(base, vec3f(.3, .6, .1)); var palb = mix(vec3f(lum0), base, .66) * (.46 + .2 * n1 + .12 * wlow); var pr = .16 + .34 * wlow + .14 * n1;
    // adesivos / numero
    if (inst.p0.x >= 0. && mat == 21u) {
      var duv = vec2f(-1.);
      if (i.on.y > .5) { duv = vec2f(P.x / inst.p0.y, P.z / inst.p0.z) * .5 + .5; duv = vec2f(duv.x, duv.y * .6875); }
      else if (an.z > .7) { duv = vec2f(P.x / inst.p0.y * sign(i.on.z) * .5 + .5, 1. - clamp(P.y / .22, 0., 1.) * .3125); if (P.y > .215) { duv = vec2f(-1.); } }
      if (duv.x > 0. && duv.x < 1. && duv.y > 0. && duv.y < 1.) { let t = textureSample(atlas, smp, (duv + vec2f(inst.p0.x, 0.)) * vec2f(.25, .25)); palb = mix(palb, t.rgb * (.85 + .15 * n1), t.a); cover = max(cover, t.a); }
    }
    let grime = smoothstep(.5, .85, fbm(P * 4. + 9.) + (1. - clamp(P.y * 6., 0., 1.)) * .22);
    palb = mix(palb, palb * vec3f(.42, .38, .34), grime * .6); pr = mix(pr, .75, grime * .6);
    let streakd = smoothstep(.55, .9, vn(vec3f(P.x * 30., P.y * 3., P.z * 30.) + 2.)) * (1. - abs(i.on.y)); palb *= 1. - streakd * .35;
    let pm = (1. - chip) * cover;
    alb = mix(bare * (.9 + .2 * streak), palb, pm); alb = mix(alb, vec3f(.5, .47, .42) * (.8 + .3 * nf), prim * cover * .8);
    metal = 1. - pm * .62; rough = mix(br + .22 * streak + sc * .1, pr * .8, pm);
    h = pm * .00035 + nf * .00006 + sc * -.0002 + (1. - pm) * streak * .00004;
    if (edge > .95 && mat != 14u) { h += sin(dot(P, vec3f(310., 290., 330.))) * .00012; } // cordao de solda nas arestas
    if (mat == 21u) { // rasgo
      var tear = 0.; for (var k = 0; k < 4; k++) { let d = inst.d[k]; if (d.w > 1.) { let v = P - d.xyz; tear = max(tear, (d.w - 1.) * exp(-dot(v, v) / .0035)); } }
      *tearOut = tear * (.55 + n3 * 1.1 + nf * .3);
      let te = smoothstep(.3, .62, tear * (.55 + n3 * 1.1 + nf * .3)); alb = mix(alb, bare * 1.1, te); metal = max(metal, te); rough = mix(rough, .25, te);
    }
    let hot = dent * inst.p1.y; emis = hot * 2.5; alb = mix(alb, vec3f(1., .35, .05), clamp(hot, 0., 1.) * .8);
  } else if (mat == 2u || mat == 3u || mat == 4u || mat == 13u) { // metais nus
    let streak = vn(vec3f(uv.x * 4., uv.y * 300., 2.)); let n3 = fbm(P * 18.); let sc = scratch(uv * 26., 3.);
    metal = 1.; rough = .3 + .09 * streak + n3 * .1; alb = alb * (.93 + .08 * streak);
    if (mat == 2u) { let rust = smoothstep(.8, .9, n3 * .8 + edge * .1 + vn(P * 60.) * .2) * .7; alb = mix(alb, vec3f(.23, .11, .05) * (.7 + .6 * vn(P * 90.)), rust * .8); metal = 1. - rust * .7; rough = mix(rough, .82, rust);
      let blu = smoothstep(.7, 1., edge) * vn(P * 12.); alb = mix(alb, vec3f(.3, .33, .5), blu * .35); }
    if (mat == 4u) { let tf = vn(P * 9.); alb = mix(alb, mix(vec3f(.35, .4, .62), vec3f(.62, .45, .3), tf), .4); }
    alb += sc * .25; rough = mix(rough, .18, sc * .7) + smoothstep(.8, 1., edge) * .22; h = streak * .00005 - sc * .00015;
    if (edge > .95 && mat == 2u) { h += sin(dot(P, vec3f(310., 290., 330.))) * .0001; }
  } else if (mat == 5u) { // borracha
    let n1 = vn(P * 40.); alb = vec3f(.022) + n1 * .012 + vn(P * 6.) * .02; rough = .82;
    if (edge > .5) { let ang = atan2(P.y, P.x); let g = fract(ang * 9.55 + abs(P.z) * 26. + inst.p1.z * 1.5); let gr = smoothstep(.0, .1, g) - smoothstep(.55, .65, g); h = gr * .0025; alb *= .6 + .5 * gr; let cg = smoothstep(.004, .0, abs(abs(P.z) - .004)); h -= cg * .002; }
    else { h = sin(length(P.xy) * 700.) * .0002; }
    alb = mix(alb, vec3f(.13, .12, .1), smoothstep(.5, .9, fbm(P * 12.)) * .5);
  } else if (mat == 6u) { let n = vn(P * 50.); alb = i.col * (.8 + .4 * n); metal = .85; rough = .38 + n * .2; if (edge > .5) { h = sin((P.x + P.z) * 520.) * .0004; } alb += scratch(uv * 30., 5.) * .12; }
  else if (mat == 7u) { rough = .42; h = vn(P * 300.) * .0002; }
  else if (mat == 8u) { let lab = step(abs(fract(P.x * 9.) - .5), .32) * step(abs(P.y - .06), .025); alb = mix(i.col, vec3f(.03), lab * step(.5, fract(P.z * 22. + P.x * 9.))); alb = mix(alb, vec3f(.03, .03, .035), step(.42, abs(fract(P.z * 6.5) - .5)) * .8); rough = .28 + vn(P * 60.) * .1; h = sin(P.z * 6.5 * 6.283) * .0006; }
  else if (mat == 9u) { emis = edge; }
  else if (mat == 10u) { // piso de aco da arena: material assado em textura + marcas dinamicas
    let q = i.wp.xz; let fuv = q / 14. + .5; let fa = textureSample(floorA, smpA, fuv); let fb = textureSample(floorB, smpA, fuv);
    alb = fa.rgb; metal = fa.a; rough = fb.b; let mk = textureSampleLevel(marks, smp, fuv, 0.);
    alb = mix(alb, vec3f(.015), clamp(mk.r * 1.4, 0., .92)); rough = mix(rough, .62, clamp(mk.r * 1.2, 0., 1.)); metal *= 1. - clamp(mk.r, 0., 1.) * .8;
    let gg = clamp(mk.g * 1.5, 0., 1.); alb = mix(alb, vec3f(.72, .73, .76), gg); rough = mix(rough, .2, gg); metal = max(metal, gg);
    alb *= 1. - clamp(mk.b, 0., 1.) * .8; rough = mix(rough, .85, clamp(mk.b, 0., 1.) * .7);
    let nn = fb.rg * 2. - 1.; N = normalize(vec3f(nn.x, sqrt(max(1. - dot(nn, nn), .01)), nn.y));
  } else if (mat == 11u) { if (edge < .9) { let n = fbm(i.wp * vec3f(1.3, 1.3, 1.3)); let f = vn(i.wp * 40.); alb = i.col * (.7 + .5 * n + .15 * f); rough = mix(.45, .9, smoothstep(.3, .7, n + edge * .5)); h = f * .0004;
      if (F.misc.z > .5 && N.y > .9) { let g = abs(fract(i.wp.xz / 1.5) - .5); let jn = 1. - smoothstep(.003, .008, min(g.x, g.y) * 1.5); alb = mix(alb, vec3f(.04), jn); let ys = 1. - smoothstep(.04, .05, abs(length(i.wp.xz) - 2.1)); alb = mix(alb, vec3f(.75, .55, .03) * (.6 + .5 * n), ys * step(.3, n)); rough = mix(rough, .28, (1. - n) * .6); } }
    else { rough = .95; } }
  else if (mat == 12u || mat == 22u) { rough = select(.85, .55, mat == 22u); alb = i.col * (.8 + .35 * vn(i.wp * 60.)); }
  else if (mat == 15u) { rough = .45; }
  else if (mat == 16u) { let r = region(i32(edge + .5)); let t = textureSample(atlas, smp, r.xy + i.col.rg * r.zw); alb = t.rgb; emis = 5.; rough = .3;
    let px = fract(i.col.rg * vec2f(260., 130.)); let led = smoothstep(.0, .25, px.x) * smoothstep(1., .75, px.x) * smoothstep(.0, .25, px.y) * smoothstep(1., .75, px.y); emis *= mix(1., .55 + .9 * led, clamp(1. - fwidth(i.col.r * 260.) * 1.5, 0., 1.)); }
  else if (mat == 17u) { metal = 1.; rough = .3 + vn(P * 80.) * .15; h = sin(dot(P, vec3f(900., 900., 900.))) * .0002; }
  else if (mat == 18u) { alb = vec3f(.02, .025, .04); rough = .06; }
  else if (mat == 19u) { let g = vn(vec3f(P.x * 3., P.y * 60., P.z * 60.)); alb = i.col * (.6 + .7 * g); rough = .55 + g * .2; alb = mix(alb, alb * .4, smoothstep(.6, .8, fbm(P * 4.))); h = g * .0003; }
  else if (mat == 20u) { let g = fract(uv * 32.) - .5; let hole = 1. - smoothstep(.12, .16, length(g)); alb = i.col * (.85 + .2 * vn(P * 30.)) * (1. - hole * .85); rough = .8; h = -hole * .001; }
  else if (mat == 23u) { let r = region(i32(edge + .5)); let t = textureSample(atlas, smp, r.xy + i.col.rg * r.zw); alb = t.rgb * (.5 + .12 * vn(i.wp * 30.)); rough = .7; emis = .03; }
  // fuligem / queimado
  let burn = inst.p1.x; if (burn > 0.) { let b = clamp(burn * (.5 + fbm(P * 14.)), 0., 1.); alb = mix(alb, vec3f(.012), b * .9); rough = mix(rough, .92, b); metal *= 1. - b * .7; }
  if (h != 0.) { N = bump(N, i.wp, h * 1.4); }
  var o: GO; o.a = vec4f(alb, metal); o.n = vec4f(N, clamp(rough, .045, 1.));
  let c = i.cc.xy / i.cc.w; let p = i.pc.xy / i.pc.w; o.v = vec4f((c - p) * vec2f(.5, -.5), emis, 1.);
  return o;
}
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> GO { var t = 0.; return shade(i, ff, &t); }
@fragment fn fsTear(i: VO, @builtin(front_facing) ff: bool) -> GO { var t = 0.; let o = shade(i, ff, &t); if (t > .62) { discard; } return o; }
@fragment fn fsFlat(i: VO) -> GO { var o: GO; o.a = vec4f(i.col * .5, 0.); o.n = vec4f(normalize(i.wn), .6); let c = i.cc.xy / i.cc.w; let p = i.pc.xy / i.pc.w; o.v = vec4f((c - p) * vec2f(.5, -.5), 0., 1.); return o; }
// ---- policarbonato ----
@group(1) @binding(0) var envT: texture_cube<f32>;
@group(1) @binding(1) var smpC: sampler;
@fragment fn fsGlass(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  var N = normalize(i.wn); let V = normalize(F.cam.xyz - i.wp); if (dot(N, V) < 0.) { N = -N; }
  let nv = max(dot(N, V), 0.); let fr = .04 + .96 * pow(1. - nv, 5.);
  let R = reflect(-V, N); var refl = textureSampleLevel(envT, smpC, R * vec3f(1., 1., -1.), 1.5).rgb;
  var uv = i.wp.xy; if (abs(i.wn.x) > .5) { uv = i.wp.zy; }
  let s1 = scratch(uv * 6., 2.) + scratch(uv * 17., 6.) * .7 + scratch(vec2f(uv.x * 3., uv.y * 30.) , 9.) * .6; let haze = fbm2(uv * 1.4) ; let low = 1. - smoothstep(.45, 1.6, i.wp.y);
  var lit = vec3f(0.);
  for (var k = 0u; k < u32(F.misc2.y); k++) { let L = F.lights[k]; let d = L.pos.xyz - i.wp; let dl = length(d); let dn = d / dl; var a = L.col.rgb / (dl * dl + 1.);
    if (L.ext.y < .5) { a *= smoothstep(L.dir.w, L.col.w, dot(-dn, L.dir.xyz)); } lit += a * (.3 + .7 * pow(max(dot(reflect(-dn, N), V), 0.), 6.) + .4 * pow(max(dot(-dn, V), 0.), 4.)); }
  let scat = clamp(s1 * .3 * smoothstep(.35, .7, haze + low * .4) + haze * haze * .03 + low * (.03 + .08 * haze) + .004, 0., 1.);
  let col = refl * fr + lit * scat * .16 + vec3f(.5, .6, .65) * .0015;
  let a = clamp(fr * .6 + scat * .2 + .012, 0., 1.);
  return vec4f(col, a);
}
`;

const WGSL_FS_TRI_SRC = /* wgsl */`
struct FSO { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vsFS(@builtin(vertex_index) i: u32) -> FSO { var o: FSO; let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); o.pos = vec4f(p * 2. - 1., 0., 1.); o.uv = vec2f(p.x, 1. - p.y); return o; }
`;

const WGSL_FS_TRI = WGSL_FS_TRI_SRC;
const WGSL_LIGHT = WGSL_COMMON + WGSL_FS_TRI + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var gA: texture_2d<f32>;
@group(0) @binding(2) var gN: texture_2d<f32>;
@group(0) @binding(3) var gV: texture_2d<f32>;
@group(0) @binding(4) var gD: texture_depth_2d;
@group(0) @binding(5) var shT: texture_depth_2d_array;
@group(0) @binding(6) var shS: sampler_comparison;
@group(0) @binding(7) var envT: texture_cube<f32>;
@group(0) @binding(8) var smpC: sampler;
@group(0) @binding(9) var prevT: texture_2d<f32>;
fn wpos(uv: vec2f, d: f32) -> vec3f { let p = F.ivpJ * vec4f(uv.x * 2. - 1., 1. - uv.y * 2., d, 1.); return p.xyz / p.w; }
fn ld(px: vec2i) -> f32 { return textureLoad(gD, clamp(px, vec2i(0), vec2i(F.res.xy) - 1), 0); }
fn shadow(k: i32, P: vec3f, N: vec3f, rot: f32) -> f32 {
  let q = F.svp[k] * vec4f(P + N * .012, 1.); let s = q.xyz / q.w; let uv = s.xy * vec2f(.5, -.5) + .5;
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1. || s.z > 1.) { return 1.; }
  let c = cos(rot); let sn = sin(rot); var a = 0.; let r = 1.1 / 2048.;
  let o = array<vec2f, 4>(vec2f(-.6, -.25), vec2f(.25, -.6), vec2f(.6, .25), vec2f(-.25, .6));
  for (var j = 0; j < 4; j++) { let d = vec2f(o[j].x * c - o[j].y * sn, o[j].x * sn + o[j].y * c) * r; a += textureSampleCompareLevel(shT, shS, uv + d, k, s.z - .00035); }
  return a * .25;
}
fn ggx(N: vec3f, V: vec3f, L: vec3f, r: f32, F0: vec3f) -> vec3f {
  let H = normalize(V + L); let nh = max(dot(N, H), 0.); let nv = max(dot(N, V), .001); let nl = max(dot(N, L), 0.); let a = r * r; let a2 = a * a;
  let d = nh * nh * (a2 - 1.) + 1.; let D = a2 / (PI * d * d); let k = (r + 1.) * (r + 1.) / 8.; let G = 1. / ((nv * (1. - k) + k) * (nl * (1. - k) + k));
  let Fr = F0 + (1. - F0) * pow(1. - max(dot(V, H), 0.), 5.); return Fr * (D * G * .25);
}
@fragment fn fs(i: FSO) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); let d = textureLoad(gD, px, 0);
  if (d >= 1.) { return vec4f(0., 0., 0., 1.); }
  let A = textureLoad(gA, px, 0); let Nr = textureLoad(gN, px, 0); let Vv = textureLoad(gV, px, 0);
  let P = wpos(i.uv, d); let N = normalize(Nr.xyz); let rough = Nr.w; let metal = A.a; let alb = A.rgb;
  if (F.fx.y > .5 && F.fx.y < 1.5) { return vec4f(alb, 1.); } if (F.fx.y > 1.5 && F.fx.y < 2.5) { return vec4f(N * .5 + .5, 1.); } if (F.fx.y > 2.5 && F.fx.y < 3.5) { return vec4f(vec3f(rough, metal, Vv.z * .1), 1.); }
  let V = normalize(F.cam.xyz - P); let F0 = mix(vec3f(.04), alb, metal); let dif = alb * (1. - metal) / PI;
  let fr = F.misc.y; let noise = ign(i.pos.xy, fr); let dist = length(F.cam.xyz - P);
  // oclusao de ambiente (SAO)
  var ao = 0.; let rad = .5; let prad = rad * F.pp.y * F.res.y * .5 / max(dist, .3);
  if (F.misc2.z > .5) { let na = noise * 6.283; for (var k = 0; k < 9; k++) { let t = (f32(k) + .5) / 9.; let a = na + t * 6.283 * 2.4; let o = vec2f(cos(a), sin(a)) * (t * prad + 1.5);
    let sp = px + vec2i(o); let sd = ld(sp); let Q = wpos((vec2f(sp) + .5) * F.res.zw, sd); let v = Q - P; let l2 = dot(v, v);
    ao += max(0., dot(N, v) / sqrt(l2 + 1e-6) - .08) / (1. + l2 / (rad * rad) * 3.); } ao = clamp(1. - ao / 9. * 2.9, 0., 1.); ao = ao * ao; } else { ao = 1.; }
  var col = vec3f(0.);
  let nL = i32(F.misc2.y);
  for (var k = 0; k < nL; k++) { let L = F.lights[k]; let lv = L.pos.xyz - P; let dl = length(lv); let ln = lv / dl; let nl = dot(N, ln); if (nl <= 0.) { continue; }
    var a = 1. / (dl * dl + .05);
    if (L.ext.y < .5) { a *= smoothstep(L.dir.w, L.col.w, dot(-ln, L.dir.xyz)); } else { let f = clamp(1. - dl / L.pos.w, 0., 1.); a *= f * f; }
    if (a < .00002) { continue; }
    if (L.ext.x >= 0.) { a *= shadow(i32(L.ext.x), P, N, noise * 6.283 + f32(k)); }
    col += (dif + ggx(N, V, ln, max(rough, .06), F0)) * L.col.rgb * (a * nl);
  }
  // ambiente: cubo de ambiente + reflexo no espaco de tela
  let rj = vec3f(ign(i.pos.xy + 17., fr), ign(i.pos.xy + 41., fr + 3.), ign(i.pos.xy + 73., fr + 7.)) - .5;
  let R = normalize(reflect(-V, N) + rj * rough * rough * .7); let nv = max(dot(N, V), 0.);
  let irr = textureSampleLevel(envT, smpC, N * vec3f(1., 1., -1.), 5.).rgb * 2.4 + vec3f(.03, .032, .038) * (.6 + .4 * N.y);
  var spec = textureSampleLevel(envT, smpC, R * vec3f(1., 1., -1.), rough * 5.).rgb; var hitc = 0.;
  if (rough < .62 && F.misc2.z > .5) {
    var t = .04 + noise * .06; var hit = false; var huv = vec2f(0.); var st = .07; var tp = 0.;
    for (var k = 0; k < 22; k++) { tp = t; t += st; st *= 1.22; let q = F.vpJ * vec4f(P + R * t, 1.); if (q.w <= 0.) { break; } let s = q.xyz / q.w; let uv = s.xy * vec2f(.5, -.5) + .5;
      if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) { break; } let sd = ld(vec2i(uv * F.res.xy));
      if (s.z > sd + .00002) { let zl = F.pp.z * F.pp.w / (F.pp.w - s.z * (F.pp.w - F.pp.z)); let zs = F.pp.z * F.pp.w / (F.pp.w - sd * (F.pp.w - F.pp.z)); if (zl - zs < .35 + st * 1.2) { hit = true; huv = uv;
          var lo = tp; var hi = t; for (var b = 0; b < 4; b++) { let m = (lo + hi) * .5; let q2 = F.vpJ * vec4f(P + R * m, 1.); let s2 = q2.xyz / q2.w; let u2 = s2.xy * vec2f(.5, -.5) + .5; if (s2.z > ld(vec2i(u2 * F.res.xy))) { hi = m; huv = u2; } else { lo = m; } } } break; } }
    if (hit) { let hv = textureLoad(gV, vec2i(huv * F.res.xy), 0).xy; let puv = huv - hv; let e = min(min(puv.x, 1. - puv.x), min(puv.y, 1. - puv.y));
      hitc = smoothstep(0., .08, e) * (1. - smoothstep(.45, .62, rough)); let sc = textureSampleLevel(prevT, smpC, puv, rough * 5.).rgb; spec = mix(spec, min(sc, vec3f(24.)), hitc); }
  }
  let ef = F0 + (max(vec3f(1. - rough), F0) - F0) * pow(1. - nv, 5.); let so = mix(ao, 1., hitc * .5) * clamp(pow(nv + ao, 2.) - 1. + ao, 0., 1.);
  col += irr * alb * (1. - metal) * ao * F.misc.w + spec * ef * mix(1., .55, rough) * max(so, .25 * ao);
  col += alb * Vv.z;
  return vec4f(col, 1.);
}
`;

const WGSL_VOL = WGSL_COMMON + WGSL_FS_TRI + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var gD: texture_depth_2d;
@group(0) @binding(2) var shT: texture_depth_2d_array;
@group(0) @binding(3) var shS: sampler_comparison;
@fragment fn fs(i: FSO) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy) * 2; let d = textureLoad(gD, min(px, vec2i(F.res.xy) - 1), 0);
  let pf = F.ivpJ * vec4f(i.uv.x * 2. - 1., 1. - i.uv.y * 2., min(d, .99995), 1.); let P1 = pf.xyz / pf.w; let ro = F.cam.xyz; var rd = P1 - ro; var tmax = min(length(rd), 34.); rd = normalize(rd);
  let n = ign(i.pos.xy, F.misc.y); let NS = 8; let dt = tmax / f32(NS); var acc = vec3f(0.); let time = F.cam.w;
  for (var s = 0; s < NS; s++) { let t = (f32(s) + n) * dt; let p = ro + rd * t;
    let dens = F.fx.x * (.55 + 1.1 * vn(p * .55 + vec3f(time * .05, -time * .03, time * .04)) * smoothstep(9., 1., p.y));
    for (var k = 0; k < 6; k++) { let L = F.lights[k]; if (L.ext.z < .5) { continue; } let lv = L.pos.xyz - p; let dl = length(lv); let ln = lv / dl; let cone = smoothstep(L.dir.w, L.col.w, dot(-ln, L.dir.xyz)); if (cone <= 0.) { continue; }
      var a = cone / (dl * dl + 1.);
      if (L.ext.x >= 0.) { let q = F.svp[i32(L.ext.x)] * vec4f(p, 1.); let sp = q.xyz / q.w; a *= textureSampleCompareLevel(shT, shS, sp.xy * vec2f(.5, -.5) + .5, i32(L.ext.x), sp.z - .0004); }
      let cs = dot(rd, ln); let ph = .12 + .5 * pow(max(cs, 0.), 3.); acc += L.col.rgb * (a * ph * dens * dt); } }
  return vec4f(acc, 1.);
}
`;

const WGSL_POST = WGSL_COMMON + WGSL_FS_TRI + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var t0: texture_2d<f32>;
@group(0) @binding(2) var t1: texture_2d<f32>;
@group(0) @binding(3) var t2: texture_2d<f32>;
@group(0) @binding(4) var gD: texture_depth_2d;
@group(0) @binding(5) var smpC: sampler;
// composicao do volumetrico (meia resolucao) sobre a cena
@fragment fn fsVolUp(i: FSO) -> @location(0) vec4f { return vec4f(textureSampleLevel(t0, smpC, i.uv, 0.).rgb * step(F.fx.y, .5), 0.); }
fn tm(c: vec3f) -> vec3f { return c / (1. + max(c.r, max(c.g, c.b))); }
fn itm(c: vec3f) -> vec3f { return c / max(1. - max(c.r, max(c.g, c.b)), .001); }
fn ycc(c: vec3f) -> vec3f { return vec3f(dot(c, vec3f(.25, .5, .25)), dot(c, vec3f(.5, 0., -.5)), dot(c, vec3f(-.25, .5, -.25))); }
fn rgb(c: vec3f) -> vec3f { return vec3f(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
fn cur(px: vec2i) -> vec3f { return ycc(tm(textureLoad(t0, clamp(px, vec2i(0), vec2i(F.res.xy) - 1), 0).rgb)); }
// TAA: t0 atual, t1 historico, t2 velocidade
@fragment fn fsTAA(i: FSO) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy);
  var best = 1.; var bo = vec2i(0);
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) { let dd = textureLoad(gD, clamp(px + vec2i(x, y), vec2i(0), vec2i(F.res.xy) - 1), 0); if (dd < best) { best = dd; bo = vec2i(x, y); } } }
  var vel = textureLoad(t2, clamp(px + bo, vec2i(0), vec2i(F.res.xy) - 1), 0).xy;
  if (best >= 1.) { let q = F.ivpJ * vec4f(i.uv.x * 2. - 1., 1. - i.uv.y * 2., 1., 1.); let w = q.xyz / q.w; let pc = F.pvp * vec4f(w, 1.); let cc = F.vp * vec4f(w, 1.); vel = (cc.xy / cc.w - pc.xy / pc.w) * vec2f(.5, -.5); }
  let c = cur(px); var m1 = c; var m2 = c * c; var mn = c; var mx = c;
  let offs = array<vec2i, 8>(vec2i(-1, 0), vec2i(1, 0), vec2i(0, -1), vec2i(0, 1), vec2i(-1, -1), vec2i(1, -1), vec2i(-1, 1), vec2i(1, 1));
  for (var k = 0; k < 8; k++) { let s = cur(px + offs[k]); m1 += s; m2 += s * s; mn = min(mn, s); mx = max(mx, s); }
  m1 /= 9.; let sg = sqrt(max(m2 / 9. - m1 * m1, vec3f(0.))); let lo = max(mn, m1 - sg * 1.25); let hi = min(mx, m1 + sg * 1.25);
  let puv = i.uv - vel - F.jit.xy * vec2f(.5, -.5) * 0.;
  if (puv.x < 0. || puv.x > 1. || puv.y < 0. || puv.y > 1. || F.misc2.w > .5) { return vec4f(itm(rgb(c)), 1.); }
  // historico com filtro Catmull-Rom (5 amostras)
  let sp = puv * F.res.xy; let tc = floor(sp - .5) + .5; let f = sp - tc; let w0 = f * (-.5 + f * (1. - .5 * f)); let w1 = 1. + f * f * (-2.5 + 1.5 * f); let w2 = f * (.5 + f * (2. - 1.5 * f)); let w3 = f * f * (-.5 + .5 * f);
  let w12 = w1 + w2; let tc0 = (tc - 1.) * F.res.zw; let tc3 = (tc + 2.) * F.res.zw; let tc12 = (tc + w2 / w12) * F.res.zw;
  var hsum = textureSampleLevel(t1, smpC, vec2f(tc12.x, tc0.y), 0.).rgb * (w12.x * w0.y) + textureSampleLevel(t1, smpC, vec2f(tc0.x, tc12.y), 0.).rgb * (w0.x * w12.y) + textureSampleLevel(t1, smpC, tc12, 0.).rgb * (w12.x * w12.y)
    + textureSampleLevel(t1, smpC, vec2f(tc3.x, tc12.y), 0.).rgb * (w3.x * w12.y) + textureSampleLevel(t1, smpC, vec2f(tc12.x, tc3.y), 0.).rgb * (w12.x * w3.y);
  hsum /= (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);
  var h = ycc(tm(max(hsum, vec3f(0.))));
  // recorte para a caixa de variancia (em direcao ao centro)
  let cen = (lo + hi) * .5; let ext = (hi - lo) * .5 + 1e-5; let dv = h - cen; let u = abs(dv / ext); let mu = max(u.x, max(u.y, u.z)); if (mu > 1.) { h = cen + dv / mu; }
  let spd = length(vel * F.res.xy); let a = mix(.06, .16, clamp(spd * .08, 0., 1.));
  return vec4f(max(itm(rgb(mix(h, c, a))), vec3f(0.)), 1.);
}
// bloom: reducao com limiar (t0), reducao simples, ampliacao
fn ds(uv: vec2f, ts: vec2f) -> vec3f { return (textureSampleLevel(t0, smpC, uv + ts * vec2f(-1., -1.), 0.).rgb + textureSampleLevel(t0, smpC, uv + ts * vec2f(1., -1.), 0.).rgb + textureSampleLevel(t0, smpC, uv + ts * vec2f(-1., 1.), 0.).rgb + textureSampleLevel(t0, smpC, uv + ts * vec2f(1., 1.), 0.).rgb) * .25; }
@fragment fn fsBloom0(i: FSO) -> @location(0) vec4f { let ts = 1. / vec2f(textureDimensions(t0)); var s = vec3f(0.); var ws = 0.;
  for (var k = 0; k < 4; k++) { let o = vec2f(f32(k & 1) * 2. - 1., f32(k >> 1) * 2. - 1.); let c = min(textureSampleLevel(t0, smpC, i.uv + ts * o, 0.).rgb, vec3f(60.)); let l = max(c.r, max(c.g, c.b)); let w = 1. / (1. + l); s += c * w * smoothstep(1.6, 4.5, l); ws += w; }
  return vec4f(s / ws, 1.); }
@fragment fn fsBloomD(i: FSO) -> @location(0) vec4f { let ts = 1. / vec2f(textureDimensions(t0)); return vec4f((ds(i.uv, ts) * 2. + ds(i.uv, ts * 2.5)) / 3., 1.); }
@fragment fn fsBloomU(i: FSO) -> @location(0) vec4f { let ts = 1. / vec2f(textureDimensions(t0)); return vec4f(ds(i.uv, ts * 1.2), 1.); }
// final: desfoque de movimento + bloom + tom + granulacao.  t0 cena, t1 bloom, t2 velocidade
fn aces(x: vec3f) -> vec3f { let a = x * (x + .0245786) - .000090537; let b = x * (.983729 * x + .4329510) + .238081; return a / b; }
fn tone(c0: vec3f) -> vec3f { var c = mat3x3f(.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777) * c0; c = aces(c);
  return clamp(mat3x3f(1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602) * c, vec3f(0.), vec3f(1.)); }
@fragment fn fsFinal(i: FSO) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); var vel = textureLoad(t2, px, 0).xy * F.misc2.x; let d0 = textureLoad(gD, px, 0);
  if (F.fx.y > .5 && F.fx.y < 3.5) { return vec4f(pow(clamp(textureLoad(t0, px, 0).rgb, vec3f(0.), vec3f(1.)), vec3f(1. / 2.2)), 1.); }
  let vl0 = length(vel * F.res.xy); let mxl = F.res.y * .007; if (vl0 > mxl) { vel *= mxl / vl0; } let vl = min(vl0, mxl);
  var c = textureSampleLevel(t0, smpC, i.uv, 0.).rgb;
  if (vl > .7) { let n = ign(i.pos.xy, F.misc.y) - .5; var ws = 1.; for (var k = 0; k < 10; k++) { let t = (f32(k) + .5 + n) / 10. - .5; let uv = i.uv + vel * t; let sv = textureLoad(t2, vec2i(uv * F.res.xy), 0).xy * F.misc2.x; let sd = textureLoad(gD, vec2i(uv * F.res.xy), 0);
      let w = select(clamp(length(sv * F.res.xy) / max(vl, 1.) + .1, 0., 1.), 1., sd <= d0 + .0002); c += textureSampleLevel(t0, smpC, uv, 0.).rgb * w; ws += w; } c /= ws; }
  // nitidez leve
  let nb = (textureSampleLevel(t0, smpC, i.uv + vec2f(F.res.z, 0.), 0.).rgb + textureSampleLevel(t0, smpC, i.uv - vec2f(F.res.z, 0.), 0.).rgb + textureSampleLevel(t0, smpC, i.uv + vec2f(0., F.res.w), 0.).rgb + textureSampleLevel(t0, smpC, i.uv - vec2f(0., F.res.w), 0.).rgb) * .25;
  let c0 = textureSampleLevel(t0, smpC, i.uv, 0.).rgb; c += clamp((c0 - nb) * .12, vec3f(-.3), vec3f(.3)) * step(vl, 2.) ;
  c = max(c, vec3f(0.)) + textureSampleLevel(t1, smpC, i.uv, 0.).rgb * .075;
  let q = i.uv - .5; let vig = 1. - dot(q, q) * .55; c *= F.misc.x * vig * vig;
  c = tone(c * .82); c = mix(c, c * c * (3. - 2. * c), .08);
  let l = dot(c, vec3f(.2126, .7152, .0722)); c = mix(vec3f(l), c, 1.06) * vec3f(1.01, 1., .985);
  c = pow(clamp(c, vec3f(0.), vec3f(1.)), vec3f(1. / 2.2));
  c += (h21(i.pos.xy + F.misc.y * 7.13) - .5) * .014 + (h21(i.pos.xy * 1.7) - .5) / 255.;
  c = mix(c, vec3f(1.), F.pp.x);
  return vec4f(c, 1.);
}
`;

const WGSL_FX = WGSL_COMMON + /* wgsl */`
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var gD: texture_depth_2d;
// particulas: pos+tamanho, vel+tipo, cor+alfa.  tipo: 0 faisca, 1 lasca, 2 fumaca, 3 fogo
struct PO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) @interpolate(flat) kind: f32, @location(3) sd: f32, @location(4) zl: f32 }
@vertex fn vsP(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f, @location(2) c: vec4f) -> PO {
  var o: PO; let q = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2. - 1.; let kind = b.w; let toC = normalize(F.cam.xyz - a.xyz);
  var wp = a.xyz; var col = c;
  if (kind < 1.5) { let sp = length(b.xyz); let dir = b.xyz / max(sp, .001); let side = normalize(cross(dir, toC)); let dc = distance(F.cam.xyz, a.xyz); let wd = min(a.w, dc * .0035); let len = min(max(wd, sp * select(.014, .006, kind > .5)), dc * .09 + .02); wp += side * q.x * wd + dir * q.y * len; }
  else { let r = F.view; let rt = vec3f(r[0][0], r[1][0], r[2][0]); let up = vec3f(r[0][1], r[1][1], r[2][1]); let rot = b.x; let cs = cos(rot); let sn = sin(rot); wp += (rt * (q.x * cs - q.y * sn) + up * (q.x * sn + q.y * cs)) * a.w;
    if (kind < 2.5) { var lit = vec3f(.02, .022, .025); for (var k = 0u; k < u32(F.misc2.y); k++) { let L = F.lights[k]; let d = L.pos.xyz - a.xyz; let dl = length(d); var at = 1. / (dl * dl + 1.); if (L.ext.y < .5) { at *= smoothstep(L.dir.w, L.col.w, dot(-d / dl, L.dir.xyz)); } else { let f = clamp(1. - dl / L.pos.w, 0., 1.); at *= f * f; } lit += L.col.rgb * at * .09; } col = vec4f(c.rgb * lit, c.a); } }
  o.pos = F.vp * vec4f(wp, 1.); o.uv = q; o.col = col; o.kind = kind; o.sd = b.y; o.zl = o.pos.w; return o;
}
@fragment fn fsP(i: PO) -> @location(0) vec4f {
  let d = textureLoad(gD, vec2i(i.pos.xy), 0); let zs = F.pp.z * F.pp.w / (F.pp.w - d * (F.pp.w - F.pp.z));
  if (i.zl > zs + .02) { discard; }
  let r2 = dot(i.uv, i.uv);
  if (i.kind < .5) { let f = (1. - abs(i.uv.x)) * (1. - i.uv.y * i.uv.y); return vec4f(i.col.rgb * f * f * i.col.a, 0.); }
  if (i.kind < 1.5) { let f = step(abs(i.uv.x), .7); return vec4f(i.col.rgb * f * i.col.a, f * i.col.a); }
  let soft = clamp((zs - i.zl) * 4., 0., 1.);
  let n = fbm2(i.uv * 1.3 + i.sd * 37.) ; let m = smoothstep(0., 1., clamp((1. - sqrt(r2)) * 1.3 - (1. - n * 1.5) * .4, 0., 1.)) * (1. - r2);
  if (i.kind < 2.5) { let a = m * i.col.a * soft; return vec4f(i.col.rgb * a, a); }
  let fn2 = fbm2(vec2f(i.uv.x * 2.2 + i.sd * 11., i.uv.y * 1.1 - i.sd * 5.)); let fl = clamp((1. - r2) * 1.6 - (1. - fn2 * 1.9) * 1.1, 0., 1.) * smoothstep(-1., -.3, i.uv.y); let heat = fl * i.col.a; let fc = mix(vec3f(1., .12, .01), vec3f(1., .62, .18), heat) * heat * heat * 1.5;
  return vec4f(fc * soft, 0.);
}
// marcas no piso: segmento (x0,z0,x1,z1) + (largura, canal, intensidade)
struct MO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) c: vec3f }
@vertex fn vsM(@builtin(vertex_index) vi: u32, @location(0) a: vec4f, @location(1) b: vec4f) -> MO {
  var o: MO; let q = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2. - 1.; var dir = a.zw - a.xy; let l = length(dir); dir = select(vec2f(1., 0.), dir / max(l, 1e-5), l > 1e-5); let sd = vec2f(-dir.y, dir.x);
  let p = (a.xy + a.zw) * .5 + dir * q.y * (l * .5 + b.x * .5) + sd * q.x * b.x; o.pos = vec4f(p.x / ${AR}., -p.y / ${AR}., 0., 1.); o.uv = q;
  o.c = vec3f(f32(b.y < .5), f32(b.y > .5 && b.y < 1.5), f32(b.y > 1.5)) * b.z; return o; }
@fragment fn fsM(i: MO) -> @location(0) vec4f { let f = (1. - smoothstep(.55, 1., abs(i.uv.x))) * (.6 + .4 * h21(i.pos.xy)); return vec4f(i.c * f, 1.); }
`;

const WGSL_ENV = WGSL_FS_TRI + /* wgsl */`
@group(0) @binding(0) var src: texture_cube<f32>;
@group(0) @binding(1) var smpC: sampler;
@group(0) @binding(2) var<uniform> U: vec4f; // face, cone, _, _
fn dirOf(face: i32, uv: vec2f) -> vec3f { let a = uv.x * 2. - 1.; let b = 1. - uv.y * 2.;
  if (face == 0) { return vec3f(1., b, -a); } if (face == 1) { return vec3f(-1., b, a); } if (face == 2) { return vec3f(a, 1., -b); } if (face == 3) { return vec3f(a, -1., b); } if (face == 4) { return vec3f(a, b, 1.); } return vec3f(-a, b, -1.); }
@fragment fn fs(i: FSO) -> @location(0) vec4f {
  let N = normalize(dirOf(i32(U.x), i.uv)); let t = normalize(cross(N, vec3f(.3, .9, .31))); let b = cross(N, t); var s = vec3f(0.); var ws = 0.;
  for (var k = 0; k < 24; k++) { let r = sqrt((f32(k) + .5) / 24.) * U.y; let a = f32(k) * 2.39996; let d = normalize(N + (t * cos(a) + b * sin(a)) * r); let w = 1.; s += min(textureSampleLevel(src, smpC, d, U.z).rgb, vec3f(40.)) * w; ws += w; }
  return vec4f(s / ws, 1.);
}
`;

const WGSL_FLOOR = WGSL_COMMON + WGSL_FS_TRI_SRC + /* wgsl */`
fn sdBox(p: vec2f, b: vec2f) -> f32 { let d = abs(p) - b; return length(max(d, vec2f(0.))) + min(max(d.x, d.y), 0.); }
struct FO { @location(0) a: vec4f, @location(1) b: vec4f }
fn fl(q: vec2f) -> array<vec4f, 2> {
  var alb: vec3f; var metal = 1.; var rough = .4; var h = 0.;
  let pl = q / 1.75 + .5; let cell = floor(pl); let fp = fract(pl) - .5; let ed = (.5 - max(abs(fp.x), abs(fp.y))) * 1.75;
  let seam = 1. - smoothstep(.003, .008, ed); let hr = h21(cell);
  let n_l = fbm2(q * .5 + 3.); let n_m = fbm2(q * 3. + hr * 20.); let n_f = vn2(q * 120.);
  let wearP = smoothstep(.3, .65, n_l + (1. - smoothstep(1.5, 7.5, length(q))) * .22);
  let dir = floor(hr * 4.) * .7854 + .2; let sq = vec2f(q.x * cos(dir) + q.y * sin(dir), -q.x * sin(dir) + q.y * cos(dir));
  let brushed = vn2(vec2f(sq.x * 3., sq.y * 380.)) * .6 + vn2(vec2f(sq.x * 9., sq.y * 900.)) * .4;
  let sc = scratch(q * 4., 1.) + scratch(q * 11., 4.) * .8 + scratch(q * 27., 7.) * .5;
  alb = vec3f(.25, .255, .265) * (.84 + .12 * hr + .14 * brushed); rough = mix(.5, .3, wearP) + (brushed - .5) * .07 + (n_m - .5) * .08;
  let oil = smoothstep(.7, .78, fbm2(q * 1.1 + 40.)); alb = mix(alb, alb * vec3f(.45, .42, .38), oil * .6); rough = mix(rough, .1, oil * .7);
  let rust = smoothstep(.74, .86, n_m * .6 + seam * .3 + fbm2(q * 14.) * .4) * .5; alb = mix(alb, vec3f(.2, .11, .06), rust); rough = mix(rough, .7, rust); metal = 1. - rust * .6;
  var pc = vec3f(0.); var pa = 0.;
  for (var s = -1.; s <= 1.; s += 2.) { let d = sdBox(q - vec2f(s * 5., 0.), vec2f(1.05)); let l = 1. - smoothstep(.04, .046, abs(d)); let col = select(vec3f(.04, .13, .6), vec3f(.6, .04, .025), s < 0.); pc = mix(pc, col, l); pa = max(pa, l); let f = (1. - smoothstep(0., .006, d + .12)) * step(.5, fract((q.x + q.y) * 2.5)) * .85; pc = mix(pc, col, f); pa = max(pa, f); }
  let rc = length(q); let ring = 1. - smoothstep(.04, .046, abs(rc - 1.7)); let ang = atan2(q.y, q.x);
  let gear = 1. - smoothstep(.0, .008, abs(rc - (.95 + .1 * smoothstep(.3, .34, abs(fract(ang * 1.9099) - .5)))) - .035); let hub = 1. - smoothstep(.03, .036, abs(rc - .38));
  let em = max(ring, hub * 0. + gear * 0.); pc = mix(pc, vec3f(.62, .6, .55), em); pa = max(pa, em);
  let dp = sdBox(q - vec2f(${PIT.x}, ${PIT.z}), vec2f(${PIT.h})); let hz = (1. - smoothstep(.34, .346, dp)) * step(0., dp);
  let dsw = sdBox(q - vec2f(4.3, -4.3), vec2f(1.15, .55)); let hz2 = 1. - smoothstep(.0, .006, abs(dsw) - .07);
  let dfl = length(q - vec2f(${FLAME.x}, ${FLAME.z})) - ${FLAME.r}; let hz3 = 1. - smoothstep(.0, .006, abs(dfl) - .07);
  let dhm = length(q - vec2f(${AHAM.hx}, ${AHAM.hz})) - ${AHAM.r}; let hz4 = 1. - smoothstep(.0, .006, abs(dhm) - .07);
  let hzA = max(max(hz, hz2), max(hz3, hz4)); let st = smoothstep(.47, .5, abs(fract((q.x + q.y) * 3.3) - .5)); pc = mix(pc, mix(vec3f(.72, .5, .02), vec3f(.02), st), hzA); pa = max(pa, hzA);
  let pwear = smoothstep(.45, .8, n_m * .7 + n_f * .25 + wearP * .3 + sc * .7 + fbm2(q * 40.) * .25); pa *= 1. - pwear * .9;
  alb = mix(alb, pc * (.85 + .2 * n_f), pa); metal *= 1. - pa; rough = mix(rough, .4 + n_f * .15, pa);
  let scl = clamp(sc, 0., 1.) * (1. - pa * .6); alb = mix(alb, vec3f(.55, .55, .58), scl * .5); rough = mix(rough, .16, scl * .6);
  alb = mix(alb, vec3f(.025), seam * .9); rough = mix(rough, .8, seam); metal *= 1. - seam * .5;
  let bq = abs(fp) * 1.75 - vec2f(.875 - .11); let bd = length(bq); let bolt = 1. - smoothstep(.016, .019, bd); alb = mix(alb, vec3f(.46), bolt * .85); rough = mix(rough, .3, bolt);
  let bring = (1. - smoothstep(.0, .004, abs(bd - .022))) * .6; alb *= 1. - bring;
  h = -seam * .004 + bolt * .002 + brushed * .00005 - scl * .00025 + pa * .00015 - bring * .001;
  return array<vec4f, 2>(vec4f(alb, metal), vec4f(h, rough, 0., 0.));
}
@fragment fn fs(i: FSO) -> FO {
  let q = (i.uv - .5) * 14.; let e = 14. / 4096.; let c = fl(q); let hx = fl(q + vec2f(e, 0.))[1].x; let hz = fl(q + vec2f(0., e))[1].x; let h0 = c[1].x;
  let n = normalize(vec3f(-(hx - h0) / e * .8, 1., -(hz - h0) / e * .8));
  var o: FO; o.a = c[0]; o.b = vec4f(n.x * .5 + .5, n.z * .5 + .5, clamp(c[1].y, .05, 1.), 1.); return o;
}
`;
const WGSL_BLIT = WGSL_FS_TRI_SRC + /* wgsl */`
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smpC: sampler;
@fragment fn fsDown(i: FSO) -> @location(0) vec4f { return textureSampleLevel(src, smpC, i.uv, 0.); }
`;
