# Classic client backend architecture

Status: active implementation design. The controller, classic wrapper, persisted Options switch, generation cancellation, normalized status, and lazy chain module are scaffolded. Chain snapshots are structurally validated before projecting board/energy/score/phase into shared stores, and classic view state is captured/restored across switches. The chain module owns an injected connect/disconnect/projection/submission lifecycle and fails closed without an adapter or on invalid authoritative state; concrete pinned Polkadot API descriptors and the target v2 runtime remain pending.

## Product shape

The existing client gets a `classic | chain` backend switch in Options. Both modes reuse the same `Game`, `Board`, `Card`, `Energy`, `Score`, `Log`, sounds, keyboard/touch controls, responsive layout, and phase-driven animation components.

The switch does not fork the UI and does not create a second blockchain-themed frontend:

- `classic` runs the current local deterministic engine, local persistence, record replay, and P2P leaderboard behavior;
- `chain` treats finalized blockchain storage as authoritative, submits card moves through a wallet, waits for scheduled entropy/resolution, and locally reconstructs the same visual phase sequence from the finalized action seed;
- backend-specific connection, wallet, transaction, and recovery status appears in the existing visual language rather than replacing the board.

Games are not migrated when the switch changes. A classic run stays in classic local storage; a chain game stays under its owner account on-chain. Switching away suspends the current controller and switching back resumes/reconciles its own game.

## Boundary to introduce

Today `Board.svelte` directly imports the singleton `game`, stores, and core helpers, and starts a local move by writing `plusIndexStore`. Before adding chain calls, move authority must be extracted behind one client-side contract while rendering stores remain shared.

```text
Svelte components
    │ render shared view stores
    │ call gameController.selectCard(index)
    ▼
GameController (composition root)
    ├── ClassicBackend ── current core + persistence + P2P records
    └── ChainBackend ──── Polkadot API adapter + wallet + local visual replay
```

Svelte components must not import Polkadot API, runtime descriptors, RPC providers, or wallet implementations. The controller owns backend activation and publishes a normalized view model.

## Backend contract

The smallest useful contract is capability-based:

```ts
type BackendKind = "classic" | "chain";

type GameBackend = {
  kind: BackendKind;
  capabilities: {
    wallet: boolean;
    p2pLeaderboard: boolean;
    onChainRecovery: boolean;
  };
  start(context): Promise<void>;
  stop(): Promise<void>;
  newGame(input): Promise<void>;
  selectCard(index): Promise<void>;
  forfeit(): Promise<void>;
  recover(): Promise<void>;
};
```

Backend methods represent intentions, not UI mechanics. A backend updates normalized stores such as:

- `backendStore`: selected kind;
- `backendStatusStore`: disconnected, connecting, ready, signing, in-pool, included, waiting-entropy, resolving, recoverable, error;
- existing board/energy/score/log/phase stores used by visual components;
- `interactionStore`: whether card selection/menu actions are currently legal;
- `backendIdentityStore`: classic player name or chain/network/account presentation;
- `backendCapabilitiesStore`: which menu actions and leaderboards are meaningful.

The classic backend initially wraps existing behavior without rewriting the core. The chain backend writes visual stores only through a dedicated projection/replay layer; it never makes chain state depend on those stores.

## Backend switch behavior

`optionsStore.backend` persists `"classic"` by default. Options renders a two-value selector using the current checkbox/button styling. Selecting `chain` reveals network, endpoint, wallet/account, and connection controls as suboptions.

Switching follows an explicit sequence:

1. Disable board input.
2. Increment a controller generation token and abort all subscriptions/async work owned by the old generation.
3. Call the old backend's `stop()` and detach listeners.
4. Clear transient focus, match masks, pending animation timers, and backend status—but not either backend's durable game.
5. Dynamically load and start the selected backend.
6. Reconcile its authoritative state before enabling input.

Every async callback captures the generation token. Results from a stopped backend are discarded, preventing a late RPC event from overwriting a resumed classic game.

Changing backend during `SigningMove`, `MoveInPool`, or a non-final chain action requires confirmation. The transaction is not cancelled by leaving the screen; returning to chain mode reconciles by owner/game/action ID. The UI must say this explicitly.

## Polkadot API integration

The chain adapter uses [Polkadot API](https://github.com/polkadot-api/polkadot-api) as its only runtime/RPC API boundary.

### Package and generated contract

- Pin `polkadot-api` and the selected provider/signer integration versions in `package-lock.json`.
- Generate typed descriptors from the exact target runtime metadata during development/CI; commit the descriptor configuration and lock the generated package/version according to the tool's supported workflow.
- Expose only a small Digifall facade from `src/backends/chain/`; the rest of the client does not depend on generated runtime types.
- At connection time verify genesis/chain identity, runtime `spec_version`, pallet presence, protocol version, and supported rules versions before enabling writes.
- A metadata/runtime mismatch fails closed into read-only status with upgrade/recovery guidance.
- Every decoded game snapshot is untrusted until its lifecycle, unsigned identity/revision, fixed board shape, unique bounded coordinates, digit values, and displayable energy/score ranges pass the client boundary validator. Unsafe SCALE integers are rejected rather than silently rounded through JavaScript `Number` conversion.

Exact Polkadot API method names are pinned when the dependency is introduced and verified against that version's generated types; this document intentionally specifies the owned boundary rather than copying an unstable library surface into UI code.

### Composition

```text
src/backends/
  controller.js             # selects backend, owns generation/abort lifecycle
  contract.js               # normalized backend/view contracts
  classic.js                # wraps current local engine and persistence
  chain/
    index.js                # dynamically imported ChainBackend
    papi.js                 # creates/disposes Polkadot API client + typed API
    descriptors.js          # narrow access to generated Digifall descriptors
    wallet.js               # signer/account port
    projection.js           # chain storage/events -> normalized state
    replay.js               # action seed + pre-state -> visual phase trace
```

The Polkadot API client and provider are singletons per active chain backend. `stop()` unsubscribes all observables/listeners and destroys provider resources. Reconnect uses bounded exponential backoff with jitter only for transport; it never automatically signs or resubmits a transaction.

### Transport

The first integration may use a configured WebSocket RPC provider through Polkadot API. Endpoint configuration is distinct from the P2P relay list. A later light-client provider can replace WebSocket inside `papi.js` without changing `ChainBackend` or Svelte components.

RPC state is treated as trusted unless the selected provider verifies proofs. The UI exposes network/endpoint identity and does not present an unverified remote RPC as trustless.

### Wallet and transactions

The wallet adapter exposes account discovery and a signer compatible with the pinned Polkadot API release. It never leaks extension/provider objects into components.

For `submit_move`, the adapter:

1. reads finalized game ID/revision and confirms `Ready`;
2. builds the typed call with owner, game ID, revision, and card index;
3. presents network, account, selected card, fee/fee-waiver state, and mortality to the user;
4. tracks signing, pool, inclusion, replacement, invalidation, and finality as separate states;
5. records the included action ID and waits for authoritative storage/event reconciliation;
6. never blindly retries or signs a replacement transaction.

## Shared animation pipeline

The same visual effects are retained by separating authoritative calculation from presentation:

### Classic

The local core continues emitting its existing phase/store changes immediately.

### Chain

1. Cache the finalized pre-move state.
2. After inclusion, highlight/lock the selected card and show waiting status without predicting random replacements.
3. On finalized `MoveResolved`, obtain the public action seed/reference and final board hash.
4. Run the parity-locked Rust/JavaScript transition replica locally from the cached pre-state, selected card, and action seed to generate a visual trace.
5. Feed that trace through the existing plus → blink → match → fall → extra → combo → score animations.
6. Verify the locally computed final hash against the chain result before publishing the final visual state.
7. On mismatch, cancel animation, render authoritative chain storage, disable further moves, and surface a client/runtime compatibility error.

The replay is presentation only. A compromised or buggy client cannot change consensus outcome.

If the tab reconnects without the pre-state or misses the completion event, it skips the historical animation and renders current finalized storage. Correct state is more important than reconstructing effects.

## Shared UI details

- Keep the board geometry, card components, colors, random-color treatment, sounds, rapid mode, focus navigation, and touch behavior identical.
- Add a compact backend/network indicator near the existing Digifall header; it must not cover board interaction.
- Map transaction lifecycle into the existing `Log` area: `sign`, `included`, `waiting entropy`, `resolving`, `finalized`, or actionable error.
- In chain mode, card input is enabled only in finalized `Ready`; menus and owner recovery remain accessible while a move is pending.
- `rapid` may shorten finalized replay animation but cannot skip chain waiting or make an unfinalized board look authoritative.
- The classic P2P leaderboard remains a classic capability. Chain results are not silently published into it; a chain leaderboard/view is added only with explicit provenance and comparison policy.

## Performance

- Dynamically import the complete chain backend so Polkadot API, descriptors, provider, and wallet integration do not increase the initial classic bundle.
- Request/subscribe only to the active owner game, relevant finalized events, runtime version, and connection health; do not scan global game storage.
- Coalesce multiple chain notifications for the same finalized block into one projection update.
- Keep authoritative state and animation trace separate so large transient traces are released after animation.
- Cache metadata/descriptors through the normal service-worker strategy only when keyed by genesis/spec version; never use stale descriptors for signing.
- Measure classic initial bundle, lazy chain chunk, time-to-ready, reconnect traffic, and animation replay cost in CI or release profiling.

## Reliability and security

- Classic and chain durable state use separate persistence keys; chain storage remains authoritative.
- Backend selection is local preference, not part of deterministic gameplay or a signed record.
- All subscriptions, timers, providers, and wallet listeners are owned and disposed by the active backend generation.
- Unknown chain, metadata, protocol, or rules version disables signing and card input.
- Finalized storage wins over optimistic UI, events, cached replay, and best-head data.
- Account changes immediately disable pending signing UI and trigger owner/game reconciliation.
- Session secrets are never placed in Svelte/localStorage stores used by classic persistence or P2P sync.
- Sanitized user-facing errors do not expose seed material before it is public, wallet internals, or RPC credentials.

## Test contract

### Shared backend contract tests

Run the same behavioral suite against `ClassicBackend` and a deterministic `ChainBackend` fixture:

- start/stop is idempotent;
- only legal `Ready` state accepts card input;
- one input creates one backend action;
- switching disposes the old generation and late callbacks are ignored;
- reconnect rebuilds view state from the backend authority;
- game-over and recovery disable normal moves;
- visual stores satisfy the same component invariants.

### Chain adapter tests

- Generated descriptors type-check against the pinned runtime metadata.
- Mocked Polkadot API streams cover disconnect, reconnect, event loss, reorg, transaction replacement, stale revision, runtime upgrade, account switch, and unsupported version.
- Local visual replay matches cross-language parity vectors and the finalized board hash for multi-cascade moves.
- No move is automatically re-signed after transport or dispatch failure.
- Dynamic import tests prove classic startup does not load the chain chunk.

### End-to-end gate

Against a local chain, exercise: select chain backend → connect wallet → create game → wait for initial board → select a card → sign → include → wait for entropy/resolution → replay existing effects → verify finalized state → reload/reconnect → switch to classic and back → recover/forfeit.

## Delivery order

1. Extract the backend contract and wrap current behavior in `ClassicBackend` with no visual change.
2. Add the Options switch, lifecycle disposal, status stores, and a fake deterministic `ChainBackend`.
3. Add lazy Polkadot API client/descriptors and read-only finalized projection.
4. Add wallet signing and move transaction lifecycle.
5. Add finalized local replay into existing animations and hash verification.
6. Add recovery, runtime-version handling, reconnect/reorg tests, bundle budgets, and local-chain end-to-end coverage.
