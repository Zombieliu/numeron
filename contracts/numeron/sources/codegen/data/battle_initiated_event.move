#[test_only]
module numeron::battle_initiated_event {

  public struct BattleInitiatedEvent has copy, drop {
    battle_id: address,
    creature1: address,
    creature2: address,
    map_id: address,
  }

  public fun new(battle_id: address, creature1: address, creature2: address, map_id: address): BattleInitiatedEvent {
    BattleInitiatedEvent {
      battle_id,
      creature1,
      creature2,
      map_id
    }
  }
}
