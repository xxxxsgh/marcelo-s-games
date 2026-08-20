/**
 * Smoke test do jogo rodando de verdade num Chromium.
 *
 * Build verde nao prova nada num jogo: este script sobe o `vite preview`,
 * abre a pagina, joga alguns segundos com teclas e mouse sinteticos e falha
 * se aparecer erro de console, excecao, NaN na simulacao ou se o mundo nao
 * reagir (nenhum bicho, nenhuma bala, nenhum tile explorado).
 *
 *   node tools/smoke.mjs [--shots]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const WANT_SHOTS = process.argv.includes('--shots');
const PORT = 4174;
const URL = `http://127.0.0.1:${PORT}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Sobe o vite pelo binario direto, e nao por `npx`: matar o npx deixaria o
// servidor filho vivo, e a cada rodada sobraria mais um preview no ar.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview',
  '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch { /* ja morreu */ } });

const erros = [];
let saida = 0;
const ok = (m) => console.log(`OK  ${m}`);
const falha = (m) => { console.error(`FALHA  ${m}`); saida = 1; };

try {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(URL); if (r.ok) break; } catch { /* ainda subindo */ }
    await wait(250);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console.error: ${m.text()}`); });
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));

  await page.goto(`${URL}?seed=smoke-1`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.SP?.jogo?.mundo, null, { timeout: 30000 });
  ok('boot: window.SP pronto');

  const mundo = await page.evaluate(() => ({
    seed: window.SP.jogo.mapa.seed,
    ninhos: window.SP.jogo.ninhos.length,
    capsulas: window.SP.jogo.capsulas.length,
    estado: window.SP.jogo.estado,
    alcancaveis: window.SP.jogo.mapa.alcancavel.reduce((a, b) => a + b, 0),
  }));
  console.log(`    mundo: seed=${mundo.seed} ninhos=${mundo.ninhos} capsulas=${mundo.capsulas} tiles alcancaveis=${mundo.alcancaveis}`);
  if (mundo.estado !== 'titulo') falha(`estado inicial deveria ser titulo, veio ${mundo.estado}`);
  if (mundo.ninhos !== 3) falha(`esperava 3 ninhos, veio ${mundo.ninhos}`);
  if (mundo.alcancaveis < 4000) falha(`vale pequeno demais: ${mundo.alcancaveis} tiles alcancaveis`);

  // Todo ponto de interesse tem que ser alcancavel a pe a partir da nave.
  const ilhados = await page.evaluate(() => {
    const j = window.SP.jogo, m = j.mapa;
    const fora = [];
    for (const p of [...j.ninhos, ...j.capsulas]) {
      if (!m.alcancavel[p.ty * m.w + p.tx]) fora.push(`${p.tx},${p.ty}`);
    }
    return fora;
  });
  if (ilhados.length) falha(`pontos de interesse ilhados: ${ilhados.join(' | ')}`);
  else ok('geracao: todos os ninhos e capsulas sao alcancaveis a pe');

  // comeca a partida
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.SP.jogo.estado === 'jogando', null, { timeout: 20000 });
  ok('queda: cinematica terminou e o controle passou pro jogador');

  if (WANT_SHOTS) mkdirSync('shots', { recursive: true });
  const foto = async (nome) => {
    if (!WANT_SHOTS) return;
    await page.screenshot({ path: `shots/${nome}.png` });
    console.log(`    shot: shots/${nome}.png`);
  };

  // --- joga: anda, atira, troca de arma, esquiva ------------------------
  await page.mouse.move(900, 300);
  await page.keyboard.down('KeyD');
  await wait(700);
  await page.mouse.down();
  await wait(500);
  await page.mouse.up();
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await wait(600);
  await page.keyboard.press('Space');
  await wait(400);
  await page.keyboard.up('KeyW');
  await foto('jogando');

  const depoisDeAndar = await page.evaluate(() => {
    const j = window.SP.jogo;
    return {
      x: j.jogador.x, y: j.jogador.y,
      tiros: j.jogador.stats.tiros,
      explorados: j.explorado.reduce((a, b) => a + b, 0),
      fps: j.stats.fps,
    };
  });
  if (!(depoisDeAndar.tiros > 0)) falha('o clique nao gerou nenhum tiro');
  else ok(`combate: ${depoisDeAndar.tiros} tiros disparados`);
  if (!(depoisDeAndar.explorados > 200)) falha(`exploracao travada: ${depoisDeAndar.explorados} tiles`);
  else ok(`exploracao: ${depoisDeAndar.explorados} tiles descobertos`);

  // --- simulacao longa: o diretor precisa povoar o vale ------------------
  // Daqui pra frente o teste checa REGRA, nao sobrevivencia: parado no meio do
  // vale por 30 s o jogador morre — e isso derrubaria o resto do roteiro.
  await page.evaluate(() => {
    const jg = window.SP.jogo.jogador;
    jg.vidaMax = 1e6; jg.vida = 1e6; jg.escudoMax = 1e6; jg.escudo = 1e6;
    window.SP.avancar(30);
  });
  const povoado = await page.evaluate(() => {
    const j = window.SP.jogo;
    return {
      inimigos: j.inimigos.length,
      tipos: [...new Set(j.inimigos.map((e) => e.tipo))].sort(),
      vivo: !j.jogador.morto,
      nan: [j.jogador.x, j.jogador.y, j.jogador.vx, j.jogador.vy].some((v) => !Number.isFinite(v))
        || j.inimigos.some((e) => !Number.isFinite(e.x) || !Number.isFinite(e.y)),
      dentro: j.jogador.x > 0 && j.jogador.y > 0
        && j.jogador.x < j.mundo.largura && j.jogador.y < j.mundo.altura,
      dentroDeParede: j.mundo.solidoMundo(j.jogador.x, j.jogador.y),
    };
  });
  if (povoado.nan) falha('NaN na simulacao');
  else ok('simulacao: 30 s sem NaN');
  if (!povoado.dentro) falha('jogador saiu dos limites do vale');
  if (povoado.dentroDeParede) falha('jogador terminou dentro de rocha solida');
  else ok('colisao: jogador fora das paredes');
  if (!povoado.vivo) falha('o jogador morreu com vida de teste — algo ignora o escudo/vida');
  if (povoado.inimigos < 3) falha(`diretor nao povoou o vale: ${povoado.inimigos} inimigos`);
  else ok(`diretor: ${povoado.inimigos} inimigos vivos (${povoado.tipos.join(', ')})`);

  // --- ciclo real do objetivo: ninho -> nucleo -> nave -------------------
  const ninho = await page.evaluate(() => {
    const j = window.SP.jogo;
    const n = j.ninhos[0];
    j.jogador.x = n.x - 240; j.jogador.y = n.y;
    const antes = n.vida;
    // Tiros de verdade, pra exercitar colisao de projetil contra o ninho.
    for (let k = 0; k < 400 && !n.destruido; k++) {
      j.projeteis.criar({
        x: j.jogador.x, y: j.jogador.y, vx: 1400, vy: 0,
        dano: 40, dono: 'jogador', raio: 3, cor: '#fff', alcance: 900,
      });
      window.SP.avancar(1 / 30);
    }
    const nucleo = j.itens.lista.find((it) => it.tipo === 'nucleo');
    return { antes, vida: n.vida, destruido: n.destruido, nucleo: !!nucleo };
  });
  if (!ninho.destruido) falha(`ninho nao caiu sob fogo (vida ${ninho.vida.toFixed(0)}/${ninho.antes})`);
  else if (!ninho.nucleo) falha('ninho destruido mas nao largou o nucleo');
  else ok('ninho: destruido a tiro e nucleo liberado');

  const pegou = await page.evaluate(() => {
    const j = window.SP.jogo;
    const it = j.itens.lista.find((i) => i.tipo === 'nucleo');
    j.jogador.x = it.x; j.jogador.y = it.y;
    window.SP.avancar(0.6);
    const carregando = j.jogador.carregando;
    j.jogador.x = j.nave.x + 30; j.jogador.y = j.nave.y;
    window.SP.avancar(0.3);
    return { carregando, entregues: j.nucleosEntregues, largou: !j.jogador.carregando };
  });
  if (!pegou.carregando) falha('o nucleo no chao nao foi recolhido ao encostar');
  else if (pegou.entregues !== 1 || !pegou.largou) falha(`entrega na nave falhou: ${JSON.stringify(pegou)}`);
  else ok('objetivo: nucleo carregado ate a nave e instalado no reator');

  // --- fluxo da missao: entrega dos 3 nucleos e cerco -------------------
  const missao = await page.evaluate(async () => {
    const j = window.SP.jogo;
    const log = [];
    while (j.nucleosEntregues < 3) {
      j.jogador.carregando = true;
      j.jogador.x = j.nave.x + 40;
      j.jogador.y = j.nave.y;
      window.SP.avancar(0.2);
      log.push(j.nucleosEntregues);
      if (log.length > 5) break;
    }
    return { entregues: j.nucleosEntregues, cerco: j.cerco.ativo, log };
  });
  if (missao.entregues !== 3 || !missao.cerco) falha(`missao travou: ${JSON.stringify(missao)}`);
  else ok('missao: 3 nucleos entregues e cerco iniciado');

  await page.evaluate(() => window.SP.avancar(20));
  const noCerco = await page.evaluate(() => {
    const j = window.SP.jogo;
    return {
      inimigos: j.inimigos.length,
      rainha: j.inimigos.some((e) => e.chefe),
      restante: j.cerco.t,
      vivo: !j.jogador.morto,
    };
  });
  if (!noCerco.rainha) falha('a rainha nao apareceu no cerco');
  else ok(`cerco: ${noCerco.inimigos} inimigos e a rainha em campo (${noCerco.restante.toFixed(0)} s restantes)`);
  await foto('cerco');

  // --- vitoria ----------------------------------------------------------
  const fim = await page.evaluate(() => {
    const j = window.SP.jogo;
    for (let i = 0; i < 60 * 130 && j.estado === 'jogando'; i++) {
      j.jogador.x = j.nave.x; j.jogador.y = j.nave.y;
      j.passo(1 / 60);
    }
    return { estado: j.estado, tempo: j.tempo };
  });
  if (fim.estado !== 'vitoria') falha(`o cerco nao terminou em vitoria: estado=${fim.estado}`);
  else ok(`vitoria: fuga concluida em ${fim.tempo.toFixed(0)} s de jogo`);
  await foto('vitoria');

  // --- morte e reinicio -------------------------------------------------
  const reinicio = await page.evaluate(() => {
    const j = window.SP.jogo;
    window.SP.iniciar('smoke-2');
    window.SP.avancar(3.2);
    j.danificarJogador(99999, 'contato');
    window.SP.avancar(1.5);
    const morto = j.estado;
    j.novaPartida('smoke-3');
    window.SP.avancar(3.2);
    return { morto, depois: j.estado, seed: j.mapa.seed, vida: j.jogador.vida };
  });
  if (reinicio.morto !== 'morto') falha(`dano fatal nao levou a tela de morte: ${reinicio.morto}`);
  else if (reinicio.depois !== 'jogando' || reinicio.vida <= 0) falha(`reinicio quebrado: ${JSON.stringify(reinicio)}`);
  else ok('ciclo: morte -> nova partida com outra semente');

  // --- desempenho -------------------------------------------------------
  await wait(1500);
  const perf = await page.evaluate(() => ({
    fps: window.SP.loop.stats.fps,
    sim: window.SP.loop.stats.simMs,
    render: window.SP.loop.stats.renderMs,
  }));
  console.log(`    perf (swiftshader): fps=${perf.fps.toFixed(0)} sim=${perf.sim.toFixed(2)}ms render=${perf.render.toFixed(2)}ms`);
  if (perf.fps < 20) falha(`fps baixo demais ate pra software rendering: ${perf.fps.toFixed(0)}`);

  if (erros.length) {
    falha(`${erros.length} erro(s) de console/pagina:`);
    for (const e of erros.slice(0, 12)) console.error(`       ${e}`);
  } else ok('console limpo');

  await browser.close();
} catch (e) {
  falha(`excecao no smoke: ${e.stack || e.message}`);
} finally {
  try { server.kill('SIGKILL'); } catch { /* ja morreu */ }
}

console.log(saida === 0 ? '\nSMOKE OK' : '\nSMOKE FALHOU');
process.exit(saida);
