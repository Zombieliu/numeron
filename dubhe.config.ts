import { DubheConfig } from '@0xobelisk/sui-common';

export const dubheConfig = {
  name: 'numeron',
  description: 'A blockchain-based creature collection game with extensible maps',
  
  // 枚举类型定义
  data: {
    CreatureType: ["None", "Fire", "Water", "Earth", "Wind", "Light", "Dark"],
    Rarity: ["Common", "Uncommon", "Rare", "Epic", "Legendary"],
    TerrainType: ["Plain", "Forest", "Mountain", "Lake", "Volcano", "Cave"],
    BattleResult: ["Victory", "Defeat", "Draw", "Escape"],
    WeatherType: ["Clear", "Rain", "Storm", "Sunny", "Foggy"],
    
    // 结构体定义
    Position: {
      x: "u64",
      y: "u64",
      map_id: "address"
    },
    
    CreatureStats: {
      level: "u8",
      hp: "u64",
      attack: "u64",
      defense: "u64",
      speed: "u64"
    },
    
    MapConfig: {
      width: "u64",
      height: "u64",
      creator: "address",
      terrain: "vector<vector<TerrainType>>",
      spawn_points: "vector<Position>"
    },
    
    ExtensionData: {
      name: "String",
      version: "u64",
      data: "vector<u8>"
    }
  },

  // 错误定义
  errors: {
    NotOwner: "Not the owner of this creature",
    InvalidMove: "Invalid movement",
    MapNotFound: "Map does not exist",
    CreatureNotFound: "Creature does not exist",
    InsufficientLevel: "Creature level too low",
    AlreadyRegistered: "Already registered",
    InvalidExtension: "Invalid extension data",
    UnauthorizedCreator: "Unauthorized map creator"
  },

  // 事件定义
  events: {
    CreatureSpawned: {
      creature_id: 'address',
      creature_type: 'CreatureType',
      position: 'Position'
    },
    BattleInitiated: {
      battle_id: 'address',
      creature1: 'address',
      creature2: 'address',
      map_id: 'address'
    },
    MapCreated: {
      map_id: 'address',
      creator: 'address',
      config: 'MapConfig'
    },
    ExtensionRegistered: {
      extension_id: 'address',
      creator: 'address',
      name: 'String'
    }
  },

  // 存储模式定义
  schemas: {
    // 生物相关存储
    creature: 'StorageMap<address, CreatureType>',
    creature_stats: 'StorageMap<address, CreatureStats>',
    creature_owner: 'StorageMap<address, address>',
    
    // 地图相关存储
    map_registry: 'StorageMap<address, bool>',
    map_config: 'StorageMap<address, MapConfig>',
    map_extensions: 'StorageMap<address, vector<ExtensionData>>',
    
    // 位置相关存储
    position: 'StorageMap<address, Position>',
    terrain: 'StorageMap<address, TerrainType>',
    
    // 玩家相关存储
    player: 'StorageMap<address, bool>',
    player_creatures: 'StorageMap<address, vector<address>>',
    player_current_map: 'StorageMap<address, address>',
    
    // 战斗相关存储
    battle_state: 'StorageMap<address, BattleResult>',
    battle_participants: 'StorageMap<address, vector<address>>',
    
    // 扩展相关存储
    extension_registry: 'StorageMap<address, bool>',
    extension_creator: 'StorageMap<address, address>',
    extension_data: 'StorageMap<address, ExtensionData>'
  }
} as DubheConfig;