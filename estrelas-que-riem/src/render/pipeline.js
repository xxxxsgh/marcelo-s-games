import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U } from './paint.js';

// Passe final: papel de aquarela. Borda de pigmento, tremor de mao, fibras
// do papel, granulacao e vinheta irregular — tudo em espaco de tela.
const PaperShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uBoil: U.uBoil,
    uTime: U.uTime,
    uFade: { value: 0 },
    uFadeCol: { value: new THREE.Color('#f4ead6') },
    uWarmth: { value: 0 },
    uStrength: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uBoil, uTime, uFade, uWarmth, uStrength;
    uniform vec3 uFadeCol;
    varying vec2 vUv;
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ return n2(p)*0.5 + n2(p*2.1)*0.28 + n2(p*4.3)*0.14 + n2(p*8.7)*0.08; }
    vec3 lum3(vec3 c){ return vec3(dot(c, vec3(0.299,0.587,0.114))); }
    void main(){
      vec2 px = 1.0 / uRes;
      float asp = uRes.x / uRes.y;
      // tremor de mao: o desenho respira em passos (8 qps)
      vec2 wob = vec2(fbm(vUv*vec2(asp,1.0)*3.0 + uBoil*1.7), fbm(vUv*vec2(asp,1.0)*3.0 + 9.1 - uBoil*1.3)) - 0.5;
      vec2 uv = vUv + wob * 0.0026 * uStrength;
      vec3 c = texture2D(tDiffuse, uv).rgb;

      // borda de pigmento: a tinta acumula onde a cor muda
      vec3 a = texture2D(tDiffuse, uv + vec2(px.x*1.5, 0.0)).rgb;
      vec3 b = texture2D(tDiffuse, uv - vec2(px.x*1.5, 0.0)).rgb;
      vec3 d = texture2D(tDiffuse, uv + vec2(0.0, px.y*1.5)).rgb;
      vec3 e = texture2D(tDiffuse, uv - vec2(0.0, px.y*1.5)).rgb;
      vec3 blur = (a+b+d+e) * 0.25;
      float edge = length(c - blur);
      c = mix(c, c * (1.0 - clamp(edge * 2.2, 0.0, 0.32)), uStrength);
      // umidade: leve "sangrado" pra dentro das areas
      c = mix(c, blur, 0.18 * uStrength);

      // papel: fibras + manchas de lavagem
      vec2 sp = gl_FragCoord.xy;
      float fib = fbm(sp * vec2(0.9, 0.25)) * 0.5 + fbm(sp * vec2(0.22, 0.8)) * 0.5;
      float wash = fbm(vUv * vec2(asp, 1.0) * 2.2 + 4.0);
      float tooth = n2(sp * 0.7);
      float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
      c *= mix(1.0, 0.94 + 0.08 * fib, uStrength);
      c -= (1.0 - tooth) * 0.05 * (0.4 + sat) * uStrength;       // granulacao
      c *= mix(1.0, 0.95 + 0.1 * wash, uStrength);               // lavagem irregular
      // tom geral de papel antigo
      vec3 paper = vec3(0.97, 0.93, 0.85);
      c = mix(c, c * paper + paper * 0.03, 0.3 * uStrength);
      c = mix(c, lum3(c), 0.06);
      c += vec3(0.04, 0.02, -0.02) * uWarmth;

      // vinheta com borda de papel queimado, irregular
      vec2 q = vUv - 0.5; q.x *= asp;
      float vig = length(q) + (fbm(vUv * 6.0) - 0.5) * 0.08;
      c *= mix(1.0, smoothstep(1.05, 0.35, vig) * 0.35 + 0.65, uStrength);
      // fade pra papel (transicoes)
      float fn = uFade + (fbm(sp * 0.01 + uTime*0.1) - 0.5) * 0.5 * uFade * (1.0 - uFade) * 2.0;
      c = mix(c, uFadeCol * (0.96 + 0.06 * fib), clamp(fn, 0.0, 1.0));
      // grao leve
      c += (h12(sp + fract(uTime) * 100.0) - 0.5) * 0.018;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Pipeline {
  constructor(container, quality) {
    this.quality = quality;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'baixa', powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'alta' ? 2 : quality === 'media' ? 1.5 : 1));
    r.shadowMap.enabled = quality !== 'baixa';
    this.shadowSize = quality === 'alta' ? 2048 : 1024;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2000);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.paper = new ShaderPass(PaperShader);
    this.composer.addPass(this.paper);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get fade() { return this.paper.uniforms.uFade.value; }
  set fade(v) { this.paper.uniforms.uFade.value = v; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.paper.uniforms.uRes.value.set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 68 : 50;
    this.camera.updateProjectionMatrix();
  }

  render() { this.composer.render(); }
}
