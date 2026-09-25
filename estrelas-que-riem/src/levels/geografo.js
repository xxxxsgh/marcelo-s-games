import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { geographer } from '../actors/people.js';
import { desk, book, paperStack, cloud } from '../actors/props.js';
import { M, paint } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, flock, placeNPC, wpos } from './common.js';

const R0 = 8;
const WATER = R0 - 0.25;
const C = {
  sand: new THREE.Color('#e2cc98'), wet: new THREE.Color('#b9a57e'), grass: new THREE.Color('#8fb06a'), grass2: new THREE.Color('#6f9a5a'),
  rock: new THREE.Color('#9b8b80'), snow: new THREE.Color('#f6f2ea'), hat: new THREE.Color('#b59b6a'),
};

// base tangente em volta de uma direcao
function frame(c) {
  const t1 = new THREE.Vector3(0, 1, 0).cross(c).normalize();
  if (t1.lengthSq() < 0.1) t1.set(1, 0, 0);
  const t2 = c.clone().cross(t1).normalize();
  return { c, t1, t2 };
}
const gauss = (x, s) => Math.exp(-(x * x) / (s * s));

export default {
  id: 'geografo',
  name: 'O Geógrafo',
  kicker: 'asteroide 330',
  subtitle: 'um planeta dez vezes maior, e um livro enorme',
  color: '#8fb06a',
  previewR: 7,
  build(game) {
    const D = {
      desk: dirLL(8, 0), spawn: dirLL(-2, -18),
      peak: dirLL(38, 70), sea: dirLL(-35, -70), hat: dirLL(-12, 150), birds: dirLL(-8, 22),
    };
    const F = { peak: frame(D.peak), sea: frame(D.sea), hat: frame(D.hat) };
    const shape = (d) => {
      let h = 0;
      // montanha alta, com cristas
      const ap = d.angleTo(D.peak);
      h += gauss(ap, 0.42) * 3.2 + gauss(ap, 0.9) * 0.9;
      // cordilheira
      h += Math.max(0, Math.sin(d.x * 5 + d.y * 3) * Math.cos(d.z * 4)) * 0.6 * gauss(d.angleTo(dirLL(20, 110)), 0.7);
      // mar
      const as = d.angleTo(D.sea);
      h -= gauss(as, 0.75) * 1.5;
      // o morro em forma de chapeu (ou jiboia que engoliu um elefante)
      const x = d.dot(F.hat.t1), y = d.dot(F.hat.t2);
      if (d.dot(D.hat) > 0.8) h += (gauss(x + 0.04, 0.12) * 1.1 + gauss(x - 0.12, 0.1) * 0.55 + gauss(x, 0.28) * 0.35) * gauss(y, 0.13);
      return h;
    };
    const planet = new Planet({
      radius: R0, seed: 330, bump: 0.03, gravity: 12, detail: 72, water: WATER, shape,
      color: (d, h, pl, c) => {
        const n = pl.nz.fbm(d.x * 6, d.y * 6, d.z * 6, 3);
        if (h < WATER + 0.12) c.copy(C.wet).lerp(C.sand, THREE.MathUtils.smoothstep(h, WATER - 0.4, WATER + 0.1));
        else if (h < WATER + 0.3) c.copy(C.sand);
        else c.copy(C.grass).lerp(C.grass2, THREE.MathUtils.smoothstep(n, -0.1, 0.25));
        if (h > R0 + 1.2 + n * 0.5) c.copy(C.rock);
        if (h > R0 + 2.6 + n * 0.4) c.copy(C.snow);
        if (d.dot(D.hat) > 0.95 && h > R0 + 0.3) c.lerp(C.hat, 0.5);
      },
    });
    const r = rng(330);
    const upd = [];
    const extras = [];

    // agua
    const water = new THREE.Mesh(new THREE.IcosahedronGeometry(WATER, 20), paint('#5f94c4', { transparent: true, opacity: 0.82, rim: 1.2, soft: 0.3, grainScale: 1.2 }));
    water.material.depthWrite = false;
    water.renderOrder = 1;
    planet.group.add(water);
    upd.push((dt, t) => { water.scale.setScalar(1 + Math.sin(t * 0.8) * 0.002); });

    // escrivaninha e o geografo
    const tbl = desk(1.4, 0.8, '#6d4a33');
    placeNPC(planet, tbl, D.desk, D.spawn, 0.9);
    const G = geographer();
    G.group.position.set(0, 0, -0.55);
    tbl.add(G.group);
    upd.push((dt, t) => G.update(dt, t));
    const big = book('#7b3b36', 1.6);
    big.position.set(0, 0.72, 0.05); tbl.add(big);
    const st = paperStack(6); st.position.set(0.55, 0.66, 0); tbl.add(st);
    // globo terrestre na mesa
    const gl = M(new THREE.SphereGeometry(0.14, 14, 10), '#6f9fc8', { inkW: 0.6 });
    gl.position.set(-0.5, 0.86, 0); tbl.add(gl);
    const glStand = M(new THREE.CylinderGeometry(0.02, 0.06, 0.12, 6), '#d9a93c', { inkW: 0.4 });
    glStand.position.set(-0.5, 0.7, 0); tbl.add(glStand);

    // arvores redondinhas e pedras
    for (const d of scatter(r, 60, [D.desk, D.spawn, D.hat], 0.12, (d) => {
      const h = planet.heightAt(d); return h > WATER + 0.35 && h < R0 + 1.1;
    })) {
      const t = new THREE.Group();
      t.add(M(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 6).translate(0, 0.25, 0), '#8a6a4a', { inkW: 0.5 }));
      const crown = M(new THREE.IcosahedronGeometry(0.3 + r() * 0.15, 1), r() < 0.5 ? '#6f9a52' : '#7fae5a', { inkW: 0.8 });
      crown.position.y = 0.65; t.add(crown);
      t.scale.setScalar(0.8 + r() * 0.6);
      planet.place(t, d);
      planet.collider(d, 0.2);
    }
    // nuvens de aquarela flutuando
    for (let i = 0; i < 6; i++) {
      const cl = cloud(i % 2 ? '#f6eef2' : '#eef2f6', 1.4 + r() * 0.8);
      const d = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      cl.position.copy(d).multiplyScalar(R0 + 10 + r() * 3);
      cl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      cl.userData.axis = new THREE.Vector3(r() - 0.5, 1, r() - 0.5).normalize();
      planet.group.add(cl);
      upd.push((dt) => cl.position.applyAxisAngle(cl.userData.axis, dt * 0.01));
    }

    const S = { stage: 'meet', fl: null, found: 0, marks: {} };
    const it = planet.interact({ obj: tbl, r: 2.2, label: 'falar com o geógrafo', labelH: 2.0, use: () => talk() });

    // tres lugares pra explorar
    const spots = {
      peak: { dir: D.peak, text: 'a montanha mais alta', say: 'lá de cima dá pra ver o planeta inteiro' },
      sea: { dir: shoreDir(), text: 'o mar', say: 'a água é fria e cheira a sal' },
      hat: { dir: D.hat, text: 'o morro em forma de chapéu', say: 'parece um chapéu… ou uma jiboia que engoliu um elefante?' },
    };
    function shoreDir() {
      // procura o ponto de praia do mar mais perto da escrivaninha
      let best = D.sea.clone();
      for (let k = 0; k <= 1; k += 0.02) {
        const d = D.sea.clone().lerp(D.desk, k).normalize();
        if (planet.heightAt(d) > WATER + 0.1) { best = d; break; }
      }
      return best;
    }
    for (const [key, sp] of Object.entries(spots)) {
      sp.it = planet.interact({
        pos: planet.surface(sp.dir), r: key === 'peak' ? 2.4 : 2.0, label: 'fincar uma bandeirinha', on: false,
        use: () => {
          sp.it.on = false;
          const f = new THREE.Group();
          f.add(M(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5).translate(0, 0.4, 0), '#6d4a33', { inkW: 0.4 }));
          const cloth = M(new THREE.PlaneGeometry(0.3, 0.2).translate(0.15, 0.68, 0), '#c9434f', { inkW: 0.4, side: THREE.DoubleSide });
          f.add(cloth);
          planet.place(f, planet.up(game.player.pos).addScaledVector(game.player.face, 0.05).normalize());
          upd.push((dt, t) => { cloth.rotation.y = Math.sin(t * 3) * 0.3; });
          S.found++;
          game.audio.success();
          game.ui.toast(sp.say, 3200);
          game.ui.quest(key, { done: true });
          if (S.found >= 3) {
            game.ui.setQuests('explorador', [{ id: 'volta', text: 'contar tudo ao *geógrafo*' }]);
            it.on = true;
          }
        },
      });
    }

    async function talk() {
      it.on = false;
      game.faceTo(wpos(tbl));
      game.talkShot(wpos(G.head), 1, 3.4);
      if (S.stage === 'meet') {
        await game.talk('o geógrafo', [
          'G Olhe! Um explorador!',
          'P Que livro grande! O que o senhor faz aqui?',
          'G Sou geógrafo. Um sábio que sabe onde ficam os mares, os rios, as cidades, as montanhas e os desertos.',
          'P Que interessante! Finalmente uma profissão de verdade! O seu planeta é muito bonito. Ele tem oceanos?',
          'G Não posso saber.',
          'P Ah! E montanhas?',
          'G Não posso saber.',
          'P Mas o senhor é geógrafo!',
          'G Exatamente. Mas não sou explorador. O geógrafo é importante demais para ficar passeando. Ele não sai da escrivaninha.',
          'G Mas você vem de longe! Você é um explorador! Vá, e me conte como é o meu planeta: a montanha mais alta, o mar, e aquele morro esquisito que dizem existir.',
        ], G, { voice: 0.75 });
        game.release();
        S.stage = 'explore';
        game.ui.setQuests('explorador', Object.entries(spots).map(([id, sp]) => ({ id, text: `encontrar *${sp.text}*` })));
        for (const sp of Object.values(spots)) sp.it.on = true;
        game.ui.toast('segure Shift para correr', 3000);
        return;
      }
      if (S.stage === 'explore') {
        await game.talk('o geógrafo', [
          'G Muito bem! Uma montanha, um mar, e um… chapéu? Anotarei primeiro a lápis. Só passo a tinta quando o explorador trouxer provas.',
          'G E o seu planeta? Como ele é?',
          'P Oh! Lá em casa não é muito interessante. É tudo muito pequeno. Eu tenho três vulcões: dois em atividade, e um extinto. Mas nunca se sabe.',
          'G Nunca se sabe. Anotado.',
          'P Tenho também uma flor.',
          'G Nós não anotamos as flores.',
          'P Por que não? É o que há de mais bonito!',
          'G Porque as flores são efêmeras.',
          'P O que quer dizer “efêmera”?',
          'G Quer dizer “ameaçada de desaparecer em breve”. As montanhas quase nunca mudam de lugar. Os mares quase nunca se esvaziam. Escrevemos coisas eternas.',
        ], G, { voice: 0.75 });
        await game.narrate('Minha flor é efêmera, pensou o principezinho, e só tem quatro espinhos para se defender do mundo. E eu a deixei sozinha lá em casa!');
        await game.talk('o geógrafo', [
          'P O senhor me aconselha a visitar o quê?',
          'G O planeta Terra. Ele tem boa reputação…',
        ], G, { voice: 0.75 });
        game.release();
        S.stage = 'leave';
        game.ui.setQuests('partida', [{ id: 'ir', text: 'segurar os fios dos *pássaros*' }]);
        S.fl = flock(game, planet, D.birds);
      }
    }

    return {
      _S: S,
      planet, extras,
      sun: dirLL(40, 20),
      sky: { dayTop: '#6fa6db', dayHor: '#f1e6cd', setA: '#f2955a', setB: '#d56f8e', nightTop: '#0c1436', nightHor: '#253373', neb: '#6a4f9c', neb2: '#2f7a8f' },
      mood: { root: 62, scale: 'lydian', tempo: 70, density: 0.45, pad: 0.6, wind: 0.2 },
      spawn: D.spawn, face: D.desk.clone().sub(D.spawn),
      countSunsets: true,
      walkSpeed: 3.6,
      camDist: 6,
      update(dt, t) { for (const u of upd) u(dt, t); if (S.fl) S.fl.update(dt, t); },
      target() {
        if (S.stage === 'meet') return wpos(tbl);
        if (S.stage === 'explore') {
          if (S.found >= 3) return wpos(tbl);
          const P = game.player.pos;
          let best = null;
          for (const sp of Object.values(spots)) if (sp.it.on) { const p = planet.surface(sp.dir); if (!best || p.distanceTo(P) < best.distanceTo(P)) best = p; }
          return best;
        }
        if (S.stage === 'leave' && S.fl) return S.fl.pos;
        return null;
      },
      start() { game.ui.setQuests('asteroide 330', [{ id: 'g', text: 'visitar o *velho senhor* com o livro enorme' }]); },
    };
  },
};
