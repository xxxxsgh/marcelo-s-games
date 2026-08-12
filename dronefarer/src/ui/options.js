/**
 * Menu de opcoes estilo PC: presets de qualidade + ajuste individual, render
 * scale separado da resolucao da janela, rebind de teclas, sensibilidade,
 * expo, FOV, tilt, mixer de audio e export/import do save.
 *
 * O objetivo declarado: o mesmo jogo tem que escalar do notebook fraco ao PC
 * forte sem o jogador precisar editar arquivo.
 */
import { QUALITY, CAMERA, INPUT } from '../config.js';
import { ACTION_LABELS } from '../input/bindings.js';

const CSS = `
.opt { position:fixed; inset:0; z-index:50; display:none;
  background:rgba(4,7,12,.95); backdrop-filter:blur(3px);
  font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color:#dff0ff; }
.opt.on { display:block; }
.opt .wrap { position:absolute; inset:5% 10%; display:flex; flex-direction:column; }
.opt h1 { font-size:13px; letter-spacing:.36em; font-weight:400; opacity:.7; }
.opt .tabs { display:flex; gap:18px; margin:12px 0 14px; }
.opt .tab { font-size:11px; letter-spacing:.22em; opacity:.45; cursor:pointer;
  padding:5px 0; border-bottom:2px solid transparent; }
.opt .tab.on { opacity:1; border-bottom-color:#37d5ff; }
.opt .body { flex:1; overflow-y:auto; padding-right:10px; }
.opt .row { display:grid; grid-template-columns:220px 1fr 90px; gap:14px;
  align-items:center; padding:7px 0; border-bottom:1px solid rgba(120,170,220,.09); }
.opt .row label { font-size:11px; letter-spacing:.1em; }
.opt .row .val { text-align:right; font-size:11px; opacity:.75; }
.opt input[type=range] { width:100%; accent-color:#37d5ff; }
.opt .seg { display:flex; gap:6px; }
.opt .seg button { flex:1; }
.opt button { font:inherit; font-size:10px; letter-spacing:.14em; padding:5px 10px;
  background:transparent; color:#8fb4d8; border:1px solid rgba(140,180,220,.3);
  cursor:pointer; }
.opt button.on { color:#37d5ff; border-color:#37d5ff; }
.opt button:hover { border-color:#37d5ff; }
.opt .hint { font-size:10px; opacity:.45; padding:10px 0; letter-spacing:.1em; }
.opt .foot { padding-top:12px; font-size:10px; opacity:.5; letter-spacing:.2em; }
.opt .rebind { color:#ffb03a; }
`;

export function createOptions(quality, pipeline, renderer, camera, input, audio, save, bus, damage) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'opt';
  el.innerHTML = `<div class="wrap">
    <h1>OPCOES</h1>
    <div class="tabs">
      <div class="tab on" data-t="video">VIDEO</div>
      <div class="tab" data-t="controles">CONTROLES</div>
      <div class="tab" data-t="audio">AUDIO</div>
      <div class="tab" data-t="jogo">JOGO</div>
    </div>
    <div class="body" id="opt-body"></div>
    <div class="foot">ESC FECHA</div>
  </div>`;
  document.body.appendChild(el);

  const body = el.querySelector('#opt-body');
  let tab = 'video';
  let visible = false;
  let awaitingRebind = null;

  el.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    tab = t.dataset.t;
    el.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
    render();
  }));

  const row = (label, control, value = '') =>
    `<div class="row"><label>${label}</label><div>${control}</div>
     <div class="val">${value}</div></div>`;

  const slider = (id, min, max, step, val) =>
    `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">`;

  const toggle = (id, on) =>
    `<button data-toggle="${id}" class="${on ? 'on' : ''}">${on ? 'LIGADO' : 'DESLIGADO'}</button>`;

  function renderVideo() {
    const s = quality.settings;
    body.innerHTML = `
      ${row('PRESET DE QUALIDADE', `<div class="seg">${quality.tiers.map((t) =>
    `<button data-tier="${t}" class="${quality.tier === t ? 'on' : ''}">${t.toUpperCase()}</button>`).join('')}</div>`)}
      ${row('RENDER SCALE', slider('rs', 0.5, 2.0, 0.05, s.renderScale),
    `${Math.round(s.renderScale * 100)}%`)}
      <div class="hint">Render scale e separado da resolucao da janela: abaixe
        pra ganhar fps, suba acima de 100% se sobrar GPU (supersampling).</div>
      ${row('SOMBRAS', toggle('shadows', s.shadows))}
      ${row('RESOLUCAO DA SOMBRA', slider('shadowMapSize', 512, 4096, 512, s.shadowMapSize), s.shadowMapSize)}
      ${row('DISTANCIA DA SOMBRA', slider('shadowDistance', 60, 400, 10, s.shadowDistance), `${s.shadowDistance} m`)}
      ${row('OCLUSAO DE AMBIENTE (GTAO)', toggle('ssao', s.ssao))}
      ${row('BLOOM', toggle('bloom', s.bloom))}
      ${row('FORCA DO BLOOM', slider('bloomStrength', 0, 1.2, 0.02, s.bloomStrength), s.bloomStrength.toFixed(2))}
      ${row('MOTION BLUR', toggle('motionBlur', s.motionBlur))}
      ${row('REFLEXO EM SCREEN SPACE', toggle('ssr', s.ssr))}
      ${row('VOLUMETRIA', toggle('volumetrics', s.volumetrics))}
      ${row('ANTI-ALIASING', `<div class="seg">${['smaa', 'fxaa', 'none'].map((a) =>
    `<button data-aa="${a}" class="${s.antialias === a ? 'on' : ''}">${a.toUpperCase()}</button>`).join('')}</div>`)}
      ${row('DISTANCIA DE DESENHO', slider('drawDistance', 400, 3000, 50, s.drawDistance), `${s.drawDistance} m`)}
      ${row('DETALHE INSTANCIADO', slider('instancedDetail', 0.2, 1, 0.05, s.instancedDetail),
    `${Math.round(s.instancedDetail * 100)}%`)}
      ${row('TELA CHEIA', '<button data-fs="1">ALTERNAR</button>')}
      ${row('VSYNC', toggle('vsync', save.getOption('vsync', false)))}
      <div class="hint">Sem VSync o jogo roda sem cap de framerate (padrao).</div>`;
  }

  function renderControles() {
    body.innerHTML = `
      ${row('SENSIBILIDADE DO MOUSE', slider('mouseSensitivity', 0.2, 3, 0.05,
    input.tuning.mouseSensitivity), input.tuning.mouseSensitivity.toFixed(2))}
      ${row('EXPO DOS STICKS', slider('expo', 0, 1, 0.02, input.tuning.expo),
    input.tuning.expo.toFixed(2))}
      ${row('DEADZONE', slider('deadzone', 0, 0.4, 0.01, input.tuning.deadzone),
    input.tuning.deadzone.toFixed(2))}
      ${row('INVERTER PITCH', toggle('invertPitch', input.tuning.invertPitch))}
      ${row('FOV DA 3a PESSOA', slider('fov', 60, 110, 1, CAMERA.chase.fov), `${CAMERA.chase.fov}°`)}
      ${row('TILT DA CAMERA FPV', slider('fpvTilt', CAMERA.fpv.tiltMin, CAMERA.fpv.tiltMax, 1,
    CAMERA.fpv.tilt), `${CAMERA.fpv.tilt}°`)}
      <div class="hint">Clique numa acao pra regravar a tecla.</div>
      ${Object.keys(input.bindings).map((a) => row(
    ACTION_LABELS[a] || a,
    `<button data-rebind="${a}" class="${awaitingRebind === a ? 'rebind' : ''}">${
      awaitingRebind === a ? 'PRESSIONE UMA TECLA...' : (input.bindings[a][0] || '—')}</button>`,
  )).join('')}
      ${row('RESTAURAR PADRAO', '<button data-resetbind="1">RESTAURAR</button>')}`;
  }

  function renderAudio() {
    body.innerHTML = ['master', 'engine', 'wind', 'sfx', 'music'].map((k) => row(
      k.toUpperCase(), slider(`mix-${k}`, 0, 1, 0.02, audio.mix[k]),
      `${Math.round(audio.mix[k] * 100)}%`,
    )).join('')
      + `<div class="hint">Tudo sintetizado em Web Audio — nenhum arquivo de som.</div>`;
  }

  function renderJogo() {
    body.innerHTML = `
      ${row('MODO TREINO (SEM RISCO)', toggle('noRisk', damage.state.noRisk))}
      <div class="hint">No modo treino o drone nao quebra e nao ha custo de reparo.</div>
      ${row('EXPORTAR SAVE', '<button data-export="1">BAIXAR JSON</button>')}
      ${row('IMPORTAR SAVE', '<input type="file" id="opt-import" accept="application/json">')}
      ${row('APAGAR PROGRESSO', '<button data-reset="1">APAGAR TUDO</button>')}
      <div class="hint">Dinheiro: $ ${save.data.money} ·
        Missoes feitas: ${Object.values(save.data.missions).filter((m) => m.done).length} ·
        POIs: ${save.data.discovered.length}</div>`;
  }

  function applySetting(key, value) {
    quality.set(key, value);
    if (key === 'renderScale') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * value);
      pipeline.setSize(window.innerWidth, window.innerHeight);
    } else {
      pipeline.applySettings(quality.settings);
    }
    save.setOption(key, value);
    bus.emit('quality:changed', quality.settings);
  }

  function render() {
    if (tab === 'video') renderVideo();
    else if (tab === 'controles') renderControles();
    else if (tab === 'audio') renderAudio();
    else renderJogo();
    wire();
  }

  function wire() {
    body.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => {
      quality.setTier(b.dataset.tier);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * quality.settings.renderScale);
      pipeline.applySettings(quality.settings);
      save.setOption('tier', b.dataset.tier);
      bus.emit('quality:changed', quality.settings);
      render();
    }));
    body.querySelectorAll('[data-aa]').forEach((b) => b.addEventListener('click', () => {
      applySetting('antialias', b.dataset.aa); render();
    }));
    body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      if (k === 'invertPitch') { input.tuning.invertPitch = !input.tuning.invertPitch; save.setOption('invertPitch', input.tuning.invertPitch); }
      else if (k === 'noRisk') damage.setNoRisk(!damage.state.noRisk);
      else if (k === 'vsync') save.setOption('vsync', !save.getOption('vsync', false));
      else applySetting(k, !quality.settings[k]);
      render();
    }));
    body.querySelectorAll('input[type=range]').forEach((r) => {
      r.addEventListener('input', () => {
        const v = parseFloat(r.value);
        const id = r.id;
        if (id === 'rs') applySetting('renderScale', v);
        else if (id.startsWith('mix-')) { audio.setMix(id.slice(4), v); save.setOption(id, v); }
        else if (id === 'mouseSensitivity') { input.tuning.mouseSensitivity = v; save.setOption(id, v); }
        else if (id === 'expo') { input.tuning.expo = v; save.setOption(id, v); }
        else if (id === 'deadzone') { input.tuning.deadzone = v; save.setOption(id, v); }
        else if (id === 'fov') { CAMERA.chase.fov = v; save.setOption(id, v); }
        else if (id === 'fpvTilt') { CAMERA.fpv.tilt = v; save.setOption(id, v); }
        else applySetting(id, v);
        const val = r.closest('.row').querySelector('.val');
        if (val) val.textContent = id === 'rs' ? `${Math.round(v * 100)}%` : String(v);
      });
    });
    body.querySelectorAll('[data-rebind]').forEach((b) => b.addEventListener('click', () => {
      awaitingRebind = b.dataset.rebind;
      render();
    }));
    body.querySelector('[data-resetbind]')?.addEventListener('click', () => {
      input.resetBindings(); save.setOption('bindings', null); render();
    });
    body.querySelector('[data-fs]')?.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    });
    body.querySelector('[data-export]')?.addEventListener('click', () => save.exportFile());
    body.querySelector('#opt-import')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (f && await save.importFile(f)) location.reload();
    });
    body.querySelector('[data-reset]')?.addEventListener('click', () => {
      save.reset(); location.reload();
    });
  }

  // rebind captura a proxima tecla
  window.addEventListener('keydown', (e) => {
    if (!visible || !awaitingRebind) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== 'Escape') {
      input.rebind(awaitingRebind, [e.code]);
      save.setOption('bindings', input.bindings);
    }
    awaitingRebind = null;
    render();
  }, true);

  function open() { visible = true; el.classList.add('on'); render(); }
  function close() { visible = false; awaitingRebind = null; el.classList.remove('on'); }

  /** Reaplica o que estava salvo (chamado no boot). */
  function restore() {
    const t = save.getOption('tier', null);
    if (t) quality.setTier(t);
    for (const k of ['renderScale', 'shadows', 'ssao', 'bloom', 'motionBlur', 'ssr',
      'volumetrics', 'antialias', 'drawDistance', 'instancedDetail', 'shadowMapSize',
      'shadowDistance', 'bloomStrength']) {
      const v = save.getOption(k, undefined);
      if (v !== undefined) quality.set(k, v);
    }
    input.loadBindings(save.getOption('bindings', null));
    input.tuning.mouseSensitivity = save.getOption('mouseSensitivity', INPUT.mouseSensitivity);
    input.tuning.expo = save.getOption('expo', INPUT.expo);
    input.tuning.deadzone = save.getOption('deadzone', INPUT.deadzone);
    input.tuning.invertPitch = save.getOption('invertPitch', INPUT.invertPitch);
    CAMERA.chase.fov = save.getOption('fov', CAMERA.chase.fov);
    CAMERA.fpv.tilt = save.getOption('fpvTilt', CAMERA.fpv.tilt);
    for (const k of ['master', 'engine', 'wind', 'sfx', 'music']) {
      const v = save.getOption(`mix-${k}`, undefined);
      if (v !== undefined) audio.setMix(k, v);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * quality.settings.renderScale);
    void QUALITY;
  }

  return {
    el, open, close, restore, render,
    get visible() { return visible; },
    toggle() { if (visible) close(); else open(); return visible; },
  };
}
