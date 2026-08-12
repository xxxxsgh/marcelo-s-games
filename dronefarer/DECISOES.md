# DECISOES — DRONEFARER

Registro de decisao tecnica. Uma linha por decisao, com o motivo.
Regra de desempate do projeto: **melhor resultado em GPU dedicada de PC**.

---

## FASE 0 — Fundação

- **Repositorio**: DRONEFARER vive em `xxxxsgh/marcelo-s-games` (repo vazio, sem
  commits) e nao em `rfs2.3` — `rfs2.3` ja e o AETHERIA, outro jogo, e misturar
  os dois quebraria a arquitetura dele. Codigo em `dronefarer/`.
- **Fisica do drone**: integracao manual **semi-implicita (Euler simpletico)**,
  nao Rapier. Motivo: o drone e arcade, nao simulador — o valor esta em
  controlar exatamente a curva de empuxo, drag e inercia, e um solver de corpo
  rigido brigaria com esse tuning. Ainda evita ~1 MB de WASM, mantem tudo
  deterministico no timestep fixo, e a colisao que o jogo precisa (esfera vs
  AABB de predio/poste) e trivial de resolver a mao.
- **Pos-processamento**: `EffectComposer` do `three/addons` + passes proprios,
  nao a lib `postprocessing`. Motivo: three 0.185 ja traz GTAO, UnrealBloom,
  SMAA, SSR e OutputPass; ficamos com **zero dependencia nova**, sem risco de
  peer-dep quebrando o build, e os passes proprios (motion blur por velocidade,
  color grade, distorcao de lente FPV) sao escritos como shader chunk simples.
- **Terreno**: **chunks** desde o comeco, nao heightmap unico. Motivo: a Fase 3
  pede cidade aberta com streaming; nascer em chunk evita reescrever mundo
  inteiro depois. Fase 1 usa exatamente 1 chunk.
- **Loop**: fisica em timestep fixo de 60 Hz com teto de 5 substeps (evita
  espiral da morte), render desacoplado e sem cap de fps.
- **Quality tiers**: 4 tiers detectados por string de GPU + resolucao +
  memoria/nucleos, com override por `?q=` e render scale por `?rs=`.
- **Unidade**: 1 unidade = 1 metro, angulo em graus no `config.js` e radiano no
  consumo. Sem "escala de jogo".

### Aceite Fase 0
- `npm run build` verde, saida estatica com `base` configuravel pro Pages.
- Cena vazia com grid + contador de FPS, sem cap de framerate.
