import * as THREE from 'three';
import { M, paint, ink, glow } from '../render/paint.js';

const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => V(x, y)), seg);

// ============================================================ vulcao
export function volcano(active = true, size = 1) {
  const g = new THREE.Group();
  const rock = active ? '#8a6a5a' : '#7c7a80';
  const cone = M(lathe([[0.0, 0], [0.75, 0], [0.62, 0.12], [0.42, 0.42], [0.26, 0.62], [0.2, 0.64], [0.14, 0.52], [0.0, 0.5]], 22), rock, { inkW: 1.1 });
  g.add(cone);
  // listras de lava seca
  const band = M(new THREE.TorusGeometry(0.5, 0.03, 6, 22).rotateX(Math.PI / 2), active ? '#6e4a3e' : '#65636a', { inkW: 0.5 });
  band.position.y = 0.24; band.scale.set(1, 1, 1); g.add(band);
  let lava = null;
  if (active) {
    lava = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16).rotateX(-Math.PI / 2), glow('#ff8a3c', 2.2));
    lava.position.y = 0.56; g.add(lava);
  }
  g.scale.setScalar(size);
  // fumaca: bolinhas que sobem
  const smoke = [];
  const smokeMat = paint('#e9e2dc', { transparent: true, opacity: 0.8, rim: 0.2, soft: 0.3 });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), smokeMat);
    s.userData.ph = i / 7;
    g.add(s); smoke.push(s);
  }
  const st = { g, dirt: 1, active, lava };
  st.update = (dt, t) => {
    const amt = active ? 0.35 + st.dirt * 0.65 : st.dirt * 0.5;
    smoke.forEach((s) => {
      const p = (t * 0.25 + s.userData.ph) % 1;
      s.visible = amt > 0.05;
      s.position.set(Math.sin(p * 6 + s.userData.ph * 9) * 0.1 * p, 0.62 + p * 1.1, Math.cos(p * 5) * 0.08 * p);
      s.scale.setScalar((0.4 + p * 1.4) * amt * (1 - p * 0.6));
    });
    if (lava) lava.material.color.setRGB(1.0 * 2.2, (0.45 + Math.sin(t * 3) * 0.08) * 2.2, 0.2 * 2.2).multiplyScalar(0.55 + st.dirt * 0.45);
  };
  return st;
}

// ============================================================ broto de baoba
export function sprout(big = 0) {
  const g = new THREE.Group();
  const mound = M(new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), '#8b6a48', { inkW: 0.6 });
  g.add(mound);
  const plant = new THREE.Group(); g.add(plant);
  const stem = M(new THREE.CylinderGeometry(0.018 + big * 0.02, 0.03 + big * 0.03, 0.26 + big * 0.2, 6).translate(0, 0.13 + big * 0.1, 0), '#6f8f3a', { inkW: 0.6 });
  plant.add(stem);
  const leafG = new THREE.SphereGeometry(0.08, 10, 6).scale(1.5, 0.25, 0.75).translate(0.1, 0, 0);
  for (let i = 0; i < 3 + big * 2; i++) {
    const l = M(leafG, i % 2 ? '#86b04a' : '#75a043', { inkW: 0.6 });
    l.position.y = 0.2 + big * 0.18 + (i % 3) * 0.03;
    l.rotation.set(0.35, i * 2.3, 0.4);
    plant.add(l);
  }
  const st = { g, plant, pulled: false, t: 0 };
  st.update = (dt, time) => {
    if (!st.pulled) { plant.rotation.z = Math.sin(time * 2 + g.id) * 0.08; return; }
    st.t += dt;
    plant.position.y = st.t * 3;
    plant.rotation.y += dt * 14;
    plant.scale.setScalar(Math.max(0, 1 - st.t * 1.5));
    if (st.t > 0.7) plant.visible = false;
  };
  return st;
}

// ============================================================ baoba adulto (decoracao)
export function baobab(s = 1) {
  const g = new THREE.Group();
  const trunk = M(lathe([[0, 0], [0.55, 0], [0.42, 0.25], [0.36, 0.8], [0.44, 1.3], [0.2, 1.45], [0, 1.45]], 16), '#a0826a', { inkW: 1.1 });
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const br = M(new THREE.CylinderGeometry(0.05, 0.1, 0.8, 6).translate(0, 0.4, 0), '#98785f', { inkW: 0.8 });
    br.position.set(Math.cos(a) * 0.25, 1.35, Math.sin(a) * 0.25);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(br);
    const crown = M(new THREE.IcosahedronGeometry(0.34, 1), i % 2 ? '#6d8e45' : '#7c9d4d', { inkW: 1 });
    crown.position.set(Math.cos(a) * 0.75, 1.85, Math.sin(a) * 0.75);
    g.add(crown);
  }
  g.scale.setScalar(s);
  return g;
}

// ============================================================ a rosa
export function rose(scale = 1, color = '#d23c4a') {
  const g = new THREE.Group();
  const stem = M(new THREE.CylinderGeometry(0.018, 0.025, 0.55, 6).translate(0, 0.275, 0), '#4f7b3a', { inkW: 0.7 });
  g.add(stem);
  // espinhos (os quatro!)
  for (let i = 0; i < 4; i++) {
    const th = M(new THREE.ConeGeometry(0.02, 0.07, 5).translate(0, 0.035, 0), '#6d4a33', { inkW: 0.4 });
    th.position.set(0, 0.12 + i * 0.08, 0);
    th.rotation.set(0, i * 1.7, 1.2);
    th.position.x = Math.cos(i * 1.7) * 0.02; th.position.z = -Math.sin(i * 1.7) * 0.02;
    g.add(th);
  }
  const leafG = new THREE.SphereGeometry(0.07, 10, 6).scale(1.8, 0.2, 0.8).translate(0.12, 0, 0);
  for (let i = 0; i < 2; i++) {
    const l = M(leafG, '#5f9243', { inkW: 0.6 });
    l.position.y = 0.2 + i * 0.12; l.rotation.set(0.3, i * Math.PI + 0.4, 0.35);
    g.add(l);
  }
  const bloom = new THREE.Group(); bloom.position.y = 0.58; g.add(bloom);
  const cup = M(new THREE.SphereGeometry(0.05, 10, 6).scale(1, 0.8, 1), '#4f7b3a', { inkW: 0.5 });
  cup.position.y = -0.03; bloom.add(cup);
  // miolo fechado em espiral + petalas em concha abrindo pra fora
  const col = new THREE.Color(color);
  const hex = (c) => '#' + c.getHexString();
  const bud = M(new THREE.SphereGeometry(0.05, 12, 10).scale(1, 1.25, 1).translate(0, 0.045, 0), hex(col.clone().offsetHSL(0, 0, -0.08)), { inkW: 0.5, rim: 0.5 });
  bloom.add(bud);
  const swirl = M(new THREE.TorusGeometry(0.025, 0.008, 5, 14, Math.PI * 1.6).rotateX(Math.PI / 2), hex(col.clone().offsetHSL(0, 0, -0.15)), { ink: false });
  swirl.position.y = 0.105; bloom.add(swirl);
  const shell = new THREE.SphereGeometry(0.085, 12, 8, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.18, Math.PI * 0.42);
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.5;
      const p = M(shell, hex(col.clone().offsetHSL(0, 0, ring * 0.05)), { inkW: 0.5, rim: 0.6, side: THREE.DoubleSide });
      const holder = new THREE.Group();
      holder.rotation.y = a;
      p.position.set(0, ring ? 0.0 : 0.02, -0.012 - ring * 0.018);
      p.rotation.x = ring ? -0.55 : -0.2;
      p.scale.setScalar(1 + ring * 0.25);
      holder.add(p);
      bloom.add(holder);
    }
  }
  g.scale.setScalar(scale);
  const st = { g, bloom };
  st.update = (dt, t) => {
    bloom.rotation.z = Math.sin(t * 1.3) * 0.06;
    bloom.rotation.x = Math.cos(t * 1.1) * 0.05;
  };
  return st;
}

// ============================================================ redoma de vidro
export function glassGlobe() {
  const g = new THREE.Group();
  const mat = paint('#d9ecff', { transparent: true, opacity: 0.26, rim: 2.2, soft: 0.3, grain: 0.3 });
  mat.depthWrite = false;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.55, 1), mat);
  dome.renderOrder = 2;
  g.add(dome);
  const knob = M(new THREE.SphereGeometry(0.04, 10, 8), '#d9ecff', { inkW: 0.5 });
  knob.position.y = 0.52; g.add(knob);
  const rim = M(new THREE.TorusGeometry(0.32, 0.015, 6, 28).rotateX(Math.PI / 2), '#b7cde0', { inkW: 0.4 });
  g.add(rim);
  // brilho do vidro
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.22), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
  hl.position.set(-0.17, 0.3, 0.2); hl.rotation.set(0, -0.6, 0.2);
  g.add(hl);
  return g;
}

// ============================================================ cadeirinha
export function chair() {
  const g = new THREE.Group();
  const wood = '#b07a4a';
  const seat = M(new THREE.BoxGeometry(0.34, 0.04, 0.32), wood, { inkW: 0.6 });
  seat.position.y = 0.3; g.add(seat);
  for (const [x, z] of [[-0.14, -0.13], [0.14, -0.13], [-0.14, 0.13], [0.14, 0.13]]) {
    const l = M(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), wood, { inkW: 0.5 });
    l.position.set(x, 0.15, z); g.add(l);
  }
  for (const x of [-0.14, 0.14]) {
    const b = M(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), wood, { inkW: 0.5 });
    b.position.set(x, 0.48, -0.14); g.add(b);
  }
  const back = M(new THREE.BoxGeometry(0.32, 0.12, 0.03), '#c48d58', { inkW: 0.5 });
  back.position.set(0, 0.58, -0.14); g.add(back);
  return g;
}

// ============================================================ rastelo / vassoura
export function rake() {
  const g = new THREE.Group();
  const h = M(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6).translate(0, 0.45, 0), '#b07a4a', { inkW: 0.5 });
  g.add(h);
  const head = M(new THREE.BoxGeometry(0.25, 0.04, 0.04), '#8a8a90', { inkW: 0.5 });
  head.position.y = 0.02; g.add(head);
  g.rotation.z = 0.3;
  return g;
}

// ============================================================ passaros migratorios
export function bird(color = '#f6f1e6') {
  const g = new THREE.Group();
  const body = M(new THREE.SphereGeometry(0.1, 10, 8).scale(0.8, 0.7, 1.6), color, { inkW: 0.6, rim: 0.6, emissive: '#2a2622' });
  g.add(body);
  const head = M(new THREE.SphereGeometry(0.06, 8, 6), color, { inkW: 0.5 });
  head.position.set(0, 0.04, 0.16); g.add(head);
  const beak = M(new THREE.ConeGeometry(0.018, 0.06, 5).rotateX(Math.PI / 2), '#e0a040', { inkW: 0.3 });
  beak.position.set(0, 0.035, 0.23); g.add(beak);
  // asa: gota achatada, com contorno (le bem de qualquer angulo)
  const wingG = new THREE.SphereGeometry(0.1, 10, 6).scale(1.7, 0.22, 0.9).translate(0.16, 0, -0.02);
  const L = new THREE.Group(), R = new THREE.Group();
  const wl = M(wingG, color, { inkW: 0.7, rim: 0.8, emissive: '#4a463e' });
  const wr = M(wingG, color, { inkW: 0.7, rim: 0.8, emissive: '#4a463e' });
  L.add(wl); R.add(wr); R.scale.x = -1;
  L.position.set(0.05, 0.03, 0); R.position.set(-0.05, 0.03, 0);
  g.add(L, R);
  const tail = M(new THREE.ConeGeometry(0.06, 0.16, 5).rotateX(-Math.PI / 2).scale(1.4, 0.3, 1).translate(0, 0.01, -0.2), color, { inkW: 0.5 });
  g.add(tail);
  const st = { g, ph: Math.random() * 6 };
  st.update = (dt, t, speed = 1) => {
    const f = Math.sin(t * 10 * speed + st.ph);
    L.rotation.z = f * 0.9; R.rotation.z = -f * 0.9;
    body.position.y = -f * 0.02;
  };
  return st;
}

// ============================================================ lampiao
export function lampPost() {
  const g = new THREE.Group();
  const iron = '#3d4150';
  g.add(M(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 10), iron, { inkW: 0.7 }));
  const pole = M(new THREE.CylinderGeometry(0.035, 0.05, 1.8, 8).translate(0, 0.95, 0), iron, { inkW: 0.8 });
  g.add(pole);
  // lanterna: base, quatro hastes e vidro (a chama aparece)
  const cbase = M(new THREE.CylinderGeometry(0.1, 0.07, 0.05, 6), iron, { inkW: 0.5 });
  cbase.position.y = 1.86; g.add(cbase);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bar = M(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 4), iron, { inkW: 0.3 });
    bar.position.set(Math.cos(a) * 0.12, 1.99, Math.sin(a) * 0.12); bar.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    g.add(bar);
  }
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 0.24, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = 1.99; g.add(glass);
  const hat = M(new THREE.ConeGeometry(0.2, 0.16, 6).translate(0, 0.08, 0), iron, { inkW: 0.7 });
  hat.position.y = 2.1; g.add(hat);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8).scale(0.8, 1.2, 0.8), glow('#ffcf6b', 3));
  flame.position.y = 1.96; g.add(flame);
  const light = new THREE.PointLight('#ffc070', 0, 9, 1.6);
  light.position.y = 1.96; g.add(light);
  const st = { g, on: false, k: 0, flame, light };
  st.update = (dt, t) => {
    st.k += ((st.on ? 1 : 0) - st.k) * (1 - Math.exp(-6 * dt));
    flame.visible = st.k > 0.02;
    flame.scale.setScalar(st.k * (1 + Math.sin(t * 13) * 0.08));
    light.intensity = st.k * 6;
  };
  return st;
}

// ============================================================ garrafas
export function bottle(color = '#3f7a5a', full = true) {
  const g = new THREE.Group();
  const b = M(lathe([[0, 0], [0.08, 0], [0.085, 0.2], [0.03, 0.28], [0.025, 0.36], [0, 0.36]], 12), color, { inkW: 0.6, rim: 0.9, transparent: !full, opacity: full ? 1 : 0.55 });
  g.add(b);
  const label = M(new THREE.CylinderGeometry(0.087, 0.087, 0.07, 12, 1, true), '#efe0bd', { inkW: 0.3 });
  label.position.y = 0.1; g.add(label);
  return g;
}

// ============================================================ mesa
export function desk(w = 1.1, d = 0.6, color = '#8d5f3c') {
  const g = new THREE.Group();
  const top = M(new THREE.BoxGeometry(w, 0.06, d), color, { inkW: 0.8 });
  top.position.y = 0.62; g.add(top);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = M(new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6), color, { inkW: 0.5 });
    l.position.set(x * (w / 2 - 0.06), 0.3, z * (d / 2 - 0.06)); g.add(l);
  }
  return g;
}

export function paperStack(n = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const p = M(new THREE.BoxGeometry(0.22, 0.012, 0.3), i % 2 ? '#f5efdf' : '#ebe2ca', { inkW: 0.3 });
    p.position.y = i * 0.014; p.rotation.y = (Math.random() - 0.5) * 0.4;
    g.add(p);
  }
  return g;
}

export function book(color = '#7b3b36', s = 1) {
  const g = new THREE.Group();
  const c = M(new THREE.BoxGeometry(0.5, 0.1, 0.36), color, { inkW: 0.7 });
  g.add(c);
  const pages = M(new THREE.BoxGeometry(0.48, 0.08, 0.33), '#f3ead3', { inkW: 0.3 });
  pages.position.set(0.012, 0, 0); g.add(pages);
  g.scale.setScalar(s);
  return g;
}

// ============================================================ estrela caida (coletavel)
export function fallenStar() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.07 : 0.17;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  geo.center();
  const s = new THREE.Mesh(geo, glow('#ffd76a', 2.4));
  s.position.y = 0.35; g.add(s);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.15, depthWrite: false }));
  halo.position.y = 0.35; g.add(halo);
  const st = { g, star: s, got: false, t: 0 };
  st.update = (dt, t) => {
    s.rotation.y = t * 1.6 + g.id;
    s.position.y = 0.35 + Math.sin(t * 2 + g.id) * 0.06;
    halo.scale.setScalar(1 + Math.sin(t * 5 + g.id) * 0.15);
    if (st.got) { st.t += dt; g.scale.setScalar(Math.max(0, 1 - st.t * 2.5)); s.position.y += st.t * 3; }
  };
  return st;
}

// ============================================================ poco
export function well() {
  const g = new THREE.Group();
  const wall = M(new THREE.CylinderGeometry(0.55, 0.6, 0.6, 16, 1, true).translate(0, 0.3, 0), '#b9a58a', { inkW: 1, side: THREE.DoubleSide });
  g.add(wall);
  const lip = M(new THREE.TorusGeometry(0.56, 0.06, 6, 20).rotateX(Math.PI / 2), '#a8947a', { inkW: 0.7 });
  lip.position.y = 0.6; g.add(lip);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18).rotateX(-Math.PI / 2), glow('#5d8fc0', 0.8));
  water.position.y = 0.2; g.add(water);
  for (const x of [-0.5, 0.5]) {
    const p = M(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6).translate(0, 0.55, 0), '#8a6a4a', { inkW: 0.6 });
    p.position.set(x, 0.5, 0); g.add(p);
  }
  const bar = M(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6).rotateZ(Math.PI / 2), '#8a6a4a', { inkW: 0.5 });
  bar.position.y = 1.55; g.add(bar);
  const wheel = M(new THREE.TorusGeometry(0.1, 0.025, 6, 14), '#6e6a70', { inkW: 0.4 });
  wheel.position.y = 1.55; wheel.rotation.y = Math.PI / 2; g.add(wheel);
  const rope = M(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4).translate(0, -0.4, 0), '#c9b28a', { ink: false });
  rope.position.y = 1.5; g.add(rope);
  const bucket = M(lathe([[0, 0], [0.09, 0], [0.11, 0.16], [0, 0.16]], 10), '#7a5a3a', { inkW: 0.5 });
  bucket.position.y = 0.6; g.add(bucket);
  return { g, wheel, bucket, rope };
}

// ============================================================ aviao
export function plane() {
  const g = new THREE.Group();
  const body = '#b8483c', wing = '#e8d9b8';
  const fus = M(lathe([[0, -1.1], [0.1, -1.1], [0.22, -0.4], [0.28, 0.3], [0.25, 0.6], [0, 0.66]], 12).rotateX(Math.PI / 2), body, { inkW: 1 });
  fus.position.y = 0.45; g.add(fus);
  for (const y of [0.3, 0.85]) {
    const w = M(new THREE.BoxGeometry(2.6, 0.05, 0.42), wing, { inkW: 0.8 });
    w.position.set(0, y, 0.2); g.add(w);
  }
  for (const x of [-1, -0.5, 0.5, 1]) {
    const s = M(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), '#7a5a3a', { inkW: 0.4 });
    s.position.set(x, 0.58, 0.2); g.add(s);
  }
  const tail = M(new THREE.BoxGeometry(0.8, 0.04, 0.28), wing, { inkW: 0.6 });
  tail.position.set(0, 0.5, -1.0); g.add(tail);
  const fin = M(new THREE.BoxGeometry(0.04, 0.35, 0.3), body, { inkW: 0.6 });
  fin.position.set(0, 0.68, -1.0); g.add(fin);
  const prop = new THREE.Group(); prop.position.set(0, 0.45, 1.12); g.add(prop);
  for (let i = 0; i < 2; i++) {
    const b = M(new THREE.BoxGeometry(0.06, 0.7, 0.03), '#6d4a33', { inkW: 0.5 });
    b.rotation.z = i * Math.PI / 2 + 0.3; prop.add(b);
  }
  for (const x of [-0.35, 0.35]) {
    const wh = M(new THREE.TorusGeometry(0.12, 0.05, 6, 12), '#3d3a40', { inkW: 0.5 });
    wh.position.set(x, 0.12, 0.45); wh.rotation.y = Math.PI / 2; g.add(wh);
  }
  // inclinado, meio enterrado na areia
  g.rotation.set(0.12, 0, 0.18);
  return g;
}

// ============================================================ flor de tres petalas (deserto)
export function desertFlower() {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(0.012, 0.018, 0.35, 5).translate(0, 0.175, 0), '#7c8a4a', { inkW: 0.5 }));
  const pg = new THREE.SphereGeometry(0.06, 10, 6).scale(0.6, 0.2, 1.4).translate(0, 0, 0.07);
  for (let i = 0; i < 3; i++) {
    const p = M(pg, '#e6d7a8', { inkW: 0.5, rim: 0.5 });
    p.position.y = 0.36; p.rotation.set(-0.35, i * 2.094, 0); p.rotation.order = 'YXZ';
    g.add(p);
  }
  const c = M(new THREE.SphereGeometry(0.03, 8, 6), '#d9a441', { inkW: 0.4 });
  c.position.y = 0.37; g.add(c);
  return g;
}

// ============================================================ caixa com carneiro dentro
export function sheepBox() {
  const g = new THREE.Group();
  const box = M(new THREE.BoxGeometry(0.4, 0.26, 0.28), '#c9a476', { inkW: 1 });
  box.position.y = 0.13; g.add(box);
  for (let i = 0; i < 3; i++) {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: '#2d2330' }));
    h.position.set(-0.1 + i * 0.1, 0.16, 0.141); g.add(h);
  }
  return g;
}

// ============================================================ nuvem de aquarela (espaco/ceu)
export function cloud(color = '#f4e9f0', s = 1) {
  const g = new THREE.Group();
  const mat = paint(color, { rim: 0.2, soft: 0.35, grain: 1.4 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.4, 2), mat);
    b.position.set((i - 2.5) * 0.5, Math.sin(i * 1.7) * 0.2, Math.cos(i * 2.3) * 0.25);
    g.add(b);
  }
  g.scale.setScalar(s);
  return g;
}

export { ink };
