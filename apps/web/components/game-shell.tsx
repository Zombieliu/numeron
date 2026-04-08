"use client";

import { useEffect, useRef, useState } from "react";
import { WorldCorePanel } from "@/components/world-core-panel";
import {
  applyBackendSnapshot,
  createBackendSession,
  DEFAULT_REMOTE_BACKEND_URL,
  fetchBackendHealth,
  fetchBackendSnapshot,
  normalizeBackendUrl,
  pushBackendProfile,
  updateBackendSession,
} from "@/lib/headless-backend-client";
import {
  clearStoredSaveCollection,
  defaultSaveCollection,
  defaultSaveSlot,
  exportSaveCollection,
  getActiveSlot,
  importSaveCollection,
  loadStoredSaveCollection,
  profileToBootConfig,
  replaceSlot,
  saveStoredSaveCollection,
  sanitizeProgression,
  sanitizeSaveSlot,
  sanitizeSlotLabel,
} from "@/lib/save-slots-store";
import {
  bootRuntimeBridge,
  dispatchUiIntent,
  getRuntimeSnapshot,
  sanitizeRuntimeBootConfig,
  subscribeRuntimeEvents,
} from "@/lib/web-bridge";
import {
  formatBadgeLabel,
  formatFactionLabel,
  formatPhaseLabel,
  formatRoleLabel,
  formatRunResult,
  formatSessionStatus,
  getUiCopy,
  localizeBootMessage,
  type UiLocale,
} from "@/lib/ui-i18n";
import type {
  MatchSessionRecord,
  ProgressionBadge,
  ShellDataMode,
  RuntimeAgentRecord,
  RuntimeAugmentView,
  RuntimeBattleRecord,
  RuntimeBootConfig,
  RuntimeBootRecord,
  RuntimeCombatDirectiveInput,
  RuntimeCombatDirectiveKey,
  RuntimeCombatDirectiveView,
  RuntimeCombatLane,
  RuntimeProgression,
  RuntimeSaveCollection,
  RuntimeSaveSlot,
  RuntimeSnapshot,
  RuntimeUnitView,
  SaveSlotId,
} from "@/lib/types";

const LAUNCHER_STORAGE_KEY = "numeron.launcher.v1";
const DATA_MODE_STORAGE_KEY = "numeron.data-mode.v1";
const BACKEND_URL_STORAGE_KEY = "numeron.backend-url.v1";
const BUY_COST_LABEL = 3;
const UNIT_ART_BY_ARCHETYPE: Record<RuntimeUnitView["archetype"], string> = {
  "verdant-bruiser": "/assets/numeron/shell/unit_verdant_bruiser.png",
  "signal-ranger": "/assets/numeron/shell/unit_signal_ranger.png",
  "ash-duelist": "/assets/numeron/shell/unit_ash_duelist.png",
  "iron-vanguard": "/assets/numeron/shell/unit_iron_vanguard.png",
  "frost-oracle": "/assets/numeron/shell/unit_signal_ranger.png",
  "ember-medic": "/assets/numeron/shell/unit_verdant_bruiser.png",
  "volt-juggler": "/assets/numeron/shell/unit_ash_duelist.png",
  "grave-warden": "/assets/numeron/shell/unit_iron_vanguard.png",
  "lumen-sentinel": "/assets/numeron/shell/unit_verdant_bruiser.png",
  "shade-runner": "/assets/numeron/shell/unit_ash_duelist.png",
};

type ControlKey = "up" | "down" | "left" | "right";
type DeckTab = "command" | "shop" | "bench" | "board" | "intel";

type ControlState = Record<ControlKey, boolean>;

type CommanderParseResult =
  | {
      kind: "plan";
      steps: RuntimeCombatDirectiveInput[];
      label: string;
    }
  | {
      kind: "clear";
      label: string;
    }
  | {
      kind: "unknown";
    };

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript?: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const DEFAULT_CONTROL_STATE: ControlState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const COMBAT_DIRECTIVES: RuntimeCombatDirectiveKey[] = [
  "focus-backline",
  "hold-skills",
  "fallback-left",
];

export function GameShell() {
  const [clientReady, setClientReady] = useState(false);
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<RuntimeSnapshot>(getRuntimeSnapshot);
  const [controls, setControls] = useState<ControlState>(DEFAULT_CONTROL_STATE);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(
    null,
  );
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(
    null,
  );
  const [commanderInput, setCommanderInput] = useState("");
  const [commanderMessage, setCommanderMessage] = useState<string | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [deckTab, setDeckTab] = useState<DeckTab>("command");
  const [saveCollection, setSaveCollection] = useState<RuntimeSaveCollection>(
    defaultSaveCollection,
  );
  const [saveDraft, setSaveDraft] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<ShellDataMode>("local");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_REMOTE_BACKEND_URL);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [currentSession, setCurrentSession] =
    useState<MatchSessionRecord | null>(null);
  const lastSceneReadyEventId = useRef<number | null>(null);
  const lastArchivedSessionId = useRef<string | null>(null);
  const remoteKnownSessionIds = useRef<Set<string>>(new Set());
  const remoteProfileSignature = useRef<string | null>(null);
  const remoteHydrated = useRef(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const trackedSessionId = useRef<string | null>(null);
  const trackedSessionAgentIds = useRef<Set<string>>(new Set());
  const lastSettledBattleId = useRef<string | null>(null);
  const locale = runtimeSnapshot.bootConfig.locale as UiLocale;
  const copy = getUiCopy(locale);
  const runtimeReady = runtimeSnapshot.world.ready;

  const activeSlot = getActiveSlot(saveCollection);
  const remoteProfileSlot: RuntimeSaveSlot = {
    ...activeSlot,
    profile: {
      ...activeSlot.profile,
      preferredPlayerName: runtimeSnapshot.bootConfig.playerName,
      preferredTouchControls: runtimeSnapshot.bootConfig.touchControls,
      preferredLocale: runtimeSnapshot.bootConfig.locale,
    },
  };
  const currentPhase = runtimeSnapshot.world.slice.phase;
  const canDraft = runtimeReady && currentPhase === "preparation";
  const canStartCombat =
    runtimeReady &&
    currentPhase === "preparation" &&
    runtimeSnapshot.world.slice.captured > 0 &&
    runtimeSnapshot.world.slice.pendingAugments.length === 0;
  const canAdvanceRound =
    runtimeReady &&
    runtimeSnapshot.world.slice.roundResolved &&
    !runtimeSnapshot.world.slice.runOver;
  const canRestartRun = runtimeReady && runtimeSnapshot.world.slice.runOver;
  const benchUnits = runtimeSnapshot.world.slice.benchUnits;
  const playerBoard = runtimeSnapshot.world.slice.playerBoard;
  const enemyBoard = runtimeSnapshot.world.slice.enemyBoard;
  const unitRoster = runtimeSnapshot.world.slice.unitRoster;
  const activeTraits = runtimeSnapshot.world.slice.activeTraits;
  const selectedAugments = runtimeSnapshot.world.slice.selectedAugments;
  const pendingAugments = runtimeSnapshot.world.slice.pendingAugments;
  const deployedUnits = playerBoard.filter(Boolean).length;
  const deploymentCap = runtimeSnapshot.world.slice.deploymentCap;
  const deploymentCapReached = deployedUnits >= deploymentCap;
  const underDeployCap =
    canDraft &&
    deployedUnits > 0 &&
    deployedUnits < deploymentCap &&
    benchUnits.length > 0;
  const hasDrafted = benchUnits.length > 0 || deployedUnits > 0;
  const hasDeployed = deployedUnits > 0;
  const hasEnteredCombat =
    currentPhase !== "preparation" || canAdvanceRound || canRestartRun;
  const hasBenchSelection =
    selectedBenchIndex != null && selectedBenchIndex < benchUnits.length;
  const hasBoardSelection =
    selectedBoardIndex != null &&
    selectedBoardIndex < playerBoard.length &&
    playerBoard[selectedBoardIndex] != null;
  const canBuyUnit =
    canDraft &&
    runtimeSnapshot.world.slice.gold >= 3 &&
    benchUnits.length < runtimeSnapshot.world.slice.benchCapacity;
  const canBuyXp =
    canDraft &&
    runtimeSnapshot.world.slice.gold >= runtimeSnapshot.world.slice.xpBuyCost &&
    runtimeSnapshot.world.slice.level < runtimeSnapshot.world.slice.maxLevel;
  const canRerollShop =
    canDraft &&
    runtimeSnapshot.world.slice.gold >= runtimeSnapshot.world.slice.rerollCost;
  const canWithdrawUnit =
    canDraft && benchUnits.length < runtimeSnapshot.world.slice.benchCapacity;
  const localizedRoundState = runtimeSnapshot.world.slice.status;
  const localizedObjective = runtimeSnapshot.world.slice.objective;
  const localizedEnemyIntent = runtimeSnapshot.world.slice.enemyIntent;
  const activeCombatDirective =
    runtimeSnapshot.world.slice.activeCombatDirective;
  const queuedCombatDirectives =
    runtimeSnapshot.world.slice.queuedCombatDirectives;
  const combatFeed = runtimeSnapshot.world.slice.combatFeed;
  const canProgramCombatPlan =
    runtimeReady &&
    currentPhase !== "resolution" &&
    !runtimeSnapshot.world.slice.runOver;
  const voiceSupported =
    clientReady &&
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const nextIncomeTotal =
    runtimeSnapshot.world.slice.baseIncome +
    runtimeSnapshot.world.slice.interestIncome +
    runtimeSnapshot.world.slice.streakIncome;
  const trackedPlayerUnits = collectTrackedPlayerUnits(benchUnits, playerBoard);
  const commanderPreview = parseCommanderDirective(commanderInput, locale);
  const trackedPlayerUnitSignature = trackedPlayerUnits
    .map(
      (unit) =>
        `${unit.agentId}:${unit.battleInstanceId}:${unit.stars}:${unit.attack}:${unit.health}`,
    )
    .join("|");

  useEffect(() => {
    const storedCollection = loadStoredSaveCollection();
    setSaveCollection(storedCollection);
    setDataMode(readStoredDataMode());
    setBackendUrl(readStoredBackendUrl());

    const initialConfig = readStoredBootConfig(storedCollection);
    setRuntimeSnapshot(
      bootRuntimeBridge({
        initialConfig,
      }),
    );
    setClientReady(true);

    const unsubscribe = subscribeRuntimeEvents((event) => {
      setRuntimeSnapshot(event.snapshot);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DATA_MODE_STORAGE_KEY, dataMode);
    } catch {}
  }, [dataMode]);

  useEffect(() => {
    if (dataMode === "local") {
      remoteHydrated.current = false;
    }
  }, [dataMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BACKEND_URL_STORAGE_KEY,
        normalizeBackendUrl(backendUrl),
      );
    } catch {}
  }, [backendUrl]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LAUNCHER_STORAGE_KEY,
        JSON.stringify(runtimeSnapshot.bootConfig),
      );
    } catch {}
  }, [runtimeSnapshot.bootConfig]);

  useEffect(() => {
    if (
      selectedBenchIndex == null ||
      !canDraft ||
      selectedBenchIndex >= benchUnits.length
    ) {
      setSelectedBenchIndex(null);
    }
  }, [benchUnits.length, canDraft, selectedBenchIndex]);

  useEffect(() => {
    if (
      selectedBoardIndex == null ||
      !canDraft ||
      selectedBoardIndex >= playerBoard.length ||
      playerBoard[selectedBoardIndex] == null
    ) {
      setSelectedBoardIndex(null);
    }
  }, [canDraft, playerBoard, selectedBoardIndex]);

  useEffect(() => {
    if (!runtimeSnapshot.world.ready) {
      setDeckTab("command");
      return;
    }

    if (!hasDrafted) {
      setDeckTab("shop");
      return;
    }

    if (!hasDeployed) {
      setDeckTab("bench");
      return;
    }

    if (!hasEnteredCombat) {
      setDeckTab("board");
      return;
    }

    setDeckTab("intel");
  }, [
    currentPhase,
    hasDeployed,
    hasDrafted,
    hasEnteredCombat,
    runtimeSnapshot.world.ready,
  ]);

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      return {
        ...slot,
        profile: {
          ...slot.profile,
          preferredPlayerName: runtimeSnapshot.bootConfig.playerName,
          preferredTouchControls: runtimeSnapshot.bootConfig.touchControls,
          preferredLocale: runtimeSnapshot.bootConfig.locale,
          updatedAt: now,
        },
        updatedAt: now,
      };
    });
  }, [
    activeSlot.id,
    clientReady,
    runtimeSnapshot.bootConfig.playerName,
    runtimeSnapshot.bootConfig.touchControls,
    runtimeSnapshot.bootConfig.locale,
  ]);

  useEffect(() => {
    const currentBoot = runtimeSnapshot.boot.current;

    if (
      !clientReady ||
      currentBoot.phase !== "scene-ready" ||
      currentBoot.id === lastSceneReadyEventId.current
    ) {
      return;
    }

    lastSceneReadyEventId.current = currentBoot.id;

    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      return {
        ...slot,
        profile: {
          ...slot.profile,
          runsLaunched: slot.profile.runsLaunched + 1,
          updatedAt: now,
        },
        progression: awardLaunchProgression(slot.progression, now),
        updatedAt: now,
      };
    });
  }, [activeSlot.id, clientReady, runtimeSnapshot.boot.current]);

  useEffect(() => {
    if (!clientReady || !runtimeSnapshot.world.ready) {
      return;
    }

    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      const nextProfile = {
        ...slot.profile,
        lastScore: runtimeSnapshot.world.slice.score,
        lastRound: runtimeSnapshot.world.slice.round,
        lastCaptured: runtimeSnapshot.world.slice.captured,
        bestScore: Math.max(
          slot.profile.bestScore,
          runtimeSnapshot.world.slice.score,
        ),
        bestRound: Math.max(
          slot.profile.bestRound,
          runtimeSnapshot.world.slice.round,
        ),
        updatedAt: now,
      };

      const nextProgression = awardProgressionMilestones(
        slot.progression,
        nextProfile.bestScore,
        nextProfile.bestRound,
        now,
      );

      if (
        slot.profile.lastScore === nextProfile.lastScore &&
        slot.profile.lastRound === nextProfile.lastRound &&
        slot.profile.lastCaptured === nextProfile.lastCaptured &&
        slot.profile.bestScore === nextProfile.bestScore &&
        slot.profile.bestRound === nextProfile.bestRound &&
        slot.progression.xp === nextProgression.xp &&
        slot.progression.level === nextProgression.level &&
        slot.progression.unlockedBadges.length ===
          nextProgression.unlockedBadges.length
      ) {
        return slot;
      }

      return {
        ...slot,
        profile: nextProfile,
        progression: nextProgression,
        updatedAt: now,
      };
    });
  }, [
    activeSlot.id,
    clientReady,
    runtimeSnapshot.world.ready,
    runtimeSnapshot.world.slice.captured,
    runtimeSnapshot.world.slice.round,
    runtimeSnapshot.world.slice.score,
  ]);

  useEffect(() => {
    if (!clientReady || dataMode !== "local" || !runtimeSnapshot.world.ready) {
      return;
    }

    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      const nextActiveRun =
        !runtimeSnapshot.world.slice.runOver &&
        typeof runtimeSnapshot.world.slice.serializedRunState === "string" &&
        runtimeSnapshot.world.slice.serializedRunState.trim()
          ? {
              version: 1 as const,
              state: runtimeSnapshot.world.slice.serializedRunState,
              updatedAt: now,
              runNumber: runtimeSnapshot.world.slice.runNumber,
              round: runtimeSnapshot.world.slice.round,
            }
          : null;

      if (
        slot.activeRun?.state === nextActiveRun?.state &&
        slot.activeRun?.runNumber === nextActiveRun?.runNumber &&
        slot.activeRun?.round === nextActiveRun?.round
      ) {
        return slot;
      }

      return {
        ...slot,
        activeRun: nextActiveRun,
        updatedAt: now,
      };
    });
  }, [
    activeSlot.id,
    clientReady,
    dataMode,
    runtimeSnapshot.world.ready,
    runtimeSnapshot.world.slice.round,
    runtimeSnapshot.world.slice.runNumber,
    runtimeSnapshot.world.slice.runOver,
    runtimeSnapshot.world.slice.serializedRunState,
  ]);

  useEffect(() => {
    if (!runtimeSnapshot.world.ready) {
      trackedSessionId.current = null;
      trackedSessionAgentIds.current = new Set();
      return;
    }

    const sessionId =
      currentSession?.id ??
      buildSessionId(activeSlot.id, runtimeSnapshot.world.slice.runNumber);

    if (trackedSessionId.current !== sessionId) {
      trackedSessionId.current = sessionId;
      trackedSessionAgentIds.current = new Set();
    }

    for (const unit of trackedPlayerUnits) {
      trackedSessionAgentIds.current.add(unit.agentId);
    }
  }, [
    activeSlot.id,
    currentSession?.id,
    runtimeSnapshot.world.ready,
    runtimeSnapshot.world.slice.runNumber,
    trackedPlayerUnitSignature,
  ]);

  useEffect(() => {
    if (
      !clientReady ||
      dataMode !== "local" ||
      !runtimeSnapshot.world.ready ||
      trackedPlayerUnits.length === 0
    ) {
      return;
    }

    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      const nextAgentRoster = mergeAgentRoster(
        slot.agentRoster,
        trackedPlayerUnits,
        currentSession?.id ?? null,
        now,
      );

      if (nextAgentRoster === slot.agentRoster) {
        return slot;
      }

      return {
        ...slot,
        agentRoster: nextAgentRoster,
        updatedAt: now,
      };
    });
  }, [
    activeSlot.id,
    clientReady,
    currentSession?.id,
    dataMode,
    runtimeSnapshot.world.ready,
    trackedPlayerUnitSignature,
  ]);

  useEffect(() => {
    if (!runtimeSnapshot.world.ready) {
      setCurrentSession(null);
      return;
    }

    const nextSessionId = buildSessionId(
      activeSlot.id,
      runtimeSnapshot.world.slice.runNumber,
    );

    setCurrentSession((current) => {
      const now = new Date().toISOString();
      const nextStatus = runtimeSnapshot.world.slice.runOver
        ? "completed"
        : runtimeSnapshot.world.slice.phase === "combat"
          ? "live"
          : "staging";

      if (!current || current.id !== nextSessionId) {
        return {
          id: nextSessionId,
          template: "numeron-run",
          slotId: activeSlot.id,
          playerName: runtimeSnapshot.bootConfig.playerName,
          locale: runtimeSnapshot.bootConfig.locale,
          status: nextStatus,
          round: runtimeSnapshot.world.slice.round,
          objective: runtimeSnapshot.world.slice.objective,
          score: runtimeSnapshot.world.slice.score,
          captured: runtimeSnapshot.world.slice.captured,
          total: runtimeSnapshot.world.slice.total,
          startedAt: now,
          updatedAt: now,
          endedAt: runtimeSnapshot.world.slice.runOver ? now : null,
        };
      }

      return {
        ...current,
        playerName: runtimeSnapshot.bootConfig.playerName,
        locale: runtimeSnapshot.bootConfig.locale,
        status: nextStatus,
        round: runtimeSnapshot.world.slice.round,
        objective: runtimeSnapshot.world.slice.objective,
        score: runtimeSnapshot.world.slice.score,
        captured: runtimeSnapshot.world.slice.captured,
        total: runtimeSnapshot.world.slice.total,
        updatedAt: now,
        endedAt:
          runtimeSnapshot.world.slice.runOver && !current.endedAt
            ? now
            : current.endedAt,
      };
    });
  }, [
    activeSlot.id,
    runtimeSnapshot.bootConfig.playerName,
    runtimeSnapshot.bootConfig.locale,
    runtimeSnapshot.world.ready,
    runtimeSnapshot.world.slice.captured,
    runtimeSnapshot.world.slice.objective,
    runtimeSnapshot.world.slice.round,
    runtimeSnapshot.world.slice.runNumber,
    runtimeSnapshot.world.slice.runOver,
    runtimeSnapshot.world.slice.score,
    runtimeSnapshot.world.slice.total,
    runtimeSnapshot.world.slice.phase,
  ]);

  useEffect(() => {
    if (!currentSession) {
      return;
    }

    updateSlot(currentSession.slotId, (slot) => {
      const currentIndex = slot.recentSessions.findIndex(
        (session) => session.id === currentSession.id,
      );
      const nextRecentSessions =
        currentIndex >= 0
          ? slot.recentSessions.map((session, index) =>
              index === currentIndex ? currentSession : session,
            )
          : [currentSession, ...slot.recentSessions].slice(0, 6);

      if (
        currentIndex >= 0 &&
        slot.recentSessions[currentIndex] === currentSession
      ) {
        return slot;
      }

      return {
        ...slot,
        recentSessions: nextRecentSessions,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [currentSession]);

  useEffect(() => {
    if (!currentSession || dataMode !== "local") {
      return;
    }

    const now = new Date().toISOString();
    const playerAgentIds = [...trackedSessionAgentIds.current].sort();
    const battleRecord = buildBattleRecord(
      currentSession,
      runtimeSnapshot,
      playerAgentIds,
    );

    updateSlot(currentSession.slotId, (slot) => {
      const nextBattleRecords = upsertBattleRecord(
        slot.battleRecords,
        battleRecord,
      );
      if (nextBattleRecords === slot.battleRecords) {
        return slot;
      }

      return {
        ...slot,
        battleRecords: nextBattleRecords,
        updatedAt: now,
      };
    });

    if (
      currentSession.status !== "completed" ||
      lastSettledBattleId.current === currentSession.id
    ) {
      return;
    }

    lastSettledBattleId.current = currentSession.id;

    updateSlot(currentSession.slotId, (slot) => {
      const nextAgentRoster = settleAgentRoster(
        slot.agentRoster,
        playerAgentIds,
        runtimeSnapshot.world.slice.runResult,
        currentSession.id,
      );

      if (nextAgentRoster === slot.agentRoster) {
        return slot;
      }

      return {
        ...slot,
        agentRoster: nextAgentRoster,
        updatedAt: now,
      };
    });
  }, [currentSession, dataMode, runtimeSnapshot]);

  useEffect(() => {
    if (!currentSession || currentSession.status !== "completed") {
      return;
    }

    if (lastArchivedSessionId.current === currentSession.id) {
      return;
    }

    lastArchivedSessionId.current = currentSession.id;

    updateSlot(currentSession.slotId, (slot) => {
      const now = new Date().toISOString();
      return {
        ...slot,
        progression: awardSweepProgression(slot.progression, now),
        updatedAt: now,
      };
    });
  }, [currentSession]);

  useEffect(() => {
    if (!clientReady || dataMode !== "remote" || remoteHydrated.current) {
      return;
    }

    remoteHydrated.current = true;
    void handlePullRemote();
  }, [clientReady, dataMode]);

  useEffect(() => {
    if (!clientReady || dataMode !== "remote") {
      return;
    }

    const signature = [
      activeSlot.id,
      remoteProfileSlot.profile.preferredPlayerName,
      remoteProfileSlot.profile.preferredTouchControls ? "1" : "0",
      remoteProfileSlot.profile.preferredLocale,
      activeSlot.profile.bestScore,
      activeSlot.profile.bestRound,
    ].join(":");

    if (remoteProfileSignature.current === signature) {
      return;
    }

    remoteProfileSignature.current = signature;

    void pushBackendProfile(normalizeBackendUrl(backendUrl), remoteProfileSlot)
      .then(() => {
        setBackendMessage(copy.remoteProfileSynced(activeSlot.label));
      })
      .catch((error: unknown) => {
        setBackendMessage(
          formatErrorMessage(error, copy.remoteProfileSyncFailed),
        );
      });
  }, [
    activeSlot.id,
    activeSlot.label,
    activeSlot.profile.bestRound,
    activeSlot.profile.bestScore,
    remoteProfileSlot.profile.preferredLocale,
    remoteProfileSlot.profile.preferredPlayerName,
    remoteProfileSlot.profile.preferredTouchControls,
    backendUrl,
    clientReady,
    copy,
    dataMode,
    remoteProfileSlot,
  ]);

  useEffect(() => {
    if (!clientReady || dataMode !== "remote" || !currentSession) {
      return;
    }

    void syncCurrentSessionToRemote(currentSession, backendUrl)
      .then((created) => {
        if (created) {
          setBackendMessage(copy.remoteSessionSynced(currentSession.id));
        }
      })
      .catch((error: unknown) => {
        setBackendMessage(
          formatErrorMessage(error, copy.remoteSessionSyncFailed),
        );
      });
  }, [backendUrl, clientReady, copy, currentSession, dataMode]);

  useEffect(() => {
    void dispatchUiIntent({
      type: "runtime.virtual-input.set",
      input: {
        x: Number(controls.right) - Number(controls.left),
        y: Number(controls.up) - Number(controls.down),
      },
    });
  }, [controls]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const control = controlKeyFromKeyboard(event.key);

      if (!control) {
        return;
      }

      event.preventDefault();
      setControlPressed(control, true);
    }

    function handleKeyUp(event: KeyboardEvent) {
      const control = controlKeyFromKeyboard(event.key);

      if (!control) {
        return;
      }

      event.preventDefault();
      setControlPressed(control, false);
    }

    function releaseControls() {
      setControls((current) =>
        Object.values(current).some(Boolean) ? DEFAULT_CONTROL_STATE : current,
      );
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseControls);
    window.addEventListener("pagehide", releaseControls);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseControls);
      window.removeEventListener("pagehide", releaseControls);
    };
  }, []);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop();
      speechRecognitionRef.current = null;
    };
  }, []);

  function commitCollection(
    updater: (current: RuntimeSaveCollection) => RuntimeSaveCollection,
  ) {
    setSaveCollection((current) => {
      const next = updater(current);
      saveStoredSaveCollection(next);
      return next;
    });
  }

  function updateSlot(
    slotId: SaveSlotId,
    updater: (slot: RuntimeSaveSlot) => RuntimeSaveSlot,
  ) {
    commitCollection((current) => {
      const slot =
        current.slots.find((candidate) => candidate.id === slotId) ??
        defaultSaveSlot(slotId);
      return replaceSlot(
        current,
        sanitizeSaveSlot(updater(slot), slotId, slot.label),
      );
    });
  }

  function setLauncherConfig<K extends keyof RuntimeBootConfig>(
    key: K,
    value: RuntimeBootConfig[K],
  ) {
    void dispatchUiIntent({
      type: "runtime.boot-config.patch",
      patch: {
        [key]: value,
      },
    });
  }

  function setControlPressed(control: ControlKey, pressed: boolean) {
    setControls((current) =>
      current[control] === pressed
        ? current
        : {
            ...current,
            [control]: pressed,
          },
    );
  }

  function handleLaunch() {
    void dispatchUiIntent({
      type: "runtime.boot",
      resumeState:
        dataMode === "local" ? (activeSlot.activeRun?.state ?? null) : null,
    });
  }

  function handleStartCombat() {
    void dispatchUiIntent({
      type: "runtime.round.start",
    });
  }

  function handleResetRound() {
    void dispatchUiIntent({
      type: "runtime.round.reset",
    });
  }

  function handleRestartRun() {
    updateSlot(activeSlot.id, (slot) => {
      const now = new Date().toISOString();
      return {
        ...slot,
        activeRun: null,
        profile: {
          ...slot.profile,
          runsLaunched: slot.profile.runsLaunched + 1,
          updatedAt: now,
        },
        progression: awardLaunchProgression(slot.progression, now),
        updatedAt: now,
      };
    });

    void dispatchUiIntent({
      type: "runtime.run.restart",
    });
  }

  function handleRerollShop() {
    void dispatchUiIntent({
      type: "runtime.shop.reroll",
    });
  }

  function handleToggleShopLock() {
    void dispatchUiIntent({
      type: "runtime.shop.lock.toggle",
    });
  }

  function handleBuyXp() {
    void dispatchUiIntent({
      type: "runtime.shop.buy-xp",
    });
  }

  function handleChooseAugment(index: number) {
    void dispatchUiIntent({
      type: "runtime.augment.choose",
      index,
    });
  }

  function handleBuyOffer(index: number) {
    void dispatchUiIntent({
      type: "runtime.shop.buy",
      index,
    });
  }

  function handleSelectBenchUnit(index: number) {
    setSelectedBoardIndex(null);
    setSelectedBenchIndex((current) => (current === index ? null : index));
  }

  function handleSelectBoardUnit(index: number) {
    if (
      canDraft &&
      selectedBoardIndex != null &&
      selectedBoardIndex !== index
    ) {
      void dispatchUiIntent({
        type: "runtime.board.reposition",
        fromSlot: selectedBoardIndex,
        toSlot: index,
      });
      setSelectedBoardIndex(null);
      setSelectedBenchIndex(null);
      return;
    }

    setSelectedBenchIndex(null);
    setSelectedBoardIndex((current) => (current === index ? null : index));
  }

  function handleDeployBenchUnit(slotIndex: number) {
    if (selectedBenchIndex == null) {
      return;
    }

    void dispatchUiIntent({
      type: "runtime.board.deploy",
      benchIndex: selectedBenchIndex,
      slotIndex,
    });
    setSelectedBenchIndex(null);
  }

  function handleWithdrawBoardUnit() {
    if (selectedBoardIndex == null) {
      return;
    }

    void dispatchUiIntent({
      type: "runtime.board.withdraw",
      slotIndex: selectedBoardIndex,
    });
    setSelectedBoardIndex(null);
  }

  function handleSellBenchUnit() {
    if (selectedBenchIndex == null) {
      return;
    }

    void dispatchUiIntent({
      type: "runtime.bench.sell",
      benchIndex: selectedBenchIndex,
    });
    setSelectedBenchIndex(null);
  }

  function handleSellBoardUnit() {
    if (selectedBoardIndex == null) {
      return;
    }

    void dispatchUiIntent({
      type: "runtime.board.sell",
      slotIndex: selectedBoardIndex,
    });
    setSelectedBoardIndex(null);
  }

  function handleSetCombatDirective(directive: RuntimeCombatDirectiveInput) {
    void dispatchUiIntent({
      type: "runtime.combat.directive.set",
      directive,
    });
  }

  function handleReplaceCombatPlan(plan: RuntimeCombatDirectiveInput[]) {
    void dispatchUiIntent({
      type: "runtime.combat.plan.replace",
      plan,
    });
  }

  function handleClearCombatDirective() {
    void dispatchUiIntent({
      type: "runtime.combat.directive.clear",
    });
  }

  function handleCommanderApply(rawInput = commanderInput) {
    const parsed = parseCommanderDirective(rawInput, locale);

    if (parsed.kind === "unknown") {
      setCommanderMessage(
        locale === "zh-CN"
          ? "没识别出可执行战术。可试试：右路集火后排 / 先保留技能再集火后排 / 左路后撤 2 tick / 清除战术。"
          : "No supported tactic found. Try: focus backline on right for 3 ticks / hold skills then focus backline / fallback left 2 ticks / clear plan.",
      );
      return;
    }

    if (!canProgramCombatPlan) {
      setCommanderMessage(
        locale === "zh-CN"
          ? "战术计划只能在备战或战斗阶段编排。"
          : "Combat plans can only be staged during preparation or live combat.",
      );
      return;
    }

    if (parsed.kind === "clear") {
      handleClearCombatDirective();
      setCommanderMessage(
        locale === "zh-CN"
          ? "已清空当前战术计划。"
          : "Cleared the current combat plan.",
      );
      return;
    }

    if (parsed.steps.length === 1) {
      handleSetCombatDirective(parsed.steps[0]);
    } else {
      handleReplaceCombatPlan(parsed.steps);
    }
    setCommanderMessage(
      locale === "zh-CN"
        ? `已解析并下发战术计划：${parsed.label}。`
        : `Parsed and issued combat plan: ${parsed.label}.`,
    );
  }

  function handleCommanderPreset(directive: RuntimeCombatDirectiveKey) {
    const presetPlan = getCombatDirectivePreset(directive);
    setCommanderInput(formatCombatPlanLabel(presetPlan, locale));
    setCommanderMessage(null);
    if (presetPlan.length === 1) {
      handleSetCombatDirective(presetPlan[0]);
    } else {
      handleReplaceCombatPlan(presetPlan);
    }
    setCommanderMessage(
      locale === "zh-CN"
        ? `已加载预设：${formatCombatPlanLabel(presetPlan, locale)}。`
        : `Loaded preset: ${formatCombatPlanLabel(presetPlan, locale)}.`,
    );
  }

  function handleVoiceCapture() {
    if (!voiceSupported || typeof window === "undefined") {
      setCommanderMessage(
        locale === "zh-CN"
          ? "当前浏览器不支持语音转写。"
          : "This browser does not support speech transcription.",
      );
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    speechRecognitionRef.current?.stop();
    const recognition = new Recognition();
    recognition.lang = locale === "zh-CN" ? "zh-CN" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      setCommanderInput(transcript);
      if (transcript) {
        handleCommanderApply(transcript);
      }
    };
    recognition.onerror = (event) => {
      setCommanderMessage(
        locale === "zh-CN"
          ? `语音转写失败：${event.error ?? "unknown"}`
          : `Speech transcription failed: ${event.error ?? "unknown"}`,
      );
      setIsVoiceListening(false);
    };
    recognition.onend = () => {
      setIsVoiceListening(false);
      speechRecognitionRef.current = null;
    };

    speechRecognitionRef.current = recognition;
    setIsVoiceListening(true);
    setCommanderMessage(
      locale === "zh-CN"
        ? "正在监听战术指令…"
        : "Listening for a combat order...",
    );
    recognition.start();
  }

  async function handlePullRemote() {
    try {
      const snapshot = await fetchBackendSnapshot(
        normalizeBackendUrl(backendUrl),
      );
      remoteKnownSessionIds.current = new Set(
        snapshot.sessions.map((session) => session.id),
      );
      remoteProfileSignature.current = null;
      let nextCollection = saveCollection;
      setSaveCollection((current) => {
        nextCollection = applyBackendSnapshot(current, snapshot);
        return nextCollection;
      });
      void dispatchUiIntent({
        type: "runtime.boot-config.patch",
        patch: profileToBootConfig(getActiveSlot(nextCollection)),
      });
      setBackendMessage(
        copy.remotePullSummary(
          snapshot.sessions.length,
          Object.keys(snapshot.profiles).length,
        ),
      );
    } catch (error: unknown) {
      setBackendMessage(formatErrorMessage(error, copy.remotePullFailed));
    }
  }

  async function handlePushRemote() {
    try {
      await pushBackendProfile(
        normalizeBackendUrl(backendUrl),
        remoteProfileSlot,
      );
      if (currentSession) {
        await syncCurrentSessionToRemote(currentSession, backendUrl);
      }
      const health = await fetchBackendHealth(normalizeBackendUrl(backendUrl));
      setBackendMessage(
        copy.remotePushSummary(health.tick, health.profiles, health.sessions),
      );
    } catch (error: unknown) {
      setBackendMessage(formatErrorMessage(error, copy.remotePushFailed));
    }
  }

  function handleSelectSlot(slotId: SaveSlotId) {
    const nextSlot =
      saveCollection.slots.find((slot) => slot.id === slotId) ??
      defaultSaveSlot(slotId);

    commitCollection((current) => ({
      ...current,
      activeSlotId: slotId,
    }));

    setSaveMessage(copy.activeSlotSwitched(nextSlot.label));
    setSaveDraft("");
    void dispatchUiIntent({
      type: "runtime.boot-config.patch",
      patch: profileToBootConfig(nextSlot),
    });
  }

  function handleRenameSlot(label: string) {
    updateSlot(activeSlot.id, (slot) => ({
      ...slot,
      label: sanitizeSlotLabel(label),
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleResetActiveSlot() {
    const reset = {
      ...defaultSaveSlot(activeSlot.id, activeSlot.label),
      label: activeSlot.label,
      updatedAt: new Date().toISOString(),
    };

    updateSlot(activeSlot.id, () => reset);
    setCurrentSession(null);
    setSaveDraft("");
    setSaveMessage(copy.resetSlot(activeSlot.label));
    void dispatchUiIntent({
      type: "runtime.boot-config.patch",
      patch: profileToBootConfig(reset),
    });
  }

  function handleResetAllSaves() {
    const next = defaultSaveCollection();
    clearStoredSaveCollection();
    saveStoredSaveCollection(next);
    setSaveCollection(next);
    setCurrentSession(null);
    setSaveDraft("");
    setSaveMessage(copy.resetAllSlots);
    void dispatchUiIntent({
      type: "runtime.boot-config.patch",
      patch: profileToBootConfig(getActiveSlot(next)),
    });
  }

  async function handleCopySaveMatrix() {
    const raw = exportSaveCollection(saveCollection);
    setSaveDraft(raw);

    try {
      await navigator.clipboard.writeText(raw);
      setSaveMessage(copy.snapshotCopied);
    } catch {
      setSaveMessage(copy.snapshotPrepared);
    }
  }

  function handleImportSaveMatrix() {
    try {
      const next = importSaveCollection(saveDraft);
      saveStoredSaveCollection(next);
      setSaveCollection(next);
      setSaveMessage(copy.snapshotImported);
      void dispatchUiIntent({
        type: "runtime.boot-config.patch",
        patch: profileToBootConfig(getActiveSlot(next)),
      });
    } catch {
      setSaveMessage(copy.snapshotImportFailed);
    }
  }

  async function syncCurrentSessionToRemote(
    session: MatchSessionRecord,
    nextBackendUrl: string,
  ) {
    const baseUrl = normalizeBackendUrl(nextBackendUrl);

    let created = false;
    if (!remoteKnownSessionIds.current.has(session.id)) {
      await createBackendSession(baseUrl, session);
      remoteKnownSessionIds.current.add(session.id);
      created = true;
    }

    await updateBackendSession(baseUrl, session);
    return created;
  }

  const onboarding = buildOnboardingModel({
    locale,
    ready: runtimeSnapshot.world.ready,
    benchCount: benchUnits.length,
    deployedUnits,
    canStartCombat,
    canAdvanceRound,
    canRestartRun,
    currentPhase,
  });
  const activeTraitSummary = activeTraits
    .filter((trait) => trait.active)
    .map((trait) => formatFactionLabel(trait.key, locale))
    .join(" · ");
  const combatDirectiveOptions = COMBAT_DIRECTIVES.map((directive) => ({
    key: directive,
    ...getCombatDirectiveCopy(directive, locale),
  }));

  const guideAction = !runtimeSnapshot.world.ready
    ? {
        label: copy.launchRuntime,
        onClick: handleLaunch,
        disabled: !clientReady,
      }
    : canStartCombat
      ? {
          label: copy.startCombat,
          onClick: handleStartCombat,
          disabled: false,
        }
      : canAdvanceRound
        ? {
            label: copy.nextRound,
            onClick: handleResetRound,
            disabled: false,
          }
        : canRestartRun
          ? {
              label: copy.restartRun,
              onClick: handleRestartRun,
              disabled: false,
            }
          : null;

  return (
    <main className="shell">
      <header className={`topbar${runtimeReady ? "" : " boot-state"}`}>
        <div className="topbar-main">
          <div className="hero-header-row">
            <div>
              <div className="eyebrow">{copy.brand}</div>
              <h1 className="title">{copy.title}</h1>
            </div>
            <div className="hero-badge">
              {locale === "zh-CN" ? "横屏战场视图" : "Landscape Battle View"}
            </div>
          </div>
          <p className="muted topbar-copy">{copy.subtitle}</p>
          <div className="status-strip">
            <div className="status-pill">
              <span className="stat-label">{copy.phase}</span>
              <strong>{formatPhaseLabel(currentPhase, locale)}</strong>
            </div>
            <div className="status-pill">
              <span className="stat-label">{copy.gold}</span>
              <strong>{runtimeSnapshot.world.slice.gold}</strong>
            </div>
            <div className="status-pill" data-testid="topbar-round">
              <span className="stat-label">{copy.roundShort}</span>
              <strong>{runtimeSnapshot.world.slice.round}</strong>
            </div>
            <div className="status-pill">
              <span className="stat-label">{copy.runLabel}</span>
              <strong>{runtimeSnapshot.world.slice.runNumber}</strong>
            </div>
            <div className="status-pill">
              <span className="stat-label">{copy.level}</span>
              <strong>{runtimeSnapshot.world.slice.level}</strong>
            </div>
            {runtimeReady ? (
              <div className="status-pill">
                <span className="stat-label">{copy.result}</span>
                <strong>
                  {formatRunResult(
                    runtimeSnapshot.world.slice.runResult,
                    locale,
                  )}
                </strong>
              </div>
            ) : null}
          </div>
        </div>
        <div className="topbar-actions">
          {runtimeReady ? (
            <div className="guide-summary-card">
              <div className="eyebrow">
                {locale === "zh-CN" ? "首局路线" : "First Match Path"}
              </div>
              <strong>{onboarding.headline}</strong>
              <span className="muted">{onboarding.detail}</span>
              {guideAction ? (
                <button
                  type="button"
                  className="button"
                  onClick={guideAction.onClick}
                  disabled={guideAction.disabled}
                >
                  {guideAction.label}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="eyebrow">
            {runtimeReady
              ? copy.language
              : locale === "zh-CN"
                ? "语言"
                : "Language"}
          </div>
          <div className="mode-toggle locale-toggle">
            <button
              type="button"
              className={`mode-chip${locale === "en" ? " active" : ""}`}
              onClick={() => setLauncherConfig("locale", "en")}
            >
              {copy.english}
            </button>
            <button
              type="button"
              className={`mode-chip${locale === "zh-CN" ? " active" : ""}`}
              onClick={() => setLauncherConfig("locale", "zh-CN")}
            >
              {copy.chineseSimplified}
            </button>
          </div>
        </div>
      </header>

      {runtimeReady ? (
        <section className="guide-strip" data-testid="first-run-guide">
          {onboarding.steps.map((step) => (
            <article
              key={step.key}
              className={`guide-step guide-step-${step.status}`}
            >
              <div className="guide-step-index">{step.index}</div>
              <div className="guide-step-copy">
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className={`game-layout${runtimeReady ? "" : " boot-layout"}`}>
        <section
          className={`stage-column${runtimeReady ? "" : " boot-stage-column"}`}
        >
          <section className="canvas-area">
            <div className="canvas-frame">
              <canvas id="bevy-runtime-canvas" />
              {runtimeReady ? (
                <div className="hud">
                  <div className="hud-card hud-card-status">
                    <div className="eyebrow">{copy.projection}</div>
                    <div>{copy.ready}</div>
                  </div>

                  <div className="hud-card objective-card hud-card-objective">
                    <div className="eyebrow">{copy.boardSlice}</div>
                    <div className="objective-title">
                      {runtimeSnapshot.world.slice.captured}/
                      {runtimeSnapshot.world.slice.total || "?"}{" "}
                      {copy.activeUnits}
                    </div>
                    <div className="muted">{localizedRoundState}</div>
                  </div>

                  <div className="hud-card objective-card hud-card-slot">
                    <div className="eyebrow">{copy.activeSlot}</div>
                    <div className="objective-title">{activeSlot.label}</div>
                    <div className="muted">
                      {copy.level} {activeSlot.progression.level} ·{" "}
                      {activeSlot.progression.xp} {copy.xp}
                    </div>
                  </div>

                  {runtimeSnapshot.bootConfig.touchControls ? (
                    <div className="touch-card hud-card-actions">
                      <div className="eyebrow">{copy.quickActions}</div>
                      <div className="touch-grid">
                        <button
                          className="touch-button"
                          onClick={handleStartCombat}
                          disabled={!canStartCombat}
                        >
                          {copy.startCombat}
                        </button>
                        <button
                          className="touch-button"
                          onClick={handleResetRound}
                          disabled={!canAdvanceRound}
                        >
                          {copy.nextRound}
                        </button>
                        <button
                          className="touch-button"
                          onClick={handleRerollShop}
                          disabled={
                            !canDraft ||
                            runtimeSnapshot.world.slice.gold <
                              runtimeSnapshot.world.slice.rerollCost
                          }
                        >
                          {copy.reroll}
                        </button>
                        <button
                          className="touch-button"
                          onClick={() => handleBuyOffer(0)}
                          disabled={
                            !canBuyUnit ||
                            runtimeSnapshot.world.slice.shopOffers.length === 0
                          }
                        >
                          {copy.buy}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="canvas-overlay" data-testid="boot-overlay">
                  <div className="canvas-overlay-card">
                    <div className="eyebrow">
                      {locale === "zh-CN" ? "战场初始化" : "Arena Boot"}
                    </div>
                    <h2 className="canvas-overlay-title">
                      {locale === "zh-CN"
                        ? "先启动 Runtime，再进入首局战斗"
                        : "Launch the runtime to enter your first match"}
                    </h2>
                    <p className="muted canvas-overlay-copy">
                      {locale === "zh-CN"
                        ? "启动后你会依次完成：从商店买第一张棋子、把它放到部署区、然后开始战斗。"
                        : "After launch, you will buy your first unit, place it on the board, and start combat."}
                    </p>
                    <div className="boot-steps">
                      <span>01 {locale === "zh-CN" ? "启动" : "Boot"}</span>
                      <span>02 {locale === "zh-CN" ? "购买" : "Buy"}</span>
                      <span>03 {locale === "zh-CN" ? "部署" : "Deploy"}</span>
                      <span>04 {locale === "zh-CN" ? "开战" : "Fight"}</span>
                    </div>
                    <button
                      type="button"
                      className="button canvas-launch-button"
                      onClick={handleLaunch}
                      disabled={!clientReady}
                      data-testid="canvas-launch-runtime"
                    >
                      {copy.launchRuntime}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {runtimeReady ? (
            <section className="deck-tabs" data-testid="tactical-tabs">
              {[
                {
                  key: "command" as const,
                  label: locale === "zh-CN" ? "指令" : "Command",
                },
                {
                  key: "shop" as const,
                  label: locale === "zh-CN" ? "商店" : "Shop",
                },
                {
                  key: "bench" as const,
                  label: locale === "zh-CN" ? "备战" : "Bench",
                },
                {
                  key: "board" as const,
                  label: locale === "zh-CN" ? "部署" : "Board",
                },
                {
                  key: "intel" as const,
                  label: locale === "zh-CN" ? "情报" : "Intel",
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`deck-tab${deckTab === tab.key ? " active" : ""}`}
                  onClick={() => setDeckTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </section>
          ) : null}

          {runtimeReady ? (
            <section className="tactics-grid">
              <section
                className={`panel tactical-panel deck-panel deck-panel-command${
                  deckTab === "command" ? " active" : ""
                }`}
                data-testid="battle-controls-panel"
              >
                <div className="eyebrow">{copy.battleControls}</div>
                <div className="stat-grid">
                  <div className="stat-card" data-testid="level-stat">
                    <span className="stat-label">{copy.level}</span>
                    <strong>{runtimeSnapshot.world.slice.level}</strong>
                  </div>
                  <div className="stat-card" data-testid="xp-stat">
                    <span className="stat-label">{copy.xp}</span>
                    <strong>
                      {runtimeSnapshot.world.slice.maxLevel >
                      runtimeSnapshot.world.slice.level
                        ? `${runtimeSnapshot.world.slice.xp}/${runtimeSnapshot.world.slice.xpToNextLevel}`
                        : locale === "zh-CN"
                          ? "已满"
                          : "max"}
                    </strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.phase}</span>
                    <strong>{formatPhaseLabel(currentPhase, locale)}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.gold}</span>
                    <strong>{runtimeSnapshot.world.slice.gold}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.reroll}</span>
                    <strong>{runtimeSnapshot.world.slice.rerollCost}</strong>
                  </div>
                  <div className="stat-card" data-testid="deployment-cap-stat">
                    <span className="stat-label">{copy.deployCap}</span>
                    <strong>
                      {deployedUnits}/{deploymentCap}
                    </strong>
                  </div>
                </div>
                <div className="action-row">
                  <button
                    className="button"
                    onClick={handleStartCombat}
                    disabled={!canStartCombat}
                    data-testid="start-combat"
                  >
                    {copy.startCombat}
                  </button>
                  <button
                    className="button secondary"
                    onClick={handleResetRound}
                    disabled={!canAdvanceRound}
                    data-testid="next-round"
                  >
                    {copy.nextRound}
                  </button>
                  <button
                    className="button secondary"
                    onClick={handleRestartRun}
                    disabled={!canRestartRun}
                    data-testid="restart-run"
                  >
                    {copy.restartRun}
                  </button>
                </div>
                <div className="eyebrow">
                  {locale === "zh-CN" ? "战斗战术" : "Combat Tactics"}
                </div>
                <div className="commander-console">
                  <label className="label">
                    {locale === "zh-CN"
                      ? "文本 / 语音战术输入"
                      : "Text / Voice Tactical Input"}
                    <textarea
                      className="commander-textarea"
                      value={commanderInput}
                      onChange={(event) => {
                        setCommanderInput(event.target.value);
                        setCommanderMessage(null);
                      }}
                      placeholder={
                        locale === "zh-CN"
                          ? "例如：右路集火后排 3 tick；先保留技能再集火后排；左路后撤 2 tick；清除战术"
                          : "Try: focus backline on right for 3 ticks; hold skills then focus backline; fallback left 2 ticks; clear plan"
                      }
                      rows={3}
                      data-testid="commander-input"
                    />
                  </label>
                  <div className="action-row">
                    <button
                      className="button secondary"
                      onClick={() => handleCommanderApply()}
                      disabled={!commanderInput.trim()}
                      data-testid="commander-apply"
                    >
                      {locale === "zh-CN"
                        ? "解析并部署计划"
                        : "Parse and Deploy Plan"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={handleVoiceCapture}
                      disabled={!voiceSupported || isVoiceListening}
                      data-testid="commander-voice"
                    >
                      {isVoiceListening
                        ? locale === "zh-CN"
                          ? "监听中…"
                          : "Listening…"
                        : locale === "zh-CN"
                          ? "语音输入"
                          : "Voice Input"}
                    </button>
                  </div>
                  <div className="commander-hints">
                    {combatDirectiveOptions.map((directive) => (
                      <button
                        key={`hint-${directive.key}`}
                        type="button"
                        className="commander-hint-chip"
                        onClick={() => handleCommanderPreset(directive.key)}
                      >
                        {directive.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="commander-hint-chip"
                      onClick={() => {
                        setCommanderInput(
                          locale === "zh-CN" ? "清除战术" : "clear plan",
                        );
                        setCommanderMessage(null);
                        handleClearCombatDirective();
                      }}
                    >
                      {locale === "zh-CN" ? "清除战术" : "Clear Plan"}
                    </button>
                  </div>
                  {commanderInput.trim() ? (
                    <div className="commander-plan-board">
                      <div className="eyebrow">
                        {locale === "zh-CN" ? "解析预览" : "Parse Preview"}
                      </div>
                      {commanderPreview.kind === "plan" ? (
                        commanderPreview.steps.map((step, index) => (
                          <div
                            className="commander-plan-step"
                            key={`preview-${index}`}
                          >
                            <span className="commander-plan-index">
                              {index + 1}
                            </span>
                            <div>
                              <strong>
                                {formatCombatPlanStep(step, locale)}
                              </strong>
                              <div className="muted">
                                {locale === "zh-CN"
                                  ? `持续 ${normalizeDirectiveDuration(step)} tick`
                                  : `${normalizeDirectiveDuration(step)} tick(s)`}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : commanderPreview.kind === "clear" ? (
                        <div className="muted">{commanderPreview.label}</div>
                      ) : (
                        <div className="muted">
                          {locale === "zh-CN"
                            ? "未识别到有效战术语法。"
                            : "No supported tactical grammar recognized yet."}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="commander-plan-board">
                    <div className="eyebrow">
                      {locale === "zh-CN"
                        ? "当前战术队列"
                        : "Live Tactical Queue"}
                    </div>
                    {activeCombatDirective ? (
                      <div className="commander-plan-step active">
                        <span className="commander-plan-index">1</span>
                        <div>
                          <strong>
                            {formatDirectiveViewLabel(
                              activeCombatDirective,
                              locale,
                            )}
                          </strong>
                          <div className="muted">
                            {locale === "zh-CN"
                              ? `剩余 ${activeCombatDirective.remainingTicks}/${activeCombatDirective.durationTicks} tick`
                              : `${activeCombatDirective.remainingTicks}/${activeCombatDirective.durationTicks} tick(s) remain`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="muted">
                        {locale === "zh-CN"
                          ? "当前没有生效中的战术步骤。"
                          : "No combat step is active right now."}
                      </div>
                    )}
                    {queuedCombatDirectives.map((directive, index) => (
                      <div
                        className="commander-plan-step"
                        key={`${directive.key}-${directive.lane ?? "none"}-${index}`}
                      >
                        <span className="commander-plan-index">
                          {index + 2}
                        </span>
                        <div>
                          <strong>
                            {formatDirectiveViewLabel(directive, locale)}
                          </strong>
                          <div className="muted">
                            {locale === "zh-CN"
                              ? `排队持续 ${directive.durationTicks} tick`
                              : `Queued for ${directive.durationTicks} tick(s)`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="muted">
                    {voiceSupported
                      ? locale === "zh-CN"
                        ? "语音转写走浏览器原生识别，转写结果会进入同一套规则解析。"
                        : "Voice transcription uses the browser's native recognizer, then runs through the same constrained parser."
                      : locale === "zh-CN"
                        ? "当前浏览器不支持原生语音转写，仍可使用文本输入。"
                        : "Native browser speech transcription is unavailable here, but text input still works."}
                  </div>
                  {commanderMessage ? (
                    <div className="muted" data-testid="commander-message">
                      {commanderMessage}
                    </div>
                  ) : null}
                </div>
                <div className="offer-grid">
                  {combatDirectiveOptions.map((directive) => {
                    const active = activeCombatDirective?.key === directive.key;

                    return (
                      <button
                        key={directive.key}
                        type="button"
                        className={`offer-card${active ? " selected" : ""}`}
                        onClick={() => handleCommanderPreset(directive.key)}
                        disabled={!canProgramCombatPlan}
                        data-testid={`combat-directive-${directive.key}`}
                      >
                        <span className="slot-title">{directive.label}</span>
                        <span className="slot-meta">
                          {directive.description}
                        </span>
                        <span className="slot-meta">
                          {active
                            ? locale === "zh-CN"
                              ? "当前生效"
                              : "Active now"
                            : locale === "zh-CN"
                              ? "可预设或临场切换"
                              : "Stage or swap live"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={handleClearCombatDirective}
                    disabled={
                      !canProgramCombatPlan ||
                      (!activeCombatDirective &&
                        queuedCombatDirectives.length === 0)
                    }
                    data-testid="clear-combat-directive"
                  >
                    {locale === "zh-CN" ? "清空计划" : "Clear Plan"}
                  </button>
                </div>
                <div className="muted">
                  {activeCombatDirective
                    ? activeCombatDirective.description
                    : runtimeSnapshot.world.slice.runOver
                      ? copy.runClosedHint
                      : underDeployCap
                        ? copy.underDeployCapHint
                        : runtimeSnapshot.world.slice.roundResolved
                          ? copy.roundResolvedHint
                          : canProgramCombatPlan
                            ? locale === "zh-CN"
                              ? "现在可以预设或临场替换多步战术计划，观察目标选择、技能节奏和承伤分布如何随着队列推进而变化。"
                              : "You can now stage or hot-swap multi-step combat plans and watch targeting, cadence, and pressure distribution evolve as the queue advances."
                            : copy.prepHint}
                </div>
              </section>

              <section
                className={`panel tactical-panel deck-panel deck-panel-shop${
                  deckTab === "shop" ? " active" : ""
                }`}
                data-testid="draft-shop"
              >
                <div className="eyebrow">{copy.draftShop}</div>
                <div className="offer-grid">
                  {runtimeSnapshot.world.slice.shopOffers.map(
                    (offer, index) => (
                      <button
                        key={`${offer.archetype}-${offer.stars}-${index}`}
                        type="button"
                        className="offer-card"
                        onClick={() => handleBuyOffer(index)}
                        disabled={!canBuyUnit}
                        data-testid={`shop-offer-${index}`}
                      >
                        <UnitPortrait unit={offer} />
                        <span className="slot-title">{offer.label}</span>
                        <span className="slot-meta">
                          {formatFactionLabel(offer.faction, locale)} ·{" "}
                          {formatRoleLabel(offer.role, locale)}
                        </span>
                        <span className="slot-meta">
                          {renderUnitMeta(offer, locale)} · {copy.buy}{" "}
                          {BUY_COST_LABEL}
                        </span>
                      </button>
                    ),
                  )}
                </div>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={handleRerollShop}
                    disabled={!canRerollShop}
                    data-testid="reroll-shop"
                  >
                    {copy.rerollShop}
                  </button>
                  <button
                    className="button secondary"
                    onClick={handleToggleShopLock}
                    disabled={!canDraft}
                    data-testid="lock-shop"
                  >
                    {runtimeSnapshot.world.slice.shopLocked
                      ? copy.unlockShop
                      : copy.lockShop}
                  </button>
                  <button
                    className="button secondary"
                    onClick={handleBuyXp}
                    disabled={!canBuyXp}
                    data-testid="buy-xp"
                  >
                    {copy.buyXp}
                  </button>
                </div>
                <div className="muted">{copy.draftHint}</div>
              </section>

              <section
                className={`panel tactical-panel deck-panel deck-panel-bench${
                  deckTab === "bench" ? " active" : ""
                }`}
                data-testid="bench-panel"
              >
                <div className="eyebrow">{copy.benchPanel}</div>
                <div className="formation-grid">
                  {Array.from({
                    length: runtimeSnapshot.world.slice.benchCapacity,
                  }).map((_, index) => {
                    const unit = benchUnits[index] ?? null;
                    return (
                      <button
                        key={`bench-${index}`}
                        type="button"
                        className={`formation-card${unit ? "" : " empty"}${
                          selectedBenchIndex === index ? " selected" : ""
                        }`}
                        onClick={() => handleSelectBenchUnit(index)}
                        disabled={!canDraft || !unit}
                        data-testid={`bench-slot-${index}`}
                      >
                        {unit ? <UnitPortrait unit={unit} compact /> : null}
                        <span className="slot-title">
                          {unit
                            ? unit.label
                            : locale === "zh-CN"
                              ? "空备战槽"
                              : "Empty Bench Slot"}
                        </span>
                        <span className="slot-meta">
                          {unit
                            ? selectedBenchIndex === index
                              ? locale === "zh-CN"
                                ? "已选中，下一步去点部署区空槽"
                                : "Selected. Next tap an empty board slot"
                              : locale === "zh-CN"
                                ? "点击选中"
                                : "Click to select"
                            : locale === "zh-CN"
                              ? "从商店购买"
                              : "Buy from the shop"}
                        </span>
                        {unit ? (
                          <span className="slot-meta">
                            {renderUnitMeta(unit, locale)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={handleSellBenchUnit}
                    disabled={!hasBenchSelection}
                    data-testid="sell-bench"
                  >
                    {copy.sellBenchUnit}
                  </button>
                </div>
                <div className="muted">
                  {hasBenchSelection
                    ? copy.benchSelectedHint
                    : copy.benchIdleHint}
                </div>
              </section>

              <section
                className={`panel tactical-panel deck-panel deck-panel-board${
                  deckTab === "board" ? " active" : ""
                }`}
                data-testid="deployment-panel"
              >
                <div className="eyebrow">{copy.deployment}</div>
                <div className="formation-grid">
                  {playerBoard.map((unit, index) => {
                    const isEmpty = unit == null;
                    const canDeployIntoSlot =
                      canDraft &&
                      isEmpty &&
                      hasBenchSelection &&
                      !deploymentCapReached;
                    const isSelected = selectedBoardIndex === index;
                    const canRepositionIntoSlot =
                      canDraft && hasBoardSelection && !isSelected;
                    const canSelectSlot = canDraft && !isEmpty;

                    return (
                      <button
                        key={`board-${index}`}
                        type="button"
                        className={`formation-card${isEmpty ? " empty" : ""}${
                          isSelected ? " selected" : ""
                        }`}
                        onClick={() =>
                          isEmpty
                            ? hasBoardSelection
                              ? handleSelectBoardUnit(index)
                              : handleDeployBenchUnit(index)
                            : handleSelectBoardUnit(index)
                        }
                        disabled={
                          !canDeployIntoSlot &&
                          !canRepositionIntoSlot &&
                          !canSelectSlot
                        }
                        data-testid={`board-slot-${index}`}
                      >
                        {unit ? <UnitPortrait unit={unit} compact /> : null}
                        <span className="slot-title">
                          {unit
                            ? unit.label
                            : locale === "zh-CN"
                              ? `空槽位 ${index + 1}`
                              : `Empty Slot ${index + 1}`}
                        </span>
                        <span className="slot-meta">
                          {unit
                            ? isSelected
                              ? locale === "zh-CN"
                                ? "已选中，可点其他槽位换位或对调"
                                : "Selected. Click another slot to move or swap"
                              : hasBoardSelection
                                ? locale === "zh-CN"
                                  ? "点击与已选单位对调"
                                  : "Click to swap with the selected unit"
                                : locale === "zh-CN"
                                  ? "点击选中"
                                  : "Click to select"
                            : hasBoardSelection
                              ? locale === "zh-CN"
                                ? "点击把已选单位移到这里"
                                : "Click to move the selected unit here"
                              : hasBenchSelection
                                ? deploymentCapReached
                                  ? copy.deployCapReached
                                  : locale === "zh-CN"
                                    ? "点击部署选中单位"
                                    : "Click to deploy selected unit"
                                : locale === "zh-CN"
                                  ? "先选一个备战单位"
                                  : "Select a bench unit first"}
                        </span>
                        {unit ? (
                          <span className="slot-meta">
                            {renderUnitMeta(unit, locale)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="action-row">
                  <button
                    className="button secondary"
                    onClick={handleWithdrawBoardUnit}
                    disabled={!hasBoardSelection || !canWithdrawUnit}
                    data-testid="withdraw-board"
                  >
                    {copy.withdrawToBench}
                  </button>
                  <button
                    className="button secondary"
                    onClick={handleSellBoardUnit}
                    disabled={!hasBoardSelection}
                    data-testid="sell-board"
                  >
                    {copy.sellDeployedUnit}
                  </button>
                </div>
                <div className="muted">
                  {copy.activeBoard}: {deployedUnits}/{deploymentCap} ·{" "}
                  {copy.boardSlots} {runtimeSnapshot.world.slice.boardCapacity}
                </div>
              </section>

              <section
                className={`panel tactical-panel deck-panel deck-panel-intel${
                  deckTab === "intel" ? " active" : ""
                }`}
              >
                <div className="eyebrow">
                  {locale === "zh-CN" ? "战局情报" : "Battle Intel"}
                </div>
                <div className="stat-grid stat-grid-two">
                  <div className="stat-card">
                    <span className="stat-label">
                      {locale === "zh-CN" ? "当前战术" : "Directive"}
                    </span>
                    <strong>
                      {activeCombatDirective?.label ??
                        (locale === "zh-CN" ? "未启用" : "None")}
                    </strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">
                      {locale === "zh-CN" ? "后续步骤" : "Queued Steps"}
                    </span>
                    <strong>{queuedCombatDirectives.length}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.intent}</span>
                    <strong>{localizedEnemyIntent}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.threat}</span>
                    <strong>{runtimeSnapshot.world.slice.enemyThreat}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.nextIncome}</span>
                    <strong>{nextIncomeTotal}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">{copy.streak}</span>
                    <strong>
                      {formatStreak(runtimeSnapshot.world.slice.streak, locale)}
                    </strong>
                  </div>
                </div>
                <div className="muted">
                  {queuedCombatDirectives.length > 0
                    ? queuedCombatDirectives
                        .map(
                          (directive, index) =>
                            `${index + 1}. ${formatDirectiveViewLabel(
                              directive,
                              locale,
                            )}`,
                        )
                        .join(" · ")
                    : locale === "zh-CN"
                      ? "当前没有排队中的后续战术步骤。"
                      : "No queued follow-up steps right now."}
                </div>
                <div className="muted">
                  {activeTraitSummary ||
                    (locale === "zh-CN"
                      ? "当前还没有激活羁绊。"
                      : "No active synergies yet.")}
                </div>
                <div className="muted">
                  {pendingAugments.length > 0
                    ? copy.augmentDraftHint
                    : locale === "zh-CN"
                      ? "强化、敌方阵容、经济细节会在宽屏和运维抽屉里展开。"
                      : "Augments, enemy lineup, and economy details expand on larger screens or inside the operations drawer."}
                </div>
                <div className="feed-list" data-testid="combat-feed">
                  <div className="stat-label">
                    {locale === "zh-CN" ? "最近战斗事件" : "Recent Combat Feed"}
                  </div>
                  {combatFeed.length > 0 ? (
                    combatFeed.map((entry, index) => (
                      <div key={`${index}-${entry}`} className="muted">
                        {entry}
                      </div>
                    ))
                  ) : (
                    <div className="muted">
                      {locale === "zh-CN"
                        ? "开战后这里会显示最近几条命中、治疗与技能触发。"
                        : "Recent hits, heals, and skill spikes show up here once combat starts."}
                    </div>
                  )}
                </div>
              </section>
            </section>
          ) : null}
        </section>

        {runtimeReady ? (
          <aside className="intel-column">
            <section className="panel" data-testid="augment-panel">
              <div className="eyebrow">{copy.augmentDraft}</div>
              {pendingAugments.length > 0 ? (
                <>
                  <div className="muted">
                    {copy.augmentDraftHint}{" "}
                    {runtimeSnapshot.world.slice.augmentDraftRound > 0
                      ? locale === "zh-CN"
                        ? `当前为第 ${runtimeSnapshot.world.slice.augmentDraftRound} 回合。`
                        : `Current trigger: round ${runtimeSnapshot.world.slice.augmentDraftRound}.`
                      : null}
                  </div>
                  <div className="offer-grid">
                    {pendingAugments.map((augment, index) => (
                      <button
                        key={`${augment.key}-${index}`}
                        type="button"
                        className="offer-card"
                        onClick={() => handleChooseAugment(index)}
                        data-testid={`augment-choice-${index}`}
                      >
                        <span className="slot-title">{augment.label}</span>
                        <span className="slot-meta">{augment.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="muted">{copy.lockedAugments}</div>
                  <div className="trait-grid">
                    {selectedAugments.length > 0 ? (
                      selectedAugments.map((augment) => (
                        <AugmentCard key={augment.key} augment={augment} />
                      ))
                    ) : (
                      <div className="trait-card">
                        <span className="slot-meta">
                          {locale === "zh-CN"
                            ? "本局还没有锁定强化。"
                            : "No augments locked yet this run."}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="panel" data-testid="enemy-panel">
              <div className="eyebrow">{copy.enemyLineup}</div>
              <div className="stat-grid stat-grid-two">
                <div className="stat-card">
                  <span className="stat-label">{copy.threat}</span>
                  <strong>{runtimeSnapshot.world.slice.enemyThreat}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.intent}</span>
                  <strong>{localizedEnemyIntent}</strong>
                </div>
              </div>
              <div className="formation-grid enemy-grid">
                {enemyBoard.map((unit, index) => (
                  <div
                    key={`enemy-${index}`}
                    className={`formation-card enemy-card${unit ? "" : " empty"}`}
                  >
                    {unit ? <UnitPortrait unit={unit} compact /> : null}
                    <span className="slot-title">
                      {unit
                        ? unit.label
                        : locale === "zh-CN"
                          ? `敌方空槽 ${index + 1}`
                          : `Open Enemy Slot ${index + 1}`}
                    </span>
                    <span className="slot-meta">
                      {unit
                        ? `${formatFactionLabel(
                            unit.faction,
                            locale,
                          )} · ${formatRoleLabel(unit.role, locale)}`
                        : locale === "zh-CN"
                          ? "本回合未使用"
                          : "Unused this round"}
                    </span>
                    {unit ? (
                      <>
                        <span className="slot-meta">
                          {renderUnitMeta(unit, locale)}
                        </span>
                        <span className="slot-meta">{unit.skill}</span>
                        <span className="slot-meta">
                          {unit.tempoLabel} {unit.castState}
                        </span>
                        <span className="slot-meta">{unit.targetRule}</span>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel" data-testid="economy-panel">
              <div className="eyebrow">{copy.economy}</div>
              <div className="stat-grid stat-grid-two">
                <div className="stat-card">
                  <span className="stat-label">{copy.nextIncome}</span>
                  <strong>{nextIncomeTotal}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.streak}</span>
                  <strong>
                    {formatStreak(runtimeSnapshot.world.slice.streak, locale)}
                  </strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.baseIncome}</span>
                  <strong>{runtimeSnapshot.world.slice.baseIncome}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.interestIncome}</span>
                  <strong>{runtimeSnapshot.world.slice.interestIncome}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.streakIncome}</span>
                  <strong>{runtimeSnapshot.world.slice.streakIncome}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">{copy.buyXp}</span>
                  <strong>{runtimeSnapshot.world.slice.xpBuyCost}</strong>
                </div>
              </div>
              <div className="muted">{copy.economyHint}</div>
            </section>

            <section className="panel" data-testid="trait-panel">
              <div className="eyebrow">{copy.synergies}</div>
              <div className="trait-grid">
                {activeTraits.map((trait) => (
                  <div
                    key={trait.key}
                    className={`trait-card${trait.active ? " active" : ""}`}
                  >
                    <span className="slot-title">
                      {formatFactionLabel(trait.key, locale)}
                    </span>
                    <span className="slot-meta">
                      {trait.count}/{trait.threshold}
                    </span>
                    <span className="slot-meta">{trait.description}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        ) : null}
      </section>

      <details
        className="dev-drawer"
        data-testid="operations-drawer"
        open={!runtimeReady ? true : undefined}
      >
        <summary>{copy.operationsAndSaves}</summary>
        <div className="drawer-grid">
          <section className="panel">
            <div className="eyebrow">{copy.launcher}</div>
            <label className="label">
              {copy.playerName}
              <input
                type="text"
                value={runtimeSnapshot.bootConfig.playerName}
                onChange={(event) =>
                  setLauncherConfig("playerName", event.target.value)
                }
                maxLength={16}
                data-testid="player-name-input"
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={runtimeSnapshot.bootConfig.touchControls}
                onChange={(event) =>
                  setLauncherConfig("touchControls", event.target.checked)
                }
              />
              {copy.touchHudEnabled}
            </label>
            <button
              className="button"
              onClick={handleLaunch}
              disabled={!clientReady}
              data-testid="launch-runtime"
            >
              {copy.launchRuntime}
            </button>
          </section>

          <section className="panel">
            <div className="eyebrow">{copy.dataMode}</div>
            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-chip${dataMode === "local" ? " active" : ""}`}
                onClick={() => setDataMode("local")}
                data-testid="data-mode-local"
              >
                {copy.local}
              </button>
              <button
                type="button"
                className={`mode-chip${dataMode === "remote" ? " active" : ""}`}
                onClick={() => setDataMode("remote")}
                data-testid="data-mode-remote"
              >
                {copy.remote}
              </button>
            </div>
            <label className="label">
              {copy.backendUrl}
              <input
                type="text"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                placeholder={DEFAULT_REMOTE_BACKEND_URL}
                data-testid="backend-url-input"
              />
            </label>
            <div className="action-row">
              <button
                className="button secondary"
                onClick={() => void handlePullRemote()}
                data-testid="pull-remote"
              >
                {copy.pullRemote}
              </button>
              <button
                className="button secondary"
                onClick={() => void handlePushRemote()}
                data-testid="push-remote"
              >
                {copy.pushActiveSlot}
              </button>
            </div>
            <div className="muted">
              {dataMode === "local" ? copy.localModeHint : copy.remoteModeHint}
            </div>
            {backendMessage ? (
              <div className="muted">{backendMessage}</div>
            ) : null}
          </section>

          <section className="panel">
            <div className="eyebrow">{copy.saveSlots}</div>
            <div className="slot-grid">
              {saveCollection.slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`slot-card${
                    slot.id === activeSlot.id ? " active" : ""
                  }`}
                  onClick={() => handleSelectSlot(slot.id)}
                  data-testid={`save-slot-${slot.id}`}
                >
                  <span className="slot-title">{slot.label}</span>
                  <span className="slot-meta">
                    {copy.best} {slot.profile.bestScore}
                  </span>
                  <span className="slot-meta">
                    {copy.roundShort} {slot.profile.bestRound}
                  </span>
                </button>
              ))}
            </div>

            <label className="label">
              {copy.activeSlotLabel}
              <input
                type="text"
                value={activeSlot.label}
                onChange={(event) => handleRenameSlot(event.target.value)}
                maxLength={18}
                data-testid="slot-label-input"
              />
            </label>

            <div className="muted">
              {copy.lastRun}: {activeSlot.profile.lastScore} {copy.pointsShort},{" "}
              {copy.roundShort} {activeSlot.profile.lastRound},{" "}
              {activeSlot.profile.lastCaptured} {copy.activeUnits}
            </div>

            <div className="muted">
              {copy.agentLedger}: {activeSlot.agentRoster.length}{" "}
              {copy.trackedAgents} · {activeSlot.battleRecords.length}{" "}
              {copy.battleAnchors}
            </div>

            <div className="session-list">
              {activeSlot.recentSessions.length > 0 ? (
                activeSlot.recentSessions.map((session) => (
                  <div className="session-row" key={session.id}>
                    <span>{session.id}</span>
                    <span>
                      {session.score} {copy.pointsShort}
                    </span>
                    <span>
                      {copy.roundShort}
                      {session.round}
                    </span>
                  </div>
                ))
              ) : (
                <div className="muted">{copy.noArchivedSessions}</div>
              )}
            </div>
          </section>

          <WorldCorePanel locale={locale} slot={activeSlot} />

          <section className="panel" data-testid="session-panel">
            <div className="eyebrow">{copy.activeRun}</div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">{copy.status}</span>
                <strong>
                  {formatSessionStatus(
                    currentSession?.status ?? "staging",
                    locale,
                  )}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.roundShort}</span>
                <strong>
                  {currentSession?.round ?? runtimeSnapshot.world.slice.round}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.result}</span>
                <strong>
                  {formatRunResult(
                    runtimeSnapshot.world.slice.runResult,
                    locale,
                  )}
                </strong>
              </div>
            </div>
            <div className="muted">
              {copy.sessionId}: {currentSession?.id ?? copy.bootAwaitingRuntime}
            </div>
            <div className="muted">
              {copy.window}:{" "}
              {formatTimestamp(currentSession?.startedAt, locale)} to{" "}
              {formatTimestamp(currentSession?.endedAt, locale)}
            </div>
            <div className="muted">
              {copy.hp}: {runtimeSnapshot.world.slice.playerHealth} commander ·{" "}
              {runtimeSnapshot.world.slice.enemyHealth} enemy
            </div>
          </section>

          <section className="panel" data-testid="progression-panel">
            <div className="eyebrow">{copy.runMeta}</div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">{copy.level}</span>
                <strong>{activeSlot.progression.level}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.xp}</span>
                <strong>{activeSlot.progression.xp}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.battles}</span>
                <strong>{activeSlot.progression.totalSweeps}</strong>
              </div>
            </div>
            <div className="muted">
              {copy.runsLaunched}: {activeSlot.progression.totalRuns}
            </div>
            <div className="muted">
              {copy.bestBoardScore}: {activeSlot.profile.bestScore}
            </div>
            <div className="badge-row">
              {activeSlot.progression.unlockedBadges.length > 0 ? (
                activeSlot.progression.unlockedBadges.map((badge) => (
                  <span className="badge-pill" key={badge}>
                    {formatBadgeLabel(badge, locale)}
                  </span>
                ))
              ) : (
                <span className="muted">{copy.noMilestones}</span>
              )}
            </div>
          </section>

          <section className="panel" data-testid="status-panel">
            <div className="eyebrow">{copy.status}</div>
            <div>{renderBootRecord(runtimeSnapshot.boot.current, locale)}</div>
            <div className="muted">{copy.statusSummary}</div>
            <div className="muted">
              {copy.runtimeActive}:{" "}
              {runtimeSnapshot.runtimeActive ? copy.ready : copy.booting}
            </div>
            <div className="muted">
              {copy.commander}:{" "}
              {runtimeSnapshot.world.player?.name ??
                runtimeSnapshot.bootConfig.playerName}
            </div>
            <div className="muted">
              {copy.boardSeed}: {runtimeSnapshot.world.slice.captured}/
              {runtimeSnapshot.world.slice.total || "?"} {copy.activeUnits}
            </div>
            <div className="muted">
              {copy.boardObjective}: {localizedObjective}
            </div>
            <div className="muted">
              {copy.roundState}: {localizedRoundState}
            </div>
            <div className="muted">
              {copy.runLabel} {runtimeSnapshot.world.slice.runNumber}:{" "}
              {formatRunResult(runtimeSnapshot.world.slice.runResult, locale)}
            </div>
          </section>

          <section className="panel" data-testid="roster-panel">
            <div className="eyebrow">{copy.roster}</div>
            <div className="offer-grid">
              {unitRoster.map((unit) => (
                <div key={unit.archetype} className="offer-card">
                  <UnitPortrait unit={unit} />
                  <span className="slot-title">{unit.label}</span>
                  <span className="slot-meta">
                    {formatFactionLabel(unit.faction, locale)} ·{" "}
                    {formatRoleLabel(unit.role, locale)}
                  </span>
                  <span className="slot-meta">
                    {renderUnitMeta(unit, locale)}
                  </span>
                  <span className="slot-meta">{unit.skill}</span>
                </div>
              ))}
            </div>
            <div className="muted">{copy.rosterHint}</div>
          </section>

          <section className="panel">
            <div className="eyebrow">{copy.runSnapshot}</div>
            <div className="action-row">
              <button
                className="button secondary"
                onClick={() => void handleCopySaveMatrix()}
                data-testid="copy-snapshot"
              >
                {copy.copySnapshot}
              </button>
              <button
                className="button secondary"
                onClick={handleImportSaveMatrix}
                data-testid="load-snapshot"
              >
                {copy.loadSnapshot}
              </button>
              <button
                className="button secondary"
                onClick={handleResetActiveSlot}
                data-testid="reset-active-slot"
              >
                {copy.resetActiveSlot}
              </button>
              <button
                className="button secondary"
                onClick={handleResetAllSaves}
                data-testid="reset-all-saves"
              >
                {copy.resetAllSaves}
              </button>
            </div>
            <label className="label">
              {copy.snapshotJson}
              <textarea
                className="profile-textarea"
                value={saveDraft}
                onChange={(event) => setSaveDraft(event.target.value)}
                placeholder={copy.snapshotPlaceholder}
                rows={8}
                data-testid="save-draft"
              />
            </label>
            {saveMessage ? <div className="muted">{saveMessage}</div> : null}
          </section>

          <section className="panel">
            <div className="eyebrow">{copy.bootHistory}</div>
            <ol className="history">
              {[...runtimeSnapshot.boot.history].reverse().map((record) => (
                <li key={record.id}>{renderBootRecord(record, locale)}</li>
              ))}
            </ol>
          </section>
        </div>
      </details>
    </main>
  );
}

function readStoredBootConfig(
  collection: RuntimeSaveCollection,
): Partial<RuntimeBootConfig> | undefined {
  try {
    const raw = window.localStorage.getItem(LAUNCHER_STORAGE_KEY);

    if (!raw) {
      return profileToBootConfig(getActiveSlot(collection));
    }

    return sanitizeRuntimeBootConfig(JSON.parse(raw));
  } catch {
    return profileToBootConfig(getActiveSlot(collection));
  }
}

function controlKeyFromKeyboard(key: string): ControlKey | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    default:
      return null;
  }
}

function renderBootRecord(record: RuntimeBootRecord, locale: UiLocale) {
  return `${record.phase} · ${localizeBootMessage(record.message, locale)}`;
}

function formatStreak(streak: number, locale: UiLocale) {
  if (streak > 0) {
    return locale === "zh-CN" ? `连胜 ${streak}` : `W ${streak}`;
  }

  if (streak < 0) {
    return locale === "zh-CN"
      ? `连败 ${Math.abs(streak)}`
      : `L ${Math.abs(streak)}`;
  }

  return locale === "zh-CN" ? "无" : "None";
}

function getCombatDirectiveCopy(
  directive: RuntimeCombatDirectiveKey,
  locale: UiLocale,
) {
  switch (directive) {
    case "focus-backline":
      return {
        label: locale === "zh-CN" ? "集火后排" : "Focus Backline",
        description:
          locale === "zh-CN"
            ? "我方单位会优先把火力压向敌方后排。"
            : "Player units bias their focus toward the enemy backline.",
      };
    case "hold-skills":
      return {
        label: locale === "zh-CN" ? "保留技能" : "Hold Skills",
        description:
          locale === "zh-CN"
            ? "压住按节奏触发的技能，换取更干净的基础输出节奏。"
            : "Suppress cadence-based skill triggers until you clear the order.",
      };
    case "fallback-left":
      return {
        label: locale === "zh-CN" ? "左翼后撤" : "Fallback Left",
        description:
          locale === "zh-CN"
            ? "降低敌方对左翼上半区的优先级，让这一路先后撤。"
            : "Enemy units deprioritize your left wing so it can fall back safely.",
      };
  }
}

function getCombatDirectivePreset(
  directive: RuntimeCombatDirectiveKey,
): RuntimeCombatDirectiveInput[] {
  switch (directive) {
    case "focus-backline":
      return [{ key: directive, durationTicks: 3 }];
    case "hold-skills":
      return [{ key: directive, durationTicks: 2 }];
    case "fallback-left":
      return [{ key: directive, lane: "left", durationTicks: 3 }];
  }
}

function formatCombatLaneLabel(
  lane: RuntimeCombatLane | null | undefined,
  locale: UiLocale,
) {
  if (!lane) {
    return null;
  }

  switch (lane) {
    case "left":
      return locale === "zh-CN" ? "左路" : "Left";
    case "center":
      return locale === "zh-CN" ? "中路" : "Center";
    case "right":
      return locale === "zh-CN" ? "右路" : "Right";
  }
}

function normalizeDirectiveDuration(step: RuntimeCombatDirectiveInput) {
  const explicitDuration =
    typeof step.durationTicks === "number"
      ? Math.floor(step.durationTicks)
      : NaN;
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return Math.max(1, Math.min(6, explicitDuration));
  }

  return step.key === "hold-skills" ? 2 : 3;
}

function formatCombatPlanStep(
  step: RuntimeCombatDirectiveInput,
  locale: UiLocale,
) {
  const base = getCombatDirectiveCopy(step.key, locale).label;
  const lane = formatCombatLaneLabel(
    step.key === "fallback-left" && !step.lane ? "left" : step.lane,
    locale,
  );
  return lane ? `${lane} · ${base}` : base;
}

function formatDirectiveViewLabel(
  directive: RuntimeCombatDirectiveView,
  locale: UiLocale,
) {
  const lane = formatCombatLaneLabel(directive.lane, locale);
  return lane && !directive.label.includes(lane)
    ? `${lane} · ${directive.label}`
    : directive.label;
}

function formatCombatPlanLabel(
  steps: RuntimeCombatDirectiveInput[],
  locale: UiLocale,
) {
  return steps
    .map((step, index) => {
      const duration = normalizeDirectiveDuration(step);
      const suffix =
        locale === "zh-CN"
          ? ` ${duration} tick`
          : ` for ${duration} tick${duration === 1 ? "" : "s"}`;
      return `${index + 1}. ${formatCombatPlanStep(step, locale)}${suffix}`;
    })
    .join(locale === "zh-CN" ? " → " : " -> ");
}

function splitCommanderSegments(rawInput: string) {
  return rawInput
    .toLowerCase()
    .replace(/[；;。]/g, ",")
    .replace(/\b(and then|then|after that|next)\b/g, ",")
    .replace(/然后|再|接着|之后|接下来/g, ",")
    .split(/[,\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseCommanderLane(segment: string): RuntimeCombatLane | null {
  if (
    /右路|右翼|右侧|right lane|right flank|right wing|on right|right/.test(
      segment,
    )
  ) {
    return "right";
  }

  if (/中路|中线|center lane|mid lane|middle|center/.test(segment)) {
    return "center";
  }

  if (
    /左路|左翼|左侧|left lane|left flank|left wing|on left|left/.test(segment)
  ) {
    return "left";
  }

  return null;
}

function parseCommanderDuration(segment: string) {
  const arabic = segment.match(
    /(\d+)\s*(?:tick|ticks|秒|拍|turn|turns|s\b|sec)/,
  );
  if (arabic) {
    return Math.max(1, Math.min(6, Number(arabic[1])));
  }

  const zhMap: Array<[RegExp, number]> = [
    [/六|6/g, 6],
    [/五|5/g, 5],
    [/四|4/g, 4],
    [/三|3/g, 3],
    [/两|二|2/g, 2],
    [/一|1/g, 1],
  ];
  for (const [pattern, value] of zhMap) {
    if (pattern.test(segment) && /(tick|秒|拍|回合)/.test(segment)) {
      return value;
    }
  }

  return undefined;
}

function parseCommanderDirectiveSegment(
  segment: string,
): RuntimeCombatDirectiveInput | null {
  const lane = parseCommanderLane(segment);
  const durationTicks = parseCommanderDuration(segment);

  if (
    /集火后排|切后排|后排|backline|rear line|focus the backline|focus backline|snipe/.test(
      segment,
    )
  ) {
    return {
      key: "focus-backline",
      ...(lane ? { lane } : {}),
      ...(durationTicks ? { durationTicks } : {}),
    };
  }

  if (
    /保留技能|憋技能|先别放技能|hold skills|hold skill|save skills|save cooldown/.test(
      segment,
    )
  ) {
    return {
      key: "hold-skills",
      ...(lane ? { lane } : {}),
      ...(durationTicks ? { durationTicks } : {}),
    };
  }

  if (
    /后撤|撤退|fallback|retreat|fall back/.test(segment) &&
    (lane === "left" || /左/.test(segment) || /left/.test(segment))
  ) {
    return {
      key: "fallback-left",
      lane: lane ?? "left",
      ...(durationTicks ? { durationTicks } : {}),
    };
  }

  return null;
}

function parseCommanderDirective(
  rawInput: string,
  locale: UiLocale,
): CommanderParseResult {
  const normalized = rawInput.trim().toLowerCase();
  if (!normalized) {
    return { kind: "unknown" };
  }

  const clearKeywords = [
    "clear",
    "cancel",
    "reset",
    "default",
    "clear directive",
    "clear plan",
    "清除",
    "取消",
    "解除",
    "恢复默认",
    "清除战术",
    "清空计划",
  ];

  if (
    clearKeywords.some((keyword) => normalized.includes(keyword)) &&
    splitCommanderSegments(normalized).length <= 1
  ) {
    return {
      kind: "clear",
      label: locale === "zh-CN" ? "清空战术计划" : "Clear Combat Plan",
    };
  }

  const steps = splitCommanderSegments(rawInput)
    .map(parseCommanderDirectiveSegment)
    .filter((step): step is RuntimeCombatDirectiveInput => step != null)
    .map((step) => ({
      ...step,
      durationTicks: normalizeDirectiveDuration(step),
    }));

  if (steps.length === 0) {
    return { kind: "unknown" };
  }

  return {
    kind: "plan",
    steps,
    label: formatCombatPlanLabel(steps, locale),
  };
}

function readStoredDataMode(): ShellDataMode {
  try {
    const raw = window.localStorage.getItem(DATA_MODE_STORAGE_KEY);
    return raw === "remote" ? "remote" : "local";
  } catch {
    return "local";
  }
}

function readStoredBackendUrl() {
  try {
    return normalizeBackendUrl(
      window.localStorage.getItem(BACKEND_URL_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_REMOTE_BACKEND_URL;
  }
}

function buildSessionId(slotId: SaveSlotId, runNumber: number) {
  return `${slotId}-run-${Math.max(1, runNumber)}`;
}

function collectTrackedPlayerUnits(
  benchUnits: RuntimeUnitView[],
  playerBoard: Array<RuntimeUnitView | null>,
) {
  return [
    ...benchUnits,
    ...playerBoard.filter((unit): unit is RuntimeUnitView => unit != null),
  ];
}

function mergeAgentRoster(
  current: RuntimeAgentRecord[],
  units: RuntimeUnitView[],
  sessionId: string | null,
  now: string,
) {
  if (units.length === 0) {
    return current;
  }

  let changed = false;
  const next = new Map(current.map((agent) => [agent.id, agent]));

  for (const unit of units) {
    const existing = next.get(unit.agentId);
    const candidate: RuntimeAgentRecord = existing
      ? {
          ...existing,
          archetype: unit.archetype,
          faction: unit.faction,
          role: unit.role,
          lastSeenAt: now,
          lastBattleInstanceId: unit.battleInstanceId,
          bestStars: Math.max(existing.bestStars, unit.stars),
          lastSessionId: sessionId,
        }
      : {
          id: unit.agentId,
          archetype: unit.archetype,
          faction: unit.faction,
          role: unit.role,
          firstSeenAt: now,
          lastSeenAt: now,
          lastBattleInstanceId: unit.battleInstanceId,
          bestStars: unit.stars,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          lastSessionId: sessionId,
        };

    if (!existing || !areAgentRecordsEqual(existing, candidate)) {
      next.set(unit.agentId, candidate);
      changed = true;
    }
  }

  if (!changed) {
    return current;
  }

  return [...next.values()].sort((left, right) => {
    return (
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      left.id.localeCompare(right.id)
    );
  });
}

function settleAgentRoster(
  current: RuntimeAgentRecord[],
  playerAgentIds: string[],
  result: RuntimeSnapshot["world"]["slice"]["runResult"],
  sessionId: string,
) {
  if (playerAgentIds.length === 0) {
    return current;
  }

  let changed = false;
  const settled = new Set(playerAgentIds);
  const next = current.map((agent) => {
    if (!settled.has(agent.id)) {
      return agent;
    }

    changed = true;
    return {
      ...agent,
      matchesPlayed: agent.matchesPlayed + 1,
      wins: agent.wins + Number(result === "victory"),
      losses: agent.losses + Number(result === "defeat"),
      lastSessionId: sessionId,
    };
  });

  return changed ? next : current;
}

function buildBattleRecord(
  session: MatchSessionRecord,
  runtimeSnapshot: RuntimeSnapshot,
  playerAgentIds: string[],
): RuntimeBattleRecord {
  return {
    id: `${session.id}-battle`,
    sessionId: session.id,
    slotId: session.slotId,
    runNumber: runtimeSnapshot.world.slice.runNumber,
    round: session.round,
    score: session.score,
    result: runtimeSnapshot.world.slice.runResult,
    status: session.status,
    startedAt: session.startedAt,
    updatedAt: session.updatedAt,
    endedAt: session.endedAt,
    playerAgentIds,
    replayState: runtimeSnapshot.world.slice.serializedRunState,
  };
}

function upsertBattleRecord(
  current: RuntimeBattleRecord[],
  nextRecord: RuntimeBattleRecord,
) {
  const existingIndex = current.findIndex(
    (record) => record.id === nextRecord.id,
  );
  if (existingIndex < 0) {
    return [nextRecord, ...current].slice(0, 32);
  }

  const existing = current[existingIndex];
  if (areBattleRecordsEqual(existing, nextRecord)) {
    return current;
  }

  return current.map((record, index) =>
    index === existingIndex ? nextRecord : record,
  );
}

function areAgentRecordsEqual(
  left: RuntimeAgentRecord,
  right: RuntimeAgentRecord,
) {
  return (
    left.id === right.id &&
    left.archetype === right.archetype &&
    left.faction === right.faction &&
    left.role === right.role &&
    left.firstSeenAt === right.firstSeenAt &&
    left.lastSeenAt === right.lastSeenAt &&
    left.lastBattleInstanceId === right.lastBattleInstanceId &&
    left.bestStars === right.bestStars &&
    left.matchesPlayed === right.matchesPlayed &&
    left.wins === right.wins &&
    left.losses === right.losses &&
    left.lastSessionId === right.lastSessionId
  );
}

function areBattleRecordsEqual(
  left: RuntimeBattleRecord,
  right: RuntimeBattleRecord,
) {
  return (
    left.id === right.id &&
    left.sessionId === right.sessionId &&
    left.slotId === right.slotId &&
    left.runNumber === right.runNumber &&
    left.round === right.round &&
    left.score === right.score &&
    left.result === right.result &&
    left.status === right.status &&
    left.startedAt === right.startedAt &&
    left.updatedAt === right.updatedAt &&
    left.endedAt === right.endedAt &&
    left.replayState === right.replayState &&
    left.playerAgentIds.join("|") === right.playerAgentIds.join("|")
  );
}

function awardLaunchProgression(
  progression: RuntimeProgression,
  updatedAt: string,
): RuntimeProgression {
  let next = grantXp(
    {
      ...progression,
      totalRuns: progression.totalRuns + 1,
      updatedAt,
    },
    25,
  );

  next = unlockBadge(next, "first-launch", 25);
  next.updatedAt = updatedAt;
  return next;
}

function awardSweepProgression(
  progression: RuntimeProgression,
  updatedAt: string,
): RuntimeProgression {
  let next = grantXp(
    {
      ...progression,
      totalSweeps: progression.totalSweeps + 1,
      updatedAt,
    },
    100,
  );

  next = unlockBadge(next, "first-sweep", 40);
  next.updatedAt = updatedAt;
  return next;
}

function awardProgressionMilestones(
  progression: RuntimeProgression,
  bestScore: number,
  bestRound: number,
  updatedAt: string,
): RuntimeProgression {
  let next = sanitizeProgression({
    ...progression,
    updatedAt,
  });

  if (bestScore >= 300) {
    next = unlockBadge(next, "score-300", 60);
  }

  if (bestRound >= 3) {
    next = unlockBadge(next, "loop-3", 80);
  }

  next.updatedAt = updatedAt;
  return next;
}

function grantXp(
  progression: RuntimeProgression,
  xp: number,
): RuntimeProgression {
  return sanitizeProgression({
    ...progression,
    xp: progression.xp + xp,
    updatedAt: progression.updatedAt,
  });
}

function unlockBadge(
  progression: RuntimeProgression,
  badge: ProgressionBadge,
  xpReward: number,
): RuntimeProgression {
  if (progression.unlockedBadges.includes(badge)) {
    return progression;
  }

  return grantXp(
    {
      ...progression,
      unlockedBadges: [...progression.unlockedBadges, badge],
    },
    xpReward,
  );
}

function formatTimestamp(value: string | null | undefined, locale: UiLocale) {
  if (!value) {
    return locale === "zh-CN" ? "进行中" : "in-progress";
  }

  return new Date(value).toLocaleTimeString(
    locale === "zh-CN" ? "zh-CN" : "en-US",
  );
}

function renderUnitMeta(unit: RuntimeUnitView, locale: UiLocale) {
  const sellLabel = locale === "zh-CN" ? "卖价" : "Sell";
  const attackLabel = locale === "zh-CN" ? "攻" : "atk";
  const healthLabel = locale === "zh-CN" ? "血" : "hp";
  return `${formatFactionLabel(unit.faction, locale)} · ${formatRoleLabel(
    unit.role,
    locale,
  )} · ${unit.attack} ${attackLabel} · ${
    unit.health
  } ${healthLabel} · ${sellLabel} ${unit.sellValue}`;
}

function formatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function buildOnboardingModel({
  locale,
  ready,
  benchCount,
  deployedUnits,
  canStartCombat,
  canAdvanceRound,
  canRestartRun,
  currentPhase,
}: {
  locale: UiLocale;
  ready: boolean;
  benchCount: number;
  deployedUnits: number;
  canStartCombat: boolean;
  canAdvanceRound: boolean;
  canRestartRun: boolean;
  currentPhase: string;
}) {
  const hasDrafted = benchCount > 0 || deployedUnits > 0;
  const hasDeployed = deployedUnits > 0;
  const hasEnteredCombat =
    currentPhase !== "preparation" || canAdvanceRound || canRestartRun;

  const steps = [
    {
      key: "boot",
      index: locale === "zh-CN" ? "01" : "01",
      label: locale === "zh-CN" ? "启动战场" : "Boot the arena",
      detail:
        locale === "zh-CN"
          ? "先启动 Runtime，商店、棋盘和战斗循环才会激活。"
          : "Launch the runtime first so the shop, board, and combat loop come online.",
      status: !ready ? "active" : "done",
    },
    {
      key: "draft",
      index: locale === "zh-CN" ? "02" : "02",
      label: locale === "zh-CN" ? "招募棋子" : "Draft a unit",
      detail:
        locale === "zh-CN"
          ? "从招募商店买一张棋子，它会先进入备战席。"
          : "Buy a unit from the shop. It lands on your bench first.",
      status: !ready ? "upcoming" : hasDrafted ? "done" : "active",
    },
    {
      key: "deploy",
      index: locale === "zh-CN" ? "03" : "03",
      label: locale === "zh-CN" ? "部署阵容" : "Deploy the lineup",
      detail:
        locale === "zh-CN"
          ? "先点备战席里的棋子，再点部署区空槽把它上场。"
          : "Tap a bench unit, then tap an empty board slot to deploy it.",
      status:
        !ready || !hasDrafted ? "upcoming" : hasDeployed ? "done" : "active",
    },
    {
      key: "combat",
      index: locale === "zh-CN" ? "04" : "04",
      label: locale === "zh-CN" ? "开始战斗" : "Start combat",
      detail:
        locale === "zh-CN"
          ? "阵容就绪后开战，回合结算后进入下一回合继续扩编。"
          : "Once the lineup is ready, start combat and continue after the round resolves.",
      status:
        !ready || !hasDeployed
          ? "upcoming"
          : hasEnteredCombat
            ? "done"
            : "active",
    },
  ] as const;

  if (!ready) {
    return {
      steps,
      headline:
        locale === "zh-CN" ? "先启动 Runtime" : "Start the runtime first",
      detail:
        locale === "zh-CN"
          ? "这是整局的开关。启动后你才会看到真正的棋盘状态和可操作的战斗流程。"
          : "This turns the whole run on. After boot, the board and combat flow become interactive.",
    };
  }

  if (!hasDrafted) {
    return {
      steps,
      headline:
        locale === "zh-CN"
          ? "先去招募商店买第一张牌"
          : "Buy your first unit from the shop",
      detail:
        locale === "zh-CN"
          ? "商店购买后单位会先到备战席。别直接找棋盘空槽，先买再布。"
          : "Purchased units go to the bench first. Draft before you try to place them.",
    };
  }

  if (!hasDeployed) {
    return {
      steps,
      headline:
        locale === "zh-CN"
          ? "把备战席棋子拖进部署区思路改成点击布阵"
          : "Select from bench, then place on board",
      detail:
        locale === "zh-CN"
          ? "当前版本不是拖拽。先点备战席中的单位，再点部署区空槽位。"
          : "This build uses tap-to-deploy, not drag-and-drop. Select a bench unit, then tap an empty board slot.",
    };
  }

  if (canStartCombat) {
    return {
      steps,
      headline:
        locale === "zh-CN"
          ? "阵容已经齐，可以开战"
          : "Your lineup is ready for combat",
      detail:
        locale === "zh-CN"
          ? "开始战斗后观察敌方阵容、经济结果和回合结算，再进下一回合。"
          : "Start combat, read the enemy setup and economy outcome, then move into the next round.",
    };
  }

  if (canAdvanceRound) {
    return {
      steps,
      headline:
        locale === "zh-CN" ? "这回合已经结算" : "The round has resolved",
      detail:
        locale === "zh-CN"
          ? "点下一回合继续运营，然后重复招募、部署、开战。"
          : "Advance to the next round and repeat the loop: draft, deploy, fight.",
    };
  }

  return {
    steps,
    headline:
      locale === "zh-CN"
        ? "战斗正在进行或本局已结束"
        : "Combat is active or the run is over",
    detail:
      locale === "zh-CN"
        ? "观察战斗结果；如果本局结束，就直接重新开一局继续试。"
        : "Watch the result flow. If the run is over, restart and iterate.",
  };
}

function UnitPortrait({
  unit,
  compact = false,
}: {
  unit: RuntimeUnitView;
  compact?: boolean;
}) {
  return (
    <div className={`unit-art-frame${compact ? " compact" : ""}`}>
      <img
        className="unit-art"
        src={UNIT_ART_BY_ARCHETYPE[unit.archetype]}
        alt={unit.label}
        loading="lazy"
      />
    </div>
  );
}

function AugmentCard({ augment }: { augment: RuntimeAugmentView }) {
  return (
    <div className="trait-card active">
      <span className="slot-title">{augment.label}</span>
      <span className="slot-meta">{augment.description}</span>
    </div>
  );
}
