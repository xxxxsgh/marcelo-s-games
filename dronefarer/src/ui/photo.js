/**
 * Photo mode e killcam.
 *
 * Photo mode: pausa, camera livre, DOF de verdade e PNG na resolucao de
 * render. Usa um composer PROPRIO (RenderPass + Bokeh + Output) em vez de
 * enfiar um passe no pipeline do jogo — o modo esta pausado, entao pode custar
 * caro sem prejudicar ninguem, e o pipeline principal fica intocado.
 *
 * Killcam: buffer circular de 8 s da transformacao do drone. No crash, a
 * camera orbita o ponto do impacto reproduzindo o trecho.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { damp } from '../core/mathx.js';

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function createPhotoMode(renderer, scene, camera, input, hud) {
  const cam = camera.clone();
  let composer = null;
  let bokeh = null;
  let active = false;
  const params = { focus: 24, aperture: 0.0022, maxblur: 0.012, speed: 14 };

  const ui = document.createElement('div');
  ui.style.cssText = `position:fixed; left:50%; bottom:22px; transform:translateX(-50%);
    z-index:55; display:none; font:11px ui-monospace,monospace; color:#dff0ff;
    background:rgba(4,8,14,.72); padding:10px 18px; letter-spacing:.14em;
    border:1px solid rgba(120,170,220,.22); text-align:center;`;
  document.body.appendChild(ui);

  function build() {
    const size = renderer.getSize(new THREE.Vector2());
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, cam));
    bokeh = new BokehPass(scene, cam, {
      focus: params.focus, aperture: params.aperture, maxblur: params.maxblur,
    });
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
  }

  function refreshUi() {
    ui.innerHTML = `PHOTO MODE · WASD move · setas sobe/desce · mouse olha<br>`
      + `FOCO ${params.focus.toFixed(0)} m ( [ ] )  ·  ABERTURA `
      + `${(params.aperture * 1000).toFixed(1)} ( ; ' )  ·  ENTER SALVA PNG  ·  P SAI`;
  }

  function enter() {
    active = true;
    cam.copy(camera);
    if (!composer) build();
    ui.style.display = '';
    hud.setVisible(false);
    refreshUi();
  }

  function exit() {
    active = false;
    ui.style.display = 'none';
    hud.setVisible(true);
  }

  /** Salva PNG lendo o render target — nao exige preserveDrawingBuffer. */
  function savePng() {
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const w = Math.floor(size.x * pr), h = Math.floor(size.y * pr);
    const rt = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace });
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const buf = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    renderer.setRenderTarget(prev);

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx2d = c.getContext('2d');
    const img = ctx2d.createImageData(w, h);
    // WebGL entrega a imagem de baixo pra cima
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4;
      img.data.set(buf.subarray(src, src + w * 4), y * w * 4);
    }
    ctx2d.putImageData(img, 0, 0);
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dronefarer-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });
    rt.dispose();
  }

  function onKey(e) {
    if (!active) return;
    if (e.code === 'BracketLeft') { params.focus = Math.max(1, params.focus - 2); }
    if (e.code === 'BracketRight') { params.focus += 2; }
    if (e.code === 'Semicolon') { params.aperture = Math.max(0, params.aperture - 0.0004); }
    if (e.code === 'Quote') { params.aperture += 0.0004; }
    if (e.code === 'Enter') savePng();
    if (['BracketLeft', 'BracketRight', 'Semicolon', 'Quote'].includes(e.code)) {
      if (bokeh) {
        bokeh.materialBokeh.uniforms.focus.value = params.focus;
        bokeh.materialBokeh.uniforms.aperture.value = params.aperture;
      }
      refreshUi();
    }
  }
  window.addEventListener('keydown', onKey);

  function update(dt) {
    if (!active) return;
    // camera livre
    const m = input.consumeMouse();
    if (m.dx || m.dy) {
      cam.rotateY(-m.dx * 0.0022);
      cam.rotateX(-m.dy * 0.0022);
      cam.rotation.z = 0;
    }
    cam.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, _up).normalize();
    const s = params.speed * dt;
    if (input.isHeld('throttleUp')) cam.position.addScaledVector(_fwd, s);
    if (input.isHeld('throttleDown')) cam.position.addScaledVector(_fwd, -s);
    if (input.isHeld('yawLeft')) cam.position.addScaledVector(_right, -s);
    if (input.isHeld('yawRight')) cam.position.addScaledVector(_right, s);
    if (input.isHeld('pitchForward')) cam.position.y += s;
    if (input.isHeld('pitchBack')) cam.position.y -= s;
  }

  function render() {
    if (!composer) build();
    composer.render();
  }

  function setSize(w, h) {
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    composer?.setSize(w, h);
  }

  return {
    get active() { return active; }, enter, exit, update, render, setSize, savePng, params,
    toggle() { if (active) exit(); else enter(); return active; },
    dispose() { window.removeEventListener('keydown', onKey); ui.remove(); composer?.dispose(); },
  };
}

/**
 * Killcam de 8 segundos. Grava a transformacao do drone num buffer circular e,
 * no crash, reproduz orbitando o impacto.
 */
export function createKillcam(camera, drone, bus) {
  const DURATION = 8;
  const RATE = 30;
  const MAX = DURATION * RATE;
  const buf = new Float32Array(MAX * 7);
  let head = 0, filled = 0, acc = 0;

  let playing = false;
  let playT = 0;
  const center = new THREE.Vector3();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  function record(dt) {
    if (playing) return;
    acc += dt;
    if (acc < 1 / RATE) return;
    acc = 0;
    const st = drone.state;
    const o = head * 7;
    buf[o] = st.pos.x; buf[o + 1] = st.pos.y; buf[o + 2] = st.pos.z;
    buf[o + 3] = st.quat.x; buf[o + 4] = st.quat.y;
    buf[o + 5] = st.quat.z; buf[o + 6] = st.quat.w;
    head = (head + 1) % MAX;
    filled = Math.min(MAX, filled + 1);
  }

  bus.on('drone:crash', ({ position }) => {
    if (filled < RATE) return;      // menos de 1 s gravado: nao vale replay
    playing = true;
    playT = 0;
    center.copy(position);
  });

  /** @returns true enquanto o killcam esta no comando da camera */
  function update(dt, ghostMesh) {
    if (!playing) { record(dt); return false; }
    playT += dt;
    const total = filled / RATE;
    const t = Math.min(playT, total);
    const idx = Math.floor((filled - 1) * (t / total));
    const src = ((head - filled + idx) % MAX + MAX) % MAX;
    const o = src * 7;
    _p.set(buf[o], buf[o + 1], buf[o + 2]);
    _q.set(buf[o + 3], buf[o + 4], buf[o + 5], buf[o + 6]);

    if (ghostMesh) {
      ghostMesh.visible = true;
      ghostMesh.position.copy(_p);
      ghostMesh.quaternion.copy(_q);
    }

    // orbita lenta em volta do impacto
    const a = playT * 0.55;
    camera.position.set(
      center.x + Math.cos(a) * 9, center.y + 3.4, center.z + Math.sin(a) * 9,
    );
    camera.lookAt(_p);

    if (playT > total + 0.4) {
      playing = false;
      if (ghostMesh) ghostMesh.visible = false;
      bus.emit('killcam:end');
    }
    return true;
  }

  return {
    update,
    get playing() { return playing; },
    skip() { playing = false; },
    reset() { head = 0; filled = 0; playing = false; },
    _damp: damp,
  };
}
