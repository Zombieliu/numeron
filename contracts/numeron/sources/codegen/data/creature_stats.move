  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::creature_stats {

  use std::ascii::String;

  use numeron::creature_type::CreatureType;

  use numeron::rarity::Rarity;

  use numeron::terrain_type::TerrainType;

  use numeron::battle_result::BattleResult;

  use numeron::weather_type::WeatherType;

  use numeron::region_type::RegionType;

  use numeron::connection_type::ConnectionType;

  public struct CreatureStats has copy, drop, store {
    level: u8,
    hp: u64,
    attack: u64,
    defense: u64,
    speed: u64,
  }

  public fun new(level: u8, hp: u64, attack: u64, defense: u64, speed: u64): CreatureStats {
    CreatureStats {
                                   level,hp,attack,defense,speed
                               }
  }

  public fun get(self: &CreatureStats): (u8,u64,u64,u64,u64) {
    (self.level,self.hp,self.attack,self.defense,self.speed)
  }

  public fun get_level(self: &CreatureStats): u8 {
    self.level
  }

  public fun get_hp(self: &CreatureStats): u64 {
    self.hp
  }

  public fun get_attack(self: &CreatureStats): u64 {
    self.attack
  }

  public fun get_defense(self: &CreatureStats): u64 {
    self.defense
  }

  public fun get_speed(self: &CreatureStats): u64 {
    self.speed
  }

  public(package) fun set_level(self: &mut CreatureStats, level: u8) {
    self.level = level;
  }

  public(package) fun set_hp(self: &mut CreatureStats, hp: u64) {
    self.hp = hp;
  }

  public(package) fun set_attack(self: &mut CreatureStats, attack: u64) {
    self.attack = attack;
  }

  public(package) fun set_defense(self: &mut CreatureStats, defense: u64) {
    self.defense = defense;
  }

  public(package) fun set_speed(self: &mut CreatureStats, speed: u64) {
    self.speed = speed;
  }

  public(package) fun set(self: &mut CreatureStats, level: u8, hp: u64, attack: u64, defense: u64, speed: u64) {
    self.level = level;
    self.hp = hp;
    self.attack = attack;
    self.defense = defense;
    self.speed = speed;
  }
}
