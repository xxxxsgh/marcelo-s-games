/**
 * Quadro de missoes e hangar. Um painel so, duas abas — abre com B.
 * Narrativamente fica na base do telhado; mecanicamente abre de qualquer
 * lugar, porque obrigar o jogador a voar ate um quadro pra ler texto e atrito
 * sem beneficio.
 */
const CSS = `
.board { position:fixed; inset:0; z-index:45; display:none;
  background:rgba(4,7,12,.93); backdrop-filter:blur(3px);
  font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; color:#dff0ff; }
.board.on { display:block; }
.board .wrap { position:absolute; inset:6% 8%; display:flex; flex-direction:column; }
.board h1 { font-size:13px; letter-spacing:.36em; font-weight:400; opacity:.7;
  margin-bottom:4px; }
.board .tabs { display:flex; gap:18px; margin:10px 0 16px; }
.board .tab { padding:6px 0; font-size:11px; letter-spacing:.24em; opacity:.45;
  cursor:pointer; border-bottom:2px solid transparent; }
.board .tab.on { opacity:1; border-bottom-color:#37d5ff; }
.board .body { flex:1; overflow-y:auto; }
.board .money { position:absolute; right:0; top:0; font-size:15px; color:#ffcf4a;
  letter-spacing:.1em; }

.board .m { display:grid; grid-template-columns:96px 1fr 110px 96px;
  gap:14px; align-items:center; padding:11px 12px; border:1px solid rgba(120,170,220,.14);
  margin-bottom:7px; cursor:pointer; }
.board .m:hover { border-color:rgba(55,213,255,.5); background:rgba(55,213,255,.05); }
.board .m.locked { opacity:.35; cursor:not-allowed; }
.board .m.done { border-color:rgba(91,224,138,.3); }
.board .type { font-size:9px; letter-spacing:.2em; font-weight:600; }
.board .name { font-size:12px; }
.board .brief { font-size:10px; opacity:.6; margin-top:2px; }
.board .diff { font-size:11px; letter-spacing:.2em; color:#ffb03a; }
.board .pay { font-size:13px; color:#ffcf4a; text-align:right; }
.board .req { font-size:9px; opacity:.6; }

.board .u { display:grid; grid-template-columns:120px 1fr 150px 90px; gap:14px;
  align-items:center; padding:11px 12px; border:1px solid rgba(120,170,220,.14);
  margin-bottom:7px; }
.board .u .line { font-size:11px; letter-spacing:.16em; font-weight:600; }
.board .tiers { display:flex; gap:5px; }
.board .tiers i { width:26px; height:5px; background:rgba(255,255,255,.15); }
.board .tiers i.on { background:#37d5ff; }
.board .eff { font-size:10px; opacity:.75; }
.board .cost { text-align:right; }
.board button { font:inherit; font-size:10px; letter-spacing:.16em; padding:6px 12px;
  background:transparent; color:#37d5ff; border:1px solid #37d5ff; cursor:pointer; }
.board button:disabled { opacity:.3; cursor:not-allowed; }
.board .chassis { display:flex; gap:10px; margin:6px 0 18px; }
.board .ch { flex:1; padding:12px; border:1px solid rgba(120,170,220,.18); cursor:pointer; }
.board .ch.on { border-color:#37d5ff; background:rgba(55,213,255,.07); }
.board .ch b { font-size:11px; letter-spacing:.18em; }
.board .ch div { font-size:10px; opacity:.65; margin-top:5px; }
.board .foot { font-size:10px; opacity:.5; letter-spacing:.18em; padding-top:12px; }
`;

const DIFF = (n) => '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n));

export function createBoard(missions, hangar, save, bus) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.className = 'board';
  el.innerHTML = `
    <div class="wrap">
      <h1>BASE — TELHADO</h1>
      <div class="money" id="bd-money"></div>
      <div class="tabs">
        <div class="tab on" data-tab="missoes">MISSOES</div>
        <div class="tab" data-tab="hangar">HANGAR</div>
      </div>
      <div class="body" id="bd-body"></div>
      <div class="foot">B FECHA · CLIQUE PRA ACEITAR</div>
    </div>`;
  document.body.appendChild(el);

  const body = el.querySelector('#bd-body');
  const moneyEl = el.querySelector('#bd-money');
  let tab = 'missoes';
  let visible = false;

  el.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      tab = t.dataset.tab;
      el.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
      render();
    });
  });

  function renderMissions() {
    const list = missions.available();
    body.innerHTML = list.map((m) => {
      const type = missions.types[m.type];
      return `<div class="m ${m.locked ? 'locked' : ''} ${m.done ? 'done' : ''}"
          data-id="${m.id}">
        <div class="type" style="color:${type.color}">${type.label}</div>
        <div>
          <div class="name">${m.name}${m.done ? '  ✓' : ''}</div>
          <div class="brief">${m.brief}</div>
          ${m.locked ? `<div class="req">REQUER UPGRADE: ${m.requires}</div>` : ''}
        </div>
        <div class="diff">${DIFF(m.difficulty)}</div>
        <div class="pay">$ ${m.reward}</div>
      </div>`;
    }).join('');

    body.querySelectorAll('.m').forEach((row) => {
      if (row.classList.contains('locked')) return;
      row.addEventListener('click', () => {
        bus.emit('board:accept', row.dataset.id);
        close();
      });
    });
  }

  function renderHangar() {
    const h = hangar;
    const money = save.data.money;
    const chassisHtml = h.chassisList.map((c) => `
      <div class="ch ${h.chassis === c.id ? 'on' : ''}" data-ch="${c.id}">
        <b>${c.name}</b>
        <div>${c.desc}</div>
        <div style="color:#ffcf4a">${c.cost ? `$ ${c.cost}` : 'DISPONIVEL'}</div>
      </div>`).join('');

    const linesHtml = h.lines.map((l) => {
      const tier = h.tierOf(l.id);
      const next = h.nextTier(l.id);
      const cost = next ? next.cost : 0;
      return `<div class="u">
        <div>
          <div class="line">${l.name}</div>
          <div class="tiers">${[0, 1, 2].map((i) =>
    `<i class="${i < tier ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="eff">${next ? next.desc : l.maxed}</div>
        <div class="eff" style="opacity:.55">${next ? next.tradeoff : ''}</div>
        <div class="cost">
          ${next ? `<button data-up="${l.id}" ${money < cost ? 'disabled' : ''}>
            $ ${cost}</button>` : '<span style="opacity:.4">MAX</span>'}
        </div>
      </div>`;
    }).join('');

    body.innerHTML = `<div class="chassis">${chassisHtml}</div>${linesHtml}
      <div class="foot" style="margin-top:14px">
        Cada upgrade tem CUSTO de pilotagem, nao so beneficio.
      </div>`;

    body.querySelectorAll('[data-up]').forEach((b) => {
      b.addEventListener('click', () => {
        if (h.buy(b.dataset.up)) { render(); bus.emit('hangar:changed'); }
      });
    });
    body.querySelectorAll('[data-ch]').forEach((c) => {
      c.addEventListener('click', () => {
        if (h.setChassis(c.dataset.ch)) { render(); bus.emit('hangar:changed'); }
      });
    });
  }

  function render() {
    moneyEl.textContent = `$ ${save.data.money}`;
    if (tab === 'missoes') renderMissions(); else renderHangar();
  }

  function open() { visible = true; el.classList.add('on'); render(); }
  function close() { visible = false; el.classList.remove('on'); }

  return {
    el,
    get visible() { return visible; },
    open, close, render,
    toggle() { if (visible) close(); else open(); return visible; },
  };
}
