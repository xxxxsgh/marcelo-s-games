/**
 * Colisao do mundo: conjunto de AABBs num hash espacial.
 * Barato o suficiente pra cidade inteira e preciso o suficiente pra um drone
 * de 26 cm — predio, poste, muro e caçamba sao caixas de verdade.
 *
 * Fornece:
 *   - resolveSphere: empurra o drone pra fora e devolve normal + impacto
 *   - raycast: usado pela camera pra nao atravessar parede
 */
import * as THREE from 'three';

const CELL = 16; // m por celula do hash

export function createColliders() {
  const boxes = [];              // {minX,minY,minZ,maxX,maxY,maxZ,tag,id}
  const grid = new Map();        // "cx,cz" -> [index]
  let nextId = 1;

  const key = (cx, cz) => `${cx},${cz}`;

  function indexBox(i) {
    const b = boxes[i];
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let arr = grid.get(k);
        if (!arr) { arr = []; grid.set(k, arr); }
        arr.push(i);
      }
    }
  }

  /** Adiciona uma caixa por centro + tamanho. */
  function addBox(center, size, tag = 'solid') {
    const hx = size.x * 0.5, hy = size.y * 0.5, hz = size.z * 0.5;
    const b = {
      minX: center.x - hx, minY: center.y - hy, minZ: center.z - hz,
      maxX: center.x + hx, maxY: center.y + hy, maxZ: center.z + hz,
      tag, id: nextId++,
    };
    boxes.push(b);
    indexBox(boxes.length - 1);
    return b;
  }

  /** Adiciona a partir de um Object3D ja posicionado (usa o bounding box). */
  function addFromObject(obj, tag = 'solid') {
    obj.updateWorldMatrix(true, false);
    const box3 = new THREE.Box3().setFromObject(obj);
    if (!Number.isFinite(box3.min.x)) return null;
    const c = box3.getCenter(new THREE.Vector3());
    const sz = box3.getSize(new THREE.Vector3());
    return addBox(c, sz, tag);
  }

  function candidates(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    const seen = new Set();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = grid.get(key(cx, cz));
        if (!arr) continue;
        for (const i of arr) if (!seen.has(i)) { seen.add(i); out.push(i); }
      }
    }
    return out;
  }

  const _cand = [];
  const _normal = new THREE.Vector3();
  const result = { hit: false, normal: _normal, depth: 0, tag: '', id: 0 };

  /**
   * Empurra uma esfera pra fora de tudo que ela estiver penetrando.
   * Muta `pos`. Devolve o contato mais profundo do passo.
   */
  function resolveSphere(pos, radius) {
    result.hit = false; result.depth = 0; result.tag = ''; result.id = 0;
    candidates(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, _cand);

    for (let n = 0; n < 3; n++) {           // algumas iteracoes pra cantos
      let moved = false;
      for (const i of _cand) {
        const b = boxes[i];
        // ponto mais proximo da caixa
        const cx = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x;
        const cy = pos.y < b.minY ? b.minY : pos.y > b.maxY ? b.maxY : pos.y;
        const cz = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z;
        let dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
        let d2 = dx * dx + dy * dy + dz * dz;

        if (d2 > radius * radius) continue;

        let nx, ny, nz, depth;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; ny = dy / d; nz = dz / d;
          depth = radius - d;
        } else {
          // Centro dentro da caixa: sai pela face mais proxima.
          const ox = Math.min(pos.x - b.minX, b.maxX - pos.x);
          const oy = Math.min(pos.y - b.minY, b.maxY - pos.y);
          const oz = Math.min(pos.z - b.minZ, b.maxZ - pos.z);
          if (ox <= oy && ox <= oz) {
            nx = pos.x - b.minX < b.maxX - pos.x ? -1 : 1; ny = 0; nz = 0; depth = ox + radius;
          } else if (oy <= oz) {
            nx = 0; ny = pos.y - b.minY < b.maxY - pos.y ? -1 : 1; nz = 0; depth = oy + radius;
          } else {
            nx = 0; ny = 0; nz = pos.z - b.minZ < b.maxZ - pos.z ? -1 : 1; depth = oz + radius;
          }
        }
        pos.x += nx * depth; pos.y += ny * depth; pos.z += nz * depth;
        moved = true;
        if (depth > result.depth) {
          result.hit = true; result.depth = depth;
          _normal.set(nx, ny, nz); result.tag = b.tag; result.id = b.id;
        }
      }
      if (!moved) break;
    }
    return result;
  }

  const _rayHit = { hit: false, distance: Infinity, point: new THREE.Vector3() };

  /** Raycast slab contra os AABBs. Usado pela colisao de camera. */
  function raycast(origin, dir, maxDist) {
    _rayHit.hit = false; _rayHit.distance = maxDist;
    const ex = Math.abs(dir.x * maxDist), ey = Math.abs(dir.y * maxDist), ez = Math.abs(dir.z * maxDist);
    candidates(
      Math.min(origin.x, origin.x + dir.x * maxDist) - 1,
      Math.min(origin.z, origin.z + dir.z * maxDist) - 1,
      Math.max(origin.x, origin.x + dir.x * maxDist) + 1,
      Math.max(origin.z, origin.z + dir.z * maxDist) + 1,
      _cand,
    );
    void ex; void ey; void ez;

    const inv = { x: 1 / (dir.x || 1e-9), y: 1 / (dir.y || 1e-9), z: 1 / (dir.z || 1e-9) };
    for (const i of _cand) {
      const b = boxes[i];
      let t0 = (b.minX - origin.x) * inv.x, t1 = (b.maxX - origin.x) * inv.x;
      let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
      t0 = (b.minY - origin.y) * inv.y; t1 = (b.maxY - origin.y) * inv.y;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
      t0 = (b.minZ - origin.z) * inv.z; t1 = (b.maxZ - origin.z) * inv.z;
      tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));

      if (tmax < Math.max(tmin, 0) || tmin > _rayHit.distance) continue;
      const t = tmin < 0 ? 0 : tmin;
      if (t < _rayHit.distance) {
        _rayHit.hit = true;
        _rayHit.distance = t;
      }
    }
    if (_rayHit.hit) {
      _rayHit.point.copy(origin).addScaledVector(dir, _rayHit.distance);
    }
    return _rayHit;
  }

  /** Distancia aproximada ate a parede mais proxima (audio e camera). */
  function nearestDistance(pos, maxRadius = 8) {
    candidates(pos.x - maxRadius, pos.z - maxRadius, pos.x + maxRadius, pos.z + maxRadius, _cand);
    let best = maxRadius;
    for (const i of _cand) {
      const b = boxes[i];
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cy = Math.max(b.minY, Math.min(pos.y, b.maxY));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const d = Math.hypot(pos.x - cx, pos.y - cy, pos.z - cz);
      if (d < best) best = d;
    }
    return best;
  }

  // --- buracos no chao ---------------------------------------------------
  // O chao e um plano infinito em y=0. Sem isto, qualquer coisa subterranea
  // (garagem, tunel, galeria) fica inalcancavel: o drone bate no plano e e
  // teleportado de volta pra rua.
  const groundHoles = [];

  function addGroundHole(minX, minZ, maxX, maxZ) {
    groundHoles.push({ minX, minZ, maxX, maxZ });
  }

  /** false quando o ponto esta sobre uma abertura (rampa, boca de tunel). */
  function hasGroundAt(x, z) {
    for (const h of groundHoles) {
      if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ) return false;
    }
    return true;
  }

  function clear() {
    boxes.length = 0; grid.clear(); nextId = 1; groundHoles.length = 0;
  }

  /** Remove tudo com uma tag (usado no unload de chunk). */
  function removeByTag(tag) {
    const kept = boxes.filter((b) => b.tag !== tag);
    if (kept.length === boxes.length) return;
    boxes.length = 0; grid.clear();
    for (const b of kept) { boxes.push(b); indexBox(boxes.length - 1); }
  }

  return {
    addBox, addFromObject, resolveSphere, raycast, nearestDistance,
    addGroundHole, hasGroundAt, groundHoles,
    clear, removeByTag,
    get count() { return boxes.length; },
    boxes,
  };
}
