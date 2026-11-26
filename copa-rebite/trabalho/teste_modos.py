# teste dos modos extras: conquistas, melhorias, desafios, amistoso e sobrevivencia (teclado, lutas aceleradas)
import sys
from cr import *
ok = True
def chk(n, c, i=''):
    global ok; ok = ok and bool(c); print('ok   ' if c else 'FALHA', n, str(i)[:200], flush=True)
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 480, 270, query='cap=1&w=480&h=270&q=0')
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=180000)
    E = pg.evaluate
    def key(k): pg.keyboard.press(k); E("CR.advance(1)")
    def luta():
        for i in range(60):
            st = E("CR.G.st")
            if st == 'intro': E("CR.G.ft[7]=9; CR.advance(1)")
            elif st == 'contagem': E("CR.advance(200)")
            elif st == 'luta': E("CR.G.fast=40; CR.advance(280); CR.G.fast=1")
            elif st in ('fim', 'juizes'): E("CR.G.fast=40; CR.advance(20); CR.G.fast=1")
            elif st == 'livre': E("CR.advance(1)"); return
            else: E("CR.advance(5)")
    E("localStorage.clear(); CR.G.skipRender=true; CR.G.auto=true")
    for row, flag in ((9, 'verConq'), (11, 'verUp'), (12, 'verDes')):
        E(f"CR.GAR.row={row}; CR.GAR.mode=0; CR.UI.garage(CR.GAR)"); key('Enter'); a = E(f"CR.GAR.{flag}"); n = E("document.querySelectorAll('#rows > *').length"); key('Escape'); c = E(f"CR.GAR.{flag}")
        chk(f'painel {flag} abre e fecha', a == 1 and c == 0 and n > 1, (a, c, n))
    # melhorias: compra com sucata
    E("CR.CAR.sucata=200; CR.GAR.row=11; CR.UI.garage(CR.GAR)"); key('Enter'); key('Enter'); r = E("[CR.CAR.sucata, CR.CAR.up0]"); key('Enter'); r2 = E("[CR.CAR.sucata, CR.CAR.up0, CR.UI.el.toast.textContent]"); key('Escape')
    chk('melhoria comprada desconta a sucata e falta de sucata bloqueia', r == [50, 1] and r2[:2] == [50, 1], (r, r2))
    hm0 = E("(CR.duel([1,1,1,0],[0,0,0,0],1,10,{auto:true}), CR.SIM.bots[0].hpMax[0])"); E("CR.GAR.enter(false)")
    # desafio
    E("CR.GAR.row=12; CR.GAR.mode=0; CR.UI.garage(CR.GAR)"); key('Enter'); key('ArrowDown'); key('ArrowDown'); key('Enter')
    st = E("[CR.G.st, CR.G.round, CR.SIM.modo, CR.SIM.bots[0].hpMax[0]]"); chk('desafio inicia com a arena da regra e melhoria aplicada', st[0] == 'intro' and 'FORNALHA' in st[1] and st[2] == 1 and st[3] > hm0 * 1.05, (st, hm0))
    luta(); m = E("[CR.UI.el.msg.textContent, CR.SIM.winner, CR.CAR.des]"); chk('desafio termina com resultado', m[0] in ('DESAFIO CUMPRIDO', 'DESAFIO FALHOU') and (m[2] == 4) == (m[0] == 'DESAFIO CUMPRIDO'), m); key('Enter'); E("CR.advance(2)")
    chk('volta para a garagem', E("CR.G.st") == 'garagem')
    # regra de montagem
    E("CR.GAR.row=12; CR.GAR.mode=0; CR.GAR.desSel=1; CR.UI.garage(CR.GAR)"); key('Enter'); key('Enter'); chk('desafio recusa montagem fora da regra', E("CR.G.st") == 'garagem', E("CR.UI.el.toast.textContent")); key('Escape')
    # amistoso
    E("CR.GAR.row=8; CR.GAR.mode=0; CR.UI.garage(CR.GAR)"); key('ArrowRight'); key('ArrowRight'); key('Enter'); chk('amistoso contra o rival escolhido', E("CR.G.st") == 'intro' and E("CR.SIM.bots[1].nome") == 'Quebra-Noz', E("CR.SIM.bots[1].nome"))
    luta(); s0 = E("CR.CAR.sucata"); key('Enter'); E("CR.advance(2)"); chk('amistoso da sucata e volta para a garagem', E("CR.G.st") == 'garagem' and s0 >= 60, s0)
    # sobrevivencia
    E("CR.GAR.row=10; CR.GAR.mode=0; CR.UI.garage(CR.GAR)"); key('Enter'); chk('sobrevivencia inicia', E("CR.G.st") == 'intro' and E("CR.G.surv") == 0)
    n = 0
    for k in range(12):
        luta(); w = E("CR.SIM.winner"); hp = E("Array.from(CR.SIM.bots[0].hp)"); key('Enter'); E("CR.advance(2)")
        if w != 0: break
        n += 1; hp2 = E("Array.from(CR.SIM.bots[0].hp)"); chk(f'sobrevivencia: dano continua na luta {n + 1}', all(abs(a - c) < .01 or c <= a for a, c in zip(hp, hp2)) and E("CR.G.surv") == n)
    chk('sobrevivencia termina e grava o recorde', E("CR.G.st") == 'garagem' and E("CR.CAR.rec") == n, (n, E("CR.CAR.rec")))
    chk('carreira salva', E("JSON.parse(localStorage.getItem('copaRebite.v1')).car.rec") == n)
    err = [l for l in logs if 'error' in l.lower()]; chk('sem erros no console', not err, err[:2])
    b.close()
print('MODOS EXTRAS:', 'PASSOU' if ok else 'FALHOU'); sys.exit(0 if ok else 1)
