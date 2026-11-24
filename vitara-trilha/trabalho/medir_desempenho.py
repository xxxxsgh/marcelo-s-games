# medir_desempenho.py — mede a volta roteirizada de 60 s em tempo real na máquina-alvo (Chrome com janela, GPU real).
# Uso:  python trabalho/medir_desempenho.py
# Saída: trabalho/relatorio_desempenho.txt e trabalho/log_quadros.csv
import json, os, statistics, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
cmds = json.loads((AQUI / "volta_comandos.json").read_text(encoding="utf-8"))["frames"]

def pct(v, p):
    s = sorted(v); return s[min(len(s) - 1, int(round(p / 100 * (len(s) - 1))))]

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME if os.path.exists(CHROME) else None, headless=False,
        args=["--enable-webgpu-developer-features", "--window-size=1920,1080", "--start-fullscreen", "--disable-frame-rate-limit=0", "--force-device-scale-factor=1"])
    pg = b.new_page(no_viewport=True)
    pg.on("console", lambda m: print("[console]", m.text) if m.type == "error" else None)
    pg.goto((AQUI.parent / "index.html").as_uri() + "?perf=1")
    pg.evaluate("() => window.__t.ready")
    info = pg.evaluate("""async () => { const a = await navigator.gpu.requestAdapter({powerPreference:'high-performance'}); const i = a.info || {}; return {vendor: i.vendor, arch: i.architecture, device: i.device, desc: i.description, canvas: [__t.GPU.W, __t.GPU.H], inner: [innerWidth, innerHeight], dpr: devicePixelRatio}; }""")
    pg.wait_for_timeout(3000)  # deixa compilar pipelines e estabilizar
    r = pg.evaluate("""async (cmds) => {
      const pad = { index: 0, id: 'Controle da volta roteirizada (STANDARD GAMEPAD)', connected: true, mapping: 'standard', timestamp: 0, axes: [0,0,0,0], buttons: [] };
      for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
      Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
      const e = new Event('gamepadconnected'); e.gamepad = pad; window.dispatchEvent(e);
      await __t.perfRun(cmds.slice(0, 240), pad);          // aquecimento (4 s), descartado
      return await __t.perfRun(cmds, pad); }""", cmds)
    b.close()

fm, gm = r["frameMs"], r["gpuMs"]
L = []
L.append("RELATÓRIO DE DESEMPENHO — volta roteirizada de 60 s em tempo real")
L.append(f"Adaptador: {info}")
L.append(f"Resolução interna: {r['w']}x{r['h']}   quadros: {len(fm) + 1}   volta: {'completa' if r['laps'] >= 1 else 'NÃO COMPLETOU'} ({r['lastMs'] / 1000:.3f} s)   resets: {r['resets']}")
L.append("")
L.append(f"Intervalo entre quadros (ms): média {statistics.mean(fm):.2f}   p99 {pct(fm, 99):.2f}   máx {max(fm):.2f}   quadros > 16,7 ms: {sum(1 for x in fm if x > 16.9)}")
if r["hasTS"] and gm:
    L.append(f"Tempo de GPU por quadro (ms, soma das passadas, {len(gm)} amostras): média {statistics.mean(gm):.2f}   p99 {pct(gm, 99):.2f}   máx {max(gm):.2f}")
    L.append("Por passada (média, ms): " + "  ".join(f"{n} {v:.2f}" for n, v in zip(r["passNames"], r["passMs"])))
    ok1, ok2 = statistics.mean(gm) <= 12.0, max(gm) <= 16.7
    L.append("")
    L.append(f"ALVO média de GPU <= 12 ms: {'PASSA' if ok1 else 'FALHA'}")
    L.append(f"ALVO nenhum quadro de GPU > 16,7 ms: {'PASSA' if ok2 else 'FALHA'}")
else:
    L.append("Sem 'timestamp-query' neste navegador: tempo de GPU não medido (só o intervalo entre quadros).")
txt = "\n".join(L); print(txt)
(AQUI / "relatorio_desempenho.txt").write_text(txt + "\n", encoding="utf-8")
with open(AQUI / "log_quadros.csv", "w", encoding="utf-8") as f:
    f.write("quadro,intervalo_ms\n"); [f.write(f"{i},{x:.3f}\n") for i, x in enumerate(fm)]
    f.write("\namostra,gpu_ms\n"); [f.write(f"{i},{x:.3f}\n") for i, x in enumerate(gm)]
