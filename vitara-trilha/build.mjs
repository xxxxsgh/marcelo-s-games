// build.mjs — monta o index.html autocontido a partir de source/ (node build.mjs [--min])
import fs from 'fs';
import { execSync } from 'child_process';
const order = ['math.js', 'world.js', 'physics.js', 'input.js', 'game.js', 'gpu.js', 'sh_common.js', 'sh_bake.js', 'sh_scene.js', 'sh_post.js', 'sh_fwd.js', 'sh_car.js', 'render.js', 'meshes.js', 'car.js', 'scene.js', 'hud.js', 'main.js'];
const dir = new URL('./source/', import.meta.url);
let js = order.filter((f) => fs.existsSync(new URL(f, dir))).map((f) => `// ---- ${f} ----\n` + fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
js = `(() => {\n"use strict";\n${js}\n})();`;
if (process.argv.includes('--min')) {
  fs.writeFileSync('/tmp/_vt_bundle.js', js);
  js = execSync('npx --yes esbuild /tmp/_vt_bundle.js --minify --target=es2022', { maxBuffer: 1 << 28 }).toString();
}
const html = `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8"><title>Trilha da Serra — Grand Vitara 4x4</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui,sans-serif}
#c{position:absolute;inset:0;margin:auto;width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;display:block}
#load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:20px;letter-spacing:.08em;background:#0b0d0c}
#pause{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;color:#fff;background:rgba(0,0,0,.45);font-size:42px;letter-spacing:.2em}
#pause small{font-size:15px;letter-spacing:.05em;margin-top:18px;opacity:.85;line-height:1.7;text-align:center}</style></head>
<body><canvas id="c"></canvas>
<div id="pause">PAUSA<small>Gamepad: RT acelera · LT freia/ré · analógico esq. esterça · analógico dir. câmera · A freio de mão · Y câmera · B volta à trilha · Start pausa<br>Teclado: W acelera · S freia/ré · A/D esterçam · Espaço freio de mão · C câmera · R volta à trilha · Esc pausa</small></div>
<div id="load">CARREGANDO A TRILHA…</div>
<script>
${js}
</script></body></html>`;
fs.writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
