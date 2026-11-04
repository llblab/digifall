#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Keep aligned with the exact Bubblewrap CLI/core version installed by CI.
export const BUBBLEWRAP_BUILD_TOOLS = "34.0.0";

export function prepareSdkLayout(sdkRoot, sdkManager) {
  if (!sdkRoot || !sdkManager) {
    throw new Error(
      "ANDROID_HOME and the sdkmanager executable path are required",
    );
  }
  const root = fs.realpathSync(sdkRoot);
  const manager = fs.realpathSync(sdkManager);
  const commandLineTools = path.dirname(path.dirname(manager));
  if (
    !commandLineTools.startsWith(`${root}${path.sep}cmdline-tools${path.sep}`)
  ) {
    throw new Error(`sdkmanager must belong to ${root}/cmdline-tools`);
  }
  fs.accessSync(manager, fs.constants.X_OK);
  const tools = path.join(root, "tools");
  if (fs.lstatSync(tools, { throwIfNoEntry: false })) {
    try {
      fs.accessSync(path.join(tools, "bin", "sdkmanager"), fs.constants.X_OK);
    } catch {
      throw new Error(
        `Existing ${tools} is incompatible; refusing to replace it`,
      );
    }
  } else {
    fs.symlinkSync(commandLineTools, tools, "dir");
  }
  return { root, manager };
}

function main() {
  const { root, manager } = prepareSdkLayout(
    process.env.ANDROID_HOME,
    process.argv[2],
  );
  execFileSync(
    manager,
    [
      `--sdk_root=${root}`,
      "platform-tools",
      "platforms;android-36",
      `build-tools;${BUBBLEWRAP_BUILD_TOOLS}`,
    ],
    { stdio: "inherit" },
  );
  console.log(
    `Prepared Bubblewrap SDK at ${root} with build-tools ${BUBBLEWRAP_BUILD_TOOLS}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
