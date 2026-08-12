/**
 * Objetos de rua. Sao eles que dao a sensacao de velocidade — passar entre
 * dois postes rente ao chao vale mais que qualquer efeito de tela.
 */
import * as THREE from 'three';
import { WORLD } from '../config.js';

const CAR_COLORS = [0x9aa0a6, 0x2c3138, 0xb23a3a, 0x2f4f7a, 0xd8d2c4, 0x1d1f22, 0x3f6b4f];

/** Carro parado. Simples, mas com proporcao certa e vidro reflexivo. */
export function makeCar(rng, mats) {
  const g = new THREE.Group();
  const color = rng.pick(CAR_COLORS);
  const body = new THREE.MeshStandardMaterial({
    color, metalness: 0.72, roughness: 0.34,
    envMap: mats.metal.envMap, envMapIntensity: 1.3,
  });
  const L = 4.3, W = 1.82, H = 0.72;

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), body);
  chassis.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.58, L * 0.48), mats.glass);
  cabin.position.set(0, 1.24, -0.15);
  g.add(chassis, cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, mats.rubber);
      w.position.set(sx * (W / 2 - 0.06), 0.32, sz * L * 0.33);
      g.add(w);
    }
  }
  // faroletes (pegam bloom a noite)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9c0, toneMapped: false });
  lampMat.color.multiplyScalar(2.2);
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), lampMat);
    l.position.set(sx * 0.62, 0.78, -L / 2);
    g.add(l);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Poste com braço e luminaria. */
export function makePole(mats, height = WORLD.block.poleHeight) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, height, 8), mats.paintedMetal);
  post.position.y = height / 2;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.09), mats.paintedMetal);
  arm.position.set(0.85, height - 0.3, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.26), mats.paintedMetal);
  head.position.set(1.62, height - 0.38, 0);
  // Emissores HDR (ver LED_HDR no drone): precisam passar do limiar do bloom.
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  bulbMat.color.multiplyScalar(2.8);
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.2), bulbMat);
  bulb.position.set(1.62, height - 0.47, 0);
  g.add(post, arm, head, bulb);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.bulb = bulb;
  return g;
}

/** Fio com catenaria de verdade — a barriga do fio e o que da leitura. */
export function makeWire(from, to, sag, mats) {
  const pts = [];
  const seg = 12;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = new THREE.Vector3().lerpVectors(from, to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, seg, 0.028, 5, false);
  const m = new THREE.Mesh(geo, mats.wire);
  m.castShadow = false;
  m.userData.wire = true;
  m.userData.points = pts;
  return m;
}

/** Caçamba de entulho. */
export function makeDumpster(mats) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a4a22, metalness: 0.65, roughness: 0.62,
    envMap: mats.metal.envMap, envMapIntensity: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.25, 3.6), mat);
  body.position.y = 0.65;
  g.add(body);
  for (const sz of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.14), mats.metal);
    rim.position.set(0, 1.28, sz * 1.72);
    g.add(rim);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Caixa d'agua de telhado. */
export function makeWaterTank(mats, r = 1.1, h = 1.6) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2f6ec4, metalness: 0.15, roughness: 0.65,
  });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, h, 14), mat);
  tank.position.y = h / 2 + 0.3;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.12, 10), mats.paintedMetal);
  lid.position.y = h + 0.36;
  const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.1, 0.3, r * 2.1), mats.concrete);
  base.position.y = 0.15;
  g.add(tank, lid, base);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Antena de telhado — obstaculo fino e traicoeiro. */
export function makeAntenna(mats, height = 4.2) {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, height, 6), mats.metal);
  mast.position.y = height / 2;
  g.add(mast);
  for (let i = 0; i < 4; i++) {
    const y = height * (0.42 + i * 0.14);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1 - i * 0.16, 0.03, 0.03), mats.metal);
    bar.position.y = y;
    g.add(bar);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
