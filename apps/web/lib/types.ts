export type RuntimeBootPhase =
  | "idle"
  | "loading-module"
  | "initializing-wasm"
  | "binding-status-sink"
  | "starting-runtime"
  | "runtime-entered"
  | "app-created"
  | "plugins-configured"
  | "running"
  | "scene-ready"
  | "error";

export type RuntimeBootConfig = {
  playerName: string;
  touchControls: boolean;
};

export type VirtualInputState = {
  x: number;
  y: number;
};

export type RuntimeBootRecord = {
  id: number;
  phase: RuntimeBootPhase;
  message: string;
  source: "shell" | "runtime";
  timestamp: number;
};

export type RuntimeProjection = {
  ready: boolean;
  touchControls: boolean;
  player: {
    name: string;
    x: number;
    y: number;
  } | null;
  slice: {
    objective: string;
    status: string;
    score: number;
    captured: number;
    total: number;
    round: number;
    completed: boolean;
  };
};

export type RuntimeSnapshot = {
  boot: {
    current: RuntimeBootRecord;
    history: RuntimeBootRecord[];
  };
  bootConfig: RuntimeBootConfig;
  world: RuntimeProjection;
  input: VirtualInputState;
  runtimeActive: boolean;
};

export type RuntimeProfile = {
  version: 1;
  preferredPlayerName: string;
  preferredTouchControls: boolean;
  runsLaunched: number;
  bestScore: number;
  bestRound: number;
  lastScore: number;
  lastRound: number;
  lastCaptured: number;
  updatedAt: string | null;
};

export type SaveSlotId = "slot-1" | "slot-2" | "slot-3";

export type ProgressionBadge =
  | "first-launch"
  | "first-sweep"
  | "score-300"
  | "loop-3";

export type RuntimeProgression = {
  xp: number;
  level: number;
  totalRuns: number;
  totalSweeps: number;
  unlockedBadges: ProgressionBadge[];
  updatedAt: string | null;
};

export type MatchSessionStatus = "staging" | "live" | "completed";

export type MatchSessionRecord = {
  id: string;
  template: "uplink-sweep";
  slotId: SaveSlotId;
  playerName: string;
  status: MatchSessionStatus;
  round: number;
  objective: string;
  score: number;
  captured: number;
  total: number;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
};

export type RuntimeSaveSlot = {
  id: SaveSlotId;
  label: string;
  profile: RuntimeProfile;
  progression: RuntimeProgression;
  recentSessions: MatchSessionRecord[];
  updatedAt: string | null;
};

export type RuntimeSaveCollection = {
  version: 1;
  activeSlotId: SaveSlotId;
  slots: RuntimeSaveSlot[];
};

export type ShellDataMode = "local" | "remote";

export type RemoteBackendProfile = {
  slot_id: string;
  player_name: string;
  touch_controls: boolean;
  best_score: number;
  best_round: number;
  updated_at: string;
};

export type RemoteBackendSession = {
  id: string;
  slot_id: string;
  player_name: string;
  status: MatchSessionStatus;
  round: number;
  objective: string;
  score: number;
  captured: number;
  total: number;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type RemoteBackendSnapshot = {
  mode: string;
  tick: number;
  uptime_ms: number;
  profiles: Record<string, RemoteBackendProfile>;
  sessions: RemoteBackendSession[];
};

export type UiIntent =
  | {
      type: "runtime.boot";
      config?: RuntimeBootConfig;
    }
  | {
      type: "runtime.boot-config.patch";
      patch: Partial<RuntimeBootConfig>;
    }
  | {
      type: "runtime.virtual-input.set";
      input: VirtualInputState;
    };

export type RuntimeEvent =
  | {
      type: "bridge.ready";
      snapshot: RuntimeSnapshot;
    }
  | {
      type: "runtime.ready";
      projection: RuntimeProjection;
      snapshot: RuntimeSnapshot;
    }
  | {
      type: "runtime.boot-status.changed";
      record: RuntimeBootRecord;
      snapshot: RuntimeSnapshot;
    }
  | {
      type: "runtime.snapshot.changed";
      reason: "boot-config" | "boot-status" | "input" | "world";
      snapshot: RuntimeSnapshot;
    };

export type RuntimeAdapterEventPayload = {
  origin: "runtime";
  type: "runtime.ready" | "runtime.projection.changed";
  projection: RuntimeProjection;
};

export const DEFAULT_RUNTIME_BOOT_CONFIG: RuntimeBootConfig = {
  playerName: "Pilot",
  touchControls: true,
};

export const DEFAULT_VIRTUAL_INPUT_STATE: VirtualInputState = {
  x: 0,
  y: 0,
};

export const DEFAULT_RUNTIME_PROJECTION: RuntimeProjection = {
  ready: false,
  touchControls: true,
  player: null,
  slice: {
    objective: "Secure each uplink pad once per sweep.",
    status: "Waiting for runtime handoff.",
    score: 0,
    captured: 0,
    total: 4,
    round: 1,
    completed: false,
  },
};

export const DEFAULT_RUNTIME_PROFILE: RuntimeProfile = {
  version: 1,
  preferredPlayerName: DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
  preferredTouchControls: DEFAULT_RUNTIME_BOOT_CONFIG.touchControls,
  runsLaunched: 0,
  bestScore: 0,
  bestRound: 0,
  lastScore: 0,
  lastRound: 0,
  lastCaptured: 0,
  updatedAt: null,
};

export const DEFAULT_RUNTIME_PROGRESSION: RuntimeProgression = {
  xp: 0,
  level: 1,
  totalRuns: 0,
  totalSweeps: 0,
  unlockedBadges: [],
  updatedAt: null,
};
