module agent_rating_extension::agent_rating {
    use sui::event;
    use sui::table::{Self, Table};

    const E_STORE_NOT_EMPTY: u64 = 0;
    const E_RATING_NOT_FOUND: u64 = 1;

    public struct RatingStore has key {
        id: UID,
        extension_id: u64,
        namespace: u64,
        schema_version: u32,
        ratings: Table<u64, AgentRating>,
    }

    public struct AgentRating has copy, drop, store {
        mu: u64,
        sigma: u64,
        rated_matches: u64,
        last_match_id: u64,
    }

    public struct RatingUpdated has copy, drop {
        agent_id: u64,
        match_id: u64,
        mu: u64,
        sigma: u64,
        rated_matches: u64,
    }

    public fun create_store(
        extension_id: u64,
        namespace: u64,
        schema_version: u32,
        ctx: &mut TxContext,
    ) {
        let store = RatingStore {
            id: object::new(ctx),
            extension_id,
            namespace,
            schema_version,
            ratings: table::new(ctx),
        };

        transfer::share_object(store);
    }

    public fun extension_id(store: &RatingStore): u64 {
        store.extension_id
    }

    public fun namespace(store: &RatingStore): u64 {
        store.namespace
    }

    public fun schema_version(store: &RatingStore): u32 {
        store.schema_version
    }

    public fun has_rating(store: &RatingStore, agent_id: u64): bool {
        table::contains(&store.ratings, agent_id)
    }

    public fun borrow_rating(store: &RatingStore, agent_id: u64): &AgentRating {
        assert!(table::contains(&store.ratings, agent_id), E_RATING_NOT_FOUND);
        table::borrow(&store.ratings, agent_id)
    }

    public fun upsert_rating(
        store: &mut RatingStore,
        agent_id: u64,
        match_id: u64,
        mu: u64,
        sigma: u64,
        rated_matches: u64,
    ) {
        let next = AgentRating {
            mu,
            sigma,
            rated_matches,
            last_match_id: match_id,
        };

        if (table::contains(&store.ratings, agent_id)) {
            *table::borrow_mut(&mut store.ratings, agent_id) = next;
        } else {
            table::add(&mut store.ratings, agent_id, next);
        };

        event::emit(RatingUpdated {
            agent_id,
            match_id,
            mu,
            sigma,
            rated_matches,
        });
    }

    public fun apply_match_result(
        store: &mut RatingStore,
        agent_id: u64,
        match_id: u64,
        won: bool,
        mu_delta: u64,
        sigma: u64,
    ) {
        let next = if (table::contains(&store.ratings, agent_id)) {
            let current = table::borrow(&store.ratings, agent_id);
            let mu = if (won) {
                current.mu + mu_delta
            } else if (current.mu > mu_delta) {
                current.mu - mu_delta
            } else {
                0
            };

            AgentRating {
                mu,
                sigma,
                rated_matches: current.rated_matches + 1,
                last_match_id: match_id,
            }
        } else {
            AgentRating {
                mu: if (won) { mu_delta } else { 0 },
                sigma,
                rated_matches: 1,
                last_match_id: match_id,
            }
        };

        let mu = next.mu;
        let rated_matches = next.rated_matches;
        if (table::contains(&store.ratings, agent_id)) {
            *table::borrow_mut(&mut store.ratings, agent_id) = next;
        } else {
            table::add(&mut store.ratings, agent_id, next);
        };

        event::emit(RatingUpdated {
            agent_id,
            match_id,
            mu,
            sigma,
            rated_matches,
        });
    }

    public fun remove_rating(store: &mut RatingStore, agent_id: u64) {
        assert!(table::contains(&store.ratings, agent_id), E_RATING_NOT_FOUND);
        let _ = table::remove(&mut store.ratings, agent_id);
    }

    public fun destroy_empty(store: RatingStore) {
        let RatingStore {
            id,
            extension_id: _,
            namespace: _,
            schema_version: _,
            ratings,
        } = store;
        assert!(table::length(&ratings) == 0, E_STORE_NOT_EMPTY);
        table::destroy_empty(ratings);
        object::delete(id);
    }
}
