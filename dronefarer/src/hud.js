/**
 * HUD. Minimo na Fase 1: bateria, altitude, velocidade horizontal e modo.
 * A regra e que o jogo tem que ser legivel SEM o HUD — ele confirma, nao guia.
 */
import { clamp01 } from './core/mathx.js';
import { formatTime, formatDelta } from './core/mathx.js';
import { MEDAL_LABEL, MEDAL_COLOR } from './race/circuits.js';

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

/* --- corrida --- */
.hud .race { position:absolute; top:0; left:50%; transform:translateX(-50%);
  padding:12px 20px; text-align:center; }
.hud .race .circuit { font-size:9px; letter-spacing:.34em; opacity:.55; }
.hud .timer { font-size:38px; font-weight:600; line-height:1.05;
  font-variant-numeric:tabular-nums; }
.hud .timer.armed { opacity:.42; }
.hud .race .row { display:flex; gap:14px; justify-content:center; align-items:baseline;
  margin-top:2px; }
.hud .race .gates { font-size:12px; letter-spacing:.16em; }
.hud .delta { font-size:13px; font-weight:600; font-variant-numeric:tabular-nums; }
.hud .delta.ahead { color:#5be08a; } .hud .delta.behind { color:#ff6a7a; }
.hud .best { font-size:10px; opacity:.5; letter-spacing:.14em; margin-top:3px; }
.hud .combo { font-size:11px; letter-spacing:.2em; color:#ffb03a; opacity:0;
  transition:opacity .2s; margin-top:4px; }
.hud .combo.on { opacity:1; }

/* seta guia pro gate atual */
.hud .guide { position:absolute; left:50%; top:50%; width:0; height:0; }
.hud .guide .arrow { position:absolute; left:-14px; top:-140px; width:28px; height:28px;
  transform-origin:14px 140px; opacity:.85; }
.hud .guide .dist { position:absolute; left:50%; top:96px; transform:translateX(-50%);
  font-size:11px; letter-spacing:.14em; opacity:.75; font-variant-numeric:tabular-nums; }

/* painel de fim de corrida */
.hud .finish { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  background:rgba(6,10,16,.9); border:1px solid rgba(120,170,220,.25);
  padding:26px 40px; text-align:center; min-width:330px; display:none; }
.hud .finish.on { display:block; }
.hud .finish h2 { font-size:12px; letter-spacing:.34em; opacity:.6; font-weight:400; }
.hud .finish .ftime { font-size:44px; font-weight:600; margin:8px 0;
  font-variant-numeric:tabular-nums; }
.hud .finish .medal { font-size:15px; letter-spacing:.26em; font-weight:600; }
.hud .finish .rec { font-size:11px; letter-spacing:.2em; color:#5be08a; margin-top:8px; }
.hud .finish .splits { margin-top:14px; font-size:10px; opacity:.65; line-height:1.8;
  text-align:left; display:inline-block; font-variant-numeric:tabular-nums; }
.hud .finish .again { margin-top:16px; font-size:10px; letter-spacing:.2em; opacity:.75; }

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

    <div class="race" id="hud-race" style="display:none">
      <div class="circuit" id="hud-circuit"></div>
      <div class="timer armed" id="hud-timer">0:00.000</div>
      <div class="row">
        <span class="gates" id="hud-gates"></span>
        <span class="delta" id="hud-delta"></span>
      </div>
      <div class="best" id="hud-best"></div>
      <div class="combo" id="hud-combo"></div>
    </div>

    <div class="guide" id="hud-guide" style="display:none">
      <div class="arrow" id="hud-arrow">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <path d="M14 1 L23 20 L14 15 L5 20 Z" fill="#37d5ff" stroke="#04121a"
            stroke-width="1.2"/>
        </svg>
      </div>
      <div class="dist" id="hud-dist"></div>
    </div>

    <div class="finish" id="hud-finish">
      <h2 id="hud-finish-title">CIRCUITO COMPLETO</h2>
      <div class="ftime" id="hud-finish-time"></div>
      <div class="medal" id="hud-finish-medal"></div>
      <div class="rec" id="hud-finish-rec"></div>
      <div class="splits" id="hud-finish-splits"></div>
      <div class="again">R  REINICIAR   ·   TAB  TROCAR CIRCUITO</div>
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
  const raceEl = $('#hud-race'), circuitEl = $('#hud-circuit'), timerEl = $('#hud-timer');
  const gatesEl = $('#hud-gates'), deltaEl = $('#hud-delta'), bestEl = $('#hud-best');
  const comboEl = $('#hud-combo');
  const guideEl = $('#hud-guide'), arrowEl = $('#hud-arrow'), distEl = $('#hud-dist');
  const finishEl = $('#hud-finish'), fTitle = $('#hud-finish-title');
  const fTime = $('#hud-finish-time'), fMedal = $('#hud-finish-medal');
  const fRec = $('#hud-finish-rec'), fSplits = $('#hud-finish-splits');

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

    /* ------------------------------------------------------------------ *
     * CORRIDA
     * ------------------------------------------------------------------ */

    setRaceVisible(on) {
      raceEl.style.display = on ? '' : 'none';
      guideEl.style.display = on ? '' : 'none';
      if (!on) finishEl.classList.remove('on');
    },

    setCircuit(circuit, record) {
      circuitEl.textContent = circuit.name;
      bestEl.textContent = record
        ? `MELHOR ${formatTime(record.time)}` : 'SEM RECORDE';
      finishEl.classList.remove('on');
    },

    /** @param st estado da corrida (race.state) */
    updateRace(st, total) {
      timerEl.textContent = formatTime(st.time);
      timerEl.className = `timer${st.status === 'armed' ? ' armed' : ''}`;
      gatesEl.textContent = `${st.gateIndex}/${total}`;

      if (st.delta !== null && st.status === 'running') {
        deltaEl.textContent = formatDelta(st.delta);
        deltaEl.className = `delta ${st.delta <= 0 ? 'ahead' : 'behind'}`;
      } else {
        deltaEl.textContent = '';
        deltaEl.className = 'delta';
      }

      if (st.combo > 1 && st.status === 'running') {
        comboEl.textContent = `COMBO x${st.combo}`;
        comboEl.className = 'combo on';
      } else {
        comboEl.className = 'combo';
      }
    },

    /**
     * Seta guia. `angle` em radianos no espaco da tela (0 = pra cima).
     * `onScreen` true quando o gate esta visivel — ai a seta some.
     */
    setGuide(angle, distance, onScreen) {
      if (distance === null) { guideEl.style.display = 'none'; return; }
      guideEl.style.display = '';
      arrowEl.style.transform = `rotate(${angle}rad)`;
      arrowEl.style.opacity = onScreen ? '0.28' : '0.9';
      distEl.textContent = `${distance.toFixed(0)} M`;
    },

    showFinish({ time, medal, newRecord, splits, bestSplits }) {
      fTitle.textContent = 'CIRCUITO COMPLETO';
      fTime.textContent = formatTime(time);
      if (medal) {
        fMedal.textContent = MEDAL_LABEL[medal];
        fMedal.style.color = MEDAL_COLOR[medal];
      } else {
        fMedal.textContent = 'SEM MEDALHA';
        fMedal.style.color = '#7d8a99';
      }
      fRec.textContent = newRecord ? 'NOVO RECORDE' : '';
      fSplits.innerHTML = splits.map((t, i) => {
        const ref = bestSplits && bestSplits[i] !== undefined ? t - bestSplits[i] : null;
        const d = ref === null ? ''
          : `<span style="color:${ref <= 0 ? '#5be08a' : '#ff6a7a'}"> ${formatDelta(ref)}</span>`;
        return `GATE ${String(i + 1).padStart(2, '0')}  ${formatTime(t)}${d}`;
      }).join('<br>');
      finishEl.classList.add('on');
    },

    hideFinish() { finishEl.classList.remove('on'); },

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
