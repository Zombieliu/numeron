"use client";

import { useDubhe } from "@0xobelisk/react/sui";
import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useSignAndExecuteTransaction,
  useSuiClientContext,
  useSuiClientQuery,
} from "@mysten/dapp-kit";
import dubheConfig from "numeron-contracts/dubhe-config";
import { useEffect, useState } from "react";

import {
  buildRegisterUserStorageTransaction,
  buildSyncLatestBattleTransaction,
  cacheUserStorageId,
  refreshChainSyncState,
} from "@/lib/chain-sync";
import { getUiCopy, type UiLocale } from "@/lib/ui-i18n";
import type { RuntimeSaveSlot } from "@/lib/types";

type WorldCorePanelProps = {
  locale: UiLocale;
  slot: RuntimeSaveSlot;
};

type ChainAction = "refresh" | "register" | "sync" | null;

function shortenHex(value: string | undefined | null) {
  if (!value || value === "0x0") {
    return "0x0";
  }

  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function summarizeObjectState(
  copy: ReturnType<typeof getUiCopy>,
  result:
    | {
        data?: {
          digest?: string;
          type?: string;
          content?: {
            dataType?: string;
            type?: string;
          };
        } | null;
        error?: {
          code?: string;
        } | null;
      }
    | null
    | undefined
) {
  if (!result) {
    return {
      state: copy.objectMissing,
      type: "unknown",
      digest: "n/a",
    };
  }

  if (result.error) {
    return {
      state: copy.objectQueryFailed,
      type: result.error.code || "error",
      digest: "n/a",
    };
  }

  if (!result.data) {
    return {
      state: copy.objectMissing,
      type: "unknown",
      digest: "n/a",
    };
  }

  return {
    state: copy.objectFound,
    type:
      result.data.type ||
      result.data.content?.type ||
      result.data.content?.dataType ||
      "object",
    digest: result.data.digest || "n/a",
  };
}

function formatChainSummary(
  locale: UiLocale,
  agentCount: number,
  matchCount: number,
  participationCount: number
) {
  if (locale === "zh-CN") {
    return `已同步 ${agentCount} 个 agent，${matchCount} 场对局，${participationCount} 条参战记录。`;
  }

  return `Synced ${agentCount} agents, ${matchCount} matches, and ${participationCount} participations.`;
}

export function WorldCorePanel({ locale, slot }: WorldCorePanelProps) {
  const copy = getUiCopy(locale);
  const {
    contract,
    dappHubId,
    dappStorageId,
    frameworkPackageId,
    network: dubheNetwork,
    packageId,
  } = useDubhe();
  const currentAccount = useCurrentAccount();
  const { connectionStatus } = useCurrentWallet();
  const { network } = useSuiClientContext();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [userStorageId, setUserStorageId] = useState<string | null>(null);
  const [userStorageWriteCount, setUserStorageWriteCount] = useState<bigint>(0n);
  const [userStorageUnsettledCount, setUserStorageUnsettledCount] =
    useState<bigint>(0n);
  const [chainMessage, setChainMessage] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [lastSyncedBattleId, setLastSyncedBattleId] = useState<string | null>(
    null
  );
  const [activeAction, setActiveAction] = useState<ChainAction>(null);
  const resourceCount = Array.isArray(dubheConfig.resources)
    ? dubheConfig.resources.length
    : 0;
  const hasPublishConfig = Boolean(
    packageId && dappHubId && dappStorageId && frameworkPackageId
  );
  const unpublished =
    !hasPublishConfig ||
    String(packageId).trim() === "0x0" ||
    String(dappStorageId).trim() === "0x0";

  const latestCheckpointQuery = useSuiClientQuery(
    "getLatestCheckpointSequenceNumber",
    {},
    {
      refetchInterval: 5_000,
    }
  );
  const packageQuery = useSuiClientQuery(
    "getObject",
    {
      id: packageId || "0x0",
      options: {
        showType: true,
        showOwner: true,
      },
    },
    {
      enabled: !unpublished && !!packageId,
      refetchInterval: 5_000,
    }
  );
  const dappStorageQuery = useSuiClientQuery(
    "getObject",
    {
      id: dappStorageId || "0x0",
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
      },
    },
    {
      enabled: !unpublished && !!dappStorageId,
      refetchInterval: 5_000,
    }
  );
  const dappHubQuery = useSuiClientQuery(
    "getObject",
    {
      id: dappHubId || "0x0",
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
      },
    },
    {
      enabled: !unpublished && !!dappHubId,
      refetchInterval: 5_000,
    }
  );
  const packageState = summarizeObjectState(copy, packageQuery.data as never);
  const dappStorageState = summarizeObjectState(
    copy,
    dappStorageQuery.data as never
  );
  const dappHubState = summarizeObjectState(copy, dappHubQuery.data as never);

  useEffect(() => {
    if (!currentAccount?.address) {
      setUserStorageId(null);
      setUserStorageWriteCount(0n);
      setUserStorageUnsettledCount(0n);
      setLastDigest(null);
      setChainMessage(null);
      return;
    }

    let cancelled = false;

    void refreshChainSyncState(contract, currentAccount.address)
      .then((state) => {
        if (cancelled) {
          return;
        }

        setUserStorageId(state.userStorageId);
        setUserStorageWriteCount(state.userStorageFields?.write_count ?? 0n);
        setUserStorageUnsettledCount(
          state.userStorageFields?.unsettled_count ?? 0n
        );
        setChainMessage(
          state.userStorageId ? null : copy.chainSyncIdleHint
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setChainMessage(
          error instanceof Error ? error.message : copy.objectQueryFailed
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    contract,
    copy.chainSyncIdleHint,
    copy.objectQueryFailed,
    currentAccount?.address,
  ]);

  async function handleRefreshChainState() {
    if (!currentAccount?.address) {
      setChainMessage(copy.chainSyncMissingWallet);
      return;
    }

    setActiveAction("refresh");
    try {
      const state = await refreshChainSyncState(contract, currentAccount.address);
      setUserStorageId(state.userStorageId);
      setUserStorageWriteCount(state.userStorageFields?.write_count ?? 0n);
      setUserStorageUnsettledCount(
        state.userStorageFields?.unsettled_count ?? 0n
      );
      setChainMessage(state.userStorageId ? null : copy.chainSyncIdleHint);
    } catch (error: unknown) {
      setChainMessage(
        error instanceof Error ? error.message : copy.objectQueryFailed
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRegisterUserStorage() {
    if (!currentAccount?.address) {
      setChainMessage(copy.chainSyncMissingWallet);
      return;
    }

    if (!hasPublishConfig) {
      setChainMessage(copy.publishPending);
      return;
    }

    setActiveAction("register");

    try {
      const chainClient = {
        contract,
        packageId: packageId!,
        dappHubId: dappHubId!,
        dappStorageId: dappStorageId!,
        frameworkPackageId: frameworkPackageId!,
      };
      const tx = buildRegisterUserStorageTransaction({
        ...chainClient,
      });
      const result = (await signAndExecuteTransaction({
        transaction: tx.serialize(),
        chain: `sui:${dubheNetwork}`,
      })) as {
        digest?: string;
        effects?: {
          status?: {
            status?: string;
            error?: string;
          };
        };
        objectChanges?: Array<{
          type?: string;
          objectId?: string;
          objectType?: string;
          sender?: string;
        }>;
      };

      if (result.effects?.status?.status === "failure") {
        throw new Error(result.effects.status.error || "register failed");
      }

      const created = result.objectChanges?.find(
        (change) =>
          change.type === "created" &&
          change.objectType ===
            `${frameworkPackageId}::dapp_service::UserStorage` &&
          change.sender?.toLowerCase() === currentAccount.address.toLowerCase()
      );

      if (created?.objectId) {
        cacheUserStorageId(currentAccount.address, created.objectId);
      }

      const state = await refreshChainSyncState(contract, currentAccount.address);
      setUserStorageId(state.userStorageId);
      setUserStorageWriteCount(state.userStorageFields?.write_count ?? 0n);
      setUserStorageUnsettledCount(
        state.userStorageFields?.unsettled_count ?? 0n
      );
      setLastDigest(result.digest ?? null);
      setLastSyncedBattleId(null);
      setChainMessage(
        locale === "zh-CN"
          ? "UserStorage 注册完成。"
          : "UserStorage registered."
      );
    } catch (error: unknown) {
      setChainMessage(
        error instanceof Error ? error.message : copy.objectQueryFailed
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSyncLatestBattle() {
    if (!currentAccount?.address) {
      setChainMessage(copy.chainSyncMissingWallet);
      return;
    }

    if (!userStorageId) {
      setChainMessage(copy.chainSyncIdleHint);
      return;
    }

    if (!hasPublishConfig) {
      setChainMessage(copy.publishPending);
      return;
    }

    setActiveAction("sync");

    try {
      const chainClient = {
        contract,
        packageId: packageId!,
        dappHubId: dappHubId!,
        dappStorageId: dappStorageId!,
        frameworkPackageId: frameworkPackageId!,
      };
      const plan = await buildSyncLatestBattleTransaction(
        chainClient,
        userStorageId,
        currentAccount.address,
        slot
      );

      if (plan.agentCount === 0 && plan.matchCount === 0) {
        setChainMessage(copy.chainSyncIdleHint);
        return;
      }

      const result = (await signAndExecuteTransaction({
        transaction: plan.tx.serialize(),
        chain: `sui:${dubheNetwork}`,
      })) as {
        digest?: string;
        effects?: {
          status?: {
            status?: string;
            error?: string;
          };
        };
      };

      if (result.effects?.status?.status === "failure") {
        throw new Error(result.effects.status.error || "sync failed");
      }

      const state = await refreshChainSyncState(contract, currentAccount.address);
      setUserStorageId(state.userStorageId);
      setUserStorageWriteCount(state.userStorageFields?.write_count ?? 0n);
      setUserStorageUnsettledCount(
        state.userStorageFields?.unsettled_count ?? 0n
      );
      setLastDigest(result.digest ?? null);
      setLastSyncedBattleId(plan.battleId);
      setChainMessage(
        formatChainSummary(
          locale,
          plan.agentCount,
          plan.matchCount,
          plan.participationCount
        )
      );
    } catch (error: unknown) {
      setChainMessage(
        error instanceof Error ? error.message : copy.objectQueryFailed
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <section className="panel" data-testid="world-core-panel">
      <div className="eyebrow">{copy.worldCore}</div>
      <div className="action-row world-core-actions">
        <ConnectButton />
        <button
          type="button"
          className="button secondary"
          onClick={() => void handleRefreshChainState()}
          disabled={activeAction != null}
        >
          {copy.refreshChainState}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => void handleRegisterUserStorage()}
          disabled={
            activeAction != null || unpublished || !currentAccount || !!userStorageId
          }
        >
          {copy.registerUserStorage}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => void handleSyncLatestBattle()}
          disabled={
            activeAction != null ||
            unpublished ||
            !currentAccount ||
            !userStorageId
          }
        >
          {copy.syncLatestBattle}
        </button>
      </div>

      <div className="muted">
        {chainMessage ||
          (connectionStatus === "connected"
            ? copy.chainSyncIdleHint
            : copy.chainSyncMissingWallet)}
      </div>

      <div className="stat-grid stat-grid-two">
        <div className="stat-card">
          <span className="stat-label">{copy.wallet}</span>
          <strong>
            {connectionStatus === "connected"
              ? shortenHex(currentAccount?.address)
              : copy.walletDisconnected}
          </strong>
          {currentAccount ? (
            <span className="muted">
              {copy.ownerAddress}: {shortenHex(currentAccount.address)}
            </span>
          ) : null}
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.chainStatus}</span>
          <strong>{network || dubheNetwork}</strong>
          <span className="muted">
            {unpublished ? copy.publishPending : copy.readyToPublish}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.schemaTables}</span>
          <strong>{resourceCount}</strong>
          <span className="muted">
            {copy.extensionPackages}: 1
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.localLedgerBridge}</span>
          <strong>{slot.agentRoster.length}</strong>
          <span className="muted">
            {slot.battleRecords.length} {copy.battleAnchors}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.latestCheckpoint}</span>
          <strong>{latestCheckpointQuery.data ?? "..."}</strong>
          <span className="muted">
            {copy.network}: {network || dubheNetwork}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.chainSync}</span>
          <strong>{userStorageId ? shortenHex(userStorageId) : copy.objectMissing}</strong>
          <span className="muted">
            {copy.recentWriteCount}: {userStorageWriteCount.toString()} ·{" "}
            {copy.recentUnsettledWrites}:{" "}
            {userStorageUnsettledCount.toString()}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">{copy.chainSyncStatus}</span>
          <strong>
            {lastDigest
              ? shortenHex(lastDigest)
              : activeAction === "sync"
              ? copy.inProgress
              : "n/a"}
          </strong>
          <span className="muted">
            {copy.lastSyncedBattle}:{" "}
            {lastSyncedBattleId ? shortenHex(lastSyncedBattleId) : "n/a"}
          </span>
        </div>
      </div>

      <div className="session-list">
        <div className="session-row">
          <span>{copy.userStorage}</span>
          <span>{userStorageId ? shortenHex(userStorageId) : copy.objectMissing}</span>
        </div>
        <div className="session-row">
          <span>{copy.syncDigest}</span>
          <span>{lastDigest ? shortenHex(lastDigest) : "n/a"}</span>
        </div>
        <div className="session-row">
          <span>{copy.packageId}</span>
          <span>{shortenHex(packageId)}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectState}</span>
          <span>{packageState.state}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectType}</span>
          <span>{packageState.type}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectDigest}</span>
          <span>{shortenHex(packageState.digest)}</span>
        </div>
        <div className="session-row">
          <span>{copy.dappStorageId}</span>
          <span>{shortenHex(dappStorageId)}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectState}</span>
          <span>{dappStorageState.state}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectType}</span>
          <span>{dappStorageState.type}</span>
        </div>
        <div className="session-row">
          <span>{copy.dappHubId}</span>
          <span>{shortenHex(dappHubId)}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectState}</span>
          <span>{dappHubState.state}</span>
        </div>
        <div className="session-row">
          <span>{copy.objectType}</span>
          <span>{dappHubState.type}</span>
        </div>
        <div className="session-row">
          <span>{copy.frameworkPackageId}</span>
          <span>{shortenHex(frameworkPackageId)}</span>
        </div>
      </div>
    </section>
  );
}
