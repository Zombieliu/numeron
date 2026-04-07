use crate::{GamePlugin, RuntimeConfig};
use bevy::app::App;
use bevy::asset::AssetMetaCheck;
use bevy::prelude::*;
use bevy::window::WindowResolution;

#[cfg(not(target_arch = "wasm32"))]
use bevy::ecs::system::NonSendMarker;
#[cfg(not(target_arch = "wasm32"))]
use bevy::window::PrimaryWindow;
#[cfg(not(target_arch = "wasm32"))]
use bevy::winit::WINIT_WINDOWS;
#[cfg(not(target_arch = "wasm32"))]
use std::io::Cursor;
#[cfg(not(target_arch = "wasm32"))]
use winit::window::Icon;

pub const DEFAULT_WINDOW_TITLE: &str = "Numeron";

#[derive(Clone, Debug)]
pub struct RuntimeBootstrap {
    pub mode: RuntimeMode,
    pub runtime_config: RuntimeConfig,
    pub window_title: String,
}

#[derive(Clone, Copy, Debug)]
pub enum RuntimeMode {
    Native,
    WebCanvas,
}

impl RuntimeBootstrap {
    pub fn native() -> Self {
        Self {
            mode: RuntimeMode::Native,
            runtime_config: RuntimeConfig::default(),
            window_title: DEFAULT_WINDOW_TITLE.to_owned(),
        }
    }

    pub fn web(runtime_config: RuntimeConfig) -> Self {
        Self {
            mode: RuntimeMode::WebCanvas,
            runtime_config,
            window_title: DEFAULT_WINDOW_TITLE.to_owned(),
        }
    }

    pub fn with_window_title(mut self, window_title: impl Into<String>) -> Self {
        self.window_title = window_title.into();
        self
    }
}

pub fn build_native_app() -> App {
    build_runtime_app(RuntimeBootstrap::native())
}

pub fn build_web_app(runtime_config: RuntimeConfig) -> App {
    build_runtime_app(RuntimeBootstrap::web(runtime_config))
}

pub fn build_runtime_app(bootstrap: RuntimeBootstrap) -> App {
    let mut app = App::new();
    configure_runtime_app(&mut app, bootstrap);
    app
}

fn configure_runtime_app(app: &mut App, bootstrap: RuntimeBootstrap) {
    let RuntimeBootstrap {
        mode,
        runtime_config,
        window_title,
    } = bootstrap;

    app.insert_resource(ClearColor(runtime_clear_color()))
        .insert_resource(runtime_config);

    match mode {
        RuntimeMode::Native => {
            app.add_plugins(DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: window_title,
                    ..default()
                }),
                ..default()
            }));

            #[cfg(not(target_arch = "wasm32"))]
            app.add_systems(Startup, set_window_icon);
        }
        RuntimeMode::WebCanvas => {
            app.add_plugins(
                DefaultPlugins
                    .set(WindowPlugin {
                        primary_window: Some(Window {
                            title: window_title,
                            canvas: Some("#bevy-runtime-canvas".to_owned()),
                            fit_canvas_to_parent: true,
                            prevent_default_event_handling: true,
                            resolution: WindowResolution::new(1280, 720),
                            ..default()
                        }),
                        ..default()
                    })
                    .set(AssetPlugin {
                        meta_check: AssetMetaCheck::Never,
                        ..default()
                    }),
            );
        }
    }

    app.add_plugins(GamePlugin);
}

fn runtime_clear_color() -> Color {
    Color::linear_rgb(0.07, 0.09, 0.12)
}

#[cfg(not(target_arch = "wasm32"))]
fn set_window_icon(
    primary_window: Single<Entity, With<PrimaryWindow>>,
    _non_send_marker: NonSendMarker,
) -> Result {
    WINIT_WINDOWS.with_borrow(|windows| {
        let Some(primary) = windows.get_window(*primary_window) else {
            return Err(BevyError::from("No primary window!"));
        };
        let icon_buf = Cursor::new(include_bytes!(
            "../build/macos/AppIcon.iconset/icon_256x256.png"
        ));
        if let Ok(image) = image::load(icon_buf, image::ImageFormat::Png) {
            let image = image.into_rgba8();
            let (width, height) = image.dimensions();
            let rgba = image.into_raw();
            let icon = Icon::from_rgba(rgba, width, height).unwrap();
            primary.set_window_icon(Some(icon));
        };

        Ok(())
    })
}
