import { DubheConfig } from '@0xobelisk/sui-common';

export const dubheConfig = {
  name: 'numeron',
  description: 'A blockchain-based creature collection game with extensible maps',
  
  // 枚举类型定义
  data: {
    CreatureType: ["None", "Fire", "Water", "Earth", "Wind", "Light", "Dark"],
    Rarity: ["Common", "Uncommon", "Rare", "Epic", "Legendary"],
    TerrainType: [
      "Plain", "Forest", "Mountain", "Lake", "Volcano", "Cave",
      "Desert", "Snow", "Swamp", "City", "Beach", "Sky",
      "Underground", "Custom" // 允许自定义地形
    ],
    BattleResult: ["Victory", "Defeat", "Draw", "Escape"],
    WeatherType: [
      "Clear", "Rain", "Snow", "Storm", "Fog", "Sandstorm", 
      "Sunny", "Cloudy", "Custom"
    ],
    RegionType: [
      "Town", "Wild", "Dungeon", "Gym", "Special", "Custom"
    ],
    ConnectionType: [
      "Path", "Portal", "Gate", "Bridge", "Custom"
    ],
    
    // 结构体定义
    Position: {
      x: "u64",
      y: "u64",
      layer: "u8" // 支持多层地图（地下、地面、空中）
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
      region_type: "RegionType",
      terrain: "vector<vector<TerrainType>>",
      spawn_points: "vector<Position>",
      connection_points: "vector<ConnectionPoint>",
      level_range: "vector<u8>",  // [min_level, max_level]
      weather_conditions: "vector<WeatherType>",
      special_features: "vector<u8>",  // 自定义特性
      metadata: "String"  // JSON格式的额外元数据
    },
    
    ExtensionData: {
      name: "String",
      version: "u64",
      data: "vector<u8>"
    },
    
    // 新增结构体
    ConnectionPoint: {
      // local world 
      position: "Position",
      // connect world poition
      connected_position: "Position",
      // connection_type: "ConnectionType",
      // requirements: "vector<Requirement>"
    },
    
    Requirement: {
      requirement_type: "String",
      value: "vector<u8>"
    },
    
    RegionMetadata: {
      name: "String",
      description: "String",
      version: "u64",
      tags: "vector<String>",
      custom_data: "vector<u8>"
    },
    
    // 事件定义
    MapCreated: {
      map_id: "address",
      creator: "address",
      config: "MapConfig"
    },
    
    MapUpdated: {
      map_id: "address",
      old_config: "MapConfig",
      new_config: "MapConfig"
    },
    
    MapConnected: {
      map_a: "address",
      map_b: "address",
      connection_point: "ConnectionPoint"
    }
  },

  // 错误定义
  errors: {
    // NotOwner: "Not the owner of this creature",
    // InvalidMove: "Invalid movement",
    // MapNotFound: "Map does not exist",
    // CreatureNotFound: "Creature does not exist",
    // InsufficientLevel: "Creature level too low",
    // AlreadyRegistered: "Already registered",
    // InvalidExtension: "Invalid extension data",
    // UnauthorizedCreator: "Unauthorized map creator",
    // InvalidMapConnection: "Invalid map connection point",
    // MapConnectionExists: "Map connection already exists",
    // InvalidRegionType: "Invalid region type",
    // LevelRequirementNotMet: "Player level requirement not met",
    // ConnectionRequirementNotMet: "Connection requirements not met",
    // MapFull: "Map has reached maximum capacity",
    // InvalidMapDimensions: "Invalid map dimensions",
    // InvalidTerrainConfiguration: "Invalid terrain configuration",
    // UnauthorizedMapModification: "Unauthorized map modification",
    // InvalidSpawnPoint: "Invalid spawn point location"
  },

  // 事件定义
  events: {
    // CreatureSpawned: {
    //   creature_id: 'address',
    //   creature_type: 'CreatureType',
    //   position: 'Position'
    // },
    // BattleInitiated: {
    //   battle_id: 'address',
    //   creature1: 'address',
    //   creature2: 'address',
    //   map_id: 'address'
    // },
    // MapRegistered: {
    //   map_id: "address",
    //   creator: "address",
    //   region_type: "RegionType",
    //   metadata: "RegionMetadata"
    // },
    // RegionStateChanged: {
    //   map_id: "address",
    //   weather: "WeatherType",
    //   special_conditions: "vector<u8>"
    // },
    // PlayerEnteredMap: {
    //   player: "address",
    //   from_map: "address",
    //   to_map: "address",
    //   entry_point: "Position"
    // }
  },

  // 存储模式定义
  schemas: {
    // 生物相关存储
    // creature: 'StorageMap<address, CreatureType>',
    // creature_stats: 'StorageMap<address, CreatureStats>',
    // creature_owner: 'StorageMap<address, address>',
    
    // 地图相关存储
    // map_registry: 'StorageMap<address, bool>',
    // map_config: 'StorageMap<address, MapConfig>',
    // package_id -> schema_id 
    map_metadata: 'StorageMap<address, RegionMetadata>',
    // schema_id -> 
    map_connections: 'StorageMap<address, vector<ConnectionPoint>>',
    // map_state: 'StorageMap<address, vector<u8>>',  // 动态地图状态
    
    // 位置相关存储
    // position: 'StorageMap<address, Position>',
    // terrain: 'StorageMap<address, TerrainType>',
    
    // 玩家相关存储
    // player: 'StorageMap<address, bool>',
    // player_creatures: 'StorageMap<address, vector<address>>',
    // player_current_map: 'StorageMap<address, address>',
    
    // 战斗相关存储
    // battle_state: 'StorageMap<address, BattleResult>',
    // battle_participants: 'StorageMap<address, vector<address>>',
    
    // // 扩展相关存储
    // extension_registry: 'StorageMap<address, bool>',
    // extension_creator: 'StorageMap<address, address>',
    // extension_data: 'StorageMap<address, ExtensionData>',
    
    // // 开发者相关存储
    // developer_maps: 'StorageMap<address, vector<address>>',
    // map_permissions: 'StorageMap<address, vector<address>>',
    
    // // 玩家地图交互存储
    // player_discovered_maps: 'StorageMap<address, vector<address>>',
    // player_map_progress: 'StorageMap<address, vector<u8>>',
    // map_visitors: 'StorageMap<address, vector<address>>'
  }
} as DubheConfig;