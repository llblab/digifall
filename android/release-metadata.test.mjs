import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("../scripts/detect-version-bump.mjs", import.meta.url),
);

function release(
  t,
  {
    previous = "0.15.5",
    current = "0.15.6",
    force = false,
    tagged = false,
    before,
  } = {},
) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "digifall-release-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const commit = (version) => {
    fs.writeFileSync(
      path.join(cwd, "package.json"),
      JSON.stringify({ version }),
    );
    git("add", "package.json");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      version,
      "--allow-empty",
    );
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  const previousSha = commit(previous);
  commit(current);
  if (tagged) git("tag", `v${current}`);
  const output = path.join(cwd, "outputs");
  const metadata = JSON.parse(
    execFileSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      env: {
        ...env,
        GITHUB_EVENT_BEFORE: before ?? previousSha,
        FORCE_PUBLISH: String(force),
        GITHUB_OUTPUT: output,
      },
    }),
  );
  const outputs = Object.fromEntries(
    fs
      .readFileSync(output, "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );
  assert.deepEqual(
    outputs,
    metadata,
    "workflow outputs and diagnostics must agree",
  );
  assert.equal(metadata.current_version, current);
  assert.equal(metadata.previous_version, previous);
  return metadata;
}

for (const [current, force, tagged, expected] of [
  ["0.15.6", false, false, "true"],
  ["0.16.0", false, false, "true"],
  ["1.0.0", false, false, "true"],
  ["0.15.5", false, false, "false"],
  ["0.15.4", false, false, "false"],
  ["0.15.6-rc.1", false, false, "false"],
  ["0.15.6-rc.1", true, false, "true"],
  ["0.15.6", false, true, "false"],
  ["0.15.6", true, true, "true"],
]) {
  test(`release decision: ${current}, force=${force}, tagged=${tagged}`, (t) => {
    const metadata = release(t, { current, force, tagged });
    assert.equal(metadata.publish_needed, expected);
    assert.equal(metadata.is_prerelease, String(current.includes("-")));
    assert.equal(metadata.current_tag_released, String(tagged));
  });
}

for (const before of ["", "0".repeat(40), "missing-ref"]) {
  test(`previous-ref fallback: ${before || "unset"}`, (t) => {
    const metadata = release(t, { before });
    assert.equal(metadata.version_code, "15006");
    assert.equal(metadata.publish_needed, "true");
  });
}
