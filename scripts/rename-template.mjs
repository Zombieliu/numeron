#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));

const displayName = required(args, "display-name");
const crateName = required(args, "crate-name");
const repoSlug = required(args, "repo-slug");
const bundleId = required(args, "bundle-id");
const authorName = args["author-name"] ?? "Your Name";
const repoUrl = args["repo-url"] ?? `https://github.com/your-account/${repoSlug}`;

const appName = pascalCase(displayName);
const executableName = crateName;
const wasmPackageName = `${crateName}_runtime`;
const serverPackageName = `${crateName}_headless_backend`;
const webPackageName = `${repoSlug}-web`;

const replacements = [
  ["Bevy Hybrid Game Template", displayName],
  ["Bevy Hybrid Game", displayName],
  ["bevy_hybrid_game", executableName],
  ["bevy_hybrid_game_headless_backend", serverPackageName],
  ["bevy-hybrid-game-template-web", webPackageName],
  ["bevy-hybrid-game-template", repoSlug],
  ["bevy_hybrid_game_runtime", wasmPackageName],
  ["BevyHybridGame", appName],
  ["com.zombieliu.bevyhybridgame", bundleId],
  ["Henry Liu", authorName],
  ["https://github.com/Zombieliu/bevy-hybrid-game-template", repoUrl],
].map(([from, to], index) => ({
  from,
  to,
  token: `__TEMPLATE_RENAME_${index}__`,
}));

const files = [
  "Cargo.toml",
  "README.md",
  "TEMPLATE_SETUP.md",
  "flake.nix",
  "package.json",
  "mobile/Cargo.toml",
  "mobile/manifest.yaml",
  "mobile/src/lib.rs",
  "src/main.rs",
  "src/runtime_app.rs",
  "server/headless_runtime/Cargo.toml",
  "server/headless_runtime/README.md",
  "apps/web/package.json",
  "apps/web/app/layout.tsx",
  "apps/web/components/game-shell.tsx",
  "apps/web/lib/runtime-client.ts",
  ".github/workflows/release.yaml",
  ".github/workflows/release-android-google-play.yaml",
  ".github/workflows/release-ios-testflight.yaml",
  "build/macos/src/Game.app/Contents/Info.plist",
  "build/windows/installer/Package.wxs",
];

for (const relativePath of files) {
  const absolutePath = path.join(repoRoot, relativePath);
  let content = await readFile(absolutePath, "utf8");

  for (const replacement of replacements) {
    content = content.split(replacement.from).join(replacement.token);
  }

  for (const replacement of replacements) {
    content = content.split(replacement.token).join(replacement.to);
  }

  await writeFile(absolutePath, content);
}

console.log(`Renamed template to ${displayName}`);
console.log(`crate: ${crateName}`);
console.log(`repo: ${repoSlug}`);
console.log(`bundle id: ${bundleId}`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--") {
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const inlineSeparator = key.indexOf("=");

    if (inlineSeparator >= 0) {
      parsed[key.slice(0, inlineSeparator)] = key.slice(inlineSeparator + 1);
      continue;
    }

    const value = argv[index + 1];
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function required(parsed, key) {
  const value = parsed[key];
  if (!value) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function pascalCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
