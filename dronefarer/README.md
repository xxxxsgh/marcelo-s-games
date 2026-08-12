# DRONEFARER

Simulador arcade de drone FPV em cidade aberta. Three.js + Vite, saida estatica,
alvo **PC** (teclado + mouse ou gamepad). Tudo gerado proceduralmente em
runtime — nenhum asset externo, nenhum download de textura ou modelo.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # dist/ estatico
npm run preview    # serve o dist
```

---

## Controles

### Voo
| Tecla | Acao |
|---|---|
| `W` / `S` | Acelerar / desacelerar (o throttle **segura**, nao volta ao centro) |
| `A` / `D` | Girar (yaw) esquerda / direita |
| `↑` / `↓` | Inclinar pra frente / pra tras (pitch) |
| `←` / `→` | Rolar esquerda / direita (roll) |
| `Shift` | Freio aerodinamico |
| `M` | Alterna **ANGLE** (auto-nivela) e **ACRO** (rotacao livre) |
| `C` | Alterna camera de **3a pessoa** e **FPV** |
| Mouse | Orbita a camera (clique na tela pra travar o ponteiro) |

### Corrida e missoes
| Tecla | Acao |
|---|---|
| `R` | Reinicia na hora (corrida ou missao) — sem menu, sem loading |
| `Tab` | Troca de circuito |
| `G` | Liga/desliga o fantasma do melhor tempo |
| `B` | Quadro de missoes e hangar |
| `T` | Respawn no ultimo ponto seguro |

### Mundo e ferramentas
| Tecla | Acao |
|---|---|
| `N` | Mapa em tela cheia (`+` / `-` dao zoom) |
| `L` | Farol (essencial em garagem e tunel) |
| `V` | Cicla o clima (limpo, chuva, neblina, vendaval, noite, noite com chuva) |
| `K` | Modo treino (sem risco de dano) |
| `P` | Photo mode (`WASD` move, `[` `]` foco, `;` `'` abertura, `Enter` salva PNG) |
| `F3` | Painel de debug (frametime, draw calls, chunks, colisores) |
| `Esc` | Opcoes (video, controles, audio, jogo) |

### Gamepad (Mode 2)
Stick esquerdo = throttle + yaw. Stick direito = pitch + roll.
`Y` alterna modo, `X` alterna camera, `B` reinicia, `LT` freia.

Deadzone, expo, sensibilidade, inversao de pitch, FOV e tilt da FPV sao todos
ajustaveis em `Esc → CONTROLES`, e as teclas sao regravaveis.

---

## Deploy no GitHub Pages

O `base` do Vite e configuravel por variavel de ambiente.

```bash
# Publicando em https://<usuario>.github.io/<repo>/
BASE_PATH=/marcelo-s-games/ npm run build
```

Sem `BASE_PATH` o build usa `base: './'` (caminhos relativos), que funciona em
qualquer subpasta — inclusive abrindo o `dist/index.html` direto.

Ha um workflow pronto em `.github/workflows/pages.yml`: qualquer push na branch
padrao builda e publica. Basta habilitar **Settings → Pages → Source: GitHub
Actions** no repositorio.

Deploy manual com a CLI do `gh-pages`, se preferir:

```bash
BASE_PATH=/marcelo-s-games/ npm run build
npx gh-pages -d dist
```

---

## Qualidade e desempenho

Quatro tiers detectados automaticamente por GPU, resolucao e memoria:
**alto / medio / baixo / minimo**. Da pra forcar por query param:

```
?q=alto        # forca o tier
?rs=1.5        # render scale (0.5 a 2.0) independente da janela
```

No menu (`Esc → VIDEO`) da pra escolher preset **e** ajustar item a item:
sombra (on/off, resolucao, distancia), GTAO, bloom (on/off e forca), motion
blur, SSR, volumetria, anti-aliasing (SMAA/FXAA/off), distancia de desenho,
detalhe do instancing e render scale.

Sem cap de framerate por padrao.

---

## Verificacao

```bash
node tools/smoke.mjs          # sobe o jogo num Chromium e valida ~35 itens
node tools/shot.mjs alto      # prints + medicao de luminancia por pose
node tools/shot.mjs alto centro,rua   # so as poses escolhidas
```

O smoke test cobre voo, ANGLE/ACRO, enquadramento da camera em quatro regimes,
crash e respawn, subsolo, os tres circuitos gate a gate, gravacao de recorde e
fantasma, streaming da cidade, distritos, sinal de radio, zona restrita,
recarga, as cinco familias de missao, trade-off do hangar, dano por partes,
clima, audio e presets de qualidade.

O `shot.mjs` mede luminancia media e fracao de pixels estourados por print —
calibrar exposicao no olho nao funciona.

> Os alvos de fps (60 em GPU integrada, 120+ em dedicada) **nao sao
> verificaveis** neste ambiente: o container so tem rasterizador de software.
> Precisam ser medidos numa maquina com GPU.

---

## Estrutura

```
src/
  config.js          toda constante de tuning (nada de numero magico solto)
  core/              loop de timestep fixo, tiers de qualidade, RNG, bus, matematica
  input/             teclado + gamepad + mouse, rebind, expo/deadzone
  drone/             fisica de voo, modelo visual, colisao/crash/bateria
  camera/            perseguicao com mola e FPV
  race/              gates, circuitos, fantasma, cronometro
  missions/          cinco tipos de missao
  hangar/            chassis e upgrades com trade-off
  damage/            dano por partes e reparo
  world/             colisao, quarteirao, cidade em chunks, distritos, clima, vida
  render/            ceu/environment, materiais, texturas, pipeline de pos-processamento
  ui/                mapa, quadro, opcoes, debug, photo mode
  audio/             motor, vento, doppler e musica — tudo sintetizado
```

Decisoes tecnicas e bugs encontrados estao em [`DECISOES.md`](./DECISOES.md).
