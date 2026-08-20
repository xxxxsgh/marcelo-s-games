/**
 * Efeitos: particulas, manchas no chao, tremor de camera, hitstop e numeros
 * flutuantes. Nada aqui afeta a simulacao — pode sumir sem quebrar o jogo.
 */
import { swapRemove, clamp01 } from '../core/mathx.js';

const MAX_PART = 1100;
const MAX_MANCHA = 260;
const MAX_TEXTO = 40;

export function createFx() {
  const parts = [];
  const manchas = [];
  const textos = [];
  let tremorMag = 0, tremorX = 0, tremorY = 0, tremorT = 0;
  let hitstop = 0;
  let flash = 0, flashCor = '#ffffff';

  function particula(p) {
    if (parts.length >= MAX_PART) swapRemove(parts, 0);
    p.t = 0;
    p.vida = p.vida ?? 0.5;
    p.vx = p.vx ?? 0; p.vy = p.vy ?? 0;
    p.arrasto = p.arrasto ?? 3.5;
    p.raio = p.raio ?? 2;
    p.tipo = p.tipo ?? 'ponto';
    p.cor = p.cor ?? '#fff';
    parts.push(p);
    return p;
  }

  function mancha(x, y, raio, cor, alpha = 0.5) {
    if (manchas.length >= MAX_MANCHA) manchas.shift();
    manchas.push({ x, y, raio, cor, alpha, t: 0, vida: 26 });
  }

  function texto(x, y, txt, cor = '#fff', tam = 13) {
    if (textos.length >= MAX_TEXTO) textos.shift();
    textos.push({ x, y, txt, cor, tam, t: 0, vida: 0.85, vy: -46 });
  }

  // ------------------------------------------------------------- receitas
  function sangue(x, y, ang, qtd = 8, cor = '#7bff5a') {
    for (let i = 0; i < qtd; i++) {
      const a = ang + (Math.random() - 0.5) * 1.5;
      const v = 90 + Math.random() * 320;
      particula({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.28 + Math.random() * 0.4, raio: 1.4 + Math.random() * 2.6,
        cor, tipo: 'risco', arrasto: 5,
      });
    }
    if (Math.random() < 0.55) mancha(x, y, 7 + Math.random() * 13, cor, 0.20);
  }

  function faiscas(x, y, ang, qtd = 6, cor = '#ffd08a') {
    for (let i = 0; i < qtd; i++) {
      const a = ang + (Math.random() - 0.5) * 2.2;
      const v = 130 + Math.random() * 340;
      particula({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.12 + Math.random() * 0.22, raio: 1 + Math.random() * 1.6,
        cor, tipo: 'risco', arrasto: 7, luz: 0.25,
      });
    }
  }

  function fumaca(x, y, qtd = 5, cor = 'rgba(150,140,170,', escala = 1) {
    for (let i = 0; i < qtd; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 10 + Math.random() * 50;
      particula({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.7 + Math.random() * 1.1, raio: (7 + Math.random() * 14) * escala,
        cor, tipo: 'fumaca', arrasto: 1.6, cresce: 22 * escala,
      });
    }
  }

  function explosao(x, y, raio = 90, cor = '#ffb03a') {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * raio * 5;
      particula({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.2 + Math.random() * 0.45, raio: 2 + Math.random() * 4,
        cor, tipo: 'brilho', arrasto: 4.5, luz: 0.5,
      });
    }
    fumaca(x, y, 8, 'rgba(120,110,130,', raio / 90);
    particula({ x, y, vida: 0.22, raio: raio * 0.55, cor, tipo: 'onda', luzForte: raio * 1.6 });
    mancha(x, y, raio * 0.45, 'rgba(20,16,24,', 0.45);
    tremor(raio / 12);
  }

  function tremor(mag) { tremorMag = Math.min(26, Math.max(tremorMag, mag)); }
  function parar(t) { hitstop = Math.max(hitstop, t); }
  function clarao(t, cor = '#ffffff') { flash = Math.max(flash, t); flashCor = cor; }

  // ------------------------------------------------------------- atualizar
  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.vida) { swapRemove(parts, i); continue; }
      const k = Math.exp(-p.arrasto * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.cresce) p.raio += p.cresce * dt;
    }
    for (let i = manchas.length - 1; i >= 0; i--) {
      const m = manchas[i];
      m.t += dt;
      if (m.t >= m.vida) swapRemove(manchas, i);
    }
    for (let i = textos.length - 1; i >= 0; i--) {
      const t = textos[i];
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-3 * dt);
      if (t.t >= t.vida) swapRemove(textos, i);
    }

    if (tremorMag > 0.01) {
      tremorT += dt;
      tremorMag *= Math.exp(-7 * dt);
      // Duas frequencias: o tremor fica "sujo", nao um seno limpo.
      tremorX = (Math.sin(tremorT * 61) + Math.sin(tremorT * 37.3) * 0.6) * tremorMag;
      tremorY = (Math.cos(tremorT * 53) + Math.cos(tremorT * 43.1) * 0.6) * tremorMag;
    } else { tremorMag = 0; tremorX = 0; tremorY = 0; }

    if (hitstop > 0) hitstop = Math.max(0, hitstop - dt);
    if (flash > 0) flash = Math.max(0, flash - dt * 3.2);
  }

  // ------------------------------------------------------------- desenhar
  function desenharChao(ctx) {
    for (const m of manchas) {
      const a = m.alpha * (1 - clamp01(m.t / m.vida) ** 3);
      ctx.fillStyle = m.cor.startsWith('rgba') ? `${m.cor}${a})` : hexA(m.cor, a);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.raio, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function desenhar(ctx) {
    for (const p of parts) {
      const k = 1 - clamp01(p.t / p.vida);
      if (p.tipo === 'risco') {
        const v = Math.hypot(p.vx, p.vy);
        const len = Math.min(22, v * 0.022);
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = hexA(p.cor, k);
        ctx.lineWidth = p.raio;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
        ctx.stroke();
      } else if (p.tipo === 'fumaca') {
        ctx.fillStyle = `${p.cor}${(0.30 * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.tipo === 'onda') {
        ctx.strokeStyle = hexA(p.cor, k * 0.9);
        ctx.lineWidth = 3 + 6 * k;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio * (1.6 - k), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.tipo === 'brilho') {
        ctx.fillStyle = hexA(p.cor, k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio * (0.4 + k * 0.9), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = hexA(p.cor, k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function desenharTextos(ctx, escala) {
    ctx.textAlign = 'center';
    for (const t of textos) {
      const k = 1 - clamp01(t.t / t.vida);
      ctx.font = `700 ${t.tam / escala}px ui-monospace, monospace`;
      ctx.fillStyle = hexA(t.cor, k);
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.textAlign = 'left';
  }

  function luzes(out) {
    for (const p of parts) {
      if (!p.luz && !p.luzForte) continue;
      const k = 1 - clamp01(p.t / p.vida);
      if (p.luzForte) out.push({ x: p.x, y: p.y, r: p.luzForte * (1.2 - k * 0.4), cor: p.cor, i: k * 1.1 });
      else out.push({ x: p.x, y: p.y, r: 70, cor: p.cor, i: k * p.luz });
    }
  }

  return {
    particula, mancha, texto, sangue, faiscas, fumaca, explosao,
    tremor, parar, clarao, update, desenharChao, desenhar, desenharTextos, luzes,
    get tremorX() { return tremorX; },
    get tremorY() { return tremorY; },
    get hitstop() { return hitstop; },
    get flash() { return flash; },
    get flashCor() { return flashCor; },
    limpar() { parts.length = 0; manchas.length = 0; textos.length = 0; tremorMag = 0; hitstop = 0; flash = 0; },
    get contagem() { return parts.length; },
  };
}

/** Aplica alpha a uma cor hex ou rgba parcial. */
export function hexA(cor, a) {
  const al = clamp01(a);
  if (cor.startsWith('rgba')) return `${cor}${al})`;
  if (cor.startsWith('#')) {
    const h = cor.slice(1);
    const n = h.length === 3
      ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return `rgba(${n[0]},${n[1]},${n[2]},${al})`;
  }
  return cor;
}
