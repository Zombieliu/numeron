#[test_only]module numeron::battle_initiated_event {

  use sui::event;

  use std::ascii::String;

  use numeron::creature_type::CreatureType;

  use numeron::rarity::Rarity;

  use numeron::terrain_type::TerrainType;

  use numeron::battle_result::BattleResult;

  use numeron::weather_type::WeatherType;

  use numeron::position::Position;

  use numeron::creature_stats::CreatureStats;

  use numeron::map_config::MapConfig;

  use numeron::extension_data::ExtensionData;

  public struct BattleInitiatedEvent has copy, drop {
    battle_id: address,
    creature1: address,
    creature2: address,
    map_id: address,
  }

  public fun new(battle_id: address, creature1: address, creature2: address, map_id: address): BattleInitiatedEvent {
    BattleInitiatedEvent {
                                   battle_id,creature1,creature2,map_id
                               }
  }
}
