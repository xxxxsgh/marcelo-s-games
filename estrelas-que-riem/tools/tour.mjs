// Carrega cada planeta, avanca a simulacao, fecha dialogos e tira um print.
//   node tools/tour.mjs [indices separados por virgula]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const only = (process.argv[2] || '').split(',').filter(Boolean).map(Number);
const PORT = 4182;
const wait = (t) => new Promise((r) => setTimeout(r, t));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {} await wait(250); }
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?q=media`);
await wait(4000);
mkdirSync('shots', { recursive: true });
const n = await page.evaluate(() => (window.__levels = window.__game && 9));
for (let i = 0; i < 9; i++) {
  if (only.length && !only.includes(i)) continue;
  const t0 = Date.now();
  await page.evaluate(async (i) => {
    const g = __game;
    g.audio.start();
    document.getElementById('title').classList.add('out');
    g.loadLevel(i);
    for (let k = 0; k < 10; k++) { g.advance(0.6); if (g.ui.cur) g.ui.close(); await new Promise((r) => setTimeout(r, 30)); }
    g.fadeAnim = null; g.gfx.fade = 0;
  }, i);
  await wait(1200);
  await page.screenshot({ path: `shots/lv${i}.png` });
  console.log('level', i, 'ok', Date.now() - t0, 'ms');
}
console.log(errs.slice(0, 20).join('\n') || 'sem erros');
await browser.close();
process.exit(0);
