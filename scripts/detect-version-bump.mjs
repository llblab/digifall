#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    version,
  );
  if (!match) throw new Error(`Invalid semver-like version: ${version}`);
  return match.slice(1, 4).map(Number);
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function readPackageVersionAt(ref) {
  try {
    const raw = git(["show", `${ref}:package.json`]);
    return JSON.parse(raw).version;
  } catch {
    return "";
  }
}

function writeOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (outputPath) fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(JSON.stringify(values, null, 2));
}

const currentVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const before = process.env.GITHUB_EVENT_BEFORE || "";
const forcePublish = process.env.FORCE_PUBLISH === "true";
let previousRef = before;
if (!previousRef || /^0+$/.test(previousRef)) {
  previousRef = "HEAD^";
}
const previousVersion = readPackageVersionAt(previousRef);
const versionIncreased = previousVersion
  ? compareVersions(currentVersion, previousVersion) > 0
  : false;
writeOutput({
  current_version: currentVersion,
  previous_version: previousVersion,
  version_increased: String(versionIncreased),
  publish_needed: String(forcePublish || versionIncreased),
});
