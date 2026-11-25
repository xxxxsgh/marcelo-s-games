#!/bin/bash
# video_parte.sh — renderiza a volta roteirizada (1920x1080, 60 qps) em 18 trechos de 200 quadros, pulando os já prontos.
# Os trechos são independentes (cada um simula até o seu início), então o trabalho pode ser retomado depois de uma interrupção.
cd "$(dirname "$0")"; mkdir -p video_partes
for N in $(seq 0 17); do
  [ -f video_partes/parte$N.mp4 ] && continue
  INI=$((N*200)); FIM=$((INI+200))
  CAPPNG=critico/final/quadros node captura.cjs video video_partes/parte$N.tmp.mp4 $INI $FIM > video_partes/parte$N.log 2>&1 || exit 1
  mv video_partes/parte$N.tmp.mp4 video_partes/parte$N.mp4
  echo PARTE_${N}_PRONTA
done
echo TODAS_PRONTAS
