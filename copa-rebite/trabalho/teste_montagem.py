# VERIFICACAO DE MONTAGEM: monta as 162 combinacoes, confere geometria (sem peca flutuando/atravessada),
# que cada uma aparece na bancada, que as barras mudam e que o limite de peso barra as pesadas.
import sys, json, itertools, time
from cr import *
falhas = []; rel = []
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 480, 270, query='cap=1&w=480&h=270&q=0')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=180000)
    pg.evaluate("localStorage.clear(); CR.GAR.idle=-999; CR.GAR.ang=.8; CR.G.camFix=[1.5,1.42,2.15,-.38,.8,0,.62]")
    pg.evaluate("CR.GAR.an.fill(0); CR.GAR.anV.fill(0)")
    pg.evaluate("CR.visPixels(true)")
    lim = pg.evaluate("CR.PESO_MAX"); t0 = time.time()
    for n, c in enumerate(itertools.product(range(3), range(3), range(3), range(6))):
        r = pg.evaluate(f"""(async()=>{{ const b={list(c)}; CR.GAR.com=b.slice(); CR.GAR.pre=b.slice(); CR.GAR.mode=0; CR.GAR.refresh(-1); CR.GAR.an.fill(0); CR.GAR.anV.fill(0);
            const st=CR.statsOf(b), erros=CR.checkBuild(b), px=await CR.visPixels(false);
            const barras=[...document.querySelectorAll('#gbars u')].map(u=>+u.dataset.v), vai=document.querySelector('.row.go'), alerta=document.querySelector('#gal').className;
            let entrou=null; if(!st.ok){{ const r=CR.GAR.go(); entrou=(r!==false)||CR.G.st!=='garagem'; }}
            return {{b, kg:st.kg, ok:st.ok, erros, px, barras, botaoBloqueado:vai.classList.contains('no'), alerta, entrou, inst:Array.from(CR.R.im.slice(8,20)).filter(x=>x>=0).length}} }})()""")
        rel.append(r)
        if r['erros']: falhas.append((c, 'geometria', r['erros']))
        if r['px'] < 1500: falhas.append((c, 'nao aparece', r['px']))
        if r['ok'] != (r['kg'] <= lim): falhas.append((c, 'limite incoerente', r['kg']))
        if not r['ok'] and (r['entrou'] or not r['botaoBloqueado'] or 'bad' not in r['alerta']): falhas.append((c, 'montagem pesada nao foi barrada', r['kg']))
        if r['ok'] and (r['botaoBloqueado'] or 'ok' not in r['alerta']): falhas.append((c, 'montagem legal bloqueada', r['kg']))
        esperado = 1 + (2 if c[1] == 2 else 4) + 5 + 2
        if r['inst'] != esperado: falhas.append((c, 'pecas desenhadas', r['inst'], esperado))
        if n % 27 == 26: print(f'{n + 1}/162  {time.time() - t0:.0f}s  falhas {len(falhas)}', flush=True)
    # barras mudam ao trocar cada peca
    idx = {tuple(r['b']): r for r in rel}; iguais = 0
    for c in idx:
        for slot, nopt in enumerate((3, 3, 3, 6)):
            for o in range(nopt):
                if o == c[slot]: continue
                d = list(c); d[slot] = o
                if idx[tuple(d)]['barras'] == idx[c]['barras']: iguais += 1; falhas.append((c, 'barras nao mudaram ao trocar', slot, o))
    pesadas = [r for r in rel if not r['ok']]
    res = {'combinacoes': len(rel), 'legais': len(rel) - len(pesadas), 'barradas_pelo_peso': len(pesadas), 'limite_kg': lim, 'peso_min': min(r['kg'] for r in rel), 'peso_max': max(r['kg'] for r in rel),
           'pixels_min': min(r['px'] for r in rel), 'trocas_sem_mudar_barra': iguais, 'falhas': [list(map(str, f)) for f in falhas]}
    json.dump({'resumo': res, 'itens': rel}, open(RAIZ / 'trabalho' / 'relatorio_montagem.json', 'w'), indent=1)
    print(json.dumps(res, indent=1, ensure_ascii=False)[:3000])
    for l in logs[:5]: print(l[:400])
    b.close()
print('MONTAGEM:', 'PASSOU' if not falhas else f'FALHOU ({len(falhas)})')
sys.exit(1 if falhas else 0)
