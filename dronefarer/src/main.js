/**
 * DRONEFARER — ponto de entrada.
 * FASE 0: renderer + cena vazia com grid + FPS, loop de timestep fixo.
 */
import * as THREE from 'three';
import { createLoop } from './core/loop.js';
import { createQuality } from './core/quality.js';
import { createBus } from './core/bus.js';
import { CAMERA, QUALITY } from './config.js';

const app = document.getElementById('app');
const bus = createBus();
const quality = createQuality();
const settings = quality.settings;

// --- renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: settings.antialias === 'none',
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.renderScale);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = QUALITY.exposure;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// --- cena ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);

const camera = new THREE.PerspectiveCamera(
  CAMERA.chase.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far,
);
camera.position.set(0, 6, 14);
camera.lookAt(0, 1, 0);

const grid = new THREE.GridHelper(200, 100, 0x2a4a6a, 0x152436);
scene.add(grid);
scene.add(new THREE.AmbientLight(0x8fb4e0, 0.9));

// --- overlay de FPS ---
const fpsEl = document.createElement('div');
fpsEl.style.cssText = `position:fixed;top:10px;left:12px;font:11px ui-monospace,monospace;
  color:#37d5ff;letter-spacing:.1em;pointer-events:none;text-shadow:0 1px 3px #000;z-index:20`;
document.body.appendChild(fpsEl);

// --- resize ---
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * quality.settings.renderScale);
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// --- loop ---
const loop = createLoop({
  fixed: () => {},
  render: () => {
    renderer.render(scene, camera);
    fpsEl.textContent =
      `${loop.stats.fps.toFixed(0)} FPS  ·  ${loop.stats.frameMs.toFixed(1)}ms  ·  TIER ${quality.tier.toUpperCase()}`;
  },
});
loop.start();

// --- some com a tela de boot ---
const boot = document.getElementById('boot');
if (boot) {
  document.getElementById('boot-bar').style.width = '100%';
  document.getElementById('boot-pct').textContent = '100%';
  boot.style.opacity = '0';
  setTimeout(() => boot.remove(), 500);
}

console.info('[DRONEFARER] tier', quality.detected);
window.DF = { scene, camera, renderer, loop, quality, bus, THREE };
