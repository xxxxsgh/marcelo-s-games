// ---------- interface (DOM): HUD de transmissao, garagem, chave, juizes ----------
const SC = [], TM = [], KOS = [], RPM = [], PCT = [];
for (let i = 0; i <= 100; i++) { SC.push(`scaleX(${(i / 100).toFixed(2)})`); RPM.push(`GIRO ${i}%`); PCT.push(i + '%'); }
for (let i = 0; i <= 600; i++) TM.push(Math.floor(i / 60) + ':' + String(i % 60).padStart(2, '0'));
for (let i = 0; i <= 10; i++) KOS.push(' IMÓVEL — ' + i);
const RODADAS = ['QUARTAS DE FINAL', 'SEMIFINAL', 'FINAL'], CAMN = ['PERSEGUIÇÃO', 'A BORDO', 'TV'], PN = ['CHASSI', 'RODAS', 'BLIND.', 'ARMA', 'BATERIA'];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UI = {
  cur: '', last: new Int16Array(40).fill(-1), toastT: 0, koShown: -1, msgT: 0,
  build() {
    const card = s => `<div class="card ${s}" id="c${s}"><div class="nm"><span class="nu" id="nu${s}"></span><span id="nm${s}"></span></div><div class="sb" id="sb${s}"></div><div class="bars">${PN.map((p, i) => `<div class="bar" id="b${s}${i}">${p}<i><u id="u${s}${i}"></u></i></div>`).join('')}</div><div class="wst"><span id="ws${s}"></span><i><u id="wu${s}"></u></i></div></div>`;
    $('ui').innerHTML = `
<div class="scr" id="hud">${card('l')}${card('r')}<div id="clock"><b id="tm">3:00</b><span id="rd"></span></div><div id="msg"></div><div id="sub"></div><div id="ko"></div><div id="rep">REPLAY · GOLPE MAIS FORTE</div><div id="cam">CÂMERA <b id="camn"></b></div><div id="hint"></div></div>
<div class="scr" id="gar"><div class="pn"><h1>COPA <em>REBITE</em></h1><div class="st" id="gst"></div><div id="rows"></div><div class="ds" id="gds"></div></div><div class="sp"><div id="gbars"></div><div class="al" id="gal"></div></div><div class="hl" id="ghl"></div></div>
<div class="scr" id="chave"><h1>CHAVE DO <em>TORNEIO</em></h1><div class="s" id="chs"></div><div class="bk" id="bk"></div><div class="big" id="chb"></div><div class="ft" id="chf"></div></div>
<div class="scr" id="intro"><div class="ic" id="ic"></div></div>
<div class="scr" id="juizes"><h1>DECISÃO DOS JUÍZES</h1><div class="jg" id="jg"></div><div class="vd" id="jv"></div></div>
<div class="scr" id="pausa"><div>PAUSA</div><p>START / ESC continua<br>RT acelera · LT freia e ré · analógico esquerdo esterça<br>A arma · X desvira · Y câmera · B volta ao canto<br>teclado: W S A D · espaço · F · C · R</p></div>
<div id="toast"></div><div id="erro"></div>`;
    this.el = {}; for (const e of $('ui').querySelectorAll('[id]')) this.el[e.id] = e;
  },
  show(a, b) { for (const n of ['hud', 'gar', 'chave', 'intro', 'juizes', 'pausa']) this.el[n].classList.toggle('on', n === a || n === b); this.cur = a; },
  toast(t) { if (!this.el) return; this.el.toast.textContent = t; this.el.toast.style.display = 'block'; this.toastT = 2.5; },
  msg(t, s) { this.el.msg.textContent = t; this.el.sub.textContent = s || ''; },
  tick(dt) { if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.style.display = 'none'; } },
  css(c) { return Atlas.css(c, 1.6); },
  // ----- HUD -----
  hudInit(a, b, rodada) {
    const e = this.el; this.last.fill(-1); this.koShown = -1;
    for (const [s, B] of [['l', a], ['r', b]]) { e['c' + s].style.setProperty('--cc', this.css(B.cor)); e['nu' + s].textContent = B.num; e['nm' + s].textContent = B.nome; e['sb' + s].textContent = `${B.S.kg} kg · ${ARMAS[B.b[3]].nome}`; }
    this.he = ['l', 'r'].map(s => [0, 1, 2, 3, 4].map(i => e['u' + s + i]).concat([0, 1, 2, 3, 4].map(i => e['b' + s + i]), [e['wu' + s], e['ws' + s]])); this.kos = [a, b].map(B => KOS.map(k => B.nome + k));
    e.rd.textContent = rodada; e.ko.style.display = 'none'; e.rep.style.display = 'none'; this.msg('', '');
    e.hint.textContent = 'RT acelera · LT ré · A arma · X desvira · Y câmera · B canto';
  },
  setBar(k, el, v, bar) { v = v | 0; v = v < 0 ? 0 : v > 100 ? 100 : v; if (this.last[k] === v) return; this.last[k] = v; el.style.transform = SC[v]; if (bar) { bar.classList.toggle('low', v < 34 && v > 0); bar.classList.toggle('dead', v === 0); } },
  hud(sim, camIdx) {
    const e = this.el, L = this.last, H = this.he;
    for (let i = 0; i < 2; i++) { const B = sim.bots[i], h = B.hp, m = B.hpMax, o = i * 12, q = H[i];
      this.setBar(o, q[0], Math.ceil(h[0] / m[0] * 100) | 0, q[5]);
      this.setBar(o + 1, q[1], Math.ceil((h[1] + h[2] + h[3] + h[4]) / (4 * m[1]) * 100) | 0, q[6]);
      this.setBar(o + 2, q[2], Math.ceil((h[5] + h[6] + h[7] + h[8] + h[9]) / (m[5] + m[6] + m[7] + m[8] + m[9]) * 100) | 0, q[7]);
      this.setBar(o + 3, q[3], Math.ceil(h[10] / m[10] * 100) | 0, q[8]);
      this.setBar(o + 4, q[4], Math.ceil(h[11] / m[11] * 100) | 0, q[9]);
      const k = ARMAS[B.b[3]]; let code = 0, lvl = 0;
      if (h[10] <= 0) { code = 200; } else if (k.spin) { lvl = (Math.round(B.wspin / k.wmax * 10 + (L[o + 5] > 0 && L[o + 5] <= 100 && Math.abs(B.wspin / k.wmax * 100 - L[o + 5]) < 8 ? (L[o + 5] / 10 - B.wspin / k.wmax * 10) : 0)) | 0) * 10; code = B.won || lvl > 0 ? lvl : 201; } else if (B.wst === 2) { code = 204; lvl = 100; } else if (B.wst === 1) { code = 203; lvl = 100; } else if (B.wcd > 0) { lvl = (Math.round((1 - B.wcd / k.cd) * 20) | 0) * 5; code = 300 + lvl; } else { code = 202; lvl = 100; }
      if (L[o + 5] !== code) { L[o + 5] = code; q[11].textContent = code === 200 ? 'DESTRUÍDA' : code === 201 ? 'DESLIGADA' : code === 202 ? 'PRONTA' : code === 203 ? 'DISPARADA' : code === 204 ? 'PRENDENDO' : code >= 300 ? 'RECARREGANDO' : RPM[code]; }
      this.setBar(o + 6, q[10], lvl, null);
    }
    const t = Math.max(0, Math.ceil(sim.dur - sim.t) | 0); if (L[30] !== t) { L[30] = t; e.tm.textContent = TM[Math.min(t, 600)]; }
    if (L[31] !== camIdx) { L[31] = camIdx; e.camn.textContent = CAMN[camIdx]; }
    let ko = -1; for (let i = 0; i < 2; i++) { const B = sim.bots[i]; if (B.imm > 0 && !sim.over) ko = i * 20 + Math.min(10, Math.ceil(KO_T - B.imm) | 0); }
    if (ko !== this.koShown) { this.koShown = ko; if (ko < 0) e.ko.style.display = 'none'; else { e.ko.style.display = 'block'; e.ko.textContent = this.kos[ko >= 20 ? 1 : 0][ko % 20]; } }
  },
  // ----- garagem -----
  garage(g) {
    const e = this.el, b = g.pre, st = statsOf(b), base = statsOf(g.com), rep = g.repair, T = TOR;
    e.gst.textContent = (rep ? `ENTRE LUTAS · ${RODADAS[T.rodada]} · CONSERTOS/TROCAS RESTANTES: ${g.acoes}` : 'GARAGEM · MONTE SEU ROBÔ') + ` · TEMPORADA ${CAR.temp} · TROFÉUS ${CAR.trofeus} · ${CAR.v}V ${CAR.d}D`;
    const lists = [CHASSIS, RODAS, BLIND, ARMAS]; let h = '';
    for (let r = 0; r < 4; r++) { const p = lists[r][b[r]], sel = g.row === r, ed = sel && g.mode === 1; let hp = '';
      if (rep) { const f = GAR.slotHp(r); hp = `<span class="hp"><u style="transform:${SC[Math.round(f * 100)]}"></u></span><span class="x">${PCT[Math.round(f * 100)]}</span>`; }
      h += `<div class="row${sel ? ' sel' : ''}${ed ? ' ed' : ''}"><span class="k">${PARTES[r]}</span><span class="v">${ed ? '◀ ' : ''}${p.nome}${ed ? ' ▶' : ''}</span>${hp}<span class="x">${p.kg} kg</span></div>`; }
    h += `<div class="row${g.row === 4 ? ' sel' : ''}"><span class="k">PINTURA</span><span class="v">${CORES.map((c, i) => `<span class="sw${i === g.cor ? ' c' : ''}" style="background:${Atlas.css(c, 1.5)}"></span>`).join('')}</span></div>`;
    h += `<div class="row${g.row === 5 ? ' sel' : ''}"><span class="k">NÚMERO</span><span class="v">◀ ${g.num} ▶</span></div>`;
    h += `<div class="row${g.row === 6 ? ' sel' : ''}"><span class="k">NOME</span><span class="v"><input id="gnome" maxlength="14" value="${esc(g.nome)}"></span><span class="x">A: sortear · Enter: digitar</span></div>`;
    h += `<div class="row go${g.row === 7 ? ' sel' : ''}${st.ok ? '' : ' no'}">${st.ok ? (rep ? 'VOLTAR PARA A ARENA ▶' : 'IR PARA A LUTA ▶') : 'ACIMA DO LIMITE DE PESO'}</div>`;
    if (!rep) { const rv = RIVAIS.concat(RIVAIS2)[g.rival]; h += `<div class="row${g.row === 8 ? ' sel' : ''}"><span class="k">AMISTOSO</span><span class="v">◀ ${esc(rv.nome)} ▶</span><span class="x">${ARMAS[rv.b[3]].nome} · A: lutar</span></div>`; }
    { let n = 0; for (let i = 0; i < CONQ.length; i++) if (CAR.conq >> i & 1) n++; h += `<div class="row${g.row === 9 ? ' sel' : ''}"><span class="k">CONQUISTAS</span><span class="v">${n} / ${CONQ.length}</span><span class="x">A: ver</span></div>`;
      if (!rep) h += `<div class="row${g.row === 10 ? ' sel' : ''}"><span class="k">SOBREVIVER</span><span class="v">sem conserto</span><span class="x">recorde ${CAR.rec} · A: começar</span></div>`;
      if (g.verConq) h = `<div class="cq">` + CONQ.map((c, i) => `<div class="${CAR.conq >> i & 1 ? 'ok' : ''}"><b>${CAR.conq >> i & 1 ? '★' : '☆'} ${c[0]}</b><span>${c[1]}</span></div>`).join('') + `</div><div class="row sel go">A / B: VOLTAR</div>`; }
    e.rows.innerHTML = h;
    const inp = $('gnome'); inp.onfocus = () => { IN.typing = true; }; inp.onblur = () => { IN.typing = false; GAR.setNome(inp.value); };
    const part = g.row < 4 ? lists[g.row][b[g.row]] : null;
    e.gds.textContent = part ? part.desc + (g.mode === 1 ? (rep ? (b[g.row] === g.com[g.row] ? '  —  A: CONSERTAR esta peça' : '  —  A: TROCAR por esta peça (nova)') : '  —  A confirma · B desfaz') : '') : g.row === 7 && !st.ok ? `A montagem pesa ${st.kg} kg e o limite é ${PESO_MAX} kg. Troque peças para entrar na arena.` : '';
    const bars = [['PESO', st.bKg, st.kg + ' / ' + PESO_MAX + ' kg', base.bKg, 1], ['VELOCIDADE', st.bVel, st.vmax.toFixed(1) + ' m/s', base.bVel], ['ACELERAÇÃO', st.bAcc, st.acc.toFixed(1) + ' m/s²', base.bAcc], ['GIRO', st.bGiro, Math.round(st.giro * 3.7 * 57.3) + ' °/s', base.bGiro], ['RESISTÊNCIA', st.bHp, Math.round(st.hp), base.bHp], ['DANO', st.bDano, Math.round(st.dano), base.bDano]];
    e.gbars.innerHTML = bars.map((q, i) => { const d = Math.round((q[1] - q[3]) * 100); return `<div class="sbar${i === 0 && !st.ok ? ' over' : ''}" id="sb${i}"><div><span>${q[0]}${d ? `<span class="dl${(d < 0) !== (i === 0) ? ' n' : ''}">${d > 0 ? '+' : ''}${d}</span>` : ''}</span><b>${q[2]}</b></div><i><u data-v="${q[1].toFixed(3)}" style="transform:scaleX(${clamp(q[1], 0, 1).toFixed(3)})"></u>${q[4] ? `<s style="left:${(PESO_MAX / 140 * 100).toFixed(1)}%"></s>` : ''}</i></div>`; }).join('');
    e.gal.className = 'al ' + (st.ok ? 'ok' : 'bad'); e.gal.textContent = st.ok ? `DENTRO DO LIMITE · FOLGA DE ${PESO_MAX - st.kg} kg` : `PESO ACIMA DO LIMITE EM ${st.kg - PESO_MAX} kg — NÃO PODE ENTRAR NA ARENA`;
    e.ghl.innerHTML = '<b>DIRECIONAL / SETAS</b> escolhe encaixe e peça · <b>A / ENTER</b> confirma · <b>B / ESC</b> volta · <b>ANALÓGICO DIREITO / Q E</b> gira a bancada · <b>START</b> vai para a luta';
  },
  endTyping() { const i = $('gnome'); if (i) i.blur(); },
  // ----- chave -----
  bracket(T, txt, foot) {
    const e = this.el, col = (r, tit) => `<div class="col"><h2>${tit}</h2>${T.jogos[r].map(j => { const row = (i, o) => { if (i < 0) return `<div class="l">—</div>`; const en = T.ent[i], w = j.w === i, l = j.w >= 0 && !w; return `<div class="${w ? 'w' : l ? 'l' : ''}${i === 0 ? ' me' : ''}"><i class="dot" style="background:${this.css(en.cor)}"></i>${esc(en.nome)}<span>${j.w >= 0 ? (w ? (j.how === 'juizes' ? `JUÍZES ${j.pa >= j.pb ? Math.max(j.pa, j.pb) : Math.max(j.pa, j.pb)}–${Math.min(j.pa, j.pb)}` : j.how === 'fosso' ? 'FOSSO' : 'NOCAUTE') : '') : ''}</span></div>`; }; return `<div class="mt${j.next ? ' nx' : ''}">${row(j.a)}${row(j.b)}</div>`; }).join('')}</div>`;
    e.bk.innerHTML = col(0, RODADAS[0]) + col(1, RODADAS[1]) + col(2, RODADAS[2]);
    e.chs.textContent = `TEMPORADA ${T.temp || 1} · ARENA ${ARENAS[((T.temp || 1) - 1) % 4]} · ` + (T.campeao >= 0 ? 'TORNEIO ENCERRADO' : RODADAS[T.rodada]) + ` · CARREIRA: ${CAR.trofeus} TROFÉU(S), ${CAR.v} VITÓRIAS (${CAR.ko} POR NOCAUTE), ${CAR.d} DERROTAS, ${CAR.pecas} PEÇAS ARRANCADAS`; e.chb.textContent = txt || ''; e.chf.innerHTML = foot || '<b>A / ENTER</b> continuar';
  },
  intro(en, side, st, hist) {
    const e = this.el.ic; e.className = 'ic ' + (side ? 'r' : 'l'); e.style.setProperty('--cc', this.css(en.cor));
    e.innerHTML = `<div class="t">Nº ${en.num} · ${side ? 'CANTO AZUL' : 'CANTO VERMELHO'}</div><div class="n">${esc(en.nome)}</div><table><tr><td>PESO</td><td>${st.kg} kg</td></tr><tr><td>ARMA</td><td>${ARMAS[en.b[3]].nome}</td></tr><tr><td>MONTAGEM</td><td>${CHASSIS[en.b[0]].nome} · ${RODAS[en.b[1]].nome} · ${BLIND[en.b[2]].nome}</td></tr><tr><td>ESTILO</td><td>${en.estilo < 0 ? 'pilotado por você' : ESTILOS[en.estilo].nome}</td></tr><tr><td>NO TORNEIO</td><td>${hist}</td></tr></table>`;
  },
  judges(sim, a, b) {
    const e = this.el, sc = sim.scores; let h = '';
    for (let j = 0; j < 3; j++) h += `<div class="jc"><h3>JUIZ ${j + 1}</h3><table><tr><td></td><td>${esc(a.nome)}</td><td>${esc(b.nome)}</td></tr>${['DANO', 'AGRESSIVIDADE', 'CONTROLE'].map((n, c) => `<tr><td>${n}</td><td>${sc[j * 6 + c]}</td><td>${sc[j * 6 + 3 + c]}</td></tr>`).join('')}<tr class="t"><td>TOTAL</td><td>${sim.judgeTot[j * 2]}</td><td>${sim.judgeTot[j * 2 + 1]}</td></tr></table></div>`;
    e.jg.innerHTML = h; e.jv.innerHTML = `VITÓRIA DE <em>${esc(sim.winner ? b.nome : a.nome)}</em>`;
  },
  fatal(m) { const e = $('erro'); e.style.display = 'flex'; e.textContent = m; const c = $('carga'); if (c) c.remove(); },
};
