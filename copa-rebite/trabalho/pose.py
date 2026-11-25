# uso: pose.py W H saida.png "JS de preparo" [n quadros]
import sys, time
from cr import *
w, h, out, pre = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
n = int(sys.argv[5]) if len(sys.argv) > 5 else 8
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, w, h, query=f'cap=1&w={w}&h={h}')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    pg.evaluate(pre); t = time.time(); print(pg.evaluate(f"CR.frame({n})"), round(time.time() - t, 1), 's')
    pg.screenshot(path=out)
    for l in logs[:10]: print(l[:900])
    b.close()
