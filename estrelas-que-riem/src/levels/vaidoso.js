import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { vain } from '../actors/people.js';
import { M, paint } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, placeNPC, wpos } from './common.js';

// espelho oval num pe dourado
function mirror() {
  const g = new THREE.Group();
  const frame = M(new THREE.TorusGeometry(0.3, 0.04, 6, 24).scale(0.75, 1, 1), '#d9a93c', { inkW: 0.7, emissive: '#2a1800' });
  frame.position.y = 0.95; g.add(frame);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24).scale(0.75, 1, 1), paint('#bcd6ea', { rim: 1.5, side: THREE.DoubleSide, grain: 0.4 }));
  glass.position.y = 0.95; g.add(glass);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  hl.position.set(-0.08, 1.0, 0.01); hl.rotation.z = 0.5; g.add(hl);
  const leg = M(new THREE.CylinderGeometry(0.025, 0.04, 0.66, 6).translate(0, 0.33, 0), '#d9a93c', { inkW: 0.5 });
  g.add(leg);
  g.add(M(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 10), '#d9a93c', { inkW: 0.5 }));
  return g;
}

export default {
  id: 'vaidoso',
  name: 'O Vaidoso',
  kicker: 'asteroide 326',
  subtitle: 'para os vaidosos, os outros são admiradores',
  color: '#e39fb0',
  previewR: 3.6,
  build(game) {
    const D = { man: dirLL(15, 10), spawn: dirLL(-10, -40), birds: dirLL(-20, 70) };
    const planet = new Planet({ radius: 3.8, seed: 326, bump: 0.05, gravity: 11, palette: { a: '#e7a6b4', b: '#9fcdbf', c: '#f6e2c4' } });
    const r = rng(326);
    const upd = [];

    // palquinho
    const stage = M(new THREE.CylinderGeometry(0.75, 0.85, 0.18, 24).translate(0, 0.09, 0), '#b8343f', { inkW: 0.9 });
    planet.place(stage, D.man);
    const V = vain();
    V.group.position.y = 0.18;
    stage.add(V.group);
    faceDir(stage, D.man, D.spawn);
    planet.collider(D.man, 0.8);
    upd.push((dt, t) => V.update(dt, t));

    const mirrors = scatter(r, 6, [D.man, D.spawn], 0.6, (d) => d.angleTo(D.man) < 1.6);
    for (const d of mirrors) {
      const m = mirror();
      planet.place(m, d);
      faceDir(m, d, D.man);
      planet.collider(d, 0.25);
    }
    for (const d of scatter(r, 40, [D.man, ...mirrors], 0.12)) {
      const f = M(new THREE.SphereGeometry(0.05, 6, 4), r() < 0.5 ? '#f3c34a' : '#fff4e0', { inkW: 0.4, cast: false });
      planet.place(f, d, { lift: 0.04 });
    }

    const S = { stage: 'meet', fl: null, claps: 0, rhythm: null };
    const vpos = () => wpos(V.head);
    const it = planet.interact({ obj: stage, r: 2.1, label: 'visitar o vaidoso', labelH: 2.2, use: () => talk() });

    async function talk() {
      it.on = false;
      game.faceTo(wpos(stage));
      game.talkShot(vpos(), 1, 3.3);
      if (S.stage === 'meet') {
        await game.talk('o vaidoso', [
          'V Ah! Ah! Vem aí a visita de um admirador!',
          'P Bom dia. Que chapéu engraçado o seu.',
          'V É para cumprimentar quando me aclamam. Infelizmente, nunca passa ninguém por aqui.',
          'P É mesmo?',
          'V Bata palmas, uma mão contra a outra.',
        ], V, { voice: 1.0 });
        game.release();
        S.stage = 'clap';
        game.ui.setQuests('aplausos', [{ id: 'clap', text: 'bater palmas no ritmo', max: 8 }]);
        startRhythm();
      }
    }

    function startRhythm() {
      game.player.frozen = true;
      game.talkShot(vpos(), -1, 4);
      const el = document.getElementById('rhythm');
      el.classList.add('on');
      game.ui.toast(game.input.touch ? 'toque ✦ quando os círculos se encontrarem' : 'aperte E quando os círculos se encontrarem', 3500);
      S.rhythm = { t: -1.2, period: 0.8, el, beat: el.querySelector('.beat'), hit: el.querySelector('.hit'), used: -1 };
    }

    function rhythmUpdate(dt) {
      const R = S.rhythm;
      R.t += dt;
      if (R.t < 0) { R.beat.style.transform = 'scale(2.4)'; R.beat.style.opacity = 0; return; }
      const n = Math.floor(R.t / R.period);
      const ph = (R.t % R.period) / R.period;               // 0..1, bate em 1
      const k = 1 - ph;
      R.beat.style.transform = `scale(${1 + k * 1.4})`;
      R.beat.style.opacity = 0.3 + ph * 0.7;
      if (game.input.pressed('act') || game.input.pressed('jump')) {
        const off = Math.min(ph, 1 - ph) * R.period;          // distancia ate a batida (s)
        const which = ph > 0.5 ? n + 1 : n;
        if (off < 0.16 && which !== R.used) {
          R.used = which;
          S.claps++;
          game.audio.clap();
          game.audio.chime(S.claps, 0.05);
          V.tip = 1;
          R.hit.classList.add('good'); setTimeout(() => R.hit.classList.remove('good'), 150);
          game.ui.quest('clap', { n: S.claps });
          if (S.claps >= 8) endRhythm();
        } else {
          game.audio.noise(0.06, 900, 0.8, 0.08);
          R.hit.classList.add('bad'); setTimeout(() => R.hit.classList.remove('bad'), 150);
        }
      }
      // metronomo suave
      if (Math.floor((R.t - dt) / R.period) !== n) game.audio.chime(0, 0.025);
    }

    async function endRhythm() {
      S.rhythm.el.classList.remove('on');
      S.rhythm = null;
      S.stage = 'talk2';
      await game.wait(0.8);
      game.talkShot(vpos(), 1, 3.3);
      await game.talk('o vaidoso', [
        'P Isto é mais divertido do que a visita ao rei.',
        'V Você me admira muito, não admira?',
      ], V, { voice: 1.0 });
      const c = await game.ui.choose('o principezinho', '', ['O que quer dizer *admirar*?', 'Admiro, sim! (sem saber bem por quê)']);
      if (c === 1) await game.ui.say('o vaidoso', 'Ah! Eu sabia! Mas diga: você sabe o que quer dizer admirar?', { voice: 1.0 });
      V.talking = true;
      await game.talk('o vaidoso', [
        'V Admirar quer dizer reconhecer que eu sou o homem mais bonito, mais bem vestido, mais rico e mais inteligente do planeta.',
        'P Mas você está sozinho no seu planeta!',
        'V Me dê esse prazer. Me admire mesmo assim!',
        'P Eu te admiro… Mas por que isso te interessa tanto?',
      ], V, { voice: 1.0 });
      await game.narrate('Os vaidosos só escutam os elogios. As pessoas grandes são mesmo muito estranhas.');
      game.release();
      game.player.frozen = false;
      S.stage = 'leave';
      game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
      S.fl = flock(game, planet, D.birds);
    }

    return {
      _S: S,
      planet,
      sun: dirLL(40, -60),
      sky: { dayTop: '#8fc0d6', dayHor: '#fae1d6', setA: '#f5a070', setB: '#e0739a', nightTop: '#161a44', nightHor: '#44307a', neb: '#a04f8c', neb2: '#2f8a8a' },
      mood: { root: 65, scale: 'major', tempo: 92, density: 0.6, pad: 0.4, wind: 0.05 },
      spawn: D.spawn, face: D.man.clone().sub(D.spawn),
      countSunsets: true,
      update(dt, t) {
        for (const u of upd) u(dt, t);
        if (S.fl) S.fl.update(dt, t);
        if (S.rhythm) rhythmUpdate(dt);
      },
      target() {
        if (S.stage === 'meet') return wpos(stage);
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      dispose() { document.getElementById('rhythm').classList.remove('on'); },
      start() { game.ui.setQuests('asteroide 326', [{ id: 'v', text: 'conhecer o morador deste planeta' }]); },
    };
  },
};
