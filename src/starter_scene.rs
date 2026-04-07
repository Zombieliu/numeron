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
const BUY_COST: u32 = 3;
const REROLL_COST: u32 = 1;
const STARTING_GOLD: u32 = 6;
const STARTING_HEALTH: u32 = 20;
const ROUND_INCOME: u32 = 4;
const COMBAT_INTERVAL: f32 = 0.7;

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
    pub shop_offers: Vec<String>,
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
            completed: false,
        }
    }
}

#[derive(Resource, Default)]
struct ShopState {
    offers: Vec<UnitArchetype>,
    reroll_cursor: usize,
}

#[derive(Resource, Default)]
struct PlayerSquad {
    units: Vec<UnitArchetype>,
}

#[derive(Resource, Default)]
struct EnemySquad {
    units: Vec<UnitArchetype>,
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

    fn label(self) -> &'static str {
        match self {
            Self::VerdantBruiser => "Verdant Bruiser",
            Self::SignalRanger => "Signal Ranger",
            Self::AshDuelist => "Ash Duelist",
            Self::IronVanguard => "Iron Vanguard",
        }
    }

    fn color(self, owner: UnitOwner) -> Color {
        match (self, owner) {
            (Self::VerdantBruiser, UnitOwner::Player) => {
                Color::linear_rgba(0.30, 0.83, 0.79, 0.98)
            }
            (Self::SignalRanger, UnitOwner::Player) => {
                Color::linear_rgba(0.32, 0.62, 0.93, 0.98)
            }
            (Self::AshDuelist, UnitOwner::Enemy) => {
                Color::linear_rgba(0.94, 0.41, 0.58, 0.98)
            }
            (Self::IronVanguard, UnitOwner::Enemy) => {
                Color::linear_rgba(0.82, 0.30, 0.35, 0.98)
            }
            (archetype, UnitOwner::Player) => archetype.color(UnitOwner::Enemy),
            (archetype, UnitOwner::Enemy) => archetype.color(UnitOwner::Player),
        }
    }

    fn max_health(self) -> i32 {
        match self {
            Self::VerdantBruiser => 15,
            Self::SignalRanger => 10,
            Self::AshDuelist => 12,
            Self::IronVanguard => 16,
        }
    }

    fn attack(self) -> u32 {
        match self {
            Self::VerdantBruiser => 4,
            Self::SignalRanger => 5,
            Self::AshDuelist => 4,
            Self::IronVanguard => 3,
        }
    }
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

    player_squad.units = vec![UnitArchetype::VerdantBruiser];
    enemy_squad.units = vec![UnitArchetype::AshDuelist, UnitArchetype::IronVanguard];
    reroll_shop(&mut shop, combat.round);
    spawn_round_units(&mut commands, &board, &player_squad, &enemy_squad, &mut combat);
    update_projection_from_state(&combat, &shop, &mut projection);
}

fn handle_runtime_commands(
    mut commands: Commands,
    board: Res<BoardConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
    mut player_squad: ResMut<PlayerSquad>,
    enemy_squad: Res<EnemySquad>,
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
                    combat.status = format!(
                        "Round {} ready. Draft one more unit or reroll the shop.",
                        combat.round
                    );
                    reroll_shop(&mut shop, combat.round);
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
                    || player_squad.units.len() >= PLAYER_SLOTS.len()
                    || index >= shop.offers.len()
                {
                    continue;
                }

                let purchased = shop.offers[index];
                player_squad.units.push(purchased);
                combat.gold -= BUY_COST;
                combat.status = format!(
                    "Drafted {}. Squad size is now {}.",
                    purchased.label(),
                    player_squad.units.len()
                );
                reroll_shop(&mut shop, combat.round + index as u32 + 2);
                needs_respawn = true;
            }
        }
    }

    if needs_respawn {
        despawn_units(&mut commands, units.iter());
        spawn_round_units(&mut commands, &board, &player_squad, &enemy_squad, &mut combat);
    }

    update_projection_from_state(&combat, &shop, &mut projection);
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
    mut unit_queries: ParamSet<(
        Query<(Entity, &UnitEntity)>,
        Query<&mut UnitEntity>,
    )>,
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

        let entities = unit_queries.p0().iter().map(|(entity, _)| entity).collect::<Vec<_>>();
        despawn_units(&mut commands, entities.into_iter());
        spawn_round_units(&mut commands, &board, &player_squad, &enemy_squad, &mut combat);
    } else {
        combat.status = format!(
            "Combat underway. {} allied units vs {} enemies.",
            combat.player_units, combat.enemy_units
        );
    }

    update_projection_from_state(&combat, &shop, &mut projection);
}

fn update_unit_health_bars(
    units: Query<&UnitEntity>,
    mut bars: Query<(&mut Sprite, &ChildOf), With<UnitHealthFill>>,
    board: Res<BoardConfig>,
) {
    for (mut sprite, parent) in &mut bars {
        if let Ok(unit) = units.get(parent.parent()) {
            let width = board.cell_size * 0.46
                * (unit.health.max(0) as f32 / unit.max_health.max(1) as f32);
            sprite.custom_size = Some(Vec2::new(width.max(8.0), 10.0));
        }
    }
}

fn update_projection_from_state(
    combat: &CombatState,
    shop: &ShopState,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    projection.phase = combat.phase.as_str().to_owned();
    projection.objective =
        "Draft a compact squad, open combat, and survive the first Numeron rounds."
            .to_owned();
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
        .map(|offer| offer.label().to_owned())
        .collect();
    projection.completed = combat.phase == CombatPhase::Resolution;
}

fn spawn_round_units(
    commands: &mut Commands,
    board: &BoardConfig,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    combat: &mut CombatState,
) {
    combat.player_units = 0;
    combat.enemy_units = 0;

    for (index, archetype) in player_squad.units.iter().copied().enumerate() {
        if let Some(&(row, col)) = PLAYER_SLOTS.get(index) {
            spawn_unit(commands, board, UnitOwner::Player, archetype, row, col);
            combat.player_units += 1;
        }
    }

    for (index, archetype) in enemy_squad.units.iter().copied().enumerate() {
        if let Some(&(row, col)) = ENEMY_SLOTS.get(index) {
            spawn_unit(commands, board, UnitOwner::Enemy, archetype, row, col);
            combat.enemy_units += 1;
        }
    }
}

fn spawn_unit(
    commands: &mut Commands,
    board: &BoardConfig,
    owner: UnitOwner,
    archetype: UnitArchetype,
    row: usize,
    col: usize,
) {
    let translation = board_to_world(board, row, col);
    let max_health = archetype.max_health();

    commands
        .spawn((
            Sprite::from_color(
                archetype.color(owner),
                Vec2::splat(board.cell_size * UNIT_SIZE_RATIO),
            ),
            Transform::from_translation(translation.extend(2.0)),
            UnitEntity {
                owner,
                health: max_health,
                max_health,
                attack: archetype.attack(),
            },
            Name::new(archetype.label()),
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

fn despawn_units(
    commands: &mut Commands,
    units: impl Iterator<Item = Entity>,
) {
    for entity in units {
        commands.entity(entity).despawn();
    }
}

fn reroll_shop(shop: &mut ShopState, round_seed: u32) {
    let pool = UnitArchetype::all();
    let start = (shop.reroll_cursor + round_seed as usize) % pool.len();
    shop.offers = (0..SHOP_SIZE)
        .map(|offset| pool[(start + offset) % pool.len()])
        .collect();
    shop.reroll_cursor = (shop.reroll_cursor + 1) % pool.len();
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
