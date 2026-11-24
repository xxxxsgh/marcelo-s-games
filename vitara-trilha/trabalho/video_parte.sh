#!/bin/bash
# video_parte.sh <n 0..5> — renderiza um trecho de 600 quadros (10 s) da volta roteirizada em 1920x1080 a 60 qps.
# Os trechos são independentes (cada um simula até o seu início) e podem ser refeitos isoladamente.
set -e
cd "$(dirname "$0")"; mkdir -p video_partes
N=$1; INI=$((N*600)); FIM=$((INI+600))
CAPPNG=critico/final/quadros node captura.cjs video video_partes/parte$N.tmp.mp4 $INI $FIM > video_partes/parte$N.log 2>&1
mv video_partes/parte$N.tmp.mp4 video_partes/parte$N.mp4
echo PARTE_${N}_PRONTA
