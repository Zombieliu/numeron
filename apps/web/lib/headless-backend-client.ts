import type {
  MatchSessionRecord,
  RemoteBackendProfile,
  RemoteBackendSession,
  RemoteBackendSnapshot,
  RuntimeSaveCollection,
  RuntimeSaveSlot,
  SaveSlotId,
} from "@/lib/types";
import {
  defaultSaveSlot,
  sanitizeSaveCollection,
  sanitizeSaveSlot,
} from "@/lib/save-slots-store";

export const DEFAULT_REMOTE_BACKEND_URL = "http://127.0.0.1:8787";

export function normalizeBackendUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_REMOTE_BACKEND_URL;
  }

  return trimmed.replace(/\/+$/, "");
}

export async function fetchBackendHealth(baseUrl: string) {
  return requestJson<{
    ok: boolean;
    mode: string;
    tick: number;
    sessions: number;
    profiles: number;
  }>(baseUrl, "/health");
}

export async function fetchBackendSnapshot(baseUrl: string) {
  return requestJson<RemoteBackendSnapshot>(baseUrl, "/snapshot");
}

export async function pushBackendProfile(
  baseUrl: string,
  slot: RuntimeSaveSlot,
) {
  return requestJson<{ accepted: boolean; command: string }>(
    baseUrl,
    `/profiles/${slot.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        player_name: slot.profile.preferredPlayerName,
        touch_controls: slot.profile.preferredTouchControls,
        best_score: slot.profile.bestScore,
        best_round: slot.profile.bestRound,
      }),
    },
  );
}

export async function createBackendSession(
  baseUrl: string,
  session: MatchSessionRecord,
) {
  return requestJson<{ accepted: boolean; session_id: string }>(
    baseUrl,
    "/sessions",
    {
      method: "POST",
      body: JSON.stringify({
        session_id: session.id,
        slot_id: session.slotId,
        player_name: session.playerName,
      }),
    },
  );
}

export async function updateBackendSession(
  baseUrl: string,
  session: MatchSessionRecord,
) {
  return requestJson<{ accepted: boolean; command: string }>(
    baseUrl,
    `/sessions/${session.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: session.status,
        score: session.score,
        captured: session.captured,
        total: session.total,
        round: session.round,
      }),
    },
  );
}

export function applyBackendSnapshot(
  current: RuntimeSaveCollection,
  snapshot: RemoteBackendSnapshot,
): RuntimeSaveCollection {
  const slotSessions = new Map<SaveSlotId, MatchSessionRecord[]>();

  for (const remoteSession of snapshot.sessions) {
    const slotId = sanitizeSlotId(remoteSession.slot_id);
    const existing = slotSessions.get(slotId) ?? [];
    existing.push(fromRemoteSession(remoteSession));
    slotSessions.set(slotId, existing);
  }

  return sanitizeSaveCollection({
    ...current,
    slots: current.slots.map((slot) => {
      const remoteProfile = snapshot.profiles[slot.id];
      const nextProfile = remoteProfile
        ? {
            ...slot.profile,
            preferredPlayerName: remoteProfile.player_name,
            preferredTouchControls: remoteProfile.touch_controls,
            bestScore: Math.max(slot.profile.bestScore, remoteProfile.best_score),
            bestRound: Math.max(slot.profile.bestRound, remoteProfile.best_round),
            updatedAt: remoteProfile.updated_at,
          }
        : slot.profile;

      return sanitizeSaveSlot(
        {
          ...slot,
          profile: nextProfile,
          recentSessions: (slotSessions.get(slot.id) ?? []).slice(0, 6),
          updatedAt:
            remoteProfile?.updated_at ??
            slotSessions.get(slot.id)?.[0]?.updatedAt ??
            slot.updatedAt,
        },
        slot.id,
        slot.label,
      );
    }),
  });
}

function fromRemoteSession(remote: RemoteBackendSession): MatchSessionRecord {
  return {
    id: remote.id,
    template: "uplink-sweep",
    slotId: sanitizeSlotId(remote.slot_id),
    playerName: remote.player_name,
    status: remote.status,
    round: remote.round,
    objective: remote.objective,
    score: remote.score,
    captured: remote.captured,
    total: remote.total,
    startedAt: remote.started_at,
    updatedAt: remote.updated_at,
    endedAt: remote.ended_at,
  };
}

function sanitizeSlotId(value: string): SaveSlotId {
  if (value === "slot-2" || value === "slot-3") {
    return value;
  }

  return "slot-1";
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${normalizeBackendUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Remote backend request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
