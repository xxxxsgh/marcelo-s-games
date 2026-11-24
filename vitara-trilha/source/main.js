// main.js — laço principal, câmeras e API de teste
const QS = new URLSearchParams(location.search);
const TEST = QS.has('test'), NORENDER = QS.has('norender');
const App = { t: 0, last: 0, ready: false, err: null };
async function boot() {
  const cv = document.getElementById('c'); cv.width = +(QS.get('w') || 1920); cv.height = +(QS.get('h') || 1080);
  worldInit();
  if (typeof Game !== 'undefined') { Game.init(); if (TEST) Game.fixedDt = true; }
  if (!NORENDER) { await gpuInit(cv); renderInit(); if (typeof sceneInit !== 'undefined') sceneInit(); }
  App.ready = true; document.getElementById('load').style.display = 'none';
  if (!TEST) requestAnimationFrame(tick);
}
function frame(dt) {
  R.dt = dt; R.ptime = R.time; R.time += dt;
  if (typeof Game !== 'undefined') Game.update(dt);
  if (typeof sceneUpdate !== 'undefined') sceneUpdate(dt);
  if (!NORENDER) renderFrame();
}
function tick(now) { if (App.perfMode) { requestAnimationFrame(tick); App.last = now; return; } const dt = clamp((now - App.last) / 1000, 1 / 240, 1 / 20); App.last = now; frame(App.last === now && App.t === 0 ? 1 / 60 : dt); App.t += dt; requestAnimationFrame(tick); }
window.__t = {
  ready: boot().catch((e) => { App.err = e; console.error(e.stack || e); document.getElementById('load').textContent = 'Erro: ' + e.message; throw e; }),
  World, R, GPU, App, get S() { return S; },
  get Game() { return typeof Game !== 'undefined' ? Game : null; }, get Physics() { return typeof Physics !== 'undefined' ? Physics : null; }, get Input() { return typeof Input !== 'undefined' ? Input : null; },
  step(n) { Game.fixedDt = true; for (let i = 0; i < n; i++) Game.update(1 / 60); },
  frames(n) { for (let i = 0; i < n; i++) frame(1 / 60); },
  sim(n) { for (let i = 0; i < n; i++) { R.dt = 1 / 60; R.ptime = R.time; R.time += 1 / 60; Game.update(1 / 60); sceneUpdate(1 / 60); sceneSimOnly(); } },
  get CarD() { return CarD; },
  still(n) { for (let i = 0; i < n; i++) { CarD.u.copyWithin(80, 0, 80); R.ptime = R.time; R.dt = 1 / 60; if (typeof hudUpdate !== 'undefined') hudUpdate(0); renderFrame(); } },
  cam(ex, ey, ez, tx, ty, tz, fov) { App.freeCam = true; R.setCamera(ex, ey, ez, tx, ty, tz, fov || 1.0); },
  // leitura do quadro renderizado fora da tela (modo de teste): 'png' -> dataURL, 'raw' -> base64 RGBA
  async grab(kind) {
    const W = GPU.W, H = GPU.H, enc = GPU.dev.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: R.offT }, { buffer: R.offBuf, bytesPerRow: W * 4 }, [W, H, 1]); GPU.dev.queue.submit([enc.finish()]);
    await R.offBuf.mapAsync(1); const px = new Uint8ClampedArray(R.offBuf.getMappedRange().slice(0)); R.offBuf.unmap();
    if (kind === 'raw') { let s = ''; for (let i = 0; i < px.length; i += 32768) s += String.fromCharCode.apply(null, px.subarray(i, i + 32768)); return btoa(s); }
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').putImageData(new ImageData(px, W, H), 0, 0); return c2.toDataURL('image/png');
  },
  // câmera relativa ao carro: azimute (0 = atrás, + = lado esquerdo), elevação, distância, altura do alvo, fov
  carCam(azDeg, elDeg, dist, ty, fov) {
    const P = Physics, q = P.quat, fx = 2 * (q[0] * q[2] + q[3] * q[1]), fz = 1 - 2 * (q[0] * q[0] + q[1] * q[1]), yaw = Math.atan2(fx, fz), a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
    const lx = Math.sin(a) * Math.cos(e) * dist, lz = -Math.cos(a) * Math.cos(e) * dist, c = Math.cos(yaw), s = Math.sin(yaw);
    App.freeCam = true; R.setCamera(P.pos[0] + lx * c + lz * s, P.pos[1] + ty + Math.sin(e) * dist, P.pos[2] - lx * s + lz * c, P.pos[0], P.pos[1] + ty, P.pos[2], fov || 0.7);
  },
  // medição: roda a volta roteirizada em tempo real (um passo fixo de simulação por quadro exibido) e registra
  // o intervalo entre quadros e o tempo de GPU (consultas de timestamp por passada). Buffers pré-alocados.
  perfRun(cmds, pad) {
    const N = cmds.length, fr = new Float32Array(N), gp = new Float32Array(N), pass = new Float64Array(R.passNames.length); let i = 0, last = 0, ng = 0, seen = 0;
    Game.restart(); Game.fixedDt = true; R.perf = true; App.perfMode = true;
    return new Promise((res) => { const step = (now) => {
      if (i > 0) fr[i - 1] = now - last; last = now;
      if (i >= N) { App.perfMode = false; res({ frameMs: Array.from(fr.subarray(0, N - 1)), gpuMs: Array.from(gp.subarray(0, ng)), passNames: R.passNames, passMs: Array.from(pass).map((v) => v / Math.max(1, ng)), laps: Game.laps, lastMs: Game.lastMs, resets: Game.resets, hasTS: GPU.hasTS, w: GPU.W, h: GPU.H }); return; }
      const c = cmds[i]; pad.buttons[7].value = c[0]; pad.buttons[7].pressed = c[0] > 0.5; pad.buttons[6].value = c[1]; pad.buttons[6].pressed = c[1] > 0.5; pad.axes[0] = c[2];
      frame(1 / 60); i++;
      if ((R.tsFrames | 0) !== seen) { seen = R.tsFrames | 0; gp[ng++] = R.gpuTotal; for (let k = 0; k < pass.length; k++) pass[k] += R.gpuMs[k]; }
      requestAnimationFrame(step); };
      requestAnimationFrame(step); });
  },
  async flush() { await GPU.dev.queue.onSubmittedWorkDone(); },
};
