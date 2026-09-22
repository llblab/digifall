# Digifall FRAME pallet

`chain/` is the standalone Rust workspace for the v1 on-chain Digifall prototype. Its rule engine remains the parity baseline for board, card, match, refill/cascade, energy, combo, scoring, and completion behavior. The [v2 lifecycle](../docs/on-chain-game-v2.md) replaces when randomness is committed and how bounded work is scheduled; it does not replace the game rules.

- [`pallets/digifall/src/engine.rs`](pallets/digifall/src/engine.rs) — pure `no_std`, fixed-size deterministic game engine.
- [`pallets/digifall/src/lib.rs`](pallets/digifall/src/lib.rs) — FRAME storage, calls, session authorization, stake custody, scheduled randomness, settlement, and reward minting.
- [`pallets/digifall/src/tests.rs`](pallets/digifall/src/tests.rs) — mock-runtime lifecycle and economic tests.
- [`pallets/digifall/src/benchmarking.rs`](pallets/digifall/src/benchmarking.rs) — FRAME harness for every weight path, reveal/fee/queue bounds, settlement, fault cleanup, and conservative per-budget resolution from full-replacement and high-group one-step cases.
- [`runtime/`](runtime/README.md) — minimal Cumulus parachain runtime proving pallet, transaction-extension, native/asset adapter, and Wasm composition.
- [`../docs/on-chain-pallet.md`](../docs/on-chain-pallet.md) — protocol contract, runtime integration requirements, and remaining production gates.
- [`../docs/on-chain-safety-performance.md`](../docs/on-chain-safety-performance.md) — normative v2 performance budgets, security invariants, adversarial validation, and operational gates.
- [`../docs/game-backends.md`](../docs/game-backends.md) — existing Svelte client reuse, classic/chain backend switching, and lazy Polkadot API integration.

## Validation

```bash
cargo fmt --manifest-path chain/Cargo.toml --all -- --check
cargo test --manifest-path chain/Cargo.toml --all-features
cargo test --locked --manifest-path chain/Cargo.toml -p pallet-digifall --features runtime-benchmarks
cargo check --manifest-path chain/Cargo.toml -p pallet-digifall --no-default-features
cargo clippy --manifest-path chain/Cargo.toml --all-targets --all-features -- -D warnings
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release --features runtime-benchmarks
```

The checked-in development weights are intentionally provisional. The mock runtime proves the custom nonce plus fee-skipping payment pipeline, and the minimal Cumulus runtime proves concrete native/asset and Wasm composition. Economic use remains blocked on benchmarks, a manipulation-resistant parachain randomness source, the final reward policy, and integration into a deployable node.
