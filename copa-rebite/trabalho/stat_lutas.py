# estatistica rapida de lutas IA x IA (duracao e desfecho)
import sys
from cr import *
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 320, 180, query='cap=1&w=320&h=180&q=0')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    r = pg.evaluate("""(()=>{ const out=[]; const B=[[1,1,1,0],[2,2,0,3],[0,0,0,0],[1,1,1,4],[1,0,2,1],[2,1,2,5],[0,1,2,2],[1,2,0,3]]; let k=0;
      for(let i=0;i<8;i++) for(let j=i+1;j<8;j++){ const S=CR.BG; S.setupBot(0,B[i],null,{nome:'a',cor:[1,0,0],num:1,estilo:i%4}); S.setupBot(1,B[j],null,{nome:'b',cor:[0,0,1],num:2,estilo:j%4}); S.bots[0].isAI=true; S.bots[1].isAI=true; S.start(100+k++); let g=0; while(!S.over&&g++<10900) S.step(); out.push([i,j,Math.round(S.t),S.koBy,S.winner]); }
      return out })()""")
    import collections
    c = collections.Counter(x[3] for x in r); ts = sorted(x[2] for x in r)
    print(c, 'mediana', ts[len(ts)//2], 'min', ts[0], 'curtas(<20s)', sum(1 for t in ts if t < 20))
    print(r)
    b.close()
