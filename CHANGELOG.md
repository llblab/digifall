# Changelog

## 0.14.1 Second Default Relay

### P2P Infrastructure

- `Second Default Relay`: Added `r2.digifall.app` to `DEFAULT_RELAYS`, giving clients and nodes a second built-in relay path for better network resilience
- `Leaderboard Package`: Bumped `@digifall/leaderboard` to 1.1.1 alongside the app version
- `Bootstrap Data`: Refreshed tracked leaderboard node data for bootstrap/backup continuity

### CI

- `Node 24 GitHub Actions`: Deploy workflow now uses Node.js 24 with latest checkout/setup-node actions so `npm ci` runs under npm 11, matching the lockfile-generating local toolchain and avoiding npm 10 optional peer lockfile drift

### Context

- `AGENTS.md Change History Removal`: Removed rolling completed-work history from durable agent protocol; completed delivery history now belongs in this changelog per ABC context split

## 0.14.0 Bumd Deps + New Default Relay

### Leaderboard Protocol

- `@llblab/uniqueue API Compatibility`: `LeaderboardCore` now reads queue snapshots through a compatibility helper, supporting current `snapshot()` and older iterable/data-based Uniqueue instances
- `@llblab/uniqueue 1.4`: Adapted `LeaderboardCore` to documented `snapshot()` and `get()` APIs instead of private `.data` / `.indexes` internals
- `Headless Node Startup`: Fixed persisted leaderboard loading after dependency upgrades
- `Record Insertion`: Preserved top-N behavior by treating self-evicted low-priority records as no-op updates

### Relay Deployment

- `CI Node Baseline`: GitHub Pages deploy now uses Node.js 22; `package.json` and lockfile declare `node >=22`; lockfile includes npm 10-compatible optional peer entries
- `Stylelint Peer Resolution`: Overrode `stylelint-order` to a Stylelint 17-compatible version and narrowed lint globs to source/html inputs so generated `dist/` assets are not linted
- `Self-Contained Relay Scripts`: Inlined the needed shell helpers into both relay lifecycle scripts so one-file `curl` installs do not depend on local or remote helper scripts
- `Node Runtime Check`: Relay deployment now verifies both Node.js 22+ and npm, installing NodeSource Node.js when a distro provides node without npm
- `RPM Package Managers`: Fedora/RHEL/CentOS deployment now supports both `dnf` and `yum`, with optional EPEL, certbot-nginx, and SELinux utility fallbacks
- `Systemd Runtime Path`: Relay service now uses the resolved absolute npm binary instead of relying on `which npm` during unit generation
- `Privilege Drop`: Temporary relay smoke test now uses `runuser` before falling back to `sudo`
- `Relay Undeploy`: Refactored removal into safer idempotent steps with explicit confirmation, safe app-directory deletion guard, nginx reload validation, and shared helpers

## 0.13.0 Svelte 5 + Dynamic Relays

### P2P Infrastructure

- `Dynamic Relay Configuration`: Users can add, remove, and reset relay servers via new Relays overlay (Options → Relays)
- `Automatic Relay Migration`: New default relays auto-inject on app update; removed defaults auto-cleanup; custom user relays preserved
- `libp2p Upgrade`: Migrated to libp2p v3 with floodsub (replacing gossipsub), updated stream handling from it-pipe to event-based API
- `Relay Node`: Added `nodes/relay/` for self-hosted relay servers with `scripts/deploy-relay.sh` for one-command deployment
- `Leaderboard Node`: Added `nodes/leaderboard/` headless peer with persistent storage (`data.json` tracked in git for bootstrap/backup)
- `Environment Config`: `DIGIFALL_RELAYS` / `DIGIFALL_RELAY` env vars for custom relay configuration in server nodes

### Svelte 5 Migration

- `Runes API`: Full migration from Svelte 4 reactive statements (`$:`) to Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`)
- `Event Handlers`: Migrated from `on:event` directive syntax to `onevent` attribute syntax
- `Snippets`: Replaced slots with `{@render children()}` snippet pattern in Dialog and VirtualScroll components

### Validation & Security

- `Moves Length Limit`: Added `MAX_MOVES_LENGTH` (40,000) early rejection before replay to prevent DoS via oversized records
- `Multiaddr Validation`: Added `validateMultiaddr()` and `sanitizeMultiaddr()` for relay address validation

### Architecture

- `@digifall/leaderboard`: Shared npm workspace package for P2P leaderboard protocol
  - `LeaderboardCore` class with queues, root hashes, and handler factories
  - Protocol constants, utilities (`compare`, `parseMessage`, `toMessage`, `squashIntegers`, `getSeed`)
  - `DEFAULT_RELAYS` as single source of truth
- `Store Refactoring`: Renamed stores with `Store` suffix, added `.get()` synchronous accessor, created `createStore()` and `createDerivedStore()` factories
- `Persistence Layer`: Refactored to `createLocalStorageStore()` and `createIndexedDBFactory()` with custom load/save support
- `Derived Store Chains`: `relaysStore` → `activeRelaysStore` → `relayPeerIdsStore` for reactive relay management
- `nodes/` restructured into separate folders: `nodes/relay/`, `nodes/leaderboard/`

### Developer Experience

- `AGENTS.md`: Added comprehensive project context documentation for AI-assisted development
- `Type Annotations`: Added JSDoc typedefs for core entities (Card, GameRecord, ComboRow, LogEntry)
- `New Scripts`: `npm run check` (svelte-check), `npm run format` (prettier), `npm run relay`, `npm run leaderboard`
