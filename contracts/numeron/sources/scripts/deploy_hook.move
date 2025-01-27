#[allow(lint(share_owned), unused_let_mut)]module numeron::deploy_hook {
  use std::ascii::string;
  use sui::clock::Clock;
  use numeron::terrain_type;
  use numeron::position;
  use numeron::map_config;
  use numeron::events;

  use numeron::dapp_system;

  public entry fun run(clock: &Clock, ctx: &mut TxContext) {
    // Create a dapp.
    let mut dapp = dapp_system::create(string(b"numeron"),string(b"A blockchain-based creature collection game with extensible maps"), clock , ctx);
    // Create schemas
    let mut schema = numeron::schema::create(ctx);
    
    // Create initial map
    let terrain = vector[
        vector[
            terrain_type::new_plain(),
            terrain_type::new_forest(),
            terrain_type::new_mountain()
        ],
        vector[
            terrain_type::new_lake(),
            terrain_type::new_plain(),
            terrain_type::new_cave()
        ],
        vector[
            terrain_type::new_volcano(),
            terrain_type::new_mountain(),
            terrain_type::new_plain()
        ]
    ];
    
    let spawn_points = vector[
        position::new(0, 0, object::id_address(&schema)),
        position::new(2, 2, object::id_address(&schema))
    ];
    
    let map_config = map_config::new(
        3, // width 
        3, // height
        ctx.sender(), // creator
        terrain,
        spawn_points
    );
    
    // Register map in schema
    let map_id = object::id_address(&schema);
    schema.map_registry().set(map_id, true);
    schema.map_config().set(map_id, map_config);
    
    // Emit map created event
    events::map_created_event(map_id, ctx.sender(), map_config);
    
    // Authorize schemas and public share objects
    dapp.add_schema(schema);
    sui::transfer::public_share_object(dapp);
  }
}
