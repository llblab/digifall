# Digifall parachain template runtime

> This runtime composes the v1 research lifecycle. The target [v2 protocol](../../docs/on-chain-game-v2.md) preserves the rule engine but requires per-action scheduled entropy, revised state/calls, client integration, and new weights; passing these checks is not approval of v1 economics or randomness for production.

This crate is a minimal Polkadot SDK 2606 parachain-runtime integration target for `pallet-digifall`. It follows the template runtime shape—FRAME runtime composition, Cumulus `ParachainSystem`, `Executive`, `UncheckedExtrinsic`, and `register_validate_block!`—without adding a node or pretending to be a production chain.

The runtime composes:

- native `Balances` as the stake currency;
- one `Assets` item adapter as the reward currency;
- `CheckNonceForDigifall` in place of standard `CheckNonce`;
- `SkipCheckIfFeeless<ChargeTransactionPayment>` for valid session progress;
- `ParachainSystem` and a generated Wasm validation entrypoint;
- collective-flip randomness only as a deterministic integration source.

Collective-flip is intentionally insecure and must be replaced before economic activation. The checked-in reward policy and weights are also integration defaults, not production economics.

## Verification

The Wasm builder needs Rust standard-library sources:

```bash
rustup component add rust-src
```

Then run:

```bash
cargo test --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --lib
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release
cargo build --locked --manifest-path chain/Cargo.toml -p digifall-template-runtime --release --features runtime-benchmarks
```

The native suite includes full-game reward settlement and SCALE-round-tripped signed extrinsics applied through `Executive`, proving fee-free session progress, stale replay rejection, and paid-call enforcement with the concrete runtime tuple.

The release build invokes `substrate-wasm-builder` and emits the compact parachain runtime under `chain/target/release/wbuild/digifall-template-runtime/`. The `runtime-benchmarks` build additionally exports FRAME's benchmark and genesis-builder APIs and registers `pallet-digifall` for an external runner such as `frame-omni-bencher`.

[`src/weights/pallet_digifall.rs`](src/weights/pallet_digifall.rs) was generated with `frame-omni-bencher` 0.23.0 using 50 steps and 20 repeats on an AMD Ryzen 7 4800H. Regenerate it on target hardware after selecting the production randomness and reward configuration:

```bash
FRAME_OMNI_BENCHER=/path/to/frame-omni-bencher chain/scripts/benchmark-digifall.sh
```

The script rebuilds benchmark-enabled Wasm, runs all pallet cases with `STEPS=50` and `REPEAT=20` by default, adapts generated imports to this umbrella-SDK runtime, verifies all 16 weight methods, and compile-checks the result. The crate still does not include a node; generated Wasm artifacts remain ignored.
