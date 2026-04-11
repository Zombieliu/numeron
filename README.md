<p align="center">
  <img src="./docs/banner.svg" alt="Numeron banner" width="100%" />
</p>

# Numeron

<p align="center">
  <strong>One Rust runtime crate. Native Bevy + Next.js shell + Bevy WASM.</strong>
</p>

<p align="center">
  <a href="https://github.com/Zombieliu/numeron">GitHub Repo</a>
  ·
  <a href="./docs/MILESTONES.md">Milestones</a>
  ·
  <a href="./apps/web">Web Shell</a>
  ·
  <a href="./src/runtime_app.rs">Shared Bootstrap</a>
</p>

<p align="center">
  <img src="./docs/smoke-preview.png" alt="Numeron live shell preview" width="100%" />
</p>

Hybrid auto-battler project built on one Rust gameplay/runtime crate shared
across:

- native Bevy builds
- `Next.js` product shell / launcher / HUD
- `Bevy WASM` embedded into a web or PWA surface

## What It Is

`Numeron` is the working game repo for a small auto-battler that targets:

- native desktop via Bevy
- web/PWA via Next.js + Bevy WASM
- an optional future headless backend path for remote authority

The first concrete target is [`v0.0.1`](./docs/MILESTONES.md): a playable
single-player vertical slice with shop, board deployment, auto-battle, round
resolution, and local save or resume.

`Numeron` keeps clear ownership boundaries:

- `React / Next.js` owns product UI, launcher flows, PWA shell, account UI, and overlays
- `Bevy` owns the canvas runtime
- the same Rust crate powers both native and web targets

The web build targets static export, so the shell can be deployed to GitHub
Pages, Netlify, Cloudflare Pages, or any other static host after `pnpm build`.

This repo keeps the original hybrid architecture because it matches the intended
product split:

- `runtime core`
  shared Bevy combat simulation, board state, and native/web runtime path
- `product shell`
  Next.js launcher, HUD, shop chrome, save flow, and progression surfaces
- `authority path`
  optional headless runtime for later cloud save, room orchestration, or remote combat authority

See [`docs/MILESTONES.md`](./docs/MILESTONES.md) for the first execution plan.

## Snapshot

- `cargo run` starts the native runtime
- `pnpm dev` starts the Next.js shell and embedded Bevy WASM runtime
- `pnpm build` exports a static web artifact from `apps/web/out`
- `pnpm smoke:native` boots the native Bevy app and verifies the shared board slice reaches play state
- `pnpm smoke:web` boots the shell, launches the runtime, and validates scene/input flow
- `SMOKE_REMOTE_BACKEND_URL=http://127.0.0.1:8787 pnpm smoke:web` also validates the shell's remote data-mode path against the optional backend
- `pnpm test:e2e` runs the Playwright regression suite for local gameplay, save flows, and remote sync
- `pnpm backend:dev` starts the optional headless Bevy backend reference
- `src/runtime_app.rs` keeps native and web bootstrap logic on one contract
- `src/starter_scene.rs` contains the current Numeron board slice
- the web shell already carries the local save-slot, session-history, and progression scaffolding for the vertical slice

## v0.0.1 Focus

The first playable milestone is intentionally narrow:

- one board
- one shop row
- ten unit archetypes
- simple economy
- auto-battle round flow
- local run persistence

The point of `v0.0.1` is not content breadth. It is to prove that Numeron feels
good on this architecture before expanding the roster or meta.

## Current Base

- native Bevy runner with `cargo run`
- `wasm-pack` build path for the Bevy runtime
- `Next.js` app shell in [`apps/web`](./apps/web)
- shared Rust bootstrap for both native and web entrypoints
- a playable board slice with shop, augments, deployment, and auto-battle flow
- local save-slot persistence, session history, and JSON import/export
- optional headless Bevy backend reference for experimental remote profile/session authority
- minimal shell-to-runtime bridge:
  - boot status sink
  - runtime event sink
  - runtime session config
  - virtual input forwarding
  - runtime projection data for shell HUDs
- mobile and release packaging scaffolding from the original hybrid base

## Quick Start

### Prerequisites

- `rustup`
- `wasm-pack`
- `node >= 20`
- `pnpm`

### Run native

```bash
cargo run
```

or

```bash
pnpm native
```

### Run web shell

```bash
pnpm install
pnpm dev
```

This will:

1. build the Rust runtime to `apps/web/public/bevy-runtime/pkg`
2. start the Next.js shell in `apps/web`

Then open:

- `http://127.0.0.1:3000`

The current slice should boot into the Numeron board, pre-fill the bench, and
allow drafting, deployment, and combat from the shell.

### Run optional headless backend

```bash
pnpm backend:dev
```

This starts the reference backend at `http://127.0.0.1:8787`.

Available endpoints:

- `GET /health`
- `GET /snapshot`
- `GET /profiles`
- `GET /profiles/:slot_id`
- `PUT /profiles/:slot_id`
- `GET /sessions`
- `POST /sessions`
- `PATCH /sessions/:session_id`

### Build web shell

```bash
pnpm build
```

Static output is written to `apps/web/out`.

If you deploy under a subpath, set `NEXT_PUBLIC_BASE_PATH=/your-path` before
`pnpm build`. The GitHub Pages workflow does this automatically for project
pages repos.

### Cloudflare Pages

This repo now includes a minimal [`wrangler.toml`](./wrangler.toml) for
Cloudflare Pages. For the current single-player shell, the smallest working
flow is:

```bash
pnpm cf:pages:deploy
```

For local Cloudflare Pages preview against the exported artifact:

```bash
pnpm cf:pages:dev
```

If your Pages project is named differently, update `name` in
[`wrangler.toml`](./wrangler.toml) before the first deploy.

Production static exports default to the lightweight single-player preview
surface. The deployed root URL is enough for sharing:

```text
https://your-site.pages.dev/
```

`?preview=0` or `?full=1` can still be used when you want to force the heavier
non-preview shell for debugging.

### Build only the wasm runtime

```bash
pnpm runtime:build:dev
pnpm runtime:build:release
```

### Run browser smoke

```bash
pnpm smoke:web
```

This builds the web export when needed, serves the generated static shell on a
local port, launches Chromium, clicks `Launch Runtime`, waits for
`scene-ready`, sends virtual input, and saves smoke artifacts under
`output/playwright/smoke-web`.

### Run Playwright e2e

```bash
pnpm test:e2e
```

Targeted entrypoints:

```bash
pnpm test:e2e:local
pnpm test:e2e:remote
```

The Playwright suite keeps the static-export path under test and covers:

- local gameplay flow: launch, draft, deploy, combat, next round, restart
- save matrix flow: locale/profile persistence plus snapshot import/export
- remote backend flow: profile push/pull plus live session sync

Local runs default to `PLAYWRIGHT_WORKERS=1` because the heavier `0.0.7`
3D runtime can saturate headless Chromium under parallel load. Override
`PLAYWRIGHT_WORKERS` explicitly when you want to stress-test parallelism again.

## Architecture

`Numeron` is built for a product split where:

- Bevy owns simulation, board state, and combat rendering
- React/Next.js owns launcher, HUD, save slots, and progression surfaces
- the same Rust crate ships to native and web

## Shell Product Layer

The web shell now ships with a local-first product shell contract:

- three save slots
- slot-scoped preferences
- match/session state derived from the runtime slice
- progression meta with XP, level, sweeps, and unlock badges
- recent session history
- JSON export/import for the whole save matrix

This is intentionally shell-owned and browser-local. If you later add auth,
cloud save, or backend match state, you can swap the storage backend without
rewriting the Bevy runtime.

The shell also ships a `Data Mode` switch:

- `Local` keeps save slots, progression, and recent sessions in browser storage
- `Remote` pulls profiles/sessions from the optional backend and pushes the active slot plus live match-session updates back to it

## Optional Headless Backend

This repo also ships an optional reference backend in
[`server/headless_runtime`](./server/headless_runtime).

Use it when you want to evolve from:

- local-only save/session state

to:

- remote profile persistence
- room/session orchestration
- headless authority for multiplayer or cloud save

The backend is intentionally not required by `v0.0.1`. Treat it as an
experimental reference path, not a hard dependency.

To exercise the remote path from the stock shell:

1. run `pnpm backend:dev`
2. run `pnpm dev`
3. switch the `Data Mode` panel to `Remote`
4. keep the default backend URL or point it at your own instance
5. use `Pull Remote` to hydrate the shell, then launch the runtime

The shell will keep slot profile changes and match-session updates synced while
remote mode stays active.

## Replaceable Boundaries

- Replace [`src/starter_scene.rs`](./src/starter_scene.rs) when your real gameplay slice is ready.
- Replace [`apps/web/components/game-shell.tsx`](./apps/web/components/game-shell.tsx) when your product UI and economy/session surfaces are ready.
- Replace local storage contracts when you are ready for auth or cloud save.
- Keep [`src/runtime_app.rs`](./src/runtime_app.rs) and the shell/runtime bridge stable as long as possible.

## Shared Runtime Bootstrap

Both native and web now use the same app bootstrap in
[`src/runtime_app.rs`](./src/runtime_app.rs).

- native uses `build_native_app()`
- web uses `build_web_app(RuntimeConfig)`
- both share the same `GamePlugin`, starter scene, asset loading, and runtime config surface

This is the contract that keeps native and web behavior aligned while the shell
evolves.

## Starter Scene

The current playable slice lives in [`src/starter_scene.rs`](./src/starter_scene.rs).

- it sets up the board, shop, bench, and enemy squad
- it runs preparation, combat, resolution, streak, and augment flow
- it projects readable runtime state back into the shell HUD
- it is the vertical slice that `v0.0.1` hardens, not throwaway placeholder code

When the game outgrows this slice, replace the board systems first, not the
runtime bridge.

## Repository Shape

- [`src`](./src)
  shared Rust game/runtime code used by native and web
- [`src/runtime_app.rs`](./src/runtime_app.rs)
  shared native/web app bootstrap and window setup
- [`src/starter_scene.rs`](./src/starter_scene.rs)
  current Numeron board slice and combat loop
- [`apps/web`](./apps/web)
  Next.js shell that dynamically imports the generated wasm package
- [`scripts/build-bevy-runtime.sh`](./scripts/build-bevy-runtime.sh)
  `wasm-pack` wrapper that writes into the web app's public runtime directory and mirrors runtime assets
- [`assets`](./assets)
  shared runtime assets
- [`build`](./build)
  native packaging assets and installer metadata

## CI And Deployment

- GitHub CI now validates both the Rust crate and the web shell
- GitHub CI installs Chromium and runs `pnpm smoke:web` against the hybrid shell
- GitHub Pages deployment uses the exported `apps/web/out` artifact
- GitHub release web artifacts zip the same exported static site

## Maintenance

- [`VERSION`](./VERSION) tracks the current Numeron release line
- [`CHANGELOG.md`](./CHANGELOG.md) records release-facing game and platform changes
- [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) defines the `v0.0.1` ship gate
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) defines the required verification loop
- [`SECURITY.md`](./SECURITY.md) defines reporting expectations for repository issues
- [`server/headless_runtime/README.md`](./server/headless_runtime/README.md) documents the optional backend reference

## Updating the icons
 1. Replace `build/macos/icon_1024x1024.png` with a `1024` times `1024` pixel png icon and run `create_icns.sh` or `create_icns_linux.sh` if you use linux (make sure to run the script inside the `build/macos` directory) - _Note: `create_icns.sh` requires a mac, and `create_icns_linux.sh` requires imagemagick and png2icns_
 2. Replace `build/windows/icon.ico` (used for windows executable and as favicon for the web-builds)
    * You can create an `.ico` file for windows by following these steps:
       1. Open `macos/AppIcon.iconset/icon_256x256.png` in [Gimp](https://www.gimp.org/downloads/)
       2. Select the `File > Export As` menu item.
       3. Change the file extension to `.ico` (or click `Select File Type (By Extension)` and select `Microsoft Windows Icon`)
       4. Save as `build/windows/icon.ico`
 3. Replace `build/android/res/mipmap-mdpi/icon.png` with `macos/AppIcon.iconset/icon_256x256.png`, but rename it to `icon.png`

## Deploy mobile platforms

For general info on mobile support, you can take a look at [one of my blog posts about mobile development with Bevy][mobile_dev_with_bevy_2] which is relevant to the current setup.

## Android

Currently, `cargo-apk` is used to run the development app. But APKs can no longer be published in the store and `cargo-apk` cannot produce the required AAB. This is why there is setup for two android related tools. In [`mobile/Cargo.toml`](./mobile/Cargo.toml), the `package.metadata.android` section configures `cargo-apk` while [`mobile/manifest.yaml`](./mobile/manifest.yaml) configures a custom fork of `xbuild` which is used in the `release-android-google-play` workflow to create an AAB.

There is a [post about how to set up the android release workflow][workflow_bevy_android] on my blog.

## iOS

The setup is pretty much what Bevy does for the mobile example.

There is a [post about how to set up the iOS release workflow][workflow_bevy_ios] on my blog.

## Removing mobile platforms

If you don't want to target Android or iOS, you can just delete the `/mobile`, `/build/android`, and `/build/ios` directories.
Then delete the `[workspace]` section from `Cargo.toml`.

## Development environments

## Nix Support

nixgl is only used on non-NixOS Linux systems;
when running there we need to use the `--impure` flag:

```
nix develop --impure
```

If using nixgl, then .e.g. `gl cargo run`, other use
`cargo` as usual.

## Getting started with Bevy

You should check out the Bevy website for [links to resources][bevy-learn] and the [Bevy Cheat Book] for a bunch of helpful documentation and examples. I can also recommend the [official Bevy Discord server][bevy-discord] for keeping up to date with the development and getting help from other Bevy users.

## Known issues

Audio in web-builds can have issues in some browsers. This seems to be a general performance issue and not due to the audio itself (see [bevy_kira_audio/#9][firefox-sound-issue]).

## License

This project is licensed under [CC0 1.0 Universal](LICENSE) except some content of `assets` and the Bevy icons in the `build` directory (see [Credits](credits/CREDITS.md)). Go crazy and feel free to show me whatever you build with this ([@nikl_me][nikl-twitter] / [@nikl_me@mastodon.online][nikl-mastodon] ).

[bevy]: https://bevyengine.org/
[bevy-learn]: https://bevyengine.org/learn/
[bevy-discord]: https://discord.gg/bevy
[nikl-twitter]: https://twitter.com/nikl_me
[nikl-mastodon]: https://mastodon.online/@nikl_me
[firefox-sound-issue]: https://github.com/NiklasEi/bevy_kira_audio/issues/9
[Bevy Cheat Book]: https://bevy-cheatbook.github.io/introduction.html
[trunk]: https://trunkrs.dev/
[android-instructions]: https://github.com/bevyengine/bevy/blob/latest/examples/README.md#setup
[ios-instructions]: https://github.com/bevyengine/bevy/blob/latest/examples/README.md#setup-1
[mobile_dev_with_bevy_2]: https://www.nikl.me/blog/2023/notes_on_mobile_development_with_bevy_2/
[workflow_bevy_android]: https://www.nikl.me/blog/2023/github_workflow_to_publish_android_app/
[workflow_bevy_ios]: https://www.nikl.me/blog/2023/github_workflow_to_publish_ios_app/
