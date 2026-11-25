import sys, time
from cr import *
w, h = int(sys.argv[1]), int(sys.argv[2])
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, w, h, query=f'cap=1&w={w}&h={h}')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    print('tris', pg.evaluate("CR.R.triCount"), 'arena', pg.evaluate("CR.MESH.arena.count/3"), 'garage', pg.evaluate("CR.MESH.garage.count/3"))
    pg.evaluate("CR.duel([1,1,1,0],[0,0,0,0],7,180,{auto:true})")
    pg.evaluate("CR.frame(2)")
    def T(label, pre):
        pg.evaluate(pre); t = time.time(); pg.evaluate("CR.frame(3)"); print(label, round((time.time() - t) / 3, 2), 's/quadro', flush=True)
    T('completo', "0")
    T('sem mundo', "CR.R.im[0]=-1;CR.R.im[1]=-1")
    T('sem nada', "CR.R.im.fill(-1);CR.R.fog=0;CR.R.quality=0")
    b.close()
