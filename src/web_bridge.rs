use crate::starter_scene::{BoardAnchor, StarterSliceProjection};
use bevy::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::{Function, Object, Reflect};
#[cfg(target_arch = "wasm32")]
use crate::RuntimeConfig;
#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

pub struct RuntimeBridgePlugin;

impl Plugin for RuntimeBridgePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<RuntimeBridgeState>()
            .add_systems(Update, (publish_runtime_ready, publish_runtime_projection));
    }
}

#[derive(Resource, Default)]
struct RuntimeBridgeState {
    ready_emitted: bool,
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static STATUS_SINK: RefCell<Option<Function>> = const { RefCell::new(None) };
    static RUNTIME_EVENT_SINK: RefCell<Option<Function>> = const { RefCell::new(None) };
    static SESSION_CONFIG: RefCell<PendingSessionConfig> = RefCell::new(PendingSessionConfig::default());
    static VIRTUAL_INPUT: RefCell<PendingVirtualInput> = const { RefCell::new(PendingVirtualInput { x: 0.0, y: 0.0 }) };
    static COMMAND_QUEUE: RefCell<Vec<RuntimeCommand>> = const { RefCell::new(Vec::new()) };
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug)]
struct PendingSessionConfig {
    player_name: String,
    touch_controls: bool,
}

#[cfg(target_arch = "wasm32")]
impl Default for PendingSessionConfig {
    fn default() -> Self {
        Self {
            player_name: "Pilot".to_owned(),
            touch_controls: true,
        }
    }
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Copy, Debug)]
struct PendingVirtualInput {
    x: f32,
    y: f32,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub enum RuntimeCommand {
    StartCombat,
    ResetRound,
    RerollShop,
    BuyOffer(usize),
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setRuntimeBootStatusSink)]
pub fn set_runtime_boot_status_sink(callback: Function) {
    STATUS_SINK.with(|sink| {
        sink.borrow_mut().replace(callback);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearRuntimeBootStatusSink)]
pub fn clear_runtime_boot_status_sink() {
    STATUS_SINK.with(|sink| {
        sink.borrow_mut().take();
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setRuntimeEventSink)]
pub fn set_runtime_event_sink(callback: Function) {
    RUNTIME_EVENT_SINK.with(|sink| {
        sink.borrow_mut().replace(callback);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearRuntimeEventSink)]
pub fn clear_runtime_event_sink() {
    RUNTIME_EVENT_SINK.with(|sink| {
        sink.borrow_mut().take();
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setRuntimeSessionConfig)]
pub fn set_runtime_session_config(player_name: String, touch_controls: bool) {
    SESSION_CONFIG.with(|config| {
        let trimmed_name = player_name.trim();
        *config.borrow_mut() = PendingSessionConfig {
            player_name: if trimmed_name.is_empty() {
                "Pilot".to_owned()
            } else {
                trimmed_name.chars().take(16).collect()
            },
            touch_controls,
        };
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setRuntimeVirtualInput)]
pub fn set_runtime_virtual_input(x: f32, y: f32) {
    VIRTUAL_INPUT.with(|input| {
        *input.borrow_mut() = PendingVirtualInput {
            x: x.clamp(-1.0, 1.0),
            y: y.clamp(-1.0, 1.0),
        };
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = startRuntimeCombat)]
pub fn start_runtime_combat() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::StartCombat);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = resetRuntimeRound)]
pub fn reset_runtime_round() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::ResetRound);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = rerollRuntimeShop)]
pub fn reroll_runtime_shop() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::RerollShop);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = buyRuntimeShopOffer)]
pub fn buy_runtime_shop_offer(index: u32) {
    COMMAND_QUEUE.with(|queue| {
        queue
            .borrow_mut()
            .push(RuntimeCommand::BuyOffer(index as usize));
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = bootRuntime)]
pub fn boot_runtime() {
    console_error_panic_hook::set_once();

    publish_status(
        "runtime-entered",
        "Rust runtime entry reached for the Next.js shell",
    );

    let pending_config = SESSION_CONFIG.with(|config| config.borrow().clone());

    let mut app = crate::build_web_app(RuntimeConfig {
        player_name: pending_config.player_name,
        touch_controls: pending_config.touch_controls,
    });

    publish_status("app-created", "Bevy app allocated");
    publish_status(
        "plugins-configured",
        "Shared runtime app bootstrap and plugins configured",
    );
    publish_status("running", "Handing off to the Bevy app loop");
    app.run();
}

pub fn read_runtime_virtual_input() -> Option<Vec2> {
    #[cfg(target_arch = "wasm32")]
    {
        return VIRTUAL_INPUT.with(|input| {
            let state = *input.borrow();
            if state.x == 0.0 && state.y == 0.0 {
                None
            } else {
                Some(Vec2::new(state.x, state.y))
            }
        });
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        None
    }
}

pub fn take_runtime_commands() -> Vec<RuntimeCommand> {
    #[cfg(target_arch = "wasm32")]
    {
        return COMMAND_QUEUE.with(|queue| queue.take());
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        Vec::new()
    }
}

fn publish_runtime_ready(
    mut state: ResMut<RuntimeBridgeState>,
    slice: Option<Res<StarterSliceProjection>>,
    board: Query<Entity, With<BoardAnchor>>,
) {
    if state.ready_emitted {
        return;
    }

    if board.single().is_ok() {
        publish_status(
            "scene-ready",
            "Numeron board slice allocated",
        );
        publish_runtime_event(
            "runtime.ready",
            &projection_object(slice.as_deref()),
        );
        state.ready_emitted = true;
    }
}

fn publish_runtime_projection(
    slice: Option<Res<StarterSliceProjection>>,
) {
    let slice_changed = slice.as_ref().is_some_and(|value| value.is_changed());

    if slice_changed {
        publish_runtime_event(
            "runtime.projection.changed",
            &projection_object(slice.as_deref()),
        );
    }
}

fn projection_object(slice: Option<&StarterSliceProjection>) -> ProjectionPayload {
    let slice = slice.cloned().unwrap_or_default();

    ProjectionPayload {
        ready: true,
        player_name: "Board".to_owned(),
        x: 0.0,
        y: 0.0,
        touch_controls: false,
        phase: slice.phase,
        objective: slice.objective,
        status: slice.status,
        score: slice.score,
        gold: slice.gold,
        player_health: slice.player_health,
        enemy_health: slice.enemy_health,
        captured: slice.captured,
        total: slice.total,
        round: slice.round,
        reroll_cost: slice.reroll_cost,
        shop_offers: slice.shop_offers,
        completed: slice.completed,
    }
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
struct ProjectionPayload {
    ready: bool,
    player_name: String,
    x: f32,
    y: f32,
    touch_controls: bool,
    phase: String,
    objective: String,
    status: String,
    score: u32,
    gold: u32,
    player_health: u32,
    enemy_health: u32,
    captured: usize,
    total: usize,
    round: u32,
    reroll_cost: u32,
    shop_offers: Vec<String>,
    completed: bool,
}

fn publish_status(phase: &str, message: &str) {
    #[cfg(target_arch = "wasm32")]
    STATUS_SINK.with(|sink| {
        if let Some(callback) = sink.borrow().as_ref() {
            let payload = Object::new();
            let _ = Reflect::set(&payload, &"phase".into(), &phase.into());
            let _ = Reflect::set(&payload, &"message".into(), &message.into());
            let _ = callback.call1(&JsValue::NULL, &payload);
        }
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = (phase, message);
}

fn publish_runtime_event(event_type: &str, projection: &ProjectionPayload) {
    #[cfg(target_arch = "wasm32")]
    RUNTIME_EVENT_SINK.with(|sink| {
        if let Some(callback) = sink.borrow().as_ref() {
            let payload = Object::new();
            let projection_object = Object::new();
            let player = Object::new();
            let slice = Object::new();

            let _ = Reflect::set(&payload, &"type".into(), &event_type.into());
            let _ = Reflect::set(&payload, &"origin".into(), &"runtime".into());

            let _ = Reflect::set(
                &projection_object,
                &"ready".into(),
                &projection.ready.into(),
            );
            let _ = Reflect::set(
                &projection_object,
                &"touchControls".into(),
                &projection.touch_controls.into(),
            );
            let _ = Reflect::set(
                &player,
                &"name".into(),
                &projection.player_name.clone().into(),
            );
            let _ = Reflect::set(&player, &"x".into(), &projection.x.into());
            let _ = Reflect::set(&player, &"y".into(), &projection.y.into());
            let _ = Reflect::set(&projection_object, &"player".into(), &player);
            let _ = Reflect::set(
                &slice,
                &"phase".into(),
                &projection.phase.clone().into(),
            );
            let _ = Reflect::set(
                &slice,
                &"objective".into(),
                &projection.objective.clone().into(),
            );
            let _ = Reflect::set(&slice, &"status".into(), &projection.status.clone().into());
            let _ = Reflect::set(&slice, &"score".into(), &projection.score.into());
            let _ = Reflect::set(&slice, &"gold".into(), &projection.gold.into());
            let _ = Reflect::set(
                &slice,
                &"playerHealth".into(),
                &projection.player_health.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"enemyHealth".into(),
                &projection.enemy_health.into(),
            );
            let _ = Reflect::set(&slice, &"captured".into(), &projection.captured.into());
            let _ = Reflect::set(&slice, &"total".into(), &projection.total.into());
            let _ = Reflect::set(&slice, &"round".into(), &projection.round.into());
            let _ = Reflect::set(
                &slice,
                &"rerollCost".into(),
                &projection.reroll_cost.into(),
            );
            let offers = js_sys::Array::new();
            for offer in &projection.shop_offers {
                offers.push(&offer.clone().into());
            }
            let _ = Reflect::set(&slice, &"shopOffers".into(), &offers);
            let _ = Reflect::set(&slice, &"completed".into(), &projection.completed.into());
            let _ = Reflect::set(&projection_object, &"slice".into(), &slice);
            let _ = Reflect::set(&payload, &"projection".into(), &projection_object);
            let _ = callback.call1(&JsValue::NULL, &payload);
        }
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = (event_type, projection);
}
