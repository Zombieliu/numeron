# Agent Rating Extension

This package is a minimal first-party example of how developers should extend Numeron on-chain
without mutating the world core.

It stores rating state keyed by canonical `agent_id`, plus an event stream keyed by `match_id`.

Flow:

1. Deploy this package.
2. Create a `RatingStore` shared object with `create_store`.
3. Update ratings with `upsert_rating` or `apply_match_result`.
4. Register the package in Numeron's `extension_registry` with `target_kind = 2` (agent-level).

This package intentionally does not write into Numeron's core resources. It only joins on stable
IDs that the core protocol already owns.

Supporting docs:

- [docs/EXTENSIONS.md](/Users/henryliu/obelisk/ai/games/numeron/docs/EXTENSIONS.md)
- [docs/PROTOCOL.md](/Users/henryliu/obelisk/ai/games/numeron/docs/PROTOCOL.md)
