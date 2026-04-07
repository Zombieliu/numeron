#![allow(clippy::type_complexity)]

mod actions;
mod audio;
mod loading;
mod player;
mod runtime_app;
mod starter_scene;
mod web_bridge;

use crate::actions::ActionsPlugin;
use crate::audio::InternalAudioPlugin;
use crate::loading::LoadingPlugin;
use crate::player::PlayerPlugin;
use crate::starter_scene::StarterScenePlugin;
use crate::web_bridge::RuntimeBridgePlugin;

use bevy::app::App;
#[cfg(debug_assertions)]
use bevy::diagnostic::{FrameTimeDiagnosticsPlugin, LogDiagnosticsPlugin};
use bevy::prelude::*;

pub use crate::runtime_app::{
    DEFAULT_WINDOW_TITLE, RuntimeBootstrap, RuntimeMode, build_native_app, build_runtime_app,
    build_web_app,
};
pub use crate::starter_scene::StarterSceneConfig;

// This example game uses States to separate logic
// See https://bevy-cheatbook.github.io/programming/states.html
// Or https://github.com/bevyengine/bevy/blob/main/examples/ecs/state.rs
#[derive(States, Default, Clone, Eq, PartialEq, Debug, Hash)]
enum GameState {
    // During the loading State the LoadingPlugin will load our assets
    #[default]
    Loading,
    // During this State the actual game logic is executed
    Playing,
}

#[derive(Resource, Clone, Debug)]
pub struct RuntimeConfig {
    pub player_name: String,
    pub touch_controls: bool,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            player_name: "Pilot".to_owned(),
            touch_controls: true,
        }
    }
}

pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.init_state::<GameState>()
            .init_resource::<RuntimeConfig>()
            .add_plugins((
                LoadingPlugin,
                StarterScenePlugin,
                ActionsPlugin,
                InternalAudioPlugin,
                PlayerPlugin,
                RuntimeBridgePlugin,
            ));

        #[cfg(debug_assertions)]
        {
            app.add_plugins((
                FrameTimeDiagnosticsPlugin::default(),
                LogDiagnosticsPlugin::default(),
            ));
        }
    }
}
