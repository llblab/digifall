#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import {
  computeVersionCode,
  parseVersion,
} from "../android/compute-version-code.mjs";

function isNewer(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (const part of ["major", "minor", "patch"]) {
    if (left[part] !== right[part]) return left[part] > right[part];
  }
  return false;
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readPackageVersionAt(ref) {
  try {
    const raw = git(["show", `${ref}:package.json`]);
    return JSON.parse(raw).version;
  } catch {
    return "";
  }
}

function refPointsAtHead(ref) {
  try {
    return git(["rev-parse", ref]) === git(["rev-parse", "HEAD"]);
  } catch {
    return false;
  }
}

function writeOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(JSON.stringify(values, null, 2));
}

const currentVersion = JSON.parse(
  fs.readFileSync("package.json", "utf8"),
).version;
const versionCode = computeVersionCode(currentVersion);
const isPrerelease = Boolean(parseVersion(currentVersion).prerelease);
const before = process.env.GITHUB_EVENT_BEFORE || "";
const forcePublish = process.env.FORCE_PUBLISH === "true";
let previousRef = before;
if (!previousRef || /^0+$/.test(previousRef)) {
  previousRef = "HEAD^";
}
let previousVersion = readPackageVersionAt(previousRef);
if (!previousVersion && previousRef !== "HEAD^") {
  previousRef = "HEAD^";
  previousVersion = readPackageVersionAt(previousRef);
}
const versionIncreased =
  Boolean(previousVersion) && isNewer(currentVersion, previousVersion);
const currentTagReleased = refPointsAtHead(`refs/tags/v${currentVersion}`);
writeOutput({
  current_version: currentVersion,
  version_code: String(versionCode),
  is_prerelease: String(isPrerelease),
  previous_version: previousVersion,
  version_increased: String(versionIncreased),
  current_tag_released: String(currentTagReleased),
  publish_needed: String(
    forcePublish || (versionIncreased && !currentTagReleased && !isPrerelease),
  ),
});
