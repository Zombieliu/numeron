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
  buyRuntimeXp,
  buyRuntimeShopOffer,
  deployRuntimeBenchUnit,
  getRuntimeBootSnapshot,
  launchRuntime,
  rerollRuntimeShop,
  resetRuntimeRound,
  restartRuntimeRun,
  toggleRuntimeShopLock,
  sellRuntimeBenchUnit,
  sellRuntimeBoardUnit,
  setRuntimeSessionConfig,
  startRuntimeCombat,
  setRuntimeVirtualInput,
  subscribeToRuntimeBootStatus,
  subscribeToRuntimeEvents,
  withdrawRuntimeBoardUnit,
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
    case "runtime.round.start": {
      startRuntimeCombat();
      return currentSnapshot;
    }
    case "runtime.round.reset": {
      resetRuntimeRound();
      return currentSnapshot;
    }
    case "runtime.run.restart": {
      restartRuntimeRun();
      return currentSnapshot;
    }
    case "runtime.shop.reroll": {
      rerollRuntimeShop();
      return currentSnapshot;
    }
    case "runtime.shop.buy-xp": {
      buyRuntimeXp();
      return currentSnapshot;
    }
    case "runtime.shop.lock.toggle": {
      toggleRuntimeShopLock();
      return currentSnapshot;
    }
    case "runtime.shop.buy": {
      buyRuntimeShopOffer(intent.index);
      return currentSnapshot;
    }
    case "runtime.board.deploy": {
      deployRuntimeBenchUnit(intent.benchIndex, intent.slotIndex);
      return currentSnapshot;
    }
    case "runtime.board.withdraw": {
      withdrawRuntimeBoardUnit(intent.slotIndex);
      return currentSnapshot;
    }
    case "runtime.bench.sell": {
      sellRuntimeBenchUnit(intent.benchIndex);
      return currentSnapshot;
    }
    case "runtime.board.sell": {
      sellRuntimeBoardUnit(intent.slotIndex);
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
    locale: value?.locale === "zh-CN" ? "zh-CN" : DEFAULT_RUNTIME_BOOT_CONFIG.locale,
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
      runNumber: Number(
        projection.slice?.runNumber ?? DEFAULT_RUNTIME_PROJECTION.slice.runNumber,
      ),
      level: Number(
        projection.slice?.level ?? DEFAULT_RUNTIME_PROJECTION.slice.level,
      ),
      xp: Number(projection.slice?.xp ?? DEFAULT_RUNTIME_PROJECTION.slice.xp),
      xpToNextLevel: Number(
        projection.slice?.xpToNextLevel ??
          DEFAULT_RUNTIME_PROJECTION.slice.xpToNextLevel,
      ),
      maxLevel: Number(
        projection.slice?.maxLevel ?? DEFAULT_RUNTIME_PROJECTION.slice.maxLevel,
      ),
      rerollCost: Number(
        projection.slice?.rerollCost ??
          DEFAULT_RUNTIME_PROJECTION.slice.rerollCost,
      ),
      xpBuyCost: Number(
        projection.slice?.xpBuyCost ?? DEFAULT_RUNTIME_PROJECTION.slice.xpBuyCost,
      ),
      shopLocked: Boolean(
        projection.slice?.shopLocked ??
          DEFAULT_RUNTIME_PROJECTION.slice.shopLocked,
      ),
      shopOffers: Array.isArray(projection.slice?.shopOffers)
        ? projection.slice.shopOffers.map(normalizeRuntimeUnitView)
        : DEFAULT_RUNTIME_PROJECTION.slice.shopOffers,
      benchUnits: Array.isArray(projection.slice?.benchUnits)
        ? projection.slice.benchUnits.map(normalizeRuntimeUnitView)
        : DEFAULT_RUNTIME_PROJECTION.slice.benchUnits,
      playerBoard: Array.isArray(projection.slice?.playerBoard)
        ? projection.slice.playerBoard.map((unit) =>
            unit == null ? null : normalizeRuntimeUnitView(unit),
          )
        : DEFAULT_RUNTIME_PROJECTION.slice.playerBoard,
      enemyBoard: Array.isArray(projection.slice?.enemyBoard)
        ? projection.slice.enemyBoard.map((unit) =>
            unit == null ? null : normalizeRuntimeUnitView(unit),
          )
        : DEFAULT_RUNTIME_PROJECTION.slice.enemyBoard,
      unitRoster: Array.isArray(projection.slice?.unitRoster)
        ? projection.slice.unitRoster.map(normalizeRuntimeUnitView)
        : DEFAULT_RUNTIME_PROJECTION.slice.unitRoster,
      activeTraits: Array.isArray(projection.slice?.activeTraits)
        ? projection.slice.activeTraits.map(normalizeRuntimeTraitView)
        : DEFAULT_RUNTIME_PROJECTION.slice.activeTraits,
      enemyThreat: normalizeNumber(
        projection.slice?.enemyThreat,
        DEFAULT_RUNTIME_PROJECTION.slice.enemyThreat,
      ),
      enemyIntent: String(
        projection.slice?.enemyIntent ??
          DEFAULT_RUNTIME_PROJECTION.slice.enemyIntent,
      ),
      benchCapacity: Number(
        projection.slice?.benchCapacity ??
          DEFAULT_RUNTIME_PROJECTION.slice.benchCapacity,
      ),
      boardCapacity: Number(
        projection.slice?.boardCapacity ??
          DEFAULT_RUNTIME_PROJECTION.slice.boardCapacity,
      ),
      deploymentCap: Number(
        projection.slice?.deploymentCap ??
          DEFAULT_RUNTIME_PROJECTION.slice.deploymentCap,
      ),
      streak: Number(
        projection.slice?.streak ?? DEFAULT_RUNTIME_PROJECTION.slice.streak,
      ),
      baseIncome: Number(
        projection.slice?.baseIncome ?? DEFAULT_RUNTIME_PROJECTION.slice.baseIncome,
      ),
      interestIncome: Number(
        projection.slice?.interestIncome ??
          DEFAULT_RUNTIME_PROJECTION.slice.interestIncome,
      ),
      streakIncome: Number(
        projection.slice?.streakIncome ??
          DEFAULT_RUNTIME_PROJECTION.slice.streakIncome,
      ),
      roundResolved: Boolean(
        projection.slice?.roundResolved ??
          DEFAULT_RUNTIME_PROJECTION.slice.roundResolved,
      ),
      runOver: Boolean(
        projection.slice?.runOver ?? DEFAULT_RUNTIME_PROJECTION.slice.runOver,
      ),
      runResult:
        projection.slice?.runResult === "victory" ||
        projection.slice?.runResult === "defeat"
          ? projection.slice.runResult
          : DEFAULT_RUNTIME_PROJECTION.slice.runResult,
      completed: Boolean(
        projection.slice?.completed ?? projection.slice?.runOver,
      ),
    },
  };
}

function emit(event: RuntimeEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

function normalizeRuntimeUnitView(value: unknown) {
  const unit = typeof value === "object" && value ? value : {};
  const record = unit as Record<string, unknown>;

  return {
    label: String(record.label ?? "Unknown Unit"),
    archetype: normalizeArchetype(record.archetype),
    faction: normalizeFaction(record.faction),
    role: normalizeRole(record.role),
    skill: String(record.skill ?? "Basic strike"),
    tempoLabel: String(record.tempoLabel ?? "Basic attack cadence"),
    castState: String(record.castState ?? "Ready"),
    targetRule: String(record.targetRule ?? "Targets the front line."),
    stars: normalizeNumber(record.stars, 1),
    attack: normalizeNumber(record.attack, 1),
    health: normalizeNumber(record.health, 1),
    sellValue: normalizeNumber(record.sellValue, 1),
  } as const;
}

function normalizeRuntimeTraitView(value: unknown) {
  const trait = typeof value === "object" && value ? value : {};
  const record = trait as Record<string, unknown>;

  return {
    key: normalizeTraitKey(record.key),
    label: String(record.label ?? "Trait"),
    count: normalizeNumber(record.count, 0),
    threshold: normalizeNumber(record.threshold, 2),
    description: String(record.description ?? ""),
    active: Boolean(record.active),
  } as const;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function normalizeArchetype(value: unknown) {
  switch (value) {
    case "verdant-bruiser":
    case "signal-ranger":
    case "ash-duelist":
    case "iron-vanguard":
    case "frost-oracle":
    case "ember-medic":
    case "volt-juggler":
    case "grave-warden":
      return value;
    default:
      return "verdant-bruiser";
  }
}

function normalizeFaction(value: unknown) {
  return value === "dusk" ? "dusk" : "dawn";
}

function normalizeRole(value: unknown) {
  return value === "skirmisher" ? "skirmisher" : "vanguard";
}

function normalizeTraitKey(value: unknown) {
  switch (value) {
    case "dawn":
    case "dusk":
    case "vanguard":
    case "skirmisher":
      return value;
    default:
      return "dawn";
  }
}
