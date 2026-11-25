import sys, time, json
from cr import *
A = sys.argv[1] if len(sys.argv) > 1 else "[1,1,1,0],[0,0,0,0],7"
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 320, 180, query='cap=1&w=320&h=180&q=0')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    pg.evaluate(f"CR.G.skipRender=true; CR.duel({A},180,{{auto:true}})")
    for i in range(int(sys.argv[2]) if len(sys.argv) > 2 else 40):
        pg.evaluate("CR.advance(90)")
        print(pg.evaluate("(()=>{const S=CR.SIM,f=B=>B.s[0].toFixed(1)+','+B.s[2].toFixed(1)+' y'+B.s[1].toFixed(2)+' up'+B.R[4].toFixed(1)+' v'+Math.hypot(B.s[7],B.s[9]).toFixed(1)+' w'+Math.round(B.wspin)+' hp['+Array.from(B.hp).map(x=>Math.round(x)).join(' ')+'] imm'+B.imm.toFixed(0);return S.t.toFixed(1)+' | '+f(S.bots[0])+' | '+f(S.bots[1])+' | hits '+CR.G.hits+' det '+CR.G.detached+' over '+S.over+' '+S.koBy+' pen '+CR.G.maxPen.toFixed(2)})()"))
        if pg.evaluate("CR.SIM.over"): break
    for l in logs[:10]: print(l[:600])
    b.close()
