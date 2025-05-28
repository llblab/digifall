import { DEFAULT_RELAYS } from "@digifall/leaderboard";

export const DEBUG = Boolean(localStorage.getItem("debug"));

export const RELOAD_IN_SEC = Number(localStorage.getItem("reload"));

export const USE_ALL_RELAYS = Boolean(localStorage.getItem("use-all-relays"));

export const MAX_RECORDS = 1e3;

export const MAX_MOVES_LENGTH = 4e4;

export const CORE = Object.freeze({
  columns: 6,
  rows: 6,
  maxValue: 9,
});

export const KEYS = Object.freeze({
  digifall: "digifall",
  highCombo: "highCombo",
  highComboPrev: "highComboPrev",
  highScore: "highScore",
  highScorePrev: "highScorePrev",
  leaderboard: "leaderboard",
  local: "local",
  moves: "moves",
  options: "options",
  peerId: "peerId",
  playerName: "playerName",
  records: "records",
  relays: "relays",
  score: "score",
  timestamp: "timestamp",
  type: "type",
  value: "value",
});

export const OVERLAYS = Object.freeze({
  gameOver: "gameOver",
  leaderboard: "leaderboard",
  menu: "menu",
  options: "options",
  relays: "relays",
  wellcome: "wellcome",
});

export const PHASES = Object.freeze({
  blink: "blink",
  combo: "combo",
  extra: "extra",
  fall: "fall",
  gameOver: "gameOver",
  idle: "idle",
  initial: "initial",
  match: "match",
  plus: "plus",
  score: "score",
});

export const RECORD_TYPES = Object.freeze([KEYS.highCombo, KEYS.highScore]);

export const INITIAL_VALUES = Object.freeze({
  cards: [],
  energy: {
    buffer: 0,
    value: 100,
  },
  [KEYS.leaderboard]: {
    highCombo: [],
    highScore: [],
  },
  log: [],
  matchedIndexes: new Set(),
  [KEYS.moves]: "",
  [KEYS.options]: {
    [KEYS.playerName]: "",
    [KEYS.leaderboard]: true,
    cluster: true,
    rapid: false,
    sound: true,
  },
  [KEYS.relays]: {
    active: [...DEFAULT_RELAYS],
    applied: [...DEFAULT_RELAYS],
  },
  overlay: OVERLAYS.menu,
  phase: PHASES.initial,
  plusIndex: null,
  [KEYS.records]: RECORD_TYPES.reduce((result, type) => {
    result[type] = {
      [KEYS.playerName]: "",
      [KEYS.timestamp]: 0,
      [KEYS.moves]: "",
      [KEYS.value]: 0,
    };
    return result;
  }, {}),
  [KEYS.score]: {
    buffer: 0,
    value: 0,
  },
});
