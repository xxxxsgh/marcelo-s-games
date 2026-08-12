/**
 * Fantasma: grava a melhor volta e reproduz um drone translucido correndo junto.
 *
 * O ponto do ghost nao e "ir mais rapido", e ver ONDE voce perde. Por isso ele
 * roda no tempo da corrida atual (nao em loop) e o HUD mostra o delta ao vivo.
 */
import * as THREE from 'three';
import { RACE } from '../config.js';

const _a = new THREE.Quaternion();
const _b = new THREE.Quaternion();

export function createGhostRecorder() {
  let samples = [];
  let acc = 0;
  const step = 1 / RACE.ghostSampleRate;

  return {
    reset() { samples = []; acc = 0; },
    /** Amostra em taxa fixa, independente do fps. */
    record(dt, time, pos, quat) {
      acc += dt;
      if (samples.length && acc < step) return;
      acc = 0;
      samples.push(
        +time.toFixed(3),
        +pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2),
        +quat.x.toFixed(3), +quat.y.toFixed(3), +quat.z.toFixed(3), +quat.w.toFixed(3),
      );
    },
    /** Array plano (8 numeros por amostra) — compacto no localStorage. */
    get data() { return samples.slice(); },
    get count() { return samples.length / 8; },
  };
}

export function createGhostPlayer(scene, model) {
  const mesh = model.makeGhost(RACE.ghostOpacity);
  mesh.visible = false;
  scene.add(mesh);

  let data = null;
  let count = 0;

  function setData(flat) {
    data = Array.isArray(flat) && flat.length >= 16 ? flat : null;
    count = data ? data.length / 8 : 0;
    mesh.visible = false;
  }

  /** Posiciona o fantasma no instante `t` da corrida. */
  function update(t, visible = true) {
    if (!data || !visible) { mesh.visible = false; return null; }
    // busca binaria pelo par de amostras que cerca t
    let lo = 0, hi = count - 1;
    if (t <= data[0]) { hi = 1; lo = 0; } else if (t >= data[(count - 1) * 8]) {
      lo = count - 2; hi = count - 1;
      mesh.visible = true;
    } else {
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (data[mid * 8] <= t) lo = mid; else hi = mid;
      }
    }
    if (lo < 0 || hi >= count) { mesh.visible = false; return null; }

    const i0 = lo * 8, i1 = hi * 8;
    const t0 = data[i0], t1 = data[i1];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;

    mesh.position.set(
      data[i0 + 1] + (data[i1 + 1] - data[i0 + 1]) * f,
      data[i0 + 2] + (data[i1 + 2] - data[i0 + 2]) * f,
      data[i0 + 3] + (data[i1 + 3] - data[i0 + 3]) * f,
    );
    _a.set(data[i0 + 4], data[i0 + 5], data[i0 + 6], data[i0 + 7]);
    _b.set(data[i1 + 4], data[i1 + 5], data[i1 + 6], data[i1 + 7]);
    mesh.quaternion.copy(_a).slerp(_b, f);
    mesh.visible = true;
    return mesh.position;
  }

  return {
    mesh, setData, update,
    get hasData() { return !!data; },
    get duration() { return count ? data[(count - 1) * 8] : 0; },
    hide() { mesh.visible = false; },
    dispose() { scene.remove(mesh); },
  };
}
