// shot.cjs — render de teste: node trabalho/shot.cjs saida.png "ex,ey,ez,tx,ty,tz,fov" [quadros] [w] [h] [extra query]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [out, cam, fr, w, h, extra] = process.argv.slice(2); const W = +(w || 960), H = +(h || 540);
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('[')) console.log('[' + m.type() + ']', t.slice(0, 1500)); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const t0 = Date.now();
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + `?test=1&offscreen=1&w=${W}&h=${H}` + (extra || ''));
  await p.evaluate(() => window.__t.ready); console.log('init', Date.now() - t0, 'ms');
  const cams = (cam || '').split(';'); const t1 = Date.now();
  for (let k = 0; k < cams.length; k++) { const c = cams[k].split(',').map(Number);
    await p.evaluate(async ([c, n, first]) => { const t = window.__t; t.R.dbgView = +(new URLSearchParams(location.search).get('dv') || 0); if (c.length >= 6) t.cam(...c); else if (c.length === 5) { if (first) t.step(30); t.carCam(...c); } t.frames(n); await t.flush(); }, [c, +(fr || 8), k === 0]);
    const url = await p.evaluate(() => window.__t.grab('png')); require('fs').writeFileSync(cams.length > 1 ? out.replace('.png', '_' + k + '.png') : out, Buffer.from(url.split(',')[1], 'base64')); }
  console.log('frames', Date.now() - t1, 'ms', 'gpuerr', await p.evaluate(() => window.__t.GPU.err || 0));
  await b.close();
})();
