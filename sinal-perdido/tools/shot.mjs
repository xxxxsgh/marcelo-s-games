/**
 * Capturas de tela encenadas — usadas pra revisar a arte sem jogar a partida
 * inteira. Cada cena posiciona o jogador, nasce quem precisa aparecer e tira a
 * foto.
 *
 *   node tools/shot.mjs [nome-da-cena ...]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = 4175;
const URL = `http://127.0.0.1:${PORT}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pedidas = process.argv.slice(2);

// binario direto (nao `npx`): assim o kill no fim mata mesmo o servidor
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview',
  '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => { try { server.kill('SIGKILL'); } catch { /* ja morreu */ } });

const CENAS = {
  titulo: () => {},
  dia: (j) => {
    j.jogador.x = j.nave.x - 200; j.jogador.y = j.nave.y + 60;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.28;
      j.enemies.criar('rastejante', j.jogador.x + Math.cos(a) * 190, j.jogador.y + Math.sin(a) * 190);
    }
    j.enemies.criar('ariete', j.jogador.x + 230, j.jogador.y - 80);
    j.enemies.criar('cuspidor', j.jogador.x - 240, j.jogador.y + 40);
  },
  noite: (j) => {
    j.tempo = 130;                       // empurra o ciclo pra noite
    j.jogador.x = j.nave.x + 320; j.jogador.y = j.nave.y - 240;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28;
      j.enemies.criar(i % 3 ? 'rastejante' : 'enxame', j.jogador.x + Math.cos(a) * 200, j.jogador.y + Math.sin(a) * 200);
    }
  },
  ninho: (j) => {
    const n = j.ninhos[0];
    n.descoberto = true;
    j.jogador.x = n.x - 210; j.jogador.y = n.y + 40;
    j.jogador.arsenal.posse.espingarda = true;
    j.jogador.arsenal.mag.espingarda = 6;
    j.jogador.arsenal.reserva.cartucho = 24;
    j.jogador.arsenal.atual = 'espingarda';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      j.enemies.criar('rastejante', n.x + Math.cos(a) * 120, n.y + Math.sin(a) * 120);
    }
  },
  rainha: (j) => {
    j.jogador.x = j.nave.x - 260; j.jogador.y = j.nave.y;
    j.jogador.arsenal.posse.plasma = true;
    j.jogador.arsenal.mag.plasma = 5;
    j.jogador.arsenal.reserva.celula = 12;
    j.jogador.arsenal.atual = 'plasma';
    j.nucleosEntregues = 3; j.nave.nucleos = 3;
    j.diretor.iniciarCerco();
    const r = j.enemies.criar('rainha', j.jogador.x - 300, j.jogador.y - 60);
    r.estado = 'cacando';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.28;
      j.enemies.criar(i % 2 ? 'rastejante' : 'enxame', j.jogador.x + Math.cos(a) * 260, j.jogador.y + Math.sin(a) * 260);
    }
  },
};

for (let i = 0; i < 40; i++) {
  try { const r = await fetch(URL); if (r.ok) break; } catch { /* subindo */ }
  await wait(250);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
mkdirSync('shots', { recursive: true });

for (const [nome, montar] of Object.entries(CENAS)) {
  if (pedidas.length && !pedidas.includes(nome)) continue;
  await page.goto(`${URL}?seed=vitrine`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.SP?.jogo?.mundo);
  if (nome !== 'titulo') {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.SP.jogo.estado === 'jogando', null, { timeout: 20000 });
    await page.evaluate(`(${montar.toString()})(window.SP.jogo)`);
    await page.evaluate(() => { window.SP.jogo.jogador.vida = window.SP.jogo.jogador.vidaMax; window.SP.avancar(1.2); });
    await page.mouse.move(860, 300);
    await wait(400);
  } else {
    await wait(600);
  }
  await page.screenshot({ path: `shots/${nome}.png` });
  console.log(`shots/${nome}.png`);
}

await browser.close();
server.kill('SIGKILL');
process.exit(0);
