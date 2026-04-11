# Changelog

All notable changes to Numeron should be documented in this file.

The format follows Keep a Changelog conventions.

## [Unreleased]

No unreleased changes.

## [0.0.7] - 2026-04-10

### Added

- Introduced the `0.0.7` presentation pass with a 3D battlefield, mesh-based units, 3D health bars, and the featured GLB runtime asset.

### Changed

- Switched the shared Bevy runtime from the earlier 2D presentation into a 2.5D / 3D camera-and-board layout.
- Optimized release web builds with `wasm-opt -Oz` when available to offset the heavier runtime payload.
- Stabilized Playwright coverage for the heavier scene by defaulting local runs to one worker and routing critical combat controls through a runtime-aware test helper.

## [0.0.1] - 2026-04-08

### Added

- Initial playable Numeron vertical slice with shop, board deployment, auto-battle, augments, and local session scaffolding.
- Native Bevy runtime, web shell, and optional headless backend reference.
- Playwright gameplay, save, responsive, and remote regression coverage.

### Changed

- Reset inherited template identity, packaging names, and repository framing to ship as `Numeron`.

## Versioning Policy

- Patch: gameplay fixes, docs, CI, or release maintenance with no save/schema break
- Minor: additive systems, content, shell capabilities, or platform support
- Major: save/schema resets, runtime contract breaks, or release-layout migrations
