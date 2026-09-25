import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Uniformes compartilhados por todos os materiais pintados.
export const U = {
  uTime: { value: 0 },
  uBoil: { value: 0 },                    // tempo "em passos" (8 qps): traco que treme a mao
  uShade: { value: new THREE.Color('#5b5f9e') }, // sombra de aquarela: fria, violeta
  uWarm: { value: new THREE.Color('#fff3dc') },  // luz: quente, papel
  uInk: { value: new THREE.Color('#3b2a2c') },
  uNight: { value: 0 },                   // 0 dia .. 1 noite (vista do jogador)
};

const GLSL_NOISE = /* glsl */`
float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x), mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x), mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float fbm3(vec3 p){ return vnoise(p)*0.55 + vnoise(p*2.13)*0.3 + vnoise(p*4.41)*0.15; }
`;
export { GLSL_NOISE };

/**
 * Material "aquarela": Lambert (recebe sombra) com a iluminacao refeita:
 *  - terminador ruidoso (borda de pincel entre luz e sombra)
 *  - sombra tingida de violeta em vez de preta
 *  - granulacao de pigmento no espaco do mundo
 */
export function paint(color = '#ffffff', opts = {}) {
  const m = new THREE.MeshLambertMaterial({
    color, vertexColors: !!opts.vertexColors,
    emissive: opts.emissive || '#000000', emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide, flatShading: !!opts.flat,
  });
  const grain = opts.grain ?? 1;
  const gscale = opts.grainScale ?? 3.0;
  const soft = opts.soft ?? 0.14;       // largura da transicao luz/sombra
  const rim = opts.rim ?? 0.35;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.uniforms.uGrain = { value: grain };
    sh.uniforms.uGScale = { value: gscale };
    sh.uniforms.uSoft = { value: soft };
    sh.uniforms.uRim = { value: rim };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWN = normalize(mat3(modelMatrix) * objectNormal);
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        uniform vec3 uShade; uniform vec3 uWarm; uniform float uGrain; uniform float uGScale;
        uniform float uSoft; uniform float uRim; uniform float uNight; uniform float uTime;
        ${GLSL_NOISE}`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 base = diffuseColor.rgb;
          float bl = max(dot(base, vec3(0.299,0.587,0.114)), 0.015);
          float lum = dot(outgoingLight - totalEmissiveRadiance, vec3(0.299,0.587,0.114));
          float lit = lum / bl;
          float g = fbm3(vWP * uGScale);
          float g2 = vnoise(vWP * uGScale * 7.0);
          // borda de pincel: o terminador anda com o ruido
          float t = smoothstep(0.5 - uSoft, 0.5 + uSoft, lit + (g - 0.5) * 0.42);
          vec3 shade = mix(base * uShade, uShade * 0.5, 0.28 + 0.12 * uNight) * (0.95 + 0.25 * g);
          vec3 light = base * uWarm * (0.97 + 0.12 * (g - 0.5));
          vec3 c = mix(shade, light, t);
          // meio-tom: uma segunda "camada" de tinta mais clara onde bate luz forte
          c = mix(c, c * 1.1 + 0.03, smoothstep(0.95, 1.25, lit) * 0.6);
          // borda de luz (contorno do ceu) nos objetos
          vec3 V = normalize(cameraPosition - vWP);
          float fr = pow(1.0 - clamp(dot(V, normalize(vWN)), 0.0, 1.0), 3.0);
          c += fr * uRim * mix(vec3(1.0,0.86,0.66), vec3(0.45,0.55,1.0), uNight) * 0.35;
          // granulacao do pigmento
          c *= 1.0 + (g2 - 0.5) * 0.16 * uGrain;
          outgoingLight = c + totalEmissiveRadiance;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'paint';
  return m;
}

// ---------------------------------------------------------------- tinta nanquim
const inkMats = new Map();
function inkMaterial(color, width) {
  const key = color + ':' + width;
  if (inkMats.has(key)) return inkMats.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uBoil: U.uBoil, uInk: { value: new THREE.Color(color) }, uW: { value: width } },
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      uniform float uBoil; uniform float uW;
      float h(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
      void main(){
        vec4 lp = vec4(position, 1.0);
        vec3 ln = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          ln = mat3(instanceMatrix) * ln;
        #endif
        vec4 mv = modelViewMatrix * lp;
        vec3 n = normalize(normalMatrix * ln);
        // largura quase constante na tela, com tremor de mao desenhada
        float d = clamp(-mv.z, 0.5, 60.0);
        float wob = 0.6 + 0.8 * h(floor(position * 4.0) + uBoil);
        mv.xyz += n * uW * d * 0.0032 * wob;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uInk;
      void main(){ gl_FragColor = vec4(uInk, 1.0); }`,
  });
  inkMats.set(key, m);
  return m;
}

const smoothCache = new WeakMap();
function smoothGeo(geo) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const s = mergeVertices(g, 1e-3);
  s.computeVertexNormals();
  smoothCache.set(geo, s);
  return s;
}

/** Contorno de nanquim (casco invertido) em volta de uma malha. */
export function ink(mesh, width = 1, color = '#3b2a2c') {
  const o = new THREE.Mesh(smoothGeo(mesh.geometry), inkMaterial(color, width));
  o.raycast = () => {};
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

/** Contorno pra InstancedMesh (compartilha as matrizes). */
export function inkInstanced(inst, width = 1, color = '#3b2a2c') {
  const o = new THREE.InstancedMesh(smoothGeo(inst.geometry), inkMaterial(color, width), inst.count);
  o.instanceMatrix = inst.instanceMatrix;
  o.raycast = () => {};
  o.frustumCulled = false;
  inst.add(o);
  return inst;
}

/** Junta pecas coloridas numa geometria so (com cor por vertice). */
export function mergeColored(parts) {
  const geos = parts.map(([g, color, m]) => {
    let geo = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    if (m) geo.applyMatrix4(m);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  });
  return mergeGeometries(geos);
}

/** Cria malha pintada com contorno e sombra. */
export function M(geo, color, opts = {}) {
  const mat = opts.material || paint(color, opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.ink !== false) ink(mesh, opts.inkW ?? 1, opts.inkColor);
  return mesh;
}

/** Material que brilha sozinho (lampiao, estrela, sol) */
export function glow(color, strength = 1.5) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), toneMapped: false });
}
