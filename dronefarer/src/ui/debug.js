/**
 * Painel de debug (F3): frametime, draw calls, triangulos, chunks e estado do
 * drone. Serve pra achar o gargalo sem abrir devtools.
 */
export function createDebug(renderer, loop, city, colliders, drone, pois) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed; top:10px; right:12px; z-index:60; display:none;
    font:10px/1.65 ui-monospace,monospace; color:#9ff0c4; background:rgba(4,8,12,.72);
    padding:10px 14px; border:1px solid rgba(120,200,160,.2); white-space:pre;
    pointer-events:none; letter-spacing:.06em; min-width:230px;`;
  document.body.appendChild(el);

  let visible = false;
  let acc = 0;
  let worstFrame = 0;

  function update(dt) {
    if (!visible) return;
    worstFrame = Math.max(worstFrame, loop.stats.frameMs);
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;

    const info = renderer.info;
    const st = drone.state;
    el.textContent = [
      `FPS        ${loop.stats.fps.toFixed(0)}`,
      `FRAME      ${loop.stats.frameMs.toFixed(2)} ms  (pior ${worstFrame.toFixed(1)})`,
      `FISICA     ${loop.stats.physMs.toFixed(2)} ms  x${loop.stats.steps}`,
      `RENDER     ${loop.stats.renderMs.toFixed(2)} ms`,
      '',
      `DRAW CALLS ${info.render.calls}`,
      `TRIANGULOS ${(info.render.triangles / 1000).toFixed(1)}k`,
      `GEOMETRIAS ${info.memory.geometries}`,
      `TEXTURAS   ${info.memory.textures}`,
      `PROGRAMAS  ${info.programs ? info.programs.length : '?'}`,
      '',
      `CHUNKS     ${city.stats.loaded} (fila ${city.stats.queued})`,
      `PREDIOS    ${city.stats.buildings}`,
      `CHUNK MS   ${city.stats.lastBuildMs.toFixed(2)}`,
      `COLISORES  ${colliders.count}`,
      '',
      `POS        ${st.pos.x.toFixed(0)} ${st.pos.y.toFixed(0)} ${st.pos.z.toFixed(0)}`,
      `VEL        ${st.speed.toFixed(1)} m/s  (h ${st.hSpeed.toFixed(1)})`,
      `MOTOR      ${(st.motor * 100).toFixed(0)}%  G ${st.gforce.toFixed(1)}`,
      `MODO       ${st.mode.toUpperCase()}`,
      `SINAL      ${(pois.state.signal * 100).toFixed(0)}%`,
      `BATERIA    ${drone.status.battery.toFixed(0)}%`,
    ].join('\n');
  }

  return {
    el, update,
    get visible() { return visible; },
    toggle() {
      visible = !visible;
      el.style.display = visible ? '' : 'none';
      worstFrame = 0;
      return visible;
    },
    resetWorst() { worstFrame = 0; },
  };
}

/**
 * Tutorial contextual de 4 passos no primeiro voo. Pulavel com ESC.
 * Cada passo so sai quando o jogador FAZ a coisa — ler nao conta.
 */
export function createTutorial(bus, save) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed; left:50%; top:64px; transform:translateX(-50%);
    z-index:35; display:none; text-align:center; pointer-events:none;
    font:12px/1.7 ui-monospace,monospace; color:#dff0ff; letter-spacing:.12em;
    background:rgba(4,8,14,.72); padding:12px 22px;
    border:1px solid rgba(120,170,220,.22);`;
  document.body.appendChild(el);

  const STEPS = [
    { text: 'W acelera. Segure W e suba ate 8 metros.',
      done: (ctx) => ctx.drone.state.altitude > 8 },
    { text: 'Setas inclinam. Incline pra frente e passe de 30 km/h.',
      done: (ctx) => ctx.drone.state.hSpeed > 8.3 },
    { text: 'M troca pra ACRO: rotacao livre, sem auto-nivelamento.',
      done: (ctx) => ctx.drone.state.mode === 'acro' },
    { text: 'Atravesse o primeiro gate. R reinicia a qualquer momento.',
      done: (ctx) => ctx.race.state.gateIndex > 0 },
  ];

  let step = 0;
  let active = !save.get('tutorialDone', false);
  let holdTimer = 0;

  if (active) {
    el.style.display = '';
    el.textContent = `${STEPS[0].text}\nESC pula o tutorial`;
  }

  function finish() {
    active = false;
    el.style.display = 'none';
    save.set('tutorialDone', true);
  }

  bus.on('action:options', () => { if (active) finish(); });

  function update(dt, ctx) {
    if (!active) return;
    if (holdTimer > 0) {
      holdTimer -= dt;
      if (holdTimer <= 0) {
        step++;
        if (step >= STEPS.length) { finish(); return; }
        el.textContent = `${STEPS[step].text}\nESC pula o tutorial`;
      }
      return;
    }
    if (STEPS[step].done(ctx)) {
      el.textContent = 'CERTO';
      holdTimer = 0.9;
    }
  }

  return { update, finish, get active() { return active; } };
}
