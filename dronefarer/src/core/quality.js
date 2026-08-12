/**
 * Detector de qualidade em 4 tiers (alto / medio / baixo / minimo).
 * Heuristica por GPU (WEBGL_debug_renderer_info), resolucao e memoria.
 * Override manual: ?q=alto | ?q=medio | ?q=baixo | ?q=minimo
 * Render scale manual: ?rs=1.5
 */
import { QUALITY } from '../config.js';

const ORDER = ['minimo', 'baixo', 'medio', 'alto'];

function gpuString() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(s || '').toLowerCase();
  } catch { return ''; }
}

/** Pontua a GPU de 0 (fraca) a 3 (dedicada forte). */
function scoreGpu(r) {
  if (!r) return 1;
  // Dedicadas modernas
  if (/rtx\s*(30|40|50)|rtx\s*20[6-9]|radeon\s*rx\s*(6|7|9)\d{3}|arc\s*a7/.test(r)) return 3;
  if (/rtx|geforce\s*gtx\s*1[06]|radeon\s*rx\s*[5-9]\d{2}|quadro|arc\s*a/.test(r)) return 2.5;
  // Apple Silicon: GPU integrada mas forte
  if (/apple\s*m[1-9]/.test(r)) return 2.5;
  // Integradas modernas
  if (/iris\s*xe|arc\s*graphics|radeon\s*(vega|graphics)|uhd\s*graphics\s*7[0-9]{2}/.test(r)) return 1.5;
  if (/intel|uhd|hd\s*graphics|mali|adreno|swiftshader|llvmpipe|software/.test(r)) return 0.5;
  return 1.5;
}

export function detectTier() {
  const params = new URLSearchParams(location.search);
  const forced = (params.get('q') || '').toLowerCase();
  if (ORDER.includes(forced)) return { name: forced, forced: true, gpu: gpuString() };

  const gpu = gpuString();
  let score = scoreGpu(gpu);

  // Resolucao: 4K custa ~2.5x o 1080p. Penaliza tier alto em telao.
  const px = (window.innerWidth * window.innerHeight) * (window.devicePixelRatio || 1) ** 2;
  if (px > 8.0e6) score -= 1.0;        // ~4K
  else if (px > 3.6e6) score -= 0.5;   // ~1440p+

  // Memoria e nucleos como desempate
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4) score -= 0.5;
  if (cores <= 2) score -= 0.5;
  if (cores >= 12 && mem >= 16) score += 0.25;

  let name = 'medio';
  if (score >= 2.6) name = 'alto';
  else if (score >= 1.4) name = 'medio';
  else if (score >= 0.75) name = 'baixo';
  else name = 'minimo';

  return { name, forced: false, gpu, score };
}

/** Retorna uma COPIA das settings do tier, com overrides de query param. */
export function resolveSettings(tierName) {
  const base = QUALITY.tiers[tierName] || QUALITY.tiers.medio;
  const s = { ...base, tier: tierName };
  const params = new URLSearchParams(location.search);
  const rs = parseFloat(params.get('rs'));
  if (Number.isFinite(rs)) {
    s.renderScale = Math.min(QUALITY.renderScaleMax, Math.max(QUALITY.renderScaleMin, rs));
  }
  return s;
}

export function createQuality() {
  const detected = detectTier();
  let settings = resolveSettings(detected.name);
  const listeners = new Set();

  return {
    get detected() { return detected; },
    get settings() { return settings; },
    get tier() { return settings.tier; },
    /** Troca de tier em runtime (menu de opcoes da Fase 8). */
    setTier(name) {
      if (!QUALITY.tiers[name]) return;
      const rs = settings.renderScale;
      settings = resolveSettings(name);
      settings.renderScale = rs;
      listeners.forEach((f) => f(settings));
    },
    /** Ajuste individual (sombra, ssao, bloom...). */
    set(key, value) {
      settings[key] = value;
      listeners.forEach((f) => f(settings));
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    tiers: ORDER,
  };
}
