/**
 * Poeira e papel solto perto do chao. Cada particula e um SEGMENTO: parado
 * vira quase um ponto, na velocidade vira streak. E o truque mais barato de
 * sensacao de velocidade que existe, e funciona porque a referencia esta perto.
 */
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { createRng } from '../core/rng.js';
import { clamp01 } from '../core/mathx.js';

export function createDust(scene, settings) {
  const count = Math.max(60, Math.round(WORLD.dust.count * settings.particleScale));
  const rng = createRng('dust');

  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const drift = new Float32Array(count * 3);

  const positions = new Float32Array(count * 2 * 3);
  const colors = new Float32Array(count * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.name = 'dust';
  scene.add(lines);

  const A = WORLD.dust.area;
  function seed(i, center) {
    px[i] = center.x + (rng.next() - 0.5) * 2 * A;
    py[i] = Math.max(0.1, rng.next() * WORLD.dust.height);
    pz[i] = center.z + (rng.next() - 0.5) * 2 * A;
    drift[i * 3] = (rng.next() - 0.5) * 0.6;
    drift[i * 3 + 1] = rng.next() * 0.25;
    drift[i * 3 + 2] = (rng.next() - 0.5) * 0.6;
  }

  let seeded = false;
  const _v = new THREE.Vector3();

  /**
   * @param center posicao do drone
   * @param vel    velocidade do drone (define o streak)
   * @param wind   vetor de vento (empurra a poeira)
   */
  function update(dt, center, vel, wind) {
    if (!seeded) { for (let i = 0; i < count; i++) seed(i, center); seeded = true; }

    const speed = vel.length();
    // O streak e desenhado na direcao OPOSTA ao movimento do drone: e o que a
    // camera ve passando. Cresce a partir de streakSpeed.
    const streak = clamp01((speed - 2) / WORLD.dust.streakSpeed) * WORLD.dust.streakLength;
    _v.copy(vel).multiplyScalar(-streak * 0.06);

    const wx = wind ? wind.x : 0, wy = wind ? wind.y : 0, wz = wind ? wind.z : 0;

    for (let i = 0; i < count; i++) {
      px[i] += (drift[i * 3] + wx * 0.35) * dt;
      py[i] += (drift[i * 3 + 1] + wy * 0.25) * dt;
      pz[i] += (drift[i * 3 + 2] + wz * 0.35) * dt;

      // Reciclagem: sai da caixa ao redor do drone, volta do outro lado.
      if (py[i] > WORLD.dust.height) py[i] = 0.05;
      const dx = px[i] - center.x, dz = pz[i] - center.z;
      if (dx * dx + dz * dz > A * A) seed(i, center);

      const o = i * 6;
      positions[o] = px[i];
      positions[o + 1] = py[i];
      positions[o + 2] = pz[i];
      positions[o + 3] = px[i] + _v.x;
      positions[o + 4] = py[i] + _v.y;
      positions[o + 5] = pz[i] + _v.z;

      // Perto do chao é poeira (quente), mais alto é papel/fiapo (frio).
      const t = clamp01(py[i] / WORLD.dust.height);
      const r = 0.72 - t * 0.22, g = 0.68 - t * 0.12, b = 0.58 + t * 0.3;
      colors[o] = r; colors[o + 1] = g; colors[o + 2] = b;
      // ponta do streak apaga
      colors[o + 3] = r * 0.25; colors[o + 4] = g * 0.25; colors[o + 5] = b * 0.25;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    mat.opacity = 0.28 + clamp01(speed / 30) * 0.45;
  }

  return {
    lines, update,
    setVisible(v) { lines.visible = v; },
    dispose() { scene.remove(lines); geo.dispose(); mat.dispose(); },
  };
}
