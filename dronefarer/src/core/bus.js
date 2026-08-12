/** Barramento de eventos minimo. Sistemas conversam por aqui, sem se importar. */
export function createBus() {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt)?.delete(fn);
    },
    once(evt, fn) {
      const off = this.on(evt, (...a) => { off(); fn(...a); });
      return off;
    },
    emit(evt, payload) {
      const set = map.get(evt);
      if (!set) return;
      for (const fn of set) {
        try { fn(payload); } catch (e) { console.error(`[bus:${evt}]`, e); }
      }
    },
    clear() { map.clear(); },
  };
}
