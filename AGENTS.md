# Project Context

## Meta-Protocol Principles

Living protocol for continuous self-improvement and knowledge evolution:

1. Mandatory Enhancement: Every task ends with context updates
2. Protocol Evolution: Rules improve when better workflows emerge
3. Context Optimization: Prevent growth through cleanup protocols
4. Knowledge Consolidation: Preserve insights from rotated entries
5. Single Source Authority: Create navigation, not duplication
6. Wisdom Distillation: Transform experiences into architectural guidance
7. Decreasing Abstraction: Organize general → specific
8. Garbage Collection: Audit and remove obsolete information
9. Evolutionary Design: Build protocols for their own enhancement

## 1. Overall Concept

Trustless P2P puzzle game with deterministic replay-based validation and serverless leaderboard synchronization.

### Philosophical Foundation

Not a traditional game-as-product, but a protocol-as-game:

- Collective Identity: PlayerName is shared credential—multiple players cooperate under single name, collectively improving leaderboard position. Gaming becomes collaborative achievement rather than individual competition
- Immortal Software: Open source + anyone-can-run-relay = game survives creator's disappearance. No central authority, no shutdown switch, no single point of failure
- Protocol Autonomy: Not "decentralized app with P2P feature" but "self-sustaining protocol that happens to be a game". Infrastructure is democratized—participants are peers, not users

## 2. Core Entities

- Card: Positioned game piece with value (1-9), coordinates, and animation state
  - See: [Card typedef](src/core.js#L8-L16)
- Game State: Reactive store collection (cards, energy, score, phase, moves, options)
  - See: [game object](src/stores.js#L94-L107), [INITIAL_VALUES](src/constants.js#L56-L93)
- Phase: Game loop state machine (initial → idle → plus → blink → match → fall → extra → combo → score → gameOver)
  - See: [PHASES enum](src/constants.js#L48-L58), [PHASE_LOGICS](src/core.js#L606-L617)
- Seed: Deterministic PRNG root derived from playerName + timestamp
  - See: [getSeed()](src/core.js#L727-L739)
- Record: Validated game result with type, moves sequence, playerName, timestamp, and value
  - See: [GameRecord typedef](src/validation.js#L13-L20), [RECORD_TYPES](src/constants.js#L60)
- Relays Config: Atomically-managed relay state with active list and applied defaults tracking
  - See: [relaysStore](src/stores.js#L80-L85), [INITIAL_VALUES.relays](src/constants.js#L89-L93)
- UniQueue: Priority heap + unique key map for leaderboard deduplication and sorting
  - See: [@llblab/uniqueue](https://www.npmjs.com/package/@llblab/uniqueue)
- LeaderboardCore: Shared protocol logic class managing queues, root hashes, and handler factories
  - See: [@digifall/leaderboard](packages/leaderboard/index.js)
- libp2p Node: Browser-based P2P networking with relay transport and floodsub
  - See: [initP2PLeaderboard()](src/leaderboard.js#L139-L210)
- Relay Node: Server-side libp2p circuit relay + pubsub peer discovery
  - See: [nodes/relay/index.js](nodes/relay/index.js), [scripts/deploy-relay.sh](scripts/deploy-relay.sh)
- Leaderboard Node: Headless server-side leaderboard peer with persistent storage
  - See: [nodes/leaderboard/index.js](nodes/leaderboard/index.js), [data.json](nodes/leaderboard/data.json)

## 3. Architectural Decisions

### Critical (Core invariants - changes require architectural review)

- Deterministic Core Logic: All game mechanics use seeded PRNG for full reproducibility
  - Rationale: Enables validation through replay without cryptographic signatures
  - Trade-offs: CPU cost of re-simulation vs cryptographic verification overhead
  - See: [getRandom()](src/core.js#L96-L98), [getSeed()](src/core.js#L727-L739)

- Validation Through Replay: Records validated by re-executing game with same seed and moves
  - Rationale: Mathematical proof of legitimacy without trusted authority
  - Trade-offs: 3-second timeout limit constrains maximum game length
  - See: [validateRecord()](src/validation.js#L30-L88)

- P2P Leaderboard: Floodsub + eventual consistency without consensus algorithm
  - Rationale: Zero hosting cost, censorship resistance, community ownership
  - Trade-offs: No global ordering guarantees, requires relay infrastructure for NAT traversal
  - Note: Floodsub is temporary—gossipsub will return when stable for libp2p v3
  - See: [leaderboard.js](src/leaderboard.js)

### Tactical (Implementation details - can evolve with justification)

- Plaintext Encryption: libp2p configured without encryption layer
  - Rationale: Validation layer makes encryption redundant—MITM cannot inject invalid records, only waste bandwidth. Defense-by-validation eliminates need for defense-by-encryption.
  - Trade-offs: No privacy (acceptable for public leaderboard), visible traffic (irrelevant since validation is sole trust boundary)
  - See: [plaintext() config](src/leaderboard.js#L270), [relay config](nodes/relay.js)

- Svelte 5 Runes: Modern reactive primitives ($state, $derived, $effect)
  - Rationale: Simplified reactivity compared to stores-only approach
  - Trade-offs: Requires Svelte 5+ (no backward compatibility)

- Single Core File: All game logic concentrated in core.js (~900 lines)
  - Rationale: Simplifies validation runtime, ensures deterministic execution
  - Trade-offs: Monolithic structure reduces modularity

- Atomic Relay State: Relays stored as `{ active, applied }` object for migration consistency
  - Rationale: Enables bidirectional relay updates—new defaults auto-inject, removed defaults auto-cleanup, user custom relays preserved
  - Trade-offs: Idempotent migration runs on every load (no persistence until user action)
  - See: [loadRelays()](src/stores.js#L107-L125), [relaysStore](src/stores.js#L104-L126)

## 4. Project Structure

- `/src/`: Application source code
  - `core.js`: Pure deterministic game logic and phase state machine (~900 LOC)
  - `stores.js`: Svelte reactive state containers with .get() extension, relay state management
  - `validation.js`: Record verification through game replay, multiaddr validation
  - `leaderboard.js`: P2P sync protocol (root hash exchange, preview diffing)
  - `persistence.js`: localStorage and IndexedDB store factories (business-logic-agnostic)

  - `sounds.js`: Howler.js audio management
  - `constants.js`: Frozen configuration objects (CORE, KEYS, PHASES, etc.)
  - `*.svelte`: UI components (App, Game, Board, Card, overlays)

- `/packages/`: Shared npm workspaces
  - `leaderboard/`: Shared P2P leaderboard protocol logic
    - `LeaderboardCore` class with queues, root hashes, handler factories
    - Protocol constants (`PROTOCOLS`), utilities (`compare`, `parseMessage`, `toMessage`)
    - Hash functions (`squashIntegers`, `getSeed`, `computeRootHash`)
    - `DEFAULT_RELAYS` as single source of truth
- `/nodes/`: Server-side infrastructure (each node in own folder with colocated data)
  - `relay/`: Standalone libp2p circuit relay for NAT traversal
    - `index.js`: Relay server implementation
    - `peerstore/`: Persistent peer identity (gitignored)
  - `leaderboard/`: Headless leaderboard node for bootstrapping peers
    - `index.js`: Node implementation (no validation, trusts network)
    - `data.json`: Persistent leaderboard storage (tracked in git for bootstrap/backup)
    - `peerstore/`: Persistent peer identity (gitignored)
- `/scripts/`: Deployment and operations automation
  - `deploy-relay.sh`: One-command relay deployment with systemd + SSL + certbot renewal hooks
  - `undeploy-relay.sh`: Clean removal of relay services, certificates, and user
- `/public/`: Static assets (fonts, images, sounds, manifest.json)
- `/dist/`: Vite build output (generated)
- `vite.config.js`: Build configuration with PWA plugin
- `package.json`: Dependencies (Svelte 5, libp2p, datastore-idb, howler)

## 5. Development Conventions

### Mandatory (Violations break core guarantees)

- Determinism First: Never use Math.random(), Date.now(), or non-seeded randomness in core logic
  - Rationale: Breaks replay validation if any non-deterministic operation enters core.js
  - See: [getRandom()](src/core.js#L96-L98)

- Reactive Stores with .get(): Extend stores with synchronous getter alongside subscriptions
  - Rationale: Phase logic needs instant state reads without subscription overhead
  - Pattern: `store.get = () => get(store)`
  - See: [createStore()](src/stores.js#L13-L17)

- Validation Timeout: 5-second limit for replay prevents DoS through artificially long games
  - Rationale: Malicious peer could send infinite-length game record; game mechanics naturally constrain legitimate games well below timeout
  - Note: Game difficulty makes 1000+ move records practically unreachable before energy depletion
  - See: [validateRecord() timeout](src/validation.js#L54-L57)

### Infrastructure (Node Operations)

- Idempotent Deployment: Relay setup must be single-command, creating systemd services and SSL certs automatically
  - Rationale: Radical simplification allows non-technical users to host relays, preventing centralization
  - See: [scripts/deploy-relay.sh](scripts/deploy-relay.sh)

- Early Rejection: Validate record constraints (moves length, field types) before expensive replay
  - Rationale: O(1) rejection of malformed records prevents DoS via crafted payloads
  - See: [MAX_MOVES_LENGTH](src/constants.js#L9), [validateRecord()](src/validation.js#L72-L74)

- Symmetric Deploy/Undeploy: Both scripts support interactive and non-interactive modes for deb/rpm systems
  - Rationale: Automated CI/CD pipelines need non-interactive; manual ops need confirmation prompts
  - See: [deploy-relay.sh](scripts/deploy-relay.sh), [undeploy-relay.sh](scripts/undeploy-relay.sh)

- Environment-First Configuration: Server nodes read `DIGIFALL_RELAYS` env var before falling back to hardcoded defaults
  - Rationale: Enables staging/prod separation, custom relay testing without code changes
  - See: [parseRelaysFromEnv()](nodes/leaderboard/index.js#L28-L35)

- Git-Tracked Bootstrap Data: Leaderboard `data.json` committed to repo for disaster recovery and new node bootstrap
  - Rationale: P2P network may be empty; git provides backup and historical record of leaderboard evolution
  - Trade-off: Manual commits required to update backup (acceptable for low-frequency changes)

### Recommended (Performance and maintainability)

- Phase-Driven Animation: All visual timing derives from phase transitions and duration calculations
  - Rationale: Keeps animation synchronized with deterministic game state
  - See: [checkRapid()](src/core.js#L138-L151)

- Move Encoding: Game actions serialized as base64-encoded integer arrays for compactness
  - Rationale: Reduces localStorage size and P2P bandwidth
  - See: [getBase64FromArray()](src/core.js#L103-L105)

- Root Hash Optimization: Leaderboard state compressed via squashIntegers() for efficient sync
  - Rationale: Prevents sending full leaderboard on every connection
  - See: [squashIntegers()](packages/leaderboard/index.js#L32-L38), [computeRootHash()](packages/leaderboard/index.js#L48-L56)

- Connection Gating: Limit simultaneous P2P connections (3-5) to prevent resource exhaustion
  - Rationale: Browser tab resource constraints
  - See: [connectionGater.denyDialPeer](src/leaderboard.js#L170-L186)

- Blacklist Invalid Peers: Disconnect and ban nodes failing protocol negotiation
  - Rationale: Prevents repeated connection attempts from incompatible clients
  - See: [blacklist Set](src/leaderboard.js#L49)

### Development Only

- Debug Flags: localStorage gates for development features
  - `debug`: Enable console logging
  - `reload`: Auto-reload interval in seconds
  - `use-all-relays`: Connect to all relays instead of rotating
  - See: [constants.js](src/constants.js#L1-L5)

- Relay Fallback: Automatic relay switching on connection failure with 73-second retry interval
  - See: [restoreRelay()](src/leaderboard.js#L125-L137)

### Store Architecture Principles

- Separation of Concerns: `stores.js` declares stores only; `persistence.js` provides generic utilities; business logic lives in components or domain modules
  - Rationale: Prevents circular dependencies, keeps persistence layer reusable
  - Pattern: Load functions passed to store factories, not embedded in persistence.js

- Derived Store Chains: Use derived stores for computed values (e.g., `relaysStore` → `activeRelaysStore` → `relayPeerIdsStore`)
  - Rationale: Automatic reactivity without manual change detection
  - Anti-pattern: Manual `prevValue` tracking in subscriptions

- Idempotent Migration: Relay migration runs on every load without persisting until user action
  - Rationale: localStorage is source of truth only when it differs from defaults; migration is cheap and deterministic
  - Pattern: `load()` transforms data, `save()` happens only on explicit `set()`/`update()`

### Shared Package Principles

- Protocol vs Infrastructure Separation: Shared packages contain protocol logic (message formats, handlers); platform-specific code (libp2p config, storage backends) stays in consumers
  - Rationale: `@digifall/leaderboard` works in browser and Node.js; `createLibp2p()` config differs per environment
  - Pattern: Package exports handler factories; consumer wires them to platform-specific libp2p instance

- Single Source of Truth for Constants: `DEFAULT_RELAYS` lives in `@digifall/leaderboard`, re-exported by `src/constants.js`
  - Rationale: Adding/removing relay requires change in one place
  - Anti-pattern: Duplicating relay lists across files

- Callback-Based Integration: `LeaderboardCore` accepts `onUpdate` callback instead of hardcoding persistence
  - Rationale: Client persists to IndexedDB, server to JSON file—same core, different storage
  - Pattern: Dependency injection via constructor options

## 6. Pre-Task Preparation Protocol

- Step 1: Review affected entity definitions in section 2 (Core Entities)
- Step 2: Verify alignment with determinism and P2P sync constraints (section 3)
- Step 3: Check relevant conventions from section 5 for implementation patterns
- Step 4: Identify knowledge gaps requiring context enhancement post-task

## 7. Task Completion Protocol

- Step 1: Verify architectural consistency (no non-deterministic operations in core.js)
- Step 2: Execute quality validation: `npm run check` (svelte-check) and `npm run lint` (stylelint)
- Step 3: Update affected Core Entities (section 2) if data structures changed
- Step 4: Mandatory Context Evolution:
  - Analyze impact on determinism, P2P sync, or validation logic
  - Update sections 1-5 for architectural drift
  - Add substantive Change History entry with task, implementation, impact, insights
  - Change History structure: `[Current]` → `[Previous]` → `[Legacy-0]` → `[Legacy-1]` → `[Legacy-2]` (newest first)
  - On new entry: current becomes previous, previous becomes legacy-0, shift legacy indexes
- Step 5: Size Management (if AGENTS.md exceeds 300 lines):
  - Trigger garbage collection phase
  - Change History: keep max 3 Legacy entries; drop oldest, extract lasting insights into sections 3-5
  - Analyze bloat sources: prune verbose sections outside Change History (redundant references, over-detailed patterns)
  - Preserve: architectural decisions rationale, philosophical foundations, active conventions
  - Remove: implementation minutiae superseded by code, resolved open questions, dated references

## 8. Change History

_Format: Task → Implementation → Impact → Insights_

[Current]: v0.13.0 — Svelte 5 + Dynamic Relays + Shared Leaderboard Package

- Task: Svelte 5 migration, user-configurable relays, `@digifall/leaderboard` extraction, node restructuring
- Implementation: Runes migration; `relaysStore` with `{ active, applied }` atomic structure; libp2p v3 + floodsub; `LeaderboardCore` class; `nodes/relay/` and `nodes/leaderboard/` structure; git-tracked `data.json`; env var relay config
- Impact: Modern reactivity; relay management without code changes; ~180 LOC deduplication; server nodes bootstrap from committed data
- Insights: Applied-Set Pattern (bidirectional migrations); Protocol vs Infrastructure separation; Handler Factories (IoC without DI); Git as Backup; Colocated Node Structure

[Previous]: Relay Infrastructure Consolidation

- Task: Restructure relay components from `/relay/` to `/nodes/` + `/scripts/`
- Implementation: Moved relay server to `nodes/relay.js`, deployment script to `scripts/deploy-relay.sh`
- Impact: Cleaner separation between runtime nodes and deployment automation
- Insights: Democracy via Bash (relay scripts as succession instrument); Symmetry of Trust (plaintext justified by validation-only security)

[Legacy-0]: Philosophical Foundation & AGENTS Genesis

- Task: Document collective identity, protocol autonomy; establish self-improving knowledge architecture
- Implementation: Expanded Overall Concept with shared playerName semantics; open relay infrastructure; protocol-not-product framing; Critical/Tactical distinction; tiered conventions
- Impact: Protocol-as-game philosophy articulated; AI context initialization optimized; change boundaries established
- Insights: Collective Identity (playerName as shared credential); Immortal Software (open relay = no shutdown); Proof-by-Replay; Defense-by-Validation; KISS Resilience
