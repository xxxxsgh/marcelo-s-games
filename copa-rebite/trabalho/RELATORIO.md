# Copa Rebite — relatório de entrega

Ambiente em que isto foi produzido: contêiner Linux **sem GPU** (Chromium 158 com WebGPU por software, SwiftShader).
A máquina-alvo (Windows 11, RTX 3050) e a pasta `referencia/` não estavam disponíveis.

## Entrega

| item | estado |
|---|---|
| `index.html` | 313 049 bytes (≈ 306 KB), autocontido, montado por `node build.mjs` a partir de `source/` |
| Montagem (162 combinações) | **passa** — `trabalho/relatorio_montagem.json` |
| Controles e torneio | **passa**, 54/54 — `trabalho/relatorio_controles.json` |
| Laço real (requestAnimationFrame) | **passa** — `trabalho/teste_laco.py` |
| Desempenho na RTX 3050 | **não medido** (sem GPU aqui) — rodar `python trabalho/medir_desempenho.py` na máquina-alvo |
| Crítico visual | **não convergiu**: 3 rodadas, a última com 15 defeitos acima de "menor" |
| `luta.mp4` | **parcial**: 25 dos 60 s, 1920×1080 a 60 qps, com render interno em 960×540 ampliado |

## Montagem
162 combinações montadas; 136 legais e 26 barradas pelo limite de 110 kg (pesos de 62 a 130 kg). Para cada uma:
vértices das peças fora do volume do chassi, peças apoiadas (sem folga), rodas tocando o piso, peças desenhadas,
robô visível na bancada (mínimo de 11 942 pixels em 480×270), barras diferentes ao trocar qualquer peça,
e botão/Start bloqueados nas montagens pesadas. O teste achou e fez corrigir dois defeitos reais
(cravos do pneu grande abaixo do piso; corrente do tambor atravessando o chassi).

## Controles e torneio
Gamepad simulado (cada botão e eixo, zona morta, detecção ao conectar sem recarregar, vibração crescente com o dano)
e teclado, na garagem e na luta. Luta roteirizada de 60 s: 31 acertos no adversário, 2 peças arrancadas,
maior avanço do casco além da parede 0,030 m (tolerância do contato; o centro nunca passa), soma de verificação
idêntica em duas execuções e igual à gravada. Torneio acelerado completo (quartas → semifinal → final) com chave,
decisão dos juízes numa das lutas, conserto/troca limitados a duas ações e salvamento conferido após recarregar.

Alocação: 58 janelas de 60 quadros da luta roteirizada (simulação, IA, efeitos, montagem das instâncias e HUD)
com exatamente 0 byte de heap JS. Fora dessa medida ficam os objetos da própria API (comandos e passes do WebGPU,
a view da textura do canvas, o array de `navigator.getGamepads()`), que o navegador cria a cada quadro.

## Desempenho
Não há número válido para a RTX 3050. No renderizador por software daqui um quadro 1080p leva cerca de 10 s,
o que não diz nada sobre a GPU-alvo. As consultas `timestamp-query` e o log de tempo de quadro estão no jogo
(`CR.perfStart` / `CR.perfEnd`) e o script grava média, p99 e máximo em `trabalho/relatorio_desempenho.md`.

## Crítico visual
Subagente novo a cada rodada, vendo só os renders; sem referências, comparou com o próprio conhecimento.

| rodada | material | acima de "menor" |
|---|---|---|
| 1 | 6 poses 1080p + luta em 960×540 (1 quadro/s) + 3 rajadas (as rajadas saíram repetidas por um erro de captura, corrigido) | 19 |
| 2 | 6 poses 1080p + luta em 960×540 (1 quadro/2 s) + 3 rajadas | 15 |
| 3 | 6 poses 1080p + primeiros 25 s do vídeo (1 quadro/0,5 s) + 1 rajada | 15 |

Corrigido entre rodadas: câmera de TV atrás da estrutura, luz irregular (poças estouradas e áreas pretas),
desfoque de movimento exagerado, câmera a bordo dentro da carcaça, policarbonato enevoado, plateia de blocos,
barras de LED soltas, faíscas gigantes em primeiro plano.

Em aberto na rodada 3 (resumo; texto integral em `trabalho/critico/r3_revisao.md`):
1. grave — imagem mole nos quadros da luta (em boa parte porque o vídeo foi renderizado em 960×540 e ampliado);
2. grave — robôs se interpenetrando no contato (a colisão usa caixas; braço do lançador e armas não colidem);
3. grave — plateia ainda lida como bonecos;
4. grave — na arena a pintura dos robôs ainda parece plástico (na garagem foi considerada bem melhor);
5. grave — disco em giro sem borrão de rotação (efeito estroboscópico);
6–15. médios — realces estourados no piso, ruído em sombra/reflexo, faíscas uniformes, destroços pouco legíveis,
   mureta sem detalhe, névoa lavando os pretos, placas borradas, adesivos espelhados, enquadramento/HUD,
   peças da câmera a bordo.

## Vídeo
`luta.mp4` tem os primeiros 25 s (1500 quadros), capturados quadro a quadro com passo fixo de 1/60 s.
A captura custava ~4,3 s por quadro aqui e foi interrompida pelo limite de tempo do ambiente.
Na máquina-alvo, o vídeo completo em 1080p nativo sai com:

    python trabalho/capturar_luta.py video 1920 1080
