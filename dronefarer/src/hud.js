/**
 * HUD. Minimo na Fase 1: bateria, altitude, velocidade horizontal e modo.
 * A regra e que o jogo tem que ser legivel SEM o HUD — ele confirma, nao guia.
 */
import { clamp01 } from './core/mathx.js';

const CSS = `
.hud { position:fixed; inset:0; pointer-events:none; z-index:10;
  font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color:#dff0ff; text-shadow:0 1px 4px rgba(0,0,0,.85); letter-spacing:.06em; }
.hud .corner { position:absolute; padding:14px 18px; }
.hud .tl { top:0; left:0; } .hud .tr { top:0; right:0; text-align:right; }
.hud .bl { bottom:0; left:0; } .hud .br { bottom:0; right:0; text-align:right; }

.hud .big { font-size:30px; font-weight:600; letter-spacing:.02em; line-height:1; }
.hud .unit { font-size:11px; opacity:.6; margin-left:4px; letter-spacing:.14em; }
.hud .lbl { font-size:9px; opacity:.5; letter-spacing:.28em; margin-bottom:3px; }

.hud .mode { display:inline-block; padding:4px 12px; border:1px solid currentColor;
  font-size:11px; letter-spacing:.24em; font-weight:600; }
.hud .mode.angle { color:#37d5ff; }
.hud .mode.acro  { color:#ffb03a; }

.hud .batt { width:150px; height:6px; background:rgba(255,255,255,.14);
  margin-top:6px; overflow:hidden; }
.hud .batt i { display:block; height:100%; background:#5be08a; transition:width .18s linear; }
.hud .batt.warn i { background:#ffb03a; }
.hud .batt.crit i { background:#ff3d5a; }
.hud .batt.crit { animation:battpulse .9s infinite; }
@keyframes battpulse { 50% { opacity:.35 } }

.hud .center { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  text-align:center; }
.hud .flash { font-size:22px; letter-spacing:.3em; font-weight:600; opacity:0;
  transition:opacity .18s; }
.hud .flash.on { opacity:1; }
.hud .crash { color:#ff3d5a; }

.hud .stats { font-size:10px; opacity:.55; letter-spacing:.12em; }
.hud .hint { font-size:10px; opacity:.45; letter-spacing:.1em; line-height:1.7; }
.hud .warnmsg { color:#ffb03a; font-size:11px; letter-spacing:.18em; }

/* horizonte artificial minimo: 2 tracinhos que giram com o roll */
.hud .horizon { position:absolute; left:50%; top:50%; width:220px; height:2px;
  margin-left:-110px; opacity:.35; }
.hud .horizon i { position:absolute; top:0; width:74px; height:2px; background:#dff0ff; }
.hud .horizon i:first-child { left:0; } .hud .horizon i:last-child { right:0; }
`;

export function createHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="corner tl">
      <div class="lbl">BATERIA</div>
      <div><span class="big" id="hud-batt-n">100</span><span class="unit">%</span></div>
      <div class="batt" id="hud-batt"><i style="width:100%"></i></div>
      <div class="stats" id="hud-fps" style="margin-top:12px"></div>
    </div>

    <div class="corner tr">
      <div class="lbl">ALTITUDE</div>
      <div><span class="big" id="hud-alt">0</span><span class="unit">M</span></div>
      <div class="stats" id="hud-vspd" style="margin-top:6px"></div>
    </div>

    <div class="corner bl">
      <div class="lbl">VELOCIDADE</div>
      <div><span class="big" id="hud-spd">0</span><span class="unit">KM/H</span></div>
      <div class="stats" id="hud-wind" style="margin-top:6px"></div>
    </div>

    <div class="corner br">
      <div id="hud-mode" class="mode angle">ANGLE</div>
      <div class="hint" id="hud-hint" style="margin-top:10px"></div>
    </div>

    <div class="horizon" id="hud-horizon"><i></i><i></i></div>
    <div class="center"><div class="flash" id="hud-flash"></div></div>
  `;
  document.body.appendChild(el);

  const $ = (id) => el.querySelector(id);
  const battN = $('#hud-batt-n'), battBar = $('#hud-batt'), battFill = battBar.querySelector('i');
  const altEl = $('#hud-alt'), vspdEl = $('#hud-vspd');
  const spdEl = $('#hud-spd'), windEl = $('#hud-wind');
  const modeEl = $('#hud-mode'), fpsEl = $('#hud-fps');
  const flashEl = $('#hud-flash'), horizonEl = $('#hud-horizon'), hintEl = $('#hud-hint');

  let flashTimer = 0;
  let visible = true;

  const api = {
    el,
    setHint(text) { hintEl.innerHTML = text; },

    /** @param st estado do drone; @param extra {battery, fps, wind, roll} */
    update(dt, st, extra = {}) {
      if (!visible) return;

      // velocidade HORIZONTAL: e ela que importa pra pilotagem
      spdEl.textContent = Math.round(st.hSpeed * 3.6);
      altEl.textContent = st.altitude.toFixed(1);

      const vs = st.vSpeed;
      vspdEl.textContent = `${vs >= 0 ? '▲' : '▼'} ${Math.abs(vs).toFixed(1)} m/s`;
      vspdEl.style.color = vs > 0.5 ? '#5be08a' : vs < -3 ? '#ff8a5a' : '';

      if (extra.battery !== undefined) {
        const b = clamp01(extra.battery / 100);
        battN.textContent = Math.round(extra.battery);
        battFill.style.width = `${b * 100}%`;
        battBar.className = `batt${b < 0.18 ? ' crit' : b < 0.35 ? ' warn' : ''}`;
      }

      if (st.mode !== api._mode) {
        api._mode = st.mode;
        modeEl.className = `mode ${st.mode}`;
        modeEl.textContent = st.mode.toUpperCase();
      }

      if (extra.wind !== undefined) {
        windEl.textContent = extra.wind > 0.4
          ? `VENTO ${(extra.wind * 3.6).toFixed(0)} km/h` : '';
      }
      if (extra.fps !== undefined) {
        fpsEl.textContent = `${extra.fps.toFixed(0)} FPS · ${extra.tier || ''}`.toUpperCase();
      }

      // horizonte artificial: gira com o roll do drone
      if (extra.roll !== undefined) {
        horizonEl.style.transform =
          `translate(-50%,-50%) rotate(${(-extra.roll * 180 / Math.PI).toFixed(1)}deg)`;
      }

      if (flashTimer > 0) {
        flashTimer -= dt;
        if (flashTimer <= 0) flashEl.classList.remove('on');
      }
    },

    flash(text, duration = 1.4, cls = '') {
      flashEl.textContent = text;
      flashEl.className = `flash on ${cls}`;
      flashTimer = duration;
    },

    setVisible(v) {
      visible = v;
      el.style.display = v ? '' : 'none';
    },
    toggle() { api.setVisible(!visible); return visible; },
    get visible() { return visible; },
  };
  return api;
}
