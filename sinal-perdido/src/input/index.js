/**
 * Entrada: teclado + mouse + gamepad, tudo num objeto so.
 *
 * As bordas (`pressed`) sao consumidas no passo FIXO, nao no render: quem le
 * `pressed('KeyR')` esta rodando na simulacao, e limpar no fim do frame perderia
 * cliques em maquina lenta. `endStep()` limpa depois de cada passo.
 */

/** Teclas que o navegador rouba e o jogo precisa de volta. */
const BLOQUEAR = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
  'F1', 'F3', 'KeyR', 'Slash', 'Quote',
]);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();

  const mouse = {
    x: 0, y: 0,           // em pixels de CSS, relativo ao canvas
    esq: false, dir: false,
    cliqueEsq: false, cliqueDir: false,
    roda: 0,
    dentro: false,
    movimentou: false,    // true quando o mouse mexeu (define se a mira e do mouse)
  };

  const pad = { ativo: false, moveX: 0, moveY: 0, miraX: 0, miraY: 0, gatilho: 0 };

  let ultimoDispositivo = 'mouse';

  const onKeyDown = (e) => {
    if (e.repeat) { return; }
    if (BLOQUEAR.has(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    ultimoDispositivo = 'teclado';
  };
  const onKeyUp = (e) => {
    down.delete(e.code);
    released.add(e.code);
  };
  const onBlur = () => { down.clear(); mouse.esq = false; mouse.dir = false; };

  const posMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };

  const onMove = (e) => {
    posMouse(e);
    mouse.dentro = true;
    mouse.movimentou = true;
    ultimoDispositivo = 'mouse';
  };
  const onDown = (e) => {
    posMouse(e);
    if (e.button === 0) { mouse.esq = true; mouse.cliqueEsq = true; }
    if (e.button === 2) { mouse.dir = true; mouse.cliqueDir = true; }
    ultimoDispositivo = 'mouse';
    e.preventDefault();
  };
  const onUp = (e) => {
    if (e.button === 0) mouse.esq = false;
    if (e.button === 2) mouse.dir = false;
  };
  const onWheel = (e) => { mouse.roda += Math.sign(e.deltaY); e.preventDefault(); };
  const onCtx = (e) => e.preventDefault();
  const onLeave = () => { mouse.dentro = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onCtx);
  canvas.addEventListener('pointerleave', onLeave);

  function lerGamepad() {
    const pads = navigator.getGamepads?.() || [];
    let g = null;
    for (const p of pads) if (p && p.connected) { g = p; break; }
    if (!g) { pad.ativo = false; return; }
    const dz = (v) => (Math.abs(v) < 0.22 ? 0 : v);
    pad.moveX = dz(g.axes[0] || 0);
    pad.moveY = dz(g.axes[1] || 0);
    pad.miraX = dz(g.axes[2] || 0);
    pad.miraY = dz(g.axes[3] || 0);
    pad.gatilho = Math.max(g.buttons[7]?.value || 0, g.buttons[5]?.value || 0);
    pad.esquiva = !!(g.buttons[0]?.pressed || g.buttons[1]?.pressed);
    pad.recarga = !!g.buttons[2]?.pressed;
    pad.troca = !!g.buttons[3]?.pressed;
    const usando = Math.abs(pad.moveX) + Math.abs(pad.moveY) + Math.abs(pad.miraX)
      + Math.abs(pad.miraY) + pad.gatilho > 0.1;
    pad.ativo = true;
    if (usando) ultimoDispositivo = 'pad';
  }

  return {
    mouse, pad,
    get dispositivo() { return ultimoDispositivo; },
    down: (code) => down.has(code),
    pressed: (code) => pressed.has(code),
    released: (code) => released.has(code),
    qualquerTecla: () => pressed.size > 0 || mouse.cliqueEsq,

    /** Vetor de movimento normalizado (teclado ou stick esquerdo). */
    eixo() {
      let x = 0, y = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
      if (x === 0 && y === 0 && pad.ativo) { x = pad.moveX; y = pad.moveY; }
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y, mag: Math.min(1, m) };
    },

    /** Chamado no inicio de cada passo fixo. */
    beginStep() { lerGamepad(); },

    /** Chamado no fim de cada passo fixo: zera as bordas ja consumidas. */
    endStep() {
      pressed.clear();
      released.clear();
      mouse.cliqueEsq = false;
      mouse.cliqueDir = false;
      mouse.roda = 0;
    },

    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onCtx);
      canvas.removeEventListener('pointerleave', onLeave);
    },
  };
}
