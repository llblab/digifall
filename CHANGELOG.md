# Changelog

## Unreleased

- `Chain Projection Hardening`: Chain snapshots now fail closed before touching shared stores when lifecycle, identity, board shape/coordinates/values, or safe JavaScript display ranges are invalid; move intents also reject indexes outside the fixed board
- `Backend View Projection`: Chain game snapshots now normalize into the existing card/energy/score/phase stores, while switching away from classic captures and restores its visual state instead of letting authoritative chain projection overwrite the local run
- `Chain Adapter Foundation`: Replaced the placeholder with a tested fail-closed adapter lifecycle that projects authoritative ready state, binds submissions to game ID/revision/card, rejects concurrent moves, disconnects resources, and ignores stopped generations
- `Client Backend Foundation`: Added the persisted classic/chain selector, controller-routed card actions, classic adapter, generation-safe backend lifecycle, shared status/interaction stores, and lazy fail-closed chain adapter seam without changing classic gameplay
- `On-chain Client Design`: Specified a `classic | chain` backend switch inside the existing Svelte client, reusing its board/styles/sounds/effects while lazy-loading Polkadot API, generated runtime descriptors, wallet/RPC lifecycle, finalized chain projection, and deterministic visual replay
- `On-chain Safety & Performance`: Defined separate exact-epoch sampling and fair bounded-resolution budgets, compact client-replay events, state/custody/upgrade invariants, adversarial validation, Wasm benchmark gates, and operational saturation signals without changing game rules
- `On-chain v2 Design`: Corrected the target to preserve Digifall rules exactly while changing the blockchain lifecycle: commit a card move, sample its bound later-block entropy, resolve the full refill/cascade transition with bounded scheduling, and drive the client from inclusion and finalized state
- `On-chain Review`: Completed a findings-first readiness assessment, confirming a foreign-consumer refund liveness defect, repeated fee-free retry exposure after failed settlement, and duplicate fee-predicate weight undercharging; economic activation remains blocked pending remediation and regression coverage
- `On-chain Protocol`: Added an experimental standalone `no_std` FRAME pallet with a fixed-size deterministic 6×6 engine, bounded resumable transitions, one current game per owner, stake custody, delegated session control, and stake/score reward minting
- `On-chain Fairness`: Bound each commitment to one bounded scheduled post-commit randomness sample, with owner refunds when the configured source cannot provide fresh entropy
- `On-chain Safety`: Added transactional fault refunds, consumer-safe sufficient references for unfunded session accounts, game-ID/revision replay guards, configurable limits, and separate stake/reward fungible adapters
- `On-chain Sponsorship`: Added a strict-current nonce transaction extension for state-dependent fee-free calls and composed it with `SkipCheckIfFeeless<ChargeTransactionPayment>` in the mock runtime, rejecting future-nonce duplicates and unrelated unfunded calls
- `On-chain Runtime`: Added a minimal Polkadot SDK 2606 Cumulus parachain runtime that composes the pallet, native stake, asset rewards, sponsored transaction extensions, `ParachainSystem`, and a successful locked `substrate-wasm-builder` validation runtime
- `On-chain Validation`: Added JavaScript parity vectors, SCALE-round-tripped signed-extrinsic runtime coverage for fee-free progress/replay/payment behavior, lifecycle/economic/fault/rollback/`no_std` tests, and a FRAME harness covering every weight path, queue bounds, active rotation, settlement, fault cleanup, and conservative per-budget resolution via full-replacement/high-group one-step benchmarks; the runtime exports FRAME's benchmark API and now uses generated weights from a full 50-step/20-repeat `frame-omni-bencher` run, with final production-hardware regeneration still gated on the chosen randomness and reward configuration

## 0.15.5 Match Animation Smoothness

- `Rendering`: Matched cards visibly blink again — the match flash was hidden by a rendering issue with filtered layers on composited cards and now draws directly on the card layer
- `Rendering`: Matched cards dissolve with a soft blur-and-shrink effect instead of a hard cut
- `Rendering`: Match highlight sliders animate with GPU transforms and opacity instead of per-frame clipping, removing the stutter during match resolution on mobile

## 0.15.4 Mobile Fall Animation Smoothness

- `Rendering`: Card fall animations now use GPU-composited transforms instead of layout offsets, removing per-frame reflow on mobile — falling cards stay smooth during match resolution on low-end devices
- `Rendering`: Leaderboard type switching (combos/scores) animates with transforms instead of layout offsets
- `Engine`: Match collapse in the deterministic core dropped from quadratic filter-and-sort to a single pass, speeding up match resolution and record replay validation
- `Dependencies`: Refreshed the libp2p stack, Svelte, Vite, PostCSS, and related lockfile dependencies; fixed the high-severity `brace-expansion` advisory (0 known vulnerabilities)
## 0.15.3 Android 16 Compatibility Hotfix

- `Android Compatibility`: Android release builds now compile against and target Android 16 (API level 36) while preserving Bubblewrap's minimum-device compatibility, satisfying the Google Play target API requirement
- `Dependencies`: Refreshed Svelte, Vite, Stylelint, Prettier, libp2p, and related lockfile dependencies to their latest compatible releases

## 0.15.2 Relay and Leaderboard Reliability

- `P2P Infrastructure`: Updated default relays with the refreshed `r1.digifall.app` peer id and added `r3.digifall.app` as a third built-in relay path for better network resilience
- `P2P Infrastructure`: Relay share links can now open the Relays overlay with a sanitized `?relay=` or `#relay=` multiaddr preview before adding it to user relay settings
- `Leaderboard Reliability`: Headless leaderboard persistence now writes snapshots atomically through a serialized save queue, preventing interrupted or overlapping saves from corrupting `nodes/leaderboard/data.json`
- `Leaderboard Reliability`: Headless leaderboard startup now fails closed on malformed persisted JSON instead of silently treating corrupted persistence as empty data
- `Relay Deployment`: Relay deployment now respects an existing Node.js runtime, installs NodeSource Node.js 26 only when no `node` is available, refreshes npm to the latest stable release, and fails if the relay smoke test exits before verification completes
- `Leaderboard Reliability`: Local personal-best records are now replay-audited before leaderboard promotion, valid records can be normalized upward to replay-derived values, and invalid records stay local-only with debug diagnostics instead of being published or deleted
- `Developer Experience`: Added generated high-score replay coverage that compares validation-style replay with live-like core startup replay and rejects non-energy-sized inflated local-record values while preserving replay-value diagnostics

## 0.15.1 Leaderboard Hotfix

- `Leaderboard Reliability`: Local personal bests are now replay-validated and synced into the IndexedDB-backed leaderboard regardless of the current game phase, so high-combo records saved during combo resolution are not stranded in localStorage

## 0.15.0 Android Play Release Pipeline

- `Android`: Added a Bubblewrap Trusted Web Activity configuration for package `com.llblab.digifall`, version-synced from `package.json`, so Digifall can ship to Google Play as a hosted PWA wrapper
- `CI`: Added pull request validation and an idempotent Android release workflow that detects package version bumps, creates or updates GitHub Releases, builds signed Android App Bundles, and can upload to Google Play
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
