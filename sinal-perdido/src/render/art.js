/**
 * Desenho de tudo que anda, atira ou explode. Zero imagem: cada bicho e um
 * punhado de paths com animacao por seno, com fase propria pra dois inimigos
 * lado a lado nunca pisarem no mesmo passo.
 */
import { hexA } from '../fx/index.js';
import { clamp01, TAU } from '../core/mathx.js';

/** Sombra achatada — o unico "chao" que os corpos tem. */
export function sombra(ctx, x, y, r, a = 0.32) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.35, r * 1.05, r * 0.62, 0, 0, TAU);
  ctx.fill();
}

// ------------------------------------------------------------------ jogador
export function desenharJogador(ctx, p, t) {
  const { x, y, ang } = p;
  ctx.save();
  // Anel fraco no chao: com 20 bichos em volta, achar a si mesmo tem que ser
  // instantaneo. E de baixo, entao nao suja a leitura do traje.
  ctx.strokeStyle = 'rgba(190,225,255,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, p.raio + 7, 0, TAU);
  ctx.stroke();
  sombra(ctx, x, y, p.raio);
  ctx.translate(x, y);

  // Pernas: o passo acompanha a velocidade real, entao andar de re fica certo.
  const passo = Math.sin(p.faseAndar) * 5.5;
  ctx.rotate(p.angCorpo);
  ctx.fillStyle = '#3f4a63';
  ctx.fillRect(-5, -9 + passo, 10, 7);
  ctx.fillRect(-5, 2 - passo, 10, 7);
  ctx.rotate(-p.angCorpo);

  ctx.rotate(ang);

  // mochila
  ctx.fillStyle = '#2b3448';
  ctx.fillRect(-13, -8, 8, 16);
  ctx.fillStyle = p.esquivando > 0 ? '#79ffd0' : '#4d5c7d';
  ctx.fillRect(-12, -6, 3, 12);

  // tronco
  ctx.fillStyle = '#c9d4ea';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 10.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8f9db9';
  ctx.beginPath();
  ctx.ellipse(-2, 0, 9, 8, 0, 0, TAU);
  ctx.fill();

  // bracos + arma
  const rec = p.recuoVis || 0;
  ctx.strokeStyle = '#aab6cf';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -7); ctx.lineTo(12 - rec, -4);
  ctx.moveTo(2, 7); ctx.lineTo(12 - rec, 3);
  ctx.stroke();

  ctx.fillStyle = '#1d2433';
  ctx.fillRect(10 - rec, -3.2, 17, 6.4);
  ctx.fillStyle = '#39455e';
  ctx.fillRect(20 - rec, -2.2, 8, 4.4);
  if (p.arma === 'plasma') {
    ctx.fillStyle = '#7cf6ff';
    ctx.fillRect(16 - rec, -4.6, 5, 9.2);
  } else if (p.arma === 'espingarda') {
    ctx.fillStyle = '#6b4b2e';
    ctx.fillRect(8 - rec, -3.8, 7, 7.6);
  }

  // capacete + visor
  ctx.fillStyle = '#e8eefb';
  ctx.beginPath();
  ctx.arc(1, 0, 8.2, 0, TAU);
  ctx.fill();
  const visor = ctx.createLinearGradient(2, -6, 9, 6);
  visor.addColorStop(0, '#79ffd0');
  visor.addColorStop(1, '#1c6f9c');
  ctx.fillStyle = visor;
  ctx.beginPath();
  ctx.arc(2.5, 0, 5.6, -1.15, 1.15);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // nucleo nas costas
  if (p.carregando) {
    const fl = 0.7 + Math.sin(t * 6) * 0.3;
    ctx.fillStyle = hexA('#79ffd0', 0.85);
    ctx.beginPath();
    ctx.arc(x - Math.cos(ang) * 15, y - Math.sin(ang) * 15, 6 + fl * 1.5, 0, TAU);
    ctx.fill();
  }

  // invulnerabilidade da esquiva: risco branco
  if (p.invul > 0 && p.esquivando > 0) {
    ctx.strokeStyle = hexA('#ffffff', 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, p.raio + 5, 0, TAU);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ inimigos
const CORPO = {
  rastejante: { base: '#4a2350', casca: '#2c1433', olho: '#ff3d6e' },
  cuspidor: { base: '#2f4a2b', casca: '#1b2f1a', olho: '#b6ff4a' },
  ariete: { base: '#5a3220', casca: '#33190f', olho: '#ff9a3d' },
  enxame: { base: '#523a6b', casca: '#2a1c3a', olho: '#ff7ad4' },
  rainha: { base: '#5c1f4a', casca: '#310f28', olho: '#ff3d6e' },
};

export function desenharInimigo(ctx, e, t) {
  const c = CORPO[e.tipo] || CORPO.rastejante;
  const ferido = e.flash > 0;
  ctx.save();
  if (e.tipo !== 'enxame') sombra(ctx, e.x, e.y, e.raio);
  else sombra(ctx, e.x, e.y + 12, e.raio * 0.7, 0.18);
  ctx.translate(e.x, e.y);
  ctx.rotate(e.ang);

  const anda = Math.sin(t * e.ritmo + e.fase);

  if (e.tipo === 'rastejante') {
    pernas(ctx, e.raio, anda, c.casca, 3, 2.6);
    ctx.fillStyle = ferido ? '#fff' : c.base;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.raio * 1.05, e.raio * 0.82, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ferido ? '#fff' : c.casca;
    ctx.beginPath();
    ctx.ellipse(-2, 0, e.raio * 0.72, e.raio * 0.6, 0, 0, TAU);
    ctx.fill();
    // mandibulas
    ctx.strokeStyle = c.casca;
    ctx.lineWidth = 2.4;
    const m = 0.35 + Math.abs(anda) * 0.35;
    ctx.beginPath();
    ctx.moveTo(e.raio * 0.7, -3); ctx.lineTo(e.raio * 1.5, -3 - m * 5);
    ctx.moveTo(e.raio * 0.7, 3); ctx.lineTo(e.raio * 1.5, 3 + m * 5);
    ctx.stroke();
    olhos(ctx, e.raio * 0.55, 3.2, 1.7, c.olho);
  } else if (e.tipo === 'cuspidor') {
    pernas(ctx, e.raio, anda, c.casca, 4, 2.2);
    ctx.fillStyle = ferido ? '#fff' : c.base;
    ctx.beginPath();
    ctx.ellipse(-3, 0, e.raio * 1.1, e.raio * 0.95, 0, 0, TAU);
    ctx.fill();
    // saco de acido pulsando (carrega antes de cuspir)
    const carga = e.carga ? clamp01(e.carga) : 0;
    ctx.fillStyle = hexA('#8dff5a', 0.5 + carga * 0.5);
    ctx.beginPath();
    ctx.ellipse(-6, 0, e.raio * (0.55 + carga * 0.2), e.raio * (0.5 + carga * 0.2), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ferido ? '#fff' : c.casca;
    ctx.beginPath();
    ctx.ellipse(e.raio * 0.55, 0, e.raio * 0.5, e.raio * 0.42, 0, 0, TAU);
    ctx.fill();
    olhos(ctx, e.raio * 0.75, 2.6, 1.5, c.olho);
  } else if (e.tipo === 'ariete') {
    pernas(ctx, e.raio, anda, c.casca, 3, 4);
    ctx.fillStyle = ferido ? '#fff' : c.base;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.raio * 1.05, e.raio * 0.9, 0, 0, TAU);
    ctx.fill();
    // placa frontal: e o que aguenta o tiro de frente
    const brilho = e.estado === 'preparando' ? 0.4 + Math.sin(t * 22) * 0.4 : 0;
    ctx.fillStyle = ferido ? '#fff' : c.casca;
    ctx.beginPath();
    ctx.moveTo(e.raio * 0.2, -e.raio * 0.85);
    ctx.lineTo(e.raio * 1.25, -e.raio * 0.3);
    ctx.lineTo(e.raio * 1.25, e.raio * 0.3);
    ctx.lineTo(e.raio * 0.2, e.raio * 0.85);
    ctx.closePath();
    ctx.fill();
    if (brilho > 0) {
      ctx.strokeStyle = hexA('#ff9a3d', brilho);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.strokeStyle = c.casca;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.raio * 1.1, -e.raio * 0.5); ctx.lineTo(e.raio * 1.8, -e.raio * 0.75);
    ctx.moveTo(e.raio * 1.1, e.raio * 0.5); ctx.lineTo(e.raio * 1.8, e.raio * 0.75);
    ctx.stroke();
    olhos(ctx, e.raio * 0.55, 4, 1.8, c.olho);
  } else if (e.tipo === 'enxame') {
    const bate = Math.sin(t * 40 + e.fase);
    ctx.fillStyle = hexA(c.olho, 0.35);
    ctx.beginPath();
    ctx.ellipse(-2, -6 - bate * 3, 8, 3, -0.5, 0, TAU);
    ctx.ellipse(-2, 6 + bate * 3, 8, 3, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ferido ? '#fff' : c.base;
    ctx.beginPath();
    ctx.moveTo(e.raio * 1.4, 0);
    ctx.lineTo(-e.raio, -e.raio * 0.8);
    ctx.lineTo(-e.raio * 0.4, 0);
    ctx.lineTo(-e.raio, e.raio * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.olho;
    ctx.beginPath();
    ctx.arc(e.raio * 0.5, 0, 1.8, 0, TAU);
    ctx.fill();
  } else if (e.tipo === 'rainha') {
    pernas(ctx, e.raio * 0.9, anda, c.casca, 4, 6);
    // abdomen com ovos
    ctx.fillStyle = ferido ? '#fff' : c.base;
    ctx.beginPath();
    ctx.ellipse(-e.raio * 0.7, 0, e.raio * 0.95, e.raio * 0.8, 0, 0, TAU);
    ctx.fill();
    const pulso = 0.55 + Math.sin(t * 3 + e.fase) * 0.25;
    ctx.fillStyle = hexA('#ff7ad4', pulso);
    ctx.beginPath();
    ctx.ellipse(-e.raio * 0.8, 0, e.raio * 0.6, e.raio * 0.48, 0, 0, TAU);
    ctx.fill();
    // torax
    ctx.fillStyle = ferido ? '#fff' : c.casca;
    ctx.beginPath();
    ctx.ellipse(e.raio * 0.25, 0, e.raio * 0.85, e.raio * 0.7, 0, 0, TAU);
    ctx.fill();
    // coroa
    ctx.strokeStyle = c.casca;
    ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.34;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * e.raio * 0.8, Math.sin(a) * e.raio * 0.8);
      ctx.lineTo(Math.cos(a) * e.raio * 1.5, Math.sin(a) * e.raio * 1.5);
      ctx.stroke();
    }
    olhos(ctx, e.raio * 0.8, 6, 2.6, c.olho);
  }
  ctx.restore();

  if (e.vidaMax > 60 && e.vida < e.vidaMax) barraVida(ctx, e);
}

function pernas(ctx, r, anda, cor, pares, largura) {
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  for (let i = 0; i < pares; i++) {
    const base = (i - (pares - 1) / 2) * 0.55;
    const bal = Math.sin(anda * Math.PI + i) * 0.32;
    for (const lado of [-1, 1]) {
      const a = base + lado * (1.15 + bal * lado);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
      ctx.lineTo(Math.cos(a) * r * 1.75, Math.sin(a) * r * 1.5 + lado * 2);
      ctx.stroke();
    }
  }
}

function olhos(ctx, dx, dy, r, cor) {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(dx, -dy, r, 0, TAU);
  ctx.arc(dx, dy, r, 0, TAU);
  ctx.fill();
}

function barraVida(ctx, e) {
  const w = e.raio * 2.4, k = clamp01(e.vida / e.vidaMax);
  const y = e.y - e.raio - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(e.x - w / 2, y, w, 4);
  ctx.fillStyle = k > 0.5 ? '#79ffd0' : k > 0.22 ? '#ffb03a' : '#ff3d6e';
  ctx.fillRect(e.x - w / 2, y, w * k, 4);
}

// ------------------------------------------------------------------ cenario
export function desenharNave(ctx, nave, t) {
  const { x, y } = nave;
  ctx.save();
  ctx.translate(x, y);
  sombra(ctx, 0, 0, 78, 0.4);
  ctx.rotate(nave.ang);

  // casco
  ctx.fillStyle = '#39415a';
  ctx.beginPath();
  ctx.moveTo(86, 0);
  ctx.lineTo(34, -34);
  ctx.lineTo(-52, -30);
  ctx.lineTo(-70, -12);
  ctx.lineTo(-70, 12);
  ctx.lineTo(-52, 30);
  ctx.lineTo(34, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4c5677';
  ctx.beginPath();
  ctx.moveTo(70, 0);
  ctx.lineTo(30, -22);
  ctx.lineTo(-40, -19);
  ctx.lineTo(-40, 19);
  ctx.lineTo(30, 22);
  ctx.closePath();
  ctx.fill();

  // asa quebrada
  ctx.fillStyle = '#2c3348';
  ctx.beginPath();
  ctx.moveTo(-10, -28);
  ctx.lineTo(24, -76);
  ctx.lineTo(40, -70);
  ctx.lineTo(10, -26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, 28);
  ctx.lineTo(18, 62);
  ctx.lineTo(34, 54);
  ctx.lineTo(10, 26);
  ctx.closePath();
  ctx.fill();

  // cabine
  const vidro = ctx.createLinearGradient(40, -18, 76, 18);
  vidro.addColorStop(0, '#9fe6ff');
  vidro.addColorStop(1, '#22405e');
  ctx.fillStyle = vidro;
  ctx.beginPath();
  ctx.ellipse(52, 0, 20, 15, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1a2030';
  ctx.lineWidth = 2;
  ctx.stroke();

  // rampa
  ctx.fillStyle = '#232939';
  ctx.fillRect(-88, -18, 22, 36);

  // reator: quantos nucleos ja foram entregues
  for (let i = 0; i < 3; i++) {
    const ligado = i < nave.nucleos;
    ctx.fillStyle = ligado ? '#79ffd0' : '#242a3a';
    ctx.beginPath();
    ctx.arc(-24 + i * 22, -0, 6.5, 0, TAU);
    ctx.fill();
    if (ligado) {
      ctx.strokeStyle = hexA('#79ffd0', 0.5 + Math.sin(t * 4 + i) * 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-24 + i * 22, 0, 10, 0, TAU);
      ctx.stroke();
    }
  }

  // baliza piscando
  const pisca = (t * 1.6) % 1 < 0.18;
  ctx.fillStyle = pisca ? '#ff3d6e' : '#4a1e2c';
  ctx.beginPath();
  ctx.arc(20, -30, 4, 0, TAU);
  ctx.fill();

  ctx.restore();
}

export function desenharNinho(ctx, n, t) {
  const k = clamp01(n.vida / n.vidaMax);
  ctx.save();
  ctx.translate(n.x, n.y);
  sombra(ctx, 0, 0, n.raio, 0.45);

  // monte de carne com veios
  ctx.fillStyle = n.flash > 0 ? '#fff' : '#3a1230';
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU;
    const r = n.raio * (0.86 + Math.sin(a * 3 + n.fase) * 0.12 + Math.sin(t * 1.4 + a * 2) * 0.03);
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const pulso = 0.45 + Math.sin(t * 2.4 + n.fase) * 0.2 + (1 - k) * 0.25;
  ctx.strokeStyle = hexA('#ff3d6e', pulso);
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = n.fase + (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * n.raio * 0.2, Math.sin(a) * n.raio * 0.2);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.4) * n.raio * 0.6, Math.sin(a + 0.4) * n.raio * 0.6,
      Math.cos(a) * n.raio * 0.92, Math.sin(a) * n.raio * 0.92,
    );
    ctx.stroke();
  }

  // boca central: abre quando cospe bicho
  const abre = n.abrindo > 0 ? n.abrindo : 0;
  ctx.fillStyle = hexA('#ff7ad4', 0.5 + abre * 0.5);
  ctx.beginPath();
  ctx.arc(0, 0, n.raio * (0.22 + abre * 0.2), 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#150610';
  ctx.beginPath();
  ctx.arc(0, 0, n.raio * (0.13 + abre * 0.16), 0, TAU);
  ctx.fill();

  // ovos ao redor
  for (let i = 0; i < 7; i++) {
    const a = n.fase * 1.7 + (i / 7) * TAU;
    const r = n.raio * 1.05;
    ctx.fillStyle = hexA('#ff7ad4', 0.35);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, 7, 9, a, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // barra de vida do ninho
  if (k < 1) {
    const w = n.raio * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(n.x - w / 2, n.y - n.raio - 18, w, 6);
    ctx.fillStyle = '#ff3d6e';
    ctx.fillRect(n.x - w / 2, n.y - n.raio - 18, w * k, 6);
  }
}

export function desenharCapsula(ctx, c, t) {
  ctx.save();
  ctx.translate(c.x, c.y);
  sombra(ctx, 0, 0, 16, 0.35);
  ctx.rotate(c.ang);
  ctx.fillStyle = c.aberta ? '#3a3f4d' : '#59627d';
  ctx.beginPath();
  ctx.roundRect(-16, -11, 32, 22, 5);
  ctx.fill();
  ctx.fillStyle = '#242a38';
  ctx.fillRect(-16, -4, 32, 8);
  if (!c.aberta) {
    const pisca = (t * 2 + c.fase) % 1 < 0.3;
    ctx.fillStyle = pisca ? '#ffb03a' : '#4a3a1c';
    ctx.beginPath();
    ctx.arc(9, -6, 3, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#20242e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -9); ctx.lineTo(14, 9);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ itens
export function desenharItem(ctx, it, t) {
  const flut = Math.sin(t * 3.4 + it.fase) * 3;
  ctx.save();
  ctx.translate(it.x, it.y + flut);
  sombra(ctx, 0, -flut, 9, 0.25);

  if (it.tipo === 'nucleo') {
    const g = 0.6 + Math.sin(t * 5 + it.fase) * 0.4;
    ctx.fillStyle = hexA('#79ffd0', 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexA('#79ffd0', g);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6, t * 2 + it.fase, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6, -t * 1.4 + it.fase, 0, TAU);
    ctx.stroke();
  } else if (it.tipo === 'vida') {
    ctx.fillStyle = '#e8eefb';
    ctx.beginPath();
    ctx.roundRect(-9, -7, 18, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#ff3d6e';
    ctx.fillRect(-2, -4.5, 4, 9);
    ctx.fillRect(-5.5, -1.5, 11, 3);
  } else if (it.tipo === 'municao') {
    ctx.fillStyle = '#39455e';
    ctx.beginPath();
    ctx.roundRect(-10, -7, 20, 14, 2);
    ctx.fill();
    ctx.fillStyle = it.cor || '#ffb03a';
    ctx.fillRect(-7, -4, 14, 4);
    ctx.font = '700 7px ui-monospace, monospace';
    ctx.fillStyle = '#cbd5f5';
    ctx.textAlign = 'center';
    ctx.fillText(it.rotulo || '', 0, 5);
    ctx.textAlign = 'left';
  } else if (it.tipo === 'arma') {
    ctx.fillStyle = '#1d2433';
    ctx.fillRect(-13, -4, 26, 8);
    ctx.fillStyle = it.cor || '#79ffd0';
    ctx.fillRect(4, -6, 8, 12);
    ctx.strokeStyle = hexA(it.cor || '#79ffd0', 0.5 + Math.sin(t * 4 + it.fase) * 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.stroke();
  } else if (it.tipo === 'melhoria') {
    const g = 0.5 + Math.sin(t * 6 + it.fase) * 0.5;
    ctx.fillStyle = hexA('#ffb03a', 0.9);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.8;
      const r = i % 2 ? 5 : 11;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hexA('#ffb03a', g * 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ tiros
export function desenharProjetil(ctx, b) {
  const ang = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  if (b.tipo === 'plasma') {
    ctx.fillStyle = hexA(b.cor, 0.25);
    ctx.beginPath();
    ctx.ellipse(-6, 0, 18, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = b.cor;
    ctx.beginPath();
    ctx.arc(0, 0, b.raio, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, b.raio * 0.45, 0, TAU);
    ctx.fill();
  } else if (b.tipo === 'acido') {
    ctx.fillStyle = hexA(b.cor, 0.35);
    ctx.beginPath();
    ctx.ellipse(-5, 0, 12, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = b.cor;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.raio * 1.2, b.raio, 0, 0, TAU);
    ctx.fill();
  } else {
    const len = 13 + b.raio * 2;
    const g = ctx.createLinearGradient(-len, 0, 4, 0);
    g.addColorStop(0, hexA(b.cor, 0));
    g.addColorStop(1, b.cor);
    ctx.strokeStyle = g;
    ctx.lineWidth = b.raio;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function desenharClarao(ctx, x, y, ang, tamanho, cor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = hexA(cor, 0.9);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(tamanho, -tamanho * 0.42);
  ctx.lineTo(tamanho * 1.5, 0);
  ctx.lineTo(tamanho, tamanho * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
