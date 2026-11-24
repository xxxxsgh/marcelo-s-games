// sh_bake.js — texturas procedurais geradas na carga: materiais do chão/casca/madeira/folhas e panorama do céu
const WG_PNOISE = /* wgsl */`
fn ph2(c: vec2f, per: vec2f) -> vec2f { let q = c - per * floor(c / per); return hash22(q + 17.0); }
fn pvn(p: vec2f, per: vec2f) -> f32 {
  let i = floor(p); let f = p - i; let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let a = ph2(i, per).x; let b = ph2(i + vec2f(1.0, 0.0), per).x; let c = ph2(i + vec2f(0.0, 1.0), per).x; let d = ph2(i + vec2f(1.0, 1.0), per).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}
fn pfbm(p: vec2f, per: vec2f, oct: i32) -> f32 { var s = 0.0; var a = 0.5; var f = 1.0; for (var i = 0; i < oct; i++) { s += a * pvn(p * f + f32(i) * 3.7, per * f); f *= 2.0; a *= 0.5; } return s; }
fn pwor(p: vec2f, per: vec2f) -> vec3f {
  let i = floor(p); let f = p - i; var d1 = 9.0; var d2 = 9.0; var id = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let g = vec2f(f32(x), f32(y)); let h = ph2(i + g, per); let r = g + h - f; let d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = fract(h.x * 7.13 + h.y * 3.71); } else if (d < d2) { d2 = d; }
  } }
  return vec3f(sqrt(d1), sqrt(d2), id);
}
`;
const WG_MATBAKE = WG_COMMON + FS_TRI + WG_PNOISE + /* wgsl */`
struct MO { @location(0) a: vec4f, @location(1) b: vec4f };
fn leafAt(p: vec2f, c: vec2f, ang: f32, len: f32, wid: f32) -> vec2f { // (máscara, coordenada ao longo)
  let d = p - c; let cs = cos(ang); let sn = sin(ang); let l = vec2f(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
  let u = l.x / len; if (u < 0.0 || u > 1.0) { return vec2f(0.0, 0.0); }
  let w = wid * sin(u * PI) * (1.0 - 0.45 * u) * 1.35; let e = 1.0 - abs(l.y) / max(w, 1e-4);
  return vec2f(smoothstep(0.0, 0.16, e), 1.0 - abs(l.y) / max(w, 1e-4));
}
@fragment fn fs(i: FsV) -> MO {
  let uv = i.uv; let L = i.inst; var alb = vec3f(0.5); var h = 0.5; var rough = 0.9; var ao = 1.0; var al = 1.0;
  if (L == 0u) { // terra batida avermelhada
    let n1 = pfbm(uv * 3.0, vec2f(3.0), 5); let n2 = pfbm(uv * 12.0 + 5.0, vec2f(12.0), 4); let n3 = pfbm(uv * 48.0, vec2f(48.0), 3);
    let w = pwor(uv * 20.0, vec2f(20.0)); let peb = smoothstep(0.30, 0.12, w.x) * step(0.80, w.z);
    let w2 = pwor(uv * 56.0, vec2f(56.0)); let grit = smoothstep(0.28, 0.08, w2.x) * step(0.55, w2.z);
    let wc = pwor(uv * 6.0 + vec2f(n2, n1) * 0.25, vec2f(6.0)); let crack = smoothstep(0.022, 0.0, wc.y - wc.x) * smoothstep(0.05, 0.35, n1) * 0.45;
    h = 0.45 + n1 * 0.22 + n2 * 0.10 + n3 * 0.05 + peb * 0.30 * (1.0 - w.x * 2.0) + grit * 0.07 - crack * 0.18;
    alb = mix(vec3f(0.27, 0.15, 0.09), vec3f(0.45, 0.28, 0.17), sat(0.5 + n1 * 0.9 + n2 * 0.5)); alb *= 0.9 + n3 * 0.3;
    alb = mix(alb, vec3f(0.33, 0.27, 0.22) * (0.75 + w.z * 0.35), peb * 0.8); alb = mix(alb, vec3f(0.40, 0.30, 0.21), grit * 0.4); alb *= 1.0 - crack * 0.55;
    rough = 0.93 - peb * 0.2; ao = 1.0 - crack * 0.6;
  } else if (L == 1u) { // cascalho
    let wp = pfbm(uv * 8.0, vec2f(8.0), 3) * 0.08;
    let w1 = pwor(uv * 13.0 + wp, vec2f(13.0)); let w2 = pwor(uv * 31.0 + 3.0, vec2f(31.0)); let w3 = pwor(uv * 78.0, vec2f(78.0));
    let m1 = smoothstep(0.03, 0.12, w1.y - w1.x) * step(0.35, w1.z); let h1 = sqrt(sat(1.0 - w1.x * 1.7)) * (0.55 + 0.45 * w1.z);
    let m2 = smoothstep(0.03, 0.14, w2.y - w2.x) * step(0.25, w2.z); let h2 = sqrt(sat(1.0 - w2.x * 1.8)) * 0.5;
    let m3 = smoothstep(0.02, 0.14, w3.y - w3.x); let h3 = sat(1.0 - w3.x * 1.8) * 0.18;
    let n = pfbm(uv * 40.0, vec2f(40.0), 3);
    h = max(max(m1 * h1, m2 * h2), m3 * h3 + 0.06) + n * 0.03;
    let c1 = mix(vec3f(0.36, 0.32, 0.28), vec3f(0.46, 0.40, 0.33), w1.z) * mix(vec3f(1.0), vec3f(1.1, 0.85, 0.7), step(0.8, w1.z));
    let c2 = mix(vec3f(0.30, 0.27, 0.24), vec3f(0.55, 0.50, 0.44), w2.z);
    alb = mix(vec3f(0.30, 0.23, 0.17), vec3f(0.40, 0.33, 0.26) * (0.8 + w3.z * 0.35), m3);
    if (m2 * h2 > m3 * h3 + 0.06) { alb = c2; } if (m1 * h1 >= max(m2 * h2, m3 * h3 + 0.06)) { alb = c1; }
    alb *= 0.9 + n * 0.2; ao = smoothstep(0.02, 0.3, h) * 0.3 + 0.7; rough = 0.82;
  } else if (L == 2u) { // lama
    let n1 = pfbm(uv * 3.0, vec2f(3.0), 4); let n2 = pfbm(uv * 9.0 + 3.0, vec2f(9.0), 4); let r = 1.0 - abs(pfbm(uv * 5.0 + 1.0, vec2f(5.0), 4));
    let n3 = pfbm(uv * 60.0, vec2f(60.0), 2);
    h = 0.5 + n1 * 0.30 + n2 * 0.14 + r * r * 0.14 + n3 * 0.015;
    alb = mix(vec3f(0.115, 0.07, 0.045), vec3f(0.23, 0.145, 0.09), sat(0.45 + n2 + n1 * 0.5)); rough = mix(0.16, 0.62, smoothstep(0.36, 0.66, h)); ao = 0.85 + 0.15 * smoothstep(0.3, 0.6, h);
  } else if (L == 3u) { // rocha
    let wpv = vec2f(pfbm(uv * 4.0 + 2.0, vec2f(4.0), 3), pfbm(uv * 4.0 + 9.0, vec2f(4.0), 3));
    let r = 1.0 - abs(pfbm(uv * 4.0 + wpv * 0.3, vec2f(4.0), 5)); let wc = pwor(uv * 7.0 + wpv * 0.35, vec2f(7.0));
    let crack = smoothstep(0.035, 0.0, wc.y - wc.x) * 0.7; let n = pfbm(uv * 24.0, vec2f(24.0), 4); let n2 = pfbm(uv * 90.0, vec2f(90.0), 2);
    h = 0.30 + r * r * 0.45 + wc.z * 0.18 + n * 0.09 + n2 * 0.02 - crack * 0.32;
    alb = mix(vec3f(0.20, 0.175, 0.15), vec3f(0.37, 0.33, 0.28), sat(r * 0.8 + n * 0.5)) * (0.8 + wc.z * 0.4);
    alb = mix(alb, vec3f(0.30, 0.34, 0.17), smoothstep(0.12, 0.4, pfbm(uv * 7.0 + 9.0, vec2f(7.0), 4)) * 0.55);
    alb = mix(alb, vec3f(0.36, 0.22, 0.14), smoothstep(0.2, 0.5, pfbm(uv * 3.0 + 4.0, vec2f(3.0), 3)) * 0.35);
    alb *= 1.0 - crack * 0.3; rough = 0.86; ao = 1.0 - crack * 0.35;
  } else if (L == 4u) { // chão de capim
    let n1 = pfbm(uv * 4.0, vec2f(4.0), 4); let n2 = pfbm(uv * 32.0, vec2f(32.0), 3); let fib = pvn(vec2f(uv.x * 220.0 + n1 * 6.0, uv.y * 55.0), vec2f(220.0, 55.0));
    let fib2 = pvn(vec2f(uv.x * 60.0, uv.y * 200.0 + n1 * 5.0), vec2f(60.0, 200.0));
    alb = mix(vec3f(0.050, 0.095, 0.020), vec3f(0.12, 0.185, 0.045), sat(0.5 + n1 + n2 * 0.5));
    alb = mix(alb, vec3f(0.20, 0.19, 0.07), smoothstep(0.1, 0.55, pfbm(uv * 9.0 + 3.0, vec2f(9.0), 3)) * 0.4);
    let soil = smoothstep(0.30, 0.50, pfbm(uv * 6.0 + 13.0, vec2f(6.0), 4)); alb = mix(alb, vec3f(0.17, 0.115, 0.07), soil * 0.6);
    alb *= 0.8 + (fib + fib2) * 0.18; h = 0.5 + n2 * 0.25 + (fib + fib2) * 0.14 - soil * 0.15; rough = 0.9;
  } else if (L == 5u) { // casca
    let wr = pwor(vec2f(uv.x * 9.0, uv.y * 3.0) + pfbm(uv * vec2f(6.0, 3.0), vec2f(6.0, 3.0), 3) * 0.5, vec2f(9.0, 3.0));
    let fur = smoothstep(0.0, 0.16, wr.y - wr.x); let n = pfbm(uv * vec2f(48.0, 12.0), vec2f(48.0, 12.0), 3); let n2 = pfbm(uv * 5.0, vec2f(5.0), 3);
    h = fur * (0.55 + 0.4 * wr.z) + n * 0.14;
    alb = mix(vec3f(0.12, 0.095, 0.075), vec3f(0.25, 0.21, 0.17), sat(h)) * (0.85 + n2 * 0.4);
    alb = mix(alb, vec3f(0.16, 0.20, 0.09), smoothstep(0.15, 0.5, n2) * 0.4); rough = 0.9; ao = 0.72 + 0.28 * fur;
  } else if (L == 6u) { // tábuas
    let pl = uv.y * 4.0; let id = floor(pl); let f = fract(pl); let hh = hash11(id + 3.0);
    let gap = smoothstep(0.0, 0.035, f) * smoothstep(1.0, 0.965, f);
    let g = pfbm(vec2f(uv.x * 5.0 + hh * 31.0, uv.y * 64.0), vec2f(5.0, 64.0), 4); let g2 = pfbm(vec2f(uv.x * 14.0 + hh * 7.0, uv.y * 160.0), vec2f(14.0, 160.0), 3);
    let ring = sin((g * 2.2 + f * 2.0 + hh) * 18.0) * 0.5 + 0.5;
    let kn = pwor(vec2f(uv.x * 3.0 + hh * 5.0, uv.y * 4.0), vec2f(3.0, 4.0)); let knot = smoothstep(0.16, 0.05, kn.x) * step(0.7, kn.z);
    alb = mix(vec3f(0.19, 0.145, 0.10), vec3f(0.40, 0.33, 0.25), sat(0.5 + g * 0.9 + ring * 0.2)) * (0.75 + 0.4 * hh);
    alb = mix(alb, vec3f(0.33, 0.32, 0.30), 0.35 + g2 * 0.3); alb = mix(alb, vec3f(0.10, 0.07, 0.05), knot);
    h = gap * (0.7 + g * 0.2 + g2 * 0.12 + ring * 0.05 - knot * 0.1); alb *= 0.35 + 0.65 * gap; rough = 0.82; ao = 0.3 + 0.7 * gap;
  } else if (L == 7u || L == 8u) { // cartão de folhas (7: folhosa, 8: tufo de araucária)
    var best = 0.0; var col = vec3f(0.0); var hb = 0.0;
    if (L == 7u) {
      for (var k = 0; k < 120; k++) {
        let fk = f32(k); let c0 = vec2f(hash11(fk * 1.7 + 0.3), hash11(fk * 2.9 + 5.1)); let c = 0.5 + (c0 - 0.5) * 0.84;
        let ang = hash11(fk * 4.3 + 1.9) * 6.283; let len = 0.075 + 0.055 * hash11(fk * 6.1); let lf = leafAt(uv, c - vec2f(cos(ang), sin(ang)) * len * 0.5, ang, len, len * 0.34);
        if (lf.x > 0.0 && fk * 0.001 + lf.x >= best * 0.999) { best = max(best, lf.x); let t = hash11(fk * 9.7);
          col = mix(vec3f(0.030, 0.075, 0.016), vec3f(0.085, 0.155, 0.030), t) * (0.75 + 0.5 * lf.y); col = mix(col, vec3f(0.20, 0.19, 0.04), step(0.9, t) * 0.6);
          col *= 0.8 + 0.4 * smoothstep(0.75, 1.0, lf.y); hb = lf.y; }
      }
    } else {
      for (var k = 0; k < 13; k++) {
        let fk = f32(k); let ang = (fk / 13.0) * 6.283 + hash11(fk) * 0.4; let dir = vec2f(cos(ang), sin(ang)); let len = 0.30 + 0.14 * hash11(fk * 3.1);
        let d = uv - vec2f(0.5); let al0 = dot(d, dir); let pe = d.x * dir.y - d.y * dir.x; let u = al0 / len;
        if (u > 0.0 && u < 1.0) { let spk = 0.5 + 0.5 * sin(u * 70.0 + fk * 2.0); let w = 0.055 * (0.5 + 0.5 * sin(u * PI)) * (0.7 + 0.5 * spk) + 0.012;
          let e = smoothstep(w, w * 0.6, abs(pe)); if (e > best) { best = e; hb = 1.0 - abs(pe) / w; col = mix(vec3f(0.018, 0.05, 0.02), vec3f(0.06, 0.12, 0.035), u * (0.5 + 0.5 * spk)) * (0.7 + 0.5 * hb); } }
      }
      let cd = length(uv - 0.5); let core = smoothstep(0.16, 0.1, cd); if (core > best) { best = core; col = vec3f(0.03, 0.065, 0.02); hb = 1.0 - cd * 5.0; }
    }
    alb = col; al = best; h = hb * 0.5; rough = 0.55; ao = 0.6 + 0.4 * hb;
  } else { // serrapilheira (folhas secas)
    let w1 = pwor(uv * 34.0 + pfbm(uv * 8.0, vec2f(8.0), 3) * 0.3, vec2f(34.0)); let w2 = pwor(uv * 71.0, vec2f(71.0)); let n = pfbm(uv * 5.0, vec2f(5.0), 4);
    let e1 = smoothstep(0.0, 0.08, w1.y - w1.x); let e2 = smoothstep(0.0, 0.1, w2.y - w2.x);
    let c1 = mix(vec3f(0.10, 0.065, 0.035), vec3f(0.20, 0.14, 0.06), w1.z); let c2 = mix(vec3f(0.06, 0.045, 0.025), vec3f(0.15, 0.11, 0.06), w2.z);
    alb = mix(c2 * (0.5 + 0.5 * e2), c1, step(0.45, w1.z) * e1); alb = mix(alb, vec3f(0.10, 0.13, 0.04), smoothstep(0.1, 0.4, n) * 0.5); alb *= 0.6 + 0.4 * e1;
    h = 0.4 + e1 * 0.25 * w1.z + e2 * 0.1 + n * 0.1; rough = 0.88; ao = 0.6 + 0.4 * e1;
  }
  var o: MO; o.a = vec4f(alb, h); o.b = vec4f(rough, ao, al, 0.0); return o;
}
`;
const WG_MATFIN = FS_TRI + /* wgsl */`
@group(0) @binding(0) var ta: texture_2d_array<f32>;
@group(0) @binding(1) var tb: texture_2d_array<f32>;
struct MO { @location(0) a: vec4f, @location(1) b: vec4f };
fn H(p: vec2i, L: i32) -> f32 { return textureLoad(ta, (p + vec2i(1024)) % vec2i(1024), L, 0).w; }
@fragment fn fs(i: FsV) -> MO {
  let p = vec2i(i.pos.xy); let L = i32(i.inst); let a = textureLoad(ta, p, L, 0); let b = textureLoad(tb, p, L, 0);
  var k = 6.0; if (L == 1) { k = 9.0; } if (L == 2) { k = 3.5; } if (L == 3) { k = 9.0; } if (L == 5) { k = 8.0; } if (L == 6) { k = 5.0; } if (L == 7 || L == 8) { k = 2.0; }
  let dx = (H(p + vec2i(1, 0), L) - H(p - vec2i(1, 0), L)) + 0.5 * (H(p + vec2i(2, 0), L) - H(p - vec2i(2, 0), L));
  let dy = (H(p + vec2i(0, 1), L) - H(p - vec2i(0, 1), L)) + 0.5 * (H(p + vec2i(0, 2), L) - H(p - vec2i(0, 2), L));
  let n = normalize(vec3f(-dx * k, -dy * k, 1.0));
  var o: MO; o.a = vec4f(a.rgb, select(a.w, b.z, L == 7 || L == 8)); o.b = vec4f(n.xy * 0.5 + 0.5, b.x, b.y); return o;
}
`;
// céu analítico de fim de tarde + nuvens volumétricas (integradas uma vez, na carga)
const WG_SKYFN = /* wgsl */`
fn skyBase(d: vec3f, sun: vec3f) -> vec3f {
  let y = max(d.y, 0.0); let mu = dot(d, sun); let az = sat(dot(normalize(d.xz + 1e-5), normalize(sun.xz)) * 0.5 + 0.5);
  var c = mix(vec3f(0.045, 0.135, 0.40), vec3f(0.36, 0.46, 0.62), pow(1.0 - y, 3.5));
  c = mix(c, vec3f(1.55, 0.80, 0.34), pow(az, 3.0) * pow(1.0 - y, 8.0) * 0.9);
  c = mix(c, vec3f(0.95, 0.70, 0.50), pow(az, 2.0) * pow(1.0 - y, 4.0) * 0.40);
  c = mix(c, vec3f(0.46, 0.36, 0.46), pow(1.0 - az, 2.0) * pow(1.0 - y, 9.0) * 0.6);
  c += vec3f(1.0, 0.50, 0.20) * pow(sat(mu), 6.0) * 0.55 + vec3f(1.0, 0.72, 0.42) * pow(sat(mu), 90.0) * 2.2;
  return c * 1.5;
}
`;
const WG_SKYBAKE = WG_COMMON + FS_TRI + WG_SKYFN + /* wgsl */`
fn cDens(p: vec3f, lod: f32) -> f32 {
  let hf = (p.y - 1500.0) / 1500.0; if (hf < 0.0 || hf > 1.0) { return 0.0; }
  let cov = textureSampleLevel(noiseT, sRep, p.xz / 61000.0 + 0.13, 0.0).x;
  let b = textureSampleLevel(noise3T, sRep, p * vec3f(1.0, 1.6, 1.0) / 7200.0 + vec3f(0.31, 0.0, 0.17), 0.0);
  let prof = smoothstep(0.0, 0.14, hf) * smoothstep(1.0, 0.35 + cov * 0.4, hf);
  var d = b.x * 0.72 + b.y * 0.28 - (0.72 - cov * 0.34); d *= prof;
  if (d > 0.0 && lod < 0.5) { let e = textureSampleLevel(noise3T, sRep, p / 1500.0, 0.0); d -= (e.z * 0.6 + e.w * 0.4) * 0.11 * (1.0 - hf * 0.5); }
  return sat(d * 3.4);
}
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let d = panoToDir(i.uv); let sun = F.sun.xyz; var col = skyBase(d, sun);
  if (d.y < 0.0) { let g = mix(vec3f(0.035, 0.05, 0.022), vec3f(0.10, 0.075, 0.04), sat(dot(d.xz, sun.xz) * 0.5 + 0.5)); return vec4f(mix(col * 0.5, g, smoothstep(0.0, -0.06, d.y)), 1.0); }
  // cirros altos
  let cu = d.xz / (d.y + 0.12); let ci = textureSampleLevel(noiseT, sRep, cu * vec2f(0.035, 0.11) + 0.4, 0.0); let ci2 = textureSampleLevel(noiseT, sRep, cu * vec2f(0.12, 0.31), 0.0);
  let cir = smoothstep(0.58, 0.9, ci.x * 0.65 + ci2.y * 0.45) * smoothstep(0.02, 0.25, d.y) * 0.45;
  let mu = dot(d, sun); let sc = F.sunCol.rgb;
  col = mix(col, sc * (0.10 + 0.5 * pow(sat(mu), 3.0)) + vec3f(0.30, 0.26, 0.30), cir);
  if (d.y > 0.012) {
    let t0 = 1500.0 / d.y; let t1 = min(3000.0 / d.y, t0 + 26000.0); let n = 56.0; let dt = (t1 - t0) / n; var T = 1.0; var acc = vec3f(0.0);
    let hg = mix((1.0 - 0.36) / pow(1.6 - 1.2 * mu, 1.5), (1.0 - 0.04) / pow(1.04 + 0.4 * mu, 1.5), 0.35) * 0.25;
    var t = t0 + dt * hash12(i.pos.xy);
    for (var k = 0; k < 56; k++) {
      let p = d * t; let de = cDens(p, 0.0);
      if (de > 0.003) {
        var od = 0.0; for (var j = 1; j <= 5; j++) { od += cDens(p + sun * (f32(j) * f32(j) * 42.0), 1.0) * (f32(j) * 70.0); }
        let hf = (p.y - 1500.0) / 1500.0; let beer = exp(-od * 0.011) * 0.85 + exp(-od * 0.0028) * 0.15; let pw = 1.0 - exp(-de * 6.0 - od * 0.02);
        let L = sc * (beer * (0.55 + 0.45 * pw) * (hg * 4.5 + 0.20)) * 1.15 + mix(vec3f(0.13, 0.15, 0.22), vec3f(0.24, 0.30, 0.44), hf) * 0.95 + vec3f(0.30, 0.13, 0.05) * (1.0 - hf) * 0.25;
        let a = 1.0 - exp(-de * dt * 0.0105); let fogk = exp(-t / 34000.0);
        acc += T * a * mix(skyBase(d, sun), L, fogk); T *= 1.0 - a; if (T < 0.01) { break; }
      }
      t += dt;
    }
    col = col * T + acc;
  }
  return vec4f(col, 1.0);
}
`;
// mapa de ambiente (reflexos/ambiente difuso): céu + chão + faixa de mata no horizonte
const WG_ENVBAKE = WG_COMMON + FS_TRI + /* wgsl */`
@group(1) @binding(0) var skyT: texture_2d<f32>;
@fragment fn fs(i: FsV) -> @location(0) vec4f {
  let d = panoToDir(i.uv); var c = textureSampleLevel(skyT, sClamp, vec2f(i.uv.x, min(i.uv.y, 0.497)), 2.0).rgb;
  let az = i.uv.x * 6.283; let n = textureSampleLevel(noiseT, sRep, vec2f(i.uv.x * 9.0, 0.3), 0.0); let n2 = textureSampleLevel(noiseT, sRep, vec2f(i.uv.x * 31.0, 0.7), 0.0);
  let th = 0.035 + n.x * 0.09 + n2.y * 0.035; let sunSide = sat(dot(normalize(d.xz + 1e-5), normalize(F.sun.xz)) * 0.5 + 0.5);
  let tree = mix(vec3f(0.020, 0.032, 0.014), vec3f(0.07, 0.065, 0.025), (1.0 - sunSide) * 0.9 + 0.1) * 1.2;
  let ground = mix(vec3f(0.07, 0.085, 0.03), vec3f(0.16, 0.11, 0.06), sat(-d.y * 2.5)) * (0.55 + 0.6 * (1.0 - sunSide));
  if (d.y < th) { c = mix(c, tree, smoothstep(th, th - 0.012, d.y)); }
  if (d.y < 0.0) { c = mix(tree, ground, smoothstep(0.0, -0.10, d.y)); }
  return vec4f(c, 1.0);
}
`;
