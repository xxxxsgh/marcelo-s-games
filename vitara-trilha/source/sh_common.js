// sh_common.js — WGSL compartilhado por todas as passadas
const WG_COMMON = /* wgsl */`
struct Frame {
  vp: mat4x4f, pvp: mat4x4f, vpNJ: mat4x4f, ivp: mat4x4f, view: mat4x4f, proj: mat4x4f,
  svp: array<mat4x4f, 3>,
  cam: vec4f,      // xyz, tempo
  sun: vec4f,      // direção para o sol, tempo anterior
  sunCol: vec4f,   // rgb, exposição
  res: vec4f,      // w, h, 1/w, 1/h
  jit: vec4f,      // jitter atual (uv), anterior
  split: vec4f,    // fim das cascatas (m), w = L da trilha
  misc: vec4f,     // quadro, dt, near, tan(fov/2)
  wind: vec4f,     // dir xz, força, câmera (0 persegue, 1 capô)
  shTex: vec4f,    // tamanho do texel de sombra por cascata (m)
  car: vec4f,      // posição do carro (xyz), velocidade
  pad1: vec4f, pad2: vec4f,
};
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var sRep: sampler;
@group(0) @binding(2) var sClamp: sampler;
@group(0) @binding(3) var noiseT: texture_2d<f32>;
@group(0) @binding(4) var noise3T: texture_3d<f32>;
@group(0) @binding(5) var sAni: sampler;
const PI = 3.14159265;
fn sat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn sat3(x: vec3f) -> vec3f { return clamp(x, vec3f(0.0), vec3f(1.0)); }
fn hash12(p: vec2f) -> f32 { var p3 = fract(vec3f(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
fn hash22(p: vec2f) -> vec2f { var p3 = fract(vec3f(p.xyx) * vec3f(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
fn hash11(p: f32) -> f32 { var q = fract(p * 0.1031); q *= q + 33.33; q *= q + q; return fract(q); }
fn ign(p: vec2f, fr: f32) -> f32 { let q = p + 5.588238 * (fr % 64.0); return fract(52.9829189 * fract(0.06711056 * q.x + 0.00583715 * q.y)); }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
fn dirToPano(d: vec3f) -> vec2f { return vec2f(atan2(d.z, d.x) / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI); }
fn panoToDir(uv: vec2f) -> vec3f { let ph = (uv.x - 0.5) * 2.0 * PI; let th = uv.y * PI; return vec3f(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)); }
fn worldFromDepth(uv: vec2f, d: f32) -> vec3f { let p = F.ivp * vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0); return p.xyz / p.w; }
fn linDepth(d: f32) -> f32 { return F.misc.z / max(d, 1e-7); }
fn motionOf(cur: vec4f, prev: vec4f) -> vec2f { return (cur.xy / cur.w - prev.xy / prev.w) * vec2f(0.5, -0.5); }
struct GOut { @location(0) alb: vec4f, @location(1) nrm: vec4f, @location(2) misc: vec4f, @location(3) mv: vec2f };
// vento: deslocamento de folhagem (pos no mundo, peso, fase, tempo)
fn windOff(p: vec3f, w: f32, ph: f32, t: f32) -> vec3f {
  let d = F.wind.xy; let g = sin(dot(p.xz, d) * 0.045 - t * 0.9) * 0.5 + 0.5;
  let s = F.wind.z * (0.35 + 0.65 * g);
  let sway = sin(t * 1.3 + ph * 6.28 + p.x * 0.08) * 0.6 + sin(t * 2.7 + ph * 11.0 + p.z * 0.11) * 0.25;
  let fl = sin(t * 6.1 + p.x * 2.3 + p.y * 3.1 + ph * 20.0) * 0.5 + sin(t * 9.3 + p.z * 2.9 + ph * 7.0) * 0.5;
  return vec3f(d.x, 0.0, d.y) * (s * w * (0.55 + sway * 0.45)) + vec3f(fl, fl * 0.6, -fl) * (0.035 * s * min(w * 3.0, 1.0));
}
`;
// dados do terreno (grupo 1 nas passadas de terreno / capim / água)
const WG_TERRAIN_DATA = /* wgsl */`
@group(1) @binding(0) var hNearT: texture_2d<f32>;
@group(1) @binding(1) var hFarT: texture_2d<f32>;
@group(1) @binding(2) var nrmNearT: texture_2d<f32>;
@group(1) @binding(3) var maskT: texture_2d<f32>;
@group(1) @binding(4) var fieldT: texture_2d<f32>;
@group(1) @binding(5) var matA: texture_2d_array<f32>;
@group(1) @binding(6) var matN: texture_2d_array<f32>;
@group(1) @binding(7) var rutT: texture_2d<f32>;
fn hLoad(t: texture_2d<f32>, f: vec2f, n: i32) -> f32 {
  let fl = floor(f); let u = f - fl; let i = clamp(vec2i(fl), vec2i(0), vec2i(n - 2));
  let a = textureLoad(t, i, 0).x; let b = textureLoad(t, i + vec2i(1, 0), 0).x; let c = textureLoad(t, i + vec2i(0, 1), 0).x; let d = textureLoad(t, i + vec2i(1, 1), 0).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn hFarAt(p: vec2f) -> f32 { return hLoad(hFarT, (p + 8192.0) / 16.0 - 0.5, 1024); }
fn canopyH(p: vec2f) -> f32 {
  let r = length(p); if (r < 380.0) { return 0.0; }
  let n = textureSampleLevel(noiseT, sRep, p / 97.0, 0.0);
  return smoothstep(380.0, 450.0, r) * (9.0 + n.z * 7.0 + n.y * 4.0);
}
fn terrainH(p: vec2f) -> f32 {
  let e = max(abs(p.x), abs(p.y)); var h: f32;
  if (e < 508.0) { h = hLoad(hNearT, (p + 512.0) * 2.0 - 0.5, 2048); if (e > 470.0) { h = mix(h, hFarAt(p), smoothstep(470.0, 506.0, e)); } }
  else { h = hFarAt(p); }
  return h + canopyH(p);
}
fn nearUV(p: vec2f) -> vec2f { return (p + 512.0) / 1024.0; }
`;
