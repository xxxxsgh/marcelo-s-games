# utilitario comum: abre o jogo no Chrome/Chromium com WebGPU
import os, sys, pathlib
from playwright.sync_api import sync_playwright
RAIZ = pathlib.Path(__file__).resolve().parent.parent
WIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
def chrome_path():
    if os.path.exists(WIN): return WIN
    p = os.environ.get('CHROME')
    if p: return p
    return '/opt/pw-browsers/chromium'
def abrir(pw, w=1920, h=1080, headless=True, query='', extra=None):
    args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc', '--disable-renderer-backgrounding', '--disable-gpu-watchdog', '--enable-logging=stderr', '--disable-gpu-process-crash-limit', '--disable-background-timer-throttling']
    if os.name != 'nt': args += ['--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
    else: args += ['--enable-gpu', '--use-angle=d3d11'] + (['--headless=new'] if headless else [])
    if extra: args += extra
    b = pw.chromium.launch(executable_path=chrome_path(), headless=headless if os.name != 'nt' else False, args=args)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
    pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
    pg.goto((RAIZ / 'index.html').as_uri() + ('?' + query if query else ''))
    return b, pg, logs
