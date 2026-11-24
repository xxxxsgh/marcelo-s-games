// input.js — gamepad (mapeamento padrão) + teclado. poll() não aloca (fora o que getGamepads() faz por dentro).
const Input = (() => {
  const I = {
    throttle: 0, brake: 0, steer: 0, handbrake: 0, camX: 0, camY: 0,
    pCam: false, pReset: false, pPause: false, padConnected: 0, padIndex: -1,
    DEAD: 0.12, clock: 0, rumbleCalls: 0,
  };
  const keys = new Uint8Array(8);  // 0 W, 1 S, 2 A, 3 D, 4 Espaço
  const latch = new Uint8Array(3); // C, R, pausa (bordas vindas do teclado)
  const prev = new Uint8Array(3);  // estado anterior de Y, B, Start
  const st = new Float64Array(5);  // 0 esterço do teclado, 1 instante do último rumble, 2/3 pendentes fraco/forte, 4 último enviado != 0
  const fx = { startDelay: 0, duration: 150, weakMagnitude: 0, strongMagnitude: 0 };
  const noop = () => { };
  let pad = null, inited = false;

  function keyIdx(c) {
    return c === 'KeyW' || c === 'ArrowUp' ? 0 : c === 'KeyS' || c === 'ArrowDown' ? 1 : c === 'KeyA' || c === 'ArrowLeft' ? 2 : c === 'KeyD' || c === 'ArrowRight' ? 3 : c === 'Space' ? 4 : -1;
  }
  function onDown(e) {
    const c = e.code, k = keyIdx(c);
    if (k >= 0) { keys[k] = 1; if (e.preventDefault) e.preventDefault(); return; }
    if (e.repeat) return;
    if (c === 'KeyC') latch[0] = 1; else if (c === 'KeyR') latch[1] = 1; else if (c === 'Escape' || c === 'KeyP') latch[2] = 1;
  }
  function onUp(e) { const k = keyIdx(e.code); if (k >= 0) keys[k] = 0; }
  function onBlur() { keys.fill(0); }
  function onPadOn(e) { if (e && e.gamepad && I.padIndex < 0) I.padIndex = e.gamepad.index; }
  function onPadOff(e) { if (e && e.gamepad && e.gamepad.index === I.padIndex) { I.padIndex = -1; I.padConnected = 0; pad = null; } }
  function dz(x) { const a = x < 0 ? -x : x, d = I.DEAD; if (!(a > d)) return 0; const r = (a - d) / (1 - d); return x < 0 ? (r > 1 ? -1 : -r) : (r > 1 ? 1 : r); }
  function usable(p) { return !!p && p.connected !== false && !!p.buttons && p.buttons.length >= 10 && !!p.axes && p.axes.length >= 2; }

  I.init = function () {
    if (inited) return; inited = true;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp); window.addEventListener('blur', onBlur);
    window.addEventListener('gamepadconnected', onPadOn); window.addEventListener('gamepaddisconnected', onPadOff);
  };

  I.poll = function (dt) {
    const h = dt > 0 ? (dt < 0.1 ? dt : 0.1) : 1 / 60; I.clock += h;
    // ---- gamepad: consulta a cada quadro (funciona se for ligado depois) ----
    let p = null;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      let pads = null; try { pads = navigator.getGamepads(); } catch (e) { pads = null; }
      if (pads) {
        const i0 = I.padIndex; if (i0 >= 0 && i0 < pads.length && usable(pads[i0])) p = pads[i0];
        if (!p) for (let i = 0; i < pads.length; i++) if (usable(pads[i]) && pads[i].mapping === 'standard') { p = pads[i]; I.padIndex = i; break; }
        if (!p) for (let i = 0; i < pads.length; i++) if (usable(pads[i])) { p = pads[i]; I.padIndex = i; break; }
      }
    }
    pad = p; I.padConnected = p ? 1 : 0; if (!p) I.padIndex = -1;
    let thr = 0, brk = 0, steer = 0, hb = 0, cx = 0, cy = 0, bY = 0, bB = 0, bS = 0;
    if (p) {
      const b = p.buttons, a = p.axes;
      thr = b[7].value; brk = b[6].value; if (thr < 0.02) thr = 0; if (brk < 0.02) brk = 0;
      steer = -dz(a[0]); if (a.length >= 4) { cx = dz(a[2]); cy = dz(a[3]); }
      hb = b[0].pressed ? 1 : 0; bY = b[3].pressed ? 1 : 0; bB = b[1].pressed ? 1 : 0; bS = b[9].pressed ? 1 : 0;
    }
    I.pCam = (bY && !prev[0]) || latch[0] === 1; I.pReset = (bB && !prev[1]) || latch[1] === 1; I.pPause = (bS && !prev[2]) || latch[2] === 1;
    prev[0] = bY; prev[1] = bB; prev[2] = bS; latch[0] = 0; latch[1] = 0; latch[2] = 0;
    // ---- teclado: esterço em rampa ----
    const tg = keys[2] - keys[3]; let ks = st[0];
    const rate = (tg === 0 ? 4.5 : (tg > 0) !== (ks > 0) && ks !== 0 ? 7 : 2.8) * h, d = tg - ks;
    ks += d > rate ? rate : d < -rate ? -rate : d; st[0] = ks;
    if (keys[0]) thr = 1; if (keys[1]) brk = 1; if (keys[4]) hb = 1;
    if ((ks < 0 ? -ks : ks) > (steer < 0 ? -steer : steer)) steer = ks;
    I.throttle = thr > 1 ? 1 : thr; I.brake = brk > 1 ? 1 : brk; I.steer = steer; I.handbrake = hb; I.camX = cx; I.camY = cy;
  };

  // vibração dupla no controle ativo; acumula o pico e envia no máximo ~10 vezes por segundo (relógio = soma dos dt de poll)
  I.rumble = function (weak, strong) {
    if (weak > st[2]) st[2] = weak; if (strong > st[3]) st[3] = strong;
    if (I.clock - st[1] < 0.1) return;
    const wk = st[2] > 1 ? 1 : st[2], sg = st[3] > 1 ? 1 : st[3]; st[2] = 0; st[3] = 0;
    if (wk < 0.02 && sg < 0.02) { st[4] = 0; return; }
    const act = pad ? pad.vibrationActuator : null; if (!act || !act.playEffect) return;
    st[1] = I.clock; st[4] = 1; fx.weakMagnitude = wk; fx.strongMagnitude = sg; I.rumbleCalls++;
    try { const r = act.playEffect('dual-rumble', fx); if (r && r.catch) r.catch(noop); } catch (e) { }
  };
  return I;
})();
