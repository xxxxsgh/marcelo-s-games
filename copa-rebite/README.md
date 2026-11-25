# Copa Rebite

Torneio de combate de robôs sobre rodas, 3D, em tempo real, num único `index.html` (WebGPU, sem engine, sem
biblioteca 3D ou de física, sem arquivos de textura/modelo/áudio — tudo é gerado pelo código).

- **Jogar:** abra `index.html` no Chrome atualizado (funciona de `file://`, sem rede).
- **Montar de novo:** `node build.mjs` (concatena `source/*.js`, `source/ui.css` e `source/shell.html`).

## Controles

| | Gamepad (layout padrão) | Teclado |
|---|---|---|
| Garagem: encaixe / peça | direcional | setas |
| Confirmar / voltar | A / B | Enter / Esc |
| Girar o robô na bancada | analógico direito | Q / E |
| Ir para a luta | Start | Enter em "Ir para a luta" |
| Acelerar / frear e ré | RT / LT (proporcionais) | W / S |
| Esterçar | analógico esquerdo | A / D |
| Arma | A | Espaço |
| Desvirar | X | F |
| Câmera | Y | C |
| Voltar ao canto | B | R |
| Pausa | Start | Esc / P |

## Fontes (`source/`)

| arquivo | conteúdo |
|---|---|
| `00_math.js` | matemática sem alocação, gerador aleatório com semente, registradores pré-alocados |
| `10_mesh.js` | construtor de malhas procedurais (caixas chanfradas, cilindros, extrusões, cabos, correntes) |
| `20_parts.js` | catálogo de peças (peso, velocidade, aceleração, giro, resistência, dano) e geometria dos robôs |
| `30_world.js` | arena, galpão, plateia, boxes, mesa dos juízes, garagem |
| `40_shaders.js` | WGSL: materiais procedurais, iluminação, volumétrico, TAA, bloom, desfoque de movimento |
| `50_gpu.js` | renderizador WebGPU (diferido, sombras, cubo de ambiente, pós-processamento) |
| `60_sim.js` | simulação determinística: corpo rígido, pneus, armas, armadilhas, dano por peça, IA, juízes |
| `70_fx.js` | faíscas, lascas, fumaça, fogo, luzes dinâmicas, marcas no piso (buffers pré-alocados) |
| `72_draw.js` … `80_game.js` | desenho dos robôs, atlas de adesivos, entrada, interface, garagem, torneio, replay |
| `85_roteiro.js` | comandos gravados da luta roteirizada de 60 s |

## Verificações (`trabalho/`)

```
python trabalho/teste_montagem.py      # 162 montagens: geometria, visibilidade, barras, limite de peso
python trabalho/teste_controles.py     # gamepad/teclado, luta roteirizada, torneio completo, alocação zero
python trabalho/medir_desempenho.py    # janela visível, máquina-alvo: tempo de GPU e de quadro em 60 s
python trabalho/poses.py 1920 1080 trabalho/critico/rN        # 6 poses fixas
python trabalho/capturar_luta.py video 1920 1080              # luta.mp4, quadro a quadro
python trabalho/gravar_roteiro.py      # regrava os comandos (necessário se a simulação mudar)
```

Os scripts usam o Chrome de `C:\Program Files\Google\Chrome\Application\chrome.exe` quando existe; fora do
Windows usam o Chromium do Playwright com WebGPU por software (variável `CHROME` troca o executável).
