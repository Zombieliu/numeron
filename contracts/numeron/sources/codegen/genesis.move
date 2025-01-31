#[allow(lint(share_owned))]module numeron::genesis {

  use std::ascii::string;

  use sui::clock::Clock;

  use numeron::dapp_system;

  public entry fun run(clock: &Clock, ctx: &mut TxContext) {
    // Create a dapp.
    let mut dapp = dapp_system::create(string(b"numeron"),string(b"A blockchain-based creature collection game with extensible maps"), clock , ctx);
    // Create schemas
    let mut schema = numeron::schema::create(ctx);
    // Logic that needs to be automated once the contract is deployed
    numeron::deploy_hook::run(&mut schema, ctx);
    // Authorize schemas and public share objects
    dapp.add_schema(schema);
    sui::transfer::public_share_object(dapp);
  }
}
