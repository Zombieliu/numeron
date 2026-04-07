use crate::GameState;
use crate::loading::TextureAssets;
use crate::player::Player;
use bevy::prelude::*;

pub struct StarterScenePlugin;

const BEACON_CAPTURE_RADIUS: f32 = 88.0;
const BEACON_BASE_SIZE: f32 = 120.0;
const ROUND_RESET_SECONDS: f32 = 1.4;

#[derive(Resource, Clone, Debug)]
pub struct StarterSceneConfig {
    pub arena_size: Vec2,
    pub player_size: Vec2,
    pub beacon_positions: [Vec2; 4],
}

impl Default for StarterSceneConfig {
    fn default() -> Self {
        Self {
            arena_size: Vec2::new(1280.0, 720.0),
            player_size: Vec2::splat(96.0),
            beacon_positions: [
                Vec2::new(-420.0, -220.0),
                Vec2::new(420.0, -220.0),
                Vec2::new(-420.0, 220.0),
                Vec2::new(420.0, 220.0),
            ],
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
            objective: "Secure each uplink pad once per sweep.".to_owned(),
            status: "Loop 1 active. Sweep the four uplinks.".to_owned(),
            score: 0,
            captured: 0,
            total: 4,
            round: 1,
            completed: false,
        }
    }
}

#[derive(Resource, Default)]
struct StarterSliceLoopState {
    reset_timer: Option<Timer>,
}

#[derive(Component)]
struct BeaconPad {
    index: usize,
    captured: bool,
}

impl Plugin for StarterScenePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<StarterSceneConfig>()
            .init_resource::<StarterSliceProjection>()
            .init_resource::<StarterSliceLoopState>()
            .add_systems(OnEnter(GameState::Playing), spawn_starter_scene)
            .add_systems(
                Update,
                (
                    animate_beacons,
                    collect_beacons,
                    recycle_completed_round,
                )
                    .run_if(in_state(GameState::Playing)),
            );
    }
}

fn spawn_starter_scene(
    mut commands: Commands,
    scene: Res<StarterSceneConfig>,
    mut slice: ResMut<StarterSliceProjection>,
    mut slice_loop: ResMut<StarterSliceLoopState>,
    textures: Res<TextureAssets>,
) {
    *slice = StarterSliceProjection {
        total: scene.beacon_positions.len(),
        ..default()
    };
    *slice_loop = StarterSliceLoopState::default();

    commands.spawn((Camera2d, Name::new("RuntimeCamera")));

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.06, 0.11, 0.15, 0.92),
            scene.arena_size,
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -10.0)),
        Name::new("ArenaBackdrop"),
    ));

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.39, 0.87, 0.78, 0.15),
            Vec2::new(scene.arena_size.x - 128.0, 4.0),
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -8.0)),
        Name::new("CenterLine"),
    ));

    commands.spawn((
        Sprite::from_color(
            Color::linear_rgba(0.40, 0.78, 0.92, 0.12),
            Vec2::new(scene.arena_size.x - 64.0, scene.arena_size.y - 64.0),
        ),
        Transform::from_translation(Vec3::new(0.0, 0.0, -9.0)),
        Name::new("ArenaFrame"),
    ));

    for (index, beacon) in scene.beacon_positions.into_iter().enumerate() {
        commands.spawn((
            Sprite::from_color(beacon_idle_color(index), Vec2::splat(BEACON_BASE_SIZE)),
            Transform::from_translation(beacon.extend(-5.0)),
            BeaconPad {
                index,
                captured: false,
            },
            Name::new("BeaconPad"),
        ));
    }

    commands
        .spawn((
            Sprite::from_color(
                Color::linear_rgba(0.74, 0.89, 0.56, 0.95),
                scene.player_size,
            ),
            Transform::from_translation(Vec3::new(0.0, 0.0, 1.0)),
            Player,
            Name::new("Player"),
        ))
        .with_children(|parent| {
            parent.spawn((
                Sprite::from_image(textures.bevy.clone()),
                Transform::from_scale(Vec3::splat(0.24)).with_translation(Vec3::new(0.0, 0.0, 1.0)),
                Name::new("PlayerMark"),
            ));
        });
}

fn animate_beacons(
    time: Res<Time>,
    mut beacons: Query<(&BeaconPad, &mut Transform, &mut Sprite)>,
) {
    for (beacon, mut transform, mut sprite) in &mut beacons {
        if beacon.captured {
            transform.scale = Vec3::splat(1.05);
            sprite.color = beacon_captured_color();
            sprite.custom_size = Some(Vec2::splat(BEACON_BASE_SIZE + 10.0));
            continue;
        }

        let pulse = (time.elapsed_secs() * 1.7 + beacon.index as f32 * 0.8).sin() * 0.08;
        transform.scale = Vec3::splat(1.0 + pulse);
        sprite.color = beacon_idle_color(beacon.index);
        sprite.custom_size = Some(Vec2::splat(BEACON_BASE_SIZE));
    }
}

fn collect_beacons(
    player: Single<&Transform, With<Player>>,
    mut beacons: Query<(&Transform, &mut BeaconPad, &mut Sprite)>,
    mut slice: ResMut<StarterSliceProjection>,
    mut slice_loop: ResMut<StarterSliceLoopState>,
) {
    if slice.completed {
        return;
    }

    let player_position = player.translation.truncate();

    for (transform, mut beacon, mut sprite) in &mut beacons {
        if beacon.captured {
            continue;
        }

        if player_position.distance(transform.translation.truncate()) > BEACON_CAPTURE_RADIUS {
            continue;
        }

        beacon.captured = true;
        sprite.color = beacon_captured_color();
        sprite.custom_size = Some(Vec2::splat(BEACON_BASE_SIZE + 10.0));

        slice.captured += 1;
        slice.score += 150;
        slice.status = format!(
            "Uplink {} secured. {} of {} locked.",
            beacon.index + 1,
            slice.captured,
            slice.total
        );

        if slice.captured == slice.total {
            slice.completed = true;
            slice.status = format!(
                "Sweep {} cleared. Resetting uplinks for the next loop.",
                slice.round
            );
            slice_loop.reset_timer =
                Some(Timer::from_seconds(ROUND_RESET_SECONDS, TimerMode::Once));
        }
    }
}

fn recycle_completed_round(
    time: Res<Time>,
    mut beacons: Query<(&mut BeaconPad, &mut Sprite)>,
    mut slice: ResMut<StarterSliceProjection>,
    mut slice_loop: ResMut<StarterSliceLoopState>,
) {
    let Some(timer) = slice_loop.reset_timer.as_mut() else {
        return;
    };

    timer.tick(time.delta());

    if !timer.is_finished() {
        return;
    }

    for (mut beacon, mut sprite) in &mut beacons {
        beacon.captured = false;
        sprite.color = beacon_idle_color(beacon.index);
        sprite.custom_size = Some(Vec2::splat(BEACON_BASE_SIZE));
    }

    slice.round += 1;
    slice.captured = 0;
    slice.completed = false;
    slice.status = format!("Loop {} active. Sweep the four uplinks.", slice.round);
    slice_loop.reset_timer = None;
}

fn beacon_idle_color(index: usize) -> Color {
    match index % 4 {
        0 => Color::linear_rgba(0.45, 0.85, 0.76, 0.22),
        1 => Color::linear_rgba(0.36, 0.70, 0.94, 0.22),
        2 => Color::linear_rgba(0.88, 0.68, 0.38, 0.22),
        _ => Color::linear_rgba(0.82, 0.52, 0.88, 0.22),
    }
}

fn beacon_captured_color() -> Color {
    Color::linear_rgba(0.92, 0.95, 0.62, 0.34)
}
