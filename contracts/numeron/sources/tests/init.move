#[test_only]
module numeron::init_test {
    use sui::test_scenario::{Self, Scenario};
    use sui::clock;
    use numeron::dapp_schema::Dapp;
    use numeron::schema::Schema;
    use numeron::position;
    
    const TEST_SENDER: address = @0xCAFE;
    
    #[test]
    fun test_deploy_dapp() {
        let (scenario, dapp, mut schema) = deploy_dapp_for_testing(TEST_SENDER);
        
        // 验证地图配置
        let map_id = object::id_address(&schema);
        assert!(schema.map_registry().contains(map_id), 0);
        
        let map_config = schema.map_config().get(map_id);
        assert!(map_config.get_width() == 3, 0);
        assert!(map_config.get_height() == 3, 0);
        assert!(map_config.get_creator() == TEST_SENDER, 0);
        
        // 验证地形
        let terrain = map_config.get_terrain();
        assert!(vector::length(&terrain) == 3, 0);
        assert!(vector::length(&terrain[0]) == 3, 0);
        
        // 验证出生点
        let spawn_points = map_config.get_spawn_points();
        assert!(vector::length(&spawn_points) == 2, 0);
        assert!(position::get_x(&spawn_points[0]) == 0, 0);
        assert!(position::get_y(&spawn_points[0]) == 0, 0);
        assert!(position::get_x(&spawn_points[1]) == 2, 0);
        assert!(position::get_y(&spawn_points[1]) == 2, 0);
        
        // 清理测试对象
        test_scenario::return_shared(dapp);
        test_scenario::return_shared(schema);
        test_scenario::end(scenario);
    }
    
    public fun deploy_dapp_for_testing(sender: address): (Scenario, Dapp, Schema) {
        let mut scenario = test_scenario::begin(sender);
        let ctx = test_scenario::ctx(&mut scenario);
        let clock = clock::create_for_testing(ctx);
        
        // 部署 dapp
        numeron::deploy_hook::run(&clock, ctx);
        clock::destroy_for_testing(clock);
        
        test_scenario::next_tx(&mut scenario, sender);
        
        // 获取共享对象
        let dapp = test_scenario::take_shared<Dapp>(&scenario);
        let schema = test_scenario::take_shared<Schema>(&scenario);
        
        (scenario, dapp, schema)
    }
}
