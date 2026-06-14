#!/usr/bin/env node
import fs from "node:fs";
import { computeVersionCode } from "./compute-version-code.mjs";

const MANIFEST_PATH = "android/twa-manifest.json";
const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || "com.llblab.digifall";
const HOST = "digifall.app";
const WEB_MANIFEST_URL = "https://digifall.app/manifest.json";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const appVersion = pkg.version;
const appVersionCode = computeVersionCode(appVersion);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

manifest.packageId = PACKAGE_NAME;
manifest.host = HOST;
manifest.startUrl = "/";
manifest.appVersion = appVersion;
manifest.appVersionCode = appVersionCode;
manifest.webManifestUrl = WEB_MANIFEST_URL;
manifest.name = "Digifall";
manifest.launcherName = "Digifall";
manifest.display = "standalone";
manifest.orientation = "portrait";
manifest.fallbackType = manifest.fallbackType || "customtabs";
manifest.signingKey = {
  ...(manifest.signingKey || {}),
  path: manifest.signingKey?.path || ".secrets/LLBLab.keystore",
  alias: process.env.ANDROID_KEY_ALIAS || manifest.signingKey?.alias || "LLBLab",
};

fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify({ appVersion, appVersionCode, packageId: manifest.packageId }, null, 2),
);
