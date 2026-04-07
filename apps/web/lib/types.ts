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
  locale: "en" | "zh-CN";
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

export type RuntimeUnitView = {
  label: string;
  archetype:
    | "verdant-bruiser"
    | "signal-ranger"
    | "ash-duelist"
    | "iron-vanguard"
    | "frost-oracle"
    | "ember-medic"
    | "volt-juggler"
    | "grave-warden";
  faction: "dawn" | "dusk";
  role: "vanguard" | "skirmisher";
  skill: string;
  tempoLabel: string;
  castState: string;
  targetRule: string;
  stars: number;
  attack: number;
  health: number;
  sellValue: number;
};

export type RuntimeTraitView = {
  key: "dawn" | "dusk" | "vanguard" | "skirmisher";
  label: string;
  count: number;
  threshold: number;
  description: string;
  active: boolean;
};

export type RuntimeAugmentView = {
  key:
    | "compound-interest"
    | "vanguard-doctrine"
    | "skirmisher-drive"
    | "dawn-pulse"
    | "dusk-pact"
    | "emergency-hull";
  label: string;
  description: string;
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
    phase: "preparation" | "combat" | "resolution";
    objective: string;
    status: string;
    score: number;
    gold: number;
    playerHealth: number;
    enemyHealth: number;
    captured: number;
    total: number;
    round: number;
    runNumber: number;
    level: number;
    xp: number;
    xpToNextLevel: number;
    maxLevel: number;
    rerollCost: number;
    xpBuyCost: number;
    shopLocked: boolean;
    shopOffers: RuntimeUnitView[];
    benchUnits: RuntimeUnitView[];
    playerBoard: Array<RuntimeUnitView | null>;
    enemyBoard: Array<RuntimeUnitView | null>;
    unitRoster: RuntimeUnitView[];
    activeTraits: RuntimeTraitView[];
    selectedAugments: RuntimeAugmentView[];
    pendingAugments: RuntimeAugmentView[];
    augmentDraftRound: number;
    enemyThreat: number;
    enemyIntent: string;
    benchCapacity: number;
    boardCapacity: number;
    deploymentCap: number;
    streak: number;
    baseIncome: number;
    interestIncome: number;
    streakIncome: number;
    roundResolved: boolean;
    runOver: boolean;
    runResult: "active" | "victory" | "defeat";
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
  preferredLocale: "en" | "zh-CN";
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
  template: "numeron-run";
  slotId: SaveSlotId;
  playerName: string;
  locale: "en" | "zh-CN";
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
  locale: "en" | "zh-CN";
  best_score: number;
  best_round: number;
  updated_at: string;
};

export type RemoteBackendSession = {
  id: string;
  slot_id: string;
  player_name: string;
  locale: "en" | "zh-CN";
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
    }
  | {
      type: "runtime.round.start";
    }
  | {
      type: "runtime.round.reset";
    }
  | {
      type: "runtime.run.restart";
    }
  | {
      type: "runtime.shop.reroll";
    }
  | {
      type: "runtime.shop.buy-xp";
    }
  | {
      type: "runtime.augment.choose";
      index: number;
    }
  | {
      type: "runtime.shop.lock.toggle";
    }
  | {
      type: "runtime.shop.buy";
      index: number;
    }
  | {
      type: "runtime.board.deploy";
      benchIndex: number;
      slotIndex: number;
    }
  | {
      type: "runtime.board.withdraw";
      slotIndex: number;
    }
  | {
      type: "runtime.bench.sell";
      benchIndex: number;
    }
  | {
      type: "runtime.board.sell";
      slotIndex: number;
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
  locale: "en",
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
    phase: "preparation",
    objective: "Stand up the first Numeron board slice.",
    status: "Waiting for board allocation.",
    score: 0,
    gold: 0,
    playerHealth: 20,
    enemyHealth: 20,
    captured: 0,
    total: 0,
    round: 1,
    runNumber: 1,
    level: 1,
    xp: 0,
    xpToNextLevel: 4,
    maxLevel: 4,
    rerollCost: 1,
    xpBuyCost: 4,
    shopLocked: false,
    shopOffers: [],
    benchUnits: [],
    playerBoard: [null, null, null, null, null],
    enemyBoard: [null, null, null, null, null],
    unitRoster: [],
    activeTraits: [],
    selectedAugments: [],
    pendingAugments: [],
    augmentDraftRound: 0,
    enemyThreat: 0,
    enemyIntent: "Awaiting board allocation.",
    benchCapacity: 6,
    boardCapacity: 5,
    deploymentCap: 2,
    streak: 0,
    baseIncome: 4,
    interestIncome: 0,
    streakIncome: 0,
    roundResolved: false,
    runOver: false,
    runResult: "active",
    completed: false,
  },
};

export const DEFAULT_RUNTIME_PROFILE: RuntimeProfile = {
  version: 1,
  preferredPlayerName: DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
  preferredTouchControls: DEFAULT_RUNTIME_BOOT_CONFIG.touchControls,
  preferredLocale: DEFAULT_RUNTIME_BOOT_CONFIG.locale,
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
