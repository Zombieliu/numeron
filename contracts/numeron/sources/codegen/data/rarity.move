  // Copyright (c) Obelisk Labs, Inc.
  // SPDX-License-Identifier: Apache-2.0
  #[allow(unused_use)]
  
  /* Autogenerated file. Do not edit manually. */
  
  module numeron::rarity {

  public enum Rarity has copy, drop , store {
                                Common,Epic,Legendary,Rare,Uncommon
                        }

  public fun new_common(): Rarity {
    Rarity::Common
  }

  public fun new_epic(): Rarity {
    Rarity::Epic
  }

  public fun new_legendary(): Rarity {
    Rarity::Legendary
  }

  public fun new_rare(): Rarity {
    Rarity::Rare
  }

  public fun new_uncommon(): Rarity {
    Rarity::Uncommon
  }
}
