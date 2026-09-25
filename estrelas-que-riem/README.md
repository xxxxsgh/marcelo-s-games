# Estrelas que Riem

Um jogo 3D curto e contemplativo, inspirado em *O Pequeno Príncipe*, de
Antoine de Saint-Exupéry. Você anda em volta de planetinhos redondos, cuida
da sua rosa, visita os adultos esquisitos dos asteroides, atravessa o
espaço pendurado num bando de pássaros e chega ao deserto da Terra.

Tudo é gerado pelo computador na hora: não há nenhuma textura, modelo ou
arquivo de som. O visual imita aquarela sobre papel e a música é uma
caixinha de música que se compõe sozinha.

```bash
npm install
npm run dev        # http://127.0.0.1:5180
npm run build      # dist/ estático (base relativa, funciona em qualquer subpasta)
```

Atalho de desenvolvimento: `?level=3` começa direto no planeta 3, `?q=baixa`
força a qualidade, `?fast=1` encurta as viagens.

---

## A viagem

| # | Planeta | O que se faz lá |
|---|---|---|
| 0 | **B-612** | arrancar brotos de baobá, limpar os três vulcões, regar a rosa e cobri-la com a redoma |
| 1 | **O Rei** | bocejar por ordem real, ver o pôr do sol "que ele mandou", julgar o velho rato |
| 2 | **O Vaidoso** | minijogo de ritmo: bater palmas quando os círculos se encontram |
| 3 | **O Bêbado** | uma conversa curta que dá voltas |
| 4 | **O Homem de Negócios** | recolher estrelas caídas e decidir: entregar ou devolver ao céu |
| 5 | **O Acendedor de Lampiões** | o planeta gira depressa; acender ao anoitecer e apagar ao amanhecer |
| 6 | **O Geógrafo** | explorar um planeta maior (montanha, mar e um morro em forma de chapéu) |
| 7 | **A Terra** | a serpente, a flor, o eco, o jardim de rosas, cativar a raposa, o aviador e o poço |
| 8 | **De volta** | epílogo |

Entre os planetas, você voa com os pássaros selvagens: guie o bando, pegue
poeira de estrela e passe por dentro das auréolas de luz.

**O pôr do sol:** num planeta pequeno, basta andar alguns passos em direção à
noite para ver o sol se pôr de novo. O jogo conta os pores do sol que você viu.

## Controles

| Teclado / mouse | Toque | Ação |
|---|---|---|
| `WASD` / `↑` `↓` | metade esquerda da tela | andar |
| arrastar o mouse, `Q` `←` `→` | metade direita da tela | girar a câmera |
| roda do mouse | — | zoom |
| `E` / `Enter` (segurar quando pedir) | ✦ | interagir |
| `Espaço` | ⤒ | pular |
| `Shift` | — | correr |
| `Tab` (segurar) | segurar ✦ | pular a viagem |
| `Esc` | ❙❙ | pausa e opções |

Gamepad também funciona (analógico esquerdo anda, direito gira a câmera, A pula, X/B interage).

## Como é feito

- **Three.js + Vite**, sem nenhum asset externo além das fontes (Cormorant Garamond e Caveat, empacotadas pelo `@fontsource`).
- `src/render/paint.js` — material "aquarela": Lambert com a luz refeita no shader. O terminador entre luz e sombra é ruidoso (borda de pincel), a sombra é tingida de violeta em vez de escurecer, e há granulação de pigmento. Contorno de nanquim por casco invertido, com o traço "tremendo" a 7 quadros por segundo como desenho à mão.
- `src/render/pipeline.js` — pós-processamento: bloom leve e um passe de papel (borda de pigmento onde a cor muda, sangrado úmido, fibras e granulação do papel, vinheta irregular, transições que "lavam" a tela para a cor do papel).
- `src/render/sky.js` — o céu depende do "pra cima" do jogador: a elevação do sol é `dot(up, sol)`, então andar pelo planeta muda a hora do dia. Estrelas de cinco pontas que piscam e, no fim, riem.
- `src/world/player.js` — andar em volta de uma esfera: gravidade pro centro, câmera que transporta o próprio referencial junto com o jogador.
- `src/actors/prince.js` — o principezinho, com o cachecol simulado por verlet (colide com o corpo e voa com o vento).
- `src/audio/audio.js` — Web Audio: caixinha de música generativa por planeta (escala, tempo, densidade), pad, reverb gerado, vozes em "blip", sinos das estrelas, passos, vento.
- `src/levels/*.js` — cada planeta é um módulo com seu roteiro escrito com `async/await` (`await game.talk(...)`, `await game.ui.choose(...)`).

## Ferramentas

```bash
npm run build
node tools/tour.mjs          # carrega todos os planetas e tira um print de cada (shots/)
node tools/autoplay.mjs 0    # um robô joga o jogo inteiro, do B-612 aos créditos
node tools/shot.mjs nome "level=2" 5000
```

As falas são uma adaptação livre, em português, feita para o jogo.
