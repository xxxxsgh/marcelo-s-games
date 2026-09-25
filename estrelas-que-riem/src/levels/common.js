import * as THREE from 'three';
import { bird } from '../actors/props.js';
import { tangent, dirLL } from '../core/math.js';

export { dirLL };

const _m = new THREE.Matrix4();

/** Orienta obj (no espaco do planeta) de pe em `dir`, olhando pra `lookDir` (outra direcao na esfera). */
export function faceDir(obj, dir, lookDir) {
  const up = dir.clone().normalize();
  const f = lookDir.clone().normalize().sub(up.clone().multiplyScalar(lookDir.clone().normalize().dot(up)));
  if (f.lengthSq() < 1e-6) return;
  f.normalize();
  const r = up.clone().cross(f).normalize();
  _m.makeBasis(r, up, f);
  obj.quaternion.setFromRotationMatrix(_m);
}

/** Coloca um personagem, com colisor, olhando pra uma direcao. */
export function placeNPC(planet, obj, dir, lookDir, colR = 0.45) {
  planet.place(obj, dir);
  if (lookDir) faceDir(obj, dir, lookDir);
  planet.collider(dir, colR);
  return obj;
}

/** posicao no mundo de um objeto filho do planeta */
export const wpos = (o, lift = 0, planet) => {
  const p = o.getWorldPosition(new THREE.Vector3());
  if (lift && planet) p.addScaledVector(p.clone().sub(planet.center).normalize(), lift);
  return p;
};

/**
 * O bando de passaros selvagens desce ate um ponto do planeta e espera.
 * Resolve quando o jogador segura os fios.
 */
export function flock(game, planet, dir, label = 'partir com os pássaros') {
  const group = new THREE.Group();
  planet.group.add(group);
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const b = bird(i % 3 ? '#f7f2e8' : '#e9dfcc');
    b.g.scale.setScalar(1.2);
    group.add(b.g);
    birds.push(b);
  }
  const d = dir.clone().normalize();
  const base = planet.surface(d).sub(planet.center);
  const up = d.clone();
  let t0 = game.t;
  const start = base.clone().addScaledVector(up, 14).add(new THREE.Vector3(6, 0, 0));
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f3e9cf', transparent: true, opacity: 0.8 }));
  const lp = new Float32Array(birds.length * 6);
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lines.frustumCulled = false;
  group.add(lines);
  const tangentA = new THREE.Vector3(1, 0, 0); tangent(tangentA, up).normalize();
  if (tangentA.lengthSq() < 0.1) tangentA.set(0, 0, 1);
  const tangentB = up.clone().cross(tangentA);

  game.audio.whoosh();
  game.ui.toast('um bando de pássaros selvagens está migrando…', 3500);

  const it = planet.interact({
    pos: planet.surface(d, 0), r: 1.6, label, labelH: 1.6,
    use: () => { it.on = false; game.audio.success(); game.next(); },
  });
  it.on = false;

  const upd = (dt, t) => {
    const k = Math.min((t - t0) / 5, 1);
    const e = 1 - Math.pow(1 - k, 3);
    const center = start.clone().lerp(base.clone().addScaledVector(up, 2.3), e);
    birds.forEach((b, i) => {
      const a = (i / birds.length) * Math.PI * 2 + t * 0.6;
      const r = 0.55 + (i % 3) * 0.25;
      const p = center.clone().addScaledVector(tangentA, Math.cos(a) * r).addScaledVector(tangentB, Math.sin(a) * r).addScaledVector(up, Math.sin(t * 2 + i) * 0.15 + (i % 2) * 0.2);
      b.g.position.copy(p);
      b.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangentA.clone().multiplyScalar(-Math.sin(a)).addScaledVector(tangentB, Math.cos(a)).normalize());
      b.update(dt, t, 1);
      const hang = base.clone().addScaledVector(up, 0.9);
      lp.set([hang.x, hang.y, hang.z, p.x, p.y, p.z], i * 6);
    });
    lines.geometry.attributes.position.needsUpdate = true;
    lines.visible = k > 0.9;
    if (k >= 1 && !it.arrived) { it.arrived = true; it.on = true; game.audio.chime(4, 0.06); }
  };
  return { group, update: upd, it, pos: planet.surface(d, 0.5) };
}

/** Carregar um objeto nas maos. */
export function carry(game, obj) {
  const m = game.player.model;
  obj.removeFromParent();
  obj.position.set(0, 0.62, 0.32);
  obj.quaternion.identity();
  m.body.add(obj);
  m.hold = 1;
  game.carrying = obj;
}

export function drop(game, planet, dir, lift = 0) {
  const obj = game.carrying;
  if (!obj) return null;
  obj.removeFromParent();
  planet.place(obj, dir, { lift });
  game.player.model.hold = 0;
  game.carrying = null;
  return obj;
}

/** direcao (no planeta) do ponto do mundo */
export const dirOf = (planet, p) => p.clone().sub(planet.center).normalize();
