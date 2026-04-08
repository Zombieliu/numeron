"use client";

import { Dubhe, Transaction } from "@0xobelisk/sui-client";
import { Network } from "numeron-contracts/deployment";

import type {
  RuntimeAgentRecord,
  RuntimeBattleRecord,
  RuntimeSaveSlot,
} from "@/lib/types";

const USER_STORAGE_CACHE_PREFIX = "numeron.user-storage.v1";
const MAX_SYNC_AGENTS = 16;
const NUMERON_SEASON_ID = 1n;
const PLAYER_TEAM = 1;
type UserStorageFields = Awaited<ReturnType<Dubhe["getUserStorageFields"]>>;

export type ChainSyncClient = {
  contract: Dubhe;
  packageId: string;
  dappHubId: string;
  dappStorageId: string;
  frameworkPackageId?: string;
};

export type ChainSyncState = {
  userStorageId: string | null;
  userStorageFields: UserStorageFields | null;
};

export type SyncPlan = {
  tx: Transaction;
  agentCount: number;
  matchCount: number;
  participationCount: number;
  replayDigest: { hi: bigint; lo: bigint } | null;
  battleId: string | null;
};

export function buildChainStorageCacheKey(address: string) {
  return `${USER_STORAGE_CACHE_PREFIX}:${Network}:${address.toLowerCase()}`;
}

export function readCachedUserStorageId(address: string) {
  try {
    const value = window.localStorage.getItem(buildChainStorageCacheKey(address));
    return value && value !== "0x0" ? value : null;
  } catch {
    return null;
  }
}

export function cacheUserStorageId(address: string, userStorageId: string | null) {
  try {
    const key = buildChainStorageCacheKey(address);
    if (!userStorageId) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, userStorageId);
  } catch {}
}

export async function refreshChainSyncState(
  contract: Dubhe,
  address: string
): Promise<ChainSyncState> {
  const cached = readCachedUserStorageId(address);
  const userStorageId = cached ?? (await contract.getUserStorageId(address));

  if (!userStorageId) {
    cacheUserStorageId(address, null);
    return {
      userStorageId: null,
      userStorageFields: null,
    };
  }

  cacheUserStorageId(address, userStorageId);

  return {
    userStorageId,
    userStorageFields: await contract.getUserStorageFields(userStorageId),
  };
}

export function buildRegisterUserStorageTransaction({
  packageId,
  dappHubId,
  dappStorageId,
}: ChainSyncClient) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${packageId}::user_storage_init::init_user_storage`,
    arguments: [tx.object(dappHubId), tx.object(dappStorageId)],
  });
  return tx;
}

export async function buildSyncLatestBattleTransaction(
  client: ChainSyncClient,
  userStorageId: string,
  ownerAddress: string,
  slot: RuntimeSaveSlot
): Promise<SyncPlan> {
  const { contract } = client;
  const tx = new Transaction();
  const battle = selectBattleForSync(slot);
  const agentIdsToSync = new Set<string>();

  if (battle) {
    for (const agentId of battle.playerAgentIds) {
      agentIdsToSync.add(agentId);
    }
  }

  for (const agent of slot.agentRoster.slice(0, MAX_SYNC_AGENTS)) {
    agentIdsToSync.add(agent.id);
    if (agentIdsToSync.size >= MAX_SYNC_AGENTS) {
      break;
    }
  }

  const agents = [...agentIdsToSync]
    .map((agentId) =>
      slot.agentRoster.find((candidate) => candidate.id === agentId)
    )
    .filter((agent): agent is RuntimeAgentRecord => Boolean(agent));

  for (const agent of agents) {
    await contract.tx.numeron_system.upsert_agent_profile({
      tx,
      params: [
        tx.object(userStorageId),
        tx.pure.u64(await hashToU64(agent.id)),
        tx.pure.address(ownerAddress),
        tx.pure.u8(archetypeToCode(agent.archetype)),
        tx.pure.u8(factionToCode(agent.faction)),
        tx.pure.u8(roleToCode(agent.role)),
        tx.pure.u64(toMillis(agent.firstSeenAt)),
        tx.pure.u64(toMillis(agent.lastSeenAt)),
      ],
      isRaw: true,
    });
  }

  let participationCount = 0;
  let replayDigest: { hi: bigint; lo: bigint } | null = null;

  if (battle) {
    const matchId = await hashToU64(battle.id);
    const endedAt =
      battle.endedAt || battle.status === "completed" ? toMillis(battle.endedAt || battle.updatedAt) : 0n;

    await contract.tx.numeron_system.record_match({
      tx,
      params: [
        tx.object(userStorageId),
        tx.pure.u64(matchId),
        tx.pure.u64(NUMERON_SEASON_ID),
        tx.pure.u8(resultToCode(battle.result)),
        tx.pure.u32(battle.round),
        tx.pure.u64(BigInt(Math.max(0, battle.score))),
        tx.pure.u64(toMillis(battle.startedAt)),
        tx.pure.u64(endedAt),
      ],
      isRaw: true,
    });

    replayDigest = await hashToReplayDigest(
      battle.replayState || JSON.stringify(battle)
    );

    await contract.tx.numeron_system.anchor_replay({
      tx,
      params: [
        tx.object(userStorageId),
        tx.pure.u64(matchId),
        tx.pure.u64(0),
        tx.pure.u128(replayDigest.hi),
        tx.pure.u128(replayDigest.lo),
      ],
      isRaw: true,
    });

    for (const agentId of battle.playerAgentIds) {
      participationCount += 1;
      await contract.tx.numeron_system.record_match_participation({
        tx,
        params: [
          tx.object(userStorageId),
          tx.pure.u64(await hashToU64(`${battle.id}:${agentId}:participation`)),
          tx.pure.u64(matchId),
          tx.pure.u64(await hashToU64(agentId)),
          tx.pure.u64(await hashToU64(`${battle.id}:${agentId}:instance`)),
          tx.pure.u8(PLAYER_TEAM),
          tx.pure.u8(placementToCode(battle.result)),
        ],
        isRaw: true,
      });
    }
  }

  return {
    tx,
    agentCount: agents.length,
    matchCount: battle ? 1 : 0,
    participationCount,
    replayDigest,
    battleId: battle?.id ?? null,
  };
}

function selectBattleForSync(slot: RuntimeSaveSlot) {
  return (
    slot.battleRecords.find((battle) => battle.status === "completed") ??
    slot.battleRecords[0] ??
    null
  );
}

function toMillis(value: string | null) {
  if (!value) {
    return 0n;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? BigInt(parsed) : 0n;
}

async function hashToU64(value: string) {
  const bytes = await sha256(value);
  return bytesToBigInt(bytes.slice(0, 8));
}

async function hashToReplayDigest(value: string) {
  const bytes = await sha256(value);
  return {
    hi: bytesToBigInt(bytes.slice(0, 16)),
    lo: bytesToBigInt(bytes.slice(16, 32)),
  };
}

async function sha256(value: string) {
  const payload = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return new Uint8Array(digest);
}

function bytesToBigInt(bytes: Uint8Array) {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte);
  }
  return result;
}

function archetypeToCode(archetype: RuntimeAgentRecord["archetype"]) {
  switch (archetype) {
    case "verdant-bruiser":
      return 0;
    case "signal-ranger":
      return 1;
    case "ash-duelist":
      return 2;
    case "iron-vanguard":
      return 3;
    case "frost-oracle":
      return 4;
    case "ember-medic":
      return 5;
    case "volt-juggler":
      return 6;
    case "grave-warden":
      return 7;
  }
}

function factionToCode(faction: RuntimeAgentRecord["faction"]) {
  return faction === "dawn" ? 1 : 2;
}

function roleToCode(role: RuntimeAgentRecord["role"]) {
  return role === "vanguard" ? 1 : 2;
}

function resultToCode(result: RuntimeBattleRecord["result"]) {
  switch (result) {
    case "victory":
      return 1;
    case "defeat":
      return 2;
    default:
      return 0;
  }
}

function placementToCode(result: RuntimeBattleRecord["result"]) {
  switch (result) {
    case "victory":
      return 1;
    case "defeat":
      return 2;
    default:
      return 0;
  }
}
