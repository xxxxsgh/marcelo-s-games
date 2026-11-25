import sys, time
from cr import *
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 960, 540, query='cap=1&w=960&h=540')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    pg.evaluate("CR.duel([1,1,1,0],[0,0,0,0],7,180,{auto:true})")
    pg.evaluate("CR.frame(2)")
    def T(label, pre):
        pg.evaluate(pre); t = time.time(); pg.evaluate("CR.frame(3)"); print(label, round((time.time() - t) / 3, 2), 's/quadro', flush=True)
    T('completo', "0")
    T('sem AO/SSR', "CR.R.quality=0")
    T('sem AO/SSR/vol', "CR.R.fog=0")
    T('+ iluminacao trivial (debug albedo)', "CR.R.debug=1")
    T('+ sem instancias dinamicas', "CR.R.im.fill(-1,2)")
    T('+ sem mundo', "CR.R.im[0]=-1;CR.R.im[1]=-1")
    b.close()
