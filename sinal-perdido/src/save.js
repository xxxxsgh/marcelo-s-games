/** Registro local: recordes e preferencias. Falha em silencio se nao houver storage. */
const CHAVE = 'sinal-perdido/v1';

const PADRAO = {
  partidas: 0,
  vitorias: 0,
  melhorTempo: null,     // segundos da fuga mais rapida
  maisAbates: 0,
  maisNucleos: 0,
  audioLigado: true,
  ultimaSeed: '',
};

export function createSave() {
  let dados = { ...PADRAO };
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) dados = { ...PADRAO, ...JSON.parse(bruto) };
  } catch { /* modo privado ou storage bloqueado */ }

  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch { /* ignora */ }
  }

  return {
    get dados() { return dados; },
    registrarPartida(seed) {
      dados.partidas++;
      dados.ultimaSeed = seed;
      gravar();
    },
    registrarFim({ venceu, tempo, abates, nucleos }) {
      if (venceu) {
        dados.vitorias++;
        if (dados.melhorTempo == null || tempo < dados.melhorTempo) dados.melhorTempo = tempo;
      }
      dados.maisAbates = Math.max(dados.maisAbates, abates);
      dados.maisNucleos = Math.max(dados.maisNucleos, nucleos);
      gravar();
    },
    set audioLigado(v) { dados.audioLigado = v; gravar(); },
    get audioLigado() { return dados.audioLigado; },
  };
}
