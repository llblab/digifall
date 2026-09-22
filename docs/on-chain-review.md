# On-chain implementation review

Review date: 2026-09-22. Scope: the standalone `chain/` workspace at the current branch head, including the deterministic engine, FRAME lifecycle, transaction extensions, template runtime, benchmarks, generated weights, tests, documentation, and pull-request validation. This is an engineering review, not an independent security audit.

## Verdict

The implementation is useful **v1 research**, but it is **not the target product protocol** and is not ready for a public testnet with economic value or for mainnet.

The design already addresses unusually difficult protocol concerns: game state is bounded, automatic transitions are resumable, arithmetic is checked, randomness is sampled once after commitment, stake/reward adapters are separated, session calls bind game ID and revision, and the concrete runtime exercises signed fee-free extrinsics. The package boundary is also coherent: the engine owns deterministic rules, the pallet owns lifecycle/custody, the extension owns nonce admission, and the runtime is the composition root.

The primary architectural change is lifecycle-only. The [v2 target](on-chain-game-v2.md) preserves browser gameplay semantics, commits a card choice before its action entropy exists, and resolves the same refill/cascade transition after the scheduled sample. Bounded hooks may split consensus work across blocks, but must not simplify the rules or draw new entropy. The custody, sponsorship, and weight findings below remain constraints for v2. There is also no production randomness/economic policy, deployable node, client integration, or Rust CI gate yet.

## Architectural finding

### A-01 — Randomness lifecycle and game rules must remain separate (blocking)

The existing engine's board, energy, card increment, matching, cascading refill, combo, scoring, and completion semantics are product rules and remain authoritative. They must not be discarded to obtain a smaller weight bound.

V2 changes the surrounding protocol: initial board creation and every card move are committed before a uniquely scheduled entropy sample. The sampled value initializes a deterministic replacement stream; the unchanged cascade may complete in that hook or continue from a stored cursor over bounded later hooks. The client observes one pending action throughout.

## Implementation findings retained as v2 constraints

### F-01 — Refund can be blocked by a foreign asset consumer (high)

Both `cancel_pending` and `settle_fault` transfer the full refundable native stake out of the pallet account with `Preservation::Expendable` before cleanup. In the template runtime, an ordinary signed account may create an asset. A foreign, non-sufficient asset account can therefore add a consumer reference to the deterministic pallet account. If the native stake is the account's last provider balance, the refund then fails with `Token(Frozen)` because the account cannot be reaped while the consumer remains.

The dispatch is transactional, so funds are not lost, but the promised recovery path does not complete: the game, escrow liability, and session sufficient reference remain live. The defect affects missed/unavailable-randomness cancellation and reachable fault settlement, including reward-mint failure. Review harnesses established both affected paths and controls; these cases still need permanent regression tests.

Required remediation:

1. Fund the pot's provider/minimum-balance requirement independently of refundable escrow, or choose custody semantics that work for every configured `StakeCurrency` implementation.
2. Preserve the full refund promise; do not subtract existential funding from player stake.
3. Retain concrete-runtime regressions for cancellation and terminal fault with a foreign consumer and no consumed-stake surplus.

### F-02 — Fee predicate is evaluated twice but only benchmarked once (medium)

`CheckNonceForDigifall::validate` calls `RuntimeCall::is_feeless` and charges `check_nonce_for_feeless()`. Later, `SkipCheckIfFeeless::validate` calls the same predicate again, while its `weight()` only forwards the wrapped payment extension's weight. The pallet benchmark measures a single direct predicate evaluation. Consequently, the transaction extension tuple performs two game/session storage lookups per predicate evaluation but declares only one custom predicate weight.

This is a deterministic undercharge rather than an unbounded algorithm, but it invalidates the current claim that generated weights cover the complete sponsored pipeline. The final composition must either avoid the duplicate stateful predicate or benchmark and charge both evaluations, then regenerate weights.

### F-03 — Failed fault settlement can remain fee-free for repeated fresh nonces (high, coupled to F-01)

The fee-free predicate depends on the stored session, game ID, revision, call shape, and step budget. A transaction nonce is consumed during transaction-extension preparation even when dispatch subsequently fails. When F-01 makes `settle_fault` fail transactionally, the game revision is restored unchanged; a newly signed call with the session account's next exact nonce can therefore qualify as fee-free again.

This does not permit replay of the identical signed extrinsic and requires control of the delegated session key, but it defeats the intended economic bound on sponsored work: repeated fresh-nonce attempts can continue while the refund blocker remains. Remediation must make the terminal recovery path infallible or add an explicit bounded sponsorship budget/terminal quarantine. Retain an `Executive::apply_extrinsic` regression that checks dispatch result, nonce, revision, balances, and cleanup across failure and retry.

## Readiness by area

| Area | Assessment | Evidence / next gate |
| --- | --- | --- |
| Deterministic engine | Strong | Fixed-size board, integer PRNG, checked counters, bounded transitions, JavaScript parity fixture, and rollback/invariant tests. Add more differential/property testing before protocol freeze. |
| State boundedness | Strong | One owner slot, bounded reveal queues, fixed board, no move history, explicit step budgets. |
| Randomness design | Good design, placeholder source | Scheduled one-shot post-commit sampling prevents activation-time epoch shopping. Replace collective-flip and calibrate delay against the production source. |
| Custody/settlement | Blocked | F-01 violates the full-refund recovery guarantee. Fix and retain adversarial runtime tests. |
| Sponsored calls | Promising, blocked | Game ID/revision and strict-current nonce are good replay controls. F-02 and F-03 prevent economic activation. |
| Weights | Template-quality only | Generated Wasm weights exist, but F-02 requires correction and regeneration for the final runtime/hardware. |
| Runtime integration | Prototype | Concrete Cumulus/Wasm composition exists; randomness and reward policy explicitly remain placeholders, and no node is delivered. |
| Client/product integration | Not started | The web game is not connected to the pallet; there is no wallet/session UX or end-to-end environment. |
| CI/release safety | Incomplete | Pull-request validation runs only the JavaScript/Android checks; Rust format, tests, Clippy, `no_std`, and Wasm build are absent. |

## Recommended order of work

1. Lock browser/Rust parity fixtures for all rule paths, especially multi-cascade replacement sequences.
2. Implement scheduled per-action entropy around the existing rules with `AwaitingInitialEntropy → Ready → PendingMove → Resolving? → Ready/Completed/Recoverable`, then build its finalized-state client flow.
   Apply the separate sampling/resolution budgets, fair scheduler, fault isolation, and validation gates from the [safety and performance contract](on-chain-safety-performance.md).
3. Carry F-01 into the custody design and make recovery independent of externally created consumer references.
4. Keep direct paid owner calls first; if sponsorship returns, give it an explicit stored budget and correct F-02/F-03 rather than relying on nonce/revision as an economic bound.
5. Add locked Rust tests, formatting, Clippy, `no_std`, and release Wasm construction to pull-request CI.
6. Select production randomness, delay, economics, and target network; benchmark and independently review the final composition before enabling value.

## Validation snapshot

At review time, `cargo test --locked --manifest-path chain/Cargo.toml --all-features` passed the repository suite (50 passed, 2 ignored). The benchmark generator was intentionally not run because it overwrites checked-in weights. Frontend checks require installed npm dependencies and are not evidence about the Rust findings above.
