import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { volcano, sprout, rose, glassGlobe, chair, rake, baobab } from '../actors/props.js';
import { M, paint } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, carry, drop, wpos } from './common.js';

export default {
  id: 'b612',
  name: 'Asteroide B-612',
  kicker: 'em casa',
  subtitle: 'um planeta pouco maior que uma casa',
  color: '#c9a36b',
  previewR: 4,
  build(game) {
    const planet = new Planet({
      radius: 5, seed: 3, bump: 0.06, gravity: 11,
      palette: { a: '#cfa56c', b: '#9aae63', c: '#e6cf9d' },
    });
    const r = rng(612);
    const extras = [];
    const upd = [];

    // --- lugares
    const D = {
      spawn: dirLL(18, 8), chair: dirLL(8, 28), rose: dirLL(42, -30), globe: dirLL(8, -62),
      can: dirLL(20, 42),
      v1: dirLL(-22, 118), v2: dirLL(-6, 150), v3: dirLL(24, 196), birds: dirLL(-38, 40),
    };

    const ch = chair();
    planet.place(ch, D.chair);
    faceDir(ch, D.chair, dirLL(10, 110));
    const chairCol = planet.collider(D.chair, 0.2);

    const R = rose(1.25);
    planet.place(R.g, D.rose);
    faceDir(R.g, D.rose, D.spawn);
    upd.push(R.update);
    planet.collider(D.rose, 0.25);
    // montinho da rosa
    const mound = M(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 1), '#a88a5c', { inkW: 0.8 });
    planet.place(mound, D.rose, { sink: 0.02 });

    const globe = glassGlobe();
    planet.place(globe, D.globe);

    // regador
    const can = new THREE.Group();
    can.add(M(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 12).translate(0, 0.12, 0), '#7b95b0', { inkW: 0.7 }));
    const spout = M(new THREE.CylinderGeometry(0.015, 0.025, 0.28, 6).translate(0, 0.14, 0), '#7b95b0', { inkW: 0.5 });
    spout.position.set(0, 0.1, 0.12); spout.rotation.x = 0.9; can.add(spout);
    const handle = M(new THREE.TorusGeometry(0.09, 0.015, 5, 12, Math.PI), '#6a84a0', { inkW: 0.4 });
    handle.position.set(0, 0.24, -0.02); handle.rotation.y = Math.PI / 2; can.add(handle);
    planet.place(can, D.can);

    const volcs = [volcano(true, 0.9), volcano(true, 0.8), volcano(false, 0.75)];
    [D.v1, D.v2, D.v3].forEach((d, i) => {
      planet.place(volcs[i].g, d);
      planet.collider(d, 0.55);
      upd.push(volcs[i].update);
    });
    const rk = rake();
    planet.place(rk, dirLL(-12, 132), { yaw: 1 });

    // brotos de baoba
    const avoid = Object.values(D);
    const sprouts = scatter(r, 5, avoid, 0.42, (d) => Math.abs(d.y) < 0.8).map((d) => {
      const s = sprout(); planet.place(s.g, d, { yaw: r() * 6 }); upd.push(s.update); return { s, d };
    });

    // decoracao: capim, flores miudas, pedrinhas
    // capim: todas as folhinhas numa malha instanciada so
    const grassDirs = scatter(r, 70, avoid, 0.09);
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.18, 4).translate(0, 0.09, 0), paint('#7f9d52', { grain: 0.5 }), grassDirs.length * 4);
    const gm = new THREE.Matrix4(), gq = new THREE.Quaternion(), gs = new THREE.Vector3(), gp = new THREE.Vector3();
    const tilt = new THREE.Quaternion(), e = new THREE.Euler();
    let gi = 0;
    for (const d of grassDirs) {
      const base = planet.surface(d, -0.02);
      const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      for (let k = 0; k < 4; k++) {
        const off = new THREE.Vector3((r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1).applyQuaternion(q0);
        gp.copy(base).add(off);
        tilt.setFromEuler(e.set((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6));
        gq.copy(q0).multiply(tilt);
        gs.set(1, 0.6 + r() * 0.8, 1);
        grass.setMatrixAt(gi++, gm.compose(gp, gq, gs));
      }
    }
    grass.castShadow = false; grass.receiveShadow = true;
    planet.group.add(grass);
    const flowerCols = ['#f3e6a0', '#e6a8c0', '#b7c8f0', '#ffffff'];
    for (const d of scatter(r, 22, avoid, 0.15)) {
      const f = M(new THREE.SphereGeometry(0.04, 6, 4), flowerCols[Math.floor(r() * 4)], { inkW: 0.4, cast: false });
      planet.place(f, d, { lift: 0.06 });
    }
    for (const d of scatter(r, 10, avoid, 0.3)) {
      const p = M(new THREE.DodecahedronGeometry(0.08 + r() * 0.12, 0), '#a39a90', { inkW: 0.6, flat: true });
      planet.place(p, d, { yaw: r() * 6 });
    }
    // um asteroide vizinho, la longe, tomado por baobas (o perigo!)
    const far = new THREE.Group();
    const farP = M(new THREE.IcosahedronGeometry(2.2, 3), '#b59a7a', { inkW: 1.2 });
    far.add(farP);
    for (let i = 0; i < 3; i++) {
      const b = baobab(1.1);
      const dd = new THREE.Vector3(Math.sin(i * 2.1), 0.7, Math.cos(i * 2.1)).normalize();
      b.position.copy(dd).multiplyScalar(2.05);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dd);
      far.add(b);
    }
    far.position.set(-40, 26, -60);
    extras.push(far);

    // --- estado
    const S = { pulled: 0, swept: 0, stage: 'chores', watered: false, globeOn: false, fl: null };
    const quests = () => game.ui.setQuests('manhã no B-612', [
      { id: 'bao', text: 'arrancar os brotos de *baobá*', max: 5 },
      { id: 'vul', text: 'limpar os vulcões', max: 3 },
    ]);

    sprouts.forEach(({ s, d }) => {
      const it = planet.interact({
        pos: planet.surface(d), r: 1.2, label: 'arrancar o baobá', hold: 0.7,
        use: () => {
          it.on = false; s.pulled = true; game.audio.pull();
          S.pulled++; game.ui.quest('bao', { n: S.pulled });
          if (S.pulled === 1) game.ui.toast('um baobá pequenininho parece um roseiral…', 3200);
          check();
        },
      });
      it.on = false; s.it = it;
    });
    volcs.forEach((v, i) => {
      const d = [D.v1, D.v2, D.v3][i];
      const it = planet.interact({
        pos: planet.surface(d), r: 1.7, label: i === 2 ? 'limpar o vulcão extinto' : 'limpar o vulcão', hold: 1.2, labelH: 1.3,
        use: () => {
          it.on = false; v.dirt = 0.12; game.audio.poof();
          S.swept++; game.ui.quest('vul', { n: S.swept });
          if (i === 2) game.ui.toast('o extinto também. nunca se sabe!', 3000);
          else game.ui.toast('bem limpinho, ele queima devagar e sem susto', 3000);
          check();
        },
      });
      it.on = false; v.it = it;
    });

    const canIt = planet.interact({
      obj: can, r: 1.2, label: 'pegar o regador', on: false,
      use: () => { canIt.on = false; carry(game, can); game.audio.chime(2); game.ui.quest('agua', { text: 'regar a *rosa*' }); },
    });
    const globeIt = planet.interact({
      obj: globe, r: 1.2, label: 'pegar a redoma', on: false,
      use: () => { globeIt.on = false; carry(game, globe); game.audio.chime(4); },
    });
    const roseIt = planet.interact({
      obj: R.g, r: 1.5, label: 'falar com a rosa', labelH: 1.2, on: false,
      use: () => roseTalk(),
    });

    function check() {
      if (S.stage === 'chores' && S.pulled >= 5 && S.swept >= 3) {
        S.stage = 'rose';
        setTimeout(async () => {
          game.ui.toast('alguém está chamando…', 2600);
          await game.wait(1.2);
          game.ui.setQuests('a flor', [{ id: 'rosa', text: 'ver o que a *rosa* quer' }]);
          roseIt.on = true;
          game.audio.chime(7, 0.1);
        }, 900);
      }
    }

    const rosePos = () => wpos(R.g);
    async function roseTalk() {
      const P = game.player;
      game.faceTo(rosePos());
      game.talkShot(rosePos(), 1, 2.6);
      if (S.stage === 'rose') {
        roseIt.on = false;
        await game.talk('a rosa', [
          'R Aaah… acabei de acordar. Me desculpe… ainda estou toda despenteada.',
          'P Como você é bonita!',
          'R Não é mesmo? E nasci junto com o sol…',
          'R Acho que é hora do café da manhã. Você teria a bondade de pensar em mim?',
        ], null, { voice: 1.2 });
        game.release();
        S.stage = 'water';
        game.ui.setQuests('a flor', [{ id: 'agua', text: 'buscar o *regador*' }]);
        canIt.on = true;
        roseIt.on = true;
        roseIt.label = 'regar a rosa';
        roseIt.cond = () => game.carrying === can;
        return;
      }
      if (S.stage === 'water') {
        roseIt.on = false;
        roseIt.cond = null;
        drop(game, planet, D.rose.clone().add(dirLL(0, 90).multiplyScalar(0.06)).normalize());
        game.audio.sparkle();
        await game.wait(0.4);
        await game.talk('a rosa', [
          'R Ah, que água fresquinha.',
          'R Não tenho medo de tigres, sabe? Olhe só os meus espinhos. Mas tenho horror de correntes de ar…',
          'R À noite faz frio no seu planeta. Você me cobriria com a *redoma*?',
        ], null, { voice: 1.2 });
        game.release();
        game.ui.quest('agua', { done: true });
        S.stage = 'globe';
        game.ui.setQuests('a flor', [{ id: 'redoma', text: 'cobrir a rosa com a *redoma de vidro*' }]);
        globeIt.on = true;
        roseIt.on = true;
        roseIt.label = 'cobrir a rosa';
        roseIt.cond = () => game.carrying === globe;
        return;
      }
      if (S.stage === 'globe') {
        roseIt.on = false;
        drop(game, planet, D.rose, 0);
        globe.scale.setScalar(1.35);
        S.globeOn = true;
        game.audio.success();
        game.ui.quest('redoma', { done: true });
        await game.wait(0.6);
        await game.narrate('Ele achava que a flor era única no universo. Mas ela falava tanto, e ele era tão jovem, que acabou se sentindo sozinho.');
        await game.narrate('Então resolveu viajar. Queria conhecer outros planetas… e aprender alguma coisa.');
        game.talkShot(rosePos(), -1, 2.6);
        await game.talk('a rosa', [
          'P Adeus.',
          'R …',
          'P Adeus.',
          'R Eu fui tola. Me perdoe. Tente ser feliz.',
          'R Eu gosto de você. Você nunca soube disso, por minha culpa. Mas isso não tem importância.',
          'R Se eu quiser conhecer as borboletas, vou ter que aguentar umas lagartas. Vá logo. Você já decidiu ir.',
        ], null, { voice: 1.2 });
        game.release();
        S.stage = 'leave';
        game.ui.setQuests('partida', [{ id: 'ir', text: 'esperar os *pássaros selvagens*' }]);
        await game.wait(1.2);
        S.fl = flock(game, planet, D.birds);
        game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
      }
    }

    // o titulo usa este nivel como cenario: principe sentado olhando o por do sol
    const L = {
      _S: S,
      planet, extras,
      sun: dirLL(38, 64),
      sky: {
        dayTop: '#6f9fd6', dayHor: '#f6dfb8', setA: '#f39a5b', setB: '#d8718f',
        nightTop: '#0e1638', nightHor: '#2b3470', neb: '#6a4f9c', neb2: '#2f7a8f',
      },
      mood: { root: 62, scale: 'major', tempo: 72, density: 0.5, pad: 0.5, wind: 0.1 },
      spawn: D.spawn,
      face: dirLL(30, -30).sub(D.spawn),
      countSunsets: true,
      camDist: 5,
      update(dt, t) {
        for (const u of upd) u(dt, t);
        if (S.fl) S.fl.update(dt, t);
      },
      target() {
        if (game.mode !== 'planet' || game.ui.busy) return null;
        const P = game.player.pos;
        const near = (list) => list.reduce((b, p) => (!b || p.distanceTo(P) < b.distanceTo(P) ? p : b), null);
        if (S.stage === 'chores') {
          const list = [...sprouts.filter((x) => !x.s.pulled).map((x) => planet.surface(x.d)), ...volcs.filter((v) => v.it.on).map((v) => wpos(v.g))];
          return near(list);
        }
        if (S.stage === 'rose') return rosePos();
        if (S.stage === 'water') return game.carrying === can ? rosePos() : wpos(can);
        if (S.stage === 'globe') return game.carrying === globe ? rosePos() : wpos(globe);
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      onSunset(n) {
        if (n === 1) game.ui.toast('num planeta tão pequeno, basta puxar a cadeira alguns passos…', 4200);
        if (n === 4) game.ui.toast('quando a gente está triste, gosta de ver o sol se pôr', 4000);
        if (n === 44) { game.ui.toast('quarenta e quatro pores do sol num dia só!', 5000); game.audio.laugh(3); }
      },
      async start() {
        await game.narrate('Era uma vez um principezinho que morava num planeta pouco maior do que ele.');
        await game.narrate('Toda manhã, ele arrumava o seu planeta com muito cuidado.');
        quests();
        sprouts.forEach((x) => (x.s.it.on = true));
        volcs.forEach((v) => (v.it.on = true));
        game.ui.toast(game.input.touch ? 'arraste à esquerda para andar · ✦ interage' : 'WASD para andar · segure E nas plantinhas', 4200);
      },
      title() {
        // pose do titulo
        const P = game.player;
        chairCol.on = false;
        P.spawn(planet, D.chair, dirLL(10, 110).sub(D.chair));
        P.model.pose = 'chair';
        P.frozen = true;
        // sol baixinho no horizonte: o por do sol do titulo
        const up = P.up.clone();
        const side = dirLL(10, 110).sub(D.chair); side.addScaledVector(up, -side.dot(up)).normalize();
        game.sunDir.copy(side).addScaledVector(up, 0.07).normalize();
      },
    };
    return L;
  },
};
