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
import { createCity } from './world/city.js';
import { createPoiSystem, createSecurity } from './world/pois.js';
import { createLife } from './world/life.js';
import { createMap } from './ui/map.js';
import { createMissions } from './missions/index.js';
import { createHangar } from './hangar/index.js';
import { createBoard } from './ui/board.js';
import { createDamage } from './damage/index.js';
import { createWeather } from './world/weather.js';
import { createAudio } from './audio/index.js';
import { createOptions } from './ui/options.js';
import { createDebug, createTutorial } from './ui/debug.js';
import { createPhotoMode, createKillcam } from './ui/photo.js';
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
  // O painel de debug precisa das estatisticas do loop, que so nasce la
  // embaixo; este objeto e preenchido quando o loop e criado.
  const loopRef = { stats: { fps: 0, frameMs: 0, physMs: 0, renderMs: 0, steps: 0 } };
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

  // Cidade aberta ao redor do quarteirao. Os chunks -2..1 sao do quarteirao
  // da Fase 1, entao a cidade nao gera por cima deles.
  const city = createCity(scene, colliders, mats, settings, env.envMap);
  city.setExclusion((cx, cz) => cx >= -2 && cx <= 1 && cz >= -2 && cz <= 1);
  const life = createLife(scene, settings, env.envMap);
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
  const pois = createPoiSystem(scene, bus, save, colliders);
  const security = createSecurity(scene, bus, drone.model);
  const map = createMap(pois);
  const hangar = createHangar(save, bus);
  hangar.apply(drone);
  const damage = createDamage(bus, drone);
  const audio = createAudio(bus);
  // Web Audio so pode nascer depois de um gesto do usuario.
  const kickAudio = () => { audio.resume(); };
  window.addEventListener('pointerdown', kickAudio, { once: false });
  window.addEventListener('keydown', kickAudio, { once: false });
  const weather = createWeather(scene, env, mats, city, life, settings);
  const race = createRace(scene, bus, save, drone.model);
  race.load(save.get('lastCircuit', 'aberto'));
  hud.setRaceVisible(true);

  const missions = createMissions(scene, bus, save, drone, camera, race);
  const board = createBoard(missions, hangar, save, bus);

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

  // ------------------------------------------------------ UI da Fase 8
  const options = createOptions(
    quality, pipeline, renderer, camera, input, audio, save, bus, damage,
  );
  options.restore();
  const debugPanel = createDebug(renderer, loopRef, city, colliders, drone, pois);
  const tutorial = createTutorial(bus, save);
  const photo = createPhotoMode(renderer, scene, camera, input, hud);
  const killcam = createKillcam(camera, drone, bus);
  const killGhost = drone.model.makeGhost(0.85);
  killGhost.visible = false;
  scene.add(killGhost);

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
  // Se ha missao ativa, R refaz a missao — falhar nunca abre game over.
  bus.on('action:restart', () => {
    if (missions.isActive || missions.state.status === 'failed') {
      const m = missions.retry();
      if (m && m.type === 'corrida') restartRace();
      hud.hideMissionResult();
      hud.flash('RECOMECANDO', 0.8);
      return;
    }
    restartRace();
  });
  bus.on('action:nextCircuit', () => {
    const c = race.next();
    save.set('lastCircuit', c.id);
    restartRace();
    hud.flash(c.name, 1.2);
  });
  bus.on('action:board', () => {
    const on = board.toggle();
    hud.setVisible(!on);
  });
  bus.on('board:accept', (id) => {
    const m = missions.start(id);
    if (!m) return;
    if (m.type === 'corrida') restartRace();
    hud.flash(m.name.toUpperCase(), 1.8);
  });
  bus.on('hangar:changed', () => {
    hangar.apply(drone);
    hud.flash(hangar.summary(), 2.6);
  });
  bus.on('mission:complete', ({ mission, reward, first }) => {
    hud.flash(`MISSAO COMPLETA  +$${reward}${first ? '' : ' (repeticao)'}`, 2.6);
    hud.showMissionResult(mission, reward, true);
  });
  bus.on('mission:fail', ({ reason }) => {
    hud.flash(`FALHOU — ${reason}`, 2.2, 'crash');
    hud.showMissionResult(null, 0, false, reason);
  });
  bus.on('mission:capture', ({ index, total }) => {
    hud.flash(`FOTO ${index}/${total}`, 0.8);
    rig.addShake(0.04);
  });
  bus.on('mission:pickup', () => hud.flash('CARGA A BORDO', 1.4));
  bus.on('action:debug', () => debugPanel.toggle());
  bus.on('action:options', () => {
    const on = options.toggle();
    hud.setVisible(!on);
  });
  bus.on('action:photo', () => {
    const on = photo.toggle();
    if (!on) rig.snap(drone);
  });
  bus.on('action:map', () => {
    const on = map.toggle();
    hud.setVisible(!on);
  });
  bus.on('poi:discovered', (p) => hud.flash(`DESCOBERTO: ${p.name}`, 1.6));
  bus.on('zone:enter', (z) => hud.flash(`ZONA RESTRITA: ${z.name}`, 1.6, 'crash'));
  bus.on('zone:alarm', (z) => {
    security.spawn(z, 3);
    hud.flash('ALARME — SEGURANCA A CAMINHO', 2.2, 'crash');
  });
  bus.on('zone:clear', () => { security.despawn(); hud.flash('DESPISTADO', 1.2); });
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
  bus.on('drone:graze', ({ impact, tag }) => {
    if (impact > 2) rig.addShake(Math.min(0.35, impact * 0.02));
    // Fio de alta tensao no poste: choque tira o controle por instantes.
    if (tag === 'poste' && impact > 4 && Math.random() < 0.4) damage.shock(1.3);
  });
  bus.on('damage:shock', () => {
    rig.addShake(0.5);
    hud.flash('CHOQUE — CONTROLE PERDIDO', 1.4, 'crash');
  });
  bus.on('damage:part', ({ part }) => hud.flash(`DANO: ${part.toUpperCase()}`, 1.2, 'crash'));
  bus.on('damage:cargo', () => hud.flash('CARGA PERDIDA', 1.8, 'crash'));
  bus.on('action:weather', () => {
    const ids = Object.keys(weather.presets);
    const i = (ids.indexOf(weather.state.preset) + 1) % ids.length;
    const p = weather.setPreset(ids[i]);
    drone.setEnvMap(env.envMap);
    hud.flash(p.name, 1.6);
  });
  bus.on('action:noRisk', () => {
    const on = damage.setNoRisk(!damage.state.noRisk);
    hud.flash(on ? 'MODO TREINO — SEM RISCO' : 'RISCO ATIVO', 1.6);
  });

  // ------------------------------------------------------------ resize
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(basePR * quality.settings.renderScale);
    renderer.setSize(w, h);
    pipeline.setSize(w, h);
    photo.setSize(w, h);
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
      // Helice agil e chassis leve sofrem mais com rajada — o trade-off do
      // hangar tem que ser sentido no ar, nao so lido na tela. O clima e o
      // distrito entram no mesmo multiplicador.
      const districtNow = city.districtAtPos(drone.state.pos);
      windVec.multiplyScalar(
        drone.status.windSens * weather.windMultiplier(districtNow),
      );
      cmd.throttle = input.state.throttle;
      cmd.pitch = input.state.pitch;
      cmd.roll = input.state.roll;
      cmd.yaw = input.state.yaw;
      cmd.brake = input.state.brake;

      // Ordem importa: o hangar DEFINE os multiplicadores da build (valores
      // absolutos) e o dano MULTIPLICA por cima. Invertido, um sobrescreveria
      // o outro e o drone quebrado voaria como novo.
      hangar.apply(drone);
      damage.modulate(dt);

      drone.step(dt, cmd, windVec, colliders);
      race.step(dt, drone.state.pos, drone.state.quat);
      pois.update(dt, drone.state.pos, drone);
      missions.update(dt);

      // Perda de sinal trava o comando: e o custo real de voar longe demais
      // ou de se enfiar numa garagem.
      if (pois.state.signal < 0.6) {
        const loss = 1 - pois.state.signal;
        if (Math.random() < loss * 0.35) {
          cmd.pitch *= 0.2; cmd.roll *= 0.2; cmd.yaw *= 0.2;
        }
      }

      if (security.count) {
        const near = security.update(dt, drone.state.pos);
        if (near !== null && near < 2.2) {
          drone.crash('seguranca', 12);
          security.despawn();
          pois.resetAlert();
        }
      }
    },

    render(dt) {
      input.update(dt);
      const st = drone.state;

      // --- photo mode congela o jogo e assume a camera ---
      if (photo.active) {
        photo.update(dt);
        photo.render();
        debugPanel.update(dt);
        return;
      }

      drone.updateVisual(dt);
      // O killcam assume a camera por 8 s depois do crash.
      const inKillcam = killcam.update(dt, killGhost);
      if (!inKillcam) rig.update(dt, drone, input.consumeMouse());
      env.updateShadow(st.pos);
      dust.update(dt, st.pos, st.vel, windVec);

      // Streaming da cidade com orcamento de tempo por frame.
      city.update(st.pos, 4);
      life.update(dt, loop.stats.elapsed, st.pos);
      weather.update(dt, st.pos);
      pois.animate(dt, loop.stats.elapsed);
      missions.animate(dt, loop.stats.elapsed);
      race.update(dt, camera.position);

      if (map.visible) {
        const e = new THREE.Euler().setFromQuaternion(st.quat, 'YXZ');
        map.draw(st.pos, e.y);
      }

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

      // audio: contexto da musica + motor/vento/doppler
      audio.setContext(
        drone.batteryRatio < 0.18 ? 'critical'
          : missions.isActive ? 'mission'
            : race.state.status === 'running' ? 'race' : 'explore',
      );
      audio.update(dt, st, camera.position,
        colliders.nearestDistance(st.pos, 8), drone.batteryRatio);

      tutorial.update(dt, { drone, race });
      debugPanel.update(dt);
      hud.setMission(missions.state);
      hud.setStatus({
        district: city.districtAtPos(st.pos).name,
        signal: pois.state.signal,
        alert: pois.state.alertLevel,
        chasing: security.count > 0,
        recharging: !!pois.state.recharging,
      });
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
        signal: pois.state.signal,
        damage: damage.cameraGlitch,
        elapsed: loop.stats.elapsed,
      });
    },
  });

  loopRef.stats = loop.stats;
  loop.start();
  boot.done();

  console.info('[DRONEFARER] tier:', quality.detected, '| colisores:', colliders.count);
  window.DF = {
    scene, camera, renderer, loop, quality, bus, drone, rig, input,
    colliders, env, mats, pipeline, block, wind, hud, restart,
    race, save, restartRace, city, pois, security, map, life,
    missions, hangar, board, damage, weather, audio,
    options, debugPanel, photo, killcam, tutorial, THREE,
  };
}

start().catch((e) => {
  console.error('[DRONEFARER] falha ao iniciar', e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = `<h1 style="font-size:18px">ERRO AO INICIAR</h1>
    <div style="font-size:11px;color:#ff8a5a;max-width:520px;text-align:center">${e.message}</div>`;
});
