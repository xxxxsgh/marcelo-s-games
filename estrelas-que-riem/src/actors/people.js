import * as THREE from 'three';
import { M, paint, ink } from '../render/paint.js';

const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => V(x, y)), seg);

/**
 * Adultos dos planetas: um "boneco de livro" parametrizado. Cada um ganha
 * roupa, chapeu e um detalhe proprio. Todos tem cabeca que balanca quando falam.
 */
export class Person {
  constructor(o = {}) {
    const g = this.group = new THREE.Group();
    const s = o.scale ?? 1;
    const coat = o.coat || '#5a6b9a';
    const skin = o.skin || '#f2d2b8';
    this.body = new THREE.Group(); g.add(this.body);
    // corpo: roupa em sino
    const h = o.height ?? 1.25;
    const w = o.width ?? 0.3;
    const prof = o.robe
      ? [[0, 0], [w * 2.2, 0], [w * 1.6, h * 0.25], [w * 1.0, h * 0.6], [w * 0.75, h * 0.8], [w * 0.5, h * 0.86], [0, h * 0.86]]
      : [[0, h * 0.28], [w * 1.05, h * 0.28], [w * 1.1, h * 0.5], [w * 1.0, h * 0.7], [w * 0.7, h * 0.84], [0, h * 0.86]];
    const torso = M(lathe(prof, 22), coat, { inkW: 1.1 });
    this.body.add(torso);
    if (!o.robe) {
      for (const x of [-0.1, 0.1]) {
        const leg = M(new THREE.CylinderGeometry(0.06, 0.055, h * 0.3, 8).translate(0, h * 0.15, 0), o.pants || '#3f3a44', { inkW: 0.7 });
        leg.position.x = x * (w / 0.3); this.body.add(leg);
        const shoe = M(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.6, 1.5), '#2f2a2c', { inkW: 0.5 });
        shoe.position.set(x * (w / 0.3), 0.03, 0.04); this.body.add(shoe);
      }
    }
    // bracos
    this.arms = [];
    for (const sd of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(sd * w * 0.95, h * 0.8, 0);
      const arm = M(new THREE.CapsuleGeometry(0.05, h * 0.28, 4, 8).translate(0, -h * 0.16, 0), coat, { inkW: 0.7 });
      arm.rotation.z = sd * 0.15;
      a.add(arm);
      const hand = M(new THREE.SphereGeometry(0.05, 8, 6), skin, { inkW: 0.5 });
      hand.position.set(sd * 0.05, -h * 0.34, 0.02);
      a.add(hand);
      this.body.add(a);
      this.arms.push(a);
    }
    // cabeca
    this.head = new THREE.Group();
    this.head.position.y = h * 0.86 + 0.2;
    this.body.add(this.head);
    const hr = o.headR ?? 0.2;
    this.head.add(M(new THREE.SphereGeometry(hr, 18, 14), skin, { inkW: 1 }));
    const nose = M(new THREE.SphereGeometry(hr * 0.22, 8, 6).scale(1, 1, o.bigNose ? 1.8 : 1.2), o.nose || skin, { inkW: 0.5 });
    nose.position.set(0, -0.01, hr * 0.98); this.head.add(nose);
    for (const sd of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), new THREE.MeshBasicMaterial({ color: '#2d2330' }));
      e.position.set(sd * hr * 0.35, hr * 0.18, hr * 0.9); this.head.add(e);
    }
    if (o.beard) {
      const b = M(new THREE.ConeGeometry(hr * 0.8, hr * (o.beardLen || 1.6), 10).rotateX(Math.PI).translate(0, -hr * 0.6, hr * 0.35), o.beard, { inkW: 0.8 });
      this.head.add(b);
    }
    if (o.mustache) {
      for (const sd of [-1, 1]) {
        const m = M(new THREE.CapsuleGeometry(0.02, 0.1, 3, 6).rotateZ(Math.PI / 2 + sd * 0.4), o.mustache, { inkW: 0.4 });
        m.position.set(sd * 0.06, -hr * 0.28, hr * 0.92); this.head.add(m);
      }
    }
    if (o.hair) {
      const hh = M(new THREE.SphereGeometry(hr * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), o.hair, { inkW: 0.7 });
      hh.rotation.x = -0.35; this.head.add(hh);
    }
    if (o.glasses) {
      for (const sd of [-1, 1]) {
        const gl = M(new THREE.TorusGeometry(0.045, 0.01, 5, 12), '#2d2330', { ink: false });
        gl.position.set(sd * hr * 0.38, hr * 0.18, hr * 0.95); this.head.add(gl);
      }
    }
    this.hat = new THREE.Group();
    this.hat.position.y = hr * 0.75;
    this.head.add(this.hat);
    this.talking = false;
    this.t = Math.random() * 10;
    this.h = h;
    g.scale.setScalar(s);
  }

  update(dt, t) {
    this.t += dt;
    const talk = this.talking ? Math.sin(this.t * 14) * 0.05 + Math.sin(this.t * 5) * 0.04 : 0;
    this.head.rotation.x = talk + Math.sin(this.t * 0.9) * 0.03;
    this.head.rotation.z = Math.sin(this.t * 0.6) * 0.04;
    this.body.position.y = Math.sin(this.t * 1.8) * 0.008;
    if (this.onUpdate) this.onUpdate(dt, t);
  }
}

// -------------------------------------------------------------------- o Rei
export function king() {
  const p = new Person({ coat: '#7a3f86', robe: true, width: 0.34, height: 1.3, beard: '#f4f1ea', beardLen: 2.2, skin: '#f0cdb0', scale: 1 });
  // arminho: bolinhas pretas no manto e gola branca
  const collar = M(new THREE.TorusGeometry(0.28, 0.09, 8, 20).rotateX(Math.PI / 2), '#f6f3ea', { inkW: 0.8 });
  collar.position.y = 1.1; p.body.add(collar);
  const trim = M(new THREE.TorusGeometry(0.72, 0.07, 6, 28).rotateX(Math.PI / 2), '#f6f3ea', { inkW: 0.8 });
  trim.position.y = 0.05; p.body.add(trim);
  const dot = new THREE.SphereGeometry(0.025, 6, 4);
  const dm = new THREE.MeshBasicMaterial({ color: '#1e1a22' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const d = new THREE.Mesh(dot, dm);
    d.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); p.body.add(d);
  }
  // coroa
  const crown = M(new THREE.CylinderGeometry(0.16, 0.15, 0.12, 10, 1, true).translate(0, 0.06, 0), '#e7b93f', { inkW: 0.7, side: THREE.DoubleSide, emissive: '#3a2600' });
  p.hat.add(crown);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = M(new THREE.ConeGeometry(0.035, 0.1, 5).translate(0, 0.05, 0), '#e7b93f', { inkW: 0.4, emissive: '#3a2600' });
    sp.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15); p.hat.add(sp);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: i % 2 ? '#c93f4a' : '#4f7dc9' }));
    gem.position.set(Math.cos(a) * 0.155, 0.05, Math.sin(a) * 0.155); p.hat.add(gem);
  }
  // cetro
  const sc = M(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6).translate(0, 0.2, 0), '#e7b93f', { inkW: 0.5 });
  p.arms[1].add(sc); sc.position.set(0.05, -0.4, 0.05);
  const orb = M(new THREE.SphereGeometry(0.05, 8, 6), '#e7b93f', { inkW: 0.5, emissive: '#3a2600' });
  orb.position.set(0.05, 0.18, 0.05); p.arms[1].add(orb);
  p.arms[1].rotation.x = -0.4;
  return p;
}

// ------------------------------------------------------------ o Vaidoso
export function vain() {
  const p = new Person({ coat: '#3f8f8a', pants: '#e2c26a', width: 0.26, height: 1.2, mustache: '#5a3a2a', skin: '#f3d1b5' });
  const brim = M(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), '#2e2a3a', { inkW: 0.8 });
  const top = M(new THREE.CylinderGeometry(0.17, 0.19, 0.5, 16).translate(0, 0.26, 0), '#2e2a3a', { inkW: 0.9 });
  const band = M(new THREE.CylinderGeometry(0.192, 0.192, 0.07, 16), '#d44d5c', { inkW: 0.4 });
  band.position.y = 0.06;
  const feather = M(new THREE.SphereGeometry(0.06, 8, 6).scale(0.5, 3, 0.3).translate(0, 0.16, 0), '#f3c34a', { inkW: 0.5 });
  feather.position.set(0.15, 0.1, 0); feather.rotation.z = -0.4;
  p.hatTop = new THREE.Group();
  p.hatTop.add(brim, top, band, feather);
  p.hat.add(p.hatTop);
  // gravata borboleta
  const bow = M(new THREE.SphereGeometry(0.05, 6, 4).scale(1.8, 0.8, 0.5), '#d44d5c', { inkW: 0.4 });
  bow.position.set(0, 1.03, 0.2); p.body.add(bow);
  p.tip = 0;
  p.onUpdate = (dt) => {
    p.tip = Math.max(0, p.tip - dt * 2.2);
    const k = Math.sin(Math.min(p.tip, 1) * Math.PI);
    p.hatTop.position.y = k * 0.28;
    p.hatTop.rotation.x = -k * 0.5;
    p.arms[1].rotation.x = -k * 2.4;
    p.body.rotation.x = k * 0.25;
  };
  return p;
}

// ------------------------------------------------------------ o Bebado
export function tippler() {
  const p = new Person({ coat: '#6a5a7a', width: 0.3, height: 1.05, nose: '#e0766e', bigNose: true, skin: '#e9c6ae', hair: '#7a6a60' });
  p.body.rotation.x = 0.15;
  p.head.rotation.x = 0.3;
  const cap = M(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.6, 1.2), '#4a4450', { inkW: 0.7 });
  p.hat.add(cap);
  return p;
}

// ------------------------------------------------------------ o Homem de negocios
export function businessman() {
  const p = new Person({ coat: '#3e4652', pants: '#2e333c', width: 0.3, height: 1.2, glasses: true, skin: '#efcfb4', hair: '#6d5a4a' });
  const tie = M(new THREE.ConeGeometry(0.035, 0.25, 4).rotateX(Math.PI).translate(0, 0.9, 0.23), '#b8483c', { inkW: 0.4 });
  p.body.add(tie);
  p.arms.forEach((a) => (a.rotation.x = -1.1));
  const pencil = M(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 5), '#e7b93f', { inkW: 0.3 });
  pencil.position.set(0.05, -0.36, 0.05); pencil.rotation.x = 1.2; p.arms[1].add(pencil);
  p.onUpdate = (dt, t) => {
    if (p.busy) p.arms[1].rotation.x = -1.1 + Math.sin(t * 16) * 0.12;
  };
  p.busy = true;
  return p;
}

// ------------------------------------------------------------ o Acendedor de lampioes
export function lamplighter() {
  const p = new Person({ coat: '#34507a', pants: '#2b3444', width: 0.26, height: 1.15, mustache: '#3a2a22', skin: '#efcfb4' });
  const cap = M(new THREE.CylinderGeometry(0.2, 0.19, 0.12, 14).translate(0, 0.02, 0), '#26344f', { inkW: 0.7 });
  const visor = M(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 12, 1, false, -Math.PI / 2, Math.PI).translate(0, -0.03, 0.12), '#1c2233', { inkW: 0.4 });
  p.hat.add(cap, visor);
  const badge = M(new THREE.SphereGeometry(0.03, 6, 4), '#e7b93f', { ink: false, emissive: '#4a3200' });
  badge.position.set(0.1, 0.95, 0.22); p.body.add(badge);
  // vara de acender
  const pole = M(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 5).translate(0, 0.6, 0), '#6d4a33', { inkW: 0.4 });
  pole.position.set(0.04, -0.38, 0.04); pole.rotation.x = 0.25;
  p.arms[1].add(pole);
  p.arms[1].rotation.x = -0.35;
  p.poleTip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffb050', toneMapped: false }));
  p.poleTip.position.y = 1.4; pole.add(p.poleTip);
  return p;
}

// ------------------------------------------------------------ o Geografo
export function geographer() {
  const p = new Person({ coat: '#7a6a4a', robe: true, width: 0.3, height: 1.2, beard: '#e8e2d6', glasses: true, skin: '#f0d0b4', beardLen: 1.4 });
  const cap = M(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), '#5a3a52', { inkW: 0.6 });
  p.hat.add(cap);
  const tassel = M(new THREE.SphereGeometry(0.03, 6, 4), '#e7b93f', { ink: false });
  tassel.position.y = 0.1; p.hat.add(tassel);
  return p;
}

// ------------------------------------------------------------ o Aviador
export function aviator() {
  const p = new Person({ coat: '#8a6446', pants: '#5a5048', width: 0.28, height: 1.45, skin: '#ecc8a8', hair: '#4a3a30' });
  const cap = M(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), '#6a4a34', { inkW: 0.7 });
  cap.rotation.x = -0.2; p.hat.add(cap); p.hat.position.y = 0;
  for (const sd of [-1, 1]) {
    const gg = M(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10).rotateX(Math.PI / 2), '#9ec3d6', { inkW: 0.5, rim: 1 });
    gg.position.set(sd * 0.07, 0.17, 0.15); p.hat.add(gg);
  }
  const scarf = M(new THREE.TorusGeometry(0.12, 0.05, 6, 14).rotateX(Math.PI / 2), '#f2efe6', { inkW: 0.6 });
  scarf.position.y = 1.25; p.body.add(scarf);
  return p;
}

// ============================================================ a raposa
export function fox() {
  const g = new THREE.Group();
  const O = '#e0823a', W = '#f6ecd8', D = '#3b2a2c';
  const body = new THREE.Group(); g.add(body);
  const torso = M(new THREE.SphereGeometry(0.2, 14, 10).scale(0.85, 0.8, 1.45), O, { inkW: 1 });
  torso.position.y = 0.34; body.add(torso);
  const chest = M(new THREE.SphereGeometry(0.13, 10, 8).scale(0.9, 1, 0.7), W, { inkW: 0.5 });
  chest.position.set(0, 0.34, 0.22); body.add(chest);
  const legs = [];
  for (const [x, z] of [[-0.09, 0.17], [0.09, 0.17], [-0.09, -0.17], [0.09, -0.17]]) {
    const L = new THREE.Group(); L.position.set(x, 0.3, z);
    const l = M(new THREE.CylinderGeometry(0.03, 0.025, 0.28, 6).translate(0, -0.14, 0), O, { inkW: 0.5 });
    const paw = M(new THREE.SphereGeometry(0.035, 6, 4), D, { inkW: 0.3 });
    paw.position.y = -0.28;
    L.add(l, paw); body.add(L); legs.push(L);
  }
  const head = new THREE.Group(); head.position.set(0, 0.55, 0.28); body.add(head);
  head.add(M(new THREE.SphereGeometry(0.13, 14, 10).scale(1.05, 0.95, 1), O, { inkW: 0.9 }));
  const snout = M(new THREE.ConeGeometry(0.075, 0.2, 10).rotateX(Math.PI / 2), W, { inkW: 0.6 });
  snout.position.set(0, -0.03, 0.14); head.add(snout);
  const nose = M(new THREE.SphereGeometry(0.022, 6, 4), D, { ink: false });
  nose.position.set(0, -0.03, 0.245); head.add(nose);
  const ears = [];
  for (const sd of [-1, 1]) {
    const e = M(new THREE.ConeGeometry(0.06, 0.2, 4).translate(0, 0.1, 0), O, { inkW: 0.6 });
    e.position.set(sd * 0.07, 0.09, -0.02); e.rotation.z = -sd * 0.25; head.add(e); ears.push(e);
    const inner = M(new THREE.ConeGeometry(0.032, 0.12, 4).translate(0, 0.08, 0.015), D, { ink: false });
    e.add(inner);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: D }));
    eye.position.set(sd * 0.055, 0.03, 0.11); head.add(eye);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.38, -0.27); body.add(tail);
  const tg = new THREE.SphereGeometry(0.1, 10, 8).scale(0.9, 0.9, 2.6).translate(0, 0, -0.22);
  tail.add(M(tg, O, { inkW: 0.8 }));
  const tip = M(new THREE.SphereGeometry(0.075, 8, 6).scale(1, 1, 1.4), W, { inkW: 0.5 });
  tip.position.z = -0.46; tail.add(tip);
  tail.rotation.x = 0.5;

  const st = { g, head, tail, legs, body, mode: 'sit', walk: 0 };
  st.update = (dt, t, speed = 0) => {
    st.walk += dt * speed * 9;
    const sit = st.mode === 'sit';
    const k = 1 - Math.exp(-8 * dt);
    legs.forEach((L, i) => {
      const back = i >= 2;
      const target = sit ? (back ? -1.2 : 0.15) : Math.sin(st.walk + (i % 2 ? Math.PI : 0) + (back ? Math.PI / 2 : 0)) * 0.6 * Math.min(speed, 1);
      L.rotation.x += (target - L.rotation.x) * k;
    });
    const by = sit ? -0.08 : 0;
    const bx = sit ? -0.35 : 0;
    body.position.y += (by - body.position.y) * k;
    body.rotation.x += (bx - body.rotation.x) * k;
    head.rotation.x += ((sit ? 0.35 : 0) - head.rotation.x) * k;
    tail.rotation.y = Math.sin(t * (st.happy ? 9 : 2)) * (st.happy ? 0.6 : 0.25);
    ears.forEach((e, i) => (e.rotation.x = Math.sin(t * 1.3 + i) * 0.08));
  };
  return st;
}

// ============================================================ a serpente
export function snake() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const a = u * Math.PI * 4.2;
    const r = 0.28 - u * 0.2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.05 + u * 0.28, Math.sin(a) * r));
  }
  pts.push(new THREE.Vector3(0.02, 0.45, 0.06));
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 120, 0.04, 8, false);
  const body = M(geo, '#e7c24a', { inkW: 0.8, rim: 0.7 });
  g.add(body);
  const head = new THREE.Group(); head.position.set(0.02, 0.47, 0.08); g.add(head);
  head.add(M(new THREE.SphereGeometry(0.055, 10, 8).scale(1, 0.75, 1.3), '#e7c24a', { inkW: 0.6 }));
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#2d2330' }));
    e.position.set(sd * 0.035, 0.02, 0.04); head.add(e);
  }
  const st = { g, head };
  st.update = (dt, t) => {
    head.rotation.y = Math.sin(t * 0.8) * 0.4;
    head.position.y = 0.47 + Math.sin(t * 1.3) * 0.02;
  };
  return st;
}
