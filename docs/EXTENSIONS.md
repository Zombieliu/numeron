# Extension Layer

This document defines how third-party developers should extend `Numeron` on-chain.

The goal is to let developers build on the world without forking or rewriting the core protocol.

## Principle

Extensions should treat `Numeron` as a stable base world.

They should:

- consume canonical IDs from the world core
- publish their own state in their own modules
- avoid mutating core protocol facts

The extension model is:

- `Numeron` owns the world facts
- extensions own interpretation, ranking, incentives, and overlay systems

## Canonical Join Keys

Every extension should key off at least one of:

- `agent_id`
- `match_id`
- `season_id`

Optional:

- `battle_instance_id`
- `extension_id`

If an extension cannot be expressed using those keys, it is probably trying to do too much inside
the core protocol.

## Extension Categories

### Agent Extensions

Key by `agent_id`.

Examples:

- rating and reputation
- cosmetic badges
- sponsorship relationships
- guild membership
- agent training lineage

### Match Extensions

Key by `match_id`.

Examples:

- replay annotations
- audit attestations
- prediction markets
- anti-cheat verdicts
- external analytics

### Season Extensions

Key by `season_id`.

Examples:

- seasonal leaderboard rules
- reward schedules
- tournament brackets
- seasonal quests

## Registry Model

The `extension_registry` resource exists so the world can discover extensions without hard-coding
them into the core package.

Current scaffold fields:

- `extension_id`
- `publisher`
- `namespace`
- `schema_version`
- `target_kind`
- `enabled`

Recommended `target_kind` convention:

- `0`: world-level
- `1`: season-level
- `2`: agent-level
- `3`: match-level
- `4`: replay-level

## Safe Extension Rules

Extensions should follow these rules:

1. Never overwrite `agent_profile`, `match_record`, `match_participation`, or `replay_anchor`.
2. Never assume replay payload format without checking the ruleset version.
3. Treat missing extension state as normal, not as corruption.
4. Use additive schemas whenever possible.
5. Version your own tables.

## Anti-Patterns

Do not:

- store full replay frames on-chain
- mirror the entire runtime state on-chain
- key extension state by ephemeral renderer entity ids
- depend on UI text or locale strings
- require direct writes into core tables

## Suggested Developer Workflow

1. Read:
   [docs/PROTOCOL.md](/Users/henryliu/obelisk/ai/games/numeron/docs/PROTOCOL.md)
2. Decide whether the extension targets agents, matches, or seasons.
3. Create a standalone Move package.
4. Key all extension rows by canonical Numeron ids.
5. Optionally register the package in `extension_registry`.
6. Build an indexer or client that joins extension rows with core world rows.

## Example Extensions

### Agent Rating

Writes:

- `rating_state(agent_id)`
- `rating_history(agent_id, season_id)`

Reads:

- `match_record`
- `match_participation`

### Sponsor Network

Writes:

- `sponsor_contract(agent_id, sponsor_id)`
- `revenue_split(agent_id, season_id)`

Reads:

- `agent_profile`
- `reward_claim`

### Replay Notes

Writes:

- `replay_annotation(match_id, publisher, note_hash)`

Reads:

- `replay_anchor`

## Recommended Compatibility Contract

An extension package should publish:

- `extension name`
- `publisher address`
- `schema version`
- `compatible ruleset versions`
- `target kind`

That metadata can live:

- in the extension's own package constants
- in `extension_registry`
- in an off-chain manifest referenced by the registry

## Review Threshold

Core-maintained or first-party extensions may live in this repo later, but third-party modules
should be designed to work without merge access.

That means the extension surface should be:

- documented
- keyed by stable ids
- discoverable
- mostly additive

## Sample Package

A concrete sample package now lives at:

- [packages/agent-rating-extension](/Users/henryliu/obelisk/ai/games/numeron/packages/agent-rating-extension)

It demonstrates the intended extension shape:

- separate package ownership
- additive state only
- rows keyed by canonical `agent_id`
- optional later registration into `extension_registry`

## Immediate Next Steps

1. Finalize replay digest submission rules.
2. Expose extension discovery in the web shell once wallet integration lands.
3. Add indexer joins between `extension_registry` and third-party package manifests.
