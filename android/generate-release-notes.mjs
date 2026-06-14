#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = pkg.version;
const locales = (process.env.RELEASE_NOTES_LOCALES || "en-US")
  .split(",")
  .map((locale) => locale.trim())
  .filter(Boolean);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function latestCommitMessage() {
  try {
    return git(["log", "-1", "--pretty=%B"]);
  } catch {
    return "Digifall " + version;
  }
}

function findPreviousTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--exclude=v" + version]);
  } catch {
    return "";
  }
}

function commitsSincePreviousTag() {
  const tag = findPreviousTag();
  if (!tag) return "";
  try {
    return git(["log", "--pretty=- %s", tag + "..HEAD"]);
  } catch {
    return "";
  }
}

function changelogHeadingVersion(line) {
  const match = /^#{1,6}\s+\[?v?(\d+\.\d+\.\d+)\]?\b/i.exec(line.trim());
  return match ? match[1] : "";
}

function changelogSection() {
  if (!fs.existsSync("CHANGELOG.md")) return "";
  const lines = fs.readFileSync("CHANGELOG.md", "utf8").split(/\r?\n/);
  const anyHeading = /^#{1,6}\s+/;
  const start = lines.findIndex((line) => changelogHeadingVersion(line) === version);
  if (start === -1) return "";
  const end = lines.findIndex((line, index) => index > start && anyHeading.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}

function stripInlineCode(line) {
  return line.split(String.fromCharCode(96)).join("");
}

function normalizeMarkdown(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "- "))
    .map(stripInlineCode)
    .map((line) => line.replace(/\s+\(#\d+\)$/g, ""))
    .join("\n");
}

function truncateForPlay(text) {
  if ([...text].length <= 500) return text;
  const bullets = text.split("\n");
  let result = "";
  for (const bullet of bullets) {
    const candidate = result ? result + "\n" + bullet : bullet;
    if ([...(candidate + "…")].length > 500) break;
    result = candidate;
  }
  if (!result) result = [...text].slice(0, 499).join("");
  return result.replace(/[\s.,;:]+$/u, "") + "…";
}

const raw = changelogSection() || commitsSincePreviousTag() || latestCommitMessage();
const notes = normalizeMarkdown(raw) || "Digifall " + version;
fs.mkdirSync("dist/google-play/whatsnew", { recursive: true });
fs.writeFileSync("dist/release-notes.md", notes + "\n");
for (const locale of locales) {
  fs.writeFileSync(
    path.join("dist/google-play/whatsnew", "whatsnew-" + locale),
    truncateForPlay(notes) + "\n",
  );
}
console.log(JSON.stringify({ version, locales, characters: [...notes].length }, null, 2));
