import {
  DEFAULT_RUNTIME_BOOT_CONFIG,
  DEFAULT_RUNTIME_PROJECTION,
  DEFAULT_VIRTUAL_INPUT_STATE,
  type RuntimeAdapterEventPayload,
  type RuntimeBootConfig,
  type RuntimeCombatDirectiveInput,
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
  setRuntimeEventSink?: (
    callback: (payload: RuntimeAdapterEventPayload) => void,
  ) => void;
  clearRuntimeEventSink?: () => void;
  setRuntimeSessionConfig?: (
    playerName: string,
    touchControls: boolean,
    locale: "en" | "zh-CN",
  ) => void;
  setRuntimeResumeState?: (resumeStateJson?: string | null) => void;
  setRuntimeVirtualInput?: (x: number, y: number) => void;
  startRuntimeCombat?: () => void;
  resetRuntimeRound?: () => void;
  restartRuntimeRun?: () => void;
  rerollRuntimeShop?: () => void;
  buyRuntimeXp?: () => void;
  chooseRuntimeAugment?: (index: number) => void;
  toggleRuntimeShopLock?: () => void;
  buyRuntimeShopOffer?: (index: number) => void;
  deployRuntimeBenchUnit?: (benchIndex: number, slotIndex: number) => void;
  repositionRuntimeBoardUnit?: (fromSlot: number, toSlot: number) => void;
  withdrawRuntimeBoardUnit?: (slotIndex: number) => void;
  sellRuntimeBenchUnit?: (benchIndex: number) => void;
  sellRuntimeBoardUnit?: (slotIndex: number) => void;
  setRuntimeCombatDirective?: (
    directiveKey: string,
    laneKey: string,
    durationTicks: number,
  ) => void;
  replaceRuntimeCombatPlan?: (planJson: string) => void;
  clearRuntimeCombatDirective?: () => void;
};

const listeners = new Set<(snapshot: RuntimeBootSnapshot) => void>();
const runtimeEventListeners = new Set<
  (event: RuntimeAdapterEventPayload) => void
>();

let nextBootEventId = 1;
let bootPromise: Promise<void> | null = null;
let runtimeStarted = false;
let runtimeModule: RuntimeModule | null = null;
let pendingSessionConfig = DEFAULT_RUNTIME_BOOT_CONFIG;
let pendingResumeState: string | null = null;
let pendingVirtualInput = DEFAULT_VIRTUAL_INPUT_STATE;

let currentSnapshot: RuntimeBootSnapshot = {
  current: createEvent(
    "idle",
    "Configure the shell, then launch the runtime.",
    "shell",
  ),
  history: [],
};

currentSnapshot = {
  current: currentSnapshot.current,
  history: [currentSnapshot.current],
};

export function getRuntimeBootSnapshot(): RuntimeBootSnapshot {
  return currentSnapshot;
}

export function subscribeToRuntimeBootStatus(
  listener: (snapshot: RuntimeBootSnapshot) => void,
) {
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
    playerName:
      config.playerName.trim() || DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
    touchControls: config.touchControls,
    locale:
      config.locale === "zh-CN" ? "zh-CN" : DEFAULT_RUNTIME_BOOT_CONFIG.locale,
  };

  runtimeModule?.setRuntimeSessionConfig?.(
    pendingSessionConfig.playerName,
    pendingSessionConfig.touchControls,
    pendingSessionConfig.locale,
  );
}

export function setRuntimeVirtualInput(input: VirtualInputState) {
  pendingVirtualInput = {
    x: clampAxis(input.x),
    y: clampAxis(input.y),
  };

  runtimeModule?.setRuntimeVirtualInput?.(
    pendingVirtualInput.x,
    pendingVirtualInput.y,
  );
}

export function setRuntimeResumeState(resumeState: string | null | undefined) {
  pendingResumeState =
    typeof resumeState === "string" && resumeState.trim() ? resumeState : null;
  runtimeModule?.setRuntimeResumeState?.(pendingResumeState ?? undefined);
}

export function launchRuntime(
  config: RuntimeBootConfig,
  resumeState?: string | null,
) {
  setRuntimeSessionConfig(config);
  setRuntimeResumeState(resumeState);
  return ensureRuntimeBoot();
}

export function startRuntimeCombat() {
  runtimeModule?.startRuntimeCombat?.();
}

export function resetRuntimeRound() {
  runtimeModule?.resetRuntimeRound?.();
}

export function restartRuntimeRun() {
  runtimeModule?.restartRuntimeRun?.();
}

export function rerollRuntimeShop() {
  runtimeModule?.rerollRuntimeShop?.();
}

export function buyRuntimeXp() {
  runtimeModule?.buyRuntimeXp?.();
}

export function chooseRuntimeAugment(index: number) {
  runtimeModule?.chooseRuntimeAugment?.(index);
}

export function toggleRuntimeShopLock() {
  runtimeModule?.toggleRuntimeShopLock?.();
}

export function buyRuntimeShopOffer(index: number) {
  runtimeModule?.buyRuntimeShopOffer?.(index);
}

export function deployRuntimeBenchUnit(benchIndex: number, slotIndex: number) {
  runtimeModule?.deployRuntimeBenchUnit?.(benchIndex, slotIndex);
}

export function withdrawRuntimeBoardUnit(slotIndex: number) {
  runtimeModule?.withdrawRuntimeBoardUnit?.(slotIndex);
}

export function repositionRuntimeBoardUnit(fromSlot: number, toSlot: number) {
  runtimeModule?.repositionRuntimeBoardUnit?.(fromSlot, toSlot);
}

export function sellRuntimeBenchUnit(benchIndex: number) {
  runtimeModule?.sellRuntimeBenchUnit?.(benchIndex);
}

export function sellRuntimeBoardUnit(slotIndex: number) {
  runtimeModule?.sellRuntimeBoardUnit?.(slotIndex);
}

export function setRuntimeCombatDirective(
  directive: RuntimeCombatDirectiveInput,
) {
  runtimeModule?.setRuntimeCombatDirective?.(
    directive.key,
    directive.lane ?? "",
    Math.max(0, Math.floor(directive.durationTicks ?? 0)),
  );
}

export function replaceRuntimeCombatPlan(plan: RuntimeCombatDirectiveInput[]) {
  runtimeModule?.replaceRuntimeCombatPlan?.(JSON.stringify(plan));
}

export function clearRuntimeCombatDirective() {
  runtimeModule?.clearRuntimeCombatDirective?.();
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
  const history = [...currentSnapshot.history, nextEvent].slice(
    -MAX_BOOT_EVENTS,
  );

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
    publish(
      "binding-status-sink",
      "Binding shell boot listener to the runtime",
      "shell",
    );
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
    publish(
      "error",
      "Runtime package loaded, but boot entry is missing.",
      "shell",
    );
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
    pendingSessionConfig.locale,
  );
  runtime.setRuntimeResumeState?.(pendingResumeState ?? undefined);
  runtime.setRuntimeVirtualInput?.(
    pendingVirtualInput.x,
    pendingVirtualInput.y,
  );
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
          projection.slice?.objective ||
          DEFAULT_RUNTIME_PROJECTION.slice.objective,
        status:
          projection.slice?.status || DEFAULT_RUNTIME_PROJECTION.slice.status,
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
          projection.slice?.runNumber ??
            DEFAULT_RUNTIME_PROJECTION.slice.runNumber,
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
          projection.slice?.maxLevel ??
            DEFAULT_RUNTIME_PROJECTION.slice.maxLevel,
        ),
        rerollCost: Number(
          projection.slice?.rerollCost ??
            DEFAULT_RUNTIME_PROJECTION.slice.rerollCost,
        ),
        xpBuyCost: Number(
          projection.slice?.xpBuyCost ??
            DEFAULT_RUNTIME_PROJECTION.slice.xpBuyCost,
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
        selectedAugments: Array.isArray(projection.slice?.selectedAugments)
          ? projection.slice.selectedAugments.map(normalizeRuntimeAugmentView)
          : DEFAULT_RUNTIME_PROJECTION.slice.selectedAugments,
        pendingAugments: Array.isArray(projection.slice?.pendingAugments)
          ? projection.slice.pendingAugments.map(normalizeRuntimeAugmentView)
          : DEFAULT_RUNTIME_PROJECTION.slice.pendingAugments,
        runModifier: projection.slice?.runModifier
          ? normalizeRuntimeRunModifierView(projection.slice.runModifier)
          : DEFAULT_RUNTIME_PROJECTION.slice.runModifier,
        roundEvent: projection.slice?.roundEvent
          ? normalizeRuntimeRoundEventView(projection.slice.roundEvent)
          : DEFAULT_RUNTIME_PROJECTION.slice.roundEvent,
        roundHistory: Array.isArray(projection.slice?.roundHistory)
          ? projection.slice.roundHistory.map(normalizeRuntimeRoundSummaryView)
          : DEFAULT_RUNTIME_PROJECTION.slice.roundHistory,
        activeCombatDirective: projection.slice?.activeCombatDirective
          ? normalizeRuntimeCombatDirectiveView(
              projection.slice.activeCombatDirective,
            )
          : DEFAULT_RUNTIME_PROJECTION.slice.activeCombatDirective,
        queuedCombatDirectives: Array.isArray(
          projection.slice?.queuedCombatDirectives,
        )
          ? projection.slice.queuedCombatDirectives.map(
              normalizeRuntimeCombatDirectiveView,
            )
          : DEFAULT_RUNTIME_PROJECTION.slice.queuedCombatDirectives,
        combatFeed: Array.isArray(projection.slice?.combatFeed)
          ? projection.slice.combatFeed.map((entry) => String(entry))
          : DEFAULT_RUNTIME_PROJECTION.slice.combatFeed,
        augmentDraftRound: clampPositiveNumber(
          projection.slice?.augmentDraftRound,
          DEFAULT_RUNTIME_PROJECTION.slice.augmentDraftRound,
        ),
        enemyThreat: clampPositiveNumber(
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
          projection.slice?.baseIncome ??
            DEFAULT_RUNTIME_PROJECTION.slice.baseIncome,
        ),
        interestIncome: Number(
          projection.slice?.interestIncome ??
            DEFAULT_RUNTIME_PROJECTION.slice.interestIncome,
        ),
        streakIncome: Number(
          projection.slice?.streakIncome ??
            DEFAULT_RUNTIME_PROJECTION.slice.streakIncome,
        ),
        incomeBaseTotal: Number(
          projection.slice?.incomeBaseTotal ??
            DEFAULT_RUNTIME_PROJECTION.slice.incomeBaseTotal,
        ),
        incomeInterestTotal: Number(
          projection.slice?.incomeInterestTotal ??
            DEFAULT_RUNTIME_PROJECTION.slice.incomeInterestTotal,
        ),
        incomeStreakTotal: Number(
          projection.slice?.incomeStreakTotal ??
            DEFAULT_RUNTIME_PROJECTION.slice.incomeStreakTotal,
        ),
        incomeModifierTotal: Number(
          projection.slice?.incomeModifierTotal ??
            DEFAULT_RUNTIME_PROJECTION.slice.incomeModifierTotal,
        ),
        incomeEventTotal: Number(
          projection.slice?.incomeEventTotal ??
            DEFAULT_RUNTIME_PROJECTION.slice.incomeEventTotal,
        ),
        roundDiagnosis: String(
          projection.slice?.roundDiagnosis ??
            DEFAULT_RUNTIME_PROJECTION.slice.roundDiagnosis,
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
        serializedRunState:
          typeof projection.slice?.serializedRunState === "string" &&
          projection.slice.serializedRunState.trim()
            ? projection.slice.serializedRunState
            : null,
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

function normalizeRuntimeUnitView(value: unknown) {
  const unit = typeof value === "object" && value ? value : {};
  const record = unit as Record<string, unknown>;

  return {
    agentId: String(record.agentId ?? "0"),
    battleInstanceId: String(record.battleInstanceId ?? "0"),
    label: String(record.label ?? "Unknown Unit"),
    archetype: normalizeArchetype(record.archetype),
    faction: normalizeFaction(record.faction),
    role: normalizeRole(record.role),
    skill: String(record.skill ?? "Basic strike"),
    tempoLabel: String(record.tempoLabel ?? "Basic attack cadence"),
    castState: String(record.castState ?? "Ready"),
    targetRule: String(record.targetRule ?? "Targets the front line."),
    stars: clampPositiveNumber(record.stars, 1),
    attack: clampPositiveNumber(record.attack, 1),
    health: clampPositiveNumber(record.health, 1),
    sellValue: clampPositiveNumber(record.sellValue, 1),
  } as const;
}

function normalizeRuntimeTraitView(value: unknown) {
  const trait = typeof value === "object" && value ? value : {};
  const record = trait as Record<string, unknown>;

  return {
    key: normalizeTraitKey(record.key),
    label: String(record.label ?? "Trait"),
    count: clampPositiveNumber(record.count, 0),
    threshold: clampPositiveNumber(record.threshold, 2),
    capstoneThreshold: clampPositiveNumber(record.capstoneThreshold, 4),
    tier: clampPositiveNumber(record.tier, 0),
    description: String(record.description ?? ""),
    active: Boolean(record.active),
  } as const;
}

function normalizeRuntimeAugmentView(value: unknown) {
  const augment = typeof value === "object" && value ? value : {};
  const record = augment as Record<string, unknown>;

  return {
    key: normalizeAugmentKey(record.key),
    label: String(record.label ?? "Augment"),
    description: String(record.description ?? ""),
  } as const;
}

function normalizeRuntimeCombatDirectiveView(value: unknown) {
  const directive = typeof value === "object" && value ? value : {};
  const record = directive as Record<string, unknown>;
  const key = record.key;
  const lane = record.lane;

  return {
    key:
      key === "focus-backline" ||
      key === "hold-skills" ||
      key === "fallback-left"
        ? key
        : "fallback-left",
    label: String(record.label ?? "Fallback Left"),
    description: String(
      record.description ??
        "Shift left and buy time before recommitting the board.",
    ),
    lane:
      lane === "left" || lane === "center" || lane === "right" ? lane : null,
    durationTicks: clampPositiveNumber(record.durationTicks, 1),
    remainingTicks: clampPositiveNumber(record.remainingTicks, 1),
  } as const;
}

function normalizeRuntimeRunModifierView(value: unknown) {
  const modifier = typeof value === "object" && value ? value : {};
  const record = modifier as Record<string, unknown>;

  return {
    key: normalizeRunModifierKey(record.key),
    label: String(record.label ?? "Rich Opening"),
    description: String(record.description ?? ""),
    routeHint: String(record.routeHint ?? ""),
  } as const;
}

function normalizeRuntimeRoundEventView(value: unknown) {
  const event = typeof value === "object" && value ? value : {};
  const record = event as Record<string, unknown>;

  return {
    key: normalizeRoundEventKey(record.key),
    label: String(record.label ?? "Standard Round"),
    description: String(record.description ?? ""),
    stakes: String(record.stakes ?? ""),
  } as const;
}

function normalizeRuntimeRoundSummaryView(value: unknown) {
  const summary = typeof value === "object" && value ? value : {};
  const record = summary as Record<string, unknown>;

  return {
    round: clampPositiveNumber(record.round, 1),
    result: record.result === "defeat" ? "defeat" : "victory",
    incomeTotal: clampPositiveNumber(record.incomeTotal, 0),
    threat: clampPositiveNumber(record.threat, 0),
    summary: String(record.summary ?? ""),
  } as const;
}

function clampPositiveNumber(value: unknown, fallback: number) {
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
    case "lumen-sentinel":
    case "shade-runner":
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

function normalizeAugmentKey(value: unknown) {
  switch (value) {
    case "compound-interest":
    case "vanguard-doctrine":
    case "skirmisher-drive":
    case "dawn-pulse":
    case "dusk-pact":
    case "emergency-hull":
      return value;
    default:
      return "compound-interest";
  }
}

function normalizeRunModifierKey(value: unknown) {
  switch (value) {
    case "rich-opening":
    case "thin-bench":
    case "dawn-surge":
    case "dusk-surge":
    case "glass-cannon":
    case "augment-storm":
      return value;
    default:
      return "rich-opening";
  }
}

function normalizeRoundEventKey(value: unknown) {
  switch (value) {
    case "training-day":
    case "spoils-of-war":
    case "high-roll-market":
    case "standard":
      return value;
    default:
      return "standard";
  }
}

function normalizeBasePath(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.startsWith("/")
    ? trimmed.replace(/\/$/, "")
    : `/${trimmed.replace(/\/$/, "")}`;
}
