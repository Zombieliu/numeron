import {
  DEFAULT_RUNTIME_BOOT_CONFIG,
  DEFAULT_RUNTIME_PROJECTION,
  DEFAULT_VIRTUAL_INPUT_STATE,
  type RuntimeAdapterEventPayload,
  type RuntimeBootConfig,
  type RuntimeBootPhase,
  type RuntimeBootRecord,
  type RuntimeProjection,
  type VirtualInputState,
} from "@/lib/types";

const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const RUNTIME_MODULE_PATH = `${PUBLIC_BASE_PATH}/bevy-runtime/pkg/numeron_runtime.js`;
const MAX_BOOT_EVENTS = 8;

export type RuntimeBootSnapshot = {
  current: RuntimeBootRecord;
  history: RuntimeBootRecord[];
};

type RuntimeModule = {
  default?: (input?: string | URL | Request) => Promise<unknown>;
  bootRuntime?: () => void;
  setRuntimeBootStatusSink?: (
    callback: (payload: { phase?: RuntimeBootPhase; message?: string }) => void,
  ) => void;
  clearRuntimeBootStatusSink?: () => void;
  setRuntimeEventSink?: (callback: (payload: RuntimeAdapterEventPayload) => void) => void;
  clearRuntimeEventSink?: () => void;
  setRuntimeSessionConfig?: (playerName: string, touchControls: boolean) => void;
  setRuntimeVirtualInput?: (x: number, y: number) => void;
  startRuntimeCombat?: () => void;
  resetRuntimeRound?: () => void;
  rerollRuntimeShop?: () => void;
  buyRuntimeShopOffer?: (index: number) => void;
};

const listeners = new Set<(snapshot: RuntimeBootSnapshot) => void>();
const runtimeEventListeners = new Set<(event: RuntimeAdapterEventPayload) => void>();

let nextBootEventId = 1;
let bootPromise: Promise<void> | null = null;
let runtimeStarted = false;
let runtimeModule: RuntimeModule | null = null;
let pendingSessionConfig = DEFAULT_RUNTIME_BOOT_CONFIG;
let pendingVirtualInput = DEFAULT_VIRTUAL_INPUT_STATE;

let currentSnapshot: RuntimeBootSnapshot = {
  current: createEvent("idle", "Configure the shell, then launch the runtime.", "shell"),
  history: [],
};

currentSnapshot = {
  current: currentSnapshot.current,
  history: [currentSnapshot.current],
};

export function getRuntimeBootSnapshot(): RuntimeBootSnapshot {
  return currentSnapshot;
}

export function subscribeToRuntimeBootStatus(listener: (snapshot: RuntimeBootSnapshot) => void) {
  listeners.add(listener);
  listener(currentSnapshot);

  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToRuntimeEvents(
  listener: (event: RuntimeAdapterEventPayload) => void,
) {
  runtimeEventListeners.add(listener);

  return () => {
    runtimeEventListeners.delete(listener);
  };
}

export function setRuntimeSessionConfig(config: RuntimeBootConfig) {
  pendingSessionConfig = {
    playerName: config.playerName.trim() || DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
    touchControls: config.touchControls,
  };

  runtimeModule?.setRuntimeSessionConfig?.(
    pendingSessionConfig.playerName,
    pendingSessionConfig.touchControls,
  );
}

export function setRuntimeVirtualInput(input: VirtualInputState) {
  pendingVirtualInput = {
    x: clampAxis(input.x),
    y: clampAxis(input.y),
  };

  runtimeModule?.setRuntimeVirtualInput?.(pendingVirtualInput.x, pendingVirtualInput.y);
}

export function launchRuntime(config: RuntimeBootConfig) {
  setRuntimeSessionConfig(config);
  return ensureRuntimeBoot();
}

export function startRuntimeCombat() {
  runtimeModule?.startRuntimeCombat?.();
}

export function resetRuntimeRound() {
  runtimeModule?.resetRuntimeRound?.();
}

export function rerollRuntimeShop() {
  runtimeModule?.rerollRuntimeShop?.();
}

export function buyRuntimeShopOffer(index: number) {
  runtimeModule?.buyRuntimeShopOffer?.(index);
}

function ensureRuntimeBoot() {
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = bootRuntime().catch((error: unknown) => {
    runtimeStarted = false;
    bootPromise = null;
    publish("error", formatError(error), "shell");
    throw error;
  });

  return bootPromise;
}

function createEvent(
  phase: RuntimeBootPhase,
  message: string,
  source: RuntimeBootRecord["source"],
): RuntimeBootRecord {
  return {
    id: nextBootEventId++,
    phase,
    message,
    source,
    timestamp: Date.now(),
  };
}

function publish(
  phase: RuntimeBootPhase,
  message: string,
  source: RuntimeBootRecord["source"],
) {
  const nextEvent = createEvent(phase, message, source);
  const history = [...currentSnapshot.history, nextEvent].slice(-MAX_BOOT_EVENTS);

  currentSnapshot = {
    current: nextEvent,
    history,
  };

  for (const listener of listeners) {
    listener(currentSnapshot);
  }
}

async function bootRuntime() {
  if (runtimeStarted) {
    return;
  }

  publish("loading-module", "Loading Bevy WASM runtime module", "shell");

  const loadedRuntime = (await import(
    /* webpackIgnore: true */ RUNTIME_MODULE_PATH
  )) as RuntimeModule;

  publish("initializing-wasm", "Initializing generated wasm glue", "shell");

  if (typeof loadedRuntime.default === "function") {
    await loadedRuntime.default();
  }

  runtimeModule = loadedRuntime;
  applyPendingRuntimeState(loadedRuntime);

  if (typeof loadedRuntime.setRuntimeBootStatusSink === "function") {
    publish("binding-status-sink", "Binding shell boot listener to the runtime", "shell");
    loadedRuntime.setRuntimeBootStatusSink((payload) => {
      if (!payload.phase || !payload.message) {
        return;
      }

      publish(payload.phase, payload.message, "runtime");
    });
  }

  if (typeof loadedRuntime.setRuntimeEventSink === "function") {
    loadedRuntime.setRuntimeEventSink((payload) => {
      publishRuntimeEvent(normalizeRuntimeEventPayload(payload));
    });
  }

  if (typeof loadedRuntime.bootRuntime !== "function") {
    publish("error", "Runtime package loaded, but boot entry is missing.", "shell");
    return;
  }

  publish(
    "starting-runtime",
    `Launching local slice for ${pendingSessionConfig.playerName}`,
    "shell",
  );
  runtimeStarted = true;
  loadedRuntime.bootRuntime();
}

function applyPendingRuntimeState(runtime: RuntimeModule) {
  runtime.setRuntimeSessionConfig?.(
    pendingSessionConfig.playerName,
    pendingSessionConfig.touchControls,
  );
  runtime.setRuntimeVirtualInput?.(pendingVirtualInput.x, pendingVirtualInput.y);
}

function publishRuntimeEvent(event: RuntimeAdapterEventPayload) {
  for (const listener of runtimeEventListeners) {
    listener(event);
  }
}

function normalizeRuntimeEventPayload(
  payload: RuntimeAdapterEventPayload,
): RuntimeAdapterEventPayload {
  const projection = payload.projection ?? DEFAULT_RUNTIME_PROJECTION;

  return {
    origin: "runtime",
    type: payload.type,
    projection: {
      ready: Boolean(projection.ready),
      touchControls: Boolean(projection.touchControls),
      player: projection.player
        ? {
            name: projection.player.name || pendingSessionConfig.playerName,
            x: Number(projection.player.x ?? 0),
            y: Number(projection.player.y ?? 0),
          }
        : null,
      slice: {
        phase:
          projection.slice?.phase || DEFAULT_RUNTIME_PROJECTION.slice.phase,
        objective:
          projection.slice?.objective || DEFAULT_RUNTIME_PROJECTION.slice.objective,
        status: projection.slice?.status || DEFAULT_RUNTIME_PROJECTION.slice.status,
        score: Number(projection.slice?.score ?? 0),
        gold: Number(
          projection.slice?.gold ?? DEFAULT_RUNTIME_PROJECTION.slice.gold,
        ),
        playerHealth: Number(
          projection.slice?.playerHealth ??
            DEFAULT_RUNTIME_PROJECTION.slice.playerHealth,
        ),
        enemyHealth: Number(
          projection.slice?.enemyHealth ??
            DEFAULT_RUNTIME_PROJECTION.slice.enemyHealth,
        ),
        captured: Number(projection.slice?.captured ?? 0),
        total: Number(
          projection.slice?.total ?? DEFAULT_RUNTIME_PROJECTION.slice.total,
        ),
        round: Number(
          projection.slice?.round ?? DEFAULT_RUNTIME_PROJECTION.slice.round,
        ),
        rerollCost: Number(
          projection.slice?.rerollCost ??
            DEFAULT_RUNTIME_PROJECTION.slice.rerollCost,
        ),
        shopOffers: Array.isArray(projection.slice?.shopOffers)
          ? projection.slice.shopOffers.map((offer) => String(offer))
          : DEFAULT_RUNTIME_PROJECTION.slice.shopOffers,
        completed: Boolean(projection.slice?.completed),
      },
    },
  };
}

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed.replace(/\/$/, "") : `/${trimmed.replace(/\/$/, "")}`;
}
