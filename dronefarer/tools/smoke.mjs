/**
 * Smoke test do jogo rodando de verdade num Chromium.
 * Build verde nao prova nada num jogo WebGL — este script carrega a pagina,
 * voa alguns segundos com teclas sinteticas e falha se aparecer erro de
 * console, excecao ou se a fisica sair do lugar.
 *
 *   node tools/smoke.mjs [--shots]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const WANT_SHOTS = process.argv.includes('--shots');
const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
  stdio: 'ignore', detached: false,
});
process.on('exit', () => { try { server.kill('SIGKILL'); } catch {} });

const errors = [];
let exitCode = 0;

try {
  // espera o preview subir
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(URL); if (r.ok) break; } catch {}
    await wait(250);
  }

  // O ambiente ja traz um Chromium; nunca baixamos browser aqui.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: [
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(URL, { waitUntil: 'load' });

  // o jogo so existe depois do start() assincrono
  await page.waitForFunction(() => !!window.DF?.drone, null, { timeout: 45000 });
  console.log('OK  boot: window.DF pronto');

  const boot = await page.evaluate(() => ({
    tier: window.DF.quality.tier,
    colliders: window.DF.colliders.count,
    hasEnv: !!window.DF.env.envMap,
    pipeline: window.DF.pipeline.enabled,
  }));
  console.log('OK  tier=%s colisores=%d envMap=%s postfx=%s',
    boot.tier, boot.colliders, boot.hasEnv, boot.pipeline);
  if (boot.colliders < 50) throw new Error(`poucos colisores: ${boot.colliders}`);
  if (!boot.hasEnv) throw new Error('environment map nao gerado');

  // --- voo: sobe e acelera pra frente ---
  // Em SwiftShader o fps e baixissimo e o loop de fisica anda em camera lenta,
  // entao esperamos a CONDICAO, nao um tempo de relogio.
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.DF.drone.state.altitude > 4, null, { timeout: 30000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.DF.drone.state.hSpeed > 4, null, { timeout: 30000 });
  await page.keyboard.up('ArrowUp');

  const flight = await page.evaluate(() => {
    const s = window.DF.drone.state;
    return {
      alt: s.altitude, hSpeed: s.hSpeed, speed: s.speed,
      pos: [s.pos.x, s.pos.y, s.pos.z],
      finite: [s.pos, s.vel].every((v) => Number.isFinite(v.x + v.y + v.z)),
      fps: window.DF.loop.stats.fps,
      mode: s.mode,
    };
  });
  console.log('OK  voo: alt=%sm hSpeed=%sm/s fps=%s',
    flight.alt.toFixed(1), flight.hSpeed.toFixed(1), flight.fps.toFixed(0));
  if (!flight.finite) throw new Error('fisica produziu NaN/Infinity');
  if (flight.alt < 3) throw new Error(`o drone nao subiu (alt=${flight.alt})`);
  if (flight.hSpeed < 2) throw new Error(`inclinar nao gerou avanco (${flight.hSpeed} m/s)`);

  // --- ACRO ---
  await page.keyboard.press('KeyM');
  await wait(300);
  const acro = await page.evaluate(() => window.DF.drone.state.mode);
  if (acro !== 'acro') throw new Error(`toggle de modo falhou: ${acro}`);
  console.log('OK  modo ACRO ativa');

  // rotacao livre em ACRO: rola sem auto-nivelar
  await page.keyboard.down('ArrowLeft');
  await wait(900);
  await page.keyboard.up('ArrowLeft');
  const rolled = await page.evaluate(() => {
    const q = window.DF.drone.state.quat;
    const up = new window.DF.THREE.Vector3(0, 1, 0).applyQuaternion(q);
    return up.y;
  });
  if (rolled > 0.96) throw new Error(`ACRO nao rolou o drone (up.y=${rolled})`);
  console.log('OK  ACRO rotaciona livre (up.y=%s)', rolled.toFixed(2));

  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => {
    const up = new window.DF.THREE.Vector3(0, 1, 0)
      .applyQuaternion(window.DF.drone.state.quat);
    return up.y > 0.9;
  }, null, { timeout: 25000 }).catch(() => {});
  const leveled = await page.evaluate(() => {
    const q = window.DF.drone.state.quat;
    const up = new window.DF.THREE.Vector3(0, 1, 0).applyQuaternion(q);
    return up.y;
  });
  if (leveled < 0.9) throw new Error(`ANGLE nao auto-nivelou (up.y=${leveled})`);
  console.log('OK  ANGLE auto-nivela (up.y=%s)', leveled.toFixed(2));

  // --- camera FPV ---
  await page.keyboard.press('KeyC');
  await wait(400);
  const view = await page.evaluate(() => window.DF.rig.rig.mode);
  if (view !== 'fpv') throw new Error('toggle de camera falhou');
  await page.keyboard.press('KeyC');
  await wait(300);
  console.log('OK  camera alterna 3a pessoa <-> FPV');

  // --- o drone tem que ficar ENQUADRADO em qualquer regime de voo ---
  // Subida vertical era o caso que jogava a camera por baixo do drone e
  // enchia a tela de ceu. Testa subida, mergulho e voo nivelado.
  const regimes = [
    ['subida vertical', [0, 12, 0]],
    ['mergulho', [0, -16, 0]],
    ['voo nivelado', [18, 0, 0]],
    ['subida em diagonal', [10, 10, 0]],
  ];
  for (const [nome, v] of regimes) {
    await page.evaluate(([vx, vy, vz]) => {
      const d = window.DF.drone;
      d.state.pos.set(0, 60, 0);
      d.state.vel.set(vx, vy, vz);
    }, v);
    await wait(900);
    const framing = await page.evaluate(() => {
      const p = window.DF.drone.state.pos.clone().project(window.DF.camera);
      return { x: p.x, y: p.y, z: p.z };
    });
    const onScreen = Math.abs(framing.x) < 0.9 && Math.abs(framing.y) < 0.9 && framing.z < 1;
    if (!onScreen) {
      throw new Error(`drone fora de quadro em "${nome}": ndc=`
        + `${framing.x.toFixed(2)},${framing.y.toFixed(2)},${framing.z.toFixed(2)}`);
    }
    console.log('OK  enquadramento "%s" (ndc %s,%s)',
      nome, framing.x.toFixed(2), framing.y.toFixed(2));
  }

  // --- camera nunca entra na geometria ---
  const camOk = await page.evaluate(() => {
    const c = window.DF.camera.position;
    return window.DF.colliders.nearestDistance(c, 4) > 0.05;
  });
  if (!camOk) console.warn('AVISO: camera muito perto de geometria');
  else console.log('OK  camera fora da geometria');

  // --- crash e respawn ---
  // Joga o drone contra o chao a 30 m/s de UMA altura baixa, senao o tempo de
  // queda depende do fps do software rasterizer.
  await page.evaluate(() => {
    const d = window.DF.drone;
    d.state.pos.set(0, 3, 0);
    d.state.vel.set(0, -30, 0);
  });
  await page.waitForFunction(() => window.DF.drone.status.crashCount > 0, null, { timeout: 20000 });
  // e volta a voar sozinho depois do respawn
  await page.waitForFunction(() => !window.DF.drone.status.crashed, null, { timeout: 20000 });
  const afterCrash = await page.evaluate(() => ({
    crashes: window.DF.drone.status.crashCount,
    alt: window.DF.drone.state.altitude,
  }));
  if (afterCrash.crashes < 1) throw new Error('impacto forte nao gerou crash');
  console.log('OK  crash + respawn (crashes=%d)', afterCrash.crashes);

  // --- subsolo: a garagem precisa ser ALCANCAVEL ---
  // O plano de chao e infinito em y=0; sem abertura registrada o drone e
  // teleportado de volta pra rua e o subsolo vira cenario decorativo.
  await page.evaluate(() => {
    const T = window.DF.THREE;
    const g = window.DF.block.garage;
    window.DF.restart(new T.Vector3(g.x, g.y, g.z), Math.PI);
  });
  await wait(2500);
  const under = await page.evaluate(() => ({
    y: window.DF.drone.state.pos.y,
    camY: window.DF.camera.position.y,
    crashed: window.DF.drone.status.crashed,
  }));
  if (under.y > -0.5) throw new Error(`drone expulso do subsolo (y=${under.y.toFixed(2)})`);
  if (under.camY > 0.2) throw new Error(`camera saiu pelo teto da garagem (y=${under.camY.toFixed(2)})`);
  console.log('OK  subsolo alcancavel (drone y=%s, camera y=%s)',
    under.y.toFixed(2), under.camY.toFixed(2));

  // --- bateria drena ---
  const batt = await page.evaluate(() => window.DF.drone.status.battery);
  if (batt >= 100) throw new Error('bateria nao drenou');
  console.log('OK  bateria drena (%s%%)', batt.toFixed(1));

  if (WANT_SHOTS) {
    mkdirSync('shots', { recursive: true });
    await page.evaluate(() => {
      window.DF.drone.reset(new window.DF.THREE.Vector3(0, 14, 40), Math.PI);
      window.DF.rig.snap(window.DF.drone);
    });
    await wait(1200);
    await page.screenshot({ path: 'shots/chase.png' });
    console.log('OK  screenshot em shots/chase.png');
  }

  await browser.close();
} catch (e) {
  console.error('FALHA:', e.message);
  exitCode = 1;
}

if (errors.length) {
  console.error(`\n${errors.length} erro(s) de console/pagina:`);
  for (const e of errors.slice(0, 12)) console.error('  -', e);
  exitCode = 1;
} else {
  console.log('OK  sem erros de console');
}

server.kill('SIGKILL');
process.exit(exitCode);
