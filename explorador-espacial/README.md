# VOIDRUNNER

Simulador de exploracao espacial 3D procedural em **um unico arquivo HTML**.
Sem build, sem npm, sem bundler: `index.html` traz HTML, CSS e JS juntos e
importa o three.js por CDN com import map de versao fixa.

## Como rodar

Modulos ES (`<script type="module">`) sao bloqueados por politica de origem
quando a pagina vem de `file://` — isso vale para qualquer navegador, nao so
para este projeto. Entao **duplo clique nao funciona**; use um servidor
estatico (o proprio jogo mostra esse aviso na tela se detectar `file://`):

```bash
cd explorador-espacial
python3 -m http.server 8000   # ou: npx serve .
# abre http://localhost:8000/
```

Em GitHub Pages, Netlify, Vercel ou qualquer host estatico basta subir o
arquivo: nao ha etapa de build.

## Controles

**Teclado + mouse**

| Tecla | Acao |
| --- | --- |
| W / S | Empuxo frente / re |
| A / D | Strafe lateral |
| R / F | Subir / descer |
| Mouse | Pitch e yaw (clique na tela para travar o cursor) |
| Q / E | Roll |
| Shift | Turbo / supercruzeiro |
| Espaco | Freio de inercia |
| Z | Liga e desliga o assistente de voo |
| T / Y | Trava proximo alvo / limpa alvo |
| C | Alterna cabine e terceira pessoa |
| G | Nivela com o horizonte local (ajuda no pouso) |
| H | Liga e desliga o HUD |
| P / Esc | Pausa e menu |

**Toque (iPad / iPhone)** — analogico esquerdo: empuxo e strafe; analogico
direito: pitch e yaw; botoes de roll, subir, descer, turbo, freio, alvo,
assistente, vista e menu.

## O que esta implementado

- Sistema estelar unico gerado por semente: estrela com classe espectral,
  5 a 8 planetas em orbitas keplerianas reais (a, e, i, nodo, periastro,
  anomalia media), cinturao de asteroides opcional.
- Voo newtoniano em 6 graus de liberdade, gravidade, arrasto e aquecimento
  atmosferico, combustivel e coleta solar.
- Supercruzeiro com velocidade proporcional a distancia do corpo mais proximo:
  qualquer travessia do sistema leva 25-40 s e nunca ultrapassa o destino.
- Transicao continua espaco -> atmosfera -> superficie, sem tela de carga.
- Terreno procedural em clipmap geodesico de 6 niveis de LOD gerado em Web
  Worker, com biomas por altitude, latitude e temperatura.
- HUD diegetico com velocidade, empuxo, combustivel, alvo travado, distancia,
  fita de altitude e marcadores prograde/retrograde/alvo.
- Save/load em localStorage com autosave a cada 20 s.
- Audio sintetizado em Web Audio API: rumble de motor modulado pelo empuxo,
  vento atmosferico, bipes de UI.

## Notas de arquitetura

O comentario da secao 6 do `index.html` documenta a solucao do problema de
escala (origem flutuante + cameras em camadas + referencial comutavel). Os
demais blocos numerados separam nucleo procedural, universo, terreno, nave,
entradas, HUD, audio, save, renderizador e jogo.

Todos os numeros magicos estao no objeto `CONFIG`, no topo do arquivo.
