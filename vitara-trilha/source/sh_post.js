// sh_post.js — sombras, oclusão, iluminação diferida, névoa volumétrica, TAA, desfoque de movimento, bloom, saída
function wgShadow(g, bt, bs) {
  return /* wgsl */`
@group(${g}) @binding(${bt}) var shT: texture_depth_2d_array;
@group(${g}) @binding(${bs}) var shS: sampler_comparison;
const PD = array<vec2f, 8>(vec2f(-0.326, -0.406), vec2f(-0.840, -0.074), vec2f(-0.696, 0.457), vec2f(-0.203, 0.621), vec2f(0.962, -0.195), vec2f(0.473, -0.480), vec2f(0.519, 0.767), vec2f(0.185, -0.893));
fn shadowAt(wp: vec3f, N: vec3f, vz: f32, noise: f32, taps: i32) -> f32 {
  if (vz > F.split.z) { return 1.0; }
  var c = 0; if (vz > F.split.x) { c = 1; } if (vz > F.split.y) { c = 2; }
  let ts = F.shTex[c]; let ndl = sat(dot(N, F.sun.xyz));
  let q = wp + N * (ts * (1.2 + 2.0 * (1.0 - ndl))) + F.sun.xyz * ts * 0.7;
  let sp = F.svp[c] * vec4f(q, 1.0); let uv = sp.xy * vec2f(0.5, -0.5) + 0.5;
  let a = noise * 6.2832; let cs = cos(a); let sn = sin(a); let rad = (1.5 + f32(c) * 0.35) / 2048.0; var s = 0.0;
  for (var k = 0; k < taps; k++) { let o = PD[k]; s += textureSampleCompareLevel(shT, shS, uv + vec2f(o.x * cs - o.y * sn, o.x * sn + o.y * cs) * rad, c, sp.z); }
  s /= f32(taps);
  return mix(s, 1.0, smoothstep(F.split.z * 0.85, F.split.z, vz));
}
`;
}
const WG_VIEWPOS = /* wgsl */`
fn viewPos(uv: vec2f, d: f32) -> vec3f { let z = F.misc.z / max(d, 1e-7); let a = F.res.x * F.res.w; return vec3f((uv.x * 2.0 - 1.0) * z * F.misc.w * a, (1.0 - uv.y * 2.0) * z * F.misc.w, -z); }
`;
const WG_AO = WG_COMMON + FS_TRI + WG_VIEWPOS + /* wgsl */`
@group(1) @binding(0) var depthT: texture_depth_2d;
@group(1) @binding(1) var nrmT: texture_2d<f32>;
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy) * 2; let d = textureLoad(depthT, px, 0); if (d <= 0.0) { return vec4f(1.0); }
  let res = vec2i(F.res.xy); let P = viewPos(i.uv, d); let Nw = textureLoad(nrmT, px, 0).xyz; let N = normalize((F.view * vec4f(Nw, 0.0)).xyz);
  let R = clamp(-P.z * 0.10, 0.25, 1.6); let rUV = R / (-P.z * F.misc.w) * 0.5; let asp = F.res.y * F.res.z;
  let n0 = ign(i.pos.xy, F.misc.x); var ao = 0.0;
  for (var k = 0; k < 10; k++) {
    let a = (f32(k) + n0) * 2.39996; let rr = sqrt((f32(k) + 0.5) / 10.0) * rUV; let uv = i.uv + vec2f(cos(a) * asp, sin(a)) * rr;
    let q = clamp(vec2i(uv * F.res.xy), vec2i(0), res - 1); let ds = textureLoad(depthT, q, 0); let S = viewPos(uv, ds); let v = S - P; let d2 = dot(v, v);
    ao += max(0.0, dot(N, v) / sqrt(d2 + 1e-5) - 0.10) * sat(1.0 - d2 / (R * R * 2.2));
  }
  return vec4f(sat(1.0 - ao / 10.0 * 2.1));
}
`;
const WG_LIGHT = WG_COMMON + FS_TRI + WG_VIEWPOS + /* wgsl */`
@group(1) @binding(0) var gA: texture_2d<f32>;
@group(1) @binding(1) var gN: texture_2d<f32>;
@group(1) @binding(2) var gM: texture_2d<f32>;
@group(1) @binding(3) var depthT: texture_depth_2d;
@group(1) @binding(4) var mvT: texture_2d<f32>;
@group(1) @binding(7) var skyT: texture_2d<f32>;
@group(1) @binding(8) var envT: texture_2d<f32>;
@group(1) @binding(9) var sPano: sampler;
@group(1) @binding(10) var aoT: texture_2d<f32>;
@group(1) @binding(11) var histT: texture_2d<f32>;
` + wgShadow(1, 5, 6) + /* wgsl */`
fn envAt(d: vec3f, rough: f32) -> vec3f { return textureSampleLevel(envT, sPano, dirToPano(d), rough * 7.5).rgb; }
fn ggxD(nh: f32, a: f32) -> f32 { let a2 = a * a; let d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d + 1e-7); }
fn smithV(nl: f32, nv: f32, a: f32) -> f32 { let k = a * 0.5 + 1e-4; return 0.25 / ((nl * (1.0 - k) + k) * (nv * (1.0 - k) + k)); }
fn envBRDF(f0: vec3f, rough: f32, nv: f32) -> vec3f { let c0 = vec4f(-1.0, -0.0275, -0.572, 0.022); let c1 = vec4f(1.0, 0.0425, 1.04, -0.04); let r = rough * c0 + c1; let a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y; let ab = vec2f(-1.04, 1.04) * a004 + r.zw; return f0 * ab.x + ab.y; }
fn ssr(P: vec3f, R: vec3f, n0: f32) -> vec4f {
  var t = 0.06; var sl = 0.16 * (0.6 + n0 * 0.8); var pt = 0.0; let res = vec2i(F.res.xy);
  for (var k = 0; k < 22; k++) {
    pt = t; t += sl; sl *= 1.26; let q = P + R * t; let c = F.vp * vec4f(q, 1.0); if (c.w <= 0.05) { break; }
    var uv = c.xy / c.w * vec2f(0.5, -0.5) + 0.5; if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { break; }
    let d = textureLoad(depthT, clamp(vec2i(uv * F.res.xy), vec2i(0), res - 1), 0); let zs = F.misc.z / max(d, 1e-7);
    if (c.w > zs + 0.02) {
      if (c.w - zs > max(1.2, sl * 2.5) || d <= 0.0) { continue; }
      var lo = pt; var hi = t;
      for (var j = 0; j < 5; j++) { let m = 0.5 * (lo + hi); let cm = F.vp * vec4f(P + R * m, 1.0); let um = cm.xy / cm.w * vec2f(0.5, -0.5) + 0.5; let dm = textureLoad(depthT, clamp(vec2i(um * F.res.xy), vec2i(0), res - 1), 0); if (cm.w > F.misc.z / max(dm, 1e-7)) { hi = m; } else { lo = m; } }
      let ch = F.vp * vec4f(P + R * hi, 1.0); uv = ch.xy / ch.w * vec2f(0.5, -0.5) + 0.5; let pi = clamp(vec2i(uv * F.res.xy), vec2i(0), res - 1);
      let puv = uv - textureLoad(mvT, pi, 0).xy; if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) { break; }
      let ed = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)); let conf = smoothstep(0.0, 0.07, ed) * (1.0 - smoothstep(14.0, 22.0, f32(k)));
      return vec4f(min(textureSampleLevel(histT, sClamp, puv, 0.0).rgb, vec3f(24.0)), conf);
    }
  }
  return vec4f(0.0);
}
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); let d = textureLoad(depthT, px, 0); let sun = F.sun.xyz; let sc = F.sunCol.rgb;
  let wp = worldFromDepth(i.uv, max(d, 1e-6)); let V = normalize(F.cam.xyz - wp);
  if (d <= 0.0) {
    let dir = -V; let s = textureSampleLevel(skyT, sPano, dirToPano(dir), 0.0); let mu = dot(dir, sun);
    return vec4f(s.rgb + sc * (smoothstep(0.99990, 0.99996, mu) * 60.0 + pow(sat(mu), 3000.0) * 3.0) * s.a, 1.0);
  }
  let ga = textureLoad(gA, px, 0); let gn = textureLoad(gN, px, 0); let gm = textureLoad(gM, px, 0);
  let N = normalize(gn.xyz); let mat = i32(gn.w + 0.5); let alb = ga.rgb; var rough = max(ga.a, 0.03); let metal = select(gm.r, 0.0, mat == 1);
  let vz = linDepth(d); let n0 = ign(i.pos.xy, F.misc.x); let n1 = ign(i.pos.xy + 37.0, F.misc.x);
  var sh = shadowAt(wp, N, vz, n0, 8);
  // sombra de contato em espaço de tela
  if (sh > 0.02 && vz < 60.0) {
    let res = vec2i(F.res.xy); let len = min(0.5, vz * 0.035) ; var occ = 0.0;
    for (var k = 1; k <= 8; k++) {
      let q = wp + sun * (len * (f32(k) - 0.5 + n1 * 0.9) / 8.0) + N * 0.004 * vz; let c = F.vp * vec4f(q, 1.0); let uv = c.xy / c.w * vec2f(0.5, -0.5) + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { break; }
      let ds = textureLoad(depthT, clamp(vec2i(uv * F.res.xy), vec2i(0), res - 1), 0); let dz = c.w - F.misc.z / max(ds, 1e-7);
      if (dz > 0.012 * vz * 0.2 + 0.006 && dz < 0.25 + vz * 0.01) { occ = 1.0; break; }
    }
    sh *= 1.0 - occ * (1.0 - smoothstep(40.0, 60.0, vz)) * select(1.0, 0.6, mat == 1);
  }
  let hp = F.res.zw; let ao4 = (textureSampleLevel(aoT, sClamp, i.uv + hp * vec2f(1.0, 1.0), 0.0).r + textureSampleLevel(aoT, sClamp, i.uv + hp * vec2f(-1.0, 1.0), 0.0).r + textureSampleLevel(aoT, sClamp, i.uv + hp * vec2f(1.0, -1.0), 0.0).r + textureSampleLevel(aoT, sClamp, i.uv + hp * vec2f(-1.0, -1.0), 0.0).r) * 0.25;
  let ao = min(gm.g, 1.0) * mix(ao4, 1.0, smoothstep(150.0, 400.0, vz));
  if (F.pad1.x > 0.5) { if (F.pad1.x < 1.5) { return vec4f(alb, 1.0); } if (F.pad1.x < 2.5) { return vec4f(N * 0.5 + 0.5, 1.0); } if (F.pad1.x < 3.5) { return vec4f(vec3f(ao), 1.0); } return vec4f(vec3f(sh), 1.0); }
  let nv = max(dot(N, V), 1e-3); let L = sun; let H = normalize(L + V); let nl = sat(dot(N, L)); let nh = sat(dot(N, H)); let vh = sat(dot(V, H));
  var f0 = mix(vec3f(0.04), alb, metal); let diffC = alb * (1.0 - metal);
  var coat = 0.0; if (mat == 2) { coat = gm.a; }
  let a = rough * rough; let Fr = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  var col = (diffC / PI + Fr * (ggxD(nh, a) * smithV(nl, nv, a)) * select(1.0, 0.3, mat == 1)) * nl * sc * sh;
  // folhagem: luz atravessando
  if (mat == 1) { let tr = gm.b; let back = sat(dot(-N, L) * 0.6 + 0.4); let vl = pow(sat(dot(V, -L)), 4.0); col += alb * sc * mix(sh, 1.0, 0.12) * tr * back * (0.20 + 0.5 * vl) / PI * 1.1; }
  // ambiente difuso
  let amb = envAt(normalize(N + vec3f(0.0, 0.25, 0.0)), 1.0) * 1.0 + envAt(vec3f(0.0, 1.0, 0.0), 1.0) * 0.25;
  col += diffC * amb * ao;
  // especular de ambiente + SSR
  let R = reflect(-V, N); let so = sat(pow(nv + ao, exp2(-16.0 * rough - 1.0)) - 1.0 + ao);
  var env = envAt(R, rough) * mix(1.0, sat(1.0 + R.y * 4.0) * 0.6 + 0.4, 0.5);
  var cenv = envAt(R, 0.22);
  let smoothK = max(coat, 1.0 - smoothstep(0.12, 0.36, rough));
  if (smoothK > 0.01 && vz < 150.0) { let h = ssr(wp + N * 0.01 * (1.0 + vz * 0.1), R, n1); cenv = mix(cenv, h.rgb, h.a * select(1.0, 0.55, coat > 0.5)); if (coat < 0.5 || rough < 0.2) { env = mix(env, h.rgb, h.a * (1.0 - smoothstep(0.12, 0.36, rough))); } }
  col += env * envBRDF(f0, rough, nv) * so * (1.0 - coat * 0.0);
  if (coat > 0.0) { // verniz
    let Fc = (0.04 + 0.96 * pow(1.0 - nv, 5.0)) * coat * 0.8; let ac = 0.0022;
    col = col * (1.0 - Fc) + cenv * Fc * mix(so, 1.0, 0.5) + sc * sh * nl * (ggxD(nh, 0.006) * smithV(nl, nv, 0.006)) * (0.04 + 0.96 * pow(1.0 - vh, 5.0)) * coat * (1.0 + ac);
  }
  if (mat == 3) { col += alb * gm.b * 3.0; }
  return vec4f(col, 1.0);
}
`;
// névoa volumétrica em meia resolução: marcha pelas cascatas de sombra (fachos de luz) + névoa de altura analítica ao longe
const WG_FOG = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var depthT: texture_depth_2d;
@group(1) @binding(3) var envT: texture_2d<f32>;
@group(1) @binding(4) var sPano: sampler;
` + wgShadow(1, 1, 2) + /* wgsl */`
fn dens(p: vec3f) -> f32 { return 0.00026 * exp(-max(p.y - 19.0, 0.0) / 220.0) + 0.00075 * exp(-max(p.y - 19.0, 0.0) / 20.0); }
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy) * 2; let d = textureLoad(depthT, px, 0); let wp = worldFromDepth(i.uv, max(d, 2e-5)); let cam = F.cam.xyz;
  var rd = wp - cam; var dist = length(rd); rd /= dist; if (d <= 0.0) { dist = 30000.0; }
  let mu = dot(rd, F.sun.xyz); let g = 0.72; let hg = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5)) * 0.8 + 0.2 / (4.0 * PI);
  let sc = F.sunCol.rgb; let ambC = textureSampleLevel(envT, sPano, dirToPano(normalize(vec3f(rd.x, 0.25, rd.z))), 5.0).rgb * 0.08;
  let n0 = ign(i.pos.xy, F.misc.x); let nearEnd = min(dist, 170.0); var T = 1.0; var acc = vec3f(0.0); let NS = 14.0;
  for (var k = 0; k < 14; k++) {
    let f0 = f32(k) / NS; let f1 = f32(k + 1) / NS; let t0 = nearEnd * f0 * f0; let t1 = nearEnd * f1 * f1; let t = mix(t0, t1, n0); let p = cam + rd * t;
    let nz = textureSampleLevel(noise3T, sRep, p * vec3f(0.021, 0.05, 0.021) + vec3f(F.cam.w * 0.012, 0.0, F.cam.w * 0.007), 0.0).x;
    let de = dens(p) * (0.55 + 1.0 * nz); let s = shadowAt(p, F.sun.xyz, t, fract(n0 + f0 * 7.0), 2);
    let a = 1.0 - exp(-de * (t1 - t0)); acc += T * a * (sc * s * min(hg, 0.38) * 3.2 + ambC * 7.0); T *= 1.0 - a;
  }
  if (dist > 170.0) { // trecho analítico
    let y0 = cam.y + rd.y * 170.0 - 19.0; let ry = rd.y; let len = dist - 170.0;
    var od = 0.0;
    for (var k = 0; k < 2; k++) { let hsc = select(20.0, 220.0, k == 0); let b = select(0.00075, 0.00026, k == 0); let e0 = exp(-max(y0, 0.0) / hsc);
      if (abs(ry) > 1e-4) { od += b * e0 * hsc / ry * (1.0 - exp(-ry * len / hsc)); } else { od += b * e0 * len; } }
    od = max(od, 0.0); let a = 1.0 - exp(-od);
    let hz = textureSampleLevel(envT, sPano, dirToPano(normalize(vec3f(rd.x, max(rd.y, 0.02) + 0.06, rd.z))), 3.0).rgb;
    acc += T * a * (hz * 0.62 + vec3f(0.10, 0.14, 0.20) + sc * min(hg, 0.9) * 0.35); T *= 1.0 - a;
  }
  return vec4f(acc, T);
}
`;
const WG_FOGC = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var fogT: texture_2d<f32>;
@group(1) @binding(1) var depthT: texture_depth_2d;
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  // reamostragem ciente de profundidade (evita vazar névoa nas bordas do carro)
  let px = vec2i(i.pos.xy); let d0 = linDepth(textureLoad(depthT, px, 0)); let hres = vec2i(F.res.xy) / 2; let b = (i.pos.xy - 1.0) * 0.5; let bi = vec2i(floor(b)); let f = b - floor(b);
  var acc = vec4f(0.0); var ws = 0.0;
  for (var k = 0; k < 4; k++) { let o = vec2i(k & 1, k >> 1); let q = clamp(bi + o, vec2i(0), hres - 1); let dz = linDepth(textureLoad(depthT, q * 2, 0));
    let wb = mix(1.0 - f.x, f.x, f32(o.x)) * mix(1.0 - f.y, f.y, f32(o.y)); let w = wb / (0.02 + abs(dz - d0) / max(d0, 0.1) * 6.0) + 1e-5; acc += textureLoad(fogT, q, 0) * w; ws += w; }
  return acc / ws;
}
`;
const WG_TAA = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var curT: texture_2d<f32>;
@group(1) @binding(1) var histT: texture_2d<f32>;
@group(1) @binding(2) var mvT: texture_2d<f32>;
@group(1) @binding(3) var depthT: texture_depth_2d;
fn tm(c: vec3f) -> vec3f { return c / (1.0 + luma(c)); }
fn itm(c: vec3f) -> vec3f { return c / max(1.0 - luma(c), 1e-4); }
fn hist(uv: vec2f) -> vec3f { // Catmull-Rom em 5 amostras
  let sp = uv * F.res.xy; let tc = floor(sp - 0.5) + 0.5; let f = sp - tc; let w0 = f * (-0.5 + f * (1.0 - 0.5 * f)); let w1 = 1.0 + f * f * (-2.5 + 1.5 * f); let w2 = f * (0.5 + f * (2.0 - 1.5 * f)); let w3 = f * f * (-0.5 + 0.5 * f);
  let w12 = w1 + w2; let t0 = (tc - 1.0) * F.res.zw; let t3 = (tc + 2.0) * F.res.zw; let t12 = (tc + w2 / w12) * F.res.zw;
  var r = vec4f(0.0);
  r += vec4f(textureSampleLevel(histT, sClamp, vec2f(t12.x, t0.y), 0.0).rgb, 1.0) * (w12.x * w0.y);
  r += vec4f(textureSampleLevel(histT, sClamp, vec2f(t0.x, t12.y), 0.0).rgb, 1.0) * (w0.x * w12.y);
  r += vec4f(textureSampleLevel(histT, sClamp, vec2f(t12.x, t12.y), 0.0).rgb, 1.0) * (w12.x * w12.y);
  r += vec4f(textureSampleLevel(histT, sClamp, vec2f(t3.x, t12.y), 0.0).rgb, 1.0) * (w3.x * w12.y);
  r += vec4f(textureSampleLevel(histT, sClamp, vec2f(t12.x, t3.y), 0.0).rgb, 1.0) * (w12.x * w3.y);
  return max(r.rgb / r.a, vec3f(0.0));
}
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); let res = vec2i(F.res.xy); var best = -1.0; var bo = vec2i(0);
  var m1 = vec3f(0.0); var m2 = vec3f(0.0); var cc = vec3f(0.0); var mn = vec3f(1e9); var mx = vec3f(-1e9);
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let q = clamp(px + vec2i(x, y), vec2i(0), res - 1); let c = tm(textureLoad(curT, q, 0).rgb); m1 += c; m2 += c * c; mn = min(mn, c); mx = max(mx, c);
    if (x == 0 && y == 0) { cc = c; } let d = textureLoad(depthT, q, 0); if (d > best) { best = d; bo = vec2i(x, y); }
  } }
  let mv = textureLoad(mvT, clamp(px + bo, vec2i(0), res - 1), 0).xy; let puv = i.uv - mv;
  let mean = m1 / 9.0; let sd = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  let spd = length(mv * F.res.xy); let gam = mix(1.35, 0.9, sat(spd / 12.0));
  let lo = max(mn, mean - sd * gam); let hi = min(mx, mean + sd * gam);
  if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0 || F.misc.x < 0.5 || F.pad1.w > 0.5) { return vec4f(itm(cc), 1.0); }
  var h = tm(hist(puv));
  // recorte em direção ao centro da vizinhança
  let cen = 0.5 * (lo + hi); let ext = 0.5 * (hi - lo) + 1e-5; let dv = h - cen; let u = abs(dv) / ext; let mu = max(u.x, max(u.y, u.z)); if (mu > 1.0) { h = cen + dv / mu; }
  let a = mix(0.07, 0.22, sat(spd / 24.0));
  return vec4f(itm(mix(h, cc, a)), 1.0);
}
`;
const WG_MB = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var colT: texture_2d<f32>;
@group(1) @binding(1) var mvT: texture_2d<f32>;
@group(1) @binding(2) var depthT: texture_depth_2d;
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); let res = vec2i(F.res.xy); let c0 = textureLoad(colT, px, 0).rgb;
  var mv = textureLoad(mvT, px, 0).xy * (0.20 / max(F.misc.y * 60.0, 0.25)); let l = length(mv * F.res.xy);
  if (l < 1.2 || F.pad1.w > 0.5 || textureLoad(depthT, px, 0) <= 0.0) { return vec4f(c0, 1.0); }
  let mxl = 30.0; if (l > mxl) { mv *= mxl / l; }
  let d0 = linDepth(textureLoad(depthT, px, 0)); let n0 = ign(i.pos.xy, F.misc.x); var acc = c0; var ws = 1.0; let ml = min(l, mxl);
  for (var k = 0; k < 9; k++) {
    let t = (f32(k) + n0) / 9.0 - 0.5; let uv = i.uv + mv * t; let q = clamp(vec2i(uv * F.res.xy), vec2i(0), res - 1);
    let ms = length(textureLoad(mvT, q, 0).xy * F.res.xy) * (0.20 / max(F.misc.y * 60.0, 0.25)); let ds = linDepth(textureLoad(depthT, q, 0));
    let w = max(sat(ms / (ml * 0.6)), sat((ds - d0) / (d0 * 0.05 + 0.2)) * 0.0) + 0.02;
    acc += textureSampleLevel(colT, sClamp, uv, 0.0).rgb * w; ws += w;
  }
  return vec4f(acc / ws, 1.0);
}
`;
const WG_BLOOM = FS_TRI + /* wgsl */`
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
fn L(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
@fragment fn fsDown0(i: FsV) -> @location(0) vec4f { // primeiro nível: média ponderada (anti vaga-lume)
  let ts = 1.0 / vec2f(textureDimensions(t)); var acc = vec3f(0.0); var ws = 0.0;
  for (var k = 0; k < 4; k++) { let o = vec2f(f32(k & 1) * 2.0 - 1.0, f32(k >> 1) * 2.0 - 1.0); let c = min(textureSampleLevel(t, s, i.uv + o * ts, 0.0).rgb, vec3f(64.0)); let w = 1.0 / (1.0 + L(c)); acc += c * w; ws += w; }
  return vec4f(acc / ws, 1.0);
}
@fragment fn fsDown(i: FsV) -> @location(0) vec4f {
  let ts = 1.0 / vec2f(textureDimensions(t)); var c = textureSampleLevel(t, s, i.uv, 0.0).rgb * 4.0;
  c += textureSampleLevel(t, s, i.uv + vec2f(-1.0, -1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(1.0, -1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(-1.0, 1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(1.0, 1.0) * ts, 0.0).rgb;
  return vec4f(c / 8.0, 1.0);
}
@fragment fn fsUp(i: FsV) -> @location(0) vec4f {
  let ts = 1.0 / vec2f(textureDimensions(t)); var c = textureSampleLevel(t, s, i.uv, 0.0).rgb * 4.0;
  c += (textureSampleLevel(t, s, i.uv + vec2f(-1.0, 0.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(1.0, 0.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(0.0, -1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(0.0, 1.0) * ts, 0.0).rgb) * 2.0;
  c += textureSampleLevel(t, s, i.uv + vec2f(-1.0, -1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(1.0, -1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(-1.0, 1.0) * ts, 0.0).rgb + textureSampleLevel(t, s, i.uv + vec2f(1.0, 1.0) * ts, 0.0).rgb;
  return vec4f(c / 16.0, 0.62);
}
`;
const WG_FINAL = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var colT: texture_2d<f32>;
@group(1) @binding(1) var bloomT: texture_2d<f32>;
fn aces(x: vec3f) -> vec3f {
  let m1 = mat3x3f(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  let m2 = mat3x3f(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  let v = m1 * x; let a = v * (v + 0.0245786) - 0.000090537; let b = v * (0.983729 * v + 0.4329510) + 0.238081; return sat3(m2 * (a / b));
}
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let px = vec2i(i.pos.xy); let res = vec2i(F.res.xy);
  var c = textureLoad(colT, px, 0).rgb;
  // nitidez adaptativa leve (compensa a suavização do TAA)
  let n = textureLoad(colT, clamp(px + vec2i(0, -1), vec2i(0), res - 1), 0).rgb + textureLoad(colT, clamp(px + vec2i(0, 1), vec2i(0), res - 1), 0).rgb + textureLoad(colT, clamp(px + vec2i(-1, 0), vec2i(0), res - 1), 0).rgb + textureLoad(colT, clamp(px + vec2i(1, 0), vec2i(0), res - 1), 0).rgb;
  let sharp = c + (c - n * 0.25) * 0.38; c = max(mix(c, sharp, sat(1.0 - luma(abs(c - n * 0.25)) * 0.8)), vec3f(0.0));
  let bl = textureSampleLevel(bloomT, sClamp, i.uv, 0.0).rgb; c = mix(c, bl, 0.035) + bl * 0.008;
  c *= F.sunCol.a;
  let q = i.uv - 0.5; c *= 1.0 - dot(q, q) * 0.42;
  c = aces(c * 1.05);
  c = pow(c, vec3f(1.0 / 2.2)); let lm = luma(c); c = mix(vec3f(lm), c, 1.06); c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
  c += (hash12(i.pos.xy + fract(F.misc.x * 0.618) * 91.0) - 0.5) / 255.0 * 1.6;
  return vec4f(c, 1.0);
}
`;
