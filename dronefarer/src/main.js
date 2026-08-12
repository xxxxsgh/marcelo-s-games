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
import { createRace } from './race/index.js';
import { createSave } from './save.js';
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
    + 'M ANGLE/ACRO · C camera · R reinicia · TAB circuito<br>'
    + 'G fantasma · L farol · clique = mouse',
  );

  // ------------------------------------------------------------ corrida
  const save = createSave();
  const race = createRace(scene, bus, save, drone.model);
  race.load(save.get('lastCircuit', 'aberto'));
  hud.setRaceVisible(true);

  /** Reinicio de corrida: arma o circuito e nasce na largada. */
  function restartRace() {
    const c = race.circuit;
    race.arm();
    restart(
      new THREE.Vector3(c.start.x, c.start.y, c.start.z),
      THREE.MathUtils.degToRad(c.start.heading),
    );
    hud.hideFinish();
    hud.setCircuit(c, save.getRecord(c.id));
  }
  restartRace();

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
  // R reinicia NA HORA: sem menu, sem loading. E o coracao do loop.
  bus.on('action:restart', () => { restartRace(); });
  bus.on('action:nextCircuit', () => {
    const c = race.next();
    save.set('lastCircuit', c.id);
    restartRace();
    hud.flash(c.name, 1.2);
  });
  bus.on('action:toggleGhost', () => {
    hud.flash(race.toggleGhost() ? 'FANTASMA ON' : 'FANTASMA OFF', 0.9);
  });

  bus.on('race:gate', (g) => {
    // Feedback forte: flash no anel (no gate), shake leve e texto.
    rig.addShake(g.centered ? 0.06 : 0.03);
    if (g.centered) hud.flash(`CENTRO  +${g.points}`, 0.7);
    else if (g.graze) hud.flash('RASPOU', 0.5);
  });
  bus.on('race:finish', (r) => {
    hud.showFinish({ ...r, bestSplits: race.state.bestSplits });
    rig.addShake(0.12);
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
  const _guide = new THREE.Vector3();
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
      race.step(dt, drone.state.pos, drone.state.quat);
    },

    render(dt) {
      input.update(dt);
      const st = drone.state;

      drone.updateVisual(dt);
      rig.update(dt, drone, input.consumeMouse());
      env.updateShadow(st.pos);
      dust.update(dt, st.pos, st.vel, windVec);

      race.update(dt, camera.position);

      // --- seta guia pro gate atual ---
      const gate = race.activeGate();
      if (gate && race.state.status !== 'finished') {
        _guide.copy(gate.center);
        const dist = _guide.distanceTo(st.pos);
        _guide.project(camera);
        const behind = _guide.z > 1;
        const gx = behind ? -_guide.x : _guide.x;
        const gy = behind ? -_guide.y : _guide.y;
        hud.setGuide(Math.atan2(gx, gy), dist,
          !behind && Math.abs(_guide.x) < 0.95 && Math.abs(_guide.y) < 0.95);
      } else {
        hud.setGuide(0, null, false);
      }
      hud.updateRace(race.state, race.gates.length);

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
    colliders, env, mats, pipeline, block, wind, hud, restart,
    race, save, restartRace, THREE,
  };
}

start().catch((e) => {
  console.error('[DRONEFARER] falha ao iniciar', e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = `<h1 style="font-size:18px">ERRO AO INICIAR</h1>
    <div style="font-size:11px;color:#ff8a5a;max-width:520px;text-align:center">${e.message}</div>`;
});
