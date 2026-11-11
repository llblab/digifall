import assert from "node:assert/strict";
import fs from "node:fs";

import { chromium } from "playwright";
import { createServer } from "vite";

const data = JSON.parse(fs.readFileSync("nodes/leaderboard/data.json", "utf8"));
const fixtures = data.highCombo.slice(0, 3);
const normalization = {
  pending: data.highCombo.find((record) => record.value > 1),
  replacement: data.highCombo.reduce((a, b) => (a.value > b.value ? a : b)),
  other: data.highScore[0],
};
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${origin}/leaderboard-test`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await page.goto(`${origin}/leaderboard-test`);
  await page.evaluate(async ([persisted]) => {
    const { DEFAULT_RELAYS, LeaderboardCore } = await import(
      "/packages/leaderboard/index.js"
    );
    const relayId = DEFAULT_RELAYS[0].split("/p2p/")[1];
    localStorage.setItem("debug", "true");
    localStorage.setItem("options", JSON.stringify({ leaderboard: false }));
    localStorage.setItem(
      "relays",
      JSON.stringify({
        active: [`/ip4/127.0.0.1/tcp/1/ws/p2p/${relayId}`],
        applied: DEFAULT_RELAYS,
      }),
    );
    const { createIndexedDBFactory } = await import("/src/persistence.js");
    const createStore = await createIndexedDBFactory("leaderboard");
    const stored = await createStore("highCombo", []);
    await new Promise((resolve) => {
      const unsubscribe = stored.subscribe((records) => {
        if (records.length !== 2) return;
        unsubscribe();
        resolve();
      });
      stored.set([persisted, { ...persisted, playerName: "INVALID" }]);
    });
    window.probe = { pushes: [], rootsUpdated: 0, writes: 0, handled: 0 };
    const updateRoot = LeaderboardCore.prototype.updateRoot;
    LeaderboardCore.prototype.updateRoot = function (type) {
      window.probe.rootsUpdated++;
      return updateRoot.call(this, type);
    };
    const handleRecord = LeaderboardCore.prototype.handleRecord;
    LeaderboardCore.prototype.handleRecord = function (record) {
      const updated = handleRecord.call(this, record);
      window.probe.handled++;
      return updated;
    };
    LeaderboardCore.prototype.createPushRoot = function () {
      window.probe.core = this;
      return async (connection) => {
        window.probe.pushes.push({
          peer: connection.remotePeer.toString(),
          roots: this.getRoots(),
        });
      };
    };
    window.probe.stores = (await import("/src/leaderboard.js")).leaderboardStores;
  }, fixtures);
  await page.waitForFunction(
    () =>
      window.probe.stores.highCombo.get().length === 1 && window.libp2p,
  );
  assert.deepEqual(
    await page.evaluate(() => window.probe.stores.highCombo.get()),
    [fixtures[0]],
    "Startup must replay-validate stored data and remove invalid snapshots",
  );
  await page.evaluate(async () => {
    await window.libp2p.stop();
    const { relayPeerIdsStore } = await import("/src/stores.js");
    window.libp2p.getConnections = () =>
      [
        [relayPeerIdsStore.get()[0], "open"],
        ["connected-player", "open"],
        ["closed-player", "closed"],
      ].map(([peer, status]) => ({
        remotePeer: { toString: () => peer },
        status,
      }));
    const store = window.probe.stores.highCombo;
    const set = store.set;
    store.set = (records) => {
      window.probe.writes++;
      return set.call(store, records);
    };
    window.probe.rootsUpdated = 0;
  });
  await page.clock.install();
  assert.equal(
    await page.evaluate(
      (record) => window.probe.core.handleRecordWithValidation(record),
      fixtures[1],
    ),
    true,
  );
  await page.waitForFunction(() => window.probe.stores.highCombo.get().length === 2);
  assert.deepEqual(
    await page.evaluate(() => window.probe.pushes.map(({ peer }) => peer)),
    ["connected-player"],
    "An accepted update must notify only open non-relay peers",
  );
  const update = await page.evaluate(() => ({
    rootsUpdated: window.probe.rootsUpdated,
    writes: window.probe.writes,
    current: window.probe.core.getRoots(),
    sent: window.probe.pushes[0].roots,
  }));
  assert.equal(update.rootsUpdated, 1, "Persistence must not recalculate the root");
  assert.equal(update.writes, 1);
  assert.deepEqual(update.sent, update.current);
  for (const record of [fixtures[1], { ...fixtures[1], playerName: "INVALID" }]) {
    assert.equal(
      await page.evaluate(
        (record) => window.probe.core.handleRecordWithValidation(record),
        record,
      ),
      false,
    );
  }
  assert.equal(await page.evaluate(() => window.probe.writes), 1);
  assert.equal(await page.evaluate(() => window.probe.pushes.length), 1);
  console.log("PASS: accepted updates persist/sync once; no-op and invalid records do neither");

  await page.evaluate(async (record) => {
    const { recordsStore } = await import("/src/stores.js");
    recordsStore.update((records) => ({ ...records, highCombo: record }));
  }, fixtures[2]);
  await page.clock.runFor(50);
  await page.waitForFunction(() => window.probe.stores.highCombo.get().length === 3);
  assert.equal(await page.evaluate(() => window.probe.writes), 2);
  assert.equal(await page.evaluate(() => window.probe.pushes.length), 1);
  await page.clock.runFor(5000);
  assert.equal(await page.evaluate(() => window.probe.pushes.length), 2);
  assert.deepEqual(
    await page.evaluate(() => window.probe.pushes[1].roots),
    await page.evaluate(() => window.probe.core.getRoots()),
  );
  const handled = await page.evaluate(() => window.probe.handled);
  await page.evaluate(async () => {
    const { recordsStore } = await import("/src/stores.js");
    recordsStore.update((records) => ({ ...records }));
  });
  await page.clock.runFor(50);
  await page.waitForFunction((count) => window.probe.handled > count, handled);
  assert.equal(await page.evaluate(() => window.probe.writes), 2);
  assert.equal(await page.evaluate(() => window.probe.rootsUpdated), 2);
  assert.equal(await page.evaluate(() => window.probe.pushes.length), 2);
  console.log("PASS: personal bests share the update path and throttled sync sends the latest root");

  for (const mutate of [false, true]) {
    for (const replace of [false, true]) {
      await page.evaluate(
        async ({ pending, replacement, other, mutate, replace }) => {
          const { recordsStore } = await import("/src/stores.js");
          const { INITIAL_VALUES } = await import("/src/constants.js");
          recordsStore.set(structuredClone(INITIAL_VALUES.records));
          const changes = [];
          const unsubscribe = recordsStore.subscribe((records) =>
            changes.push(structuredClone(records)),
          );
          const stale = { ...pending, value: 1 };
          const write = (highCombo, highScore) =>
            recordsStore.update((records) =>
              mutate
                ? Object.assign(records, { highCombo, highScore })
                : { ...records, highCombo, highScore },
            );
          write(stale, INITIAL_VALUES.records.highScore);
          write(replace ? replacement : stale, other);
          window.probe.normalization = { changes, unsubscribe };
        },
        { ...normalization, mutate, replace },
      );
      await page.clock.runFor(50);
      const changes = await page.evaluate(() => {
        const { changes, unsubscribe } = window.probe.normalization;
        unsubscribe();
        return changes;
      });
      const expected = {
        highCombo: replace ? normalization.replacement : normalization.pending,
        highScore: normalization.other,
      };
      assert.deepEqual(
        changes.at(-1),
        expected,
        `Replay normalization must preserve current records (mutate=${mutate}, replace=${replace})`,
      );
      for (const records of changes.slice(2)) {
        assert.deepEqual(records.highScore, expected.highScore);
        if (replace) assert.deepEqual(records.highCombo, expected.highCombo);
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS: replay normalization preserves sibling records and newer bests across immutable and in-place updates");
} finally {
  await browser?.close();
  await server.close();
}
