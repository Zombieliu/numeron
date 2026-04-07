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
  RuntimeTraitView,
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

  const activeSlot = getActiveSlot(saveCollection);
  const currentPhase = runtimeSnapshot.world.slice.phase;
  const canDraft = runtimeSnapshot.world.ready && currentPhase === "preparation";
  const canStartCombat =
    runtimeSnapshot.world.ready &&
    currentPhase === "preparation" &&
    runtimeSnapshot.world.slice.captured > 0;
  const canAdvanceRound =
    runtimeSnapshot.world.ready && currentPhase === "resolution";
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
      activeSlot.profile.runsLaunched,
      runtimeSnapshot.world.slice.round,
    );

    setCurrentSession((current) => {
      const now = new Date().toISOString();
      const nextStatus =
        runtimeSnapshot.world.slice.completed
          ? "completed"
          : runtimeSnapshot.world.slice.phase === "preparation"
            ? "staging"
            : "live";

      if (!current || current.id !== nextSessionId) {
        return {
          id: nextSessionId,
          template: "numeron-run",
          slotId: activeSlot.id,
          playerName:
            runtimeSnapshot.world.player?.name ??
            runtimeSnapshot.bootConfig.playerName,
          status: nextStatus,
          round: runtimeSnapshot.world.slice.round,
          objective: runtimeSnapshot.world.slice.objective,
          score: runtimeSnapshot.world.slice.score,
          captured: runtimeSnapshot.world.slice.captured,
          total: runtimeSnapshot.world.slice.total,
          startedAt: now,
          updatedAt: now,
          endedAt: runtimeSnapshot.world.slice.completed ? now : null,
        };
      }

      return {
        ...current,
        playerName:
          runtimeSnapshot.world.player?.name ??
          runtimeSnapshot.bootConfig.playerName,
        status: nextStatus,
        objective: runtimeSnapshot.world.slice.objective,
        score: runtimeSnapshot.world.slice.score,
        captured: runtimeSnapshot.world.slice.captured,
        total: runtimeSnapshot.world.slice.total,
        updatedAt: now,
        endedAt:
          runtimeSnapshot.world.slice.completed && !current.endedAt
            ? now
            : current.endedAt,
      };
    });
  }, [
    activeSlot.id,
    activeSlot.profile.runsLaunched,
    runtimeSnapshot.bootConfig.playerName,
    runtimeSnapshot.world.player?.name,
    runtimeSnapshot.world.ready,
    runtimeSnapshot.world.slice.captured,
    runtimeSnapshot.world.slice.completed,
    runtimeSnapshot.world.slice.objective,
    runtimeSnapshot.world.slice.round,
    runtimeSnapshot.world.slice.score,
    runtimeSnapshot.world.slice.total,
  ]);

  useEffect(() => {
    if (!currentSession || currentSession.status !== "completed") {
      return;
    }

    if (lastArchivedSessionId.current === currentSession.id) {
      return;
    }

    lastArchivedSessionId.current = currentSession.id;

    updateSlot(currentSession.slotId, (slot) => {
      if (slot.recentSessions.some((session) => session.id === currentSession.id)) {
        return slot;
      }

      const now = new Date().toISOString();
      return {
        ...slot,
        progression: awardSweepProgression(slot.progression, now),
        recentSessions: [currentSession, ...slot.recentSessions].slice(0, 6),
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
      activeSlot.profile.bestScore,
      activeSlot.profile.bestRound,
    ].join(":");

    if (remoteProfileSignature.current === signature) {
      return;
    }

    remoteProfileSignature.current = signature;

    void pushBackendProfile(normalizeBackendUrl(backendUrl), activeSlot)
      .then(() => {
        setBackendMessage(`Remote profile synced for ${activeSlot.label}.`);
      })
      .catch((error: unknown) => {
        setBackendMessage(formatErrorMessage(error, "Remote profile sync failed."));
      });
  }, [
    activeSlot.id,
    activeSlot.label,
    activeSlot.profile.bestRound,
    activeSlot.profile.bestScore,
    activeSlot.profile.preferredPlayerName,
    activeSlot.profile.preferredTouchControls,
    backendUrl,
    clientReady,
    dataMode,
  ]);

  useEffect(() => {
    if (!clientReady || dataMode !== "remote" || !currentSession) {
      return;
    }

    void syncCurrentSessionToRemote(currentSession, backendUrl)
      .then((created) => {
        if (created) {
          setBackendMessage(`Remote session synced: ${currentSession.id}.`);
        }
      })
      .catch((error: unknown) => {
        setBackendMessage(formatErrorMessage(error, "Remote session sync failed."));
      });
  }, [backendUrl, clientReady, currentSession, dataMode]);

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
        `Pulled ${snapshot.sessions.length} session(s) and ${Object.keys(snapshot.profiles).length} profile(s) from remote.`,
      );
    } catch (error: unknown) {
      setBackendMessage(formatErrorMessage(error, "Remote pull failed."));
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
        `Remote push complete. tick=${health.tick}, profiles=${health.profiles}, sessions=${health.sessions}.`,
      );
    } catch (error: unknown) {
      setBackendMessage(formatErrorMessage(error, "Remote push failed."));
    }
  }

  function handleSelectSlot(slotId: SaveSlotId) {
    const nextSlot =
      saveCollection.slots.find((slot) => slot.id === slotId) ?? defaultSaveSlot(slotId);

    commitCollection((current) => ({
      ...current,
      activeSlotId: slotId,
    }));

    setSaveMessage(`Active slot switched to ${nextSlot.label}.`);
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
    setSaveMessage(`Reset ${activeSlot.label} to template defaults.`);
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
    setSaveMessage("Reset all save slots and progression data.");
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
      setSaveMessage("Save matrix JSON copied to clipboard.");
    } catch {
      setSaveMessage("Save matrix JSON prepared below. Copy manually if needed.");
    }
  }

  function handleImportSaveMatrix() {
    try {
      const next = importSaveCollection(saveDraft);
      saveStoredSaveCollection(next);
      setSaveCollection(next);
      setSaveMessage("Save matrix imported from JSON.");
      void dispatchUiIntent({
        type: "runtime.boot-config.patch",
        patch: profileToBootConfig(getActiveSlot(next)),
      });
    } catch {
      setSaveMessage("Save matrix import failed. Check the JSON payload.");
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
      <aside className="sidebar">
        <div>
          <div className="eyebrow">Numeron</div>
          <h1 className="title">Board Auto-Battler</h1>
          <p className="muted">
            React controls the HUD, shop, and save flow while Bevy drives the shared
            board simulation for both web and native.
          </p>
        </div>

        <section className="panel">
          <div className="eyebrow">Data Mode</div>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-chip${dataMode === "local" ? " active" : ""}`}
              onClick={() => setDataMode("local")}
            >
              Local
            </button>
            <button
              type="button"
              className={`mode-chip${dataMode === "remote" ? " active" : ""}`}
              onClick={() => setDataMode("remote")}
            >
              Remote
            </button>
          </div>
          <label className="label">
            Backend URL
            <input
              type="text"
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              placeholder={DEFAULT_REMOTE_BACKEND_URL}
            />
          </label>
          <div className="action-row">
            <button className="button secondary" onClick={() => void handlePullRemote()}>
              Pull Remote
            </button>
            <button className="button secondary" onClick={() => void handlePushRemote()}>
              Push Active Slot
            </button>
          </div>
          <div className="muted">
            {dataMode === "local"
              ? "Shell data stays browser-local."
              : "Shell profile/session state syncs with the optional headless backend."}
          </div>
          {backendMessage ? <div className="muted">{backendMessage}</div> : null}
        </section>

        <section className="panel">
          <div className="eyebrow">Launcher</div>
          <label className="label">
            Player Name
            <input
              type="text"
              value={runtimeSnapshot.bootConfig.playerName}
              onChange={(event) =>
                setLauncherConfig("playerName", event.target.value)
              }
              maxLength={16}
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
            Touch HUD enabled
          </label>

          <button className="button" onClick={handleLaunch} disabled={!clientReady}>
            Launch Runtime
          </button>
        </section>

        <section className="panel">
          <div className="eyebrow">Battle Controls</div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Phase</span>
              <strong>{formatPhaseLabel(currentPhase)}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Gold</span>
              <strong>{runtimeSnapshot.world.slice.gold}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Reroll</span>
              <strong>{runtimeSnapshot.world.slice.rerollCost}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Bench</span>
              <strong>
                {benchUnits.length}/{runtimeSnapshot.world.slice.benchCapacity}
              </strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Shop</span>
              <strong>
                {runtimeSnapshot.world.slice.shopLocked ? "Locked" : "Open"}
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
              Start Combat
            </button>
            <button
              className="button secondary"
              onClick={handleResetRound}
              disabled={!canAdvanceRound}
              data-testid="next-round"
            >
              Next Round
            </button>
          </div>
        </section>

        <section className="panel" data-testid="draft-shop">
          <div className="eyebrow">Draft Shop</div>
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
                  {formatFactionLabel(offer.faction)} · {formatRoleLabel(offer.role)}
                </span>
                <span className="slot-meta">
                  {renderUnitMeta(offer)} · Cost {BUY_COST_LABEL}
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
              Reroll Shop
            </button>
            <button
              className="button secondary"
              onClick={handleToggleShopLock}
              disabled={!canDraft}
              data-testid="lock-shop"
            >
              {runtimeSnapshot.world.slice.shopLocked ? "Unlock Shop" : "Lock Shop"}
            </button>
          </div>
          <div className="muted">
            Buying now sends units to the bench. Deploy them into empty board slots before combat.
          </div>
          <div className="muted">
            {runtimeSnapshot.world.slice.shopLocked
              ? "Locked offers will carry into the next round."
              : "Open shop will refresh on the next round start."}
          </div>
        </section>

        <section className="panel" data-testid="bench-panel">
          <div className="eyebrow">Bench</div>
          <div className="formation-grid">
            {Array.from({ length: runtimeSnapshot.world.slice.benchCapacity }).map((_, index) => {
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
                    {unit ? unit.label : "Empty Bench Slot"}
                  </span>
                  <span className="slot-meta">
                    {unit
                      ? selectedBenchIndex === index
                        ? "Selected for deployment"
                        : "Click to select"
                      : "Buy from the shop"}
                  </span>
                  {unit ? (
                    <>
                      <span className="slot-meta">{renderUnitMeta(unit)}</span>
                      <span className="slot-meta">{unit.skill}</span>
                    </>
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
              Sell Bench Unit
            </button>
          </div>
          <div className="muted">
            {hasBenchSelection
              ? "Bench unit selected. Click an empty deployment slot to place it."
              : "Select a benched unit to prepare a deployment."}
          </div>
        </section>

        <section className="panel" data-testid="deployment-panel">
          <div className="eyebrow">Deployment</div>
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
                    {unit ? unit.label : `Empty Slot ${index + 1}`}
                  </span>
                  <span className="slot-meta">
                    {unit
                      ? isSelected
                        ? "Selected for board actions"
                        : "Click to select"
                      : hasBenchSelection
                        ? "Click to deploy selected unit"
                        : "Select a bench unit first"}
                  </span>
                  {unit ? (
                    <>
                      <span className="slot-meta">{renderUnitMeta(unit)}</span>
                      <span className="slot-meta">{unit.skill}</span>
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
              Withdraw To Bench
            </button>
            <button
              className="button secondary"
              onClick={handleSellBoardUnit}
              disabled={!hasBoardSelection}
              data-testid="sell-board"
            >
              Sell Deployed Unit
            </button>
          </div>
          <div className="muted">
            Active board: {playerBoard.filter(Boolean).length}/
            {runtimeSnapshot.world.slice.boardCapacity} deployed units
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Synergies</div>
          <div className="trait-grid">
            {activeTraits.map((trait) => (
              <div
                key={trait.key}
                className={`trait-card${trait.active ? " active" : ""}`}
              >
                <span className="slot-title">{trait.label}</span>
                <span className="slot-meta">
                  {trait.count}/{trait.threshold}
                </span>
                <span className="slot-meta">{trait.description}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Enemy Lineup</div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Threat</span>
              <strong>{runtimeSnapshot.world.slice.enemyThreat}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Intent</span>
              <strong>{runtimeSnapshot.world.slice.enemyIntent}</strong>
            </div>
          </div>
          <div className="formation-grid enemy-grid">
            {enemyBoard.map((unit, index) => (
              <div
                key={`enemy-${index}`}
                className={`formation-card enemy-card${unit ? "" : " empty"}`}
              >
                <span className="slot-title">
                  {unit ? unit.label : `Open Enemy Slot ${index + 1}`}
                </span>
                <span className="slot-meta">
                  {unit
                    ? `${formatFactionLabel(unit.faction)} · ${formatRoleLabel(unit.role)}`
                    : "Unused this round"}
                </span>
                {unit ? (
                  <>
                    <span className="slot-meta">{renderUnitMeta(unit)}</span>
                    <span className="slot-meta">{unit.skill}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Status</div>
          <div>{renderBootRecord(runtimeSnapshot.boot.current)}</div>
          <div className="muted">
            Current runtime now supports a lockable shop, richer enemy forecasts, unit
            skills/targeting rules, plus selling and merge-based roster growth.
          </div>
          <div className="muted">
            Runtime active: {runtimeSnapshot.runtimeActive ? "yes" : "no"}
          </div>
          <div className="muted">
            Commander:{" "}
            {runtimeSnapshot.world.player?.name ?? runtimeSnapshot.bootConfig.playerName}
          </div>
          <div className="muted">
            Board Seed: {runtimeSnapshot.world.slice.captured}/
            {runtimeSnapshot.world.slice.total || "?"} units active
          </div>
          <div className="muted">
            Board objective: {runtimeSnapshot.world.slice.objective}
          </div>
          <div className="muted">
            Round state: {runtimeSnapshot.world.slice.status}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Active Run</div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Status</span>
              <strong>{currentSession?.status ?? "staging"}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Round</span>
              <strong>{currentSession?.round ?? runtimeSnapshot.world.slice.round}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Gold</span>
              <strong>{runtimeSnapshot.world.slice.gold}</strong>
            </div>
          </div>
          <div className="muted">Session id: {currentSession?.id ?? "awaiting runtime"}</div>
          <div className="muted">
            Window: {formatTimestamp(currentSession?.startedAt)} to{" "}
            {formatTimestamp(currentSession?.endedAt)}
          </div>
          <div className="muted">
            HP: {runtimeSnapshot.world.slice.playerHealth} commander ·{" "}
            {runtimeSnapshot.world.slice.enemyHealth} enemy
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Run Meta</div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Level</span>
              <strong>{activeSlot.progression.level}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">XP</span>
              <strong>{activeSlot.progression.xp}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Battles</span>
              <strong>{activeSlot.progression.totalSweeps}</strong>
            </div>
          </div>
          <div className="muted">Runs launched: {activeSlot.progression.totalRuns}</div>
          <div className="muted">Best board score: {activeSlot.profile.bestScore}</div>
          <div className="badge-row">
            {activeSlot.progression.unlockedBadges.length > 0 ? (
              activeSlot.progression.unlockedBadges.map((badge) => (
                <span className="badge-pill" key={badge}>
                  {formatBadgeLabel(badge)}
                </span>
              ))
            ) : (
              <span className="muted">No milestones unlocked yet.</span>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Save Slots</div>
          <div className="slot-grid">
            {saveCollection.slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot-card${slot.id === activeSlot.id ? " active" : ""}`}
                onClick={() => handleSelectSlot(slot.id)}
              >
                <span className="slot-title">{slot.label}</span>
                <span className="slot-meta">Best {slot.profile.bestScore}</span>
                <span className="slot-meta">Round {slot.profile.bestRound}</span>
              </button>
            ))}
          </div>

          <label className="label">
            Active Slot Label
            <input
              type="text"
              value={activeSlot.label}
              onChange={(event) => handleRenameSlot(event.target.value)}
              maxLength={18}
            />
          </label>

          <div className="muted">
            Last run: {activeSlot.profile.lastScore} score, round {activeSlot.profile.lastRound},
            staged units {activeSlot.profile.lastCaptured}
          </div>

          <div className="session-list">
            {activeSlot.recentSessions.length > 0 ? (
              activeSlot.recentSessions.map((session) => (
                <div className="session-row" key={session.id}>
                  <span>{session.id}</span>
                  <span>{session.score} pts</span>
                  <span>R{session.round}</span>
                </div>
              ))
            ) : (
              <div className="muted">No archived sessions yet.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Run Snapshot</div>
          <div className="action-row">
            <button className="button secondary" onClick={() => void handleCopySaveMatrix()}>
              Copy Snapshot
            </button>
            <button className="button secondary" onClick={handleImportSaveMatrix}>
              Load Snapshot
            </button>
            <button className="button secondary" onClick={handleResetActiveSlot}>
              Reset Active Slot
            </button>
            <button className="button secondary" onClick={handleResetAllSaves}>
              Reset All Saves
            </button>
          </div>
          <label className="label">
            Snapshot JSON
            <textarea
              className="profile-textarea"
              value={saveDraft}
              onChange={(event) => setSaveDraft(event.target.value)}
              placeholder="Exported Numeron run snapshot JSON appears here. Paste a payload to import."
              rows={8}
            />
          </label>
          {saveMessage ? <div className="muted">{saveMessage}</div> : null}
        </section>

        <section className="panel">
          <div className="eyebrow">Boot History</div>
          <ol className="history">
            {[...runtimeSnapshot.boot.history].reverse().map((record) => (
              <li key={record.id}>{renderBootRecord(record)}</li>
            ))}
          </ol>
        </section>
      </aside>

      <section className="canvas-area">
        <div className="canvas-frame">
          <canvas id="bevy-runtime-canvas" />
          <div className="hud">
            <div className="hud-card">
              <div className="eyebrow">Projection</div>
              <div>{runtimeSnapshot.world.ready ? "ready" : "booting"}</div>
            </div>

            <div className="hud-card objective-card">
              <div className="eyebrow">Board Slice</div>
              <div className="objective-title">
                {runtimeSnapshot.world.slice.captured}/{runtimeSnapshot.world.slice.total || "?"}{" "}
                active units
              </div>
              <div className="muted">{runtimeSnapshot.world.slice.status}</div>
            </div>

            <div className="hud-card objective-card">
              <div className="eyebrow">Active Slot</div>
              <div className="objective-title">{activeSlot.label}</div>
              <div className="muted">
                L{activeSlot.progression.level} · {activeSlot.progression.xp} XP
              </div>
            </div>

            {runtimeSnapshot.bootConfig.touchControls ? (
              <div className="touch-card">
                <div className="eyebrow">Quick Actions</div>
                <div className="touch-grid">
                  <button
                    className="touch-button"
                    onClick={handleStartCombat}
                    disabled={!canStartCombat}
                  >
                    Start
                  </button>
                  <button
                    className="touch-button"
                    onClick={handleResetRound}
                    disabled={!canAdvanceRound}
                  >
                    Next
                  </button>
                  <button
                    className="touch-button"
                    onClick={handleRerollShop}
                    disabled={!canDraft || runtimeSnapshot.world.slice.gold < runtimeSnapshot.world.slice.rerollCost}
                  >
                    Roll
                  </button>
                  <button
                    className="touch-button"
                    onClick={() => handleBuyOffer(0)}
                    disabled={!canBuyUnit || runtimeSnapshot.world.slice.shopOffers.length === 0}
                  >
                    Buy
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
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

function renderBootRecord(record: RuntimeBootRecord) {
  return `${record.phase} · ${record.message}`;
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

function buildSessionId(slotId: SaveSlotId, runsLaunched: number, round: number) {
  const runNumber = Math.max(1, runsLaunched);
  return `${slotId}-run-${runNumber}-round-${round}`;
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

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "in-progress";
  }

  return new Date(value).toLocaleTimeString();
}

function formatBadgeLabel(badge: ProgressionBadge) {
  switch (badge) {
    case "first-launch":
      return "First Launch";
    case "first-sweep":
      return "First Battle";
    case "score-300":
      return "Score 300";
    case "loop-3":
      return "Loop 3";
  }
}

function formatPhaseLabel(phase: RuntimeSnapshot["world"]["slice"]["phase"]) {
  switch (phase) {
    case "preparation":
      return "Prep";
    case "combat":
      return "Combat";
    case "resolution":
      return "Resolution";
  }
}

function renderUnitMeta(unit: RuntimeUnitView) {
  return `${formatFactionLabel(unit.faction)} · ${formatRoleLabel(unit.role)} · ${unit.attack} atk · ${unit.health} hp · Sell ${unit.sellValue} · ${unit.targetRule}`;
}

function formatFactionLabel(faction: RuntimeUnitView["faction"] | RuntimeTraitView["key"]) {
  switch (faction) {
    case "dawn":
      return "Dawn";
    case "dusk":
      return "Dusk";
    case "vanguard":
      return "Vanguard";
    case "skirmisher":
      return "Skirmisher";
  }
}

function formatRoleLabel(role: RuntimeUnitView["role"]) {
  switch (role) {
    case "vanguard":
      return "Vanguard";
    case "skirmisher":
      return "Skirmisher";
  }
}

function formatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}
