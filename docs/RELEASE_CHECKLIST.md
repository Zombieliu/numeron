# Numeron Release Checklist

## v0.0.1 Ship Gate

- [x] `VERSION` is `0.0.1` and matches release tag `v0.0.1`
- [x] `pnpm version:check` verifies package and runtime version alignment
- [x] `cargo check` passes for the main runtime
- [x] `cargo check --manifest-path server/headless_runtime/Cargo.toml` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm smoke:web` validates boot, buy, deploy, combat, and round advance on the exported shell
- [x] `pnpm test:e2e:local` covers gameplay, save, and regression flows on the local runtime path
- [x] `pnpm test:e2e:remote` covers profile/session sync against the optional headless backend
- [x] `pnpm smoke:native` boots the native Bevy app and verifies the shared board slice reaches play state
- [x] release artifacts and installer names say `Numeron`, not `NumeronTemplate`

## v0.0.1 Acceptance Matrix

- [x] Full run loop is shippable without editor intervention.
  Validated by `tests/e2e/gameplay.spec.ts` plus local save/resume coverage.
- [x] Web and native boot the same Rust combat systems.
  Validated by `pnpm smoke:web`, `pnpm smoke:native`, and the shared `src/starter_scene.rs` gameplay crate.
- [x] HUD, shop, bench, board actions, and save/resume are exposed in the shell.
  Validated by `tests/e2e/regressions.spec.ts` and `tests/e2e/save.spec.ts`.
- [x] Units are readable enough to support basic strategy decisions.
  Validated by visible enemy intent/threat, trait panels, unit portraits, and the expanded deployment-cap warning path.
- [x] Save and resume work locally for active runs, augment drafts, and combat snapshots.
  Validated by `tests/e2e/save.spec.ts`.
- [x] Smoke validation covers boot, start run, place units, start combat, and resolve a round.
  Validated by `pnpm smoke:web` and `pnpm smoke:native`.

## Release Notes Scope

- `v0.0.1` is the first playable single-player vertical slice
- the optional headless backend is experimental and not required for the default local path
- if a known issue blocks repeated local runs on web or native, the release is not ready
