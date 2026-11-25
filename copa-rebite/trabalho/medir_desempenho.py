# VERIFICACAO DE DESEMPENHO (rodar na maquina-alvo, com janela visivel):
#   python trabalho/medir_desempenho.py
# Abre o Chrome em tela cheia, roda a luta roteirizada de 60 s em tempo real e grava
# trabalho/relatorio_desempenho.md com media, percentil 99 e maximo do tempo de GPU (timestamp-query)
# e do tempo de quadro (requestAnimationFrame).
import sys, os, json, time, datetime
from cr import *
with sync_playwright() as pw:
    args = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--kiosk', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--enable-precise-memory-info',
            '--enable-dawn-features=allow_unsafe_apis', '--enable-webgpu-developer-features']
    b = pw.chromium.launch(executable_path=chrome_path(), headless=False, args=args)
    ctx = b.new_context(no_viewport=True); pg = ctx.new_page()
    pg.goto((RAIZ / 'index.html').as_uri())
    pg.wait_for_function("window.CR&&(CR.pronto||CR.erro)", timeout=120000)
    if pg.evaluate("CR.erro"): print('ERRO:', pg.evaluate("CR.erro")); sys.exit(1)
    pg.wait_for_timeout(3000)                      # deixa a garagem estabilizar
    pg.evaluate("CR.perfStart(8000); CR.roteiro()")
    pg.wait_for_function("CR.SIM.t >= 60", timeout=180000)
    r = pg.evaluate("CR.perfEnd()"); extra = pg.evaluate("({hits:CR.G.hits, pecas:CR.G.detached, hash:CR.SIM.hash(), esperado:ROTEIRO.hash, ua:navigator.userAgent, dpr:devicePixelRatio, tela:screen.width+'x'+screen.height})")
    b.close()
def linha(n, s): return f"| {n} | {s['n']} | {s['media']:.2f} | {s['p50']:.2f} | {s['p99']:.2f} | {s['max']:.2f} | {s['acima16_7']} |" if s else f"| {n} | indisponivel | | | | | |"
gpu, q = r['gpu'], r['quadro']
ok = bool(gpu) and gpu['media'] <= 12 and q and q['max'] <= 16.7 + 0.5
md = f"""# Relatorio de desempenho — luta roteirizada de 60 s

- Data: {datetime.datetime.now():%Y-%m-%d %H:%M}
- Adaptador WebGPU: {r['adaptador']}
- Resolucao interna: {r['res']} (tela {extra['tela']}, devicePixelRatio {extra['dpr']})
- Navegador: {extra['ua']}
- timestamp-query: {'sim' if r['timestampQuery'] else 'NAO (tempo de GPU indisponivel)'}
- Luta: {extra['hits']} impactos, {extra['pecas']} pecas arrancadas, soma de verificacao {extra['hash']} (gravada: {extra['esperado']})

| medida (ms) | amostras | media | mediana | p99 | maximo | acima de 16,7 ms |
|---|---|---|---|---|---|---|
{linha('tempo de GPU por quadro', gpu)}
{linha('tempo de quadro (rAF)', q)}

Alvo: GPU <= 12 ms na media e nenhum quadro acima de 16,7 ms. Resultado: **{'ATENDE' if ok else 'NAO ATENDE'}**
"""
open(RAIZ / 'trabalho' / 'relatorio_desempenho.md', 'w', encoding='utf-8').write(md); print(md)
