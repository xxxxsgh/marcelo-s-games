/**
 * HUD. Desenha em pixels de tela (ja com DPR aplicado) sobre a cena.
 *
 * Prioridade da informacao, de cima pra baixo: o que me mata (vida, dano
 * chegando), o que eu faco agora (objetivo, bussola) e o que eu escolho
 * (arma, municao). Tudo o resto e enfeite e fica fraco de proposito.
 */
import { PALETA, CERCO } from '../config.js';
import { clamp01, tempoStr, TAU } from '../core/mathx.js';
import { hexA } from '../fx/index.js';
import { ARMAS, MUNICAO, ORDEM_ARMAS } from '../combat/weapons.js';
import { desenharMinimapa } from './minimap.js';

export function desenharHud(ctx, jogo) {
  const s = jogo.ui;                  // escala de UI (DPR)
  const W = jogo.cam.largura, H = jogo.cam.altura;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = 'alphabetic';

  vinheta(ctx, jogo, W, H);
  barrasVida(ctx, jogo, s);
  arma(ctx, jogo, s, W, H);
  objetivo(ctx, jogo, s, W);
  bussola(ctx, jogo, W, H, s);
  mensagens(ctx, jogo, s, H);
  desenharMinimapa(ctx, jogo, W - 176 * s - 16 * s, 16 * s, 176 * s);
  marcadorRecarga(ctx, jogo, s);
  mira(ctx, jogo, s);
  indicadoresDano(ctx, jogo, W, H, s);

  if (jogo.estado === 'jogando' && jogo.tempo < 12) dicas(ctx, jogo, s, W, H);
}

// --------------------------------------------------------------------- peças
function painel(ctx, x, y, w, h, alpha = 0.45) {
  ctx.fillStyle = `rgba(10,8,16,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,140,180,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function barra(ctx, x, y, w, h, k, cor, fundo = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = fundo;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w * clamp01(k), h);
  ctx.strokeStyle = 'rgba(230,242,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function barrasVida(ctx, jogo, s) {
  const jog = jogo.jogador;
  const x = 18 * s, y = 18 * s, w = 240 * s;
  painel(ctx, x - 8 * s, y - 8 * s, w + 16 * s, 54 * s);

  const kv = jog.vida / jog.vidaMax;
  barra(ctx, x, y, w, 14 * s, kv, kv > 0.35 ? '#ff5d78' : (jogo.tempo * 6) % 1 > 0.5 ? '#ff3d6e' : '#7a1b2c');
  ctx.font = `700 ${10 * s}px ui-monospace, monospace`;
  ctx.fillStyle = '#0b0710';
  ctx.fillText(`${Math.ceil(jog.vida)}`, x + 6 * s, y + 11 * s);

  const ke = jog.escudo / jog.escudoMax;
  barra(ctx, x, y + 20 * s, w, 8 * s, ke, '#7cf6ff');

  ctx.font = `${9 * s}px ui-monospace, monospace`;
  ctx.fillStyle = '#6f7f9c';
  ctx.fillText('INTEGRIDADE DO TRAJE', x, y + 40 * s);

  // esquiva
  const kd = 1 - clamp01(jog.esquivaCd / 0.85);
  ctx.fillStyle = kd >= 1 ? '#79ffd0' : '#3a4a5e';
  ctx.fillRect(x + w - 46 * s, y + 33 * s, 46 * s * (kd >= 1 ? 1 : kd), 4 * s);
  ctx.font = `${8 * s}px ui-monospace, monospace`;
  ctx.fillStyle = kd >= 1 ? '#79ffd0' : '#55627a';
  ctx.textAlign = 'right';
  ctx.fillText('ESQUIVA [ESPACO]', x + w, y + 41 * s);
  ctx.textAlign = 'left';
}

function arma(ctx, jogo, s, W, H) {
  const ars = jogo.jogador.arsenal;
  const a = ARMAS[ars.atual];
  const x = 18 * s, y = H - 92 * s;
  painel(ctx, x - 8 * s, y - 8 * s, 268 * s, 84 * s);

  ctx.font = `700 ${12 * s}px ui-monospace, monospace`;
  ctx.fillStyle = PALETA.ui;
  ctx.fillText(a.nome, x, y + 6 * s);

  const mag = ars.mag[a.id];
  const res = ars.reserva[a.municao];
  ctx.font = `700 ${30 * s}px ui-monospace, monospace`;
  ctx.fillStyle = mag === 0 ? '#ff3d6e' : mag <= a.mag * 0.25 ? '#ffb03a' : PALETA.ui;
  ctx.fillText(String(mag).padStart(2, '0'), x, y + 38 * s);
  ctx.font = `${13 * s}px ui-monospace, monospace`;
  ctx.fillStyle = '#7b88a3';
  ctx.fillText(`/ ${res === Infinity ? '∞' : res}  ${MUNICAO[a.municao].nome}`, x + 46 * s, y + 38 * s);

  if (ars.recarregando > 0) {
    const k = 1 - ars.recarregando / a.recarga;
    barra(ctx, x, y + 46 * s, 160 * s, 5 * s, k, '#ffb03a');
    ctx.font = `${9 * s}px ui-monospace, monospace`;
    ctx.fillStyle = '#ffb03a';
    ctx.fillText('RECARREGANDO', x + 168 * s, y + 51 * s);
  } else if (mag === 0) {
    ctx.font = `700 ${10 * s}px ui-monospace, monospace`;
    ctx.fillStyle = (jogo.tempo * 4) % 1 > 0.5 ? '#ff3d6e' : '#7a2233';
    ctx.fillText(res > 0 ? 'PENTE VAZIO — [R]' : 'SEM MUNICAO', x, y + 51 * s);
  }

  // lista de armas
  let ax = x;
  ctx.font = `${9 * s}px ui-monospace, monospace`;
  for (let i = 0; i < ORDEM_ARMAS.length; i++) {
    const id = ORDEM_ARMAS[i];
    const tem = ars.posse[id];
    const sel = ars.atual === id;
    const w = 62 * s;
    ctx.fillStyle = sel ? 'rgba(121,255,208,0.18)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(ax, y + 58 * s, w - 4 * s, 14 * s);
    ctx.fillStyle = !tem ? '#39404f' : sel ? '#79ffd0' : '#8d9ab5';
    ctx.fillText(`${i + 1}·${ARMAS[id].curto.slice(0, 6)}`, ax + 4 * s, y + 68 * s);
    ax += w;
  }
}

function objetivo(ctx, jogo, s, W) {
  const x = W / 2;
  ctx.textAlign = 'center';

  if (jogo.cerco.ativo) {
    const k = jogo.cerco.t / CERCO.duracao;
    ctx.font = `700 ${13 * s}px ui-monospace, monospace`;
    ctx.fillStyle = '#ff3d6e';
    ctx.fillText('SEQUENCIA DE DECOLAGEM — SEGURE A POSICAO', x, 28 * s);
    ctx.font = `700 ${34 * s}px ui-monospace, monospace`;
    ctx.fillStyle = (jogo.cerco.t < 10 && (jogo.tempo * 4) % 1 > 0.5) ? '#fff' : '#ffb03a';
    ctx.fillText(tempoStr(jogo.cerco.t), x, 62 * s);
    barra(ctx, x - 140 * s, 70 * s, 280 * s, 5 * s, 1 - k, '#ff3d6e');
  } else {
    ctx.font = `${11 * s}px ui-monospace, monospace`;
    ctx.fillStyle = '#8d9ab5';
    ctx.fillText(jogo.objetivoTexto, x, 28 * s);

    // tres lampadas de nucleo
    for (let i = 0; i < 3; i++) {
      const cx = x - 34 * s + i * 34 * s;
      const cheio = i < jogo.nucleosEntregues;
      const carregando = jogo.jogador.carregando && i === jogo.nucleosEntregues;
      ctx.beginPath();
      ctx.arc(cx, 46 * s, 9 * s, 0, TAU);
      ctx.fillStyle = cheio ? '#79ffd0' : carregando ? hexA('#79ffd0', 0.35 + Math.sin(jogo.tempo * 6) * 0.25) : 'rgba(20,26,36,0.8)';
      ctx.fill();
      ctx.strokeStyle = cheio ? '#79ffd0' : '#46536b';
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    }
  }

  // relogio do ciclo
  const ang = jogo.faseDia * TAU - Math.PI / 2;
  const rx = W - 26 * s, ry = 122 * s, r = 12 * s;
  ctx.beginPath();
  ctx.arc(rx, ry, r, 0, TAU);
  ctx.fillStyle = 'rgba(10,8,16,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,200,0.3)';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(rx + Math.cos(ang) * r * 0.8, ry + Math.sin(ang) * r * 0.8);
  ctx.strokeStyle = jogo.noite ? '#7cf6ff' : '#ffb03a';
  ctx.stroke();
  ctx.font = `${8 * s}px ui-monospace, monospace`;
  ctx.fillStyle = jogo.noite ? '#7cf6ff' : '#ffb03a';
  ctx.fillText(jogo.noite ? 'NOITE' : 'DIA', rx, ry + r + 10 * s);
  ctx.textAlign = 'left';
}

/** Setas na borda apontando pro que importa agora. */
function bussola(ctx, jogo, W, H, s) {
  const alvos = jogo.alvosBussola();
  const cx = W / 2, cy = H / 2;
  const raio = Math.min(W, H) * 0.36;
  for (const alvo of alvos) {
    const p = jogo.cam.mundoParaTela(alvo.x, alvo.y);
    const dx = p.x - cx, dy = p.y - cy;
    const naTela = p.x > 40 * s && p.x < W - 40 * s && p.y > 60 * s && p.y < H - 40 * s;
    const dist = Math.hypot(alvo.x - jogo.jogador.x, alvo.y - jogo.jogador.y);
    const ang = Math.atan2(dy, dx);
    const px = naTela ? p.x : cx + Math.cos(ang) * raio;
    const py = naTela ? p.y : cy + Math.sin(ang) * raio;

    ctx.save();
    ctx.translate(px, py);
    if (!naTela) {
      ctx.rotate(ang);
      ctx.fillStyle = hexA(alvo.cor, 0.85);
      ctx.beginPath();
      ctx.moveTo(11 * s, 0);
      ctx.lineTo(-6 * s, -7 * s);
      ctx.lineTo(-6 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-ang);
    } else {
      ctx.strokeStyle = hexA(alvo.cor, 0.7);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(0, 0, 13 * s, 0, TAU);
      ctx.stroke();
    }
    ctx.font = `${9 * s}px ui-monospace, monospace`;
    ctx.fillStyle = hexA(alvo.cor, 0.8);
    ctx.textAlign = 'center';
    ctx.fillText(`${alvo.rotulo} ${(dist / 40).toFixed(0)}m`, 0, 24 * s);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

function mensagens(ctx, jogo, s, H) {
  const base = H - 120 * s;
  ctx.font = `${11 * s}px ui-monospace, monospace`;
  for (let i = 0; i < jogo.log.length; i++) {
    const m = jogo.log[jogo.log.length - 1 - i];
    const idade = jogo.tempo - m.t;
    const a = clamp01(1 - (idade - 5) / 1.6) * clamp01(idade * 6);
    if (a <= 0) continue;
    const cor = m.tipo === 'perigo' ? PALETA.perigo : m.tipo === 'ok' ? PALETA.ok : m.tipo === 'aviso' ? PALETA.aviso : '#a9b6cf';
    ctx.fillStyle = hexA(cor, a * (1 - i * 0.18));
    ctx.fillText(`> ${m.txt}`, 20 * s, base - i * 15 * s);
  }
}

function mira(ctx, jogo, s) {
  if (jogo.jogador.morto) return;
  const m = jogo.miraTela();
  const ars = jogo.jogador.arsenal;
  const a = ARMAS[ars.atual];
  const abertura = (14 + a.espalha * 260 + Math.hypot(jogo.jogador.vx, jogo.jogador.vy) * 0.02) * s;
  ctx.strokeStyle = jogo.miraSobreInimigo ? '#ff3d6e' : 'rgba(230,242,255,0.85)';
  ctx.lineWidth = 1.6 * s;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * TAU;
    ctx.beginPath();
    ctx.moveTo(m.x + Math.cos(ang) * abertura * 0.45, m.y + Math.sin(ang) * abertura * 0.45);
    ctx.lineTo(m.x + Math.cos(ang) * abertura, m.y + Math.sin(ang) * abertura);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230,242,255,0.9)';
  ctx.fillRect(m.x - 1 * s, m.y - 1 * s, 2 * s, 2 * s);

  // marcador de acerto
  if (jogo.acertoT > 0) {
    const k = jogo.acertoT / 0.2;
    ctx.strokeStyle = hexA(jogo.acertoMorte ? '#ff3d6e' : '#ffffff', k);
    ctx.lineWidth = 2 * s;
    const r = (8 + (1 - k) * 6) * s;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(m.x + sx * r, m.y + sy * r);
      ctx.lineTo(m.x + sx * r * 1.7, m.y + sy * r * 1.7);
      ctx.stroke();
    }
  }
}

/** Anel de recarga em volta do jogador — informacao onde os olhos ja estao. */
function marcadorRecarga(ctx, jogo, s) {
  const ars = jogo.jogador.arsenal;
  if (ars.recarregando <= 0) return;
  const a = ARMAS[ars.atual];
  const p = jogo.cam.mundoParaTela(jogo.jogador.x, jogo.jogador.y);
  const k = 1 - ars.recarregando / a.recarga;
  ctx.strokeStyle = 'rgba(255,176,58,0.9)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 26 * s, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
}

function indicadoresDano(ctx, jogo, W, H, s) {
  const cx = W / 2, cy = H / 2;
  for (const d of jogo.danosRecentes) {
    const k = clamp01(1 - (jogo.tempo - d.t) / 1.2);
    if (k <= 0) continue;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(d.ang);
    ctx.globalAlpha = k * 0.55;
    // Arco fino apontando pra origem do dano: informa sem tapar o combate.
    const r = Math.min(W, H) * 0.3;
    ctx.strokeStyle = 'rgba(255,61,110,0.95)';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.26, 0.26);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function vinheta(ctx, jogo, W, H) {
  const jog = jogo.jogador;
  const k = 1 - clamp01(jog.vida / jog.vidaMax);
  const pulso = k > 0.55 ? 0.06 * Math.sin(jogo.tempo * 6) : 0;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(${k > 0.4 ? '60,0,14' : '0,0,0'},${0.42 + k * 0.35 + pulso})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (jogo.fx.flash > 0) {
    ctx.fillStyle = hexA(jogo.fx.flashCor, Math.min(0.6, jogo.fx.flash));
    ctx.fillRect(0, 0, W, H);
  }
}

function dicas(ctx, jogo, s, W, H) {
  const a = clamp01(1 - (jogo.tempo - 8) / 4) * clamp01(jogo.tempo - 0.5);
  if (a <= 0) return;
  ctx.font = `${11 * s}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = hexA('#8d9ab5', a);
  ctx.fillText('WASD move  •  MOUSE mira  •  CLIQUE atira  •  ESPACO esquiva  •  R recarrega  •  F coronhada', W / 2, H - 26 * s);
  ctx.textAlign = 'left';
}
