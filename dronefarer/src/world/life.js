/**
 * Vida urbana barata: transito nas ruas e pombos que levantam voo.
 * Custa pouco e vende muito — uma cidade sem nada se movendo parece maquete.
 */
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { createRng } from '../core/rng.js';
import { clamp01 } from '../core/mathx.js';
import { groundHeightAt } from './districts.js';

const S = WORLD.chunkSize;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

export function createLife(scene, settings, envMap) {
  const rng = createRng('life');
  const detail = settings.instancedDetail;
  const CARS = Math.round(46 * detail);
  const BIRDS = Math.round(50 * detail);

  // ------------------------------------------------------------ transito
  // Cada carro anda numa "spline" trivial: uma faixa reta da malha de ruas,
  // reciclada quando sai do alcance. Basta pra ler movimento a 60 m de altura.
  const carGeo = new THREE.BoxGeometry(1.8, 1.4, 4.3);
  const carMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0.6, roughness: 0.4, envMap, envMapIntensity: 1.0,
    vertexColors: true,
  });
  // cor por instancia
  const cars = new THREE.InstancedMesh(carGeo, carMat, CARS);
  cars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CARS * 3), 3);
  cars.castShadow = true;
  cars.frustumCulled = false;
  scene.add(cars);

  const carState = [];
  const PALETTE = [
    [0.62, 0.65, 0.68], [0.16, 0.18, 0.21], [0.62, 0.19, 0.19],
    [0.18, 0.30, 0.48], [0.82, 0.79, 0.72], [0.24, 0.40, 0.30],
  ];

  function seedCar(i, center) {
    const alongZ = rng.bool();
    // trava numa das ruas da malha (bordas de chunk)
    const lane = (Math.round((alongZ ? center.x : center.z) / S) + rng.int(-2, 2)) * S;
    const dir = rng.bool() ? 1 : -1;
    const along = (alongZ ? center.z : center.x) + rng.float(-260, 260);
    const off = dir * 3.6;
    const c = rng.pick(PALETTE);
    carState[i] = {
      alongZ, lane: lane + off, along, dir,
      speed: rng.float(7, 15),
    };
    cars.instanceColor.setXYZ(i, c[0], c[1], c[2]);
  }

  // ------------------------------------------------------------- pombos
  // Billboard duplo cruzado: le como passaro de qualquer angulo por 2 quads.
  const birdGeo = new THREE.PlaneGeometry(0.42, 0.16);
  const birdMat = new THREE.MeshBasicMaterial({
    color: 0x9aa0a8, side: THREE.DoubleSide, transparent: true, opacity: 0.95,
  });
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, BIRDS);
  birds.frustumCulled = false;
  scene.add(birds);

  const birdState = [];
  function seedBird(i, center) {
    birdState[i] = {
      x: center.x + rng.float(-90, 90),
      y: groundHeightAt(center.x, center.z) + rng.float(0.2, 1.2),
      z: center.z + rng.float(-90, 90),
      vx: 0, vy: 0, vz: 0,
      flying: false, flap: rng.float(0, 6.28), timer: rng.float(0, 4),
    };
  }

  let seeded = false;

  function update(dt, t, dronePos) {
    if (!seeded) {
      for (let i = 0; i < CARS; i++) seedCar(i, dronePos);
      for (let i = 0; i < BIRDS; i++) seedBird(i, dronePos);
      seeded = true;
    }

    // --- carros ---
    for (let i = 0; i < CARS; i++) {
      const c = carState[i];
      c.along += c.speed * c.dir * dt;
      const x = c.alongZ ? c.lane : c.along;
      const z = c.alongZ ? c.along : c.lane;
      if (Math.abs(x - dronePos.x) > 300 || Math.abs(z - dronePos.z) > 300) {
        seedCar(i, dronePos);
        continue;
      }
      _p.set(x, groundHeightAt(x, z) + 0.7, z);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0),
        c.alongZ ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2));
      _m.compose(_p, _q, _one);
      cars.setMatrixAt(i, _m);
    }
    cars.instanceMatrix.needsUpdate = true;
    cars.instanceColor.needsUpdate = true;

    // --- pombos ---
    for (let i = 0; i < BIRDS; i++) {
      const b = birdState[i];
      const dx = b.x - dronePos.x, dy = b.y - dronePos.y, dz = b.z - dronePos.z;
      const d2 = dx * dx + dy * dy + dz * dz;

      // O drone passou perto: levanta voo fugindo na direcao oposta.
      if (!b.flying && d2 < 100) {
        b.flying = true;
        b.timer = 3.5;
        const d = Math.max(1, Math.sqrt(d2));
        b.vx = (dx / d) * 7; b.vy = 5.5; b.vz = (dz / d) * 7;
      }

      if (b.flying) {
        b.vy -= 5.0 * dt;
        b.vy = Math.max(b.vy, -1.2);
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        b.vx *= 0.995; b.vz *= 0.995;
        b.timer -= dt;
        const ground = groundHeightAt(b.x, b.z);
        if (b.timer <= 0 && b.y <= ground + 0.4) {
          b.y = ground + 0.3; b.flying = false; b.vx = b.vy = b.vz = 0;
        }
        b.flap += dt * 22;
      }

      if (Math.abs(dx) > 140 || Math.abs(dz) > 140) { seedBird(i, dronePos); continue; }

      _p.set(b.x, b.y, b.z);
      // bater de asa = oscilar a escala vertical
      const flap = b.flying ? 0.5 + Math.abs(Math.sin(b.flap)) * 0.9 : 0.35;
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(b.flap) * 0.5);
      _m.compose(_p, _q, _p.set(1, flap, 1));
      birds.setMatrixAt(i, _m);
    }
    birds.instanceMatrix.needsUpdate = true;
    void clamp01; void t;
  }

  return {
    cars, birds, update,
    setVisible(v) { cars.visible = v; birds.visible = v; },
    /** Faroletes acesos a noite (Fase 6). */
    setNight(on) {
      carMat.emissive = new THREE.Color(on ? 0x221a10 : 0x000000);
    },
    setEnvMap(env) { carMat.envMap = env; carMat.needsUpdate = true; },
    dispose() {
      scene.remove(cars); scene.remove(birds);
      carGeo.dispose(); carMat.dispose(); birdGeo.dispose(); birdMat.dispose();
    },
  };
}
