# Changelog

All notable changes to Numeron should be documented in this file.

The format follows Keep a Changelog conventions.

## [Unreleased]

### Changed

- Stabilized local regression coverage around shop timing and duplicate-merge flow.
- Aligned release metadata, installer names, and workflow validation on `v0.0.1`.
- Switched primary docs from template framing to Numeron game-repo framing.

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
