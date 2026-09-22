import { CORE, PHASES } from "../../constants.js";
import { toSafeViewInteger, validateChainGame } from "./validation.js";

export function normalizeChainGame(game) {
  if (!game) return null;
  validateChainGame(game);
  return {
    cards: (game.board ?? []).map((card, index) => ({
      value: toSafeViewInteger(card.value, `board[${index}].value`),
      x: card.x ?? Math.floor(index / CORE.rows),
      y: toSafeViewInteger(card.y, `board[${index}].y`),
    })),
    energy: { buffer: 0, value: toSafeViewInteger(game.energy ?? 0, "energy") },
    log: [],
    matchedIndexes: new Set(),
    phase:
      game.status === "completed"
        ? PHASES.gameOver
        : game.status === "ready"
          ? PHASES.idle
          : PHASES.initial,
    plusIndex: null,
    score: { buffer: 0, value: toSafeViewInteger(game.score ?? 0, "score") },
  };
}
