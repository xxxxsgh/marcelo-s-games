const KEY = 'estrelas-que-riem:v1';

export function load() {
  try { return { level: 0, current: 0, sunsets: 0, stars: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { level: 0, current: 0, sunsets: 0, stars: 0 }; }
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* modo privado: tudo bem */ }
}
