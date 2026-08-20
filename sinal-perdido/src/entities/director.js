/**
 * O diretor decide QUEM aparece, QUANDO e ONDE.
 *
 * Duas fontes de bicho: os ninhos (enquanto vivos, cospem quem estiver por
 * perto) e a pressao ambiente (nasce fora da tela, no anel ao redor do
 * jogador). A pressao sobe com a noite, com cada nucleo entregue e enquanto o
 * jogador carrega um nucleo — o planeta reage ao roubo, e o caminho de volta e
 * sempre pior que o de ida.
 */
import { DIRETOR, CERCO, BIOMA } from '../config.js';

/** Pesos por progresso; o bioma so tempera. */
function pesos(jogo, bioma) {
  const n = jogo.nucleosEntregues;
  const p = {
    rastejante: 6,
    enxame: 1.4 + n * 0.5,
    cuspidor: 1.2 + n * 0.9,
    ariete: 0.25 + n * 0.7,
  };
  if (bioma === BIOMA.PANTANO) p.cuspidor *= 2.1;
  if (bioma === BIOMA.PEDREGAL) p.ariete *= 2.2;
  if (bioma === BIOMA.FUNGAL) p.enxame *= 2.4;
  if (bioma === BIOMA.CRISTALINO) p.rastejante *= 1.3;
  return Object.entries(p);
}

export function createDiretor(jogo) {
  let relogio = 0;
  const cerco = { ativo: false, t: 0, proximaOnda: 0, onda: 0, rainhaViva: false };

  function tetoVivos() {
    let teto = DIRETOR.vivosBase + jogo.nucleosEntregues * DIRETOR.vivosPorNucleo;
    if (jogo.noite) teto += DIRETOR.vivosNoite;
    if (cerco.ativo) teto += 26;
    return teto;
  }

  function vivosDoAmbiente() {
    let n = 0;
    for (const e of jogo.inimigos) if (!e.morto && !e.ninho) n++;
    return n;
  }

  /** Ponto de nascimento fora do campo de visao. */
  function ondeNascer(rMin = DIRETOR.raioSpawnMin, rMax = DIRETOR.raioSpawnMax) {
    const jog = jogo.jogador;
    for (let i = 0; i < 22; i++) {
      const p = jogo.mundo.pontoLivre(jogo.rngFx, jog.x, jog.y, rMin, rMax, 3);
      if (!p) continue;
      if (jogo.cam.visivel(p.x, p.y, 160)) continue;
      return p;
    }
    return null;
  }

  function nascer(tipo, x, y, opts) {
    const e = jogo.enemies.criar(tipo, x, y, opts);
    e.estado = 'cacando';
    e.alvoX = jogo.jogador.x; e.alvoY = jogo.jogador.y;
    e.memoria = 6;
    jogo.fx.fumaca(x, y, 4, 'rgba(130,110,150,', 0.7);
    return e;
  }

  function pressaoAmbiente(dt) {
    if (jogo.jogador.morto) return;
    relogio -= dt;
    if (relogio > 0) return;

    let intervalo = DIRETOR.intervaloBase / (1 + jogo.nucleosEntregues * 0.35);
    if (jogo.noite) intervalo *= 0.68;
    if (jogo.jogador.carregando) intervalo *= DIRETOR.fatorCarga;
    if (cerco.ativo) intervalo *= 0.45;
    relogio = intervalo * jogo.rngFx.float(0.75, 1.3);

    if (vivosDoAmbiente() >= tetoVivos()) return;

    const p = ondeNascer();
    if (!p) return;
    const bioma = jogo.mundo.biomaEm(p.x, p.y);
    const tipo = jogo.rngFx.weighted(pesos(jogo, bioma));
    // O enxame nunca vem sozinho.
    if (tipo === 'enxame') {
      const n = jogo.rngFx.int(3, 6);
      for (let i = 0; i < n; i++) {
        nascer('enxame', p.x + jogo.rngFx.float(-40, 40), p.y + jogo.rngFx.float(-40, 40));
      }
    } else {
      nascer(tipo, p.x, p.y);
    }
  }

  function ninhos(dt) {
    for (const n of jogo.ninhos) {
      if (n.destruido) continue;
      if (n.abrindo > 0) n.abrindo -= dt * 2;
      const d = Math.hypot(jogo.jogador.x - n.x, jogo.jogador.y - n.y);
      if (d > 1100) continue;
      n.relogio -= dt * (d < 420 ? 1.7 : 1);
      if (n.relogio > 0) continue;
      n.relogio = jogo.rngFx.float(3.4, 6.2);
      if (n.filhos >= 8) continue;
      const p = jogo.mundo.pontoLivre(jogo.rngFx, n.x, n.y, n.raio + 20, n.raio + 90, 8);
      if (!p) continue;
      const tipo = jogo.rngFx.weighted(pesos(jogo, n.bioma));
      const e = nascer(tipo, p.x, p.y, { ninho: n });
      n.filhos++;
      n.abrindo = 1;
      jogo.audio.tocar('ninhoCospe', 0.5, d);
    }
  }

  // ------------------------------------------------------------------ cerco
  function iniciarCerco() {
    cerco.ativo = true;
    cerco.t = CERCO.duracao;
    cerco.onda = 0;
    cerco.proximaOnda = 2;
    cerco.rainhaViva = false;
  }

  function onda() {
    cerco.onda++;
    const n = Math.min(4 + cerco.onda * 2, 12);
    for (let i = 0; i < n; i++) {
      const p = ondeNascer(420, 760) || jogo.mundo.pontoLivre(jogo.rngFx, jogo.jogador.x, jogo.jogador.y, 300, 700, 10);
      if (!p) continue;
      const tipo = jogo.rngFx.weighted([
        ['rastejante', 5],
        ['enxame', 2 + cerco.onda * 0.4],
        ['cuspidor', 1.5 + cerco.onda * 0.5],
        ['ariete', 0.6 + cerco.onda * 0.5],
      ]);
      nascer(tipo, p.x, p.y, { cerco: true });
    }
    jogo.audio.tocar('onda', 0.8);
    jogo.mensagem(`Onda ${cerco.onda}: leituras de massa se aproximando.`, 'perigo');
  }

  function cercoPasso(dt) {
    if (!cerco.ativo) return;
    cerco.t -= dt;
    cerco.proximaOnda -= dt;
    if (cerco.proximaOnda <= 0) {
      cerco.proximaOnda = CERCO.ondaIntervalo;
      onda();
    }
    if (!cerco.rainhaViva && CERCO.duracao - cerco.t > CERCO.rainhaEm) {
      const p = ondeNascer(560, 820) || jogo.mundo.pontoLivre(jogo.rngFx, jogo.jogador.x, jogo.jogador.y, 400, 800, 12);
      if (p) {
        const r = nascer('rainha', p.x, p.y, { cerco: true });
        r.percepcao = 4000;
        cerco.rainhaViva = true;
        jogo.mensagem('ALERTA: assinatura biologica massiva. A MAE veio buscar os nucleos.', 'perigo');
        jogo.audio.tocar('rugido', 1);
        jogo.fx.clarao(0.6, '#ff3d6e');
      }
    }
    if (cerco.t <= 0) {
      cerco.ativo = false;
      jogo.decolar();
    }
  }

  return {
    cerco,
    iniciarCerco,
    atualizar(dt) {
      pressaoAmbiente(dt);
      ninhos(dt);
      cercoPasso(dt);
    },
  };
}
