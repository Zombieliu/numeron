#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_DIR="$ROOT_DIR/apps/web/public/bevy-runtime/pkg"
WEB_ASSETS_DIR="$ROOT_DIR/apps/web/public/assets"
SOURCE_ASSETS_DIR="$ROOT_DIR/assets"
BUILD_PROFILE="${1:-release}"

case "$BUILD_PROFILE" in
  dev)
    PROFILE_FLAG="--dev"
    ;;
  release)
    PROFILE_FLAG="--release"
    ;;
  *)
    echo "Unsupported build profile: $BUILD_PROFILE" >&2
    echo "Usage: $0 [dev|release]" >&2
    exit 1
    ;;
esac

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "wasm-pack is required but not installed." >&2
  exit 1
fi

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"
rm -rf "$WEB_ASSETS_DIR"
mkdir -p "$WEB_ASSETS_DIR"

cp -R "$SOURCE_ASSETS_DIR"/. "$WEB_ASSETS_DIR"/

wasm-pack build \
  "$ROOT_DIR" \
  --target web \
  "$PROFILE_FLAG" \
  --out-dir "$PKG_DIR" \
  --out-name numeron_runtime

rm -f "$PKG_DIR/.gitignore" "$PKG_DIR/package.json"
