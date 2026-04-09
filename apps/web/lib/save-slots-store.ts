import {
  DEFAULT_RUNTIME_PROFILE,
  DEFAULT_RUNTIME_PROGRESSION,
  type MatchSessionRecord,
  type ProgressionBadge,
  type RuntimeActiveRun,
  type RuntimeAgentRecord,
  type RuntimeAugmentView,
  type RuntimeBattleRecord,
  type RuntimeBootConfig,
  type RuntimePerformanceView,
  type RuntimeProgression,
  type RuntimeRoundSummaryView,
  type RuntimeRunModifierView,
  type RuntimeSaveCollection,
  type RuntimeSaveSlot,
  type RuntimeStarterDoctrineView,
  type RuntimeTraitView,
  type RuntimeUnitView,
  type SaveSlotId,
} from "@/lib/types";
import {
  PROFILE_STORAGE_KEY,
  clearStoredProfile,
  loadStoredProfile,
  sanitizeRuntimeProfile,
} from "@/lib/profile-store";

export const SAVE_COLLECTION_STORAGE_KEY = "numeron.save-collection.v1";

const SLOT_DEFINITIONS: Array<{ id: SaveSlotId; label: string }> = [
  { id: "slot-1", label: "Alpha" },
  { id: "slot-2", label: "Bravo" },
  { id: "slot-3", label: "Charlie" },
];

export function loadStoredSaveCollection(): RuntimeSaveCollection {
  if (typeof window === "undefined") {
    return defaultSaveCollection();
  }

  try {
    const raw = window.localStorage.getItem(SAVE_COLLECTION_STORAGE_KEY);

    if (raw) {
      return sanitizeSaveCollection(JSON.parse(raw));
    }

    const legacyProfileRaw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (legacyProfileRaw) {
      const collection = defaultSaveCollection();
      collection.slots[0] = {
        ...collection.slots[0],
        profile: loadStoredProfile(),
        updatedAt: new Date().toISOString(),
      };
      saveStoredSaveCollection(collection);
      clearStoredProfile();
      return collection;
    }
  } catch {}

  return defaultSaveCollection();
}

export function saveStoredSaveCollection(collection: RuntimeSaveCollection) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SAVE_COLLECTION_STORAGE_KEY,
    JSON.stringify(sanitizeSaveCollection(collection))
  );
}

export function clearStoredSaveCollection() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SAVE_COLLECTION_STORAGE_KEY);
}

export function exportSaveCollection(collection: RuntimeSaveCollection) {
  return JSON.stringify(sanitizeSaveCollection(collection), null, 2);
}

export function importSaveCollection(raw: string): RuntimeSaveCollection {
  return sanitizeSaveCollection(JSON.parse(raw));
}

export function profileToBootConfig(slot: RuntimeSaveSlot): RuntimeBootConfig {
  return {
    playerName: slot.profile.preferredPlayerName,
    touchControls: slot.profile.preferredTouchControls,
    locale: slot.profile.preferredLocale,
    starterDoctrine: slot.profile.preferredStarterDoctrine,
  };
}

export function defaultSaveCollection(): RuntimeSaveCollection {
  return {
    version: 1,
    activeSlotId: SLOT_DEFINITIONS[0].id,
    slots: SLOT_DEFINITIONS.map((slot) => defaultSaveSlot(slot.id, slot.label)),
  };
}

export function defaultSaveSlot(
  id: SaveSlotId,
  label?: string
): RuntimeSaveSlot {
  return {
    id,
    label: sanitizeSlotLabel(label ?? fallbackLabel(id)),
    profile: DEFAULT_RUNTIME_PROFILE,
    progression: DEFAULT_RUNTIME_PROGRESSION,
    recentSessions: [],
    activeRun: null,
    agentRoster: [],
    battleRecords: [],
    updatedAt: null,
  };
}

export function getActiveSlot(
  collection: RuntimeSaveCollection
): RuntimeSaveSlot {
  return (
    collection.slots.find((slot) => slot.id === collection.activeSlotId) ??
    collection.slots[0] ??
    defaultSaveSlot("slot-1")
  );
}

export function replaceSlot(
  collection: RuntimeSaveCollection,
  nextSlot: RuntimeSaveSlot
): RuntimeSaveCollection {
  return sanitizeSaveCollection({
    ...collection,
    slots: collection.slots.map((slot) =>
      slot.id === nextSlot.id ? nextSlot : slot
    ),
  });
}

export function sanitizeSaveCollection(
  value: Partial<RuntimeSaveCollection> | null | undefined
): RuntimeSaveCollection {
  const slots = SLOT_DEFINITIONS.map(({ id, label }) => {
    const candidate = value?.slots?.find((slot) => slot.id === id);
    return sanitizeSaveSlot(candidate, id, label);
  });

  const activeSlotId = SLOT_DEFINITIONS.some(
    ({ id }) => id === value?.activeSlotId
  )
    ? (value?.activeSlotId as SaveSlotId)
    : SLOT_DEFINITIONS[0].id;

  return {
    version: 1,
    activeSlotId,
    slots,
  };
}

export function sanitizeSaveSlot(
  value: Partial<RuntimeSaveSlot> | null | undefined,
  slotId?: SaveSlotId,
  fallback?: string
): RuntimeSaveSlot {
  const id = SLOT_DEFINITIONS.some(
    ({ id: candidate }) => candidate === value?.id
  )
    ? (value?.id as SaveSlotId)
    : slotId ?? SLOT_DEFINITIONS[0].id;

  return {
    id,
    label: sanitizeSlotLabel(value?.label ?? fallback ?? fallbackLabel(id)),
    profile: sanitizeRuntimeProfile(value?.profile),
    progression: sanitizeProgression(value?.progression),
    recentSessions: Array.isArray(value?.recentSessions)
      ? value.recentSessions
          .map((session) => sanitizeMatchSession(session, id))
          .slice(0, 6)
      : [],
    activeRun: sanitizeActiveRun(value?.activeRun),
    agentRoster: Array.isArray(value?.agentRoster)
      ? value.agentRoster.map(sanitizeAgentRecord).slice(0, 256)
      : [],
    battleRecords: Array.isArray(value?.battleRecords)
      ? value.battleRecords
          .map((record) => sanitizeBattleRecord(record, id))
          .slice(0, 32)
      : [],
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : null,
  };
}

export function sanitizeProgression(
  value: Partial<RuntimeProgression> | null | undefined
): RuntimeProgression {
  const xp = Math.max(0, Number(value?.xp ?? 0) || 0);
  const unlockedBadges = Array.isArray(value?.unlockedBadges)
    ? uniqueBadges(value.unlockedBadges)
    : [];

  return {
    xp,
    level: Math.max(1, Math.floor(xp / 200) + 1),
    totalRuns: Math.max(0, Number(value?.totalRuns ?? 0) || 0),
    totalSweeps: Math.max(0, Number(value?.totalSweeps ?? 0) || 0),
    unlockedBadges,
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : null,
  };
}

export function sanitizeMatchSession(
  value: Partial<MatchSessionRecord> | null | undefined,
  slotId: SaveSlotId
): MatchSessionRecord {
  const now = new Date().toISOString();

  return {
    id:
      typeof value?.id === "string" && value.id.trim()
        ? value.id
        : `${slotId}-${Date.now()}`,
    template: "numeron-run",
    slotId,
    playerName:
      typeof value?.playerName === "string" && value.playerName.trim()
        ? value.playerName.trim().slice(0, 16)
        : DEFAULT_RUNTIME_PROFILE.preferredPlayerName,
    locale:
      value?.locale === "zh-CN"
        ? "zh-CN"
        : DEFAULT_RUNTIME_PROFILE.preferredLocale,
    status:
      value?.status === "completed" || value?.status === "staging"
        ? value.status
        : "live",
    round: Math.max(1, Number(value?.round ?? 1) || 1),
    objective:
      typeof value?.objective === "string" && value.objective.trim()
        ? value.objective
        : "Stand up the first Numeron board slice.",
    score: Math.max(0, Number(value?.score ?? 0) || 0),
    captured: Math.max(0, Number(value?.captured ?? 0) || 0),
    total: Math.max(1, Number(value?.total ?? 4) || 4),
    startedAt:
      typeof value?.startedAt === "string" && value.startedAt.trim()
        ? value.startedAt
        : now,
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : now,
    endedAt:
      typeof value?.endedAt === "string" && value.endedAt.trim()
        ? value.endedAt
        : null,
  };
}

export function sanitizeSlotLabel(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 18) : "Save Slot";
}

function sanitizeActiveRun(
  value: Partial<RuntimeActiveRun> | null | undefined
): RuntimeActiveRun | null {
  if (typeof value?.state !== "string" || !value.state.trim()) {
    return null;
  }

  return {
    version: 1,
    state: value.state,
    updatedAt:
      typeof value.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : new Date().toISOString(),
    runNumber: Math.max(1, Number(value.runNumber ?? 1) || 1),
    round: Math.max(1, Number(value.round ?? 1) || 1),
  };
}

function sanitizeAgentRecord(
  value: Partial<RuntimeAgentRecord> | null | undefined
): RuntimeAgentRecord {
  const now = new Date().toISOString();

  return {
    id:
      typeof value?.id === "string" && value.id.trim()
        ? value.id
        : `agent-${Date.now()}`,
    archetype: sanitizeArchetype(value?.archetype),
    faction: value?.faction === "dusk" ? "dusk" : "dawn",
    role: value?.role === "skirmisher" ? "skirmisher" : "vanguard",
    firstSeenAt:
      typeof value?.firstSeenAt === "string" && value.firstSeenAt.trim()
        ? value.firstSeenAt
        : now,
    lastSeenAt:
      typeof value?.lastSeenAt === "string" && value.lastSeenAt.trim()
        ? value.lastSeenAt
        : now,
    lastBattleInstanceId:
      typeof value?.lastBattleInstanceId === "string" &&
      value.lastBattleInstanceId.trim()
        ? value.lastBattleInstanceId
        : "0",
    bestStars: Math.max(1, Math.min(3, Number(value?.bestStars ?? 1) || 1)),
    matchesPlayed: Math.max(0, Number(value?.matchesPlayed ?? 0) || 0),
    wins: Math.max(0, Number(value?.wins ?? 0) || 0),
    losses: Math.max(0, Number(value?.losses ?? 0) || 0),
    lastSessionId:
      typeof value?.lastSessionId === "string" && value.lastSessionId.trim()
        ? value.lastSessionId
        : null,
  };
}

function sanitizeBattleRecord(
  value: Partial<RuntimeBattleRecord> | null | undefined,
  slotId: SaveSlotId
): RuntimeBattleRecord {
  const now = new Date().toISOString();

  return {
    id:
      typeof value?.id === "string" && value.id.trim()
        ? value.id
        : `${slotId}-${Date.now()}`,
    sessionId:
      typeof value?.sessionId === "string" && value.sessionId.trim()
        ? value.sessionId
        : `${slotId}-run-1`,
    slotId,
    runNumber: Math.max(1, Number(value?.runNumber ?? 1) || 1),
    round: Math.max(1, Number(value?.round ?? 1) || 1),
    score: Math.max(0, Number(value?.score ?? 0) || 0),
    result:
      value?.result === "victory" || value?.result === "defeat"
        ? value.result
        : "active",
    status:
      value?.status === "completed" || value?.status === "staging"
        ? value.status
        : "live",
    startedAt:
      typeof value?.startedAt === "string" && value.startedAt.trim()
        ? value.startedAt
        : now,
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : now,
    endedAt:
      typeof value?.endedAt === "string" && value.endedAt.trim()
        ? value.endedAt
        : null,
    playerAgentIds: Array.isArray(value?.playerAgentIds)
      ? value.playerAgentIds
          .filter(
            (agentId): agentId is string =>
              typeof agentId === "string" && Boolean(agentId.trim())
          )
          .slice(0, 16)
      : [],
    replayState:
      typeof value?.replayState === "string" && value.replayState.trim()
        ? value.replayState
        : null,
    starterDoctrine: sanitizeStarterDoctrineView(value?.starterDoctrine),
    runModifier: sanitizeRunModifierView(value?.runModifier),
    selectedAugments: Array.isArray(value?.selectedAugments)
      ? value.selectedAugments.map(sanitizeAugmentView).slice(0, 8)
      : [],
    activeTraits: Array.isArray(value?.activeTraits)
      ? value.activeTraits.map(sanitizeTraitView).slice(0, 8)
      : [],
    finalBoard: Array.isArray(value?.finalBoard)
      ? value.finalBoard.map(sanitizeUnitView).slice(0, 5)
      : [],
    roundHistory: Array.isArray(value?.roundHistory)
      ? value.roundHistory.map(sanitizeRoundSummaryView).slice(0, 8)
      : [],
    performanceLeaders: Array.isArray(value?.performanceLeaders)
      ? value.performanceLeaders.map(sanitizePerformanceView).slice(0, 8)
      : [],
    incomeBaseTotal: Math.max(0, Number(value?.incomeBaseTotal ?? 0) || 0),
    incomeInterestTotal: Math.max(
      0,
      Number(value?.incomeInterestTotal ?? 0) || 0
    ),
    incomeStreakTotal: Math.max(0, Number(value?.incomeStreakTotal ?? 0) || 0),
    incomeModifierTotal: Math.max(
      0,
      Number(value?.incomeModifierTotal ?? 0) || 0
    ),
    incomeEventTotal: Math.max(0, Number(value?.incomeEventTotal ?? 0) || 0),
    buildRoute:
      typeof value?.buildRoute === "string" && value.buildRoute.trim()
        ? value.buildRoute
        : "Flex Pivot",
    econPlan:
      typeof value?.econPlan === "string" && value.econPlan.trim()
        ? value.econPlan
        : "Stabilize the board first, then rebuild interest.",
    mvpLabel:
      typeof value?.mvpLabel === "string" && value.mvpLabel.trim()
        ? value.mvpLabel
        : null,
    outcomeReason:
      typeof value?.outcomeReason === "string" && value.outcomeReason.trim()
        ? value.outcomeReason
        : "",
  };
}

function sanitizeRunModifierView(
  value: Partial<RuntimeRunModifierView> | null | undefined
): RuntimeRunModifierView {
  const key =
    value?.key === "thin-bench" ||
    value?.key === "dawn-surge" ||
    value?.key === "dusk-surge" ||
    value?.key === "glass-cannon" ||
    value?.key === "augment-storm"
      ? value.key
      : "rich-opening";

  return {
    key,
    label:
      typeof value?.label === "string" && value.label.trim()
        ? value.label
        : "Rich Opening",
    description:
      typeof value?.description === "string" ? value.description : "",
    routeHint: typeof value?.routeHint === "string" ? value.routeHint : "",
  };
}

function sanitizeStarterDoctrineView(value: {
  key?: unknown;
  label?: unknown;
  description?: unknown;
  openingPlan?: unknown;
  bonusLabel?: unknown;
} | null | undefined): RuntimeStarterDoctrineView {
  const key: RuntimeStarterDoctrineView["key"] =
    value?.key === "dawn-relay" ||
    value?.key === "dusk-raid" ||
    value?.key === "iron-wall" ||
    value?.key === "open-market"
      ? value.key
      : "balanced";

  return {
    key,
    label:
      typeof value?.label === "string" && value.label.trim()
        ? value.label
        : "Balanced Prep",
    description: typeof value?.description === "string" ? value.description : "",
    openingPlan: typeof value?.openingPlan === "string" ? value.openingPlan : "",
    bonusLabel: typeof value?.bonusLabel === "string" ? value.bonusLabel : "",
  };
}

function sanitizeRoundSummaryView(
  value: Partial<RuntimeRoundSummaryView> | null | undefined
): RuntimeRoundSummaryView {
  return {
    round: Math.max(1, Number(value?.round ?? 1) || 1),
    result: value?.result === "defeat" ? "defeat" : "victory",
    incomeTotal: Math.max(0, Number(value?.incomeTotal ?? 0) || 0),
    threat: Math.max(0, Number(value?.threat ?? 0) || 0),
    summary: typeof value?.summary === "string" ? value.summary : "",
  };
}

function sanitizePerformanceView(
  value: Partial<RuntimePerformanceView> | null | undefined
): RuntimePerformanceView {
  return {
    agentId:
      typeof value?.agentId === "string" && value.agentId.trim()
        ? value.agentId
        : "0",
    battleInstanceId:
      typeof value?.battleInstanceId === "string" &&
      value.battleInstanceId.trim()
        ? value.battleInstanceId
        : "0",
    label:
      typeof value?.label === "string" && value.label.trim()
        ? value.label
        : "Unknown Unit",
    damageDealt: Math.max(0, Number(value?.damageDealt ?? 0) || 0),
    damageTaken: Math.max(0, Number(value?.damageTaken ?? 0) || 0),
    healingDone: Math.max(0, Number(value?.healingDone ?? 0) || 0),
    kills: Math.max(0, Number(value?.kills ?? 0) || 0),
  };
}

function sanitizeAugmentView(
  value: Partial<RuntimeAugmentView> | null | undefined
): RuntimeAugmentView {
  return {
    key:
      value?.key === "vanguard-doctrine" ||
      value?.key === "skirmisher-drive" ||
      value?.key === "dawn-pulse" ||
      value?.key === "dusk-pact" ||
      value?.key === "emergency-hull"
        ? value.key
        : "compound-interest",
    label: typeof value?.label === "string" ? value.label : "Augment",
    description:
      typeof value?.description === "string" ? value.description : "",
  };
}

function sanitizeTraitView(
  value: Partial<RuntimeTraitView> | null | undefined
): RuntimeTraitView {
  return {
    key:
      value?.key === "dusk" ||
      value?.key === "vanguard" ||
      value?.key === "skirmisher"
        ? value.key
        : "dawn",
    label: typeof value?.label === "string" ? value.label : "Trait",
    count: Math.max(0, Number(value?.count ?? 0) || 0),
    threshold: Math.max(1, Number(value?.threshold ?? 2) || 2),
    capstoneThreshold: Math.max(
      2,
      Number(value?.capstoneThreshold ?? 4) || 4
    ),
    tier: Math.max(0, Number(value?.tier ?? 0) || 0),
    description:
      typeof value?.description === "string" ? value.description : "",
    active: Boolean(value?.active),
  };
}

function sanitizeUnitView(
  value: Partial<RuntimeUnitView> | null | undefined
): RuntimeUnitView {
  return {
    agentId:
      typeof value?.agentId === "string" && value.agentId.trim()
        ? value.agentId
        : "0",
    battleInstanceId:
      typeof value?.battleInstanceId === "string" && value.battleInstanceId.trim()
        ? value.battleInstanceId
        : "0",
    label: typeof value?.label === "string" ? value.label : "Unknown Unit",
    archetype: sanitizeArchetype(value?.archetype),
    faction: value?.faction === "dusk" ? "dusk" : "dawn",
    role: value?.role === "skirmisher" ? "skirmisher" : "vanguard",
    skill: typeof value?.skill === "string" ? value.skill : "",
    tempoLabel: typeof value?.tempoLabel === "string" ? value.tempoLabel : "",
    castState: typeof value?.castState === "string" ? value.castState : "",
    targetRule: typeof value?.targetRule === "string" ? value.targetRule : "",
    stars: Math.max(1, Number(value?.stars ?? 1) || 1),
    attack: Math.max(1, Number(value?.attack ?? 1) || 1),
    health: Math.max(1, Number(value?.health ?? 1) || 1),
    sellValue: Math.max(1, Number(value?.sellValue ?? 1) || 1),
  };
}

function fallbackLabel(id: SaveSlotId) {
  return SLOT_DEFINITIONS.find((slot) => slot.id === id)?.label ?? "Save Slot";
}

function uniqueBadges(badges: unknown[]): ProgressionBadge[] {
  return badges.filter(isProgressionBadge).filter((badge, index, list) => {
    return list.indexOf(badge) === index;
  });
}

function isProgressionBadge(value: unknown): value is ProgressionBadge {
  return (
    value === "first-launch" ||
    value === "first-sweep" ||
    value === "score-300" ||
    value === "loop-3"
  );
}

function sanitizeArchetype(
  value: RuntimeAgentRecord["archetype"] | undefined
): RuntimeAgentRecord["archetype"] {
  switch (value) {
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
