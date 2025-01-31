  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::battle_result {

  public enum BattleResult has copy, drop , store {
                                Defeat,Draw,Escape,Victory
                        }

  public fun new_defeat(): BattleResult {
    BattleResult::Defeat
  }

  public fun new_draw(): BattleResult {
    BattleResult::Draw
  }

  public fun new_escape(): BattleResult {
    BattleResult::Escape
  }

  public fun new_victory(): BattleResult {
    BattleResult::Victory
  }
}
