import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const fmt = (t) => t.replace(/\*(.+?)\*/g, '<i>$1</i>');

/**
 * Interface: dialogos com maquina de escrever, escolhas, narracao,
 * lista de tarefas, prompt de interacao e estrela-guia.
 * Tudo assincrono: `await ui.say(...)` deixa os roteiros lineares.
 */
export class UI {
  constructor(audio) {
    this.audio = audio;
    this.dlg = $('#dialog');
    this.who = this.dlg.querySelector('.who');
    this.text = this.dlg.querySelector('.text');
    this.choicesEl = this.dlg.querySelector('.choices');
    this.narrEl = $('#narr');
    this.q = [];
    this.cur = null;     // { kind, full, shown, resolve, ... }
    this.busy = false;
    this.dlg.addEventListener('pointerdown', (e) => { if (e.target.tagName !== 'BUTTON') this.clicked = true; });
    this.narrEl.style.pointerEvents = 'none';
    addEventListener('pointerdown', () => { if (this.cur && this.cur.kind === 'narr') this.clicked = true; });
    this._v = new THREE.Vector3();
  }

  // ------------------------------------------------------------ dialogos
  say(who, text, o = {}) {
    return new Promise((resolve) => this.open({ kind: 'say', who, text, voice: o.voice ?? 1, resolve, auto: o.auto }));
  }
  choose(who, text, options, o = {}) {
    return new Promise((resolve) => this.open({ kind: 'choose', who, text, options, voice: o.voice ?? 1, resolve }));
  }
  narrate(text, o = {}) {
    return new Promise((resolve) => this.open({ kind: 'narr', text, resolve, auto: o.auto ?? null }));
  }

  open(c) {
    this.cur = { ...c, shown: 0, t: 0, done: false, sel: 0 };
    this.busy = true;
    this.clicked = false;
    if (c.kind === 'narr') {
      this.narrEl.classList.add('on');
      this.narrEl.querySelector('.text').innerHTML = '';
    } else {
      this.dlg.classList.add('on');
      this.dlg.classList.remove('wait');
      this.who.textContent = c.who || '';
      this.text.innerHTML = '';
      this.choicesEl.innerHTML = '';
    }
  }

  close(result) {
    const c = this.cur;
    this.cur = null;
    this.busy = false;
    if (c.kind === 'narr') this.narrEl.classList.remove('on');
    else this.dlg.classList.remove('on');
    setTimeout(() => c.resolve(result), 60);
  }

  update(dt, input) {
    const c = this.cur;
    if (!c) return;
    const adv = input.pressed('act') || input.pressed('jump') || this.clicked;
    this.clicked = false;
    const plain = c.text.replace(/\*/g, '');
    const speed = c.kind === 'narr' ? 38 : 46;
    if (!c.done) {
      const before = Math.floor(c.shown);
      c.shown += dt * speed;
      const n = Math.floor(c.shown);
      if (c.kind !== 'narr' && n !== before && n % 2 === 0) {
        const ch = plain[n] || ' ';
        if (/\w/.test(ch)) this.audio.blip(c.voice, ch);
      }
      if (adv && c.shown > 2) c.shown = plain.length;
      if (c.shown >= plain.length) {
        c.done = true; c.t = 0;
        if (c.kind === 'choose') this.showChoices();
        else if (c.kind === 'say') this.dlg.classList.add('wait');
      }
      this.render(c, Math.min(Math.floor(c.shown), plain.length));
      return;
    }
    c.t += dt;
    if (c.kind === 'choose') {
      const btns = [...this.choicesEl.children];
      if (input.pressed('up')) c.sel = (c.sel + btns.length - 1) % btns.length;
      if (input.pressed('down')) c.sel = (c.sel + 1) % btns.length;
      btns.forEach((b, i) => b.classList.toggle('sel', i === c.sel));
      if ((input.pressed('act') || input.pressed('jump')) && c.t > 0.25) { this.audio.chime(c.sel + 2, 0.06); this.close(c.sel); }
      return;
    }
    if ((adv && c.t > 0.15) || (c.auto && c.t > c.auto)) { this.audio.chime(0, 0.03); this.close(); }
  }

  render(c, n) {
    // revela respeitando os *italicos*
    let out = '', k = 0, it = false;
    for (const ch of c.text) {
      if (ch === '*') { it = !it; out += it ? '<i>' : '</i>'; continue; }
      if (k >= n) break;
      out += ch === '\n' ? '<br>' : ch; k++;
    }
    if (it) out += '</i>';
    const hidden = c.text.replace(/\*/g, '').slice(n).replace(/\n/g, '<br>');
    const html = out + `<span style="opacity:0">${hidden}</span>`;
    if (c.kind === 'narr') this.narrEl.querySelector('.text').innerHTML = html;
    else this.text.innerHTML = html;
  }

  showChoices() {
    const c = this.cur;
    this.choicesEl.innerHTML = '';
    c.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = fmt(o);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (this.cur === c) { this.audio.chime(i + 2, 0.06); this.close(i); } });
      b.addEventListener('pointerenter', () => { c.sel = i; });
      this.choicesEl.appendChild(b);
    });
  }

  // ------------------------------------------------------------ tarefas
  setQuests(title, list) {
    this.q = list.map((x) => ({ n: 0, max: 0, done: false, hidden: false, ...x }));
    this.qTitle = title;
    this.drawQuests();
  }
  quest(id, patch) {
    const q = this.q.find((x) => x.id === id);
    if (!q) return;
    const wasDone = q.done;
    Object.assign(q, patch);
    if (q.max && q.n >= q.max) q.done = true;
    if (q.done && !wasDone) this.audio.success();
    this.drawQuests();
  }
  qget(id) { return this.q.find((x) => x.id === id); }
  drawQuests() {
    const el = $('#quest');
    if (!this.q.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="h">${this.qTitle || ''}</div>` + this.q.filter((q) => !q.hidden).map((q) =>
      `<div class="q ${q.done ? 'done' : ''}">${fmt(q.text)}${q.max ? ` <small>(${Math.min(q.n, q.max)}/${q.max})</small>` : ''}</div>`).join('');
  }
  clearQuests() { this.q = []; this.drawQuests(); }

  // ------------------------------------------------------------ avisos
  toast(text, ms = 2600) {
    const el = $('#toast');
    el.innerHTML = fmt(text);
    el.classList.add('on');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => el.classList.remove('on'), ms);
  }
  card(k, t, s, ms = 4200) {
    const el = $('#card');
    el.querySelector('.k').textContent = k;
    el.querySelector('.t').textContent = t;
    el.querySelector('.s').textContent = s;
    el.classList.add('on');
    clearTimeout(this._card);
    this._card = setTimeout(() => el.classList.remove('on'), ms);
  }
  sunsets(n, show = true) {
    const el = $('#sunsets');
    el.textContent = `☀ pores do sol: ${n}`;
    el.classList.toggle('on', show);
  }

  // ------------------------------------------------------------ mundo -> tela
  project(p, cam) {
    const v = this._v.copy(p).project(cam);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, behind: v.z > 1 };
  }

  prompt(p, label, cam, hold = 0) {
    const el = $('#prompt');
    if (!p || this.busy) { el.classList.remove('on'); return; }
    const s = this.project(p, cam);
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
    el.querySelector('.lbl').textContent = label;
    el.querySelector('.ring circle').style.strokeDashoffset = String(100.5 * (1 - hold));
    el.classList.add('on');
  }

  drawing(svg, cap = '') {
    const el = $('#drawing');
    if (!svg) { el.classList.remove('on'); return; }
    el.querySelector('svg').innerHTML = svg;
    el.querySelector('.cap').textContent = cap;
    el.classList.add('on');
  }

  credits(html) {
    const el = $('#credits');
    if (!html) { el.classList.remove('on'); return; }
    el.innerHTML = html;
    el.classList.add('on');
  }

  skipHint(on) { $('#skip').classList.toggle('on', on); }
}
