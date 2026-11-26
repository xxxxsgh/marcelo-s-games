#!/bin/sh
# uso: rodada.sh N [gravar]  -> regrava o roteiro (se pedido), renderiza poses 1080p e serie da luta em trabalho/critico/rN
cd "$(dirname "$0")"; N=$1
if [ "$2" = gravar ]; then python3 gravar_roteiro.py > gravar.log 2>&1 || { echo FALHA_GRAVAR; exit 1; }; (cd .. && node build.mjs >/dev/null); fi
mkdir -p critico/r$N
python3 poses.py 1920 1080 critico/r$N > critico/r$N/poses.log 2>&1
python3 capturar_luta.py serie 960 540 critico/r$N 120 3 > critico/r$N/serie.log 2>&1
echo FIM >> critico/r$N/serie.log
