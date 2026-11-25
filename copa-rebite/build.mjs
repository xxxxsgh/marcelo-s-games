// monta index.html autocontido a partir de source/
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url)), src = join(dir, 'source');
const js = readdirSync(src).filter(f => /^\d\d_.*\.js$/.test(f)).sort().map(f => `// ==== ${f} ====\n` + readFileSync(join(src, f), 'utf8')).join('\n');
const css = readFileSync(join(src, 'ui.css'), 'utf8'), shell = readFileSync(join(src, 'shell.html'), 'utf8');
const out = shell.replace('/*CSS*/', () => css).replace('/*JS*/', () => js.replace(/<\/script/g, '<\\/script'));
writeFileSync(join(dir, 'index.html'), out);
console.log('index.html', (out.length / 1024).toFixed(1) + ' KB (' + Buffer.byteLength(out) + ' bytes)');
