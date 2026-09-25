import * as THREE from 'three';
import { bird } from './actors/props.js';
import { M, paint, ink, glow } from './render/paint.js';
import { LEVELS } from './levels/index.js';
import { clamp, damp } from './core/math.js';

/**
 * Viagem entre planetas pendurado num bando de passaros selvagens.
 * Sem como perder: voce guia o bando, recolhe poeira de estrela e passa
 * por dentro de aureolas de luz. O planeta seguinte cresce no horizonte.
 */
export class Travel {
  constructor(game) {
    this.game = game;
    const g = this.group = new THREE.Group();

    this.birds = [];
    for (let i = 0; i < 13; i++) {
      const b = bird(i % 4 === 0 ? '#e9dfcc' : '#f7f2e8');
      const a = (i / 13) * Math.PI * 2;
      const r = 0.5 + (i % 3) * 0.38;
      b.off = new THREE.Vector3(Math.cos(a) * r * 1.3, 1.9 + (i % 3) * 0.25 + Math.sin(i) * 0.1, Math.sin(a) * r - 0.2);
      b.g.scale.setScalar(1.6);
      g.add(b.g);
      this.birds.push(b);
    }
    const lp = new Float32Array(13 * 2 * 3);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.strings = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#f3e9cf', transparent: true, opacity: 0.75 }));
    this.strings.frustumCulled = false;
    g.add(this.strings);

    // poeira de estrela
    this.motes = [];
    const mg = new THREE.OctahedronGeometry(0.12, 0);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(mg, glow('#ffe08a', 2.6));
      g.add(m); this.motes.push(m);
    }
    // aureolas
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 8, 40), glow('#ffd98a', 1.8));
      const inner = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.15, 8, 40), new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.12, depthWrite: false }));
      r.add(inner);
      g.add(r); this.rings.push(r);
    }
    // planetas de passagem (decoracao)
    this.decor = [];
    const cols = [['#c98f7a', '#e8c9a0'], ['#7aa3c9', '#d7e6f0'], ['#a8c97a', '#f0e6b0'], ['#c97ab4', '#f0d0e6'], ['#e0b060', '#fff0c0'], ['#8a84c9', '#e0dcff']];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      const s = M(new THREE.IcosahedronGeometry(1, 4), cols[i][0], { inkW: 1.4, grainScale: 1.5 });
      p.add(s);
      if (i % 2 === 0) {
        const ring = M(new THREE.TorusGeometry(1.7, 0.12, 4, 48).scale(1, 1, 0.12).rotateX(Math.PI / 2 + 0.4), cols[i][1], { inkW: 0.6, cast: false });
        p.add(ring);
      }
      if (i === 3) {
        // um asteroide tomado por baobas, como aviso
        for (let k = 0; k < 3; k++) {
          const t = M(new THREE.CylinderGeometry(0.12, 0.2, 1.2, 6).translate(0, 0.9, 0), '#8a6a50', { inkW: 0.8 });
          t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(k * 2.1), 0.8, Math.cos(k * 2.1)).normalize());
          p.add(t);
        }
      }
      g.add(p); this.decor.push(p);
    }
    // cometa
    this.comet = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), glow('#e8f4ff', 3));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 7, 12, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 3.5),
      new THREE.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    this.comet.add(head, tail);
    g.add(this.comet);

    this.dest = new THREE.Group();
    g.add(this.dest);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
  }

  begin(to) {
    const G = this.game;
    this.to = to;
    this.t = 0;
    this.dur = G.params.get('fast') ? 3 : 30;
    this.pos.set(0, 0, 0);
    this.off = new THREE.Vector2();
    this.vel.set(0, 0);
    this.got = 0;
    this.skip = 0;
    this.nextRing = 3.5;
    G.scene.add(this.group);
    G.sky.uniforms.uAtmo.value = 0;
    G.sky.setPalette({ nightTop: '#0b1233', nightHor: '#1f2a66', neb: '#7a4fa0', neb2: '#2c7f95' });
    G.sunDir.set(0.7, 0.35, 0.25).normalize();
    G.audio.setMood({ root: 64, scale: 'lydian', tempo: 84, density: 0.6, pad: 0.8, wind: 0.6 });
    G.player.model.pose = 'idle';
    G.player.model.scarf.reset();

    for (const m of this.motes) this.placeMote(m, true);
    this.rings.forEach((r) => (r.visible = false));
    this.decor.forEach((d, i) => this.placeDecor(d, i, true));
    this.comet.position.set(40, 18, -140);

    // planeta de destino
    this.dest.clear();
    const L = LEVELS[to];
    const s = M(new THREE.IcosahedronGeometry(1, 5), L.color || '#c9a36b', { inkW: 1.6, grainScale: 1.2 });
    this.dest.add(s);
    this.dest.position.set(0, -2, -400);
    this.dest.scale.setScalar(L.previewR || 6);
    G.ui.toast(`próxima parada: <b>${L.name}</b>`, 3500);
    G.ui.skipHint(true);
    setTimeout(() => G.ui.skipHint(false), 5000);
  }

  placeMote(m, init) {
    m.position.set(this.pos.x + (Math.random() - 0.5) * 12, this.pos.y + (Math.random() - 0.5) * 7, this.pos.z - (init ? 8 + Math.random() * 80 : 70 + Math.random() * 20));
    m.visible = true;
    m.userData.got = 0;
  }

  placeDecor(d, i, init) {
    const side = i % 2 ? 1 : -1;
    const s = 3 + (i * 37 % 5);
    d.scale.setScalar(s);
    d.position.set(side * (18 + (i * 13 % 20)), (i * 7 % 11) - 4, this.pos.z - (init ? 30 + i * 45 : 240 + Math.random() * 60));
    d.rotation.set(i, i * 2, 0);
  }

  update(dt, input) {
    const G = this.game, P = G.player;
    this.t += dt;
    const k = clamp(this.t / this.dur, 0, 1);
    const speed = 9 * (1 - Math.pow(k, 6) * 0.7);
    this.pos.z -= speed * dt;

    // guiar o bando
    const mv = input.move;
    this.vel.x = damp(this.vel.x, mv.x * 6, 3, dt);
    this.vel.y = damp(this.vel.y, mv.y * 4.5, 3, dt);
    this.off.x = clamp(this.off.x + this.vel.x * dt, -6, 6);
    this.off.y = clamp(this.off.y + this.vel.y * dt, -3.5, 3.5);
    const bob = Math.sin(this.t * 1.7) * 0.25;
    const pos = new THREE.Vector3(this.off.x, this.off.y + bob, this.pos.z);

    // principe pendurado
    const up = new THREE.Vector3(0, 1, 0);
    const m = P.model;
    m.group.position.copy(pos);
    const bank = -this.vel.x * 0.07;
    m.group.quaternion.setFromEuler(new THREE.Euler(-0.15 + this.vel.y * 0.03, Math.PI, bank));
    const wind = new THREE.Vector3(-this.vel.x * 0.4, -this.vel.y * 0.3, speed * 0.9);
    m.animate(dt, 0, false, G.t, up, wind, new THREE.Vector3(1, 0, 0));

    // passaros e fios
    const hand = pos.clone().add(new THREE.Vector3(0, 1.28, 0));
    const lp = this.strings.geometry.attributes.position.array;
    this.birds.forEach((b, i) => {
      const o = b.off;
      const tp = pos.clone().add(o).add(new THREE.Vector3(Math.sin(G.t * 1.3 + i) * 0.08, Math.sin(G.t * 2 + i * 1.7) * 0.1, 0));
      b.g.position.lerp(tp, 1 - Math.exp(-8 * dt));
      b.g.rotation.set(-0.1, Math.PI, bank * 1.3);
      b.update(dt, G.t, 1.2);
      lp.set([hand.x + (i % 3 - 1) * 0.03, hand.y, hand.z, b.g.position.x, b.g.position.y - 0.05, b.g.position.z], i * 6);
    });
    this.strings.geometry.attributes.position.needsUpdate = true;

    // poeira
    for (const mo of this.motes) {
      mo.rotation.y += dt * 3; mo.rotation.x += dt * 2;
      if (mo.userData.got) {
        mo.userData.got += dt;
        mo.position.lerp(hand, 1 - Math.exp(-10 * dt));
        mo.scale.setScalar(Math.max(0.01, 1 - mo.userData.got * 2.5));
        if (mo.userData.got > 0.4) this.placeMote(mo);
        continue;
      }
      mo.scale.setScalar(1 + Math.sin(G.t * 6 + mo.id) * 0.2);
      const d = mo.position.distanceTo(pos.clone().add(new THREE.Vector3(0, 0.9, 0)));
      if (d < 1.5 && k < 0.92) {
        mo.userData.got = 0.001;
        this.got++;
        G.save.stars = (G.save.stars || 0) + 1;
        G.audio.chime(this.got % 8, 0.05);
      }
      if (mo.position.z > this.pos.z + 8) this.placeMote(mo);
    }
    // aureolas
    this.nextRing -= dt;
    if (this.nextRing < 0 && k < 0.8) {
      const r = this.rings.find((x) => !x.visible);
      if (r) {
        r.visible = true;
        r.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, this.pos.z - 70);
        r.userData.passed = false;
      }
      this.nextRing = 4 + Math.random() * 2;
    }
    for (const r of this.rings) {
      if (!r.visible) continue;
      r.rotation.z += dt * 0.5;
      if (!r.userData.passed && r.position.z > pos.z) {
        r.userData.passed = true;
        const d = Math.hypot(r.position.x - pos.x, r.position.y - (pos.y + 1));
        if (d < 1.8) { G.audio.success(); G.ui.toast('✦', 900); r.userData.flash = 1; }
      }
      if (r.userData.flash) { r.userData.flash = Math.max(0, r.userData.flash - dt * 2); r.scale.setScalar(1 + (1 - r.userData.flash) * 0.6); }
      else r.scale.setScalar(1);
      if (r.position.z > this.pos.z + 10) r.visible = false;
    }
    this.decor.forEach((d, i) => {
      d.rotation.y += dt * 0.1;
      if (d.position.z > this.pos.z + 30) this.placeDecor(d, i, false);
    });
    this.comet.position.x -= dt * 6; this.comet.position.z += dt * 2;
    this.comet.lookAt(this.comet.position.clone().add(new THREE.Vector3(1, 0, -0.3)));

    // destino se aproxima
    const L = LEVELS[this.to];
    const R = L.previewR || 6;
    const dz = 30 + (1 - k) * 360;
    this.dest.position.set(0, -R * 0.7, this.pos.z - dz - R);
    this.dest.rotation.y += dt * 0.15;

    // luz / sombra
    G.sun.position.copy(pos).addScaledVector(G.sunDir, 25);
    G.sun.target.position.copy(pos);
    G.sky.uniforms.uUp.value.set(0, 1, 0);
    G.sky.uniforms.uSun.value.copy(G.sunDir);

    // camera
    const cp = pos.clone().add(new THREE.Vector3(-this.off.x * 0.25, 1.4, 5.8));
    G.camera.position.lerp(cp, 1 - Math.exp(-4 * dt));
    G.camera.up.set(0, 1, 0);
    G.camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.9, -5)));

    G.ui.prompt(null);
    if (G.guide) G.guide.visible = false;

    // pular a viagem
    if (input.down('skip') || input.down('act')) this.skip += dt; else this.skip = Math.max(0, this.skip - dt);
    if ((k >= 1 || this.skip > 0.9) && !this.ending) this.finish();
  }

  async finish() {
    const G = this.game;
    this.ending = true;
    G.audio.whoosh();
    await G.fadeTo(1, 1.2);
    G.scene.remove(this.group);
    this.ending = false;
    await G.loadLevel(this.to, { fromTravel: true });
  }
}
