#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v mprocs >/dev/null 2>&1 && [[ -t 1 ]]; then
  exec mprocs -c "$ROOT_DIR/mprocs.yaml"
fi

if command -v mprocs >/dev/null 2>&1; then
  echo "[local:play] no interactive TTY detected, falling back to plain shell orchestration."
else
  echo "[local:play] mprocs not found, falling back to plain shell orchestration."
  echo "[local:play] tip: brew install mprocs"
fi
echo "[local:play] web will be available at http://localhost:3000"

declare -a CHILD_PIDS=()
declare -a LONG_LIVED_PIDS=()

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if ((${#CHILD_PIDS[@]} > 0)); then
    kill "${CHILD_PIDS[@]}" >/dev/null 2>&1 || true
    wait "${CHILD_PIDS[@]}" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

start_proc() {
  local name="$1"
  shift

  (
    "$@" 2>&1 | sed -u "s/^/[$name] /"
  ) &

  CHILD_PIDS+=("$!")
  LONG_LIVED_PIDS+=("$!")
}

start_helper() {
  local name="$1"
  shift

  (
    "$@" 2>&1 | sed -u "s/^/[$name] /"
  ) &

  CHILD_PIDS+=("$!")
}

port_in_use() {
  local port="$1"
  lsof -ti "tcp:${port}" >/dev/null 2>&1
}

kill_repo_listener() {
  local port="$1"
  local marker="$2"
  local fallback_marker="${3:-}"
  local pids

  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    local command
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command" == *"$marker"* ]] || [[ -n "$fallback_marker" && "$command" == *"$fallback_marker"* ]]; then
      echo "[local:play] killing stale process on :${port} (pid=${pid})"
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done <<< "$pids"
}

kill_repo_listener 3000 "$ROOT_DIR/apps/web" "next-server"
kill_repo_listener 3001 "$ROOT_DIR/apps/web" "next-server"
kill_repo_listener 8787 "numeron_headless_backend"

start_proc node pnpm --dir packages/contracts start:localnet
start_helper contracts bash -lc "./packages/contracts/node_modules/.bin/dubhe wait --localnet && pnpm --dir packages/contracts setup:localnet && pnpm local:status"

if port_in_use 3000; then
  echo "[local:play] port 3000 already in use, skipping web startup."
else
  start_proc web pnpm web:dev
fi

if port_in_use 8787; then
  echo "[local:play] port 8787 already in use, skipping backend startup."
else
  start_proc backend pnpm backend:dev
fi

echo "[local:play] running. Press Ctrl+C to stop all child processes."
if ((${#LONG_LIVED_PIDS[@]} == 0)); then
  echo "[local:play] no long-lived processes were started."
  wait "${CHILD_PIDS[@]}"
fi

while true; do
  any_alive=0
  for pid in "${LONG_LIVED_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      any_alive=1
      break
    fi
  done

  if ((any_alive == 0)); then
    break
  fi

  sleep 1
done
