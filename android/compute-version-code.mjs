#!/usr/bin/env node
import fs from "node:fs";

const PLAY_BASELINE_VERSION_CODE = 5003;
const ANDROID_VERSION_CODE_LIMIT = 2100000000;

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    version,
  );
  if (!match) throw new Error(`Invalid semver-like version: ${version}`);
  const [, majorRaw, minorRaw, patchRaw, prerelease] = match;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);
  if (minor >= 1000 || patch >= 1000) {
    throw new Error(`Version minor and patch must be < 1000: ${version}`);
  }
  return { major, minor, patch, prerelease: prerelease ?? "" };
}

export function computeVersionCode(version) {
  const { major, minor, patch } = parseVersion(version);
  const versionCode = major * 1000000 + minor * 1000 + patch;
  if (versionCode <= PLAY_BASELINE_VERSION_CODE) {
    throw new Error(
      `Computed versionCode ${versionCode} must exceed existing Play versionCode ${PLAY_BASELINE_VERSION_CODE}`,
    );
  }
  if (versionCode >= ANDROID_VERSION_CODE_LIMIT) {
    throw new Error(
      `Computed versionCode ${versionCode} must be < ${ANDROID_VERSION_CODE_LIMIT}`,
    );
  }
  return versionCode;
}

function writeOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(JSON.stringify(values, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const versionName = pkg.version;
  const parsed = parseVersion(versionName);
  const versionCode = computeVersionCode(versionName);
  writeOutput({
    version_name: versionName,
    version_code: String(versionCode),
    is_prerelease: parsed.prerelease ? "true" : "false",
  });
}
