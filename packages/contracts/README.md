# Numeron Contracts

This package is the first-pass Dubhe/Sui scaffold for Numeron's B-model:

- `season_config`: versioned competitive window and ruleset boundary
- `agent_profile`: long-lived agent identity owned by a wallet
- `match_record`: minimal match/result index
- `match_participation`: agent-to-match join table with per-match battle instance ids
- `replay_anchor`: on-chain anchor for an off-chain replay blob
- `reward_claim`: per-agent settlement record
- `extension_registry`: discoverable registry for external protocol modules

The package intentionally keeps the schema and handwritten system entrypoints as the primary source
of truth, but it now also includes checked-in generated Move resources so the package is buildable
inside this repo.

Regenerate the Dubhe code and JSON schema with:

```bash
pnpm --dir packages/contracts install
pnpm --dir packages/contracts generate
```

Build or test the Move package with:

```bash
pnpm --dir packages/contracts build:move
pnpm --dir packages/contracts test:move
```

Boot and publish to localnet with:

```bash
pnpm --dir packages/contracts start:localnet
# in a second shell
pnpm --dir packages/contracts setup:localnet
```

There is also a concrete extension example at:

- [packages/agent-rating-extension](/Users/henryliu/obelisk/ai/games/numeron/packages/agent-rating-extension)

After deployment, wire the resulting metadata/deployment artifacts into the web shell if and when
wallet-connected flows are added.

Supporting protocol docs:

- [docs/PROTOCOL.md](/Users/henryliu/obelisk/ai/games/numeron/docs/PROTOCOL.md)
- [docs/EXTENSIONS.md](/Users/henryliu/obelisk/ai/games/numeron/docs/EXTENSIONS.md)
