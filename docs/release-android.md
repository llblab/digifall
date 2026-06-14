# Android / Google Play Release

Digifall ships as a hosted PWA at `https://digifall.app/` and as an Android Trusted Web Activity (TWA) with package name `com.llblab.digifall`.

## Release lever

`package.json.version` is the source of truth.

On push to `main`, `.github/workflows/gh-pages-deploy.yml` keeps deploying the web app to GitHub Pages. The separate `.github/workflows/android-play-release.yml` workflow:

1. Detects whether `package.json.version` increased.
2. When the version increased, generates release notes, creates or updates tag/release `vX.Y.Z`, builds a signed TWA Android App Bundle, and uploads it to Google Play.

Manual dispatch with `force_publish=true` publishes the current version even if the version did not change. Use that for the first catch-up release from Play `0.12.0` / versionCode `5003` to the current site version, currently `0.15.0` / versionCode `15000`.

## Android versioning

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
npm run check
npm run build
node android/compute-version-code.mjs
node android/generate-release-notes.mjs
node android/sync-twa-version.mjs
node scripts/validate-records.mjs nodes/leaderboard/data.json
```

Local Android builds are optional. The normal path is CI-only: GitHub Actions installs Java/Android SDK, restores the keystore from secrets, generates the TWA project with Bubblewrap, signs the AAB, and uploads to Google Play.
