/**
 * Maquina de estado da corrida.
 *
 * O loop que importa e: errou -> R -> ja esta correndo de novo. Nao existe
 * menu, contagem regressiva nem loading no meio. O cronometro so comeca quando
 * voce cruza o gate 1, entao reiniciar nao cobra tempo de reacao.
 */
import * as THREE from 'three';
import { createGate, relaxGate } from './gates.js';
import { createGhostRecorder, createGhostPlayer } from './ghost.js';
import { CIRCUITS, getCircuit, medalFor } from './circuits.js';
import { RACE } from '../config.js';
import { clamp01 } from '../core/mathx.js';

const _prev = new THREE.Vector3();

export function createRace(scene, bus, save, droneModel) {
  const root = new THREE.Group();
  root.name = 'race';
  scene.add(root);

  let circuit = null;
  let gates = [];
  const ghostRec = createGhostRecorder();
  const ghost = createGhostPlayer(scene, droneModel);

  const state = {
    status: 'idle',        // 'armed' | 'running' | 'finished'
    circuitId: null,
    time: 0,
    gateIndex: 0,          // proximo gate a passar
    splits: [],
    bestSplits: null,
    bestTime: null,
    delta: null,           // diferenca ao vivo contra o recorde
    combo: 0,
    comboTimer: 0,
    score: 0,
    medal: null,
    newRecord: false,
    finishedTime: null,
    ghostVisible: true,
    attempts: 0,
  };

  function clearGates() {
    for (const g of gates) { root.remove(g.group); g.dispose(); }
    gates = [];
  }

  /** Carrega um circuito e arma a corrida. */
  function load(circuitId) {
    clearGates();
    circuit = getCircuit(circuitId);
    state.circuitId = circuit.id;

    gates = circuit.gates.map((spec, i) => {
      const g = createGate(spec, i + 1, i === circuit.gates.length - 1);
      root.add(g.group);
      return g;
    });

    const rec = save.getRecord(circuit.id);
    state.bestTime = rec ? rec.time : null;
    state.bestSplits = rec ? rec.splits : null;
    ghost.setData(rec ? rec.ghost : null);

    arm();
    bus.emit('race:load', { circuit, record: rec });
    return circuit;
  }

  /** Volta pro comeco sem tocar no recorde. */
  function arm() {
    state.status = 'armed';
    state.time = 0;
    state.gateIndex = 0;
    state.splits = [];
    state.delta = null;
    state.combo = 0;
    state.comboTimer = 0;
    state.score = 0;
    state.medal = null;
    state.newRecord = false;
    state.finishedTime = null;
    for (const g of gates) { g.passed = false; }
    refreshGateStates();
    ghostRec.reset();
    ghost.hide();
    _prev.set(NaN, NaN, NaN);
    bus.emit('race:arm', { circuit });
  }

  function refreshGateStates() {
    for (let i = 0; i < gates.length; i++) {
      if (i < state.gateIndex) gates[i].setState('done');
      else if (i === state.gateIndex) gates[i].setState('active');
      else gates[i].setState('next');
    }
  }

  function finish() {
    state.status = 'finished';
    state.finishedTime = state.time;
    state.medal = medalFor(circuit, state.time);

    const improved = !state.bestTime || state.time < state.bestTime;
    if (improved) {
      state.newRecord = true;
      state.bestTime = state.time;
      state.bestSplits = state.splits.slice();
      const record = {
        time: state.time,
        splits: state.splits.slice(),
        medal: state.medal,
        ghost: ghostRec.data,
        date: Date.now(),
      };
      save.setRecord(circuit.id, record);
      ghost.setData(record.ghost);
    }
    bus.emit('race:finish', {
      circuit, time: state.time, medal: state.medal,
      newRecord: state.newRecord, splits: state.splits.slice(),
      score: state.score,
    });
  }

  /**
   * Passo fixo da corrida. `pos` e a posicao do drone DEPOIS do passo de fisica.
   */
  function step(dt, pos, quat) {
    if (!circuit || state.status === 'finished') return;

    if (!Number.isFinite(_prev.x)) _prev.copy(pos);

    if (state.status === 'running') {
      state.time += dt;
      ghostRec.record(dt, state.time, pos, quat);
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
    }

    const gate = gates[state.gateIndex];
    if (gate) {
      const hit = gate.test(_prev, pos);
      if (hit) {
        // O cronometro so nasce no gate 1: reiniciar nao cobra reacao.
        if (state.gateIndex === 0 && state.status === 'armed') {
          state.status = 'running';
          state.time = 0;
          ghostRec.reset();
          state.attempts++;
        }
        gate.passed = true;
        gate.flash();
        state.splits.push(state.time);

        // combo: encadear gates rapido mantem vivo; centro da bonus
        state.combo = Math.min(RACE.comboMax, state.combo + 1);
        state.comboTimer = RACE.comboWindow;
        let points = RACE.gatePoints * state.combo;
        if (hit.centered) points += RACE.centerBonusPoints;
        state.score += points;

        bus.emit('race:gate', {
          index: state.gateIndex + 1,
          total: gates.length,
          centered: hit.centered,
          graze: hit.graze,
          offset: hit.offset,
          combo: state.combo,
          points,
          time: state.time,
          split: state.bestSplits ? state.time - state.bestSplits[state.gateIndex] : null,
        });

        state.gateIndex++;
        if (state.gateIndex >= gates.length) finish();
        else refreshGateStates();
      }
    }

    // delta ao vivo contra o recorde, no gate ja passado
    if (state.status === 'running' && state.bestSplits && state.gateIndex > 0) {
      const i = state.gateIndex - 1;
      if (state.bestSplits[i] !== undefined) {
        state.delta = state.splits[i] - state.bestSplits[i];
      }
    }

    _prev.copy(pos);
  }

  /** Render: animacao dos gates e do fantasma. */
  function update(dt, cameraPos) {
    for (const g of gates) { g.update(dt, cameraPos); relaxGate(g, dt); }
    if (state.status === 'running' && state.ghostVisible) ghost.update(state.time, true);
    else ghost.hide();
  }

  /** Direcao e distancia ate o gate atual (seta do HUD). */
  function activeGate() { return gates[state.gateIndex] || null; }

  return {
    state, root,
    get circuit() { return circuit; },
    get gates() { return gates; },
    get ghost() { return ghost; },
    load, arm, step, update, activeGate,
    circuits: CIRCUITS,
    next() {
      const i = CIRCUITS.findIndex((c) => c.id === state.circuitId);
      return load(CIRCUITS[(i + 1) % CIRCUITS.length].id);
    },
    toggleGhost() {
      state.ghostVisible = !state.ghostVisible;
      return state.ghostVisible;
    },
    /** 0..1 — progresso no circuito, pro HUD. */
    get progress() {
      return gates.length ? clamp01(state.gateIndex / gates.length) : 0;
    },
    setVisible(v) { root.visible = v; if (!v) ghost.hide(); },
    dispose() { clearGates(); ghost.dispose(); scene.remove(root); },
  };
}
