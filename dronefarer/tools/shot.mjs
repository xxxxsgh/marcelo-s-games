/**
 * Gera prints do jogo em pontos e qualidades escolhidos.
 * Serve pra checar o criterio "um print do jogo parado ja parece bonito" e
 * pra exercitar o caminho de pos-processamento do tier alto, que o smoke test
 * nao alcanca (a GPU de software cai sempre no tier minimo).
 *
 *   node tools/shot.mjs [tier]        # padrao: alto
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const TIER = process.argv[2] || 'alto';
const PORT = 4174;
const URL = `http://127.0.0.1:${PORT}/?q=${TIER}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'],
  { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });

// Poses escolhidas a mao: cada uma testa uma coisa diferente do visual.
const POSES = [
  { name: 'rua', pos: [3, 6, 55], vel: [0, 0, -18], yaw: Math.PI,
    desc: 'voo rente ao asfalto entre postes e fios' },
  { name: 'fachada', pos: [-14, 14, 40], vel: [0, 2, -14], yaw: Math.PI,
    desc: 'rasante na fachada, testa normal map e reflexo' },
  { name: 'telhados', pos: [30, 34, 30], vel: [-10, 0, -6], yaw: Math.PI * 0.8,
    desc: 'altura de telhado, caixas d agua e antenas' },
  { name: 'garagem', pos: [-13.5, -1.6, -70], vel: [0, 0, 3], yaw: 0,
    desc: 'interior escuro da garagem' },
  { name: 'rampa', pos: [-4.2, 1.2, -49], vel: [0, -1, -7], yaw: Math.PI,
    desc: 'boca da rampa vista de cima' },
];

let code = 0;
try {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) break; } catch {}
    await wait(300);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.DF?.drone, null, { timeout: 90000 });

  const info = await page.evaluate(() => ({
    tier: window.DF.quality.tier, postfx: window.DF.pipeline.enabled,
    passes: Object.entries(window.DF.pipeline.passes)
      .filter(([, v]) => !!v).map(([k]) => k),
  }));
  console.log('tier=%s postfx=%s passes=%s', info.tier, info.postfx, info.passes.join(','));
  if (TIER === 'alto' && !info.postfx) throw new Error('tier alto sem pos-processamento');

  mkdirSync('shots', { recursive: true });
  for (const p of POSES) {
    await page.evaluate((pose) => {
      const T = window.DF.THREE;
      window.DF.restart(new T.Vector3(...pose.pos), pose.yaw);
      window.DF.drone.state.vel.set(...pose.vel);
      // deixa a camera assentar na pose sem varrer o mapa
      window.DF.rig.snap(window.DF.drone);
      window.DF.hud.setVisible(false);
      // farol ligado quando a pose e subterranea
      window.DF.drone.setHeadlight(pose.pos[1] < 0.5);
    }, p);
    // alguns frames pra mola da camera, helices e poeira assentarem
    await wait(2500);
    const file = `shots/${TIER}-${p.name}.png`;
    const buf = await page.screenshot({ path: file });

    // Mede a imagem em vez de julgar no olho: media de luminancia e fracao de
    // pixels estourados sao o sinal objetivo pra calibrar exposicao/bloom.
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, blown = 0, dark = 0, n = 0;
      for (let i = 0; i < d.length; i += 16) {   // amostra 1 a cada 4 pixels
        const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        sum += l; n++;
        if (l > 0.97) blown++;
        if (l < 0.06) dark++;
      }
      return { mean: sum / n, blown: blown / n, dark: dark / n };
    }, buf.toString('base64'));

    const warn = stats.blown > 0.18 ? '  <-- ESTOURADO' : stats.mean > 0.72 ? '  <-- claro demais' : '';
    console.log('  %s  media=%s estourado=%s%% escuro=%s%%%s',
      file, stats.mean.toFixed(3), (stats.blown * 100).toFixed(1),
      (stats.dark * 100).toFixed(1), warn);
  }

  await page.evaluate(() => window.DF.hud.setVisible(true));
  if (errors.length) {
    console.error('erros:', errors.slice(0, 8));
    code = 1;
  }
  await browser.close();
} catch (e) {
  console.error('FALHA:', e.message);
  code = 1;
}
server.kill('SIGKILL');
process.exit(code);
