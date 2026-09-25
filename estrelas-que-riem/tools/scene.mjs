// Enquadra personagens: para cada [nivel, rotulo], leva o principe ate a
// interacao, faz a camera de conversa e tira um print.
//   node tools/scene.mjs "1:rei" "2:vaidoso" ...
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const jobs = process.argv.slice(2).map((a) => { const [lv, label, side = '1', dist = '3.2', extra = ''] = a.split(':'); return { lv: +lv, label, side: +side, dist: +dist, extra }; });
const PORT = 4184;
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
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/?q=alta`);
await wait(3500);
mkdirSync('shots', { recursive: true });
for (const j of jobs) {
  await page.evaluate(async (j) => {
    const g = __game;
    document.getElementById('title').classList.add('out');
    document.body.classList.remove('in-title');
    g.loadLevel(j.lv);
    for (let k = 0; k < 8; k++) { g.advance(0.6); if (g.ui.cur) g.ui.close(); await new Promise((r) => setTimeout(r, 20)); }
    g.fadeAnim = null; g.gfx.fade = 0;
    g.ui.clearQuests();
    const L = g.level;
    if (j.extra) eval(j.extra);
    const it = L.planet.interactables.find((i) => i.label.includes(j.label));
    if (!it) return;
    if (it.obj) it.obj.getWorldPosition(it.pos);
    const d = it.pos.clone().normalize();
    const side = new (d.constructor)(0, 1, 0).cross(d).normalize();
    g.player.spawn(L.planet, d.clone().addScaledVector(side, 1.3 / L.planet.radius).normalize(), it.pos.clone().sub(L.planet.center));
    g.advance(0.3);
    g.faceTo(it.pos);
    g.talkShot(it.pos.clone().addScaledVector(d, 0.8), j.side, j.dist);
    g.advance(2);
  }, j);
  await wait(1200);
  await page.screenshot({ path: `shots/sc-${j.lv}-${j.label.replace(/\W+/g, '_')}.png` });
  console.log('ok', j.lv, j.label);
}
console.log(errs.join('\n') || 'sem erros');
await browser.close();
process.exit(0);
