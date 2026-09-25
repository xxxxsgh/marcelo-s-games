import * as THREE from 'three';
import { Pipeline } from './render/pipeline.js';
import { Sky } from './render/sky.js';
import { U } from './render/paint.js';
import { Input } from './core/input.js';
import { Player } from './world/player.js';
import { UI } from './ui/ui.js';
import { Audio } from './audio/audio.js';
import { Travel } from './travel.js';
import { LEVELS } from './levels/index.js';
import { load, save } from './save.js';
import { clamp, tangent } from './core/math.js';
import { Planet } from './world/planet.js';
import { Dust, Motes } from './render/fx.js';
import { faceDir } from './levels/common.js';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.params = params;
    this.save = load();
    const q = params.get('q') || this.save.quality || (matchMedia('(pointer: coarse)').matches ? 'media' : 'alta');
    this.save.quality = q;
    this.gfx = new Pipeline(document.getElementById('app'), q);
    Planet.detailScale = q === 'baixa' ? 0.55 : q === 'media' ? 0.8 : 1;
    this.scene = this.gfx.scene;
    this.camera = this.gfx.camera;
    this.audio = new Audio();
    this.ui = new UI(this.audio);
    this.input = new Input(this.gfx.renderer.domElement);
    if (this.input.touch) document.body.classList.add('touch');

    this.sky = new Sky();
    this.scene.add(this.sky.group);
    this.sun = new THREE.DirectionalLight('#fff1d6', Math.PI * 1.05);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.gfx.shadowSize, this.gfx.shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -9; sc.right = sc.top = 9; sc.near = 0.5; sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.amb = new THREE.AmbientLight('#b8c2ff', Math.PI * 0.32);
    this.scene.add(this.amb);
    this.sunDir = new THREE.Vector3(0.5, 0.6, 0.4).normalize();

    this.player = new Player(this.scene);
    this.dust = new Dust(this.scene);
    this.motes = new Motes(this.scene, this.gfx.quality === 'baixa' ? 40 : 90);
    const feet = () => this.player.pos.clone().addScaledVector(this.player.face, -0.1);
    this.player.onStep = () => { this.audio.step(this.level?.stepSoft ?? 1); this.dust.puff(feet(), this.player.up, 2, 0.55); };
    this.player.onJump = () => { this.audio.jump(); this.dust.puff(feet(), this.player.up, 3, 0.7); };
    this.player.onLand = () => { this.audio.land(); this.dust.puff(feet(), this.player.up, 6, 1); };

    this.travel = new Travel(this);
    this.mode = 'title';
    this.t = 0;
    this.waiters = [];
    this.sunsetE = null;
    this.hold = 0;
    this.paused = false;
        this._last = performance.now();
    this.skipT = 0;
    this.paperStrength = this.save.paper ?? 1;
    this.gfx.paper.uniforms.uStrength.value = this.paperStrength;
  }

  // ------------------------------------------------------------ niveis
  async loadLevel(i, { fromTravel = false, title = false } = {}) {
    if (this.level) {
      this.level.dispose && this.level.dispose();
      this.scene.remove(this.level.planet.group);
      this.level.planet.dispose();
      for (const o of this.level.extras || []) this.scene.remove(o);
    }
    this.waiters = [];
    this.ui.clearQuests();
    this.ui.sunsets(0, false);
    this.levelIndex = i;
    const L = this.level = LEVELS[i].build(this);
    L.index = i;
    this.scene.add(L.planet.group);
    for (const o of L.extras || []) this.scene.add(o);
    this.sunDir.copy(L.sun || new THREE.Vector3(0.5, 0.6, 0.4)).normalize();
    this.sky.setPalette(L.sky || {});
    this.sky.uniforms.uAtmo.value = L.atmo ?? 1;
    this.player.wind.copy(L.wind || new THREE.Vector3());
    this.dust.color(L.dust || '#e6d8bd');
    this.player.walkSpeed = L.walkSpeed ?? 3;
    this.player.model.pose = 'idle';
    this.player.model.hold = 0;
    this.player.camOverride = null;
    this.player.camDist = L.camDist ?? 5.2;
    this.player.camPitch = L.camPitch ?? 0.42;
    this.player.spawn(L.planet, L.spawn, L.face);
    this.player.model.group.visible = true;
    this.player.model.scarf.mesh.visible = true;
    this.sunsetE = null;
    this.mode = title ? 'title' : 'planet';
    this.audio.setMood(L.mood || {});
    if (!title) {
      this.save.level = Math.max(this.save.level || 0, i);
      this.save.current = i;
      save(this.save);
      this.player.frozen = true;
      this.fadeTo(0, 1.6);
      this.ui.card(L.kicker || '', L.name, L.subtitle || '', 4200);
      await this.wait(fromTravel ? 1.2 : 0.8);
      this.player.frozen = false;
      if (L.start) L.start();
    }
  }

  async next() {
    const i = this.levelIndex + 1;
    if (i >= LEVELS.length) return;
    this.save.level = Math.max(this.save.level || 0, i);
    save(this.save);
    if (LEVELS[i].direct) {
      this.player.frozen = true;
      await this.fadeTo(1, 2.5);
      await this.loadLevel(i, { fromTravel: true });
    } else this.startTravel(i);
  }

  async startTravel(to) {
    this.player.frozen = true;
    await this.fadeTo(1, 1.2);
    this.ui.clearQuests();
    this.ui.sunsets(0, false);
    if (this.level) {
      this.scene.remove(this.level.planet.group);
      for (const o of this.level.extras || []) this.scene.remove(o);
    }
    this.mode = 'travel';
    this.travel.begin(to);
    this.fadeTo(0, 1.4);
  }

  // ------------------------------------------------------------ utilitarios de roteiro
  narrate(text, o) { return this.ui.narrate(text, o); }
  wait(sec) { return new Promise((r) => this.waiters.push({ at: this.t + sec, r })); }
  until(cond) { return new Promise((r) => this.waiters.push({ cond, r })); }

  fadeTo(v, sec = 1) {
    const from = this.gfx.fade;
    const start = this.t;
    return new Promise((r) => {
      this.fadeAnim = { from, to: v, start, sec, r };
    });
  }

  /** enquadra a camera num ponto (cenas) */
  shot(pos, look, up) { this.player.camOverride = { pos: pos.clone(), look: look.clone(), up: up ? up.clone() : null }; }
  release() { this.player.camOverride = null; }

  /** camera de conversa: entre o principe e alguem */
  talkShot(targetPos, side = 1, dist = 3.4) {
    const P = this.player;
    const up = P.up.clone();
    const mid = P.pos.clone().lerp(targetPos, 0.5).addScaledVector(up, 0.8);
    const across = targetPos.clone().sub(P.pos); tangent(across, up);
    const len = Math.max(across.length(), 0.5);
    across.normalize();
    const perp = across.clone().cross(up).multiplyScalar(side);
    const pos = mid.clone().addScaledVector(perp, dist * 0.8 + len * 0.5).addScaledVector(up, 0.9).addScaledVector(across, -len * 0.25);
    this.shot(pos, mid);
  }

  /** faz o principe olhar pra algo */
  faceTo(p) {
    const d = p.clone().sub(this.player.pos);
    tangent(d, this.player.up);
    if (d.lengthSq() > 1e-4) this.player.face.copy(d.normalize());
  }

  /** vira um personagem pro principe (so em volta do proprio "cima") */
  turnToPlayer(obj) {
    const L = this.level;
    if (!obj || !L) return;
    if (obj.parent === L.planet.group) {
      const dir = obj.position.clone().sub(L.planet.center).normalize();
      const look = this.player.pos.clone().sub(L.planet.center).normalize();
      faceDir(obj, dir, look);
    } else if (obj.parent) {
      const t = obj.parent.worldToLocal(this.player.pos.clone());
      const d = t.sub(obj.position);
      const yaw = Math.atan2(d.x, d.z);
      obj.rotation.y = obj.userData.maxTurn ? THREE.MathUtils.clamp(yaw, -obj.userData.maxTurn, obj.userData.maxTurn) : yaw;
    }
  }

  async talk(who, lines, npc, o = {}) {
    if (npc) this.turnToPlayer(npc.group || npc.g);
    for (const l of lines) {
      const isPrince = l[0] === 'P';
      const text = l.slice(2);
      if (npc) npc.talking = !isPrince;
      await this.ui.say(isPrince ? 'o principezinho' : who, text, { voice: isPrince ? 1.45 : o.voice ?? 0.9 });
    }
    if (npc) npc.talking = false;
  }

  sunElevation(pos = this.player.pos) {
    const up = pos.clone().sub(this.level.planet.center).normalize();
    return up.dot(this.sunDir);
  }

  // ------------------------------------------------------------ laco
  /** so pra testes: avanca a simulacao sem desenhar */
  advance(sec, step = 1 / 30) {
    for (let t = 0; t < sec; t += step) this.frame(step, false);
    this._last = performance.now();
  }

  frame(fixed = 0, draw = true) {
    const now = performance.now();
    const dt = fixed || Math.min((now - this._last) / 1000, 1 / 20);
    if (!fixed) this._last = now;
    const inp = this.input;
    inp.poll();
    if (inp.pressed('menu') && this.mode !== 'title') this.togglePause();
    if (this.paused) { inp.endFrame(); if (draw) this.gfx.render(); return; }
    this.t += dt;
    U.uTime.value = this.t;
    U.uBoil.value = Math.floor(this.t * 7) * 1.37 % 50;

    // esperas de roteiro
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      if ((w.at !== undefined && this.t >= w.at) || (w.cond && w.cond())) { this.waiters.splice(i, 1); w.r(); }
    }
    if (this.fadeAnim) {
      const f = this.fadeAnim;
      const k = clamp((this.t - f.start) / f.sec, 0, 1);
      this.gfx.fade = f.from + (f.to - f.from) * (k * k * (3 - 2 * k));
      if (k >= 1) { this.fadeAnim = null; f.r(); }
    }

    this.ui.update(dt, inp);

    if (this.mode === 'travel') {
      this.travel.update(dt, inp);
    } else if (this.level) {
      this.updatePlanet(dt, inp);
    }

    this.sky.update(this.camera);
    U.uNight.value = this.sky.night();
    this.dust.update(dt);
    this.motes.update(this.camera);
    this.motes.points.visible = this.mode !== 'travel';
    if (draw) this.gfx.render();
    if (draw || !fixed) inp.endFrame();
  }

  updatePlanet(dt, inp) {
    const L = this.level, P = this.player;
    const busy = this.ui.busy || this.mode === 'title';
    const saved = inp.enabled;
    if (busy) inp.enabled = false;
    P.update(dt, busy ? { ...inp, move: { x: 0, y: 0 }, pressed: () => false, down: () => false, look: this.mode === 'title' ? { x: 0, y: 0 } : inp.look, zoom: 0 } : inp, this.t);
    inp.enabled = saved;
    L.update && L.update(dt, this.t);

    // luz do sol: sombra centrada no jogador
    this.sun.position.copy(P.pos).addScaledVector(this.sunDir, 25);
    this.sun.target.position.copy(P.pos);
    this.sky.uniforms.uUp.value.copy(this.camera.up);
    this.sky.uniforms.uSun.value.copy(this.sunDir);
    const n = this.sky.night();
    this.amb.intensity = Math.PI * (0.3 + n * 0.12);
    U.uShade.value.set('#6268aa').lerp(new THREE.Color('#5a64b8'), n);

    // pores do sol
    if (L.countSunsets && this.mode === 'planet') {
      const e = this.sunElevation();
      if (this.sunsetE !== null && this.sunsetE > 0.0 && e <= 0.0) {
        this.save.sunsets = (this.save.sunsets || 0) + 1;
        save(this.save);
        this.ui.sunsets(this.save.sunsets, true);
        this.audio.chime(5, 0.07);
        L.onSunset && L.onSunset(this.save.sunsets);
      }
      this.sunsetE = e;
    }

    // interacoes
    let best = null, bd = 1e9;
    if (!busy && !P.frozen) {
      for (const it of L.planet.interactables) {
        if (!it.on || (it.cond && !it.cond())) continue;
        if (it.obj) it.obj.getWorldPosition(it.pos);
        const d = it.pos.distanceTo(P.pos);
        if (d < it.r && d < bd) { best = it; bd = d; }
      }
    }
    if (best) {
      const lp = best.pos.clone().addScaledVector(P.up, best.labelH ?? 1.1);
      if (best.hold) {
        if (inp.down('act')) {
          this.hold += dt / best.hold;
          if (this.hold >= 1) { this.hold = 0; best.use(); }
        } else this.hold = Math.max(0, this.hold - dt * 3);
      } else if (inp.pressed('act')) best.use();
      this.ui.prompt(lp, best.label, this.camera, this.hold);
    } else {
      this.hold = 0;
      this.ui.prompt(null);
    }
    this.focus = best;

    const tgt = L.target && this.mode === 'planet' && !this.ui.busy && !P.camOverride && !P.frozen ? L.target() : null;
    this.updateGuide(dt, tgt);

    if (this.mode === 'title') this.titleCam(dt);
    else P.camera(this.camera, dt);
  }

  /** estrelinha que voa na frente do principe, mostrando o caminho */
  updateGuide(dt, tgt) {
    const P = this.player;
    if (!this.guide) {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.045 : 0.11;
        i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
      geo.center();
      this.guide = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd76a').multiplyScalar(2.6), toneMapped: false, transparent: true }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.18, depthWrite: false }));
      this.guide.add(halo);
      this.guide.k = 0;
      this.scene.add(this.guide);
      this.guide.position.copy(P.pos);
    }
    const g = this.guide;
    const far = tgt && tgt.distanceTo(P.pos) > 3.2;
    g.k += ((far ? 1 : 0) - g.k) * (1 - Math.exp(-3 * dt));
    g.visible = g.k > 0.02;
    if (!g.visible) { g.position.copy(P.pos).addScaledVector(P.up, 1.2); return; }
    if (tgt) {
      const d = tgt.clone().sub(P.pos);
      d.addScaledVector(P.up, -d.dot(P.up));
      if (d.lengthSq() > 1e-4) d.normalize();
      const bob = Math.sin(this.t * 3) * 0.12;
      const want = P.pos.clone().addScaledVector(d, 1.25 + Math.sin(this.t * 1.7) * 0.15).addScaledVector(P.up, 1.05 + bob);
      g.position.lerp(want, 1 - Math.exp(-4 * dt));
    }
    g.scale.setScalar(g.k * (1 + Math.sin(this.t * 6) * 0.08));
    g.quaternion.copy(this.camera.quaternion);
    g.rotateZ(this.t * 1.5);
  }

  titleCam(dt) {
    const P = this.player;
    const up = P.up;
    const a = this.t * 0.035 + 2.4;
    const f0 = P.face.clone();
    const dirH = f0.applyAxisAngle(up, a);
    const camFwd = dirH.clone().negate();
    const right = camFwd.clone().cross(up).normalize();
    const portrait = this.camera.aspect < 1;
    const pos = P.pos.clone().addScaledVector(dirH, portrait ? 6.4 : 5.2).addScaledVector(up, 0.9);
    const look = P.pos.clone().addScaledVector(up, portrait ? -0.4 : 1.55).addScaledVector(right, portrait ? -0.2 : -1.5);
    this.camera.position.copy(pos);
    this.camera.up.copy(up);
    this.camera.lookAt(look);
    this.sky.uniforms.uUp.value.copy(up);
  }

  togglePause() {
    this.paused = !this.paused;
    document.body.classList.toggle('paused', this.paused);
    document.getElementById('pause').classList.toggle('hide', !this.paused);
    if (this.paused) this.syncPause();
  }

  syncPause() {
    const el = document.getElementById('pause');
    el.querySelectorAll('[data-v]').forEach((r) => (r.value = this.audio.vol[r.dataset.v]));
    el.querySelector('[data-q]').value = this.save.quality;
    el.querySelector('[data-paper]').value = this.paperStrength;
  }
}
