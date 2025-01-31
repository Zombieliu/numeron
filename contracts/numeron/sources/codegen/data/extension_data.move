  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::extension_data {

  use std::ascii::String;

  use numeron::creature_type::CreatureType;

  use numeron::rarity::Rarity;

  use numeron::terrain_type::TerrainType;

  use numeron::battle_result::BattleResult;

  use numeron::weather_type::WeatherType;

  use numeron::region_type::RegionType;

  use numeron::connection_type::ConnectionType;

  public struct ExtensionData has copy, drop, store {
    name: String,
    version: u64,
    data: vector<u8>,
  }

  public fun new(name: String, version: u64, data: vector<u8>): ExtensionData {
    ExtensionData {
                                   name,version,data
                               }
  }

  public fun get(self: &ExtensionData): (String,u64,vector<u8>) {
    (self.name,self.version,self.data)
  }

  public fun get_name(self: &ExtensionData): String {
    self.name
  }

  public fun get_version(self: &ExtensionData): u64 {
    self.version
  }

  public fun get_data(self: &ExtensionData): vector<u8> {
    self.data
  }

  public(package) fun set_name(self: &mut ExtensionData, name: String) {
    self.name = name;
  }

  public(package) fun set_version(self: &mut ExtensionData, version: u64) {
    self.version = version;
  }

  public(package) fun set_data(self: &mut ExtensionData, data: vector<u8>) {
    self.data = data;
  }

  public(package) fun set(self: &mut ExtensionData, name: String, version: u64, data: vector<u8>) {
    self.name = name;
    self.version = version;
    self.data = data;
  }
}
