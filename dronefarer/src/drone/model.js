/**
 * Modelo visual do drone. Em 3a pessoa ele fica no centro da tela o tempo
 * inteiro, entao ele e o personagem — vale o detalhe.
 *
 * Detalhes que vendem o modelo:
 *  - helices reais em RPM baixo que CROSSFADE pra disco de blur em RPM alto
 *    (helice geometrica girando rapido vira serrilhado estroboscopico)
 *  - LEDs emissivos que o bloom pega
 *  - balanco secundario do corpo: a casca reage a aceleracao com mola propria
 *  - antena tremendo por inercia
 */
import * as THREE from 'three';
import { damp, clamp01, lerp } from '../core/mathx.js';

/** Textura radial usada como "disco de helice borrada". */
function makePropBlurTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.5);
  g.addColorStop(0.00, 'rgba(180,200,225,0.00)');
  g.addColorStop(0.45, 'rgba(180,200,225,0.10)');
  g.addColorStop(0.82, 'rgba(200,220,245,0.30)');
  g.addColorStop(0.97, 'rgba(220,235,255,0.16)');
  g.addColorStop(1.00, 'rgba(220,235,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Uma pa de helice: perfil afinado e com torcao. */
function makeBladeGeometry(radius) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.012);
  shape.quadraticCurveTo(radius * 0.45, -0.030, radius * 0.92, -0.012);
  shape.quadraticCurveTo(radius * 1.0, 0, radius * 0.92, 0.010);
  shape.quadraticCurveTo(radius * 0.45, 0.026, 0, 0.012);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  return geo;
}

export function createDroneModel(envMap = null) {
  const root = new THREE.Group();
  root.name = 'drone';

  // --- materiais ---
  const carbon = new THREE.MeshStandardMaterial({
    color: 0x14171c, metalness: 0.35, roughness: 0.44, envMap, envMapIntensity: 1.1,
  });
  const anodized = new THREE.MeshStandardMaterial({
    color: 0x2f6ea8, metalness: 0.92, roughness: 0.26, envMap, envMapIntensity: 1.35,
  });
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x9aa4b0, metalness: 1.0, roughness: 0.28, envMap, envMapIntensity: 1.5,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.0, roughness: 0.86 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1420, metalness: 0.0, roughness: 0.06, transmission: 0.0,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMap, envMapIntensity: 2.0,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x1d2229, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide, envMap,
  });
  const blurTex = makePropBlurTexture();
  const blurMat = new THREE.MeshBasicMaterial({
    map: blurTex, transparent: true, opacity: 0, depthWrite: false,
    blending: NormalBlendingSafe(), side: THREE.DoubleSide,
  });
  function NormalBlendingSafe() { return THREE.NormalBlending; }

  // Os LEDs sao emissores HDR: o valor passa de 1.0 de proposito, pra ficarem
  // acima do limiar do bloom (que e alto justamente pra o ceu nao florescer).
  const LED_HDR = 3.4;
  const ledMats = {
    front: new THREE.MeshBasicMaterial({ color: 0x64ffd0 }),
    rear: new THREE.MeshBasicMaterial({ color: 0xff3d5a }),
    strip: new THREE.MeshBasicMaterial({ color: 0x37d5ff }),
  };
  for (const m of Object.values(ledMats)) m.toneMapped = false;

  // ------------------------------------------------------------------
  // shell: tudo que balanca junto (mola secundaria de corpo)
  // ------------------------------------------------------------------
  const shell = new THREE.Group();
  root.add(shell);

  // --- placa inferior e superior (sanduiche de carbono) ---
  const plateGeo = new THREE.BoxGeometry(0.115, 0.004, 0.16);
  const bottom = new THREE.Mesh(plateGeo, carbon);
  bottom.position.y = -0.012;
  const top = new THREE.Mesh(plateGeo.clone().scale(0.92, 1, 0.86), carbon);
  top.position.y = 0.036;
  shell.add(bottom, top);

  // --- bateria (lipo) ---
  const batt = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.030, 0.108), rubber);
  batt.position.y = 0.018;
  shell.add(batt);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.034, 0.014), anodized);
  strap.position.set(0, 0.018, 0.01);
  shell.add(strap);

  // --- braços + motores + helices ---
  const armGeo = new THREE.BoxGeometry(0.135, 0.005, 0.020);
  const rotors = [];
  const ARM = 0.107;                       // distancia do centro ao motor
  const PROP_R = 0.064;                    // helice 5"
  const positions = [
    { x: ARM, z: -ARM, dir: 1, led: 'front' },   // frente direita
    { x: -ARM, z: -ARM, dir: -1, led: 'front' }, // frente esquerda
    { x: ARM, z: ARM, dir: -1, led: 'rear' },    // tras direita
    { x: -ARM, z: ARM, dir: 1, led: 'rear' },    // tras esquerda
  ];
  const bladeGeo = makeBladeGeometry(PROP_R);
  const discGeo = new THREE.CircleGeometry(PROP_R * 1.03, 28);
  discGeo.rotateX(-Math.PI / 2);

  for (const p of positions) {
    // braço apontando pro motor
    const arm = new THREE.Mesh(armGeo, carbon);
    arm.position.set(p.x * 0.5, -0.008, p.z * 0.5);
    arm.rotation.y = Math.atan2(p.x, p.z) + Math.PI / 2;
    shell.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0175, 0.020, 14), motorMat);
    motor.position.set(p.x, 0.004, p.z);
    shell.add(motor);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0155, 0.006, 14), anodized);
    bell.position.set(p.x, 0.017, p.z);
    shell.add(bell);

    // helice geometrica (RPM baixo)
    const prop = new THREE.Group();
    prop.position.set(p.x, 0.022, p.z);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.y = (b / 3) * Math.PI * 2;
      blade.rotation.z = 0.16 * p.dir;      // passo da pa
      prop.add(blade);
    }
    shell.add(prop);

    // disco de blur (RPM alto)
    const disc = new THREE.Mesh(discGeo, blurMat.clone());
    disc.position.copy(prop.position);
    shell.add(disc);

    // LED sob o braço
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), ledMats[p.led]);
    led.position.set(p.x, -0.016, p.z);
    shell.add(led);

    rotors.push({ prop, disc, dir: p.dir, angle: Math.random() * Math.PI * 2, led });
  }

  // --- camera FPV na frente, inclinada pra cima ---
  const camPod = new THREE.Group();
  camPod.position.set(0, 0.026, -0.052);
  camPod.rotation.x = THREE.MathUtils.degToRad(-26);
  const podBody = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.024, 0.024), rubber);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.008, 16), glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.015;
  camPod.add(podBody, lens);
  shell.add(camPod);

  // --- fita de LED lateral ---
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.07), ledMats.strip);
    strip.position.set(sx * 0.056, 0.004, 0.01);
    shell.add(strip);
  }

  // --- antena (treme por inercia) ---
  const antenna = new THREE.Group();
  antenna.position.set(0, 0.030, 0.072);
  const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.052, 6), rubber);
  antRod.position.y = 0.026;
  const antTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.014, 4, 8), anodized);
  antTip.position.y = 0.060;
  antenna.add(antRod, antTip);
  antenna.rotation.x = 0.35;
  shell.add(antenna);

  // --- farol: unica forma de enxergar dentro de garagem e tunel ---
  // Sem sombra de proposito: uma spot com shadow map custa caro e o ganho
  // visual aqui e quase zero.
  const headlight = new THREE.SpotLight(
    0xfff2df, 0, 46, THREE.MathUtils.degToRad(38), 0.5, 1.1,
  );
  headlight.position.set(0, 0.0, -0.05);
  headlight.castShadow = false;
  const hlTarget = new THREE.Object3D();
  hlTarget.position.set(0, -0.4, -8);
  root.add(headlight, hlTarget);
  headlight.target = hlTarget;

  // sombras
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  // ------------------------------------------------------------------
  // animacao
  // ------------------------------------------------------------------
  const sway = { x: 0, z: 0, vx: 0, vz: 0 };
  const antSway = { x: 0, z: 0 };
  let ledPulse = 0;
  let spin = 0;

  /**
   * @param dt        delta de render (nao de fisica)
   * @param st        estado do drone (physics.state)
   * @param prevAccel aceleracao aproximada no espaco do mundo
   */
  function update(dt, st, worldAccel) {
    // --- RPM: hover ja gira bastante; throttle sobe dai ---
    const rpm = clamp01(0.18 + st.motor * 0.82);
    spin += rpm * 340 * dt;

    // crossfade helice geometrica -> disco borrado
    const blurT = clamp01((rpm - 0.26) / 0.30);
    const bladeOpacity = 1 - blurT;

    for (const r of rotors) {
      r.angle += r.dir * rpm * 340 * dt;
      r.prop.rotation.y = r.angle;
      r.prop.visible = bladeOpacity > 0.02;
      r.disc.material.opacity = blurT * 0.9;
      r.disc.visible = blurT > 0.02;
      r.disc.rotation.y = r.angle * 0.3;
    }
    bladeMat.opacity = bladeOpacity;
    bladeMat.transparent = bladeOpacity < 0.99;

    // --- balanco secundario da casca ---
    // A casca persegue o zero com mola; a aceleracao a empurra pro lado.
    if (worldAccel) {
      sway.vx += (-worldAccel.z * 0.0016 - sway.x * 26 - sway.vx * 6.2) * dt;
      sway.vz += (worldAccel.x * 0.0016 - sway.z * 26 - sway.vz * 6.2) * dt;
      sway.x += sway.vx * dt;
      sway.z += sway.vz * dt;
    }
    shell.rotation.x = damp(shell.rotation.x, sway.x, 18, dt);
    shell.rotation.z = damp(shell.rotation.z, sway.z, 18, dt);
    // vibracao fina do motor
    const vib = rpm * 0.0009;
    shell.position.y = Math.sin(spin * 3.1) * vib;

    // --- antena: inercia + arrasto do ar ---
    const drag = clamp01(st.speed / 32);
    antSway.x = damp(antSway.x, 0.35 + drag * 0.55 + Math.sin(spin * 0.9) * 0.03 * rpm, 9, dt);
    antSway.z = damp(antSway.z, Math.sin(spin * 1.31) * 0.05 * rpm + sway.z * 0.6, 9, dt);
    antenna.rotation.x = antSway.x;
    antenna.rotation.z = antSway.z;

    // --- LEDs pulsando ---
    ledPulse += dt * 3.4;
    const pulse = 0.55 + Math.sin(ledPulse) * 0.45;
    ledMats.strip.color.setHSL(0.53, 1.0, 0.35 + pulse * 0.3).multiplyScalar(LED_HDR);
    ledMats.front.color.setRGB(0.25 + pulse * 0.35, 1.0, 0.78).multiplyScalar(LED_HDR);
    ledMats.rear.color.setRGB(1.0, 0.18 + pulse * 0.18, 0.32).multiplyScalar(LED_HDR);

    void lerp;
  }

  function setEnvMap(env) {
    for (const m of [carbon, anodized, motorMat, glass, bladeMat]) {
      m.envMap = env; m.needsUpdate = true;
    }
  }

  /** Versao translucida pro fantasma da Fase 2. */
  function makeGhost(opacity = 0.42) {
    const ghost = root.clone(true);
    ghost.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.material = new THREE.MeshBasicMaterial({
        color: 0x37d5ff, transparent: true, opacity, depthWrite: false,
      });
    });
    return ghost;
  }

  return {
    root, shell, update, setEnvMap, makeGhost, rotors, headlight,
    /** Liga/desliga o farol. Intensidade em unidades de SpotLight. */
    setHeadlight(on) { headlight.intensity = on ? 58 : 0; return headlight.intensity > 0; },
    get headlightOn() { return headlight.intensity > 0; },
  };
}
