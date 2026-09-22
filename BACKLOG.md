# Backlog

Canonical open-work file for Digifall. Completed delivery history lives in [CHANGELOG.md](CHANGELOG.md); durable project protocol lives in [AGENTS.md](AGENTS.md).

## Active

- [ ] `Digifall on-chain pallet`: Finish independent review and harden the delivered kernel before testnet integration and economic activation
  - Handoff baseline: Branch `bc`, implementation commit `0eaa806` (`feat(chain): add on-chain Digifall pallet`). Engine, FRAME lifecycle, sponsored extensions, Cumulus template, Wasm builds, and measured template weights are delivered; see [delivery history](CHANGELOG.md#unreleased), [workspace](chain/README.md), and [protocol contract](docs/on-chain-pallet.md). The follow-up review has not changed implementation or repository tests; no final review verdict has been issued
  - Scope: Finish review before remediation. Keep browser gameplay/P2P unchanged during hardening; preserve bounded state, deterministic transitions, fixed scheduled randomness, configurable currencies, and owner/session separation. Buyback/burn remain out of scope; deployment and publication require separate authorization
  - [ ] `Review closure`: Resolve the remaining questions against the concrete runtime rather than relying on previous approvals
    - Confirmed finding: `cancel_pending` and `settle_fault` in `chain/pallets/digifall/src/lib.rs` cannot refund the last stake when the native pot has no surplus and a non-sufficient foreign asset holds a consumer reference. Ordinary signed `Assets::create`/`mint` calls can create that reference; the refund returns `Token(Frozen)`, leaving the game, escrow liability, and session reference intact
    - Local evidence: Four temporary native harness tests against `digifall-template-runtime` passed their assertions. Controls refunded successfully; a foreign asset blocked missed-reveal cancellation and a reachable `RewardMintFailed` refund after ordinary full-game play with the reward asset absent. Adding one native existential deposit to the pot allowed the failed terminal call to complete and return the full stake. These tests are not yet retained in the repository
    - [ ] `Failed-dispatch sponsorship`: Test whether the unchanged game revision after a failed refund remains fee-free for newly signed exact-current-nonce retries. Use SCALE-round-tripped extrinsics through `Executive::apply_extrinsic`; inspect dispatch result, account nonce, game revision, balances, and cleanup. Unbounded free retry behavior is a hypothesis, not a confirmed finding
    - [ ] `Transaction weight coverage`: Trace `CheckNonceForDigifall`, `SkipCheckIfFeeless<ChargeTransactionPayment>`, dispatch weights, and benchmark whitelisting together. The fee predicate runs in both extensions, while `check_nonce_for_feeless` currently benchmarks one evaluation; verify both evaluations and owner `System::Account` work are covered by the total charged weight. Account for conservative settlement/fault suffixes and standard extension weights before declaring undercharge; no undercharge finding is confirmed
    - Exit criteria: Deliver a findings-first review with concrete locations, reproductions, severity, and clearly separated unresolved questions; do not run `chain/scripts/benchmark-digifall.sh` during read-only review because it overwrites generated weights
  - [ ] `Custody and sponsorship hardening`: Fix confirmed findings and retain regressions in the pallet/concrete-runtime suites
    - Ensure pot minimum-balance/provider requirements are funded independently of refundable stakes, or use another custody design compatible with configured fungible adapters; do not silently reduce the promised refund
    - Exit criteria: Full refunds and cleanup succeed with foreign consumer references and no consumed-stake surplus, through both cancellation and terminal fault paths; signed-extrinsic tests establish a bounded sponsored workload even when settlement fails. Preserve successful reward minting, forfeit, session rotation, and replay rejection
    - Validation checkpoint: Run the affected regression families first, then locked all-features tests, formatting, pallet `no_std`, workspace Clippy, and real normal/benchmark-enabled release Wasm builds using the [runtime instructions](chain/runtime/README.md). Regenerate affected weights after behavior/benchmark changes, not as part of review
    - Evidence baseline: Review-time `cargo test --locked --manifest-path chain/Cargo.toml --all-features` passed 50 tests with 2 ignored; `npm run check` and direct non-fixing Stylelint passed. `npm run lint` encountered an output-parser error, not a demonstrated stylesheet error. Earlier successful Clippy/`no_std`/Wasm checks predate this follow-up review and are not evidence for future fixes
  - [ ] `Rust CI`: Check all workflows, then add missing chain validation without replacing web/Android checks. The inspected `.github/workflows/pr-validation.yml` currently has no Rust steps; include locked tests, formatting, Clippy, `no_std`, and a real Wasm build with required Rust sources. Exit criteria: CI exercises `chain/` changes and rejects regressions in these checks
  - [ ] `Production configuration`: Choose the target network/runtime, manipulation-resistant randomness source and delay, final stake/reward policy, and minimum stake covering the bounded worst-case sponsored workload. Collective-flip and `TemplateRewardPolicy` are integration placeholders, not approved production economics
  - [ ] `Playable test environment`: After selecting the network, plan node/testnet and on-chain client integration. Exit criteria: An end-to-end flow covers wallet connection, stake commitment, scheduled reveal, delegated session play, result/reward, and owner recovery without changing browser replay semantics accidentally
  - [ ] `Economic activation gate`: Regenerate weights for the final production composition on target hardware, repeat integration validation, and obtain an independent security/economic review before using real funds. Existing 50-step/20-repeat template weights do not replace this gate
- [ ] `Onboarding/tutorial`: Design and implement a lightweight learning path for new players
  - Exit criteria: First-time players can understand the core move rule, falling/combo behavior, energy pressure, and leaderboard goal without external explanation
  - Exit criteria: Tutorial/onboarding does not compromise deterministic replay validation or core game logic
  - Exit criteria: Returning players can skip or disable the learning flow
- [ ] `Energy ghost diff`: Reconcile and, if still desired, implement the proposed energy-gain ghost animation in `src/Energy.svelte`
  - Exit criteria: Positive energy gains within the 0-100 range show a temporary color-cycling ghost segment between previous and new values
  - Exit criteria: Main bar/value update is delayed or tweened without Svelte 5 reactive loops
  - Exit criteria: Low-energy warning and game-over flip behavior remain unchanged

## Notes

- Previous continuity notes claimed the Energy ghost diff was complete, but current source does not contain that implementation; treat it as unlanded until code changes.
