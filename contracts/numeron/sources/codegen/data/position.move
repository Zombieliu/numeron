  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::position {

  use std::ascii::String;

  use numeron::creature_type::CreatureType;

  use numeron::rarity::Rarity;

  use numeron::terrain_type::TerrainType;

  use numeron::battle_result::BattleResult;

  use numeron::weather_type::WeatherType;

  public struct Position has copy, drop, store {
    x: u64,
    y: u64,
    map_id: address,
  }

  public fun new(x: u64, y: u64, map_id: address): Position {
    Position { x, y, map_id }
  }

  public fun get(self: &Position): (u64, u64, address) {
    (self.x, self.y, self.map_id)
  }

  public fun get_x(self: &Position): u64 {
    self.x
  }

  public fun get_y(self: &Position): u64 {
    self.y
  }

  public fun get_map_id(self: &Position): address {
    self.map_id
  }

  public(package) fun set_x(self: &mut Position, x: u64) {
    self.x = x;
  }

  public(package) fun set_y(self: &mut Position, y: u64) {
    self.y = y;
  }

  public(package) fun set_map_id(self: &mut Position, map_id: address) {
    self.map_id = map_id;
  }

  public(package) fun set(self: &mut Position, x: u64, y: u64, map_id: address) {
    self.x = x;
    self.y = y;
    self.map_id = map_id;
  }
}
