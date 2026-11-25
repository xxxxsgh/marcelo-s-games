# teste do laco real (requestAnimationFrame, sem modo de captura): o jogo roda em tempo real, entra na luta pelo gamepad
# e segue sem erros. Onde o canvas WebGPU nao consegue apresentar (Chromium sem GPU), a textura de apresentacao e substituida.
import sys, time
from cr import *
INIT = """
window.__gp = null; navigator.getGamepads = () => [window.__gp, null, null, null];
(() => { const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { const c = gc.call(this, t, o); if (t !== 'webgpu' || !c || !window.__SEMTELA) return c;
  let dev = null, tex = null, fmt = null, cv = this; return { configure(d) { dev = d.device; fmt = d.format; }, getCurrentTexture() { if (!tex || tex.width !== cv.width || tex.height !== cv.height) tex = dev.createTexture({ size: [cv.width, cv.height], format: fmt, usage: GPUTextureUsage.RENDER_ATTACHMENT }); return tex; } }; }; })();
window.__SEMTELA = %s;
"""
with sync_playwright() as pw:
    b, pg, logs = abrir(pw, 480, 270, query='w=320&h=180&q=0', init=INIT % ('true' if os.name != 'nt' else 'false'))
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=180000)
    E = pg.evaluate; ok = True
    def chk(n, c, i=''):
        global ok; ok = ok and bool(c); print('ok   ' if c else 'FALHA', n, i, flush=True)
    E("localStorage.clear()"); pg.wait_for_timeout(3000)
    f0 = E("CR.R.frameNo"); pg.wait_for_timeout(4000); f1 = E("CR.R.frameNo")
    chk('laco de quadros roda sozinho na garagem', f1 > f0 + 2, f'{f1 - f0} quadros em 4 s')
    E("__gp={connected:true,id:'t',mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),vibrationActuator:{playEffect(){return Promise.resolve()}}}; window.dispatchEvent(Object.assign(new Event('gamepadconnected'),{gamepad:__gp}))")
    def press(i):
        E(f"__gp.buttons[{i}].pressed=true"); pg.wait_for_function(f"CR.IN.gpPrev[{i}]===1", timeout=60000); E(f"__gp.buttons[{i}].pressed=false"); pg.wait_for_function(f"CR.IN.gpPrev[{i}]===0", timeout=60000)
    press(9); chk('Start leva a chave', E("CR.G.st") == 'chave', E("CR.G.st"))
    press(0); chk('A leva a apresentacao', E("CR.G.st") == 'intro', E("CR.G.st"))
    press(0); press(0); pg.wait_for_function("CR.G.st==='luta'", timeout=240000); chk('contagem regressiva termina e a luta comeca', True)
    E("__gp.buttons[7].pressed=true; __gp.buttons[7].value=1"); t0 = E("CR.SIM.frame"); x0 = E("CR.SIM.bots[0].s[0]"); pg.wait_for_function(f"CR.SIM.frame>{t0}+60", timeout=240000); x1 = E("CR.SIM.bots[0].s[0]")
    chk('RT move o robo no laco real', x1 > x0 + .5, f'{x0:.2f} -> {x1:.2f}')
    err = [l for l in logs if 'error' in l.lower()]
    chk('sem erros no console', not err and not E("CR.R.lastError||''"), err[:3])
    b.close()
print('LACO REAL:', 'PASSOU' if ok else 'FALHOU'); sys.exit(0 if ok else 1)
