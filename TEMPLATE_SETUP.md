# Template Setup Checklist

Use this after creating a new repo from the template.

## 1. Rename Runtime Identity

Run the built-in rename script first:

```bash
pnpm rename:template -- \
  --display-name "My Game" \
  --crate-name my_game \
  --repo-slug my-game \
  --bundle-id com.example.mygame \
  --author-name "Your Name" \
  --repo-url https://github.com/you/my-game
```

This rewrites the main template identity in:

- `Cargo.toml`
- `src/main.rs`
- `src/runtime_app.rs`
- `mobile/Cargo.toml`
- `mobile/manifest.yaml`
- `build/macos/src/Game.app/Contents/Info.plist`
- `build/windows/installer/Package.wxs`
- `apps/web/package.json`
- `apps/web/app/layout.tsx`
- `apps/web/components/game-shell.tsx`

Then manually review the diff before your first commit.

## 2. Replace Template Branding

- Update the browser metadata in `apps/web/app/layout.tsx`
- Update the shell copy in `apps/web/components/game-shell.tsx`
- Replace app icons in `build/` and `mobile/ios-src/Assets.xcassets/`
- Replace the default starter scene in `src/starter_scene.rs`

## 3. Set Repo Metadata

- Update `LICENSE` if you do not want to keep `CC0-1.0`
- Rewrite the first section of `README.md` for your game or studio
- Reset `CHANGELOG.md` if you do not want to inherit template release history
- Confirm `VERSION` matches your intended starting tag
- Decide whether to keep the default save-slot/session/progression shell contract or replace it with your own product layer

## 4. Verify Both Targets

```bash
pnpm install
pnpm dev
pnpm build
pnpm smoke:web
pnpm backend:check
cargo run
```

## 5. Enable GitHub Template Mode

After pushing to your personal GitHub repo:

1. Open `Settings`
2. Open `General`
3. Enable `Template repository`

That gives you the standard GitHub "Use this template" flow for future projects.

## 6. Productize The Public Repo

Before sharing the repo publicly, update:

- `README.md` hero copy and preview assets
- `docs/COMMERCIAL_TEMPLATE_GUIDE.md` if your downstream product path differs
- `docs/capability-map.svg` if you change the template boundaries materially
