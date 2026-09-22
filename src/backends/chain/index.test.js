import assert from "node:assert/strict";
import test from "node:test";

import { createChainBackend } from "./index.js";

function createContext() {
  const interactions = [];
  const projections = [];
  const statuses = [];
  let current = true;
  return {
    context: {
      isCurrent: () => current,
      projectGame: (game) => projections.push(game),
      setInteraction: (value) => interactions.push(value),
      setStatus: (value) => statuses.push(value),
    },
    interactions,
    projections,
    statuses,
    stopGeneration() {
      current = false;
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

function game(overrides = {}) {
  return {
    board: Array.from({ length: 36 }, (_, index) => ({
      value: index % 10,
      y: index % 6,
    })),
    energy: 70,
    gameId: 1,
    revision: 1,
    score: 123,
    status: "ready",
    ...overrides,
  };
}

test("chain backend projects ready state and submits the bound move", async () => {
  let onGame;
  const moves = [];
  const backend = createChainBackend({
    endpoint: "wss://chain.invalid",
    createAdapter: async ({ endpoint }) => {
      assert.equal(endpoint, "wss://chain.invalid");
      return {
        connect(callbacks) {
          onGame = callbacks.onGame;
        },
        disconnect() {},
        submitMove(move) {
          moves.push(move);
        },
      };
    },
  });
  const state = createContext();

  await backend.start(state.context);
  onGame(game({ gameId: 3, revision: 7 }));
  assert.equal(state.projections.at(-1).gameId, 3);
  assert.equal(state.interactions.at(-1), true);
  assert.equal(await backend.selectCard(11), true);
  assert.deepEqual(moves, [{ cardIndex: 11, gameId: 3, revision: 7 }]);
  assert.equal(state.statuses.at(-1).state, "in-pool");
  await backend.stop();
});

test("chain backend fails closed when the adapter is unavailable", async () => {
  const backend = createChainBackend();
  const state = createContext();

  await backend.start(state.context);
  assert.equal(state.interactions.at(-1), false);
  assert.equal(state.statuses.at(-1).state, "unavailable");
  assert.match(state.statuses.at(-1).message, /Polkadot API/);
  assert.equal(await backend.selectCard(0), false);
  await backend.stop();
});

test("chain backend ignores projections after its generation stops", async () => {
  let onGame;
  let disconnected = 0;
  const backend = createChainBackend({
    createAdapter: async () => ({
      connect(callbacks) {
        onGame = callbacks.onGame;
      },
      disconnect() {
        disconnected += 1;
      },
      submitMove() {},
    }),
  });
  const state = createContext();

  await backend.start(state.context);
  state.stopGeneration();
  await backend.stop();
  const interactionCount = state.interactions.length;
  onGame(game());
  assert.equal(state.interactions.length, interactionCount);
  assert.equal(disconnected, 1);
});

test("chain backend admits only one move submission at a time", async () => {
  let onGame;
  let submissions = 0;
  const pending = deferred();
  const backend = createChainBackend({
    createAdapter: async () => ({
      connect(callbacks) {
        onGame = callbacks.onGame;
      },
      disconnect() {},
      submitMove() {
        submissions += 1;
        return pending.promise;
      },
    }),
  });
  const state = createContext();

  await backend.start(state.context);
  onGame(game({ revision: 2 }));
  const first = backend.selectCard(4);
  assert.equal(await backend.selectCard(5), false);
  pending.resolve();
  assert.equal(await first, true);
  assert.equal(submissions, 1);
  await backend.stop();
});

test("chain backend fails closed on malformed authoritative state", async () => {
  let onGame;
  const backend = createChainBackend({
    createAdapter: async () => ({
      connect(callbacks) {
        onGame = callbacks.onGame;
      },
      disconnect() {},
      submitMove() {
        assert.fail("invalid state must never admit a move");
      },
    }),
  });
  const state = createContext();

  await backend.start(state.context);
  onGame(game({ board: [], score: 2n ** 60n }));
  assert.equal(state.interactions.at(-1), false);
  assert.equal(state.statuses.at(-1).state, "invalid-state");
  assert.match(state.statuses.at(-1).message, /Ready chain board/);
  assert.equal(await backend.selectCard(0), false);
  await backend.stop();
});

test("chain backend rejects card indexes outside the fixed board", async () => {
  let onGame;
  let submissions = 0;
  const backend = createChainBackend({
    createAdapter: async () => ({
      connect(callbacks) {
        onGame = callbacks.onGame;
      },
      disconnect() {},
      submitMove() {
        submissions += 1;
      },
    }),
  });
  const state = createContext();

  await backend.start(state.context);
  onGame(game());
  assert.equal(await backend.selectCard(-1), false);
  assert.equal(await backend.selectCard(36), false);
  assert.equal(await backend.selectCard(1.5), false);
  assert.equal(submissions, 0);
  await backend.stop();
});
