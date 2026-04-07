import {
  DEFAULT_RUNTIME_PROFILE,
  DEFAULT_RUNTIME_PROGRESSION,
  type MatchSessionRecord,
  type ProgressionBadge,
  type RuntimeBootConfig,
  type RuntimeProgression,
  type RuntimeSaveCollection,
  type RuntimeSaveSlot,
  type SaveSlotId,
} from "@/lib/types";
import {
  PROFILE_STORAGE_KEY,
  clearStoredProfile,
  loadStoredProfile,
  sanitizeRuntimeProfile,
} from "@/lib/profile-store";

export const SAVE_COLLECTION_STORAGE_KEY =
  "numeron.save-collection.v1";

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
    JSON.stringify(sanitizeSaveCollection(collection)),
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
  };
}

export function defaultSaveCollection(): RuntimeSaveCollection {
  return {
    version: 1,
    activeSlotId: SLOT_DEFINITIONS[0].id,
    slots: SLOT_DEFINITIONS.map((slot) => defaultSaveSlot(slot.id, slot.label)),
  };
}

export function defaultSaveSlot(id: SaveSlotId, label?: string): RuntimeSaveSlot {
  return {
    id,
    label: sanitizeSlotLabel(label ?? fallbackLabel(id)),
    profile: DEFAULT_RUNTIME_PROFILE,
    progression: DEFAULT_RUNTIME_PROGRESSION,
    recentSessions: [],
    updatedAt: null,
  };
}

export function getActiveSlot(collection: RuntimeSaveCollection): RuntimeSaveSlot {
  return (
    collection.slots.find((slot) => slot.id === collection.activeSlotId) ??
    collection.slots[0] ??
    defaultSaveSlot("slot-1")
  );
}

export function replaceSlot(
  collection: RuntimeSaveCollection,
  nextSlot: RuntimeSaveSlot,
): RuntimeSaveCollection {
  return sanitizeSaveCollection({
    ...collection,
    slots: collection.slots.map((slot) => (slot.id === nextSlot.id ? nextSlot : slot)),
  });
}

export function sanitizeSaveCollection(
  value: Partial<RuntimeSaveCollection> | null | undefined,
): RuntimeSaveCollection {
  const slots = SLOT_DEFINITIONS.map(({ id, label }) => {
    const candidate = value?.slots?.find((slot) => slot.id === id);
    return sanitizeSaveSlot(candidate, id, label);
  });

  const activeSlotId = SLOT_DEFINITIONS.some(
    ({ id }) => id === value?.activeSlotId,
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
  fallback?: string,
): RuntimeSaveSlot {
  const id = SLOT_DEFINITIONS.some(({ id: candidate }) => candidate === value?.id)
    ? (value?.id as SaveSlotId)
    : (slotId ?? SLOT_DEFINITIONS[0].id);

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
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : null,
  };
}

export function sanitizeProgression(
  value: Partial<RuntimeProgression> | null | undefined,
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
  slotId: SaveSlotId,
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
