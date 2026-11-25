# captura quadro a quadro da luta roteirizada (passo fixo de 1/60 s), no Chrome com WebGPU.
#   capturar_luta.py video  W H [seg_ini seg_fim]   -> segmentos de 300 quadros em quadros/seg_NN.mp4 (retomavel) e luta.mp4 ao final
#   capturar_luta.py serie  W H pasta passo n_rajadas -> um quadro a cada 'passo' quadros + rajadas de 8 quadros consecutivos
import sys, os, subprocess, time
from cr import *
modo, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
# resolucao interna de render (padrao = a da tela). Ex.: INTERNA=1280x720 quando so ha renderizacao por software
CRIT = os.environ.get('CRITICO', '')
IW, IH = [int(v) for v in os.environ.get('INTERNA', f'{W}x{H}').split('x')]
Q = RAIZ / 'trabalho' / 'quadros'; os.makedirs(Q, exist_ok=True)
def pagina(pw):
    b, pg, logs = abrir(pw, W, H, query=f'cap=1&w={IW}&h={IH}')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=300000)
    pg.evaluate("localStorage.clear(); CR.roteiro()")
    return b, pg, logs
with sync_playwright() as pw:
    if modo == 'video':
        s0 = int(sys.argv[4]) if len(sys.argv) > 4 else 0; s1 = int(sys.argv[5]) if len(sys.argv) > 5 else 12
        for seg in range(s0, s1):
            out = Q / f'seg_{seg:02d}.mp4'
            if out.exists(): print('ja existe', out.name, flush=True); continue
            b, pg, logs = pagina(pw); t0 = time.time(); d = Q / f'tmp_{seg:02d}'; os.makedirs(d, exist_ok=True)
            for k in range(300):
                f = seg * 300 + k + 1
                r = pg.evaluate(f"CR.goto({f}, {8 if k == 0 else 0})")
                pg.screenshot(path=str(d / f'{k:04d}.png'))
                if CRIT and (f % 30 == 0 or any(r0 <= f < r0 + 8 for r0 in (900, 1900, 2900))):   # copia para o pacote do critico
                    import shutil; r = [r0 for r0 in (900, 1900, 2900) if r0 <= f < r0 + 8]; nome = f'rajada{(900, 1900, 2900).index(r[0]) + 1}_q{f - r[0] + 1}_t{f / 60:06.3f}s.png' if r else f'luta_t{f / 60:05.1f}s.png'; shutil.copy(str(d / f'{k:04d}.png'), os.path.join(CRIT, nome))
                if k % 50 == 49: print(f'seg {seg} quadro {k + 1}/300  {(time.time() - t0) / (k + 1):.1f} s/quadro  {r}', flush=True)
            b.close()
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '60', '-i', str(d / '%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', '60', str(out)], check=True)
            for p in d.iterdir(): p.unlink()
            d.rmdir()
        segs = sorted(Q.glob('seg_*.mp4'))
        if len(segs) == 12:
            open(Q / 'lista.txt', 'w').write(''.join(f"file '{s.name}'\n" for s in segs))
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(Q / 'lista.txt'), '-c', 'copy', '-movflags', '+faststart', str(RAIZ / 'luta.mp4')], check=True)
            print('luta.mp4 pronto')
    else:
        pasta, passo, nraj = sys.argv[4], int(sys.argv[5]), int(sys.argv[6])
        os.makedirs(pasta, exist_ok=True); b, pg, logs = pagina(pw); t0 = time.time()
        alvo = {f: f'luta_t{f / 60:05.1f}s.png' for f in range(passo, 3601, passo)}
        raj = [900, 1900, 2900][:nraj]
        for i, r0 in enumerate(raj):
            for k in range(8): alvo[r0 + k] = f'rajada{i + 1}_q{k + 1}_t{(r0 + k) / 60:06.3f}s.png'
        ant = -99
        for f in sorted(alvo):
            pg.evaluate(f"CR.goto({f}, {0 if f == ant + 1 else 6})"); pg.screenshot(path=os.path.join(pasta, alvo[f])); ant = f
            print(alvo[f], f'{time.time() - t0:.0f}s', flush=True)
        b.close()
