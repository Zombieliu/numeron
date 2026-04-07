use crate::GameState;
use crate::web_bridge::{RuntimeCommand, take_runtime_commands};
use bevy::prelude::*;

pub struct StarterScenePlugin;

const BOARD_ROWS: usize = 4;
const BOARD_COLS: usize = 6;
const CELL_SIZE: f32 = 140.0;
const CELL_PADDING: f32 = 16.0;
const UNIT_SIZE_RATIO: f32 = 0.64;
const SHOP_SIZE: usize = 3;
const BENCH_CAPACITY: usize = 4;
const BUY_COST: u32 = 3;
const REROLL_COST: u32 = 1;
const SELL_VALUE_BASE: u32 = 2;
const STARTING_GOLD: u32 = 6;
const STARTING_HEALTH: u32 = 20;
const ROUND_INCOME: u32 = 4;
const COMBAT_INTERVAL: f32 = 0.7;
const TRAIT_THRESHOLD: usize = 2;
const MAX_STARS: u8 = 3;

const PLAYER_SLOTS: [(usize, usize); 4] = [(0, 1), (1, 1), (2, 1), (3, 1)];
const ENEMY_SLOTS: [(usize, usize); 3] = [(0, 4), (1, 4), (2, 4)];

#[derive(Resource, Clone, Debug)]
pub struct BoardConfig {
    pub rows: usize,
    pub cols: usize,
    pub cell_size: f32,
    pub origin: Vec2,
}

impl Default for BoardConfig {
    fn default() -> Self {
        let width = CELL_SIZE * BOARD_COLS as f32;
        let height = CELL_SIZE * BOARD_ROWS as f32;

        Self {
            rows: BOARD_ROWS,
            cols: BOARD_COLS,
            cell_size: CELL_SIZE,
            origin: Vec2::new(
                -width * 0.5 + CELL_SIZE * 0.5,
                -height * 0.5 + CELL_SIZE * 0.5,
            ),
        }
    }
}

#[derive(Resource, Clone, Debug)]
pub struct CombatState {
    pub phase: CombatPhase,
    pub round: u32,
    pub player_health: u32,
    pub enemy_health: u32,
    pub gold: u32,
    pub score: u32,
    pub player_units: usize,
    pub enemy_units: usize,
    pub status: String,
}

impl Default for CombatState {
    fn default() -> Self {
        Self {
            phase: CombatPhase::Preparation,
            round: 1,
            player_health: STARTING_HEALTH,
            enemy_health: STARTING_HEALTH,
            gold: STARTING_GOLD,
            score: 0,
            player_units: 0,
            enemy_units: 0,
            status: "Board ready. Draft another unit or start combat.".to_owned(),
        }
    }
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeUnitView {
    pub label: String,
    pub archetype: String,
    pub faction: String,
    pub role: String,
    pub stars: u8,
    pub attack: u32,
    pub health: u32,
    pub sell_value: u32,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeTraitView {
    pub key: String,
    pub label: String,
    pub count: usize,
    pub threshold: usize,
    pub description: String,
    pub active: bool,
}

#[derive(Resource, Clone, Debug)]
pub struct StarterSliceProjection {
    pub phase: String,
    pub objective: String,
    pub status: String,
    pub score: u32,
    pub gold: u32,
    pub player_health: u32,
    pub enemy_health: u32,
    pub captured: usize,
    pub total: usize,
    pub round: u32,
    pub reroll_cost: u32,
    pub shop_offers: Vec<RuntimeUnitView>,
    pub bench_units: Vec<RuntimeUnitView>,
    pub player_board: Vec<Option<RuntimeUnitView>>,
    pub enemy_board: Vec<Option<RuntimeUnitView>>,
    pub active_traits: Vec<RuntimeTraitView>,
    pub bench_capacity: usize,
    pub board_capacity: usize,
    pub completed: bool,
}

impl Default for StarterSliceProjection {
    fn default() -> Self {
        Self {
            phase: "preparation".to_owned(),
            objective: "Draft a squad, stage units, and survive the first Numeron rounds."
                .to_owned(),
            status: "Waiting for board allocation.".to_owned(),
            score: 0,
            gold: 0,
            player_health: STARTING_HEALTH,
            enemy_health: STARTING_HEALTH,
            captured: 0,
            total: 0,
            round: 1,
            reroll_cost: REROLL_COST,
            shop_offers: Vec::new(),
            bench_units: Vec::new(),
            player_board: vec![None; PLAYER_SLOTS.len()],
            enemy_board: vec![None; ENEMY_SLOTS.len()],
            active_traits: Vec::new(),
            bench_capacity: BENCH_CAPACITY,
            board_capacity: PLAYER_SLOTS.len(),
            completed: false,
        }
    }
}

#[derive(Resource, Default)]
struct ShopState {
    offers: Vec<UnitInstance>,
    reroll_cursor: usize,
}

#[derive(Resource, Default)]
struct PlayerSquad {
    board: [Option<UnitInstance>; PLAYER_SLOTS.len()],
    bench: Vec<UnitInstance>,
}

#[derive(Resource, Default)]
struct EnemySquad {
    units: Vec<UnitInstance>,
}

#[derive(Resource)]
struct CombatTickTimer(Timer);

impl Default for CombatTickTimer {
    fn default() -> Self {
        Self(Timer::from_seconds(COMBAT_INTERVAL, TimerMode::Repeating))
    }
}

#[derive(Component)]
pub struct BoardAnchor;

#[derive(Component)]
struct BoardTile;

#[derive(Component)]
struct UnitEntity {
    owner: UnitOwner,
    health: i32,
    max_health: i32,
    attack: u32,
}

#[derive(Component)]
struct UnitHealthFrame;

#[derive(Component)]
struct UnitHealthFill;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CombatPhase {
    Preparation,
    Combat,
    Resolution,
}

impl CombatPhase {
    fn as_str(self) -> &'static str {
        match self {
            CombatPhase::Preparation => "preparation",
            CombatPhase::Combat => "combat",
            CombatPhase::Resolution => "resolution",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitOwner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitFaction {
    Dawn,
    Dusk,
}

impl UnitFaction {
    fn key(self) -> &'static str {
        match self {
            UnitFaction::Dawn => "dawn",
            UnitFaction::Dusk => "dusk",
        }
    }

    fn label(self) -> &'static str {
        match self {
            UnitFaction::Dawn => "Dawn Circuit",
            UnitFaction::Dusk => "Dusk Bastion",
        }
    }

    fn description(self) -> &'static str {
        match self {
            UnitFaction::Dawn => "2 deployed Dawn units: Dawn allies gain +1 attack.",
            UnitFaction::Dusk => "2 deployed Dusk units: Dusk allies gain +2 health.",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitRole {
    Vanguard,
    Skirmisher,
}

impl UnitRole {
    fn key(self) -> &'static str {
        match self {
            UnitRole::Vanguard => "vanguard",
            UnitRole::Skirmisher => "skirmisher",
        }
    }

    fn label(self) -> &'static str {
        match self {
            UnitRole::Vanguard => "Vanguard Line",
            UnitRole::Skirmisher => "Skirmisher Line",
        }
    }

    fn description(self) -> &'static str {
        match self {
            UnitRole::Vanguard => "2 deployed Vanguards: all allies gain +2 health.",
            UnitRole::Skirmisher => "2 deployed Skirmishers: all allies gain +1 attack.",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitArchetype {
    VerdantBruiser,
    SignalRanger,
    AshDuelist,
    IronVanguard,
}

impl UnitArchetype {
    fn all() -> [Self; 4] {
        [
            Self::VerdantBruiser,
            Self::SignalRanger,
            Self::AshDuelist,
            Self::IronVanguard,
        ]
    }

    fn key(self) -> &'static str {
        match self {
            Self::VerdantBruiser => "verdant-bruiser",
            Self::SignalRanger => "signal-ranger",
            Self::AshDuelist => "ash-duelist",
            Self::IronVanguard => "iron-vanguard",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::VerdantBruiser => "Verdant Bruiser",
            Self::SignalRanger => "Signal Ranger",
            Self::AshDuelist => "Ash Duelist",
            Self::IronVanguard => "Iron Vanguard",
        }
    }

    fn faction(self) -> UnitFaction {
        match self {
            Self::VerdantBruiser | Self::SignalRanger => UnitFaction::Dawn,
            Self::AshDuelist | Self::IronVanguard => UnitFaction::Dusk,
        }
    }

    fn role(self) -> UnitRole {
        match self {
            Self::VerdantBruiser | Self::IronVanguard => UnitRole::Vanguard,
            Self::SignalRanger | Self::AshDuelist => UnitRole::Skirmisher,
        }
    }

    fn color(self, owner: UnitOwner) -> Color {
        match (self, owner) {
            (Self::VerdantBruiser, UnitOwner::Player) => Color::linear_rgba(0.30, 0.83, 0.79, 0.98),
            (Self::SignalRanger, UnitOwner::Player) => Color::linear_rgba(0.32, 0.62, 0.93, 0.98),
            (Self::AshDuelist, UnitOwner::Enemy) => Color::linear_rgba(0.94, 0.41, 0.58, 0.98),
            (Self::IronVanguard, UnitOwner::Enemy) => Color::linear_rgba(0.82, 0.30, 0.35, 0.98),
            (archetype, UnitOwner::Player) => archetype.color(UnitOwner::Enemy),
            (archetype, UnitOwner::Enemy) => archetype.color(UnitOwner::Player),
        }
    }

    fn base_health(self) -> i32 {
        match self {
            Self::VerdantBruiser => 15,
            Self::SignalRanger => 10,
            Self::AshDuelist => 12,
            Self::IronVanguard => 16,
        }
    }

    fn base_attack(self) -> u32 {
        match self {
            Self::VerdantBruiser => 4,
            Self::SignalRanger => 5,
            Self::AshDuelist => 4,
            Self::IronVanguard => 3,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct UnitInstance {
    archetype: UnitArchetype,
    stars: u8,
}

impl UnitInstance {
    fn new(archetype: UnitArchetype) -> Self {
        Self {
            archetype,
            stars: 1,
        }
    }

    fn label(self) -> String {
        format!("{} {}", self.archetype.label(), star_badge(self.stars))
    }

    fn sell_value(self) -> u32 {
        SELL_VALUE_BASE * self.stars as u32
    }

    fn base_view(self) -> RuntimeUnitView {
        let stats = scaled_stats(self);
        RuntimeUnitView {
            label: self.label(),
            archetype: self.archetype.key().to_owned(),
            faction: self.archetype.faction().key().to_owned(),
            role: self.archetype.role().key().to_owned(),
            stars: self.stars,
            attack: stats.attack,
            health: stats.max_health.max(1) as u32,
            sell_value: self.sell_value(),
        }
    }

    fn resolved_view(self, buffs: TraitBuffs) -> RuntimeUnitView {
        let stats = resolved_stats(self, buffs);
        RuntimeUnitView {
            attack: stats.attack,
            health: stats.max_health.max(1) as u32,
            ..self.base_view()
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct TraitBuffs {
    dawn_active: bool,
    dusk_active: bool,
    vanguard_active: bool,
    skirmisher_active: bool,
}

#[derive(Clone, Copy, Debug)]
struct UnitStats {
    attack: u32,
    max_health: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitLocation {
    Board(usize),
    Bench(usize),
}

impl Plugin for StarterScenePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BoardConfig>()
            .init_resource::<CombatState>()
            .init_resource::<StarterSliceProjection>()
            .init_resource::<ShopState>()
            .init_resource::<PlayerSquad>()
            .init_resource::<EnemySquad>()
            .init_resource::<CombatTickTimer>()
            .add_systems(OnEnter(GameState::Playing), setup_board_scene)
            .add_systems(
                Update,
                (
                    handle_runtime_commands,
                    run_combat_tick,
                    update_unit_health_bars,
                )
                    .run_if(in_state(GameState::Playing)),
            );
    }
}

fn setup_board_scene(
    mut commands: Commands,
    board: Res<BoardConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
    mut player_squad: ResMut<PlayerSquad>,
    mut enemy_squad: ResMut<EnemySquad>,
    mut combat_timer: ResMut<CombatTickTimer>,
) {
    commands.spawn((Camera2d, Name::new("RuntimeCamera")));
    commands.spawn((
        BoardAnchor,
        Name::new("BoardAnchor"),
        Transform::default(),
        GlobalTransform::default(),
    ));

    let board_width = board.cols as f32 * board.cell_size;
    let board_height = board.rows as f32 * board.cell_size;

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.04, 0.06, 0.09, 0.98),
            Vec2::new(board_width + 120.0, board_height + 120.0),
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -12.0)),
        Name::new("BoardBackdrop"),
    ));

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.07, 0.11, 0.16, 1.0),
            Vec2::new(board_width + 24.0, board_height + 24.0),
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -10.0)),
        Name::new("BoardPlate"),
    ));

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.22, 0.78, 0.64, 0.18),
            Vec2::new(6.0, board_height + 32.0),
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -8.0)),
        Name::new("MidLine"),
    ));

    for row in 0..board.rows {
        for col in 0..board.cols {
            commands.spawn((
                Sprite::from_color(
                    tile_color(row, col),
                    Vec2::splat(board.cell_size - CELL_PADDING),
                ),
                Transform::from_translation(board_to_world(&board, row, col).extend(-4.0)),
                BoardTile,
                Name::new("BoardTile"),
            ));
        }
    }

    *combat = CombatState::default();
    combat_timer.0.reset();

    player_squad.board = [None; PLAYER_SLOTS.len()];
    player_squad.bench = vec![UnitInstance::new(UnitArchetype::VerdantBruiser)];
    enemy_squad.units = seed_enemy_squad(1);
    reroll_shop(&mut shop, combat.round);
    combat.status = "Bench primed. Deploy a unit before opening combat.".to_owned();
    spawn_round_units(
        &mut commands,
        &board,
        &player_squad,
        &enemy_squad,
        &mut combat,
    );
    update_projection_from_state(&combat, &shop, &player_squad, &enemy_squad, &mut projection);
}

fn handle_runtime_commands(
    mut commands: Commands,
    board: Res<BoardConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
    mut player_squad: ResMut<PlayerSquad>,
    mut enemy_squad: ResMut<EnemySquad>,
    units: Query<Entity, With<UnitEntity>>,
    mut combat_timer: ResMut<CombatTickTimer>,
) {
    let commands_to_apply = take_runtime_commands();
    if commands_to_apply.is_empty() {
        return;
    }

    let mut needs_respawn = false;

    for runtime_command in commands_to_apply {
        match runtime_command {
            RuntimeCommand::StartCombat => {
                if combat.phase == CombatPhase::Preparation
                    && combat.player_units > 0
                    && combat.enemy_units > 0
                {
                    combat.phase = CombatPhase::Combat;
                    combat.status = format!(
                        "Combat started. {} allied units engage {} enemies.",
                        combat.player_units, combat.enemy_units
                    );
                    combat_timer.0.reset();
                }
            }
            RuntimeCommand::ResetRound => {
                if combat.phase == CombatPhase::Resolution {
                    combat.round += 1;
                    combat.phase = CombatPhase::Preparation;
                    combat.gold += ROUND_INCOME;
                    enemy_squad.units = seed_enemy_squad(combat.round);
                    reroll_shop(&mut shop, combat.round);
                    combat.status = format!(
                        "Round {} ready. Draft, merge, or reposition before combat.",
                        combat.round
                    );
                    needs_respawn = true;
                }
            }
            RuntimeCommand::RerollShop => {
                if combat.phase == CombatPhase::Preparation && combat.gold >= REROLL_COST {
                    combat.gold -= REROLL_COST;
                    reroll_shop(&mut shop, combat.round + 1);
                    combat.status = "Shop rerolled. Draft before combat starts.".to_owned();
                }
            }
            RuntimeCommand::BuyOffer(index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.gold < BUY_COST
                    || player_squad.bench.len() >= BENCH_CAPACITY
                    || index >= shop.offers.len()
                {
                    continue;
                }

                let purchased = shop.offers[index];
                player_squad.bench.push(purchased);
                combat.gold -= BUY_COST;
                let merge_messages = normalize_player_squad(&mut player_squad);
                combat.status = merge_messages_for(
                    format!(
                        "Drafted {} to bench. Bench now holds {} units.",
                        purchased.label(),
                        player_squad.bench.len()
                    ),
                    &merge_messages,
                );
                reroll_shop(&mut shop, combat.round + index as u32 + 2);
                needs_respawn = true;
            }
            RuntimeCommand::DeployBenchToBoard {
                bench_index,
                slot_index,
            } => {
                if combat.phase != CombatPhase::Preparation
                    || slot_index >= player_squad.board.len()
                    || bench_index >= player_squad.bench.len()
                    || player_squad.board[slot_index].is_some()
                {
                    continue;
                }

                let deployed = player_squad.bench.remove(bench_index);
                player_squad.board[slot_index] = Some(deployed);
                let merge_messages = normalize_player_squad(&mut player_squad);
                combat.status = merge_messages_for(
                    format!(
                        "Deployed {} into slot {}.",
                        deployed.label(),
                        slot_index + 1
                    ),
                    &merge_messages,
                );
                needs_respawn = true;
            }
            RuntimeCommand::WithdrawBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || slot_index >= player_squad.board.len()
                    || player_squad.bench.len() >= BENCH_CAPACITY
                {
                    continue;
                }

                let Some(withdrawn) = player_squad.board[slot_index].take() else {
                    continue;
                };

                player_squad.bench.push(withdrawn);
                let merge_messages = normalize_player_squad(&mut player_squad);
                combat.status = merge_messages_for(
                    format!(
                        "Returned {} to bench from slot {}.",
                        withdrawn.label(),
                        slot_index + 1
                    ),
                    &merge_messages,
                );
                needs_respawn = true;
            }
            RuntimeCommand::SellBenchUnit(bench_index) => {
                if combat.phase != CombatPhase::Preparation
                    || bench_index >= player_squad.bench.len()
                {
                    continue;
                }

                let sold = player_squad.bench.remove(bench_index);
                combat.gold += sold.sell_value();
                combat.status = format!("Sold {} for {} gold.", sold.label(), sold.sell_value());
            }
            RuntimeCommand::SellBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || slot_index >= player_squad.board.len()
                {
                    continue;
                }

                let Some(sold) = player_squad.board[slot_index].take() else {
                    continue;
                };

                combat.gold += sold.sell_value();
                combat.status = format!(
                    "Sold {} from slot {} for {} gold.",
                    sold.label(),
                    slot_index + 1,
                    sold.sell_value()
                );
                needs_respawn = true;
            }
        }
    }

    if needs_respawn {
        despawn_units(&mut commands, units.iter());
        spawn_round_units(
            &mut commands,
            &board,
            &player_squad,
            &enemy_squad,
            &mut combat,
        );
    }

    update_projection_from_state(&combat, &shop, &player_squad, &enemy_squad, &mut projection);
}

fn run_combat_tick(
    mut commands: Commands,
    time: Res<Time>,
    board: Res<BoardConfig>,
    mut combat: ResMut<CombatState>,
    player_squad: Res<PlayerSquad>,
    enemy_squad: Res<EnemySquad>,
    mut projection: ResMut<StarterSliceProjection>,
    shop: Res<ShopState>,
    mut timer: ResMut<CombatTickTimer>,
    mut unit_queries: ParamSet<(Query<(Entity, &UnitEntity)>, Query<&mut UnitEntity>)>,
) {
    if combat.phase != CombatPhase::Combat {
        return;
    }

    timer.0.tick(time.delta());
    if !timer.0.just_finished() {
        return;
    }

    let mut player_entities = Vec::new();
    let mut enemy_entities = Vec::new();

    for (entity, unit) in &unit_queries.p0() {
        match unit.owner {
            UnitOwner::Player => player_entities.push((entity, unit.health, unit.attack)),
            UnitOwner::Enemy => enemy_entities.push((entity, unit.health, unit.attack)),
        }
    }

    player_entities.sort_by_key(|(_, health, _)| *health);
    enemy_entities.sort_by_key(|(_, health, _)| *health);

    if let (Some((_, _, player_attack)), Some((enemy_target, _, _))) =
        (player_entities.first(), enemy_entities.first())
        && let Ok(mut unit) = unit_queries.p1().get_mut(*enemy_target)
    {
        unit.health -= *player_attack as i32;
    }

    if let (Some((_, _, enemy_attack)), Some((player_target, _, _))) =
        (enemy_entities.first(), player_entities.first())
        && let Ok(mut unit) = unit_queries.p1().get_mut(*player_target)
    {
        unit.health -= *enemy_attack as i32;
    }

    let post_units = unit_queries
        .p0()
        .iter()
        .map(|(entity, unit)| (entity, unit.owner, unit.health))
        .collect::<Vec<_>>();

    let mut defeated = Vec::new();
    combat.player_units = 0;
    combat.enemy_units = 0;

    for (entity, owner, health) in post_units {
        if health <= 0 {
            defeated.push((entity, owner));
        } else {
            match owner {
                UnitOwner::Player => combat.player_units += 1,
                UnitOwner::Enemy => combat.enemy_units += 1,
            }
        }
    }

    for (entity, owner) in defeated {
        if owner == UnitOwner::Enemy {
            combat.score += 20;
        }
        commands.entity(entity).despawn();
    }

    if combat.player_units == 0 || combat.enemy_units == 0 {
        combat.phase = CombatPhase::Resolution;
        if combat.enemy_units == 0 {
            combat.score += 80;
            combat.gold += 2;
            combat.enemy_health = combat.enemy_health.saturating_sub(2);
            combat.status = format!(
                "Victory. Enemy board collapsed. Click Next Round to continue to round {}.",
                combat.round + 1
            );
        } else {
            combat.player_health = combat
                .player_health
                .saturating_sub(combat.enemy_units.max(1) as u32 * 2);
            combat.status = format!(
                "Defeat. {} enemies survived. Click Next Round to rebuild.",
                combat.enemy_units
            );
        }

        let entities = unit_queries
            .p0()
            .iter()
            .map(|(entity, _)| entity)
            .collect::<Vec<_>>();
        despawn_units(&mut commands, entities.into_iter());
        spawn_round_units(
            &mut commands,
            &board,
            &player_squad,
            &enemy_squad,
            &mut combat,
        );
    } else {
        combat.status = format!(
            "Combat underway. {} allied units vs {} enemies.",
            combat.player_units, combat.enemy_units
        );
    }

    update_projection_from_state(&combat, &shop, &player_squad, &enemy_squad, &mut projection);
}

fn update_unit_health_bars(
    units: Query<&UnitEntity>,
    mut bars: Query<(&mut Sprite, &ChildOf), With<UnitHealthFill>>,
    board: Res<BoardConfig>,
) {
    for (mut sprite, parent) in &mut bars {
        if let Ok(unit) = units.get(parent.parent()) {
            let width = board.cell_size
                * 0.46
                * (unit.health.max(0) as f32 / unit.max_health.max(1) as f32);
            sprite.custom_size = Some(Vec2::new(width.max(8.0), 10.0));
        }
    }
}

fn update_projection_from_state(
    combat: &CombatState,
    shop: &ShopState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());

    projection.phase = combat.phase.as_str().to_owned();
    projection.objective =
        "Draft a compact squad, merge duplicates, and survive the first Numeron rounds.".to_owned();
    projection.status = combat.status.clone();
    projection.score = combat.score;
    projection.gold = combat.gold;
    projection.player_health = combat.player_health;
    projection.enemy_health = combat.enemy_health;
    projection.captured = combat.player_units;
    projection.total = combat.player_units + combat.enemy_units;
    projection.round = combat.round;
    projection.reroll_cost = REROLL_COST;
    projection.shop_offers = shop
        .offers
        .iter()
        .copied()
        .map(UnitInstance::base_view)
        .collect();
    projection.bench_units = player_squad
        .bench
        .iter()
        .copied()
        .map(UnitInstance::base_view)
        .collect();
    projection.player_board = player_squad
        .board
        .iter()
        .copied()
        .map(|unit| unit.map(|unit| unit.resolved_view(player_buffs)))
        .collect();
    projection.enemy_board = enemy_squad
        .units
        .iter()
        .copied()
        .map(|unit| Some(unit.resolved_view(enemy_buffs)))
        .chain(std::iter::repeat(None::<RuntimeUnitView>))
        .take(ENEMY_SLOTS.len())
        .collect();
    projection.active_traits =
        trait_views_for(player_squad.board.iter().flatten().copied()).collect();
    projection.bench_capacity = BENCH_CAPACITY;
    projection.board_capacity = PLAYER_SLOTS.len();
    projection.completed = combat.phase == CombatPhase::Resolution;
}

fn spawn_round_units(
    commands: &mut Commands,
    board: &BoardConfig,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    combat: &mut CombatState,
) {
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());

    combat.player_units = 0;
    combat.enemy_units = 0;

    for (index, maybe_unit) in player_squad.board.iter().copied().enumerate() {
        let Some(unit) = maybe_unit else {
            continue;
        };

        if let Some(&(row, col)) = PLAYER_SLOTS.get(index) {
            spawn_unit(
                commands,
                board,
                UnitOwner::Player,
                unit,
                resolved_stats(unit, player_buffs),
                row,
                col,
            );
            combat.player_units += 1;
        }
    }

    for (index, unit) in enemy_squad.units.iter().copied().enumerate() {
        if let Some(&(row, col)) = ENEMY_SLOTS.get(index) {
            spawn_unit(
                commands,
                board,
                UnitOwner::Enemy,
                unit,
                resolved_stats(unit, enemy_buffs),
                row,
                col,
            );
            combat.enemy_units += 1;
        }
    }
}

fn spawn_unit(
    commands: &mut Commands,
    board: &BoardConfig,
    owner: UnitOwner,
    unit: UnitInstance,
    stats: UnitStats,
    row: usize,
    col: usize,
) {
    let translation = board_to_world(board, row, col);

    commands
        .spawn((
            Sprite::from_color(
                unit.archetype.color(owner),
                Vec2::splat(board.cell_size * UNIT_SIZE_RATIO),
            ),
            Transform::from_translation(translation.extend(2.0)),
            UnitEntity {
                owner,
                health: stats.max_health,
                max_health: stats.max_health,
                attack: stats.attack,
            },
            Name::new(unit.label()),
        ))
        .with_children(|parent| {
            parent.spawn((
                Sprite::from_color(
                    Color::linear_rgba(0.02, 0.03, 0.05, 0.92),
                    Vec2::new(board.cell_size * 0.48, 12.0),
                ),
                Transform::from_translation(Vec3::new(0.0, board.cell_size * 0.34, 2.0)),
                UnitHealthFrame,
                Name::new("UnitHealthFrame"),
            ));

            parent.spawn((
                Sprite::from_color(
                    match owner {
                        UnitOwner::Player => Color::linear_rgba(0.38, 0.88, 0.72, 0.96),
                        UnitOwner::Enemy => Color::linear_rgba(0.97, 0.43, 0.55, 0.96),
                    },
                    Vec2::new(board.cell_size * 0.46, 10.0),
                ),
                Transform::from_translation(Vec3::new(0.0, board.cell_size * 0.34, 3.0)),
                UnitHealthFill,
                Name::new("UnitHealthFill"),
            ));
        });
}

fn despawn_units(commands: &mut Commands, units: impl Iterator<Item = Entity>) {
    for entity in units {
        commands.entity(entity).despawn();
    }
}

fn reroll_shop(shop: &mut ShopState, round_seed: u32) {
    let pool = UnitArchetype::all();
    let start = (shop.reroll_cursor + round_seed as usize) % pool.len();
    shop.offers = (0..SHOP_SIZE)
        .map(|offset| UnitInstance::new(pool[(start + offset) % pool.len()]))
        .collect();
    shop.reroll_cursor = (shop.reroll_cursor + 1) % pool.len();
}

fn seed_enemy_squad(round: u32) -> Vec<UnitInstance> {
    let mut units = vec![
        UnitInstance::new(UnitArchetype::AshDuelist),
        UnitInstance::new(UnitArchetype::IronVanguard),
    ];

    if round >= 2 {
        units.push(UnitInstance::new(UnitArchetype::AshDuelist));
    }

    if round >= 4 {
        units[1].stars = 2;
    }

    units.truncate(ENEMY_SLOTS.len());
    units
}

fn normalize_player_squad(player_squad: &mut PlayerSquad) -> Vec<String> {
    let mut messages = Vec::new();

    loop {
        let mut merged_any = false;

        for archetype in UnitArchetype::all() {
            for stars in 1..MAX_STARS {
                loop {
                    let matches = matching_locations(player_squad, archetype, stars);
                    if matches.len() < 3 {
                        break;
                    }

                    let consumed = matches.into_iter().take(3).collect::<Vec<_>>();
                    let anchor_board = consumed.iter().find_map(|location| match location {
                        UnitLocation::Board(index) => Some(*index),
                        UnitLocation::Bench(_) => None,
                    });

                    remove_locations(player_squad, &consumed);

                    let upgraded = UnitInstance {
                        archetype,
                        stars: stars + 1,
                    };

                    if let Some(slot_index) = anchor_board {
                        player_squad.board[slot_index] = Some(upgraded);
                    } else {
                        player_squad.bench.push(upgraded);
                    }

                    messages.push(format!(
                        "Merged three {} copies into {}.",
                        archetype.label(),
                        upgraded.label()
                    ));
                    merged_any = true;
                }
            }
        }

        if !merged_any {
            break;
        }
    }

    messages
}

fn matching_locations(
    player_squad: &PlayerSquad,
    archetype: UnitArchetype,
    stars: u8,
) -> Vec<UnitLocation> {
    let mut matches = player_squad
        .board
        .iter()
        .enumerate()
        .filter_map(|(index, unit)| match unit {
            Some(unit) if unit.archetype == archetype && unit.stars == stars => {
                Some(UnitLocation::Board(index))
            }
            _ => None,
        })
        .collect::<Vec<_>>();

    matches.extend(
        player_squad
            .bench
            .iter()
            .enumerate()
            .filter_map(|(index, unit)| {
                if unit.archetype == archetype && unit.stars == stars {
                    Some(UnitLocation::Bench(index))
                } else {
                    None
                }
            }),
    );

    matches
}

fn remove_locations(player_squad: &mut PlayerSquad, locations: &[UnitLocation]) {
    for location in locations {
        if let UnitLocation::Board(index) = location {
            player_squad.board[*index] = None;
        }
    }

    let mut bench_indices = locations
        .iter()
        .filter_map(|location| match location {
            UnitLocation::Bench(index) => Some(*index),
            UnitLocation::Board(_) => None,
        })
        .collect::<Vec<_>>();
    bench_indices.sort_unstable_by(|left, right| right.cmp(left));

    for index in bench_indices {
        player_squad.bench.remove(index);
    }
}

fn merge_messages_for(base: String, merge_messages: &[String]) -> String {
    if merge_messages.is_empty() {
        base
    } else {
        format!("{base} {}", merge_messages.join(" "))
    }
}

fn trait_counts(units: impl Iterator<Item = UnitInstance>) -> (usize, usize, usize, usize) {
    let mut dawn = 0;
    let mut dusk = 0;
    let mut vanguard = 0;
    let mut skirmisher = 0;

    for unit in units {
        match unit.archetype.faction() {
            UnitFaction::Dawn => dawn += 1,
            UnitFaction::Dusk => dusk += 1,
        }

        match unit.archetype.role() {
            UnitRole::Vanguard => vanguard += 1,
            UnitRole::Skirmisher => skirmisher += 1,
        }
    }

    (dawn, dusk, vanguard, skirmisher)
}

fn trait_buffs_for(units: impl Iterator<Item = UnitInstance>) -> TraitBuffs {
    let (dawn, dusk, vanguard, skirmisher) = trait_counts(units);

    TraitBuffs {
        dawn_active: dawn >= TRAIT_THRESHOLD,
        dusk_active: dusk >= TRAIT_THRESHOLD,
        vanguard_active: vanguard >= TRAIT_THRESHOLD,
        skirmisher_active: skirmisher >= TRAIT_THRESHOLD,
    }
}

fn trait_views_for(
    units: impl Iterator<Item = UnitInstance>,
) -> impl Iterator<Item = RuntimeTraitView> {
    let (dawn, dusk, vanguard, skirmisher) = trait_counts(units);

    [
        RuntimeTraitView {
            key: UnitFaction::Dawn.key().to_owned(),
            label: UnitFaction::Dawn.label().to_owned(),
            count: dawn,
            threshold: TRAIT_THRESHOLD,
            description: UnitFaction::Dawn.description().to_owned(),
            active: dawn >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitFaction::Dusk.key().to_owned(),
            label: UnitFaction::Dusk.label().to_owned(),
            count: dusk,
            threshold: TRAIT_THRESHOLD,
            description: UnitFaction::Dusk.description().to_owned(),
            active: dusk >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Vanguard.key().to_owned(),
            label: UnitRole::Vanguard.label().to_owned(),
            count: vanguard,
            threshold: TRAIT_THRESHOLD,
            description: UnitRole::Vanguard.description().to_owned(),
            active: vanguard >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Skirmisher.key().to_owned(),
            label: UnitRole::Skirmisher.label().to_owned(),
            count: skirmisher,
            threshold: TRAIT_THRESHOLD,
            description: UnitRole::Skirmisher.description().to_owned(),
            active: skirmisher >= TRAIT_THRESHOLD,
        },
    ]
    .into_iter()
}

fn scaled_stats(unit: UnitInstance) -> UnitStats {
    let star_multiplier = match unit.stars {
        1 => 1.0,
        2 => 1.75,
        _ => 2.5,
    };

    UnitStats {
        attack: (unit.archetype.base_attack() as f32 * star_multiplier).round() as u32,
        max_health: (unit.archetype.base_health() as f32 * star_multiplier).round() as i32,
    }
}

fn resolved_stats(unit: UnitInstance, buffs: TraitBuffs) -> UnitStats {
    let mut stats = scaled_stats(unit);

    if buffs.vanguard_active {
        stats.max_health += 2;
    }

    if buffs.skirmisher_active {
        stats.attack += 1;
    }

    match unit.archetype.faction() {
        UnitFaction::Dawn if buffs.dawn_active => stats.attack += 1,
        UnitFaction::Dusk if buffs.dusk_active => stats.max_health += 2,
        _ => {}
    }

    stats
}

fn star_badge(stars: u8) -> &'static str {
    match stars {
        1 => "I",
        2 => "II",
        _ => "III",
    }
}

fn board_to_world(board: &BoardConfig, row: usize, col: usize) -> Vec2 {
    Vec2::new(
        board.origin.x + col as f32 * board.cell_size,
        board.origin.y + row as f32 * board.cell_size,
    )
}

fn tile_color(row: usize, col: usize) -> Color {
    if col < BOARD_COLS / 2 {
        if (row + col) % 2 == 0 {
            Color::linear_rgba(0.10, 0.18, 0.18, 0.96)
        } else {
            Color::linear_rgba(0.07, 0.14, 0.15, 0.96)
        }
    } else if (row + col) % 2 == 0 {
        Color::linear_rgba(0.17, 0.11, 0.14, 0.96)
    } else {
        Color::linear_rgba(0.14, 0.08, 0.11, 0.96)
    }
}
