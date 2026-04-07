import {
  DEFAULT_RUNTIME_BOOT_CONFIG,
  DEFAULT_RUNTIME_PROJECTION,
  DEFAULT_VIRTUAL_INPUT_STATE,
  type RuntimeAdapterEventPayload,
  type RuntimeBootConfig,
  type RuntimeBootPhase,
  type RuntimeEvent,
  type RuntimeProjection,
  type RuntimeSnapshot,
  type UiIntent,
  type VirtualInputState,
} from "@/lib/types";
import {
  getRuntimeBootSnapshot,
  launchRuntime,
  setRuntimeSessionConfig,
  setRuntimeVirtualInput,
  subscribeToRuntimeBootStatus,
  subscribeToRuntimeEvents,
} from "@/lib/runtime-client";

type BootRuntimeBridgeOptions = {
  initialConfig?: Partial<RuntimeBootConfig>;
};

const ACTIVE_PHASES = new Set<RuntimeBootPhase>([
  "loading-module",
  "initializing-wasm",
  "binding-status-sink",
  "starting-runtime",
  "runtime-entered",
  "app-created",
  "plugins-configured",
  "running",
  "scene-ready",
]);

const listeners = new Set<(event: RuntimeEvent) => void>();

let bridgeReady = false;
let runtimeBootSnapshot = getRuntimeBootSnapshot();
let bootConfig = DEFAULT_RUNTIME_BOOT_CONFIG;
let worldProjection = DEFAULT_RUNTIME_PROJECTION;
let inputState = DEFAULT_VIRTUAL_INPUT_STATE;
let unsubscribeFromRuntime: (() => void) | null = null;
let unsubscribeFromRuntimeEvents: (() => void) | null = null;
let currentSnapshot = buildSnapshot();

export function bootRuntimeBridge(
  options: BootRuntimeBridgeOptions = {},
): RuntimeSnapshot {
  if (options.initialConfig) {
    bootConfig = sanitizeRuntimeBootConfig(options.initialConfig);
    setRuntimeSessionConfig(bootConfig);
    currentSnapshot = buildSnapshot();
  }

  if (!unsubscribeFromRuntime) {
    unsubscribeFromRuntime = subscribeToRuntimeBootStatus((nextBootSnapshot) => {
      runtimeBootSnapshot = nextBootSnapshot;
      syncSnapshot("boot-status");
      emit({
        type: "runtime.boot-status.changed",
        record: currentSnapshot.boot.current,
        snapshot: currentSnapshot,
      });
    });
  }

  if (!unsubscribeFromRuntimeEvents) {
    unsubscribeFromRuntimeEvents = subscribeToRuntimeEvents((event) => {
      applyRuntimeProjectionEvent(event);
    });
  }

  if (!bridgeReady) {
    bridgeReady = true;
    emit({
      type: "bridge.ready",
      snapshot: currentSnapshot,
    });
  }

  return currentSnapshot;
}

export async function dispatchUiIntent(intent: UiIntent): Promise<RuntimeSnapshot> {
  switch (intent.type) {
    case "runtime.boot-config.patch": {
      bootConfig = sanitizeRuntimeBootConfig({
        ...bootConfig,
        ...intent.patch,
      });
      setRuntimeSessionConfig(bootConfig);
      syncSnapshot("boot-config");
      return currentSnapshot;
    }
    case "runtime.virtual-input.set": {
      inputState = sanitizeVirtualInput(intent.input);
      setRuntimeVirtualInput(inputState);
      syncSnapshot("input");
      return currentSnapshot;
    }
    case "runtime.boot": {
      if (intent.config) {
        bootConfig = sanitizeRuntimeBootConfig(intent.config);
      }

      await launchRuntime(bootConfig);
      return currentSnapshot;
    }
  }
}

export function subscribeRuntimeEvents(listener: (event: RuntimeEvent) => void) {
  listeners.add(listener);

  if (bridgeReady) {
    listener({
      type: "bridge.ready",
      snapshot: currentSnapshot,
    });
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getRuntimeSnapshot(): RuntimeSnapshot {
  return currentSnapshot;
}

export function sanitizeRuntimeBootConfig(
  value: Partial<RuntimeBootConfig> | null | undefined,
): RuntimeBootConfig {
  const playerName =
    typeof value?.playerName === "string" && value.playerName.trim()
      ? value.playerName.trim().slice(0, 16)
      : DEFAULT_RUNTIME_BOOT_CONFIG.playerName;

  return {
    playerName,
    touchControls:
      typeof value?.touchControls === "boolean"
        ? value.touchControls
        : DEFAULT_RUNTIME_BOOT_CONFIG.touchControls,
  };
}

function sanitizeVirtualInput(input: VirtualInputState): VirtualInputState {
  return {
    x: clampAxis(input.x),
    y: clampAxis(input.y),
  };
}

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function syncSnapshot(reason: "boot-config" | "boot-status" | "input" | "world") {
  currentSnapshot = buildSnapshot();

  emit({
    type: "runtime.snapshot.changed",
    reason,
    snapshot: currentSnapshot,
  });
}

function buildSnapshot(): RuntimeSnapshot {
  return {
    boot: runtimeBootSnapshot,
    bootConfig,
    world: worldProjection,
    input: inputState,
    runtimeActive: ACTIVE_PHASES.has(runtimeBootSnapshot.current.phase),
  };
}

function applyRuntimeProjectionEvent(event: RuntimeAdapterEventPayload) {
  worldProjection = normalizeProjection(event.projection);
  syncSnapshot("world");

  if (event.type === "runtime.ready") {
    emit({
      type: "runtime.ready",
      projection: worldProjection,
      snapshot: currentSnapshot,
    });
  }
}

function normalizeProjection(projection: RuntimeProjection): RuntimeProjection {
  return {
    ready: Boolean(projection.ready),
    touchControls: Boolean(projection.touchControls),
    player: projection.player
      ? {
          name: projection.player.name || bootConfig.playerName,
          x: Number(projection.player.x ?? 0),
          y: Number(projection.player.y ?? 0),
        }
      : null,
    slice: {
      objective:
        projection.slice?.objective || DEFAULT_RUNTIME_PROJECTION.slice.objective,
      status: projection.slice?.status || DEFAULT_RUNTIME_PROJECTION.slice.status,
      score: Number(projection.slice?.score ?? 0),
      captured: Number(projection.slice?.captured ?? 0),
      total: Number(
        projection.slice?.total ?? DEFAULT_RUNTIME_PROJECTION.slice.total,
      ),
      round: Number(
        projection.slice?.round ?? DEFAULT_RUNTIME_PROJECTION.slice.round,
      ),
      completed: Boolean(projection.slice?.completed),
    },
  };
}

function emit(event: RuntimeEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}
