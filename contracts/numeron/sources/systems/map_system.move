module numeron::map_system {
    use numeron::dapp_schema::Dapp;
    use numeron::schema::Schema;
    use numeron::terrain_type::TerrainType;
    use numeron::position::{Self, Position};
    use numeron::map_config;
    use numeron::events;
    use numeron::dapp_system;

    /// 允许第三方包创建地图的公共接口
    public fun create_map(
        dapp: &mut Dapp,
        schema: &mut Schema,
        width: u64,
        height: u64,
        terrain: vector<vector<TerrainType>>,
        spawn_points: vector<Position>,
        ctx: &mut TxContext
    ) {
        // 确保 dapp 不在安全模式
        dapp_system::ensure_no_safe_mode(dapp);
        
        // 验证地图尺寸
        assert!(width > 0 && height > 0, 0);
        assert!(vector::length(&terrain) == height, 0);
        
        // 验证地形数组
        let mut i = 0;
        while (i < height) {
            assert!(vector::length(&terrain[i]) == width, 0);
            i = i + 1;
        };
        
        // 验证出生点
        assert!(vector::length(&spawn_points) > 0, 0);
        let mut i = 0;
        while (i < vector::length(&spawn_points)) {
            let spawn_point = &spawn_points[i];
            assert!(position::get_x(spawn_point) < width && position::get_y(spawn_point) < height, 0);
            i = i + 1;
        };
        
        // 创建地图配置
        let map_config = map_config::new(
            width,
            height,
            tx_context::sender(ctx),
            terrain,
            spawn_points
        );
        
        // 在 schema 中注册地图
        let uid = object::new(ctx);
        let map_id = object::uid_to_address(&uid);
        object::delete(uid);
        
        schema.map_registry().set(map_id, true);
        schema.map_config().set(map_id, map_config);
        
        // 发出地图创建事件
        events::map_created_event(map_id, tx_context::sender(ctx), map_config);
    }
}
