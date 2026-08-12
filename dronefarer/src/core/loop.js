/**
 * Loop de jogo com timestep FIXO de fisica e render desacoplado.
 * A fisica sempre roda em passos de 1/fixedHz. O render roda na taxa que a
 * maquina der (sem cap). `alpha` permite interpolar o estado no render.
 */
import { GAME } from '../config.js';

export function createLoop({ fixed, render, hz = GAME.fixedHz, maxSubSteps = GAME.maxSubSteps }) {
  const step = 1 / hz;
  let running = false;
  let last = 0;
  let acc = 0;
  let rafId = 0;

  // Estatisticas expostas pro painel de debug (F3) e HUD de FPS.
  const stats = {
    fps: 0, frameMs: 0, physMs: 0, renderMs: 0,
    steps: 0, frames: 0, alpha: 0, elapsed: 0,
  };
  let fpsAccum = 0, fpsFrames = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    const t0 = now;
    let dt = (now - last) / 1000;
    last = now;

    // Clamp: aba em background / breakpoint nao deve gerar 400 substeps.
    if (!Number.isFinite(dt) || dt < 0) dt = step;
    if (dt > 0.25) dt = 0.25;

    stats.frameMs = dt * 1000;
    stats.elapsed += dt;
    acc += dt;

    // --- fisica em passos fixos ---
    const pStart = performance.now();
    let steps = 0;
    while (acc >= step && steps < maxSubSteps) {
      fixed(step, stats.elapsed);
      acc -= step;
      steps++;
    }
    // Se estourou o teto, descarta o resto pra nao entrar em espiral da morte.
    if (steps >= maxSubSteps) acc = 0;
    stats.steps = steps;
    stats.physMs = performance.now() - pStart;

    // --- render com o resto interpolavel ---
    stats.alpha = acc / step;
    const rStart = performance.now();
    render(dt, stats.alpha, stats.elapsed);
    stats.renderMs = performance.now() - rStart;

    // --- fps medio em janela de 0.5s ---
    fpsAccum += dt; fpsFrames++;
    if (fpsAccum >= 0.5) {
      stats.fps = fpsFrames / fpsAccum;
      fpsAccum = 0; fpsFrames = 0;
    }
    stats.frames++;
    void t0;
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
