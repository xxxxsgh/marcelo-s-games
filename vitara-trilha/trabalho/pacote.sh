#!/bin/bash
# pacote.sh <rodada> [passo da volta em quadros; 30 = um quadro a cada meio segundo]
# Monta o pacote do crítico visual: 6 poses fixas, quadros da volta roteirizada e 3 rajadas de 8 quadros consecutivos (1920x1080).
set -e
cd "$(dirname "$0")"
D=critico/rodada$1; PASSO=${2:-30}
mkdir -p $D
node captura.cjs poses $D/poses
node captura.cjs quadros $D/volta 0 3600 $PASSO 5
node captura.cjs quadros $D/rajada1 560 568 1 5
node captura.cjs quadros $D/rajada2 1085 1093 1 5
node captura.cjs quadros $D/rajada3 2200 2208 1 5
echo PACOTE_PRONTO
