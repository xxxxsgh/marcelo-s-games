/**
 * SINAL PERDIDO — ponto de entrada.
 * Monta canvas, entrada, audio e loop. Regra de jogo nenhuma mora aqui.
 */
import { createLoop } from './core/loop.js';
import { createInput } from './input/index.js';
import { createAudio } from './audio/index.js';
import { createSave } from './save.js';
import { createJogo } from './game.js';

const params = new URLSearchParams(location.search);

const app = document.getElementById('app');
const canvas = document.createElement('canvas');
canvas.id = 'jogo';
app.appendChild(canvas);
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const boot = {
  el: document.getElementById('boot'),
  bar: document.getElementById('boot-bar'),
  set(p) { if (this.bar) this.bar.style.width = `${Math.round(p * 100)}%`; },
  fim() {
    const el = this.el;
    if (!el) return;
    this.el = null;
    el.style.opacity = '0';
    // Sai do DOM de verdade: com opacidade 0 ele continuaria comendo os cliques.
    setTimeout(() => el.remove(), 500);
  },
};
boot.set(0.15);

// DPR limitado a 2: acima disso o ganho visual e nulo e o custo de pixel dobra.
function dprAtual() {
  const forcado = parseFloat(params.get('dpr') || '');
  if (Number.isFinite(forcado) && forcado > 0) return forcado;
  return Math.min(window.devicePixelRatio || 1, 2);
}

const input = createInput(canvas);
const save = createSave();
const audio = createAudio();
const jogo = createJogo({ canvas, ctx, input, audio, save });

function redimensionar() {
  const dpr = dprAtual();
  const w = Math.max(320, Math.floor(canvas.clientWidth || window.innerWidth));
  const h = Math.max(240, Math.floor(canvas.clientHeight || window.innerHeight));
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  jogo.redimensionar(canvas.width, canvas.height, dpr);
}
window.addEventListener('resize', redimensionar);
redimensionar();
boot.set(0.4);

// Qualidade da camada de luz: `?luz=1` deixa nitida, `?luz=0.35` alivia GPU fraca.
const luzQ = parseFloat(params.get('luz') || '');
if (Number.isFinite(luzQ) && luzQ > 0.1 && luzQ <= 1) jogo.luz.qualidade = luzQ;

// O planeta ja nasce gerado atras do titulo — a tela inicial e o proprio jogo.
jogo.novaPartida(params.get('seed') || save.dados.ultimaSeed || String(Math.floor(Math.random() * 1e9)));
jogo.irParaTitulo();
boot.set(0.85);

// Audio so pode acordar depois de um gesto do usuario.
const acordarAudio = () => { if (save.audioLigado !== false) audio.retomar(); };
window.addEventListener('pointerdown', acordarAudio, { once: false });
window.addEventListener('keydown', acordarAudio, { once: false });
if (save.audioLigado === false) audio.alternar();

const loop = createLoop({
  fixed: (dt) => jogo.passo(dt),
  render: () => jogo.render(),
});
jogo.stats = loop.stats;

// Aba escondida: pausa o jogo em vez de deixar o jogador morrer sozinho.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) jogo.pausar();
});

loop.start();
boot.set(1);
setTimeout(() => boot.fim(), 220);

// Superficie usada pelo smoke test (tools/smoke.mjs).
window.SP = {
  jogo, loop, input, audio, save,
  versao: '1.0.0',
  get estado() { return jogo.estado; },
  iniciar(seed) { jogo.novaPartida(seed); },
  /** Roda N passos fixos de simulacao sem esperar frames (usado nos testes). */
  avancar(segundos) {
    const passos = Math.round(segundos * 60);
    for (let i = 0; i < passos; i++) jogo.passo(1 / 60);
  },
};
