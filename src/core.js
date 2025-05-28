import { CORE, INITIAL_VALUES, KEYS, PHASES } from "./constants.js";

const { abs, sign, trunc } = Math;

// UTILITIES ///////////////////////////////////////////////////////////////////

/**
 * A single card placed on the board.
 * @typedef {Object} Card
 * @property {number} x
 * @property {number} y
 * @property {number} value
 * @property {number} [nextValue]
 * @property {number} duration
 */

/**
 * 2D index field mapping [x][y] -> card index (or undefined for empty slot).
 * @typedef {(Array<(number|undefined)>)} IndexColumn
 * @typedef {IndexColumn[]} IndexField
 */

/**
 * A log entry created after blink phase: either a match summary or an extra energy entry.
 * @typedef {Object} LogEntryMatch
 * @property {number[]} counts
 * @property {number[]} digits
 * @property {number} sum
 */

/**
 * @typedef {Object} LogEntryExtra
 * @property {number} extra
 */

/**
 * Union of possible log entry kinds.
 * @typedef {(LogEntryMatch | LogEntryExtra)} LogEntry
 */

/**
 * UI-ready combo row entry.
 * @typedef {Object} ComboRow
 * @property {number} combo
 * @property {number} key
 */

/**
 * Generic store-like shape used throughout core logic.
 * Compatible with Svelte stores extended with a synchronous `get()` helper.
 * @template T
 * @typedef {Object} StoreLike
 * @property {() => T} get
 * @property {(value: T) => any} [set]
 * @property {(updater: (value: T) => T) => any} [update]
 * @property {(run: (value: T) => void) => any} [subscribe]
 */

/**
 * Energy store value.
 * @typedef {Object} Energy
 * @property {number} buffer
 * @property {number} value
 */

/**
 * Score store value.
 * @typedef {Object} Score
 * @property {number} buffer
 * @property {number} value
 */

/**
 * Minimal runtime shape used by core logic.
 * Only properties accessed by core are declared.
 * @typedef {Object} Game
 * @property {StoreLike<Card[]>} cardsStore
 * @property {StoreLike<Energy>} energyStore
 * @property {StoreLike<LogEntry[]>} logStore
 * @property {StoreLike<Set<number>>} matchedIndexesStore
 * @property {StoreLike<string|number[]|Uint8Array>} movesStore
 * @property {StoreLike<{ playerName?: string, cluster?: boolean, rapid?: boolean, sound?: boolean }>} optionsStore
 * @property {StoreLike<number>} phaseStore
 * @property {StoreLike<number|null>} plusIndexStore
 * @property {StoreLike<Record<string, any>>} recordsStore
 * @property {StoreLike<Score>} scoreStore
 * @property {StoreLike<number|undefined>} seedStore
 * @property {StoreLike<number>} timestampStore
 * @property {boolean} [ready]
 * @property {import('./sounds.js').Sounds} [sounds]
 * @property {number} [moveCount]
 * @property {null|Array<number>} [movesInitial]
 * @property {(column: number) => number} [getNextCardValue]
 */

export function getRandom(prev = 0) {
  return (prev * 16807 + 19487171) % 2147483647;
}

/**
 * @param {number[]} array
 */
export function getBase64FromArray(array) {
  return btoa(String.fromCodePoint(...array));
}

/**
 * @param {string} base64
 */
export function getArrayFromBase64(base64) {
  return Array.from(atob(base64)).map((letter) => letter.charCodeAt());
}

/**
 * Squash integers into safe one pseudo hash
 * @param {number[]} integers
 */
export function squashIntegers(integers) {
  const SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
  const pseudoHash = integers.reduce((result, integer) => {
    result = BigInt(`${result}${integer}`);
    if (result > SAFE_BIGINT) result = result % SAFE_BIGINT;
    return result;
  }, 0);
  return Number(pseudoHash);
}

// CHECK LOGIC /////////////////////////////////////////////////////////////////

/**
 * Utility that executes side effects instantly or with animation timing depending on `rapid` mode.
 * Returns the value or schedules the callback accordingly.
 * @param {Game} game
 * @param {number|Function|Object|undefined} value
 * @param {number} [timeout=0]
 * @returns {any}
 */
export function checkRapid(game, value, timeout = 0) {
  const { rapid } = game.optionsStore.get();
  const insta = !rapid && game.movesInitial === null && timeout > 0;
  switch (typeof value) {
    case "undefined":
      return { duration: insta ? 0 : 400 };
    case "function":
      return insta ? setTimeout(() => value(game), timeout) : value(game);
    case "object":
      return insta ? { duration: 0 } : value;
    default:
      return insta ? 0 : value;
  }
}

/**
 * Plays a callback or array of callbacks depending on sound settings and phase.
 * @param {Game} game
 * @param {Function|Function[]|undefined} callback
 * @param {{ muteRapid?: boolean }} [options]
 */
export function checkSound(game, callback, { muteRapid = false } = {}) {
  if (!callback) return;
  const { sound, rapid } = game.optionsStore.get();
  if (muteRapid && rapid) return;
  if (!sound || game.movesInitial !== null || !game.ready) return;
  if (Array.isArray(callback)) {
    callback.forEach((cb) => cb && cb());
    return;
  }
  callback();
}

function checkLocalScore(game, type, value) {
  const records = game.recordsStore.get();
  const valuePrev = records[type][KEYS.value];
  if (valuePrev >= value) return;
  records[type] = {
    [KEYS.moves]: game.movesStore.get(),
    [KEYS.playerName]: game.optionsStore.get().playerName,
    [KEYS.timestamp]: game.timestampStore.get(),
    [KEYS.value]: value,
  };
  game.recordsStore.set(records);
}

// CARDS LOGIC /////////////////////////////////////////////////////////////////

/**
 * Returns next value in the card cycle [0..CORE.maxValue].
 * @param {number} value
 * @returns {number}
 */
export function getNextCardValue(value) {
  return value < CORE.maxValue ? value + 1 : 0;
}

/**
 * Builds a 2D index field from the flat list of cards for quick neighbor access.
 * @param {Card[]} cards
 * @returns {IndexField}
 */
export function getFieldFromCards(cards) {
  const field = Array.from({ length: CORE.columns }, () =>
    Array.from({ length: 2 * CORE.rows }),
  );
  cards.forEach(({ x, y }, index) => (field[x][y] = index));
  return field;
}

function getFallenCards(game, cards) {
  const phase = game.phaseStore.get();
  const { rapid } = game.optionsStore.get();
  const field = getFieldFromCards(cards);
  const result = [];
  const set = new Set();
  field.forEach((column) => {
    let count = 0;
    column.forEach((index, y) => {
      if (index === undefined) return ++count;
      const { x, value } = cards[index];
      const duration =
        rapid || game.movesInitial || phase !== PHASES.fall
          ? 0
          : 100 * (2 * count) ** 0.5;
      result[index] = {
        x,
        y: y - count,
        value,
        nextValue: getNextCardValue(value),
        duration,
      };
      if (count > 0 && duration > 0 && !set.has(duration)) set.add(duration);
    });
  });
  checkSound(
    game,
    () => set.forEach((delay) => setTimeout(game.sounds.playKick, delay)),
    { muteRapid: true },
  );
  return result;
}

/**
 * Finds groups of adjacent cards with the same value and returns matched indexes when size equals the value.
 * @param {Card[]} cards
 * @returns {{ counts: number, digits: Set<number>, indexes: Set<number> }}
 */
function getMatchedFromCards(cards) {
  const field = getFieldFromCards(cards);
  const escape = new Set();
  const groups = [];
  const assort = (group, index, askedValue) => {
    if (escape.has(index)) return;
    const { x, y, value } = cards[index];
    if (askedValue !== undefined && askedValue !== value) return;
    if (!groups[group]) groups[group] = { value, indexes: new Set() };
    groups[group].indexes.add(index);
    escape.add(index);
    if (y < CORE.rows - 1) assort(group, field[x][y + 1], value);
    if (x < CORE.columns - 1) assort(group, field[x + 1][y], value);
    if (y > 0) assort(group, field[x][y - 1], value);
    if (x > 0) assort(group, field[x - 1][y], value);
  };
  cards.forEach((_, index) => assort(index, index));
  return groups.reduce(
    (result, group) => {
      if (group.value === group.indexes.size) {
        result.counts++;
        result.digits.add(group.value);
        group.indexes.forEach(result.indexes.add, result.indexes);
      }
      return result;
    },
    {
      counts: 0,
      digits: new Set(),
      indexes: new Set(),
    },
  );
}

/**
 * Returns a new board after collapsing matched indexes (matched cards move up within their columns and increment value by column rule).
 * @param {Game} game
 * @param {Card[]} cards
 * @param {Set<number>} matchedIndexes
 * @returns {Card[]}
 */
function getMatchedCards(game, cards, matchedIndexes) {
  const counts = Array.from({ length: CORE.columns }, () => 0);
  const getNextY = (nextX) =>
    counts[nextX] +
    cards
      .filter(({ x }) => x === nextX)
      .sort(({ y: y1 }, { y: y2 }) => y2 - y1)[0].y;
  return cards.map((card, index) => {
    if (card.y < CORE.rows && matchedIndexes.has(index)) {
      ++counts[card.x];
      return {
        x: card.x,
        y: getNextY(card.x),
        value: game.getNextCardValue(card.x),
        duration: 0,
      };
    }
    return card;
  });
}

/**
 * Augments cards with cluster info if `cluster` option is enabled.
 * @param {Game} game
 * @param {Card[]} cards
 * @returns {Card[]}
 */
function getClusteredCards(game, cards) {
  if (!game.optionsStore.get().cluster) return cards;
  const field = getFieldFromCards(cards);
  return cards.map((card) => ({
    ...card,
    cluster: getCluster(cards, field, card),
  }));
}

/**
 * Computes adjacency flags for a single card.
 * @param {Card[]} cards
 * @param {IndexField} field
 * @param {Card} card
 * @returns {{ top: boolean, right: boolean, bottom: boolean, left: boolean }}
 */
function getCluster(cards, field, { x, y, value }) {
  const topIndex = y === CORE.rows - 1 ? -1 : field[x][y + 1];
  const rightIndex = x === CORE.columns - 1 ? -1 : field[x + 1][y];
  const bottomIndex = y === 0 ? -1 : field[x][y - 1];
  const leftIndex = x === 0 ? -1 : field[x - 1][y];
  const topValue = topIndex > -1 ? cards[topIndex].value : NaN;
  const rightValue = rightIndex > -1 ? cards[rightIndex].value : NaN;
  const bottomValue = bottomIndex > -1 ? cards[bottomIndex].value : NaN;
  const leftValue = leftIndex > -1 ? cards[leftIndex].value : NaN;
  return {
    top: topValue === value,
    right: rightValue === value,
    bottom: bottomValue === value,
    left: leftValue === value,
  };
}

// ENERGY LOGIC ////////////////////////////////////////////////////////////////

function getDiffFromBuffer(buffer) {
  return sign(buffer) * trunc(abs(buffer) ** 0.5);
}

/**
 * Handles energy buffer draining with timing depending on phase and rapid mode.
 * @param {Game} game
 * @param {Energy} param1
 */
function doEnergyLogic(game, { buffer, value }) {
  const phase = game.phaseStore.get();
  const { rapid } = game.optionsStore.get();
  const diff =
    rapid || game.movesInitial
      ? buffer
      : phase === PHASES.gameOver
        ? sign(buffer)
        : getDiffFromBuffer(buffer);
  if (phase === PHASES.extra) {
    if (buffer === 0) {
      checkRapid(game, () => game.phaseStore.set(PHASES.combo), 800);
      return;
    }
    game.logStore.update((log) => {
      const lastIndex = log.length - 1;
      const { extra } = log[lastIndex];
      log[lastIndex] = { extra: extra - diff };
      return log;
    });
  }
  if (buffer === 0) {
    if (phase === PHASES.gameOver) {
      checkSound(game, () => setTimeout(game.sounds.playGameOver, 600));
    }
    return;
  }
  checkRapid(
    game,
    () => {
      game.energyStore.set({
        buffer: buffer - diff,
        value: value + diff,
      });
    },
    phase === PHASES.gameOver ? 200 : 32,
  );
}

// PHASE LOGIC /////////////////////////////////////////////////////////////////

/**
 * Initial phase: switch to idle asynchronously to allow subscribers to attach.
 * @param {Game} game
 */
function doInitialPhase(game) {
  setTimeout(() => game.phaseStore.set(PHASES.idle), 0);
}

/**
 * Idle logic: reset animations, update highs, play reset sound.
 * @param {Game} game
 */
function doIdlePhase(game) {
  if (game.movesInitial !== null) {
    if (game.moveCount < game.movesInitial.length) {
      game.plusIndexStore.set(game.movesInitial[game.moveCount++]);
      game.energyStore.update(({ buffer, value }) => ({
        buffer,
        value: value - 10,
      }));
      game.phaseStore.set(PHASES.plus);
      return;
    }
    game.movesInitial = null;
    checkLocalScore(game, KEYS.highScore, game.scoreStore.get().value);
    return;
  }
  game.cardsStore.update((cards) =>
    cards.map((card) => ({ ...card, duration: 0 })),
  );
  checkLocalScore(game, KEYS.highScore, game.scoreStore.get().value);
  checkSound(game, game.sounds.reset);
}

/**
 * Plus phase: apply +1 to selected card and proceed to blink.
 * @param {Game} game
 */
function doPlusPhase(game) {
  game.plusIndexStore.update((plusIndex) => {
    game.cardsStore.update((cards) =>
      getClusteredCards(
        game,
        cards.map((card, index) => {
          if (index !== plusIndex) return card;
          const value = getNextCardValue(card.value);
          return {
            ...card,
            value,
            nextValue: getNextCardValue(value),
            duration: 0,
          };
        }),
      ),
    );
    return null;
  });
  game.phaseStore.set(PHASES.blink);
}

/**
 * Blink phase: detect matches, push to log, adjust energy, handle transitions.
 * @param {Game} game
 */
function doBlinkPhase(game) {
  const cards = game.cardsStore.get();
  let { counts, digits, indexes } = getMatchedFromCards(cards);
  game.matchedIndexesStore.set(indexes);
  const { value } = game.energyStore.get();
  if (indexes.size > 0) {
    const indexesArray = Array.from(indexes);
    game.logStore.update((log) =>
      log.concat(
        indexesArray.reduce((result, index) => {
          const card = cards[index];
          result[card.value] = (result[card.value] || 0) + card.value;
          result.sum = (result.sum || 0) + card.value;
          result.counts = counts;
          result.digits = Array.from(digits);
          return result;
        }, {}),
      ),
    );
    const buffer = indexesArray.reduce(
      (result, index) => result + cards[index].value,
      0,
    );
    checkRapid(game, () => game.energyStore.set({ buffer, value }), 400);
    checkRapid(game, () => game.phaseStore.set(PHASES.match), 800);
    checkSound(game, [game.sounds.playWordUp, game.sounds.playBlink], {
      muteRapid: true,
    });
    return;
  }
  if (value > 100) {
    game.phaseStore.set(PHASES.extra);
    return;
  }
  if (game.logStore.get().length > 0) {
    game.phaseStore.set(PHASES.combo);
    return;
  }
  if (value < 10) {
    game.phaseStore.set(PHASES.gameOver);
    return;
  }
  game.phaseStore.set(PHASES.idle);
}

/**
 * Match phase: transform matched cards into next values and clear matches.
 * @param {Game} game
 */
function doMatchPhase(game) {
  game.matchedIndexesStore.update((matchedIndexes) => {
    game.cardsStore.update((cards) =>
      getClusteredCards(game, getMatchedCards(game, cards, matchedIndexes)),
    );
    return new Set();
  });
  checkRapid(game, () => game.phaseStore.set(PHASES.fall), 400);
}

/**
 * Fall phase: apply gravity-like falling and proceed to blink.
 * @param {Game} game
 */
function doFallPhase(game) {
  game.cardsStore.update((cards) =>
    getClusteredCards(game, getFallenCards(game, cards)),
  );
  checkRapid(game, () => game.phaseStore.set(PHASES.blink), 400);
}

/**
 * Extra phase: convert energy overflow to combo log.
 * @param {Game} game
 */
function doExtraPhase(game) {
  game.energyStore.update(({ value }) => ({ buffer: 100 - value, value }));
  game.logStore.update((log) => log.concat({ extra: 100 }));
  checkSound(game, game.sounds.playWordUp, { muteRapid: true });
}

/**
 * Calculates combo value from the log.
 * @param {LogEntry[]} log
 * @returns {number}
 */
export function getComboFromLog(log) {
  return log.reduce(
    (result, { counts, extra, sum }, index) =>
      result + (index + 1) * (sum || extra) * (counts || 1),
    0,
  );
}

/**
 * Combo phase: move log value into score buffer and transition to score phase.
 * @param {Game} game
 */
function doComboPhase(game) {
  const log = game.logStore.get();
  const combo = getComboFromLog(log);
  game.scoreStore.update(({ value }) => ({
    buffer: combo,
    value,
  }));
  checkLocalScore(game, KEYS.highCombo, combo);
  checkRapid(
    game,
    () => game.phaseStore.set(PHASES.score),
    log.length > 1 ? 800 : 0,
  );
  checkSound(game, game.sounds.playWordUp, { muteRapid: true });
}

/**
 * Score phase: ensure score subscribers tick when there is a non-trivial log.
 * @param {Game} game
 */
function doScorePhase(game) {
  if (game.logStore.get().length < 2) return;
  game.scoreStore.update((score) => ({ ...score }));
}

/**
 * GameOver phase: drain remaining energy into score.
 * @param {Game} game
 */
function doGameOverPhase(game) {
  checkRapid(
    game,
    () => {
      game.energyStore.update(({ value }) => ({
        buffer: -value,
        value,
      }));
      game.scoreStore.update(({ value }) => ({
        buffer: game.energyStore.get().value,
        value,
      }));
    },
    400,
  );
}

const PHASE_LOGICS = {
  [PHASES.initial]: doInitialPhase,
  [PHASES.idle]: doIdlePhase,
  [PHASES.plus]: doPlusPhase,
  [PHASES.blink]: doBlinkPhase,
  [PHASES.match]: doMatchPhase,
  [PHASES.fall]: doFallPhase,
  [PHASES.extra]: doExtraPhase,
  [PHASES.combo]: doComboPhase,
  [PHASES.score]: doScorePhase,
  [PHASES.gameOver]: doGameOverPhase,
};

/**
 * Dispatches phase logic by phase id.
 * @param {Game} game
 * @param {number} phase
 */
function doPhaseLogic(game, phase) {
  PHASE_LOGICS[phase](game);
}

// PLUS INDEX LOGIC ////////////////////////////////////////////////////////////

/**
 * Handles user action: writing plusIndex into moves and transition to plus phase.
 * @param {Game} game
 * @param {number|null} plusIndex
 */
function doPlusIndexLogic(game, plusIndex) {
  if (plusIndex === null || game.movesInitial !== null) return;
  let moves = game.movesStore.get();
  moves = Array.isArray(moves) ? moves : getArrayFromBase64(moves);
  moves.push(plusIndex);
  game.movesStore.set(getBase64FromArray(moves));
  game.energyStore.update((energy) => ({ ...energy, buffer: -10 }));
  checkRapid(game, () => game.phaseStore.set(PHASES.plus), 400);
}

// SCORE LOGIC /////////////////////////////////////////////////////////////////

/**
 * Returns animation time depending on score buffer diff step.
 * @param {number} diff
 * @returns {number}
 */
function getTimeFromDiff(diff) {
  switch (abs(diff)) {
    case 1:
      return 130;
    case 2:
    case 3:
      return 80;
    case 4:
    case 5:
    case 6:
      return 50;
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
      return 30;
    default:
      return 20;
  }
}

/**
 * Drains score buffer applying timings. Handles transitions between score and next phase.
 * @param {Game} game
 * @param {Score} param1
 */
function doScoreLogic(game, { buffer, value }) {
  const phase = game.phaseStore.get();
  if (phase !== PHASES.gameOver && phase !== PHASES.score) return;
  if (buffer === 0) {
    if (phase === PHASES.gameOver) {
      checkLocalScore(game, KEYS.highScore, value);
      return;
    }
    checkRapid(
      game,
      () => {
        game.logStore.set([]);
        game.phaseStore.set(
          game.energyStore.get().value < 10 ? PHASES.gameOver : PHASES.idle,
        );
        checkSound(game, game.sounds.playTurnOn);
      },
      200,
    );
    return;
  }
  const { rapid } = game.optionsStore.get();
  const diff =
    rapid || game.movesInitial
      ? buffer
      : phase === PHASES.gameOver
        ? sign(buffer)
        : getDiffFromBuffer(buffer);
  checkRapid(
    game,
    () => {
      game.scoreStore.set({
        buffer: buffer - diff,
        value: value + diff,
      });
    },
    phase === PHASES.gameOver ? 200 : getTimeFromDiff(diff),
  );
  checkSound(game, game.sounds.playBleep, { muteRapid: true });
}

// SEED LOGIC //////////////////////////////////////////////////////////////////

/**
 * Derives deterministic seed from playerName and timestamp.
 * @param {{ playerName: string, timestamp: number }} param0
 * @returns {number|undefined}
 */
export function getSeed({ playerName, timestamp }) {
  return (
    playerName &&
    typeof playerName === "string" &&
    timestamp &&
    typeof timestamp === "number" &&
    timestamp < Infinity &&
    squashIntegers([
      timestamp,
      ...Array.from(playerName).map((letter) => letter.charCodeAt()),
    ])
  );
}

function getInitialRandoms(seed) {
  let count = 0;
  const result = [getRandom(seed)];
  while (count < CORE.columns - 1) result.push(getRandom(2 * result[count++]));
  return result;
}

/**
 * Creates deterministic next-card-value generator based on seed.
 * @param {number} seed
 * @returns {(column: number) => number}
 */
function createGetNextCardValue(seed) {
  let randoms = getInitialRandoms(seed);
  return (column) => {
    if (column < 0 || CORE.columns - 1 < column) return;
    let result = randoms[column];
    randoms[column] = getRandom(result);
    return result % 10;
  };
}

/**
 * Builds initial deck of cards for a new game.
 * @param {Game} game
 * @returns {Card[]}
 */
function getInitialCards(game) {
  return Array.from(
    { length: CORE.columns * CORE.rows },
    (_, index, x, value) => (
      (x = trunc(index / CORE.columns)),
      (value = game.getNextCardValue(x)),
      {
        x,
        y: index % CORE.rows,
        value,
        nextValue: getNextCardValue(value),
        duration: 0,
      }
    ),
  );
}

/**
 * Re-rolls initial field until there are no immediate matches.
 * @param {Game} game
 * @param {Card[]} cards
 * @returns {Card[]}
 */
function getPreparedCards(game, cards) {
  while (true) {
    const matchedIndexes = getMatchedFromCards(cards).indexes;
    if (matchedIndexes.size === 0) return cards;
    const matchedCards = getMatchedCards(game, cards, matchedIndexes);
    cards = getFallenCards(game, matchedCards);
  }
}

/**
 * Seed logic: prepare deterministic generators and initialize cards and moves.
 * @param {Game} game
 * @param {number|null|undefined} seed
 */
function doSeedLogic(game, seed) {
  if (seed == null) return;
  game.getNextCardValue = createGetNextCardValue(seed);
  game.cardsStore.set(
    getClusteredCards(game, getPreparedCards(game, getInitialCards(game))),
  );
  let moves = game.movesStore.get();
  if (!moves) return;
  moves = Array.isArray(moves) ? moves : getArrayFromBase64(moves);
  if (moves.length > 0) {
    game.moveCount = 0;
    game.movesInitial = moves;
    return;
  }
  game.movesInitial = null;
}

// CORE INITIALIZATION /////////////////////////////////////////////////////////

/**
 * Reads previous highs from records into the game for later comparison.
 * @param {Game} game
 */
function updatePreviousHighs(game) {
  const records = game.recordsStore.get();
  game[KEYS.highComboPrev] = records[KEYS.highCombo][KEYS.value];
  game[KEYS.highScorePrev] = records[KEYS.highScore][KEYS.value];
}

/**
 * Sets up subscriptions and core state on the provided game object.
 * @param {Game} game
 * @param {any} [sounds]
 * @returns {Game}
 */
export function initCore(game, sounds) {
  updatePreviousHighs(game);
  game.sounds = sounds || {};
  game.getNextCardValue = () => 0;
  game.moveCount = 0;
  game.movesInitial = null;
  game.energyStore.subscribe((energy) => {
    doEnergyLogic(game, energy);
  });
  game.phaseStore.subscribe((phase) => {
    doPhaseLogic(game, phase);
  });
  game.plusIndexStore.subscribe((plusIndex) => {
    doPlusIndexLogic(game, plusIndex);
  });
  game.scoreStore.subscribe((score) => {
    doScoreLogic(game, score);
  });
  game.seedStore.subscribe((seed) => {
    doSeedLogic(game, seed);
  });
  return game;
}

// GAME RESET //////////////////////////////////////////////////////////////////

/**
 * Soft-resets the game several times to shuffle the board visually.
 * @param {Game} game
 * @param {number} count
 * @param {string} [playerName]
 */
function shuffleBoard(game, count, playerName) {
  if (count < 0) return (game.ready = true);
  setTimeout(() => {
    game.logStore.set(INITIAL_VALUES.log);
    game.plusIndexStore.set(INITIAL_VALUES.plusIndex);
    game.matchedIndexesStore.set(INITIAL_VALUES.matchedIndexes);
    game.movesStore.set(INITIAL_VALUES.moves);
    game.scoreStore.set(INITIAL_VALUES.score);
    game.energyStore.set(INITIAL_VALUES.energy);
    game.phaseStore.set(INITIAL_VALUES.phase);
    game.timestampStore.set(Date.now());
    shuffleBoard(game, --count);
    if (!playerName) return;
    game.optionsStore.update((options) => ({ ...options, playerName }));
  }, 64);
}

/**
 * Public reset: updates highs, plays sound, and triggers board shuffling.
 * @param {Game} game
 * @param {string} [playerName]
 */
export function resetGame(game, playerName) {
  updatePreviousHighs(game);
  checkSound(game, game.sounds.playGenerate);
  game.ready = false;
  shuffleBoard(game, 8, playerName);
}
