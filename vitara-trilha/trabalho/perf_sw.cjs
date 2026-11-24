const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [w, h, n, dbg] = process.argv.slice(2).map(Number); const W = w || 960, H = h || 540;
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); p.on('console', (m) => { if (m.type() === 'error') console.log(m.text().slice(0, 800)); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + `?test=1&offscreen=1&w=${W}&h=${H}`);
  await p.evaluate(() => window.__t.ready);
  const r = await p.evaluate(async ([n, dbg]) => { const t = window.__t; t.S.dbg = dbg; t.R.dbg = dbg; t.cam(-20, 23.2, -93, 30, 21, -86, 1); t.R.perf = true; t.frames(2); await t.flush(); const out = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); t.frames(1); await t.flush(); await new Promise(r => setTimeout(r, 30)); out.push(Math.round(performance.now() - t0)); }
    return { cnt: Array.from(t.S.cnt).join(','), wall: out, names: t.R.passNames, ms: Array.from(t.R.gpuMs).map(v => +v.toFixed(0)) }; }, [n || 3, dbg || 0]);
  console.log('wall ms/frame', r.wall.join(' ')); console.log('trees', r.cnt); console.log(r.names.map((nm, i) => nm + ':' + r.ms[i]).join('  ')); await b.close();
})();
