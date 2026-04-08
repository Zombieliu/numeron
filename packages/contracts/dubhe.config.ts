import { defineConfig } from "@0xobelisk/sui-common";

export const dubheConfig = defineConfig({
  name: "numeron",
  description: "Numeron async autobattler agent, match, and replay index",
  resources: {
    season_config: {
      fields: {
        season_id: "u64",
        ruleset_version: "u32",
        start_at_ms: "u64",
        end_at_ms: "u64",
        active: "bool",
      },
      keys: ["season_id"],
    },
    agent_profile: {
      fields: {
        agent_id: "u64",
        owner: "address",
        archetype: "u8",
        faction: "u8",
        role: "u8",
        created_at_ms: "u64",
        last_seen_at_ms: "u64",
      },
      keys: ["agent_id"],
    },
    match_record: {
      fields: {
        match_id: "u64",
        season_id: "u64",
        result: "u8",
        round: "u32",
        score: "u64",
        started_at_ms: "u64",
        ended_at_ms: "u64",
      },
      keys: ["match_id"],
    },
    match_participation: {
      fields: {
        participation_id: "u64",
        match_id: "u64",
        agent_id: "u64",
        battle_instance_id: "u64",
        team: "u8",
        placement: "u8",
      },
      keys: ["match_id", "agent_id"],
    },
    replay_anchor: {
      fields: {
        match_id: "u64",
        walrus_blob_epoch: "u64",
        replay_digest_hi: "u128",
        replay_digest_lo: "u128",
      },
      keys: ["match_id"],
    },
    reward_claim: {
      fields: {
        match_id: "u64",
        agent_id: "u64",
        reward_type: "u8",
        amount: "u64",
        claimed_at_ms: "u64",
      },
      keys: ["match_id", "agent_id"],
    },
    extension_registry: {
      fields: {
        extension_id: "u64",
        publisher: "address",
        namespace: "u64",
        schema_version: "u32",
        target_kind: "u8",
        enabled: "bool",
      },
      keys: ["extension_id"],
    },
  },
});
