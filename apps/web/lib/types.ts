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
  starterDoctrine:
    | "balanced"
    | "dawn-relay"
    | "dusk-raid"
    | "iron-wall"
    | "open-market";
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
  agentId: string;
  battleInstanceId: string;
  label: string;
  archetype:
    | "verdant-bruiser"
    | "signal-ranger"
    | "ash-duelist"
    | "iron-vanguard"
    | "frost-oracle"
    | "ember-medic"
    | "volt-juggler"
    | "grave-warden"
    | "lumen-sentinel"
    | "shade-runner";
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
  capstoneThreshold: number;
  tier: number;
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

export type RuntimeRunModifierKey =
  | "rich-opening"
  | "thin-bench"
  | "dawn-surge"
  | "dusk-surge"
  | "glass-cannon"
  | "augment-storm";

export type RuntimeRunModifierView = {
  key: RuntimeRunModifierKey;
  label: string;
  description: string;
  routeHint: string;
};

export type RuntimeStarterDoctrineKey =
  | "balanced"
  | "dawn-relay"
  | "dusk-raid"
  | "iron-wall"
  | "open-market";

export type RuntimeStarterDoctrineView = {
  key: RuntimeStarterDoctrineKey;
  label: string;
  description: string;
  openingPlan: string;
  bonusLabel: string;
};

export type RuntimeRoundEventKey =
  | "standard"
  | "training-day"
  | "spoils-of-war"
  | "high-roll-market";

export type RuntimeRoundEventView = {
  key: RuntimeRoundEventKey;
  label: string;
  description: string;
  stakes: string;
};

export type RuntimeOperationKey =
  | "steady-search"
  | "deep-raid"
  | "field-cache"
  | "tactical-transfer";

export type RuntimeOperationView = {
  key: RuntimeOperationKey;
  label: string;
  description: string;
  rewardLabel: string;
  riskLabel: string;
};

export type RuntimeRoundSummaryView = {
  round: number;
  result: "victory" | "defeat";
  incomeTotal: number;
  threat: number;
  summary: string;
};

export type RuntimePerformanceView = {
  agentId: string;
  battleInstanceId: string;
  label: string;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  kills: number;
};

export type RuntimeCombatDirectiveKey =
  | "focus-backline"
  | "hold-skills"
  | "fallback-left";

export type RuntimeCombatLane = "left" | "center" | "right";

export type RuntimeCombatDirectiveInput = {
  key: RuntimeCombatDirectiveKey;
  lane?: RuntimeCombatLane | null;
  durationTicks?: number;
};

export type RuntimeCombatDirectiveView = {
  key: RuntimeCombatDirectiveKey;
  label: string;
  description: string;
  lane: RuntimeCombatLane | null;
  durationTicks: number;
  remainingTicks: number;
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
    operationCards: RuntimeOperationView[];
    selectedOperation: RuntimeOperationView | null;
    starterDoctrine: RuntimeStarterDoctrineView;
    runModifier: RuntimeRunModifierView;
    roundEvent: RuntimeRoundEventView;
    roundHistory: RuntimeRoundSummaryView[];
    performanceLeaders: RuntimePerformanceView[];
    activeCombatDirective: RuntimeCombatDirectiveView | null;
    queuedCombatDirectives: RuntimeCombatDirectiveView[];
    combatFeed: string[];
    augmentDraftRound: number;
    enemyThreat: number;
    enemyIntent: string;
    benchCapacity: number;
    boardCapacity: number;
    deploymentCap: number;
    supplies: number;
    medical: number;
    contamination: number;
    securedLoot: number;
    unsecuredLoot: number;
    streak: number;
    baseIncome: number;
    interestIncome: number;
    streakIncome: number;
    incomeBaseTotal: number;
    incomeInterestTotal: number;
    incomeStreakTotal: number;
    incomeModifierTotal: number;
    incomeEventTotal: number;
    roundDiagnosis: string;
    roundResolved: boolean;
    runOver: boolean;
    runResult: "active" | "victory" | "defeat";
    completed: boolean;
    serializedRunState: string | null;
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
  preferredStarterDoctrine: RuntimeStarterDoctrineKey;
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

export type RuntimeActiveRun = {
  version: 1;
  state: string;
  updatedAt: string;
  runNumber: number;
  round: number;
};

export type RuntimeAgentRecord = {
  id: string;
  archetype: RuntimeUnitView["archetype"];
  faction: RuntimeUnitView["faction"];
  role: RuntimeUnitView["role"];
  firstSeenAt: string;
  lastSeenAt: string;
  lastBattleInstanceId: string;
  bestStars: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  lastSessionId: string | null;
};

export type RuntimeBattleRecord = {
  id: string;
  sessionId: string;
  slotId: SaveSlotId;
  runNumber: number;
  round: number;
  score: number;
  result: RuntimeProjection["slice"]["runResult"];
  status: MatchSessionStatus;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  playerAgentIds: string[];
  replayState: string | null;
  starterDoctrine: RuntimeStarterDoctrineView;
  runModifier: RuntimeRunModifierView;
  selectedAugments: RuntimeAugmentView[];
  activeTraits: RuntimeTraitView[];
  selectedOperation: RuntimeOperationView | null;
  supplies: number;
  medical: number;
  contamination: number;
  securedLoot: number;
  unsecuredLoot: number;
  finalBoard: RuntimeUnitView[];
  roundHistory: RuntimeRoundSummaryView[];
  performanceLeaders: RuntimePerformanceView[];
  incomeBaseTotal: number;
  incomeInterestTotal: number;
  incomeStreakTotal: number;
  incomeModifierTotal: number;
  incomeEventTotal: number;
  buildRoute: string;
  econPlan: string;
  mvpLabel: string | null;
  outcomeReason: string;
};

export type RuntimeSaveSlot = {
  id: SaveSlotId;
  label: string;
  profile: RuntimeProfile;
  progression: RuntimeProgression;
  recentSessions: MatchSessionRecord[];
  activeRun: RuntimeActiveRun | null;
  agentRoster: RuntimeAgentRecord[];
  battleRecords: RuntimeBattleRecord[];
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
      resumeState?: string | null;
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
      type: "runtime.operation.choose";
      index: number;
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
      type: "runtime.board.reposition";
      fromSlot: number;
      toSlot: number;
    }
  | {
      type: "runtime.bench.sell";
      benchIndex: number;
    }
  | {
      type: "runtime.board.sell";
      slotIndex: number;
    }
  | {
      type: "runtime.combat.directive.set";
      directive: RuntimeCombatDirectiveInput;
    }
  | {
      type: "runtime.combat.plan.replace";
      plan: RuntimeCombatDirectiveInput[];
    }
  | {
      type: "runtime.combat.directive.clear";
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
  starterDoctrine: "balanced",
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
    operationCards: [],
    selectedOperation: null,
    starterDoctrine: {
      key: "balanced",
      label: "Balanced Prep",
      description: "A stable opener that keeps your first shop and board decisions flexible.",
      openingPlan: "Start with a balanced frontline and pivot toward the clearest 4-piece capstone.",
      bonusLabel: "No extra opener bonus",
    },
    runModifier: {
      key: "rich-opening",
      label: "Rich Opening",
      description: "Open with more gold and pressure an early tempo line.",
      routeHint: "Economy greed into a late spike.",
    },
    roundEvent: {
      key: "standard",
      label: "Standard Round",
      description: "No temporary event modifier this round.",
      stakes: "Play the strongest board and convert clean tempo.",
    },
    roundHistory: [],
    performanceLeaders: [],
    activeCombatDirective: null,
    queuedCombatDirectives: [],
    combatFeed: [],
    augmentDraftRound: 0,
    enemyThreat: 0,
    enemyIntent: "Awaiting board allocation.",
    benchCapacity: 6,
    boardCapacity: 5,
    deploymentCap: 2,
    supplies: 3,
    medical: 1,
    contamination: 0,
    securedLoot: 0,
    unsecuredLoot: 0,
    streak: 0,
    baseIncome: 4,
    interestIncome: 0,
    streakIncome: 0,
    incomeBaseTotal: 0,
    incomeInterestTotal: 0,
    incomeStreakTotal: 0,
    incomeModifierTotal: 0,
    incomeEventTotal: 0,
    roundDiagnosis: "Build toward a two-piece trait and preserve board tempo.",
    roundResolved: false,
    runOver: false,
    runResult: "active",
    completed: false,
    serializedRunState: null,
  },
};

export const DEFAULT_RUNTIME_PROFILE: RuntimeProfile = {
  version: 1,
  preferredPlayerName: DEFAULT_RUNTIME_BOOT_CONFIG.playerName,
  preferredTouchControls: DEFAULT_RUNTIME_BOOT_CONFIG.touchControls,
  preferredLocale: DEFAULT_RUNTIME_BOOT_CONFIG.locale,
  preferredStarterDoctrine: DEFAULT_RUNTIME_BOOT_CONFIG.starterDoctrine,
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
