/**
 * Pipeline de render. Tudo escalonavel por tier — no tier minimo o composer
 * some inteiro e o renderer desenha direto na tela (caminho mais rapido).
 *
 * Ordem: cena -> GTAO -> bloom (HDR) -> grade/motion blur -> SMAA -> output
 * O tone mapping ACES mora no OutputPass, entao o bloom trabalha em HDR, que
 * e onde ele tem que trabalhar pra nao virar borrao leitoso.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GradeShader } from './gradeShader.js';
import { QUALITY } from '../config.js';
import { clamp01, damp } from '../core/mathx.js';

const _proj = new THREE.Vector3();

export function createPipeline(renderer, scene, camera, settings) {
  let composer = null;
  let bloomPass = null, gtaoPass = null, gradePass = null, smaaPass = null, fxaaPass = null;
  let enabled = true;

  const size = new THREE.Vector2();
  renderer.getSize(size);

  function build(s) {
    if (composer) composer.dispose();
    composer = null;
    bloomPass = gtaoPass = gradePass = smaaPass = fxaaPass = null;

    // Tier minimo: sem composer. Render direto = caminho mais barato possivel.
    const wantsFx = s.bloom || s.ssao || s.motionBlur || s.antialias !== 'none';
    if (!wantsFx) { enabled = false; return; }
    enabled = true;

    const w = size.x, h = size.y;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));

    if (s.ssao) {
      try {
        gtaoPass = new GTAOPass(scene, camera, w, h);
        gtaoPass.output = GTAOPass.OUTPUT.Default;
        if (typeof gtaoPass.updateGtaoMaterial === 'function') {
          gtaoPass.updateGtaoMaterial({
            radius: s.ssaoRadius, distanceExponent: 1.2, thickness: 1.0,
            scale: 1.0, samples: 16, screenSpaceRadius: false,
          });
        }
        gtaoPass.blendIntensity = 0.85;
        composer.addPass(gtaoPass);
      } catch (e) {
        console.warn('[pipeline] GTAO indisponivel, seguindo sem SSAO:', e.message);
        gtaoPass = null;
      }
    }

    if (s.bloom) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h), s.bloomStrength, s.bloomRadius, s.bloomThreshold,
      );
      composer.addPass(bloomPass);
    }

    // Sempre presente quando ha composer: e o grade + motion blur + lente.
    gradePass = new ShaderPass(GradeShader);
    composer.addPass(gradePass);

    if (s.antialias === 'smaa') {
      smaaPass = new SMAAPass();
      if (typeof smaaPass.setSize === 'function') smaaPass.setSize(w, h);
      composer.addPass(smaaPass);
    } else if (s.antialias === 'fxaa') {
      fxaaPass = new ShaderPass(FXAAShader);
      const pr = renderer.getPixelRatio();
      fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      composer.addPass(fxaaPass);
    }

    const output = new OutputPass();
    composer.addPass(output);
  }

  build(settings);

  const blurState = { strength: 0 };

  function setSize(w, h) {
    size.set(w, h);
    if (!composer) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    if (gtaoPass?.setSize) gtaoPass.setSize(w, h);
    if (smaaPass?.setSize) smaaPass.setSize(w, h);
    if (bloomPass?.setSize) bloomPass.setSize(w, h);
    if (fxaaPass) {
      const pr = renderer.getPixelRatio();
      fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    }
  }

  /**
   * @param ctx {speed, maxSpeed, velocity, distortion, damage, signal, elapsed}
   */
  function render(dt, ctx = {}) {
    if (!enabled || !composer) { renderer.render(scene, camera); return; }

    if (gradePass) {
      const u = gradePass.uniforms;
      const s = settings;
      // --- motion blur pela velocidade, centrado na direcao do voo ---
      let target = 0;
      if (s.motionBlur && ctx.speed > 6) {
        target = clamp01((ctx.speed - 6) / 34) * s.motionBlurStrength;
      }
      blurState.strength = damp(blurState.strength, target, 5.5, dt);
      u.uBlurStrength.value = blurState.strength;

      if (ctx.velocity && ctx.speed > 1) {
        // Projeta pra onde o drone esta indo: o blur foge desse ponto.
        _proj.copy(ctx.velocity).normalize().multiplyScalar(60).add(camera.position);
        _proj.project(camera);
        u.uBlurCenter.value[0] = clamp01(_proj.x * 0.5 + 0.5);
        u.uBlurCenter.value[1] = clamp01(_proj.y * 0.5 + 0.5);
      } else {
        u.uBlurCenter.value[0] = 0.5; u.uBlurCenter.value[1] = 0.5;
      }

      u.uDistortion.value = ctx.distortion || 0;
      u.uDamage.value = ctx.damage || 0;
      u.uSignal.value = ctx.signal === undefined ? 1 : ctx.signal;
      u.uTime.value = ctx.elapsed || 0;
    }

    composer.render(dt);
  }

  function applySettings(s) {
    Object.assign(settings, s);
    build(settings);
    setSize(size.x, size.y);
  }

  return {
    render, setSize, applySettings,
    get enabled() { return enabled; },
    get passes() { return { bloomPass, gtaoPass, gradePass, smaaPass, fxaaPass }; },
    setBloom(strength) { if (bloomPass) bloomPass.strength = strength; },
    setExposure(v) { renderer.toneMappingExposure = QUALITY.exposure * v; },
    dispose() { composer?.dispose(); },
  };
}
