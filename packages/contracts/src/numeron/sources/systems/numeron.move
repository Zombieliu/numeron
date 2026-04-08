module numeron::numeron_system {
    use dubhe::dapp_service::UserStorage;
    use numeron::agent_profile;
    use numeron::extension_registry;
    use numeron::match_participation;
    use numeron::match_record;
    use numeron::replay_anchor;
    use numeron::reward_claim;
    use numeron::season_config;

    public fun upsert_season_config(
        user_storage: &mut UserStorage,
        season_id: u64,
        ruleset_version: u32,
        start_at_ms: u64,
        end_at_ms: u64,
        active: bool,
        ctx: &mut TxContext,
    ) {
        season_config::set(
            user_storage,
            season_id,
            ruleset_version,
            start_at_ms,
            end_at_ms,
            active,
            ctx,
        );
    }

    public fun upsert_agent_profile(
        user_storage: &mut UserStorage,
        agent_id: u64,
        owner: address,
        archetype: u8,
        faction: u8,
        role: u8,
        created_at_ms: u64,
        last_seen_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        agent_profile::set(
            user_storage,
            agent_id,
            owner,
            archetype,
            faction,
            role,
            created_at_ms,
            last_seen_at_ms,
            ctx,
        );
    }

    public fun register_extension(
        user_storage: &mut UserStorage,
        extension_id: u64,
        publisher: address,
        namespace: u64,
        schema_version: u32,
        target_kind: u8,
        enabled: bool,
        ctx: &mut TxContext,
    ) {
        extension_registry::set(
            user_storage,
            extension_id,
            publisher,
            namespace,
            schema_version,
            target_kind,
            enabled,
            ctx,
        );
    }

    public fun record_match(
        user_storage: &mut UserStorage,
        match_id: u64,
        season_id: u64,
        result: u8,
        round: u32,
        score: u64,
        started_at_ms: u64,
        ended_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        match_record::set(
            user_storage,
            match_id,
            season_id,
            result,
            round,
            score,
            started_at_ms,
            ended_at_ms,
            ctx,
        );
    }

    public fun record_match_participation(
        user_storage: &mut UserStorage,
        participation_id: u64,
        match_id: u64,
        agent_id: u64,
        battle_instance_id: u64,
        team: u8,
        placement: u8,
        ctx: &mut TxContext,
    ) {
        match_participation::set(
            user_storage,
            match_id,
            agent_id,
            participation_id,
            battle_instance_id,
            team,
            placement,
            ctx,
        );
    }

    public fun anchor_replay(
        user_storage: &mut UserStorage,
        match_id: u64,
        walrus_blob_epoch: u64,
        replay_digest_hi: u128,
        replay_digest_lo: u128,
        ctx: &mut TxContext,
    ) {
        replay_anchor::set(
            user_storage,
            match_id,
            walrus_blob_epoch,
            replay_digest_hi,
            replay_digest_lo,
            ctx,
        );
    }

    public fun claim_reward(
        user_storage: &mut UserStorage,
        match_id: u64,
        agent_id: u64,
        reward_type: u8,
        amount: u64,
        claimed_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        reward_claim::set(
            user_storage,
            match_id,
            agent_id,
            reward_type,
            amount,
            claimed_at_ms,
            ctx,
        );
    }
}
