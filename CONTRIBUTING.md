# Contributing

## Scope

This repository is the working `Numeron` game repo. Changes should improve one
of these surfaces:

- native/web bootstrap consistency
- the playable auto-battler slice
- shell/runtime integration quality
- deployment and release flows
- regression prevention

## Development Loop

```bash
pnpm install
cargo check
pnpm typecheck
pnpm build
pnpm smoke:web
pnpm test:e2e
```

If you touch startup, runtime bridging, shell integration, or release workflow
logic, run the full loop before opening a PR.

## Change Guidelines

- Keep the shared Rust runtime crate as the source of truth for gameplay/runtime logic.
- Keep React / Next.js responsible for product shell concerns.
- Prefer improvements that strengthen the `v0.0.1` vertical slice over speculative scaffolding.
- Keep web builds static-export friendly.
- Document release-facing behavior changes in `CHANGELOG.md`.

## Pull Requests

- Keep PRs scoped to one gameplay, platform, or release concern when possible.
- Include verification notes.
- Include screenshots or terminal evidence for shell/runtime changes.
- Call out any follow-up work that affects the `v0.0.1` ship gate.
