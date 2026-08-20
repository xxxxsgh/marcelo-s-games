/**
 * Empacota o jogo num HTML unico, sem servidor e sem asset externo, e so
 * entrega o arquivo depois de prova-lo num Chromium de verdade.
 *
 * Serve pra mandar o jogo por link, anexo ou pendrive: `file://` funciona
 * porque o bundle inteiro entra inline (o build ja e livre de dependencia em
 * runtime, entao nao sobra nada pra buscar na rede).
 *
 *   node tools/arquivo-unico.mjs [saida.html]
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const saida = resolve(process.argv[2] || 'dist/sinal-perdido.html');

console.log('build...');
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'ignore' });

const html = readFileSync('dist/index.html', 'utf-8');
const nomeJs = readdirSync('dist/assets').find((f) => f.endsWith('.js'));
const js = readFileSync(`dist/assets/${nomeJs}`, 'utf-8');
if (js.includes('</script')) throw new Error('o bundle contem "</script" e nao pode ser embutido cru');

const estilo = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const corpo = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[^>]*><\/script>\s*/g, '');
const titulo = html.match(/<title>([\s\S]*?)<\/title>/)[1];

writeFileSync(saida, `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${titulo}</title>
<style>${estilo}</style>
</head>
<body>
${corpo.trim()}
<script type="module">
${js}
</script>
</body>
</html>
`);

console.log(`gerado ${saida} (${(readFileSync(saida).length / 1024).toFixed(0)} KB) — verificando...`);

const erros = [];
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });

await p.goto(`file://${saida}`, { waitUntil: 'load' });
await p.waitForFunction(() => !!window.SP?.jogo?.mundo, null, { timeout: 30000 });
await p.keyboard.press('Enter');
await p.waitForFunction(() => window.SP.jogo.estado === 'jogando', null, { timeout: 30000 });
await p.mouse.move(900, 300);
await p.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 600));
await p.mouse.down();
await new Promise((r) => setTimeout(r, 300));
await p.mouse.up();
await p.keyboard.up('KeyD');
const est = await p.evaluate(() => ({
  estado: window.SP.jogo.estado,
  tiros: window.SP.jogo.jogador.stats.tiros,
  inimigos: window.SP.jogo.inimigos.length,
}));
await p.close();

if (erros.length) { console.error('FALHA:', erros.slice(0, 5).join(' | ')); process.exit(1); }
if (est.estado !== 'jogando' || est.tiros < 1) { console.error('FALHA: o jogo nao respondeu ao teclado/mouse', est); process.exit(1); }
console.log(`OK  roda em file:// sozinho (estado=${est.estado}, tiros=${est.tiros}, inimigos=${est.inimigos})`);

// --- o mesmo arquivo dentro de um iframe -----------------------------------
// E assim que ele e servido num artifact/embed: se a pagina so tivesse
// conteudo `position: fixed`, o quadro mediria zero e o jogador veria preto.
const p2 = await b.newPage({ viewport: { width: 1280, height: 800 } });
p2.on('pageerror', (e) => erros.push(`iframe pageerror: ${e.message}`));
p2.on('console', (m) => { if (m.type() === 'error') erros.push(`iframe console: ${m.text()}`); });
// A pagina de teste tambem precisa ser `file://`: o Chromium recusa carregar
// um iframe file:// dentro de uma pagina de outra origem.
const paginaTeste = saida.replace(/\.html$/, '.embed-teste.html');
writeFileSync(paginaTeste, `<!doctype html><body style="margin:0;background:#333">
  <iframe id="q" src="${saida.split('/').pop()}" style="width:100%;height:0;border:0;display:block"></iframe>
</body>`);
await p2.goto(`file://${paginaTeste}`, { waitUntil: 'load' });
const elQuadro = await p2.waitForSelector('#q', { state: 'attached' });
const f = await elQuadro.contentFrame();
try {
  await f.waitForFunction(() => !!window.SP?.jogo?.mundo, null, { timeout: 15000 });
} catch {
  const diag = await f.evaluate(() => ({
    temSP: !!window.SP, temApp: !!document.getElementById('app'),
    scripts: document.querySelectorAll('script').length,
    pronto: document.readyState,
  })).catch((e) => ({ falhaEval: e.message }));
  console.error('FALHA: o jogo nao subiu dentro do iframe', diag, erros.slice(0, 5));
  process.exit(1);
}

const medir = () => f.evaluate(() => {
  const cv = document.querySelector('canvas');
  const c = cv.getContext('2d');
  const px = c.getImageData(0, 0, cv.width, cv.height).data;
  // quantas amostras diferem do preto de fundo? (prova que algo foi desenhado)
  let pintados = 0, amostras = 0;
  for (let i = 0; i < px.length; i += 4 * 997) {
    amostras++;
    if (px[i] > 20 || px[i + 1] > 16 || px[i + 2] > 26) pintados++;
  }
  return { w: cv.width, h: cv.height, pintados, amostras, alturaDoc: document.documentElement.scrollHeight };
});

const colapsado = await medir();
// o host cresce o quadro depois de medir o conteudo — e o observer tem que reagir
await p2.evaluate(() => { document.getElementById('q').style.height = '640px'; });
await new Promise((r) => setTimeout(r, 700));
const crescido = await medir();
await b.close();

if (erros.length) { console.error('FALHA:', erros.slice(0, 5).join(' | ')); process.exit(1); }
if (colapsado.alturaDoc < 200) {
  console.error(`FALHA: dentro de iframe o conteudo mede ${colapsado.alturaDoc}px de altura — o host colapsaria o quadro`);
  process.exit(1);
}
if (crescido.w < 1000 || crescido.h < 500) {
  console.error('FALHA: o canvas nao acompanhou o quadro ao crescer', crescido);
  process.exit(1);
}
if (crescido.pintados / crescido.amostras < 0.05) {
  console.error('FALHA: o canvas ficou praticamente preto', crescido);
  process.exit(1);
}
console.log(`OK  dentro de iframe (conteudo ${colapsado.alturaDoc}px sem altura dada, canvas ${crescido.w}x${crescido.h}, ${Math.round(crescido.pintados / crescido.amostras * 100)}% dos pixels pintados)`);
