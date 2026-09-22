import { CORE } from "../../constants.js";

const STATUSES = new Set([
  "awaiting-initial-entropy",
  "completed",
  "pending",
  "ready",
  "recoverable",
  "resolving",
]);

function isUnsignedInteger(value) {
  return (
    (typeof value === "bigint" && value >= 0n) ||
    (Number.isSafeInteger(value) && value >= 0)
  );
}

export function toSafeViewInteger(value, field) {
  const converted = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(converted) || converted < 0) {
    throw new RangeError(`${field} is outside the safe client integer range`);
  }
  return converted;
}

export function validateChainGame(game) {
  if (!game || typeof game !== "object") {
    throw new TypeError("Chain game snapshot must be an object");
  }
  if (!STATUSES.has(game.status)) {
    throw new TypeError(`Unsupported chain game status: ${String(game.status)}`);
  }
  if (!isUnsignedInteger(game.gameId) || !isUnsignedInteger(game.revision)) {
    throw new TypeError("Chain game identity and revision must be unsigned integers");
  }

  const board = game.board ?? [];
  const boardSize = CORE.columns * CORE.rows;
  if (!Array.isArray(board) || (board.length !== 0 && board.length !== boardSize)) {
    throw new RangeError(`Chain board must contain either 0 or ${boardSize} cards`);
  }
  if (game.status === "ready" && board.length !== boardSize) {
    throw new RangeError(`Ready chain board must contain ${boardSize} cards`);
  }

  const positions = new Set();
  board.forEach((card, index) => {
    const value = toSafeViewInteger(card?.value, `board[${index}].value`);
    const y = toSafeViewInteger(card?.y, `board[${index}].y`);
    const x = card?.x ?? Math.floor(index / CORE.rows);
    if (value > 9 || !Number.isSafeInteger(x) || x < 0 || x >= CORE.columns) {
      throw new RangeError(`Invalid chain card at board[${index}]`);
    }
    if (y >= CORE.rows || positions.has(`${x}:${y}`)) {
      throw new RangeError(`Invalid or duplicate chain position at board[${index}]`);
    }
    positions.add(`${x}:${y}`);
  });

  toSafeViewInteger(game.energy ?? 0, "energy");
  toSafeViewInteger(game.score ?? 0, "score");
  return game;
}
