// teste_fisica.cjs — testes da física isolada (node). Sai com código != 0 se algo falhar.
require('child_process').execFileSync('node', [__dirname + '/sim_bundle.mjs']);
const S = require('./sim.cjs'), W = S.World, P = S.Physics;
S.worldInit();
const DT = 1 / 120; let fails = 0;
const ok = (c, name, info) => { console.log((c ? 'PASS ' : 'FAIL ') + name + (info ? '  — ' + info : '')); if (!c) fails++; };
const run = (sec, thr, brk, st, hb, each) => { const n = Math.round(sec * 120); for (let i = 0; i < n; i++) { P.step(DT, thr, brk, st, hb); if (each) each(i); } };
const yaw = () => { const q = P.quat; return Math.atan2(2 * (q[0] * q[2] + q[3] * q[1]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])); };
const up = () => { const q = P.quat; return [2 * (q[0] * q[1] - q[3] * q[2]), 1 - 2 * (q[0] * q[0] + q[2] * q[2]), 2 * (q[1] * q[2] + q[3] * q[0])]; };
const fwd = () => { const q = P.quat; return [2 * (q[0] * q[2] + q[3] * q[1]), 2 * (q[1] * q[2] - q[3] * q[0]), 1 - 2 * (q[0] * q[0] + q[1] * q[1])]; };
const finite = () => [...P.pos, ...P.quat, ...P.vel, ...P.angVel, P.speed, P.rpm, ...P.wy, ...P.spin].every(Number.isFinite);
const real = { heightAt: W.heightAt, heightRaw: W.heightRaw, surfaceAt: W.surfaceAt, queryCol: W.queryCol, col: W.col };
// mundo sintético: plano inclinado (gz = declive ao longo de +Z), piso escolhido
const TAB = { grip: [1.00, 0.88, 0.62, 0.70, 0.78, 0.95, 0.92], drag: [0.015, 0.03, 0.10, 0.16, 0.07, 0.012, 0.035], rumble: [0.05, 0.30, 0.08, 0.55, 0.10, 0.18, 0.40] };
function synth(gz, type, water) {
  const h = (x, z) => 20 + gz * z; W.heightAt = h; W.heightRaw = h; W.queryCol = () => 0;
  W.surfaceAt = () => { const sf = W.sf; sf.type = type; sf.grip = TAB.grip[type]; sf.drag = TAB.drag[type]; sf.rumble = TAB.rumble[type]; sf.wet = water ? 1 : 0; sf.water = water || 0; sf.dust = 0; return type; };
}
function restore() { Object.assign(W, real); }
// coloca o carro no mundo sintético apontando para +Z
function place() { const pa = W.poseAt; W.poseAt = (s, o) => { o[0] = 0; o[2] = 0; o[1] = W.heightAt(0, 0); o[3] = 0; }; P.reset(0); W.poseAt = pa; }

// 1) repouso na largada (mundo real)
P.init();
{
  run(2, 0, 0, 0, 0); const p0 = [...P.pos]; run(6, 0, 0, 0, 0);
  const d = Math.hypot(P.pos[0] - p0[0], P.pos[1] - p0[1], P.pos[2] - p0[2]);
  ok(d < 0.01 && Math.abs(P.speed) < 0.01, 'repouso na largada: assenta e fica parado', `deslocou ${(d * 1000).toFixed(2)} mm em 6 s, wy=${[...P.wy].map(v => v.toFixed(3))}`);
  ok([...P.wy].every(v => Math.abs(v - 0.362) < 0.03) && [...P.contact].every(v => v === 1), 'repouso: rodas na altura de descanso e em contato');
}
// 1b) repouso no trecho mais inclinado da trilha
{
  const T = W.trk; let bi = 0, bs = 0; for (let i = 0; i < T.n; i++) { const g = Math.abs(T.y[(i + 6) % T.n] - T.y[i]) / (6 * T.ds); if (g > bs) { bs = g; bi = i; } }
  P.reset(bi * T.ds); run(2, 0, 0, 0, 0); const p0 = [...P.pos]; run(8, 0, 0, 0, 0);
  const d = Math.hypot(P.pos[0] - p0[0], P.pos[2] - p0[2]);
  ok(d < 0.03, 'repouso em rampa (trecho mais inclinado)', `declive ${(bs * 100).toFixed(0)}% em s=${(bi * T.ds).toFixed(0)}, deslocou ${(d * 1000).toFixed(1)} mm em 8 s`);
}
// 2) aceleração e velocidade máxima (plano, terra batida)
synth(0, 0); place(); run(1, 0, 0, 0, 0);
{
  let t60 = -1, t100 = -1; run(45, 1, 0, 0, 0, (i) => { if (t60 < 0 && P.speed * 3.6 >= 60) t60 = (i + 1) / 120; if (t100 < 0 && P.speed * 3.6 >= 100) t100 = (i + 1) / 120; });
  const top = P.speed * 3.6;
  ok(t60 > 3.4 && t60 < 5.2, 'acelerador: 0-60 km/h', `${t60.toFixed(2)} s (0-100 em ${t100.toFixed(2)} s)`);
  ok(top > 114 && top < 126, 'velocidade máxima ~120 km/h', `${top.toFixed(1)} km/h, marcha ${P.gear}, ${P.rpm.toFixed(0)} rpm`);
  ok(Math.abs(P.pos[0]) < 0.5, 'anda reto sem esterço', `desvio lateral ${P.pos[0].toFixed(3)} m em ${P.pos[2].toFixed(0)} m`);
}
// 3) freio (com mergulho da frente)
{
  place(); run(1, 0, 0, 0, 0); run(30, 1, 0, 0, 0, () => { }); while (P.speed > 16.67) P.step(DT, 0, 0, 0, 0);
  const z0 = P.pos[2]; let t = 0, minPitch = 0, light = 0;
  while (P.speed > 0.3 && t < 10) { P.step(DT, 0, 1, 0, 0); t += DT; const f = fwd(); if (f[1] < minPitch) minPitch = f[1]; light = Math.max(light, P.brakeLight); }
  ok(t < 2.6 && P.pos[2] - z0 < 22, 'freio para o carro (60 km/h -> 0)', `${t.toFixed(2)} s, ${(P.pos[2] - z0).toFixed(1)} m`);
  ok(minPitch < -0.012 && light === 1, 'mergulho na frenagem + luz de freio', `inclinação ${(Math.asin(-minPitch) * 57.3).toFixed(1)}°`);
}
// 4) ré: freio segurado a partir do repouso; acelerador durante a ré freia primeiro
{
  place(); run(1, 0, 0, 0, 0); run(3, 0, 1, 0, 0);
  ok(P.speed < -3 && P.reverse === 1 && P.gear === -1, 'freio segurado em repouso engata a ré', `${(P.speed * 3.6).toFixed(1)} km/h`);
  run(20, 0, 1, 0, 0); ok(P.speed > -11.5, 'ré limitada', `${(P.speed * 3.6).toFixed(1)} km/h`);
  const v0 = P.speed; run(0.4, 1, 0, 0, 0); const stillRev = P.reverse === 1 && P.speed > v0 + 1 && P.speed < 0, bl = P.brakeLight; run(4, 1, 0, 0, 0);
  ok(stillRev && bl === 1 && P.reverse === 0 && P.speed > 3, 'acelerador durante a ré: freia e depois avança', `${(P.speed * 3.6).toFixed(1)} km/h`);
}
// 5) esterço (com rolagem da carroceria para fora da curva)
for (const dir of [1, -1]) {
  place(); run(1, 0, 0, 0, 0); while (P.speed < 11) P.step(DT, 1, 0, 0, 0);
  const y0 = yaw(), x0 = P.pos[0]; let roll = 0; run(1.5, 0.4, 0, dir, 0, () => { const u = up(), f = fwd(); const r = u[0] * f[2] - u[2] * f[0]; if (Math.abs(r) > Math.abs(roll)) roll = r; });
  let dy = yaw() - y0; if (dy > Math.PI) dy -= 2 * Math.PI; if (dy < -Math.PI) dy += 2 * Math.PI;
  ok(dy * dir > 0.4 && (P.pos[0] - x0) * dir > 1 && P.steerAngle * dir > 0 && P.angVel[1] * dir > 0, `esterço para a ${dir > 0 ? 'esquerda' : 'direita'} vira para a ${dir > 0 ? 'esquerda (+X)' : 'direita (-X)'}`, `yaw ${(dy * 57.3).toFixed(0)}°, rolagem máx ${(Math.asin(roll) * 57.3).toFixed(1)}° (${roll * dir < 0 ? 'para fora' : 'para dentro'})`);
  ok(roll * dir < -0.02 && up()[1] > 0.9, '  carroceria rola para fora da curva e não capota');
}
// 6) freio de mão trava as rodas traseiras
{
  place(); run(1, 0, 0, 0, 0); while (P.speed < 15) P.step(DT, 1, 0, 0, 0);
  run(0.3, 0, 0, 0, 1); const s2 = P.spin[2], s3 = P.spin[3], s0 = P.spin[0], v0 = P.speed; run(0.5, 0, 0, 0, 1);
  ok(Math.abs(P.spin[2] - s2) < 0.01 && Math.abs(P.spin[3] - s3) < 0.01 && P.spin[0] - s0 > 5 && P.speed < v0 - 1 && P.slip[2] > 0.5 && P.brakeLight === 1,
    'freio de mão trava as rodas traseiras', `giro traseiro ${(P.spin[2] - s2).toFixed(3)} rad, dianteiro ${(P.spin[0] - s0).toFixed(1)} rad, ${(v0 * 3.6).toFixed(0)} -> ${(P.speed * 3.6).toFixed(0)} km/h`);
  run(6, 0, 0, 0, 1); const z = P.pos[2]; run(2, 0, 0, 0, 1); ok(Math.abs(P.pos[2] - z) < 0.01, '  e segura o carro parado');
}
// 7) colisão com um círculo de World.col
{
  place(); W.col = new Float32Array([0.3, 40, 0.35, 3]); W.queryCol = (x, z, r, out) => { out[0] = 0; return 1; };
  let imp = 0, vHit = 0; run(1, 0, 0, 0, 0); run(8, 1, 0, 0, 0, () => { if (P.impact > imp) { imp = P.impact; } if (imp === 0) vHit = P.speed; });
  const d = Math.hypot(P.pos[0] + fwd()[0] * 1.38 - 0.3, P.pos[2] + fwd()[2] * 1.38 - 40);
  ok(imp > 0.3 && imp <= 1 && finite() && up()[1] > 0.8, 'colisão registra Physics.impact', `impacto ${imp.toFixed(2)} a ${(vHit * 3.6).toFixed(0)} km/h`);
  P.impact = 0.8; run(0.35, 0, 0, 0, 1); ok(P.impact === 0, '  impacto decai em ~0,3 s');
  W.col = real.col;
}
// 8) sobe rampa de 25% na pedra
{
  synth(0.25, 6); place(); run(1.5, 0, 0, 0, 0); const z0 = P.pos[2]; ok(Math.abs(P.speed) < 0.02, 'parado na rampa de 25% (segura sozinho)', `v=${P.speed.toFixed(4)}`);
  run(6, 1, 0, 0, 0);
  ok(P.speed > 8 && P.pos[2] - z0 > 20, 'sobe rampa de 25% na pedra', `${(P.speed * 3.6).toFixed(1)} km/h após 6 s, subiu ${((P.pos[2] - z0) * 0.25).toFixed(1)} m`);
  synth(0.45, 6); place(); run(1, 0, 0, 0, 0); run(6, 1, 0, 0, 0); console.log(`     (rampa de 45%: ${(P.speed * 3.6).toFixed(1)} km/h após 6 s)`);
}
// 9) lama e água seguram o carro
{
  const vAt = (type, water) => { synth(0, type, water); place(); run(0.5, 0, 0, 0, 0); run(8, 1, 0, 0, 0); return P.speed * 3.6; };
  const vt = vAt(0), vm = vAt(2), vw = vAt(3, 0.3);
  ok(vm < vt - 8 && vw < vt - 25, 'lama e água deixam o carro mais lento', `8 s de acelerador: terra ${vt.toFixed(0)}, lama ${vm.toFixed(0)}, água 30 cm ${vw.toFixed(0)} km/h`);
}
// 10) 60 s de comandos aleatórios no mundo real, em vários pontos da trilha
restore();
{
  const rnd = S.mulberry32(99); let bad = 0, stuck = 0, maxV = 0, minUp = 1;
  for (let k = 0; k < 6; k++) {
    P.reset(k * 110 + 6); let thr = 0, brk = 0, st = 0, hb = 0;
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 40 === 0) { thr = rnd() < 0.75 ? rnd() : 0; brk = rnd() < 0.2 ? rnd() : 0; st = rnd() * 2 - 1; hb = rnd() < 0.08 ? 1 : 0; }
      P.step(DT, thr, brk, st, hb); if (!finite()) { bad++; break; }
      maxV = Math.max(maxV, Math.abs(P.speed)); minUp = Math.min(minUp, up()[1]);
      if (P.stuck) { stuck++; P.reset(k * 110 + 6); }
    }
  }
  ok(bad === 0, '6 x 60 s de comandos aleatórios (fora da trilha, árvores, riacho): sem NaN', `vmax ${(maxV * 3.6).toFixed(0)} km/h, menor up.y ${minUp.toFixed(2)}, stuck ${stuck}x`);
}
console.log(fails ? `\n${fails} FALHA(S)` : '\nfísica: tudo certo'); process.exit(fails ? 1 : 0);
