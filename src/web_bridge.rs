use crate::starter_scene::{
    BoardAnchor, RuntimeTraitView, RuntimeUnitView, StarterSliceProjection,
};
use bevy::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::{RuntimeConfig, RuntimeLocale};
#[cfg(target_arch = "wasm32")]
use js_sys::{Function, Object, Reflect};
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
    locale_code: String,
}

#[cfg(target_arch = "wasm32")]
impl Default for PendingSessionConfig {
    fn default() -> Self {
        Self {
            player_name: "Pilot".to_owned(),
            touch_controls: true,
            locale_code: "en".to_owned(),
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
    RestartRun,
    RerollShop,
    BuyXp,
    ToggleShopLock,
    BuyOffer(usize),
    DeployBenchToBoard {
        bench_index: usize,
        slot_index: usize,
    },
    WithdrawBoardUnit(usize),
    SellBenchUnit(usize),
    SellBoardUnit(usize),
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
pub fn set_runtime_session_config(player_name: String, touch_controls: bool, locale: String) {
    SESSION_CONFIG.with(|config| {
        let trimmed_name = player_name.trim();
        *config.borrow_mut() = PendingSessionConfig {
            player_name: if trimmed_name.is_empty() {
                "Pilot".to_owned()
            } else {
                trimmed_name.chars().take(16).collect()
            },
            touch_controls,
            locale_code: if locale == "zh-CN" {
                "zh-CN".to_owned()
            } else {
                "en".to_owned()
            },
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
#[wasm_bindgen(js_name = restartRuntimeRun)]
pub fn restart_runtime_run() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::RestartRun);
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
#[wasm_bindgen(js_name = buyRuntimeXp)]
pub fn buy_runtime_xp() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::BuyXp);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = toggleRuntimeShopLock)]
pub fn toggle_runtime_shop_lock() {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::ToggleShopLock);
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
#[wasm_bindgen(js_name = deployRuntimeBenchUnit)]
pub fn deploy_runtime_bench_unit(bench_index: u32, slot_index: u32) {
    COMMAND_QUEUE.with(|queue| {
        queue.borrow_mut().push(RuntimeCommand::DeployBenchToBoard {
            bench_index: bench_index as usize,
            slot_index: slot_index as usize,
        });
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = withdrawRuntimeBoardUnit)]
pub fn withdraw_runtime_board_unit(slot_index: u32) {
    COMMAND_QUEUE.with(|queue| {
        queue
            .borrow_mut()
            .push(RuntimeCommand::WithdrawBoardUnit(slot_index as usize));
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = sellRuntimeBenchUnit)]
pub fn sell_runtime_bench_unit(bench_index: u32) {
    COMMAND_QUEUE.with(|queue| {
        queue
            .borrow_mut()
            .push(RuntimeCommand::SellBenchUnit(bench_index as usize));
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = sellRuntimeBoardUnit)]
pub fn sell_runtime_board_unit(slot_index: u32) {
    COMMAND_QUEUE.with(|queue| {
        queue
            .borrow_mut()
            .push(RuntimeCommand::SellBoardUnit(slot_index as usize));
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
        locale: RuntimeLocale::from_code(&pending_config.locale_code),
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
        publish_status("scene-ready", "Numeron board slice allocated");
        publish_runtime_event("runtime.ready", &projection_object(slice.as_deref()));
        state.ready_emitted = true;
    }
}

fn publish_runtime_projection(slice: Option<Res<StarterSliceProjection>>) {
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
        run_number: slice.run_number,
        level: slice.level,
        xp: slice.xp,
        xp_to_next_level: slice.xp_to_next_level,
        max_level: slice.max_level,
        reroll_cost: slice.reroll_cost,
        xp_buy_cost: slice.xp_buy_cost,
        shop_locked: slice.shop_locked,
        shop_offers: slice.shop_offers,
        bench_units: slice.bench_units,
        player_board: slice.player_board,
        enemy_board: slice.enemy_board,
        unit_roster: slice.unit_roster,
        active_traits: slice.active_traits,
        enemy_threat: slice.enemy_threat,
        enemy_intent: slice.enemy_intent,
        bench_capacity: slice.bench_capacity,
        board_capacity: slice.board_capacity,
        deployment_cap: slice.deployment_cap,
        streak: slice.streak,
        base_income: slice.base_income,
        interest_income: slice.interest_income,
        streak_income: slice.streak_income,
        round_resolved: slice.round_resolved,
        run_over: slice.run_over,
        run_result: slice.run_result,
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
    run_number: u32,
    level: u32,
    xp: u32,
    xp_to_next_level: u32,
    max_level: u32,
    reroll_cost: u32,
    xp_buy_cost: u32,
    shop_locked: bool,
    shop_offers: Vec<RuntimeUnitView>,
    bench_units: Vec<RuntimeUnitView>,
    player_board: Vec<Option<RuntimeUnitView>>,
    enemy_board: Vec<Option<RuntimeUnitView>>,
    unit_roster: Vec<RuntimeUnitView>,
    active_traits: Vec<RuntimeTraitView>,
    enemy_threat: u32,
    enemy_intent: String,
    bench_capacity: usize,
    board_capacity: usize,
    deployment_cap: usize,
    streak: i32,
    base_income: u32,
    interest_income: u32,
    streak_income: u32,
    round_resolved: bool,
    run_over: bool,
    run_result: String,
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
            let _ = Reflect::set(&slice, &"phase".into(), &projection.phase.clone().into());
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
            let _ = Reflect::set(&slice, &"runNumber".into(), &projection.run_number.into());
            let _ = Reflect::set(&slice, &"level".into(), &projection.level.into());
            let _ = Reflect::set(&slice, &"xp".into(), &projection.xp.into());
            let _ = Reflect::set(
                &slice,
                &"xpToNextLevel".into(),
                &projection.xp_to_next_level.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"maxLevel".into(),
                &projection.max_level.into(),
            );
            let _ = Reflect::set(&slice, &"rerollCost".into(), &projection.reroll_cost.into());
            let _ = Reflect::set(&slice, &"xpBuyCost".into(), &projection.xp_buy_cost.into());
            let _ = Reflect::set(&slice, &"shopLocked".into(), &projection.shop_locked.into());
            let offers = js_sys::Array::new();
            for offer in &projection.shop_offers {
                offers.push(&runtime_unit_view_object(offer));
            }
            let _ = Reflect::set(&slice, &"shopOffers".into(), &offers);
            let bench_units = js_sys::Array::new();
            for unit in &projection.bench_units {
                bench_units.push(&runtime_unit_view_object(unit));
            }
            let _ = Reflect::set(&slice, &"benchUnits".into(), &bench_units);
            let player_board = js_sys::Array::new();
            for unit in &projection.player_board {
                match unit {
                    Some(unit) => player_board.push(&runtime_unit_view_object(unit)),
                    None => player_board.push(&JsValue::NULL),
                };
            }
            let _ = Reflect::set(&slice, &"playerBoard".into(), &player_board);
            let enemy_board = js_sys::Array::new();
            for unit in &projection.enemy_board {
                match unit {
                    Some(unit) => enemy_board.push(&runtime_unit_view_object(unit)),
                    None => enemy_board.push(&JsValue::NULL),
                };
            }
            let _ = Reflect::set(&slice, &"enemyBoard".into(), &enemy_board);
            let unit_roster = js_sys::Array::new();
            for unit in &projection.unit_roster {
                unit_roster.push(&runtime_unit_view_object(unit));
            }
            let _ = Reflect::set(&slice, &"unitRoster".into(), &unit_roster);
            let active_traits = js_sys::Array::new();
            for trait_view in &projection.active_traits {
                active_traits.push(&runtime_trait_view_object(trait_view));
            }
            let _ = Reflect::set(&slice, &"activeTraits".into(), &active_traits);
            let _ = Reflect::set(
                &slice,
                &"enemyThreat".into(),
                &projection.enemy_threat.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"enemyIntent".into(),
                &projection.enemy_intent.clone().into(),
            );
            let _ = Reflect::set(
                &slice,
                &"benchCapacity".into(),
                &projection.bench_capacity.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"boardCapacity".into(),
                &projection.board_capacity.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"deploymentCap".into(),
                &projection.deployment_cap.into(),
            );
            let _ = Reflect::set(&slice, &"streak".into(), &projection.streak.into());
            let _ = Reflect::set(
                &slice,
                &"baseIncome".into(),
                &projection.base_income.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"interestIncome".into(),
                &projection.interest_income.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"streakIncome".into(),
                &projection.streak_income.into(),
            );
            let _ = Reflect::set(
                &slice,
                &"roundResolved".into(),
                &projection.round_resolved.into(),
            );
            let _ = Reflect::set(&slice, &"runOver".into(), &projection.run_over.into());
            let _ = Reflect::set(
                &slice,
                &"runResult".into(),
                &projection.run_result.clone().into(),
            );
            let _ = Reflect::set(&slice, &"completed".into(), &projection.completed.into());
            let _ = Reflect::set(&projection_object, &"slice".into(), &slice);
            let _ = Reflect::set(&payload, &"projection".into(), &projection_object);
            let _ = callback.call1(&JsValue::NULL, &payload);
        }
    });

    #[cfg(not(target_arch = "wasm32"))]
    let _ = (event_type, projection);
}

#[cfg(target_arch = "wasm32")]
fn runtime_unit_view_object(view: &RuntimeUnitView) -> JsValue {
    let payload = Object::new();
    let _ = Reflect::set(&payload, &"label".into(), &view.label.clone().into());
    let _ = Reflect::set(
        &payload,
        &"archetype".into(),
        &view.archetype.clone().into(),
    );
    let _ = Reflect::set(&payload, &"faction".into(), &view.faction.clone().into());
    let _ = Reflect::set(&payload, &"role".into(), &view.role.clone().into());
    let _ = Reflect::set(&payload, &"skill".into(), &view.skill.clone().into());
    let _ = Reflect::set(
        &payload,
        &"tempoLabel".into(),
        &view.tempo_label.clone().into(),
    );
    let _ = Reflect::set(
        &payload,
        &"castState".into(),
        &view.cast_state.clone().into(),
    );
    let _ = Reflect::set(
        &payload,
        &"targetRule".into(),
        &view.target_rule.clone().into(),
    );
    let _ = Reflect::set(&payload, &"stars".into(), &view.stars.into());
    let _ = Reflect::set(&payload, &"attack".into(), &view.attack.into());
    let _ = Reflect::set(&payload, &"health".into(), &view.health.into());
    let _ = Reflect::set(&payload, &"sellValue".into(), &view.sell_value.into());
    payload.into()
}

#[cfg(target_arch = "wasm32")]
fn runtime_trait_view_object(view: &RuntimeTraitView) -> JsValue {
    let payload = Object::new();
    let _ = Reflect::set(&payload, &"key".into(), &view.key.clone().into());
    let _ = Reflect::set(&payload, &"label".into(), &view.label.clone().into());
    let _ = Reflect::set(&payload, &"count".into(), &view.count.into());
    let _ = Reflect::set(&payload, &"threshold".into(), &view.threshold.into());
    let _ = Reflect::set(
        &payload,
        &"description".into(),
        &view.description.clone().into(),
    );
    let _ = Reflect::set(&payload, &"active".into(), &view.active.into());
    payload.into()
}
