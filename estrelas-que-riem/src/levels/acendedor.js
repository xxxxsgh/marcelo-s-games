import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { lamplighter } from '../actors/people.js';
import { lampPost } from '../actors/props.js';
import { M } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, placeNPC, wpos } from './common.js';

const DAY = 26; // segundos por volta do planeta

export default {
  id: 'acendedor',
  name: 'O Acendedor de Lampiões',
  kicker: 'asteroide 329',
  subtitle: 'o menor de todos: um lampião e um homem',
  color: '#d9b36a',
  previewR: 2.6,
  build(game) {
    const D = { lamp: dirLL(4, 0), man: dirLL(0, -26), spawn: dirLL(-10, -70), birds: dirLL(40, 120) };
    const planet = new Planet({ radius: 2.8, seed: 329, bump: 0.05, gravity: 10, palette: { a: '#d6b172', b: '#b8a06a', c: '#ecd7a8' } });
    const r = rng(329);
    const upd = [];

    const lamp = lampPost();
    planet.place(lamp.g, D.lamp);
    planet.collider(D.lamp, 0.2);
    upd.push(lamp.update);
    lamp.on = true;

    const man = lamplighter();
    placeNPC(planet, man.group, D.man, D.lamp, 0.35);
    upd.push((dt, t) => man.update(dt, t));
    for (const d of scatter(r, 12, [D.lamp, D.man, D.spawn], 0.3)) {
      const p = M(new THREE.DodecahedronGeometry(0.06 + r() * 0.08, 0), '#a39a8a', { inkW: 0.5, flat: true });
      planet.place(p, d, { yaw: r() * 6 });
    }

    const S = { stage: 'meet', fl: null, done: 0, auto: true, sleep: false, ang: 0 };
    const lampE = () => planet.up(wpos(lamp.g)).dot(game.sunDir);
    const it = planet.interact({ obj: man.group, r: 1.8, label: 'falar com o acendedor', labelH: 1.9, use: () => talk() });
    const lampIt = planet.interact({
      obj: lamp.g, r: 1.3, label: 'acender', labelH: 2.4, on: false,
      use: () => {
        const e = lampE();
        if (!lamp.on) {
          if (e < 0.15) { lamp.on = true; ok('boa noite!'); }
          else { game.ui.toast('mas ainda é dia!', 1500); game.audio.noise(0.1, 500, 1, 0.05); }
        } else {
          if (e > -0.15) { lamp.on = false; ok('bom dia!'); }
          else { game.ui.toast('ainda é noite escura!', 1500); game.audio.noise(0.1, 500, 1, 0.05); }
        }
      },
    });
    function ok(msg) {
      S.done++;
      game.audio.success();
      game.ui.toast(msg, 1400);
      game.ui.quest('lamp', { n: S.done });
      if (S.done >= 4) wake();
    }

    async function talk() {
      it.on = false;
      game.faceTo(wpos(man.group));
      game.talkShot(wpos(man.head), 1, 3);
      if (S.stage === 'meet') {
        await game.talk('o acendedor', [
          'L Bom dia.',
          'P Bom dia. Por que você acabou de apagar o seu lampião?',
          'L É o regulamento. Bom dia.',
          'P Que regulamento?',
          'L O de apagar o lampião. Boa noite.',
          'P Mas por que você acabou de acender de novo?',
          'L É o regulamento.',
          'P Não estou entendendo.',
          'L Não há nada a entender. Regulamento é regulamento. Bom dia.',
          'L Eu faço um trabalho terrível. Antigamente era razoável: apagava de manhã e acendia à noite. Tinha o resto do dia para descansar e o resto da noite para dormir…',
          'L Mas o planeta foi girando cada vez mais depressa, e o regulamento não mudou! Agora ele dá uma volta por minuto, e eu não tenho um segundo de sossego.',
          'L Ai… estou tão cansado… Será que você cuidaria do lampião enquanto eu tiro um cochilo? Acenda quando a noite chegar. Apague quando o dia nascer.',
        ], man, { voice: 0.8 });
        game.release();
        S.stage = 'work';
        S.auto = false;
        S.sleep = true;
        game.ui.setQuests('o regulamento', [{ id: 'lamp', text: 'acender ao anoitecer, apagar ao amanhecer', max: 4 }]);
        lampIt.on = true;
        return;
      }
      if (S.stage === 'woke') {
        await game.talk('o acendedor', [
          'L Aaah… que sono bom! O regulamento foi cumprido?',
          'P Foi, sim. Escute: seu planeta é tão pequeno que você dá a volta nele em três passos. Basta andar bem devagar para ficar sempre no sol.',
          'P Quando quiser descansar, é só andar… e o dia vai durar o quanto você quiser.',
          'L Isso não me adianta muito. O que eu mais gosto na vida é dormir.',
          'P Então não tem jeito.',
          'L Não tem jeito. Bom dia.',
        ], man, { voice: 0.8 });
        await game.narrate('Este aqui, pensou o principezinho, seria desprezado por todos os outros: pelo rei, pelo vaidoso, pelo bêbado, pelo homem de negócios.');
        await game.narrate('Mas é o único que não me parece ridículo. Talvez porque ele cuida de outra coisa, e não de si mesmo.');
        game.release();
        S.stage = 'leave';
        S.auto = true;
        game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
        S.fl = flock(game, planet, D.birds);
      }
    }

    async function wake() {
      lampIt.on = false;
      S.sleep = false;
      S.stage = 'woke';
      await game.wait(1);
      game.ui.setQuests('o regulamento', [{ id: 'fala', text: 'acordar o *acendedor*' }]);
      it.on = true; it.label = 'acordar o acendedor';
    }

    const axis = new THREE.Vector3(0.15, 1, 0.1).normalize();
    const sun0 = dirLL(10, 60);
    let zz = 0;
    return {
      _S: S,
      planet,
      sun: sun0,
      sky: { dayTop: '#7faed8', dayHor: '#f6e2bd', setA: '#f79a50', setB: '#e0708a', nightTop: '#0c1438', nightHor: '#283470', neb: '#6a4f9c', neb2: '#2f7a8f' },
      mood: { root: 67, scale: 'major', tempo: 84, density: 0.5, pad: 0.45, wind: 0.05 },
      spawn: D.spawn, face: D.man.clone().sub(D.spawn),
      countSunsets: true,
      camDist: 4.6,
      update(dt, t) {
        // o planeta gira depressa: o sol da voltas no ceu
        S.ang += (dt / DAY) * Math.PI * 2;
        game.sunDir.copy(sun0).applyAxisAngle(axis, S.ang);
        for (const u of upd) u(dt, t);
        if (S.fl) S.fl.update(dt, t);
        const e = lampE();
        if (S.auto) {
          // o acendedor segue o regulamento sozinho
          if (!lamp.on && e < -0.02) { lamp.on = true; man.arms[1].rotation.x = -1.6; }
          if (lamp.on && e > 0.02) { lamp.on = false; man.arms[1].rotation.x = -1.6; }
          man.arms[1].rotation.x += (-0.35 - man.arms[1].rotation.x) * dt * 2;
        }
        lampIt.label = lamp.on ? 'apagar o lampião' : 'acender o lampião';
        // dormindo: tomba a cabeca e solta zzz
        man.head.rotation.z += ((S.sleep ? 0.5 : 0) - man.head.rotation.z) * dt * 3;
        if (S.sleep) { zz += dt; if (zz > 2.5) { zz = 0; if (!game.ui.busy) game.audio.noise(0.9, 180, 2, 0.02, 'bandpass', 0.8); } }
      },
      target() {
        if (S.stage === 'meet' || S.stage === 'woke') return wpos(man.group);
        if (S.stage === 'work') {
          const e = lampE();
          const need = (!lamp.on && e < 0.15) || (lamp.on && e > -0.15);
          return need ? wpos(lamp.g) : null;
        }
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      onSunset(n) { if (n % 5 === 0) game.ui.toast(`${n} pores do sol…`, 1500); },
      start() { game.ui.setQuests('asteroide 329', [{ id: 'a', text: 'conhecer o *acendedor de lampiões*' }]); },
    };
  },
};
