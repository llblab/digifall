# Digifall on-chain lifecycle v2

Status: target protocol design. It changes how moves receive randomness and how the client follows chain state; it does **not** change Digifall gameplay rules.

The mandatory performance budgets, threat model, invariants, client trust rules, and release gates are defined in the [safety and performance contract](on-chain-safety-performance.md).

## Product decision

The blockchain version preserves the web game's rule semantics:

- a fixed 6×6 board with values `0..=9`;
- the same initial energy and move cost;
- a move increments the selected card;
- the same exact-size orthogonal matching rule;
- the same falling, random replacement, recursive cascades, combo, scoring, and terminal conditions.

The Rust rule engine should remain parity-tested against the browser implementation. Protocol version 2 changes the source and timing of entropy: a player fixes a move first, later-block randomness is bound to that move, and only then is the unchanged game transition evaluated.

Browser replay and on-chain execution may use different record envelopes and validation mechanisms, but a given rule version must not silently produce different gameplay semantics. Any future rule change requires an explicit new `rules_version`; the lifecycle described here is a `protocol_version` change, not a new game.

## Lifecycle

Game creation and every move follow the same commit-before-randomness pattern:

```text
start_game or finalized Ready state at revision R
        │
        │ submit_move(game_id, R, card_index)
        ▼
block N: PendingAction is stored
        │ card choice and pre-state are fixed before entropy exists
        ▼
block N + D: sample the one scheduled entropy value
        │ initialize the board or resolve the committed move
        ▼
finalized Ready/Completed state at revision R + 1
```

For a prototype, `D = 1`: an action included in block `N` receives entropy in block `N + 1`. Production must select `D` from the security guarantees of the actual randomness provider. “Next block” is a scheduling choice, not by itself a fairness guarantee.

This is not a hidden commit/reveal scheme. The card index is public in block `N`, but the entropy used by its replacement and cascade sequence is not fixed until the scheduled sample. A player salt and second transaction do not hide the move from block producers and are unnecessary for this threat model.

## Preserving the rules with bounded execution

Randomness timing must not simplify the game. In particular, v2 must not replace card selection with column selection, remove refill, limit matching to the inserted card, or remove recursive cascades.

The consensus transition is equivalent to:

```text
resolve(pre_state, Increment(card_index), action_entropy, rules_version)
    -> post_state + resolution_summary
```

`action_entropy` initializes a deterministic per-action random stream used wherever the unchanged rules need replacement cards. Domain-separated counter expansion supplies additional values without sampling another block. Given the pre-state, move, rules version, and action entropy, every node computes exactly the same final state.

Cascade execution is bounded operationally, not removed from the rules:

1. `MaxTransitionsPerAction` is a protocol safety limit chosen above all valid playtested transitions.
2. If the benchmarked worst case fits the scheduled hook budget, resolution completes in block `N + D`.
3. Otherwise the pallet stores a deterministic `Resolving` cursor and the already sampled entropy stream position. Bounded hooks continue the same transition in later blocks without requesting new entropy or another player transaction.
4. The client treats `Resolving` as one pending move and replays the finalized transition locally for animation only after completion.
5. Reaching the safety limit is an invariant/protocol fault and enters `Recoverable`; it must not silently truncate a cascade or reinterpret the move.

Thus block execution stays bounded while the observable game result remains identical to an uninterrupted application of the rules.

## Authoritative state

One owner may have one live game:

```text
Game {
    game_id,
    protocol_version,
    rules_version,
    revision,
    board: [Card; 36],
    energy,
    score,
    high_combo,
    moves,
    status,
    optional_session,
    stake,
}

Status = AwaitingInitialEntropy { action_id, committed_at, resolve_at }
       | Ready
       | PendingMove {
            action_id,
            card_index,
            committed_at,
            resolve_at,
            pre_state_hash,
         }
       | Resolving { action_id, cursor, entropy_position }
       | Recoverable { reason }
```

`action_id` is monotonic within a game. `revision` changes only after a completed transition or explicit owner recovery action. `pre_state_hash` binds resolution to the exact board, counters, and economic state present when the move was accepted. Only one pending or resolving action is allowed, so moves cannot race or reorder.

Scheduled queues and active resolution queues are bounded per block. Calls fail before changing game state when the relevant target queue is full. Consensus storage contains no unbounded move history.

## Entropy binding

The domain-separated action seed is derived from:

```text
provider_entropy
|| genesis_hash
|| pallet_instance
|| protocol_version
|| rules_version
|| owner
|| game_id
|| action_id
|| committed_at
|| pre_state_hash
```

At `resolve_at`, the hook verifies all identifiers and samples exactly once. It never selects among later randomness epochs. If fresh entropy is unavailable, the game enters `Recoverable`; a retry must not substitute newer randomness.

Initial board creation is also a scheduled action. This prevents the owner from seeing a board and selectively accepting or discarding it without paying the protocol-defined consequence.

## Calls and events

Minimal call surface:

- `start_game(session?, stake, rules_version)` — commits game creation and schedules initial-board entropy.
- `submit_move(owner, game_id, expected_revision, card_index)` — accepts only `Ready`, a valid card, sufficient energy, and no pending action.
- `rotate_session(expected_revision, new_session?)` — owner recovery for a lost gameplay key.
- `forfeit(expected_revision)` — owner-controlled terminal action.
- `claim_refund(expected_revision)` — owner recovery from `Recoverable`, designed to work even if foreign pallets hold consumer references on the custody account.

Primary events:

- `GameCommitted { action_id, resolve_at }`
- `GameStarted { board_hash, revision }`
- `MoveCommitted { action_id, card_index, resolve_at }`
- `MoveResolutionStarted { action_id }` when chunking is necessary
- `MoveResolved { action_id, revision, action_seed, pre_state_hash, board_hash, score_delta, energy_delta, transitions }`
- `GameCompleted`
- `GameRecoverable`
- `GameRefunded`

The completion event stays compact. A client that retained the finalized pre-state replays the deterministic engine from `action_seed` to produce increment, match, fall, replacement, and combo animations, then verifies `board_hash`. A reconnecting client without the pre-state skips old animation and renders authoritative storage.

## Client protocol

The blockchain mode is added to the existing Svelte client as a selectable backend, reusing the same board, controls, styles, sounds, and effects. Polkadot API integration, backend switching, wallet/RPC ownership, lazy loading, and shared animation projection are specified in the [classic client backend architecture](game-backends.md).

### Client state machine

```text
Disconnected
Connecting
NoGame
CreatingGame / WaitingForInitialEntropy
Ready
SigningMove
MoveInPool
MoveIncluded
WaitingForEntropy
Resolving
Ready | Completed | Recoverable
```

“Transaction submitted” is not a completed move. The client may highlight the selected card after inclusion, but it must not predict replacement cards or commit score/energy animations before finalized resolution.

### Move flow

1. Subscribe to finalized heads, game storage, and game events.
2. Render the board and legal card interactions from the latest finalized `Ready` state.
3. On card input, lock controls and request a signature bound to chain/genesis context, owner, game ID, revision, card index, mortality, and nonce.
4. Show distinct `signing`, `in pool`, `included in block N`, `waiting for entropy`, and—if needed—`resolving cascade` states.
5. Keep all further moves disabled while `PendingMove` or `Resolving` exists.
6. On finalized `MoveResolved`, verify game ID, action ID, prior revision, replay the action seed against the retained pre-state, verify the board hash, then play the reconstructed trace using the existing Digifall animation vocabulary.
7. If events were missed, the tab slept, RPC changed, or a reorg occurred, cancel optimistic animation and rebuild from storage.
8. On `Recoverable`, stop automatic retries and show the owner recovery/refund action.

### Signing and fees

The first vertical slice uses normally paid owner-signed calls. Session keys can later improve mobile UX, but fee sponsorship is not required to validate the game loop.

If sponsorship returns:

- scope the session to one owner/game and expiry;
- authorize move submission only, never custody or recovery calls;
- admit at most one action while the game is `Ready`;
- store and decrement an explicit sponsored-action/weight budget when the action is admitted, even if later resolution fails;
- never treat nonce and revision alone as an economic bound.

### Client adapter

UI components depend on a narrow chain adapter rather than Polkadot.js/PAPI directly:

- `getGame(owner)` and `subscribeGame(owner)`;
- `getProtocolConfig()` and `getRules(rulesVersion)`;
- `startGame(options)`;
- `submitMove(gameId, revision, cardIndex)`;
- `subscribeAction(actionId)`;
- `recoverGame(revision)`;
- normalized signing, pool, inclusion, finality, replacement, and error updates.

Wallet selection, metadata upgrades, RPC failover, and light-client/full-node transport remain in the client composition layer.

## Failure and reorg behavior

- Duplicate or stale revisions fail without changing game state.
- Pending and resolving moves survive client disconnects and need no second player transaction.
- If block `N` is reorged out, the client returns to the finalized pre-move state.
- If the entropy or resolution block is reorged, optimistic animation is discarded and canonical finalized state wins.
- Missing freshness enters `Recoverable`; it never samples a later convenient block.
- Runtime upgrades must finish existing actions under their stored protocol/rules versions or offer an explicit fully refundable retirement path.

## Implementation slices

1. Lock browser/Rust parity fixtures for initialization, single moves, falls, replacement, cascades, combo, energy, score, and completion.
2. Add per-action entropy input to the engine without changing the rule transition outputs for equivalent random streams.
3. Implement scheduled initial entropy and `Ready → PendingMove → Resolving? → Ready/Completed/Recoverable` with mock deterministic entropy.
4. Benchmark complete and chunked resolution; choose queue and per-hook bounds without changing gameplay outcomes.
5. Build the finalized-state client adapter and a no-value local UI using the existing board and animation components.
6. Integrate a production randomness provider and choose `D` from its security properties.
7. Add custody/recovery and only then optional session sponsorship.
8. Benchmark and independently review the final runtime and economics before enabling value.

The detailed performance, security, adversarial-test, and operational acceptance criteria for these slices are normative in the [safety and performance contract](on-chain-safety-performance.md).

## Non-goals

- Changing Digifall rules merely to make the pallet easier to benchmark.
- Removing cascades, refill, energy, combo, or existing match semantics.
- Requiring a second reveal transaction from the player.
- Hidden moves against block producers without a separate cryptographic/privacy protocol.
- Calling an insecure next-block entropy source “fair” in production.
