/**
 * Ceu, sol e environment map.
 *
 * Isto e o maior ganho visual por unidade de custo do projeto inteiro: o ceu
 * com espalhamento atmosferico e convertido em environment map (PMREM) e vira
 * a iluminacao ambiente de TUDO. E o que faz o metal do drone, o vidro das
 * janelas e o asfalto molhado parecerem reais em vez de plasticos.
 *
 * A sombra usa um frustum ORTO apertado que segue o drone, com snap de texel
 * pra nao cintilar — ver DECISOES.md sobre a escolha em vez de CSM.
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { WORLD, QUALITY } from '../config.js';
import { clamp01, lerp } from '../core/mathx.js';

const _sunDir = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/** Presets de hora do dia. Fim de tarde e o padrao: sol raso, sombra longa. */
export const TIME_PRESETS = {
  amanhecer: { elevation: 6, azimuth: 95, turbidity: 6, rayleigh: 2.4, mie: 0.008, exposure: 0.95,
    sunColor: 0xffb27a, sunIntensity: 2.0, fog: 0xb9c6d6, ambient: 0.16 },
  meiodia: { elevation: 62, azimuth: 170, turbidity: 3.2, rayleigh: 1.1, mie: 0.004, exposure: 1.0,
    sunColor: 0xfff4e2, sunIntensity: 2.6, fog: 0xa9c0d8, ambient: 0.20 },
  tarde: { elevation: 16, azimuth: 248, turbidity: 3.4, rayleigh: 1.9, mie: 0.004, exposure: 0.98,
    sunColor: 0xffb066, sunIntensity: 1.9, fog: 0xd9b393, ambient: 0.15 },
  noite: { elevation: -6, azimuth: 260, turbidity: 9, rayleigh: 0.6, mie: 0.002, exposure: 1.5,
    sunColor: 0x5f7fbf, sunIntensity: 0.30, fog: 0x141c2c, ambient: 0.10 },
};

export function createEnvironment(renderer, scene, settings) {
  // --- ceu ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  sky.name = 'sky';
  scene.add(sky);
  const skyU = sky.material.uniforms;

  // --- luzes ---
  const sun = new THREE.DirectionalLight(0xffffff, 3.0);
  sun.castShadow = settings.shadows;
  sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  const shadowCam = sun.shadow.camera;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xa8c8ff, 0x4a4034, 0.5);
  scene.add(hemi);
  // Luz de preenchimento fria oposta ao sol: tira o preto morto da sombra.
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.35);
  scene.add(fill);

  // --- nevoa ---
  scene.fog = new THREE.FogExp2(WORLD.fogColor, WORLD.fogDensity);

  // --- PMREM: ceu -> environment map ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;

  const state = { preset: 'tarde', elevation: 11, azimuth: 248, envMap: null, sunDir: _sunDir };

  function regenerateEnv() {
    if (envRT) envRT.dispose();
    // Renderiza SO o ceu num alvo PMREM. Chamado apenas quando a hora muda.
    const skyScene = new THREE.Scene();
    const skyClone = new Sky();
    skyClone.scale.setScalar(450000);
    for (const k of Object.keys(skyU)) {
      if (skyClone.material.uniforms[k]) {
        const v = skyU[k].value;
        skyClone.material.uniforms[k].value = v?.clone ? v.clone() : v;
      }
    }
    skyScene.add(skyClone);
    envRT = pmrem.fromScene(skyScene, 0.0, 0.1, 1000);
    state.envMap = envRT.texture;
    scene.environment = state.envMap;
    skyClone.geometry.dispose();
    skyClone.material.dispose();
    return state.envMap;
  }

  function applyPreset(p, blend = 1) {
    skyU.turbidity.value = lerp(skyU.turbidity.value, p.turbidity, blend);
    skyU.rayleigh.value = lerp(skyU.rayleigh.value, p.rayleigh, blend);
    skyU.mieCoefficient.value = lerp(skyU.mieCoefficient.value, p.mie, blend);
    skyU.mieDirectionalG.value = 0.8;

    state.elevation = p.elevation;
    state.azimuth = p.azimuth;
    const phi = THREE.MathUtils.degToRad(90 - p.elevation);
    const theta = THREE.MathUtils.degToRad(p.azimuth);
    _sunDir.setFromSphericalCoords(1, phi, theta);
    skyU.sunPosition.value.copy(_sunDir);

    sun.color.setHex(p.sunColor);
    sun.intensity = p.sunIntensity;
    hemi.intensity = p.ambient;
    fill.intensity = p.ambient * 0.55;
    fill.position.copy(_sunDir).multiplyScalar(-100).setY(60);

    scene.fog.color.setHex(p.fog);
    renderer.toneMappingExposure = QUALITY.exposure * p.exposure;
    regenerateEnv();
  }

  function setTimeOfDay(name) {
    const p = TIME_PRESETS[name] || TIME_PRESETS.tarde;
    state.preset = name;
    applyPreset(p);
    return state.envMap;
  }

  /**
   * Move o frustum de sombra pra acompanhar o drone.
   * Snap de texel: sem isso a sombra "ferve" quando a camera anda.
   */
  let lastSnapX = 0, lastSnapY = 0;
  function updateShadow(target) {
    if (!settings.shadows) return;
    const d = settings.shadowDistance;
    // Frustum apertado ao redor do jogador: qualidade alta com 1 cascata.
    const half = d * 0.5;
    if (shadowCam.right !== half) {
      shadowCam.left = -half; shadowCam.right = half;
      shadowCam.top = half; shadowCam.bottom = -half;
      shadowCam.near = 1; shadowCam.far = d * 2.4;
      shadowCam.updateProjectionMatrix();
    }

    // Quantiza a posicao do alvo no tamanho de um texel do shadow map.
    const texelSize = (half * 2) / settings.shadowMapSize;
    const sx = Math.round(target.x / texelSize) * texelSize;
    const sz = Math.round(target.z / texelSize) * texelSize;
    if (sx !== lastSnapX || sz !== lastSnapY) { lastSnapX = sx; lastSnapY = sz; }

    _tmp.set(sx, target.y, sz);
    sun.target.position.copy(_tmp);
    sun.position.copy(_tmp).addScaledVector(_sunDir, d * 1.15);
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  function applySettings(s) {
    sun.castShadow = s.shadows;
    if (s.shadows) {
      sun.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    scene.fog.density = WORLD.fogDensity;
  }

  setTimeOfDay('tarde');

  return {
    sky, sun, hemi, fill, state,
    get envMap() { return state.envMap; },
    get sunDirection() { return _sunDir; },
    setTimeOfDay, updateShadow, applySettings, regenerateEnv,
    /** Chuva/neblina da Fase 6 mexem aqui. */
    setFog(color, density) {
      scene.fog.color.setHex(color);
      scene.fog.density = density;
    },
    setSunIntensity(v) { sun.intensity = v; },
    dispose() { pmrem.dispose(); envRT?.dispose(); },
    _clamp: clamp01,
  };
}
