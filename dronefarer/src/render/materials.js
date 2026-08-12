/**
 * Registro central de materiais do mundo. Todos compartilhados (um material
 * por superficie, nao um por objeto) — e isso que deixa o batching viavel.
 */
import * as THREE from 'three';
import { asphaltTextures, concreteTextures, facadeTextures, roadMarkTexture } from './textures.js';

export function createMaterials(envMap, settings) {
  const aniso = settings.anisotropy;
  const reg = [];
  const track = (m) => { reg.push(m); return m; };

  const asphaltTex = asphaltTextures();
  const concreteTex = concreteTextures();
  const curbTex = concreteTextures(512, false);

  for (const set of [asphaltTex, concreteTex, curbTex]) {
    for (const t of Object.values(set)) if (t?.anisotropy !== undefined) t.anisotropy = aniso;
  }

  const asphalt = track(new THREE.MeshStandardMaterial({
    map: asphaltTex.map, normalMap: asphaltTex.normalMap, roughnessMap: asphaltTex.roughnessMap,
    roughness: 0.92, metalness: 0.04, envMap, envMapIntensity: 0.40,
    normalScale: new THREE.Vector2(0.9, 0.9),
  }));

  const sidewalk = track(new THREE.MeshStandardMaterial({
    map: concreteTex.map, normalMap: concreteTex.normalMap, roughnessMap: concreteTex.roughnessMap,
    roughness: 0.92, metalness: 0.0, envMap, envMapIntensity: 0.6,
  }));

  const concrete = track(new THREE.MeshStandardMaterial({
    map: curbTex.map, normalMap: curbTex.normalMap, roughnessMap: curbTex.roughnessMap,
    roughness: 0.9, metalness: 0.0, envMap, envMapIntensity: 0.55,
  }));

  // Interiores (garagem, tunel, subsolo). O environment map ilumina sem saber
  // que existe parede, entao um ambiente fechado ficaria tao claro quanto a
  // rua. A correcao e material proprio que quase nao ve o ceu.
  const interiorConcrete = track(new THREE.MeshStandardMaterial({
    map: curbTex.map, normalMap: curbTex.normalMap, roughnessMap: curbTex.roughnessMap,
    color: 0x5f6062, roughness: 0.96, metalness: 0.0,
    envMap, envMapIntensity: 0.10,
  }));

  const roadMark = track(new THREE.MeshBasicMaterial({
    map: roadMarkTexture(), transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));

  const metal = track(new THREE.MeshStandardMaterial({
    color: 0x8d949c, metalness: 0.95, roughness: 0.38, envMap, envMapIntensity: 1.2,
  }));

  const paintedMetal = track(new THREE.MeshStandardMaterial({
    color: 0x37404b, metalness: 0.6, roughness: 0.52, envMap, envMapIntensity: 0.9,
  }));

  const glass = track(new THREE.MeshPhysicalMaterial({
    color: 0x1b2a3a, metalness: 0.1, roughness: 0.08,
    clearcoat: 1.0, clearcoatRoughness: 0.06,
    envMap, envMapIntensity: 2.2, transparent: true, opacity: 0.72,
  }));

  const wire = track(new THREE.MeshBasicMaterial({ color: 0x0e1116 }));

  const rubber = track(new THREE.MeshStandardMaterial({
    color: 0x14161a, metalness: 0.0, roughness: 0.9,
  }));

  // Cache de fachadas: uma por (variante, andares).
  const facadeCache = new Map();
  function facade(variant, floors) {
    const key = `${variant}|${floors}`;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const tex = facadeTextures(variant, floors);
    for (const t of Object.values(tex)) if (t?.anisotropy !== undefined) t.anisotropy = aniso;
    const m = track(new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normalMap, roughnessMap: tex.roughnessMap,
      emissiveMap: tex.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.0,
      roughness: 0.78, metalness: 0.06, envMap, envMapIntensity: 0.85,
      normalScale: new THREE.Vector2(1.1, 1.1),
    }));
    facadeCache.set(key, m);
    return m;
  }

  /** Caixa-com-fachada dos LODs distantes (sem normal, sem roughness map). */
  function facadeLod(variant, floors) {
    const key = `lod|${variant}|${floors}`;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const tex = facadeTextures(variant, floors);
    const m = track(new THREE.MeshLambertMaterial({ map: tex.map }));
    facadeCache.set(key, m);
    return m;
  }

  return {
    asphalt, sidewalk, concrete, interiorConcrete, roadMark, metal, paintedMetal,
    glass, wire, rubber,
    facade, facadeLod,
    /** Acende as janelas (ciclo dia/noite). */
    setWindowLight(intensity) {
      for (const m of facadeCache.values()) {
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity;
      }
    },
    /** Asfalto molhado da Fase 6: roughness cai, reflexo sobe. */
    setWetness(w) {
      asphalt.roughness = 0.92 - w * 0.60;
      asphalt.envMapIntensity = 0.40 + w * 1.6;
      sidewalk.roughness = 0.92 - w * 0.45;
      concrete.roughness = 0.9 - w * 0.4;
    },
    setEnvMap(env) {
      for (const m of reg) {
        if ('envMap' in m) { m.envMap = env; m.needsUpdate = true; }
      }
    },
    dispose() { for (const m of reg) m.dispose(); },
    all: reg,
  };
}
