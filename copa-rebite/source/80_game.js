// ---------- jogo: garagem, torneio, luta, cameras, replay ----------
const SAVE_KEY = 'copaRebite.v1';
const RIVAIS = [
  { nome: 'Trator Zé', b: [2, 2, 0, 3], cor: 3, num: 12, estilo: 1 },
  { nome: 'Vespa 9', b: [0, 0, 0, 0], cor: 2, num: 9, estilo: 2 },
  { nome: 'Quebra-Noz', b: [1, 1, 1, 4], cor: 5, num: 44, estilo: 0 },
  { nome: 'Serrote', b: [1, 0, 2, 1], cor: 7, num: 21, estilo: 3 },
  { nome: 'Dona Morsa', b: [2, 1, 2, 5], cor: 6, num: 58, estilo: 1 },
  { nome: 'Pipoca', b: [0, 1, 2, 2], cor: 8, num: 3, estilo: 0 },
  { nome: 'Catapimba', b: [1, 2, 0, 3], cor: 1, num: 77, estilo: 2 },
];
const RIVAIS2 = [
  { nome: 'Cascavel', b: [0, 0, 2, 1], cor: 9, num: 13, estilo: 3 },
  { nome: 'Bate-Estaca', b: [2, 2, 0, 4], cor: 4, num: 66, estilo: 0 },
  { nome: 'Lesma Turbo', b: [1, 2, 1, 2], cor: 3, num: 5, estilo: 1 },
  { nome: 'Pé-de-Cabra', b: [0, 1, 1, 5], cor: 8, num: 31, estilo: 3 },
  { nome: 'Ventania', b: [1, 0, 0, 0], cor: 7, num: 88, estilo: 2 },
  { nome: 'Chumbo Grosso', b: [2, 1, 1, 2], cor: 5, num: 99, estilo: 0 },
  { nome: 'Saca-Rolha', b: [1, 1, 2, 1], cor: 6, num: 17, estilo: 2 },
];
const CAR = { temp: 1, trofeus: 0, v: 0, d: 0, ko: 0, juiz: 0, pecas: 0, conq: 0, armas: 0, chas: 0, seq: 0, rec: 0, sucata: 0, up0: 0, up1: 0, up2: 0, up3: 0, des: 0, dif: 1 };
const DIFS = ['FÁCIL', 'NORMAL', 'DIFÍCIL'], DIFM = [.78, 1, 1.28];
// desafios: rival (indice em RIVAIS+RIVAIS2), arena, restricao de montagem e condicao de vitoria
const DESAFIOS = [
  { nome: 'Relâmpago', desc: 'Vença Vespa 9 em menos de 60 s', r: 1, modo: 0, ok: () => true, cond: (S, G) => S.t < 60 },
  { nome: 'Por baixo', desc: 'Vença Quebra-Noz usando o chassi Cunha Rasteira', r: 2, modo: 0, ok: b => b[0] === 0, cond: () => true },
  { nome: 'Fornalha', desc: 'Vença Pipoca na arena Fornalha', r: 5, modo: 1, ok: () => true, cond: () => true },
  { nome: 'Peso-pena', desc: 'Vença Dona Morsa com montagem de até 80 kg', r: 4, modo: 0, ok: b => statsOf(b).kg <= 80, cond: () => true },
  { nome: 'Desmontador', desc: 'Arranque 3 peças do Serrote numa só luta', r: 3, modo: 0, ok: () => true, cond: (S, G) => G.detB >= 3 },
  { nome: 'Intocável', desc: 'Vença Catapimba sem perder nenhuma peça', r: 6, modo: 0, ok: () => true, cond: (S, G) => G.detached - G.detB === 0 },
  { nome: 'Serraria', desc: 'Vença Chumbo Grosso na arena Serraria', r: 12, modo: 2, ok: () => true, cond: () => true },
  { nome: 'Martelada', desc: 'Vença Bate-Estaca na arena Bate-Estaca usando o Martelo', r: 8, modo: 3, ok: b => b[3] === 4, cond: () => true },
];
const upCusto = l => 150 * (l + 1), upList = () => [CAR.up0, CAR.up1, CAR.up2, CAR.up3];
const ARENAS = ['CLÁSSICA', 'FORNALHA', 'SERRARIA', 'BATE-ESTACA'];
const CONQ = [['Primeira vitória', 'Vença uma luta de torneio'], ['Nocaute', 'Vença por nocaute'], ['Nas mãos dos juízes', 'Vença por decisão'], ['Buraco negro', 'Mande um adversário para o fosso'], ['Campeão', 'Vença uma temporada'], ['Bicampeão', 'Vença duas temporadas'],
  ['Ferro-velho', 'Arranque 10 peças na carreira'], ['Desmanche', 'Arranque 30 peças na carreira'], ['Intacto', 'Vença sem perder nenhuma peça'], ['Arsenal completo', 'Vença com as 6 armas'], ['Três carcaças', 'Vença com os 3 chassis'], ['Embalado', 'Vença 5 lutas seguidas']];
function conquistas(S, ganhou, perdidas) {
  const antes = CAR.conq; if (ganhou) { CAR.seq++; CAR.armas |= 1 << GAR.com[3]; CAR.chas |= 1 << GAR.com[0]; } else CAR.seq = 0;
  const c = [CAR.v >= 1, CAR.ko >= 1, CAR.juiz >= 1, ganhou && S.koBy === 'fosso', CAR.trofeus >= 1, CAR.trofeus >= 2, CAR.pecas >= 10, CAR.pecas >= 30, ganhou && perdidas === 0, CAR.armas === 63, CAR.chas === 7, CAR.seq >= 5];
  for (let i = 0; i < c.length; i++) if (c[i]) CAR.conq |= 1 << i;
  for (let i = 0; i < c.length; i++) if ((CAR.conq & ~antes) >> i & 1) UI.toast('CONQUISTA: ' + CONQ[i][0].toUpperCase());
}
const NOMES = ['Fagulha', 'Rebimboca', 'Chapa Quente', 'Zé Faísca', 'Mordaça', 'Tranco', 'Parafuseta', 'Curto-Circuito', 'Bigorna', 'Marreta Boa'];
const SIM = new Sim(), BG = new Sim(), TMPS = new Sim();
let TOR = null;

const GAR = {
  com: [1, 1, 1, 0], pre: [1, 1, 1, 0], row: 0, mode: 0, cor: 0, num: 7, nome: 'Fagulha', repair: false, rival: 0, verConq: 0, verUp: 0, upSel: 0, verDes: 0, desSel: 0, acoes: 2, ang: .6, an: new Float32Array(4), anV: new Float32Array(4), bot: new Bot(0), hp: null, idle: 0, warn: 0,
  slotHp(r) { const h = this.bot.hp, m = this.bot.hpMax; if (r === 0) return (h[0] / m[0] + h[11] / m[11]) / 2; if (r === 1) return (h[1] + h[2] + h[3] + h[4]) / (4 * m[1]); if (r === 2) return (h[5] + h[6] + h[7] + h[8] + h[9]) / (m[5] + m[6] + m[7] + m[8] + m[9]); return h[10] / m[10]; },
  fixSlot(r) { const h = this.hp, m = this.bot.hpMax; if (!h) return; if (r === 0) { h[0] = m[0]; h[11] = m[11]; } else if (r === 1) { for (let q = 1; q <= 4; q++) h[q] = m[q]; } else if (r === 2) { for (let q = 5; q <= 9; q++) h[q] = m[q]; } else h[10] = m[10]; },
  refresh(slotChanged) { // remonta o robo da bancada
    const B = this.bot, hp = this.hp, tmp = TMPS; tmp.bots[0] = B; tmp.setupBot(0, this.pre, null, { nome: this.nome, cor: CORES[this.cor], num: this.num });
    if (hp) { for (let q = 0; q < NPART; q++) if (hp[q] !== undefined && hp[q] >= 0) B.hp[q] = Math.min(hp[q], B.hpMax[q]); }
    if (slotChanged >= 0) { this.an[slotChanged] = slotChanged === 1 ? .32 : .42; this.anV[slotChanged] = 0; }
    Atlas.robot(0, this.nome, this.num, CORES[this.cor]); UI.garage(this);
  },
  setNome(v) { v = String(v).trim().slice(0, 14) || 'Sem Nome'; if (v !== this.nome) { this.nome = v; Atlas.robot(0, this.nome, this.num, CORES[this.cor]); G.save(); } },
  enter(repair) {
    this.repair = !!repair; this.acoes = 2; this.mode = 0; this.row = 0; this.pre = this.com.slice(); this.hp = repair && TOR ? TOR.ent[0].hp : null;
    G.st = 'garagem'; UI.show('gar'); AU.calar(); R.exposure = .5; R.fog = .0012; R.mblur = .4; R.amb = 1.0; R.keyDim = 1; FX.reset(); DRAW.hide(SLOT.ROBOT + SLOT.ROBOT_N);
    for (let i = SLOT.DEBRIS; i < SLOT.DEBRIS + SLOT.DEBRIS_N; i++) R.im[i] = -1; R.im[SLOT.AUX1] = -1; R.im[SLOT.AUX2] = -1; R.im[SLOT.AUX3] = -1; R.im[SLOT.GLASS] = -1;
    R.bake(1, MESH.garage.id, GAR_LIGHTS, [0, 1.5, 1.2]); this.refresh(-1); for (let k = 0; k < 4; k++) this.an[k] = .4 + k * .12;
  },
  tick(dt) {
    const g = this; let ch = false;
    if (IN.typing) { } else if (g.mode === 0) {
      if (g.verUp) { if (IN.pUp) { g.upSel = (g.upSel + 3) % 4; ch = true; } if (IN.pDown) { g.upSel = (g.upSel + 1) % 4; ch = true; } if (IN.pBack) { g.verUp = 0; ch = true; } else if (IN.pOk) { const k = 'up' + g.upSel, l = CAR[k]; if (l >= 3) UI.toast('NÍVEL MÁXIMO'); else if (CAR.sucata < upCusto(l)) UI.toast('SUCATA INSUFICIENTE'); else { CAR.sucata -= upCusto(l); CAR[k]++; G.save(); UI.toast('MELHORIA INSTALADA'); } ch = true; } IN.pOk = 0; IN.pUp = 0; IN.pDown = 0; IN.pStart = 0; }
      if (g.verDes) { if (IN.pUp) { g.desSel = (g.desSel + DESAFIOS.length - 1) % DESAFIOS.length; ch = true; } if (IN.pDown) { g.desSel = (g.desSel + 1) % DESAFIOS.length; ch = true; } if (IN.pBack) { g.verDes = 0; ch = true; } else if (IN.pOk) { g.desafio(g.desSel); if (G.st !== 'garagem') return; ch = true; } IN.pOk = 0; IN.pUp = 0; IN.pDown = 0; IN.pStart = 0; }
      if (g.verConq) { if (IN.pOk || IN.pBack) { g.verConq = 0; ch = true; } IN.pOk = 0; IN.pUp = 0; IN.pDown = 0; IN.pStart = 0; }
      if (IN.pUp) { g.row = (g.row + 13) % 14; ch = true; } if (IN.pDown) { g.row = (g.row + 1) % 14; ch = true; }
      if (g.row === 13 && (IN.pLeft || IN.pRight)) { if (TOR && TOR.ativo && TOR.lutas > 0) UI.toast('A DIFICULDADE SÓ MUDA ENTRE TORNEIOS'); else { CAR.dif = (CAR.dif + (IN.pRight ? 1 : 2)) % 3; if (TOR) TOR = null; G.save(); } ch = true; }
      if (g.row === 12 && IN.pOk && !g.repair) { g.verDes = 1; ch = true; }
      if (g.row === 11 && IN.pOk) { g.verUp = 1; ch = true; }
      if (g.row === 9 && IN.pOk) { g.verConq = 1; ch = true; }
      if (g.row === 10 && IN.pOk && !g.repair) { g.sobreviver(0, null); return; }
      if (g.row === 8 && (IN.pLeft || IN.pRight)) { g.rival = (g.rival + (IN.pRight ? 1 : 13)) % 14; ch = true; } else if (g.row === 8 && IN.pOk && !g.repair) g.amistoso();
      if (g.row < 4 && (IN.pOk || IN.pRight)) { if (g.repair && g.acoes <= 0) UI.toast('SEM TEMPO: AS DUAS AÇÕES JÁ FORAM USADAS'); else { g.mode = 1; ch = true; } }
      else if (g.row === 4 && (IN.pLeft || IN.pRight) && !g.repair) { g.cor = (g.cor + (IN.pRight ? 1 : CORES.length - 1)) % CORES.length; g.refresh(-1); G.save(); }
      else if (g.row === 5 && (IN.pLeft || IN.pRight) && !g.repair) { g.num = (g.num + (IN.pRight ? 1 : 99)) % 100; g.refresh(-1); G.save(); }
      else if (g.row === 6 && IN.pOk && !g.repair) { if (IN.pA) { g.nome = NOMES[(NOMES.indexOf(g.nome) + 1) % NOMES.length]; g.refresh(-1); G.save(); } else { const i = $('gnome'); i.focus(); i.select(); } }
      else if (g.row === 7 && IN.pOk) g.go();
      if (IN.pStart) g.go();
    } else {
      const n = [3, 3, 3, 6][g.row];
      if (IN.pLeft || IN.pUp) { g.pre[g.row] = (g.pre[g.row] + n - 1) % n; g.refresh(g.row); } if (IN.pRight || IN.pDown) { g.pre[g.row] = (g.pre[g.row] + 1) % n; g.refresh(g.row); }
      if (IN.pOk) { const same = g.pre[g.row] === g.com[g.row];
        if (g.repair) { if (same && g.slotHp(g.row) > .999) UI.toast('PEÇA SEM DANO'); else { g.com[g.row] = g.pre[g.row]; g.acoes--; g.refresh(-1); g.fixSlot(g.row); TOR.ent[0].b = g.com.slice(); g.refresh(g.row); UI.toast(same ? 'PEÇA CONSERTADA' : 'PEÇA TROCADA'); } }
        else g.com[g.row] = g.pre[g.row];
        g.mode = 0; ch = true; G.save(); }
      else if (IN.pBack) { if (g.pre[g.row] !== g.com[g.row]) { g.pre[g.row] = g.com[g.row]; g.refresh(g.row); } g.mode = 0; ch = true; }
    }
    if (ch) { UI.garage(g); _k[11] = 0; AU.blip(g.mode === 1 ? 660 : 520); }
    // bancada giratoria
    if (Math.abs(IN.rx) > .01) { g.ang += IN.rx * dt * 2.6; g.idle = 0; } else { g.idle += dt; if (g.idle > 2.5) g.ang += dt * .22; }
    // animacao de encaixe (mola amortecida)
    for (let k = 0; k < 4; k++) { if (g.an[k] === 0 && g.anV[k] === 0) continue; const was = g.an[k]; g.anV[k] += (-g.an[k] * 260 - g.anV[k] * 17) * dt; g.an[k] += g.anV[k] * dt; if (g.an[k] < 0) { g.an[k] = 0; if (g.anV[k] < -.5) { g.anV[k] *= -.25; (_f[0] = Math.sin(g.ang) * .1, _f[1] = BENCH_Y + .12 + k * .03, _f[2] = Math.cos(g.ang) * .1, _f[3] = 0, _f[4] = .6, _f[5] = 0, _f[6] = 26, _f[7] = 2.2, _f[8] = 1, FX.sparksR(0)); (_f[0] = 0, _f[1] = BENCH_Y + .3, _f[2] = 0, _f[3] = 3, _f[4] = 3, _f[5] = 2, _f[6] = .8, _f[7] = .18, FX.lightR()); } else g.anV[k] = 0; } if (Math.abs(g.an[k]) < .0005 && Math.abs(g.anV[k]) < .01) { g.an[k] = 0; g.anV[k] = 0; } }
  },
  amistoso() { const st = statsOf(this.pre); if (!st.ok) { UI.toast(`PESO ACIMA DO LIMITE (${st.kg} / ${PESO_MAX} kg)`); return; } this.com = this.pre.slice(); G.save(); const r = RIVAIS.concat(RIVAIS2)[this.rival]; G.round = 'AMISTOSO'; G.curMatch = null; G.script = null;
    G.setupFight(0, 1, 500 + this.rival * 13 + CAR.v, LUTA_T, { nome: this.nome, b: this.com.slice(), cor: CORES[this.cor], num: this.num, estilo: -1, hp: null, v: CAR.v, d: CAR.d }, { nome: r.nome, b: r.b.slice(), cor: CORES[r.cor], num: r.num, estilo: r.estilo, hp: null, v: 0, d: 0 }); G.st = 'intro'; G.intro = 0; G.ft[7] = 0; R.keyDim = .45; UI.show('intro'); G.showIntro(); },
  sobreviver(n, hp) { const st = statsOf(this.pre); if (!st.ok) { UI.toast(`PESO ACIMA DO LIMITE (${st.kg} / ${PESO_MAX} kg)`); return; } this.com = this.pre.slice(); const pool = RIVAIS.concat(RIVAIS2), r = pool[(n * 5 + 3) % 14]; G.surv = n; G.round = 'SOBREVIVÊNCIA · LUTA ' + (n + 1); G.curMatch = null; G.script = null;
    G.setupFight(0, 1, 900 + n * 17, LUTA_T, { nome: this.nome, b: this.com.slice(), cor: CORES[this.cor], num: this.num, estilo: -1, hp: hp, v: n, d: 0 }, { nome: r.nome, b: r.b.slice(), cor: CORES[r.cor], num: r.num, estilo: r.estilo, hp: null, v: 0, d: 0, buff: 1 + n * .1 }); G.st = 'intro'; G.intro = 0; G.ft[7] = 0; R.keyDim = .45; UI.show('intro'); G.showIntro(); },
  desafio(i) { const d = DESAFIOS[i], st = statsOf(this.pre); if (!st.ok) { UI.toast(`PESO ACIMA DO LIMITE (${st.kg} / ${PESO_MAX} kg)`); return; } if (!d.ok(this.pre)) { UI.toast('A MONTAGEM NÃO ATENDE À REGRA DO DESAFIO'); return; } this.com = this.pre.slice(); this.verDes = 0; const r = RIVAIS.concat(RIVAIS2)[d.r]; G.des = i; G.surv = -1; G.round = 'DESAFIO · ' + d.nome.toUpperCase(); G.curMatch = null; G.script = null;
    G.setupFight(0, 1, 700 + i * 31, LUTA_T, { nome: this.nome, b: this.com.slice(), cor: CORES[this.cor], num: this.num, estilo: -1, hp: null, v: CAR.v, d: CAR.d }, { nome: r.nome, b: r.b.slice(), cor: CORES[r.cor], num: r.num, estilo: r.estilo, hp: null, v: 0, d: 0, buff: 1.15 }); SIM.modo = d.modo; G.round = 'DESAFIO · ' + d.nome.toUpperCase() + (d.modo ? ' · ARENA ' + ARENAS[d.modo] : ''); UI.el.rd.textContent = G.round; G.st = 'intro'; G.intro = 0; G.ft[7] = 0; R.keyDim = .45; UI.show('intro'); G.showIntro(); },
  go() { const st = statsOf(this.pre); if (this.mode === 1) return; if (!st.ok) { UI.toast(`PESO ACIMA DO LIMITE (${st.kg} / ${PESO_MAX} kg)`); this.warn = 1; return false; } this.com = this.pre.slice(); G.save(); if (!TOR || !TOR.ativo) G.newTournament(); else TOR.ent[0].b = this.com.slice(); if (this.repair) G.startIntro(); else G.toBracket('PRÓXIMA LUTA'); return true; },
  draw() {
    const B = this.bot, L = B.L, a = this.ang, I = R.I;
    R.im[SLOT.AUX0] = MESH.bench.id; M4.ident(_m, 48); (_t[0] = 0, _t[1] = BENCH_Y, _t[2] = 0, _t[3] = a, M4.mulTRr(I, SLOT.AUX0 * INST_F, _m, 48, 1)); (_d[0] = 0, _d[1] = -1, _d[2] = 1, _d[3] = 1, _d[4] = 0, _d[5] = 0, _d[6] = 0, _d[7] = 0, _d[8] = 3, DRAW.putR(SLOT.AUX0, MESH.bench.id, B.cor)); DRAW.dents(SLOT.AUX0, null, 0);
    (_q[0] = 0, _q[1] = BENCH_Y + L.clear + B.ycm, _q[2] = 0, _q[3] = 0, _q[4] = Math.sin(a / 2), _q[5] = 0, _q[6] = Math.cos(a / 2), DRAW.botR(SLOT.ROBOT, B, 0, this.an));
    if (G.camFix) { const c = G.camFix; R.eye[0] = c[0]; R.eye[1] = c[1]; R.eye[2] = c[2]; R.tgt[0] = c[3]; R.tgt[1] = c[4]; R.tgt[2] = c[5]; R.cp[0] = c[6]; return; }
    R.eye[0] = 1.1; R.eye[1] = 1.5; R.eye[2] = 2.75; R.tgt[0] = -.75; R.tgt[1] = .78; R.tgt[2] = 0; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; R.cp[0] = .62;
  },
};

const G = {
  st: 'boot', ft: new Float64Array(12), pr: new Float32Array(8), cam: 0, ce: new Float32Array(3), ct: new Float32Array(3), first: 1, round: '', intro: 0, paused: 0, prev: '',
  auto: false, fast: 1, dbg: 0, livreMsg: 0, surv: -1, des: 0, skipRender: false, camFix: null, notes: null, entA: null, entB: null, curMatch: null, cnt: 0, clipFor: -2, rk: 0, rpx: .5, rpy: .5, rpz: .5, rqx: .5, rqy: .5, rqz: .5, script: null, sf: 0, rec: null, lastSk: new Float32Array(2 * 4 * 3).fill(-9), frameLog: null, nlog: 0, lastT: 0, acc: 0, hits: 0, detached: 0, maxPen: 0, rumbleLog: null,
  // replay
  REC_F: 28 + 5 + DEB_N * 8, ring: null, clip: null, clipN: 0, clipHit: 0, cev: new Float32Array(32 * 9), ncev: 0, rev: new Float32Array(64 * 9), nrev: 0, bestAt: -1, rp: null,
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ b: GAR.com, cor: GAR.cor, num: GAR.num, nome: GAR.nome, tor: TOR, car: CAR })); } catch (e) { } },
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!s) return; if (s.car) for (const k in CAR) if (typeof s.car[k] === 'number') CAR[k] = s.car[k]; if (Array.isArray(s.b) && s.b.length === 4) GAR.com = s.b.map((v, i) => Math.min(Math.max(v | 0, 0), [2, 2, 2, 5][i])); GAR.cor = Math.min(Math.max(s.cor | 0, 0), CORES.length - 1); GAR.num = Math.min(Math.max(s.num | 0, 0), 99); GAR.nome = String(s.nome || 'Fagulha').slice(0, 14); if (s.tor && s.tor.ent && s.tor.ent.length === 8) TOR = s.tor; } catch (e) { } },
  newTournament(seed) {
    const ent = [{ nome: GAR.nome, b: GAR.com.slice(), cor: CORES[GAR.cor], num: GAR.num, estilo: -1, hp: null, v: 0, d: 0 }];
    // elenco da temporada: 7 rivais sorteados de 14 pela temporada; a cada temporada ficam mais resistentes
    const pool = RIVAIS.concat(RIVAIS2), t = CAR.temp, pick = t === 1 ? RIVAIS : Array.from({ length: 7 }, (_, i) => pool[(i * 2 + (t - 1) * 3 + (i > 3 ? 1 : 0)) % 14]).filter((r, i, a) => a.indexOf(r) === i);
    for (let i = 0; pick.length < 7; i++) if (!pick.includes(pool[i])) pick.push(pool[i]);
    for (const r of pick) ent.push({ nome: r.nome, b: r.b.slice(), cor: CORES[r.cor], num: r.num, estilo: r.estilo, hp: null, v: 0, d: 0 });
    const mk = (a, b) => ({ a, b, w: -1, how: '', pa: 0, pb: 0 });
    TOR = { ativo: true, rodada: 0, ent, jogos: [[mk(0, 1), mk(2, 3), mk(4, 5), mk(6, 7)], [mk(-1, -1), mk(-1, -1)], [mk(-1, -1)]], campeao: -1, vivo: true, seed: seed || (20260 + CAR.temp * 37), lutas: 0, temp: CAR.temp, buff: (1 + Math.min(CAR.temp - 1, 8) * .09) * DIFM[CAR.dif] };
    this.save();
  },
  myMatch() { if (!TOR || !TOR.vivo) return null; for (const j of TOR.jogos[TOR.rodada]) if ((j.a === 0 || j.b === 0) && j.w < 0) return j; return null; },
  cfg(i) { const e = TOR.ent[i]; return { nome: e.nome, cor: e.cor, num: e.num, estilo: Math.max(0, e.estilo), buff: i === 0 ? 1 : (TOR.buff || 1) }; },
  // simula as lutas restantes da rodada (IA x IA) e avanca a chave
  finishRound() {
    const T = TOR, js = T.jogos[T.rodada];
    for (let k = 0; k < js.length; k++) { const j = js[k]; if (j.w >= 0 || j.a < 0 || j.b < 0) continue;
      BG.setupBot(0, T.ent[j.a].b, T.ent[j.a].hp, this.cfg(j.a)); BG.setupBot(1, T.ent[j.b].b, T.ent[j.b].hp, this.cfg(j.b)); BG.modo = ((T.temp || 1) - 1) % 4; BG.bots[0].isAI = true; BG.bots[1].isAI = true; BG.start(T.seed + T.rodada * 100 + k * 7 + 1);
      let guard = 0; while (!BG.over && guard++ < LUTA_T * 60 + 10) BG.step();
      this.record(j, BG); }
    if (js.every(j => j.w >= 0)) {
      for (const j of js) { const e = T.ent[j.w]; if (j.w !== 0 && e.hp) { // IA conserta as duas pecas mais gastas
          for (let n = 0; n < 2; n++) { let bi = -1, bv = .999; const ts = TMPS, tb = ts.bots[1]; ts.setupBot(1, e.b, null, this.cfg(j.w)); for (let q = 0; q < NPART; q++) { const f = e.hp[q] / tb.hpMax[q]; if (f < bv) { bv = f; bi = q; } } if (bi >= 0) e.hp[bi] = tb.hpMax[bi]; } } }
      if (T.rodada < 2) { const nx = T.jogos[T.rodada + 1]; for (let k = 0; k < nx.length; k++) { nx[k].a = js[k * 2].w; nx[k].b = js[k * 2 + 1].w; } T.rodada++; if (!T.vivo) this.finishRound(); }
      else { T.campeao = js[0].w; T.ativo = false; }
    }
    this.save();
  },
  record(j, S) { const T = TOR; j.w = S.winner === 0 ? j.a : j.b; j.how = S.koBy; j.pa = S.ptsA; j.pb = S.ptsB; const l = j.w === j.a ? j.b : j.a; T.ent[j.w].v++; T.ent[l].d++; T.ent[j.a].hp = Array.from(S.bots[0].hp); T.ent[j.b].hp = Array.from(S.bots[1].hp); if (l === 0) T.vivo = false; T.lutas++; if (j.a === 0 || j.b === 0) { if (j.w === 0) { CAR.v++; if (S.koBy === 'juizes') CAR.juiz++; else CAR.ko++; } else CAR.d++; CAR.pecas += this.detB || 0; conquistas(S, j.w === 0, (this.detached || 0) - (this.detB || 0)); CAR.sucata += Math.round(((j.w === 0 ? 100 : 30) + (this.detB || 0) * 25) * DIFM[CAR.dif]); } },
  toBracket(txt) {
    const T = TOR, j = this.myMatch(); for (const r of T.jogos) for (const q of r) q.next = q === j;
    this.st = 'chave'; UI.show('chave'); this.enterArena(); this.cam = 2;
    let foot = '<b>A / ENTER</b> continuar';
    if (T.campeao >= 0) { txt = T.campeao === 0 ? 'VOCÊ É O CAMPEÃO DA COPA REBITE!' : `CAMPEÃO: ${T.ent[T.campeao].nome}`; foot = T.campeao === 0 ? `<b>A / ENTER</b> avançar para a temporada ${CAR.temp + 1} (rivais mais fortes)` : '<b>A / ENTER</b> tentar de novo esta temporada'; }
    else if (!T.vivo) { txt = 'VOCÊ FOI ELIMINADO'; foot = '<b>A / ENTER</b> ver o resto do torneio'; }
    else if (j) { const o = j.a === 0 ? j.b : j.a; txt = `${txt || 'PRÓXIMA LUTA'}: ${T.ent[0].nome} × ${T.ent[o].nome}`; }
    UI.bracket(T, txt, foot);
  },
  enterArena() {
    if (R.scene !== 0) { R.im[SLOT.GLASS] = MESH.glass.id; R.im[SLOT.AUX0] = MESH.saw.id; R.im[SLOT.AUX1] = MESH.saw.id; R.im[SLOT.AUX2] = MESH.ahammer.id; R.bake(0, MESH.arena.id, ARENA_LIGHTS, [0, 1.2, 0]); }
    R.exposure = .3; R.fog = .0016; R.mblur = .3; R.amb = 1; R.cp[0] = .9;
  },
  // prepara a luta do jogador (ou uma luta avulsa para teste/roteiro)
  setupFight(ia, ib, seed, dur, ea, eb) {
    const A = ea || TOR.ent[ia], B = eb || TOR.ent[ib]; this.entA = A; this.entB = B;
    SIM.setupBot(0, A.b, A.hp, { nome: A.nome, cor: A.cor, num: A.num, estilo: Math.max(0, A.estilo), up: A.estilo < 0 ? upList() : null }); SIM.setupBot(1, B.b, B.hp, { nome: B.nome, cor: B.cor, num: B.num, estilo: Math.max(0, B.estilo), buff: eb ? (eb.buff || 1) : (TOR && TOR.buff || 1) });
    SIM.bots[0].isAI = this.auto; SIM.bots[1].isAI = true; SIM.start(seed, dur); SIM.modo = this.script || !ea ? (this.script ? 0 : ((TOR && TOR.temp || 1) - 1) % 4) : (this.surv >= 0 ? this.surv % 4 : (GAR.rival % 4)); if (!this.script && SIM.modo) this.round += ' · ARENA ' + ARENAS[SIM.modo];
    Atlas.robot(0, A.nome, A.num, A.cor); Atlas.robot(1, B.nome, B.num, B.cor); Atlas.score(A.nome.toUpperCase(), B.nome.toUpperCase(), this.round, 'AO VIVO', A.cor, B.cor);
    this.enterArena(); R.clearMarks(); FX.reset(); this.lastSk.fill(-9); this.hits = 0; this.hitsB = 0; this.detB = 0; this.detached = 0; this.maxPen = -9; this.bestAt = -1; this.clipN = 0; this.ncev = 0; this.nrev = 0; this.sf = 0;
    if (!this.ring) { this.ring = new Float32Array(300 * this.REC_F); this.clip = new Float32Array(240 * this.REC_F); this.rp = [0, 1].map(() => ({ hp: new Float32Array(NPART), wang: new Float32Array(4), wa: 0, burn: 0, glow: 0 })); }
    UI.hudInit(SIM.bots[0], SIM.bots[1], this.round); this.clipFor = -2; this.notes = SIM.bots.map(B => ['O CHASSI', 'UMA RODA', 'UMA RODA', 'UMA RODA', 'UMA RODA', 'A BLINDAGEM DA FRENTE', 'A BLINDAGEM DE TRÁS', 'A BLINDAGEM ESQUERDA', 'A BLINDAGEM DIREITA', 'A BLINDAGEM DO TETO', 'A ARMA', 'A BATERIA'].map(p => B.nome + ' PERDEU ' + p));
    for (let i = 0; i < SLOT.DEBRIS_N; i++) R.im[SLOT.DEBRIS + i] = -1;
    this.cam = 0; this.first = 1; this.drawFight(0); R.reset = 1;
  },
  startIntro() {
    const j = this.myMatch(); if (!j) { this.toBracket(''); return; } const o = j.a === 0 ? j.b : j.a; this.round = RODADAS[TOR.rodada];
    this.setupFight(0, o, TOR.seed + TOR.rodada * 100 + 50, LUTA_T); this.curMatch = j;
    this.st = 'intro'; this.intro = 0; this.ft[7] = 0; R.keyDim = .45; UI.show('intro'); this.showIntro();
  },
  showIntro() { const e = this.intro ? this.entB : this.entA, h = e.v + e.d === 0 ? 'ESTREIA' : `${e.v} VITÓRIA${e.v === 1 ? '' : 'S'}`; UI.intro(e, this.intro, SIM.bots[this.intro].S, h); },
  startFight() { this.st = 'luta'; UI.show('hud'); UI.msg('', ''); R.keyDim = 1; },
  // ---------- quadro ----------
  tick(dt) {
    IN.poll(dt); UI.tick(dt); this.ft[0] += dt; const st = this.st;
    if (st === 'garagem') { GAR.tick(dt); GAR.draw(); FX.update(dt); }
    else if (st === 'chave') { if (IN.pOk || IN.pStart) { if (TOR.campeao >= 0) { if (TOR.campeao === 0) { CAR.trofeus++; CAR.temp++; if (CAR.trofeus >= 1) CAR.conq |= 16; if (CAR.trofeus >= 2) CAR.conq |= 32; } TOR = null; this.save(); GAR.com = GAR.com.slice(); GAR.enter(false); } else if (!TOR.vivo) { this.finishRound(); this.toBracket(''); } else if (TOR.lutas === 0) this.startIntro(); else GAR.enter(true); }
      else { this.ft[8] += dt; const a = this.ft[8] * .12; R.eye[0] = Math.cos(a) * 11.5; R.eye[1] = 6.6; R.eye[2] = Math.sin(a) * 11.5; R.tgt[0] = 0; R.tgt[1] = .4; R.tgt[2] = 0; R.cp[0] = .8; FX.update(dt); { const P = this.pr, S = SIM; P[0] = S.sawH[0]; P[1] = S.sawH[1]; P[2] = S.sawA; P[3] = S.ahA; P[4] = S.pitY; } this.drawProps(); } }
    else if (st === 'intro') { this.ft[7] += dt; const B = SIM.bots[this.intro], s = B.s, a = this.ft[7] * .9 + (this.intro ? PI : 0) + .6, r = 2.3;
      R.eye[0] = Math.min(Math.max(s[0] + Math.cos(a) * r, -AR + .5), AR - .5); R.eye[1] = .75 + Math.sin(this.ft[7] * .7) * .12; R.eye[2] = s[2] + Math.sin(a) * r; R.tgt[0] = s[0]; R.tgt[1] = .2; R.tgt[2] = s[2]; R.cp[0] = .7;
      this.drawFight(0); FX.update(dt);
      if (this.ft[7] > 3.6 || IN.pOk || IN.pStart) { if (this.intro === 0) { this.intro = 1; this.ft[7] = 0; this.showIntro(); } else { this.st = 'contagem'; this.ft[7] = 0; UI.show('hud'); this.cam = 0; this.first = 1; this.cnt = -1; } } }
    else if (st === 'contagem') { this.ft[7] += dt; const n = Math.floor(this.ft[7] / .8); if (n !== this.cnt) { this.cnt = n; if (n < 3) { UI.msg(String(3 - n), 'PREPARAR'); const c = n === 0 ? [9, .6, .3] : n === 1 ? [9, 6, .5] : [9, 8, 2]; (_f[0] = 0, _f[1] = 3.2, _f[2] = 0, _f[3] = 16, _f[4] = c[0] * 6, _f[5] = c[1] * 6, _f[6] = c[2] * 6, _f[7] = .7, FX.lightR()); R.keyDim = .45 + n * .15; } else { UI.msg('LUTA!', ''); (_f[0] = 0, _f[1] = 3.2, _f[2] = 0, _f[3] = 18, _f[4] = 10, _f[5] = 60, _f[6] = 14, _f[7] = .9, FX.lightR()); R.keyDim = 1; } }
      this.camera(dt); this.drawFight(0); FX.update(dt); if (this.ft[7] > 3.1) this.startFight(); }
    else if (st === 'luta' || st === 'fim') {
      if (IN.pPause && st === 'luta' && !this.script) { this.prev = st; this.st = 'pausa'; UI.show('hud', 'pausa'); return; }
      if (this.ft[2] > 0) { this.ft[2] -= dt; if (this.ft[2] <= 0 && st === 'luta') UI.msg('', ''); }
      const n = this.fast; for (let k = 0; k < n; k++) this.fightStep();
      if (!this.skipRender || this.st !== 'luta') { const dbg = this.dbg; if (!(dbg & 1)) this.camera(dt); if (!(dbg & 2)) this.drawFight(1); if (!(dbg & 4)) FX.update(dt); if (!(dbg & 8)) UI.hud(SIM, this.cam); AU.update(SIM, this.st === 'luta' ? 1 : 0); }
      if (this.st === 'fim') { this.ft[1] += dt * (this.fast > 1 ? 30 : 1); if (this.ft[1] > 3) this.afterFight(); } }
    else if (st === 'juizes') { this.ft[1] += dt * (this.fast > 1 ? 30 : 1); this.camera(dt); this.drawFight(1); FX.update(dt); if (this.ft[1] > 6 || IN.pOk) this.toReplay(); }
    else if (st === 'replay') { this.replayTick(dt); }
    else if (st === 'livre') { this.camera(dt); this.drawFight(1); FX.update(dt); if (this.round.startsWith('DESAFIO')) { if (!this.livreMsg) { this.livreMsg = 1; const d = DESAFIOS[this.des], ok = SIM.winner === 0 && d.cond(SIM, this); if (ok && !(CAR.des >> this.des & 1)) { CAR.des |= 1 << this.des; CAR.sucata += 120; } this.save(); UI.msg(ok ? 'DESAFIO CUMPRIDO' : 'DESAFIO FALHOU', (ok ? '+120 de sucata · ' : d.desc + ' · ') + 'A / ENTER garagem'); } if (IN.pOk || IN.pStart) { this.livreMsg = 0; GAR.enter(false); } }
      else if (this.surv >= 0 && this.round.startsWith('SOBREV')) { if (!this.livreMsg) { this.livreMsg = 1; const w = SIM.winner === 0; CAR.sucata += (w ? 60 : 15) + (this.detB || 0) * 15; if (w) UI.msg('VENCEU A LUTA ' + (this.surv + 1), 'A / ENTER próxima luta — sem conserto'); else { const n = this.surv; if (n > CAR.rec) CAR.rec = n; this.save(); UI.msg('FIM DA SOBREVIVÊNCIA', n + ' vitória(s) seguida(s) · recorde ' + CAR.rec + ' · A / ENTER garagem'); } } if (IN.pOk || IN.pStart) { this.livreMsg = 0; if (SIM.winner === 0) GAR.sobreviver(this.surv + 1, Array.from(SIM.bots[0].hp)); else { this.surv = -1; GAR.enter(false); } } }
      else if (this.round.startsWith('AMISTOSO')) { if (!this.livreMsg) { this.livreMsg = 1; CAR.sucata += (SIM.winner === 0 ? 40 : 10) + (this.detB || 0) * 10; this.save(); UI.msg(SIM.winner === 0 ? 'VITÓRIA' : 'DERROTA', 'A / ENTER volta para a garagem'); } if (IN.pOk || IN.pStart) { this.livreMsg = 0; GAR.enter(false); } } }
    else if (st === 'pausa') { if (IN.pPause || IN.pOk) { this.st = this.prev; UI.show('hud'); } }
  },
  fightStep() {
    const S = SIM, A = S.bots[0];
    if (this.script) { const f = this.sf, d = this.script; if (f * 3 + 2 < d.length) { A.thr = d[f * 3] / 100; A.steer = d[f * 3 + 1] / 100; const b = d[f * 3 + 2]; A.fire = b & 1; A.flipB = (b >> 1) & 1; A.resetB = (b >> 2) & 1; if (b & 8) this.cam = (this.cam + 1) % 3; } else { A.thr = 0; A.steer = 0; A.fire = 0; } }
    else if (!A.isAI) { A.thr = IN.thr; A.steer = IN.steer; A.fire = IN.fire; A.flipB = IN.flip; A.resetB = IN.rst; if (IN.pCam) this.cam = (this.cam + 1) % 3; }
    if (this.rec && A.isAI) { // gravacao: o piloto automatico decide, os comandos sao quantizados e so entao aplicados (o replay fica identico)
      if (!S.over) S.think(A, S.bots[1]); A.thr = Math.round(A.thr * 100) / 100; A.steer = Math.round(A.steer * 100) / 100; A.isAI = false; S.step(); A.isAI = true; } else S.step();
    this.sf++;
    if (this.rec && S.frame <= this.rec.length / 3) { const o = (S.frame - 1) * 3; this.rec[o] = Math.round(A.thr * 100); this.rec[o + 1] = Math.round(A.steer * 100); this.rec[o + 2] = (A.fire ? 1 : 0) | (A.flipB ? 2 : 0) | (A.resetB ? 4 : 0); }
    this.events(); this.recFrame();
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s, h = B.hpt, Rm = B.R; let p = -9; for (let q = 0; q < B.nhull; q++) { const lx = h[q * 3], ly = h[q * 3 + 1], lz = h[q * 3 + 2], x = s[0] + Rm[0] * lx + Rm[1] * ly + Rm[2] * lz, z = s[2] + Rm[6] * lx + Rm[7] * ly + Rm[8] * lz, e = Math.max(Math.abs(x), Math.abs(z)) - AR; if (e > p) p = e; } if (p > this.maxPen) this.maxPen = p; if (S.bots[i].teleport) { S.bots[i].teleport = 0; this.first = 1; } }
    if (S.over && this.st === 'luta') { this.st = 'fim'; this.ft[1] = 0; const w = S.bots[S.winner].nome; if (S.koBy === 'juizes') UI.msg('FIM DO TEMPO', 'A DECISÃO VAI PARA OS JUÍZES'); else UI.msg(S.koBy === 'fosso' ? 'NO FOSSO!' : 'NOCAUTE!', 'VITÓRIA DE ' + w); if (this.curMatch) Atlas.score(this.entA.nome.toUpperCase(), this.entB.nome.toUpperCase(), this.round, 'VITÓRIA: ' + w.toUpperCase(), this.entA.cor, this.entB.cor); }
  },
  events() {
    const S = SIM, e = S.ev;
    for (let k = 0; k < S.nev; k++) { const o = k * 8, ty = e[o], x = e[o + 1], y = e[o + 2], z = e[o + 3], dx = e[o + 4], dy = e[o + 5], dz = e[o + 6], mag = e[o + 7];
      if (ty === EV.HIT) { const dmg = mag % 1000; this.hits++; if (mag >= 1000) this.hitsB++; (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = dx, _f[4] = dy, _f[5] = dz, _f[6] = 7 + dmg * 1.5, _f[7] = 3 + dmg * .14, _f[8] = .75, FX.sparksR(0)); (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = dx, _f[4] = dy + .5, _f[5] = dz, _f[6] = 0, _f[7] = 3.5, _f[8] = .9, FX.sparksR(1)); (_f[0] = x, _f[1] = y + .7, _f[2] = z, _f[3] = 2.6 + dmg * .05, _f[4] = 2.4 + dmg * .16, _f[5] = 1.3 + dmg * .08, _f[6] = .3, _f[7] = .4, FX.lightR()); (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 2, _f[4] = .22, _f[5] = .7, FX.smokeR(0)); (_f[0] = x - dz * .2, _f[1] = z + dx * .2, _f[2] = x + dz * .2, _f[3] = z - dx * .2, _f[4] = .012, _f[5] = 1, _f[6] = .6, FX.markR());
        FX.sh[0] = Math.min(1, FX.sh[0] + dmg * .03); const st = Math.min(Math.max(.12 + dmg / 60, 0), 1); (_k[8] = st, _k[9] = st * .7, _k[10] = 120 + dmg * 7, IN.rumbleR()); if (this.rumbleLog && this.rumbleLog.length < 400) this.rumbleLog.push(dmg, st);
        if (dmg > S.best) { S.best = dmg; this.bestAt = S.frame; } _k[11] = dmg; this.pushEv(1, o); AU.hitR(); }
      else if (ty === EV.DETACH) { this.detached++; if (mag >= 100) this.detB++; (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = dx, _f[4] = 1, _f[5] = dz, _f[6] = 70, _f[7] = 5, _f[8] = .9, FX.sparksR(0)); (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = dx, _f[4] = 1, _f[5] = dz, _f[6] = 14, _f[7] = 4, _f[8] = 1, FX.sparksR(1)); (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 4, _f[4] = .3, _f[5] = .9, FX.smokeR(1)); (_f[0] = x, _f[1] = y + .3, _f[2] = z, _f[3] = 5, _f[4] = 40, _f[5] = 22, _f[6] = 6, _f[7] = .3, FX.lightR()); (_k[8] = .9, _k[9] = .6, _k[10] = 260, IN.rumbleR()); FX.sh[0] = Math.min(1, FX.sh[0] + .5); _k[11] = 30; this.pushEv(2, o); AU.hitR(); this.note(this.notes[mag >= 100 ? 1 : 0][mag % 100 | 0]); }
      else if (ty === EV.GRIND) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = dx * .3, _f[4] = .8, _f[5] = dz * .3, _f[6] = 5, _f[7] = 3, _f[8] = .9, FX.sparksR(0)); }
      else if (ty === EV.SAW) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 1, _f[4] = .9, _f[5] = 0, _f[6] = 46, _f[7] = 6, _f[8] = .5, FX.sparksR(0)); (_f[0] = x, _f[1] = .4, _f[2] = z, _f[3] = 4, _f[4] = 30, _f[5] = 18, _f[6] = 5, _f[7] = .2, FX.lightR()); (_k[8] = .6, _k[9] = .5, _k[10] = 160, IN.rumbleR()); FX.sh[0] = Math.min(1, FX.sh[0] + .3); _k[11] = 12; this.pushEv(1, o); AU.hitR(); }
      else if (ty === EV.AHAM) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 0, _f[4] = 1, _f[5] = 0, _f[6] = 40, _f[7] = 4.5, _f[8] = 1, FX.sparksR(0)); (_f[0] = x, _f[1] = .1, _f[2] = z, _f[3] = 3, _f[4] = .4, _f[5] = .5, FX.smokeR(0)); (_f[0] = x, _f[1] = .5, _f[2] = z, _f[3] = 5, _f[4] = 30, _f[5] = 20, _f[6] = 8, _f[7] = .25, FX.lightR()); FX.sh[0] = Math.min(1, FX.sh[0] + .45); (_f[0] = x - .15, _f[1] = z - .15, _f[2] = x + .15, _f[3] = z + .15, _f[4] = .16, _f[5] = 1, _f[6] = .8, FX.markR()); }
      else if (ty === EV.LAND) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 0, _f[4] = 1, _f[5] = 0, _f[6] = 6 + mag * 2, _f[7] = 2.5, _f[8] = 1, FX.sparksR(0)); (_k[8] = Math.min(Math.max(mag / 10, .15), .7), _k[9] = .3, _k[10] = 110, IN.rumbleR()); }
      else if (ty === EV.HAMMER) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 0, _f[4] = 1, _f[5] = 0, _f[6] = 16, _f[7] = 3.5, _f[8] = 1, FX.sparksR(0)); (_f[0] = x, _f[1] = .3, _f[2] = z, _f[3] = 3, _f[4] = 14, _f[5] = 9, _f[6] = 3, _f[7] = .15, FX.lightR()); (_f[0] = x - .04, _f[1] = z, _f[2] = x + .04, _f[3] = z, _f[4] = .05, _f[5] = 1, _f[6] = .9, FX.markR()); }
      else if (ty === EV.FLIP) { (_f[0] = x, _f[1] = y + .05, _f[2] = z, _f[3] = 3, _f[4] = .25, _f[5] = .4, FX.smokeR(0)); }
      else if (ty === EV.GRAB) { (_f[0] = x, _f[1] = y, _f[2] = z, _f[3] = 0, _f[4] = 1, _f[5] = 0, _f[6] = 20, _f[7] = 3, _f[8] = 1, FX.sparksR(0)); (_k[8] = .5, _k[9] = .4, _k[10] = 140, IN.rumbleR()); }
      else if (ty === EV.SCRAPE) { const l = this.lastSk, o2 = 0; (_f[0] = x - dx * .016, _f[1] = z - dz * .016, _f[2] = x, _f[3] = z, _f[4] = .008, _f[5] = 1, _f[6] = .55, FX.markR()); if ((FX.rng.uR(), _u[0]) < .5) (_f[0] = x, _f[1] = .02, _f[2] = z, _f[3] = -dx * .12, _f[4] = .5, _f[5] = -dz * .12, _f[6] = 2, _f[7] = 2.2, _f[8] = .7, FX.sparksR(0)); }
      else if (ty === EV.SKID) { const id = mag >= 1000 ? 1 : 0, q = Math.floor((mag % 1000) / 10), w = mag % 10, l = this.lastSk, o2 = (id * 4 + q) * 3; if (l[o2 + 2] === S.frame - 1 && Math.sqrt((l[o2] - x) * (l[o2] - x) + (l[o2 + 1] - z) * (l[o2 + 1] - z)) < .5) (_f[0] = l[o2], _f[1] = l[o2 + 1], _f[2] = x, _f[3] = z, _f[4] = w * .5, _f[5] = 0, _f[6] = .34, FX.markR()); l[o2] = x; l[o2 + 1] = z; l[o2 + 2] = S.frame; }
      else if (ty === EV.KO) { FX.sh[0] = .6; }
    }
    // fogo das armadilhas e das baterias
    if (S.flameOn) { for (let i = 0; i < 3; i++) { const n = FLAME.n[i]; (_f[0] = n[0], _f[1] = .06, _f[2] = n[1], _f[3] = 7, _f[4] = .15, _f[5] = 6.5, FX.fireR()); if ((S.frame + i) % 6 === 0) (_f[0] = n[0] - .3, _f[1] = n[1], _f[2] = n[0] + .3, _f[3] = n[1], _f[4] = .35, _f[5] = 2, _f[6] = .1, FX.markR()); } (_f[0] = FLAME.x, _f[1] = .9, _f[2] = FLAME.z, _f[3] = 7, _f[4] = 60 + 20 * Math.sin(S.t * 31), _f[5] = 26, _f[6] = 5, FX.flightR()); if (S.frame % 9 === 0) (_f[0] = FLAME.x + (FX.rng.uR(), _u[0] * 2 - 1) * .6, _f[1] = 1.6, _f[2] = FLAME.z, _f[3] = 1, _f[4] = .5, _f[5] = 1.2, FX.smokeR(1)); }
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s; if (B.fireOn) { const c = CHASSIS[B.b[0]]; (_c[45] = (c.win[0] + c.win[1]) / 2, _c[46] = B.L.hy1 - B.ycm, _c[47] = 0, S.wptR(B)); (_f[0] = _c[0], _f[1] = _c[1], _f[2] = _c[2], _f[3] = 3, _f[4] = .1, _f[5] = 2.6, FX.fireR()); if (S.frame % 2 === 0) (_f[0] = _c[0], _f[1] = _c[1] + .25, _f[2] = _c[2], _f[3] = 1, _f[4] = .3, _f[5] = 1.3, FX.smokeR(1)); (_f[0] = _c[0], _f[1] = _c[1] + .3, _f[2] = _c[2], _f[3] = 4, _f[4] = 46 + 14 * Math.sin(S.t * 27 + i), _f[5] = 19, _f[6] = 4, FX.flightR()); B.burn = Math.min(1, B.burn + DT * .08); }
      else if (B.hp[P_BAT] < B.hpMax[P_BAT] * .6 && S.frame % 7 === 0) { const c = CHASSIS[B.b[0]]; (_c[45] = (c.win[0] + c.win[1]) / 2, _c[46] = B.L.hy1 - B.ycm, _c[47] = 0, S.wptR(B)); (_f[0] = _c[0], _f[1] = _c[1] + .05, _f[2] = _c[2], _f[3] = 1, _f[4] = .2, _f[5] = .8, FX.smokeR(0)); }
      const k = ARMAS[B.b[3]]; if (k.spin && B.wspin > k.wmax * .5 && B.hp[P_WP] > 0 && S.frame % 4 === 0) { /* brilho sutil do disco: nada */ } }
  },
  note(t) { UI.msg('', t); this.ft[2] = 2.2; },
  pushEv(ty, k) { const q = SIM.ev, x = q[k + 1], y = q[k + 2], z = q[k + 3], dx = q[k + 4], dy = q[k + 5], dz = q[k + 6], mag = _k[11]; if (this.nrev >= 64) { this.rev.copyWithin(0, 9, 64 * 9); this.nrev = 63; } const o = this.nrev++ * 9, e = this.rev; e[o] = SIM.frame; e[o + 1] = ty; e[o + 2] = x; e[o + 3] = y; e[o + 4] = z; e[o + 5] = dx; e[o + 6] = dy; e[o + 7] = dz; e[o + 8] = mag; },
  recFrame() { // grava o estado visual num anel; ao redor do melhor golpe, copia para o clipe
    const S = SIM, F = this.REC_F, o = (S.frame % 300) * F, r = this.ring;
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s, q = o + i * 14; for (let k = 0; k < 7; k++) r[q + k] = s[k]; r[q + 7] = B.wa; for (let k = 0; k < 4; k++) r[q + 8 + k] = B.wang[k]; let m = 0; for (let k = 0; k < NPART; k++) if (B.hp[k] > 0) m |= 1 << k; r[q + 12] = m; r[q + 13] = B.burn; }
    r[o + 28] = S.sawH[0]; r[o + 29] = S.sawH[1]; r[o + 30] = S.sawA; r[o + 31] = S.ahA; r[o + 32] = S.pitY;
    for (let i = 0; i < DEB_N; i++) { const q = o + 33 + i * 8, d = S.deb, p = i * DEB_F; r[q] = S.debMesh[i]; for (let k = 0; k < 7; k++) r[q + 1 + k] = d[p + k]; }
    if (this.bestAt >= 0 && (S.frame === this.bestAt + 110 || (S.over && S.frame > this.bestAt && this.clipFor !== this.bestAt && S.frame <= this.bestAt + 110))) this.cutClip();
  },
  cutClip() { const S = SIM, F = this.REC_F, a = Math.max(0, this.bestAt - 100, S.frame - 299), b = S.frame, n = Math.min(240, b - a + 1); for (let k = 0; k < n; k++) { const src = ((a + k) % 300) * F; this.clip.set(this.ring.subarray(src, src + F), k * F); } this.clipN = n; this.clipHit = this.bestAt - a; this.clipFor = this.bestAt; this.ncev = 0; for (let k = 0; k < this.nrev && this.ncev < 32; k++) { const f = this.rev[k * 9]; if (f >= a && f <= b) { const o = this.ncev++ * 9; for (let q = 0; q < 9; q++) this.cev[o + q] = this.rev[k * 9 + q]; this.cev[o] = f - a; } } },
  afterFight() {
    const S = SIM; if (this.bestAt >= 0 && this.clipFor !== this.bestAt) this.cutClip();
    if (S.koBy === 'juizes') { this.st = 'juizes'; this.ft[1] = 0; UI.judges(S, S.bots[0], S.bots[1]); UI.show('hud', 'juizes'); UI.msg('', ''); } else this.toReplay();
  },
  toReplay() { if (this.clipN > 20 && this.fast === 1) { this.st = 'replay'; this.ft[9] = Math.max(0, this.clipHit - 70); this.rk = 0; UI.show('hud'); UI.msg('', ''); UI.el.rep.style.display = 'block'; FX.reset(); this.first = 1; } else this.endFight(); },
  endFight() {
    UI.el.rep.style.display = 'none'; const S = SIM;
    if (this.curMatch) { const j = this.curMatch; this.curMatch = null; if (j.a !== 0) { /* jogador sempre e o lado a */ } this.record(j, S); this.finishRound(); this.toBracket(S.winner === 0 ? 'VITÓRIA!' : ''); }
    else { this.st = 'livre'; UI.show('hud'); }
  },
  replayTick(dt) {
    const F = this.REC_F, c = this.clip; this.ft[9] += dt * 60 * .25; if (this.ft[9] >= this.clipN - 1 || IN.pOk || IN.pStart) { this.endFight(); return; }
    const f0 = Math.floor(this.ft[9]), fr = this.ft[9] - f0, o0 = f0 * F, o1 = Math.min(f0 + 1, this.clipN - 1) * F, S = SIM;
    for (let i = 0; i < 2; i++) { const B = S.bots[i], P = this.rp[i], q0 = o0 + i * 14, q1 = o1 + i * 14; P.b = B.b; P.L = B.L; P.mid = B.mid; P.wav = (P.wav || 0) + .09; P.cor = B.cor; P.dent = B.dent; P.hpMax = B.hpMax; P.ycm = B.ycm;
      const px = ((c[q0]) + ((c[q1]) - (c[q0])) * (fr)), py = ((c[q0 + 1]) + ((c[q1 + 1]) - (c[q0 + 1])) * (fr)), pz = ((c[q0 + 2]) + ((c[q1 + 2]) - (c[q0 + 2])) * (fr)); let d = c[q0 + 3] * c[q1 + 3] + c[q0 + 4] * c[q1 + 4] + c[q0 + 5] * c[q1 + 5] + c[q0 + 6] * c[q1 + 6]; const sg = d < 0 ? -1 : 1;
      let qx = ((c[q0 + 3]) + ((c[q1 + 3] * sg) - (c[q0 + 3])) * (fr)), qy = ((c[q0 + 4]) + ((c[q1 + 4] * sg) - (c[q0 + 4])) * (fr)), qz = ((c[q0 + 5]) + ((c[q1 + 5] * sg) - (c[q0 + 5])) * (fr)), qw = ((c[q0 + 6]) + ((c[q1 + 6] * sg) - (c[q0 + 6])) * (fr)); const l = 1 / Math.sqrt((qx) * (qx) + (qy) * (qy) + (qz) * (qz) + (qw) * (qw)); qx *= l; qy *= l; qz *= l; qw *= l;
      P.wa = ((c[q0 + 7]) + ((c[q1 + 7]) - (c[q0 + 7])) * (fr)); for (let k = 0; k < 4; k++) P.wang[k] = ((c[q0 + 8 + k]) + ((c[q1 + 8 + k]) - (c[q0 + 8 + k])) * (fr)); const m = c[q0 + 12]; for (let k = 0; k < NPART; k++) P.hp[k] = (m >> k) & 1 ? B.hpMax[k] : 0; P.burn = c[q0 + 13]; P.glow = 0;
      (_q[0] = px, _q[1] = py, _q[2] = pz, _q[3] = qx, _q[4] = qy, _q[5] = qz, _q[6] = qw, DRAW.botR(SLOT.ROBOT + i * SLOT.ROBOT_N, P, i, null)); if (i === 0) { this.rpx = px; this.rpy = py; this.rpz = pz; } else { this.rqx = px; this.rqy = py; this.rqz = pz; } }
    { const P = this.pr; P[0] = c[o0 + 28]; P[1] = c[o0 + 29]; P[2] = c[o0 + 30]; P[3] = c[o0 + 31]; P[4] = c[o0 + 32]; this.drawProps(); }
    for (let i = 0; i < DEB_N; i++) { const q = o0 + 33 + i * 8, sl = SLOT.DEBRIS + i, m = c[q]; if (m < 0) { R.im[sl] = -1; continue; } (_q[0] = c[q + 4], _q[1] = c[q + 5], _q[2] = c[q + 6], _q[3] = c[q + 7], _q[4] = c[q + 1], _q[5] = c[q + 2], _q[6] = c[q + 3], M4.fromQTr(R.I, sl * INST_F)); R.im[sl] = m; }
    while (this.rk < this.ncev && this.cev[this.rk * 9] <= this.ft[9]) { const o = this.rk++ * 9, e = this.cev, dmg = e[o + 8]; (_f[0] = e[o + 2], _f[1] = e[o + 3], _f[2] = e[o + 4], _f[3] = e[o + 5], _f[4] = e[o + 6], _f[5] = e[o + 7], _f[6] = 30 + dmg * 6, _f[7] = 4 + dmg * .22, _f[8] = .75, FX.sparksR(0)); (_f[0] = e[o + 2], _f[1] = e[o + 3], _f[2] = e[o + 4], _f[3] = e[o + 5], _f[4] = e[o + 6] + .5, _f[5] = e[o + 7], _f[6] = 6, _f[7] = 3.5, _f[8] = .9, FX.sparksR(1)); (_f[0] = e[o + 2], _f[1] = e[o + 3] + .25, _f[2] = e[o + 4], _f[3] = 5, _f[4] = 26 + dmg * 2.2, _f[5] = 15 + dmg * 1.1, _f[6] = 4, _f[7] = .5, FX.lightR()); }
    // camera do replay: orbita lenta em volta do golpe
    const mx = (this.rpx + this.rqx) / 2, mz = (this.rpz + this.rqz) / 2, a = this.ft[9] * .012 + 1, rr = 2.6;
    (_k[0] = Math.min(Math.max(mx + Math.cos(a) * rr, -AR + .4), AR - .4), _k[1] = .85, _k[2] = Math.min(Math.max(mz + Math.sin(a) * rr, -AR + .4), AR - .4), _k[3] = mx, _k[4] = .25, _k[5] = mz, _k[6] = dt, _k[7] = .62, this.setCamR());
    FX.update(dt * .25);
  },
  setCamR() { const ex = _k[0], ey = _k[1], ez = _k[2], tx = _k[3], ty = _k[4], tz = _k[5], dt = _k[6], fov = _k[7], k = this.first ? 1 : 1 - Math.exp(-dt * 7), e = R.eye, t = R.tgt; e[0] += (ex - e[0]) * k; e[1] += (ey - e[1]) * k; e[2] += (ez - e[2]) * k; t[0] += (tx - t[0]) * k; t[1] += (ty - t[1]) * k; t[2] += (tz - t[2]) * k; R.cp[0] += (fov - R.cp[0]) * k; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; if (this.first) { this.first = 0; R.reset = 1; } },
  camera(dt) {
    if (this.camFix) { const c = this.camFix; R.eye[0] = c[0]; R.eye[1] = c[1]; R.eye[2] = c[2]; R.tgt[0] = c[3]; R.tgt[1] = c[4]; R.tgt[2] = c[5]; R.cp[0] = c[6]; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; if (this.first) { this.first = 0; R.reset = 1; } return; }
    const A = SIM.bots[0], B = SIM.bots[1], s = A.s, R_ = A.R, e = R.eye, t = R.tgt; const sh = FX.sh[0] * FX.sh[0] * .05, jx = Math.sin(this.ft[0] * 71) * sh, jy = Math.sin(this.ft[0] * 93 + 1) * sh;
    if (this.cam === 0 || (this.cam === 1 && R_[4] < .45)) { let fx = R_[0], fz = R_[6]; const l = Math.sqrt((fx) * (fx) + (fz) * (fz)); if (l > .3) { fx /= l; fz /= l; this.ft[5] = fx; this.ft[6] = fz; } else { fx = this.ft[5] || 1; fz = this.ft[6] || 0; }
      const kk = this.first ? 1 : 1 - Math.exp(-dt * 3.2); this.ft[3] = (this.ft[3] || fx) + (fx - (this.ft[3] || fx)) * kk; this.ft[4] = (this.ft[4] || 0) + (fz - (this.ft[4] || 0)) * kk; if (this.first) { this.ft[3] = fx; this.ft[4] = fz; }
      const n = Math.sqrt((this.ft[3]) * (this.ft[3]) + (this.ft[4]) * (this.ft[4])) || 1, ux = this.ft[3] / n, uz = this.ft[4] / n;
      (_k[0] = Math.min(Math.max(s[0] - ux * 2.05, -AR + .25), AR - .25) + jx, _k[1] = Math.min(Math.max(s[1] + 1.05, .5), 3) + jy + (((s[0] - ux * 2.05 - B.s[0]) * (s[0] - ux * 2.05 - B.s[0]) + (s[2] - uz * 2.05 - B.s[2]) * (s[2] - uz * 2.05 - B.s[2])) < 2.2 ? .6 : 0), _k[2] = Math.min(Math.max(s[2] - uz * 2.05, -AR + .25), AR - .25), _k[3] = s[0] + ux * 1.1, _k[4] = Math.max(s[1], 0) + .2, _k[5] = s[2] + uz * 1.1, _k[6] = dt, _k[7] = .86, this.setCamR()); }
    else if (this.cam === 1) { const L = A.L, y = L.hy1 - A.ycm + .3, x = L.mx - .12; (_c[45] = x, _c[46] = y, _c[47] = 0, SIM.wptR(A)); e[0] = Math.min(Math.max(_c[0] + jx, -AR + .75), AR - .75); e[1] = _c[1] + jy; e[2] = Math.min(Math.max(_c[2], -AR + .75), AR - .75); (_c[45] = x + 3, _c[46] = y - .62, _c[47] = 0, SIM.wptR(A)); t[0] = _c[0]; t[1] = _c[1]; t[2] = _c[2]; R.up[0] = R_[1]; R.up[1] = R_[4]; R.up[2] = R_[7]; R.cp[0] = 1.05; if (this.first) { this.first = 0; R.reset = 1; } }
    else { const mx = (s[0] + B.s[0]) / 2, mz = (s[2] + B.s[2]) / 2, d = Math.sqrt((s[0] - B.s[0]) * (s[0] - B.s[0]) + (s[2] - B.s[2]) * (s[2] - B.s[2])); (_k[0] = mx * .35 + jx, _k[1] = 3.55 + jy, _k[2] = -6.55, _k[3] = mx, _k[4] = .2, _k[5] = mz, _k[6] = dt, _k[7] = Math.min(Math.max(2 * Math.atan((d * .55 + 1.25) / (1.78 * Math.sqrt((mx * .65) * (mx * .65) + 11.6 + (mz + 6.55) * (mz + 6.55)))), .1), .95), this.setCamR()); }
  },
  drawProps() { // le serras, martelo e tampa do fosso de this.pr (sawH0, sawH1, sawA, ahA, pitY)
    const S = SIM, I = R.I, P = this.pr, h0 = P[0], h1 = P[1], sa = P[2], ah = P[3], py = P[4];
    M4.ident(_m, 48); (_t[0] = PIT.x, _t[1] = py - .002, _t[2] = PIT.z, _t[3] = 0, M4.mulTRr(I, SLOT.AUX3 * INST_F, _m, 48, 1)); (_d[0] = 0, _d[1] = -1, _d[2] = 1, _d[3] = 1, _d[4] = .3, _d[5] = 0, _d[6] = 0, _d[7] = 0, _d[8] = 11, DRAW.putR(SLOT.AUX3, MESH.pitlid.id, CORES[4])); DRAW.dents(SLOT.AUX3, null, 0); FX.sh[1] = py;
    for (let i = 0; i < 2; i++) { const sl = i ? SLOT.AUX1 : SLOT.AUX0, h = i ? h1 : h0; M4.ident(_m, 48); (_t[0] = SAWS[i].x, _t[1] = -SAW_R - .03 + h * (SAW_R * .78), _t[2] = SAWS[i].z, _t[3] = -sa * Math.min(1, h * 3 + .05), M4.mulTRr(I, sl * INST_F, _m, 48, 2)); (_d[0] = 0, _d[1] = -1, _d[2] = 1, _d[3] = 1, _d[4] = .3, _d[5] = 0, _d[6] = 0, _d[7] = 0, _d[8] = 5 + i, DRAW.putR(sl, MESH.saw.id, CORES[4])); DRAW.dents(sl, null, 0); }
    M4.ident(_m, 48); (_t[0] = AHAM.x, _t[1] = AHAM.y + .1, _t[2] = AHAM.z, _t[3] = PI * .75, M4.mulTRr(_m, 32, _m, 48, 1)); (_t[0] = 0, _t[1] = 0, _t[2] = 0, _t[3] = ah, M4.mulTRr(I, SLOT.AUX2 * INST_F, _m, 32, 2)); (_d[0] = 0, _d[1] = -1, _d[2] = 1, _d[3] = 1, _d[4] = .4, _d[5] = 0, _d[6] = 0, _d[7] = 0, _d[8] = 9, DRAW.putR(SLOT.AUX2, MESH.ahammer.id, CORES[4])); DRAW.dents(SLOT.AUX2, null, 0);
  },
  drawFight() {
    const S = SIM;
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s; B.wav += Math.min(Math.max(B.wspin * DT, -.34), .34); (_q[0] = s[0], _q[1] = s[1], _q[2] = s[2], _q[3] = s[3], _q[4] = s[4], _q[5] = s[5], _q[6] = s[6], DRAW.botR(SLOT.ROBOT + i * SLOT.ROBOT_N, B, i, null)); if (this.first) for (let k = 0; k < SLOT.ROBOT_N; k++) R.snap(SLOT.ROBOT + i * SLOT.ROBOT_N + k); }
    const P = this.pr; P[0] = S.sawH[0]; P[1] = S.sawH[1]; P[2] = S.sawA; P[3] = S.ahA; P[4] = S.pitY; this.drawProps();
    const d = S.deb; for (let i = 0; i < DEB_N; i++) { const sl = SLOT.DEBRIS + i, m = S.debMesh[i]; if (m < 0) { R.im[sl] = -1; continue; } const o = i * DEB_F, was = R.im[sl]; (_q[0] = d[o + 3], _q[1] = d[o + 4], _q[2] = d[o + 5], _q[3] = d[o + 6], _q[4] = d[o], _q[5] = d[o + 1], _q[6] = d[o + 2], M4.fromQTr(R.I, sl * INST_F)); const B = S.bots[d[o + 17] | 0], part = d[o + 18] | 0, c = CHASSIS[B.b[0]];
      (_d[0] = BLIND[B.b[2]].metal, _d[1] = part >= P_AF && part <= P_AT ? d[o + 17] : -1, _d[2] = c.L / 2, _d[3] = c.W / 2 + .012, _d[4] = .15, _d[5] = B.burn, _d[6] = 0, _d[7] = 0, _d[8] = sl * 1.3, DRAW.putR(sl, m, B.cor)); DRAW.dents(sl, null, 0); if (was !== m) R.snap(sl); }
  },
};
