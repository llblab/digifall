# Changelog

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

### Dependencies

- Svelte 5.22 → 5.46
- Vite 6.3 → 7.3
- libp2p 2.8 → 3.1
- Removed: idb-keyval, it-pipe, @chainsafe/libp2p-gossipsub
- Added: @libp2p/floodsub, datastore-fs, prettier, svelte-check
