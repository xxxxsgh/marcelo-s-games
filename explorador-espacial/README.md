# EXOSONDA - simulador de exploracao espacial procedural

Arquivo unico (`index.html`), sem build step, sem npm. Three.js r185 vem por CDN
com import map + cascata de fallback. Abre com duplo clique (precisa de internet
para baixar o Three.js) e funciona em GitHub Pages.

## Como rodar

- **Duplo clique** em `index.html` (com internet).
- **Servidor local** (recomendado, habilita o Web Worker de terreno):
  `python3 -m http.server 8000` e abrir `http://localhost:8000/explorador-espacial/`.
- **Offline**: baixe `three.module.js` **e** `three.core.js` da versao 0.185.1
  (o build do r185 e dividido em dois arquivos) para esta pasta e abra
  `index.html?three=./three.module.js`.

## Controles

| Acao | Teclado / mouse | Toque |
|---|---|---|
| Empuxo frente / re | `W` / `S` | stick esquerdo (vertical) |
| Strafe lateral | `A` / `D` | stick esquerdo (horizontal) |
| Strafe vertical | `R` / `F` | - |
| Pitch / yaw | mouse ou setas | stick direito |
| Roll | `Q` / `E` | ROLL < > |
| Turbo (cruzeiro) | `Shift` | TURBO |
| Freio inercial | `X` | FREIO |
| Assistencia de pouso | `G` | POUSO |
| Trocar alvo | `T` | ALVO |
| Camera 3a pessoa / cabine | `C` | CAM |
| Menu / pausa | `M` | MENU |
| Travar ponteiro | `P` | - |
| Ocultar HUD | `H` | - |
| Tela cheia | `F` | - |

## O que esta implementado (MVP)

- Sistema estelar de 5 a 8 planetas com orbitas keplerianas reais (a, e, i, nodo,
  periastro, anomalia media resolvida por Newton-Raphson).
- Voo 6DOF com gravidade, arrasto atmosferico, dano de reentrada, pouso e
  recuperacao da sonda.
- Terreno procedural em quadtree sobre cubo-esfera, chunks gerados em Web Worker,
  pousavel em **todos** os planetas, sem tela de carregamento.
- Biomas, paletas, atmosfera, agua e temperatura derivados de uma unica semente.
- HUD diegetico, dois joysticks virtuais, safe-area do iPhone, PWA.
- Save/load em localStorage (autosave a cada 15 s).
- Bloom proprio, tres camaras em camadas e origem flutuante (ver comentarios no
  topo do arquivo para o tratamento do problema de escala em float32).

## Depuracao

`window.EXOSONDA` expoe o objeto do jogo no console (nave, universo, carga de
terreno, renderer). Util para posicionar a nave em qualquer planeta:

```js
const J = EXOSONDA, n = J.nave, P = J.universo.planetas[3];
n.trocarRef(P);
n.pos.set(0, P.raio * 2, 0); n.vel.set(0, 0, 0);
```
