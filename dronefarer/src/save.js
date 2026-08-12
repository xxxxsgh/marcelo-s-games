/**
 * Save em localStorage, com versao de schema e migracao.
 * Tudo dentro de try/catch: modo privado, cota cheia e storage bloqueado nao
 * podem derrubar o jogo — no pior caso o jogo roda sem salvar.
 */
import { GAME } from './config.js';

const KEY = GAME.saveKey;

/** Estado zerado. Toda chave nova do jogo comeca aqui. */
export function emptySave() {
  return {
    version: GAME.saveVersion,
    records: {},          // circuitId -> {time, splits[], medal, ghost[]}
    money: 0,
    upgrades: {},         // linha -> tier
    chassis: 'equilibrado',
    presets: {},
    discovered: [],       // POIs achados
    missions: {},         // missionId -> {done, best}
    options: {},          // qualidade, audio, bindings, sensibilidade
    stats: { flights: 0, crashes: 0, distance: 0, playtime: 0 },
    tutorialDone: false,
  };
}

/** Migra saves antigos. Cada passo leva de N pra N+1. */
const MIGRATIONS = {
  // 1: (s) => { s.novoCampo = 0; s.version = 2; return s; },
};

function migrate(data) {
  let s = data;
  while (s.version < GAME.saveVersion) {
    const step = MIGRATIONS[s.version];
    if (!step) { s.version = GAME.saveVersion; break; }
    s = step(s);
  }
  // Garante que chaves novas existam mesmo em save antigo.
  return { ...emptySave(), ...s, version: GAME.saveVersion };
}

export function createSave() {
  let data = emptySave();
  let available = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return data;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = migrate(parsed);
    } catch (e) {
      console.warn('[save] nao consegui ler, usando save novo:', e.message);
      data = emptySave();
    }
    return data;
  }

  let pending = 0;
  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      available = true;
    } catch (e) {
      available = false;
      console.warn('[save] nao consegui gravar:', e.message);
    }
  }

  /** Grava com debounce: o ghost e grande e o fim de corrida grava varias vezes. */
  function save(immediate = false) {
    if (immediate) { clearTimeout(pending); write(); return; }
    clearTimeout(pending);
    pending = setTimeout(write, 400);
  }

  load();

  return {
    get data() { return data; },
    get available() { return available; },
    load, save,

    /** Recorde de circuito. Grava so se melhorou. */
    setRecord(circuitId, record) {
      const prev = data.records[circuitId];
      if (prev && prev.time <= record.time) return false;
      data.records[circuitId] = record;
      save();
      return true;
    },
    getRecord(circuitId) { return data.records[circuitId] || null; },

    set(key, value) { data[key] = value; save(); },
    get(key, fallback) { return data[key] === undefined ? fallback : data[key]; },

    setOption(key, value) { data.options[key] = value; save(); },
    getOption(key, fallback) {
      return data.options[key] === undefined ? fallback : data.options[key];
    },

    addMoney(v) { data.money = Math.max(0, data.money + v); save(); return data.money; },

    /** Exporta o save como arquivo JSON (Fase 8). */
    exportFile() {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dronefarer-save-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /** Importa de um File. Devolve true se aceitou. */
    async importFile(file) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') return false;
        data = migrate(parsed);
        save(true);
        return true;
      } catch (e) {
        console.warn('[save] import falhou:', e.message);
        return false;
      }
    },

    reset() { data = emptySave(); save(true); },
  };
}
