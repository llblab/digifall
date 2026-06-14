#!/usr/bin/env node
import fs from "node:fs/promises";

if (!globalThis.localStorage) {
  globalThis.localStorage = { getItem: () => null };
}

async function readInput() {
  const file = process.argv[2];
  if (file) return fs.readFile(file, "utf8");
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function extractRecords(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    if ("type" in input && "moves" in input) return [input];
    if (Array.isArray(input.records)) return input.records;
    return Object.values(input).flatMap((value) =>
      Array.isArray(value) ? value : [],
    );
  }
  return [];
}

function serializeError(error) {
  if (error instanceof Error) return error.message;
  return error;
}

async function main() {
  const [{ validateRecord }, raw] = await Promise.all([
    import("../src/validation.js"),
    readInput(),
  ]);
  const records = extractRecords(JSON.parse(raw));
  if (records.length === 0) throw new Error("No records found");
  const results = [];
  for (const record of records) {
    try {
      results.push({ ok: true, record: await validateRecord(record) });
    } catch (error) {
      results.push({ ok: false, record, error: serializeError(error) });
    }
  }
  const failed = results.filter((result) => !result.ok);
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        total: results.length,
        failed: failed.length,
        results,
      },
      null,
      2,
    ),
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
