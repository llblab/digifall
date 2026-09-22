import assert from "node:assert/strict";
import test from "node:test";

import { PHASES } from "../../constants.js";
import { normalizeChainGame } from "./projection.js";

test("normalizes an authoritative ready game for shared view stores", () => {
  const board = Array.from({ length: 36 }, (_, index) => ({
    value: index % 10,
    y: index % 6,
  }));
  const view = normalizeChainGame({
    board,
    energy: 70,
    gameId: 1,
    revision: 2,
    score: 123,
    status: "ready",
  });

  assert.equal(view.cards.length, 36);
  assert.deepEqual(view.cards[7], { value: 7, x: 1, y: 1 });
  assert.deepEqual(view.energy, { buffer: 0, value: 70 });
  assert.deepEqual(view.score, { buffer: 0, value: 123 });
  assert.equal(view.phase, PHASES.idle);
});

test("maps non-interactive and completed states to shared phases", () => {
  assert.equal(
    normalizeChainGame({ gameId: 1, revision: 1, status: "pending" }).phase,
    PHASES.initial,
  );
  assert.equal(
    normalizeChainGame({ gameId: 1, revision: 2, status: "completed" }).phase,
    PHASES.gameOver,
  );
});
