/**
 * Loop com timestep FIXO de simulacao e render desacoplado.
 * Toda a logica de jogo roda em passos de 1/hz — bala, IA e colisao ficam
 * deterministicos e independentes do fps. O render roda no ritmo da maquina.
 */
import { GAME } from '../config.js';

export function createLoop({ fixed, render, hz = GAME.fixedHz, maxSubSteps = GAME.maxSubSteps }) {
  const step = 1 / hz;
  let running = false;
  let last = 0;
  let acc = 0;
  let rafId = 0;

  const stats = {
    fps: 0, frameMs: 0, simMs: 0, renderMs: 0,
    steps: 0, frames: 0, alpha: 0, elapsed: 0,
  };
  let fpsAccum = 0, fpsFrames = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    let dt = (now - last) / 1000;
    last = now;
    // Aba em background ou breakpoint nao pode virar 300 substeps.
    if (!Number.isFinite(dt) || dt < 0) dt = step;
    if (dt > 0.25) dt = 0.25;

    stats.frameMs = dt * 1000;
    stats.elapsed += dt;
    acc += dt;

    const t0 = performance.now();
    let steps = 0;
    while (acc >= step && steps < maxSubSteps) {
      fixed(step, stats.elapsed);
      acc -= step;
      steps++;
    }
    // Estourou o teto: descarta o resto pra nao entrar em espiral da morte.
    if (steps >= maxSubSteps) acc = 0;
    stats.steps = steps;
    stats.simMs = performance.now() - t0;

    stats.alpha = acc / step;
    const t1 = performance.now();
    render(dt, stats.alpha, stats.elapsed);
    stats.renderMs = performance.now() - t1;

    fpsAccum += dt; fpsFrames++;
    if (fpsAccum >= 0.5) {
      stats.fps = fpsFrames / fpsAccum;
      fpsAccum = 0; fpsFrames = 0;
    }
    stats.frames++;
  }

  return {
    stats,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() { return running; },
  };
}
