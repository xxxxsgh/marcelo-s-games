// sh_car.js — shader do carro: classifica cada ponto da casca (pintura, vidros, colunas, lanternas, grade...) por regiões analíticas
const WG_CAR = WG_COMMON + /* wgsl */`
struct CarU { m: array<mat4x4f, 5>, pm: array<mat4x4f, 5>, p: vec4f, q: vec4f };
@group(1) @binding(0) var<uniform> C: CarU;
@group(1) @binding(1) var decT: texture_2d<f32>;
@group(1) @binding(2) var envT: texture_2d<f32>;
@group(1) @binding(3) var sPano: sampler;
struct CV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) op: vec3f, @location(3) on: vec3f, @location(4) uv: vec2f, @location(5) col: vec4f, @location(6) @interpolate(flat) kind: f32, @location(7) cur: vec4f, @location(8) prv: vec4f };
@vertex fn vs(@builtin(instance_index) ii: u32, @location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) col: vec4f, @location(4) mat: vec4f) -> CV {
  var o: CV; let M = C.m[ii]; let w = M * vec4f(pos, 1.0); o.wp = w.xyz; o.n = (M * vec4f(nrm, 0.0)).xyz; o.op = pos; o.on = nrm; o.uv = uv; o.col = col; o.kind = mat.w * 255.0;
  o.pos = F.vp * w; o.cur = F.vpNJ * w; o.prv = F.pvp * (C.pm[ii] * vec4f(pos, 1.0)); return o;
}
@vertex fn vsShadow(@builtin(instance_index) ii: u32, @location(0) pos: vec3f) -> @builtin(position) vec4f { return F.vp * (C.m[ii] * vec4f(pos, 1.0)); }
fn yBeltF(z: f32) -> f32 { return 1.035 - 0.012 * z; }
// classes: 0 pintura, 1 vidro dianteiro, 2 vidro traseiro (escurecido), 3 coluna preta brilhante, 4 borracha, 5 farol, 6 lanterna, 7 grade, 8 plástico escuro, 9 cromado, 10 placa, 11 fundo/caixa de roda, 12 farol de neblina, 13 refletor, 14 friso do emblema
fn classify(p: vec3f, n: vec3f) -> i32 {
  let ax = abs(p.x); let y = p.y; let z = p.z; let da = min(abs(z - 1.32), abs(z + 1.32));
  if ((n.y < -0.55 && y < 0.56) || (da < 0.45 && ax < 0.80 && y < 0.83)) { return 11; }
  let anx = abs(n.x);
  // lanterna traseira: sobe pela coluna e dobra a esquina
  if (y > 0.80 && y < 1.385 && ((z < -1.93 && ax > 0.662) || (z < -1.885 && ax > 0.80))) { return 6; }
  // farol: dobra a esquina dianteira
  let hlTop = 1.005 - 0.03 * smoothstep(0.45, 0.9, ax); let hlBot = 0.80 + 0.03 * smoothstep(0.7, 0.4, ax);
  if (z > 1.74 && y > hlBot && y < hlTop && ax > 0.405 && (n.z > 0.2 || z > 1.76)) { return 5; }
  if (anx > 0.45 && y > 0.95 && z < 0.92 && z > -1.85 && n.y < 0.75) { // área envidraçada lateral
    let zf = 0.64 - (y - 1.03) * 0.98; let zr = -1.56 + (y - 1.07) * 0.34;
    let d = max(max(yBeltF(z) + 0.038 + 0.075 * smoothstep(-1.12, -1.5, z) - y, y - 1.512), max(z - zf, zr - z));
    if (z > zf && z < zf + 0.16 - (y - 1.03) * 0.5 && y > yBeltF(z) + 0.03 && y < 1.2) { return 3; }
    if (d < 0.0) {
      if (d > -0.020) { return 4; }
      if (abs(z + 0.165) < 0.058 || abs(z + 1.075) < 0.040) { return 3; }
      return select(2, 1, z > -0.165);
    }
    if (d < 0.012) { return 4; }
  }
  if (n.y > 0.15 && n.z > 0.1 && z > 0.18 && z < 1.0 && y > 1.0) { // para-brisa
    let xe = mix(0.775, 0.675, sat((y - 1.045) / 0.54)) - 0.045; let d = max(max(1.118 - y, y - 1.578), ax - xe);
    if (d < 0.0) { if (d > -0.022) { return 4; } return 1; }
    if (y < 1.118 && ax < 0.74 && z > 0.86 && n.y > 0.5) { return 8; }
  }
  if (n.z < -0.45 && z < -1.85) { // traseira
    let d = max(max(1.085 - y, y - 1.505), ax - 0.635);
    if (d < 0.0) { if (d > -0.022) { return 4; } return 2; }
    if (y < 0.46) { return 8; }
    if (y > 0.515 && y < 0.578 && ax > 0.50 && ax < 0.76) { return 13; }
    if (p.x > 0.165 && p.x < 0.565 && y > 0.795 && y < 0.925) { return 10; }
  }
  if (n.z > 0.35 && z > 1.80) { // frente
    let dg = max(ax - 0.392, max(0.732 - y, y - 0.950));
    if (dg < 0.0) { if (dg > -0.020) { return 9; } return 7; }
    if (y < 0.35) { return 8; }
    if (ax < 0.53 && y > 0.385 && y < 0.515) { return 8; }
    if (length(vec2f(ax - 0.675, y - 0.465)) < 0.060) { return 12; }
    if (ax < 0.205 && y > 0.548 && y < 0.678) { return 10; }
  }
  if (y < 0.385 && abs(z) < 0.92 && anx > 0.3) { return 8; }
  if (y < 0.40 && abs(z) > 1.72) { return 8; }
  if (anx > 0.6 && z > 0.895 && z < 0.955 && y > 0.80 && y < 0.95) { return 8; }
  return 0;
}
fn grooves(p: vec3f, n: vec3f) -> f32 { // juntas de portas, capô e tampa
  let ax = abs(p.x); let y = p.y; let z = p.z; var g = 0.0; let w = 0.0035;
  if (abs(n.x) > 0.55) {
    if (y > 0.42 && y < 1.04) { g = max(g, 1.0 - smoothstep(0.0, w, abs(z - 0.80))); g = max(g, 1.0 - smoothstep(0.0, w, abs(z + 0.165))); }
    if (y > 0.93 && y < 1.04) { g = max(g, 1.0 - smoothstep(0.0, w, abs(z + 1.075))); }
    if (y <= 0.95 && y > 0.42 && z > -1.30 && z < -0.70) { g = max(g, 1.0 - smoothstep(0.0, w, abs(length(vec2f(z + 1.32, y - 0.377)) - 0.535))); }
    if (z > -0.80 && z < 0.80) { g = max(g, 1.0 - smoothstep(0.0, w, abs(y - 0.425))); }
    if (p.x > 0.0) { g = max(g, 1.0 - smoothstep(0.0, w, abs(length(vec2f(z + 1.63, y - 0.90)) - 0.072))); }
    if (z > 1.74 || z < -1.74) { g = max(g, (1.0 - smoothstep(0.0, w, abs(y - 0.752))) * step(y, 0.8)); }
    if (z > 0.92 && z < 1.80) { g = max(g, 1.0 - smoothstep(0.0, w, abs(y - (mix(1.025, 0.935, sat((z - 0.92) / 1.0)) - 0.035)))); }
  }
  if (n.z < -0.5 && z < -1.9) { if (y > 0.755 && y < 1.56) { g = max(g, 1.0 - smoothstep(0.0, w, abs(ax - 0.655))); } if (ax < 0.90) { g = max(g, 1.0 - smoothstep(0.0, w, abs(y - 0.752))); } if (ax < 0.655) { g = max(g, 1.0 - smoothstep(0.0, w, abs(y - 1.56))); } }
  if (n.z > 0.4 && z > 1.8) { g = max(g, 1.0 - smoothstep(0.0, w, abs(y - 0.722))); }
  if (n.y > 0.5 && z > 0.98 && z < 2.0) { g = max(g, (1.0 - smoothstep(0.0, w, abs(z - 0.985))) * step(ax, 0.74)); }
  return g;
}
struct Surf { alb: vec3f, rough: f32, metal: f32, coat: f32, emis: f32, mat: f32, ao: f32, glass: f32 };
fn dec(uv: vec2f, r: vec4f) -> f32 { if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return 0.0; } return textureSampleLevel(decT, sClamp, r.xy + uv * r.zw, 0.0).r; }
fn shade(v: CV, ff: bool) -> Surf {
  var s: Surf; s.alb = vec3f(0.5); s.rough = 0.5; s.metal = 0.0; s.coat = 0.0; s.emis = 0.0; s.mat = 0.0; s.ao = 1.0; s.glass = 0.0;
  let k = i32(v.kind + 0.5); let p = v.op; let n = normalize(v.on); let paint = vec3f(0.56, 0.57, 0.585);
  let fl = textureSampleLevel(noiseT, sRep, (p.zy + p.xx * 0.7) * 23.0, 0.0).w; let flk = textureSampleLevel(noiseT, sRep, (p.zy + p.xx) * 61.0, 0.0).w;
  var dirtable = 1.0;
  if (k == 10) {
    let c = classify(p, n); let ax = abs(p.x);
    if (c == 1 || c == 2) { s.glass = f32(c); return s; }
    if (!ff) { s.alb = vec3f(0.055, 0.055, 0.06); s.rough = 0.85; s.ao = 0.7; if (c == 11) { s.alb = vec3f(0.02); } return s; }
    if (c == 0) {
      s.alb = paint * (0.97 + 0.06 * fl); s.metal = 0.70; s.rough = 0.36 + 0.05 * flk; s.coat = 1.0; s.mat = 2.0;
      let g = grooves(p, n); s.alb = mix(s.alb, vec3f(0.01), g); s.coat *= 1.0 - g; s.ao = 1.0 - g * 0.6;
      // emblema GRAND VITARA na tampa
      if (n.z < -0.5 && p.z < -1.9) { let e = dec(vec2f((0.60 - p.x) / 0.36, (1.012 - p.y) / 0.055), vec4f(0.5, 0.0, 0.5, 0.5)); s.alb = mix(s.alb, vec3f(0.9), e); s.metal = mix(s.metal, 1.0, e); s.rough = mix(s.rough, 0.12, e); }
    } else if (c == 3) { s.alb = vec3f(0.012); s.rough = 0.06; s.coat = 1.0; s.mat = 2.0; }
    else if (c == 4) { s.alb = vec3f(0.014); s.rough = 0.55; }
    else if (c == 5) { // farol: refletor cromado, projetor e lente
      let q = vec2f(ax, p.y); let d1 = length(q - vec2f(0.56, 0.905)); let d2 = length(q - vec2f(0.735, 0.900));
      s.alb = vec3f(0.80, 0.82, 0.84) * (0.75 + 0.25 * sin(ax * 260.0)); s.metal = 1.0; s.rough = 0.16; s.coat = 1.0; s.mat = 2.0;
      let ring = smoothstep(0.078, 0.072, d1) * smoothstep(0.056, 0.062, d1) + smoothstep(0.062, 0.056, d2) * smoothstep(0.042, 0.048, d2);
      s.alb = mix(s.alb, vec3f(0.03), ring); let lens = smoothstep(0.056, 0.050, d1) + smoothstep(0.042, 0.037, d2); let hb = min(min(p.y - (0.80 + 0.03 * smoothstep(0.7, 0.4, ax)), 1.005 - 0.03 * smoothstep(0.45, 0.9, ax) - p.y), ax - 0.405); s.alb = mix(vec3f(0.02), s.alb, smoothstep(0.008, 0.016, hb)); s.metal *= smoothstep(0.008, 0.016, hb); s.alb = mix(s.alb, vec3f(0.55, 0.60, 0.66), lens); s.rough = mix(s.rough, 0.05, lens);
      if (ax > 0.83) { s.alb = vec3f(0.85, 0.42, 0.06) * (0.7 + 0.3 * sin(p.y * 300.0)); s.metal = 0.5; }
      dirtable = 0.6;
    } else if (c == 6) { // lanterna: vermelha com frisos; ré clara embaixo; acende no freio
      let rib = 0.72 + 0.28 * sin(p.y * 330.0); s.alb = vec3f(0.36, 0.008, 0.008) * rib; s.rough = 0.22; s.metal = 0.25; s.coat = 1.0; s.mat = 2.0;
      let cr = min(abs(p.y - 1.215), abs(p.y - 1.065)); s.alb = mix(s.alb, vec3f(0.55, 0.02, 0.015), smoothstep(0.055, 0.045, cr) * 0.8);
      if (p.y < 0.935) { s.alb = vec3f(0.62, 0.62, 0.64) * rib; s.metal = 0.6; if (C.p.w > 0.5) { s.mat = 3.0; s.emis = 0.35; s.alb = vec3f(1.0, 0.95, 0.85); } }
      else if (C.p.z > 0.02 && p.y > 0.99) { s.mat = 3.0; s.emis = C.p.z * (0.55 + 0.6 * smoothstep(0.06, 0.03, cr)); s.alb = vec3f(1.0, 0.045, 0.02); }
      dirtable = 0.6;
    } else if (c == 7) { // grade: colmeia escura, barra cromada e emblema
      let hx = fract(vec2f(ax * 38.0, p.y * 44.0 + floor(ax * 38.0) * 0.5)); let mesh = smoothstep(0.10, 0.2, min(min(hx.x, 1.0 - hx.x), min(hx.y, 1.0 - hx.y)));
      s.alb = mix(vec3f(0.06), vec3f(0.008), mesh); s.rough = 0.45; s.ao = 0.45 + 0.4 * (1.0 - mesh);
      let bar = 1.0 - smoothstep(0.014, 0.018, abs(p.y - 0.842)); let em = dec(vec2f((p.x + 0.07) / 0.14, (0.912 - p.y) / 0.14), vec4f(0.5, 0.5, 0.125, 0.5)); let disc = 1.0 - smoothstep(0.066, 0.07, length(vec2f(p.x, p.y - 0.842)));
      s.alb = mix(s.alb, vec3f(0.86), max(bar, em)); s.metal = max(bar, em); s.rough = mix(s.rough, 0.10, max(bar, em)); s.ao = mix(s.ao, 1.0, max(bar, em));
      if (disc > 0.0 && em < 0.5) { s.alb = mix(s.alb, vec3f(0.02), disc * (1.0 - bar)); }
    } else if (c == 8) { s.alb = vec3f(0.030, 0.031, 0.033) * (0.8 + 0.4 * fl); s.rough = 0.58;
      if (n.z > 0.35 && p.y > 0.385 && p.y < 0.515 && ax < 0.53) { s.alb *= 0.4 + 0.6 * step(0.5, fract(p.y * 46.0)); s.ao = 0.6; } }
    else if (c == 9) { s.alb = vec3f(0.88); s.metal = 1.0; s.rough = 0.09; }
    else if (c == 10) { // placa genérica
      var u = vec2f(0.0); if (p.z < 0.0) { u = vec2f((0.565 - p.x) / 0.40, (0.925 - p.y) / 0.13); } else { u = vec2f((p.x + 0.205) / 0.41, (0.678 - p.y) / 0.13); }
      let tx = dec(vec2f(u.x, (u.y - 0.2) / 0.78), vec4f(0.0, 0.5, 0.5, 0.5)); s.alb = mix(vec3f(0.72, 0.72, 0.70), vec3f(0.03), tx); if (u.y < 0.17) { s.alb = vec3f(0.03, 0.10, 0.42); }
      let ed = min(min(u.x, 1.0 - u.x) * 3.1, min(u.y, 1.0 - u.y)); if (ed < 0.05) { s.alb = vec3f(0.03); } s.rough = 0.35;
    } else if (c == 11) { s.alb = vec3f(0.018); s.rough = 0.9; s.ao = 0.5; }
    else if (c == 12) { let d = length(vec2f(ax - 0.675, p.y - 0.465)); s.alb = mix(vec3f(0.75, 0.78, 0.8), vec3f(0.03), smoothstep(0.045, 0.052, d)); s.metal = 1.0 - smoothstep(0.045, 0.052, d); s.rough = 0.12; s.coat = 1.0; s.mat = 2.0; }
    else if (c == 13) { s.alb = vec3f(0.45, 0.01, 0.01) * (0.7 + 0.3 * sin(ax * 500.0)); s.rough = 0.25; s.coat = 1.0; s.mat = 2.0; }
  } else if (k == 11 || k == 18) {
    s.alb = paint * (0.97 + 0.06 * fl); s.metal = 0.70; s.rough = 0.36 + 0.05 * flk; s.coat = 1.0; s.mat = 2.0;
    if (k == 18 && p.z < -2.30) { let e = dec(vec2f(0.5 - (p.x + 0.10) / 0.50, 0.5 - (p.y - 0.955) / 0.125), vec4f(0.0, 0.0, 0.5, 0.5)); s.alb = mix(s.alb, vec3f(0.10, 0.10, 0.11), e); s.metal *= 1.0 - e * 0.7; }
  } else if (k == 12) { s.alb = v.col.rgb; s.rough = 0.42; }
  else if (k == 13) { s.alb = v.col.rgb * (0.85 + 0.3 * fl); s.rough = 0.88; s.ao = 0.75; dirtable = 0.0; }
  else if (k == 14) { // liga leve: face dos raios clara, vãos escuros
    let r = v.uv.x * 0.224; let a = v.uv.y; let kk = fract(a / 6.2832 * 5.0); let ad = abs(kk - 0.5) * 2.0 * (PI / 5.0) * r; let rn = v.uv.x; let sw = 0.030 + 0.016 * rn;
    let face = max(max(1.0 - smoothstep(sw, sw + 0.012, ad), 1.0 - smoothstep(0.052, 0.064, r)), smoothstep(0.186, 0.196, r));
    s.alb = mix(vec3f(0.02), vec3f(0.80, 0.805, 0.82), face); s.metal = face * 0.6; s.rough = mix(0.7, 0.30, face); s.ao = mix(0.35, 1.0, face);
    let la = fract(a / 6.2832 * 5.0 + 0.5) - 0.5; let lug = length(vec2f(la * 2.0 * PI / 5.0 * r, r - 0.056)); s.alb = mix(s.alb, vec3f(0.25), smoothstep(0.011, 0.008, lug)); if (r < 0.03) { s.alb = vec3f(0.30, 0.30, 0.32); s.rough = 0.35; }
    dirtable = 0.9;
  } else if (k == 15) { // pneu: sulcos na banda, ombro em blocos, flanco liso
    let u = v.uv.x; let w = v.uv.y; s.alb = vec3f(0.022, 0.022, 0.024); s.rough = 0.86;
    let tread = smoothstep(0.24, 0.30, w) * smoothstep(0.76, 0.70, w); let ac = abs(w - 0.5);
    let zig = abs(fract(u * 22.0) - 0.5) * 0.05; let gc = min(abs(ac - 0.045 - zig), abs(ac - 0.125 + zig));
    let cg = 1.0 - smoothstep(0.008, 0.014, gc); let lg = 1.0 - smoothstep(0.10, 0.17, abs(fract(u * 44.0 + ac * 3.5 + step(0.5, w) * 0.5) - 0.5));
    let sh = smoothstep(0.155, 0.18, ac) * (1.0 - smoothstep(0.12, 0.2, abs(fract(u * 30.0 + step(0.5, w) * 0.5) - 0.5)));
    let gr = max(max(cg, lg * smoothstep(0.02, 0.05, ac)) * tread, sh * smoothstep(0.33, 0.24, ac));
    s.alb *= 1.0 - gr * 0.75; s.ao = 1.0 - gr * 0.65; s.rough = mix(s.rough, 0.95, gr);
    let sw = 1.0 - tread; s.alb = mix(s.alb, vec3f(0.035), sw * smoothstep(0.5, 0.3, abs(fract(ac * 30.0) - 0.5)) * 0.4);
    dirtable = 1.6;
  } else if (k == 16) { s.alb = v.col.rgb; s.metal = 1.0; s.rough = 0.35; }
  else if (k == 17) { s.alb = vec3f(0.9); s.metal = 1.0; s.rough = 0.02; s.coat = 1.0; s.mat = 2.0; dirtable = 0.3; }
  // ---- sujeira: poeira (seco) e respingos de lama (molhado), mais fortes embaixo e atrás das rodas ----
  if (dirtable > 0.0) {
    let low = 1.0 - smoothstep(0.35, 1.25, p.y); let rear = smoothstep(0.6, -2.1, p.z) * 0.5 + 0.25; let da = min(abs(p.z - 1.32 + 0.35), abs(p.z + 1.32 + 0.35));
    let nA = textureSampleLevel(noiseT, sRep, p.zy * 0.9 + p.xx * 0.5, 0.0); let nB = textureSampleLevel(noiseT, sRep, p.zy * 4.5 + p.xx * 2.0, 0.0);
    var dust = sat(C.p.x * dirtable * (0.25 + low * 0.9 + rear * 0.5 + (nA.x - 0.5) * 0.7) * 1.25) * (0.75 + 0.25 * nB.y);
    if (k == 15 || k == 14) { dust = sat(max(C.p.x * 3.0, C.p.y * 2.0) * dirtable * (0.5 + nB.x)); }
    let splN = smoothstep(0.62 - 0.30 * low - 0.25 * smoothstep(0.8, 0.0, da), 0.72, nB.z * 0.6 + nB.x * 0.4 + (nA.y - 0.5) * 0.3);
    let mud = sat(C.p.y * 1.6 * dirtable) * splN * smoothstep(1.5, 0.5, p.y) * step(C.p.y, 2.0);
    s.alb = mix(s.alb, vec3f(0.36, 0.265, 0.185) * (0.8 + 0.4 * nB.x), dust * 0.88); s.rough = mix(s.rough, 0.9, dust); s.coat *= 1.0 - dust; s.metal *= 1.0 - dust * 0.9;
    s.alb = mix(s.alb, vec3f(0.13, 0.08, 0.05) * (0.7 + 0.6 * nB.y), mud); s.rough = mix(s.rough, 0.45, mud); s.coat *= 1.0 - mud; s.metal *= 1.0 - mud;
    if (s.mat > 2.5) { s.emis *= 1.0 - 0.6 * max(dust, mud); } else if (s.coat < 0.05) { s.mat = 0.0; }
  }
  return s;
}
@fragment fn fs(v: CV, @builtin(front_facing) ff: bool) -> GOut {
  let s = shade(v, ff); if (s.glass > 0.5) { discard; }
  var N = normalize(v.n); if (!ff) { N = -N; }
  if (s.mat > 1.5 && s.mat < 2.5 && s.metal > 0.5) { let sp = (textureSampleLevel(noiseT, sRep, (v.op.zy + v.op.xx * 0.9) * 37.0, 0.0).xy - 0.5) * 0.012; N = normalize(N + vec3f(sp.x, sp.y, -sp.x)); }
  var o: GOut; o.alb = vec4f(s.alb, s.rough); o.nrm = vec4f(N, s.mat); o.misc = vec4f(s.metal, s.ao * v.col.a, s.emis, s.coat); o.mv = motionOf(v.cur, v.prv); return o;
}
@fragment fn fsGlass(v: CV) -> @location(0) vec4f {
  let k = i32(v.kind + 0.5); if (k != 10) { discard; } let n = normalize(v.on); let c = classify(v.op, n); if (c != 1 && c != 2) { discard; }
  let N = normalize(v.n); let V = normalize(F.cam.xyz - v.wp); let nv = sat(dot(N, V)); let Fr = 0.045 + 0.955 * pow(1.0 - nv, 5.0); let R = reflect(-V, N);
  let env = textureSampleLevel(envT, sPano, dirToPano(R), 0.5).rgb; let H = normalize(F.sun.xyz + V); let sp = pow(sat(dot(N, H)), 2500.0) * 150.0;
  let nB = textureSampleLevel(noiseT, sRep, v.op.zy * 4.5 + v.op.xx * 2.0, 0.0); let low = 1.0 - smoothstep(0.9, 1.6, v.op.y);
  let dust = sat(C.p.x * (0.25 + low * 0.5 + (nB.x - 0.5) * 0.4)) * 0.55 + sat(C.p.y) * smoothstep(0.66, 0.74, nB.z * 0.6 + nB.x * 0.4) * low * 0.8;
  let tintA = select(0.80, 0.10, c == 1); let tintC = select(vec3f(0.012, 0.014, 0.016), vec3f(0.03, 0.045, 0.04), c == 1);
  let dcol = vec3f(0.36, 0.265, 0.185) * (F.sunCol.rgb * 0.10 + 0.25);
  let a = 1.0 - (1.0 - Fr) * (1.0 - tintA) * (1.0 - dust);
  let col = (env + F.sunCol.rgb * sp) * Fr + (1.0 - Fr) * (tintC * tintA * 0.3 * (1.0 - dust) + dcol * dust);
  return vec4f(col, a);
}
`;
