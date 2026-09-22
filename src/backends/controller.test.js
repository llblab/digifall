import assert from "node:assert/strict";
import test from "node:test";

import { createBackendController } from "./controller-core.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

test("controller delegates card intent to the active backend", async () => {
  const selected = [];
  let interactive = false;
  const controller = createBackendController({
    factories: {
      classic: () => ({
        kind: "classic",
        start({ setInteraction }) {
          setInteraction(true);
        },
        selectCard(index) {
          selected.push(index);
          return true;
        },
        stop() {},
      }),
    },
    setInteraction(value) {
      interactive = value;
    },
    setStatus() {},
  });

  await controller.activate("classic", "classic");
  assert.equal(interactive, true);
  assert.equal(controller.selectCard(7), true);
  assert.deepEqual(selected, [7]);
  await controller.stop();
});

test("controller stops a backend that resolves after a newer activation", async () => {
  const slow = deferred();
  let staleStops = 0;
  const controller = createBackendController({
    factories: {
      chain: () => slow.promise,
      classic: () => ({
        kind: "classic",
        start({ setInteraction }) {
          setInteraction(true);
        },
        stop() {},
      }),
    },
    setInteraction() {},
    setStatus() {},
  });

  const chainActivation = controller.activate("chain", "classic");
  await Promise.resolve();
  await controller.activate("classic", "classic");
  slow.resolve({
    kind: "chain",
    start() {},
    stop() {
      staleStops += 1;
    },
  });
  await chainActivation;

  assert.equal(staleStops, 1);
  await controller.stop();
});

test("controller ignores state updates from a stopped generation", async () => {
  const started = deferred();
  const release = deferred();
  const interactions = [];
  const controller = createBackendController({
    factories: {
      chain: () => ({
        async start({ setInteraction }) {
          started.resolve();
          await release.promise;
          setInteraction(true);
        },
        stop() {},
      }),
      classic: () => ({ start() {}, stop() {} }),
    },
    setInteraction(value) {
      interactions.push(value);
    },
    setStatus() {},
  });

  const chainActivation = controller.activate("chain", "classic");
  await started.promise;
  await controller.activate("classic", "classic");
  release.resolve();
  await chainActivation;

  assert.deepEqual(interactions, [false, false]);
  await controller.stop();
});
