# Contributing

## Scope

This repository is a reusable hybrid game template, not a shipped game. Changes
should improve one of these surfaces:

- native/web bootstrap consistency
- starter runtime slice quality
- deployment and release flows
- template documentation and downstream onboarding
- regression prevention

## Development Loop

```bash
pnpm install
cargo check
pnpm typecheck
pnpm build
pnpm smoke:web
```

If you touch startup, runtime bridging, shell integration, or release workflow
logic, run the full loop before opening a PR.

## Change Guidelines

- Keep the shared Rust runtime crate as the source of truth for gameplay/runtime logic.
- Keep React / Next.js responsible for product shell concerns.
- Prefer additive starter-scene improvements over game-specific assumptions.
- Do not reintroduce trunk-only web assumptions.
- Document any downstream migration cost in `CHANGELOG.md`.

## Template Renames

If your change touches naming, repo metadata, package IDs, or executable names,
test the rename automation:

```bash
pnpm rename:template -- \
  --display-name "My Game" \
  --crate-name my_game \
  --repo-slug my-game \
  --bundle-id com.example.mygame \
  --author-name "Your Name" \
  --repo-url https://github.com/you/my-game
```

## Pull Requests

- Keep PRs scoped to one template concern when possible.
- Include verification notes.
- Include screenshots or terminal evidence for shell/runtime changes.
- Call out any follow-up work that downstream template users should know about.
