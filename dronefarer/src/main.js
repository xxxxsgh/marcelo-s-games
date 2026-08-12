/**
 * DRONEFARER — ponto de entrada.
 * Monta os sistemas, roda o loop e conecta os eventos. Nada de logica de jogo
 * aqui dentro: este arquivo so amarra as pecas.
 */
import * as THREE from 'three';
import { createLoop } from './core/loop.js';
import { createQuality } from './core/quality.js';
import { createBus } from './core/bus.js';
import { createInput } from './input/index.js';
import { createDrone } from './drone/index.js';
import { hoverThrottle } from './drone/physics.js';
import { createCameraRig } from './camera/index.js';
import { createEnvironment } from './render/env.js';
import { createMaterials } from './render/materials.js';
import { createPipeline } from './render/pipeline.js';
import { createColliders } from './world/collision.js';
import { createBlock } from './world/block.js';
import { createWind } from './world/wind.js';
import { createDust } from './fx/dust.js';
import { createHud } from './hud.js';
import { CAMERA, QUALITY, WORLD } from './config.js';

const boot = {
  el: document.getElementById('boot'),
  bar: document.getElementById('boot-bar'),
  pct: document.getElementById('boot-pct'),
  set(p, label) {
    if (!this.bar) return;
    this.bar.style.width = `${Math.round(p * 100)}%`;
    this.pct.textContent = label || `${Math.round(p * 100)}%`;
  },
  done() {
    if (!this.el) return;
    this.el.style.opacity = '0';
    setTimeout(() => this.el?.remove(), 500);
  },
};

async function start() {
  const app = document.getElementById('app');
  const bus = createBus();
  const quality = createQuality();
  const settings = quality.settings;
  boot.set(0.05, 'INICIANDO');

  // ------------------------------------------------------------ renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: false, powerPreference: 'high-performance', stencil: false,
  });
  const basePR = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(basePR * settings.renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = QUALITY.exposure;
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    CAMERA.chase.fov, window.innerWidth / window.innerHeight,
    CAMERA.near, Math.min(CAMERA.far, settings.drawDistance * 2),
  );

  // ------------------------------------------------- ceu + environment map
  boot.set(0.2, 'CEU');
  const env = createEnvironment(renderer, scene, settings);
  await new Promise((r) => requestAnimationFrame(r));

  // ------------------------------------------------------------ materiais
  boot.set(0.4, 'MATERIAIS');
  const mats = createMaterials(env.envMap, settings);
  await new Promise((r) => requestAnimationFrame(r));

  // ------------------------------------------------------------ mundo
  boot.set(0.6, 'CIDADE');
  const colliders = createColliders();
  const block = createBlock(scene, colliders, mats, WORLD.seed);
  const wind = createWind(WORLD.seed);
  const dust = createDust(scene, settings);
  await new Promise((r) => requestAnimationFrame(r));

  // ------------------------------------------------------------ drone
  boot.set(0.8, 'DRONE');
  const drone = createDrone(scene, bus, env.envMap);
  const rig = createCameraRig(camera, colliders);
  const input = createInput(bus, renderer.domElement);

  /** Reinicio: sempre nasce com o throttle no ponto de sustentacao. */
  function restart(pos = block.spawn, heading = Math.PI) {
    drone.reset(pos, heading);
    input.setThrottle(hoverThrottle());
    rig.snap(drone);
  }
  restart();
  const hud = createHud();
  hud.setHint(
    'W/S acelera · A/D gira · setas inclina<br>'
    + 'M ANGLE/ACRO · C camera · R reinicia · clique = mouse',
  );

  const pipeline = createPipeline(renderer, scene, camera, settings);
  boot.set(1.0, 'PRONTO');

  // ------------------------------------------------------------ eventos
  bus.on('action:toggleMode', () => {
    const m = drone.toggleMode();
    hud.flash(m === 'acro' ? 'ACRO' : 'ANGLE', 1.0);
  });
  bus.on('action:toggleView', () => {
    const m = rig.toggleMode();
    hud.flash(m === 'fpv' ? 'FPV' : '3a PESSOA', 1.0);
  });
  bus.on('action:restart', () => {
    restart();
    hud.flash('REINICIADO', 0.8);
  });
  bus.on('action:respawn', () => { drone.respawn(); rig.snap(drone); });
  bus.on('action:lights', () => {
    hud.flash(drone.toggleHeadlight() ? 'FAROL LIGADO' : 'FAROL DESLIGADO', 0.9);
  });
  bus.on('drone:crash', ({ impact }) => {
    rig.addShake(Math.min(1.4, CAMERA.shakeCrash * (impact / 12)));
    hud.flash('CRASH', 1.2, 'crash');
  });
  bus.on('drone:graze', ({ impact }) => {
    if (impact > 2) rig.addShake(Math.min(0.35, impact * 0.02));
  });

  // ------------------------------------------------------------ resize
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(basePR * quality.settings.renderScale);
    renderer.setSize(w, h);
    pipeline.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // ------------------------------------------------------------ loop
  const cmd = { throttle: 0, pitch: 0, roll: 0, yaw: 0, brake: false };
  let windVec = null;

  const loop = createLoop({
    fixed(dt) {
      wind.update(dt);
      windVec = wind.sample(drone.state.pos);
      cmd.throttle = input.state.throttle;
      cmd.pitch = input.state.pitch;
      cmd.roll = input.state.roll;
      cmd.yaw = input.state.yaw;
      cmd.brake = input.state.brake;
      drone.step(dt, cmd, windVec, colliders);
    },

    render(dt) {
      input.update(dt);
      const st = drone.state;

      drone.updateVisual(dt);
      rig.update(dt, drone, input.consumeMouse());
      env.updateShadow(st.pos);
      dust.update(dt, st.pos, st.vel, windVec);

      hud.update(dt, st, {
        battery: drone.status.battery,
        fps: loop.stats.fps,
        tier: quality.tier,
        wind: windVec ? windVec.length() : 0,
        roll: rig.rig.roll,
      });

      pipeline.render(dt, {
        speed: st.speed,
        velocity: st.vel,
        distortion: rig.rig.lensDistortion,
        elapsed: loop.stats.elapsed,
      });
    },
  });

  loop.start();
  boot.done();

  console.info('[DRONEFARER] tier:', quality.detected, '| colisores:', colliders.count);
  window.DF = {
    scene, camera, renderer, loop, quality, bus, drone, rig, input,
    colliders, env, mats, pipeline, block, wind, hud, restart, THREE,
  };
}

start().catch((e) => {
  console.error('[DRONEFARER] falha ao iniciar', e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = `<h1 style="font-size:18px">ERRO AO INICIAR</h1>
    <div style="font-size:11px;color:#ff8a5a;max-width:520px;text-align:center">${e.message}</div>`;
});
