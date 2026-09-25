import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { king } from '../actors/people.js';
import { M, paint } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, placeNPC, wpos } from './common.js';

const PURPLE = new THREE.Color('#6f3f86'), PURPLE2 = new THREE.Color('#9767ad'), WHITE = new THREE.Color('#f3efe6'), BLACK = new THREE.Color('#231d2a');

export default {
  id: 'rei',
  name: 'O Rei',
  kicker: 'asteroide 325',
  subtitle: 'um rei que reinava sobre tudo',
  color: '#7a4a8e',
  previewR: 4,
  build(game) {
    const D = { throne: dirLL(20, 0), spawn: dirLL(-8, -48), rat: dirLL(-40, 170), birds: dirLL(-10, 60) };
    const planet = new Planet({
      radius: 4.3, seed: 25, bump: 0.035, gravity: 11,
      color: (d, h, pl, c) => {
        const n = pl.nz.fbm(d.x * 3, d.y * 3, d.z * 3, 3);
        const fold = Math.sin((d.x + d.z) * 9 + n * 6) * 0.5 + 0.5; // dobras do manto
        c.copy(PURPLE).lerp(PURPLE2, fold * 0.55 + n * 0.3);
        const ang = d.angleTo(D.throne);
        if (ang < 0.95 + n * 0.35) {
          c.copy(WHITE);
          const sp = pl.nz.noise(d.x * 26, d.y * 26, d.z * 26);
          if (sp > 0.42) c.copy(BLACK);
        }
      },
    });
    const r = rng(325);
    const upd = [];

    // trono
    const throne = new THREE.Group();
    const seat = M(new THREE.BoxGeometry(0.9, 0.45, 0.7), '#d9a93c', { inkW: 0.9, emissive: '#2a1800' });
    seat.position.y = 0.22; throne.add(seat);
    const back = M(new THREE.BoxGeometry(0.9, 1.3, 0.14), '#d9a93c', { inkW: 0.9, emissive: '#2a1800' });
    back.position.set(0, 0.95, -0.3); throne.add(back);
    const cush = M(new THREE.BoxGeometry(0.8, 0.1, 0.6), '#b8343f', { inkW: 0.5 });
    cush.position.y = 0.48; throne.add(cush);
    for (const x of [-0.42, 0.42]) {
      const ball = M(new THREE.SphereGeometry(0.08, 8, 6), '#d9a93c', { inkW: 0.4 });
      ball.position.set(x, 1.62, -0.3); throne.add(ball);
    }
    placeNPC(planet, throne, D.throne, D.spawn, 0.6);

    const K = king();
    K.group.position.set(0, 0.42, 0.06);
    K.group.userData.maxTurn = 0.7;
    K.group.scale.setScalar(0.85);
    throne.add(K.group);
    upd.push((dt, t) => K.update(dt, t));

    // rato
    const rat = new THREE.Group();
    rat.add(M(new THREE.SphereGeometry(0.1, 10, 8).scale(0.9, 0.8, 1.4).translate(0, 0.08, 0), '#8a8490', { inkW: 0.6 }));
    const rh = M(new THREE.ConeGeometry(0.06, 0.14, 8).rotateX(Math.PI / 2), '#8a8490', { inkW: 0.5 });
    rh.position.set(0, 0.09, 0.17); rat.add(rh);
    for (const s of [-1, 1]) {
      const e = M(new THREE.SphereGeometry(0.04, 6, 4).scale(1, 1, 0.3), '#d9a0a8', { inkW: 0.3 });
      e.position.set(s * 0.05, 0.16, 0.1); rat.add(e);
    }
    const tail = M(new THREE.TorusGeometry(0.12, 0.01, 4, 12, Math.PI), '#b89aa0', { ink: false });
    tail.position.set(0, 0.05, -0.2); tail.rotation.y = Math.PI / 2; rat.add(tail);
    planet.place(rat, D.rat);
    faceDir(rat, D.rat, D.throne);
    upd.push((dt, t) => { rat.children[0].scale.y = 1 + Math.sin(t * 7) * 0.05; });

    // decoracao: coroas de flor-de-lis? pequenas almofadas e estrelas douradas bordadas
    for (const d of scatter(r, 18, [D.throne, D.rat, D.spawn], 0.35)) {
      const s = M(new THREE.OctahedronGeometry(0.07, 0), '#e7b93f', { inkW: 0.4, emissive: '#2a1800', cast: false });
      planet.place(s, d, { lift: 0.03 });
    }

    const S = { stage: 'meet', fl: null };
    const kpos = () => wpos(K.head);
    const it = planet.interact({ obj: throne, r: 2.0, label: 'aproximar-se do rei', labelH: 2.1, use: () => talk() });
    const ratIt = planet.interact({ obj: rat, r: 1.2, label: 'julgar o velho rato', on: false, use: () => judgeRat() });

    async function talk() {
      it.on = false;
      game.faceTo(wpos(throne));
      game.talkShot(kpos(), 1, 3.4);
      if (S.stage === 'meet') {
        await game.talk('o rei', [
          'K Ah! Eis um súdito!',
        ], K, { voice: 0.7 });
        await game.narrate('Como ele pode me reconhecer, se nunca me viu? — pensou o principezinho. Ele não sabia que, para os reis, o mundo é muito simples: todos os homens são súditos.');
        await game.talk('o rei', [
          'K Aproxime-se, para que eu o veja melhor.',
          'P (aaaah…)',
          'K É contra a etiqueta bocejar na presença de um rei. Eu o proíbo.',
          'P Não consigo evitar… fiz uma viagem comprida e não dormi nada.',
          'K Então eu lhe ordeno que boceje. Há anos não vejo ninguém bocejar. Os bocejos são uma curiosidade para mim. Vamos! Boceje! É uma ordem.',
        ], K, { voice: 0.7 });
        game.release();
        S.stage = 'yawn';
        game.ui.setQuests('ordens do rei', [{ id: 'bocejo', text: 'bocejar, por ordem real' }]);
        it.label = 'bocejar'; it.on = true;
        return;
      }
      if (S.stage === 'yawn') {
        game.release();
        game.player.model.head.rotation.x = -0.6;
        game.audio.noise(1.2, 300, 0.8, 0.05, 'bandpass', 0.6);
        game.ui.toast('aaaaaaah…', 1800);
        game.ui.quest('bocejo', { done: true });
        await game.wait(1.4);
        game.talkShot(kpos(), 1, 3.4);
        await game.talk('o rei', [
          'K Excelente! Muito bem obedecido.',
          'P Majestade… sobre o que o senhor reina?',
          'K Sobre tudo.',
          'P Sobre tudo? E as estrelas obedecem?',
          'K Mas é claro! Obedecem na mesma hora. Eu não tolero indisciplina.',
          'P Eu gostaria tanto de ver um pôr do sol… Me dê esse prazer. Ordene ao sol que se ponha!',
          'K Se eu ordenasse a um general que voasse de flor em flor feito borboleta, e ele não obedecesse, de quem seria a culpa? Dele ou minha?',
          'P Sua.',
          'K Exato. É preciso exigir de cada um o que cada um pode dar. A autoridade se apoia na razão.',
          'K Você terá o seu pôr do sol. Eu o exigirei. Mas vou esperar que as condições sejam favoráveis… Hum! Hum! Será esta tarde… quando você caminhar até a beira da noite!',
        ], K, { voice: 0.7 });
        game.release();
        S.stage = 'sunset';
        game.ui.setQuests('ordens do rei', [{ id: 'sol', text: 'caminhar até a *beira da noite* para ver o sol se pôr' }]);
        return;
      }
      if (S.stage === 'afterSunset') {
        await game.talk('o rei', [
          'K Viu? Eu mandei, e ele obedeceu. Eu sou um rei muito razoável.',
          'K Agora escute: em algum lugar do meu planeta vive um velho rato. Eu o ouço à noite.',
          'K Você poderá julgá-lo. De vez em quando, você o condenará à morte… e depois o perdoará. Precisamos economizá-lo: é o único que temos.',
        ], K, { voice: 0.7 });
        game.release();
        S.stage = 'rat';
        game.ui.setQuests('ordens do rei', [{ id: 'rato', text: 'encontrar o *velho rato*, do lado da noite' }]);
        ratIt.on = true;
        return;
      }
      if (S.stage === 'judged') {
        await game.talk('o rei', [
          'P Já não tenho mais nada a fazer aqui. Vou partir.',
          'K Não parta! Eu o faço ministro! Ministro da… da Justiça!',
          'P Mas não há ninguém para julgar!',
          'K Então você julgará a si mesmo. É o mais difícil. Se conseguir se julgar bem, é porque você é um verdadeiro sábio.',
          'P Se Vossa Majestade quer ser obedecido na hora, poderia me dar uma ordem razoável. Poderia me ordenar, por exemplo, que eu partisse antes de um minuto…',
          'K …',
          'K Eu o faço meu embaixador!',
        ], K, { voice: 0.7 });
        await game.narrate('As pessoas grandes são muito estranhas, pensou o principezinho, durante a viagem.');
        game.release();
        S.stage = 'leave';
        game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
        S.fl = flock(game, planet, D.birds);
      }
    }

    async function judgeRat() {
      ratIt.on = false;
      game.faceTo(wpos(rat));
      game.talkShot(wpos(rat), -1, 2.2);
      const c = await game.ui.choose('o velho rato', 'O ratinho te olha, tremendo o bigode.', ['condená-lo à morte', 'perdoá-lo']);
      if (c === 0) {
        await game.ui.say('o velho rato', '…');
        await game.ui.choose('o principezinho', 'Hum. Não tenho vontade nenhuma de condenar ninguém…', ['então eu o perdoo']);
      }
      game.audio.success();
      game.ui.toast('o rato foi perdoado. é o único que eles têm!', 3000);
      game.ui.quest('rato', { done: true });
      game.release();
      S.stage = 'judged';
      game.ui.setQuests('ordens do rei', [{ id: 'volta', text: 'voltar ao *rei*' }]);
      it.label = 'falar com o rei'; it.on = true;
    }

    return {
      _S: S,
      planet,
      sun: dirLL(55, -20),
      sky: { dayTop: '#8e98d6', dayHor: '#f5dfc9', setA: '#f2a15f', setB: '#c86f9e', nightTop: '#140f38', nightHor: '#3b2c72', neb: '#8a4fa0', neb2: '#3a6f9a' },
      mood: { root: 60, scale: 'dorian', tempo: 66, density: 0.45, pad: 0.6, wind: 0.05 },
      spawn: D.spawn, face: D.throne.clone().sub(D.spawn),
      countSunsets: true,
      update(dt, t) {
        for (const u of upd) u(dt, t);
        if (S.fl) S.fl.update(dt, t);
        if (S.stage === 'sunset' && !game.ui.busy) {
          const e = game.sunElevation();
          if (e < 0.06 && e > -0.1) {
            S.stage = 'afterSunset';
            game.ui.quest('sol', { done: true });
            game.audio.laugh(1.5, 0.03);
            game.ui.toast('“Viu? Eu mandei!” — grita o rei, lá do trono', 3500);
            it.label = 'falar com o rei'; it.on = true;
            game.ui.setQuests('ordens do rei', [{ id: 'volta', text: 'voltar ao *rei*' }]);
          }
        }
      },
      target() {
        if (S.stage === 'sunset') {
          // aponta pra linha do por do sol, a partir do jogador
          const up = game.player.up;
          const s = game.sunDir.clone();
          const tang = s.clone().addScaledVector(up, -s.dot(up));
          if (tang.lengthSq() < 1e-4) return null;
          const d = game.player.pos.clone().normalize().addScaledVector(tang.normalize(), -Math.sign(game.sunElevation()) * 0.8).normalize();
          return planet.surface(d, 0.3);
        }
        if (S.stage === 'rat') return wpos(rat);
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        if (it.on) return wpos(throne);
        return null;
      },
      start() {
        game.ui.setQuests('asteroide 325', [{ id: 'rei', text: 'visitar o *rei* no seu trono' }]);
      },
    };
  },
};
