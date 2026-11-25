#!/bin/bash
# junta os 6 trechos em volta.mp4 (sem recodificar) e confere duração/quadros
set -e
cd "$(dirname "$0")"
for i in $(seq 0 17); do echo "file 'video_partes/parte$i.mp4'"; done > video_partes.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i video_partes.txt -c copy ../volta.mp4
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,r_frame_rate,nb_read_frames,duration -of default=nw=1 ../volta.mp4
