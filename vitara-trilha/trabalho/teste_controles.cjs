// teste_controles.cjs — Playwright: confere cada controle (gamepad e teclado) na página real, reproduz a volta
// gravada pelo gamepad falso e confere a vibração. Uso: node trabalho/teste_controles.cjs [caminho/da/pagina.html]
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'index.html');
if (!fs.existsSync(file)) { console.log(`(${path.relative(root, file)} não existe; usando trabalho/stub.html)`); file = path.join(__dirname, 'stub.html'); }
const url = 'file://' + file + '?test=1&norender=1';
const lap = JSON.parse(fs.readFileSync(path.join(__dirname, 'volta_comandos.json'), 'utf8'));
const rows = []; let fails = 0;
const ok = (c, name, info) => { rows.push((c ? 'PASS' : 'FAIL') + '  ' + name.padEnd(46) + (info ? '  ' + info : '')); console.log(rows[rows.length - 1]); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__t && window.__t.ready, null, { timeout: 60000 });
  await page.evaluate(() => window.__t.ready);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // ---------- (a) gamepad ligado DEPOIS da carga ----------
  const before = await ev(() => { const t = window.__t; t.step(2); return t.Input.padConnected; });
  await ev(() => {
    const t = window.__t, pad = { index: 0, id: 'Controle falso (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: [] };
    for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
    const calls = [];
    pad.vibrationActuator = { type: 'dual-rumble', playEffect(type, p) { calls.push({ type, w: p.weakMagnitude, s: p.strongMagnitude, d: p.duration, f: t.Game.simFrame, rum: t.Physics.rumble, wat: t.Physics.inWater, imp: t.Physics.impact }); return Promise.resolve('complete'); } };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
    const e = new Event('gamepadconnected'); e.gamepad = pad; window.dispatchEvent(e);
    const h = window.__h = {
      pad, calls,
      neutral() { for (const b of pad.buttons) { b.pressed = false; b.value = 0; } pad.axes[0] = pad.axes[1] = pad.axes[2] = pad.axes[3] = 0; },
      btn(i, v) { pad.buttons[i].value = v; pad.buttons[i].pressed = v > 0.5; },
      fresh() { h.neutral(); t.Game.paused = 0; t.step(40); t.Game.restart(); t.Game.cam = 0; },   // estado limpo e determinístico
      tap(i) { h.btn(i, 1); t.step(4); h.btn(i, 0); t.step(2); },
      yaw() { const q = t.Physics.quat; return Math.atan2(2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])); },
      teleportOff() { // 10 m para a esquerda da trilha
        const W = t.World, T = W.trk, i = Math.round(t.Game.trackS / T.ds) % T.n, P = t.Physics, o = T.hw[i] + 10;
        P.pos[0] = T.x[i] + T.tz[i] * o; P.pos[2] = T.z[i] - T.tx[i] * o; P.pos[1] = W.heightAt(P.pos[0], P.pos[2]) + 0.3; P.vel.fill(0); P.angVel.fill(0);
      },
    };
  });
  const after = await ev(() => { const t = window.__t; t.step(2); return [t.Input.padConnected, t.Input.padIndex]; });
  ok(before === 0 && after[0] === 1 && after[1] === 0, 'gamepad detectado sem recarregar', `padConnected ${before} -> ${after[0]}, índice ${after[1]}`);

  // ---------- (b) cada controle do gamepad ----------
  let r;
  r = await ev(() => { const t = window.__t, h = window.__h; h.fresh(); h.btn(7, 0.5); t.step(3); const half = t.Input.throttle; h.btn(7, 1); t.step(150); return { half, thr: t.Input.throttle, v: t.Physics.speed, kmh: t.Game.speedKmh, rev: t.Physics.reverse }; });
  ok(r.half === 0.5 && r.thr === 1 && r.v > 8 && r.rev === 0, 'RT  acelerador (proporcional)', `RT=0.5 -> ${r.half}; RT=1 por 2,5 s -> ${r.kmh.toFixed(0)} km/h`);
  r = await ev(() => { const t = window.__t, h = window.__h; h.btn(7, 0); const v0 = t.Physics.speed; h.btn(6, 0.5); t.step(2); const half = t.Input.brake; h.btn(6, 1); t.step(25); return { half, v0, v: t.Physics.speed, light: t.Physics.brakeLight, rev: t.Physics.reverse }; });
  ok(r.half === 0.5 && r.v < r.v0 - 3 && r.v > 0 && r.light === 1 && r.rev === 0, 'LT  freio em movimento + luz de freio', `${(r.v0 * 3.6).toFixed(0)} -> ${(r.v * 3.6).toFixed(0)} km/h em 0,45 s, brakeLight=${r.light}`);
  r = await ev(() => { const t = window.__t, h = window.__h; h.fresh(); h.btn(6, 1); t.step(150); const a = { v: t.Physics.speed, rev: t.Physics.reverse, gear: t.Physics.gear, s: t.Game.trackS }; return a; });
  ok(r.rev === 1 && r.v < -2 && r.gear === -1, 'LT  ré a partir do repouso', `${(r.v * 3.6).toFixed(0)} km/h, reverse=${r.rev}`);
  for (const dir of [-1, 1]) {
    r = await ev((dir) => { const t = window.__t, h = window.__h; h.fresh(); h.btn(7, 0.6); t.step(120); const y0 = h.yaw(); h.pad.axes[0] = dir; t.step(60); let dy = h.yaw() - y0; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI; return { st: t.Input.steer, ang: t.Physics.steerAngle, w: t.Physics.angVel[1], dy }; }, dir);
    ok(r.st === -dir && r.ang * -dir > 0.05 && r.w * -dir > 0.1 && r.dy * -dir > 0.2, `analógico esq. para a ${dir < 0 ? 'esquerda' : 'direita'}`, `Input.steer=${r.st}, rodas ${(r.ang * 57.3).toFixed(1)}°, rumo ${(r.dy * 57.3).toFixed(0)}°`);
  }
  r = await ev(() => { const t = window.__t, h = window.__h; h.fresh(); h.btn(7, 0.6); t.step(120); h.pad.axes[0] = 0.05; t.step(40); const a = [t.Input.steer, t.Physics.steerAngle]; h.pad.axes[0] = -0.11; t.step(40); a.push(t.Input.steer, t.Physics.steerAngle); h.pad.axes[0] = 0.56; t.step(2); a.push(t.Input.steer); return a; });
  ok(r[0] === 0 && r[1] === 0 && r[2] === 0 && r[3] === 0 && Math.abs(r[4] + 0.5) < 1e-9, 'analógico esq.: zona morta (0,05 e 0,11 = nada)', `0.05 -> ${r[0]}, -0.11 -> ${r[2]}, 0.56 -> ${r[4].toFixed(3)} (reescalado)`);
  r = await ev(() => { const t = window.__t, h = window.__h, G = t.Game; h.fresh(); h.pad.axes[2] = 1; t.step(40); const a = { yaw: G.camYaw, cx: t.Input.camX }; h.pad.axes[2] = 0; h.pad.axes[3] = -1; t.step(40); a.pitch = G.camPitch; a.yaw2 = G.camYaw; h.pad.axes[3] = 0.05; t.step(90); a.p3 = G.camPitch; a.y3 = G.camYaw; return a; });
  ok(r.cx === 1 && r.yaw > 1 && r.pitch < -0.2 && Math.abs(r.y3) < 0.01 && Math.abs(r.p3) < 0.01, 'analógico dir.: órbita da câmera', `camYaw ${r.yaw.toFixed(2)} rad, camPitch ${r.pitch.toFixed(2)}, soltar -> ${r.y3.toFixed(3)}/${r.p3.toFixed(3)}`);
  r = await ev(() => { const t = window.__t, h = window.__h, P = t.Physics; h.fresh(); h.btn(7, 1); t.step(180); h.btn(7, 0); h.btn(0, 1); t.step(20); const s2 = P.spin[2], s0 = P.spin[0], v0 = P.speed; t.step(20); return { hb: t.Input.handbrake, dr: P.spin[2] - s2, df: P.spin[0] - s0, v0, v: P.speed, light: P.brakeLight, slip: P.slip[2] }; });
  ok(r.hb === 1 && Math.abs(r.dr) < 0.01 && r.df > 2 && r.v < r.v0 && r.light === 1, 'A   freio de mão trava as traseiras', `giro traseiro ${r.dr.toFixed(3)} rad, dianteiro ${r.df.toFixed(1)} rad, slip ${r.slip.toFixed(2)}`);
  r = await ev(() => { const t = window.__t, h = window.__h, G = t.Game; h.fresh(); const a = [G.cam]; for (let i = 0; i < 3; i++) { h.btn(3, 1); t.step(8); h.btn(3, 0); t.step(2); a.push(G.cam); } return a; });
  ok(r.join() === '0,1,2,0', 'Y   troca de câmera 0->1->2->0', `${r.join(' -> ')} (segurar 8 quadros conta uma vez)`);
  r = await ev(() => { const t = window.__t, h = window.__h, G = t.Game; h.fresh(); h.btn(7, 1); t.step(240); h.btn(7, 0); const s0 = G.trackS; h.teleportOff(); t.step(20); const a = { off: G.offTrack, t0: G.trackT, msg0: G.msg, s0 }; h.tap(1); a.off1 = G.offTrack; a.t1 = G.trackT; a.s1 = G.trackS; a.v = t.Physics.speed; a.resets = G.resets; a.msg = G.msg; t.step(60); a.t2 = G.trackT; a.stuck = t.Physics.stuck; a.lap = G.lapActive; return a; });
  ok(r.off === 1 && r.msg0 === 5 && r.off1 === 0 && Math.abs(r.t1) < 0.3 && Math.abs(r.t2) < 0.3 && Math.abs(r.v) < 0.5 && r.resets === 1 && r.msg === 4 && r.s1 < r.s0 && r.s1 > r.s0 - 8 && !r.stuck && r.lap === 1, 'B   volta para a trilha', `t=${r.t0.toFixed(1)} m (offTrack=1) -> t=${r.t1.toFixed(2)} m, s ${r.s0.toFixed(0)} -> ${r.s1.toFixed(0)}, parado, volta segue correndo`);
  r = await ev(() => { const t = window.__t, h = window.__h, G = t.Game, P = t.Physics; h.fresh(); h.btn(7, 1); t.step(60); h.tap(9); const a = { p: G.paused, f: G.simFrame, z: P.pos[2], x: P.pos[0], tm: G.timeMs }; t.step(60); a.f2 = G.simFrame; a.same = P.pos[2] === a.z && P.pos[0] === a.x && G.timeMs === a.tm; h.tap(9); a.p2 = G.paused; t.step(30); a.f3 = G.simFrame; a.moved = P.pos[2] !== a.z || P.pos[0] !== a.x; return a; });
  ok(r.p === 1 && r.f2 === r.f && r.same && r.p2 === 0 && r.f3 > r.f && r.moved, 'Start pausa e a simulação para', `pausado: simFrame ${r.f} -> ${r.f2}; solto: -> ${r.f3}`);

  // ---------- teclado ----------
  const key = async (code, frames) => { await page.keyboard.down(code); const v = await ev((n) => { window.__t.step(n); }, frames); return v; };
  const st = () => ev(() => { const t = window.__t, I = t.Input, P = t.Physics, G = t.Game; return { thr: I.throttle, brk: I.brake, steer: I.steer, hb: I.handbrake, v: P.speed, rev: P.reverse, ang: P.steerAngle, cam: G.cam, paused: G.paused, f: G.simFrame, light: P.brakeLight, off: G.offTrack, t: G.trackT, resets: G.resets, w2: P.wheelW ? P.wheelW[2] : 0 }; });
  await ev(() => window.__h.fresh());
  await key('KeyW', 120); r = await st(); await page.keyboard.up('KeyW'); await ev(() => window.__t.step(2)); let r2 = await st();
  ok(r.thr === 1 && r.v > 6 && r2.thr === 0, 'tecla W  acelera', `${(r.v * 3.6).toFixed(0)} km/h em 2 s`);
  await key('KeyS', 20); r = await st(); ok(r.brk === 1 && r.v < r2.v - 2 && r.light === 1, 'tecla S  freia em movimento', `${(r2.v * 3.6).toFixed(0)} -> ${(r.v * 3.6).toFixed(0)} km/h`);
  await ev(() => window.__t.step(200)); r = await st(); await page.keyboard.up('KeyS'); ok(r.rev === 1 && r.v < -2, 'tecla S  ré depois de parar', `${(r.v * 3.6).toFixed(0)} km/h`);
  await ev(() => window.__h.fresh()); await key('KeyW', 90);
  await key('KeyA', 4); r = await st(); await ev(() => window.__t.step(50)); r2 = await st(); await page.keyboard.up('KeyA');
  ok(r.steer > 0.05 && r.steer < 0.5 && r2.steer === 1 && r2.ang > 0.05, 'tecla A  esterça à esquerda (em rampa)', `4 quadros: ${r.steer.toFixed(2)}; 54 quadros: ${r2.steer}`);
  await ev(() => window.__t.step(40)); r = await st(); const centered = r.steer === 0;
  await key('KeyD', 4); r = await st(); await ev(() => window.__t.step(50)); r2 = await st(); await page.keyboard.up('KeyD');
  ok(centered && r.steer < -0.05 && r.steer > -0.5 && r2.steer === -1 && r2.ang < -0.05, 'tecla D  esterça à direita (em rampa)', `4 quadros: ${r.steer.toFixed(2)}; 54 quadros: ${r2.steer}; solto volta a 0`);
  await ev(() => window.__h.fresh()); await key('KeyW', 150); await page.keyboard.up('KeyW');
  await key('Space', 25); r = await st(); await page.keyboard.up('Space'); await ev(() => window.__t.step(2)); r2 = await st();
  ok(r.hb === 1 && Math.abs(r.w2) < 0.01 && r.light === 1 && r2.hb === 0, 'tecla Espaço  freio de mão', `roda traseira ${r.w2.toFixed(3)} rad/s a ${(r.v * 3.6).toFixed(0)} km/h`);
  await ev(() => window.__h.fresh()); const cams = [];
  for (let i = 0; i < 3; i++) { await key('KeyC', 5); await page.keyboard.up('KeyC'); await ev(() => window.__t.step(2)); cams.push((await st()).cam); }
  ok(cams.join() === '1,2,0', 'tecla C  troca de câmera', `0 -> ${cams.join(' -> ')}`);
  await ev(() => { const t = window.__t, h = window.__h; h.fresh(); h.btn(7, 1); t.step(200); h.btn(7, 0); h.teleportOff(); t.step(20); }); r = await st();
  await key('KeyR', 3); await page.keyboard.up('KeyR'); r2 = await st();
  ok(r.off === 1 && r2.off === 0 && Math.abs(r2.t) < 0.3 && r2.resets === 1 && Math.abs(r2.v) < 0.5, 'tecla R  volta para a trilha', `t ${r.t.toFixed(1)} m -> ${r2.t.toFixed(2)} m`);
  for (const k of ['Escape', 'KeyP']) {
    await ev(() => window.__h.fresh()); await key(k, 2); await page.keyboard.up(k); r = await st(); await ev(() => window.__t.step(30)); r2 = await st();
    await key(k, 2); await page.keyboard.up(k); await ev(() => window.__t.step(10)); const r3 = await st();
    ok(r.paused === 1 && r2.f === r.f && r3.paused === 0 && r3.f > r.f, `tecla ${k === 'Escape' ? 'Esc' : 'P'}  pausa`, `simFrame parado em ${r.f}, depois ${r3.f}`);
  }

  // ---------- (c) volta gravada, pelo gamepad falso ----------
  r = await ev((frames) => {
    const t = window.__t, h = window.__h, G = t.Game, P = t.Physics; h.fresh(); h.calls.length = 0;
    const R = { maxOut: -1e9, cps: 0, off: 0, stuck: false, lapFrame: -1, n: frames.length }; let last = G.cp;
    for (let f = 0; f < frames.length; f++) {
      const c = frames[f]; h.btn(7, c[0]); h.btn(6, c[1]); h.pad.axes[0] = c[2]; t.step(1);
      const o = Math.abs(G.trackT) - G.trackHw; if (o > R.maxOut) R.maxOut = o;
      if (G.cp !== last) { R.cps++; last = G.cp; } if (G.offTrack) R.off++; if (P.stuck) R.stuck = true; if (G.laps >= 1 && R.lapFrame < 0) R.lapFrame = f;
    }
    R.laps = G.laps; R.lastMs = G.lastMs; R.best = G.bestMs; R.resets = G.resets; R.nCp = G.nCp; R.s = G.trackS; R.calls = h.calls.slice();
    return R;
  }, lap.frames);
  ok(r.n === 3600 && r.laps >= 1 && r.lapFrame < 58 * 60, 'volta gravada: volta completa', `tempo da volta ${(r.lastMs / 1000).toFixed(3)} s, fechada no quadro ${r.lapFrame} (${(r.lapFrame / 60).toFixed(2)} s)`);
  ok(r.cps >= r.nCp + 1, 'volta gravada: todos os checkpoints', `${r.cps} cruzamentos (${r.nCp} por volta)`);
  ok(r.maxOut < 0 && r.off === 0 && r.resets === 0 && !r.stuck, 'volta gravada: nunca saiu da trilha', `margem mínima ${(-r.maxOut).toFixed(2)} m, resets ${r.resets}`);

  // ---------- (d) vibração ----------
  const calls = r.calls, grav = calls.filter((c) => c.rum > 0.25 && c.wat === 0 && c.imp === 0), agua = calls.filter((c) => c.wat > 0.06);
  let dense = 0; for (let i = 0; i < calls.length; i++) { let n = 0; for (let j = i; j < calls.length && calls[j].f < calls[i].f + 60; j++) n++; if (n > dense) dense = n; }
  const avg = (a, k) => a.reduce((s, c) => s + c[k], 0) / Math.max(1, a.length);
  ok(calls.length > 20 && calls.every((c) => c.type === 'dual-rumble' && c.w >= 0 && c.w <= 1 && c.s >= 0 && c.s <= 1 && c.d > 0), 'vibração chega a playEffect(dual-rumble)', `${calls.length} chamadas em 60 s`);
  ok(dense <= 10, 'vibração limitada a ~10 chamadas/s', `máx ${dense} em 1 s`);
  ok(grav.length > 5 && avg(grav, 'w') > 0.1 && avg(grav, 's') < 0.05, 'vibração leve no cascalho', `${grav.length} chamadas, fraco ${avg(grav, 'w').toFixed(2)}, forte ${avg(grav, 's').toFixed(2)}`);
  ok(agua.length > 1 && avg(agua, 's') > 0.3, 'vibração forte no riacho', `${agua.length} chamadas, forte ${avg(agua, 's').toFixed(2)}`);
  ok(errs.length === 0, 'sem erros de JavaScript na página', errs.slice(0, 3).join(' | '));

  await browser.close();
  const head = `Teste de controles — ${path.relative(root, file)} — ${fails ? fails + ' FALHA(S)' : 'tudo certo'}\n`;
  fs.writeFileSync(path.join(__dirname, 'relatorio_controles.txt'), head + rows.join('\n') + '\n');
  console.log('\n' + head); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
