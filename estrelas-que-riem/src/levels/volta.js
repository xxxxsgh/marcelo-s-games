import * as THREE from 'three';
import b612 from './b612.js';
import { rose, glassGlobe, sheepBox, volcano } from '../actors/props.js';
import { dirLL, faceDir, wpos } from './common.js';

// Epilogo: de volta ao B-612, de noite. A rosa na redoma, as estrelas rindo.
export default {
  id: 'volta',
  name: 'De volta',
  kicker: 'asteroide B-612',
  subtitle: 'olhe para o céu',
  color: '#c9a36b',
  previewR: 4,
  direct: true,
  build(game) {
    const base = b612.build(game);
    const planet = base.planet;
    // reaproveita o planeta de casa, mas sem as tarefas
    planet.interactables.length = 0; // (a cadeira tambem sai: o final e com a rosa)
    const roseDir = dirLL(42, -30);
    const box = sheepBox();
    planet.place(box, dirLL(34, -22));
    const S = { stage: 'go', laugh: 0 };
    const it = planet.interact({ pos: planet.surface(roseDir), r: 1.6, label: 'voltar para a rosa', labelH: 1.2, use: () => end() });

    async function end() {
      it.on = false;
      game.faceTo(planet.surface(roseDir));
      game.talkShot(planet.surface(roseDir, 0.6), 1, 2.6);
      await game.talk('a rosa', [
        'R …você voltou.',
        'P Voltei. Eu sou responsável por você.',
        'R Olha só o que você trouxe… uma caixa?',
        'P Tem um carneiro dentro. Não se preocupe: o aviador desenhou uma focinheira para ele.',
        'R …e esqueceu de desenhar a correia, não foi?',
        'P …',
      ], null, { voice: 1.2 });
      game.release();
      S.laugh = 1;
      game.audio.laugh(8, 0.06);
      // a camera se afasta: o planetinha entre as estrelas que riem
      const P = game.player;
      const up = P.up.clone();
      const side = P.face.clone().cross(up).normalize();
      for (let i = 0; i <= 240; i++) {
        const k = i / 240;
        const e = k * k * (3 - 2 * k);
        const pos = P.pos.clone().addScaledVector(up, 1.5 + e * 18).addScaledVector(side, 2 + e * 10).addScaledVector(P.face, -3 - e * 8);
        game.shot(pos, P.pos.clone().addScaledVector(up, 0.8 + e * 6));
        await game.wait(1 / 40);
      }
      game.ui.clearQuests();
      game.ui.credits(`<h2>Estrelas que Riem</h2>
        <p>Olhe para o céu. Pergunte: o carneiro comeu ou não comeu a flor?<br>E você vai ver como tudo muda…</p>
        <small>um jogo inspirado em <i>O Pequeno Príncipe</i>, de Antoine de Saint-Exupéry (1943)<br>
        tudo desenhado e tocado ao vivo pelo computador · ${game.save.sunsets || 0} pores do sol vistos · ${game.save.stars || 0} poeiras de estrela</small>`);
      game.save.done = true;
      game.save.current = 0;
      (await import('../save.js')).save(game.save);
      await game.wait(14);
      game.ui.credits(`<p>obrigado por viajar</p><small>toque ou aperte E para voltar ao começo</small>`);
      await game.until(() => game.input.pressed('act') || game.input.pressed('jump'));
      location.reload();
    }

    return {
      ...base,
      sun: dirLL(-60, 150),
      mood: { root: 62, scale: 'major', tempo: 60, density: 0.35, pad: 0.8, wind: 0.05 },
      spawn: dirLL(10, 20),
      face: roseDir.clone().sub(dirLL(10, 20)),
      countSunsets: false,
      update(dt, t) {
        base.update(dt, t);
        game.sky.uniforms.uLaugh.value += (S.laugh - game.sky.uniforms.uLaugh.value) * dt * 0.8;
      },
      target() { return it.on ? planet.surface(roseDir) : null; },
      dispose() { game.sky.uniforms.uLaugh.value = 0; },
      async start() {
        // a redoma ja esta sobre a rosa
        const g = planet.group.children.find((o) => o.userData.dir && o.userData.dir.angleTo(dirLL(8, -62)) < 0.01);
        if (g) { planet.place(g, roseDir); g.scale.setScalar(1.35); }
        await game.narrate('Já se passaram seis anos… Às vezes eu me pergunto: o que estará acontecendo lá no planeta dele?');
        game.ui.setQuests('em casa', [{ id: 'r', text: 'voltar para a *rosa*' }]);
      },
    };
  },
};
