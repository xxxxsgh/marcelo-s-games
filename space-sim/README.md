# ODISSEIA - Simulador de Exploracao Espacial 3D

Arquivo unico (`index.html`), sem build step, sem npm, sem bundler.
Abre com duplo clique ou publicado no GitHub Pages.

- **Engine:** three.js `0.185.1` via import map (jsDelivr, versao fixada).
- **Alvo:** Safari iOS (iPad/iPhone) e Chrome desktop. 60 fps no desktop, 30+ no iPad.
- **Controles:** teclado + mouse no desktop; dois joysticks virtuais no toque.
- **Semente:** o mesmo seed gera exatamente o mesmo sistema estelar em qualquer dispositivo.

Toda a documentacao tecnica (origem flutuante, cameras em camadas, quadtree
cube-sphere, orcamento de geracao por frame) esta em comentarios no proprio
arquivo, comecando pelo bloco `NOTA DE ARQUITETURA` no topo do modulo.
