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

- Card: Positioned game piece with value (0-9), coordinates, and animation state
  - See: [Card typedef](src/core.js#L8-L16)
- Game State: Reactive store collection (cards, energy, score, phase, moves, options)
  - See: [game object](src/stores.js#L94-L107), [INITIAL_VALUES](src/constants.js#L56-L93)
- Phase: Game loop state machine (initial → idle → plus → blink → match → fall → extra → combo → score → gameOver)
  - See: [PHASES enum](src/constants.js#L48-L58), [PHASE_LOGICS](src/core.js#L606-L617)
- Browser Seed: Deterministic PRNG root derived from playerName + timestamp
  - See: [getSeed()](src/core.js#L727-L739)
- Record: Validated game result with type, moves sequence, playerName, timestamp, and value
  - See: [GameRecord typedef](src/validation.js), [RECORD_TYPES](src/constants.js#L60)
- Relays Config: Atomically-managed relay state with active list and applied defaults tracking
  - See: [relaysStore](src/stores.js#L80-L85), [INITIAL_VALUES.relays](src/constants.js#L89-L93)
- UniQueue: Priority heap + unique key map for leaderboard deduplication and sorting
  - See: [@llblab/uniqueue](https://www.npmjs.com/package/@llblab/uniqueue)
- LeaderboardCore: Shared protocol logic class managing queues, root hashes, and handler factories
  - See: [@digifall/leaderboard](packages/leaderboard/index.js)
- libp2p Node: Browser-based P2P networking with relay transport and floodsub
  - See: [initP2PLeaderboard()](src/leaderboard.js#L139-L210)
- Relay Node: Server-side libp2p circuit relay + pubsub peer discovery
  - See: [nodes/relay/relay.mjs](nodes/relay/relay.mjs), [scripts/deploy-relay.sh](scripts/deploy-relay.sh)
- Leaderboard Node: Headless server-side leaderboard peer with persistent storage
  - See: [nodes/leaderboard/leaderboard.mjs](nodes/leaderboard/leaderboard.mjs), [data.json](nodes/leaderboard/data.json)
- On-chain Game v2: Target lifecycle with one owner-keyed board, revision, optional session, economics, and at most one pending card move; it preserves Digifall gameplay rules while binding each initialization/move to later-block entropy
  - See: [v2 protocol and client contract](docs/on-chain-game-v2.md)
- Scheduled Move: Bounded queue entry binding one public card choice and pre-state hash to exactly one later-block entropy sample; resolution preserves refill and recursive cascades and may be operationally chunked without new randomness
  - See: [v2 lifecycle](docs/on-chain-game-v2.md#lifecycle)
- On-chain Work Scheduler: Separate bounded sampling and round-robin resolution queues with explicit per-block/per-action budgets; one long or corrupt game cannot monopolize hooks or change its fixed entropy epoch
  - See: [safety and performance contract](docs/on-chain-safety-performance.md)
- Game Backend: Client-side capability contract selecting `classic` local execution or authoritative `chain` execution while projecting both into the existing board/energy/score/log/phase stores and visual components
  - Current foundation: generation-safe `GameController`, classic adapter, lazy fail-closed chain seam, persisted selector, and normalized status/interaction stores
  - See: [backend implementation](src/backends/controller.js), [classic client backend architecture](docs/game-backends.md)
- Chain Adapter: Lazy-loaded Polkadot API boundary owning typed runtime descriptors, RPC/provider lifecycle, wallet signing, finalized subscriptions, and chain-to-view projection; Svelte components never import chain infrastructure directly
  - Current foundation: injected adapter lifecycle, fail-closed startup, structurally validated authoritative snapshots, safe-integer projection, normalized board/energy/score/phase stores, classic view snapshot/restore, bounded card/revision/game-bound move submission, single in-flight admission, disconnect cleanup, and stale-generation suppression are implemented and unit-tested; concrete Polkadot API descriptors remain pending
  - See: [Polkadot API integration](docs/game-backends.md#polkadot-api-integration)
- On-chain v1 Prototype: Checked-in FRAME research implementation preserving browser mechanics; useful for determinism/runtime experiments but superseded as the product protocol
  - See: [v1 implementation contract](docs/on-chain-pallet.md), [review](docs/on-chain-review.md)

## 3. Architectural Decisions

### Critical (Core invariants - changes require architectural review)

- Shared Rule Semantics, Separate Execution: Browser records replay seeded web games, while on-chain v2 stores authoritative bounded state and supplies a fixed later-block entropy stream per action; the Rust engine must preserve board, move, match, fall/refill, cascade, combo, energy, scoring, and terminal semantics for the same rule version
  - Rationale: Block timing changes how randomness is committed and work is scheduled, not what Digifall's rules mean
  - See: [browser core](src/core.js), [Rust engine](chain/pallets/digifall/src/engine.rs)
- Validation Through Replay: Browser records are validated by re-executing the same seed and moves under a 3-second DoS timeout
  - See: [validateRecord](src/validation.js)
- P2P Leaderboard: Floodsub provides eventual consistency without consensus, trading global ordering for zero-authority operation and requiring relay infrastructure
  - Note: Floodsub is temporary—gossipsub may return when stable for libp2p v3
  - See: [leaderboard.js](src/leaderboard.js)
- Fixed On-chain Randomness: Each accepted v2 initialization or move fixes its action and target entropy epoch before randomness exists; resolution samples that epoch exactly once, expands a deterministic action stream for replacements/cascades, and never chooses among later outputs
  - Rationale: Freshness alone does not prevent timing-based outcome selection; a prototype may use the next block, but production delay follows the selected provider's security contract
  - See: [v2 entropy binding](docs/on-chain-game-v2.md#entropy-binding)

### Tactical (Implementation details - can evolve with justification)

- Plaintext Encryption: libp2p uses validation rather than transport secrecy as its trust boundary; leaderboard traffic is public and invalid records remain rejectable
  - See: [browser config](src/leaderboard.js), [relay config](nodes/relay/relay.mjs)
- Svelte 5 Runes: Modern reactive primitives simplify UI state at the cost of requiring Svelte 5+
- Single Browser Core File: Concentrating replay logic in `core.js` simplifies validation but trades away modularity
- Atomic Relay State: `{ active, applied }` enables idempotent default migration while preserving custom relays without persisting migration-only loads
  - See: [loadRelays()](src/stores.js), [relaysStore](src/stores.js)
- Shared Client, Swappable Backend: Classic and chain modes reuse the current visual tree and animation language; a composition-root controller owns backend activation, generation-based cancellation, and normalized stores, while chain dependencies load only when selected
  - See: [backend boundary](docs/game-backends.md#boundary-to-introduce), [backend switching](docs/game-backends.md#backend-switch-behavior)

## 4. Project Structure

- `/src/`: Application source code
  - `backends/`: Swappable game authority boundary; controller and classic adapter are active, while `chain/` is a lazy fail-closed seam pending Polkadot API descriptors/runtime
  - `core.js`: Pure deterministic game logic and phase state machine (~900 LOC)
  - `stores.js`: Svelte reactive state containers with .get() extension, relay state management
  - `leaderboard.js`: P2P sync protocol (root hash exchange, preview diffing)
  - `validation.js`: Record replay validation, player name sanitizing, and multiaddr validation
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
- `/chain/`: Standalone Rust workspace; `pallets/digifall` owns the `no_std` game domain and `runtime` is the minimal Cumulus composition/Wasm verification target
  - See: [chain README](chain/README.md), [template runtime](chain/runtime/README.md), [on-chain protocol](docs/on-chain-pallet.md)
- `/nodes/`: Server-side infrastructure (each node in own folder with colocated data)
  - `relay/`: Standalone libp2p circuit relay for NAT traversal
    - `relay.mjs`: Relay server implementation
    - `peerstore/`: Persistent peer identity (gitignored)
  - `leaderboard/`: Headless leaderboard node for bootstrapping peers
    - `leaderboard.mjs`: Node implementation with replay validation for inbound and persisted records
    - `data.json`: Persistent leaderboard storage (tracked in git for bootstrap/backup)
    - `peerstore/`: Persistent peer identity (gitignored)
- `/scripts/`: Deployment and operations automation
  - `deploy-relay.sh`: One-command relay deployment with systemd + SSL + certbot renewal hooks
  - `undeploy-relay.sh`: Clean removal of relay services, certificates, and user
  - `validate-records.mjs`: CLI validator for replay-checking leaderboard records from JSON files or stdin
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
- Validation Timeout: 3-second limit for replay prevents DoS through artificially long games
  - Rationale: Malicious peer could send infinite-length game record; game mechanics naturally constrain legitimate games well below timeout
  - Note: Game difficulty makes 1000+ move records practically unreachable before energy depletion
  - See: [createRecordValidator() timeout](src/validation.js)
- Replay-Compatible State Gates: Core phase/reset guards must not assume UI-only fields exist in validation runtimes
  - Rationale: `createRecordValidator()` constructs a minimal replay game object; broad falsy checks like `!game.ready` can freeze `initial → idle` and reject or hang valid records
  - Pattern: Check explicit UI gate states (`game.ready === false`) when absence should mean “not applicable”; run `timeout 10s npm run validate-records -- nodes/leaderboard/data.json` after core phase/reset/replay changes
  - See: [createRecordValidator()](src/validation.js), [doInitialPhase()](src/core.js)
- On-chain Boundedness Without Rule Changes: FRAME state and queues must be static; scheduled hooks have explicit work bounds, while operational chunking preserves the full cascade result using one stored entropy stream and deterministic cursor
  - Pattern: Never remove refill/cascades or alter matching to satisfy a weight target; sample once at the scheduled epoch, continue without fresh entropy when needed, and generate benchmark weights before economic activation
  - See: [v2 bounded execution](docs/on-chain-game-v2.md#preserving-the-rules-with-bounded-execution)
- On-chain Fault Isolation and Recovery: Queue admission reserves bounded capacity, hooks isolate corrupt games instead of panicking, custody keeps provider funding separate from refundable escrow, and recovery is idempotent across failures and upgrades
  - Pattern: Test queue saturation, scheduler fairness, chunk equivalence, stale entries, foreign consumers, reward failure, and in-flight migrations before economic activation
  - See: [security model](docs/on-chain-safety-performance.md#security-model), [required validation](docs/on-chain-safety-performance.md#required-validation)
- Sponsored Session Transactions: Every progress call binds owner, game ID, revision, and work bound; fee-free runtime composition replaces standard `CheckNonce` with the strict-current nonce wrapper and wraps transaction payment with `SkipCheckIfFeeless`
  - Rationale: Revision checks stop dispatch replay, while exact-current nonces stop future-nonce copies of one valid revision from chaining in the pool

### Infrastructure (Node Operations)

- Idempotent Deployment: Relay setup must be single-command, creating systemd services and SSL certs automatically
  - Rationale: Radical simplification allows non-technical users to host relays, preventing centralization
  - See: [scripts/deploy-relay.sh](scripts/deploy-relay.sh)
- Early Rejection: Validate record constraints (moves length, field types) before expensive replay
  - Rationale: O(1) rejection of malformed records prevents DoS via crafted payloads
  - See: [MAX_MOVES_LENGTH](src/constants.js#L9), [createRecordValidator()](src/validation.js)
- Symmetric Deploy/Undeploy: Both scripts support interactive and non-interactive modes for deb/rpm systems
  - Rationale: Automated CI/CD pipelines need non-interactive; manual ops need confirmation prompts
  - See: [deploy-relay.sh](scripts/deploy-relay.sh), [undeploy-relay.sh](scripts/undeploy-relay.sh)
- Environment-First Configuration: Server nodes read `DIGIFALL_RELAYS` env var before falling back to hardcoded defaults
  - Rationale: Enables staging/prod separation, custom relay testing without code changes
  - See: [parseRelaysFromEnv()](nodes/leaderboard/leaderboard.mjs#L28-L35)
- Deployment Runtime Validation: Relay deployment must validate both Node.js and npm before installing app dependencies
  - Rationale: Distros can provide a usable `node` binary without `npm`; systemd units should use resolved absolute runtime paths
  - Pattern: Keep curl-installed lifecycle scripts self-contained; duplicate shell helpers intentionally when single-file bootstrap reliability matters more than DRY; respect an existing Node.js runtime and install the current stable NodeSource major only when no `node` is available; refresh npm to the latest stable release after runtime detection/installation; fail deployment if the resolved npm runtime cannot keep the relay alive as the `digifall` service user
  - See: [ensure_node_runtime()](scripts/deploy-relay.sh)
- CI Toolchain Parity: Keep GitHub Actions Node/npm aligned with the local lockfile-generating toolchain
  - Rationale: npm 10 and npm 11 serialize optional peer dependencies differently; mismatched npm majors can make `npm ci` reject an otherwise valid lockfile
  - Pattern: Build/deploy workflow uses Node 24/npm 11; if CI Node changes, regenerate and validate `package-lock.json` with that npm major
- Android Target SDK: Apply API-level requirements after Bubblewrap project generation
  - Rationale: Bubblewrap exposes minimum SDK but hardcodes target SDK in its generated Gradle template
  - Pattern: Run `android/configure-sdk.mjs` after `bubblewrap update`; keep compile and target SDK aligned and preserve the generated minimum SDK
- Git-Tracked Bootstrap Data: Leaderboard `data.json` committed to repo for disaster recovery and new node bootstrap
  - Rationale: P2P network may be empty; git provides backup and historical record of leaderboard evolution
  - Trade-off: Manual commits required to update backup (acceptable for low-frequency changes)
  - Constraint: Bootstrap data must pass `npm run validate-records -- nodes/leaderboard/data.json` before commit
- Release Note Ordering: Version sections in `CHANGELOG.md` must list the most player-visible and user-important changes first, then operational/CI/internal details
  - Rationale: Android release notes are generated from the current changelog section; Google Play truncates `whatsnew-*` text to 500 Unicode characters, so the first bullets become the public store copy
  - Pattern: Start with gameplay, compatibility, platform availability, fixes, and user-facing behavior; put build automation, docs, safety, and refactors later
  - See: [Release flow notes](docs/release-flow.md#release-notes)
- Release Workflow Idempotence: Published version rewrites must not re-upload the same Android versionCode
  - Rationale: Google Play rejects replacing an already published APK; release-commit amend/force-push workflows must detect `vX.Y.Z` already pointing at `HEAD` and skip publish unless manually forced
  - Pattern: Keep version-bump detection, tag guards, and full workflow `run-name` labels consistent across `.github/workflows/*`
  - See: [Release flow lever](docs/release-flow.md#release-lever)

### Recommended (Performance and maintainability)

- Phase-Driven Animation: All visual timing derives from phase transitions and duration calculations
  - Rationale: Keeps animation synchronized with deterministic game state
  - See: [checkRapid()](src/core.js#L138-L151)
- Game Surface Owns Touch Gestures: Long-press gameplay zones must suppress browser-native selection/callout/scroll gestures at both CSS and event-listener boundaries
  - Rationale: Mobile Safari can otherwise treat a long tap as text selection or callout instead of the game action; touch listeners that call `preventDefault()` must not be passive
  - Pattern: Scope suppression to the board/card surface, keep the state machine unchanged, and avoid global overrides that break form controls or overlays
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
  - See: [constants.js](src/constants.js#L1-L5)
- Relay Fallback: Automatic relay switching on connection failure with 73-second retry interval
  - See: [restoreRelay()](src/leaderboard.js#L125-L137)

### Store Architecture Principles

- Backend-Neutral View Stores: UI stores describe renderable game state and interaction capability, not its authority source; classic core and chain projection update them through the active backend controller
  - Rationale: Reuses the exact Svelte visuals/effects without allowing components to call Polkadot API or conflate local persistence with authoritative chain state
  - Pattern: Route card intent through `gameController.selectCard(index)`; isolate classic and chain durable state; discard callbacks from inactive backend generations
  - See: [backend contract](docs/game-backends.md#backend-contract)
- Fail-Closed Chain Projection: Treat RPC/runtime snapshots as untrusted input before they reach shared stores; validate lifecycle, fixed board shape, coordinates, card values, identifiers, and safe display ranges, and disable gameplay on any mismatch
  - Rationale: JavaScript number coercion can silently corrupt large SCALE integers, while malformed or incompatible runtime state must never become a signable client intent
  - See: [chain snapshot validation](src/backends/chain/validation.js)
- Separation of Concerns: `stores.js` declares stores only; `persistence.js` provides generic utilities; business logic lives in components or domain modules
  - Rationale: Prevents circular dependencies, keeps persistence layer reusable
  - Pattern: Load functions passed to store factories, not embedded in persistence.js
- Derived Store Chains: Use derived stores for computed values (e.g., `relaysStore` → `activeRelaysStore` → `relayPeerIdsStore`)
  - Rationale: Automatic reactivity without manual change detection
  - Anti-pattern: Manual `prevValue` tracking in subscriptions
- Idempotent Migration: Relay migration runs on every load without persisting until user action
  - Rationale: localStorage is source of truth only when it differs from defaults; migration is cheap and deterministic
  - Pattern: `load()` transforms data, `save()` happens only on explicit `set()`/`update()`
- LocalStorage as Cache: Client persistence must degrade to in-memory stores when localStorage is unavailable, full, private-mode restricted, or contains invalid JSON
  - Rationale: Mobile Safari can throw on storage reads/writes; gameplay must continue because local persistence is not part of deterministic validation
  - Pattern: Catch storage failures at persistence boundaries, keep reactive store updates synchronous, and reuse safe JSON loaders for custom migrations
- Personal-Best Leaderboard Sync: localStorage personal records must be replay-validated and queued into the IndexedDB leaderboard without phase gating
  - Rationale: highCombo is saved during combo resolution; idle/gameOver-only sync can strand a valid local best until the user beats it again
  - Pattern: Add record type on a copy, call `LeaderboardCore.handleRecordWithValidation()`, then persist updated leaderboard snapshots

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
- Public Dependency Surfaces: Shared protocol packages must consume dependency APIs through documented methods and compatibility shims before falling back to historical internals
  - Rationale: Deployed nodes can run stale dependency builds; `getQueueSnapshot()` supports current `snapshot()` and older iterable/data-based `@llblab/uniqueue` instances

## 6. Pre-Task Preparation Protocol

- Step 1: Review affected entity definitions in section 2 (Core Entities)
- Step 2: Verify alignment with determinism and P2P sync constraints (section 3)
- Step 3: Check relevant conventions from section 5 for implementation patterns
- Step 4: Identify knowledge gaps requiring context enhancement post-task

## 7. Task Completion Protocol

- Step 1: Verify architectural consistency (no non-deterministic operations in core.js)
- Step 2: Execute quality validation: `npm run check` (svelte-check) and `npm run lint` (stylelint)
- Step 3: Update affected Core Entities (section 2) if data structures changed
- Step 4: Sync root context by responsibility:
  - `AGENTS.md`: durable rules, conventions, architecture, reusable constraints
  - `BACKLOG.md`: open, blocked, gated, or next work only
  - `CHANGELOG.md`: completed delivery history only
  - `README.md` and subtree README files: human navigation and usage entrypoints
- Step 5: Size Management (if AGENTS.md exceeds 300 lines):
  - Trigger garbage collection phase
  - Move completed-delivery history to `CHANGELOG.md`
  - Preserve architectural decisions, rationale, philosophical foundations, and active conventions
  - Remove implementation minutiae superseded by code, resolved open questions, and dated references
