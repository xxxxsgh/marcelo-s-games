import * as THREE from 'three';
import { M, paint, ink } from '../render/paint.js';

const SKIN = '#f7dcc4';
const COAT = '#6e9c6a';
const COAT2 = '#4f7d57';
const GOLD = '#f1c64d';
const HAIR = '#f3cf57';
const BOOT = '#5b4636';

function limb(len, r, color) {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2 - r * 0.5, 0);
  return M(g, color, { inkW: 0.8 });
}

/**
 * O principezinho: casaco verde comprido, cabelo de trigo, e o cachecol
 * amarelo que voa com o vento (simulado com verlet).
 */
export class PrinceModel {
  constructor() {
    this.group = new THREE.Group();
    const body = this.body = new THREE.Group();
    this.group.add(body);

    // pernas / botas
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.position.set(0.075, 0.34, 0); this.legR.position.set(-0.075, 0.34, 0);
    for (const L of [this.legL, this.legR]) {
      const leg = limb(0.22, 0.05, '#e9e1cf');
      L.add(leg);
      const boot = M(new THREE.SphereGeometry(0.075, 12, 8).scale(1, 0.75, 1.45), BOOT, { inkW: 0.8 });
      boot.position.set(0, -0.32, 0.03);
      L.add(boot);
      body.add(L);
    }

    // casaco: torno de revolucao, abre como sino ate o meio da canela
    const prof = [
      [0.0, 0.92], [0.13, 0.9], [0.17, 0.82], [0.17, 0.7], [0.19, 0.55], [0.23, 0.4], [0.27, 0.26], [0.26, 0.23], [0.0, 0.23],
    ].reverse().map(([x, y]) => new THREE.Vector2(x, y));
    const coatG = new THREE.LatheGeometry(prof, 22);
    const coat = M(coatG, COAT, { inkW: 1.1 });
    body.add(coat);
    // faixa escura na barra do casaco e o cinto
    const belt = M(new THREE.TorusGeometry(0.18, 0.02, 6, 22).rotateX(Math.PI / 2), '#b5463a', { inkW: 0.6 });
    belt.position.y = 0.6; body.add(belt);
    const hem = M(new THREE.TorusGeometry(0.265, 0.018, 6, 24).rotateX(Math.PI / 2), COAT2, { inkW: 0.5 });
    hem.position.y = 0.25; body.add(hem);
    // botoes dourados
    for (let i = 0; i < 3; i++) {
      const b = M(new THREE.SphereGeometry(0.018, 8, 6), GOLD, { ink: false, emissive: '#6b4a10' });
      b.position.set(0, 0.8 - i * 0.09, 0.172 - i * 0.004);
      body.add(b);
    }
    // dragonas com estrelinhas
    for (const s of [-1, 1]) {
      const ep = M(new THREE.SphereGeometry(0.06, 10, 6).scale(1.2, 0.45, 1), GOLD, { inkW: 0.6 });
      ep.position.set(0.16 * s, 0.9, 0);
      body.add(ep);
    }

    // bracos
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    this.armL.position.set(0.19, 0.87, 0); this.armR.position.set(-0.19, 0.87, 0);
    for (const [A, s] of [[this.armL, 1], [this.armR, -1]]) {
      const a = limb(0.24, 0.045, COAT);
      a.rotation.z = 0.12 * s;
      A.add(a);
      const hand = M(new THREE.SphereGeometry(0.045, 10, 8), SKIN, { inkW: 0.6 });
      hand.position.set(0.035 * s, -0.33, 0);
      A.add(hand);
      body.add(A);
    }

    // cabeca
    this.head = new THREE.Group();
    this.head.position.y = 1.08;
    body.add(this.head);
    const skull = M(new THREE.SphereGeometry(0.19, 20, 16), SKIN, { inkW: 1 });
    this.head.add(skull);
    const neck = M(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), SKIN, { ink: false });
    neck.position.y = -0.17; this.head.add(neck);
    // olhos e bochechas
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6).scale(0.85, 1.15, 0.6), new THREE.MeshBasicMaterial({ color: '#2d2330' }));
      eye.position.set(0.065 * s, 0.01, 0.172);
      this.head.add(eye);
      const ch = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: '#f09a8c', transparent: true, opacity: 0.55, depthWrite: false }));
      ch.position.set(0.1 * s, -0.05, 0.16);
      ch.lookAt(ch.position.clone().multiplyScalar(3));
      this.head.add(ch);
    }
    this.eyes = this.head.children.filter((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.radius === 0.021);
    // cabelo: tufos de trigo, bagunçados pelo vento das viagens
    const hairMat = paint(HAIR, { rim: 0.6, emissive: '#3a2a00' });
    const hairMat2 = paint('#e8b93e', { rim: 0.6, emissive: '#3a2a00' });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.198, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
    cap.position.set(0, 0.01, -0.015); cap.rotation.x = -0.42; cap.castShadow = true;
    ink(cap, 0.7);
    this.head.add(cap);
    let s = 11;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 44; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.pow(rnd(), 0.8) * 1.25;
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      if (dir.z > 0.35 && dir.y < 0.82) continue; // deixa o rosto aberto
      if (dir.y < 0.05) continue;
      const len = 0.07 + rnd() * 0.11;
      const g = new THREE.ConeGeometry(0.032 + rnd() * 0.015, len, 4);
      g.translate(0, len / 2, 0);
      const tuft = new THREE.Mesh(g, i % 3 ? hairMat : hairMat2);
      tuft.position.copy(dir).multiplyScalar(0.175).add(new THREE.Vector3(0, 0.02, -0.01));
      const out = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.6, 0.55, -0.25 + (rnd() - 0.5) * 0.4)).normalize();
      tuft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
      tuft.castShadow = true;
      if (i % 2 === 0) ink(tuft, 0.5);
      this.head.add(tuft);
    }
    // franjinha na testa
    for (let i = 0; i < 5; i++) {
      const g = new THREE.ConeGeometry(0.03, 0.09, 4).translate(0, 0.045, 0);
      const f = new THREE.Mesh(g, hairMat);
      const a = (i - 2) * 0.28;
      f.position.set(Math.sin(a) * 0.15, 0.13, Math.cos(a) * 0.12);
      f.rotation.set(1.9, 0, -a * 0.8);
      this.head.add(f);
    }

    // cachecol: volta no pescoco + ponta simulada
    const wrap = M(new THREE.TorusGeometry(0.1, 0.045, 8, 18).rotateX(Math.PI / 2), GOLD, { inkW: 0.8, rim: 0.5 });
    wrap.position.y = 0.95; body.add(wrap);
    this.scarf = new Scarf(10, 0.075);
    this.anchor = new THREE.Object3D();
    this.anchor.position.set(0.07, 0.96, -0.17);
    body.add(this.anchor);

    this.walk = 0;
    this.pose = 'idle';
    this.hold = 0;
  }

  attach(scene) { scene.add(this.scarf.mesh); }
  detach() { this.scarf.mesh.removeFromParent(); }

  /** speed em u/s, grounded, dt, up (mundo), wind (mundo) */
  animate(dt, speed, grounded, t, up, wind, right) {
    const w = Math.min(speed / 3, 1.3);
    this.walk += dt * (4 + speed * 2.4) * (speed > 0.05 ? 1 : 0);
    const sw = Math.sin(this.walk) * 0.75 * w;
    const sitting = this.pose === 'sit' || this.pose === 'chair';
    const lying = this.pose === 'lie';
    const k = 1 - Math.exp(-12 * dt);
    const tgt = (o, x, z = 0) => { o.rotation.x += (x - o.rotation.x) * k; o.rotation.z += (z - o.rotation.z) * k; };
    if (sitting) {
      tgt(this.legL, -1.35); tgt(this.legR, -1.35);
      tgt(this.armL, -0.5, 0.2); tgt(this.armR, -0.5, -0.2);
      this.body.position.y += ((this.pose === 'chair' ? 0.0 : -0.28) - this.body.position.y) * k;
      this.body.rotation.x += (0 - this.body.rotation.x) * k;
    } else if (lying) {
      tgt(this.legL, 0); tgt(this.legR, 0);
      tgt(this.armL, -0.2, 0.3); tgt(this.armR, -0.2, -0.3);
      this.body.position.y += (0.12 - this.body.position.y) * k;
      this.body.rotation.x += (-1.45 - this.body.rotation.x) * k;
    } else {
      tgt(this.legL, grounded ? sw : -0.5); tgt(this.legR, grounded ? -sw : 0.3);
      const hold = this.hold;
      tgt(this.armL, grounded ? -sw * 0.8 - hold * 1.2 : -2.2, grounded ? 0.05 : 0.5);
      tgt(this.armR, grounded ? sw * 0.8 - hold * 1.2 : -2.2, grounded ? -0.05 : -0.5);
      const bob = Math.abs(Math.cos(this.walk)) * 0.04 * w + Math.sin(t * 2) * 0.006;
      this.body.position.y += (bob - this.body.position.y) * k;
      this.body.rotation.x += (w * 0.12 - this.body.rotation.x) * k;
    }
    // piscar
    const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
    for (const e of this.eyes) e.scale.y = blink;
    // cabeca olha um pouquinho pro alto quando parado (estrelas!)
    this.head.rotation.x += ((speed < 0.1 && !sitting ? -0.15 : 0) - this.head.rotation.x) * k * 0.3;

    this.group.updateMatrixWorld(true);
    const a = this.anchor.getWorldPosition(new THREE.Vector3());
    this.scarf.step(dt, a, up, wind, right, this.group.position);
  }
}

/** Fita simulada por verlet, desenhada como tira dupla-face. */
class Scarf {
  constructor(n, seg) {
    this.n = n; this.seg = seg;
    this.p = []; this.o = [];
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector3()); this.o.push(new THREE.Vector3()); }
    this.init = false;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    const uv = new Float32Array(n * 2 * 2);
    for (let i = 0; i < n; i++) uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo = geo;
    const mat = paint(GOLD, { side: THREE.DoubleSide, rim: 0.6, soft: 0.25, emissive: '#3d2800' });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  step(dt, anchor, up, wind, right, base) {
    dt = Math.min(dt, 1 / 30);
    if (!this.init) {
      for (let i = 0; i < this.n; i++) { this.p[i].copy(anchor).addScaledVector(up, -i * this.seg); this.o[i].copy(this.p[i]); }
      this.init = true;
    }
    // teleporte (troca de planeta, cena, cadeira): recomeca a fita no lugar
    if (this.lastAnchor && this.lastAnchor.distanceTo(anchor) > 0.6) this.init = false;
    this.lastAnchor = (this.lastAnchor || new THREE.Vector3()).copy(anchor);
    if (!this.init) {
      for (let i = 0; i < this.n; i++) { this.p[i].copy(anchor).addScaledVector(up, -i * this.seg); this.o[i].copy(this.p[i]); }
      this.init = true;
    }
    const g = up.clone().multiplyScalar(-3.2 * dt * dt);
    const w = wind.clone().multiplyScalar(dt * dt);
    const tmp = new THREE.Vector3();
    for (let i = 1; i < this.n; i++) {
      const p = this.p[i], o = this.o[i];
      tmp.copy(p).sub(o).multiplyScalar(0.94);
      o.copy(p);
      const flutter = Math.sin(performance.now() * 0.006 + i * 0.9) * 0.35;
      p.add(tmp).add(g).addScaledVector(w, 1 + flutter).addScaledVector(right, flutter * 0.4 * dt * dt * wind.length());
    }
    this.p[0].copy(anchor);
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < this.n; i++) {
        const a = this.p[i - 1], b = this.p[i];
        tmp.copy(b).sub(a);
        const d = tmp.length() || 1e-5;
        const diff = (d - this.seg) / d;
        if (i === 1) b.addScaledVector(tmp, -diff);
        else { a.addScaledVector(tmp, diff * 0.5); b.addScaledVector(tmp, -diff * 0.5); }
      }
      this.p[0].copy(anchor);
      // nao atravessa o corpo: empurra pra fora de um cilindro em volta do principe
      if (base) {
        for (let i = 1; i < this.n; i++) {
          const p = this.p[i];
          tmp.copy(p).sub(base);
          const along = tmp.dot(up);
          if (along < -0.1 || along > 1.05) continue;
          tmp.addScaledVector(up, -along);
          const rad = 0.2 + Math.max(0, 0.6 - along) * 0.12;
          const l = tmp.length();
          if (l < rad && l > 1e-5) p.addScaledVector(tmp, (rad - l) / l);
        }
      }
    }
    // passo final "duro": nenhum segmento fica mais comprido que o normal
    // (sem isso, vento forte + framerate alto esticava a fita num fio comprido)
    for (let i = 1; i < this.n; i++) {
      const a = this.p[i - 1], b = this.p[i];
      tmp.copy(b).sub(a);
      const d = tmp.length();
      if (!(d <= this.seg * 1.02)) {
        if (!Number.isFinite(d) || d < 1e-6) tmp.copy(up).negate(); else tmp.divideScalar(d);
        b.copy(a).addScaledVector(tmp, this.seg);
        this.o[i].copy(b);
      }
    }
    // monta a fita: largura no eixo "right" torcido pela ondulacao
    const wdt = 0.07;
    for (let i = 0; i < this.n; i++) {
      const taper = 1 - (i / this.n) * 0.35;
      const tw = Math.sin(performance.now() * 0.004 + i * 0.6) * 0.5;
      const ax = right.clone().applyAxisAngle(up, tw).multiplyScalar(wdt * taper);
      const p = this.p[i];
      this.pos.set([p.x - ax.x, p.y - ax.y, p.z - ax.z, p.x + ax.x, p.y + ax.y, p.z + ax.z], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  reset() { this.init = false; }
}
