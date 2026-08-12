/**
 * FASE 1 — o quarteirao urbano minimo.
 * Uma rua principal com cruzamento, calcadas, predios de 4 a 10 andares,
 * postes com fios cruzando a rua, carros parados, caçamba, muro e rampa de
 * garagem. Chao plano: o relevo aqui e so guia e rampa.
 *
 * Tudo que e solido registra um AABB no `colliders`.
 */
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { createRng } from '../core/rng.js';
import { makeCar, makePole, makeWire, makeDumpster, makeWaterTank, makeAntenna } from './props.js';

const B = WORLD.block;

export function createBlock(scene, colliders, mats, seed = WORLD.seed) {
  const root = new THREE.Group();
  root.name = 'block';
  scene.add(root);
  const rng = createRng(`block-${seed}`);

  const EXTENT = 260;            // meio-lado do chao
  const half = B.streetWidth / 2;
  const walkOuter = half + B.sidewalkWidth;

  // ---------------------------------------------------------------- chao
  // A boca da rampa de garagem e um BURACO de verdade no chao. Por isso o
  // asfalto nao e um plano unico: sao quatro faixas em volta da abertura.
  const RAMP_HOLE = { minX: -7.2, maxX: -1.2, minZ: -62, maxZ: -50 };
  const TILE = 4;  // metros por repeticao da textura

  /** Faixa de asfalto com UV em coordenada de mundo (tiling continuo). */
  function groundStrip(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    if (w <= 0 || d <= 0) return null;
    const geo = new THREE.PlaneGeometry(w, d, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // UV a partir da posicao no mundo: as quatro faixas casam sem costura.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + cx) / TILE, (pos.getZ(i) + cz) / TILE);
    }
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, mats.asphalt);
    m.position.set(cx, 0, cz);
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  for (const t of [mats.asphalt.map, mats.asphalt.normalMap, mats.asphalt.roughnessMap]) {
    if (t) t.repeat.set(1, 1);
  }
  groundStrip(-EXTENT, EXTENT, -EXTENT, RAMP_HOLE.minZ);
  groundStrip(-EXTENT, EXTENT, RAMP_HOLE.maxZ, EXTENT);
  groundStrip(-EXTENT, RAMP_HOLE.minX, RAMP_HOLE.minZ, RAMP_HOLE.maxZ);
  groundStrip(RAMP_HOLE.maxX, EXTENT, RAMP_HOLE.minZ, RAMP_HOLE.maxZ);

  // -------------------------------------------------------- faixas de rua
  const markGeo = new THREE.PlaneGeometry(0.9, EXTENT * 2);
  const mark = new THREE.Mesh(markGeo, mats.roadMark);
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = 0.012;
  mark.material.map.repeat.set(1, EXTENT / 3);
  root.add(mark);
  const markCross = mark.clone();
  markCross.rotation.z = Math.PI / 2;
  root.add(markCross);

  // ---------------------------------------------------------- calcadas
  function sidewalk(cx, cz, sx, sz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, B.sidewalkHeight, sz), mats.sidewalk);
    m.position.set(cx, B.sidewalkHeight / 2, cz);
    m.receiveShadow = true; m.castShadow = true;
    root.add(m);
    colliders.addBox(m.position, new THREE.Vector3(sx, B.sidewalkHeight, sz), 'calcada');
    return m;
  }
  // quatro quadrantes ao redor do cruzamento
  const armLen = EXTENT;
  for (const sxSign of [-1, 1]) {
    for (const szSign of [-1, 1]) {
      // faixa paralela a Z
      sidewalk(sxSign * (half + B.sidewalkWidth / 2), szSign * (armLen / 2 + walkOuter),
        B.sidewalkWidth, armLen - walkOuter * 2);
      // faixa paralela a X
      sidewalk(sxSign * (armLen / 2 + walkOuter), szSign * (half + B.sidewalkWidth / 2),
        armLen - walkOuter * 2, B.sidewalkWidth);
    }
  }

  // ---------------------------------------------------------- predios
  const buildings = [];
  function building(cx, cz, w, d, floors, variant) {
    const h = floors * B.floorHeight;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d), mats.facade(variant, floors),
    );
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    // UV: repete a fachada uma vez por andar na vertical
    g.add(body);

    // parapeito do telhado — da silhueta e serve de obstaculo
    const parapetH = 0.85;
    const pg = new THREE.Group();
    for (const [ox, oz, sw, sd] of [
      [0, d / 2 - 0.12, w, 0.24], [0, -d / 2 + 0.12, w, 0.24],
      [w / 2 - 0.12, 0, 0.24, d], [-w / 2 + 0.12, 0, 0.24, d],
    ]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(sw, parapetH, sd), mats.concrete);
      p.position.set(ox, h + parapetH / 2, oz);
      p.castShadow = true;
      pg.add(p);
    }
    g.add(pg);

    // coisas de telhado: caixa d'agua e antena
    if (rng.bool(0.7)) {
      const tank = makeWaterTank(mats, 0.9 + rng.next() * 0.5, 1.4 + rng.next());
      tank.position.set((rng.next() - 0.5) * w * 0.5, h, (rng.next() - 0.5) * d * 0.5);
      g.add(tank);
      colliders.addBox(
        new THREE.Vector3(cx + tank.position.x, h + 1.2, cz + tank.position.z),
        new THREE.Vector3(2.2, 2.4, 2.2), 'telhado',
      );
    }
    if (rng.bool(0.45)) {
      const ant = makeAntenna(mats, 3 + rng.next() * 3);
      ant.position.set((rng.next() - 0.5) * w * 0.6, h, (rng.next() - 0.5) * d * 0.6);
      g.add(ant);
    }

    g.position.set(cx, 0, cz);
    root.add(g);
    colliders.addBox(
      new THREE.Vector3(cx, h / 2, cz), new THREE.Vector3(w, h, d), 'predio',
    );
    // parapeito como colisao (senao da pra atravessar a borda do telhado)
    colliders.addBox(
      new THREE.Vector3(cx, h + parapetH / 2, cz + d / 2 - 0.12),
      new THREE.Vector3(w, parapetH, 0.24), 'predio',
    );
    colliders.addBox(
      new THREE.Vector3(cx, h + parapetH / 2, cz - d / 2 + 0.12),
      new THREE.Vector3(w, parapetH, 0.24), 'predio',
    );
    buildings.push({ x: cx, z: cz, w, d, h, floors });
    return g;
  }

  // Fileiras de predios nos quatro quadrantes, com vaos (becos) entre eles.
  const rowStart = walkOuter + 0.5;
  for (const qx of [-1, 1]) {
    for (const qz of [-1, 1]) {
      let cursor = rowStart + 4;
      while (cursor < 150) {
        const depth = 14 + rng.next() * 10;
        const width = 12 + rng.next() * 14;
        const floors = Math.round(B.buildingMinFloors
          + rng.next() * (B.buildingMaxFloors - B.buildingMinFloors));
        const variant = rng.int(0, 4);

        // fileira ao longo de Z (fachadas voltadas pra rua principal)
        building(
          qx * (rowStart + depth / 2), qz * (cursor + width / 2),
          depth, width, floors, variant,
        );
        // fileira ao longo de X (rua transversal)
        building(
          qx * (cursor + width / 2), qz * (rowStart + depth / 2),
          width, depth, Math.max(B.buildingMinFloors, floors - rng.int(0, 3)), (variant + 2) % 5,
        );

        // beco: o vao entre um predio e o proximo
        cursor += width + (rng.bool(0.35) ? 2.2 + rng.next() * 2 : 5 + rng.next() * 6);
      }
    }
  }

  // ---------------------------------------------------- postes e fios
  const poleTops = [];
  for (let z = -140; z <= 140; z += B.poleSpacing) {
    if (Math.abs(z) < walkOuter + 2) continue;
    for (const sx of [-1, 1]) {
      const p = makePole(mats);
      const px = sx * (half + B.sidewalkWidth * 0.55);
      p.position.set(px, B.sidewalkHeight, z);
      p.rotation.y = sx > 0 ? Math.PI : 0;
      root.add(p);
      colliders.addBox(
        new THREE.Vector3(px, B.poleHeight / 2, z),
        new THREE.Vector3(0.3, B.poleHeight, 0.3), 'poste',
      );
      poleTops.push(new THREE.Vector3(px, B.poleHeight - 1.1, z));
    }
  }
  // fios: atravessando a rua e correndo ao longo dela
  for (let i = 0; i < poleTops.length; i++) {
    const a = poleTops[i];
    // fio cruzando a rua (par esquerda/direita no mesmo z)
    const partner = poleTops.find((p) => p !== a && Math.abs(p.z - a.z) < 0.1 && p.x > a.x);
    if (partner) {
      root.add(makeWire(a, partner, B.wireSag, mats));
      // segundo fio mais baixo
      const a2 = a.clone().setY(a.y - 0.9), b2 = partner.clone().setY(partner.y - 0.9);
      root.add(makeWire(a2, b2, B.wireSag * 0.8, mats));
    }
    // fio ao longo da rua
    const next = poleTops.find((p) => Math.abs(p.x - a.x) < 0.1 && Math.abs(p.z - a.z - B.poleSpacing) < 0.5);
    if (next) root.add(makeWire(a.clone().setY(a.y - 0.35), next.clone().setY(next.y - 0.35), 0.55, mats));
  }

  // ---------------------------------------------------- carros parados
  for (let i = 0; i < 26; i++) {
    const alongZ = rng.bool();
    const side = rng.bool() ? 1 : -1;
    const car = makeCar(rng, mats);
    let x, z;
    if (alongZ) {
      x = side * (half - 1.3);
      z = (rng.next() - 0.5) * 260;
      if (Math.abs(z) < walkOuter + 6) continue;
    } else {
      z = side * (half - 1.3);
      x = (rng.next() - 0.5) * 260;
      if (Math.abs(x) < walkOuter + 6) continue;
      car.rotation.y = Math.PI / 2;
    }
    car.position.set(x, 0, z);
    root.add(car);
    const size = alongZ ? new THREE.Vector3(1.9, 1.55, 4.4) : new THREE.Vector3(4.4, 1.55, 1.9);
    colliders.addBox(new THREE.Vector3(x, 0.78, z), size, 'carro');
  }

  // ---------------------------------------------------- caçambas e muro
  for (let i = 0; i < 5; i++) {
    const d = makeDumpster(mats);
    const sx = rng.bool() ? 1 : -1;
    const z = (rng.next() - 0.5) * 200;
    if (Math.abs(z) < walkOuter + 8) continue;
    d.position.set(sx * (half - 1.6), 0, z);
    root.add(d);
    colliders.addBox(new THREE.Vector3(d.position.x, 0.65, z),
      new THREE.Vector3(2.1, 1.3, 3.7), 'cacamba');
  }

  // muro baixo separando um terreno
  const wallZ = 96;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 2.6, 0.34), mats.concrete);
  wall.position.set(rowStart + 24, 1.3, wallZ);
  wall.castShadow = true; wall.receiveShadow = true;
  root.add(wall);
  colliders.addBox(wall.position, new THREE.Vector3(46, 2.6, 0.34), 'muro');

  // ---------------------------------------------------- rampa de garagem
  // Unico "relevo" do chao: desce pra um subsolo raso e escuro, que so faz
  // sentido de voar com cuidado. A boca fica NA RUA (onde nao ha predio) e o
  // salao se estende por baixo do quarteirao.
  const rampGroup = new THREE.Group();
  const DROP = 3.2;                      // profundidade do subsolo
  const CEIL_TOP = -0.3;                 // topo do teto, logo abaixo da rua
  const rx0 = RAMP_HOLE.minX, rx1 = RAMP_HOLE.maxX;
  const rz0 = RAMP_HOLE.minZ, rz1 = RAMP_HOLE.maxZ;   // z0 = fundo, z1 = boca

  // piso inclinado
  const rampLen = rz1 - rz0;
  const angle = Math.atan2(DROP, rampLen);
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(rx1 - rx0, 0.4, Math.hypot(rampLen, DROP)), mats.interiorConcrete,
  );
  ramp.rotation.x = -angle;
  ramp.position.set((rx0 + rx1) / 2, -DROP / 2, (rz0 + rz1) / 2);
  rampGroup.add(ramp);
  colliders.addBox(ramp.position,
    new THREE.Vector3(rx1 - rx0, 1.4, rampLen), 'rampa');

  // paredes laterais da trincheira da rampa (senao ve-se o vazio sob a rua)
  for (const wx of [rx0, rx1]) {
    const tw = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, DROP + 0.6, rampLen), mats.interiorConcrete,
    );
    tw.position.set(wx, -DROP / 2 + 0.1, (rz0 + rz1) / 2);
    rampGroup.add(tw);
    colliders.addBox(tw.position, new THREE.Vector3(0.3, DROP + 0.6, rampLen), 'garagem');
  }

  // salao: x de -26 a -1, z de -78 a -62 (a boca da rampa entra pelo +Z)
  const GX0 = -26, GX1 = -1, GZ0 = -78, GZ1 = rz0;
  const gx = (GX0 + GX1) / 2, gz = (GZ0 + GZ1) / 2;
  const gw = GX1 - GX0, gd = GZ1 - GZ0;
  const gh = CEIL_TOP - (-DROP);         // pe direito interno

  const floorG = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.3, gd), mats.interiorConcrete);
  floorG.position.set(gx, -DROP - 0.15, gz);
  rampGroup.add(floorG);
  colliders.addBox(floorG.position, new THREE.Vector3(gw, 0.3, gd), 'garagem');

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.3, gd), mats.interiorConcrete);
  ceil.position.set(gx, CEIL_TOP + 0.15, gz);
  rampGroup.add(ceil);
  colliders.addBox(ceil.position, new THREE.Vector3(gw, 0.3, gd), 'garagem');

  // paredes: fundo, dois lados, e a da frente PARTIDA onde a rampa entra
  const wallY = -DROP + gh / 2;
  const walls = [
    [gx, GZ0, gw, 0.3],                            // fundo (-Z)
    [GX0, gz, 0.3, gd],                            // lateral -X
    [GX1, gz, 0.3, gd],                            // lateral +X
    [(GX0 + rx0) / 2, GZ1, rx0 - GX0, 0.3],        // frente, trecho esquerdo
    [(rx1 + GX1) / 2, GZ1, GX1 - rx1, 0.3],        // frente, trecho direito
  ];
  for (const [wx, wz, sw, sd] of walls) {
    if (sw <= 0 || sd <= 0) continue;
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(sw, gh, sd), mats.interiorConcrete);
    w2.position.set(wx, wallY, wz);
    rampGroup.add(w2);
    colliders.addBox(w2.position, new THREE.Vector3(sw, gh, sd), 'garagem');
  }

  // pilares: obstaculo real la dentro
  for (const px of [-8, 0, 8]) {
    for (const pz of [-5, 5]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.7, gh, 0.7), mats.interiorConcrete);
      pil.position.set(gx + px, wallY, gz + pz);
      rampGroup.add(pil);
      colliders.addBox(pil.position, new THREE.Vector3(0.7, gh, 0.7), 'garagem');
    }
  }

  // O plano de chao nao existe sobre a rampa nem sobre o salao — sem isto o
  // subsolo fica inalcancavel.
  colliders.addGroundHole(rx0, rz0, rx1, rz1);
  colliders.addGroundHole(GX0, GZ0, GX1, GZ1);

  rampGroup.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  root.add(rampGroup);

  return {
    root,
    buildings,
    garage: { x: -13.5, y: -1.6, z: -70 },
    rampMouth: { x: -4.2, y: 2.0, z: -48 },
    spawn: new THREE.Vector3(0, 1.4, 22),
    dispose() {
      root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      scene.remove(root);
    },
  };
}
