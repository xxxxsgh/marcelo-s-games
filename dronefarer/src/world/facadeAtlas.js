/**
 * Atlas de fachadas + material instanciado.
 *
 * O problema central da cidade aberta: milhares de predios, cada um com altura
 * e fachada diferentes, sem virar milhares de draw calls.
 *
 * Solucao: UM atlas (variantes empilhadas na vertical) e UMA InstancedMesh de
 * caixas. Cada instancia carrega tres atributos:
 *   aVariant  — qual faixa do atlas usar
 *   aFloors   — quantos andares repetir na vertical
 *   aTilesX   — quantas repeticoes na horizontal
 * O shader remonta a UV a partir disso. Sem essa remontagem, escalar a caixa
 * ESTICARIA a textura e todo predio alto viraria um borrao de janela gigante.
 */
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

const VARIANTS = 8;          // faixas no atlas
const TILE = 256;            // px por faixa

/** Desenha uma faixa: um andar de fachada, tileavel na horizontal. */
function drawFloor(ctx, y, variant, rng) {
  // [parede, vidro, caixilho] — uma paleta por faixa do atlas
  const palettes = [
    ['#8d8577', '#2b3d52', '#43474b'],   // 0 concreto bege
    ['#9aa0a4', '#1d2c3c', '#3a3f45'],   // 1 concreto cinza
    ['#6f7a82', '#16222e', '#2f363c'],   // 2 vidro escuro (centro)
    ['#a8a094', '#2d4256', '#4b4f54'],   // 3 reboco claro
    ['#7d6a58', '#22303f', '#3d3a36'],   // 4 tijolo antigo
    ['#5c6672', '#0f1a24', '#2a3038'],   // 5 torre corporativa
    ['#9c9384', '#33485e', '#4a4740'],   // 6 reboco sujo
    ['#8a7b6a', '#26323f', '#403c37'],   // 7 popular
  ];
  const [wall, glass, frame] = palettes[variant % palettes.length];

  ctx.fillStyle = wall;
  ctx.fillRect(0, y, TILE, TILE);

  // grao da parede
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng.next() * 0.05})`;
    ctx.fillRect(rng.next() * TILE, y + rng.next() * TILE, 2, 2);
  }

  // faixa de piso (laje entre andares) — da leitura de escala
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(0, y + TILE - 12, TILE, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, y + TILE - 20, TILE, 6);

  // janelas
  const cols = 3 + (variant % 3);
  const cw = TILE / cols;
  const ww = cw * 0.6, wh = TILE * 0.46;
  for (let c = 0; c < cols; c++) {
    const x = c * cw + (cw - ww) / 2;
    const wy = y + TILE * 0.24;
    const g = ctx.createLinearGradient(x, wy, x, wy + wh);
    g.addColorStop(0, glass);
    g.addColorStop(0.6, '#0d151f');
    g.addColorStop(1, glass);
    ctx.fillStyle = g;
    ctx.fillRect(x, wy, ww, wh);
    ctx.strokeStyle = frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, wy, ww, wh);
    // peitoril
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x - 3, wy + wh, ww + 6, 5);
  }

  // sujeira escorrida — predio limpo demais parece maquete
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(40,34,26,${0.05 + rng.next() * 0.09})`;
    ctx.fillRect(rng.next() * TILE, y + rng.next() * TILE * 0.5,
      2 + rng.next() * 6, 30 + rng.next() * 90);
  }
}

/** Atlas com as janelas acesas (usado como emissive a noite). */
function drawLit(ctx, y, variant, rng) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, y, TILE, TILE);
  const cols = 3 + (variant % 3);
  const cw = TILE / cols;
  const ww = cw * 0.6, wh = TILE * 0.46;
  for (let c = 0; c < cols; c++) {
    if (rng.next() > 0.45) continue;
    const x = c * cw + (cw - ww) / 2;
    ctx.fillStyle = rng.bool(0.72) ? '#ffcf8a' : '#bfe0ff';
    ctx.globalAlpha = 0.55 + rng.next() * 0.45;
    ctx.fillRect(x, y + TILE * 0.24, ww, wh);
    ctx.globalAlpha = 1;
  }
}

let cached = null;

export function facadeAtlas() {
  if (cached) return cached;
  const rng = createRng('atlas');
  const c = document.createElement('canvas');
  c.width = TILE; c.height = TILE * VARIANTS;
  const ctx = c.getContext('2d');
  const lc = document.createElement('canvas');
  lc.width = TILE; lc.height = TILE * VARIANTS;
  const lctx = lc.getContext('2d');

  for (let v = 0; v < VARIANTS; v++) {
    drawFloor(ctx, v * TILE, v, rng);
    drawLit(lctx, v * TILE, v, rng);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;   // tiling e feito no shader
  map.anisotropy = 4;

  const lit = new THREE.CanvasTexture(lc);
  lit.colorSpace = THREE.SRGBColorSpace;
  lit.wrapS = lit.wrapT = THREE.ClampToEdgeWrapping;

  cached = { map, lit, variants: VARIANTS };
  return cached;
}

/**
 * Material instanciado que remonta a UV por instancia.
 * O `onBeforeCompile` e o unico jeito de fazer isso sem escrever um
 * MeshStandardMaterial inteiro do zero.
 */
export function createFacadeMaterial(envMap) {
  const atlas = facadeAtlas();
  const mat = new THREE.MeshStandardMaterial({
    map: atlas.map,
    emissiveMap: atlas.lit,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.82,
    metalness: 0.05,
    envMap,
    envMapIntensity: 0.8,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uVariants = { value: atlas.variants };

    shader.vertexShader = `
      attribute float aVariant;
      attribute float aFloors;
      attribute float aTilesX;
      varying float vVariant;
      varying float vFloors;
      varying float vTilesX;
      varying vec3 vLocalNormal;
    ` + shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
       vVariant = aVariant;
       vFloors  = aFloors;
       vTilesX  = aTilesX;
       vLocalNormal = normal;`,
    );

    shader.fragmentShader = `
      uniform float uVariants;
      varying float vVariant;
      varying float vFloors;
      varying float vTilesX;
      varying vec3 vLocalNormal;

      /**
       * Amostra o atlas remontando a UV: tile horizontal por largura, tile
       * vertical por andar, deslocado pra faixa da variante.
       *
       * Usa textureGrad com as derivadas da coordenada CONTINUA. Isto nao e
       * detalhe: com fract() a coordenada da um salto de 1.0 na costura de
       * cada tile, o GPU le uma derivada enorme, escolhe o mip mais baixo e a
       * fachada inteira vira ruido cintilante a distancia. Passar o gradiente
       * na mao e o que mantem o mipmap correto.
       */
      vec4 dfAtlasSample(sampler2D tex, vec2 uv) {
        // topo e base do predio nao levam fachada — usa um pixel neutro
        float side = step(0.5, 1.0 - abs(vLocalNormal.y));

        vec2 cont = vec2(uv.x * max(vTilesX, 1.0), uv.y * max(vFloors, 1.0));
        vec2 dCdx = dFdx(cont);
        vec2 dCdy = dFdy(cont);

        // inset evita puxar o pixel da faixa vizinha do atlas
        float rowY = (vVariant + 0.004 + fract(cont.y) * 0.992) / uVariants;
        vec2 atlasUv = vec2(fract(cont.x), rowY);

        // o gradiente vertical encolhe junto com a faixa
        float k = 0.992 / uVariants;
        vec2 gx = vec2(dCdx.x, dCdx.y * k);
        vec2 gy = vec2(dCdy.x, dCdy.y * k);

        // NAO usar 'flat' como nome: e qualificador reservado no GLSL ES 3.00.
        vec4 wall = textureGrad(tex, atlasUv, gx, gy);
        vec4 capColor = textureGrad(tex, vec2(0.5, (vVariant + 0.5) / uVariants), gx, gy);
        return mix(capColor, wall, side);
      }
    ` + shader.fragmentShader
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          diffuseColor *= dfAtlasSample( map, vMapUv );
        #endif
      `)
      .replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP
          totalEmissiveRadiance *= dfAtlasSample( emissiveMap, vEmissiveMapUv ).rgb;
        #endif
      `);
  };
  // Sem isto o three reaproveita o programa de outro material com o mesmo perfil
  // e o patch nao entra.
  mat.customProgramCacheKey = () => 'df-facade-instanced';
  return mat;
}

/** Anexa os atributos por instancia numa InstancedMesh de caixas. */
export function attachFacadeAttributes(mesh, variants, floors, tilesX) {
  mesh.geometry.setAttribute('aVariant',
    new THREE.InstancedBufferAttribute(new Float32Array(variants), 1));
  mesh.geometry.setAttribute('aFloors',
    new THREE.InstancedBufferAttribute(new Float32Array(floors), 1));
  mesh.geometry.setAttribute('aTilesX',
    new THREE.InstancedBufferAttribute(new Float32Array(tilesX), 1));
}
