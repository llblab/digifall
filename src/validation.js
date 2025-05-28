import { multiaddr } from "@multiformats/multiaddr";
import { get, readable, writable } from "svelte/store";

import { INITIAL_VALUES, KEYS, MAX_MOVES_LENGTH, PHASES } from "./constants.js";
import { getSeed, initCore } from "./core.js";

/**
 * Normalizes player name to a safe subset of characters.
 * @param {string} playerName
 * @returns {string}
 */
export function sanitizePlayerName(playerName) {
  return playerName.toLowerCase().replace(/[^a-z0-9@&$!?\-+=.:/_]/g, "");
}

/**
 * Normalizes multiaddr to a safe subset of characters.
 * @param {string} addr
 * @returns {string}
 */
export function sanitizeMultiaddr(addr) {
  return addr.replace(/[^a-z0-9./:_-]/gi, "");
}

/**
 * Validates a multiaddr string.
 * @param {string} addr
 * @returns {string|null} Normalized multiaddr or null if invalid
 */
export function validateMultiaddr(addr) {
  try {
    const ma = multiaddr(addr);
    const str = ma.toString();
    if (!str.includes("/p2p/")) return null;
    return str;
  } catch {
    return null;
  }
}

/**
 * @typedef {Object} GameRecord
 * @property {string} type
 * @property {string|number[]} moves
 * @property {string} playerName
 * @property {number} timestamp
 * @property {number} value
 */

/**
 * Validates a single record by simulating the core. Resolves with the corrected
 * record value or rejects with a descriptive error payload.
 * @param {Partial<GameRecord>} gameData
 * @returns {Promise<GameRecord>}
 */
export async function validateRecord(gameData = {}) {
  const { type, moves, playerName, timestamp, value } = /** @type {any} */ (
    gameData
  );

  // Basic shape and type checks
  if (!type || typeof type !== "string") {
    throw new Error(["RECORD VALIDATION: BAD TYPE!", gameData]);
  }
  if (!moves || !(Array.isArray(moves) || typeof moves === "string")) {
    throw new Error(["RECORD VALIDATION: BAD MOVES!", gameData]);
  }
  if (moves.length > MAX_MOVES_LENGTH) {
    throw new Error(["RECORD VALIDATION: MOVES TOO LONG!", gameData]);
  }
  if (!playerName || typeof playerName !== "string") {
    throw new Error(["RECORD VALIDATION: BAD PLAYER NAME!", gameData]);
  }
  if (sanitizePlayerName(playerName) !== playerName) {
    throw new Error(["RECORD VALIDATION: BAD PLAYER NAME!", gameData]);
  }
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    throw new Error(["RECORD VALIDATION: BAD TIMESTAMP!", gameData]);
  }
  if (typeof value !== "number" || !(value > 0)) {
    throw new Error(["RECORD VALIDATION: BAD VALUE!", gameData]);
  }

  return new Promise((resolve, reject) => {
    /** @type {null|(() => void)} */
    let unsubscribe = null;
    const timer = setTimeout(() => {
      if (unsubscribe) unsubscribe();
      reject(["RECORD VALIDATION: TIMEOUT!", gameData]);
    }, 3e3);

    /** @template T */
    const withGet = (store) => ((store.get = () => get(store)), store);
    const game = initCore({
      cardsStore: withGet(writable(INITIAL_VALUES.cards)),
      energyStore: withGet(writable(INITIAL_VALUES.energy)),
      logStore: withGet(writable(INITIAL_VALUES.log)),
      matchedIndexesStore: withGet(writable(INITIAL_VALUES.matchedIndexes)),
      movesStore: withGet(readable(moves)),
      optionsStore: withGet(
        readable({ playerName, cluster: false, rapid: true }),
      ),
      phaseStore: withGet(writable(INITIAL_VALUES.phase)),
      plusIndexStore: withGet(writable(INITIAL_VALUES.plusIndex)),
      recordsStore: withGet(writable({ ...INITIAL_VALUES.records })),
      scoreStore: withGet(writable(INITIAL_VALUES.score)),
      seedStore: withGet(
        readable(getSeed(/** @type {GameRecord} */ (gameData))),
      ),
      timestampStore: withGet(readable(timestamp)),
    });

    unsubscribe = game.recordsStore.subscribe((records) => {
      const { movesInitial, phaseStore } = game;
      if (movesInitial !== null && phaseStore.get() !== PHASES.gameOver) return;
      clearTimeout(timer);
      unsubscribe && unsubscribe();
      const recordValue = records[type][KEYS.value];
      /** @type {GameRecord} */
      let result = { type, moves, playerName, timestamp, value };
      if (recordValue >= value) {
        result.value = recordValue;
        resolve(result);
      } else {
        reject(["RECORD VALIDATION: WRONG VALUE!", result, recordValue]);
      }
    });
  });
}
