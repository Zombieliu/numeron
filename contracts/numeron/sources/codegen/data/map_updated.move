  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::map_updated {

  use std::ascii::String;

  use numeron::creature_type::CreatureType;

  use numeron::rarity::Rarity;

  use numeron::terrain_type::TerrainType;

  use numeron::battle_result::BattleResult;

  use numeron::weather_type::WeatherType;

  use numeron::region_type::RegionType;

  use numeron::connection_type::ConnectionType;

  public struct MapUpdated has copy, drop, store {
    map_id: address,
    old_config: MapConfig,
    new_config: MapConfig,
  }

  public fun new(map_id: address, old_config: MapConfig, new_config: MapConfig): MapUpdated {
    MapUpdated {
                                   map_id,old_config,new_config
                               }
  }

  public fun get(self: &MapUpdated): (address,MapConfig,MapConfig) {
    (self.map_id,self.old_config,self.new_config)
  }

  public fun get_map_id(self: &MapUpdated): address {
    self.map_id
  }

  public fun get_old_config(self: &MapUpdated): MapConfig {
    self.old_config
  }

  public fun get_new_config(self: &MapUpdated): MapConfig {
    self.new_config
  }

  public(package) fun set_map_id(self: &mut MapUpdated, map_id: address) {
    self.map_id = map_id;
  }

  public(package) fun set_old_config(self: &mut MapUpdated, old_config: MapConfig) {
    self.old_config = old_config;
  }

  public(package) fun set_new_config(self: &mut MapUpdated, new_config: MapConfig) {
    self.new_config = new_config;
  }

  public(package) fun set(self: &mut MapUpdated, map_id: address, old_config: MapConfig, new_config: MapConfig) {
    self.map_id = map_id;
    self.old_config = old_config;
    self.new_config = new_config;
  }
}
