# Numeron Milestones

`Numeron` is being built as a hybrid auto-battler project:

- `Bevy native` for desktop shipping
- `Next.js + Bevy WASM` for web/PWA
- optional `headless Bevy backend` for future authority, cloud save, and session sync

This document defines the first playable milestone and the execution order to get there.

## Product Direction

`Numeron` should start as a small, readable, highly replayable single-player auto-battler.

The first version is not trying to ship:

- PvP matchmaking
- a large hero roster
- meta-progression depth
- ranked economy
- cosmetics or live-ops

The first version is trying to prove:

- the combat loop is understandable and satisfying
- the shell/runtime split still works for a real game
- the project can ship the same gameplay core to web and native

## v0.0.1 Goal

`v0.0.1` is the first playable vertical slice.

It should let a player:

1. open the shell
2. start a run
3. buy units from a shop
4. place units onto a small board
5. run an automatic battle against a generated enemy squad
6. win or lose rounds, take damage, and continue until run end
7. persist the run locally and resume from the shell

## v0.0.1 Scope

### Core Gameplay

- one fixed battle board
- one bench row
- one shop row
- one player squad and one enemy squad
- auto-battle only once combat starts
- deterministic round flow

### Economy

- gold income per round
- shop refresh
- buy from shop
- sell from board or bench
- simple reroll cost

### Units

- `4` base unit archetypes
- `2` origins or factions
- `2` classes or roles
- simple star-up merge path for duplicates
- one basic attack and one passive or active identity per archetype

### Combat

- target selection
- movement into range
- attack cadence
- damage and death
- round resolution

### Shell Product Layer

- launcher and run-start flow
- gold, health, round, and streak panel
- shop panel
- bench and board interaction layer
- run summary panel
- local save or resume path

### Technical Boundaries

- native and web use the same Rust combat core
- Next.js owns menus, shop chrome, run HUD, and save flow
- Bevy owns board simulation, combat state, and runtime rendering
- no backend dependency for `v0.0.1`

## Out Of Scope For v0.0.1

- online PvP
- asynchronous ghost battles
- ranked ladder
- account system
- cloud save
- inventory or equipment system
- large synergy graph
- authored campaign map
- voice systems
- Steam platform integration

## Milestone Breakdown

### M0. Project Reset

Goal:
- finish converting the copied template into a `Numeron` repo

Deliverables:
- reset repo metadata and versioning
- replace template framing in docs
- define `v0.0.1` milestone and art direction

Exit criteria:
- repo reads as `Numeron`, not as a generic template

### M1. Combat Skeleton

Goal:
- replace the starter scene with a board-driven auto-battler runtime

Deliverables:
- board coordinate model
- unit entity model
- team ownership
- battle phase state resource
- selection and deployment primitives

Exit criteria:
- a seeded player squad and enemy squad spawn into valid tiles

### M2. Round Flow

Goal:
- make the game loop cycle between preparation and combat

Deliverables:
- round state machine
- prep timer or manual start trigger
- combat start and stop
- win or lose resolution
- player health loss and run termination

Exit criteria:
- a full round can be played from prep to combat to resolution

### M3. Shop And Economy

Goal:
- make the run strategically controllable

Deliverables:
- shop generation
- buy, sell, reroll, and lock model
- gold gain and spend rules
- bench capacity rules
- duplicate merge or upgrade rule

Exit criteria:
- the player can meaningfully improve a squad over multiple rounds

### M4. Readable Combat

Goal:
- make fights legible enough to evaluate fun, not just correctness

Deliverables:
- health bars
- attack feedback
- death cleanup
- unit highlights or outlines
- faction or class color coding

Exit criteria:
- a new viewer can understand who is winning by looking at the board

### M5. Shell Integration

Goal:
- wire the real game loop into the existing web shell

Deliverables:
- shell HUD for health, gold, round, and result
- shop panel data bindings
- bench and board actions routed into runtime intents
- local save or resume contract for active run state

Exit criteria:
- web shell can start, continue, and finish a run without dev-only controls

### M6. Playtest Gate

Goal:
- harden the slice until it is stable enough to iterate on content

Deliverables:
- deterministic smoke path
- runtime crash cleanup
- balance notes from first playtests
- first content tuning pass across all four archetypes

Exit criteria:
- `v0.0.1` is playable for repeated local runs on web and native

## Acceptance Criteria For v0.0.1

`v0.0.1` is done when all of the following are true:

- a player can complete at least one full run loop without editor intervention
- web build and native build both boot the same combat systems
- the shell exposes the minimum run HUD and shop controls
- units are readable enough to support basic strategy decisions
- save or resume works locally for the active run
- smoke validation covers boot, start run, place units, start combat, and resolve a round

## Suggested Build Order

1. M0. Project Reset
2. M1. Combat Skeleton
3. M2. Round Flow
4. M3. Shop And Economy
5. M4. Readable Combat
6. M5. Shell Integration
7. M6. Playtest Gate

## After v0.0.1

If `v0.0.1` lands well, the next version should expand only one layer at a time:

- `v0.0.2`
  more archetypes, better combat feedback, stronger board interaction
- `v0.0.3`
  first meta layer, run modifiers, and stronger session summaries
- `v0.1.0`
  first public demo candidate for Steam page capture and external playtest
