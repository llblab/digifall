# Release Flow

Digifall ships as a hosted PWA at `https://digifall.app/` and as an Android Trusted Web Activity (TWA) with package name `com.llblab.digifall`.

## Release lever

`package.json.version` is the source of truth.

On push to `main`, `.github/workflows/gh-pages-deploy.yml` keeps deploying the web app to GitHub Pages. The separate `.github/workflows/android-play-release.yml` workflow:

1. Computes version metadata and publish eligibility once in `scripts/detect-version-bump.mjs`, reusing the Android version parser/code validation; ordinary pushes exclude prereleases, while explicit forced recovery remains available.
2. Skips publish when the current `vX.Y.Z` tag already points at `HEAD`, so amending a published release commit does not re-upload the same Android versionCode.
3. When a new version increased, generates release notes, creates or updates tag/release `vX.Y.Z`, builds a signed TWA Android package, and uploads it to Google Play.

Manual dispatch with `force_publish=true` publishes the current version even if the version did not change or the tag already points at `HEAD`. Use that only for deliberate recovery/retry releases, because Google Play rejects replacing an already published APK versionCode. If Android failed before any upload while the GitHub Release already exists, an explicitly authorized CI-only repair can retry Android from corrected `main` with the same version; manual dispatch skips the GitHub Release job, so the published tag remains immutable. Confirm the failed attempt never uploaded that versionCode, then dispatch with an explicit `play_track`, `release_status=completed`, and `dry_run=false`. Record the recovery run's commit because it may differ from the tag only in CI/support files.

GitHub workflow run titles use the shared `Digifall / <surface> / <ref> / <event>` pattern for readable Actions history; GitHub's own `pages-build-deployment` workflow is system-managed and remains outside project control.

## Android SDK and versioning

CI pins Bubblewrap CLI and core together at `1.24.1`, preserving the API-21-compatible Android Browser Helper instead of inheriting a newer dependency that requires API 24. `android/prepare-sdk.mjs` exposes the selected command-line tools at the legacy SDK `tools` path expected by Bubblewrap, preserving an existing usable tools directory and refusing to replace an incompatible one. It explicitly installs platform-tools, Android platform 36, and build-tools `34.0.0`; keep the build-tools version aligned with the pinned Bubblewrap core rather than relying on the runner image's preinstalled packages.

The generated TWA compiles against and targets Android 16 (API level 36). Bubblewrap does not expose the target SDK in `twa-manifest.json`, so `android/configure-sdk.mjs` applies and verifies both SDK values after `bubblewrap update`. Before uploading artifacts or publishing to Play, CI also reads the target SDK from the signed APK using `apkanalyzer` and refuses a missing, invalid, or below-36 value. The minimum supported device SDK remains Bubblewrap's default and does not need to match the Google Play target API requirement.

`android/compute-version-code.mjs` maps semver to Android versionCode:

```text
major * 1000000 + minor * 1000 + patch
```

Examples:

- `0.15.0` → `15000`
- `0.14.5` → `14005`

The script fails if:

- The version is not `x.y.z` semver-like.
- `minor` or `patch` is `>= 1000`.
- The computed code is not greater than the known Play baseline `5003`.
- The computed code is `>= 2100000000`.

Prerelease versions do not auto-publish from push. Manual dispatch with `force_publish=true` can override this.

## Release notes

`android/generate-release-notes.mjs` writes:

- `dist/release-notes.md` for GitHub Releases.
- `dist/google-play/whatsnew/whatsnew-en-US` for Google Play.

It prefers the current version section in `CHANGELOG.md`, then commit messages since the previous tag, then the latest commit message. Google Play notes are truncated to 500 Unicode characters per locale.

Because Google Play uses only the truncated prefix, each `CHANGELOG.md` version section must be ordered by public importance: player-visible changes, compatibility/platform availability, and user-facing fixes first; CI, documentation, safety, and internal refactors later.

Set additional locales with `RELEASE_NOTES_LOCALES`, for example `en-US,ru-RU`.

## Required GitHub secrets

Never commit these files or values.

```bash
# Linux
base64 -w 0 /path/to/LLBLab.keystore | gh secret set ANDROID_KEYSTORE_BASE64

# macOS
base64 < /path/to/LLBLab.keystore | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64

gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON < /path/to/service-account.json
```

Suggested repository variables:

```bash
gh variable set ANDROID_PACKAGE_NAME --body com.llblab.digifall
gh variable set GOOGLE_PLAY_TRACK --body internal
gh variable set RELEASE_NOTES_LOCALES --body en-US
```

## Google Play API setup

1. In Google Cloud Console, create/select a project.
2. Enable **Google Play Android Developer API**.
3. Create a service account and JSON key.
4. In Play Console → Users and permissions, invite the service account email.
5. Grant app-level permissions for Digifall only.
6. Initially grant release permissions only for the internal testing track.
7. Store the JSON key as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

## Digital Asset Links

The deployed file must be available at:

```bash
curl -fsSL https://digifall.app/.well-known/assetlinks.json | jq .
```

`public/.well-known/assetlinks.json` currently includes package `com.llblab.digifall` and the existing published fingerprint. Before production publishing, confirm in Play Console → Digifall → App integrity whether Play App Signing is enabled and copy the **App signing key certificate** SHA-256 fingerprint. If it differs from the existing fingerprint, add it to `sha256_cert_fingerprints` before release.

For sideload/local testing, adding the upload-key SHA-256 fingerprint can also be useful.

## First catch-up internal release

After secrets and variables are set, run a dry run first:

```bash
gh workflow run android-play-release.yml \
  -f force_publish=true \
  -f play_track=internal \
  -f release_status=completed \
  -f dry_run=true
```

If the dry run builds signed artifacts, publish to internal testing:

```bash
gh workflow run android-play-release.yml \
  -f force_publish=true \
  -f play_track=internal \
  -f release_status=completed \
  -f dry_run=false
```

Do not switch automatic/default publishing to production until one internal release succeeds and TWA verification is confirmed on a device.

## Device verification

Install the internal Play build and check:

- The app opens fullscreen as a TWA, not as a Custom Tab with browser UI.
- The content loads from `https://digifall.app/`.
- Energy/spinner/gameplay behavior matches the web app.

Optional adb checks:

```bash
adb shell pm get-app-links com.llblab.digifall
adb shell am start \
  -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "https://digifall.app/"
```

## Local validation

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run check
npm run build
node android/compute-version-code.mjs
node android/generate-release-notes.mjs
node android/sync-twa-version.mjs
node --test android/configure-sdk.test.mjs
node scripts/validate-records.mjs nodes/leaderboard/data.json
```

Local Android builds are optional. The normal path is CI-only: GitHub Actions installs Java/Android SDK, restores the keystore from secrets, generates the TWA project with Bubblewrap, signs the AAB, and uploads to Google Play.
