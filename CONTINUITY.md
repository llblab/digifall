# Continuity Ledger

## Goal

Extract shared leaderboard logic into `packages/leaderboard/` and add persistent storage for server-side leaderboard node.

**Success criteria:**

- `packages/leaderboard/` with shared protocol handlers and utilities
- Both `src/leaderboard.js` (client) and `nodes/leaderboard/index.js` (server) import from shared package
- Server node persists leaderboard data to disk
- No logic duplication between client and server

## Constraints/Assumptions

- npm workspaces for monorepo structure
- Package must work in both browser and Node.js environments
- Client validates records via replay; server trusts network (per AGENTS.md design)
- Shared package exports pure functions and protocol logic
- Storage abstraction allows different backends (IDB vs filesystem)

## Key Decisions

- `packages/leaderboard/` — shared leaderboard protocol logic
- `LeaderboardCore` class encapsulates queues, roots, and handler factories
- Exported: `PROTOCOLS`, `compare`, `extractKey`, `parseMessage`, `toMessage`, `squashIntegers`, `getSeed`, `computeRootHash`, `DEFAULT_RELAYS`
- Handler factories: `createRootHandler`, `createPreviewHandler`, `createPushRoot`, `createPushPreview`
- Server persistence via JSON file (`nodes/leaderboard/data.json`, tracked in git)
- `onUpdate` callback for persistence hooks
- `DIGIFALL_RELAYS` / `DIGIFALL_RELAY` env vars for server node relay configuration
- `@libp2p/bootstrap` for automatic relay connection on server startup

## State

### Done

- Created `packages/leaderboard/index.js` with `LeaderboardCore` class
- Created `packages/leaderboard/package.json`
- Refactored `src/leaderboard.js` to use `@digifall/leaderboard`
- Refactored `nodes/leaderboard/index.js` to use shared package + JSON persistence
- Moved `DEFAULT_RELAYS` to shared package as single source of truth
- Restructured `nodes/` into `relay/` and `leaderboard/` subfolders
- Added `@libp2p/bootstrap` for automatic relay connection
- Added `DIGIFALL_RELAYS` env var support
- Updated `.gitignore` for new structure
- Created initial `nodes/leaderboard/data.json` (tracked in git)
- Updated `package.json` scripts for new paths
- Updated `AGENTS.md` with new structure, entities, and insights
- Updated `CHANGELOG.md`
- Verified both client (vite dev) and server (node) work

### Now

- Complete

### Next

- N/A

## Open Questions

- N/A

## Working Set

- `packages/leaderboard/index.js` — shared leaderboard package
- `packages/leaderboard/package.json` — package config
- `src/leaderboard.js` — client leaderboard (refactored)
- `src/constants.js` — re-exports `DEFAULT_RELAYS` from shared package
- `nodes/relay/index.js` — relay node
- `nodes/leaderboard/index.js` — leaderboard node (refactored + persistence)
- `nodes/leaderboard/data.json` — persistent leaderboard storage
- `.gitignore` — updated for new structure
- `AGENTS.md` — updated project structure and insights
- `CHANGELOG.md` — updated for 0.13.0
