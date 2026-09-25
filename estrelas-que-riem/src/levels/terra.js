import * as THREE from 'three';
import { Planet, scatter } from '../world/planet.js';
import { aviator, fox, snake } from '../actors/people.js';
import { desertFlower, plane, well, sheepBox, rose } from '../actors/props.js';
import { M, paint, mergeColored, inkInstanced, glow } from '../render/paint.js';
import { rng } from '../core/noise.js';
import { dirLL, faceDir, placeNPC, wpos } from './common.js';
import { surfaceQuat, tangent } from '../core/math.js';

const R0 = 24;
const gauss = (x, s) => Math.exp(-(x * x) / (s * s));
const C = {
  sand: new THREE.Color('#ecd09a'), sand2: new THREE.Color('#dcb479'), sand3: new THREE.Color('#f4e1b8'),
  rock: new THREE.Color('#a88a78'), rock2: new THREE.Color('#8f7a74'), grass: new THREE.Color('#9bb86a'), grass2: new THREE.Color('#7ea35a'),
};

// desenhos do aviador (traco feito a mao, em SVG)
const SHEEP = {
  body: 'M48,78 q-16,-18 2,-30 q6,-20 28,-12 q12,-16 32,-4 q22,-10 30,10 q20,6 10,26 q6,20 -18,22 q-12,14 -30,4 q-18,10 -32,-2 q-24,2 -22,-14 z',
  head: 'M150,50 q18,-8 26,8 q6,16 -10,20 q-16,2 -18,-12',
  ear: 'M152,54 q-10,-2 -12,8',
  legs: 'M70,96 v26 M88,99 v24 M118,99 v24 M136,96 v26',
};
const DRAW = [
  { svg: `<path d="${SHEEP.body}"/><path d="${SHEEP.head}"/><path d="${SHEEP.ear}"/><path d="${SHEEP.legs}"/><path d="M160,62 l6,4 M166,62 l-6,4"/><path d="M165,74 q-4,-3 -8,0"/>`, cap: 'um carneiro' },
  { svg: `<path d="${SHEEP.body}"/><path d="${SHEEP.head}"/><path d="${SHEEP.legs}"/><path d="M152,48 q-16,-24 4,-30 q18,-2 14,16 q-4,10 -12,4 q-6,-6 2,-10"/><circle class="f" cx="164" cy="60" r="2"/>`, cap: 'outro carneiro' },
  { svg: `<path d="${SHEEP.body}"/><path d="${SHEEP.head}"/><path d="${SHEEP.ear}"/><path d="M70,96 q4,14 -2,26 M88,99 q-4,12 2,24 M118,99 q5,12 -1,24 M136,96 q-4,14 3,26"/><path d="M160,76 q2,16 -4,26 M166,74 q4,14 2,22"/><path d="M158,60 h8"/>`, cap: 'mais um carneiro' },
  { svg: `<path d="M30,52 h120 v66 h-120 z"/><path d="M30,52 l26,-22 h120 l-26,22"/><path d="M150,118 l26,-22 v-66"/><circle class="f" cx="62" cy="84" r="4"/><circle class="f" cx="90" cy="84" r="4"/><circle class="f" cx="118" cy="84" r="4"/>`, cap: 'uma caixa' },
];

export default {
  id: 'terra',
  name: 'A Terra',
  kicker: 'o sétimo planeta',
  subtitle: 'não é um planeta qualquer',
  color: '#e6c48a',
  previewR: 12,
  build(game) {
    const D = {
      spawn: dirLL(0, 0), snake: dirLL(-4, 7), flower: dirLL(6, 24), peak: dirLL(16, 48),
      garden: dirLL(-6, 80), tree: dirLL(-14, 90), fox: dirLL(-16, 95),
      plane: dirLL(0, 122), well: dirLL(8, 146), wall: dirLL(13, 151),
    };
    const nz2 = new THREE.Vector3();
    const shape = (d, pl) => {
      // dunas: ondas compridas deformadas pelo ruido
      const n = pl.nz.noise(d.x * 4, d.y * 4, d.z * 4);
      let h = (Math.sin(d.x * 26 + d.z * 14 + n * 3) * 0.5 + 0.5) * 0.9 + (Math.sin(d.y * 31 - d.x * 12 + n * 4) * 0.5 + 0.5) * 0.4;
      // montanha alta e pontuda
      const ap = d.angleTo(D.peak);
      const ridge = Math.abs(pl.nz.noise(d.x * 14, d.y * 14, d.z * 14));
      h += gauss(ap, 0.1) * 8 + gauss(ap, 0.22) * 2.5 * (0.6 + ridge) + gauss(d.angleTo(dirLL(22, 56)), 0.07) * 4 + gauss(d.angleTo(dirLL(10, 40)), 0.06) * 3;
      // jardim e caminhos planos
      h *= 1 - gauss(d.angleTo(D.garden), 0.16) * 0.85;
      h *= 1 - gauss(d.angleTo(D.spawn), 0.08) * 0.8;
      h *= 1 - gauss(d.angleTo(D.plane), 0.1) * 0.7;
      h *= 1 - gauss(d.angleTo(D.well), 0.08) * 0.8;
      return h;
    };
    const planet = new Planet({
      radius: R0, seed: 7, bump: 0.004, gravity: 14, detail: 120, shape,
      color: (d, h, pl, c) => {
        const n = pl.nz.fbm(d.x * 9, d.y * 9, d.z * 9, 3);
        c.copy(C.sand).lerp(C.sand2, THREE.MathUtils.smoothstep(n, -0.05, 0.3)).lerp(C.sand3, THREE.MathUtils.smoothstep(h - R0, 0.7, 1.3) * 0.7);
        if (h > R0 + 2.2 + n) c.copy(C.rock).lerp(C.rock2, THREE.MathUtils.smoothstep(n, 0, 0.3));
        const ag = d.angleTo(D.garden);
        if (ag < 0.2 + n * 0.08) c.copy(C.grass).lerp(C.grass2, THREE.MathUtils.smoothstep(n, -0.1, 0.2));
      },
    });
    const r = rng(1943);
    const upd = [];

    // ------------------------------------------------ serpente na pedra
    const rock = M(new THREE.DodecahedronGeometry(0.7, 1).scale(1.3, 0.6, 1), '#b09a86', { inkW: 1 });
    planet.place(rock, D.snake, { sink: 0.2 });
    planet.collider(D.snake, 0.7);
    const Sn = snake();
    Sn.g.position.y = 0.28;
    rock.add(Sn.g);
    faceDir(rock, D.snake, D.spawn);
    upd.push(Sn.update);

    // ------------------------------------------------ flor de tres petalas
    const fl = desertFlower();
    fl.scale.setScalar(1.6);
    planet.place(fl, D.flower);

    // ------------------------------------------------ jardim de rosas (centenas, instanciadas)
    const petal = new THREE.SphereGeometry(0.075, 8, 6).scale(1, 1.1, 0.8);
    const parts = [
      [new THREE.CylinderGeometry(0.018, 0.025, 0.5, 5).translate(0, 0.25, 0), '#4f7b3a'],
      [new THREE.SphereGeometry(0.07, 8, 5).scale(1.8, 0.25, 0.8), '#5f9243', new THREE.Matrix4().makeTranslation(0.1, 0.22, 0)],
      [new THREE.SphereGeometry(0.07, 8, 5).scale(1.8, 0.25, 0.8), '#5f9243', new THREE.Matrix4().makeRotationY(Math.PI).setPosition(-0.1, 0.32, 0)],
      [petal, '#c93846', new THREE.Matrix4().makeTranslation(0, 0.54, 0)],
      [petal, '#d8434f', new THREE.Matrix4().makeTranslation(0.045, 0.52, 0.02)],
      [petal, '#b8303d', new THREE.Matrix4().makeTranslation(-0.04, 0.52, -0.02)],
      [petal, '#e0525c', new THREE.Matrix4().makeTranslation(0, 0.5, 0.05)],
    ];
    const roseGeo = mergeColored(parts);
    const gardenDirs = [];
    for (let i = 0; i < 900 && gardenDirs.length < 420; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.19;
      const t1 = new THREE.Vector3(0, 1, 0).cross(D.garden).normalize();
      const t2 = D.garden.clone().cross(t1);
      const d = D.garden.clone().addScaledVector(t1, Math.cos(a) * rr).addScaledVector(t2, Math.sin(a) * rr).normalize();
      if (d.angleTo(D.garden) < 0.035) continue; // clareira no meio
      gardenDirs.push(d);
    }
    const roses = new THREE.InstancedMesh(roseGeo, paint('#ffffff', { vertexColors: true, rim: 0.4 }), gardenDirs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    gardenDirs.forEach((d, i) => {
      const p = planet.surface(d, -0.02);
      surfaceQuat(d, r() * 6, q);
      sc.setScalar(1.1 + r() * 0.6);
      roses.setMatrixAt(i, m4.compose(p, q, sc));
    });
    roses.castShadow = true; roses.receiveShadow = true;
    inkInstanced(roses, 0.7);
    planet.group.add(roses);

    // macieira (a raposa aparece embaixo dela)
    const tree = new THREE.Group();
    tree.add(M(new THREE.CylinderGeometry(0.14, 0.24, 1.8, 7).translate(0, 0.9, 0), '#8a6446', { inkW: 1 }));
    for (let i = 0; i < 5; i++) {
      const c = M(new THREE.IcosahedronGeometry(0.75 + r() * 0.3, 1), i % 2 ? '#6f9a52' : '#7fae5a', { inkW: 1.1 });
      c.position.set(Math.cos(i * 1.3) * 0.6, 2.1 + Math.sin(i * 2) * 0.3, Math.sin(i * 1.3) * 0.6); tree.add(c);
      const ap = M(new THREE.SphereGeometry(0.09, 8, 6), '#d8434f', { inkW: 0.4 });
      ap.position.set(Math.cos(i * 1.3) * 0.9, 1.8, Math.sin(i * 1.3) * 0.9); tree.add(ap);
    }
    planet.place(tree, D.tree);
    planet.collider(D.tree, 0.4);

    // raposa
    const Fx = fox();
    Fx.g.scale.setScalar(1.3);
    const foxW = walker(planet, Fx.g, D.fox.clone());
    faceDir(Fx.g, D.fox, D.garden);
    upd.push((dt, t) => Fx.update(dt, t, foxW.speed));

    // ------------------------------------------------ o aviador e o aviao
    const pl = plane();
    pl.scale.setScalar(1.4);
    planet.place(pl, D.plane, { sink: 0.25 });
    faceDir(pl, D.plane, D.garden);
    pl.rotateX(0.12); pl.rotateZ(0.18);
    planet.collider(D.plane, 1.6);
    const Av = aviator();
    const avDir = dirLL(-3, 119);
    const avW = walker(planet, Av.group, avDir.clone());
    faceDir(Av.group, avDir, D.plane);
    upd.push((dt, t) => Av.update(dt, t));
    // caixa de ferramentas
    const tools = M(new THREE.BoxGeometry(0.4, 0.2, 0.25), '#9a3a30', { inkW: 0.6 });
    planet.place(tools, dirLL(-2, 117));

    // ------------------------------------------------ o poco e o muro
    const W = well();
    W.g.scale.setScalar(1.3);
    planet.place(W.g, D.well);
    planet.collider(D.well, 0.85);
    const wall = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const b = M(new THREE.BoxGeometry(0.5, 0.3, 0.35), i % 2 ? '#b59e84' : '#a8917a', { inkW: 0.6 });
      b.position.set((i - 3) * 0.48, 0.15 + (i % 3 === 0 ? 0.3 : 0), 0); wall.add(b);
      if (i % 3 === 0) { const b2 = b.clone(); b2.position.y = 0.15; wall.add(b2); }
    }
    planet.place(wall, D.wall);
    faceDir(wall, D.wall, D.well);
    planet.collider(D.wall, 1.4);

    // pedras e arbustos secos no deserto
    for (const d of scatter(r, 70, Object.values(D), 0.05, (d) => d.angleTo(D.garden) > 0.25)) {
      const k = r();
      if (k < 0.6) {
        const s = M(new THREE.DodecahedronGeometry(0.1 + r() * 0.25, 0), '#b8a28a', { inkW: 0.6, flat: true });
        planet.place(s, d, { yaw: r() * 6, sink: 0.08 });
      } else {
        const b = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const tw = M(new THREE.CylinderGeometry(0.01, 0.02, 0.35, 4).translate(0, 0.17, 0), '#8a7a5a', { inkW: 0.3, cast: false });
          tw.rotation.set((r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2); b.add(tw);
        }
        planet.place(b, d);
      }
    }

    // ------------------------------------------------ estado e roteiro
    const S = { stage: 'arrive', day: 0, sitting: false, spot: null, fl: null, lapse: 0, sunBase: dirLL(10, 40), laugh: 0 };
    const sunAxis = new THREE.Vector3(0, 1, 0);

    const snakeIt = planet.interact({ obj: rock, r: 2.2, label: 'falar com a serpente', labelH: 1.4, on: false, use: () => snakeTalk() });
    const flowerIt = planet.interact({ obj: fl, r: 1.5, label: 'falar com a flor', labelH: 1.0, on: false, use: () => flowerTalk() });
    const peakIt = planet.interact({ pos: planet.surface(D.peak), r: 2.6, label: 'gritar lá do alto', on: false, use: () => echo() });
    const gardenIt = planet.interact({ pos: planet.surface(D.garden), r: 3.2, label: 'olhar as rosas', on: false, use: () => garden() });
    const foxIt = planet.interact({ obj: Fx.g, r: 2.2, label: 'falar com a raposa', labelH: 1.0, on: false, use: () => foxTalk() });
    const avIt = planet.interact({ obj: Av.group, r: 2.3, label: 'falar com o aviador', labelH: 2.0, on: false, use: () => aviatorTalk() });
    const wellIt = planet.interact({ obj: W.g, r: 2.0, label: 'puxar o balde', labelH: 2.2, hold: 1.4, on: false, use: () => drink() });

    // marca de onde sentar (anel de luz no chao)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.8, depthWrite: false }));
    ring.visible = false;
    planet.group.add(ring);
    const sitIt = planet.interact({ pos: new THREE.Vector3(), r: 0.8, label: 'sentar na grama', on: false, use: () => sit() });

    const say = (who, lines, npc, voice) => game.talk(who, lines, npc, { voice });

    async function snakeTalk() {
      snakeIt.on = false;
      game.faceTo(wpos(rock));
      game.talkShot(wpos(Sn.head), 1, 2.8);
      await say('a serpente', [
        'S Boa noite.',
        'P Em que planeta eu caí?',
        'S Na Terra. Na África.',
        'P Ah!… Então não há ninguém na Terra?',
        'S Aqui é o deserto. Não há ninguém nos desertos. A Terra é grande.',
        'P Onde estão os homens? A gente se sente um pouco sozinho no deserto…',
        'S Entre os homens a gente também se sente sozinho.',
        'P Você é um bicho engraçado. Fininho como um dedo.',
        'S Mas eu sou mais poderosa que o dedo de um rei. Posso te levar mais longe que um navio…',
        'S Tenho pena de você, tão frágil nesta Terra de granito. Um dia, se sentir saudade demais do seu planeta, eu posso… posso ajudar.',
        'P Ah! Entendi muito bem. Mas por que você sempre fala por enigmas?',
        'S Eu resolvo todos eles.',
      ], Sn, 0.55);
      game.release();
      S.stage = 'flower';
      game.ui.setQuests('o deserto', [{ id: 'fl', text: 'procurar *os homens* pelo deserto' }]);
      flowerIt.on = true;
    }

    async function flowerTalk() {
      flowerIt.on = false;
      game.faceTo(wpos(fl));
      game.talkShot(wpos(fl), -1, 2.4);
      await say('a flor', [
        'P Bom dia.',
        'F Bom dia.',
        'P Onde estão os homens?',
        'F Os homens? Existem uns seis ou sete, eu acho. Vi faz anos. Mas nunca se sabe onde encontrá-los. O vento leva eles. Eles não têm raízes, e isso atrapalha muito.',
        'P Adeus.',
        'F Adeus.',
      ], null, 1.3);
      game.release();
      S.stage = 'peak';
      game.ui.setQuests('o deserto', [{ id: 'pk', text: 'subir a *montanha alta* para ver o planeta inteiro' }]);
      peakIt.on = true;
    }

    async function echo() {
      peakIt.on = false;
      const lines = ['Bom dia…', 'Quem é você?', 'Sejam meus amigos. Estou sozinho…'];
      const echoes = ['…dia… dia… dia…', '…você… você… você…', '…sozinho… sozinho… sozinho…'];
      for (let i = 0; i < 3; i++) {
        await game.ui.say('o principezinho', lines[i], { voice: 1.45 });
        game.audio.chime(i, 0.04); setTimeout(() => game.audio.chime(i, 0.02), 500); setTimeout(() => game.audio.chime(i, 0.01), 1000);
        game.ui.toast(echoes[i], 2200);
        await game.wait(2.2);
      }
      await game.narrate('Que planeta engraçado! É todo seco, pontudo e salgado. E os homens não têm imaginação: repetem o que a gente diz…');
      await game.narrate('No meu planeta eu tinha uma flor. Era sempre ela que falava primeiro.');
      S.stage = 'garden';
      game.ui.setQuests('o deserto', [{ id: 'gd', text: 'descer até o *jardim florido* lá embaixo' }]);
      gardenIt.on = true;
    }

    async function garden() {
      gardenIt.on = false;
      if (S.stage === 'garden') {
        game.talkShot(planet.surface(D.garden, 0.5), 1, 5);
        await game.ui.say('o principezinho', 'Bom dia.', { voice: 1.45 });
        await game.ui.say('as rosas', 'Bom dia!', { voice: 1.15 });
        await game.ui.say('o principezinho', 'Quem são vocês?', { voice: 1.45 });
        await game.ui.say('as rosas', 'Nós somos rosas.', { voice: 1.15 });
        await game.narrate('E ele se sentiu muito infeliz. Sua flor tinha contado que era a única da sua espécie em todo o universo. E ali havia cinco mil, todas parecidas, num só jardim!');
        await game.narrate('Eu me achava rico com uma flor única, e só tenho uma rosa comum. Isso, e três vulcões da altura do meu joelho… Isso não faz de mim um príncipe muito grande.');
        game.player.model.pose = 'lie';
        game.release();
        await game.wait(2.5);
        game.ui.toast('…', 1500);
        await game.wait(1.5);
        // a raposa chega
        S.stage = 'fox';
        game.player.model.pose = 'idle';
        foxW.dir.copy(D.fox);
        Fx.mode = 'sit';
        await game.ui.say('uma voz', 'Bom dia.', { voice: 0.95 });
        await game.ui.say('o principezinho', 'Bom dia. (ele se virou, e não viu nada)', { voice: 1.45 });
        await game.ui.say('uma voz', 'Estou aqui, embaixo da macieira…', { voice: 0.95 });
        game.ui.setQuests('a raposa', [{ id: 'fx', text: 'ver quem está embaixo da *macieira*' }]);
        foxIt.on = true;
        return;
      }
      if (S.stage === 'roses2') {
        game.talkShot(planet.surface(D.garden, 0.5), -1, 5);
        await game.talk('o principezinho', [
          'P Vocês não se parecem nada com a minha rosa. Vocês ainda não são nada. Ninguém cativou vocês, e vocês não cativaram ninguém.',
          'P Vocês são bonitas, mas vazias. Ninguém morreria por vocês.',
          'P A minha rosa, uma pessoa qualquer vai achar que é igualzinha a vocês. Mas ela sozinha é mais importante que todas vocês juntas…',
          'P …porque foi ela que eu reguei. Foi ela que eu pus debaixo da redoma. Foi ela que eu escutei reclamar, ou se gabar, ou mesmo às vezes calar. Porque ela é a minha rosa.',
        ]);
        game.release();
        S.stage = 'secret';
        game.ui.setQuests('a raposa', [{ id: 'sec', text: 'voltar para se despedir da *raposa*' }]);
        foxIt.on = true;
      }
    }

    function spotDir(k) {
      // cada dia um pouco mais perto
      const dist = [0.26, 0.19, 0.12, 0.06][k];
      const from = D.garden.clone();
      const toward = from.clone().sub(foxW.dir); tangent(toward, foxW.dir); toward.normalize();
      return foxW.dir.clone().addScaledVector(toward, dist).normalize();
    }
    function showSpot() {
      const d = spotDir(S.day);
      S.spot = d;
      ring.position.copy(planet.surface(d, 0.04));
      ring.quaternion.copy(surfaceQuat(d));
      ring.visible = true;
      sitIt.pos.copy(planet.surface(d));
      sitIt.on = true;
    }

    async function foxTalk() {
      foxIt.on = false;
      game.faceTo(wpos(Fx.g));
      game.talkShot(wpos(Fx.head), 1, 3);
      if (S.stage === 'fox') {
        await say('a raposa', [
          'P Quem é você? Você é bem bonita…',
          'X Eu sou uma raposa.',
          'P Venha brincar comigo. Estou tão triste…',
          'X Eu não posso brincar com você. Não fui cativada.',
          'P Ah! Desculpe. O que quer dizer “cativar”?',
          'X É uma coisa muito esquecida. Quer dizer “criar laços”.',
          'X Para mim, você ainda é só um menino igual a cem mil outros meninos. Eu não preciso de você. E você também não precisa de mim.',
          'X Mas, se você me cativar, nós vamos precisar um do outro. Você vai ser único no mundo para mim. E eu vou ser única no mundo para você…',
          'X Minha vida é muito monótona. Mas, se você me cativar, minha vida vai ficar como que ensolarada. Vou conhecer um barulho de passos diferente de todos os outros.',
          'X E olhe! Está vendo os trigais lá longe? Eu não como pão. O trigo não me lembra nada. Mas você tem cabelos cor de ouro. Então vai ser maravilhoso quando você tiver me cativado: o trigo, que é dourado, vai me lembrar você…',
          'X Por favor… me cativa!',
          'P O que é preciso fazer?',
          'X É preciso ter muita paciência. Primeiro, você vai se sentar um pouco longe de mim, assim, na grama. Eu vou te olhar com o canto do olho, e você não vai dizer nada. A linguagem é uma fonte de mal-entendidos.',
          'X Mas, a cada dia, você vai poder se sentar um pouco mais perto…',
        ], Fx, 0.95);
        game.release();
        S.stage = 'tame';
        game.ui.setQuests('cativar', [{ id: 'dia', text: 'sentar na grama e *esperar em silêncio*', max: 4 }]);
        showSpot();
        return;
      }
      if (S.stage === 'tamed') {
        await say('a raposa', [
          'P Bom… então, adeus.',
          'X Ah! Eu vou chorar.',
          'P A culpa é sua. Eu não queria te fazer mal nenhum, mas você quis que eu te cativasse…',
          'X É mesmo.',
          'P Então você não ganhou nada com isso!',
          'X Ganhei, sim. Por causa da cor do trigo.',
          'X Vá ver as rosas de novo. Você vai entender que a sua é única no mundo. Depois volte para me dizer adeus, e eu vou te dar um segredo de presente.',
        ], Fx, 0.95);
        game.release();
        S.stage = 'roses2';
        game.ui.setQuests('a raposa', [{ id: 'rs', text: 'voltar ao *jardim de rosas*' }]);
        gardenIt.on = true; gardenIt.label = 'falar com as rosas';
        return;
      }
      if (S.stage === 'secret') {
        await say('a raposa', [
          'P Adeus.',
          'X Adeus. Aqui está o meu segredo. É muito simples:',
          'X Só se vê bem com o coração. *O essencial é invisível aos olhos.*',
          'P O essencial é invisível aos olhos…',
          'X Foi o tempo que você dedicou à sua rosa que fez a sua rosa tão importante.',
          'P Foi o tempo que eu dediquei à minha rosa…',
          'X Os homens esqueceram essa verdade. Mas você não deve esquecer. Você se torna responsável, para sempre, por aquilo que cativa. Você é responsável pela sua rosa…',
          'P Eu sou responsável pela minha rosa…',
        ], Fx, 0.95);
        await game.narrate('E o principezinho seguiu caminho pelo deserto. Mais adiante, um avião tinha caído na areia.');
        game.release();
        S.stage = 'aviator';
        Fx.happy = true;
        game.ui.setQuests('o deserto', [{ id: 'av', text: 'seguir até o *avião caído*' }]);
        avIt.on = true;
      }
    }

    async function sit() {
      sitIt.on = false;
      ring.visible = false;
      game.player.model.pose = 'sit';
      game.player.frozen = false;
      S.sitting = true;
      S.lapse = 0;
      game.faceTo(wpos(Fx.g));
      game.ui.toast('não se mexa… só espere', 2500);
    }

    function standUp(fail) {
      S.sitting = false;
      game.player.model.pose = 'idle';
      if (fail) {
        game.ui.toast('a raposa se assustou! sente de novo, bem quietinho', 2600);
        game.audio.noise(0.2, 700, 1, 0.05);
        showSpot();
      }
    }

    async function dayDone() {
      S.sitting = false;
      S.day++;
      game.ui.quest('dia', { n: S.day });
      game.audio.success();
      const lines = [
        ['X …'],
        ['X Teria sido melhor você voltar na mesma hora. Se você vem, por exemplo, às quatro da tarde, desde as três eu vou começar a ser feliz.'],
        ['X Quanto mais a hora for chegando, mais feliz eu vou ficar. Às quatro, já vou estar agitada, inquieta: vou descobrir o preço da felicidade!'],
        [],
      ][S.day - 1];
      if (lines.length) await say('a raposa', lines, Fx, 0.95);
      game.player.model.pose = 'idle';
      if (S.day >= 4) {
        S.stage = 'tamedWalk';
        Fx.mode = 'walk';
        Fx.happy = true;
        game.ui.toast('a raposa foi cativada', 3000);
        game.audio.laugh(1.2, 0.03);
        const near = planet.up(game.player.pos).lerp(foxW.dir, 0.4).normalize();
        await foxW.goto(near, 1.2);
        Fx.mode = 'sit';
        S.stage = 'tamed';
        foxIt.on = true;
        game.ui.setQuests('a raposa', [{ id: 'fx', text: 'falar com a *raposa*' }]);
      } else showSpot();
    }

    async function aviatorTalk() {
      avIt.on = false;
      game.faceTo(wpos(Av.group));
      game.talkShot(wpos(Av.head), 1, 3.4);
      if (S.stage === 'aviator') {
        await game.talk('o aviador', [
          'P Por favor… desenha pra mim um carneiro!',
          'A Hein?!',
          'P Desenha um carneiro pra mim…',
        ], Av, { voice: 0.8 });
        await game.narrate('Quando o mistério é impressionante demais, a gente não ousa desobedecer. Por mais absurdo que parecesse, a mil milhas de qualquer lugar habitado, ele tirou do bolso uma folha de papel e uma caneta.');
        const replies = [
          'Não! Esse aí já está muito doente. Faz outro.',
          'Olha só… isso não é um carneiro, é um bode. Tem chifres…',
          'Esse é velho demais. Eu quero um carneiro que viva muito tempo.',
        ];
        let tries = 0;
        while (true) {
          const opts = tries < 3 ? ['desenhar um carneiro', 'desenhar só uma caixa'] : ['desenhar só uma caixa'];
          const c = await game.ui.choose('o aviador', tries === 0 ? 'O que eu desenho?' : 'Hum… e agora?', opts, { voice: 0.8 });
          const pick = opts[c] === 'desenhar só uma caixa' ? 3 : tries;
          game.ui.drawing(DRAW[pick].svg, DRAW[pick].cap);
          game.audio.noise(2.2, 3000, 0.5, 0.012);
          await game.wait(2.6);
          if (pick === 3) break;
          await game.ui.say('o principezinho', replies[tries], { voice: 1.45 });
          game.ui.drawing(null);
          tries++;
        }
        await game.ui.say('o aviador', 'Isto é a caixa. O carneiro que você quer está dentro.', { voice: 0.8 });
        await game.ui.say('o principezinho', 'Era assim mesmo que eu queria! Olha… ele dormiu.', { voice: 1.45 });
        game.ui.drawing(null);
        const box = sheepBox();
        planet.place(box, planet.up(game.player.pos).addScaledVector(game.player.face, 0.03).normalize());
        await game.talk('o aviador', [
          'A Meu avião quebrou, e já não tenho quase nada de água para beber.',
          'P Eu também estou com sede… Vamos procurar um poço.',
          'A É absurdo procurar um poço, ao acaso, na imensidão do deserto…',
        ], Av, { voice: 0.8 });
        await game.narrate('Mesmo assim, eles se puseram a caminho. O sol começava a se pôr.');
        game.release();
        S.stage = 'toWell';
        S.follow = true;
        avW.rate = 1.9;
        game.ui.setQuests('o deserto', [{ id: 'poco', text: 'procurar um *poço*, com o aviador' }]);
        wellIt.on = true;
      }
    }

    async function drink() {
      wellIt.on = false;
      S.follow = false;
      game.talkShot(wpos(W.g, 1.2, planet), 1, 4);
      // o balde sobe
      for (let i = 0; i < 30; i++) { W.wheel.rotation.x += 0.2; W.bucket.position.y = 0.6 + i * 0.03; await game.wait(0.04); }
      game.audio.sparkle();
      await game.narrate('O poço cantava. A roldana gemia como um velho cata-vento que dormiu muito tempo.');
      await game.talk('o aviador', [
        'P Estou com sede dessa água. Me dá de beber…',
      ], Av, { voice: 0.8 });
      await game.narrate('Aquela água era mais que um alimento. Tinha nascido da caminhada sob as estrelas, do canto da roldana, do esforço dos braços. Era boa para o coração, como um presente.');
      await game.talk('o aviador', [
        'P As pessoas do seu planeta cultivam cinco mil rosas num mesmo jardim… e não encontram o que procuram.',
        'A Não encontram…',
        'P E, no entanto, o que eles procuram poderia ser encontrado numa só rosa, ou num pouco de água…',
        'A Com certeza.',
        'P Mas os olhos são cegos. É preciso procurar com o coração.',
      ], Av, { voice: 0.8 });
      game.release();
      S.stage = 'stars';
      await game.wait(1.2);
      finale();
    }

    async function finale() {
      // a serpente espera no muro
      const Sn2 = snake();
      Sn2.g.scale.setScalar(1.2);
      planet.place(Sn2.g, D.wall, { lift: 0.55 });
      upd.push(Sn2.update);
      game.faceTo(wpos(Av.group));
      game.talkShot(wpos(Av.head), -1, 4.2);
      await game.talk('o aviador', [
        'P Esta noite faz um ano. A minha estrela vai estar bem em cima do lugar onde eu caí no ano passado…',
        'P As pessoas têm estrelas que não são as mesmas. Para uns, que viajam, as estrelas são guias. Para outros, não passam de luzinhas.',
        'P Mas você vai ter estrelas como ninguém tem.',
        'A O que você quer dizer?',
        'P Quando você olhar para o céu, de noite, como eu vou morar numa delas, como eu vou estar rindo numa delas…',
        'P …vai ser como se todas as estrelas rissem para você. Você vai ter estrelas que sabem rir!',
      ], Av, { voice: 0.8 });
      // o titulo do jogo: as estrelas riem
      S.laugh = 1;
      game.audio.laugh(6, 0.06);
      game.shot(game.player.pos.clone().addScaledVector(game.player.up, 1.2).addScaledVector(game.player.face, -3), game.player.pos.clone().addScaledVector(game.player.up, 8));
      await game.wait(5);
      game.talkShot(wpos(Av.head), 1, 4);
      await game.talk('o aviador', [
        'P Vai parecer que eu estou morto, e não vai ser verdade…',
        'P Você entende. É longe demais. Eu não posso levar este corpo. É pesado demais.',
        'P Mas vai ser como uma casca velha abandonada. Não tem nada de triste nas cascas velhas…',
        'P Sabe… a minha flor… eu sou responsável por ela. E ela é tão frágil! Tão ingênua. Tem quatro espinhos de nada para se defender do mundo…',
      ], Av, { voice: 0.8 });
      game.release();
      game.player.frozen = true;
      await game.player.walkTo(planet.surface(D.wall.clone().lerp(D.well, 0.55).normalize()), 0.35);
      await game.narrate('Não houve nada, além de um clarão amarelo perto do seu tornozelo. Ele ficou um instante imóvel. Não gritou.');
      // clarao e uma estrelinha que sobe
      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), glow('#ffe08a', 3));
      flash.position.copy(game.player.pos).addScaledVector(game.player.up, 0.5);
      planet.group.add(flash);
      game.audio.success();
      game.player.model.group.visible = false;
      game.player.model.scarf.mesh.visible = false;
      S.rise = { m: flash, v: 0 };
      await game.wait(4);
      await game.narrate('Mas eu sei que ele voltou para o seu planeta, porque, ao amanhecer, não encontrei o seu corpo.');
      await game.narrate('E agora, de noite, eu gosto de escutar as estrelas. São como quinhentos milhões de guizos…');
      game.audio.laugh(4, 0.05);
      await game.wait(1.5);
      game.next();
    }

    // ------------------------------------------------ jogo
    return {
      _S: S,
      planet,
      sun: S.sunBase,
      sky: { dayTop: '#78acdc', dayHor: '#f8e2b6', setA: '#f39044', setB: '#d86a82', nightTop: '#0a1336', nightHor: '#27336e', neb: '#6a4f9c', neb2: '#2f7a8f' },
      mood: { root: 62, scale: 'lydian', tempo: 64, density: 0.4, pad: 0.65, wind: 0.8 },
      spawn: D.spawn, face: D.snake.clone().sub(D.spawn),
      countSunsets: false,
      walkSpeed: 4.2,
      camDist: 6,
      stepSoft: 0.6,
      wind: new THREE.Vector3(1.5, 0, 0.6),
      update(dt, t) {
        for (const u of upd) u(dt, t);
        foxW.update(dt);
        avW.update(dt);
        ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.3;
        // cativar: sentado e quieto, o dia passa rapidinho
        if (S.sitting) {
          const mv = game.input.move;
          if (Math.hypot(mv.x, mv.y) > 0.2 || game.input.pressed('jump')) standUp(true);
          else {
            S.lapse += dt / 7;
            game.sunDir.copy(S.sunBase).applyAxisAngle(sunAxis, S.lapse * Math.PI * 2);
            if (S.lapse >= 1) { game.sunDir.copy(S.sunBase); dayDone(); }
          }
        } else if (S.stage === 'tame' && !S.sitting) game.sunDir.copy(S.sunBase);
        // o aviador acompanha ate o poco
        if (S.follow) {
          const behind = planet.up(game.player.pos).addScaledVector(game.player.face, -0.07).normalize();
          if (behind.angleTo(avW.dir) > 0.06) avW.target = behind; else avW.target = null;
        }
        // estrelas que riem
        game.sky.uniforms.uLaugh.value += (S.laugh - game.sky.uniforms.uLaugh.value) * dt * 0.8;
        if (S.rise) {
          S.rise.v += dt * 0.8;
          S.rise.m.position.addScaledVector(planet.up(S.rise.m.position), S.rise.v * dt * 3);
          S.rise.m.scale.setScalar(Math.max(0.15, 1 - S.rise.v * 0.5));
        }
      },
      target() {
        const st = S.stage;
        if (st === 'arrive') return snakeIt.on ? wpos(rock) : null;
        if (st === 'flower') return wpos(fl);
        if (st === 'peak') return planet.surface(D.peak, 0.5);
        if (st === 'garden' || st === 'roses2') return planet.surface(D.garden);
        if (st === 'fox' || st === 'tamed' || st === 'secret') return wpos(Fx.g);
        if (st === 'tame') return sitIt.on ? sitIt.pos : null;
        if (st === 'aviator') return wpos(Av.group);
        if (st === 'toWell') return wpos(W.g);
        return null;
      },
      dispose() { game.sky.uniforms.uLaugh.value = 0; game.ui.drawing(null); },
      async start() {
        await game.narrate('A Terra não é um planeta qualquer! Contam-se ali cento e onze reis, sete mil geógrafos, novecentos mil homens de negócios, sete milhões e meio de bêbados, trezentos e onze milhões de vaidosos…');
        await game.narrate('…quer dizer, uns dois bilhões de pessoas grandes. Mas o principezinho caiu no deserto, e não viu ninguém.');
        game.ui.setQuests('a Terra', [{ id: 'sn', text: 'alguma coisa se mexe perto da *pedra*…' }]);
        snakeIt.on = true;
      },
    };
  },
};

/** Faz um bicho/pessoa andar pela superficie de uma direcao ate outra. */
function walker(planet, obj, dir) {
  const w = { dir: dir.normalize(), target: null, speed: 0, rate: 1, resolve: null };
  planet.group.add(obj);
  const place = (look) => {
    obj.position.copy(planet.surface(w.dir, -0.02));
    if (look) faceDir(obj, w.dir, look);
    else obj.quaternion.copy(surfaceQuat(w.dir)).multiply(obj.userData.yawQ || new THREE.Quaternion());
  };
  place();
  w.goto = (d, rate = 1) => new Promise((res) => { w.target = d.clone().normalize(); w.rate = rate; w.resolve = res; });
  w.update = (dt) => {
    if (!w.target) { w.speed *= 0.8; obj.position.copy(planet.surface(w.dir, -0.02)); return; }
    const ang = w.dir.angleTo(w.target);
    const step = (2.2 * w.rate * dt) / planet.radius;
    if (ang < 0.004) {
      w.target = null; w.speed = 0;
      if (w.resolve) { const r = w.resolve; w.resolve = null; r(); }
      return;
    }
    const axis = w.dir.clone().cross(w.target).normalize();
    const look = w.target.clone();
    w.dir.applyAxisAngle(axis, Math.min(step, ang)).normalize();
    w.speed = 2.2 * w.rate;
    place(look);
  };
  return w;
}
