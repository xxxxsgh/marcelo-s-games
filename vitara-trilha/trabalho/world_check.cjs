const S = require('./sim.cjs'); const W = S.World;
let t0 = Date.now(); S.worldInit(); console.log('init ms', Date.now() - t0);
const T = W.trk; console.log('L', T.L.toFixed(1), 'n', T.n, 'trees', W.nTrees, 'rocks', W.nRocks, 'posts', W.nPosts, 'col', W.nCol);
console.log('bridge', W.bridge.s0.toFixed(1), W.bridge.s1.toFixed(1), 'len', W.bridge.len.toFixed(1), 'y', W.bridge.y0.toFixed(2));
console.log('checkpoints', Array.from(W.checkpoints).map(v => v.toFixed(0)).join(' '), 'zones', W.zones.map(z => z.type + ':' + z.a.toFixed(0) + '-' + z.b.toFixed(0)).join(' '));
let mxSlope = 0, mxC = 0, line = '';
const names = 'TCLAGMP';
for (let i = 0; i < T.n; i += 8) {
  const ty = W.surfaceAt(T.x[i], T.z[i]); line += names[ty];
  const j = (i + 8) % T.n; mxSlope = Math.max(mxSlope, Math.abs(T.y[j] - T.y[i]) / (8 * T.ds)); mxC = Math.max(mxC, Math.abs(T.curv[i]));
}
console.log(line); console.log('max slope', mxSlope.toFixed(2), 'min radius', (1 / mxC).toFixed(1));
// erro entre o perfil e o terreno no eixo, e desnível na ponte
let e = 0; for (let i = 0; i < T.n; i++) { if (i > W.bridge.i0 && i < W.bridge.i1) continue; e = Math.max(e, Math.abs(W.heightRaw(T.x[i], T.z[i]) - T.y[i])); }
console.log('max |terrain - profile| on centerline', e.toFixed(2));
const bi = (W.bridge.i0 + W.bridge.i1) >> 1; console.log('under bridge: deck', W.heightAt(T.x[bi], T.z[bi]).toFixed(2), 'terrain', W.heightRaw(T.x[bi], T.z[bi]).toFixed(2), 'water', W.waterAt(T.x[bi], T.z[bi]).toFixed(2));
// mapa de cima em PGM/PPM para conferência
const fs = require('fs'), N = 1024, buf = Buffer.alloc(N * N * 3);
for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
  const wx = (x - N / 2) * 0.6, wz = (z - N / 2) * 0.6, h = W.heightRaw(wx, wz), k = (z * N + x) * 3;
  const hx = W.heightRaw(wx + 1, wz) - h; let v = Math.max(0, Math.min(255, (h - 10) * 3 + hx * 120 + 40));
  let r = v, g = v, b = v; const ty = W.surfaceAt(wx, wz);
  if (ty !== 4) { const c = [[200, 150, 90], [170, 170, 170], [110, 70, 40], [60, 120, 255], 0, [255, 220, 0], [255, 80, 80]][ty]; r = c[0]; g = c[1]; b = c[2]; }
  else if (W.waterAt(wx, wz) > h) { r = 60; g = 120; b = 255; }
  buf[k] = r; buf[k + 1] = g; buf[k + 2] = b;
}
for (let i = 0; i < W.nTrees; i++) { const x = Math.round(W.trees[i * 8] / 0.6 + N / 2), z = Math.round(W.trees[i * 8 + 2] / 0.6 + N / 2); if (x >= 0 && z >= 0 && x < N && z < N) { const k = (z * N + x) * 3; buf[k] = 0; buf[k + 1] = W.trees[i * 8 + 5] == 2 ? 255 : 130; buf[k + 2] = W.trees[i * 8 + 5] == 3 ? 200 : 0; } }
fs.writeFileSync(__dirname + '/mapa.ppm', Buffer.concat([Buffer.from(`P6 ${N} ${N} 255\n`), buf]));
