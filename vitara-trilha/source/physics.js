// physics.js — Grand Vitara 4x4: corpo rígido 3D + 4 suspensões por raio + pneus com círculo de atrito.
// Eixos locais: +Z frente, +X esquerda, +Y cima. Nada aqui aloca por passo.
const Physics = (() => {
  const M = 1600, G = 9.81, HCG = 0.62, RW = 0.362, AX = 1.32, HT = 0.775, WB = 2 * AX;
  const IPITCH = 2900, IYAW = 3000, IROLL = 900;
  const KS = 40000, CBUMP = 2900, CREB = 4300, KSTOP = 260000, TRAVEL = 0.22;
  const STATIC = M * G / 4, WY_MIN = RW - STATIC / KS, WY_MAX = WY_MIN + TRAVEL;
  const KARB_F = 11000, KARB_R = 7000;
  const FMAX = 6500, PWR = 102000, VTOP = 33.9, VREV = 10;
  const BRK_F = 5600, BRK_R = 3300, KBRK = 15000, KSTICK = 80000;
  const MU0 = 1.0, TB = 13, TC = 1.3, VLOW = 3, LIFT = 0.13, CWATER = 55;
  const STEER0 = 0.60, STEER_V2 = 95;
  const WX = new Float64Array([HT, -HT, HT, -HT]), WZ = new Float64Array([AX, AX, -AX, -AX]);
  // pontos de contato da carroceria (x,y,z locais): fundo, para-choques, soleiras, teto
  const BP = new Float64Array([
    0.7, 0.27, 2.08, -0.7, 0.27, 2.08, 0.7, 0.27, -2.08, -0.7, 0.27, -2.08,
    0, 0.2, 0.7, 0, 0.2, -0.7, 0.82, 0.24, 0, -0.82, 0.24, 0,
    0.7, 0.98, 2.1, -0.7, 0.98, 2.1, 0.55, 1.64, 0.45, -0.55, 1.64, 0.45, 0.55, 1.64, -1.7, -0.55, 1.64, -1.7]);
  const NBP = BP.length / 3;
  const CZ = new Float64Array([1.38, 0, -1.38]), CR = 0.92; // 3 círculos de colisão ao longo do carro
  const GEAR_K = new Float64Array([610, 610, 345, 236, 176]); // rpm por m/s (índice = marcha)
  const GEAR_UP = new Float64Array([0, 9.4, 16.6, 24.4, 1e9]), GEAR_DN = new Float64Array([0, 0, 7.2, 13.6, 21]);

  const cg = new Float64Array(3), comp = new Float64Array(4), compP = new Float64Array(4), fzA = new Float64Array(4);
  const nrm = new Float64Array(12), cpt = new Float64Array(12), wW = new Float64Array(4);
  const aLat = new Float64Array(4), aLon = new Float64Array(4);
  const grip = new Float64Array(4).fill(1), drag = new Float64Array(4), rum = new Float64Array(4);
  const acc = new Float64Array(6); // força (0..2) e torque (3..5) no mundo
  const colIdx = new Int32Array(96), tmp = new Float64Array(4);
  const st = new Float64Array(4); // 0: tempo capotado, 1: contador de passos

  const P = {
    pos: new Float64Array(3), quat: new Float64Array([0, 0, 0, 1]), vel: new Float64Array(3), angVel: new Float64Array(3),
    speed: 0, steerAngle: 0, steerMax: STEER0, brakeLight: 0, reverse: 0, rpm: 900, gear: 1, impact: 0, stuck: false,
    rumble: 0, nContact: 4, inWater: 0,
    wy: new Float32Array(4), spin: new Float32Array(4), contact: new Float32Array(4), slip: new Float32Array(4),
    surf: new Float32Array(4), wet: new Float32Array(4), water: new Float32Array(4),
    cx: new Float32Array(4), cy: new Float32Array(4), cz: new Float32Array(4), load: new Float32Array(4),
    wheelW: wW, RW, WB, WY_MIN, WY_MAX, DT: 1 / 120,
  };

  function sampleSurf(i, x, z) {
    const sf = World.sf; World.surfaceAt(x, z);
    grip[i] = sf.grip; drag[i] = sf.drag; rum[i] = sf.rumble; P.surf[i] = sf.type; P.wet[i] = sf.wet; P.water[i] = sf.water;
  }
  function addF(rx, ry, rz, fx, fy, fz) {
    acc[0] += fx; acc[1] += fy; acc[2] += fz;
    acc[3] += ry * fz - rz * fy; acc[4] += rz * fx - rx * fz; acc[5] += rx * fy - ry * fx;
  }

  P.init = function () { P.reset(World.startS); };

  P.reset = function (s) {
    World.poseAt(s, tmp);
    const x = tmp[0], z = tmp[2], yaw = tmp[3], sx = Math.sin(yaw), cz = Math.cos(yaw);
    // plano médio sob as 4 rodas
    const hFL = World.heightAt(x + cz * HT + sx * AX, z - sx * HT + cz * AX), hFR = World.heightAt(x - cz * HT + sx * AX, z + sx * HT + cz * AX);
    const hRL = World.heightAt(x + cz * HT - sx * AX, z - sx * HT - cz * AX), hRR = World.heightAt(x - cz * HT - sx * AX, z + sx * HT - cz * AX);
    const gF = (hFL + hFR - hRL - hRR) / (4 * AX), gS = (hFL + hRL - hFR - hRR) / (4 * HT);
    let ux = -gF * sx - gS * cz, uy = 1, uz = -gF * cz + gS * sx, l = 1 / Math.hypot(ux, uy, uz); ux *= l; uy *= l; uz *= l;
    let d = sx * ux + cz * uz, fx = sx - ux * d, fy = -uy * d, fz = cz - uz * d; l = 1 / Math.hypot(fx, fy, fz); fx *= l; fy *= l; fz *= l;
    const lx = uy * fz - uz * fy, ly = uz * fx - ux * fz, lz = ux * fy - uy * fx;
    // matriz (colunas l,u,f) -> quaternion
    const q = P.quat, tr = lx + uy + fz;
    if (tr > 0) { const k = Math.sqrt(tr + 1) * 2; q[3] = k / 4; q[0] = (uz - fy) / k; q[1] = (fx - lz) / k; q[2] = (ly - ux) / k; }
    else if (lx > uy && lx > fz) { const k = Math.sqrt(1 + lx - uy - fz) * 2; q[3] = (uz - fy) / k; q[0] = k / 4; q[1] = (ux + ly) / k; q[2] = (fx + lz) / k; }
    else if (uy > fz) { const k = Math.sqrt(1 + uy - lx - fz) * 2; q[3] = (fx - lz) / k; q[0] = (ux + ly) / k; q[1] = k / 4; q[2] = (fy + uz) / k; }
    else { const k = Math.sqrt(1 + fz - lx - uy) * 2; q[3] = (ly - ux) / k; q[0] = (fx + lz) / k; q[1] = (fy + uz) / k; q[2] = k / 4; }
    P.pos[0] = x; P.pos[1] = (hFL + hFR + hRL + hRR) / 4 + 0.005; P.pos[2] = z;
    for (let i = 0; i < 3; i++) { P.vel[i] = 0; P.angVel[i] = 0; }
    for (let i = 0; i < 4; i++) {
      comp[i] = compP[i] = STATIC / KS; wW[i] = 0; aLat[i] = 0; aLon[i] = 0; P.wy[i] = RW; P.contact[i] = 1; P.slip[i] = 0; P.load[i] = 1;
      const wx = x + lx * WX[i] + fx * WZ[i], wz = z + lz * WX[i] + fz * WZ[i];
      P.cx[i] = wx; P.cz[i] = wz; P.cy[i] = World.heightAt(wx, wz); sampleSurf(i, wx, wz);
    }
    P.speed = 0; P.steerAngle = 0; P.brakeLight = 0; P.reverse = 0; P.rpm = 900; P.gear = 1; P.impact = 0; P.stuck = false;
    P.rumble = 0; P.nContact = 4; P.inWater = 0; st[0] = 0; st[1] = 0; P.spin.fill(0);
  };

  P.step = function (dt, thrIn, brkIn, steerIn, hbIn) {
    const pos = P.pos, q = P.quat, v = P.vel, w = P.angVel;
    const thr = thrIn > 0 ? (thrIn < 1 ? thrIn : 1) : 0, brk = brkIn > 0 ? (brkIn < 1 ? brkIn : 1) : 0;
    const hb = hbIn > 0.5 ? 1 : 0, sIn = steerIn < -1 ? -1 : steerIn > 1 ? 1 : steerIn;
    let qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const lx = 1 - 2 * (qy * qy + qz * qz), ly = 2 * (qx * qy + qw * qz), lz = 2 * (qx * qz - qw * qy);
    const ux = 2 * (qx * qy - qw * qz), uy = 1 - 2 * (qx * qx + qz * qz), uz = 2 * (qy * qz + qw * qx);
    const fx = 2 * (qx * qz + qw * qy), fy = 2 * (qy * qz - qw * qx), fz = 1 - 2 * (qx * qx + qy * qy);

    // ---------- colisão com obstáculos (círculos no plano XZ) ----------
    if (P.impact > 0) { P.impact -= dt * 3.3; if (P.impact < 0) P.impact = 0; }
    const nc = World.queryCol(pos[0], pos[2], 3.6, colIdx), C = World.col;
    for (let k = 0; k < 3; k++) {
      const rz = CZ[k];
      for (let j = 0; j < nc; j++) {
        const o = colIdx[j] * 4, bx = pos[0] + fx * rz, bz = pos[2] + fz * rz;
        let dx = bx - C[o], dz = bz - C[o + 1]; const rr = CR + C[o + 2], d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        if (pos[1] + fy * rz + 0.3 > World.heightRaw(C[o], C[o + 1]) + C[o + 3]) continue; // passa por cima
        let d = Math.sqrt(d2); if (d < 1e-5) { dx = -fx; dz = -fz; d = Math.hypot(dx, dz) + 1e-9; }
        const nx = dx / d, nz = dz / d, pen = rr - d;
        pos[0] += nx * pen; pos[2] += nz * pen;
        const rx = fx * rz, ry = fy * rz, rzz = fz * rz; // braço a partir do CG (na altura do CG)
        const vpx = v[0] + w[1] * rzz - w[2] * ry, vpz = v[2] + w[0] * ry - w[1] * rx, vn = vpx * nx + vpz * nz;
        if (vn < 0) {
          const cxn = ry * nz, cyn = rzz * nx - rx * nz, czn = -ry * nx; // r × n
          const bX = cxn * lx + cyn * ly + czn * lz, bY = cxn * ux + cyn * uy + czn * uz, bZ = cxn * fx + cyn * fy + czn * fz;
          const J = -1.25 * vn / (1 / M + bX * bX / IPITCH + bY * bY / IYAW + bZ * bZ / IROLL);
          v[0] += nx * J / M; v[2] += nz * J / M;
          const aX = bX * J / IPITCH, aY = bY * J / IYAW, aZ = bZ * J / IROLL;
          w[0] += lx * aX + ux * aY + fx * aZ; w[1] += ly * aX + uy * aY + fy * aZ; w[2] += lz * aX + uz * aY + fz * aZ;
          const vt = -vpx * nz + vpz * nx; let Jt = -vt * M * 0.3; const jm = 0.35 * J; Jt = Jt > jm ? jm : Jt < -jm ? -jm : Jt;
          v[0] += -nz * Jt / M; v[2] += nx * Jt / M;
          const im = J / (M * 6); if (im > P.impact) P.impact = im > 1 ? 1 : im;
        }
      }
    }
    cg[0] = pos[0] + ux * HCG; cg[1] = pos[1] + uy * HCG; cg[2] = pos[2] + uz * HCG;

    // ---------- pedais, marcha à ré, direção ----------
    const spd = v[0] * fx + v[1] * fy + v[2] * fz, va = spd < 0 ? -spd : spd;
    if (!P.reverse) { if (spd < 0.6 && brk > 0.1 && thr < 0.1) P.reverse = 1; }
    else if (spd > -0.6 && thr > 0.1 && brk < 0.1) P.reverse = 0;
    const rev = P.reverse, drive = rev ? brk : thr; let brake = rev ? thr : brk;
    let Ft;
    if (!rev) { Ft = drive * Math.min(FMAX, PWR / (va > 1 ? va : 1)) * (1 - smooth(VTOP - 3, VTOP + 0.6, spd)); }
    else Ft = -drive * Math.min(FMAX * 0.75, PWR / (va > 1 ? va : 1)) * (1 - smooth(VREV - 2.5, VREV + 0.5, -spd));
    if (drive < 0.05) Ft -= 520 * (spd > 2 ? 1 : spd < -2 ? -1 : spd / 2); // freio-motor
    if (drive < 0.03 && brake < 0.03 && va < 0.5) brake = 0.4; // segura parado
    P.brakeLight = (brake > 0.05 && (rev ? thr > 0.05 : brk > 0.05)) || hb ? 1 : 0;
    const smax = STEER0 / (1 + spd * spd / STEER_V2); P.steerMax = smax;
    { const tg = sIn * smax, rate = (smax * 5 + 0.25) * dt, d = tg - P.steerAngle; P.steerAngle += d > rate ? rate : d < -rate ? -rate : d; }
    const sa = P.steerAngle, cs = Math.cos(sa), sn = Math.sin(sa);

    // ---------- suspensão: passada 1 (compressão e normal) ----------
    let fl = Math.hypot(fx, fz); const fhx = fl > 1e-6 ? fx / fl : 0, fhz = fl > 1e-6 ? fz / fl : 1; // frente horizontal
    const stepN = st[1]; st[1] = stepN + 1; const rr4 = stepN & 3;
    let nContact = 0;
    for (let i = 0; i < 4; i++) {
      const bx = pos[0] + lx * WX[i] + fx * WZ[i], by = pos[1] + ly * WX[i] + fy * WZ[i], bz = pos[2] + lz * WX[i] + fz * WZ[i];
      const t0 = compP[i] + WY_MIN - RW, px = bx + ux * t0, pz = bz + uz * t0;
      const h0 = World.heightAt(px, pz), hf = World.heightAt(px + fhx * 0.25, pz + fhz * 0.25), hb2 = World.heightAt(px - fhx * 0.25, pz - fhz * 0.25);
      const hs = World.heightAt(px + fhz * 0.25, pz - fhx * 0.25);
      // envelope da roda (círculo) sobre 3 amostras
      let h = h0; if (hf - 0.1 > h) h = hf - 0.1; if (hb2 - 0.1 > h) h = hb2 - 0.1;
      let gF = (hf - hb2) * 2, gS = (hs - h0) * 4; gF = gF > 1.2 ? 1.2 : gF < -1.2 ? -1.2 : gF; gS = gS > 1.2 ? 1.2 : gS < -1.2 ? -1.2 : gS;
      let nx = -gF * fhx - gS * fhz, ny = 1, nz = -gF * fhz + gS * fhx; const nl = 1 / Math.hypot(nx, ny, nz); nx *= nl; ny *= nl; nz *= nl;
      const un = ux * nx + uy * ny + uz * nz; let c = 0;
      if (un > 0.25) { c = ((px - bx) * nx + (h - by) * ny + (pz - bz) * nz) / un + RW - WY_MIN; if (c > 0.5) c = 0.5; }
      if (c <= 0) { c = 0; P.contact[i] = 0; } else { P.contact[i] = 1; nContact++; }
      comp[i] = c; nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nz;
      const cc = c < TRAVEL ? c : TRAVEL, t1 = cc + WY_MIN - RW;
      cpt[i * 3] = bx + ux * t1; cpt[i * 3 + 1] = by + uy * t1; cpt[i * 3 + 2] = bz + uz * t1;
      P.wy[i] = cc + WY_MIN;
      let cd = (c - compP[i]) / dt; cd = cd > 5 ? 5 : cd < -5 ? -5 : cd;
      let F = c > 0 ? KS * cc + (cd > 0 ? CBUMP : CREB) * cd + (c > TRAVEL ? KSTOP * (c - TRAVEL) : 0) : 0;
      fzA[i] = F; compP[i] = c;
      if (i === rr4) sampleSurf(i, cpt[i * 3], cpt[i * 3 + 2]); // piso: uma roda por passo (rodízio)
    }
    P.nContact = nContact;
    { // barras estabilizadoras
      const c0 = comp[0] < TRAVEL ? comp[0] : TRAVEL, c1 = comp[1] < TRAVEL ? comp[1] : TRAVEL, c2 = comp[2] < TRAVEL ? comp[2] : TRAVEL, c3 = comp[3] < TRAVEL ? comp[3] : TRAVEL;
      const a = KARB_F * (c0 - c1), b = KARB_R * (c2 - c3); fzA[0] += a; fzA[1] -= a; fzA[2] += b; fzA[3] -= b;
    }
    let fzSum = 0;
    for (let i = 0; i < 4; i++) { let F = fzA[i]; if (F < 0 || comp[i] <= 0) F = 0; if (F > 42000) F = 42000; fzA[i] = F; fzSum += F; }

    // ---------- forças ----------
    acc[0] = 0; acc[1] = -M * G; acc[2] = 0; acc[3] = 0; acc[4] = 0; acc[5] = 0;
    { const sp = Math.hypot(v[0], v[1], v[2]) * 0.62; acc[0] -= v[0] * sp; acc[1] -= v[1] * sp; acc[2] -= v[2] * sp; } // arrasto do ar
    let rumS = 0, watS = 0, slipMax = 0;
    for (let i = 0; i < 4; i++) {
      const Fz = fzA[i]; P.load[i] = Fz / STATIC;
      P.cx[i] = cpt[i * 3]; P.cy[i] = cpt[i * 3 + 1]; P.cz[i] = cpt[i * 3 + 2];
      const rear = i >= 2, locked = hb && rear;
      let wt, wrate = 30, slip = 0;
      if (Fz <= 0) { // roda no ar
        wt = locked || brake > 0.3 ? 0 : (spd + (rev ? -1 : 1) * drive * 10) / RW; wrate = locked ? 40 : 3;
        aLat[i] = 0; aLon[i] = 0;
      } else {
        const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
        const rx = cpt[i * 3] - cg[0], ry = cpt[i * 3 + 1] - cg[1], rz = cpt[i * 3 + 2] - cg[2];
        const vx = v[0] + w[1] * rz - w[2] * ry, vy = v[1] + w[2] * rx - w[0] * rz, vz = v[2] + w[0] * ry - w[1] * rx;
        // direção da roda projetada no plano do chão
        let wfx = fx, wfy = fy, wfz = fz; if (!rear) { wfx = fx * cs + lx * sn; wfy = fy * cs + ly * sn; wfz = fz * cs + lz * sn; }
        let d = wfx * nx + wfy * ny + wfz * nz; wfx -= nx * d; wfy -= ny * d; wfz -= nz * d;
        d = 1 / Math.hypot(wfx, wfy, wfz); wfx *= d; wfy *= d; wfz *= d;
        const sx = ny * wfz - nz * wfy, sy = nz * wfx - nx * wfz, sz = nx * wfy - ny * wfx; // lado (esquerda)
        const vlong = vx * wfx + vy * wfy + vz * wfz, vlat = vx * sx + vy * sy + vz * sz;
        const al = vlong < 0 ? -vlong : vlong, vc = Math.hypot(vlong, vlat);
        const lim = MU0 * grip[i] * Fz * (1.06 - 0.06 * Fz / STATIC > 0.8 ? 1.06 - 0.06 * Fz / STATIC : 0.8);
        const still = 1 - smooth(0.4, 1.6, vc);
        const u = TB * vlat / (al > VLOW ? al : VLOW);
        let Fy = -lim * Math.sin(TC * Math.atan(u));
        let aw = (aLat[i] + vlat * dt) * still; const am = lim / KSTICK; aw = aw > am ? am : aw < -am ? -am : aw; aLat[i] = aw; Fy -= KSTICK * aw;
        const bmax = locked ? 20000 : brake * (rear ? BRK_R : BRK_F);
        let Fb = -vlong * KBRK;
        if (bmax > 0) { let az = (aLon[i] + vlong * dt) * still; const zm = bmax / KSTICK; az = az > zm ? zm : az < -zm ? -zm : az; aLon[i] = az; Fb -= KSTICK * az; } else aLon[i] = 0;
        Fb = Fb > bmax ? bmax : Fb < -bmax ? -bmax : Fb;
        const Fd = Ft * (0.125 + 0.5 * Fz / fzSum), Freq = Fd + Fb;
        let Fx;
        if (locked && vc > 0.8) { // roda travada: atrito cinético contra o deslizamento
          Fx = -0.9 * lim * vlong / vc; Fy = -0.9 * lim * vlat / vc; slip = vc / 5; wt = 0; wrate = 40;
        } else {
          Fx = Freq > lim ? lim : Freq < -lim ? -lim : Freq;
          let ex = (Freq < 0 ? -Freq : Freq) / (lim > 1 ? lim : 1) - 1; ex = ex < 0 ? 0 : ex > 1.5 ? 1.5 : ex;
          const k = Fx / (lim > 1 ? lim : 1), fm = lim * Math.sqrt(1 - 0.8 * k * k);
          Fy = Fy > fm ? fm : Fy < -fm ? -fm : Fy;
          const braking = (Fb < 0 ? -Fb : Fb) > (Fd < 0 ? -Fd : Fd);
          wt = braking ? vlong * (1 - (ex < 1 ? ex : 1)) / RW : (vlong + (Freq > 0 ? 5 : -5) * ex) / RW;
          let sl = ((u < 0 ? -u : u) - 1.3) * 0.4 * (vc < 3 ? vc / 3 : 1); sl = sl > ex ? sl : ex * (braking ? (vc < 3 ? vc / 3 : 1) : 1); slip = sl;
        }
        // resistência do piso (lama, água) — fora do círculo de atrito
        const wd = P.water[i] < 0.5 ? P.water[i] : 0.5;
        Fx -= drag[i] * Fz * vlong / (al + 0.5) + CWATER * wd * vlong * al;
        const ax = rx + ux * LIFT, ay = ry + uy * LIFT, az2 = rz + uz * LIFT;
        addF(rx, ry, rz, nx * Fz, ny * Fz, nz * Fz);
        addF(ax, ay, az2, wfx * Fx + sx * Fy, wfy * Fx + sy * Fy, wfz * Fx + sz * Fy);
        rumS += rum[i] * 0.25; if (wd > watS) watS = wd;
      }
      wW[i] += (wt - wW[i]) * (wrate * dt < 1 ? wrate * dt : 1);
      let sp = P.spin[i] + wW[i] * dt; if (sp > 6283.185307) sp -= 6283.185307; else if (sp < -6283.185307) sp += 6283.185307; P.spin[i] = sp;
      slip = slip < 0 ? 0 : slip > 1 ? 1 : slip; P.slip[i] = slip; if (slip > slipMax) slipMax = slip;
    }
    P.rumble = rumS; P.inWater = watS;

    // ---------- carroceria contra o terreno ----------
    for (let k = 0; k < NBP; k++) {
      const bx = BP[k * 3], by = BP[k * 3 + 1], bz = BP[k * 3 + 2];
      const px = pos[0] + lx * bx + ux * by + fx * bz, py = pos[1] + ly * bx + uy * by + fy * bz, pz = pos[2] + lz * bx + uz * by + fz * bz;
      const pen = World.heightAt(px, pz) - py; if (pen <= 0) continue;
      const rx = px - cg[0], ry = py - cg[1], rz = pz - cg[2];
      const vx = v[0] + w[1] * rz - w[2] * ry, vy = v[1] + w[2] * rx - w[0] * rz, vz = v[2] + w[0] * ry - w[1] * rx;
      let Fn = 180000 * (pen < 0.35 ? pen : 0.35) - 9000 * vy; if (Fn <= 0) continue; if (Fn > 70000) Fn = 70000;
      const vt = Math.hypot(vx, vz); let Ff = vt * 4000; if (Ff > 0.55 * Fn) Ff = 0.55 * Fn; const iv = vt > 1e-6 ? Ff / vt : 0;
      addF(rx, ry, rz, -vx * iv, Fn, -vz * iv);
    }

    // ---------- integração ----------
    v[0] += acc[0] / M * dt; v[1] += acc[1] / M * dt; v[2] += acc[2] / M * dt;
    {
      let bX = w[0] * lx + w[1] * ly + w[2] * lz, bY = w[0] * ux + w[1] * uy + w[2] * uz, bZ = w[0] * fx + w[1] * fy + w[2] * fz;
      const tX = acc[3] * lx + acc[4] * ly + acc[5] * lz, tY = acc[3] * ux + acc[4] * uy + acc[5] * uz, tZ = acc[3] * fx + acc[4] * fy + acc[5] * fz;
      const dX = (tX - bY * bZ * (IROLL - IYAW)) / IPITCH, dY = (tY - bZ * bX * (IPITCH - IROLL)) / IYAW, dZ = (tZ - bX * bY * (IYAW - IPITCH)) / IROLL;
      const dmp = 1 - 0.25 * dt; bX = (bX + dX * dt) * dmp; bY = (bY + dY * dt) * dmp; bZ = (bZ + dZ * dt) * dmp;
      w[0] = lx * bX + ux * bY + fx * bZ; w[1] = ly * bX + uy * bY + fy * bZ; w[2] = lz * bX + uz * bY + fz * bZ;
    }
    let s2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; if (s2 > 3600) { const k = 60 / Math.sqrt(s2); v[0] *= k; v[1] *= k; v[2] *= k; }
    s2 = w[0] * w[0] + w[1] * w[1] + w[2] * w[2]; if (s2 > 144) { const k = 12 / Math.sqrt(s2); w[0] *= k; w[1] *= k; w[2] *= k; }
    cg[0] += v[0] * dt; cg[1] += v[1] * dt; cg[2] += v[2] * dt;
    const hx = 0.5 * dt * w[0], hy = 0.5 * dt * w[1], hz = 0.5 * dt * w[2];
    const nqx = qx + hx * qw + hy * qz - hz * qy, nqy = qy + hy * qw + hz * qx - hx * qz, nqz = qz + hz * qw + hx * qy - hy * qx, nqw = qw - hx * qx - hy * qy - hz * qz;
    const ql = 1 / Math.sqrt(nqx * nqx + nqy * nqy + nqz * nqz + nqw * nqw);
    qx = q[0] = nqx * ql; qy = q[1] = nqy * ql; qz = q[2] = nqz * ql; qw = q[3] = nqw * ql;
    const nux = 2 * (qx * qy - qw * qz), nuy = 1 - 2 * (qx * qx + qz * qz), nuz = 2 * (qy * qz + qw * qx);
    pos[0] = cg[0] - nux * HCG; pos[1] = cg[1] - nuy * HCG; pos[2] = cg[2] - nuz * HCG;
    const ns = v[0] * 2 * (qx * qz + qw * qy) + v[1] * 2 * (qy * qz - qw * qx) + v[2] * (1 - 2 * (qx * qx + qy * qy));
    P.speed = ns;

    // ---------- motor / câmbio (só para mostrador e som) ----------
    const na = ns < 0 ? -ns : ns; let g = P.gear;
    if (rev) g = -1; else { if (g < 1) g = 1; if (g < 4 && na > GEAR_UP[g]) g++; else if (g > 1 && na < GEAR_DN[g]) g--; }
    P.gear = g;
    let rt = na * GEAR_K[g < 0 ? 0 : g] * (1 + slipMax * 0.25 * drive) + 250 * drive; if (rt < 850 + 500 * drive) rt = 850 + 500 * drive; if (rt > 6400) rt = 6400;
    P.rpm += (rt - P.rpm) * (dt * 10 < 1 ? dt * 10 : 1);

    // ---------- capotado / afundado / numérico ----------
    if (nuy < 0.25) st[0] += dt; else st[0] = 0;
    if (st[0] > 1.5 || pos[1] < World.heightRaw(pos[0], pos[2]) - 1.5 || !(pos[0] + pos[1] + pos[2] + qw + w[0] + w[1] + w[2] === pos[0] + pos[1] + pos[2] + qw + w[0] + w[1] + w[2])) P.stuck = true;
  };
  return P;
})();
