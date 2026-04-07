# Changelog

All notable changes to this template should be documented in this file.

The format follows Keep a Changelog conventions and the template uses
semantic-style version tags such as `v0.1.0`.

## [Unreleased]

### Added

- Starter slice progression data now flows into the web shell with objective, score, loop, and status fields.
- Local save slots with progression meta, recent session history, and JSON export/import for the shell-owned save matrix.
- Product-facing packaging docs and visual capability map for public template distribution.
- Optional headless Bevy backend reference with health, profile, session, and snapshot endpoints.
- Shell-level `local / remote` data mode with backend URL controls, remote snapshot hydration, and live profile/session sync against the optional headless backend.

## [0.1.0] - 2026-04-06

### Added

- Shared native + web runtime bootstrap via `src/runtime_app.rs`
- Next.js shell under `apps/web`
- WASM bridge for boot status, runtime events, session config, and virtual input
- Visible starter scene with a movable player marker
- Static-export web build, GitHub Pages workflow, and web release packaging
- Template rename automation script and repository maintenance docs
- Browser smoke test flow for the hybrid runtime shell

### Changed

- Replaced the old trunk-specific web path with a Next.js + `wasm-pack` pipeline
- Unified initial project naming under `numeron`

## Versioning Policy

- Patch: documentation, CI, or template maintenance improvements with no intended
  migration burden for downstream users
- Minor: additive template capabilities, new scripts, new scaffolding, new
  optional integrations
- Major: breaking rename conventions, structural changes to startup/bootstrap
  contracts, or template layout changes that require downstream migration
