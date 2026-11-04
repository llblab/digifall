# Backlog

Canonical open-work file for Digifall. Completed delivery history lives in [CHANGELOG.md](CHANGELOG.md); durable project protocol lives in [AGENTS.md](AGENTS.md).

## Active

- [ ] `iPhone highlight verification` — Device-gated: Ask the tester to verify the card-hold hotfix on the affected iPhone
  - Exit criteria: No persistent tint after holds, matches/card reuse, mode changes, or starting a new game
  - If it recurs: Capture iOS version, rapid-mode history, and affected card classes/computed `::after` styles to distinguish another stale UI-state path from a WebKit rendering artifact; Chromium regressions do not establish iPhone rendering correctness
- [ ] `Build-tool dependency advisories`: Resolve remaining low/moderate audit findings in the PWA/Workbox and Svelte build-tool chains
  - Scope: Evaluate compatible upstream fixes or a separately validated PWA/tooling migration; do not force major transitive overrides into a gameplay hotfix
  - Exit criteria: Full `npm audit` is clean while service-worker generation and offline behavior remain correct; production-only audit is already clean
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
