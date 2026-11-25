// ---------- entrada: gamepad (layout padrao) + teclado ----------
const IN = {
  thr: 0, steer: 0, rx: 0, fire: 0, flip: 0, rst: 0,
  // pressionados neste quadro
  pA: 0, pB: 0, pX: 0, pY: 0, pStart: 0, pUp: 0, pDown: 0, pLeft: 0, pRight: 0, pCam: 0, pPause: 0, pBack: 0, pOk: 0,
  kb: new Uint8Array(32), kp: new Uint8Array(32), gpPrev: new Uint8Array(20), gpNow: new Uint8Array(20), gp: null, gpName: '', dead: .16, rep: 0, repDir: 0,
  rum: { startDelay: 0, duration: 100, weakMagnitude: 0, strongMagnitude: 0 }, lastRumble: 0, typing: false,
  K: { KeyW: 0, KeyS: 1, KeyA: 2, KeyD: 3, Space: 4, KeyF: 5, KeyC: 6, KeyR: 7, ArrowUp: 8, ArrowDown: 9, ArrowLeft: 10, ArrowRight: 11, Enter: 12, Escape: 13, Backspace: 14, KeyQ: 15, KeyE: 16, KeyP: 17, NumpadEnter: 12 },
  init() {
    addEventListener('keydown', e => { if (this.typing) { if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); UI.endTyping(); } return; } const k = this.K[e.code]; if (k === undefined) return; if (!this.kb[k]) this.kp[k] = 1; this.kb[k] = 1; e.preventDefault(); });
    addEventListener('keyup', e => { const k = this.K[e.code]; if (k !== undefined) this.kb[k] = 0; });
    addEventListener('blur', () => this.kb.fill(0));
    addEventListener('gamepadconnected', e => { this.gpName = e.gamepad.id; UI.toast('CONTROLE CONECTADO'); });
    addEventListener('gamepaddisconnected', () => { this.gp = null; this.gpName = ''; UI.toast('CONTROLE DESCONECTADO'); });
  },
  axis(v) { const a = Math.abs(v); return a < this.dead ? 0 : Math.sign(v) * (a - this.dead) / (1 - this.dead); },
  poll(dt) {
    const kb = this.kb, kp = this.kp, n = this.gpNow, pv = this.gpPrev; let gp = null;
    if (navigator.getGamepads) { const l = navigator.getGamepads(); for (let i = 0; i < l.length; i++) if (l[i] && l[i].connected) { gp = l[i]; break; } }
    this.gp = gp; let rt = 0, lt = 0, sx = 0, rx = 0;
    if (gp) { const b = gp.buttons; for (let i = 0; i < 17 && i < b.length; i++) n[i] = b[i].pressed ? 1 : 0; rt = b[7] ? b[7].value : 0; lt = b[6] ? b[6].value : 0; sx = this.axis(gp.axes[0] || 0); rx = this.axis(gp.axes[2] || 0); const sy = gp.axes[1] || 0; n[17] = sy < -.6 ? 1 : 0; n[18] = sy > .6 ? 1 : 0; }
    else n.fill(0);
    this.thr = clamp(rt - lt + (kb[0] ? 1 : 0) - (kb[1] ? 1 : 0), -1, 1); this.steer = clamp(sx + (kb[3] ? 1 : 0) - (kb[2] ? 1 : 0), -1, 1); this.rx = clamp(rx + (kb[16] ? 1 : 0) - (kb[15] ? 1 : 0), -1, 1);
    this.fire = (n[0] || kb[4]) ? 1 : 0; this.flip = (n[2] || kb[5]) ? 1 : 0; this.rst = (n[1] || kb[7]) ? 1 : 0;
    this.pA = n[0] & ~pv[0] & 1; this.pB = n[1] & ~pv[1] & 1; this.pX = n[2] & ~pv[2] & 1; this.pY = n[3] & ~pv[3] & 1; this.pStart = n[9] & ~pv[9] & 1;
    this.pUp = (n[12] & ~pv[12] & 1) | (n[17] & ~pv[17] & 1) | kp[8]; this.pDown = (n[13] & ~pv[13] & 1) | (n[18] & ~pv[18] & 1) | kp[9]; this.pLeft = (n[14] & ~pv[14] & 1) | kp[10]; this.pRight = (n[15] & ~pv[15] & 1) | kp[11];
    this.pOk = this.pA | kp[12]; this.pBack = this.pB | kp[13] | kp[14]; this.pCam = this.pY | kp[6]; this.pPause = this.pStart | kp[13] | kp[17];
    for (let i = 0; i < 20; i++) pv[i] = n[i]; kp.fill(0);
  },
  rumble(strong, weak, ms) { const gp = this.gp; this.lastRumble = strong; if (!gp || !gp.vibrationActuator) return; const r = this.rum; r.duration = ms; r.strongMagnitude = clamp(strong, 0, 1); r.weakMagnitude = clamp(weak, 0, 1); try { gp.vibrationActuator.playEffect('dual-rumble', r); } catch (e) { } },
};
