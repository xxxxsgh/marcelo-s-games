import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { tippler } from '../actors/people.js';
import { bottle, desk } from '../actors/props.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, placeNPC, wpos } from './common.js';

export default {
  id: 'bebado',
  name: 'O Bêbado',
  kicker: 'asteroide 327',
  subtitle: 'uma visita muito curta, e muito triste',
  color: '#4f7f7a',
  previewR: 3.2,
  build(game) {
    const D = { man: dirLL(10, 0), spawn: dirLL(-5, -45), birds: dirLL(-25, 55) };
    const planet = new Planet({ radius: 3.3, seed: 327, bump: 0.05, gravity: 11, palette: { a: '#577f86', b: '#6a8a6a', c: '#8aa0a8' } });
    const r = rng(327);
    const upd = [];

    const table = desk(0.8, 0.5, '#6d4a3a');
    planet.place(table, D.man);
    faceDir(table, D.man, D.spawn);
    planet.collider(D.man, 0.7);
    const T = tippler();
    T.group.position.set(0, 0, -0.45);
    table.add(T.group);
    upd.push((dt, t) => T.update(dt, t));
    const cols = ['#3f7a5a', '#6a3f5a', '#3f5a7a', '#7a6a3f'];
    for (let i = 0; i < 5; i++) {
      const b = bottle(cols[i % 4], i % 2 === 0);
      b.position.set(-0.3 + i * 0.15, 0.65, 0.05 * (i % 2));
      b.scale.setScalar(0.8);
      table.add(b);
    }
    // fileiras de garrafas pelo chao: cheias de um lado, vazias do outro
    for (const d of scatter(r, 26, [D.man, D.spawn], 0.22)) {
      const full = d.x > 0;
      const b = bottle(cols[Math.floor(r() * 4)], full);
      planet.place(b, d, { yaw: r() * 6 });
      if (!full && r() < 0.5) { b.rotation.x = Math.PI / 2; b.position.addScaledVector(d, 0.06); }
    }

    const S = { stage: 'meet', fl: null, asked: new Set() };
    const it = planet.interact({ obj: table, r: 1.9, label: 'falar com o bêbado', labelH: 1.8, use: () => talk() });

    async function talk() {
      it.on = false;
      game.faceTo(wpos(table));
      game.talkShot(wpos(T.head), 1, 3);
      await game.ui.say('o bêbado', '…', { voice: 0.6 });
      // o jogador escolhe as perguntas, mas a conversa sempre dá voltas
      const Q = [
        ['O que você está fazendo aí?', 'Estou bebendo.'],
        ['Por que você bebe?', 'Para esquecer.'],
        ['Esquecer o quê?', 'Esquecer que tenho vergonha.'],
        ['Vergonha de quê?', 'Vergonha de beber!'],
      ];
      for (let i = 0; i < Q.length; i++) {
        await game.ui.choose('o principezinho', '', [Q[i][0]]);
        T.talking = true;
        await game.ui.say('o bêbado', Q[i][1], { voice: 0.6 });
        T.talking = false;
      }
      await game.narrate('E o bêbado se fechou num silêncio definitivo. O principezinho foi embora, perplexo.');
      await game.narrate('As pessoas grandes são mesmo muito, muito estranhas.');
      game.release();
      S.stage = 'leave';
      game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
      S.fl = flock(game, planet, D.birds);
    }

    return {
      _S: S,
      planet,
      sun: dirLL(-8, -80),
      sky: { dayTop: '#6f8fb0', dayHor: '#d9cfc0', setA: '#d98f6a', setB: '#a0658a', nightTop: '#0a1230', nightHor: '#223a5c', neb: '#4f6aa0', neb2: '#2f6a6a' },
      mood: { root: 57, scale: 'minor', tempo: 54, density: 0.35, pad: 0.8, wind: 0.2 },
      spawn: D.spawn, face: D.man.clone().sub(D.spawn),
      countSunsets: true,
      update(dt, t) { for (const u of upd) u(dt, t); if (S.fl) S.fl.update(dt, t); },
      target() {
        if (S.stage === 'meet') return wpos(table);
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      start() { game.ui.setQuests('asteroide 327', [{ id: 'b', text: 'visitar o morador deste planeta' }]); },
    };
  },
};
