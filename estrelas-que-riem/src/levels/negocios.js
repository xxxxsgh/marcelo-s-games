import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { businessman } from '../actors/people.js';
import { desk, paperStack, fallenStar, book } from '../actors/props.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, wpos } from './common.js';

export default {
  id: 'negocios',
  name: 'O Homem de Negócios',
  kicker: 'asteroide 328',
  subtitle: 'um homem muito sério, muito ocupado',
  color: '#a8a090',
  previewR: 4.2,
  build(game) {
    const D = { man: dirLL(12, 0), spawn: dirLL(-6, -42), birds: dirLL(-30, 60) };
    const planet = new Planet({ radius: 4.6, seed: 328, bump: 0.04, gravity: 11, palette: { a: '#b3ab98', b: '#9c9a8c', c: '#d6ccb4' } });
    const r = rng(328);
    const upd = [];

    const table = desk(1.2, 0.6, '#5a4a3e');
    planet.place(table, D.man);
    faceDir(table, D.man, D.spawn);
    planet.collider(D.man, 0.8);
    const B = businessman();
    B.group.position.set(0, 0, -0.5);
    table.add(B.group);
    upd.push((dt, t) => B.update(dt, t));
    for (let i = 0; i < 4; i++) {
      const p = paperStack(4 + i * 2);
      p.position.set(-0.4 + i * 0.26, 0.66, 0.05);
      table.add(p);
    }
    const bk = book('#2f3f5a'); bk.position.set(0.35, 0.7, -0.1); bk.scale.setScalar(0.6); table.add(bk);
    // pilhas de papel espalhadas
    for (const d of scatter(r, 14, [D.man, D.spawn], 0.4)) {
      const p = paperStack(3 + Math.floor(r() * 8));
      planet.place(p, d, { yaw: r() * 6 });
    }

    const S = { stage: 'meet', fl: null, got: 0, stars: [], rising: [] };
    const it = planet.interact({ obj: table, r: 2.0, label: 'falar com o homem de negócios', labelH: 1.9, use: () => talk() });

    function spawnStars() {
      const dirs = scatter(r, 7, [D.man], 0.5, (d) => d.angleTo(D.man) > 0.5);
      dirs.forEach((d, i) => {
        const s = fallenStar();
        planet.place(s.g, d);
        upd.push(s.update);
        // caem do ceu
        s.g.userData.fall = 12 + i * 3;
        s.d = d;
        const sit = planet.interact({
          obj: s.g, r: 1.2, label: 'pegar a estrela', labelH: 0.9,
          use: () => {
            sit.on = false; s.got = true; S.got++;
            game.audio.sparkle();
            game.ui.quest('est', { n: S.got });
            if (S.got >= 7) { game.ui.setQuests('as estrelas', [{ id: 'volta', text: 'levar as estrelas ao *homem de negócios*' }]); it.label = 'entregar as estrelas'; it.on = true; }
          },
        });
        s.it = sit;
        S.stars.push(s);
      });
    }

    async function talk() {
      it.on = false;
      game.faceTo(wpos(table));
      game.talkShot(wpos(B.head), 1, 3.2);
      if (S.stage === 'meet') {
        await game.talk('o homem de negócios', [
          'B Três e dois, cinco. Cinco e sete, doze. Doze e três, quinze. Bom dia. Quinze e sete, vinte e dois…',
          'P Bom dia. Seu cigarro apagou.',
          'B …vinte e dois e seis, vinte e oito. Não tenho tempo de acender. Ufa! Isso dá quinhentos e um milhões, seiscentos e vinte e dois mil, setecentos e trinta e um.',
          'P Quinhentos milhões de quê?',
          'B Hein? Você ainda está aí? Quinhentos milhões de… não sei mais… tenho tanto trabalho! Eu sou um homem sério, não me divirto com bobagens!',
          'P Quinhentos milhões de quê?',
          'B De coisinhas que a gente vê às vezes no céu. Pontinhos dourados que fazem os preguiçosos sonhar. Mas eu sou sério!',
          'P Ah! Estrelas?',
          'B Isso mesmo. Estrelas. E elas são minhas, porque eu fui o primeiro a pensar nisso.',
          'B E olhe só: esta noite algumas caíram por aí. Sete! Vá buscá-las antes que alguém as possua! Eu não tenho tempo de levantar.',
        ], B, { voice: 0.85 });
        game.release();
        S.stage = 'collect';
        game.ui.setQuests('as estrelas', [{ id: 'est', text: 'recolher as *estrelas caídas*', max: 7 }]);
        spawnStars();
        return;
      }
      if (S.stage === 'collect') {
        B.busy = false;
        await game.talk('o homem de negócios', [
          'B Ah, até que enfim! Sete! Me dê aqui. Vou escrever o número num papelzinho e trancar numa gaveta.',
          'P E é só isso?',
          'B É o suficiente!',
          'P Eu tenho uma flor, que eu rego todos os dias. Tenho três vulcões, que eu limpo toda semana. É útil para os meus vulcões, e é útil para a minha flor, que eu as tenha.',
          'P Mas você não é útil às estrelas…',
          'B …',
        ], B, { voice: 0.85 });
        const c = await game.ui.choose('o principezinho', 'As estrelas ainda brilham, quentinhas, nas suas mãos.', ['entregar ao homem de negócios', 'devolver as estrelas ao céu']);
        if (c === 1) {
          game.release();
          game.player.model.hold = 1;
          await game.wait(0.3);
          releaseStars();
          game.audio.laugh(3, 0.05);
          await game.wait(2.5);
          game.player.model.hold = 0;
          game.talkShot(wpos(B.head), 1, 3.2);
          await game.talk('o homem de negócios', ['B Ei! Minhas estrelas! Agora vou ter que contar tudo de novo…', 'B Três e dois, cinco…'], B, { voice: 0.85 });
        } else {
          await game.talk('o homem de negócios', ['B …seiscentos e vinte e dois mil, setecentos e trinta e oito. Pronto. Agora não me atrapalhe mais.'], B, { voice: 0.85 });
        }
        B.busy = true;
        await game.narrate('As pessoas grandes são mesmo extraordinárias, pensou o principezinho, simplesmente.');
        game.release();
        S.stage = 'leave';
        game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
        S.fl = flock(game, planet, D.birds);
      }
    }

    function releaseStars() {
      const hand = game.player.pos.clone().addScaledVector(game.player.up, 0.9);
      for (const s of S.stars) {
        s.g.removeFromParent();
        s.g.scale.setScalar(1);
        s.got = false;
        s.g.position.copy(hand).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
        s.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), game.player.up);
        planet.group.add(s.g);
        S.rising.push({ g: s.g, v: game.player.up.clone().multiplyScalar(1.5 + Math.random()).add(new THREE.Vector3().randomDirection().multiplyScalar(0.6)) });
      }
    }

    return {
      _S: S,
      planet,
      sun: dirLL(35, -35),
      sky: { dayTop: '#95a8c0', dayHor: '#ece2cf', setA: '#e8a060', setB: '#b87a8a', nightTop: '#0f1636', nightHor: '#2c3868', neb: '#6a5f9c', neb2: '#2f6f8f' },
      mood: { root: 63, scale: 'dorian', tempo: 104, density: 0.5, pad: 0.35, wind: 0.05 },
      spawn: D.spawn, face: D.man.clone().sub(D.spawn),
      countSunsets: true,
      update(dt, t) {
        for (const u of upd) u(dt, t);
        if (S.fl) S.fl.update(dt, t);
        for (const s of S.stars) {
          const f = s.g.userData.fall;
          if (f > 0 && !s.got) {
            s.g.userData.fall = Math.max(0, f - dt * 18);
            s.g.position.copy(planet.surface(s.d, s.g.userData.fall));
            if (s.g.userData.fall === 0) game.audio.chime(6, 0.03);
          }
        }
        for (const s of S.rising) { s.g.position.addScaledVector(s.v, dt); s.v.multiplyScalar(1 + dt * 0.8); }
      },
      target() {
        if (S.stage === 'meet') return wpos(table);
        if (S.stage === 'collect') {
          if (S.got >= 7) return wpos(table);
          const P = game.player.pos;
          let best = null;
          for (const s of S.stars) if (!s.got) { const p = wpos(s.g); if (!best || p.distanceTo(P) < best.distanceTo(P)) best = p; }
          return best;
        }
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      start() { game.ui.setQuests('asteroide 328', [{ id: 'n', text: 'visitar o morador deste planeta' }]); },
    };
  },
};
