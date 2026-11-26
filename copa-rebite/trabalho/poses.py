# renderiza as 6 poses fixas. uso: poses.py W H pasta [nomes...]
import sys, time, os
from cr import *
w, h, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
only = sys.argv[4:]
os.makedirs(out, exist_ok=True)
LUTA = "CR.duel([1,1,1,0],[0,0,0,0],7,180,{auto:true}); CR.G.skipRender=true; CR.advance(%d); CR.G.skipRender=false;"
POSES = [
 ('garagem_1', "CR.GAR.ang=.75; CR.GAR.idle=-999; CR.GAR.an.fill(0); CR.GAR.anV.fill(0)", 10),
 ('garagem_2', "CR.GAR.com=[0,2,2,4]; CR.GAR.pre=[0,2,2,4]; CR.GAR.cor=1; CR.GAR.num=42; CR.GAR.nome='Tranco'; CR.GAR.refresh(-1); CR.GAR.ang=-2.2; CR.GAR.idle=-999; CR.GAR.an.fill(0); CR.GAR.anV.fill(0); CR.GAR.row=3; CR.UI.garage(CR.GAR)", 10),
 ('arena_1_perseguicao', LUTA % 30 + "CR.G.cam=0", 10),
 ('arena_2_tv', LUTA % 420 + "CR.G.cam=2", 10),
 ('arena_3_bordo', LUTA % 150 + "CR.G.cam=1", 10),
 ('arena_4_fixa', LUTA % 1500 + "(()=>{const a=CR.SIM.bots[0].s,b=CR.SIM.bots[1].s,mx=(a[0]+b[0])/2,mz=(a[2]+b[2])/2,c=x=>Math.max(-6.2,Math.min(6.2,x)); let dx=-(b[2]-a[2]),dz=(b[0]-a[0]),l=Math.hypot(dx,dz)||1; dx/=l;dz/=l; if(Math.abs(mx+dx*2.6)>6.2||Math.abs(mz+dz*2.6)>6.2){dx=-dx;dz=-dz} CR.G.camFix=[c(mx+dx*2.6),0.6,c(mz+dz*2.6),mx,0.2,mz,0.8]})()", 10),
]
with sync_playwright() as pw:
    for name, pre, n in POSES:
        if only and name not in only: continue
        b, pg, logs = abrir(pw, w, h, query=f'cap=1&w={w}&h={h}')
        pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=180000)
        pg.evaluate("localStorage.clear()")
        pg.evaluate(pre); t = time.time(); r = pg.evaluate(f"CR.frame({n})"); pg.screenshot(path=f'{out}/{name}.png'); print(name, r, round(time.time() - t, 1), 's', flush=True)
        for l in logs[:6]: print(l[:500])
        b.close()
