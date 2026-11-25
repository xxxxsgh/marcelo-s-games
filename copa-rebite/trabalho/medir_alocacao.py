from cr import *
GP2 = "navigator.getGamepads = (()=>{const a=[null,null,null,null]; return ()=>a})();"
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 480, 270, query='cap=1&w=480&h=270&q=0', init=GP2)
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=180000)
    pg.evaluate("window.MEDE=()=>{ const o=window.__o||(window.__o=new Float64Array(58)), dt=1/60, G=CR.G, pm=performance.memory; CR.roteiro(); for(let w=0;w<58;w++){ const a=pm.usedJSHeapSize; for(let i=0;i<60;i++) G.tick(dt); o[w]=pm.usedJSHeapSize-a; } }")
    for k in range(3):
        pg.evaluate("MEDE()"); o = pg.evaluate("Array.from(__o)"); print(k, 'zeros', sum(1 for v in o if v == 0), 'mediana/quadro', sorted(o)[29] / 60, [int(v) for v in o], flush=True)
    b.close()
