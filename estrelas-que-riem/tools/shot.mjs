// Tira prints do jogo (chromium headless com GPU de software).
//   node tools/shot.mjs <nome> "<url-query>" [ms] [script-js-antes-do-print]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const [name = 'shot', query = '', ms = '6000', pre = ''] = process.argv.slice(2);
const PORT = 4181;
const wait = (t) => new Promise((r) => setTimeout(r, t));
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break; } catch {} await wait(250); }
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage(process.env.MOBILE ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?${query}`);
await wait(+ms);
if (pre) { await page.evaluate(pre); await wait(2500); }
mkdirSync('shots', { recursive: true });
await page.screenshot({ path: `shots/${name}.png` });
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log('fps', fps);
console.log(errs.slice(0, 15).join('\n'));
await browser.close();
process.exit(0);
