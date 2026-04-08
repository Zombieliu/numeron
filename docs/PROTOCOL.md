# Numeron Protocol

`Numeron` is organized as a three-layer protocol:

1. `World Core`
2. `Battle Runtime`
3. `Extension Layer`

The system is intentionally biased toward a persistent agent world rather than a one-off match
log. The key separation is:

- `agent`: long-lived identity
- `battle instance`: temporary unit instance inside one match
- `match`: durable world fact
- `replay`: off-chain battle evidence anchored on-chain

## Design Goals

- Keep the core world small, stable, and verifiable.
- Keep combat fast and deterministic off-chain.
- Let third-party developers extend the world without mutating the core schema.
- Preserve auto-battler feel by separating permanent identity from temporary battle instances.

## Layer 1: World Core

The world core contains the minimal facts that must remain durable and shareable.

### Canonical IDs

- `season_id`
- `agent_id`
- `match_id`
- `battle_instance_id`
- `extension_id`

These IDs are the stable join keys for every other layer.

### Core Resources

Current scaffold:

- `season_config`
- `agent_profile`
- `match_record`
- `match_participation`
- `replay_anchor`
- `reward_claim`
- `extension_registry`

Contract schema lives in:
[packages/contracts/dubhe.config.ts](/Users/henryliu/obelisk/ai/games/numeron/packages/contracts/dubhe.config.ts)

System entrypoints live in:
[packages/contracts/src/numeron/sources/systems/numeron.move](/Users/henryliu/obelisk/ai/games/numeron/packages/contracts/src/numeron/sources/systems/numeron.move)

### Core Responsibilities

`season_config`

- versioned competitive window
- rule selection
- feature gating

`agent_profile`

- wallet ownership
- base identity and class metadata
- durable lifecycle timestamps

`match_record`

- canonical result summary
- season linkage
- score and timing facts

`match_participation`

- join table between `match_id` and `agent_id`
- stores the per-match `battle_instance_id`
- supports future ladders, scouting, and rewards

`replay_anchor`

- on-chain pointer to replay content
- stores digest plus storage epoch
- replay body stays off-chain

`reward_claim`

- settlement result per agent and match
- does not require storing the full reward derivation path on-chain

`extension_registry`

- registry of approved or discoverable extension modules
- binds extension namespace to publisher and schema version

## Layer 2: Battle Runtime

The battle runtime is intentionally off-chain.

It owns:

- board state
- shop state
- player squad and enemy squad
- combat ticks
- temporary buffs and live HP
- replay event stream
- resumable local run-state

The runtime already exists in the shared Rust simulation:
[src/starter_scene.rs](/Users/henryliu/obelisk/ai/games/numeron/src/starter_scene.rs)

### Runtime Rules

- Every spawned unit gets an `agent_id` and a `battle_instance_id`.
- `agent_id` represents durable identity.
- `battle_instance_id` represents this match-local incarnation.
- Merge, sell, death, reroll, and deployment all operate on battle instances.
- World core only receives the finalized summary and replay anchor.

### Replay Rule

`Numeron` should not store per-tick replay state on-chain.

Instead:

1. The runtime emits a replay blob or event stream.
2. The blob is stored off-chain.
3. The chain only stores `match_id -> replay_anchor`.

## Layer 3: Extension Layer

Extensions are not expected to mutate core resources.

Instead, extensions should:

- read `agent_id`, `match_id`, and `season_id`
- write their own module-local state
- optionally register their schema in `extension_registry`

Examples:

- rating and leaderboard modules
- guild or team modules
- sponsorship and revenue sharing
- replay annotation
- betting or prediction markets
- scouting and analytics
- AI memory or training anchors

## World Flow

Recommended durable flow:

1. Create or update `season_config`.
2. Mint or register `agent_profile`.
3. Run a match off-chain.
4. Produce battle instances and replay data.
5. Submit `match_record`.
6. Submit `match_participation` rows.
7. Submit `replay_anchor`.
8. Submit `reward_claim` if the season or mode pays out.
9. Let extensions index `match_id` and `agent_id`.

## What Must Not Go On-Chain

- full replay frames
- shop reroll history
- raw retrieval context
- model reasoning traces
- renderer projection data
- large agent memory payloads

## Upgrade Policy

The world core should be treated as stable protocol surface.

Allowed:

- add new resources
- add new system entrypoints
- add optional indexes and registries

Risky:

- changing meaning of existing fields
- changing ID semantics
- replacing replay digest rules

If a breaking change is unavoidable:

- increment `ruleset_version`
- create a new season boundary
- keep old joins readable

## Current Scaffold Status

The repo now includes:

- runtime-level `agent_id` and `battle_instance_id`
- local agent and battle ledgers in the web shell
- generated Dubhe resources for the Numeron world core
- a sample standalone extension package keyed by `agent_id`

## Recommended Next Steps

1. Add indexer queries for `agent_profile`, `match_record`, and `extension_registry`.
2. Define replay digest construction and submission rules.
3. Add a wallet-connected shell page for world-core inspection.
4. Publish and register the sample extension on a target Sui network.
