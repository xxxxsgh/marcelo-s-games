// sh_fwd.js — passadas diretas sobre o HDR: riacho, fios da cerca, partículas, carimbo de sulcos
const WG_FWD_BIND = /* wgsl */`
@group(1) @binding(0) var depthT: texture_depth_2d;
@group(1) @binding(1) var sceneT: texture_2d<f32>;
@group(1) @binding(4) var envT: texture_2d<f32>;
@group(1) @binding(5) var sPano: sampler;
` + wgShadow(1, 2, 3);
const WG_WATER = WG_COMMON + WG_FWD_BIND + /* wgsl */`
struct WV { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) d: vec4f };
@vertex fn vs(@location(0) pos: vec3f, @location(1) d: vec4f) -> WV { var o: WV; o.wp = pos; o.d = d; o.pos = F.vp * vec4f(pos, 1.0); return o; }
@fragment fn fs(v: WV) -> @location(0) vec4f {
  let px = vec2i(v.pos.xy); let uv = v.pos.xy * F.res.zw; let zs = linDepth(textureLoad(depthT, px, 0)); let zw = v.pos.w; let thick = zs - zw;
  let V = normalize(F.cam.xyz - v.wp); let flow = v.d.zw; let t = F.cam.w; let side = vec2f(-flow.y, flow.x);
  let q = vec2f(dot(v.wp.xz, flow), dot(v.wp.xz, side));
  let n1 = textureSample(noiseT, sRep, q * vec2f(0.21, 0.45) - vec2f(t * 0.22, 0.0)).xy; let n2 = textureSample(noiseT, sRep, q * vec2f(0.55, 0.9) - vec2f(t * 0.41, t * 0.03) + 0.4).yz; let n3 = textureSample(noiseT, sRep, q * vec2f(1.7, 2.3) - vec2f(t * 0.7, 0.0)).zx;
  let dv = sat(thick * abs(V.y) * 1.0 + thick * 0.2);
  let amp = 0.045 + 0.05 * (1.0 - smoothstep(0.0, 0.25, dv));
  let nl = (n1 - 0.5) * 1.0 + (n2 - 0.5) * 0.7 + (n3 - 0.5) * 0.35; let nw = flow * nl.x + side * nl.y; let N = normalize(vec3f(nw.x * amp, 1.0, nw.y * amp));
  var ruv = uv + N.xz * vec2f(0.035, -0.035) * sat(thick * 3.0) / max(zw * 0.15, 1.0);
  let zr = linDepth(textureLoad(depthT, clamp(vec2i(ruv * F.res.xy), vec2i(0), vec2i(F.res.xy) - 1), 0)); if (zr < zw) { ruv = uv; }
  var refr = textureSampleLevel(sceneT, sClamp, ruv, 0.0).rgb; let depthW = max(zr - zw, thick) * (0.35 + 0.65 * abs(V.y));
  let n0 = ign(v.pos.xy, F.misc.x); let sh = shadowAt(v.wp, vec3f(0.0, 1.0, 0.0), zw, n0, 4); let sc = F.sunCol.rgb;
  let amb = textureSampleLevel(envT, sPano, vec2f(0.5, 0.05), 7.0).rgb;
  refr = refr * exp(-depthW * vec3f(1.1, 0.6, 0.7)) + vec3f(0.16, 0.115, 0.065) * (sc * sh * 0.06 + amb * 0.5) * (1.0 - exp(-depthW * 3.0));
  let nv = sat(dot(N, V)); let Fr = 0.02 + 0.98 * pow(1.0 - nv, 5.0); let R = reflect(-V, N);
  var refl = textureSampleLevel(envT, sPano, dirToPano(normalize(vec3f(R.x, abs(R.y) + 0.02, R.z))), 2.0).rgb * 0.5; refl = mix(refl, vec3f(0.035, 0.05, 0.028) * (F.sunCol.rgb * 0.08 + 0.5), 0.45);
  let H = normalize(F.sun.xyz + V); let sp = pow(sat(dot(N, H)), 900.0) * 60.0 * sh;
  var col = mix(refr, refl, Fr) + sc * sp * Fr;
  let foamN = textureSample(noiseT, sRep, q * vec2f(1.1, 1.6) - vec2f(t * 0.5, 0.0)).w * 0.6 + n3.x * 0.6;
  let foam = smoothstep(0.05, 0.0, depthW) * smoothstep(0.45, 0.85, foamN) * 0.55 + smoothstep(0.88, 1.0, foamN * (0.6 + 0.6 * n2.x)) * 0.10;
  col = mix(col, (sc * sh * 0.10 + amb * 0.7) * 0.8, sat(foam));
  return vec4f(col, smoothstep(0.0, 0.025, thick));
}
`;
const WG_WIRE = WG_COMMON + /* wgsl */`
struct LV { @builtin(position) pos: vec4f, @location(0) a: f32, @location(1) wp: vec3f };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) A: vec4f, @location(1) B: vec4f) -> LV {
  var o: LV; let strand = vi / 6u; let c = vi % 6u; let e = f32((0x2Cu >> c) & 1u); let s = f32((0x1Au >> c) & 1u) * 2.0 - 1.0;
  let hA = (0.36 + f32(strand) * 0.29) * A.w; let hB = (0.36 + f32(strand) * 0.29) * B.w;
  let pa = A.xyz + vec3f(0.0, hA, 0.0); let pb = B.xyz + vec3f(0.0, hB, 0.0); let wp = mix(pa, pb, e);
  let ca = F.vp * vec4f(pa, 1.0); let cb = F.vp * vec4f(pb, 1.0); var cp = mix(ca, cb, e);
  let d = normalize((cb.xy / max(cb.w, 1e-3) - ca.xy / max(ca.w, 1e-3)) * F.res.xy + 1e-5); let nrm = vec2f(-d.y, d.x);
  let wpx = 0.0045 * F.res.y / (2.0 * F.misc.w * max(cp.w, 0.05)); let dr = max(wpx, 1.35);
  cp = vec4f(cp.xy + nrm * s * dr * 0.5 * F.res.zw * 2.0 * cp.w, cp.zw); o.pos = cp; o.a = sat(wpx / dr); o.wp = wp; return o;
}
@fragment fn fs(v: LV) -> @location(0) vec4f {
  let V = normalize(F.cam.xyz - v.wp); let g = pow(sat(dot(normalize(F.sun.xyz + V), vec3f(0.0, 1.0, 0.0)) ), 12.0);
  let c = vec3f(0.085, 0.075, 0.07) * (F.sunCol.rgb * 0.10 + 0.25) + F.sunCol.rgb * g * 0.01; return vec4f(c, v.a * 0.92);
}
`;
const WG_PART = WG_COMMON + WG_FWD_BIND + /* wgsl */`
struct QV { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) sd: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) P: vec4f, @location(1) C: vec4f) -> QV {
  var o: QV; let c = vec2f(f32((0x2Cu >> vi) & 1u), f32((0x1Au >> vi) & 1u)) * 2.0 - 1.0;
  let vpz = (F.view * vec4f(P.xyz, 1.0)).xyz + vec3f(c * P.w, 0.0); o.pos = F.proj * vec4f(vpz, 1.0); o.uv = c; o.col = C; o.sd = fract(P.x * 1.37 + P.z * 2.11 + P.w * 7.0); return o;
}
@fragment fn fs(v: QV) -> @location(0) vec4f {
  let r = length(v.uv); if (r > 1.0) { discard; }
  let zs = linDepth(textureLoad(depthT, vec2i(v.pos.xy), 0)); let soft = sat((zs - v.pos.w) / 0.35 + 0.15) * sat((v.pos.w - 0.4) / 2.2);
  let ca = cos(v.sd * 6.28); let sa = sin(v.sd * 6.28); let ruv = vec2f(v.uv.x * ca - v.uv.y * sa, v.uv.x * sa + v.uv.y * ca);
  let n = textureSampleLevel(noiseT, sRep, ruv * 0.21 + v.sd * 3.0, 0.0);
  var a = smoothstep(1.0, 0.25, r + (n.x - 0.5) * 0.7) * (0.55 + 0.6 * n.y);
  if (v.col.a > 1.5) { a = smoothstep(1.0, 0.55, r); return vec4f(v.col.rgb * a * soft, a * soft * (v.col.a - 2.0)); } // gotas/torrões: opacos
  a *= v.col.a * soft; return vec4f(v.col.rgb * a, a);
}
`;
const WG_RUT = /* wgsl */`
struct RV { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) s: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @location(0) A: vec4f, @location(1) B: vec4f) -> RV {
  var o: RV; let e = f32((0x2Cu >> vi) & 1u); let s = f32((0x1Au >> vi) & 1u) * 2.0 - 1.0;
  let d = normalize(A.zw - A.xy + vec2f(1e-5, 0.0)); let n = vec2f(-d.y, d.x); let p = mix(A.xy - d * B.x, A.zw + d * B.x, e) + n * s * B.x;
  o.pos = vec4f(p.x / 150.0, -p.y / 150.0, 0.0, 1.0); o.uv = vec2f(s, 0.0); o.s = B.y; return o;
}
@fragment fn fs(v: RV) -> @location(0) vec4f { return vec4f(v.s * smoothstep(1.0, 0.45, abs(v.uv.x))); }
`;
