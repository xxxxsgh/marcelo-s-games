// gravar_volta.cjs — grava 60 s (3600 quadros a 60 fps) de comandos do piloto automático passando pelo
// caminho real Input -> Game (gamepad padrão simulado), salva volta_comandos.json, e depois REPRODUZ o JSON
// do zero conferindo: volta completa, checkpoints, sempre dentro da trilha, sem reset, estado final idêntico.
const fs = require('fs'), path = require('path');
require('child_process').execFileSync('node', [path.join(__dirname, 'sim_bundle.mjs')]);
const S = require('./sim.cjs'), W = S.World, P = S.Physics, G = S.Game, I = S.Input;
const Autopilot = new Function('World', 'Physics', fs.readFileSync(path.join(__dirname, 'autopilot.js'), 'utf8') + '\nreturn Autopilot;')(W, P);
const FRAMES = 3600, OUT = path.join(__dirname, 'volta_comandos.json'), VERBOSE = process.argv.includes('-v');

const pad = { index: 0, connected: true, mapping: 'standard', id: 'piloto', axes: [0, 0, 0, 0], buttons: [] };
for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true, writable: true });
const r3 = (x) => Math.round(x * 1000) / 1000;

S.worldInit(); G.init(); Autopilot.init(); G.fixedDt = true;

function runLap(frames) { // frames = null -> piloto automático; senão reproduz
  G.restart(); I.padIndex = -1;
  const rec = [], R = { maxOut: -1e9, maxOutS: 0, lapFrame: -1, gateFrame: -1, stuck: false, off: 0, cps: 0, vmax: 0, air: 0, maxImp: 0, minUp: 1, cp0: 0, wheelsOff: 0, maxSteerRate: 0 };
  let lastCp = G.cp, lastSx = 0, lastD = 0; R.rev = 0;
  for (let f = 0; f < FRAMES; f++) {
    let c;
    if (frames) c = frames[f]; else { Autopilot.drive(); c = [r3(Autopilot.rt), r3(Autopilot.lt), r3(Autopilot.sx)]; rec.push(c); }
    pad.buttons[7].value = c[0]; pad.buttons[7].pressed = c[0] > 0.5; pad.buttons[6].value = c[1]; pad.buttons[6].pressed = c[1] > 0.5; pad.axes[0] = c[2];
    G.update(1 / 60);
    const out = Math.abs(G.trackT) - G.trackHw; if (out > R.maxOut) { R.maxOut = out; R.maxOutS = G.trackS; }
    if (G.cp !== lastCp) { R.cps++; lastCp = G.cp; if (VERBOSE && !frames) console.log(`  quadro ${f} (${(f / 60).toFixed(2)} s): checkpoint em s=${G.trackS.toFixed(0)}, ${G.speedKmh.toFixed(0)} km/h`); }
    if (G.lapActive && R.gateFrame < 0) R.gateFrame = f;
    if (G.laps >= 1 && R.lapFrame < 0) R.lapFrame = f;
    if (P.stuck) R.stuck = true; if (G.offTrack) R.off++;
    R.vmax = Math.max(R.vmax, G.speedKmh); if (P.nContact === 0) R.air++; R.maxImp = Math.max(R.maxImp, P.impact);
    R.minUp = Math.min(R.minUp, 1 - 2 * (P.quat[0] * P.quat[0] + P.quat[2] * P.quat[2]));
    for (let i = 0; i < 4; i++) if (W.trackQ(P.cx[i], P.cz[i]) && Math.abs(W.tq.t) > W.tq.hw) { R.wheelsOff++; break; }
    { const d = I.steer - lastSx; R.maxSteerRate = Math.max(R.maxSteerRate, Math.abs(d) * 60); if (d * lastD < 0 && Math.abs(d) > 0.02) R.rev++; if (d !== 0) lastD = d; lastSx = I.steer; }
    if (VERBOSE && !frames && f % 30 === 0) console.log(`${(f / 60).toFixed(1).padStart(5)} s  s=${G.trackS.toFixed(0).padStart(4)}  t=${G.trackT.toFixed(2).padStart(6)} hw=${G.trackHw.toFixed(1)}  v=${G.speedKmh.toFixed(0).padStart(3)} alvo=${(Autopilot.vTarget * 3.6).toFixed(0).padStart(3)}  rt=${c[0]} lt=${c[1]} sx=${c[2]}  piso=${P.surf[0]} slip=${Math.max(...P.slip).toFixed(2)} ar=${4 - P.nContact}`);
  }
  R.state = [...P.pos, ...P.quat, ...P.vel, ...P.angVel, ...P.spin, G.timeMs, G.lastMs, G.laps, G.cp, G.trackS];
  R.lastMs = G.lastMs; R.laps = G.laps; R.resets = G.resets; R.rec = rec;
  return R;
}

const A = runLap(null);
fs.writeFileSync(OUT, JSON.stringify({ fps: 60, frames: A.rec }));
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const B = runLap(data.frames);

let fails = 0; const ok = (c, name, info) => { console.log((c ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); if (!c) fails++; };
console.log(`gravação: ${data.frames.length} quadros -> ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`);
ok(data.fps === 60 && data.frames.length === FRAMES, 'JSON com 3600 quadros a 60 fps');
ok(B.cps >= W.checkpoints.length + 1, 'todos os checkpoints passados em ordem', `${B.cps} cruzamentos (${W.checkpoints.length} por volta)`);
ok(B.laps >= 1, 'volta completa', `tempo da volta ${(B.lastMs / 1000).toFixed(3)} s; porteira no quadro ${B.gateFrame} (${(B.gateFrame / 60).toFixed(2)} s), volta fechada no quadro ${B.lapFrame} (${(B.lapFrame / 60).toFixed(2)} s desde a largada parada)`);
ok(B.lapFrame >= 0 && B.lapFrame < 58 * 60, 'volta fechada em menos de 58 s desde a largada');
ok(B.maxOut < 0, 'nunca saiu da trilha (centro do carro)', `margem mínima até a borda ${(-B.maxOut).toFixed(2)} m (em s=${B.maxOutS.toFixed(0)}); quadros com alguma roda fora da faixa: ${B.wheelsOff}`);
ok(B.resets === 0 && B.off === 0, 'sem reset e sem "fora da trilha"');
ok(!B.stuck, 'Physics.stuck nunca ligou', `menor up.y ${B.minUp.toFixed(3)}`);
ok(B.state.every((v, i) => Object.is(v, A.state[i])) && B.lapFrame === A.lapFrame, 'reprodução idêntica bit a bit à gravação');
console.log(`velocidade máx ${B.vmax.toFixed(0)} km/h, quadros com as 4 rodas no ar ${B.air}, impacto máx ${B.maxImp.toFixed(2)}, maior variação do esterço ${B.maxSteerRate.toFixed(1)}/s (1 = batente), inversões bruscas do volante ${B.rev}, posição final s=${B.state[B.state.length - 1].toFixed(0)} (2ª volta)`);
console.log(fails ? `${fails} FALHA(S)` : 'volta gravada e conferida'); process.exit(fails ? 1 : 0);
