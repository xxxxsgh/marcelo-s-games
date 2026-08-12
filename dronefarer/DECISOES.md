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

---

## FASE 1 — Voo em 3a pessoa

### Decisoes

- **Empuxo no eixo do corpo, nao roteirizado.** "Inclinar pra frente ganha
  velocidade e perde altura" nao e uma regra especial: o empuxo aponta sempre
  no +Y do drone, entao inclinar rouba o cosseno da sustentacao e doa o seno
  pro avanco. Perder sustentacao em angulo alto vem de graca, e e legivel.
- **Controle de atitude em cascata** (igual flight controller real): em ANGLE o
  erro de atitude vira comando de *rate* e o loop de rate persegue; em ACRO o
  stick JA e o comando de rate. Isso faz os dois modos compartilharem o mesmo
  loop interno, entao a "sensacao de peso" e a mesma nos dois — muda so quem
  manda no rate.
- **Erro de atitude por quaternion (eixo-angulo), nao por Euler.** Euler
  quebra de cabeca pra baixo, que e exatamente onde o ACRO vive.
- **Sombra: frustum orto apertado seguindo o drone, com snap de texel — NAO
  CSM.** O `CSM.js` do three exige `setupMaterial()` em cada material e remenda
  o shader por `onBeforeCompile`; isso brigaria com o instancing pesado das
  Fases 3 e 8 e com os materiais procedurais. Num jogo de drone a faixa de
  distancia da camera e curta, entao uma cascata bem ajustada da a mesma
  qualidade com muito menos fragilidade. O snap de texel e o que impede a
  sombra de "ferver" quando a camera anda.
- **Pos-processamento num passe unico** (motion blur radial + distorcao de
  lente + aberracao cromatica + color grade + vinheta) em vez de quatro passes
  encadeados: uma leitura de tela em vez de quatro.
- **Motion blur radial centrado na DIRECAO DO VOO**, nao no centro da tela. O
  vetor velocidade e projetado pra tela e o borrao foge desse ponto — e isso
  que da sensacao de tunel em vez de "tela tremida".
- **Helice: crossfade geometria -> disco borrado.** Helice poligonal girando a
  RPM alto vira serrilhado estroboscopico; acima de certo RPM ela some e entra
  um disco com textura radial.

### Bugs reais achados e corrigidos (achados por teste, nao no olho)

- **Camera por baixo do drone na subida.** O achatamento vertical do braço nao
  bastava: subindo na vertical o braço apontava pra baixo e a tela virava so
  ceu, perdendo toda a referencia do mundo. Corrigido com teto duro de
  inclinacao (`boomPitchLimit`) e reprojecao na horizontal, com fallback pro
  nariz quando o voo e puramente vertical. Ha teste de enquadramento em quatro
  regimes (subida, mergulho, nivelado, diagonal) travando a regressao.
- **Garagem inalcancavel.** O chao e um plano infinito em y=0; o drone era
  teleportado de volta pra rua ao tentar descer. Introduzido registro de
  ABERTURAS no chao (`addGroundHole`/`hasGroundAt`), o asfalto virou quatro
  faixas em volta da boca da rampa, e a rampa foi movida pra dentro da rua
  (onde nao ha predio). Ha teste travando a regressao.
- **Camera arrancada pelo teto da garagem.** O clamp "nao afundar no chao" era
  incondicional. Agora so vale quando o DRONE esta acima do chao.
- **Imagem estourada.** O limiar do bloom estava abaixo de 1.0 rodando em HDR
  linear ANTES do tone mapping, entao o ceu inteiro florescia e lavava a tela.
  Limiar subiu pra ~1.9 (bem acima do brilho do ceu) e os emissores — LED,
  poste, farolete — passaram a ser HDR de proposito (`toneMapped: false`, cor
  multiplicada) pra continuarem acima do limiar.
- **Asfalto virando lencol branco.** Roughness minima baixa demais fazia a rua
  inteira pegar um especular de raspao sob sol baixo. Piso de roughness subiu
  e `envMapIntensity` caiu.
- **Interior tao claro quanto a rua.** O environment map ilumina sem saber que
  existe parede. Garagem/tunel ganharam material proprio com
  `envMapIntensity` quase zero, mais um farol no drone.
- **Throttle lento demais** pra responder no teclado; e o drone nascia sem
  sustentacao. Agora nasce no ponto de hover e a rampa e mais rapida.

### Ferramentas de verificacao

- `node tools/smoke.mjs` — sobe o jogo num Chromium de verdade e valida 16
  itens (voo, ACRO/ANGLE, camera, enquadramento, crash, subsolo, bateria,
  zero erro de console). Build verde nao prova nada num jogo WebGL.
- `node tools/shot.mjs [tier]` — prints em poses fixas + **medicao objetiva**
  de luminancia media / pixels estourados / pixels escuros. Calibrar exposicao
  no olho nao funciona; o numero e que fecha a questao.

### Aceite Fase 1
- Fisica, modos, camera, crash, subsolo e bateria: verificados por teste.
- "Print parado ja parece bonito": rua 0.5% estourado, fachada 0.1%.
- **Nao verificavel neste ambiente:** os alvos de fps (60 em GPU integrada,
  120+ em dedicada). O container so tem rasterizador de software (SwiftShader,
  ~5 fps), que sempre cai no tier minimo. Os quatro tiers existem e o caminho
  de tier alto foi exercitado (bloom+GTAO+SMAA+grade ativos), mas o numero de
  fps precisa ser medido numa maquina com GPU.
