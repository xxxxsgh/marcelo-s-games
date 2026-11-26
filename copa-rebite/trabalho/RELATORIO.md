# Copa Rebite — relatório de entrega

Ambiente em que isto foi produzido: contêiner Linux **sem GPU** (Chromium 158 com WebGPU por software, SwiftShader).
A máquina-alvo (Windows 11, RTX 3050) e a pasta `referencia/` não estavam disponíveis.

## Entrega

| item | estado |
|---|---|
| `index.html` | 340 213 bytes (≈ 332 KB), autocontido, montado por `node build.mjs` a partir de `source/` |
| Montagem (162 combinações) | **passa** — `trabalho/relatorio_montagem.json` |
| Controles e torneio | **passa**, 54/54 — `trabalho/relatorio_controles.json` |
| Laço real (requestAnimationFrame) | **passa** — `trabalho/teste_laco.py` |
| Desempenho na RTX 3050 | **não medido** (sem GPU aqui) — rodar `python trabalho/medir_desempenho.py` na máquina-alvo |
| Modos extras | **passa** — `trabalho/teste_modos.py` |
| Crítico visual | **não convergiu**: 15 rodadas, a última com 13 defeitos acima de "menor" (melhor: 11) |
| `luta.mp4` | **parcial e desatualizado**: 25 dos 60 s, 1920×1080 a 60 qps, render interno em 960×540 ampliado, gravado na versão da rodada 3 |

## Montagem
162 combinações montadas; 136 legais e 26 barradas pelo limite de 110 kg (pesos de 62 a 130 kg). Para cada uma:
vértices das peças fora do volume do chassi, peças apoiadas (sem folga), rodas tocando o piso, peças desenhadas,
robô visível na bancada (mínimo de 11 942 pixels em 480×270), barras diferentes ao trocar qualquer peça,
e botão/Start bloqueados nas montagens pesadas. O teste achou e fez corrigir dois defeitos reais
(cravos do pneu grande abaixo do piso; corrente do tambor atravessando o chassi).

## Controles e torneio
Gamepad simulado (cada botão e eixo, zona morta, detecção ao conectar sem recarregar, vibração crescente com o dano)
e teclado, na garagem e na luta. Luta roteirizada de 60 s: 51 acertos no adversário, 4 peças arrancadas,
maior avanço do casco além da parede 0,030 m (tolerância do contato; o centro nunca passa), soma de verificação
idêntica em duas execuções e igual à gravada. Torneio acelerado completo (quartas → semifinal → final) com chave,
decisão dos juízes numa das lutas, conserto/troca limitados a duas ações e salvamento conferido após recarregar.

Com o som ligado, a atualização dos parâmetros de áudio (10 vezes por segundo) passa números à API do navegador, o que fica fora desta medida.

Alocação: 58 janelas de 60 quadros da luta roteirizada (simulação, IA, efeitos, montagem das instâncias e HUD)
com exatamente 0 byte de heap JS. Fora dessa medida ficam os objetos da própria API (comandos e passes do WebGPU,
a view da textura do canvas, o array de `navigator.getGamepads()`), que o navegador cria a cada quadro.

## Desempenho
Não há número válido para a RTX 3050. No renderizador por software daqui um quadro 1080p leva cerca de 10 s,
o que não diz nada sobre a GPU-alvo. As consultas `timestamp-query` e o log de tempo de quadro estão no jogo
(`CR.perfStart` / `CR.perfEnd`) e o script grava média, p99 e máximo em `trabalho/relatorio_desempenho.md`.

## Crítico visual
Subagente novo a cada rodada, vendo só os renders; sem referências, comparou com o próprio conhecimento.
Cada rodada: 6 poses em 1080p, a luta roteirizada em 960×540 (um quadro a cada 2 s, a partir da rodada 2) e 3 rajadas de 8 quadros.

| rodada | acima de "menor" | o que mudou antes dela |
|---|---|---|
| 1 | 19 | primeira versão |
| 2 | 15 | câmera de TV, plateia, desfoque, policarbonato |
| 3 | 15 | luz mais uniforme, colisão, materiais (quadros do vídeo ampliado) |
| 4 | 16 | colisão com mais pontos, disco, pintura |
| 5 | 18 | exposição (passou do ponto: arena lavada) |
| 6 | 14 | contraste, disco borrado, policarbonato limpo |
| 7 | 15 | cones dos refletores, penumbra da plateia |
| 8 | 13 | piso, perseguição mais próxima, grão |
| 9 | 14 | desgaste, reflexo do piso, arma colide com a parede |
| 10 | 14 | riscos do piso, alumínio, rodas maciças, lançador |
| 11 | 13 | base do martelo colide, câmera de perseguição |
| 12 | 11 | estrutura do chassi, fogo, mureta, altas luzes |
| 13 | 14 | chassi em treliça, fogo, placas arrancadas |
| 14 | 14 | fogo alongado, disco, colisão mais firme |
| 15 | 13 | contraste, rodas pequenas, luz de impacto |

**Não convergiu.** A contagem caiu de 19 para a faixa de 11 a 15 e ficou oscilando: cada crítico novo acha um conjunto
parecido de problemas de fundo. Os que se repetem em quase todas as rodadas e continuam em aberto:
- os robôs ainda leem como caixas pintadas na arena (a garagem é apontada como a melhor parte);
- interpenetração no contato (a colisão é por caixa e pontos, sem deformação);
- plateia de bonecos simples;
- disco em giro sem borrão de rotação convincente;
- piso que alterna entre realce estourado e sombra chapada;
- falta de sombra de contato sob os robôs.

Texto da última rodada em `trabalho/critico/r15_revisao.md`; os pacotes de imagens de todas as rodadas estão em `trabalho/critico/rN/`.

## Conteúdo acrescentado depois da primeira entrega
Carreira em temporadas (14 rivais, quatro arenas, rivais mais resistentes a cada temporada), amistoso, sobrevivência,
nove desafios (incluindo o chefão Rei Rebite), oficina de melhorias com sucata, 12 conquistas, quatro pinturas
desbloqueáveis, três dificuldades, retrospecto contra cada rival e som procedural (Web Audio).
Coberto por `trabalho/teste_modos.py`.

## Vídeo
`luta.mp4` tem os primeiros 25 s (1500 quadros), capturados quadro a quadro com passo fixo de 1/60 s.
A captura custava ~4,3 s por quadro aqui e foi interrompida pelo limite de tempo do ambiente.
Na máquina-alvo, o vídeo completo em 1080p nativo sai com:

    python trabalho/capturar_luta.py video 1920 1080
