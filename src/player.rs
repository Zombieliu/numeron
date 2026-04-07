use crate::GameState;
use crate::RuntimeConfig;
use crate::actions::Actions;
use crate::starter_scene::StarterSceneConfig;
use bevy::prelude::*;

pub struct PlayerPlugin;

#[derive(Component)]
pub struct Player;

/// This plugin handles player related stuff like movement
/// Player logic is only active during the State `GameState::Playing`
impl Plugin for PlayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, move_player.run_if(in_state(GameState::Playing)));
    }
}

fn move_player(
    time: Res<Time>,
    actions: Res<Actions>,
    config: Res<RuntimeConfig>,
    scene: Res<StarterSceneConfig>,
    mut player_query: Query<&mut Transform, With<Player>>,
) {
    let Some(movement) = actions.player_movement else {
        return;
    };
    let speed = if config.touch_controls { 150. } else { 190. };
    let movement = Vec3::new(
        movement.x * speed * time.delta_secs(),
        movement.y * speed * time.delta_secs(),
        0.,
    );
    for mut player_transform in &mut player_query {
        player_transform.translation += movement;
        let player_half_width = scene.player_size.x * 0.5;
        let player_half_height = scene.player_size.y * 0.5;

        player_transform.translation.x = player_transform.translation.x.clamp(
            -(scene.arena_size.x * 0.5) + player_half_width,
            (scene.arena_size.x * 0.5) - player_half_width,
        );
        player_transform.translation.y = player_transform.translation.y.clamp(
            -(scene.arena_size.y * 0.5) + player_half_height,
            (scene.arena_size.y * 0.5) - player_half_height,
        );
    }
}
