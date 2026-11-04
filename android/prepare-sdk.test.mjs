import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareSdkLayout } from "./prepare-sdk.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "digifall-sdk-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const commandLineTools = path.join(root, "cmdline-tools", "22.0");
  const manager = path.join(commandLineTools, "bin", "sdkmanager");
  fs.mkdirSync(path.dirname(manager), { recursive: true });
  fs.writeFileSync(manager, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  return { root, commandLineTools, manager };
}

test("modern SDK layout gets an idempotent Bubblewrap-compatible tools link", (t) => {
  const { root, commandLineTools, manager } = fixture(t);
  assert.deepEqual(prepareSdkLayout(root, manager), {
    root: fs.realpathSync(root),
    manager,
  });
  const tools = path.join(root, "tools");
  assert.equal(fs.realpathSync(tools), commandLineTools);
  prepareSdkLayout(root, manager);
  assert.equal(fs.realpathSync(tools), commandLineTools);
});

test("existing usable SDK tools are preserved", (t) => {
  const { root, manager } = fixture(t);
  const legacyManager = path.join(root, "tools", "bin", "sdkmanager");
  fs.mkdirSync(path.dirname(legacyManager), { recursive: true });
  fs.writeFileSync(legacyManager, "legacy tools", { mode: 0o755 });
  prepareSdkLayout(root, manager);
  assert.equal(fs.lstatSync(path.join(root, "tools")).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(legacyManager, "utf8"), "legacy tools");
});

test("an incompatible tools directory or broken link is not overwritten", (t) => {
  const { root, manager } = fixture(t);
  const tools = path.join(root, "tools");
  fs.mkdirSync(tools);
  assert.throws(() => prepareSdkLayout(root, manager), /refusing to replace/);
  assert.equal(fs.lstatSync(tools).isDirectory(), true);
  fs.rmdirSync(tools);
  fs.symlinkSync(path.join(root, "missing"), tools);
  assert.throws(() => prepareSdkLayout(root, manager), /refusing to replace/);
  assert.equal(fs.readlinkSync(tools), path.join(root, "missing"));
});

test("missing or external sdkmanager paths fail before creating a compatibility link", (t) => {
  const { root, manager } = fixture(t);
  assert.throws(() => prepareSdkLayout(undefined, manager), /required/);
  assert.throws(
    () => prepareSdkLayout(root, path.join(root, "absent")),
    /ENOENT/,
  );
  const external = path.join(root, "outside", "bin", "sdkmanager");
  fs.mkdirSync(path.dirname(external), { recursive: true });
  fs.copyFileSync(manager, external);
  assert.throws(() => prepareSdkLayout(root, external), /must belong/);
  assert.equal(fs.existsSync(path.join(root, "tools")), false);
});
