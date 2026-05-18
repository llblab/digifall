import { multiaddr } from "@multiformats/multiaddr";
import { get, readable, writable } from "svelte/store";

import { INITIAL_VALUES, KEYS, MAX_MOVES_LENGTH, PHASES } from "./constants.js";
import { getSeed, initCore } from "./core.js";

/**
 * @typedef {Object} GameRecord
 * @property {string} type
 * @property {string|number[]} moves
 * @property {string} playerName
 * @property {number} timestamp
 * @property {number} value
 */

/**
 * @typedef {Object} RecordValidationDeps
 * @property {(stores: Record<string, unknown>) => any} initCore
 * @property {(record: GameRecord) => number} getSeed
 * @property {Record<string, any>} initialValues
 * @property {Record<string, string>} keys
 * @property {Record<string, string>} phases
 * @property {number} maxMovesLength
 * @property {(store: unknown) => unknown} get
 * @property {(value: unknown) => unknown} readable
 * @property {(value: unknown) => unknown} writable
 * @property {number} [timeoutMs]
 */

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

function cloneRecords(records) {
  return Object.fromEntries(
    Object.entries(records).map(([type, record]) => [type, { ...record }]),
  );
}

/**
 * Creates a record validator bound to the deterministic game core.
 * @param {Partial<RecordValidationDeps>} [deps]
 * @returns {(gameData?: Partial<GameRecord>) => Promise<GameRecord>}
 */
export function createRecordValidator(deps = {}) {
  const {
    initCore: initCoreFn = initCore,
    getSeed: getSeedFn = getSeed,
    initialValues = INITIAL_VALUES,
    keys = KEYS,
    phases = PHASES,
    maxMovesLength = MAX_MOVES_LENGTH,
    get: getFn = get,
    readable: readableFn = readable,
    writable: writableFn = writable,
    timeoutMs = 3e3,
  } = deps;
  return async function validateRecord(gameData = {}) {
    const { type, moves, playerName, timestamp, value } = /** @type {any} */ (
      gameData
    );
    if (!type || typeof type !== "string") {
      throw new Error(["RECORD VALIDATION: BAD TYPE!", gameData]);
    }
    if (!moves || !(Array.isArray(moves) || typeof moves === "string")) {
      throw new Error(["RECORD VALIDATION: BAD MOVES!", gameData]);
    }
    if (moves.length > maxMovesLength) {
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
      }, timeoutMs);
      const withGet = (store) => ((store.get = () => getFn(store)), store);
      const game = initCoreFn({
        cardsStore: withGet(writableFn([...initialValues.cards])),
        energyStore: withGet(writableFn({ ...initialValues.energy })),
        logStore: withGet(writableFn([...initialValues.log])),
        matchedIndexesStore: withGet(
          writableFn(new Set(initialValues.matchedIndexes)),
        ),
        movesStore: withGet(readableFn(moves)),
        optionsStore: withGet(
          readableFn({ playerName, cluster: false, rapid: true }),
        ),
        phaseStore: withGet(writableFn(initialValues.phase)),
        plusIndexStore: withGet(writableFn(initialValues.plusIndex)),
        recordsStore: withGet(writableFn(cloneRecords(initialValues.records))),
        scoreStore: withGet(writableFn({ ...initialValues.score })),
        seedStore: withGet(
          readableFn(getSeedFn(/** @type {GameRecord} */ (gameData))),
        ),
        timestampStore: withGet(readableFn(timestamp)),
      });
      unsubscribe = game.recordsStore.subscribe((records) => {
        const { movesInitial, phaseStore } = game;
        if (movesInitial !== null && phaseStore.get() !== phases.gameOver)
          return;
        clearTimeout(timer);
        unsubscribe && unsubscribe();
        const recordValue = records[type][keys.value];
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
  };
}

export const validateRecord = createRecordValidator();
