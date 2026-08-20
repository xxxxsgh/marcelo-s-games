# SINAL PERDIDO

Shooter 2D de visao de cima. A **Capsula 7** cai em KOR-9, um vale que ninguem
mapeou. A nave ainda voa — falta energia. Os tres nucleos de plasma que o
reator precisa estao dentro dos ninhos, e os ninhos nao gostam de visita.

Canvas 2D + Vite, saida estatica, **zero dependencia em runtime**: terreno,
bichos, som e efeitos sao todos gerados em codigo. Nenhuma imagem, nenhum
arquivo de audio, nenhum download.

```bash
npm install
npm run dev        # http://127.0.0.1:5174
npm run build      # dist/ estatico
npm run preview    # serve o dist
npm run smoke      # joga sozinho num Chromium e falha se algo quebrar
npm run sim        # roda so a simulacao no Node (sem navegador), minutos de partida em segundos
npm run shots      # capturas encenadas em shots/ (dia, noite, ninho, rainha)
```

---

## Como se joga

Voce acorda ao lado dos destrocos. A partir dai o laco e sempre o mesmo:

1. **Ache um ninho** — a bussola aponta o `SINAL` mais proximo enquanto voce
   nao tiver nada melhor pra fazer.
2. **Queime o ninho** — 800 de vida. Enquanto ele estiver de pe, cospe bicho.
3. **Pegue o nucleo** e volte pra nave. Carregando, voce anda mais devagar e o
   planeta manda mais gente. O caminho de volta e sempre pior que o de ida.
4. **Tres nucleos** ligam o reator e comecam a decolagem: **105 segundos** de
   cerco, com ondas crescentes e a **MAE** vindo cobrar o roubo.
5. Sobreviva ate o zero e o planeta fica pra tras.

Pelo caminho tem **capsulas de suprimento** (a primeira sempre tem arma nova),
**pocas de acido** que queimam quem pisa, e o **ciclo dia/noite**: no escuro
eles ficam mais corajosos e nascem mais rapido.

---

## Controles

| Tecla | Acao |
|---|---|
| `WASD` / setas | Mover |
| Mouse | Mirar |
| Clique esquerdo | Atirar (segurar so funciona nas automaticas) |
| `Espaco` | Esquiva com invulnerabilidade curta |
| `R` | Recarregar (tambem recarrega sozinho com o pente vazio) |
| `1` `2` `3` `4` / `Q` / roda | Trocar de arma |
| `F` | Coronhada — empurra e machuca de perto, sem gastar bala |
| `L` | Lanterna |
| `Esc` | Pausa |
| `M` | Som ligado/mudo |
| `-` / `=` | Zoom |
| `F3` | Diagnostico (fps, contagens, bioma, semente) |

Gamepad tambem funciona: stick esquerdo anda, stick direito mira, gatilho
atira, `A`/`B` esquiva, `X` recarrega, `Y` troca de arma.

---

## Arsenal

| Arma | Perfil | Municao |
|---|---|---|
| **Pistola de servico** | Semi-auto, 14 no pente, reserva **infinita** | `CAL .30` |
| **Espingarda de mineracao** | 9 bagos, brutal a queima-roupa, 6 no pente | `CARTUCHO` |
| **Fuzil de pulso NV-4** | Automatico, 32 no pente, alcance longo | `PULSO` |
| **Lanca-plasma MK II** | Projetil lento com estouro em area — cuidado com o coice | `CELULA` |

A pistola nunca fica sem reserva de proposito: ficar desarmado num planeta
hostil nao e tensao, e castigo.

---

## A fauna

| Bicho | Como se comporta | Como se mata |
|---|---|---|
| **Rastejante** | Corre em bando e da saltos curtos pra fechar distancia | Qualquer coisa, mas nunca vem sozinho |
| **Cuspidor** | Mantem distancia e cospe acido; o saco brilha antes do tiro | Feche a distancia ou puna a carga |
| **Ariete** | Prepara, brilha e investe a 660 u/s; se bater na pedra, se atordoa | Deixe ele errar e ataque o flanco |
| **Enxame** | Voa por cima das pedras em espiral, em grupos de 3 a 6 | Espingarda; um a um e desespero |
| **A MAE** | So aparece no cerco: salva de acido, ninhada e massa | Plasma, espaco e paciencia |

O acido do pantano tambem machuca eles. Da pra usar isso.

---

## Parametros de URL

| Parametro | Efeito |
|---|---|
| `?seed=algumacoisa` | Gera um vale especifico (a semente aparece no titulo e na pausa) |
| `?luz=0.35` | Baixa a resolucao da camada de luz (GPU fraca); `1` deixa nitida |
| `?dpr=1` | Forca o device pixel ratio |

---

## Estrutura

```
src/
  main.js            boot: canvas, entrada, audio, loop
  game.js            maquina de estados, regras da missao, ordem de desenho
  config.js          todo numero que da "sensacao" ao jogo
  core/              loop de timestep fixo, rng deterministico, matematica, eventos
  input/             teclado + mouse + gamepad, com bordas consumidas no passo fixo
  world/gen.js       geracao do vale (biomas, rocha, acido, ninhos, corredores)
  world/index.js     colisao, linha de visada e cache de terreno por bloco
  entities/          jogador, inimigos, projeteis, itens, diretor de spawn
  combat/weapons.js  tabela de armas e municao
  render/            camera, arte procedural, camada de luz
  ui/                HUD, minimapa com neblina de guerra, telas
  audio/             sintese WebAudio (tiro, bicho, ambiente, batimento)
  fx/                particulas, manchas, tremor, hitstop
tools/
  smoke.mjs          joga sozinho num Chromium e falha se algo quebrar
  simtest.mjs        simulacao pura em Node, sem canvas: 180 s de cerco em 1,6 s
  shot.mjs           capturas encenadas pra revisar arte
```

Decisoes tecnicas e o porque de cada uma: [`DECISOES.md`](DECISOES.md).
