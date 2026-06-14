# Changelog

## 0.15.0 Android Play Release Pipeline

- `Android`: Added a Bubblewrap Trusted Web Activity configuration for package `com.llblab.digifall`, version-synced from `package.json`, so Digifall can ship to Google Play as a hosted PWA wrapper
- `CI`: Extended the main GitHub Pages workflow into an idempotent release pipeline that detects package version bumps, deploys the web app, creates or updates GitHub Releases, builds signed Android App Bundles, and can upload to Google Play
- `Release Automation`: Added Android version-code, version-bump detection, TWA version sync, and release-notes generation scripts with manual dispatch support for the first internal catch-up release
- `Documentation`: Added Android/Google Play release documentation covering required secrets, Play Console setup, manual dry run/internal publish commands, asset links verification, and device checks
- `Safety`: Expanded ignore rules for keystores, service account files, signed APKs/AABs, and local secret material so release credentials and artifacts stay out of git
- `Node Entrypoints`: Renamed server node entry files to explicit `.mjs` names (`relay.mjs`, `leaderboard.mjs`, `validate-records.mjs`) while keeping npm scripts as the operational interface

## 0.14.5 iOS Energy Reliability

- `Reliability`: Startup replay now marks the game as not ready while persisted moves are being rehydrated, preventing iOS rapid-mode touches from being ignored during the restore window instead of being mistaken for valid moves
- `Reliability`: Rapid-mode user moves now debit energy directly in the move transaction, matching replay behavior and avoiding dependence on the energy-buffer drain subscriber
- `Input`: Board long-press actions now check both game readiness and phase progress before committing a plus action, hardening startup/reset races
- `Input`: Rapid-mode touch starts now commit a card move immediately, restoring tap-to-plus behavior on touch devices while preserving long-press protection for normal mode
- `Developer Experience`: Added core state-machine regression tests covering rapid and animated energy debit, replay readiness, ignored live input during replay, and reset readiness
- `Dependencies`: Refreshed Svelte, Vite, Stylelint, Prettier, libp2p, and related lockfile dependencies for the 0.14.5 release
- `Build`: Removed the deprecated Vite dependency optimization override; Vite 8 now builds cleanly without the old `esbuildOptions` setting

## 0.14.4 Architecture Guardrails

- `Architecture`: Added project-local Domain DAG validation config and vendored the Domain DAG skill under `.agents/skills/domain-dag`, covering browser source, shared leaderboard package, server nodes, scripts, layer direction, and core boundary rules
- `Documentation`: Linked Domain DAG validation from the root README architecture overview and added a docs index for project-control navigation

## 0.14.3 Mobile Safari Hotfix

- `Reliability`: Board/card long-press surfaces now explicitly disable native selection/callout gestures and cancel touch defaults so iOS long taps remain gameplay actions
- `Reliability`: localStorage reads and writes now fail soft so unavailable, full, private-mode restricted, or corrupt browser storage cannot block gameplay state updates such as energy drain after moves
- `Dependencies`: Refreshed the root package lock metadata for the 0.14.3 release and preserved npm's optional peer placeholder for `svelte-check`'s nested `fdir` dependency
- `Developer Experience`: Added Node test coverage for localStorage fallback behavior and leaderboard protocol helpers so `npm test` and `npm test --workspaces` have passing validation paths

## 0.14.2 Dependency Lock Refresh

- `Dependencies`: Regenerated `package-lock.json` from the upgraded `package.json` dependency set so clean `npm install` resolves `@sveltejs/vite-plugin-svelte@7.1.2` with `vite@8.0.13` instead of the stale Vite 7 tree
- `P2P`: Removed the `use-all-relays` localStorage debug flag; browser clients always use relay rotation gating
- `Validation`: Kept replay validation in `src/validation.js` as the single source for record replay validation and input sanitizers, with isolated initial store state for parallel replay checks
- `Validation`: Added `npm run validate-records` for replay-validating leaderboard record JSON from a file path or stdin
- `Validation`: Leaderboard nodes now replay-validate inbound and persisted records instead of trusting received data
- `Validation`: Removed invalid `vggjj` highCombo record whose replay value is 3, not the persisted 303

## 0.14.1 Second Default Relay

- `P2P Infrastructure`: Added `r2.digifall.app` to `DEFAULT_RELAYS`, giving clients and nodes a second built-in relay path for better network resilience
- `P2P Infrastructure`: Bumped `@digifall/leaderboard` to 1.1.1 alongside the app version
- `P2P Infrastructure`: Refreshed tracked leaderboard node data for bootstrap/backup continuity
- `CI`: Deploy workflow now uses Node.js 24 with latest checkout/setup-node actions so `npm ci` runs under npm 11, matching the lockfile-generating local toolchain and avoiding npm 10 optional peer lockfile drift
- `Context`: Removed rolling completed-work history from durable agent protocol; completed delivery history now belongs in this changelog per ABC context split

## 0.14.0 Bump Deps + New Default Relay

- `Leaderboard Protocol`: `LeaderboardCore` now reads queue snapshots through a compatibility helper, supporting current `snapshot()` and older iterable/data-based Uniqueue instances
- `Leaderboard Protocol`: Adapted `LeaderboardCore` to documented `snapshot()` and `get()` APIs instead of private `.data` / `.indexes` internals
- `Leaderboard Protocol`: Fixed persisted leaderboard loading after dependency upgrades
- `Leaderboard Protocol`: Preserved top-N behavior by treating self-evicted low-priority records as no-op updates
- `Relay Deployment`: GitHub Pages deploy now uses Node.js 22; `package.json` and lockfile declare `node >=22`; lockfile includes npm 10-compatible optional peer entries
- `Relay Deployment`: Overrode `stylelint-order` to a Stylelint 17-compatible version and narrowed lint globs to source/html inputs so generated `dist/` assets are not linted
- `Relay Deployment`: Inlined the needed shell helpers into both relay lifecycle scripts so one-file `curl` installs do not depend on local or remote helper scripts
- `Relay Deployment`: Relay deployment now verifies both Node.js 22+ and npm, installing NodeSource Node.js when a distro provides node without npm
- `Relay Deployment`: Fedora/RHEL/CentOS deployment now supports both `dnf` and `yum`, with optional EPEL, certbot-nginx, and SELinux utility fallbacks
- `Relay Deployment`: Relay service now uses the resolved absolute npm binary instead of relying on `which npm` during unit generation
- `Relay Deployment`: Temporary relay smoke test now uses `runuser` before falling back to `sudo`
- `Relay Deployment`: Refactored removal into safer idempotent steps with explicit confirmation, safe app-directory deletion guard, nginx reload validation, and shared helpers

## 0.13.0 Svelte 5 + Dynamic Relays

- `P2P Infrastructure`: Users can add, remove, and reset relay servers via new Relays overlay in Options
- `P2P Infrastructure`: New default relays auto-inject on app update; removed defaults auto-cleanup; custom user relays preserved
- `P2P Infrastructure`: Migrated to libp2p v3 with floodsub, replacing gossipsub, and updated stream handling from it-pipe to event-based API
- `P2P Infrastructure`: Added `nodes/relay/` for self-hosted relay servers with `scripts/deploy-relay.sh` for one-command deployment
- `P2P Infrastructure`: Added `nodes/leaderboard/` headless peer with persistent storage, with `data.json` tracked in git for bootstrap and backup
- `P2P Infrastructure`: Added `DIGIFALL_RELAYS` and `DIGIFALL_RELAY` env vars for custom relay configuration in server nodes
- `Svelte 5 Migration`: Full migration from Svelte 4 reactive statements to Svelte 5 runes
- `Svelte 5 Migration`: Migrated from `on:event` directive syntax to `onevent` attribute syntax
- `Svelte 5 Migration`: Replaced slots with `{@render children()}` snippet pattern in Dialog and VirtualScroll components
- `Validation & Security`: Added `MAX_MOVES_LENGTH` early rejection before replay to prevent DoS via oversized records
- `Validation & Security`: Added `validateMultiaddr()` and `sanitizeMultiaddr()` for relay address validation
- `Architecture`: Added `@digifall/leaderboard` shared npm workspace package for P2P leaderboard protocol
- `Architecture`: Renamed stores with `Store` suffix, added `.get()` synchronous accessor, created `createStore()` and `createDerivedStore()` factories
- `Architecture`: Refactored persistence to `createLocalStorageStore()` and `createIndexedDBFactory()` with custom load/save support
- `Architecture`: Added derived relay store chains from `relaysStore` to `activeRelaysStore` to `relayPeerIdsStore`
- `Architecture`: Restructured `nodes/` into separate `nodes/relay/` and `nodes/leaderboard/` folders
- `Developer Experience`: Added comprehensive project context documentation for AI-assisted development
- `Developer Experience`: Added JSDoc typedefs for core entities such as Card, GameRecord, ComboRow, and LogEntry
- `Developer Experience`: Added scripts for `npm run check`, `npm run format`, `npm run relay`, and `npm run leaderboard`
