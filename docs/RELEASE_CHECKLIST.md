# Numeron Release Checklist

## v0.0.7 Ship Gate

- [x] `VERSION` is `0.0.7` and matches the release tag `v0.0.7`
- [x] `pnpm version:check` verifies package, mobile, backend, and installer version alignment
- [x] `cargo test -q` passes for the shared runtime crate
- [x] `pnpm typecheck` passes for the web shell
- [x] `pnpm build` exports the 2.5D / 3D web shell successfully
- [x] `pnpm exec playwright test --project=local-chromium` passes with serialized workers by default
- [x] `pnpm exec playwright test --project=remote-chromium` passes against the optional backend
- [ ] Manual browser/native play pass on the final `0.0.7` build

## v0.0.7 Acceptance Matrix

- [x] The shared runtime presents the battlefield in the new 2.5D / 3D layout without regressing the core round loop.
  Validated by `src/starter_scene.rs`, `tests/e2e/gameplay.spec.ts`, and the local regression suite.
- [x] Shell controls still cover launch, buy, deploy, combat, next round, restart, save/resume, and remote sync after the visual upgrade.
  Validated by `tests/e2e/gameplay.spec.ts`, `tests/e2e/regressions.spec.ts`, `tests/e2e/save.spec.ts`, and `tests/e2e/remote.spec.ts`.
- [x] Automated coverage is stable under the heavier runtime startup profile.
  Validated by serialized local Playwright workers plus the runtime-aware `__NUMERON_TEST_API__` bridge for combat control buttons.
- [ ] Final release signoff waits on manual playtesting of the shipped `0.0.7` shell/runtime build.

## Release Notes Scope

- `v0.0.7` is the 3D presentation upgrade on top of the existing single-player vertical slice
- the optional headless backend is still experimental and not required for the default local path
- if a known issue blocks repeated local runs on web, native, or Playwright smoke, the release is not ready
