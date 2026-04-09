import {
  DEFAULT_RUNTIME_BOOT_CONFIG,
  DEFAULT_RUNTIME_PROFILE,
  type RuntimeBootConfig,
  type RuntimeProfile,
} from "@/lib/types";

export const PROFILE_STORAGE_KEY = "numeron.profile.v1";

export function loadStoredProfile(): RuntimeProfile {
  if (typeof window === "undefined") {
    return DEFAULT_RUNTIME_PROFILE;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_RUNTIME_PROFILE;
    }

    return sanitizeRuntimeProfile(JSON.parse(raw));
  } catch {
    return DEFAULT_RUNTIME_PROFILE;
  }
}

export function saveStoredProfile(profile: RuntimeProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(sanitizeRuntimeProfile(profile)),
  );
}

export function clearStoredProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function profileToBootConfig(profile: RuntimeProfile): RuntimeBootConfig {
  return {
    playerName:
      profile.preferredPlayerName || DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
    touchControls: profile.preferredTouchControls,
    locale: profile.preferredLocale || DEFAULT_RUNTIME_BOOT_CONFIG.locale,
    starterDoctrine:
      profile.preferredStarterDoctrine ||
      DEFAULT_RUNTIME_BOOT_CONFIG.starterDoctrine,
  };
}

export function exportRuntimeProfile(profile: RuntimeProfile) {
  return JSON.stringify(sanitizeRuntimeProfile(profile), null, 2);
}

export function importRuntimeProfile(raw: string): RuntimeProfile {
  return sanitizeRuntimeProfile(JSON.parse(raw));
}

export function sanitizeRuntimeProfile(
  value: Partial<RuntimeProfile> | null | undefined,
): RuntimeProfile {
  const preferredPlayerName =
    typeof value?.preferredPlayerName === "string" &&
    value.preferredPlayerName.trim()
      ? value.preferredPlayerName.trim().slice(0, 16)
      : DEFAULT_RUNTIME_PROFILE.preferredPlayerName;

  return {
    version: 1,
    preferredPlayerName,
    preferredTouchControls:
      typeof value?.preferredTouchControls === "boolean"
        ? value.preferredTouchControls
        : DEFAULT_RUNTIME_PROFILE.preferredTouchControls,
    preferredLocale:
      value?.preferredLocale === "zh-CN" ? "zh-CN" : DEFAULT_RUNTIME_PROFILE.preferredLocale,
    preferredStarterDoctrine:
      value?.preferredStarterDoctrine === "dawn-relay" ||
      value?.preferredStarterDoctrine === "dusk-raid" ||
      value?.preferredStarterDoctrine === "iron-wall" ||
      value?.preferredStarterDoctrine === "open-market"
        ? value.preferredStarterDoctrine
        : DEFAULT_RUNTIME_PROFILE.preferredStarterDoctrine,
    runsLaunched: Math.max(0, Number(value?.runsLaunched ?? 0) || 0),
    bestScore: Math.max(0, Number(value?.bestScore ?? 0) || 0),
    bestRound: Math.max(0, Number(value?.bestRound ?? 0) || 0),
    lastScore: Math.max(0, Number(value?.lastScore ?? 0) || 0),
    lastRound: Math.max(0, Number(value?.lastRound ?? 0) || 0),
    lastCaptured: Math.max(0, Number(value?.lastCaptured ?? 0) || 0),
    updatedAt:
      typeof value?.updatedAt === "string" && value.updatedAt.trim()
        ? value.updatedAt
        : null,
  };
}
