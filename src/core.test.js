import assert from "node:assert/strict";
import test from "node:test";

import { get, readable, writable } from "svelte/store";

import { INITIAL_VALUES, KEYS, PHASES } from "./constants.js";
import { getBase64FromArray, getSeed, initCore, resetGame } from "./core.js";
import { validateRecord } from "./validation.js";

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
  sound = false,
  sounds,
  cards = createCards(),
} = {}) {
  const playerName = "tester";
  const timestamp = 1700000000000;
  const game = {
    cardsStore: withGet(writable(cards)),
    energyStore: withGet(writable({ ...INITIAL_VALUES.energy })),
    logStore: withGet(writable([...INITIAL_VALUES.log])),
    matchedIndexesStore: withGet(
      writable(new Set(INITIAL_VALUES.matchedIndexes)),
    ),
    movesStore: withGet(writable(moves)),
    optionsStore: withGet(
      writable({ playerName, cluster: false, rapid, sound }),
    ),
    phaseStore: withGet(writable(phase)),
    plusIndexStore: withGet(writable(INITIAL_VALUES.plusIndex)),
    recordsStore: withGet(writable(cloneRecords())),
    scoreStore: withGet(writable({ ...INITIAL_VALUES.score })),
    seedStore: withGet(readable(seed)),
    timestampStore: withGet(writable(timestamp)),
    ready: true,
  };
  return initCore(game, sounds);
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

test("reset plays generate sound even when game is not ready", () => {
  let generated = 0;
  const game = createGame({
    sound: true,
    sounds: { playGenerate: () => generated++ },
  });
  game.ready = false;
  resetGame(game, "tester");
  assert.equal(generated, 1);
});

test("reset cancels restored replay before playing generate sound", () => {
  let generated = 0;
  const game = createGame({
    sound: true,
    sounds: { playGenerate: () => generated++ },
  });
  game.movesInitial = [0];
  game.moveCount = 1;
  resetGame(game, "tester");
  assert.equal(game.movesInitial, null);
  assert.equal(game.moveCount, 0);
  assert.equal(generated, 1);
});

for (const rapid of [false, true]) {
  test(`match accounting preserves log, energy, and timing (rapid=${rapid})`, (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cards = createCards();
    cards[0].value = 1;
    cards[1].value = cards[2].value = 2;
    const game = createGame({ cards, rapid });
    const logs = [];
    const energies = [];
    game.logStore.subscribe((log) => logs.push(structuredClone(log)));
    game.energyStore.subscribe((energy) => energies.push({ ...energy }));
    game.phaseStore.set(PHASES.blink);
    const match = { 1: 1, 2: 4, sum: 5, counts: 2, digits: [1, 2] };
    assert.deepEqual(logs[1], [match]);
    if (rapid) {
      assert.deepEqual(energies.slice(0, 3), [
        { buffer: 0, value: 100 },
        { buffer: 5, value: 100 },
        { buffer: 0, value: 105 },
      ]);
      assert.equal(game.phaseStore.get(), PHASES.idle);
      assert.equal(game.energyStore.get().value, 100);
      assert.equal(game.scoreStore.get().value, 220);
    } else {
      assert.deepEqual([...game.matchedIndexesStore.get()], [0, 1, 2]);
      t.mock.timers.tick(399);
      assert.deepEqual(energies, [{ buffer: 0, value: 100 }]);
      t.mock.timers.tick(1);
      assert.deepEqual(energies[1], { buffer: 5, value: 100 });
      assert.equal(game.phaseStore.get(), PHASES.blink);
      t.mock.timers.tick(400);
      assert.equal(game.phaseStore.get(), PHASES.match);
    }
  });
}

function createDeterministicMoves(seed, count) {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % 36;
  });
}

function createLiveLikeReplayGame(moves, playerName, timestamp) {
  return createGame({
    moves,
    phase: PHASES.initial,
    seed: getSeed({ playerName, timestamp }),
    cards: [...INITIAL_VALUES.cards],
  });
}

test("validation replay matches live-like highScore replay and rejects inflated deltas", async () => {
  const scenarios = [
    [4, 8],
    [4, 9],
    [4, 10],
    [5, 8],
    [5, 9],
  ];
  for (let index = 0; index < scenarios.length; index++) {
    const [seed, count] = scenarios[index];
    const playerName = `fuzz${index}`;
    const timestamp = 1700000000000 + index;
    const moves = getBase64FromArray(createDeterministicMoves(seed, count));
    const baselineRecord = {
      [KEYS.type]: KEYS.highScore,
      [KEYS.moves]: moves,
      [KEYS.playerName]: playerName,
      [KEYS.timestamp]: timestamp,
      [KEYS.value]: 1,
    };
    const replayedRecord = await validateRecord(baselineRecord);
    const liveGame = createLiveLikeReplayGame(moves, playerName, timestamp);
    await waitUntil(
      () =>
        liveGame.recordsStore.get()[KEYS.highScore][KEYS.value] ===
        replayedRecord[KEYS.value],
      3000,
    );
    const invalidValue = replayedRecord[KEYS.value] + 7;
    await assert.rejects(
      () =>
        validateRecord({
          ...replayedRecord,
          [KEYS.value]: invalidValue,
        }),
      (error) => Array.isArray(error) && error[2] === replayedRecord.value,
      `highScore non-energy delta was accepted for generated sequence ${index}`,
    );
  }
});
