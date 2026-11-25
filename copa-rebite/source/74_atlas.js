// ---------- atlas procedural (canvas 2D -> textura): adesivos, numeros, faixas, placar ----------
const FONT = '"Bahnschrift","DIN Condensed","Arial Narrow","Liberation Sans Narrow",Impact,sans-serif';
const PATROS = ['KORVA ÓLEOS', 'TORQUE 9', 'FAGULHA SOLDAS', 'MOLA & CIA', 'VOLT-RÃ', 'ZINCO NORTE', 'PARAFUSOS IRMÃOS LUME', 'BORRACHARIA DO EIXO'];
const Atlas = {
  cv: null, g: null, dirty: false,
  init() { this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = 2048; this.g = this.cv.getContext('2d'); this.statics(); this.score('—', '—', 'COPA REBITE', '', 0, 1); },
  css(c, k) { k = k === undefined ? 1 : k; const f = v => Math.round(255 * Math.pow(clamp(v * k, 0, 1), 1 / 2.2)); return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`; },
  txt(s, x, y, px, col, align, w, weight) { const g = this.g; g.font = `${weight || 700} ${px}px ${FONT}`; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillStyle = col; if (w) { const m = g.measureText(s).width; if (m > w) { g.save(); g.translate(x, y); g.scale(w / m, 1); g.fillText(s, 0, 0); g.restore(); return; } } g.fillText(s, x, y); },
  gear(x, y, r, col, teeth) { const g = this.g; g.fillStyle = col; g.beginPath(); const n = teeth || 10; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, rr = (i & 1) ? r : r * .8; g.lineTo(x + Math.cos(a - .08) * rr, y + Math.sin(a - .08) * rr); g.lineTo(x + Math.cos(a + .08) * rr, y + Math.sin(a + .08) * rr); } g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, r * .42, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; },
  logo(x, y, s, light) { const g = this.g; this.gear(x - 205 * s, y, 58 * s, light ? '#f2b21c' : '#f2b21c', 9); g.fillStyle = '#d8dde2'; g.beginPath(); g.arc(x - 205 * s, y, 14 * s, 0, TAU); g.fill(); this.txt('COPA', x + 30 * s, y - 34 * s, 44 * s, '#f2b21c', 'center', 0, 400); this.txt('REBITE', x + 30 * s, y + 18 * s, 92 * s, light ? '#f4f6f8' : '#f4f6f8', 'center', 0, 800); },
  statics() {
    const g = this.g; g.clearRect(0, 0, 2048, 2048);
    // 1: faixa do logo (0,1536,1024x256)
    g.fillStyle = '#0c0f14'; g.fillRect(0, 1536, 1024, 256); g.fillStyle = '#f2b21c'; g.fillRect(0, 1536, 1024, 10); g.fillRect(0, 1782, 1024, 10); this.logo(512, 1664, 1.5);
    // 2 e 3: faixas de patrocinio (0,1792 / 0,1920, 1024x128)
    for (let r = 0; r < 2; r++) { const y = 1792 + r * 128; g.fillStyle = r ? '#e9e6dc' : '#10151c'; g.fillRect(0, y, 1024, 128); for (let i = 0; i < 4; i++) { const cx = 128 + i * 256, nm = PATROS[(i + r * 4) % 8]; g.fillStyle = ['#c2281b', '#1d4fb0', '#f2b21c', '#2c8a43'][(i + r) % 4]; if ((i + r) % 2) { g.beginPath(); g.moveTo(cx - 100, y + 96); g.lineTo(cx - 80, y + 30); g.lineTo(cx + 100, y + 30); g.lineTo(cx + 80, y + 96); g.fill(); this.txt(nm, cx, y + 64, 34, '#fff', 'center', 150); } else { g.fillRect(cx - 104, y + 88, 208, 8); this.txt(nm, cx, y + 56, 40, r ? '#10151c' : '#f4f6f8', 'center', 200, 800); } } }
    // 4: mesa dos juizes (1024,0,512x128)
    g.fillStyle = '#10151c'; g.fillRect(1024, 0, 512, 128); g.fillStyle = '#f2b21c'; g.fillRect(1024, 0, 512, 8); this.txt('JUÍZES', 1150, 68, 64, '#f4f6f8', 'center', 0, 800); this.gear(1290, 66, 34, '#f2b21c', 9); this.txt('COPA REBITE', 1420, 68, 36, '#f2b21c', 'center', 190);
    // 5: monitor dos juizes (1536,0,256x128)
    g.fillStyle = '#06131f'; g.fillRect(1536, 0, 256, 128); g.fillStyle = '#1d9bd6'; for (let i = 0; i < 5; i++) g.fillRect(1552, 16 + i * 22, 60 + ((i * 53) % 150), 10); g.fillStyle = '#f2b21c'; g.fillRect(1552, 4, 224, 6);
    // 6 e 7: fundo dos boxes (1024,128 / 1024,384, 512x256)
    for (let r = 0; r < 2; r++) { const y = 128 + r * 256; g.fillStyle = r ? '#0c2a66' : '#6b130e'; g.fillRect(1024, y, 512, 256); g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(1024 + i * 60, y); g.lineTo(1054 + i * 60, y); g.lineTo(994 + i * 60, y + 256); g.lineTo(964 + i * 60, y + 256); g.fill(); } this.txt(r ? 'BOXE AZUL' : 'BOXE VERMELHO', 1280, y + 90, 76, '#f4f6f8', 'center', 440, 800); this.txt(PATROS[r * 3 + 1] + '  ·  ' + PATROS[r * 3 + 2], 1280, y + 180, 34, '#f2b21c', 'center', 440); }
    // 8: cartaz da garagem (1536,128,512x512)
    g.fillStyle = '#e9e6dc'; g.fillRect(1536, 128, 512, 512); g.fillStyle = '#10151c'; g.fillRect(1552, 144, 480, 480); this.gear(1792, 330, 120, '#f2b21c', 11); g.fillStyle = '#c2281b'; g.fillRect(1552, 470, 480, 70); this.txt('TORNEIO ELIMINATÓRIO', 1792, 506, 44, '#fff', 'center', 440, 800); this.txt('8 ROBÔS · 1 CAMPEÃO', 1792, 580, 36, '#e9e6dc', 'center', 420);
    this.txt('COPA REBITE', 1792, 180, 40, '#f2b21c', 'center', 420, 800);
    this.dirty = true;
  },
  // adesivos do robo no encaixe slot (0 ou 1): topo 512x352 + lateral 512x160
  robot(slot, nome, num, cor) {
    const g = this.g, x0 = slot * 512; g.clearRect(x0, 0, 512, 512); g.save(); g.beginPath(); g.rect(x0, 0, 512, 512); g.clip();
    const lum = cor[0] * .3 + cor[1] * .6 + cor[2] * .1, ink = lum > .35 ? '#0b0d10' : '#f2f2ee', acc = lum > .35 ? '#0b0d10' : '#f2b21c';
    // topo: +X do robo = direita do canvas, +Z = baixo. numero na traseira, nome ao longo
    g.fillStyle = ink; g.beginPath(); g.arc(x0 + 96, 176, 64, 0, TAU); g.fill(); this.txt(String(num), x0 + 96, 180, 86, lum > .35 ? '#f2f2ee' : '#0b0d10', 'center', 100, 800);
    g.fillStyle = acc; g.fillRect(x0 + 180, 40, 300, 12); g.fillRect(x0 + 180, 300, 300, 12);
    g.save(); g.translate(x0 + 330, 300 - 24); this.txt(nome.toUpperCase(), 0, 0, 40, ink, 'center', 280, 800); g.restore();
    g.fillStyle = ink; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x0 + 190 + i * 30, 96); g.lineTo(x0 + 204 + i * 30, 96); g.lineTo(x0 + 190 + i * 30, 66); g.lineTo(x0 + 176 + i * 30, 66); g.fill(); }
    this.gear(x0 + 440, 84, 26, acc, 8); g.fillStyle = '#f2f2ee'; g.fillRect(x0 + 380, 120, 110, 40); this.txt(PATROS[(num + slot) % 8].split(' ')[0], x0 + 435, 141, 22, '#0b0d10', 'center', 100, 800);
    g.strokeStyle = '#f2b21c'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 30, 310); g.lineTo(x0 + 56, 266); g.lineTo(x0 + 82, 310); g.closePath(); g.stroke(); this.txt('!', x0 + 56, 296, 26, '#f2b21c', 'center', 0, 800);
    // lateral
    const y1 = 352; g.fillStyle = ink; g.fillRect(x0 + 196, y1 + 24, 120, 112); this.txt(String(num), x0 + 256, y1 + 84, 96, lum > .35 ? '#f2f2ee' : '#0b0d10', 'center', 100, 800);
    this.txt(nome.toUpperCase(), x0 + 420, y1 + 110, 30, ink, 'center', 150, 800); g.fillStyle = acc; g.fillRect(x0 + 20, y1 + 120, 150, 10);
    g.restore(); this.dirty = true;
  },
  // placar (0,1024,1024x512)
  score(a, b, top, sub, ca, cb) {
    const g = this.g, y = 1024; g.fillStyle = '#04070b'; g.fillRect(0, y, 1024, 512); g.fillStyle = '#f2b21c'; g.fillRect(0, y, 1024, 14);
    this.txt(top, 512, y + 70, 58, '#f2b21c', 'center', 900, 800);
    g.fillStyle = typeof ca === 'object' ? this.css(ca, 1.4) : '#c2281b'; g.fillRect(40, y + 130, 430, 230); g.fillStyle = typeof cb === 'object' ? this.css(cb, 1.4) : '#1d4fb0'; g.fillRect(554, y + 130, 430, 230);
    this.txt(a, 255, y + 245, 90, '#fff', 'center', 400, 800); this.txt(b, 769, y + 245, 90, '#fff', 'center', 400, 800); this.txt('×', 512, y + 245, 80, '#f4f6f8', 'center', 0, 400);
    this.txt(sub, 512, y + 440, 64, '#f4f6f8', 'center', 940, 700); this.dirty = true;
  },
  flush() { if (this.dirty && R.ok) { R.uploadAtlas(this.cv); this.dirty = false; } },
};
