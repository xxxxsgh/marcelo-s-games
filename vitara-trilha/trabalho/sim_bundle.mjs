// monta trabalho/sim.cjs: módulos puros (sem DOM/GPU) para testes no node
import fs from 'fs';
const dir = new URL('../source/', import.meta.url);
const files = ['math.js', 'world.js', 'physics.js', 'input.js', 'game.js'].filter(f => fs.existsSync(new URL(f, dir)));
let src = files.map(f => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
src += '\nmodule.exports = { World, worldInit, farH, clamp, sat, lerp, smooth, mulberry32, noise2, fbm2,' +
  ' Physics: typeof Physics !== "undefined" ? Physics : null, Input: typeof Input !== "undefined" ? Input : null, Game: typeof Game !== "undefined" ? Game : null,' +
  ' SURF_TERRA, SURF_CASCALHO, SURF_LAMA, SURF_AGUA, SURF_GRAMA, SURF_MADEIRA, SURF_PEDRA };\n';
fs.writeFileSync(new URL('./sim.cjs', import.meta.url), src);
