import assert from "node:assert/strict";
import test from "node:test";

import { get, readable, writable } from "svelte/store";

import { INITIAL_VALUES, PHASES } from "./constants.js";
import { getBase64FromArray, getSeed, initCore, resetGame } from "./core.js";

function withGet(store) {
  store.get = () => get(store);
  return store;
}

function cloneRecords(records = INITIAL_VALUES.records) {
  return Object.fromEntries(
    Object.entries(records).map(([type, record]) => [type, { ...record }]),
  );
}

function createCards(value = 9) {
  return Array.from({ length: 36 }, (_, index) => ({
    x: Math.trunc(index / 6),
    y: index % 6,
    value,
    nextValue: value < 9 ? value + 1 : 0,
    duration: 0,
  }));
}

function createGame({
  moves = "",
  phase = PHASES.idle,
  rapid = true,
  seed,
} = {}) {
  const playerName = "tester";
  const timestamp = 1700000000000;
  const game = {
    cardsStore: withGet(writable(createCards())),
    energyStore: withGet(writable({ ...INITIAL_VALUES.energy })),
    logStore: withGet(writable([...INITIAL_VALUES.log])),
    matchedIndexesStore: withGet(
      writable(new Set(INITIAL_VALUES.matchedIndexes)),
    ),
    movesStore: withGet(writable(moves)),
    optionsStore: withGet(
      writable({ playerName, cluster: false, rapid, sound: false }),
    ),
    phaseStore: withGet(writable(phase)),
    plusIndexStore: withGet(writable(INITIAL_VALUES.plusIndex)),
    recordsStore: withGet(writable(cloneRecords())),
    scoreStore: withGet(writable({ ...INITIAL_VALUES.score })),
    seedStore: withGet(readable(seed)),
    timestampStore: withGet(writable(timestamp)),
    ready: true,
  };
  return initCore(game);
}

async function waitUntil(predicate, timeout = 1000) {
  const startedAt = Date.now();
  while (!predicate()) {
    assert.ok(Date.now() - startedAt < timeout, "Timed out waiting for state");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("rapid user move debits energy immediately", () => {
  const game = createGame({ rapid: true });
  game.plusIndexStore.set(0);
  assert.equal(game.energyStore.get().value, 90);
  assert.equal(game.energyStore.get().buffer, 0);
});

test("non-rapid user move debits energy through animation buffer", async () => {
  const game = createGame({ rapid: false });
  game.plusIndexStore.set(0);
  assert.deepEqual(game.energyStore.get(), { buffer: -10, value: 100 });
  await waitUntil(() => {
    const energy = game.energyStore.get();
    return energy.buffer === 0 && energy.value === 90;
  });
});

test("live user moves are ignored while saved moves replay is active", () => {
  const game = createGame({ rapid: true });
  game.movesInitial = [0];
  game.plusIndexStore.set(0);
  assert.equal(game.movesStore.get(), "");
  assert.deepEqual(game.energyStore.get(), { buffer: 0, value: 100 });
});

test("saved moves replay marks game ready only after restoration", async () => {
  const playerName = "tester";
  const timestamp = 1700000000000;
  const seed = getSeed({ playerName, timestamp });
  const game = createGame({
    moves: getBase64FromArray([0]),
    phase: PHASES.initial,
    rapid: true,
    seed,
  });
  assert.equal(game.ready, false);
  await waitUntil(() => game.movesInitial === null);
  assert.equal(game.ready, true);
});

test("reset keeps game not ready until shuffle completes", async () => {
  const game = createGame({ rapid: true });
  resetGame(game, "tester");
  assert.equal(game.ready, false);
  await waitUntil(() => game.ready === true, 1000);
});
