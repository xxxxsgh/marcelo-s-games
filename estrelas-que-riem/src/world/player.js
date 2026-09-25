import * as THREE from 'three';
import { PrinceModel } from '../actors/prince.js';
import { clamp, damp, tangent } from '../core/math.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();

/**
 * Andar em volta de um planeta pequeno: a gravidade aponta pro centro,
 * "pra cima" muda a cada passo, e a camera acompanha esse "cima".
 */
export class Player {
  constructor(scene) {
    this.model = new PrinceModel();
    this.scene = scene;
    scene.add(this.model.group);
    this.model.attach(scene);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.face = new THREE.Vector3(0, 0, 1);
    this.grounded = true;
    this.frozen = false;
    this.speed = 0;
    this.stillTime = 0;
    this.walkSpeed = 3.0;
    this.onStep = null;
    this.stepAcc = 0;
    this.wind = new THREE.Vector3();

    // camera: vetor "pra frente" da camera, transportado junto com o jogador
    this.camFwd = new THREE.Vector3(0, 0, 1);
    this.camPitch = 0.42;
    this.camDist = 5.2;
    this.camPos = new THREE.Vector3();
    this.camUp = new THREE.Vector3(0, 1, 0);
    this.camLook = new THREE.Vector3();
    this.camOverride = null;   // {pos, look} pra cenas
  }

  walkTo(p, speed = 0.5) { return new Promise((done) => { this.auto = { p: p.clone(), speed, done }; }); }

  spawn(planet, dir, faceHint) {
    this.auto = null;
    this.planet = planet;
    const d = dir.clone().normalize();
    this.pos.copy(planet.surface(d, 0.02));
    this.up.copy(d);
    this.vel.set(0, 0, 0);
    const f = (faceHint ? faceHint.clone() : new THREE.Vector3(0, 0, 1));
    tangent(f, this.up);
    if (f.lengthSq() < 1e-4) f.set(1, 0, 0).cross(this.up);
    this.face.copy(f.normalize());
    this.camFwd.copy(this.face);
    this.snapCamera();
    this.model.scarf.reset();
  }

  update(dt, input, t) {
    const P = this.planet;
    if (!P) return;
    this.up.copy(this.pos).sub(P.center).normalize();
    // transporta frente da camera e do corpo pro novo plano tangente
    tangent(this.camFwd, this.up).normalize();
    tangent(this.face, this.up).normalize();

    // camera: girar
    this.camFwd.applyAxisAngle(this.up, -input.look.x);
    if (input.down('camL')) this.camFwd.applyAxisAngle(this.up, 1.8 * dt);
    if (input.down('camR')) this.camFwd.applyAxisAngle(this.up, -1.8 * dt);
    this.camPitch = clamp(this.camPitch + input.look.y, 0.05, 1.25);
    this.camDist = clamp(this.camDist + input.zoom * 0.5, 2.6, 11);

    const mv = this.frozen ? { x: 0, y: 0 } : input.move;
    const right = _v.copy(this.camFwd).cross(this.up).normalize();
    const wish = _w.copy(this.camFwd).multiplyScalar(mv.y).addScaledVector(right, mv.x);
    if (this.auto) {
      const d = this.auto.p.clone().sub(this.pos);
      tangent(d, this.up);
      this.auto.t = (this.auto.t || 0) + dt;
      if (d.length() < 0.25 || this.auto.t > 8) { const a = this.auto; this.auto = null; a.done(); wish.set(0, 0, 0); }
      else wish.copy(d.normalize()).multiplyScalar(this.auto.speed);
    }
    const run = input.down('run') ? 1.45 : 1;
    const target = wish.multiplyScalar(this.walkSpeed * run);

    // separa velocidade radial e tangencial
    let vr = this.vel.dot(this.up);
    const vt = tangent(this.vel.clone(), this.up);
    const accel = this.grounded ? 10 : 2.5;
    vt.lerp(target, 1 - Math.exp(-accel * dt));
    if (this.grounded && !this.frozen && input.pressed('jump')) { vr = 4.2; this.grounded = false; this.onJump && this.onJump(); }
    vr -= P.gravity * dt;
    this.vel.copy(vt).addScaledVector(this.up, vr);
    this.pos.addScaledVector(this.vel, dt);

    // chao
    const rel = _v.copy(this.pos).sub(P.center);
    const dist = rel.length();
    const dir = rel.divideScalar(dist);
    const ground = P.heightAt(dir);
    if (dist <= ground + 0.001) {
      this.pos.copy(dir).multiplyScalar(ground).add(P.center);
      if (!this.grounded && vr < -2) this.onLand && this.onLand();
      if (vr < 0) this.vel.addScaledVector(dir, -this.vel.dot(dir));
      this.grounded = true;
    } else if (dist > ground + 0.08) this.grounded = false;
    // agua: nao entra
    if (P.water && ground < P.water - 0.05) {
      const back = this.vel.clone(); tangent(back, dir);
      this.pos.addScaledVector(back, -dt * 1.05);
      this.vel.addScaledVector(back, -1);
    }

    // colisores (empurra no plano tangente)
    for (const c of P.colliders) {
      if (!c.on) continue;
      const d = _w.copy(this.pos).sub(c.pos);
      tangent(d, this.up);
      const l = d.length();
      const r = c.r + 0.2;
      if (l < r && l > 1e-5) this.pos.addScaledVector(d, (r - l) / l);
    }

    this.speed = tangent(this.vel.clone(), this.up).length();
    if (this.speed > 0.3) {
      const f = tangent(this.vel.clone(), this.up).normalize();
      this.face.lerp(f, 1 - Math.exp(-10 * dt)).normalize();
      this.stillTime = 0;
      if (this.grounded) {
        this.stepAcc += this.speed * dt;
        if (this.stepAcc > 0.55) { this.stepAcc = 0; this.onStep && this.onStep(); }
      }
    } else this.stillTime += dt;

    // camera volta devagar pra tras do jogador quando anda sem mexer o mouse
    if (this.speed > 0.5 && Math.abs(input.look.x) < 1e-4 && mv.y > -0.2) {
      this.camFwd.lerp(this.face, 1 - Math.exp(-0.9 * dt)).normalize();
    }

    this.syncModel(dt, t);
  }

  syncModel(dt, t) {
    const g = this.model.group;
    const up = this.up;
    const f = this.face;
    const r = _v.copy(up).cross(f).normalize();
    _m.makeBasis(r, up, f);
    g.quaternion.setFromRotationMatrix(_m);
    g.position.copy(this.pos);
    const side = r.clone();
    // brisa leve sempre, pra fita nunca ficar parada
    const wind = this.wind.clone().addScaledVector(f, -this.speed * 2.2 - 0.9).addScaledVector(up, 0.3)
      .addScaledVector(side, 0.5 + Math.sin(t * 0.7) * 0.5);
    this.model.animate(dt, this.speed, this.grounded, t, up, wind, side);
  }

  /** posicao da camera (orbital, com "cima" local) */
  camera(cam, dt) {
    let pos, look, up;
    if (this.camOverride) {
      ({ pos, look } = this.camOverride);
      up = this.camOverride.up || this.up;
      // camera de cena tambem nao entra no chao (dunas, montanhas)
      const P = this.planet;
      const rel = pos.clone().sub(P.center);
      const h = P.heightAt(rel.clone().normalize()) + 0.45;
      if (rel.length() < h) pos = rel.setLength(h).add(P.center);
    } else {
      look = this.pos.clone().addScaledVector(this.up, 0.9);
      const back = this.camFwd.clone().multiplyScalar(-Math.cos(this.camPitch) * this.camDist);
      pos = look.clone().add(back).addScaledVector(this.up, Math.sin(this.camPitch) * this.camDist);
      // nao deixa a camera entrar no chao
      const P = this.planet;
      const rel = pos.clone().sub(P.center);
      const h = P.heightAt(rel.clone().normalize()) + 0.5;
      if (rel.length() < h) pos = rel.setLength(h).add(P.center);
      up = this.up;
    }
    const k = 1 - Math.exp(-6 * dt);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, 1 - Math.exp(-10 * dt));
    this.camUp.lerp(up, 1 - Math.exp(-4 * dt)).normalize();
    cam.position.copy(this.camPos);
    cam.up.copy(this.camUp);
    cam.lookAt(this.camLook);
  }

  snapCamera() {
    const look = this.pos.clone().addScaledVector(this.up, 0.9);
    const back = this.camFwd.clone().multiplyScalar(-Math.cos(this.camPitch) * this.camDist);
    this.camPos.copy(look).add(back).addScaledVector(this.up, Math.sin(this.camPitch) * this.camDist);
    this.camLook.copy(look);
    this.camUp.copy(this.up);
  }
}
