// captura.cjs — renders determinísticos da volta roteirizada (passo fixo de 1/60 s), pilotada pelos comandos gravados
// via gamepad simulado. Chrome sem janela, WebGPU por software, leitura dos pixels fora da tela.
//   node captura.cjs quadros <dir> <ini> <fim> [passo=1] [aquec=6]   -> PNG dos quadros ini..fim-1 (a cada "passo")
//   node captura.cjs video <saida.mp4> <ini> <fim>                   -> trecho de vídeo 1080p60
//   node captura.cjs poses <dir>                                     -> as 6 poses fixas de câmera
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs'), cp = require('child_process');
const W = +(process.env.CAPW || 1920), H = +(process.env.CAPH || 1080);
const CAMS = [[1200, 1], [1920, 2], [2520, 0]]; // quadro -> câmera (0 perseguição, 1 capô, 2 beira da trilha)
async function open() {
  const b = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('[erro]', m.text().slice(0, 600)); }); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html') + `?test=1&offscreen=1&w=${W}&h=${H}`);
  await p.evaluate(() => window.__t.ready);
  const cmds = JSON.parse(fs.readFileSync(path.join(__dirname, 'volta_comandos.json'), 'utf8')).frames;
  await p.evaluate(([cmds, CAMS]) => {
    const t = window.__t, pad = { index: 0, id: 'Controle da volta roteirizada (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: [] };
    for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
    const e = new Event('gamepadconnected'); e.gamepad = pad; window.dispatchEvent(e);
    window.__cap = { f: 0, set() { const c = cmds[Math.min(this.f, cmds.length - 1)]; pad.buttons[7].value = c[0]; pad.buttons[7].pressed = c[0] > 0.5; pad.buttons[6].value = c[1]; pad.buttons[6].pressed = c[1] > 0.5; pad.axes[0] = c[2];
        let want = 0; for (const k of CAMS) if (this.f >= k[0]) want = k[1]; const y = t.Game.cam !== want && (this.f & 3) < 2; pad.buttons[3].value = y ? 1 : 0; pad.buttons[3].pressed = y; },
      sim(to) { while (this.f < to) { this.set(); t.sim(1); this.f++; } },
      render(n) { for (let i = 0; i < n; i++) { this.set(); t.frames(1); this.f++; } },
      info() { const G = t.Game; return { f: this.f, laps: G.laps, last: G.lastMs, cp: G.cp, s: G.trackS, off: G.offTrack, resets: G.resets, cam: G.cam, err: t.GPU.err || 0 }; } };
  }, [cmds, CAMS]);
  return { b, p };
}
const grabPNG = async (p, file) => { const url = await p.evaluate(() => window.__t.grab('png')); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
(async () => {
  const [mode, out, a1, a2, a3, a4] = process.argv.slice(2); const t0 = Date.now(); const { b, p } = await open();
  if (mode === 'quadros') {
    const ini = +a1, fim = +a2, passo = +(a3 || 1), aq = +(a4 === undefined ? 6 : a4); fs.mkdirSync(out, { recursive: true });
    for (let f = ini; f < fim; f += passo) {
      const cur = await p.evaluate(() => window.__cap.f);
      if (passo === 1 && cur === f && f > ini) await p.evaluate(() => window.__cap.render(1));
      else await p.evaluate(async ([f, aq]) => { const c = window.__cap; c.sim(Math.max(c.f, f - aq)); c.render(f + 1 - c.f); await window.__t.flush(); }, [f, aq]);
      await grabPNG(p, path.join(out, 'q' + String(f).padStart(4, '0') + '.png'));
      if ((f - ini) / passo % 10 === 0) console.log('quadro', f, ((Date.now() - t0) / 1000).toFixed(0) + ' s', JSON.stringify(await p.evaluate(() => window.__cap.info())));
    }
  } else if (mode === 'video') {
    const ini = +a1, fim = +a2;
    const ff = cp.spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '60', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    await p.evaluate(async ([ini]) => { const c = window.__cap; c.sim(Math.max(0, ini - 8)); c.render(ini - c.f); await window.__t.flush(); }, [ini]);
    for (let f = ini; f < fim; f++) {
      await p.evaluate(() => window.__cap.render(1)); const raw = await p.evaluate(() => window.__t.grab('raw'));
      if (!ff.stdin.write(Buffer.from(raw, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      // quadros sem perda para o pacote final do crítico: um a cada meio segundo e as três rajadas
      if (process.env.CAPPNG && (f % 30 === 0 || (f >= 560 && f < 568) || (f >= 1085 && f < 1093) || (f >= 2200 && f < 2208))) { fs.mkdirSync(process.env.CAPPNG, { recursive: true }); await grabPNG(p, path.join(process.env.CAPPNG, 'q' + String(f).padStart(4, '0') + '.png')); }
      if (f % 20 === 0) console.log('quadro', f, ((Date.now() - t0) / 1000).toFixed(0) + ' s', JSON.stringify(await p.evaluate(() => window.__cap.info())));
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  } else if (mode === 'poses') {
    fs.mkdirSync(out, { recursive: true });
    // [nome, quadro da volta, câmera]: carCam = [az, el, dist, altura do alvo, fov]; null = câmera do jogo
    const poses = [['pose1_traseira_3-4', 0, [38, 9, 6.6, 0.85, 0.62]], ['pose2_frente_3-4', 0, [148, 7, 6.4, 0.8, 0.62]], ['pose3_lateral', 0, [-90, 9, 7.4, 0.8, 0.5]],
      ['pose4_riacho_perseguicao', 1105, null], ['pose5_subida_pedras', 1420, [200, 10, 7.5, 0.9, 0.75]], ['pose6_ponte', 2860, [35, 12, 8.5, 0.8, 0.7]]];
    for (const [nm, f, cam] of poses) {
      await p.evaluate(async ([f, cam]) => { const c = window.__cap, t = window.__t; t.App.freeCam = false; if (f > 0) { c.sim(Math.max(c.f, f - 3)); c.render(f - c.f); }
        if (cam) t.carCam(...cam); t.still(12); await t.flush(); t.App.freeCam = false; }, [f, cam]);
      await grabPNG(p, path.join(out, nm + '.png')); console.log(nm, ((Date.now() - t0) / 1000).toFixed(0) + ' s', JSON.stringify(await p.evaluate(() => window.__cap.info())));
    }
  }
  await b.close();
})();
