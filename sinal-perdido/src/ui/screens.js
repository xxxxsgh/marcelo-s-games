/**
 * Telas cheias: titulo, pausa, morte e fuga. Todas desenhadas no mesmo canvas,
 * em pixels de tela — o jogo continua vivo atras (a nave, o vento, os bichos),
 * so a simulacao e que congela.
 */
import { PALETA } from '../config.js';
import { clamp01, tempoStr } from '../core/mathx.js';
import { hexA } from '../fx/index.js';

function fundo(ctx, W, H, alpha = 0.72) {
  ctx.fillStyle = `rgba(6,5,11,${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function titulo(ctx, txt, x, y, s, cor = PALETA.aviso, tam = 44) {
  ctx.textAlign = 'center';
  ctx.font = `700 ${tam * s}px ui-monospace, monospace`;
  ctx.fillStyle = cor;
  ctx.save();
  ctx.shadowColor = hexA(cor, 0.55);
  ctx.shadowBlur = 26 * s;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

function linha(ctx, txt, x, y, s, cor = '#a9b6cf', tam = 12, peso = 400) {
  ctx.textAlign = 'center';
  ctx.font = `${peso} ${tam * s}px ui-monospace, monospace`;
  ctx.fillStyle = cor;
  ctx.fillText(txt, x, y);
}

/** Fundo do menu: chuva de meteoros — a mesma que trouxe voce. */
const meteoros = [];
function meteoro(ctx, W, H, s) {
  if (meteoros.length < 26) {
    meteoros.push({
      x: Math.random() * W * 1.4 - W * 0.2, y: -Math.random() * H,
      v: 260 + Math.random() * 700, len: 40 + Math.random() * 120,
      a: 0.15 + Math.random() * 0.5,
    });
  }
  for (const m of meteoros) {
    m.y += m.v * 0.016;
    m.x += m.v * 0.016 * 0.35;
    if (m.y > H + 100) { m.y = -80; m.x = Math.random() * W * 1.4 - W * 0.2; }
    const g = ctx.createLinearGradient(m.x, m.y, m.x - m.len * 0.35 * s, m.y - m.len * s);
    g.addColorStop(0, `rgba(255,180,120,${m.a})`);
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x - m.len * 0.35 * s, m.y - m.len * s);
    ctx.stroke();
  }
}

export function telaTitulo(ctx, jogo) {
  const { largura: W, altura: H } = jogo.cam;
  const s = jogo.ui;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  fundo(ctx, W, H, 0.82);
  meteoro(ctx, W, H, s);

  const cy = H * 0.34;
  titulo(ctx, 'SINAL PERDIDO', W / 2, cy, s, PALETA.aviso, Math.min(52, W / (13 * s)));
  linha(ctx, 'CAPSULA 7 — QUEDA NAO PROGRAMADA EM KOR-9', W / 2, cy + 28 * s, s, '#7d8aa5', 11);

  const y = cy + 78 * s;
  linha(ctx, 'A nave aguenta um lancamento. Faltam tres nucleos de plasma.', W / 2, y, s, '#c8d4ea', 13);
  linha(ctx, 'Eles estao dentro dos ninhos. Os ninhos sabem disso.', W / 2, y + 20 * s, s, '#8d9ab5', 12);

  const yc = y + 62 * s;
  const cols = [
    ['WASD', 'mover'], ['MOUSE', 'mirar'], ['CLIQUE', 'atirar'],
    ['ESPACO', 'esquiva'], ['R', 'recarregar'], ['1-4 / Q', 'trocar arma'],
    ['F', 'coronhada'], ['L', 'lanterna'], ['ESC', 'pausa'],
  ];
  ctx.textAlign = 'center';
  for (let i = 0; i < cols.length; i++) {
    const cx = W / 2 + ((i % 3) - 1) * 190 * s;
    const yy = yc + Math.floor(i / 3) * 22 * s;
    ctx.font = `700 ${11 * s}px ui-monospace, monospace`;
    ctx.fillStyle = PALETA.ok;
    ctx.textAlign = 'right';
    ctx.fillText(cols[i][0], cx - 14 * s, yy);
    ctx.font = `${11 * s}px ui-monospace, monospace`;
    ctx.fillStyle = '#7d8aa5';
    ctx.textAlign = 'left';
    ctx.fillText(cols[i][1], cx - 4 * s, yy);
    ctx.textAlign = 'center';
  }

  const pisca = 0.55 + Math.sin(jogo.tempo * 3.4) * 0.45;
  linha(ctx, '[ CLIQUE OU ENTER PARA CAIR ]', W / 2, H - 92 * s, s, hexA(PALETA.ui, pisca), 15, 700);
  linha(ctx, `SEMENTE: ${jogo.mapa.seed}   ·   [S] sortear outro planeta   ·   [M] som: ${jogo.audio.ligado ? 'ligado' : 'mudo'}`,
    W / 2, H - 62 * s, s, '#5f6b83', 10);

  const d = jogo.save.dados;
  if (d.partidas > 0) {
    linha(ctx,
      `quedas: ${d.partidas}   fugas: ${d.vitorias}   melhor tempo: ${d.melhorTempo ? tempoStr(d.melhorTempo) : '—'}   recorde de abates: ${d.maisAbates}`,
      W / 2, H - 38 * s, s, '#4d576c', 10);
  }
  ctx.textAlign = 'left';
}

export function telaPausa(ctx, jogo) {
  const { largura: W, altura: H } = jogo.cam;
  const s = jogo.ui;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  fundo(ctx, W, H, 0.6);
  titulo(ctx, 'PAUSA', W / 2, H * 0.4, s, PALETA.ui, 34);
  linha(ctx, '[ESC] continuar    [R] reiniciar este planeta    [N] novo planeta', W / 2, H * 0.4 + 34 * s, s, '#a9b6cf', 12);
  linha(ctx, `[M] som: ${jogo.audio.ligado ? 'ligado' : 'mudo'}    [L] lanterna    [F3] diagnostico`, W / 2, H * 0.4 + 56 * s, s, '#6b7891', 11);
  linha(ctx, `semente ${jogo.mapa.seed}`, W / 2, H * 0.4 + 84 * s, s, '#4d576c', 10);
  ctx.textAlign = 'left';
}

function placar(ctx, jogo, W, s, y0) {
  const st = jogo.jogador.stats;
  const precisao = st.tiros > 0 ? Math.round((st.acertos / st.tiros) * 100) : 0;
  const linhas = [
    ['TEMPO NO PLANETA', tempoStr(jogo.tempo)],
    ['NUCLEOS ENTREGUES', `${jogo.nucleosEntregues} / 3`],
    ['NINHOS QUEIMADOS', `${jogo.ninhos.filter((n) => n.destruido).length} / ${jogo.ninhos.length}`],
    ['ABATES', String(st.mortes)],
    ['PRECISAO', `${precisao}%`],
    ['DANO ABSORVIDO', String(Math.round(st.danoTomado))],
  ];
  for (let i = 0; i < linhas.length; i++) {
    const y = y0 + i * 22 * s;
    ctx.textAlign = 'right';
    ctx.font = `${11 * s}px ui-monospace, monospace`;
    ctx.fillStyle = '#6b7891';
    ctx.fillText(linhas[i][0], W / 2 - 14 * s, y);
    ctx.textAlign = 'left';
    ctx.font = `700 ${12 * s}px ui-monospace, monospace`;
    ctx.fillStyle = PALETA.ui;
    ctx.fillText(linhas[i][1], W / 2 + 14 * s, y);
  }
  ctx.textAlign = 'center';
}

export function telaMorte(ctx, jogo) {
  const { largura: W, altura: H } = jogo.cam;
  const s = jogo.ui;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const k = clamp01((jogo.tempoEstado - 0.2) / 1.4);
  fundo(ctx, W, H, 0.5 + k * 0.36);
  titulo(ctx, 'SINAL PERDIDO', W / 2, H * 0.26, s, PALETA.perigo, 40);
  linha(ctx, jogo.causaMorte, W / 2, H * 0.26 + 26 * s, s, '#8d9ab5', 12);
  placar(ctx, jogo, W, s, H * 0.26 + 66 * s);
  const pisca = 0.5 + Math.sin(jogo.tempoEstado * 4) * 0.5;
  linha(ctx, '[R] cair de novo no mesmo planeta    [N] outro planeta', W / 2, H * 0.82, s, hexA(PALETA.ui, 0.55 + pisca * 0.45), 13, 700);
  ctx.textAlign = 'left';
}

export function telaVitoria(ctx, jogo) {
  const { largura: W, altura: H } = jogo.cam;
  const s = jogo.ui;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const k = clamp01(jogo.tempoEstado / 2);
  fundo(ctx, W, H, 0.35 + k * 0.5);
  titulo(ctx, 'ORBITA ALCANCADA', W / 2, H * 0.26, s, PALETA.ok, 38);
  linha(ctx, 'KOR-9 fica pra tras. O sinal volta a existir.', W / 2, H * 0.26 + 26 * s, s, '#8d9ab5', 12);
  placar(ctx, jogo, W, s, H * 0.26 + 66 * s);
  const d = jogo.save.dados;
  if (d.melhorTempo != null) {
    linha(ctx, `melhor fuga registrada: ${tempoStr(d.melhorTempo)}`, W / 2, H * 0.72, s, '#4d576c', 10);
  }
  const pisca = 0.5 + Math.sin(jogo.tempoEstado * 4) * 0.5;
  linha(ctx, '[N] cair em outro planeta    [R] repetir este', W / 2, H * 0.82, s, hexA(PALETA.ui, 0.55 + pisca * 0.45), 13, 700);
  ctx.textAlign = 'left';
}

/** Sobreposicao da queda: a capsula entrando na atmosfera. */
export function telaQueda(ctx, jogo) {
  const { largura: W, altura: H } = jogo.cam;
  const s = jogo.ui;
  const t = jogo.tempoEstado;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const brilho = clamp01(1 - t / 1.6);
  ctx.fillStyle = `rgba(255,${Math.round(140 + brilho * 80)},60,${brilho * 0.5})`;
  ctx.fillRect(0, 0, W, H);
  const fade = clamp01(1 - (t - 1.8) / 0.8);
  ctx.fillStyle = `rgba(6,5,11,${fade * 0.9})`;
  ctx.fillRect(0, 0, W, H);
  if (t < 2.4) {
    ctx.textAlign = 'center';
    ctx.font = `700 ${13 * s}px ui-monospace, monospace`;
    ctx.fillStyle = hexA('#ffd7b0', clamp01(1.6 - t));
    ctx.fillText('CAPSULA 7 — REENTRADA', W / 2, H * 0.5);
    ctx.font = `${11 * s}px ui-monospace, monospace`;
    ctx.fillStyle = hexA('#ff7a3d', clamp01(1.6 - t));
    ctx.fillText('CONTROLE PERDIDO · ALTITUDE CAINDO · SEGURE-SE', W / 2, H * 0.5 + 22 * s);
    ctx.textAlign = 'left';
  }
}
