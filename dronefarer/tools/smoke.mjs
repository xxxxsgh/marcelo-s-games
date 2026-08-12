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

  // ------------------------------------------------------------------
  // FASE 2 — corrida
  // ------------------------------------------------------------------
  // Percorre o circuito teleportando de um lado ao outro de cada gate. A
  // deteccao e por cruzamento de plano entre dois passos, entao isso exercita
  // exatamente o caminho real (inclusive o sentido de passagem).
  // Espera FRAMES de verdade, nao milissegundos: com o rasterizador de
  // software um frame passa de 200 ms e um wait fixo nao garante nada.
  const frames = (n = 3) => page.evaluate((k) => new Promise((res) => {
    let i = 0;
    const tick = () => { i += 1; if (i >= k) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), n);

  async function runCircuit(id) {
    await page.evaluate((cid) => {
      window.DF.race.load(cid);
      window.DF.restartRace();
    }, id);
    await frames(3);

    const n = await page.evaluate(() => window.DF.race.gates.length);
    for (let i = 0; i < n; i++) {
      // atras do gate
      await page.evaluate((gi) => {
        const g = window.DF.race.gates[gi];
        const d = window.DF.drone.state;
        d.pos.copy(g.center).addScaledVector(g.normal, -5);
        d.vel.set(0, 0, 0);
      }, i);
      await frames(3);
      // na frente do gate (cruza o plano pelo centro)
      await page.evaluate((gi) => {
        const g = window.DF.race.gates[gi];
        const d = window.DF.drone.state;
        d.pos.copy(g.center).addScaledVector(g.normal, 5);
        d.vel.set(0, 0, 0);
      }, i);
      await frames(3);
    }
    return page.evaluate(() => ({
      status: window.DF.race.state.status,
      gateIndex: window.DF.race.state.gateIndex,
      time: window.DF.race.state.time,
      splits: window.DF.race.state.splits.length,
      medal: window.DF.race.state.medal,
      newRecord: window.DF.race.state.newRecord,
      total: window.DF.race.gates.length,
    }));
  }

  for (const cid of ['aberto', 'tecnico', 'vertical']) {
    const r = await runCircuit(cid);
    if (r.status !== 'finished') {
      throw new Error(`circuito "${cid}" nao terminou: ${r.gateIndex}/${r.total} gates`);
    }
    if (r.splits !== r.total) {
      throw new Error(`circuito "${cid}": ${r.splits} splits pra ${r.total} gates`);
    }
    console.log('OK  circuito "%s" completo: %d gates, %ss, medalha=%s',
      cid, r.total, r.time.toFixed(2), r.medal || 'nenhuma');
  }

  // recorde persistido + ghost gravado
  const persisted = await page.evaluate(() => {
    const raw = localStorage.getItem('dronefarer.save.v1');
    if (!raw) return null;
    const s = JSON.parse(raw);
    const rec = s.records && s.records.vertical;
    return rec ? { time: rec.time, ghostSamples: (rec.ghost || []).length / 8,
      splits: rec.splits.length, medal: rec.medal } : null;
  });
  if (!persisted) throw new Error('recorde nao foi salvo no localStorage');
  if (persisted.ghostSamples < 3) {
    throw new Error(`ghost gravado com ${persisted.ghostSamples} amostras`);
  }
  console.log('OK  recorde salvo (%ss, %d amostras de fantasma)',
    persisted.time.toFixed(2), persisted.ghostSamples);

  // o fantasma tem que reproduzir a volta salva
  const ghostOk = await page.evaluate(() => {
    window.DF.race.load('vertical');
    window.DF.restartRace();
    const g = window.DF.race.ghost;
    if (!g.hasData) return { ok: false, why: 'sem dados' };
    const p = g.update(g.duration * 0.5, true);
    return { ok: !!p && Number.isFinite(p.x), duration: g.duration };
  });
  if (!ghostOk.ok) throw new Error(`fantasma nao reproduz: ${ghostOk.why || ''}`);
  console.log('OK  fantasma reproduz a volta salva (%ss)', ghostOk.duration.toFixed(2));

  // reinicio instantaneo: R rearma sem loading
  await page.evaluate(() => { window.DF.race.state.time = 9; });
  await page.keyboard.press('KeyR');
  await wait(500);
  const rearmed = await page.evaluate(() => ({
    status: window.DF.race.state.status,
    time: window.DF.race.state.time,
    gate: window.DF.race.state.gateIndex,
  }));
  if (rearmed.status !== 'armed' || rearmed.gate !== 0) {
    throw new Error(`R nao rearmou a corrida: ${JSON.stringify(rearmed)}`);
  }
  console.log('OK  R reinicia instantaneo (status=%s)', rearmed.status);

  // ------------------------------------------------------------------
  // FASE 3 — cidade aberta
  // ------------------------------------------------------------------
  await page.evaluate(() => {
    const T = window.DF.THREE;
    window.DF.restart(new T.Vector3(700, 60, 700), 0);
  });
  await frames(30);
  const cityInfo = await page.evaluate(() => ({
    loaded: window.DF.city.stats.loaded,
    buildings: window.DF.city.stats.buildings,
    lastBuildMs: window.DF.city.stats.lastBuildMs,
    colliders: window.DF.colliders.count,
  }));
  if (cityInfo.loaded < 5) throw new Error(`cidade nao streamou: ${cityInfo.loaded} chunks`);
  if (cityInfo.buildings < 50) throw new Error(`poucos predios: ${cityInfo.buildings}`);
  console.log('OK  cidade streamou %d chunks / %d predios (pior chunk %sms)',
    cityInfo.loaded, cityInfo.buildings, cityInfo.lastBuildMs.toFixed(1));

  // os cinco distritos existem e sao distintos
  const districts = await page.evaluate(() => {
    const T = window.DF.THREE;
    const probes = {
      centro: [0, 0], portuaria: [0, -600], parque: [0, 600],
      antigo: [-600, 0], morro: [600, 0],
    };
    const out = {};
    for (const [name, [x, z]] of Object.entries(probes)) {
      out[name] = window.DF.city.districtAtPos(new T.Vector3(x, 30, z)).id;
    }
    return out;
  });
  for (const [want, got] of Object.entries(districts)) {
    if (want !== got) throw new Error(`distrito errado em ${want}: veio ${got}`);
  }
  console.log('OK  cinco distritos no lugar (%s)', Object.values(districts).join(', '));

  // descarrega ao voltar
  await page.evaluate(() => {
    const T = window.DF.THREE;
    window.DF.restart(new T.Vector3(0, 40, 0), 0);
  });
  await frames(40);
  const afterUnload = await page.evaluate(() => window.DF.city.stats.loaded);
  console.log('OK  chunks descarregados ao voltar (%d ativos)', afterUnload);

  // sinal de radio cai com a distancia
  const signal = await page.evaluate(async () => {
    const T = window.DF.THREE;
    const read = () => window.DF.pois.state.signal;
    window.DF.restart(new T.Vector3(0, 30, 0), 0);
    await new Promise((r) => setTimeout(r, 600));
    const perto = read();
    window.DF.restart(new T.Vector3(1400, 30, 0), 0);
    await new Promise((r) => setTimeout(r, 1600));
    return { perto, longe: read() };
  });
  if (!(signal.longe < signal.perto - 0.2)) {
    throw new Error(`sinal nao degradou com a distancia: ${JSON.stringify(signal)}`);
  }
  console.log('OK  sinal cai com a distancia (%s -> %s)',
    signal.perto.toFixed(2), signal.longe.toFixed(2));

  // zona restrita dispara alarme e perseguicao
  const zone = await page.evaluate(async () => {
    const T = window.DF.THREE;
    const z = window.DF.pois.restricted[2];
    window.DF.restart(new T.Vector3(z.x, 40, z.z), 0);
    await new Promise((r) => setTimeout(r, 6000));
    return { chasing: window.DF.pois.state.chasing, units: window.DF.security.count };
  });
  if (!zone.chasing || zone.units < 1) {
    throw new Error(`zona restrita nao disparou perseguicao: ${JSON.stringify(zone)}`);
  }
  console.log('OK  zona restrita dispara perseguicao (%d drones)', zone.units);
  await page.evaluate(() => { window.DF.security.despawn(); window.DF.pois.resetAlert(); });

  // recarga devolve bateria
  const recharge = await page.evaluate(async () => {
    const T = window.DF.THREE;
    const r = window.DF.pois.recharge[1];
    window.DF.restart(new T.Vector3(r.x, r.y, r.z), 0);
    window.DF.drone.status.battery = 30;
    await new Promise((res) => setTimeout(res, 1500));
    return window.DF.drone.status.battery;
  });
  if (recharge <= 30) throw new Error(`ponto de recarga nao recarregou (${recharge})`);
  console.log('OK  ponto de recarga devolve bateria (30%% -> %s%%)', recharge.toFixed(0));

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
