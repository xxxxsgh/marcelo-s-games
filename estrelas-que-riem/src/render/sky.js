import * as THREE from 'three';
import { GLSL_NOISE, U } from './paint.js';

/**
 * Ceu pintado. Num planeta pequeno o "horario" depende de onde voce esta:
 * a elevacao do sol e dot(up_local, sol). Andar alguns passos pro lado do
 * terminador e ver o por do sol de novo — como o principe com a cadeira.
 */
export class Sky {
  constructor() {
    this.group = new THREE.Group();
    this.group.renderOrder = -10;
    this.uniforms = {
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uSun: { value: new THREE.Vector3(0.4, 0.6, 0.5).normalize() },
      uAtmo: { value: 1 },
      uTime: U.uTime,
      uDayTop: { value: new THREE.Color('#8fb6d9') },
      uDayHor: { value: new THREE.Color('#f6e7c8') },
      uSetA: { value: new THREE.Color('#f39a5b') },
      uSetB: { value: new THREE.Color('#d8718f') },
      uNightTop: { value: new THREE.Color('#0e1638') },
      uNightHor: { value: new THREE.Color('#2b3470') },
      uNeb: { value: new THREE.Color('#6a4f9c') },
      uNeb2: { value: new THREE.Color('#2f7a8f') },
      uLaugh: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(900, 64, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww; gl_Position.z = gl_Position.w * 0.99999;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uUp, uSun; uniform float uAtmo, uTime, uLaugh;
        uniform vec3 uDayTop, uDayHor, uSetA, uSetB, uNightTop, uNightHor, uNeb, uNeb2;
        varying vec3 vDir;
        ${GLSL_NOISE}
        void main(){
          vec3 v = normalize(vDir);
          float h = dot(v, uUp);
          float e = dot(uSun, uUp);                   // elevacao do sol pro jogador
          float day = smoothstep(-0.18, 0.28, e);
          float set = exp(-pow(e / 0.22, 2.0));       // perto do horizonte
          float towards = pow(max(dot(normalize(v - uUp*h), normalize(uSun - uUp*e)), 0.0), 2.0);

          // pinceladas: ruido esticado deixa marcas de pincel horizontais
          vec3 bp = v * vec3(3.0, 9.0, 3.0);
          float brush = fbm3(bp + vec3(0.0, uTime*0.01, 0.0));
          float brush2 = fbm3(v * 14.0);

          float hh = clamp(h, -1.0, 1.0);
          vec3 dayC = mix(uDayHor, uDayTop, smoothstep(-0.3, 0.32, hh + (brush-0.5)*0.22));
          vec3 nightC = mix(uNightHor, uNightTop, smoothstep(-0.3, 0.8, hh + (brush-0.5)*0.3));
          // nebulosas de aquarela (sempre um pouco, mais forte no espaco)
          float n1 = smoothstep(0.52, 0.8, fbm3(v * 2.2 + 3.1));
          float n2 = smoothstep(0.55, 0.85, fbm3(v * 3.1 - 7.3));
          vec3 nebC = nightC + uNeb * n1 * 0.35 + uNeb2 * n2 * 0.3;
          vec3 c = mix(nebC, dayC, day * uAtmo);
          // faixa de por do sol no horizonte, mais forte do lado do sol
          vec3 setC = mix(uSetB, uSetA, towards);
          float band = exp(-pow((hh - 0.02) / (0.18 + 0.25*towards), 2.0));
          c = mix(c, setC, clamp(set * band * (0.55 + 0.45*towards) * uAtmo * (0.8 + 0.4*brush), 0.0, 1.0));
          // abaixo do horizonte (so no espaco aparece, no planeta o chao cobre)
          // disco do sol
          float sd = dot(v, uSun);
          float disc = smoothstep(0.9975, 0.9985, sd + (brush2-0.5)*0.0015);
          float halo = pow(max(sd, 0.0), 60.0) * 0.6 + pow(max(sd,0.0), 8.0) * 0.12;
          vec3 sunC = mix(vec3(1.0, 0.72, 0.4), vec3(1.0, 0.95, 0.8), day);
          c += sunC * halo * (0.5 + 0.5*uAtmo);
          c = mix(c, sunC * 2.2, disc);
          // manchas de pigmento
          c *= 0.94 + 0.1 * brush2;
          c += vec3(0.9, 0.8, 1.0) * uLaugh * 0.05;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    this.stars = makeStars(this.uniforms);
    this.group.add(this.stars);
  }

  setPalette(p = {}) {
    for (const [k, v] of Object.entries(p)) {
      const key = 'u' + k[0].toUpperCase() + k.slice(1);
      if (this.uniforms[key]) this.uniforms[key].value.set(v);
    }
  }

  // noite vista pelo jogador (0..1)
  night() {
    const e = this.uniforms.uSun.value.dot(this.uniforms.uUp.value);
    const day = THREE.MathUtils.smoothstep(e, -0.18, 0.28);
    return 1 - day * this.uniforms.uAtmo.value;
  }

  update(camera) {
    this.group.position.copy(camera.position);
  }
}

function makeStars(skyU) {
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const data = new Float32Array(N * 3);
  const r = 800;
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    pos.set([q * Math.cos(t) * r, u * r, q * Math.sin(t) * r], i * 3);
    const big = rnd() < 0.06;
    data.set([big ? 18 + rnd() * 12 : 3.5 + rnd() * 5, rnd() * 100, big ? 1 : 0], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uUp: skyU.uUp, uSun: skyU.uSun, uAtmo: skyU.uAtmo, uLaugh: skyU.uLaugh,
      uPx: { value: Math.min(window.devicePixelRatio, 2) },
    },
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 aData;
      uniform float uTime, uAtmo, uLaugh, uPx; uniform vec3 uUp, uSun;
      varying float vA; varying float vStar; varying float vRot;
      void main(){
        vec3 d = normalize(position);
        float e = dot(uSun, uUp);
        float night = 1.0 - smoothstep(-0.25, 0.1, e) * uAtmo;
        night *= mix(1.0, smoothstep(-0.6, 0.2, dot(d, uUp)) * 0.4 + 0.6, uAtmo);
        float horizon = 1.0; // o proprio planeta tampa as estrelas (o horizonte de um asteroide fica bem abaixo do plano)
        float tw = 0.65 + 0.35 * sin(uTime * (1.3 + fract(aData.y)*2.5) + aData.y);
        float laugh = uLaugh * (0.5 + 0.5*sin(uTime*9.0 + aData.y*3.0));
        vA = night * horizon * tw * (0.8 + laugh);
        vStar = aData.z;
        vRot = aData.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w * 0.9999;
        gl_PointSize = aData.x * uPx * (1.0 + laugh*0.6) * (0.85 + 0.15*tw);
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vStar; varying float vRot;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p) * 2.0;
        float a;
        if (vStar > 0.5) {
          // estrela de cinco pontas, pintada a mao
          float ang = atan(p.y, p.x) + vRot;
          float k = 0.55 + 0.45 * pow(abs(cos(ang * 2.5)), 3.0);
          a = smoothstep(k, k - 0.25, r) + exp(-r * 4.0) * 0.6;
        } else {
          a = exp(-r * r * 4.0);
        }
        vec3 c = mix(vec3(1.0, 0.93, 0.72), vec3(1.0, 0.98, 0.9), a);
        gl_FragColor = vec4(c * a * vA * 1.6, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  return pts;
}
