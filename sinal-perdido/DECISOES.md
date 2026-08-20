# DECISOES — SINAL PERDIDO

Registro de decisao tecnica. Uma linha por decisao, com o motivo.
Regra de desempate do projeto: **o combate tem que ser legivel numa olhada**.
Beleza que atrapalha ler a ameaca perde.

---

## Fundacao

- **Canvas 2D, nao WebGL.** O jogo e feito de silhuetas chapadas, paths e
  gradientes; nada aqui precisa de shader. Canvas 2D entrega isso com zero
  dependencia, boot instantaneo e um render que qualquer maquina roda. O unico
  efeito "de GPU" que o jogo quer — luz colorida somada por cima da cena — sai
  com uma camada em `multiply`, descrita abaixo.
- **Zero dependencia em runtime.** Terreno, bicho, som e HUD sao codigo. O
  build final tem ~97 KB (35 KB gzip) e nao baixa asset nenhum: o jogo abre
  antes do jogador desistir.
- **Loop de timestep fixo (60 Hz) com render desacoplado.** Bala, IA e colisao
  precisam ser identicas a 60 e a 144 fps. Teto de 5 substeps evita a espiral
  da morte quando a aba volta do background.
- **Toda a geracao vem de uma seed.** `?seed=` reproduz o vale inteiro, o que
  torna bug de geracao reportavel e o smoke test deterministico. `Math.random()`
  so aparece em efeito visual puro, onde variacao e desejavel.
- **Unidade do mundo = 1 pixel com zoom 1.** Sem "escala de jogo": tile de 40,
  jogador de raio 12, e o que se le no `config.js` e o que se ve na tela.

---

## Mundo

- **Grade de tiles com colisao circulo-vs-AABB, nao poligonos.** Cobertura em
  shooter de cima precisa de duas coisas: bloquear bala e bloquear passo. A
  grade resolve as duas em O(1) por consulta, e a resolucao por menor
  afastamento faz o jogador *deslizar* na pedra em vez de grudar na quina — o
  defeito classico de "recuar o movimento inteiro".
- **Distorcao de dominio no ruido (`fbmWarp`).** Value noise puro tem features
  alinhadas aos eixos; em terreno isso vira retangulo visivel na tela — e foi
  exatamente o que apareceu na primeira captura. Deslocar a coordenada de
  amostragem por outro ruido custa duas amostras e mata o alinhamento.
- **Fronteira de bioma borrada por media 3x3.** Sem isso o mapa vira colcha de
  retalhos, porque dois biomas vizinhos trocam de cor no meio de um tile. A
  media roda uma vez por tile, na criacao do bloco de cache.
- **Terreno pre-renderizado em blocos de 8x8 tiles, com LRU de 90 blocos.**
  Repintar ~600 tiles com cascalho, manchas e pedra a cada frame seria o
  gargalo do jogo. Assim o custo por frame vira um punhado de `drawImage`, e o
  detalhe por tile pode ser caro a vontade.
- **Contorno claro em toda pedra que encosta no chao.** E o que faz a rocha ler
  como COBERTURA numa olhada. Sem o contorno o jogador so descobre a parede
  quando esbarra nela — testado, e horrivel.
- **Clareiras + corredores serpenteantes + flood fill de verificacao.** O ruido
  sozinho fecha bolsoes: ninho inalcancavel = partida impossivel. A geracao
  cava clareira em cada ponto de interesse, liga tudo com corredores tortos
  (nunca retas perfeitas) e, se o flood fill a partir da nave ainda deixar
  alguem ilhado, abre na marra. O smoke test falha se sobrar um so ilhado.
- **O vale e uma cratera fechada.** Muralha de rocha na borda em vez de parede
  invisivel: o limite do mapa e diegetico e ainda serve de cobertura.

---

## Combate

- **Mira e corpo giram separados.** E o que faz um shooter de cima parecer
  twin-stick e nao carrinho de controle remoto: as pernas apontam pra onde voce
  anda, o tronco e a arma pra onde voce mira.
- **Movimento em aceleracao + atrito, nao "velocidade = input".** Da peso sem
  deixar o controle mole. A esquiva e um estado que ignora a entrada durante o
  mergulho — comprometer-se com a rolagem e o que a torna uma decisao.
- **Projetil de verdade, com passo subdividido em 10 unidades.** Hitscan seria
  mais barato, mas tirar o tempo de voo tira a leitura do cuspe de acido e do
  plasma. A subdivisao existe porque a 1750 u/s uma bala anda quase um tile
  inteiro por frame e atravessaria parede.
- **Semi-automatico exige soltar o gatilho.** Segurar o botao com a pistola da
  um tiro so, de proposito: e o que separa pistola de fuzil sem precisar de
  numeros diferentes de dano.
- **A pistola tem reserva infinita.** Ficar desarmado num planeta hostil nao e
  tensao, e castigo — o jogador para de jogar e comeca a farmar.
- **O plasma machuca quem atirou.** Estouro em area sem risco proprio vira a
  unica arma do jogo; com risco, vira escolha.
- **Coronhada no `F`.** Toda arma tem um alcance minimo desconfortavel; sem
  resposta corpo-a-corpo, o rastejante colado vira dano garantido.
- **Escudo que volta sozinho, vida que nao.** O escudo perdoa o erro pontual e
  permite agressividade; a vida so volta com item, entao a partida ainda tem
  memoria dos erros.

---

## Inimigos

- **IA de perceber-lembrar-contornar-atacar, sem A\*.** O vale e aberto: um
  pathfinder completo custaria caro e nao melhoraria a leitura do combate. Os
  bichos usam "bigodes" (tres raios curtos) pra contornar pedra, e cada um tem
  um lado preferido que inverte quando trava — sem isso meia duzia deles
  empilha na mesma quina.
- **Barulho acorda quem nao viu.** Cada tiro emite um raio de alerta. E o que
  torna a espingarda uma decisao tatica em vez de so a arma de mais dano.
- **Separacao mutua entre bichos.** Sem ela, seis rastejantes viram um pixel so
  e o jogador perde a nocao de quantos sao.
- **Cada tipo resolve um problema diferente do jogador:** rastejante pune ficar
  parado, cuspidor pune ficar longe, ariete pune ficar em linha reta, enxame
  pune confiar na pedra (voa por cima), rainha pune ficar sem espaco.
- **Ariete que se atordoa na parede.** A investida so e justa se errar tiver
  preco pra ele tambem — e ensina o jogador a usar a pedra a favor.

---

## Diretor

- **Nada nasce na tela.** O spawn procura um ponto livre no anel de 620-900
  unidades e desiste se o ponto estiver visivel. Bicho aparecendo do nada na
  frente do jogador nao e dificuldade, e trapaca.
- **A pressao sobe com a noite, com cada nucleo entregue e enquanto o jogador
  carrega um nucleo.** O planeta reage ao roubo: a volta pra nave e sempre pior
  que a ida, e isso e a curva de tensao da partida inteira, sem cutscene.
- **Teto de populacao viva.** Sem teto, o jogo vira sopa de bicho e o
  frametime some junto com a leitura. As ondas do cerco tem teto proprio (12).
- **Ninho e fonte e alvo ao mesmo tempo.** Enquanto vivo, cospe; morto, entrega
  o nucleo. Isso transforma "va ate o ponto X" num objetivo que se defende.

---

## Apresentacao

- **Camada de luz em meia resolucao, aplicada com `multiply`.** Uma
  multiplicacao de tela inteira substitui iluminacao por objeto; a meia
  resolucao ainda deixa a borda da luz macia de graca. Cada luz e um sprite
  radial cacheado por cor — nada de `createRadialGradient` por luz por frame.
- **Escala da camera vem da ALTURA da janela.** Todo mundo enxerga a mesma
  faixa vertical, independente da resolucao. Ultrawide ganha visao lateral, que
  num jogo de cima e vantagem aceitavel e melhor do que distorcer o campo.
- **Anel discreto no chao do jogador.** Com vinte bichos em volta, achar a si
  mesmo tem que ser instantaneo.
- **Corpos desenhados em ordem de Y.** Quem esta mais ao sul aparece por cima;
  e a unica pista de profundidade que um jogo de cima tem.
- **Hitstop curto no abate e tremor com duas frequencias.** O tremor de seno
  unico parece maquina de lavar; somar duas frequencias deixa o impacto sujo,
  que e como impacto soa.
- **Som 100% sintetizado, com distancia virando volume.** Tiro e ruido filtrado
  caindo somado a um estalo; bicho e dente-de-serra com vibrato. Da pra *ouvir*
  de onde vem o problema, e o jogo continua sem baixar um byte de audio.
- **Minimapa de 1 pixel por tile, repintado so nos tiles recem-descobertos.**
  A neblina de guerra sai de graca e o custo por frame e um `drawImage`.

---

## Ferramentas

- **`tools/smoke.mjs` joga o jogo de verdade num Chromium.** Build verde nao
  prova nada num jogo: o smoke abre a pagina, atira, anda, roda 30 s de
  simulacao, destroi um ninho a tiro, leva o nucleo ate a nave, aguenta o cerco
  inteiro ate a vitoria, mata o jogador e reinicia — falhando em erro de
  console, NaN, jogador dentro de parede ou ponto de interesse ilhado.
  Foi ele que pegou o overlay de boot invisivel que engolia todo clique do
  mouse: build passava, jogo nao atirava.
- **`tools/simtest.mjs` roda a simulacao pura no Node**, com `document` de
  mentira e um canvas que engole chamadas. Foi ele que pegou o pior bug do
  projeto: com o centro do circulo DENTRO de um tile solido, a normal era
  calculada dividindo por uma distancia de 0.001 e saia mil vezes maior que
  unitaria — a velocidade do bicho era multiplicada por um milhao, a posicao ia
  pra 1e15 e o `for` de tiles da colisao parava de avancar (float grande demais
  pra `+1` mudar alguma coisa). O jogo congelava a aba inteira. No Chromium
  isso aparecia como "a aba morreu"; em Node virou stack trace em 30 segundos.
  Desde entao a colisao escreve a normal degenerada a mao, os limites do laco
  de tile sao presos a grade e todo bicho e preso ao vale a cada passo.
- **`tools/shot.mjs` monta cenas pra revisar arte** (dia, noite, ninho, rainha)
  sem ter que jogar ate la. Foi o que expos a cara de grade do terreno.
