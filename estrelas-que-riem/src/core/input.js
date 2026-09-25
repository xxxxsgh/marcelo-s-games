// Teclado + mouse + toque + gamepad num so lugar.
// Acoes: act (E/Enter/clique no botao), jump (Espaco), menu (Esc), skip.

const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'camL', ArrowRight: 'camR', KeyQ: 'camL',
  KeyE: 'act', Enter: 'act', KeyF: 'act',
  Space: 'jump', Escape: 'menu', Tab: 'skip', ShiftLeft: 'run', ShiftRight: 'run',
};

export class Input {
  constructor(el) {
    this.el = el;
    this.held = new Set();
    this.edge = new Set();
    this.look = { x: 0, y: 0 };
    this.zoom = 0;
    this.stick = { x: 0, y: 0 };      // joystick de toque
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      if (a === 'skip' || a === 'jump' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(a)) this.edge.add(a);
      this.held.add(a);
    });
    addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) this.held.delete(a); });
    addEventListener('blur', () => this.held.clear());

    // arrastar com o mouse gira a camera
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      drag = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerType === 'touch') return;
      this.look.x += (e.clientX - drag.x) * 0.005;
      this.look.y += (e.clientY - drag.y) * 0.004;
      drag = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); }, { passive: true });

    this.buildTouch();
  }

  buildTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    if (this.touch) root.classList.add('on');
    const pad = root.querySelector('.pad');
    const knob = root.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId; pad.setPointerCapture(id);
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      this.stick.x = dx / R; this.stick.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    pad.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.stick.x = this.stick.y = 0; knob.style.transform = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);

    // metade direita da tela: arrastar gira camera
    const look = root.querySelector('.look');
    let lid = null, lx = 0, ly = 0;
    look.addEventListener('pointerdown', (e) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      this.look.x += (e.clientX - lx) * 0.008; this.look.y += (e.clientY - ly) * 0.006;
      lx = e.clientX; ly = e.clientY;
    });
    look.addEventListener('pointerup', () => { lid = null; });

    for (const b of root.querySelectorAll('[data-act]')) {
      const a = b.dataset.act;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.edge.add(a); this.held.add(a); b.classList.add('down'); });
      const up = () => { this.held.delete(a); b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
  }

  poll() {
    // gamepad
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    this.gp = null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      this.gp = { x: dz(gp.axes[0]), y: -dz(gp.axes[1]) };
      this.look.x += dz(gp.axes[2] || 0) * 0.05;
      this.look.y += dz(gp.axes[3] || 0) * 0.04;
      const btn = (i, a) => {
        const p = gp.buttons[i] && gp.buttons[i].pressed;
        const k = 'gp' + i;
        if (p && !this[k]) this.edge.add(a);
        if (p) this.held.add(a); else if (this[k]) this.held.delete(a);
        this[k] = p;
      };
      btn(0, 'jump'); btn(2, 'act'); btn(1, 'act'); btn(9, 'menu');
    }
  }

  get move() {
    let x = 0, y = 0;
    if (this.held.has('up')) y += 1;
    if (this.held.has('down')) y -= 1;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    x += this.stick.x; y += this.stick.y;
    if (this.gp) { x += this.gp.x; y += this.gp.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (!this.enabled) return { x: 0, y: 0 };
    return { x, y };
  }

  pressed(a) { return this.edge.has(a); }
  down(a) { return this.held.has(a); }

  endFrame() {
    this.edge.clear();
    this.look.x = this.look.y = 0;
    this.zoom = 0;
  }
}
