import { Uniqueue } from "@llblab/uniqueue";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";

/** @type {readonly string[]} */
export const DEFAULT_RELAYS = Object.freeze([
  "/dns4/r2.digifall.app/tcp/443/wss/p2p/12D3KooWPN8DqXM1ytrTs9bxpWt3ZnMLEWxHc3AEX2kKg62qhesv",
]);

/** @type {Readonly<{ root: string; preview: string }>} */
export const PROTOCOLS = Object.freeze({
  root: "/digifall/root/1.0",
  preview: "/digifall/preview/1.0",
});

/** @type {readonly string[]} */
export const DEFAULT_RECORD_TYPES = Object.freeze(["highCombo", "highScore"]);

/**
 * @typedef {Object} LeaderboardRecord
 * @property {string} type
 * @property {string} playerName
 * @property {number} timestamp
 * @property {number} value
 * @property {string | number[]} [moves]
 */

/**
 * @typedef {Object} LeaderboardCoreOptions
 * @property {string[]} [recordTypes]
 * @property {number} [maxRecords]
 * @property {boolean} [debug]
 * @property {(record: LeaderboardRecord) => Promise<LeaderboardRecord | null>} [validateRecord]
 * @property {(type: string, records: LeaderboardRecord[]) => void} [onUpdate]
 */

/**
 * @param {{ value: number; timestamp: number }} a
 * @param {{ value: number; timestamp: number }} b
 * @returns {number}
 */
export function compare(a, b) {
  if (a.value > b.value) return 1;
  if (a.value < b.value) return -1;
  if (a.timestamp < b.timestamp) return -1;
  if (a.timestamp > b.timestamp) return 1;
  return 0;
}

/**
 * @param {{ playerName?: string } | null | undefined} record
 * @returns {string}
 */
export function extractKey(record) {
  return record?.playerName ?? "";
}

/**
 * @param {Uint8Array} message
 * @returns {unknown}
 */
export function parseMessage(message) {
  return JSON.parse(uint8ArrayToString(message.subarray()));
}

/**
 * @param {unknown} object
 * @returns {Uint8Array}
 */
export function toMessage(object) {
  return uint8ArrayFromString(JSON.stringify(object));
}

/**
 * @param {number[]} integers
 * @returns {number}
 */
export function squashIntegers(integers) {
  let hash = 0;
  for (const int of integers) {
    hash = (hash * 31 + int) | 0;
  }
  return hash;
}

/**
 * @param {{ playerName?: string; timestamp?: number }} options
 * @returns {number}
 */
export function getSeed({ playerName = "", timestamp = 0 }) {
  let hash = timestamp | 0;
  for (let i = 0; i < playerName.length; i++) {
    hash = (hash * 31 + playerName.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * @param {Array<{ playerName: string; timestamp: number; value: number }>} records
 * @returns {number}
 */
export function computeRootHash(records) {
  if (records.length === 0) return 0;
  return squashIntegers(
    records
      .slice()
      .sort(compare)
      .map((game) => squashIntegers([getSeed(game), game.value])),
  );
}

export class LeaderboardCore {
  /** @type {string[]} */
  recordTypes;
  /** @type {number} */
  maxRecords;
  /** @type {boolean} */
  debug;
  /** @type {((record: LeaderboardRecord) => Promise<LeaderboardRecord | null>) | null} */
  validateRecord;
  /** @type {((type: string, records: LeaderboardRecord[]) => void) | null} */
  onUpdate;
  /** @type {Record<string, Uniqueue>} */
  queues;
  /** @type {Record<string, number>} */
  roots;

  /**
   * @param {LeaderboardCoreOptions} [options]
   */
  constructor(options = {}) {
    this.recordTypes = options.recordTypes ?? [...DEFAULT_RECORD_TYPES];
    this.maxRecords = options.maxRecords ?? 1000;
    this.debug = options.debug ?? false;
    this.validateRecord = options.validateRecord ?? null;
    this.onUpdate = options.onUpdate ?? null;
    this.queues = Object.fromEntries(
      this.recordTypes.map((type) => [
        type,
        new Uniqueue({ maxSize: this.maxRecords, compare, extractKey }),
      ]),
    );
    this.roots = Object.fromEntries(this.recordTypes.map((type) => [type, 0]));
  }

  /**
   * @param {string} type
   * @returns {void}
   */
  updateRoot(type) {
    const queue = this.queues[type];
    this.roots[type] = queue ? computeRootHash(queue.data) : 0;
  }

  /**
   * @param {string} type
   * @returns {Uniqueue | undefined}
   */
  getQueue(type) {
    return this.queues[type];
  }

  /**
   * @returns {Record<string, number>}
   */
  getRoots() {
    return { ...this.roots };
  }

  /**
   * @param {string} type
   * @returns {LeaderboardRecord[]}
   */
  getData(type) {
    return this.queues[type]?.data ?? [];
  }

  /**
   * @returns {Record<string, LeaderboardRecord[]>}
   */
  getAllData() {
    return Object.fromEntries(
      this.recordTypes.map((type) => [type, this.getData(type)]),
    );
  }

  /**
   * @param {string} type
   * @param {LeaderboardRecord[]} records
   * @returns {void}
   */
  loadData(type, records) {
    const queue = this.queues[type];
    if (!queue) return;
    for (const record of records) {
      queue.push(record);
    }
    this.updateRoot(type);
  }

  /**
   * @param {LeaderboardRecord} record
   * @returns {boolean}
   */
  handleRecord(record) {
    const { type, playerName, value } = record;
    const queue = this.queues[type];
    if (!queue) return false;
    const { data, indexes } = queue;
    const index = indexes.get(playerName);
    if (index in data && data[index].value >= value) return false;
    queue.push(record);
    this.updateRoot(type);
    if (this.debug) {
      console.log("LEADERBOARD UPDATED:", type, playerName, value);
    }
    this.onUpdate?.(type, queue.data);
    return true;
  }

  /**
   * @param {LeaderboardRecord} record
   * @returns {Promise<boolean>}
   */
  async handleRecordWithValidation(record) {
    const { type, playerName, value } = record;
    const queue = this.queues[type];
    if (!queue) return false;
    const { data, indexes } = queue;
    const index = indexes.get(playerName);
    if (index in data && data[index].value >= value) return false;
    if (this.validateRecord) {
      try {
        const validatedRecord = await this.validateRecord(record);
        if (!validatedRecord) return false;
        return this.handleRecord(validatedRecord);
      } catch (error) {
        if (this.debug) console.error(error);
        return false;
      }
    }
    return this.handleRecord(record);
  }

  /**
   * @param {(connection: unknown, types: string[]) => Promise<void>} pushPreviewFn
   * @returns {(stream: unknown, connection: unknown) => Promise<void>}
   */
  createRootHandler(pushPreviewFn) {
    return async (stream, connection) => {
      if (this.debug) console.log("handleRoot");
      const previewTypes = new Set();
      stream.addEventListener("message", (evt) => {
        const message = evt.detail ?? evt.data;
        try {
          const data = parseMessage(message);
          if (data === null) {
            stream.close();
            if (previewTypes.size === 0 || connection.status !== "open") return;
            pushPreviewFn(connection, Array.from(previewTypes));
            return;
          }
          if (Array.isArray(data)) {
            const [type, remoteRoot] = data;
            if (!(type in this.roots)) return;
            if (remoteRoot === 0) {
              for (const game of this.queues[type].data) {
                stream.send(toMessage(game));
              }
              return;
            }
            if (remoteRoot !== this.roots[type]) {
              previewTypes.add(type);
            }
          } else {
            this.handleRecordWithValidation(data);
          }
        } catch (e) {
          if (this.debug) console.error(e);
        }
      });
    };
  }

  /**
   * @returns {(stream: unknown, connection: unknown) => Promise<void>}
   */
  createPreviewHandler() {
    return async (stream, _connection) => {
      if (this.debug) console.log("handlePreview");
      const touchedTypes = new Set();
      const skippedNames = Object.fromEntries(
        this.recordTypes.map((type) => [type, new Set()]),
      );
      stream.addEventListener("message", (evt) => {
        const message = evt.detail ?? evt.data;
        try {
          const data = parseMessage(message);
          if (data === null) {
            Array.from(touchedTypes)
              .flatMap((type) =>
                this.queues[type].data.filter(
                  (game) => !skippedNames[type].has(game.playerName),
                ),
              )
              .forEach((game) => stream.send(toMessage(game)));
            stream.close();
            return;
          }
          const { type, playerName, value } = data;
          if (!(type in this.queues)) return;
          touchedTypes.add(type);
          const index = this.queues[type].indexes.get(playerName);
          if (index === undefined) return;
          if (this.queues[type].data[index].value > value) return;
          skippedNames[type].add(playerName);
        } catch (e) {
          if (this.debug) console.error(e);
        }
      });
    };
  }

  /**
   * @param {(message: Uint8Array) => void} onRecordMessage
   * @returns {(connection: unknown) => Promise<{ error?: Error } | void>}
   */
  createPushRoot(onRecordMessage) {
    return async (connection) => {
      if (this.debug) console.log(PROTOCOLS.root);
      return connection
        .newStream(PROTOCOLS.root, { runOnLimitedConnection: true })
        .then(async (stream) => {
          stream.addEventListener("message", (evt) => {
            const message = evt.detail ?? evt.data;
            onRecordMessage(message);
          });
          Object.entries(this.roots).forEach(([type, root]) =>
            stream.send(toMessage([type, root])),
          );
          stream.send(toMessage(null));
        })
        .catch((error) => {
          if (this.debug) console.error(error);
          return { error };
        });
    };
  }

  /**
   * @param {(message: Uint8Array) => void} onRecordMessage
   * @returns {(connection: unknown, types: string[]) => Promise<void>}
   */
  createPushPreview(onRecordMessage) {
    return async (connection, types) => {
      if (this.debug) console.log(PROTOCOLS.preview);
      return connection
        .newStream(PROTOCOLS.preview, { runOnLimitedConnection: true })
        .then(async (stream) => {
          stream.addEventListener("message", (evt) => {
            const message = evt.detail ?? evt.data;
            onRecordMessage(message);
          });
          types.forEach((type) =>
            this.queues[type].data.forEach(({ playerName, value }) =>
              stream.send(toMessage({ type, playerName, value })),
            ),
          );
          stream.send(toMessage(null));
        })
        .catch((error) => {
          if (this.debug) console.error(error);
        });
    };
  }
}
