/**
 * Gates de corrida: visual + deteccao de passagem.
 *
 * A deteccao NAO e por proximidade (isso deixa passar por fora e conta, ou
 * falha quando o drone atravessa rapido demais entre dois frames). E por
 * CRUZAMENTO DE PLANO: compara o lado do plano no passo anterior e no atual,
 * acha o ponto exato de interseccao e mede a distancia radial ali. Assim
 * funciona a 60 m/s e exige atravessar de verdade, no sentido certo.
 */
import * as THREE from 'three';
import { RACE } from '../config.js';
import { clamp01 } from '../core/mathx.js';

const _n = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _tmp = new THREE.Vector3();

const COLORS = {
  active: 0x37d5ff,
  next: 0x2a6c8a,
  done: 0x2f7a4a,
  final: 0xffb03a,
};

function makeNumberTexture(n) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param spec {x,y,z, yaw (graus, direcao de passagem), pitch?, radius?}
 * @param index numero do gate (1-based)
 */
export function createGate(spec, index, isFinal = false) {
  const radius = spec.radius || RACE.gateRadius;
  const group = new THREE.Group();
  group.position.set(spec.x, spec.y, spec.z);

  const yaw = THREE.MathUtils.degToRad(spec.yaw || 0);
  const pitch = THREE.MathUtils.degToRad(spec.pitch || 0);
  group.rotation.set(pitch, yaw, 0, 'YXZ');

  // Normal do gate = direcao de passagem (o -Z local, igual ao "frente").
  const normal = new THREE.Vector3(0, 0, -1).applyEuler(group.rotation).normalize();

  // --- anel ---
  const ringGeo = new THREE.TorusGeometry(radius, RACE.gateThickness, 8, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: COLORS.active, emissive: COLORS.active, emissiveIntensity: 2.2,
    metalness: 0.3, roughness: 0.35, transparent: true, opacity: 1,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);

  // --- disco interno (le a "boca" do gate a distancia) ---
  const discMat = new THREE.MeshBasicMaterial({
    color: COLORS.active, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.97, 32), discMat);
  group.add(disc);

  // --- numero ---
  const numMat = new THREE.SpriteMaterial({
    map: makeNumberTexture(index), transparent: true, depthTest: true,
  });
  const num = new THREE.Sprite(numMat);
  num.scale.setScalar(radius * 0.72);
  num.position.y = radius + 1.0;
  group.add(num);

  const gate = {
    index, spec, group, ring, disc, num, normal, radius,
    center: group.position.clone(),
    isFinal,
    passed: false,
    state: 'idle',        // 'idle' | 'active' | 'next' | 'done'
    lastOffset: 0,        // distancia do centro na ultima passagem
    _pulse: Math.random() * 6.28,

    /**
     * Testa se o segmento prev->cur atravessou a boca do gate.
     * Devolve null ou {offset, centered, t}.
     */
    test(prev, cur) {
      const d0 = _tmp.copy(prev).sub(this.center).dot(this.normal);
      const d1 = _n.copy(cur).sub(this.center).dot(this.normal);
      // exige ir do lado de tras (-) pro lado da frente (+): sentido correto
      if (!(d0 <= 0 && d1 > 0)) return null;
      const denom = d1 - d0;
      if (Math.abs(denom) < 1e-9) return null;
      const t = -d0 / denom;                       // fracao do segmento
      _cross.copy(prev).lerp(cur, t);              // ponto exato no plano
      const offset = _cross.distanceTo(this.center);
      if (offset > this.radius) return null;       // passou por fora do anel
      this.lastOffset = offset;
      return {
        offset, t,
        centered: offset <= RACE.gateCenterBonusRadius,
        graze: offset > this.radius - RACE.grazeRadius,
      };
    },

    setState(s) {
      this.state = s;
      const color = s === 'done' ? COLORS.done
        : s === 'active' ? (this.isFinal ? COLORS.final : COLORS.active)
          : COLORS.next;
      ringMat.color.setHex(color);
      ringMat.emissive.setHex(color);
      ringMat.emissiveIntensity = s === 'active' ? 2.4 : s === 'done' ? 0.5 : 0.9;
      ringMat.opacity = s === 'active' ? 1 : s === 'done' ? 0.35 : RACE.nextGateDim + 0.3;
      discMat.color.setHex(color);
      discMat.opacity = s === 'active' ? 0.10 : 0.03;
      numMat.opacity = s === 'active' ? 1 : s === 'done' ? 0.25 : 0.5;
      group.visible = true;
    },

    /** Animacao: o gate ativo pulsa pra puxar o olho. */
    update(dt, cameraPos) {
      this._pulse += dt * 3.0;
      if (this.state === 'active') {
        const p = 0.5 + Math.sin(this._pulse) * 0.5;
        ringMat.emissiveIntensity = 1.8 + p * 1.4;
        discMat.opacity = 0.06 + p * 0.07;
      }
      // o numero sempre encara a camera (Sprite ja faz), some de muito longe
      if (cameraPos) {
        const d = group.position.distanceTo(cameraPos);
        numMat.opacity = clamp01(1 - (d - 90) / 60) * (this.state === 'active' ? 1 : 0.45);
      }
    },

    /** Feedback de passagem: o anel da um flash e um estufo. */
    flash() {
      ringMat.emissiveIntensity = 7.0;
      ring.scale.setScalar(1.14);
    },

    dispose() {
      ringGeo.dispose(); ringMat.dispose();
      disc.geometry.dispose(); discMat.dispose();
      numMat.map.dispose(); numMat.dispose();
    },
  };

  gate.setState('next');
  return gate;
}

/** Relaxa o flash do gate de volta ao normal. */
export function relaxGate(gate, dt) {
  const s = gate.ring.scale.x;
  if (s > 1.001) gate.ring.scale.setScalar(s + (1 - s) * Math.min(1, dt * 7));
}
