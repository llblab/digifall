# Digifall Docs

Root documentation index for architecture and project-control material.

## Architecture

- [Domain DAG config](../domain-dag.json) — project-local dependency layer and boundary validation rules.
- [On-chain pallet](on-chain-pallet.md) — standalone FRAME game protocol, runtime contracts, and production gates.
- [On-chain lifecycle v2](on-chain-game-v2.md) — unchanged Digifall rules with commit-before-randomness moves, bounded resolution, and client protocol.
- [On-chain safety and performance](on-chain-safety-performance.md) — normative budgets, threat model, invariants, validation, and production gates for v2.
- [Classic client backends](game-backends.md) — one existing UI with selectable classic/chain engines and a lazy Polkadot API boundary.
- [On-chain review](on-chain-review.md) — findings-first readiness assessment for the experimental FRAME implementation.
- [Release flow](release-flow.md) — web deploy, TWA wrapper, versioning, GitHub Actions publishing, and Play Console setup.

## Project control

- [Agent protocol](../AGENTS.md)
- [Backlog](../BACKLOG.md)
- [Changelog](../CHANGELOG.md)
- [Root README](../README.md)
