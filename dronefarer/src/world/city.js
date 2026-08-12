/**
 * Cidade aberta com streaming por quarteirao (chunk).
 *
 * Cada chunk vira UMA InstancedMesh de predios (mais uma de caixa d'agua, uma
 * de poste, uma de arvore). Sem isso, uma cidade com milhares de predios seria
 * milhares de draw calls e nao existiria frame rate que salvasse.
 *
 * A geracao e FATIADA POR ORCAMENTO DE TEMPO: no maximo alguns milissegundos
 * por frame, um chunk por vez, priorizando o mais perto. E o que evita o
 * engasgo classico de "atravessou a fronteira e travou 200 ms".
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { rngAt } from '../core/rng.js';
import { districtAt, groundHeightAt } from './districts.js';
import { createFacadeMaterial, attachFacadeAttributes } from './facadeAtlas.js';

const S = WORLD.chunkSize;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Geometria de arvore: tronco + copa, mesclados num buffer so. */
function treeGeometry() {
  // CylinderGeometry vem indexada e IcosahedronGeometry nao. mergeGeometries
  // exige que TODAS tenham indice ou nenhuma tenha — sem converter, o merge
  // falha e a arvore fica so tronco.
  const trunk = new THREE.CylinderGeometry(0.18, 0.26, 2.6, 6);
  trunk.translate(0, 1.3, 0);
  const crown = new THREE.IcosahedronGeometry(1.9, 1);
  crown.translate(0, 4.0, 0);
  crown.scale(1, 0.85, 1);
  const geo = BufferGeometryUtils.mergeGeometries(
    [trunk.toNonIndexed(), crown.toNonIndexed()], true,
  );
  if (!geo) {
    console.warn('[city] merge da arvore falhou; usando so o tronco');
    return trunk;
  }
  trunk.dispose(); crown.dispose();
  return geo;
}

export function createCity(scene, colliders, mats, settings, envMap) {
  const root = new THREE.Group();
  root.name = 'city';
  scene.add(root);

  const facadeMat = createFacadeMaterial(envMap);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const tankGeo = new THREE.CylinderGeometry(1.0, 0.95, 1.5, 10);
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 8.4, 6);
  const treeGeo = treeGeometry();
  // marcadas como compartilhadas pra nao serem liberadas no unload de chunk
  for (const g of [tankGeo, poleGeo, treeGeo]) g.userData.shared = true;

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3c2c, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x3f7a45, roughness: 0.85, envMap, envMapIntensity: 0.5,
  });
  const tankMat = new THREE.MeshStandardMaterial({
    color: 0x3f74b4, roughness: 0.66, envMap, envMapIntensity: 0.6,
  });

  // O quarteirao da Fase 1 ocupa os chunks -2..1 nos dois eixos; a cidade
  // aberta nao gera por cima dele.
  let excluded = () => false;

  const chunks = new Map();           // "cx,cz" -> {group, boxes, built}
  const queue = [];                   // chunks pendentes, mais perto primeiro
  const stats = { built: 0, loaded: 0, buildings: 0, queued: 0, lastBuildMs: 0 };

  const key = (cx, cz) => `${cx},${cz}`;

  /** Gera os dados do chunk (sem tocar na cena) — parte cara. */
  function generate(cx, cz) {
    const rng = rngAt(WORLD.seed, cx, 0, cz);
    const d = districtAt(cx, cz);
    const x0 = cx * S, z0 = cz * S;
    const half = d.streetWidth / 2;
    const in0 = half + 2, in1 = S - half - 2;

    const buildings = [];
    let z = in0;
    let guard = 0;
    while (z < in1 && guard++ < 200) {
      const depth = rng.float(d.footprint[0], d.footprint[1]);
      if (z + depth > in1) break;
      let x = in0;
      let g2 = 0;
      while (x < in1 && g2++ < 200) {
        const w = rng.float(d.footprint[0], d.footprint[1]);
        if (x + w > in1) break;
        if (rng.next() < d.density) {
          const floors = Math.round(rng.float(d.floors[0], d.floors[1]));
          const h = floors * 3.1;
          const wx = x0 + x + w / 2, wz = z0 + z + depth / 2;
          buildings.push({
            x: wx, z: wz, w, d: depth, h, floors,
            base: groundHeightAt(wx, wz),
            variant: rng.pick(d.variants),
            tank: rng.next() < d.rooftopProps,
          });
        }
        x += w + rng.float(d.gap[0], d.gap[1]);
      }
      z += depth + rng.float(d.gap[0], d.gap[1]);
    }

    // postes ao longo da rua do chunk
    const poles = [];
    for (let t = 10; t < S; t += 22) {
      if (rng.next() < 0.85) {
        poles.push({ x: x0 + half * 0.45, z: z0 + t });
        poles.push({ x: x0 + t, z: z0 + half * 0.45 });
      }
    }

    // arvores
    const trees = [];
    if (d.trees > 0) {
      const n = Math.round(d.trees * 34 * settings.instancedDetail);
      for (let i = 0; i < n; i++) {
        const tx = x0 + rng.float(2, S - 2), tz = z0 + rng.float(2, S - 2);
        // nao planta dentro de predio
        if (buildings.some((b) => Math.abs(b.x - tx) < b.w / 2 + 1
          && Math.abs(b.z - tz) < b.d / 2 + 1)) continue;
        trees.push({ x: tx, z: tz, s: rng.float(0.7, 1.5), base: groundHeightAt(tx, tz) });
      }
    }

    return { d, buildings, poles, trees };
  }

  /** Monta os objetos na cena a partir dos dados gerados. */
  function build(cx, cz) {
    const t0 = performance.now();
    const k = key(cx, cz);
    if (chunks.has(k)) return;

    const data = generate(cx, cz);
    const group = new THREE.Group();
    group.name = `chunk:${k}`;
    const tag = `chunk:${k}`;

    // --- chao do chunk ---
    const d = data.d;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), mats.asphalt);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx * S + S / 2, groundHeightAt(cx * S + S / 2, cz * S + S / 2) - 0.01,
      cz * S + S / 2);
    ground.receiveShadow = true;
    group.add(ground);

    // --- predios instanciados ---
    const n = data.buildings.length;
    if (n > 0) {
      // Geometria PROPRIA por chunk: os atributos por instancia moram nela.
      const geo = boxGeo.clone();
      const mesh = new THREE.InstancedMesh(geo, facadeMat, n);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const variants = new Float32Array(n);
      const floors = new Float32Array(n);
      const tilesX = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        const b = data.buildings[i];
        _p.set(b.x, b.base + b.h / 2, b.z);
        _s.set(b.w, b.h, b.d);
        _m.compose(_p, _q.identity(), _s);
        mesh.setMatrixAt(i, _m);
        variants[i] = b.variant;
        floors[i] = b.floors;
        tilesX[i] = Math.max(1, Math.round(b.w / 3.4));
        colliders.addBox(_p, _s, tag);
      }
      attachFacadeAttributes(mesh, variants, floors, tilesX);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = true;
      group.add(mesh);
      stats.buildings += n;

      // --- caixas d'agua no telhado ---
      const withTank = data.buildings.filter((b) => b.tank);
      if (withTank.length) {
        const tanks = new THREE.InstancedMesh(tankGeo, tankMat, withTank.length);
        tanks.castShadow = true;
        withTank.forEach((b, i) => {
          _p.set(b.x, b.base + b.h + 0.75, b.z);
          _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
          tanks.setMatrixAt(i, _m);
          colliders.addBox(_p, new THREE.Vector3(2, 1.6, 2), tag);
        });
        tanks.instanceMatrix.needsUpdate = true;
        group.add(tanks);
      }
    }

    // --- postes ---
    if (data.poles.length) {
      const poles = new THREE.InstancedMesh(poleGeo, mats.paintedMetal, data.poles.length);
      poles.castShadow = true;
      data.poles.forEach((p, i) => {
        const base = groundHeightAt(p.x, p.z);
        _p.set(p.x, base + 4.2, p.z);
        _m.compose(_p, _q.identity(), _s.set(1, 1, 1));
        poles.setMatrixAt(i, _m);
        colliders.addBox(_p, new THREE.Vector3(0.3, 8.4, 0.3), tag);
      });
      poles.instanceMatrix.needsUpdate = true;
      group.add(poles);
    }

    // --- arvores ---
    if (data.trees.length) {
      const trees = new THREE.InstancedMesh(treeGeo, [trunkMat, leafMat], data.trees.length);
      trees.castShadow = true;
      data.trees.forEach((t, i) => {
        _p.set(t.x, t.base, t.z);
        _m.compose(_p, _q.identity(), _s.set(t.s, t.s, t.s));
        trees.setMatrixAt(i, _m);
      });
      trees.instanceMatrix.needsUpdate = true;
      group.add(trees);
    }

    root.add(group);
    chunks.set(k, { group, cx, cz, district: data.d, tag, buildings: data.buildings });
    stats.built++;
    stats.loaded = chunks.size;
    stats.lastBuildMs = performance.now() - t0;
  }

  function unload(k) {
    const c = chunks.get(k);
    if (!c) return;
    root.remove(c.group);
    c.group.traverse((o) => {
      if (o.isInstancedMesh) {
        // so a geometria clonada dos predios e por chunk; as outras sao compartilhadas
        if (o.geometry && o.geometry !== boxGeo && o.geometry.userData.shared !== true) {
          o.geometry.dispose();
        }
        o.dispose();
      }
    });
    colliders.removeByTag(c.tag);
    chunks.delete(k);
    stats.loaded = chunks.size;
  }

  /**
   * Chamado todo frame. Enfileira o que falta, descarrega o que sobra e
   * constroi dentro de um orcamento de tempo.
   * @param budgetMs teto de tempo gasto construindo neste frame
   */
  function update(pos, budgetMs = 4) {
    const cx = Math.floor(pos.x / S), cz = Math.floor(pos.z / S);
    const R = WORLD.streamRadius, U = WORLD.unloadRadius;

    // enfileira faltantes
    queue.length = 0;
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const k = key(cx + dx, cz + dz);
        if (chunks.has(k) || excluded(cx + dx, cz + dz)) continue;
        queue.push({ cx: cx + dx, cz: cz + dz, d: dx * dx + dz * dz });
      }
    }
    queue.sort((a, b) => a.d - b.d);
    stats.queued = queue.length;

    // constroi dentro do orcamento — o mais perto primeiro
    const start = performance.now();
    for (const c of queue) {
      if (performance.now() - start > budgetMs) break;
      build(c.cx, c.cz);
    }

    // descarrega o que passou do raio
    for (const [k, c] of chunks) {
      if (Math.abs(c.cx - cx) > U || Math.abs(c.cz - cz) > U) unload(k);
    }
  }

  return {
    root, stats, chunks,
    update,
    setExclusion(fn) { excluded = fn; },
    get material() { return facadeMat; },
    districtAtPos(pos) {
      return districtAt(Math.floor(pos.x / S), Math.floor(pos.z / S));
    },
    /** Acende as janelas (ciclo dia/noite da Fase 6). */
    setWindowLight(v) { facadeMat.emissiveIntensity = v; },
    setEnvMap(env) {
      facadeMat.envMap = env; facadeMat.needsUpdate = true;
      for (const m of [leafMat, tankMat]) { m.envMap = env; m.needsUpdate = true; }
    },
    clear() { for (const k of [...chunks.keys()]) unload(k); },
    dispose() {
      this.clear();
      boxGeo.dispose(); tankGeo.dispose(); poleGeo.dispose(); treeGeo.dispose();
      facadeMat.dispose(); trunkMat.dispose(); leafMat.dispose(); tankMat.dispose();
      scene.remove(root);
    },
  };
}
