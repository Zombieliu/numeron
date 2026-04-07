"use client";

import { useEffect, useRef, useState } from "react";
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
  RuntimeBootConfig,
  RuntimeBootRecord,
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

type ControlKey = "up" | "down" | "left" | "right";

type ControlState = Record<ControlKey, boolean>;

const DEFAULT_CONTROL_STATE: ControlState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

export function GameShell() {
  const [clientReady, setClientReady] = useState(false);
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<RuntimeSnapshot>(getRuntimeSnapshot);
  const [controls, setControls] = useState<ControlState>(DEFAULT_CONTROL_STATE);
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [selectedBoardIndex, setSelectedBoardIndex] = useState<number | null>(null);
  const [saveCollection, setSaveCollection] =
    useState<RuntimeSaveCollection>(defaultSaveCollection);
  const [saveDraft, setSaveDraft] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<ShellDataMode>("local");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_REMOTE_BACKEND_URL);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<MatchSessionRecord | null>(
    null,
  );
  const lastSceneReadyEventId = useRef<number | null>(null);
  const lastArchivedSessionId = useRef<string | null>(null);
  const remoteKnownSessionIds = useRef<Set<string>>(new Set());
  const remoteProfileSignature = useRef<string | null>(null);
  const remoteHydrated = useRef(false);
  const locale = runtimeSnapshot.bootConfig.locale as UiLocale;
  const copy = getUiCopy(locale);

  const activeSlot = getActiveSlot(saveCollection);
  const currentPhase = runtimeSnapshot.world.slice.phase;
  const canDraft = runtimeSnapshot.world.ready && currentPhase === "preparation";
  const canStartCombat =
    runtimeSnapshot.world.ready &&
    currentPhase === "preparation" &&
    runtimeSnapshot.world.slice.captured > 0;
  const canAdvanceRound =
    runtimeSnapshot.world.ready &&
    runtimeSnapshot.world.slice.roundResolved &&
    !runtimeSnapshot.world.slice.runOver;
  const canRestartRun =
    runtimeSnapshot.world.ready && runtimeSnapshot.world.slice.runOver;
  const benchUnits = runtimeSnapshot.world.slice.benchUnits;
  const playerBoard = runtimeSnapshot.world.slice.playerBoard;
  const enemyBoard = runtimeSnapshot.world.slice.enemyBoard;
  const activeTraits = runtimeSnapshot.world.slice.activeTraits;
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
  const canRerollShop =
    canDraft &&
    runtimeSnapshot.world.slice.gold >= runtimeSnapshot.world.slice.rerollCost;
  const canWithdrawUnit =
    canDraft && benchUnits.length < runtimeSnapshot.world.slice.benchCapacity;
  const localizedRoundState = runtimeSnapshot.world.slice.status;
  const localizedObjective = runtimeSnapshot.world.slice.objective;
  const localizedEnemyIntent = runtimeSnapshot.world.slice.enemyIntent;

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
        bestScore: Math.max(slot.profile.bestScore, runtimeSnapshot.world.slice.score),
        bestRound: Math.max(slot.profile.bestRound, runtimeSnapshot.world.slice.round),
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
      const nextStatus =
        runtimeSnapshot.world.slice.runOver
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
      activeSlot.profile.preferredPlayerName,
      activeSlot.profile.preferredTouchControls ? "1" : "0",
      activeSlot.profile.preferredLocale,
      activeSlot.profile.bestScore,
      activeSlot.profile.bestRound,
    ].join(":");

    if (remoteProfileSignature.current === signature) {
      return;
    }

    remoteProfileSignature.current = signature;

    void pushBackendProfile(normalizeBackendUrl(backendUrl), activeSlot)
      .then(() => {
        setBackendMessage(copy.remoteProfileSynced(activeSlot.label));
      })
      .catch((error: unknown) => {
        setBackendMessage(formatErrorMessage(error, copy.remoteProfileSyncFailed));
      });
  }, [
    activeSlot.id,
    activeSlot.label,
    activeSlot.profile.bestRound,
    activeSlot.profile.bestScore,
    activeSlot.profile.preferredLocale,
    activeSlot.profile.preferredPlayerName,
    activeSlot.profile.preferredTouchControls,
    backendUrl,
    clientReady,
    copy,
    dataMode,
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
        setBackendMessage(formatErrorMessage(error, copy.remoteSessionSyncFailed));
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
      return replaceSlot(current, sanitizeSaveSlot(updater(slot), slotId, slot.label));
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

  async function handlePullRemote() {
    try {
      const snapshot = await fetchBackendSnapshot(normalizeBackendUrl(backendUrl));
      remoteKnownSessionIds.current = new Set(snapshot.sessions.map((session) => session.id));
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
      await pushBackendProfile(normalizeBackendUrl(backendUrl), activeSlot);
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
      saveCollection.slots.find((slot) => slot.id === slotId) ?? defaultSaveSlot(slotId);

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

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-main">
          <div className="eyebrow">{copy.brand}</div>
          <h1 className="title">{copy.title}</h1>
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
            <div className="status-pill">
              <span className="stat-label">{copy.runLabel}</span>
              <strong>{runtimeSnapshot.world.slice.runNumber}</strong>
            </div>
            <div className="status-pill">
              <span className="stat-label">{copy.result}</span>
              <strong>{formatRunResult(runtimeSnapshot.world.slice.runResult, locale)}</strong>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="eyebrow">{copy.language}</div>
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

      <section className="game-layout">
        <aside className="side-column">
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
            {backendMessage ? <div className="muted">{backendMessage}</div> : null}
          </section>

          <section className="panel">
            <div className="eyebrow">{copy.launcher}</div>
            <label className="label">
              {copy.playerName}
              <input
                type="text"
                value={runtimeSnapshot.bootConfig.playerName}
                onChange={(event) => setLauncherConfig("playerName", event.target.value)}
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

          <section className="panel" data-testid="battle-controls-panel">
            <div className="eyebrow">{copy.battleControls}</div>
            <div className="stat-grid">
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
              <div className="stat-card">
                <span className="stat-label">{copy.bench}</span>
                <strong>
                  {benchUnits.length}/{runtimeSnapshot.world.slice.benchCapacity}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.shop}</span>
                <strong>
                  {runtimeSnapshot.world.slice.shopLocked
                    ? copy.lockShop
                    : locale === "zh-CN"
                      ? "开放"
                      : "Open"}
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
            <div className="muted">
              {runtimeSnapshot.world.slice.runOver
                ? copy.runClosedHint
                : runtimeSnapshot.world.slice.roundResolved
                  ? copy.roundResolvedHint
                  : copy.prepHint}
            </div>
          </section>

          <section className="panel" data-testid="draft-shop">
            <div className="eyebrow">{copy.draftShop}</div>
            <div className="offer-grid">
              {runtimeSnapshot.world.slice.shopOffers.map((offer, index) => (
                <button
                  key={`${offer.archetype}-${offer.stars}-${index}`}
                  type="button"
                  className="offer-card"
                  onClick={() => handleBuyOffer(index)}
                  disabled={!canBuyUnit}
                  data-testid={`shop-offer-${index}`}
                >
                  <span className="slot-title">{offer.label}</span>
                  <span className="slot-meta">
                    {formatFactionLabel(offer.faction, locale)} ·{" "}
                    {formatRoleLabel(offer.role, locale)}
                  </span>
                  <span className="slot-meta">
                    {renderUnitMeta(offer, locale)} · {copy.buy} {BUY_COST_LABEL}
                  </span>
                </button>
              ))}
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
                {runtimeSnapshot.world.slice.shopLocked ? copy.unlockShop : copy.lockShop}
              </button>
            </div>
            <div className="muted">{copy.draftHint}</div>
            <div className="muted">
              {runtimeSnapshot.world.slice.shopLocked
                ? copy.lockedShopHint
                : copy.openShopHint}
            </div>
          </section>

          <section className="panel" data-testid="bench-panel">
            <div className="eyebrow">{copy.benchPanel}</div>
            <div className="formation-grid">
              {Array.from({ length: runtimeSnapshot.world.slice.benchCapacity }).map(
                (_, index) => {
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
                              ? "已选中，准备部署"
                              : "Selected for deployment"
                            : locale === "zh-CN"
                              ? "点击选中"
                              : "Click to select"
                          : locale === "zh-CN"
                            ? "从商店购买"
                            : "Buy from the shop"}
                      </span>
                      {unit ? (
                        <>
                          <span className="slot-meta">{renderUnitMeta(unit, locale)}</span>
                          <span className="slot-meta">{unit.skill}</span>
                          <span className="slot-meta">
                            {unit.tempoLabel} {unit.castState}
                          </span>
                          <span className="slot-meta">{unit.targetRule}</span>
                        </>
                      ) : null}
                    </button>
                  );
                },
              )}
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
              {hasBenchSelection ? copy.benchSelectedHint : copy.benchIdleHint}
            </div>
          </section>

          <section className="panel" data-testid="deployment-panel">
            <div className="eyebrow">{copy.deployment}</div>
            <div className="formation-grid">
              {playerBoard.map((unit, index) => {
                const isEmpty = unit == null;
                const canDeployIntoSlot = canDraft && isEmpty && hasBenchSelection;
                const isSelected = selectedBoardIndex === index;
                const canSelectSlot = canDraft && !isEmpty;

                return (
                  <button
                    key={`board-${index}`}
                    type="button"
                    className={`formation-card${isEmpty ? " empty" : ""}${
                      isSelected ? " selected" : ""
                    }`}
                    onClick={() =>
                      isEmpty ? handleDeployBenchUnit(index) : handleSelectBoardUnit(index)
                    }
                    disabled={!canDeployIntoSlot && !canSelectSlot}
                    data-testid={`board-slot-${index}`}
                  >
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
                            ? "已选中，可执行棋盘操作"
                            : "Selected for board actions"
                          : locale === "zh-CN"
                            ? "点击选中"
                            : "Click to select"
                        : hasBenchSelection
                          ? locale === "zh-CN"
                            ? "点击部署选中单位"
                            : "Click to deploy selected unit"
                          : locale === "zh-CN"
                            ? "先选择一个备战单位"
                            : "Select a bench unit first"}
                    </span>
                    {unit ? (
                      <>
                        <span className="slot-meta">{renderUnitMeta(unit, locale)}</span>
                        <span className="slot-meta">{unit.skill}</span>
                        <span className="slot-meta">
                          {unit.tempoLabel} {unit.castState}
                        </span>
                        <span className="slot-meta">{unit.targetRule}</span>
                      </>
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
              {copy.activeBoard}: {playerBoard.filter(Boolean).length}/
              {runtimeSnapshot.world.slice.boardCapacity}
            </div>
          </section>
        </aside>

        <section className="stage-column">
          <section className="canvas-area">
            <div className="canvas-frame">
              <canvas id="bevy-runtime-canvas" />
              <div className="hud">
                <div className="hud-card">
                  <div className="eyebrow">{copy.projection}</div>
                  <div>{runtimeSnapshot.world.ready ? copy.ready : copy.booting}</div>
                </div>

                <div className="hud-card objective-card">
                  <div className="eyebrow">{copy.boardSlice}</div>
                  <div className="objective-title">
                    {runtimeSnapshot.world.slice.captured}/
                    {runtimeSnapshot.world.slice.total || "?"} {copy.activeUnits}
                  </div>
                  <div className="muted">{localizedRoundState}</div>
                </div>

                <div className="hud-card objective-card">
                  <div className="eyebrow">{copy.activeSlot}</div>
                  <div className="objective-title">{activeSlot.label}</div>
                  <div className="muted">
                    {copy.level} {activeSlot.progression.level} · {activeSlot.progression.xp}{" "}
                    {copy.xp}
                  </div>
                </div>

                {runtimeSnapshot.bootConfig.touchControls ? (
                  <div className="touch-card">
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
                          !canBuyUnit || runtimeSnapshot.world.slice.shopOffers.length === 0
                        }
                      >
                        {copy.buy}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </section>

        <aside className="side-column">
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
                  <span className="slot-title">
                    {unit
                      ? unit.label
                      : locale === "zh-CN"
                        ? `敌方空槽 ${index + 1}`
                        : `Open Enemy Slot ${index + 1}`}
                  </span>
                  <span className="slot-meta">
                    {unit
                      ? `${formatFactionLabel(unit.faction, locale)} · ${formatRoleLabel(
                          unit.role,
                          locale,
                        )}`
                      : locale === "zh-CN"
                        ? "本回合未使用"
                        : "Unused this round"}
                  </span>
                  {unit ? (
                    <>
                      <span className="slot-meta">{renderUnitMeta(unit, locale)}</span>
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
                  <span className="slot-meta">
                    {trait.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" data-testid="status-panel">
            <div className="eyebrow">{copy.status}</div>
            <div>{renderBootRecord(runtimeSnapshot.boot.current, locale)}</div>
            <div className="muted">{copy.statusSummary}</div>
            <div className="muted">
              {copy.runtimeActive}: {runtimeSnapshot.runtimeActive ? copy.ready : copy.booting}
            </div>
            <div className="muted">
              {copy.commander}:{" "}
              {runtimeSnapshot.world.player?.name ?? runtimeSnapshot.bootConfig.playerName}
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

          <section className="panel" data-testid="session-panel">
            <div className="eyebrow">{copy.activeRun}</div>
            <div className="stat-grid">
              <div className="stat-card">
                <span className="stat-label">{copy.status}</span>
                <strong>
                  {formatSessionStatus(currentSession?.status ?? "staging", locale)}
                </strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.roundShort}</span>
                <strong>{currentSession?.round ?? runtimeSnapshot.world.slice.round}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">{copy.result}</span>
                <strong>{formatRunResult(runtimeSnapshot.world.slice.runResult, locale)}</strong>
              </div>
            </div>
            <div className="muted">
              {copy.sessionId}: {currentSession?.id ?? copy.bootAwaitingRuntime}
            </div>
            <div className="muted">
              {copy.window}: {formatTimestamp(currentSession?.startedAt, locale)} to{" "}
              {formatTimestamp(currentSession?.endedAt, locale)}
            </div>
            <div className="muted">
              {copy.hp}: {runtimeSnapshot.world.slice.playerHealth} commander ·{" "}
              {runtimeSnapshot.world.slice.enemyHealth} enemy
            </div>
            <div className="muted">
              {runtimeSnapshot.world.slice.runOver
                ? copy.sessionClosedHint
                : runtimeSnapshot.world.slice.roundResolved
                  ? copy.sessionRoundResolvedHint
                  : copy.sessionProgressingHint}
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
        </aside>
      </section>

      <details className="dev-drawer" data-testid="operations-drawer">
        <summary>{copy.operationsAndSaves}</summary>
        <div className="drawer-grid">
          <section className="panel">
            <div className="eyebrow">{copy.saveSlots}</div>
            <div className="slot-grid">
              {saveCollection.slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`slot-card${slot.id === activeSlot.id ? " active" : ""}`}
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
              {copy.roundShort} {activeSlot.profile.lastRound}, {activeSlot.profile.lastCaptured}{" "}
              {copy.activeUnits}
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
    return normalizeBackendUrl(window.localStorage.getItem(BACKEND_URL_STORAGE_KEY));
  } catch {
    return DEFAULT_REMOTE_BACKEND_URL;
  }
}

function buildSessionId(slotId: SaveSlotId, runNumber: number) {
  return `${slotId}-run-${Math.max(1, runNumber)}`;
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

function grantXp(progression: RuntimeProgression, xp: number): RuntimeProgression {
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

  return new Date(value).toLocaleTimeString(locale === "zh-CN" ? "zh-CN" : "en-US");
}

function renderUnitMeta(unit: RuntimeUnitView, locale: UiLocale) {
  const sellLabel = locale === "zh-CN" ? "卖价" : "Sell";
  const attackLabel = locale === "zh-CN" ? "攻" : "atk";
  const healthLabel = locale === "zh-CN" ? "血" : "hp";
  return `${formatFactionLabel(unit.faction, locale)} · ${formatRoleLabel(
    unit.role,
    locale,
  )} · ${unit.attack} ${attackLabel} · ${unit.health} ${healthLabel} · ${sellLabel} ${unit.sellValue}`;
}

function formatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}
