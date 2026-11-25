# grava os comandos da luta roteirizada de 60 s (piloto automatico -> trilha de comandos) em source/85_roteiro.js
import sys, base64, json
from cr import *
A, B, EB = [1, 1, 1, 0], [1, 2, 0, 3], 2
N = 3600
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 320, 180, query='cap=1&w=320&h=180&q=0')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    best = None
    for seed in range(1, 60):
        r = pg.evaluate(f"""(()=>{{ CR.G.skipRender=true; CR.duel({A},{B},{seed},180,{{auto:true, rec:{N}, eb:{EB}, nb:'Catapimba', cb:1}}); let flips=0, air=0; for(let i=0;i<{N};i++){{ CR.advance(1); if(CR.SIM.bots[0].R[4]<0) flips++; if(CR.SIM.bots[0].s[1]>0.6||CR.SIM.bots[1].s[1]>0.6) air++; if(CR.SIM.over) break; }}
          const S=CR.SIM; return {{seed:{seed}, over:S.over, t:S.t, hitsB:CR.G.hitsB, hits:CR.G.hits, detB:CR.G.detB, det:CR.G.detached, flips, air, pen:CR.G.maxPen, hash:S.hash(), rec: btoa(String.fromCharCode(...new Uint8Array(CR.G.rec.buffer))) }} }})()""")
        ok = (not r['over']) and r['hitsB'] >= 6 and r['detB'] >= 1 and r['det'] >= 2 and r['air'] > 20
        print({k: v for k, v in r.items() if k != 'rec'}, 'OK' if ok else '', flush=True)
        score = r['hitsB'] + 4 * r['detB'] + (r['air'] > 20) * 5 - (r['flips'] > 900) * 10
        if ok and (best is None or score > best[0]): best = (score, r)
        if best and seed > best[1]['seed'] + 12: break
    if not best: print('nenhuma semente serviu'); sys.exit(1)
    r = best[1]; d = bytearray(base64.b64decode(r['rec']))
    # trocas de camera (botao Y = bit 8): perseguicao -> a bordo -> TV -> perseguicao
    for f in (840, 1440, 2400): d[f * 3 + 2] |= 8
    open(RAIZ / 'source' / '85_roteiro.js', 'w').write("// comandos gravados da luta roteirizada (gerado por trabalho/gravar_roteiro.py)\nconst ROTEIRO = " + json.dumps({'a': A, 'b': B, 'seed': r['seed'], 'eb': EB, 'nb': 'Catapimba', 'cb': 1, 'hash': r['hash'], 'dados': base64.b64encode(bytes(d)).decode()}) + ";\n")
    print('gravado: semente', r['seed'], 'hash', r['hash'])
    b.close()
