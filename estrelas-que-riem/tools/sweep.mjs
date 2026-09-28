// Anda por pontos aleatorios de cada planeta e conta tremedeiras (vai-e-volta).
//   node tools/sweep.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 4189; const wait = (t) => new Promise((r) => setTimeout(r, t));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {} await wait(250); }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
await page.goto(`http://127.0.0.1:${PORT}/?q=baixa`); await wait(3500);
for (let lv = 0; lv < 9; lv++) {
  const r = await page.evaluate(async (lv) => {
    const g = __game; document.getElementById('title').classList.add('out'); g.loadLevel(lv);
    for (let i = 0; i < 6; i++) { g.advance(0.6); if (g.ui.cur) g.ui.close(); await new Promise((r) => setTimeout(r, 20)); }
    const L = g.level, P = g.player; const V = P.pos.constructor;
    let bad = 0, maxStep = 0; const keys = [['up'], ['up', 'right'], ['up', 'left'], ['down'], ['right']];
    for (let k = 0; k < 25; k++) {
      const d = new V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      P.spawn(L.planet, d, new V(0, 1, 0).cross(d)); P.frozen = false; P.model.pose = 'idle';
      g.input.held.clear(); keys[k % 5].forEach((x) => g.input.held.add(x));
      let prev = P.pos.clone(), prevD = null, rev = 0;
      for (let i = 0; i < 120; i++) {
        g.frame(1 / 60, false); if (g.ui.cur) g.ui.close();
        const dp = P.pos.clone().sub(prev); maxStep = Math.max(maxStep, dp.length());
        if (i > 10 && prevD && dp.lengthSq() > 1e-7 && prevD.lengthSq() > 1e-7 && dp.dot(prevD) < 0) rev++;
        prevD = dp; prev.copy(P.pos);
      }
      if (rev > 6) bad++;
    }
    g.input.held.clear();
    return `nivel ${lv}: pontos com tremedeira ${bad}/25, maior passo por quadro ${maxStep.toFixed(3)} (normal ~0.07)`;
  }, lv);
  console.log(r);
}
await browser.close(); process.exit(0);
