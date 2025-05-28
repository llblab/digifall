import { DEFAULT_RELAYS } from "@digifall/leaderboard";
import { derived, get, writable } from "svelte/store";

import { INITIAL_VALUES, KEYS } from "./constants.js";
import {
  checkRapid as coreCheckRapid,
  checkSound as coreCheckSound,
  resetGame as coreResetGame,
  getComboFromLog,
  getSeed,
} from "./core.js";
import { createLocalStorageStore } from "./persistence.js";
import { playWordUp } from "./sounds.js";

/** @typedef {import('./core.js').ComboRow} ComboRow */
/** @typedef {import('./core.js').LogEntry} LogEntry */

export function createStore(initialValue) {
  let store = writable(initialValue);
  store.get = () => get(store);
  return store;
}

export function createDerivedStore(stores = [], callbacks = () => {}) {
  let store = derived(stores, callbacks);
  store.get = () => get(store);
  return store;
}

export const cardsStore = createStore(INITIAL_VALUES.cards);

export const energyStore = createStore(INITIAL_VALUES.energy);

export const logStore = createStore(INITIAL_VALUES.log);

export const matchedIndexesStore = createStore(INITIAL_VALUES.matchedIndexes);

export const movesStore = createLocalStorageStore(
  KEYS.moves,
  INITIAL_VALUES.moves,
);

export const optionsStore = createLocalStorageStore(
  KEYS.options,
  INITIAL_VALUES.options,
);

export const phaseStore = createStore(INITIAL_VALUES.phase);

export const plusIndexStore = createStore(INITIAL_VALUES.plusIndex);

export const recordsStore = createLocalStorageStore(
  KEYS.records,
  INITIAL_VALUES.records,
);

export const scoreStore = createStore(INITIAL_VALUES.score);

export const timestampStore = createLocalStorageStore(
  KEYS.timestamp,
  Date.now(),
);

export const seedStore = createDerivedStore(
  [optionsStore, timestampStore],
  ([{ playerName }, timestamp]) => {
    return getSeed({ playerName, timestamp });
  },
);

/**
 * Store of last combo rows prepared for UI.
 * @type {import('svelte/store').Readable<ComboRow[]> & { get: () => ComboRow[], seed?: number, prev?: LogEntry[], rows?: ComboRow[] }}
 */
export const combosStore = createDerivedStore(
  [logStore, optionsStore, seedStore],
  ([log, { rapid }, seed]) => {
    if (!rapid) return [];
    if (seed !== combosStore.seed) {
      combosStore.seed = seed;
      combosStore.prev = [];
      combosStore.rows = [];
    }
    if (log.length === 0) {
      const combo = getComboFromLog(combosStore.prev);
      if (combo) {
        combosStore.rows = [
          ...combosStore.rows,
          { combo, key: performance.now() },
        ];
        checkSound(playWordUp);
        if (combosStore.rows.length > 7) {
          combosStore.rows = combosStore.rows.slice(-7);
        }
        combosStore.prev = [];
      }
    } else {
      combosStore.prev = log;
    }
    return combosStore.rows;
  },
);

export const relaysStore = createLocalStorageStore(
  KEYS.relays,
  INITIAL_VALUES.relays,
  function loadRelays(initialValue) {
    const saved = localStorage.getItem(KEYS.relays);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed) return initialValue;
    const activeSet = new Set(parsed.active ?? []);
    const appliedSet = new Set(parsed.applied ?? []);
    const currentDefaultsSet = new Set(DEFAULT_RELAYS);
    for (const relay of DEFAULT_RELAYS) {
      if (!appliedSet.has(relay)) {
        activeSet.add(relay);
        appliedSet.add(relay);
      }
    }
    for (const relay of [...appliedSet]) {
      if (!currentDefaultsSet.has(relay)) {
        activeSet.delete(relay);
        appliedSet.delete(relay);
      }
    }
    return { active: [...activeSet], applied: [...appliedSet] };
  },
);

export const activeRelaysStore = createDerivedStore(
  [relaysStore],
  ([{ active }]) => active,
);

export const relayPeerIdsStore = createDerivedStore(
  [activeRelaysStore],
  ([relays]) =>
    relays
      .map((addr) => {
        const match = addr.match(/\/p2p\/([a-zA-Z0-9]+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean),
);

export const overlayStore = createStore(INITIAL_VALUES.overlay);

export const game = {
  cardsStore,
  energyStore,
  logStore,
  matchedIndexesStore,
  movesStore,
  optionsStore,
  phaseStore,
  plusIndexStore,
  recordsStore,
  scoreStore,
  seedStore,
  timestampStore,
  ready: true,
};

export function checkRapid(value, timeout = 0) {
  return coreCheckRapid(game, value, timeout);
}

export function checkSound(callback, { muteRapid = false } = {}) {
  return coreCheckSound(game, callback, { muteRapid });
}

export function resetGame(playerName) {
  overlayStore.set(null);
  coreResetGame(game, playerName);
}

export default game;
