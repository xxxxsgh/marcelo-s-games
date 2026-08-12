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

---

## FASE 2 — Corrida e progressao

### Decisoes

- **Deteccao de gate por CRUZAMENTO DE PLANO, nao por proximidade.** Proximidade
  deixa passar por fora e contar, e falha quando o drone atravessa entre dois
  frames. Aqui compara-se de que lado do plano o drone estava no passo anterior
  e no atual, acha-se o ponto exato de interseccao e mede-se a distancia radial
  ali. Funciona a 60 m/s e exige atravessar de verdade, no sentido certo.
- **O cronometro so comeca no gate 1.** Reiniciar nao cobra tempo de reacao —
  se comecasse no respawn, o jogador seria punido por apertar R rapido, que e
  exatamente o comportamento que o loop quer incentivar.
- **Fantasma gravado em array plano de numeros** (8 por amostra, arredondados),
  nao array de objetos: cabe no localStorage sem estourar cota.
- **Ghost roda no tempo da corrida atual**, nao em loop. O ponto dele nao e
  "ir mais rapido", e ver ONDE se perde tempo — por isso tambem existe delta
  ao vivo por split.
- **Ouro pede ACRO.** Os tempos de ouro foram postos abaixo do que da pra fazer
  nivelando a cada curva; em ANGLE o auto-nivelamento cobra tempo em toda
  mudanca de direcao.
- **Raspar e penalidade visual, nao morte** (roadmap). O gate registra `graze`
  e o HUD avisa, mas a corrida continua.
- **Save com versao de schema e migracao**, tudo em try/catch: modo privado,
  cota cheia ou storage bloqueado nao podem derrubar o jogo.

### Verificacao
Os tres circuitos sao percorridos gate a gate pelo smoke test (teleporte de um
lado ao outro de cada gate, que exercita o caminho real de cruzamento de plano),
validando ordem obrigatoria, splits, gravacao de recorde no localStorage,
reproducao do fantasma e rearme instantaneo no R.

**Nota de teste:** as esperas do teste sao por FRAME (`requestAnimationFrame`),
nao por milissegundo — no rasterizador de software um frame passa de 200 ms e
espera por relogio nao garante que um passo de fisica aconteceu.

---

## FASE 3 — Cidade aberta

### Decisoes

- **Um InstancedMesh de predios por chunk, com ATLAS DE FACHADA.** O problema
  central era ter milhares de predios de alturas diferentes sem virar milhares
  de draw calls. Cada instancia carrega `aVariant` (faixa do atlas), `aFloors`
  e `aTilesX`, e o shader remonta a UV. Sem essa remontagem, escalar a caixa
  esticaria a textura e todo predio alto viraria um borrao de janela gigante.
- **`textureGrad` com o gradiente da coordenada CONTINUA.** Tiling manual com
  `fract()` da um salto de 1.0 na costura de cada tile; o GPU le derivada
  enorme, escolhe o mip mais baixo e a fachada inteira cintila a distancia.
  Passar o gradiente na mao e o que mantem o mipmap correto.
- **Geracao fatiada por ORCAMENTO DE TEMPO no frame, nao Web Worker.** O
  roadmap permitia worker; medindo, um chunk custa fracao de milissegundo, e a
  fila ordenada por distancia com teto de ~4 ms/frame ja elimina o engasgo. Um
  worker exigiria serializar geometria e materiais de volta, com ganho nulo
  neste custo. Se a Fase 8 mostrar chunk caro, o ponto de corte ja esta isolado
  numa funcao (`generate`).
- **Distritos por REGIAO, nao por ruido.** Um bairro antigo espalhado em
  manchas nao daria identidade; cada distrito precisa ser contiguo pra o
  jogador saber onde esta so de olhar pra fora.
- **CENTRO vai ate r=3.** Os chunks -2..1 sao o quarteirao da Fase 1 e nao sao
  gerados. Com o centro parando em r=1, o distrito de arranha-ceus — o cartao
  postal do jogo — simplesmente nao existiria.
- **Interiores tem material proprio.** O environment map ilumina sem saber que
  existe parede, entao garagem/tunel usariam a mesma luz da rua.

### Bugs reais achados e corrigidos

- **`InstancedMesh` NAO clona a geometria.** Escrever os atributos por
  instancia na `boxGeo` compartilhada fazia cada chunk sobrescrever o anterior:
  o ultimo vencia e os demais liam `aFloors = 0`, virando UM andar esticado no
  predio inteiro — as janelas apareciam como listras verticais do chao ao topo.
  Agora cada chunk clona a geometria.
- **Aberracao cromatica DESLIGADA.** O bloco re-amostrava R e B da textura sem
  borrao enquanto G vinha do caminho borrado; a simples mistura de canal
  nitido com canal borrado pintava franja verde/magenta em toda silhueta,
  independente do tamanho do deslocamento. Fazer certo custaria borrar os tres
  canais (3x amostras) por um efeito que nem estava no escopo do roadmap.
- **`mergeGeometries` falhava na arvore**: `CylinderGeometry` vem indexada e
  `IcosahedronGeometry` nao. Sem `toNonIndexed()` o merge devolvia null e a
  arvore ficava so tronco.
- **`flat` e palavra reservada no GLSL ES 3.00** (qualificador de
  interpolacao) — quebrava a compilacao do shader de fachada.

### Verificacao
Smoke test cobre: streaming (53 chunks / ~1500 predios), os cinco distritos nas
posicoes certas, descarregamento ao voltar, queda de sinal com a distancia,
alarme + perseguicao em zona restrita e recarga de bateria.

---

## FASES 4 a 8 — missoes, hangar, risco, audio e entrega

### Decisoes

- **Missoes usam a camera de verdade como mecanica** (inspecao e vigilancia):
  o alvo precisa estar dentro de um cone E de uma faixa de distancia, e o
  medidor so enche enquanto o enquadramento se mantem. Nao ha "aperte E perto
  do objeto".
- **Cone de 20 graus, nao 14.** Com camera de perseguicao a mira nao e a do
  jogador diretamente — a mola e o look-ahead deslocam o alvo. Cone apertado
  demais transformava a missao em briga com a camera.
- **Pontos de inspecao na FACE voltada pra rua.** Ponto no meio do quarteirao
  obrigaria o jogador a entrar na geometria pra enquadrar.
- **Ordem hangar → dano no passo de fisica.** O hangar DEFINE os
  multiplicadores da build (valores absolutos) e o dano MULTIPLICA por cima.
  Invertido, um sobrescreveria o outro e o drone quebrado voaria como novo.
- **Nenhum upgrade e so beneficio.** Motor da empuxo e cobra bateria; bateria
  da autonomia e cobra peso (inercia); helice da agilidade e cobra
  estabilidade no vento; camera da zoom e cobra peso na frente; antena da
  alcance e cobra arrasto. Sem isso, progressao vira "numero maior".
- **Ciclo dia/noite por MISSAO, nao global.** O jogador escolhe o cenario em
  vez de esperar o relogio.
- **Audio 100% sintetizado.** O motor nao e um loop com pitch: sao quatro
  parciais (uma por helice) mais ruido de passagem de pa, com frequencia
  ligada ao RPM, volume ao throttle e timbre a CARGA.
- **Doppler feito na mao.** A spec do Web Audio removeu o `dopplerFactor` do
  `PannerNode`, entao a velocidade radial em relacao a camera desloca a
  frequencia diretamente.
- **Photo mode usa composer PROPRIO** (RenderPass + Bokeh + Output) em vez de
  enfiar um passe no pipeline do jogo: o modo esta pausado, entao pode custar
  caro, e o pipeline principal fica intocado.
- **PNG do photo mode sai por `readRenderTargetPixels`**, nao por
  `toDataURL` — assim nao e preciso ligar `preserveDrawingBuffer`, que cobraria
  desempenho o jogo inteiro por causa de um botao.
- **Aberracao cromatica removida** (ver Fase 3): efeito fora do escopo que
  produzia franja verde/magenta sempre que havia motion blur.

### Nao entregue / limitacoes conhecidas

- **Alvos de fps nao verificados.** O container so tem rasterizador de
  software (SwiftShader, ~5 fps), que sempre cai no tier minimo. Os quatro
  tiers existem e o caminho do tier alto foi exercitado (bloom + GTAO + SMAA +
  grade ativos), mas 60 fps em GPU integrada e 120+ em dedicada precisam ser
  medidos numa maquina com GPU.
- **Sem Web Worker.** A geracao de chunk mede fracao de milissegundo; a fila
  com orcamento de tempo por frame ja resolve. O ponto de corte esta isolado
  em `city.generate()` se um perfil real mostrar necessidade.
- **Sem KTX2/Basis nem Draco/meshopt.** Nao ha um unico asset binario no
  projeto — textura e geometria sao geradas em runtime — entao compressao de
  asset nao se aplica. O bundle e ~1 MB (300 KB gzip), quase todo Three.js.
- **Volumetria e SSR estao no menu e nos tiers, mas o pipeline nao os
  implementa** como passes proprios: os toggles existem e sao persistidos, e
  hoje nao mudam a imagem. Ficam como o proximo passo natural do render.
- **Alguns itens de conteudo da Fase 3 ficaram de fora**: shopping com vao
  central, galeria de metro, prediso em construcao, andaimes, pedestres
  impostor e decals de pichacao. Telhado navegavel, garagem, POIs, zonas
  restritas, transito e pombos estao no jogo.
