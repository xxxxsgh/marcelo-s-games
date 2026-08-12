/**
 * Mapa em tela cheia, estilo GPS: malha de ruas, distritos coloridos, POIs
 * descobertos, zonas restritas e a posicao/direcao do drone.
 * Desenhado em canvas 2D — barato e nitido em qualquer resolucao.
 */
import { WORLD } from '../config.js';
import { DISTRICT_LIST, districtAt } from '../world/districts.js';
import { POIS, RESTRICTED, RECHARGE, RADIO } from '../world/pois.js';

const S = WORLD.chunkSize;

export function createMap(pois) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed; inset:0; z-index:40; display:none;
    background:rgba(4,7,12,.94); backdrop-filter:blur(2px);`;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%;';
  el.appendChild(canvas);

  const legend = document.createElement('div');
  legend.style.cssText = `position:absolute; left:24px; bottom:24px;
    font:11px ui-monospace,monospace; color:#dff0ff; letter-spacing:.1em; line-height:2;`;
  el.appendChild(legend);

  const title = document.createElement('div');
  title.style.cssText = `position:absolute; left:24px; top:22px;
    font:12px ui-monospace,monospace; color:#dff0ff; letter-spacing:.34em;`;
  title.textContent = 'MAPA  ·  N PARA FECHAR';
  el.appendChild(title);

  document.body.appendChild(el);

  const ctx = canvas.getContext('2d');
  let visible = false;
  let zoom = 0.35;             // px por metro

  function resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(dronePos, heading) {
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    const cxp = w / 2, cyp = h / 2;
    // mundo -> tela, centrado no drone
    const tx = (x) => cxp + (x - dronePos.x) * zoom;
    const ty = (z) => cyp + (z - dronePos.z) * zoom;

    // --- distritos ---
    const span = Math.ceil(Math.max(w, h) / (S * zoom)) + 2;
    const c0x = Math.floor(dronePos.x / S) - span, c0z = Math.floor(dronePos.z / S) - span;
    for (let i = 0; i <= span * 2; i++) {
      for (let j = 0; j <= span * 2; j++) {
        const cx = c0x + i, cz = c0z + j;
        const d = districtAt(cx, cz);
        ctx.fillStyle = `#${d.color.toString(16).padStart(6, '0')}`;
        ctx.globalAlpha = 0.13;
        ctx.fillRect(tx(cx * S), ty(cz * S), S * zoom, S * zoom);
        ctx.globalAlpha = 1;
      }
    }

    // --- malha de ruas ---
    ctx.strokeStyle = 'rgba(150,190,230,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= span * 2 + 1; i++) {
      const x = tx((c0x + i) * S);
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      const y = ty((c0z + i) * S);
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();

    // --- alcance de radio ---
    ctx.strokeStyle = 'rgba(55,213,255,.30)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(tx(RADIO.base.x), ty(RADIO.base.z), (RADIO.range + RADIO.antennaBonus) * zoom,
      0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- zonas restritas ---
    for (const z of RESTRICTED) {
      ctx.fillStyle = 'rgba(255,61,90,.13)';
      ctx.strokeStyle = 'rgba(255,61,90,.6)';
      ctx.beginPath();
      ctx.arc(tx(z.x), ty(z.z), z.r * zoom, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,140,.85)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(z.name, tx(z.x), ty(z.z) - z.r * zoom - 6);
    }

    // --- recarga descoberta ---
    for (const r of RECHARGE) {
      if (!pois.isDiscovered(r.id) && r.id !== 'base') continue;
      ctx.fillStyle = '#5be08a';
      ctx.beginPath();
      ctx.arc(tx(r.x), ty(r.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(91,224,138,.8)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(r.name, tx(r.x) + 7, ty(r.z) + 3);
    }

    // --- POIs ---
    for (const p of POIS) {
      const known = pois.isDiscovered(p.id);
      ctx.fillStyle = known ? '#ffb03a' : 'rgba(160,180,200,.28)';
      ctx.beginPath();
      ctx.moveTo(tx(p.x), ty(p.z) - 6);
      ctx.lineTo(tx(p.x) + 5, ty(p.z) + 4);
      ctx.lineTo(tx(p.x) - 5, ty(p.z) + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = known ? 'rgba(255,200,120,.9)' : 'rgba(160,180,200,.35)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(known ? p.name : '???', tx(p.x) + 8, ty(p.z) + 4);
    }

    // --- drone ---
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.rotate(-heading);
    ctx.fillStyle = '#37d5ff';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- legenda ---
    const d = districtAt(Math.floor(dronePos.x / S), Math.floor(dronePos.z / S));
    legend.innerHTML = DISTRICT_LIST.map((x) => {
      const on = x.id === d.id;
      const col = `#${x.color.toString(16).padStart(6, '0')}`;
      return `<span style="color:${col}">■</span> `
        + `<span style="opacity:${on ? 1 : 0.45}">${x.name}${on ? '  ← VOCE' : ''}</span>`;
    }).join('<br>')
      + `<br><br><span style="opacity:.5">${Math.round(dronePos.x)} , `
      + `${Math.round(dronePos.z)}  ·  ZOOM +/-</span>`;
  }

  function onKey(e) {
    if (!visible) return;
    if (e.key === '+' || e.key === '=') zoom = Math.min(2.0, zoom * 1.25);
    if (e.key === '-' || e.key === '_') zoom = Math.max(0.08, zoom / 1.25);
  }
  window.addEventListener('keydown', onKey);

  return {
    el,
    get visible() { return visible; },
    toggle() { visible = !visible; el.style.display = visible ? '' : 'none'; return visible; },
    close() { visible = false; el.style.display = 'none'; },
    draw(pos, heading) { if (visible) draw(pos, heading); },
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      el.remove();
    },
  };
}
