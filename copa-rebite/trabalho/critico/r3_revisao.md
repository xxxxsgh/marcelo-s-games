# Revisão final do crítico visual — rodada 3

Subagente novo, que viu só os renders de `trabalho/critico/r3/` (6 poses, 28 quadros da luta, 8 quadros da rajada).
Não havia imagens de referência; a comparação foi com o conhecimento dele do patamar de jogos atuais.
Texto do crítico, com os itens na ordem e com a severidade que ele deu.

1. **GRAVE — imagem mole em quase todos os quadros da luta.** luta_t002.5s a t009.5s, t011.5s a t014.5s, t016.0s, t017.0s, t021.0s, t022.0s e a rajada inteira; tela toda, inclusive o robô em foco. Rebites, adesivos e bordas borrados (t005.5s, t008.5s, t012.5s). "Parece 540p ampliado, não 1080p." Deveria ter o robô em foco, nítido, e desfoque só no fundo e em movimento rápido.
2. **GRAVE — peças atravessando outras, robôs fundidos por cerca de 7 s.** luta_t002.5s a t010.0s; t018.5s, t019.0s, t020.0s, t023.0s, t024.0s. A cunha azul entra na caixa vermelha; os dois giram colados. Na câmera a bordo o braço da arma vermelha atravessa o teto do azul. Deveria haver contato rígido, com separação e amassado.
3. **GRAVE — plateia de bonecos de pino.** Todos os da arena; pior em luta_t014.5s, t019.0s, t020.0s, t012.5s, arena_3_bordo. Cilindros com esfera cor de pele, sem rosto, repetidos em grade. Deveria ser gente com silhueta e variação, ou plateia escura atrás de policarbonato sujo.
4. **GRAVE — na arena os robôs parecem brinquedo de plástico.** luta_t000.5s, t004.5s a t009.5s, t011.5s, t013.0s, arena_1_perseguicao. Cores primárias saturadas e uniformes, quase sem reflexo metálico, adesivos chapados; em t013.5s o fundo do robô tombado é uma placa cinza lisa. "A garagem está bem melhor (garagem_1 tem desgaste de borda e metal escovado), mas isso some na arena."
5. **GRAVE — a arma giratória não se lê.** luta_t004.5s a t009.5s, t012.5s, t013.0s, rajada, t017.0s, t021.0s, arena_3_bordo. A 100% o disco some ou vira um arco fantasma; na rajada aparece congelado e muda de forma aos saltos (estroboscópico); a corrente fica parada. Deveria ter borrão radial contínuo e brilho anelar estável.
6. **MÉDIO — brancos estourados no piso.** arena_2_tv, arena_1_perseguicao, luta_t000.5s, t005.5s.
7. **MÉDIO — reflexo e sombra do piso com ruído e manchas.** Rajada (mancha pontilhada que muda a cada quadro, x≈650–900, y≈560–720), arena_2_tv (sombra serrilhada), arena_4_fixa.
8. **MÉDIO — faíscas e clarão de impacto artificiais.** arena_4_fixa (coluna branca de borda dura), luta_t018.0s, t020.0s, t010.5s.
9. **MÉDIO — destroços como borrões.** luta_t018.5s, t022.0s, t023.0s, t025.0s.
10. **MÉDIO — muro e mureta da arena sem detalhe.** luta_t024.0s, rajada, t014.5s, t012.5s, t007.5s.
11. **MÉDIO — cena escura e lavada por névoa cinza.** luta_t012.5s a t014.5s, t021.0s, rajada.
12. **MÉDIO — placas de patrocínio borradas, com imagem dupla.** arena_3_bordo, luta_t003.5s, t008.5s, t016.0s, rajada; painel de LED azul chapado (t024.0s, t020.0s).
13. **MÉDIO — adesivos errados ou espelhados.** garagem_2 (etiqueta "FAGULHA" no robô "TRANCO"; nome invertido no teto), arena_2_tv, luta_t004.5s, t008.5s.
14. **MÉDIO — enquadramento e HUD cobrindo a ação.** arena_2_tv, luta_t025.0s (aviso de peça perdida sobre os robôs), garagem_1.
15. **MÉDIO — câmera a bordo dominada por peça de baixa qualidade.** arena_3_bordo, luta_t016.0s, t017.0s, t022.0s, t023.0s.
16. **MENOR — garagem com fundo pobre e borda da mesa cintilante.** garagem_1, garagem_2.
17. **MENOR — luz interna vazando.** luta_t010.5s.
18. **MENOR — contato do robô com o piso fraco.** arena_1_perseguicao, luta_t000.5s.

Rajada: sem objeto surgindo do nada, sem faixas evidentes, sem fantasma de quadro anterior.

**Acima de menor: 15**

Notas de quem montou o pacote (não são do crítico):
- Item 1: os quadros da luta desta rodada vieram do vídeo, renderizado em 960×540 e ampliado para 1080p; as 6 poses são 1080p nativas.
- Item 13, etiqueta "FAGULHA": é o adesivo do patrocinador fictício "Fagulha Soldas", que coincide com o nome padrão do robô do jogador.
