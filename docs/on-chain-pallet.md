# On-chain Digifall pallet

Status: superseded v1 prototype; not connected to the web client or a production runtime.

> This document describes the checked-in implementation, not the target lifecycle. The target [on-chain v2 protocol](on-chain-game-v2.md) preserves these gameplay rules but commits initial creation and every card move before its scheduled entropy exists. Do not deploy v1 economics or randomness composition as the product protocol.

## Scope

`pallet-digifall` moves the deterministic game state machine into FRAME while retaining only the current game for each owner. It deliberately excludes move-history storage, leaderboard migration, oracle/indexer/off-chain-worker dependencies, and stake buyback or burn.

The pallet owns the game domain. Runtime composition supplies currencies, randomness, reward economics, call weights, and transaction-payment behavior.

## Lifecycle

```text
owner commit + stake
        │
        ▼
pending / awaiting scheduled reveal
        │ on_initialize(reveal_at): sample exactly once
        ├──────── unavailable ──────── owner cancel + full refund
        ▼
pending / fixed seed
        │ owner or delegated session activates
        ▼
active / preparing ⇄ resolving ────── delegated advance
        │ ready
        ├───────────────────────────── delegated play
        │ energy < move cost or move cap
        ▼
completed ── consume stake + mint reward

owner may rotate the session at any pending/active revision
owner may forfeit at any pending/active revision, consuming the stake
engine or reward-policy fault ──────── full stake refund
```

A commitment is scheduled for `committed_at + RandomnessDelay`. The bounded `ScheduledReveals` queue is consumed by `on_initialize`, which stores either one fixed seed or an unavailable marker. Activation never samples randomness, so waiting cannot select among later outputs. If the scheduled source is not fresh, the owner can cancel and recover the stake. A production runtime must choose `RandomnessDelay` to match the selected randomness source and benchmark the hook at `MaxRevealsPerBlock`.

## Stored state

- `Games`: at most one pending or active game per owner.
- `ScheduledReveals`: a bounded per-block queue of commitment IDs.
- `SessionOwners`: reverse authorization index for one scoped delegated account.
- `NextGameIds`: monotonic owner-local identity and stale-call separation.
- `TotalEscrowed`: amount in the pallet pot still refundable to live games.
- `LastResults`: only the latest terminal summary per owner.
- `CurrentStakeBounds`: root-managed minimum and maximum for future commitments.

The board is a fixed `[Card; 36]`; no move sequence or unbounded collection is stored.

## Deterministic engine

Rules version 1 preserves the current 6×6 stable-card model, values `0..=9`, 100 initial energy, 10 energy per move, exact-size orthogonal matches, deterministic falling/replacement, combo scoring, and completion after resolution when energy is below the move cost. Integer arithmetic and a fixed integer PRNG avoid host floating-point behavior.

The Rust tests include a seed-7 board/move fixture captured from the JavaScript core plus invariant, rollback, cascade, exhaustion, and execution-limit coverage. On-chain entropy is reduced to a `u64` before entering the versioned engine.

## Assets and settlement

`StakeCurrency` and `RewardCurrency` use FRAME fungible traits. A runtime may bind native balances or a selected `pallet-assets` item with `fungible::ItemOf`; the test runtime uses native stake and a separate reward asset.

- Commitment transfers stake to the pallet account with preservation.
- Normal completion leaves stake in the pallet pot and mints the runtime policy's `reward(stake, score)`, capped by `MaxReward`.
- Engine faults, rejected reward calculations, and reward mint failures refund the full stake transactionally.
- Forfeit consumes the stake without reward.
- Buyback/burn of consumed stake is intentionally not implemented.

Delegated session accounts receive a temporary FRAME sufficient reference. This allows nonce validation without a token balance and, unlike a provider reference, cleanup cannot fail because another pallet added consumer references. Because valid progress calls waive direct payment rather than decrementing escrow per extrinsic, the runtime's minimum-stake policy must economically cover the bounded worst-case sponsored weight budget.

## Fee-free session calls

Only correctly shaped `activate_game`, `play`, and `advance` calls signed by the stored session account can satisfy FRAME's `CheckIfFeeless` predicate. Each call binds the owner, monotonic game ID, revision, and bounded work request. Owner recovery calls and invalid, stale, wrong-game, or session-mismatched calls remain paid.

The runtime must replace standard `frame_system::CheckNonce` with the pallet's encoding-compatible `CheckNonceForDigifall`. Paid calls retain standard future-nonce pool behavior. A call that currently qualifies as fee-free must use the account's exact current nonce, receives explicit runtime-configured priority and short longevity, and therefore cannot chain many copies of one currently valid revision through future nonce dependencies. Reusing a reaped session account cannot replay an earlier game's call because every progress call includes the owner-local game ID.

The annotation alone does **not** waive payment. The runtime must also include `pallet-skip-feeless-payment` and wrap `ChargeTransactionPayment` with `SkipCheckIfFeeless`. Both the mock runtime and concrete Cumulus runtime exercise the combined nonce and payment behavior: one current valid move from an unfunded sufficient-reference account succeeds without payment, replay is rejected, and an unrelated call fails payment. The concrete test signs the full runtime extension payload, SCALE-round-trips the extrinsic, and applies it through `Executive`.

## Runtime configuration

A runtime must provide:

- fungible stake and reward adapters with the same balance type;
- a manipulation-resistant `Randomness<Hash, BlockNumber>` implementation;
- `RandomnessDelay` and bounded reveal capacity compatible with that source;
- minimum/maximum stake, with the minimum calibrated against the maximum sponsored call/weight budget, plus maximum reward and move/transition/step limits;
- a pure, checked `RewardPolicy`;
- benchmark-generated `WeightInfo` including worst-case reveal, resolution, and settlement paths;
- `CheckNonceForDigifall` in place of standard `CheckNonce`, followed by `SkipCheckIfFeeless<ChargeTransactionPayment>`;
- transaction-payment integration tests in the concrete runtime, preserving extension ordering and client metadata expectations.

## Parachain template verification

[`chain/runtime`](../chain/runtime/README.md) is a minimal Polkadot SDK 2606 Cumulus runtime with `ParachainSystem`, `Executive`, `UncheckedExtrinsic`, and `register_validate_block!`. It composes native stake, an asset-backed reward adapter, the custom nonce extension, the fee-skipping payment wrapper, scheduled randomness, and `pallet-digifall`. Native tests execute commitment, scheduled reveal, activation, custody, forfeit cleanup, full game completion, and asset reward minting through the concrete runtime types. They also apply SCALE-round-tripped signed extrinsics through `Executive` to verify the complete custom-nonce and fee-skipping extension tuple.

Its release build runs `substrate-wasm-builder` and produces a compact Wasm parachain validation runtime. The pallet's FRAME harness covers every declared weight path, scheduled reveal processing, the fee predicate, full successful queue insertion/removal, the larger active-session rotation branch, successful reward settlement, and engine-fault refund cleanup. Requested resolution budgets are charged conservatively by multiplying every requested step by the maximum of two one-step benchmarks: a valid board where all 36 cards match and fall, and a checkerboard with 18 exact singleton groups. `play` and `advance` then add both measured successful-settlement and fault-refund suffixes, conservatively covering a late terminal step and reward-mint failure in one dispatch. Activation starts at full energy and cannot complete normally during preparation; it adds the fault-cleanup suffix to its base and per-step charges. With `runtime-benchmarks` enabled, the validation runtime exports FRAME's `Benchmark` runtime API (plus its required `Core` and `GenesisBuilder` APIs) and registers `pallet-digifall`. The checked-in runtime weights were generated from that Wasm with `frame-omni-bencher` 0.23.0 using 50 steps and 20 repeats on an AMD Ryzen 7 4800H. They replace provisional weights for this integration runtime; the final randomness/reward composition must be benchmarked again on target production hardware.

The crate intentionally omits a node and uses collective-flip randomness only as an insecure integration placeholder; neither choice is a production claim.

## Current validation

```bash
cargo test --manifest-path chain/Cargo.toml --all-features
cargo test --locked --manifest-path chain/Cargo.toml -p pallet-digifall --features runtime-benchmarks
cargo check --manifest-path chain/Cargo.toml -p pallet-digifall --no-default-features
cargo clippy --manifest-path chain/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path chain/Cargo.toml -p digifall-template-runtime --lib
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release --features runtime-benchmarks
```

Mock-runtime tests cover stake bounds and custody, fixed scheduled entropy, failed-entropy cancellation, session authorization and rotation, game-ID/revision replay protection, bounded continuation, actual nonce/payment extension behavior for unfunded sessions, completion/reward minting, forfeit, consumer-safe session cleanup, engine-fault refund, and reward-mint-failure refund.

See [`BACKLOG.md`](../BACKLOG.md) for the remaining benchmark, randomness, and final economic-policy gates.
