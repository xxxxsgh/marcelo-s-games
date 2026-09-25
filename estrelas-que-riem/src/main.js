import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import './ui/style.css';
import { Game } from './game.js';
import { LEVELS } from './levels/index.js';
import { save } from './save.js';

addEventListener('unhandledrejection', (e) => console.error('unhandled', e.reason && (e.reason.stack || e.reason)));
const game = new Game();
window.__game = game;
const $ = (s) => document.querySelector(s);

// cenario do titulo: o B-612 girando devagar, principe sentado
await game.loadLevel(0, { title: true });
game.level.title && game.level.title();
game.gfx.fade = 0;

function loop() { game.frame(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
setTimeout(() => $('#boot').classList.add('out'), 200);

const title = $('#title');
if (game.input.touch) $('#hint').textContent = 'arraste à esquerda para andar · à direita para olhar · ✦ interage';
if ((game.save.level || 0) > 0) {
  title.querySelector('[data-m=cont]').classList.remove('hide');
  title.querySelector('[data-m=map]').classList.remove('hide');
}

async function begin(i) {
  game.audio.start();
  title.classList.add('out');
  document.body.classList.remove('in-title');
  await game.fadeTo(1, 1.1);
  game.player.model.pose = 'idle';
  game.player.frozen = false;
  await game.loadLevel(i);
}

title.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = b.dataset.m;
  if (m === 'new') { game.save.sunsets = 0; save(game.save); begin(0); }
  if (m === 'cont') begin(game.save.current || game.save.level || 0);
  if (m === 'map') openMap();
  if (m === 'opts') { game.audio.start(); game.paused = true; $('#pause').classList.remove('hide'); game.syncPause(); }
});

function openMap() {
  const el = $('#map .planets');
  el.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const d = document.createElement('div');
    d.className = 'pl' + (i > (game.save.level || 0) ? ' lock' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    drawPlanet(c, L.color || '#c9a36b', i);
    d.appendChild(c);
    d.insertAdjacentHTML('beforeend', `${L.name}<small>${L.kicker || ''}</small>`);
    d.addEventListener('click', () => { $('#map').classList.add('hide'); begin(i); });
    el.appendChild(d);
  });
  $('#map').classList.remove('hide');
}

// planetinha em aquarela desenhado em canvas 2D pro caderno
function drawPlanet(c, color, seed) {
  const x = c.getContext('2d');
  const r = 70, cx = 96, cy = 96;
  let s = seed * 999 + 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 18; i++) {
    x.globalAlpha = 0.12;
    x.fillStyle = color;
    x.beginPath();
    x.ellipse(cx + (rnd() - 0.5) * 8, cy + (rnd() - 0.5) * 8, r * (0.9 + rnd() * 0.15), r * (0.9 + rnd() * 0.15), rnd() * 3, 0, Math.PI * 2);
    x.fill();
  }
  const g = x.createRadialGradient(cx - 25, cy - 25, 5, cx, cy, r);
  g.addColorStop(0, 'rgba(255,250,230,.5)'); g.addColorStop(1, 'rgba(60,40,80,.35)');
  x.globalAlpha = 1; x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#3b2a2c'; x.lineWidth = 2.5;
  x.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.1) {
    const rr = r + (rnd() - 0.5) * 2.5;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    a ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
}

$('#pause').addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.v) game.audio.setVolume(t.dataset.v, +t.value);
  if (t.dataset.paper !== undefined) { game.paperStrength = +t.value; game.gfx.paper.uniforms.uStrength.value = +t.value; game.save.paper = +t.value; save(game.save); }
});
$('#pause').addEventListener('change', (e) => {
  if (e.target.dataset.q !== undefined) { game.save.quality = e.target.value; save(game.save); location.reload(); }
});
$('#pause').addEventListener('click', (e) => {
  const p = e.target.closest('button')?.dataset.p;
  if (p === 'resume') { game.paused = false; document.body.classList.remove('paused'); $('#pause').classList.add('hide'); }
  if (p === 'title') location.reload();
});
$('#map').addEventListener('click', (e) => { if (e.target.closest('button')?.dataset.p === 'closemap') $('#map').classList.add('hide'); });

// atalho de desenvolvimento: ?level=3 pula direto
const lv = game.params.get('level');
if (lv !== null) begin(+lv);
