# On-chain safety and performance contract

Status: mandatory design gates for the v2 lifecycle. This document does not change Digifall rules; it defines how the same rules execute safely and predictably in a bounded runtime.

## Objectives

The runtime must guarantee all of the following at once:

1. **Rule fidelity:** chunking, storage layout, and optimization never change the final board, energy, combo, score, or random replacement sequence.
2. **Bounded blocks:** no call or hook can consume unbounded CPU, proof size, storage reads/writes, or event bytes.
3. **Fixed entropy:** an action uses exactly the randomness epoch chosen before that entropy exists.
4. **Fault isolation:** one malformed or exhausted game cannot prevent other scheduled games from progressing.
5. **Recoverable value:** faults and upgrades have an idempotent owner recovery path that cannot strand stake.
6. **Client convergence:** after disconnects, RPC changes, and reorgs, the client can reconstruct the canonical state without trusting event history.

## Performance architecture

### Separate sampling from resolution

The scheduled hook has two responsibilities with separate budgets:

1. At the exact `resolve_at` block, consume at most `MaxSamplesPerBlock` bounded requests, validate their identifiers, sample the configured provider once per action, and store the derived `action_seed`.
2. Execute at most `MaxResolutionStepsPerBlock` deterministic engine steps across sampled actions.

If an action cannot finish inside the remaining resolution budget, it enters `Resolving` with its engine phase, transition counter, random-stream counter, and partial board state. Later hooks continue from that cursor; they never query randomness again. Sampling therefore remains tied to the promised epoch even when a resolution backlog exists.

Both queue capacities are compile-time bounds. `start_game` and `submit_move` reserve the target sampling slot before accepting the action. They fail atomically when the bucket is full.

### Fair scheduler

The active resolution queue uses bounded round-robin scheduling:

- each active action receives at most `MaxStepsPerActionPerBlock` before rotation;
- queue position is explicit storage, not a scan over all games;
- stale queue entries are removed in constant bounded work;
- a single long cascade cannot monopolize every block;
- the sum of per-action slices cannot exceed `MaxResolutionStepsPerBlock` or the runtime's reserved hook weight.

The scheduler charges the worst-case weight for every requested engine step. Early completion may return unused weight only when FRAME post-dispatch accounting supports the exact path safely.

### Storage and event budget

- Board and engine cursor types remain fixed-size and `MaxEncodedLen`.
- The pallet reads a game once at the start of its slice and writes it once after the slice; engine inner loops operate in memory.
- Queue buckets use bounded vectors and direct block-number keys. Runtime code never iterates `Games` or searches an unbounded history.
- Terminal summaries replace old games; move history belongs in events/indexers, not consensus storage.
- Events contain bounded summaries, hashes, and identifiers—not a full board snapshot for every cascade phase.

For animation, `MoveResolved` exposes the action seed (or a derivable public reference), pre/post board hashes, score/energy deltas, transition count, and final revision. A client with the finalized pre-state locally replays the deterministic engine to produce the existing animations and verifies the post-state hash. A client without the pre-state skips historical animation and renders authoritative storage. This avoids a potentially large on-chain animation receipt.

### Optimization order

Optimize only after parity tests exist, in this order:

1. Remove repeated storage decoding/writes inside one slice.
2. Use fixed arrays, bit masks, stack-local work queues, and integer arithmetic in the pure engine.
3. Cache values that are proven identical within a transition, such as occupancy/match masks.
4. Benchmark worst-case board shapes and cascade phases in Wasm.
5. Adjust safe queue/step constants from measured target-runtime weights.

Do not change match semantics, refill order, random-stream consumption, or cascade behavior as an optimization. Native speed alone is not evidence; production decisions use Wasm execution time and proof size.

## Security model

### Randomness and block producers

Commit-before-randomness prevents the player from choosing a card after seeing its random replacements, but it does not by itself stop a block producer from censorship or randomness manipulation.

Production activation requires a randomness provider whose unpredictability and bias-resistance assumptions are documented for the chosen network. `RandomnessDelay` must exceed the provider's lookback/finality requirement. Collective-flip and an arbitrary next-block hash are test sources only.

The action seed uses a cryptographic domain-separated hash over provider entropy, genesis hash, pallet instance, protocol/rules versions, owner, game ID, action ID, commitment block, and pre-state hash. Counter-mode expansion includes the action seed, counter, and draw domain (initial board or replacement column). No runtime path may accept a player-provided seed or resample after failure.

### Admission and replay protection

Every action binds:

- signer authority;
- owner and game ID;
- exact current revision;
- action ID;
- card index;
- target randomness block;
- rules/protocol versions;
- pre-state hash.

Only `Ready` games accept a move. There is at most one pending or resolving action. Stale, duplicate, wrong-game, wrong-session, out-of-range, and queue-full requests fail before economic or gameplay state changes.

One owner may hold one live game, and creating it requires the configured stake/deposit. This makes scheduled-queue occupancy economically attributable. Runtime governance caps per-block admission independently so a wealthy actor still cannot exceed reserved hook capacity.

### State invariants

Runtime assertions and tests preserve these relationships:

- every pending action has exactly one matching scheduled entry;
- every resolving action has one stored seed and no scheduled entry;
- `pre_state_hash` matches the immutable committed snapshot;
- a game revision advances once per completed action, never per chunk;
- transition and entropy counters never decrease or overflow;
- session-to-owner mapping is one-to-one and cleaned on every terminal path;
- escrow accounting equals refundable liability for all live games;
- terminal games have no scheduled/resolution entry or live session reference.

Hooks must not panic on corrupted state. They isolate the affected game as `Recoverable`, emit a bounded diagnostic event, remove its work item, and continue processing other games.

### Custody and settlement

- Custody operations and game-state changes are transactional.
- The custody account's provider/minimum balance is funded independently of refundable player escrow.
- Full refunds do not depend on reaping an account that foreign pallets can keep alive with consumer references.
- Reward mint failure cannot destroy the refund path.
- Recovery is idempotent: retrying cannot pay twice, consume another stake, or restore a completed game.
- `TotalEscrowed` is an asserted accounting invariant, not the source from which individual entitlement is inferred.

### Sessions and sponsorship

The safe initial client uses paid owner calls. If session sponsorship is enabled later:

- the session is scoped to one game, expires, and cannot call custody/recovery operations;
- admission decrements a stored sponsored-action/weight allowance before fee waiver;
- failed later resolution does not restore that allowance;
- exact-current nonce and revision remain replay protections, not the economic limit;
- both fee predicates and all account reads are included in generated extension weights.

### Runtime upgrades

Every stored game carries protocol and rules versions. Before an upgrade:

- `try-runtime` checks queue/game correspondence and escrow/session invariants;
- migrations are bounded or multi-block;
- in-flight actions either continue under their stored versions or become fully refundable;
- removed versions remain executable until no live game references them;
- generated metadata and client compatibility are tested before activation.

## Client reliability and security

These guarantees are implemented through the existing client's selectable backend boundary and Polkadot API adapter described in the [classic client backend architecture](game-backends.md).

- Signing payloads display the chain, game, revision, selected card, fee policy, and mortality; the UI never requests an opaque unlimited authorization.
- The adapter follows finalized heads for authoritative animation. Best-head information may improve latency but is visibly provisional.
- Events are hints. Storage plus runtime metadata is authoritative after reconnect, event loss, RPC replacement, or reorg.
- The client verifies action ID, previous revision, action seed/reference, and post-state hash before replaying animation.
- Runtime `spec_version`, protocol version, and supported rules versions are checked before enabling controls; unknown versions fail closed with read-only state and recovery guidance.
- Automatic retries stop on stale revision, unknown metadata, `Recoverable`, or repeated transport errors. The client never blindly resubmits a paid or sponsored move.
- RPC endpoints are replaceable. A production client should support a light-client/proof-verified path or clearly disclose when it trusts a remote RPC for state reads.
- Session secrets stay in platform-protected local storage where available, are never synchronized through P2P leaderboard storage, and can be rotated by the owner.

## Required validation

### Rule and engine tests

- Cross-language golden vectors for initial board, card increment, every phase, multi-cascade refill order, combo, energy, score, and completion.
- Property tests for board coordinates/values, monotonic counters, score arithmetic, cursor serialization, and equivalence of uninterrupted versus arbitrarily chunked resolution.
- Fuzz tests over seeds, legal moves, chunk sizes, decode boundaries, and maximum transition cases.
- A deterministic test proving that changing chunk size does not change random draws or final state.

### Pallet and runtime tests

- Queue-full admission rollback, maximum scheduled bucket, maximum active queue, round-robin fairness, stale entry cleanup, and one corrupt-game isolation.
- Reorg/replay model tests for game ID, action ID, revision, pre-state hash, and session rotation.
- Missing/stale randomness, runtime upgrade during pending/resolving states, and idempotent recovery.
- Adversarial custody tests with foreign consumers, no pot surplus, reward failure, and repeated recovery.
- Signed-extrinsic tests for payment, nonce, sponsorship allowance, failed dispatch, and weight accounting.

### Benchmark and release gates

- FRAME benchmarks cover maximum sampling, each engine phase, chunk resume/persist, queue rotation, successful completion, every recovery/settlement suffix, and transaction extensions.
- Generated weights come from the final runtime Wasm on representative production hardware and include proof-size regression review.
- CI runs formatting, locked tests, Clippy, pallet `no_std`, runtime tests, normal release Wasm, benchmark-enabled Wasm, and parity vectors.
- A stress test fills every bounded queue and demonstrates that block weight stays below the reserved maximum while unrelated extrinsics remain includable.
- Economic activation requires independent runtime-security and game-economic review after the final randomness, custody, reward, fee, and sponsorship composition is selected.

## Operational signals

Expose bounded events/metrics for queue occupancy, oldest resolution age, steps consumed, recoverable faults, randomness unavailability, settlement failures, and protocol/rules-version counts. Alert before queues saturate or resolution latency exceeds the client promise. Metrics are observational only and must never affect consensus decisions.
