// game.js — laço de jogo: entrada -> física em passo fixo (1/120 s) -> volta, checkpoints, vibração.
const Game = (() => {
  const H = 1 / 120, KEY = 'vitara_trilha_best';
  const Gm = {
    paused: 0, cam: 0, camYaw: 0, camPitch: 0,
    timeMs: 0, lapActive: 0, bestMs: -1, lastMs: -1, laps: 0, speedKmh: 0,
    cp: 0, nCp: 0, offTrack: 0, msg: 0, msgT: 0, simFrame: 0,
    fixedDt: false, resets: 0, trackS: 0, trackT: 0, trackHw: 3, lastS: 0, acc: 0, stuckT: 0,
  };
  let prevS = 0;
  function wrapD(d) { const L = World.trk.L; return d > L / 2 ? d - L : d < -L / 2 ? d + L : d; }
  function say(m, t) { Gm.msg = m; Gm.msgT = t; }

  Gm.init = function () {
    Physics.init(); Input.init();
    Gm.nCp = World.checkpoints.length; Gm.restart();
    try { if (typeof localStorage !== 'undefined') { const v = parseFloat(localStorage.getItem(KEY)); if (v > 0) Gm.bestMs = v; } } catch (e) { }
  };
  // volta ao início (largada parada); mantém o recorde
  Gm.restart = function () {
    Physics.reset(World.startS); prevS = Gm.lastS = Gm.trackS = World.startS; Gm.trackT = 0;
    Gm.paused = 0; Gm.timeMs = 0; Gm.lapActive = 0; Gm.lastMs = -1; Gm.laps = 0; Gm.cp = 0; Gm.offTrack = 0; Gm.msg = 0; Gm.msgT = 0;
    Gm.simFrame = 0; Gm.resets = 0; Gm.acc = 0; Gm.camYaw = 0; Gm.camPitch = 0; Gm.speedKmh = 0; Gm.stuckT = 0;
  };
  Gm.resetToTrack = function () {
    const L = World.trk.L; let s = Gm.lastS - 4; if (s < 0) s += L;
    Physics.reset(s); prevS = s; Gm.trackS = s; Gm.trackT = 0; Gm.offTrack = 0; Gm.resets++; Gm.stuckT = 0; say(4, 2);
  };

  Gm.update = function (dt) {
    const fixed = Gm.fixedDt; if (fixed) dt = 1 / 60;
    Input.poll(dt);
    if (Input.pPause) Gm.paused = Gm.paused ? 0 : 1;
    if (Gm.paused) return;
    Gm.simFrame++;
    if (Input.pCam) Gm.cam = (Gm.cam + 1) % 3;
    { const k = dt * 7 < 1 ? dt * 7 : 1; Gm.camYaw += (Input.camX * 2.7 - Gm.camYaw) * k; Gm.camPitch += (Input.camY * 0.55 - Gm.camPitch) * k; }
    if (Input.pReset) Gm.resetToTrack();
    // ---- física ----
    let n = 2;
    if (!fixed) { Gm.acc += dt < 0.1 ? dt : 0.1; n = Math.floor(Gm.acc / H + 1e-6); if (n > 12) n = 12; Gm.acc -= n * H; if (Gm.acc < 0) Gm.acc = 0; }
    for (let i = 0; i < n; i++) Physics.step(H, Input.throttle, Input.brake, Input.steer, Input.handbrake);
    if (Gm.lapActive) Gm.timeMs += n * H * 1000;
    Gm.speedKmh = (Physics.speed < 0 ? -Physics.speed : Physics.speed) * 3.6;
    if (Physics.stuck) { Gm.stuckT += dt; if (Gm.stuckT > 1.2) Gm.resetToTrack(); }
    // ---- posição na trilha, checkpoints e volta ----
    const p = Physics.pos, tq = World.tq, found = World.trackQ(p[0], p[2]);
    if (found) {
      const s = tq.s, at = tq.t < 0 ? -tq.t : tq.t, ds = wrapD(s - prevS);
      Gm.trackS = s; Gm.trackT = tq.t; Gm.trackHw = tq.hw;
      Gm.offTrack = at > tq.hw + 2.5 ? 1 : 0;
      if (at <= tq.hw && Physics.nContact >= 3 && !Physics.stuck) Gm.lastS = s;
      if (ds > 0 && ds < 15 && at < tq.hw + 3) {
        const sc = World.checkpoints[Gm.cp], a = wrapD(prevS - sc), b = wrapD(s - sc);
        if (a < 0 && b >= 0 && b < 15) {
          if (Gm.cp === 0) {
            if (Gm.lapActive) {
              Gm.lastMs = Gm.timeMs; Gm.laps++;
              if (Gm.bestMs < 0 || Gm.lastMs < Gm.bestMs) {
                Gm.bestMs = Gm.lastMs; say(3, 4);
                try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, String(Math.round(Gm.bestMs))); } catch (e) { }
              } else say(2, 4);
            }
            Gm.lapActive = 1; Gm.timeMs = 0;
          } else say(1, 1.6);
          Gm.cp = (Gm.cp + 1) % Gm.nCp;
        }
      }
      prevS = s;
    } else Gm.offTrack = 1;
    if (Gm.offTrack) { if (Gm.msg === 0 || Gm.msg === 5) say(5, 0.5); }
    if (Gm.msgT > 0) { Gm.msgT -= dt; if (Gm.msgT <= 0) { Gm.msgT = 0; Gm.msg = 0; } }
    // ---- vibração: leve no cascalho (proporcional à velocidade), forte em batidas e no riacho ----
    const va = Gm.speedKmh / 3.6, k = va / 16 < 1 ? va / 16 : 1;
    const weak = Physics.rumble * k * 1.3 + Physics.impact * 0.6;
    let strong = Physics.impact; const ws = Physics.inWater > 0.06 ? (0.35 + Physics.inWater * 1.5) * (0.3 + 0.7 * k) : 0; if (ws > strong) strong = ws;
    Input.rumble(weak, strong);
  };
  return Gm;
})();
