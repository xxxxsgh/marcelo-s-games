import * as THREE from 'three';
import { paint, U } from './paint.js';

/** Poeirinha que levanta nos passos e na aterrissagem. */
export class Dust {
  constructor(scene) {
    this.mat = paint('#e8dcc4', { rim: 0.2, soft: 0.35, grain: 0.6 });
    this.pool = [];
    const geo = new THREE.IcosahedronGeometry(0.06, 1);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.visible = false;
      m.castShadow = false;
      m.userData = { life: 0, v: new THREE.Vector3() };
      scene.add(m);
      this.pool.push(m);
    }
    this.i = 0;
  }

  color(c) { this.mat.color.set(c); }

  puff(pos, up, n = 3, power = 1) {
    for (let k = 0; k < n; k++) {
      const m = this.pool[this.i++ % this.pool.length];
      const side = new THREE.Vector3().randomDirection();
      side.addScaledVector(up, -side.dot(up)).normalize();
      m.position.copy(pos).addScaledVector(side, 0.08).addScaledVector(up, 0.04);
      m.userData.v.copy(side).multiplyScalar((0.4 + Math.random() * 0.5) * power).addScaledVector(up, 0.35 * power);
      m.userData.life = 1;
      m.userData.s = (0.7 + Math.random() * 0.6) * power;
      m.visible = true;
    }
  }

  update(dt) {
    for (const m of this.pool) {
      const d = m.userData;
      if (d.life <= 0) continue;
      d.life -= dt * 1.7;
      if (d.life <= 0) { m.visible = false; continue; }
      m.position.addScaledVector(d.v, dt);
      d.v.multiplyScalar(1 - dt * 3);
      const k = d.life;
      m.scale.setScalar(d.s * (1.6 - k) * Math.min(1, k * 3));
    }
  }
}

/** Polen/vaga-lumes flutuando em volta da camera. De noite, brilham mais. */
export class Motes {
  constructor(scene, n = 90) {
    this.n = n;
    this.box = 14;
    const pos = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * this.box, (Math.random() - 0.5) * this.box, (Math.random() - 0.5) * this.box], i * 3);
      ph[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    this.uniforms = {
      uTime: U.uTime, uNight: U.uNight, uCenter: { value: new THREE.Vector3() }, uBox: { value: this.box },
      uPx: { value: Math.min(window.devicePixelRatio, 2) }, uAmt: { value: 1 },
      uCol: { value: new THREE.Color('#fff2c8') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aPh;
        uniform float uTime, uNight, uBox, uPx, uAmt; uniform vec3 uCenter;
        varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime*0.3 + aPh), sin(uTime*0.23 + aPh*1.7) * 0.6 + uTime * 0.12, cos(uTime*0.27 + aPh*0.7)) * 1.2;
          // mantem as particulas numa caixa que acompanha a camera
          p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5 + uCenter;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          float blink = 0.5 + 0.5 * sin(uTime * (1.5 + fract(aPh) * 2.0) + aPh);
          vA = uAmt * smoothstep(0.5, 2.0, d) * smoothstep(uBox * 0.5, uBox * 0.3, d) * mix(0.35, 1.3 * blink + 0.15, uNight);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (3.0 + 7.0 * uNight * blink) * (8.0 / max(d, 1.0));
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol; varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-r * r * 3.5);
          gl_FragColor = vec4(uCol * a * vA, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(camera) { this.uniforms.uCenter.value.copy(camera.position); }
}
