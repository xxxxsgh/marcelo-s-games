/**
 * O jogo: maquina de estados, regras da missao e a ordem de desenho.
 *
 * Aqui mora tudo que os sistemas precisam saber uns dos outros — dano,
 * objetivos, ciclo dia/noite, exploracao do mapa. Os sistemas em si (mundo,
 * inimigos, itens, fx) nao se conhecem: falam com este objeto e so.
 */
import { GAME, CICLO, PALETA } from './config.js';
import { createRng } from './core/rng.js';
import { clamp, clamp01, lerp, smoothstep, dist2, tempoStr } from './core/mathx.js';
import { gerarMundo } from './world/gen.js';
import { createWorld } from './world/index.js';
import { createCamera } from './render/camera.js';
import { createLighting } from './render/lighting.js';
import { createFx } from './fx/index.js';
import { createJogador } from './entities/player.js';
import { createProjeteis } from './entities/projectiles.js';
import { createItens } from './entities/pickups.js';
import { createInimigos } from './entities/enemies.js';
import { createDiretor } from './entities/director.js';
import { desenharNave, desenharNinho, desenharCapsula, desenharJogador, desenharClarao } from './render/art.js';
import { desenharHud } from './ui/hud.js';
import { telaTitulo, telaPausa, telaMorte, telaVitoria, telaQueda } from './ui/screens.js';

const DURACAO_QUEDA = 2.8;

export function createJogo({ canvas, ctx, input, audio, save }) {
  const jogo = {
    canvas, ctx, input, audio, save,
    estado: 'titulo',
    tempo: 0, tempoEstado: 0,
    ui: 1,
    dificuldade: 0,
    nucleosEntregues: 0,
    capsulasAbertas: 0,
    inimigos: [],
    log: [],
    danosRecentes: [],
    acertoT: 0, acertoMorte: false, miraSobreInimigo: false,
    objetivoTexto: '',
    causaMorte: '',
    debug: false,
    stats: { fps: 0 },
  };

  jogo.fx = createFx();
  jogo.cam = createCamera();
  jogo.luz = createLighting();

  let seedAtual = String(Math.floor(Math.random() * 1e9));
  const luzes = [];

  // --------------------------------------------------------------- partida
  function novaPartida(seed) {
    seedAtual = String(seed ?? seedAtual);
    jogo.mapa = gerarMundo(seedAtual);
    jogo.mundo = createWorld(jogo.mapa);
    jogo.rngFx = createRng(`${seedAtual}|fx`);

    jogo.nave = {
      x: jogo.mapa.nave.x, y: jogo.mapa.nave.y,
      ang: jogo.rngFx.float(-0.5, 0.5), nucleos: 0, raio: 92,
    };
    jogo.ninhos = jogo.mapa.ninhos.map((n, i) => ({
      ...n, indice: i, raio: 62, vida: 800, vidaMax: 800,
      destruido: false, descoberto: false, flash: 0, relogio: jogo.rngFx.float(1, 4),
      filhos: 0, fase: jogo.rngFx.ang(), abrindo: 0,
    }));
    jogo.capsulas = jogo.mapa.capsulas.map((c) => ({
      ...c, aberta: false, descoberta: false,
      ang: jogo.rngFx.float(0, 6.28), fase: jogo.rngFx.float(0, 1),
    }));

    jogo.inimigos.length = 0;
    jogo.fx.limpar();
    jogo.log.length = 0;
    jogo.danosRecentes.length = 0;
    jogo.nucleosEntregues = 0;
    jogo.capsulasAbertas = 0;
    jogo.dificuldade = 0;
    jogo.tempo = 0;
    jogo.acertoT = 0;

    jogo.explorado = new Uint8Array(jogo.mapa.w * jogo.mapa.h);
    jogo.tilesNovos = [];
    ultimoExploradoX = -1e9; ultimoExploradoY = -1e9;

    // O jogador acorda ao lado da rampa da nave.
    const px = jogo.nave.x - Math.cos(jogo.nave.ang) * 130;
    const py = jogo.nave.y - Math.sin(jogo.nave.ang) * 130;
    jogo.jogador = createJogador(jogo, px, py);
    jogo.projeteis = createProjeteis(jogo);
    jogo.itens = createItens(jogo);
    jogo.enemies = createInimigos(jogo);
    jogo.diretor = createDiretor(jogo);
    jogo.cerco = jogo.diretor.cerco;

    jogo.cam.zoom = 1;
    jogo.cam.atualizar(jogo.fx);
    jogo.cam.irPara(jogo.nave.x, jogo.nave.y, jogo.mundo);

    jogo.faseDia = CICLO.inicio;
    jogo.ambiente = luzAmbiente(jogo.faseDia);
    jogo.noite = jogo.ambiente < (CICLO.ambienteDia + CICLO.ambienteNoite) / 2;

    save.registrarPartida(seedAtual);
    trocarEstado('queda');
    audio.tocar('queda', 1);
    jogo.fx.tremor(16);
    atualizarObjetivo();
  }

  function trocarEstado(novo) {
    jogo.estado = novo;
    jogo.tempoEstado = 0;
  }

  // -------------------------------------------------------------- utilidades
  jogo.mouseMundo = () => jogo.cam.telaParaMundo(input.mouse.x * jogo.ui, input.mouse.y * jogo.ui);
  jogo.miraTela = () => {
    if (input.dispositivo === 'pad') {
      return jogo.cam.mundoParaTela(jogo.jogador.mira.x, jogo.jogador.mira.y);
    }
    return { x: input.mouse.x * jogo.ui, y: input.mouse.y * jogo.ui };
  };

  jogo.mensagem = (txt, tipo = 'info') => {
    jogo.log.push({ txt, tipo, t: jogo.tempo });
    if (jogo.log.length > 8) jogo.log.shift();
  };

  /** Barulho acorda quem estiver perto, mesmo sem linha de visada. */
  jogo.barulho = (x, y, raio) => {
    const r2 = raio * raio;
    for (const e of jogo.inimigos) {
      if (e.morto) continue;
      if (dist2(e.x, e.y, x, y) > r2) continue;
      e.alvoX = x; e.alvoY = y;
      e.memoria = Math.max(e.memoria, 2.5);
      if (e.estado === 'vagando') { e.estado = 'cacando'; e.tempoEstado = 0; }
    }
  };

  // ------------------------------------------------------------------- dano
  jogo.danificarInimigo = (e, dano, ang, empurrao) => {
    const antes = e.vida;
    jogo.enemies.danificar(e, dano, ang, empurrao);
    if (antes > 0) {
      jogo.jogador.stats.acertos++;
      jogo.acertoT = 0.2;
      jogo.acertoMorte = e.morto;
      if (e.morto) jogo.fx.parar(e.chefe ? 0.14 : 0.035);
    }
  };

  jogo.danificarNinho = (n, dano) => {
    if (n.destruido) return;
    n.vida -= dano;
    n.flash = 0.06;
    jogo.jogador.stats.acertos++;
    jogo.acertoT = 0.2;
    jogo.acertoMorte = false;
    if (n.vida <= 0) destruirNinho(n);
  };

  function destruirNinho(n) {
    n.destruido = true;
    n.vida = 0;
    jogo.fx.explosao(n.x, n.y, 190, '#ff7ad4');
    jogo.fx.clarao(0.4, '#ff7ad4');
    jogo.fx.tremor(14);
    jogo.audio.tocar('explosao', 1);
    jogo.itens.criar('nucleo', n.x, n.y);
    jogo.mensagem('Ninho colapsado. Nucleo de plasma exposto.', 'ok');
    // O choque mata a ninhada mais fraca ao redor.
    for (const e of jogo.inimigos) {
      if (e.ninho === n && !e.chefe && dist2(e.x, e.y, n.x, n.y) < 260 * 260) {
        jogo.enemies.danificar(e, 90, Math.atan2(e.y - n.y, e.x - n.x), 320);
      }
    }
    atualizarObjetivo();
  }

  jogo.danificarJogador = (dano, fonte, continuo = false, origem = null) => {
    const jog = jogo.jogador;
    if (jog.morto || jogo.estado !== 'jogando') return false;
    if (jog.invul > 0 && !continuo) return false;

    let restante = dano;
    if (jog.escudo > 0) {
      const absorvido = Math.min(jog.escudo, restante);
      jog.escudo -= absorvido;
      restante -= absorvido;
      if (jog.escudo <= 0 && absorvido > 0) {
        jogo.audio.tocar('escudo', 0.8);
        jogo.fx.clarao(0.12, '#7cf6ff');
      }
    }
    jog.vida -= restante;
    jog.semDano = 0;
    jog.stats.danoTomado += dano;

    if (!continuo) {
      jog.invul = Math.max(jog.invul, 0.12);
      jogo.audio.tocar('dano', clamp01(0.35 + dano / 40));
      jogo.fx.tremor(clamp(dano * 0.22, 1, 7));
      if (origem) {
        jogo.danosRecentes.push({ ang: Math.atan2(origem.y - jog.y, origem.x - jog.x), t: jogo.tempo });
        if (jogo.danosRecentes.length > 6) jogo.danosRecentes.shift();
      }
    }
    if (jog.vida <= 0) morrer(fonte);
    return true;
  };

  function morrer(fonte) {
    const jog = jogo.jogador;
    jog.vida = 0;
    jog.morto = true;
    jogo.causaMorte = {
      acido: 'O traje cedeu no pantano acido.',
      contato: 'Eles chegaram perto demais.',
      cuspe: 'Acido na viseira. Fim.',
      explosao: 'Plasma detonado perto demais das proprias botas.',
      tiro: 'Perfuracao no traje. Sistemas offline.',
    }[fonte] || 'Sistemas offline.';
    jogo.fx.sangue(jog.x, jog.y, Math.random() * 6.28, 26, '#ff3d6e');
    jogo.fx.tremor(12);
    jogo.fx.clarao(0.35, '#ff3d6e');
    jogo.audio.tocar('morteJogador', 1);
    save.registrarFim({
      venceu: false, tempo: jogo.tempo,
      abates: jog.stats.mortes, nucleos: jogo.nucleosEntregues,
    });
    trocarEstado('morto');
  }

  jogo.explodir = (x, y, raio, dano, dono, cor) => {
    jogo.fx.explosao(x, y, raio, cor || '#ffb03a');
    jogo.audio.tocar('explosao', 0.8, Math.hypot(jogo.jogador.x - x, jogo.jogador.y - y));
    const r2 = raio * raio;
    if (dono === 'jogador') {
      for (const e of jogo.inimigos) {
        if (e.morto) continue;
        const d2 = dist2(e.x, e.y, x, y);
        if (d2 > r2) continue;
        const k = 1 - Math.sqrt(d2) / raio;
        jogo.danificarInimigo(e, dano * (0.35 + k * 0.65), Math.atan2(e.y - y, e.x - x), 420 * k);
      }
      for (const n of jogo.ninhos) {
        if (n.destruido) continue;
        if (dist2(n.x, n.y, x, y) > (raio + n.raio) ** 2) continue;
        jogo.danificarNinho(n, dano);
      }
    }
    // Explosao do jogador tambem machuca o jogador — plasma de perto e burrice.
    const dj = dist2(jogo.jogador.x, jogo.jogador.y, x, y);
    if (dj < r2) {
      const k = 1 - Math.sqrt(dj) / raio;
      jogo.danificarJogador(dano * 0.35 * k, 'explosao', false, { x, y });
    }
  };

  jogo.aoMatar = (e) => {
    jogo.jogador.stats.mortes++;
    jogo.itens.drop(e);
    if (e.ninho) e.ninho.filhos = Math.max(0, e.ninho.filhos - 1);
    if (e.chefe) {
      jogo.mensagem('A MAE caiu. O vale inteiro ouviu.', 'ok');
      jogo.diretor.cerco.rainhaViva = false;
    }
  };

  jogo.aoPegarNucleo = () => {
    jogo.mensagem('Leve o nucleo ate a nave. Nao pare de andar.', 'aviso');
  };

  jogo.alvosBussola = () => {
    const lista = [];
    const jog = jogo.jogador;
    if (jog.carregando || jogo.cerco.ativo) {
      lista.push({ x: jogo.nave.x, y: jogo.nave.y, rotulo: 'NAVE', cor: PALETA.ok });
      return lista;
    }
    for (const it of jogo.itens.lista) {
      if (it.tipo === 'nucleo') lista.push({ x: it.x, y: it.y, rotulo: 'NUCLEO', cor: PALETA.ok });
    }
    let maisPerto = null, melhor = Infinity;
    for (const n of jogo.ninhos) {
      if (n.destruido) continue;
      const d = dist2(n.x, n.y, jog.x, jog.y);
      if (n.descoberto) lista.push({ x: n.x, y: n.y, rotulo: 'NINHO', cor: PALETA.perigo });
      else if (d < melhor) { melhor = d; maisPerto = n; }
    }
    if (maisPerto && lista.length === 0) {
      lista.push({ x: maisPerto.x, y: maisPerto.y, rotulo: 'SINAL', cor: PALETA.aviso });
    }
    return lista;
  };

  function atualizarObjetivo() {
    const vivos = jogo.ninhos.filter((n) => !n.destruido).length;
    if (jogo.cerco.ativo) jogo.objetivoTexto = 'DEFENDA A NAVE ATE A DECOLAGEM';
    else if (jogo.jogador?.carregando) jogo.objetivoTexto = 'LEVE O NUCLEO ATE A NAVE';
    else if (jogo.nucleosEntregues >= 3) jogo.objetivoTexto = 'REATOR COMPLETO';
    else jogo.objetivoTexto = `RECUPERE OS NUCLEOS  ·  ${vivos} NINHO${vivos === 1 ? '' : 'S'} ATIVO${vivos === 1 ? '' : 'S'}`;
  }

  function entregarNucleo() {
    const jog = jogo.jogador;
    jog.carregando = false;
    jogo.nucleosEntregues++;
    jogo.dificuldade = jogo.nucleosEntregues;
    jogo.nave.nucleos = jogo.nucleosEntregues;
    jogo.fx.clarao(0.3, '#79ffd0');
    jogo.audio.tocar('entregar', 1);
    jog.curar(25);
    if (jogo.nucleosEntregues >= 3) {
      jogo.mensagem('Reator carregado. Iniciando sequencia de decolagem — 105 segundos.', 'perigo');
      jogo.diretor.iniciarCerco();
      jogo.audio.tocar('alarme', 1);
    } else {
      jogo.mensagem(`Nucleo ${jogo.nucleosEntregues}/3 instalado. O traje foi remendado.`, 'ok');
    }
    atualizarObjetivo();
  }

  jogo.decolar = () => {
    const jog = jogo.jogador;
    jogo.fx.explosao(jogo.nave.x, jogo.nave.y, 260, '#79ffd0');
    jogo.fx.clarao(0.8, '#ffffff');
    jogo.audio.tocar('decolagem', 1);
    jogo.audio.tocar('vitoria', 1);
    save.registrarFim({
      venceu: true, tempo: jogo.tempo,
      abates: jog.stats.mortes, nucleos: jogo.nucleosEntregues,
    });
    trocarEstado('vitoria');
  };

  // ------------------------------------------------------------- exploracao
  let ultimoExploradoX = -1e9, ultimoExploradoY = -1e9;
  function explorar() {
    const jog = jogo.jogador;
    if (Math.abs(jog.x - ultimoExploradoX) < 18 && Math.abs(jog.y - ultimoExploradoY) < 18) return;
    ultimoExploradoX = jog.x; ultimoExploradoY = jog.y;
    const { w, h, tile } = jogo.mapa;
    const raio = 9;
    const tx = Math.floor(jog.x / tile), ty = Math.floor(jog.y / tile);
    for (let y = Math.max(0, ty - raio); y <= Math.min(h - 1, ty + raio); y++) {
      for (let x = Math.max(0, tx - raio); x <= Math.min(w - 1, tx + raio); x++) {
        if ((x - tx) ** 2 + (y - ty) ** 2 > raio * raio) continue;
        const i = y * w + x;
        if (jogo.explorado[i]) continue;
        jogo.explorado[i] = 1;
        jogo.tilesNovos.push(i);
      }
    }
  }

  // ------------------------------------------------------------- ciclo do dia
  function luzAmbiente(fase) {
    // 0.00 amanhecer · 0.25 meio-dia · 0.5 entardecer · 0.75 madrugada
    const noite = CICLO.ambienteNoite, dia = CICLO.ambienteDia;
    if (fase < 0.08) return lerp(noite, dia, smoothstep(fase / 0.08));
    if (fase < 0.45) return dia;
    if (fase < 0.60) return lerp(dia, noite, smoothstep((fase - 0.45) / 0.15));
    if (fase < 0.92) return noite;
    return lerp(noite, dia, smoothstep((fase - 0.92) / 0.08));
  }

  // --------------------------------------------------------------- simulacao
  function simular(dt) {
    const jog = jogo.jogador;

    jogo.tempo += dt;
    jogo.faseDia = (CICLO.inicio + jogo.tempo / CICLO.duracao) % 1;
    jogo.ambiente = luzAmbiente(jogo.faseDia);
    const eraNoite = jogo.noite;
    jogo.noite = jogo.ambiente < (CICLO.ambienteDia + CICLO.ambienteNoite) / 2;
    if (jogo.noite && !eraNoite) {
      jogo.mensagem('A luz foi embora. Eles ficam mais corajosos no escuro.', 'aviso');
      jogo.audio.tocar('alarme', 0.5);
    } else if (!jogo.noite && eraNoite) {
      jogo.mensagem('Amanheceu. A pressao diminui — por enquanto.', 'ok');
    }

    jog.update(dt, input);
    jogo.enemies.atualizar(dt);
    jogo.projeteis.update(dt);
    jogo.itens.atualizar(dt);
    jogo.diretor.atualizar(dt);
    jogo.fx.update(dt);
    explorar();

    if (jogo.acertoT > 0) jogo.acertoT -= dt;

    // ninhos: descoberta e brilho
    for (const n of jogo.ninhos) {
      if (n.flash > 0) n.flash -= dt;
      if (!n.descoberto && !n.destruido) {
        const d = Math.hypot(jog.x - n.x, jog.y - n.y);
        if (d < 780 && jogo.mundo.linhaLivre(jog.x, jog.y, n.x, n.y)) {
          n.descoberto = true;
          jogo.mensagem('Ninho localizado. Queime-o e pegue o nucleo.', 'perigo');
          jogo.audio.tocar('alarme', 0.6);
        }
      }
    }

    // capsulas de suprimento
    for (const c of jogo.capsulas) {
      const d2 = dist2(jog.x, jog.y, c.x, c.y);
      if (!c.descoberta && d2 < 620 * 620 && jogo.mundo.linhaLivre(jog.x, jog.y, c.x, c.y)) {
        c.descoberta = true;
      }
      if (!c.aberta && d2 < 46 * 46) {
        c.aberta = true;
        jogo.itens.abrirCapsula(c);
        jogo.capsulasAbertas++;
        jogo.audio.tocar('armaNova', 0.6);
        jogo.mensagem('Capsula de suprimento aberta.', 'ok');
        jogo.fx.fumaca(c.x, c.y, 6, 'rgba(180,170,200,', 0.8);
      }
    }

    // entrega na nave
    if (jog.carregando && dist2(jog.x, jog.y, jogo.nave.x, jogo.nave.y) < 120 * 120) {
      entregarNucleo();
    }

    // camera
    jogo.cam.seguir(jog, jog.mira.x, jog.mira.y, dt, jogo.mundo);

    // a mira esta em cima de alguem?
    const m = jogo.mouseMundo();
    jogo.miraSobreInimigo = false;
    for (const e of jogo.inimigos) {
      if (dist2(m.x, m.y, e.x, e.y) < (e.raio + 6) ** 2) { jogo.miraSobreInimigo = true; break; }
    }

    // audio ambiente
    const perigoVida = jog.vida / jog.vidaMax < 0.35 ? clamp01(1 - jog.vida / (jog.vidaMax * 0.35)) : 0;
    audio.atualizar(dt, {
      intensidade: clamp01((jogo.cerco.ativo ? 1 : 0) + jogo.inimigosPerto() / 12),
      noite: jogo.noite ? 1 : 0,
      perigo: perigoVida,
    });
  }

  jogo.inimigosPerto = () => {
    let n = 0;
    for (const e of jogo.inimigos) {
      if (dist2(e.x, e.y, jogo.jogador.x, jogo.jogador.y) < 700 * 700) n++;
    }
    return n;
  };

  // ------------------------------------------------------------------ teclas
  function teclasGlobais() {
    if (input.pressed('KeyM')) {
      const lig = audio.alternar();
      save.audioLigado = lig;
      jogo.mensagem(`Som ${lig ? 'ligado' : 'mudo'}.`);
    }
    if (input.pressed('F3')) jogo.debug = !jogo.debug;
    if (input.pressed('Minus')) jogo.cam.zoom = clamp(jogo.cam.zoom - 0.12, GAME.zoomMin, GAME.zoomMax);
    if (input.pressed('Equal')) jogo.cam.zoom = clamp(jogo.cam.zoom + 0.12, GAME.zoomMin, GAME.zoomMax);
  }

  // ------------------------------------------------------------------- passo
  jogo.passo = function passo(dt) {
    input.beginStep();
    jogo.tempoEstado += dt;
    teclasGlobais();

    switch (jogo.estado) {
      case 'titulo': {
        jogo.tempo += dt;
        jogo.fx.update(dt);
        if (input.pressed('KeyS')) {
          novaPartida(String(Math.floor(Math.random() * 1e9)));
          trocarEstado('titulo');
        }
        if (input.pressed('Enter') || input.pressed('Space') || input.mouse.cliqueEsq) {
          audio.retomar();
          novaPartida(seedAtual);
        }
        break;
      }
      case 'queda': {
        jogo.fx.update(dt);
        const k = clamp01(jogo.tempoEstado / DURACAO_QUEDA);
        jogo.cam.zoom = lerp(1.9, 1, smoothstep(k));
        jogo.cam.irPara(
          lerp(jogo.nave.x, jogo.jogador.x, smoothstep(k)),
          lerp(jogo.nave.y, jogo.jogador.y, smoothstep(k)),
          jogo.mundo,
        );
        if (jogo.tempoEstado > DURACAO_QUEDA) {
          trocarEstado('jogando');
          jogo.cam.zoom = 1;
          jogo.fx.explosao(jogo.nave.x, jogo.nave.y, 120, '#ffb03a');
          jogo.mensagem('AURA: sistemas em modo minimo. Voce sobreviveu a queda.', 'ok');
          jogo.mensagem('AURA: o reator precisa de tres nucleos de plasma. Estao nos ninhos.', 'aviso');
        }
        break;
      }
      case 'jogando': {
        if (input.pressed('Escape')) { trocarEstado('pausa'); jogo.audio.tocar('ui'); break; }
        // hitstop: o mundo congela por instantes no abate — o soco fica melhor
        if (jogo.fx.hitstop > 0) { jogo.fx.update(dt); break; }
        simular(dt);
        break;
      }
      case 'pausa': {
        if (input.pressed('Escape')) { trocarEstado('jogando'); jogo.audio.tocar('ui'); }
        if (input.pressed('KeyR')) novaPartida(seedAtual);
        if (input.pressed('KeyN')) novaPartida(String(Math.floor(Math.random() * 1e9)));
        break;
      }
      case 'morto':
      case 'vitoria': {
        jogo.fx.update(dt);
        jogo.enemies.atualizar(dt);
        jogo.projeteis.update(dt);
        jogo.cam.seguir(jogo.jogador, jogo.jogador.x, jogo.jogador.y, dt, jogo.mundo);
        if (jogo.tempoEstado > 1) {
          if (input.pressed('KeyR')) novaPartida(seedAtual);
          if (input.pressed('KeyN') || input.pressed('Enter')) novaPartida(String(Math.floor(Math.random() * 1e9)));
        }
        break;
      }
      default: break;
    }

    input.endStep();
  };

  // ------------------------------------------------------------------ desenho
  function coletarLuzes() {
    luzes.length = 0;
    jogo.mundo.luzesTerreno(jogo.cam, luzes);
    jogo.jogador.luzes(luzes);
    jogo.enemies.luzes(luzes);
    jogo.itens.luzes(luzes);
    jogo.projeteis.luzes(luzes);
    jogo.fx.luzes(luzes);
    // nave e ninhos
    luzes.push({ x: jogo.nave.x, y: jogo.nave.y, r: 320, cor: jogo.nucleosEntregues >= 3 ? '#79ffd0' : '#ffb03a', i: 0.55 });
    for (const n of jogo.ninhos) {
      if (n.destruido || !jogo.cam.visivel(n.x, n.y, 200)) continue;
      luzes.push({ x: n.x, y: n.y, r: 220, cor: '#ff3d6e', i: 0.45 });
    }
    for (const c of jogo.capsulas) {
      if (c.aberta || !jogo.cam.visivel(c.x, c.y, 100)) continue;
      luzes.push({ x: c.x, y: c.y, r: 90, cor: '#ffb03a', i: 0.4 });
    }
    return luzes;
  }

  jogo.render = function render() {
    const { cam } = jogo;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, cam.largura, cam.altura);

    if (jogo.estado === 'titulo' && !jogo.mundo) {
      telaTitulo(ctx, jogo);
      return;
    }

    cam.atualizar(jogo.fx);
    cam.aplicar(ctx);

    // 1. terreno e manchas
    jogo.mundo.desenhar(ctx, cam);
    jogo.fx.desenharChao(ctx);

    // 2. cenario
    for (const c of jogo.capsulas) {
      if (cam.visivel(c.x, c.y, 40)) desenharCapsula(ctx, c, jogo.tempo);
    }
    for (const n of jogo.ninhos) {
      if (!n.destruido && cam.visivel(n.x, n.y, n.raio + 40)) desenharNinho(ctx, n, jogo.tempo);
    }
    if (cam.visivel(jogo.nave.x, jogo.nave.y, 140)) desenharNave(ctx, jogo.nave, jogo.tempo);

    // 3. itens
    jogo.itens.desenhar(ctx);

    // 4. corpos ordenados por Y (quem esta mais ao sul desenha por cima)
    const corpos = [];
    for (const e of jogo.inimigos) if (cam.visivel(e.x, e.y, e.raio + 30)) corpos.push(e);
    if (jogo.estado !== 'queda') corpos.push(jogo.jogador);
    corpos.sort((a, b) => a.y - b.y);
    for (const c of corpos) {
      if (c === jogo.jogador) {
        if (!jogo.jogador.morto) desenharJogador(ctx, jogo.jogador, jogo.tempo);
      } else jogo.enemies.desenharUm(ctx, c);
    }

    // 5. tiros, clarao de cano e particulas
    jogo.projeteis.desenhar(ctx);
    const jog = jogo.jogador;
    if (jog.claraoT > 0 && !jog.morto) {
      desenharClarao(ctx, jog.x + Math.cos(jog.ang) * 27, jog.y + Math.sin(jog.ang) * 27, jog.ang, jog.claraoTam, jog.claraoCor);
    }
    jogo.fx.desenhar(ctx);
    jogo.fx.desenharTextos(ctx, cam.escala);

    // 6. luz
    jogo.luz.render(ctx, cam, jogo.ambiente ?? 1, coletarLuzes(),
      jogo.estado === 'jogando' || jogo.estado === 'pausa' ? jog.lanterna() : null);

    // 7. interface
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (jogo.estado === 'jogando' || jogo.estado === 'pausa') desenharHud(ctx, jogo);
    if (jogo.estado === 'queda') telaQueda(ctx, jogo);
    if (jogo.estado === 'pausa') telaPausa(ctx, jogo);
    if (jogo.estado === 'morto') telaMorte(ctx, jogo);
    if (jogo.estado === 'vitoria') telaVitoria(ctx, jogo);
    if (jogo.estado === 'titulo') telaTitulo(ctx, jogo);
    if (jogo.debug) painelDebug();
  };

  function painelDebug() {
    const s = jogo.ui;
    const linhas = [
      `fps ${jogo.stats.fps.toFixed(0)}  sim ${jogo.stats.simMs?.toFixed(2) ?? '-'}ms  render ${jogo.stats.renderMs?.toFixed(2) ?? '-'}ms`,
      `inimigos ${jogo.inimigos.length}  balas ${jogo.projeteis.contagem}  particulas ${jogo.fx.contagem}  itens ${jogo.itens.lista.length}`,
      `jogador ${jogo.jogador.x.toFixed(0)},${jogo.jogador.y.toFixed(0)}  tile ${jogo.mundo.tileMundo(jogo.jogador.x, jogo.jogador.y)}  bioma ${jogo.mundo.biomaEm(jogo.jogador.x, jogo.jogador.y)}`,
      `ambiente ${(jogo.ambiente ?? 1).toFixed(2)}  fase ${(jogo.faseDia ?? 0).toFixed(2)}  seed ${jogo.mapa.seed}  t ${tempoStr(jogo.tempo)}`,
    ];
    ctx.font = `${10 * s}px ui-monospace, monospace`;
    const w = 430 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10 * s, jogo.cam.altura - (18 + linhas.length * 13) * s, w, (linhas.length * 13 + 10) * s);
    ctx.fillStyle = '#79ffd0';
    for (let i = 0; i < linhas.length; i++) {
      ctx.fillText(linhas[i], 16 * s, jogo.cam.altura - (10 + (linhas.length - 1 - i) * 13) * s);
    }
  }

  // ------------------------------------------------------------------- setup
  jogo.redimensionar = (larguraPx, alturaPx, dpr) => {
    jogo.ui = dpr;
    jogo.cam.redimensionar(larguraPx, alturaPx);
    jogo.luz.redimensionar(larguraPx, alturaPx);
    if (jogo.mundo) jogo.cam.atualizar(jogo.fx);
  };

  jogo.novaPartida = novaPartida;
  jogo.irParaTitulo = () => { trocarEstado('titulo'); };
  jogo.pausar = () => { if (jogo.estado === 'jogando') trocarEstado('pausa'); };
  Object.defineProperty(jogo, 'seed', { get: () => seedAtual });

  return jogo;
}
