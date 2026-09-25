// "Robo" que joga o jogo inteiro: usa as interacoes na ordem, fecha dialogos,
// resolve os minijogos, e pula as viagens. Serve pra achar erro de roteiro.
//   node tools/autoplay.mjs [nivel-inicial]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const START = +(process.argv[2] || 0);
const PORT = 4183;
const wait = (t) => new Promise((r) => setTimeout(r, t));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {} await wait(250); }
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?q=baixa&fast=1`);
await wait(3000);
mkdirSync('shots', { recursive: true });
await page.evaluate((s) => { const g = __game; g.audio.start(); document.getElementById('title').classList.add('out'); g.loadLevel(s); }, START);

let last = -1, stuck = 0;
for (let step = 0; step < 9000; step++) {
  const st = await page.evaluate(() => {
    const g = __game;
    // desenha so de vez em quando
    g.advance(0.25);
    const L = g.level;
    const S = L && L._S;
    const out = { lv: g.levelIndex, mode: g.mode, stage: S && S.stage, busy: g.ui.busy, used: null };
    if (g.ui.cur) { const k = g.ui.cur.kind; g.ui.close(k === 'choose' ? 0 : undefined); return out; }
    if (g.mode === 'travel') { g.travel.skip = 5; return out; }
    if (!L || g.mode !== 'planet') return out;
    const id = L.index;
    // minijogos
    if (id === 1 && S.stage === 'sunset') {
      const up = g.player.up.clone();
      const t = g.sunDir.clone().addScaledVector(up, -g.sunDir.dot(up)).normalize();
      g.sunDir.copy(t).addScaledVector(up, 0.02).normalize();
    }
    if (id === 2 && S.rhythm) {
      const R = S.rhythm;
      if (R.t > 0) { const ph = (R.t % R.period) / R.period; if (ph > 0.97 || ph < 0.03) g.input.edge.add('act'); }
      g.advance(0.02, 0.02);
      g.input.edge.clear();
      return out;
    }
    if (id === 7 && S.sitting) { g.advance(1); return out; }
    // usa a primeira interacao disponivel
    for (const it of L.planet.interactables) {
      if (!it.on || (it.cond && !it.cond()) || it.label.includes('pôr do sol')) continue;
      if (it.obj) it.obj.getWorldPosition(it.pos);
      // leva o jogador ate la (teleporte) pra cenas que dependem da posicao
      const dir = it.pos.clone().sub(L.planet.center).normalize();
      g.player.spawn(L.planet, dir.clone().add(g.player.face.clone().multiplyScalar(0.02)).normalize(), g.player.face);
      out.used = it.label;
      it.use();
      break;
    }
    return out;
  });
  const key = JSON.stringify([st.lv, st.stage, st.mode]);
  if (key !== last) { console.log(step, key, st.used || ''); last = key; stuck = 0; } else stuck++;
  if (st.used && stuck % 40 === 0 && stuck) console.log('   (usando', st.used, ')');
  if (stuck > 900) { console.log('TRAVOU em', key, await page.evaluate(() => JSON.stringify({ cur: __game.ui.cur && __game.ui.cur.kind, waiters: __game.waiters.map((w) => w.at ? 'at ' + (w.at - __game.t).toFixed(1) : 'cond'), fade: __game.gfx.fade, fa: !!__game.fadeAnim, ons: __game.level.planet.interactables.filter((i) => i.on).map((i) => i.label) }))); break; }
  if (errs.length) break;
  if (st.lv === 8 && st.stage === 'go' && step > 5) {
    // epilogo: usa a rosa
  }
  if (await page.evaluate(() => document.getElementById('credits').classList.contains('on'))) { console.log('CREDITOS!'); break; }
}
await page.screenshot({ path: 'shots/autoplay-end.png' });
console.log(errs.slice(0, 10).join('\n') || 'sem erros');
await browser.close();
process.exit(0);
