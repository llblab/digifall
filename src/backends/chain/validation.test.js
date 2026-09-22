import assert from "node:assert/strict";
import test from "node:test";

import { toSafeViewInteger, validateChainGame } from "./validation.js";

function game(overrides = {}) {
  return {
    board: Array.from({ length: 36 }, (_, index) => ({
      value: index % 10,
      y: index % 6,
    })),
    energy: 50,
    gameId: 4n,
    revision: 9n,
    score: 100n,
    status: "ready",
    ...overrides,
  };
}

test("accepts a complete bounded authoritative snapshot", () => {
  const snapshot = game();
  assert.equal(validateChainGame(snapshot), snapshot);
  assert.equal(toSafeViewInteger(100n, "score"), 100);
});

test("rejects unsafe numeric projection instead of losing precision", () => {
  assert.throws(
    () => validateChainGame(game({ score: BigInt(Number.MAX_SAFE_INTEGER) + 1n })),
    /safe client integer range/,
  );
});

test("rejects malformed boards and duplicate coordinates", () => {
  assert.throws(() => validateChainGame(game({ board: [] })), /Ready chain board/);
  const board = game().board.map((card) => ({ ...card }));
  board[1].y = board[0].y;
  assert.throws(() => validateChainGame(game({ board })), /duplicate/);
});

test("rejects unknown lifecycle states and invalid revisions", () => {
  assert.throws(() => validateChainGame(game({ status: "idle" })), /Unsupported/);
  assert.throws(() => validateChainGame(game({ revision: -1 })), /unsigned/);
});
