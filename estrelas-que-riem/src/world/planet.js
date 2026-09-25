import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise } from '../core/noise.js';
import { M, ink, paint } from '../render/paint.js';
import { surfaceQuat } from '../core/math.js';

/**
 * Um planetinha: esfera com relevo, cor pintada por vertice, lista de
 * colisores e de coisas com que da pra interagir.
 *
 * `shape(dir)` pode ser trocado por nivel pra criar montanhas, lagos etc.
 */
export class Planet {
  static detailScale = 1;
  constructor(o) {
    this.radius = o.radius;
    this.center = (o.center || new THREE.Vector3()).clone();
    this.gravity = o.gravity ?? 12;
    this.bump = o.bump ?? 0.04;
    this.nz = makeNoise(o.seed || 1);
    this.extra = o.shape || null;          // (dir, base) => delta de altura
    this.colorFn = o.color || null;        // (dir, h, nz) => THREE.Color
    this.palette = o.palette || { a: '#c9a36b', b: '#8fa060', c: '#e3c79a' };
    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    this.colliders = [];
    this.interactables = [];
    this.water = o.water ?? null;          // nivel da agua (raio) ou null

    this.mesh = this.build(Math.max(16, Math.round((o.detail ?? 48) * Planet.detailScale)));
    this.group.add(this.mesh);
  }

  heightAt(dir) {
    const s = 1.3;
    let h = this.nz.fbm(dir.x * s + 3, dir.y * s, dir.z * s, 4) * this.bump * this.radius;
    if (this.extra) h += this.extra(dir, this);
    return this.radius + h;
  }

  build(detail) {
    let geo = new THREE.IcosahedronGeometry(1, detail);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const d = new THREE.Vector3();
    const A = new THREE.Color(this.palette.a), B = new THREE.Color(this.palette.b), C = new THREE.Color(this.palette.c);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      const h = this.heightAt(d);
      pos.setXYZ(i, d.x * h, d.y * h, d.z * h);
      if (this.colorFn) this.colorFn(d, h, this, c);
      else {
        const n = this.nz.fbm(d.x * 2.5, d.y * 2.5 + 7, d.z * 2.5, 3);
        const m = this.nz.fbm(d.x * 7 + 1, d.y * 7, d.z * 7, 2);
        c.copy(A).lerp(B, THREE.MathUtils.smoothstep(n, -0.05, 0.2)).lerp(C, THREE.MathUtils.smoothstep(m, 0.15, 0.45) * 0.6);
      }
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, paint('#ffffff', { vertexColors: true, grainScale: 2.2, rim: 0.2 }));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    ink(mesh, 1.3);
    return mesh;
  }

  /** ponto na superficie (mundo) */
  surface(dir, lift = 0, out = new THREE.Vector3()) {
    const d = dir.clone().normalize();
    return out.copy(d).multiplyScalar(this.heightAt(d) + lift).add(this.center);
  }

  /** Planta um objeto de pe na superficie, na direcao dada. */
  place(obj, dir, { lift = 0, yaw = 0, sink = 0.04 } = {}) {
    const d = dir.clone().normalize();
    obj.position.copy(d).multiplyScalar(this.heightAt(d) + lift - sink);
    obj.quaternion.copy(surfaceQuat(d, yaw));
    this.group.add(obj);
    obj.userData.dir = d;
    return obj;
  }

  collider(dir, r, lift = 0) {
    const c = { pos: this.surface(dir, lift), r, on: true };
    this.colliders.push(c);
    return c;
  }

  /** Algo com que o jogador interage (E). */
  interact(o) {
    const it = { r: 1.4, on: true, label: 'olhar', hold: 0, ...o };
    if (!it.pos && it.obj) it.pos = new THREE.Vector3();
    this.interactables.push(it);
    return it;
  }

  up(p, out = new THREE.Vector3()) { return out.copy(p).sub(this.center).normalize(); }

  dispose() {
    this.group.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  }
}

/** Espalha n direcoes aleatorias evitando outras direcoes ocupadas. */
export function scatter(rnd, n, avoid = [], minAng = 0.25, filter = null) {
  const out = [];
  let tries = 0;
  while (out.length < n && tries++ < n * 200) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    const d = new THREE.Vector3(q * Math.cos(t), u, q * Math.sin(t));
    if (filter && !filter(d)) continue;
    if ([...avoid, ...out].some((a) => a.angleTo(d) < minAng)) continue;
    out.push(d);
  }
  return out;
}

export { M };
