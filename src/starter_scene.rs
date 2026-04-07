use crate::GameState;
use bevy::prelude::*;

pub struct StarterScenePlugin;

const BOARD_ROWS: usize = 4;
const BOARD_COLS: usize = 6;
const CELL_SIZE: f32 = 140.0;
const CELL_PADDING: f32 = 16.0;
const UNIT_SIZE_RATIO: f32 = 0.64;

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
    pub player_units: usize,
    pub enemy_units: usize,
}

impl Default for CombatState {
    fn default() -> Self {
        Self {
            phase: CombatPhase::Preparation,
            round: 1,
            player_health: 30,
            enemy_health: 30,
            player_units: 0,
            enemy_units: 0,
        }
    }
}

#[derive(Resource, Clone, Debug)]
pub struct StarterSliceProjection {
    pub objective: String,
    pub status: String,
    pub score: u32,
    pub captured: usize,
    pub total: usize,
    pub round: u32,
    pub completed: bool,
}

impl Default for StarterSliceProjection {
    fn default() -> Self {
        Self {
            objective: "Draft a front line and prepare to open combat.".to_owned(),
            status: "Board ready. Seed squads are standing by.".to_owned(),
            score: 0,
            captured: 0,
            total: 0,
            round: 1,
            completed: false,
        }
    }
}

#[derive(Component)]
pub struct BoardAnchor;

#[derive(Component)]
struct BoardTile {
    row: usize,
    col: usize,
}

#[derive(Component)]
struct UnitEntity {
    owner: UnitOwner,
    name: &'static str,
    health: u32,
    max_health: u32,
    row: usize,
    col: usize,
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitOwner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug)]
struct UnitSeed {
    owner: UnitOwner,
    row: usize,
    col: usize,
    color: Color,
    name: &'static str,
    health: u32,
}

impl Plugin for StarterScenePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BoardConfig>()
            .init_resource::<CombatState>()
            .init_resource::<StarterSliceProjection>()
            .add_systems(OnEnter(GameState::Playing), spawn_board_scene)
            .add_systems(
                Update,
                (refresh_projection, update_unit_health_bars)
                    .run_if(in_state(GameState::Playing)),
            );
    }
}

fn spawn_board_scene(
    mut commands: Commands,
    board: Res<BoardConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
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
                BoardTile { row, col },
                Name::new("BoardTile"),
            ));
        }
    }

    let seeds = seeded_units();
    combat.player_units = seeds
        .iter()
        .filter(|seed| seed.owner == UnitOwner::Player)
        .count();
    combat.enemy_units = seeds
        .iter()
        .filter(|seed| seed.owner == UnitOwner::Enemy)
        .count();

    for seed in seeds {
        spawn_unit(&mut commands, &board, seed);
    }

    *projection = StarterSliceProjection {
        objective: "Replace the template slice with the first board-driven Numeron combat loop."
            .to_owned(),
        status: "Preparation phase. Seed squads are standing by on both sides.".to_owned(),
        score: 0,
        captured: combat.player_units,
        total: combat.player_units + combat.enemy_units,
        round: combat.round,
        completed: false,
    };
}

fn refresh_projection(
    combat: Res<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
) {
    if !combat.is_changed() {
        return;
    }

    projection.round = combat.round;
    projection.captured = combat.player_units;
    projection.total = combat.player_units + combat.enemy_units;
    projection.completed = combat.phase == CombatPhase::Resolution;
    projection.status = match combat.phase {
        CombatPhase::Preparation => format!(
            "Preparation phase. {} allied units face {} enemy units.",
            combat.player_units, combat.enemy_units
        ),
        CombatPhase::Combat => format!(
            "Combat phase. {} vs {} with both squads committed.",
            combat.player_units, combat.enemy_units
        ),
        CombatPhase::Resolution => format!(
            "Resolution phase. Player HP {} · Enemy HP {}.",
            combat.player_health, combat.enemy_health
        ),
    };
}

fn update_unit_health_bars(
    units: Query<&UnitEntity>,
    mut bars: Query<(&mut Sprite, &ChildOf), With<UnitHealthFill>>,
    board: Res<BoardConfig>,
) {
    for (mut sprite, parent) in &mut bars {
        if let Ok(unit) = units.get(parent.parent()) {
            let width = board.cell_size * 0.46
                * (unit.health as f32 / unit.max_health.max(1) as f32);
            sprite.custom_size = Some(Vec2::new(width.max(8.0), 10.0));
        }
    }
}

fn spawn_unit(commands: &mut Commands, board: &BoardConfig, seed: UnitSeed) {
    let translation = board_to_world(board, seed.row, seed.col);

    commands
        .spawn((
            Sprite::from_color(
                seed.color,
                Vec2::splat(board.cell_size * UNIT_SIZE_RATIO),
            ),
            Transform::from_translation(translation.extend(2.0)),
            UnitEntity {
                owner: seed.owner,
                name: seed.name,
                health: seed.health,
                max_health: seed.health,
                row: seed.row,
                col: seed.col,
            },
            Name::new(seed.name),
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
                    match seed.owner {
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

fn seeded_units() -> [UnitSeed; 4] {
    [
        UnitSeed {
            owner: UnitOwner::Player,
            row: 1,
            col: 1,
            color: Color::linear_rgba(0.30, 0.83, 0.79, 0.98),
            name: "Verdant Bruiser",
            health: 12,
        },
        UnitSeed {
            owner: UnitOwner::Player,
            row: 2,
            col: 1,
            color: Color::linear_rgba(0.32, 0.62, 0.93, 0.98),
            name: "Signal Ranger",
            health: 9,
        },
        UnitSeed {
            owner: UnitOwner::Enemy,
            row: 1,
            col: 4,
            color: Color::linear_rgba(0.94, 0.41, 0.58, 0.98),
            name: "Ash Duelist",
            health: 10,
        },
        UnitSeed {
            owner: UnitOwner::Enemy,
            row: 2,
            col: 4,
            color: Color::linear_rgba(0.82, 0.30, 0.35, 0.98),
            name: "Iron Vanguard",
            health: 13,
        },
    ]
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
    } else {
        if (row + col) % 2 == 0 {
            Color::linear_rgba(0.17, 0.11, 0.14, 0.96)
        } else {
            Color::linear_rgba(0.14, 0.08, 0.11, 0.96)
        }
    }
}
