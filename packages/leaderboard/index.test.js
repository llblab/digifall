import assert from "node:assert/strict";
import test from "node:test";

import {
  LeaderboardCore,
  computeRootHash,
  compare,
  parseMessage,
  toMessage,
} from "./index.js";

test("compare sorts by value and then older timestamp", () => {
  assert.equal(
    compare({ value: 2, timestamp: 2 }, { value: 1, timestamp: 1 }),
    1,
  );
  assert.equal(
    compare({ value: 1, timestamp: 2 }, { value: 2, timestamp: 1 }),
    -1,
  );
  assert.equal(
    compare({ value: 1, timestamp: 1 }, { value: 1, timestamp: 2 }),
    -1,
  );
});

test("message helpers round-trip JSON payloads", () => {
  const record = {
    type: "highScore",
    playerName: "llb",
    timestamp: 1,
    value: 10,
  };
  assert.deepEqual(parseMessage(toMessage(record)), record);
});

test("LeaderboardCore keeps only the best record per player", () => {
  const core = new LeaderboardCore({
    recordTypes: ["highScore"],
    maxRecords: 10,
  });
  assert.equal(
    core.handleRecord({
      type: "highScore",
      playerName: "llb",
      timestamp: 1,
      value: 10,
    }),
    true,
  );
  assert.equal(
    core.handleRecord({
      type: "highScore",
      playerName: "llb",
      timestamp: 2,
      value: 5,
    }),
    false,
  );
  assert.deepEqual(
    core.getData("highScore").map(({ value }) => value),
    [10],
  );
});

test("computeRootHash is order independent", () => {
  const records = [
    { playerName: "a", timestamp: 1, value: 10 },
    { playerName: "b", timestamp: 2, value: 20 },
  ];
  assert.equal(computeRootHash(records), computeRootHash(records.toReversed()));
});
