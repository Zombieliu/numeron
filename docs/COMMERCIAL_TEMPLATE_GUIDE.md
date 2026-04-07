# Commercial Template Guide

Use this when turning the repository from a technical starter into a public or paid starter kit.

## Positioning

Frame the template around three promises:

- one Rust gameplay/runtime crate shared by native and web
- a shell-owned product layer that can evolve independently from the runtime
- a safe path from local-first prototype to hosted web/native release

## What Is Already Productized

- shared runtime bootstrap
- embedded Bevy WASM shell path
- local save slots
- match/session summaries
- progression meta
- optional headless backend reference
- rename automation
- browser smoke in CI

## What You Should Replace First

- `src/starter_scene.rs`
  Replace the uplink slice with your game-specific vertical.
- `apps/web/components/game-shell.tsx`
  Replace generic shell copy, session presentation, and slot labels.
- `assets/`
  Replace placeholder content and iconography.

## Recommended Downstream Phases

1. Rename and rebrand the template.
2. Replace the starter slice with your first real game loop.
3. Decide whether save/session storage remains browser-local or moves behind auth/cloud save.
4. Add project-specific screenshots, gifs, and store-facing assets.
5. Tighten release/version policy once external users depend on the template.

## Optional Backend Path

The template does not require a backend. If you add one later, keep these boundaries:

- runtime remains authoritative for immediate simulation state
- shell owns auth, account UX, and remote persistence orchestration
- backend stores profiles, progression, and session records instead of driving frame-by-frame simulation

That preserves the template’s main value: the runtime contract stays stable while the product stack changes.
