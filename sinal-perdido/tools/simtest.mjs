/**
 * Simulacao pura em Node, sem navegador.
 *
 * O jogo inteiro (mundo, IA, balas, diretor) roda sem tocar em pixel: aqui o
 * `document` e um esqueleto e o canvas e um objeto que engole chamadas. Serve
 * pra rodar milhares de segundos de partida em segundos, com stack trace de
 * verdade quando algo estoura — coisa que um crash de aba no Chromium nao da.
 *
 *   node tools/simtest.mjs [segundos]
 */
const noop = () => {};

/** Canvas de mentira: qualquer metodo vira no-op, qualquer propriedade vira 0. */
function canvasFalso() {
  const ctx = new Proxy({}, {
    get: (alvo, k) => {
      if (k === 'canvas') return alvo;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof alvo[k] === 'undefined') return noop;
      return alvo[k];
    },
    set: () => true,
  });
  return { width: 0, height: 0, getContext: () => ctx, style: {}, addEventListener: noop, removeEventListener: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
}

globalThis.document = {
  createElement: () => canvasFalso(),
  getElementById: () => null,
  addEventListener: noop,
  removeEventListener: noop,
  hidden: false,
};
globalThis.window = { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1 };
if (!globalThis.navigator?.getGamepads) {
  // Node 22 ja expoe `navigator` como getter — da pra completar, nao substituir.
  Object.defineProperty(globalThis, 'navigator', {
    value: { getGamepads: () => [] }, configurable: true, writable: true,
  });
}
globalThis.requestAnimationFrame = noop;
globalThis.cancelAnimationFrame = noop;

const { createJogo } = await import('../src/game.js');
const { createInput } = await import('../src/input/index.js');
const { createAudio } = await import('../src/audio/index.js');
const { createSave } = await import('../src/save.js');

const canvas = canvasFalso();
const jogo = createJogo({
  canvas,
  ctx: canvas.getContext('2d'),
  input: createInput(canvas),
  audio: createAudio(),
  save: createSave(),
});
jogo.redimensionar(1280, 720, 1);

const segundos = Number(process.argv[2] || 400);
const CENARIOS = {
  'partida normal': (j) => {},
  'cerco com rainha e horda': (j) => {
    j.nucleosEntregues = 3; j.dificuldade = 3; j.nave.nucleos = 3;
    j.diretor.iniciarCerco();
    j.enemies.criar('rainha', j.jogador.x - 300, j.jogador.y - 60).estado = 'cacando';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.28;
      j.enemies.criar(i % 2 ? 'rastejante' : 'enxame',
        j.jogador.x + Math.cos(a) * 260, j.jogador.y + Math.sin(a) * 260);
    }
  },
  'jogador imortal cercado': (j) => {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.28;
      j.enemies.criar(['rastejante', 'cuspidor', 'ariete', 'enxame'][i % 4],
        j.jogador.x + Math.cos(a) * 220, j.jogador.y + Math.sin(a) * 220);
    }
  },
};

let falhas = 0;
for (const [nome, montar] of Object.entries(CENARIOS)) {
  jogo.novaPartida(`sim-${nome}`);
  for (let i = 0; i < 60 * 3; i++) jogo.passo(1 / 60);   // sai da cinematica
  jogo.jogador.vidaMax = 1e9; jogo.jogador.vida = 1e9;
  jogo.jogador.escudoMax = 1e9; jogo.jogador.escudo = 1e9;
  montar(jogo);

  // Sentinela: qualquer coordenada nao finita chegando na colisao vira erro
  // com stack, em vez de um `for` infinito la dentro.
  const original = jogo.mundo.resolverCirculo;
  jogo.mundo.resolverCirculo = (e) => {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.raio)) {
      throw new Error(`coordenada invalida em ${e.tipo || 'entidade'}: x=${e.x} y=${e.y} vx=${e.vx} vy=${e.vy} raio=${e.raio} estado=${e.estado}`);
    }
    return original(e);
  };

  // Rastreio sincrono de fase: `writeSync` nao fica preso em buffer se o
  // processo morrer no meio de um loop infinito.
  if (process.env.TRACE) {
    const fs = await import('node:fs');
    const marcar = (txt) => fs.writeSync(1, `${txt}\n`);
    const envolver = (obj, metodo, rotulo) => {
      const orig = obj[metodo].bind(obj);
      obj[metodo] = (...a) => { marcar(`> ${rotulo}`); const r = orig(...a); marcar(`< ${rotulo}`); return r; };
    };
    envolver(jogo.jogador, 'update', 'jogador');
    envolver(jogo.enemies, 'atualizar', 'inimigos');
    envolver(jogo.projeteis, 'update', 'projeteis');
    envolver(jogo.itens, 'atualizar', 'itens');
    envolver(jogo.diretor, 'atualizar', 'diretor');
    envolver(jogo.fx, 'update', 'fx');
  }

  const t0 = Date.now();
  let pico = 0;
  try {
    for (let i = 0; i < segundos * 60; i++) {
      jogo.passo(1 / 60);
      pico = Math.max(pico, jogo.inimigos.length);
      if (i % 60 === 0) {
        console.log(`  ${nome}: ${(i / 60).toFixed(0)}s  inimigos=${jogo.inimigos.length} balas=${jogo.projeteis.contagem} part=${jogo.fx.contagem} itens=${jogo.itens.lista.length} estado=${jogo.estado}`);
      }
    }
    const ms = Date.now() - t0;
    console.log(`OK  ${nome}: ${segundos}s simulados em ${ms}ms (${(segundos * 60 / (ms / 1000) / 1000).toFixed(1)}k passos/s), pico de ${pico} inimigos     `);
  } catch (e) {
    falhas++;
    console.log(`\nFALHA  ${nome}: ${e.stack}`);
  }
}

console.log(falhas === 0 ? '\nSIM OK' : '\nSIM FALHOU');
process.exit(falhas === 0 ? 0 : 1);
