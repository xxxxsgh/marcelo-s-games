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
const NOMES = ['Fagulha', 'Rebimboca', 'Chapa Quente', 'Zé Faísca', 'Mordaça', 'Tranco', 'Parafuseta', 'Curto-Circuito', 'Bigorna', 'Marreta Boa'];
const SIM = new Sim(), BG = new Sim(), TMPS = new Sim();
let TOR = null;

const GAR = {
  com: [1, 1, 1, 0], pre: [1, 1, 1, 0], row: 0, mode: 0, cor: 0, num: 7, nome: 'Fagulha', repair: false, acoes: 2, ang: .6, an: new Float32Array(4), anV: new Float32Array(4), bot: new Bot(0), hp: null, idle: 0, warn: 0,
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
    G.st = 'garagem'; UI.show('gar'); R.exposure = .62; R.fog = .0016; R.mblur = .5; R.amb = 1.0; R.keyDim = 1; FX.reset(); DRAW.hide(SLOT.ROBOT + SLOT.ROBOT_N);
    for (let i = SLOT.DEBRIS; i < SLOT.DEBRIS + SLOT.DEBRIS_N; i++) R.im[i] = -1; R.im[SLOT.AUX1] = -1; R.im[SLOT.AUX2] = -1; R.im[SLOT.AUX3] = -1; R.im[SLOT.GLASS] = -1;
    R.bake(1, MESH.garage.id, GAR_LIGHTS, [0, 1.5, 1.2]); this.refresh(-1); for (let k = 0; k < 4; k++) this.an[k] = .4 + k * .12;
  },
  tick(dt) {
    const g = this; let ch = false;
    if (IN.typing) { } else if (g.mode === 0) {
      if (IN.pUp) { g.row = (g.row + 7) % 8; ch = true; } if (IN.pDown) { g.row = (g.row + 1) % 8; ch = true; }
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
    if (ch) UI.garage(g);
    // bancada giratoria
    if (Math.abs(IN.rx) > .01) { g.ang += IN.rx * dt * 2.6; g.idle = 0; } else { g.idle += dt; if (g.idle > 2.5) g.ang += dt * .22; }
    // animacao de encaixe (mola amortecida)
    for (let k = 0; k < 4; k++) { if (g.an[k] === 0 && g.anV[k] === 0) continue; const was = g.an[k]; g.anV[k] += (-g.an[k] * 260 - g.anV[k] * 17) * dt; g.an[k] += g.anV[k] * dt; if (g.an[k] < 0) { g.an[k] = 0; if (g.anV[k] < -.5) { g.anV[k] *= -.25; FX.sparks(Math.sin(g.ang) * .1, BENCH_Y + .12 + k * .03, Math.cos(g.ang) * .1, 0, .6, 0, 26, 2.2, 1, 0); FX.light(0, BENCH_Y + .3, 0, 3, 3, 2, .8, .18); } else g.anV[k] = 0; } if (Math.abs(g.an[k]) < .0005 && Math.abs(g.anV[k]) < .01) { g.an[k] = 0; g.anV[k] = 0; } }
  },
  go() { const st = statsOf(this.pre); if (this.mode === 1) return; if (!st.ok) { UI.toast(`PESO ACIMA DO LIMITE (${st.kg} / ${PESO_MAX} kg)`); this.warn = 1; return false; } this.com = this.pre.slice(); G.save(); if (!TOR || !TOR.ativo) G.newTournament(); else TOR.ent[0].b = this.com.slice(); if (this.repair) G.startIntro(); else G.toBracket('PRÓXIMA LUTA'); return true; },
  draw() {
    const B = this.bot, L = B.L, a = this.ang, I = R.I;
    R.im[SLOT.AUX0] = MESH.bench.id; M4.ident(_m, 48); M4.mulTR(I, SLOT.AUX0 * INST_F, _m, 48, 0, BENCH_Y, 0, 1, a); DRAW.put(SLOT.AUX0, MESH.bench.id, B.cor, 0, -1, 1, 1, 0, 0, 0, 0, 3); DRAW.dents(SLOT.AUX0, null, 0);
    DRAW.bot(SLOT.ROBOT, B, 0, BENCH_Y + L.clear + B.ycm, 0, 0, Math.sin(a / 2), 0, Math.cos(a / 2), 0, this.an);
    if (G.camFix) { const c = G.camFix; R.eye[0] = c[0]; R.eye[1] = c[1]; R.eye[2] = c[2]; R.tgt[0] = c[3]; R.tgt[1] = c[4]; R.tgt[2] = c[5]; R.fov = c[6]; return; }
    R.eye[0] = 1.5; R.eye[1] = 1.42; R.eye[2] = 2.15; R.tgt[0] = -.38; R.tgt[1] = .8; R.tgt[2] = 0; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; R.fov = .62;
  },
};

const G = {
  st: 'boot', t: 0, cam: 0, camT: 0, ce: new Float32Array(3), ct: new Float32Array(3), first: 1, round: '', intro: 0, introT: 0, endT: 0, paused: 0, prev: '',
  auto: false, fast: 1, skipRender: false, script: null, sf: 0, rec: null, lastSk: new Float32Array(2 * 4 * 3).fill(-9), frameLog: null, nlog: 0, lastT: 0, acc: 0, hits: 0, detached: 0, maxPen: 0, rumbleLog: null,
  // replay
  REC_F: 28 + 5 + DEB_N * 8, ring: null, clip: null, clipN: 0, clipHit: 0, cev: new Float32Array(32 * 9), ncev: 0, rev: new Float32Array(64 * 9), nrev: 0, bestAt: -1, rp: null, rt: 0,
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ b: GAR.com, cor: GAR.cor, num: GAR.num, nome: GAR.nome, tor: TOR })); } catch (e) { } },
  load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!s) return; if (Array.isArray(s.b) && s.b.length === 4) GAR.com = s.b.map((v, i) => clamp(v | 0, 0, [2, 2, 2, 5][i])); GAR.cor = clamp(s.cor | 0, 0, CORES.length - 1); GAR.num = clamp(s.num | 0, 0, 99); GAR.nome = String(s.nome || 'Fagulha').slice(0, 14); if (s.tor && s.tor.ent && s.tor.ent.length === 8) TOR = s.tor; } catch (e) { } },
  newTournament(seed) {
    const ent = [{ nome: GAR.nome, b: GAR.com.slice(), cor: CORES[GAR.cor], num: GAR.num, estilo: -1, hp: null, v: 0, d: 0 }];
    for (const r of RIVAIS) ent.push({ nome: r.nome, b: r.b.slice(), cor: CORES[r.cor], num: r.num, estilo: r.estilo, hp: null, v: 0, d: 0 });
    const mk = (a, b) => ({ a, b, w: -1, how: '', pa: 0, pb: 0 });
    TOR = { ativo: true, rodada: 0, ent, jogos: [[mk(0, 1), mk(2, 3), mk(4, 5), mk(6, 7)], [mk(-1, -1), mk(-1, -1)], [mk(-1, -1)]], campeao: -1, vivo: true, seed: seed || 20260, lutas: 0 };
    this.save();
  },
  myMatch() { if (!TOR || !TOR.vivo) return null; for (const j of TOR.jogos[TOR.rodada]) if ((j.a === 0 || j.b === 0) && j.w < 0) return j; return null; },
  cfg(i) { const e = TOR.ent[i]; return { nome: e.nome, cor: e.cor, num: e.num, estilo: Math.max(0, e.estilo) }; },
  // simula as lutas restantes da rodada (IA x IA) e avanca a chave
  finishRound() {
    const T = TOR, js = T.jogos[T.rodada];
    for (let k = 0; k < js.length; k++) { const j = js[k]; if (j.w >= 0 || j.a < 0 || j.b < 0) continue;
      BG.setupBot(0, T.ent[j.a].b, T.ent[j.a].hp, this.cfg(j.a)); BG.setupBot(1, T.ent[j.b].b, T.ent[j.b].hp, this.cfg(j.b)); BG.bots[0].isAI = true; BG.bots[1].isAI = true; BG.start(T.seed + T.rodada * 100 + k * 7 + 1);
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
  record(j, S) { const T = TOR; j.w = S.winner === 0 ? j.a : j.b; j.how = S.koBy; j.pa = S.ptsA; j.pb = S.ptsB; const l = j.w === j.a ? j.b : j.a; T.ent[j.w].v++; T.ent[l].d++; T.ent[j.a].hp = Array.from(S.bots[0].hp); T.ent[j.b].hp = Array.from(S.bots[1].hp); if (l === 0) T.vivo = false; T.lutas++; },
  toBracket(txt) {
    const T = TOR, j = this.myMatch(); for (const r of T.jogos) for (const q of r) q.next = q === j;
    this.st = 'chave'; UI.show('chave'); this.enterArena(); this.cam = 2;
    let foot = '<b>A / ENTER</b> continuar';
    if (T.campeao >= 0) { txt = T.campeao === 0 ? 'VOCÊ É O CAMPEÃO DA COPA REBITE!' : `CAMPEÃO: ${T.ent[T.campeao].nome}`; foot = '<b>A / ENTER</b> novo torneio'; }
    else if (!T.vivo) { txt = 'VOCÊ FOI ELIMINADO'; foot = '<b>A / ENTER</b> ver o resto do torneio'; }
    else if (j) { const o = j.a === 0 ? j.b : j.a; txt = `${txt || 'PRÓXIMA LUTA'}: ${T.ent[0].nome} × ${T.ent[o].nome}`; }
    UI.bracket(T, txt, foot);
  },
  enterArena() {
    if (R.scene !== 0) { R.im[SLOT.GLASS] = MESH.glass.id; R.im[SLOT.AUX0] = MESH.saw.id; R.im[SLOT.AUX1] = MESH.saw.id; R.im[SLOT.AUX2] = MESH.ahammer.id; R.bake(0, MESH.arena.id, ARENA_LIGHTS, [0, 1.2, 0]); }
    R.exposure = .2; R.fog = .0042; R.mblur = 1; R.amb = 1; R.fov = .9;
  },
  // prepara a luta do jogador (ou uma luta avulsa para teste/roteiro)
  setupFight(ia, ib, seed, dur, ea, eb) {
    const A = ea || TOR.ent[ia], B = eb || TOR.ent[ib]; this.entA = A; this.entB = B;
    SIM.setupBot(0, A.b, A.hp, { nome: A.nome, cor: A.cor, num: A.num, estilo: Math.max(0, A.estilo) }); SIM.setupBot(1, B.b, B.hp, { nome: B.nome, cor: B.cor, num: B.num, estilo: Math.max(0, B.estilo) });
    SIM.bots[0].isAI = this.auto; SIM.bots[1].isAI = true; SIM.start(seed, dur);
    Atlas.robot(0, A.nome, A.num, A.cor); Atlas.robot(1, B.nome, B.num, B.cor); Atlas.score(A.nome.toUpperCase(), B.nome.toUpperCase(), this.round, 'AO VIVO', A.cor, B.cor);
    this.enterArena(); R.clearMarks(); FX.reset(); this.lastSk.fill(-9); this.hits = 0; this.hitsB = 0; this.detB = 0; this.detached = 0; this.maxPen = -9; this.bestAt = -1; this.clipN = 0; this.ncev = 0; this.nrev = 0; this.sf = 0;
    if (!this.ring) { this.ring = new Float32Array(300 * this.REC_F); this.clip = new Float32Array(240 * this.REC_F); this.rp = [0, 1].map(() => ({ hp: new Float32Array(NPART), wang: new Float32Array(4), wa: 0, burn: 0, glow: 0 })); }
    UI.hudInit(SIM.bots[0], SIM.bots[1], this.round); this.clipFor = -2;
    for (let i = 0; i < SLOT.DEBRIS_N; i++) R.im[SLOT.DEBRIS + i] = -1;
    this.cam = 0; this.first = 1; this.drawFight(0); R.reset = 1;
  },
  startIntro() {
    const j = this.myMatch(); if (!j) { this.toBracket(''); return; } const o = j.a === 0 ? j.b : j.a; this.round = RODADAS[TOR.rodada];
    this.setupFight(0, o, TOR.seed + TOR.rodada * 100 + 50, LUTA_T); this.curMatch = j;
    this.st = 'intro'; this.intro = 0; this.introT = 0; R.keyDim = .45; UI.show('intro'); this.showIntro();
  },
  showIntro() { const e = this.intro ? this.entB : this.entA, h = e.v + e.d === 0 ? 'ESTREIA' : `${e.v} VITÓRIA${e.v === 1 ? '' : 'S'}`; UI.intro(e, this.intro, SIM.bots[this.intro].S, h); },
  startFight() { this.st = 'luta'; UI.show('hud'); UI.msg('', ''); R.keyDim = 1; },
  // ---------- quadro ----------
  tick(dt) {
    IN.poll(dt); UI.tick(dt); this.t += dt; const st = this.st;
    if (st === 'garagem') { GAR.tick(dt); GAR.draw(); FX.update(dt); }
    else if (st === 'chave') { if (IN.pOk || IN.pStart) { if (TOR.campeao >= 0) { TOR = null; this.save(); GAR.com = GAR.com.slice(); GAR.enter(false); } else if (!TOR.vivo) { this.finishRound(); this.toBracket(''); } else if (TOR.lutas === 0) this.startIntro(); else GAR.enter(true); }
      else { this.camT += dt; const a = this.camT * .12; R.eye[0] = Math.cos(a) * 11.5; R.eye[1] = 6.6; R.eye[2] = Math.sin(a) * 11.5; R.tgt[0] = 0; R.tgt[1] = .4; R.tgt[2] = 0; R.fov = .8; FX.update(dt); this.drawProps(); } }
    else if (st === 'intro') { this.introT += dt; const B = SIM.bots[this.intro], s = B.s, a = this.introT * .9 + (this.intro ? PI : 0) + .6, r = 2.3;
      R.eye[0] = clamp(s[0] + Math.cos(a) * r, -AR + .5, AR - .5); R.eye[1] = .75 + Math.sin(this.introT * .7) * .12; R.eye[2] = s[2] + Math.sin(a) * r; R.tgt[0] = s[0]; R.tgt[1] = .2; R.tgt[2] = s[2]; R.fov = .7;
      this.drawFight(0); FX.update(dt);
      if (this.introT > 3.6 || IN.pOk || IN.pStart) { if (this.intro === 0) { this.intro = 1; this.introT = 0; this.showIntro(); } else { this.st = 'contagem'; this.introT = 0; UI.show('hud'); this.cam = 0; this.first = 1; this.cnt = -1; } } }
    else if (st === 'contagem') { this.introT += dt; const n = Math.floor(this.introT / .8); if (n !== this.cnt) { this.cnt = n; if (n < 3) { UI.msg(String(3 - n), 'PREPARAR'); const c = n === 0 ? [9, .6, .3] : n === 1 ? [9, 6, .5] : [9, 8, 2]; FX.light(0, 3.2, 0, 16, c[0] * 6, c[1] * 6, c[2] * 6, .7); R.keyDim = .45 + n * .15; } else { UI.msg('LUTA!', ''); FX.light(0, 3.2, 0, 18, 10, 60, 14, .9); R.keyDim = 1; } }
      this.camera(dt); this.drawFight(0); FX.update(dt); if (this.introT > 3.1) this.startFight(); }
    else if (st === 'luta' || st === 'fim') {
      if (IN.pPause && st === 'luta' && !this.script) { this.prev = st; this.st = 'pausa'; UI.show('hud', 'pausa'); return; }
      if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0 && st === 'luta') UI.msg('', ''); }
      const n = this.fast; for (let k = 0; k < n; k++) this.fightStep();
      if (!this.skipRender || this.st !== 'luta') { this.camera(dt); this.drawFight(1); FX.update(dt); UI.hud(SIM, this.cam); }
      if (this.st === 'fim') { this.endT += dt * (this.fast > 1 ? 30 : 1); if (this.endT > 3) this.afterFight(); } }
    else if (st === 'juizes') { this.endT += dt * (this.fast > 1 ? 30 : 1); this.camera(dt); this.drawFight(1); FX.update(dt); if (this.endT > 6 || IN.pOk) this.toReplay(); }
    else if (st === 'replay') { this.replayTick(dt); }
    else if (st === 'pausa') { if (IN.pPause || IN.pOk) { this.st = this.prev; UI.show('hud'); } }
  },
  fightStep() {
    const S = SIM, A = S.bots[0];
    if (this.script) { const f = this.sf, d = this.script; if (f * 3 + 2 < d.length) { A.thr = d[f * 3] / 100; A.steer = d[f * 3 + 1] / 100; const b = d[f * 3 + 2]; A.fire = b & 1; A.flipB = (b >> 1) & 1; A.resetB = (b >> 2) & 1; if (b & 8) this.cam = (this.cam + 1) % 3; } else { A.thr = 0; A.steer = 0; A.fire = 0; } }
    else if (!A.isAI) { A.thr = IN.thr; A.steer = IN.steer; A.fire = IN.fire; A.flipB = IN.flip; A.resetB = IN.rst; if (IN.pCam) this.cam = (this.cam + 1) % 3; }
    S.step(); this.sf++;
    if (this.rec && S.frame <= this.rec.length / 3) { const o = (S.frame - 1) * 3; this.rec[o] = Math.round(A.thr * 100); this.rec[o + 1] = Math.round(A.steer * 100); this.rec[o + 2] = (A.fire ? 1 : 0) | (A.flipB ? 2 : 0) | (A.resetB ? 4 : 0); }
    this.events(); this.recFrame();
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s, h = B.hpt, Rm = B.R; let p = -9; for (let q = 0; q < B.nhp; q++) { const lx = h[q * 3], ly = h[q * 3 + 1], lz = h[q * 3 + 2], x = s[0] + Rm[0] * lx + Rm[1] * ly + Rm[2] * lz, z = s[2] + Rm[6] * lx + Rm[7] * ly + Rm[8] * lz, e = Math.max(Math.abs(x), Math.abs(z)) - AR; if (e > p) p = e; } if (p > this.maxPen) this.maxPen = p; if (S.bots[i].teleport) { S.bots[i].teleport = 0; this.first = 1; } }
    if (S.over && this.st === 'luta') { this.st = 'fim'; this.endT = 0; const w = S.bots[S.winner].nome; if (S.koBy === 'juizes') UI.msg('FIM DO TEMPO', 'A DECISÃO VAI PARA OS JUÍZES'); else UI.msg(S.koBy === 'fosso' ? 'NO FOSSO!' : 'NOCAUTE!', 'VITÓRIA DE ' + w); if (this.curMatch) Atlas.score(this.entA.nome.toUpperCase(), this.entB.nome.toUpperCase(), this.round, 'VITÓRIA: ' + w.toUpperCase(), this.entA.cor, this.entB.cor); }
  },
  events() {
    const S = SIM, e = S.ev;
    for (let k = 0; k < S.nev; k++) { const o = k * 8, ty = e[o], x = e[o + 1], y = e[o + 2], z = e[o + 3], dx = e[o + 4], dy = e[o + 5], dz = e[o + 6], mag = e[o + 7];
      if (ty === EV.HIT) { const dmg = mag % 1000; this.hits++; if (mag >= 1000) this.hitsB++; FX.sparks(x, y, z, dx, dy, dz, 24 + dmg * 6, 4 + dmg * .22, .75, 0); FX.sparks(x, y, z, dx, dy + .5, dz, 4 + dmg * .5, 3.5, .9, 1); FX.light(x, y + .25, z, 4 + dmg * .12, 26 + dmg * 2.2, 15 + dmg * 1.1, 4, .22); FX.smoke(x, y, z, 2, .22, 0, .7); FX.mark(x - dz * .2, z + dx * .2, x + dz * .2, z - dx * .2, .012, 1, .6);
        FX.shake = Math.min(1, FX.shake + dmg * .03); const st = clamp(.2 + dmg / 34, 0, 1); IN.rumble(st, st * .7, 120 + dmg * 7); if (this.rumbleLog && this.rumbleLog.length < 400) this.rumbleLog.push(dmg, st);
        if (dmg > S.best) { S.best = dmg; this.bestAt = S.frame; } this.pushEv(1, x, y, z, dx, dy, dz, dmg); }
      else if (ty === EV.DETACH) { this.detached++; if (mag >= 100) this.detB++; FX.sparks(x, y, z, dx, 1, dz, 70, 5, .9, 0); FX.sparks(x, y, z, dx, 1, dz, 14, 4, 1, 1); FX.smoke(x, y, z, 4, .3, 1, .9); FX.light(x, y + .3, z, 5, 40, 22, 6, .3); IN.rumble(.9, .6, 260); FX.shake = Math.min(1, FX.shake + .5); this.pushEv(2, x, y, z, dx, 1, dz, 30); const who = mag >= 100 ? 1 : 0; this.note(S.bots[who].nome + ' PERDEU ' + ['O CHASSI', 'UMA RODA', 'UMA RODA', 'UMA RODA', 'UMA RODA', 'A BLINDAGEM DA FRENTE', 'A BLINDAGEM DE TRÁS', 'A BLINDAGEM ESQUERDA', 'A BLINDAGEM DIREITA', 'A BLINDAGEM DO TETO', 'A ARMA', 'A BATERIA'][mag % 100]); }
      else if (ty === EV.GRIND) { FX.sparks(x, y, z, dx * .3, .8, dz * .3, 5, 3, .9, 0); }
      else if (ty === EV.SAW) { FX.sparks(x, y, z, 1, .9, 0, 46, 6, .5, 0); FX.light(x, .4, z, 4, 30, 18, 5, .2); IN.rumble(.6, .5, 160); FX.shake = Math.min(1, FX.shake + .3); this.pushEv(1, x, y, z, 1, .9, 0, 12); }
      else if (ty === EV.AHAM) { FX.sparks(x, y, z, 0, 1, 0, 40, 4.5, 1, 0); FX.smoke(x, .1, z, 3, .4, 0, .5); FX.light(x, .5, z, 5, 30, 20, 8, .25); FX.shake = Math.min(1, FX.shake + .45); FX.mark(x - .15, z - .15, x + .15, z + .15, .16, 1, .8); }
      else if (ty === EV.LAND) { FX.sparks(x, y, z, 0, 1, 0, 6 + mag * 2, 2.5, 1, 0); IN.rumble(clamp(mag / 10, .15, .7), .3, 110); }
      else if (ty === EV.HAMMER) { FX.sparks(x, y, z, 0, 1, 0, 16, 3.5, 1, 0); FX.light(x, .3, z, 3, 14, 9, 3, .15); FX.mark(x - .04, z, x + .04, z, .05, 1, .9); }
      else if (ty === EV.FLIP) { FX.smoke(x, y + .05, z, 3, .25, 0, .4); }
      else if (ty === EV.GRAB) { FX.sparks(x, y, z, 0, 1, 0, 20, 3, 1, 0); IN.rumble(.5, .4, 140); }
      else if (ty === EV.SCRAPE) { const l = this.lastSk, o2 = 0; FX.mark(x - dx * .016, z - dz * .016, x, z, .008, 1, .55); if (FX.rng.u() < .5) FX.sparks(x, .02, z, -dx * .12, .5, -dz * .12, 2, 2.2, .7, 0); }
      else if (ty === EV.SKID) { const id = mag >= 1000 ? 1 : 0, q = Math.floor((mag % 1000) / 10), w = mag % 10, l = this.lastSk, o2 = (id * 4 + q) * 3; if (l[o2 + 2] === S.frame - 1 && Math.hypot(l[o2] - x, l[o2 + 1] - z) < .5) FX.mark(l[o2], l[o2 + 1], x, z, w * .5, 0, .34); l[o2] = x; l[o2 + 1] = z; l[o2 + 2] = S.frame; }
      else if (ty === EV.KO) { FX.shake = .6; }
    }
    // fogo das armadilhas e das baterias
    if (S.flameOn) { for (let i = 0; i < 3; i++) { const n = FLAME.n[i]; FX.fire(n[0], .06, n[1], 3, .3, 5.5); if ((S.frame + i) % 6 === 0) FX.mark(n[0] - .3, n[1], n[0] + .3, n[1], .35, 2, .1); } FX.flight(FLAME.x, .9, FLAME.z, 7, 60 + 20 * Math.sin(S.t * 31), 26, 5); if (S.frame % 9 === 0) FX.smoke(FLAME.x + FX.rng.s1() * .6, 1.6, FLAME.z, 1, .5, 1, 1.2); }
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s; if (B.fireOn) { const c = CHASSIS[B.b[0]]; S.wpt(B, (c.win[0] + c.win[1]) / 2, B.L.hy1 - B.ycm, 0); FX.fire(_c[0], _c[1], _c[2], 1, .16, 2.2); if (S.frame % 3 === 0) FX.smoke(_c[0], _c[1] + .25, _c[2], 1, .3, 1, 1.3); FX.flight(_c[0], _c[1] + .3, _c[2], 4, 22 + 8 * Math.sin(S.t * 27 + i), 9, 2); B.burn = Math.min(1, B.burn + DT * .08); }
      else if (B.hp[P_BAT] < B.hpMax[P_BAT] * .6 && S.frame % 7 === 0) { const c = CHASSIS[B.b[0]]; S.wpt(B, (c.win[0] + c.win[1]) / 2, B.L.hy1 - B.ycm, 0); FX.smoke(_c[0], _c[1] + .05, _c[2], 1, .2, 0, .8); }
      const k = ARMAS[B.b[3]]; if (k.spin && B.wspin > k.wmax * .5 && B.hp[P_WP] > 0 && S.frame % 4 === 0) { /* brilho sutil do disco: nada */ } }
  },
  note(t) { UI.msg('', t); this.msgT = 2.2; },
  pushEv(ty, x, y, z, dx, dy, dz, mag) { if (this.nrev >= 64) { this.rev.copyWithin(0, 9, 64 * 9); this.nrev = 63; } const o = this.nrev++ * 9, e = this.rev; e[o] = SIM.frame; e[o + 1] = ty; e[o + 2] = x; e[o + 3] = y; e[o + 4] = z; e[o + 5] = dx; e[o + 6] = dy; e[o + 7] = dz; e[o + 8] = mag; },
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
    if (S.koBy === 'juizes') { this.st = 'juizes'; this.endT = 0; UI.judges(S, S.bots[0], S.bots[1]); UI.show('hud', 'juizes'); UI.msg('', ''); } else this.toReplay();
  },
  toReplay() { if (this.clipN > 20 && this.fast === 1) { this.st = 'replay'; this.rt = Math.max(0, this.clipHit - 70); this.rk = 0; UI.show('hud'); UI.msg('', ''); UI.el.rep.style.display = 'block'; FX.reset(); this.first = 1; } else this.endFight(); },
  endFight() {
    UI.el.rep.style.display = 'none'; const S = SIM;
    if (this.curMatch) { const j = this.curMatch; this.curMatch = null; if (j.a !== 0) { /* jogador sempre e o lado a */ } this.record(j, S); this.finishRound(); this.toBracket(S.winner === 0 ? 'VITÓRIA!' : ''); }
    else { this.st = 'livre'; UI.show('hud'); }
  },
  replayTick(dt) {
    const F = this.REC_F, c = this.clip; this.rt += dt * 60 * .25; if (this.rt >= this.clipN - 1 || IN.pOk || IN.pStart) { this.endFight(); return; }
    const f0 = Math.floor(this.rt), fr = this.rt - f0, o0 = f0 * F, o1 = Math.min(f0 + 1, this.clipN - 1) * F, S = SIM;
    for (let i = 0; i < 2; i++) { const B = S.bots[i], P = this.rp[i], q0 = o0 + i * 14, q1 = o1 + i * 14; P.b = B.b; P.L = B.L; P.cor = B.cor; P.dent = B.dent; P.hpMax = B.hpMax; P.ycm = B.ycm;
      const px = lerp(c[q0], c[q1], fr), py = lerp(c[q0 + 1], c[q1 + 1], fr), pz = lerp(c[q0 + 2], c[q1 + 2], fr); let d = c[q0 + 3] * c[q1 + 3] + c[q0 + 4] * c[q1 + 4] + c[q0 + 5] * c[q1 + 5] + c[q0 + 6] * c[q1 + 6]; const sg = d < 0 ? -1 : 1;
      let qx = lerp(c[q0 + 3], c[q1 + 3] * sg, fr), qy = lerp(c[q0 + 4], c[q1 + 4] * sg, fr), qz = lerp(c[q0 + 5], c[q1 + 5] * sg, fr), qw = lerp(c[q0 + 6], c[q1 + 6] * sg, fr); const l = 1 / Math.hypot(qx, qy, qz, qw); qx *= l; qy *= l; qz *= l; qw *= l;
      P.wa = lerp(c[q0 + 7], c[q1 + 7], fr); for (let k = 0; k < 4; k++) P.wang[k] = lerp(c[q0 + 8 + k], c[q1 + 8 + k], fr); const m = c[q0 + 12]; for (let k = 0; k < NPART; k++) P.hp[k] = (m >> k) & 1 ? B.hpMax[k] : 0; P.burn = c[q0 + 13]; P.glow = 0;
      DRAW.bot(SLOT.ROBOT + i * SLOT.ROBOT_N, P, px, py, pz, qx, qy, qz, qw, i, null); if (i === 0) { this.rpx = px; this.rpy = py; this.rpz = pz; } else { this.rqx = px; this.rqy = py; this.rqz = pz; } }
    this.drawProps(c[o0 + 28], c[o0 + 29], c[o0 + 30], c[o0 + 31], c[o0 + 32]);
    for (let i = 0; i < DEB_N; i++) { const q = o0 + 33 + i * 8, sl = SLOT.DEBRIS + i, m = c[q]; if (m < 0) { R.im[sl] = -1; continue; } M4.fromQT(R.I, sl * INST_F, c[q + 4], c[q + 5], c[q + 6], c[q + 7], c[q + 1], c[q + 2], c[q + 3]); R.im[sl] = m; }
    while (this.rk < this.ncev && this.cev[this.rk * 9] <= this.rt) { const o = this.rk++ * 9, e = this.cev, dmg = e[o + 8]; FX.sparks(e[o + 2], e[o + 3], e[o + 4], e[o + 5], e[o + 6], e[o + 7], 30 + dmg * 6, 4 + dmg * .22, .75, 0); FX.sparks(e[o + 2], e[o + 3], e[o + 4], e[o + 5], e[o + 6] + .5, e[o + 7], 6, 3.5, .9, 1); FX.light(e[o + 2], e[o + 3] + .25, e[o + 4], 5, 26 + dmg * 2.2, 15 + dmg * 1.1, 4, .5); }
    // camera do replay: orbita lenta em volta do golpe
    const mx = (this.rpx + this.rqx) / 2, mz = (this.rpz + this.rqz) / 2, a = this.rt * .012 + 1, rr = 2.6;
    this.setCam(clamp(mx + Math.cos(a) * rr, -AR + .4, AR - .4), .85, clamp(mz + Math.sin(a) * rr, -AR + .4, AR - .4), mx, .25, mz, dt, .62);
    FX.update(dt * .25);
  },
  setCam(ex, ey, ez, tx, ty, tz, dt, fov) { const k = this.first ? 1 : 1 - Math.exp(-dt * 7), e = R.eye, t = R.tgt; e[0] += (ex - e[0]) * k; e[1] += (ey - e[1]) * k; e[2] += (ez - e[2]) * k; t[0] += (tx - t[0]) * k; t[1] += (ty - t[1]) * k; t[2] += (tz - t[2]) * k; R.fov += (fov - R.fov) * k; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; if (this.first) { this.first = 0; R.reset = 1; } },
  camera(dt) {
    if (this.camFix) { const c = this.camFix; R.eye[0] = c[0]; R.eye[1] = c[1]; R.eye[2] = c[2]; R.tgt[0] = c[3]; R.tgt[1] = c[4]; R.tgt[2] = c[5]; R.fov = c[6]; R.up[0] = 0; R.up[1] = 1; R.up[2] = 0; if (this.first) { this.first = 0; R.reset = 1; } return; }
    const A = SIM.bots[0], B = SIM.bots[1], s = A.s, R_ = A.R, e = R.eye, t = R.tgt; const sh = FX.shake * FX.shake * .05, jx = Math.sin(this.t * 71) * sh, jy = Math.sin(this.t * 93 + 1) * sh;
    if (this.cam === 0) { let fx = R_[0], fz = R_[6]; const l = Math.hypot(fx, fz); if (l > .3) { fx /= l; fz /= l; this.cfx = fx; this.cfz = fz; } else { fx = this.cfx || 1; fz = this.cfz || 0; }
      const kk = this.first ? 1 : 1 - Math.exp(-dt * 3.2); this.sfx = (this.sfx || fx) + (fx - (this.sfx || fx)) * kk; this.sfz = (this.sfz || 0) + (fz - (this.sfz || 0)) * kk; if (this.first) { this.sfx = fx; this.sfz = fz; }
      const n = Math.hypot(this.sfx, this.sfz) || 1, ux = this.sfx / n, uz = this.sfz / n;
      this.setCam(clamp(s[0] - ux * 2.5, -AR + .25, AR - .25) + jx, clamp(s[1] + 1.05, .5, 3) + jy, clamp(s[2] - uz * 2.5, -AR + .25, AR - .25), s[0] + ux * 1.1, Math.max(s[1], 0) + .2, s[2] + uz * 1.1, dt, .95); }
    else if (this.cam === 1) { const L = A.L, y = L.hy1 - A.ycm + .2, x = -L.hx * .55; SIM.wpt(A, x, y, 0); e[0] = _c[0] + jx; e[1] = _c[1] + jy; e[2] = _c[2]; SIM.wpt(A, x + 3, y - .55, 0); t[0] = _c[0]; t[1] = _c[1]; t[2] = _c[2]; R.up[0] = R_[1]; R.up[1] = R_[4]; R.up[2] = R_[7]; R.fov = 1.2; if (this.first) { this.first = 0; R.reset = 1; } }
    else { const mx = (s[0] + B.s[0]) / 2, mz = (s[2] + B.s[2]) / 2, d = Math.hypot(s[0] - B.s[0], s[2] - B.s[2]); this.setCam(mx * .25 + jx, 6.4 + jy, -8.1, mx, .2, mz, dt, clamp(.3 + d * .045, .34, .78)); }
  },
  drawProps(h0, h1, sa, ah, py) {
    const S = SIM, I = R.I; if (h0 === undefined) { h0 = S.sawH[0]; h1 = S.sawH[1]; sa = S.sawA; ah = S.ahA; py = S.pitY; }
    M4.ident(_m, 48); M4.mulTR(I, SLOT.AUX3 * INST_F, _m, 48, PIT.x, py - .002, PIT.z, 1, 0); DRAW.put(SLOT.AUX3, MESH.pitlid.id, CORES[4], 0, -1, 1, 1, .3, 0, 0, 0, 11); DRAW.dents(SLOT.AUX3, null, 0); FX.pitY = py;
    for (let i = 0; i < 2; i++) { const sl = i ? SLOT.AUX1 : SLOT.AUX0, h = i ? h1 : h0; M4.ident(_m, 48); M4.mulTR(I, sl * INST_F, _m, 48, SAWS[i].x, -SAW_R - .03 + h * (SAW_R * .78), SAWS[i].z, 2, -sa * Math.min(1, h * 3 + .05)); DRAW.put(sl, MESH.saw.id, CORES[4], 0, -1, 1, 1, .3, 0, 0, 0, 5 + i); DRAW.dents(sl, null, 0); }
    M4.ident(_m, 48); M4.mulTR(_m, 32, _m, 48, AHAM.x, AHAM.y + .1, AHAM.z, 1, PI * .75); M4.mulTR(I, SLOT.AUX2 * INST_F, _m, 32, 0, 0, 0, 2, ah); DRAW.put(SLOT.AUX2, MESH.ahammer.id, CORES[4], 0, -1, 1, 1, .4, 0, 0, 0, 9); DRAW.dents(SLOT.AUX2, null, 0);
  },
  drawFight() {
    const S = SIM;
    for (let i = 0; i < 2; i++) { const B = S.bots[i], s = B.s; DRAW.bot(SLOT.ROBOT + i * SLOT.ROBOT_N, B, s[0], s[1], s[2], s[3], s[4], s[5], s[6], i, null); if (this.first) for (let k = 0; k < SLOT.ROBOT_N; k++) R.snap(SLOT.ROBOT + i * SLOT.ROBOT_N + k); }
    this.drawProps();
    const d = S.deb; for (let i = 0; i < DEB_N; i++) { const sl = SLOT.DEBRIS + i, m = S.debMesh[i]; if (m < 0) { R.im[sl] = -1; continue; } const o = i * DEB_F, was = R.im[sl]; M4.fromQT(R.I, sl * INST_F, d[o + 3], d[o + 4], d[o + 5], d[o + 6], d[o], d[o + 1], d[o + 2]); const B = S.bots[d[o + 17] | 0], part = d[o + 18] | 0, c = CHASSIS[B.b[0]];
      DRAW.put(sl, m, B.cor, BLIND[B.b[2]].metal, part >= P_AF && part <= P_AT ? d[o + 17] : -1, c.L / 2, c.W / 2 + .012, 1, B.burn, 0, 0, sl * 1.3); if (part >= P_AF && part <= P_AT) DRAW.dents(sl, B.dent, (part - P_AF) * 16); else DRAW.dents(sl, null, 0); if (was !== m) R.snap(sl); }
  },
};
