use crate::web_bridge::{RuntimeCommand, take_runtime_commands};
use crate::{GameState, RuntimeConfig, RuntimeLocale, RuntimeStarterDoctrine};
use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub struct StarterScenePlugin;

const BOARD_ROWS: usize = 4;
const BOARD_COLS: usize = 7;
const CELL_SIZE: f32 = 140.0;
const CELL_PADDING: f32 = 16.0;
const UNIT_SIZE_RATIO: f32 = 0.64;
const SHOP_SIZE: usize = 4;
const BENCH_CAPACITY: usize = 6;
const BUY_COST: u32 = 3;
const REROLL_COST: u32 = 1;
const BUY_XP_COST: u32 = 4;
const BUY_XP_AMOUNT: u32 = 4;
const SELL_VALUE_BASE: u32 = 2;
const STARTING_GOLD: u32 = 10;
const STARTING_HEALTH: u32 = 24;
const STARTING_SUPPLIES: u32 = 3;
const STARTING_MEDICAL: u32 = 1;
const ROUND_BASE_INCOME: u32 = 4;
const PASSIVE_ROUND_XP: u32 = 1;
const MAX_INTEREST_INCOME: u32 = 3;
const COMBAT_INTERVAL: f32 = 0.7;
const TRAIT_THRESHOLD: usize = 2;
const TRAIT_CAPSTONE_THRESHOLD: usize = 4;
const MAX_STARS: u8 = 3;
const FINAL_ROUND: u32 = 8;
const SECURED_LOOT_SCORE: u32 = 30;

const PLAYER_SLOTS: [(usize, usize); 5] = [(0, 1), (1, 1), (2, 1), (3, 1), (1, 2)];
const ENEMY_SLOTS: [(usize, usize); 5] = [(0, 5), (1, 5), (2, 5), (3, 5), (2, 4)];

fn localized(locale: RuntimeLocale, en: &'static str, zh: &'static str) -> &'static str {
    match locale {
        RuntimeLocale::En => en,
        RuntimeLocale::ZhCn => zh,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RunModifierKind {
    RichOpening,
    ThinBench,
    DawnSurge,
    DuskSurge,
    GlassCannon,
    AugmentStorm,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RoundEventKind {
    Standard,
    TrainingDay,
    SpoilsOfWar,
    HighRollMarket,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum RoundOutcome {
    Victory,
    Defeat,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoundHistoryEntry {
    round: u32,
    result: RoundOutcome,
    income_total: u32,
    threat: u32,
    summary: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum RunOperationKind {
    SteadySearch,
    DeepRaid,
    FieldCache,
    TacticalTransfer,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct CombatPerformanceEntry {
    agent_id: u64,
    battle_instance_id: u64,
    archetype: UnitArchetype,
    stars: u8,
    damage_dealt: u32,
    damage_taken: u32,
    healing_done: u32,
    kills: u32,
}

impl Default for CombatPerformanceEntry {
    fn default() -> Self {
        Self {
            agent_id: 0,
            battle_instance_id: 0,
            archetype: UnitArchetype::VerdantBruiser,
            stars: 1,
            damage_dealt: 0,
            damage_taken: 0,
            healing_done: 0,
            kills: 0,
        }
    }
}

fn default_run_modifier() -> RunModifierKind {
    RunModifierKind::RichOpening
}

fn default_starter_doctrine() -> RuntimeStarterDoctrine {
    RuntimeStarterDoctrine::Balanced
}

fn default_supplies() -> u32 {
    STARTING_SUPPLIES
}

fn default_medical() -> u32 {
    STARTING_MEDICAL
}

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

#[derive(Resource, Clone, Debug, Serialize, Deserialize)]
pub struct CombatState {
    pub phase: CombatPhase,
    pub round: u32,
    pub run_number: u32,
    #[serde(default = "default_run_modifier")]
    pub run_modifier: RunModifierKind,
    #[serde(default = "default_starter_doctrine")]
    pub starter_doctrine: RuntimeStarterDoctrine,
    pub run_over: bool,
    pub run_result: RunResult,
    pub player_health: u32,
    pub enemy_health: u32,
    pub gold: u32,
    pub score: u32,
    pub level: u32,
    pub xp: u32,
    pub deployment_cap: usize,
    pub win_streak: u32,
    pub loss_streak: u32,
    pub player_units: usize,
    pub enemy_units: usize,
    #[serde(default)]
    pub free_reroll_available: bool,
    #[serde(default = "default_supplies")]
    pub supplies: u32,
    #[serde(default = "default_medical")]
    pub medical: u32,
    #[serde(default)]
    pub contamination: u32,
    #[serde(default)]
    pub secured_loot: u32,
    #[serde(default)]
    pub unsecured_loot: u32,
    #[serde(default)]
    operation_cards: Vec<RunOperationKind>,
    #[serde(default)]
    selected_operation: Option<RunOperationKind>,
    #[serde(default)]
    operation_bonus_secured_on_win: u32,
    #[serde(default)]
    operation_bonus_unsecured_on_win: u32,
    #[serde(default)]
    operation_unsecured_loss_on_defeat: u32,
    #[serde(default)]
    operation_enemy_pressure: u32,
    #[serde(default)]
    pub income_base_total: u32,
    #[serde(default)]
    pub income_interest_total: u32,
    #[serde(default)]
    pub income_streak_total: u32,
    #[serde(default)]
    pub income_modifier_total: u32,
    #[serde(default)]
    pub income_event_total: u32,
    #[serde(default)]
    pub active_directive: Option<CombatDirectiveOrder>,
    #[serde(default)]
    pub queued_directives: Vec<CombatDirectiveOrder>,
    #[serde(default)]
    pub recent_highlights: Vec<String>,
    #[serde(default)]
    pub round_history: Vec<RoundHistoryEntry>,
    #[serde(default)]
    performance_log: Vec<CombatPerformanceEntry>,
    #[serde(default)]
    pub round_diagnosis: String,
    pub status: String,
}

impl Default for CombatState {
    fn default() -> Self {
        Self {
            phase: CombatPhase::Preparation,
            round: 1,
            run_number: 1,
            run_modifier: default_run_modifier(),
            starter_doctrine: RuntimeStarterDoctrine::Balanced,
            run_over: false,
            run_result: RunResult::Active,
            player_health: STARTING_HEALTH,
            enemy_health: STARTING_HEALTH,
            gold: STARTING_GOLD,
            score: 0,
            level: 1,
            xp: 0,
            deployment_cap: deploy_cap_for_level(1),
            win_streak: 0,
            loss_streak: 0,
            player_units: 0,
            enemy_units: 0,
            free_reroll_available: false,
            supplies: STARTING_SUPPLIES,
            medical: STARTING_MEDICAL,
            contamination: 0,
            secured_loot: 0,
            unsecured_loot: 0,
            operation_cards: Vec::new(),
            selected_operation: None,
            operation_bonus_secured_on_win: 0,
            operation_bonus_unsecured_on_win: 0,
            operation_unsecured_loss_on_defeat: 0,
            operation_enemy_pressure: 0,
            income_base_total: 0,
            income_interest_total: 0,
            income_streak_total: 0,
            income_modifier_total: 0,
            income_event_total: 0,
            active_directive: None,
            queued_directives: Vec::new(),
            recent_highlights: Vec::new(),
            round_history: Vec::new(),
            performance_log: Vec::new(),
            round_diagnosis: "Build toward a two-piece trait and preserve board tempo.".to_owned(),
            status: "Board ready. Draft another unit or start combat.".to_owned(),
        }
    }
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeUnitView {
    pub agent_id: String,
    pub battle_instance_id: String,
    pub label: String,
    pub archetype: String,
    pub faction: String,
    pub role: String,
    pub skill: String,
    pub tempo_label: String,
    pub cast_state: String,
    pub target_rule: String,
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
    pub capstone_threshold: usize,
    pub tier: u32,
    pub description: String,
    pub active: bool,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeAugmentView {
    pub key: String,
    pub label: String,
    pub description: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeRunModifierView {
    pub key: String,
    pub label: String,
    pub description: String,
    pub route_hint: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeStarterDoctrineView {
    pub key: String,
    pub label: String,
    pub description: String,
    pub opening_plan: String,
    pub bonus_label: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeRoundEventView {
    pub key: String,
    pub label: String,
    pub description: String,
    pub stakes: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeRoundSummaryView {
    pub round: u32,
    pub result: String,
    pub income_total: u32,
    pub threat: u32,
    pub summary: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimePerformanceView {
    pub agent_id: String,
    pub battle_instance_id: String,
    pub label: String,
    pub damage_dealt: u32,
    pub damage_taken: u32,
    pub healing_done: u32,
    pub kills: u32,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeOperationView {
    pub key: String,
    pub label: String,
    pub description: String,
    pub reward_label: String,
    pub risk_label: String,
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
#[derive(Clone, Debug)]
pub struct RuntimeCombatDirectiveView {
    pub key: String,
    pub label: String,
    pub description: String,
    pub lane: Option<String>,
    pub duration_ticks: u32,
    pub remaining_ticks: u32,
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
    pub run_number: u32,
    pub level: u32,
    pub xp: u32,
    pub xp_to_next_level: u32,
    pub max_level: u32,
    pub reroll_cost: u32,
    pub xp_buy_cost: u32,
    pub shop_locked: bool,
    pub shop_offers: Vec<RuntimeUnitView>,
    pub bench_units: Vec<RuntimeUnitView>,
    pub player_board: Vec<Option<RuntimeUnitView>>,
    pub enemy_board: Vec<Option<RuntimeUnitView>>,
    pub unit_roster: Vec<RuntimeUnitView>,
    pub active_traits: Vec<RuntimeTraitView>,
    pub selected_augments: Vec<RuntimeAugmentView>,
    pub pending_augments: Vec<RuntimeAugmentView>,
    pub operation_cards: Vec<RuntimeOperationView>,
    pub selected_operation: Option<RuntimeOperationView>,
    pub starter_doctrine: RuntimeStarterDoctrineView,
    pub run_modifier: RuntimeRunModifierView,
    pub round_event: RuntimeRoundEventView,
    pub round_history: Vec<RuntimeRoundSummaryView>,
    pub performance_leaders: Vec<RuntimePerformanceView>,
    pub active_combat_directive: Option<RuntimeCombatDirectiveView>,
    pub queued_combat_directives: Vec<RuntimeCombatDirectiveView>,
    pub combat_feed: Vec<String>,
    pub augment_draft_round: u32,
    pub enemy_threat: u32,
    pub enemy_intent: String,
    pub bench_capacity: usize,
    pub board_capacity: usize,
    pub deployment_cap: usize,
    pub supplies: u32,
    pub medical: u32,
    pub contamination: u32,
    pub secured_loot: u32,
    pub unsecured_loot: u32,
    pub streak: i32,
    pub base_income: u32,
    pub interest_income: u32,
    pub streak_income: u32,
    pub income_base_total: u32,
    pub income_interest_total: u32,
    pub income_streak_total: u32,
    pub income_modifier_total: u32,
    pub income_event_total: u32,
    pub round_diagnosis: String,
    pub round_resolved: bool,
    pub run_over: bool,
    pub run_result: String,
    pub completed: bool,
    pub serialized_run_state: Option<String>,
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
            run_number: 1,
            level: 1,
            xp: 0,
            xp_to_next_level: xp_to_next_level(1),
            max_level: max_level(),
            reroll_cost: REROLL_COST,
            xp_buy_cost: BUY_XP_COST,
            shop_locked: false,
            shop_offers: Vec::new(),
            bench_units: Vec::new(),
            player_board: vec![None; PLAYER_SLOTS.len()],
            enemy_board: vec![None; ENEMY_SLOTS.len()],
            unit_roster: Vec::new(),
            active_traits: Vec::new(),
            selected_augments: Vec::new(),
            pending_augments: Vec::new(),
            operation_cards: Vec::new(),
            selected_operation: None,
            starter_doctrine: RuntimeStarterDoctrine::Balanced.as_view(RuntimeLocale::En),
            run_modifier: RuntimeRunModifierView {
                key: "rich-opening".to_owned(),
                label: "Rich Opening".to_owned(),
                description: "Open with more gold and pressure an early tempo line.".to_owned(),
                route_hint: "Economy greed into a late spike.".to_owned(),
            },
            round_event: RuntimeRoundEventView {
                key: "standard".to_owned(),
                label: "Standard Round".to_owned(),
                description: "No temporary event modifier this round.".to_owned(),
                stakes: "Play the strongest board and convert clean tempo.".to_owned(),
            },
            round_history: Vec::new(),
            performance_leaders: Vec::new(),
            active_combat_directive: None,
            queued_combat_directives: Vec::new(),
            combat_feed: Vec::new(),
            augment_draft_round: 0,
            enemy_threat: 0,
            enemy_intent: "Awaiting board allocation.".to_owned(),
            bench_capacity: BENCH_CAPACITY,
            board_capacity: PLAYER_SLOTS.len(),
            deployment_cap: deploy_cap_for_level(1),
            supplies: STARTING_SUPPLIES,
            medical: STARTING_MEDICAL,
            contamination: 0,
            secured_loot: 0,
            unsecured_loot: 0,
            streak: 0,
            base_income: ROUND_BASE_INCOME,
            interest_income: 0,
            streak_income: 0,
            income_base_total: 0,
            income_interest_total: 0,
            income_streak_total: 0,
            income_modifier_total: 0,
            income_event_total: 0,
            round_diagnosis: "Build toward a two-piece trait and preserve board tempo.".to_owned(),
            round_resolved: false,
            run_over: false,
            run_result: RunResult::Active.as_str().to_owned(),
            completed: false,
            serialized_run_state: None,
        }
    }
}

#[derive(Resource, Default, Clone, Debug, Serialize, Deserialize)]
struct ShopState {
    offers: Vec<UnitInstance>,
    reroll_cursor: usize,
    locked: bool,
}

#[derive(Resource, Clone, Debug, Serialize, Deserialize)]
struct IdentityState {
    next_agent_id: u64,
    next_battle_instance_id: u64,
}

impl Default for IdentityState {
    fn default() -> Self {
        Self {
            next_agent_id: 1,
            next_battle_instance_id: 1,
        }
    }
}

#[derive(Resource, Default, Clone, Debug, Serialize, Deserialize)]
struct PlayerSquad {
    board: [Option<UnitInstance>; PLAYER_SLOTS.len()],
    bench: Vec<UnitInstance>,
}

#[derive(Resource, Default, Clone, Debug, Serialize, Deserialize)]
struct EnemySquad {
    units: Vec<UnitInstance>,
}

#[derive(Resource, Default, Clone, Debug, Serialize, Deserialize)]
struct AugmentState {
    selected: Vec<AugmentKind>,
    pending_choices: Vec<AugmentKind>,
    pending_round: Option<u32>,
    draft_cursor: usize,
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
    slot_index: usize,
    agent_id: u64,
    battle_instance_id: u64,
    archetype: UnitArchetype,
    stars: u8,
    action_counter: u32,
    health: i32,
    max_health: i32,
    attack: u32,
}

#[derive(Component)]
struct UnitHealthFrame;

#[derive(Component)]
struct UnitHealthFill;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunResult {
    Active,
    Victory,
    Defeat,
}

impl RunResult {
    fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Victory => "victory",
            Self::Defeat => "defeat",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CombatDirective {
    FocusBackline,
    HoldSkills,
    FallbackLeft,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CombatDirectiveLane {
    Left,
    Center,
    Right,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CombatDirectiveOrder {
    pub directive: CombatDirective,
    pub lane: Option<CombatDirectiveLane>,
    pub duration_ticks: u32,
    pub remaining_ticks: u32,
}

impl CombatDirective {
    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    pub fn from_key(value: &str) -> Option<Self> {
        match value {
            "focus-backline" => Some(Self::FocusBackline),
            "hold-skills" => Some(Self::HoldSkills),
            "fallback-left" => Some(Self::FallbackLeft),
            _ => None,
        }
    }

    fn key(self) -> &'static str {
        match self {
            Self::FocusBackline => "focus-backline",
            Self::HoldSkills => "hold-skills",
            Self::FallbackLeft => "fallback-left",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::FocusBackline => localized(locale, "Focus Backline", "集火后排"),
            Self::HoldSkills => localized(locale, "Hold Skills", "保留技能"),
            Self::FallbackLeft => localized(locale, "Fallback Left", "左翼后撤"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::FocusBackline => localized(
                locale,
                "Player units bias target selection toward the enemy backline, optionally favoring a lane.",
                "我方单位会优先把火力压向敌方后排，并可额外偏向指定一路。",
            ),
            Self::HoldSkills => localized(
                locale,
                "Player units suppress cadence-based skill triggers, optionally only on one lane.",
                "我方单位会压住按节奏触发的技能，也可以只作用在某一路。",
            ),
            Self::FallbackLeft => localized(
                locale,
                "Enemy units deprioritize the protected lane, letting that flank fall back safely.",
                "敌方会降低对受保护一路的优先级，让这一翼先后撤。",
            ),
        }
    }

    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    fn default_duration_ticks(self) -> u32 {
        match self {
            Self::FocusBackline => 3,
            Self::HoldSkills => 2,
            Self::FallbackLeft => 3,
        }
    }
}

impl CombatDirectiveLane {
    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    pub fn from_key(value: &str) -> Option<Self> {
        match value {
            "left" => Some(Self::Left),
            "center" => Some(Self::Center),
            "right" => Some(Self::Right),
            _ => None,
        }
    }

    fn key(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Center => "center",
            Self::Right => "right",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Left => localized(locale, "Left Lane", "左路"),
            Self::Center => localized(locale, "Center Lane", "中路"),
            Self::Right => localized(locale, "Right Lane", "右路"),
        }
    }
}

impl CombatDirectiveOrder {
    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    pub fn new(
        directive: CombatDirective,
        lane: Option<CombatDirectiveLane>,
        duration_ticks: Option<u32>,
    ) -> Self {
        let normalized_ticks = duration_ticks
            .unwrap_or_else(|| directive.default_duration_ticks())
            .clamp(1, 6);
        Self {
            directive,
            lane,
            duration_ticks: normalized_ticks,
            remaining_ticks: normalized_ticks,
        }
    }

    fn label(self, locale: RuntimeLocale) -> String {
        match self.lane {
            Some(lane) => format!("{} · {}", self.directive.label(locale), lane.label(locale)),
            None => self.directive.label(locale).to_owned(),
        }
    }

    fn description(self, locale: RuntimeLocale) -> String {
        match locale {
            RuntimeLocale::En => format!(
                "{} Runs for {} ticks.",
                self.directive.description(locale),
                self.duration_ticks
            ),
            RuntimeLocale::ZhCn => format!(
                "{} 持续 {} 个 tick。",
                self.directive.description(locale),
                self.duration_ticks
            ),
        }
    }

    fn staged_status_line(self, locale: RuntimeLocale, queued_count: usize) -> String {
        match locale {
            RuntimeLocale::En => format!(
                "Combat plan staged: {} for {} ticks{}.",
                self.label(locale),
                self.duration_ticks,
                if queued_count > 0 {
                    format!(" with {} queued follow-up step(s)", queued_count)
                } else {
                    String::new()
                }
            ),
            RuntimeLocale::ZhCn => format!(
                "战术计划已预设：{}，持续 {} 个 tick{}。",
                self.label(locale),
                self.duration_ticks,
                if queued_count > 0 {
                    format!("，后续还有 {} 步", queued_count)
                } else {
                    String::new()
                }
            ),
        }
    }

    fn live_status_line(self, locale: RuntimeLocale, queued_count: usize) -> String {
        match locale {
            RuntimeLocale::En => format!(
                "Directive live: {}. {} tick(s) remain{}.",
                self.label(locale),
                self.remaining_ticks,
                if queued_count > 0 {
                    format!(" with {} queued step(s)", queued_count)
                } else {
                    String::new()
                }
            ),
            RuntimeLocale::ZhCn => format!(
                "战术生效：{}。剩余 {} 个 tick{}。",
                self.label(locale),
                self.remaining_ticks,
                if queued_count > 0 {
                    format!("，后续还有 {} 步", queued_count)
                } else {
                    String::new()
                }
            ),
        }
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeCombatDirectiveView {
        RuntimeCombatDirectiveView {
            key: self.directive.key().to_owned(),
            label: self.label(locale),
            description: self.description(locale),
            lane: self.effective_lane().map(|lane| lane.key().to_owned()),
            duration_ticks: self.duration_ticks,
            remaining_ticks: self.remaining_ticks,
        }
    }

    fn effective_lane(self) -> Option<CombatDirectiveLane> {
        self.lane.or(match self.directive {
            CombatDirective::FallbackLeft => Some(CombatDirectiveLane::Left),
            _ => None,
        })
    }
}

fn replace_combat_plan(
    combat: &mut CombatState,
    plan: Vec<CombatDirectiveOrder>,
    locale: RuntimeLocale,
) {
    let mut steps = plan.into_iter();
    combat.active_directive = steps.next();
    combat.queued_directives = steps.collect();
    combat.status = combat_plan_status_line(combat, locale);
}

fn clear_combat_plan(combat: &mut CombatState, locale: RuntimeLocale) {
    combat.active_directive = None;
    combat.queued_directives.clear();
    combat.status = localized(
        locale,
        "Combat plan cleared. Units return to baseline combat logic.",
        "战术计划已清空，部队恢复默认战斗逻辑。",
    )
    .to_owned();
}

fn combat_plan_status_line(combat: &CombatState, locale: RuntimeLocale) -> String {
    match combat.active_directive {
        Some(directive) => {
            let queued_count = combat.queued_directives.len();
            match combat.phase {
                CombatPhase::Combat => directive.live_status_line(locale, queued_count),
                _ => directive.staged_status_line(locale, queued_count),
            }
        }
        None => localized(
            locale,
            "Combat plan cleared. Units return to baseline combat logic.",
            "战术计划已清空，部队恢复默认战斗逻辑。",
        )
        .to_owned(),
    }
}

fn advance_combat_plan_tick(combat: &mut CombatState) {
    let Some(mut directive) = combat.active_directive else {
        return;
    };

    directive.remaining_ticks = directive.remaining_ticks.saturating_sub(1);
    if directive.remaining_ticks > 0 {
        combat.active_directive = Some(directive);
        return;
    }

    combat.active_directive = if combat.queued_directives.is_empty() {
        None
    } else {
        Some(combat.queued_directives.remove(0))
    };
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum UnitOwner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum AugmentKind {
    CompoundInterest,
    VanguardDoctrine,
    SkirmisherDrive,
    DawnPulse,
    DuskPact,
    EmergencyHull,
}

impl AugmentKind {
    fn all() -> [Self; 6] {
        [
            Self::CompoundInterest,
            Self::VanguardDoctrine,
            Self::SkirmisherDrive,
            Self::DawnPulse,
            Self::DuskPact,
            Self::EmergencyHull,
        ]
    }

    fn key(self) -> &'static str {
        match self {
            Self::CompoundInterest => "compound-interest",
            Self::VanguardDoctrine => "vanguard-doctrine",
            Self::SkirmisherDrive => "skirmisher-drive",
            Self::DawnPulse => "dawn-pulse",
            Self::DuskPact => "dusk-pact",
            Self::EmergencyHull => "emergency-hull",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::CompoundInterest => localized(locale, "Compound Interest", "复利协议"),
            Self::VanguardDoctrine => localized(locale, "Vanguard Doctrine", "前线教范"),
            Self::SkirmisherDrive => localized(locale, "Skirmisher Drive", "游击驱动"),
            Self::DawnPulse => localized(locale, "Dawn Pulse", "黎明脉冲"),
            Self::DuskPact => localized(locale, "Dusk Pact", "黄昏契约"),
            Self::EmergencyHull => localized(locale, "Emergency Hull", "紧急加固"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::CompoundInterest => localized(
                locale,
                "Gain 6 gold now and raise max interest income by 1.",
                "立刻获得 6 金币，并让利息上限额外 +1。",
            ),
            Self::VanguardDoctrine => localized(
                locale,
                "Your Vanguard units gain +4 health total and mitigate 1 extra damage.",
                "你的前排单位总计获得 +4 生命，并额外减免 1 点伤害。",
            ),
            Self::SkirmisherDrive => localized(
                locale,
                "Your Skirmisher units gain +1 attack and bias toward the backline.",
                "你的游击单位获得 +1 攻击，并会更主动切向后排。",
            ),
            Self::DawnPulse => localized(
                locale,
                "Your Dawn units gain +1 attack and heal 1 whenever their cadence skill triggers.",
                "你的黎明单位获得 +1 攻击，并在节奏技能触发时回复 1 点生命。",
            ),
            Self::DuskPact => localized(
                locale,
                "Your Dusk units gain +1 attack, +1 health, and hit harder on cadence spikes.",
                "你的黄昏单位获得 +1 攻击、+1 生命，并在节奏爆发时打得更重。",
            ),
            Self::EmergencyHull => localized(
                locale,
                "Restore 6 commander health immediately, up to 30.",
                "立刻回复 6 点指挥官生命，上限 30。",
            ),
        }
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeAugmentView {
        RuntimeAugmentView {
            key: self.key().to_owned(),
            label: self.label(locale).to_owned(),
            description: self.description(locale).to_owned(),
        }
    }
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

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            UnitFaction::Dawn => localized(locale, "Dawn Circuit", "黎明回路"),
            UnitFaction::Dusk => localized(locale, "Dusk Bastion", "黄昏壁垒"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            UnitFaction::Dawn => localized(
                locale,
                "2 Dawn: Dawn allies gain +1 attack. 4 Dawn: +2 attack total and cadence heals.",
                "2 黎明：黎明友军获得 +1 攻击。4 黎明：总计 +2 攻击，并在节奏触发时治疗。",
            ),
            UnitFaction::Dusk => localized(
                locale,
                "2 Dusk: Dusk allies gain +2 health. 4 Dusk: gain more health, +1 attack, and burst harder.",
                "2 黄昏：黄昏友军获得 +2 生命。4 黄昏：再获更多生命、+1 攻击，并拥有更强爆发。",
            ),
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

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            UnitRole::Vanguard => localized(locale, "Vanguard Line", "前排战线"),
            UnitRole::Skirmisher => localized(locale, "Skirmisher Line", "游击战线"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            UnitRole::Vanguard => localized(
                locale,
                "2 Vanguards: all allies gain +2 health. 4 Vanguards: +4 health total and vanguards mitigate more.",
                "2 前排：所有友军获得 +2 生命。4 前排：总计 +4 生命，且前排减伤更强。",
            ),
            UnitRole::Skirmisher => localized(
                locale,
                "2 Skirmishers: all allies gain +1 attack. 4 Skirmishers: skirmishers gain extra attack and dive deeper.",
                "2 游击：所有友军获得 +1 攻击。4 游击：游击单位额外获得攻击并更深入切后排。",
            ),
        }
    }
}

impl RuntimeStarterDoctrine {
    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Balanced => localized(locale, "Balanced Prep", "均衡备战"),
            Self::DawnRelay => localized(locale, "Dawn Relay", "黎明接力"),
            Self::DuskRaid => localized(locale, "Dusk Raid", "黄昏突袭"),
            Self::IronWall => localized(locale, "Iron Wall", "铁壁开局"),
            Self::OpenMarket => localized(locale, "Open Market", "开放黑市"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Balanced => localized(
                locale,
                "Stable opener with no forced bonus. Stay flexible until a route clearly appears.",
                "稳定开局，没有强制加成。等路线信号足够清晰后再锁方向。",
            ),
            Self::DawnRelay => localized(
                locale,
                "Open with Dawn sustain pieces and a little more commander life to hold streaks.",
                "以黎明续航组件开局，并带着更多指挥官血量去稳住节奏。",
            ),
            Self::DuskRaid => localized(
                locale,
                "Open with a Dusk backline pair and one extra gold to buy early tempo.",
                "以黄昏后排对子开局，并带 1 金币去抢前中期节奏。",
            ),
            Self::IronWall => localized(
                locale,
                "Open with a tank-heavy shell and extra commander life for slower scaling games.",
                "以前排重壳开局，并带额外血量去打更慢的养成局。",
            ),
            Self::OpenMarket => localized(
                locale,
                "Open with extra gold and flexible backliners so you can pivot around the first shops.",
                "带着更多金币和灵活后排开局，围绕前几轮商店快速转型。",
            ),
        }
    }

    fn opening_plan(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Balanced => localized(
                locale,
                "Field the strongest pair and chase whichever 4-piece capstone comes together first.",
                "先上最强对子，再追最先成型的四件套满羁绊。",
            ),
            Self::DawnRelay => localized(
                locale,
                "Use the early sustain shell to protect HP, then complete Dawn or Vanguard first.",
                "先用续航壳保血，再优先补齐黎明或前排羁绊。",
            ),
            Self::DuskRaid => localized(
                locale,
                "Spend for an early spike if the Dusk shop appears, then keep pressure on the backline race.",
                "如果黄昏商店来了就果断花钱冲强度，然后持续打后排爆发竞速。",
            ),
            Self::IronWall => localized(
                locale,
                "Anchor the board with tanks, then decide whether to branch into Dawn sustain or Dusk bruisers.",
                "先用前排站稳，再决定转向黎明续航还是黄昏重装。",
            ),
            Self::OpenMarket => localized(
                locale,
                "Use the extra gold to hit pairs early and pivot hard around your first augment or event shop.",
                "用额外金币尽快做出对子，并围绕第一轮强化或事件商店大转型。",
            ),
        }
    }

    fn bonus_label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Balanced => localized(locale, "No extra opener bonus", "没有额外开局加成"),
            Self::DawnRelay => localized(locale, "+2 commander health", "指挥官生命 +2"),
            Self::DuskRaid => localized(locale, "+1 opening gold", "开局金币 +1"),
            Self::IronWall => localized(locale, "+3 commander health", "指挥官生命 +3"),
            Self::OpenMarket => localized(locale, "+2 opening gold", "开局金币 +2"),
        }
    }

    fn opening_gold_bonus(self) -> u32 {
        match self {
            Self::DuskRaid => 1,
            Self::OpenMarket => 2,
            _ => 0,
        }
    }

    fn opening_health_bonus(self) -> u32 {
        match self {
            Self::DawnRelay => 2,
            Self::IronWall => 3,
            _ => 0,
        }
    }

    fn starting_bench(self, identity: &mut IdentityState) -> Vec<UnitInstance> {
        match self {
            Self::Balanced => vec![
                UnitInstance::new(UnitArchetype::VerdantBruiser, identity),
                UnitInstance::new(UnitArchetype::EmberMedic, identity),
            ],
            Self::DawnRelay => vec![
                UnitInstance::new(UnitArchetype::VerdantBruiser, identity),
                UnitInstance::new(UnitArchetype::LumenSentinel, identity),
            ],
            Self::DuskRaid => vec![
                UnitInstance::new(UnitArchetype::AshDuelist, identity),
                UnitInstance::new(UnitArchetype::ShadeRunner, identity),
            ],
            Self::IronWall => vec![
                UnitInstance::new(UnitArchetype::IronVanguard, identity),
                UnitInstance::new(UnitArchetype::GraveWarden, identity),
            ],
            Self::OpenMarket => vec![
                UnitInstance::new(UnitArchetype::SignalRanger, identity),
                UnitInstance::new(UnitArchetype::FrostOracle, identity),
            ],
        }
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeStarterDoctrineView {
        RuntimeStarterDoctrineView {
            key: self.code().to_owned(),
            label: self.label(locale).to_owned(),
            description: self.description(locale).to_owned(),
            opening_plan: self.opening_plan(locale).to_owned(),
            bonus_label: self.bonus_label(locale).to_owned(),
        }
    }
}

impl RunOperationKind {
    fn key(self) -> &'static str {
        match self {
            Self::SteadySearch => "steady-search",
            Self::DeepRaid => "deep-raid",
            Self::FieldCache => "field-cache",
            Self::TacticalTransfer => "tactical-transfer",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::SteadySearch => localized(locale, "Steady Search", "稳健搜索"),
            Self::DeepRaid => localized(locale, "Deep Raid", "深层突入"),
            Self::FieldCache => localized(locale, "Field Cache", "野战补给"),
            Self::TacticalTransfer => localized(locale, "Tactical Transfer", "战术转运"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::SteadySearch => localized(
                locale,
                "Low-risk sweep that pads gold and supplies before the next fight.",
                "低风险清扫，先补金币和补给，再稳稳进入下一战。",
            ),
            Self::DeepRaid => localized(
                locale,
                "Push into the black zone for unsecured loot and a wider market, but enemy pressure rises immediately.",
                "深入黑区换高价值未锁定收益和更宽商店，但敌方压力会立刻抬高。",
            ),
            Self::FieldCache => localized(
                locale,
                "Stabilize with medical supplies and field treatment before the next engagement.",
                "先补医疗并做野战处理，再准备下一场战斗。",
            ),
            Self::TacticalTransfer => localized(
                locale,
                "Convert carried loot into secured value now, but accept a narrower shopping window.",
                "先把携行收益转成已锁定价值，但商店窗口会被压缩。",
            ),
        }
    }

    fn reward_label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::SteadySearch => localized(locale, "+2 gold, +1 supplies", "+2 金币，+1 补给"),
            Self::DeepRaid => localized(
                locale,
                "+2 unsecured loot, reroll into a wider market",
                "+2 未锁定收益，并刷新成更宽的商店",
            ),
            Self::FieldCache => localized(
                locale,
                "+1 medical, clear 1 contamination, win grants +1 unsecured loot",
                "+1 医疗，清除 1 点污染，获胜再得 +1 未锁定收益",
            ),
            Self::TacticalTransfer => localized(
                locale,
                "Secure up to 2 loot now, win secures 1 more",
                "立刻锁定最多 2 份收益，获胜再锁定 1 份",
            ),
        }
    }

    fn risk_label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::SteadySearch => localized(
                locale,
                "Safe line. Converts 1 unsecured loot on a win.",
                "稳线。若本回合获胜，可再锁定 1 份未锁定收益。",
            ),
            Self::DeepRaid => localized(
                locale,
                "Gain 1 contamination, stronger enemy board, and lose 2 unsecured loot if you fail.",
                "获得 1 点污染，敌军更强，失败会损失 2 份未锁定收益。",
            ),
            Self::FieldCache => localized(
                locale,
                "No extra tempo now. The payoff comes from surviving cleanly.",
                "当下没有额外战力，收益来自稳稳打完这一回合。",
            ),
            Self::TacticalTransfer => localized(
                locale,
                "Shop narrows by one offer this round.",
                "本回合商店会少 1 个招募位。",
            ),
        }
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeOperationView {
        RuntimeOperationView {
            key: self.key().to_owned(),
            label: self.label(locale).to_owned(),
            description: self.description(locale).to_owned(),
            reward_label: self.reward_label(locale).to_owned(),
            risk_label: self.risk_label(locale).to_owned(),
        }
    }
}

impl RunModifierKind {
    fn all() -> [Self; 6] {
        [
            Self::RichOpening,
            Self::ThinBench,
            Self::DawnSurge,
            Self::DuskSurge,
            Self::GlassCannon,
            Self::AugmentStorm,
        ]
    }

    fn for_run(run_number: u32) -> Self {
        let modifiers = Self::all();
        modifiers[((run_number.max(1) - 1) as usize) % modifiers.len()]
    }

    fn key(self) -> &'static str {
        match self {
            Self::RichOpening => "rich-opening",
            Self::ThinBench => "thin-bench",
            Self::DawnSurge => "dawn-surge",
            Self::DuskSurge => "dusk-surge",
            Self::GlassCannon => "glass-cannon",
            Self::AugmentStorm => "augment-storm",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::RichOpening => localized(locale, "Rich Opening", "富集开局"),
            Self::ThinBench => localized(locale, "Thin Bench", "短备战席"),
            Self::DawnSurge => localized(locale, "Dawn Surge", "黎明激涌"),
            Self::DuskSurge => localized(locale, "Dusk Surge", "黄昏激涌"),
            Self::GlassCannon => localized(locale, "Glass Cannon", "高压脆皮"),
            Self::AugmentStorm => localized(locale, "Augment Storm", "强化风暴"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::RichOpening => localized(
                locale,
                "Start with +4 gold and push for a greed economy opening.",
                "开局额外 +4 金币，鼓励你走更贪的经济开局。",
            ),
            Self::ThinBench => localized(
                locale,
                "Bench shrinks to 4 slots, but each round pays +1 bonus gold.",
                "备战席缩到 4 格，但每回合会额外支付 +1 金币。",
            ),
            Self::DawnSurge => localized(
                locale,
                "Shops bias toward Dawn units and Dawn boards hit harder.",
                "商店更偏向黎明单位，黎明阵容的输出也更强。",
            ),
            Self::DuskSurge => localized(
                locale,
                "Shops bias toward Dusk units and Dusk boards spike faster.",
                "商店更偏向黄昏单位，黄昏阵容的爆发也更快。",
            ),
            Self::GlassCannon => localized(
                locale,
                "All units gain attack but lose health, turning fights into races.",
                "全体单位提高攻击但降低生命，战斗会变成抢杀竞速。",
            ),
            Self::AugmentStorm => localized(
                locale,
                "Augment drafts appear more often, enabling flex pivots.",
                "强化草案出现得更频繁，更适合中途转型。",
            ),
        }
    }

    fn route_hint(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::RichOpening => localized(
                locale,
                "Economy greed into a late spike.",
                "经济贪法，后期冲一波强度。",
            ),
            Self::ThinBench => localized(
                locale,
                "Tempo discipline with fast board decisions.",
                "靠更快的上板与取舍打节奏。",
            ),
            Self::DawnSurge => localized(
                locale,
                "Lean into Dawn sustain and stable frontline pressure.",
                "押黎明续航和稳定前压。",
            ),
            Self::DuskSurge => localized(
                locale,
                "Lean into Dusk burst and quick skirmisher spikes.",
                "押黄昏爆发和游击提速。",
            ),
            Self::GlassCannon => localized(
                locale,
                "Play for burst races and exact positioning.",
                "打爆发竞速，站位更重要。",
            ),
            Self::AugmentStorm => localized(
                locale,
                "Stay flexible and pivot around augment hits.",
                "保持灵活，围绕强化命中转型。",
            ),
        }
    }

    fn opening_gold_bonus(self) -> u32 {
        match self {
            Self::RichOpening => 4,
            _ => 0,
        }
    }

    fn round_bonus_income(self) -> u32 {
        match self {
            Self::ThinBench => 1,
            _ => 0,
        }
    }

    fn bench_capacity(self) -> usize {
        match self {
            Self::ThinBench => 4,
            _ => BENCH_CAPACITY,
        }
    }

    fn shop_bias(self) -> Option<UnitFaction> {
        match self {
            Self::DawnSurge => Some(UnitFaction::Dawn),
            Self::DuskSurge => Some(UnitFaction::Dusk),
            _ => None,
        }
    }

    fn draft_rounds(self) -> &'static [u32] {
        match self {
            Self::AugmentStorm => &[2, 4, 6],
            _ => &[2, 5],
        }
    }

    fn attack_bonus(self, faction: UnitFaction) -> i32 {
        match self {
            Self::DawnSurge if faction == UnitFaction::Dawn => 1,
            Self::DuskSurge if faction == UnitFaction::Dusk => 1,
            Self::GlassCannon => 1,
            _ => 0,
        }
    }

    fn health_bonus(self, faction: UnitFaction) -> i32 {
        match self {
            Self::GlassCannon => -2,
            _ => {
                let _ = faction;
                0
            }
        }
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeRunModifierView {
        RuntimeRunModifierView {
            key: self.key().to_owned(),
            label: self.label(locale).to_owned(),
            description: self.description(locale).to_owned(),
            route_hint: self.route_hint(locale).to_owned(),
        }
    }
}

impl RoundEventKind {
    fn for_round(round: u32) -> Self {
        match round {
            2 | 5 => Self::TrainingDay,
            3 | 6 => Self::SpoilsOfWar,
            4 | 7 => Self::HighRollMarket,
            _ => Self::Standard,
        }
    }

    fn key(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::TrainingDay => "training-day",
            Self::SpoilsOfWar => "spoils-of-war",
            Self::HighRollMarket => "high-roll-market",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Standard => localized(locale, "Standard Round", "标准回合"),
            Self::TrainingDay => localized(locale, "Training Day", "训练日"),
            Self::SpoilsOfWar => localized(locale, "Spoils of War", "战利品回合"),
            Self::HighRollMarket => localized(locale, "High Roll Market", "高波动黑市"),
        }
    }

    fn description(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Standard => localized(
                locale,
                "No temporary event modifier this round.",
                "本回合没有额外事件规则。",
            ),
            Self::TrainingDay => localized(
                locale,
                "Buying XP grants +2 bonus XP this round.",
                "本回合购买经验会额外获得 +2 经验。",
            ),
            Self::SpoilsOfWar => localized(
                locale,
                "Winning this round grants +2 bonus gold on top of the usual rewards.",
                "本回合胜利会在常规奖励外额外获得 +2 金币。",
            ),
            Self::HighRollMarket => localized(
                locale,
                "The shop gains one extra offer and the first reroll costs 0 this round.",
                "本回合商店会多 1 个招募位，且第一次刷新免费。",
            ),
        }
    }

    fn stakes(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::Standard => localized(
                locale,
                "Play the strongest board and convert clean tempo.",
                "用最稳的棋盘去换取干净节奏。",
            ),
            Self::TrainingDay => localized(
                locale,
                "Level now if your board can hold, otherwise preserve enough gold to spike on the next shop.",
                "如果当前棋盘能稳住就升级，否则保留足够金币为下一轮商店冲强度。",
            ),
            Self::SpoilsOfWar => localized(
                locale,
                "A tempo win pays immediately, so spend for board strength if you are close.",
                "这一回合的节奏胜利会立刻返钱，差一点强度时值得补投资。",
            ),
            Self::HighRollMarket => localized(
                locale,
                "Use the free reroll and wider shop to finish pairs or hit a capstone piece.",
                "利用免费刷新和更宽商店，把对子补满或追到关键羁绊牌。",
            ),
        }
    }

    fn xp_bonus(self) -> u32 {
        match self {
            Self::TrainingDay => 2,
            _ => 0,
        }
    }

    fn victory_bonus_gold(self) -> u32 {
        match self {
            Self::SpoilsOfWar => 2,
            _ => 0,
        }
    }

    fn shop_size_bonus(self) -> usize {
        match self {
            Self::HighRollMarket => 1,
            _ => 0,
        }
    }

    fn grants_free_reroll(self) -> bool {
        matches!(self, Self::HighRollMarket)
    }

    fn as_view(self, locale: RuntimeLocale) -> RuntimeRoundEventView {
        RuntimeRoundEventView {
            key: self.key().to_owned(),
            label: self.label(locale).to_owned(),
            description: self.description(locale).to_owned(),
            stakes: self.stakes(locale).to_owned(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum UnitArchetype {
    VerdantBruiser,
    SignalRanger,
    AshDuelist,
    IronVanguard,
    FrostOracle,
    EmberMedic,
    VoltJuggler,
    GraveWarden,
    LumenSentinel,
    ShadeRunner,
}

impl UnitArchetype {
    fn all() -> [Self; 10] {
        [
            Self::SignalRanger,
            Self::AshDuelist,
            Self::IronVanguard,
            Self::FrostOracle,
            Self::VerdantBruiser,
            Self::EmberMedic,
            Self::VoltJuggler,
            Self::GraveWarden,
            Self::LumenSentinel,
            Self::ShadeRunner,
        ]
    }

    fn key(self) -> &'static str {
        match self {
            Self::VerdantBruiser => "verdant-bruiser",
            Self::SignalRanger => "signal-ranger",
            Self::AshDuelist => "ash-duelist",
            Self::IronVanguard => "iron-vanguard",
            Self::FrostOracle => "frost-oracle",
            Self::EmberMedic => "ember-medic",
            Self::VoltJuggler => "volt-juggler",
            Self::GraveWarden => "grave-warden",
            Self::LumenSentinel => "lumen-sentinel",
            Self::ShadeRunner => "shade-runner",
        }
    }

    fn label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser => localized(locale, "Verdant Bruiser", "翠卫斗士"),
            Self::SignalRanger => localized(locale, "Signal Ranger", "信号射手"),
            Self::AshDuelist => localized(locale, "Ash Duelist", "灰烬决斗者"),
            Self::IronVanguard => localized(locale, "Iron Vanguard", "钢铁先锋"),
            Self::FrostOracle => localized(locale, "Frost Oracle", "霜语先知"),
            Self::EmberMedic => localized(locale, "Ember Medic", "余烬医师"),
            Self::VoltJuggler => localized(locale, "Volt Juggler", "电弧杂耍者"),
            Self::GraveWarden => localized(locale, "Grave Warden", "墓垒守卫"),
            Self::LumenSentinel => localized(locale, "Lumen Sentinel", "辉光卫哨"),
            Self::ShadeRunner => localized(locale, "Shade Runner", "影奔袭客"),
        }
    }

    fn skill_label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser => localized(locale, "Bulwark Bash", "壁垒重击"),
            Self::SignalRanger => localized(locale, "Piercing Volley", "穿透齐射"),
            Self::AshDuelist => localized(locale, "Execution Arc", "处决弧刃"),
            Self::IronVanguard => localized(locale, "Anchor Strike", "锚定打击"),
            Self::FrostOracle => localized(locale, "Cold Snap", "寒霜迸发"),
            Self::EmberMedic => localized(locale, "Cinder Mend", "炽火疗愈"),
            Self::VoltJuggler => localized(locale, "Chain Static", "连锁电弧"),
            Self::GraveWarden => localized(locale, "Last Toll", "终末丧钟"),
            Self::LumenSentinel => localized(locale, "Solar Riposte", "耀光还击"),
            Self::ShadeRunner => localized(locale, "Shadow Echo", "暗影回响"),
        }
    }

    fn tempo_label(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser => localized(
                locale,
                "Empowers every second swing.",
                "每第二次攻击会强化。",
            ),
            Self::SignalRanger => localized(
                locale,
                "Fires a stronger volley every second shot.",
                "每第二次射击会打出更强齐射。",
            ),
            Self::AshDuelist => localized(
                locale,
                "Always primed to punish weakened targets.",
                "始终准备惩罚残血目标。",
            ),
            Self::IronVanguard => localized(
                locale,
                "Blocks 1 damage on every hit and spikes every second strike.",
                "每次受击格挡 1 点伤害，并在第二次攻击时增强。",
            ),
            Self::FrostOracle => localized(
                locale,
                "Every third cast bursts for heavier spell damage.",
                "每第三次施法会打出更高爆发。",
            ),
            Self::EmberMedic => localized(
                locale,
                "Every attack also patches the weakest ally.",
                "每次攻击后都会治疗最虚弱的友军。",
            ),
            Self::VoltJuggler => localized(
                locale,
                "Every second shot also zaps a secondary target.",
                "每第二次出手会顺带电击第二目标。",
            ),
            Self::GraveWarden => localized(
                locale,
                "Swings harder while wounded and anchors the frontline.",
                "受伤后会打得更重，并持续稳住前线。",
            ),
            Self::LumenSentinel => localized(
                locale,
                "Every third strike bursts higher and restores hull.",
                "每第三次攻击会爆发更高伤害并修复自身。",
            ),
            Self::ShadeRunner => localized(
                locale,
                "Every second shot adds a follow-up echo on the same target.",
                "每第二次射击会对同一目标追加回响伤害。",
            ),
        }
    }

    fn cast_state(self, action_counter: u32, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser
            | Self::SignalRanger
            | Self::IronVanguard
            | Self::VoltJuggler
            | Self::ShadeRunner => {
                if (action_counter + 1) % 2 == 0 {
                    localized(locale, "Next attack is empowered.", "下一次攻击已强化。")
                } else {
                    localized(
                        locale,
                        "One swing until the empowered cast.",
                        "再攻击一次就会进入强化。",
                    )
                }
            }
            Self::LumenSentinel => {
                if (action_counter + 1) % 3 == 0 {
                    localized(
                        locale,
                        "Next attack crashes in with a sustain spike.",
                        "下一次攻击会带来爆发并回复自身。",
                    )
                } else {
                    localized(
                        locale,
                        "Charging toward the next sustain spike.",
                        "正在为下一次爆发与回复蓄势。",
                    )
                }
            }
            Self::FrostOracle => {
                if (action_counter + 1) % 3 == 0 {
                    localized(
                        locale,
                        "Next cast detonates with frost burst.",
                        "下一次施法会引爆霜爆。",
                    )
                } else {
                    localized(
                        locale,
                        "Charging the next frost burst.",
                        "正在为下一次霜爆蓄势。",
                    )
                }
            }
            Self::EmberMedic => localized(
                locale,
                "Healing pulse is active every attack.",
                "每次攻击都会触发治疗脉冲。",
            ),
            Self::AshDuelist => localized(
                locale,
                "Bonus damage is live against targets below half health.",
                "对半血以下目标会立刻触发额外伤害。",
            ),
            Self::GraveWarden => localized(
                locale,
                "Below half health it gains bonus strike damage.",
                "半血以下会获得额外打击伤害。",
            ),
        }
    }

    fn target_rule(self, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser => localized(
                locale,
                "Targets the healthiest enemy and surges every second swing.",
                "优先攻击血量最高的敌人，并在每第二次挥击时爆发。",
            ),
            Self::SignalRanger => localized(
                locale,
                "Snipes the weakest enemy and fires a stronger volley every second shot.",
                "优先狙击最弱目标，并在每第二次射击时打出强化齐射。",
            ),
            Self::AshDuelist => localized(
                locale,
                "Executes the weakest enemy and deals bonus damage below half health.",
                "优先处决最弱敌人，对半血以下目标造成额外伤害。",
            ),
            Self::IronVanguard => localized(
                locale,
                "Challenges the highest-attack enemy and shrugs off 1 damage from each hit.",
                "优先挑战攻击最高的敌人，并且每次受击减少 1 点伤害。",
            ),
            Self::FrostOracle => localized(
                locale,
                "Focuses the highest-attack enemy and bursts every third cast.",
                "优先锁定攻击最高的敌人，并在第三次施法时爆发。",
            ),
            Self::EmberMedic => localized(
                locale,
                "Pokes the weakest enemy while healing the lowest-health ally.",
                "一边攻击最弱敌人，一边治疗生命值最低的友军。",
            ),
            Self::VoltJuggler => localized(
                locale,
                "Shoots the weakest enemy and arcs into a second target every other shot.",
                "优先射击最弱敌人，并在隔次出手时弹射到第二目标。",
            ),
            Self::GraveWarden => localized(
                locale,
                "Pins the healthiest enemy and gains damage while wounded.",
                "优先钉住最肉的敌人，并在受伤后提升伤害。",
            ),
            Self::LumenSentinel => localized(
                locale,
                "Pressures the healthiest enemy and stabilizes itself every third strike.",
                "优先压制最肉敌人，并在每第三次攻击时稳住自身血线。",
            ),
            Self::ShadeRunner => localized(
                locale,
                "Hunts the weakest enemy and doubles down every other shot.",
                "优先追击最弱敌人，并在隔次出手时补上回响伤害。",
            ),
        }
    }

    fn faction(self) -> UnitFaction {
        match self {
            Self::VerdantBruiser
            | Self::SignalRanger
            | Self::FrostOracle
            | Self::EmberMedic
            | Self::LumenSentinel => {
                UnitFaction::Dawn
            }
            Self::AshDuelist
            | Self::IronVanguard
            | Self::VoltJuggler
            | Self::GraveWarden
            | Self::ShadeRunner => {
                UnitFaction::Dusk
            }
        }
    }

    fn role(self) -> UnitRole {
        match self {
            Self::VerdantBruiser
            | Self::IronVanguard
            | Self::EmberMedic
            | Self::GraveWarden
            | Self::LumenSentinel => {
                UnitRole::Vanguard
            }
            Self::SignalRanger
            | Self::AshDuelist
            | Self::FrostOracle
            | Self::VoltJuggler
            | Self::ShadeRunner => {
                UnitRole::Skirmisher
            }
        }
    }

    fn color(self, owner: UnitOwner) -> Color {
        match (self, owner) {
            (Self::VerdantBruiser, UnitOwner::Player) => Color::linear_rgba(0.30, 0.83, 0.79, 0.98),
            (Self::SignalRanger, UnitOwner::Player) => Color::linear_rgba(0.32, 0.62, 0.93, 0.98),
            (Self::FrostOracle, UnitOwner::Player) => Color::linear_rgba(0.63, 0.73, 0.97, 0.98),
            (Self::EmberMedic, UnitOwner::Player) => Color::linear_rgba(0.95, 0.66, 0.35, 0.98),
            (Self::LumenSentinel, UnitOwner::Player) => {
                Color::linear_rgba(0.96, 0.84, 0.38, 0.98)
            }
            (Self::AshDuelist, UnitOwner::Enemy) => Color::linear_rgba(0.94, 0.41, 0.58, 0.98),
            (Self::IronVanguard, UnitOwner::Enemy) => Color::linear_rgba(0.82, 0.30, 0.35, 0.98),
            (Self::VoltJuggler, UnitOwner::Enemy) => Color::linear_rgba(0.74, 0.42, 0.95, 0.98),
            (Self::GraveWarden, UnitOwner::Enemy) => Color::linear_rgba(0.45, 0.50, 0.59, 0.98),
            (Self::ShadeRunner, UnitOwner::Enemy) => Color::linear_rgba(0.61, 0.33, 0.86, 0.98),
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
            Self::FrostOracle => 9,
            Self::EmberMedic => 13,
            Self::VoltJuggler => 11,
            Self::GraveWarden => 18,
            Self::LumenSentinel => 14,
            Self::ShadeRunner => 10,
        }
    }

    fn base_attack(self) -> u32 {
        match self {
            Self::VerdantBruiser => 4,
            Self::SignalRanger => 5,
            Self::AshDuelist => 4,
            Self::IronVanguard => 3,
            Self::FrostOracle => 6,
            Self::EmberMedic => 3,
            Self::VoltJuggler => 5,
            Self::GraveWarden => 4,
            Self::LumenSentinel => 4,
            Self::ShadeRunner => 5,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct UnitInstance {
    agent_id: u64,
    battle_instance_id: u64,
    archetype: UnitArchetype,
    stars: u8,
}

impl UnitInstance {
    fn new(archetype: UnitArchetype, identity: &mut IdentityState) -> Self {
        Self {
            agent_id: identity.next_agent_id(),
            battle_instance_id: identity.next_battle_instance_id(),
            archetype,
            stars: 1,
        }
    }

    fn label(self, locale: RuntimeLocale) -> String {
        format!(
            "{} {}",
            self.archetype.label(locale),
            star_badge(self.stars)
        )
    }

    fn sell_value(self) -> u32 {
        SELL_VALUE_BASE * self.stars as u32
    }

    fn base_view(self, locale: RuntimeLocale) -> RuntimeUnitView {
        let stats = scaled_stats(self);
        RuntimeUnitView {
            agent_id: self.agent_id.to_string(),
            battle_instance_id: self.battle_instance_id.to_string(),
            label: self.label(locale),
            archetype: self.archetype.key().to_owned(),
            faction: self.archetype.faction().key().to_owned(),
            role: self.archetype.role().key().to_owned(),
            skill: self.archetype.skill_label(locale).to_owned(),
            tempo_label: self.archetype.tempo_label(locale).to_owned(),
            cast_state: self.archetype.cast_state(0, locale).to_owned(),
            target_rule: self.archetype.target_rule(locale).to_owned(),
            stars: self.stars,
            attack: stats.attack,
            health: stats.max_health.max(1) as u32,
            sell_value: self.sell_value(),
        }
    }

    fn resolved_view(
        self,
        buffs: TraitBuffs,
        augments: &[AugmentKind],
        modifier: RunModifierKind,
        locale: RuntimeLocale,
    ) -> RuntimeUnitView {
        let stats = resolved_stats(self, buffs, augments, modifier);
        RuntimeUnitView {
            attack: stats.attack,
            health: stats.max_health.max(1) as u32,
            ..self.base_view(locale)
        }
    }
}

impl IdentityState {
    fn next_agent_id(&mut self) -> u64 {
        let id = self.next_agent_id;
        self.next_agent_id += 1;
        id
    }

    fn next_battle_instance_id(&mut self) -> u64 {
        let id = self.next_battle_instance_id;
        self.next_battle_instance_id += 1;
        id
    }
}

fn mint_starred_unit(
    identity: &mut IdentityState,
    archetype: UnitArchetype,
    stars: u8,
) -> UnitInstance {
    UnitInstance {
        stars,
        ..UnitInstance::new(archetype, identity)
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct TraitBuffs {
    dawn_count: usize,
    dusk_count: usize,
    vanguard_count: usize,
    skirmisher_count: usize,
}

impl TraitBuffs {
    fn dawn_tier(self) -> u8 {
        trait_tier(self.dawn_count)
    }

    fn dusk_tier(self) -> u8 {
        trait_tier(self.dusk_count)
    }

    fn vanguard_tier(self) -> u8 {
        trait_tier(self.vanguard_count)
    }

    fn skirmisher_tier(self) -> u8 {
        trait_tier(self.skirmisher_count)
    }

    fn highest_tier(self) -> u8 {
        [
            self.dawn_tier(),
            self.dusk_tier(),
            self.vanguard_tier(),
            self.skirmisher_tier(),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
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

#[derive(Clone, Copy, Debug)]
struct CombatUnitSnapshot {
    entity: Entity,
    owner: UnitOwner,
    slot_index: usize,
    agent_id: u64,
    battle_instance_id: u64,
    archetype: UnitArchetype,
    stars: u8,
    health: i32,
    max_health: i32,
    attack: u32,
    action_counter: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct PersistedRunState {
    version: u8,
    combat: CombatState,
    shop: ShopState,
    identity_state: IdentityState,
    player_squad: PlayerSquad,
    enemy_squad: EnemySquad,
    augments: AugmentState,
    live_units: Vec<PersistedLiveUnit>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
struct PersistedLiveUnit {
    owner: UnitOwner,
    slot_index: usize,
    agent_id: u64,
    battle_instance_id: u64,
    archetype: UnitArchetype,
    stars: u8,
    health: i32,
    max_health: i32,
    attack: u32,
    action_counter: u32,
}

impl From<CombatUnitSnapshot> for PersistedLiveUnit {
    fn from(snapshot: CombatUnitSnapshot) -> Self {
        Self {
            owner: snapshot.owner,
            slot_index: snapshot.slot_index,
            agent_id: snapshot.agent_id,
            battle_instance_id: snapshot.battle_instance_id,
            archetype: snapshot.archetype,
            stars: snapshot.stars,
            health: snapshot.health,
            max_health: snapshot.max_health,
            attack: snapshot.attack,
            action_counter: snapshot.action_counter,
        }
    }
}

#[derive(Clone, Debug)]
struct ResolvedCombatAction {
    hits: Vec<(Entity, i32)>,
    heals: Vec<(Entity, i32)>,
    highlight: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct BoardRepositionResult {
    moved: UnitInstance,
    displaced: Option<UnitInstance>,
}

impl Plugin for StarterScenePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BoardConfig>()
            .init_resource::<CombatState>()
            .init_resource::<StarterSliceProjection>()
            .init_resource::<ShopState>()
            .init_resource::<IdentityState>()
            .init_resource::<PlayerSquad>()
            .init_resource::<EnemySquad>()
            .init_resource::<AugmentState>()
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
    config: Res<RuntimeConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
    mut identity: ResMut<IdentityState>,
    mut player_squad: ResMut<PlayerSquad>,
    mut enemy_squad: ResMut<EnemySquad>,
    mut augments: ResMut<AugmentState>,
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

    let restored_live_units = config
        .resume_state_json
        .as_deref()
        .and_then(|resume_state_json| {
            restore_run_state(
                &mut commands,
                &board,
                config.locale,
                &mut combat,
                &mut shop,
                &mut identity,
                &mut player_squad,
                &mut enemy_squad,
                &mut augments,
                &mut combat_timer,
                resume_state_json,
            )
        });

    if restored_live_units.is_none() {
        reset_run_state(
            &mut commands,
            &board,
            config.locale,
            config.starter_doctrine,
            &mut combat,
            &mut shop,
            &mut identity,
            &mut player_squad,
            &mut enemy_squad,
            &mut augments,
            &mut combat_timer,
            false,
        );
    }

    if combat.phase == CombatPhase::Combat
        && restored_live_units
            .as_ref()
            .is_some_and(|live_units| !live_units.is_empty())
    {
        update_projection_from_persisted_live_state(
            &combat,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            restored_live_units.as_deref().unwrap_or(&[]),
            config.locale,
            &mut projection,
        );
    } else {
        update_projection_from_state(
            &combat,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            config.locale,
            &mut projection,
        );
    }
}

fn reset_run_state(
    commands: &mut Commands,
    board: &BoardConfig,
    locale: RuntimeLocale,
    starter_doctrine: RuntimeStarterDoctrine,
    combat: &mut CombatState,
    shop: &mut ShopState,
    identity: &mut IdentityState,
    player_squad: &mut PlayerSquad,
    enemy_squad: &mut EnemySquad,
    augments: &mut AugmentState,
    combat_timer: &mut CombatTickTimer,
    increment_run_number: bool,
) {
    let next_run_number = if increment_run_number {
        combat.run_number + 1
    } else {
        combat.run_number.max(1)
    };

    *combat = CombatState::default();
    combat.run_number = next_run_number;
    combat.starter_doctrine = starter_doctrine;
    combat.run_modifier = RunModifierKind::for_run(next_run_number);
    combat.free_reroll_available = RoundEventKind::for_round(combat.round).grants_free_reroll();
    combat.round_diagnosis = RoundEventKind::for_round(combat.round).stakes(locale).to_owned();
    combat.gold += combat.run_modifier.opening_gold_bonus();
    combat.gold += starter_doctrine.opening_gold_bonus();
    combat.player_health += starter_doctrine.opening_health_bonus();
    combat.recent_highlights.clear();
    combat_timer.0.reset();

    shop.locked = false;
    shop.offers.clear();
    *augments = AugmentState::default();
    player_squad.board = [None; PLAYER_SLOTS.len()];
    player_squad.bench = starter_doctrine.starting_bench(identity);
    enemy_squad.units = seed_enemy_squad(1, identity);
    reroll_shop(
        shop,
        combat.round,
        identity,
        combat.run_modifier,
        RoundEventKind::for_round(combat.round),
        0,
    );
    combat.operation_cards = operation_cards_for(combat);
    combat.selected_operation = None;
    combat.operation_bonus_secured_on_win = 0;
    combat.operation_bonus_unsecured_on_win = 0;
    combat.operation_unsecured_loss_on_defeat = 0;
    combat.operation_enemy_pressure = 0;
    combat.status = operation_prompt(locale);
    spawn_round_units(
        commands,
        board,
        player_squad,
        enemy_squad,
        augments,
        locale,
        combat,
    );
}

fn restore_run_state(
    commands: &mut Commands,
    board: &BoardConfig,
    locale: RuntimeLocale,
    combat: &mut CombatState,
    shop: &mut ShopState,
    identity: &mut IdentityState,
    player_squad: &mut PlayerSquad,
    enemy_squad: &mut EnemySquad,
    augments: &mut AugmentState,
    combat_timer: &mut CombatTickTimer,
    resume_state_json: &str,
) -> Option<Vec<PersistedLiveUnit>> {
    let saved_state = serde_json::from_str::<PersistedRunState>(resume_state_json).ok()?;
    if saved_state.version != 1 {
        return None;
    }

    *combat = saved_state.combat;
    *shop = saved_state.shop;
    *identity = saved_state.identity_state;
    *player_squad = saved_state.player_squad;
    *enemy_squad = saved_state.enemy_squad;
    *augments = saved_state.augments;
    combat.deployment_cap = deploy_cap_for_level(combat.level);
    combat.recent_highlights.truncate(4);
    combat.round_history.truncate(8);
    if combat.round_diagnosis.is_empty() {
        combat.round_diagnosis = RoundEventKind::for_round(combat.round).stakes(locale).to_owned();
    }
    if combat.phase == CombatPhase::Preparation && combat.operation_cards.is_empty() {
        combat.operation_cards = operation_cards_for(combat);
    }
    if combat.phase == CombatPhase::Preparation && combat.selected_operation.is_none() {
        combat.operation_bonus_secured_on_win = 0;
        combat.operation_bonus_unsecured_on_win = 0;
        combat.operation_unsecured_loss_on_defeat = 0;
        combat.operation_enemy_pressure = 0;
        combat.status = operation_prompt(locale);
    }
    combat_timer.0.reset();

    if combat.phase == CombatPhase::Combat && !saved_state.live_units.is_empty() {
        spawn_persisted_live_units(commands, board, &saved_state.live_units, locale, combat);
        Some(saved_state.live_units)
    } else {
        spawn_round_units(
            commands,
            board,
            player_squad,
            enemy_squad,
            augments,
            locale,
            combat,
        );
        Some(Vec::new())
    }
}

fn handle_runtime_commands(
    mut commands: Commands,
    board: Res<BoardConfig>,
    config: Res<RuntimeConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
    mut identity: ResMut<IdentityState>,
    mut player_squad: ResMut<PlayerSquad>,
    mut enemy_squad: ResMut<EnemySquad>,
    mut augments: ResMut<AugmentState>,
    units: Query<Entity, With<UnitEntity>>,
    mut combat_timer: ResMut<CombatTickTimer>,
) {
    let locale = config.locale;
    let commands_to_apply = take_runtime_commands();
    if commands_to_apply.is_empty() {
        return;
    }

    let mut needs_respawn = false;

    for runtime_command in commands_to_apply {
        match runtime_command {
            RuntimeCommand::StartCombat => {
                if combat.phase == CombatPhase::Preparation
                    && !combat.run_over
                    && combat.player_units > 0
                    && combat.enemy_units > 0
                    && augments.pending_choices.is_empty()
                    && combat.selected_operation.is_some()
                {
                    combat.phase = CombatPhase::Combat;
                    combat.recent_highlights.clear();
                    combat.status = if combat.active_directive.is_some() {
                        match locale {
                            RuntimeLocale::En => format!(
                                "Combat started. {} allied units engage {} enemies. {}",
                                combat.player_units,
                                combat.enemy_units,
                                combat_plan_status_line(&combat, locale)
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "战斗开始。{} 名友军正在迎战 {} 名敌军。{}",
                                combat.player_units,
                                combat.enemy_units,
                                combat_plan_status_line(&combat, locale)
                            ),
                        }
                    } else {
                        match locale {
                            RuntimeLocale::En => format!(
                                "Combat started. {} allied units engage {} enemies.",
                                combat.player_units, combat.enemy_units
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "战斗开始。{} 名友军正在迎战 {} 名敌军。",
                                combat.player_units, combat.enemy_units
                            ),
                        }
                    };
                    combat_timer.0.reset();
                }
            }
            RuntimeCommand::ChooseOperation(index) => {
                if !operation_selection_pending(&combat) {
                    continue;
                }

                let Some(choice) = combat.operation_cards.get(index).copied() else {
                    continue;
                };

                apply_operation_choice(
                    choice,
                    &mut combat,
                    &mut shop,
                    &mut identity,
                    locale,
                );
                needs_respawn = true;
            }
            RuntimeCommand::ResetRound => {
                if combat.phase == CombatPhase::Resolution && !combat.run_over {
                    let (base_income, interest_income, streak_income, modifier_income) =
                        round_income_preview(
                            combat.gold,
                            current_streak(&combat),
                            &augments.selected,
                            combat.run_modifier,
                        );
                    let total_income =
                        base_income + interest_income + streak_income + modifier_income;
                    combat.round += 1;
                    let round_event = RoundEventKind::for_round(combat.round);
                    combat.phase = CombatPhase::Preparation;
                    combat.active_directive = None;
                    combat.queued_directives.clear();
                    combat.recent_highlights.clear();
                    combat.run_result = RunResult::Active;
                    combat.free_reroll_available = round_event.grants_free_reroll();
                    combat.gold += total_income;
                    combat.income_base_total += base_income;
                    combat.income_interest_total += interest_income;
                    combat.income_streak_total += streak_income;
                    combat.income_modifier_total += modifier_income;
                    let levels_gained = grant_xp(&mut combat, PASSIVE_ROUND_XP);
                    enemy_squad.units = seed_enemy_squad(combat.round, &mut identity);
                    maybe_prepare_augment_draft(&mut augments, combat.round, combat.run_modifier);
                    combat.round_diagnosis = round_event.stakes(locale).to_owned();
                    let upkeep = apply_round_upkeep(&mut combat);
                    let lost_unsecured_on_collapse = combat.unsecured_loot;

                    if combat.player_health == 0 {
                        combat.run_over = true;
                        combat.run_result = RunResult::Defeat;
                        combat.unsecured_loot = 0;
                        combat.status = match locale {
                            RuntimeLocale::En => format!(
                                "Round {} collapse. Upkeep dealt {} contamination damage and the commander was lost{}.",
                                combat.round,
                                upkeep.contamination_damage,
                                if lost_unsecured_on_collapse > 0 {
                                    format!(
                                        ", dropping {} unsecured loot",
                                        lost_unsecured_on_collapse
                                    )
                                } else {
                                    String::new()
                                }
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "第 {} 回合行军失败。回合 upkeep 造成了 {} 点污染伤害，指挥官倒下{}。",
                                combat.round,
                                upkeep.contamination_damage,
                                if lost_unsecured_on_collapse > 0 {
                                    format!("，并丢失了 {} 份未锁定收益", lost_unsecured_on_collapse)
                                } else {
                                    String::new()
                                }
                            ),
                        };
                        continue;
                    }

                    combat.selected_operation = None;
                    combat.operation_cards = operation_cards_for(&combat);
                    combat.operation_bonus_secured_on_win = 0;
                    combat.operation_bonus_unsecured_on_win = 0;
                    combat.operation_unsecured_loss_on_defeat = 0;
                    combat.operation_enemy_pressure = 0;

                    let mut prep_notes = vec![match locale {
                        RuntimeLocale::En => format!(
                            "Round {} ready under {}. Income +{} (base {} / interest {} / streak {} / modifier {}). Level {} supports {} deployed units{}.",
                            combat.round,
                            round_event.label(locale),
                            total_income,
                            base_income,
                            interest_income,
                            streak_income,
                            modifier_income,
                            combat.level,
                            combat.deployment_cap,
                            if levels_gained > 0 {
                                " after leveling up"
                            } else {
                                ""
                            }
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "第 {} 回合已在 {} 下就绪。收入 +{}（基础 {} / 利息 {} / 连胜连败 {} / modifier {}）。当前等级 {}，可部署 {} 个单位{}",
                            combat.round,
                            round_event.label(locale),
                            total_income,
                            base_income,
                            interest_income,
                            streak_income,
                            modifier_income,
                            combat.level,
                            combat.deployment_cap,
                            if levels_gained > 0 {
                                "，并已升级。"
                            } else {
                                "。"
                            }
                        ),
                    }];

                    if shop.locked {
                        prep_notes.push(
                            localized(
                                locale,
                                "Locked shop carried forward.",
                                "锁定商店已保留。",
                            )
                            .to_owned(),
                        );
                    } else {
                        reroll_shop(
                            &mut shop,
                            combat.round,
                            &mut identity,
                            combat.run_modifier,
                            round_event,
                            0,
                        );
                        prep_notes.push(
                            localized(
                                locale,
                                "Shop refreshed for the new operation window.",
                                "商店已按新的行动窗口刷新。",
                            )
                            .to_owned(),
                        );
                    }

                    if upkeep.supply_spent > 0 {
                        prep_notes.push(
                            localized(
                                locale,
                                "Travel consumed 1 supplies.",
                                "行军消耗了 1 点补给。",
                            )
                            .to_owned(),
                        );
                    } else {
                        prep_notes.push(
                            localized(
                                locale,
                                "Supplies are empty. Rerolls cost +1 until you restock.",
                                "补给已空。补给恢复前，刷新费用 +1。",
                            )
                            .to_owned(),
                        );
                    }

                    if upkeep.contamination_treated > 0 {
                        prep_notes.push(
                            localized(
                                locale,
                                "Medical auto-treated 1 contamination.",
                                "医疗资源自动清除了 1 点污染。",
                            )
                            .to_owned(),
                        );
                    }

                    if upkeep.contamination_damage > 0 {
                        prep_notes.push(match locale {
                            RuntimeLocale::En => format!(
                                "Residual contamination dealt {} damage.",
                                upkeep.contamination_damage
                            ),
                            RuntimeLocale::ZhCn => {
                                format!("残留污染造成了 {} 点伤害。", upkeep.contamination_damage)
                            }
                        });
                    }

                    if !augments.pending_choices.is_empty() {
                        prep_notes.push(
                            localized(
                                locale,
                                "Augment draft is waiting after you lock the operation.",
                                "强化草案已出现，但要先锁定行动节点。",
                            )
                            .to_owned(),
                        );
                    }

                    combat.status =
                        format!("{} {}", prep_notes.join(" "), operation_prompt(locale));
                    needs_respawn = true;
                }
            }
            RuntimeCommand::RestartRun => {
                despawn_units(&mut commands, units.iter());
                reset_run_state(
                    &mut commands,
                    &board,
                    locale,
                    config.starter_doctrine,
                    &mut combat,
                    &mut shop,
                    &mut identity,
                    &mut player_squad,
                    &mut enemy_squad,
                    &mut augments,
                    &mut combat_timer,
                    true,
                );
            }
            RuntimeCommand::RerollShop => {
                let round_event = RoundEventKind::for_round(combat.round);
                let reroll_cost = effective_reroll_cost(&combat);
                if combat.phase == CombatPhase::Preparation
                    && !combat.run_over
                    && combat.selected_operation.is_some()
                    && combat.gold >= reroll_cost
                {
                    combat.gold -= reroll_cost;
                    if reroll_cost == 0 {
                        combat.free_reroll_available = false;
                    }
                    reroll_shop(
                        &mut shop,
                        combat.round + 1,
                        &mut identity,
                        combat.run_modifier,
                        round_event,
                        0,
                    );
                    combat.status = if reroll_cost == 0 {
                        localized(
                            locale,
                            "Event reroll cashed in. Wider market is live for this round.",
                            "已用掉本回合事件免费刷新，扩展商店仍在生效。",
                        )
                        .to_owned()
                    } else {
                        localized(
                            locale,
                            "Shop rerolled. Draft before combat starts.",
                            "商店已刷新。战斗前先完成招募。",
                        )
                        .to_owned()
                    };
                }
            }
            RuntimeCommand::BuyXp => {
                let round_event = RoundEventKind::for_round(combat.round);
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || combat.gold < BUY_XP_COST
                    || combat.level >= max_level()
                {
                    continue;
                }

                combat.gold -= BUY_XP_COST;
                let previous_level = combat.level;
                let xp_gained = BUY_XP_AMOUNT + round_event.xp_bonus();
                let levels_gained = grant_xp(&mut combat, xp_gained);
                combat.status = match locale {
                    RuntimeLocale::En => {
                        if levels_gained > 0 {
                            format!(
                                "Bought {} XP for {} gold. Level {} unlocked with {} deployment slots.",
                                xp_gained, BUY_XP_COST, combat.level, combat.deployment_cap
                            )
                        } else {
                            format!(
                                "Bought {} XP for {} gold. Level {} progress: {}/{}.",
                                xp_gained,
                                BUY_XP_COST,
                                previous_level,
                                combat.xp,
                                xp_to_next_level(previous_level)
                            )
                        }
                    }
                    RuntimeLocale::ZhCn => {
                        if levels_gained > 0 {
                            format!(
                                "已花费 {} 金币购买 {} 经验。升到 {} 级，可部署 {} 个单位。",
                                BUY_XP_COST, xp_gained, combat.level, combat.deployment_cap
                            )
                        } else {
                            format!(
                                "已花费 {} 金币购买 {} 经验。{} 级进度：{}/{}。",
                                BUY_XP_COST,
                                xp_gained,
                                previous_level,
                                combat.xp,
                                xp_to_next_level(previous_level)
                            )
                        }
                    }
                };
            }
            RuntimeCommand::ChooseAugment(index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                {
                    continue;
                }

                let Some(chosen) = augments.pending_choices.get(index).copied() else {
                    continue;
                };
                augments.pending_choices.clear();
                augments.pending_round = None;
                if !augments.selected.contains(&chosen) {
                    augments.selected.push(chosen);
                }
                apply_augment_pick(chosen, &mut combat);
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Augment locked: {}. {}",
                        chosen.label(locale),
                        chosen.description(locale)
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "已选择强化：{}。{}",
                        chosen.label(locale),
                        chosen.description(locale)
                    ),
                };
                needs_respawn = true;
            }
            RuntimeCommand::ToggleShopLock => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                {
                    continue;
                }

                shop.locked = !shop.locked;
                combat.status = if shop.locked {
                    localized(
                        locale,
                        "Shop lock engaged. Current offers will carry into the next round.",
                        "商店已锁定，当前招募项会保留到下一回合。",
                    )
                    .to_owned()
                } else {
                    localized(
                        locale,
                        "Shop lock released. Next round will refresh the offers.",
                        "商店已解锁，下一回合开始时会刷新。",
                    )
                    .to_owned()
                };
            }
            RuntimeCommand::BuyOffer(index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || combat.gold < BUY_COST
                    || player_squad.bench.len() >= combat.run_modifier.bench_capacity()
                    || index >= shop.offers.len()
                {
                    continue;
                }

                let purchased = shop.offers[index];
                player_squad.bench.push(purchased);
                combat.gold -= BUY_COST;
                let merge_messages = normalize_player_squad(&mut player_squad, locale);
                combat.status = merge_messages_for(
                    match locale {
                        RuntimeLocale::En => format!(
                            "Drafted {} to bench. Bench now holds {} units.",
                            purchased.label(locale),
                            player_squad.bench.len()
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "已将 {} 招募到备战席。当前备战席共有 {} 个单位。",
                            purchased.label(locale),
                            player_squad.bench.len()
                        ),
                    },
                    &merge_messages,
                );
                reroll_shop(
                    &mut shop,
                    combat.round + index as u32 + 2,
                    &mut identity,
                    combat.run_modifier,
                    RoundEventKind::for_round(combat.round),
                    0,
                );
                needs_respawn = true;
            }
            RuntimeCommand::DeployBenchToBoard {
                bench_index,
                slot_index,
            } => {
                let deployed_units = player_squad.board.iter().flatten().count();
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || slot_index >= player_squad.board.len()
                    || bench_index >= player_squad.bench.len()
                    || player_squad.board[slot_index].is_some()
                    || deployed_units >= combat.deployment_cap
                {
                    continue;
                }

                let deployed = player_squad.bench.remove(bench_index);
                player_squad.board[slot_index] = Some(deployed);
                let merge_messages = normalize_player_squad(&mut player_squad, locale);
                combat.status = merge_messages_for(
                    match locale {
                        RuntimeLocale::En => {
                            format!(
                                "Deployed {} into slot {}.",
                                deployed.label(locale),
                                slot_index + 1
                            )
                        }
                        RuntimeLocale::ZhCn => format!(
                            "已将 {} 部署到槽位 {}。",
                            deployed.label(locale),
                            slot_index + 1
                        ),
                    },
                    &merge_messages,
                );
                needs_respawn = true;
            }
            RuntimeCommand::RepositionBoardUnit { from_slot, to_slot } => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || from_slot >= player_squad.board.len()
                    || to_slot >= player_squad.board.len()
                    || from_slot == to_slot
                {
                    continue;
                }

                let Some(result) =
                    reposition_board_unit(&mut player_squad.board, from_slot, to_slot)
                else {
                    continue;
                };

                combat.status = match (locale, result.displaced) {
                    (RuntimeLocale::En, Some(displaced)) => format!(
                        "Swapped {} in slot {} with {} in slot {}.",
                        result.moved.label(locale),
                        from_slot + 1,
                        displaced.label(locale),
                        to_slot + 1
                    ),
                    (RuntimeLocale::ZhCn, Some(displaced)) => format!(
                        "已将槽位 {} 的 {} 与槽位 {} 的 {} 对调。",
                        from_slot + 1,
                        result.moved.label(locale),
                        to_slot + 1,
                        displaced.label(locale)
                    ),
                    (RuntimeLocale::En, None) => format!(
                        "Moved {} from slot {} to slot {}.",
                        result.moved.label(locale),
                        from_slot + 1,
                        to_slot + 1
                    ),
                    (RuntimeLocale::ZhCn, None) => format!(
                        "已将 {} 从槽位 {} 移动到槽位 {}。",
                        result.moved.label(locale),
                        from_slot + 1,
                        to_slot + 1
                    ),
                };
                needs_respawn = true;
            }
            RuntimeCommand::WithdrawBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || slot_index >= player_squad.board.len()
                    || player_squad.bench.len() >= combat.run_modifier.bench_capacity()
                {
                    continue;
                }

                let Some(withdrawn) = player_squad.board[slot_index].take() else {
                    continue;
                };

                player_squad.bench.push(withdrawn);
                let merge_messages = normalize_player_squad(&mut player_squad, locale);
                combat.status = merge_messages_for(
                    match locale {
                        RuntimeLocale::En => format!(
                            "Returned {} to bench from slot {}.",
                            withdrawn.label(locale),
                            slot_index + 1
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "已将 {} 从槽位 {} 撤回到备战席。",
                            withdrawn.label(locale),
                            slot_index + 1
                        ),
                    },
                    &merge_messages,
                );
                needs_respawn = true;
            }
            RuntimeCommand::SellBenchUnit(bench_index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || bench_index >= player_squad.bench.len()
                {
                    continue;
                }

                let sold = player_squad.bench.remove(bench_index);
                combat.gold += sold.sell_value();
                combat.status = match locale {
                    RuntimeLocale::En => {
                        format!(
                            "Sold {} for {} gold.",
                            sold.label(locale),
                            sold.sell_value()
                        )
                    }
                    RuntimeLocale::ZhCn => {
                        format!(
                            "已出售 {}，获得 {} 金币。",
                            sold.label(locale),
                            sold.sell_value()
                        )
                    }
                };
            }
            RuntimeCommand::SellBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.selected_operation.is_none()
                    || slot_index >= player_squad.board.len()
                {
                    continue;
                }

                let Some(sold) = player_squad.board[slot_index].take() else {
                    continue;
                };

                combat.gold += sold.sell_value();
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Sold {} from slot {} for {} gold.",
                        sold.label(locale),
                        slot_index + 1,
                        sold.sell_value()
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "已出售槽位 {} 的 {}，获得 {} 金币。",
                        slot_index + 1,
                        sold.label(locale),
                        sold.sell_value()
                    ),
                };
                needs_respawn = true;
            }
            RuntimeCommand::SetCombatDirective(directive) => {
                if combat.phase == CombatPhase::Resolution || combat.run_over {
                    continue;
                }

                replace_combat_plan(&mut combat, vec![directive], locale);
            }
            RuntimeCommand::ReplaceCombatPlan(plan) => {
                if combat.phase == CombatPhase::Resolution || combat.run_over {
                    continue;
                }

                replace_combat_plan(&mut combat, plan, locale);
            }
            RuntimeCommand::ClearCombatDirective => {
                if combat.phase == CombatPhase::Resolution || combat.run_over {
                    continue;
                }

                clear_combat_plan(&mut combat, locale);
            }
        }
    }

    if needs_respawn {
        despawn_units(&mut commands, units.iter());
        if !combat.run_over {
            spawn_round_units(
                &mut commands,
                &board,
                &player_squad,
                &enemy_squad,
                &augments,
                locale,
                &mut combat,
            );
        }
    }

    update_projection_from_state(
        &combat,
        &shop,
        &identity,
        &player_squad,
        &enemy_squad,
        &augments,
        locale,
        &mut projection,
    );
}

fn run_combat_tick(
    mut commands: Commands,
    time: Res<Time>,
    board: Res<BoardConfig>,
    config: Res<RuntimeConfig>,
    mut combat: ResMut<CombatState>,
    identity: Res<IdentityState>,
    player_squad: Res<PlayerSquad>,
    enemy_squad: Res<EnemySquad>,
    augments: Res<AugmentState>,
    mut projection: ResMut<StarterSliceProjection>,
    shop: Res<ShopState>,
    mut timer: ResMut<CombatTickTimer>,
    mut unit_queries: ParamSet<(Query<(Entity, &UnitEntity)>, Query<&mut UnitEntity>)>,
) {
    let locale = config.locale;
    if combat.phase != CombatPhase::Combat {
        return;
    }

    timer.0.tick(time.delta());
    if !timer.0.just_finished() {
        return;
    }

    let snapshots = unit_queries
        .p0()
        .iter()
        .map(|(entity, unit)| CombatUnitSnapshot {
            entity,
            owner: unit.owner,
            slot_index: unit.slot_index,
            agent_id: unit.agent_id,
            battle_instance_id: unit.battle_instance_id,
            archetype: unit.archetype,
            stars: unit.stars,
            health: unit.health,
            max_health: unit.max_health,
            attack: unit.attack,
            action_counter: unit.action_counter,
        })
        .collect::<Vec<_>>();

    let player_entities = snapshots
        .iter()
        .copied()
        .filter(|snapshot| snapshot.owner == UnitOwner::Player)
        .collect::<Vec<_>>();
    let enemy_entities = snapshots
        .iter()
        .copied()
        .filter(|snapshot| snapshot.owner == UnitOwner::Enemy)
        .collect::<Vec<_>>();

    let mut pending_damage = HashMap::<Entity, i32>::new();
    let mut pending_damage_sources = HashMap::<Entity, Vec<(u64, i32)>>::new();
    let mut pending_healing = HashMap::<Entity, i32>::new();
    let mut combat_highlights = Vec::new();
    let active_directive = combat.active_directive;
    let selected_augments = augments.selected.clone();
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());

    for attacker in &player_entities {
        if let Some(action) = resolve_attack(
            *attacker,
            &player_entities,
            &enemy_entities,
            locale,
            active_directive,
            &selected_augments,
            player_buffs,
        ) {
            let healing_total = action
                .heals
                .iter()
                .map(|(_, healing)| (*healing).max(0) as u32)
                .sum();

            for &(target_entity, damage) in &action.hits {
                *pending_damage.entry(target_entity).or_insert(0) += damage;
                pending_damage_sources
                    .entry(target_entity)
                    .or_default()
                    .push((attacker.agent_id, damage));
            }
            for &(target_entity, healing) in &action.heals {
                *pending_healing.entry(target_entity).or_insert(0) += healing;
            }
            record_healing_done(&mut combat, attacker.agent_id, healing_total);
            if combat_highlights.len() < 2 {
                combat_highlights.push(action.highlight);
            }
        }
    }

    for attacker in &enemy_entities {
        if let Some(action) = resolve_attack(
            *attacker,
            &enemy_entities,
            &player_entities,
            locale,
            active_directive,
            &selected_augments,
            enemy_buffs,
        ) {
            for &(target_entity, damage) in &action.hits {
                *pending_damage.entry(target_entity).or_insert(0) += damage;
                pending_damage_sources
                    .entry(target_entity)
                    .or_default()
                    .push((attacker.agent_id, damage));
            }
            for &(target_entity, healing) in &action.heals {
                *pending_healing.entry(target_entity).or_insert(0) += healing;
            }
            if combat_highlights.len() < 4 {
                combat_highlights.push(action.highlight);
            }
        }
    }

    for snapshot in &snapshots {
        if let Ok(mut unit) = unit_queries.p1().get_mut(snapshot.entity) {
            unit.action_counter += 1;
        }
    }

    for (target_entity, damage) in pending_damage {
        if let Ok(mut unit) = unit_queries.p1().get_mut(target_entity) {
            let mitigated = mitigate_damage(
                unit.archetype,
                damage,
                unit.owner,
                unit.slot_index,
                active_directive,
                &selected_augments,
                if unit.owner == UnitOwner::Player {
                    player_buffs
                } else {
                    enemy_buffs
                },
            );
            unit.health -= mitigated;
            if unit.owner == UnitOwner::Player {
                record_damage_taken(&mut combat, unit.agent_id, mitigated.max(0) as u32);
            }

            if let Some(sources) = pending_damage_sources.get(&target_entity) {
                let total_raw = sources.iter().map(|(_, value)| (*value).max(0) as u32).sum::<u32>();
                let mut remainder = mitigated.max(0) as u32;
                let top_source = sources
                    .iter()
                    .copied()
                    .max_by_key(|(_, value)| *value)
                    .map(|(agent_id, _)| agent_id);

                for (agent_id, raw) in sources {
                    if total_raw == 0 {
                        continue;
                    }
                    let share = ((mitigated.max(0) as u32) * (*raw).max(0) as u32) / total_raw;
                    if unit.owner == UnitOwner::Enemy {
                        record_damage_dealt(&mut combat, *agent_id, share);
                    }
                    remainder = remainder.saturating_sub(share);
                }

                if unit.owner == UnitOwner::Enemy {
                    if let Some(top_source) = top_source {
                        record_damage_dealt(&mut combat, top_source, remainder);
                    }
                }
            }
        }
    }

    for (target_entity, healing) in pending_healing {
        if let Ok(mut unit) = unit_queries.p1().get_mut(target_entity) {
            unit.health = (unit.health + healing).min(unit.max_health);
        }
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
            let credited_killer = pending_damage_sources
                .get(&entity)
                .and_then(|sources| {
                    sources
                        .iter()
                        .copied()
                        .max_by_key(|(_, damage)| *damage)
                        .map(|(agent_id, _)| agent_id)
                });
            defeated.push((entity, owner, credited_killer));
        } else {
            match owner {
                UnitOwner::Player => combat.player_units += 1,
                UnitOwner::Enemy => combat.enemy_units += 1,
            }
        }
    }

    for (entity, owner, credited_killer) in defeated {
        if owner == UnitOwner::Enemy {
            combat.score += 20;
            if let Some(killer_agent_id) = credited_killer {
                record_kill(&mut combat, killer_agent_id);
            }
        }
        commands.entity(entity).despawn();
    }

    if combat.player_units == 0 || combat.enemy_units == 0 {
        combat.phase = CombatPhase::Resolution;
        combat.active_directive = None;
        combat.queued_directives.clear();
        combat.recent_highlights = combat_highlights.iter().take(4).cloned().collect();
        let round_event = RoundEventKind::for_round(combat.round);
        if combat.enemy_units == 0 {
            combat.win_streak += 1;
            combat.loss_streak = 0;
            combat.score += 80;
            combat.gold += 1;
            if round_event.victory_bonus_gold() > 0 {
                combat.gold += round_event.victory_bonus_gold();
                combat.income_event_total += round_event.victory_bonus_gold();
            }
            combat.enemy_health = combat.enemy_health.saturating_sub(2);
            let mut operation_notes = resolve_operation_after_round(&mut combat, locale);
            if combat.round >= FINAL_ROUND {
                let unsecured_remaining = combat.unsecured_loot;
                let extraction_lock = lock_loot(&mut combat, unsecured_remaining);
                if extraction_lock > 0 {
                    operation_notes.push(match locale {
                        RuntimeLocale::En => format!(
                            "Final extraction secured the remaining {} loot.",
                            extraction_lock
                        ),
                        RuntimeLocale::ZhCn => {
                            format!("最终撤离锁定了剩余的 {} 份收益。", extraction_lock)
                        }
                    });
                }
                combat.run_over = true;
                combat.run_result = RunResult::Victory;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Run clear. Round {} collapsed the final enemy squad{} Restart to begin a new climb.",
                        combat.round,
                        if round_event.victory_bonus_gold() > 0 {
                            " and paid out extra spoils."
                        } else {
                            "."
                        }
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "通关。第 {} 回合击溃了最后一支敌军{}重新开局即可开始新的爬塔。",
                        combat.round,
                        if round_event.victory_bonus_gold() > 0 {
                            "，并额外拿到了战利品。"
                        } else {
                            "。"
                        }
                    ),
                };
            } else {
                combat.run_result = RunResult::Active;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Victory. Enemy board collapsed{} Click Next Round to continue to round {}.",
                        if round_event.victory_bonus_gold() > 0 {
                            " and Spoils of War paid +2 gold."
                        } else {
                            "."
                        },
                        combat.round + 1
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "胜利。敌方棋盘已崩溃{}点击“下一回合”进入第 {} 回合。",
                        if round_event.victory_bonus_gold() > 0 {
                            "，并额外获得了 +2 金币战利品。"
                        } else {
                            "。"
                        },
                        combat.round + 1
                    ),
                };
            }
            if !operation_notes.is_empty() {
                combat.status = format!("{} {}", combat.status, operation_notes.join(" "));
            }
        } else {
            combat.loss_streak += 1;
            combat.win_streak = 0;
            let defeat_damage = combat.enemy_units.max(1) as u32 * 2;
            combat.player_health = combat.player_health.saturating_sub(defeat_damage);
            let mut operation_notes = resolve_operation_after_round(&mut combat, locale);
            if combat.player_health == 0 {
                let lost_on_wipe = combat.unsecured_loot;
                if lost_on_wipe > 0 {
                    combat.unsecured_loot = 0;
                    operation_notes.push(match locale {
                        RuntimeLocale::En => format!(
                            "The wipe dropped the remaining {} unsecured loot.",
                            lost_on_wipe
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "整队溃败后，剩余的 {} 份未锁定收益也全部丢失。",
                            lost_on_wipe
                        ),
                    });
                }
                combat.run_over = true;
                combat.run_result = RunResult::Defeat;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Run over. {} enemies survived the last fight and the commander fell. Restart to try again.",
                        combat.enemy_units
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "本局结束。最后一战仍有 {} 个敌人存活，指挥官已经倒下。重新开局后再试一次。",
                        combat.enemy_units
                    ),
                };
            } else {
                combat.run_result = RunResult::Active;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Defeat. {} enemies survived. Click Next Round to rebuild.",
                        combat.enemy_units
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "失败。还有 {} 个敌人存活。点击“下一回合”重新布阵。",
                        combat.enemy_units
                    ),
                };
            }
            if !operation_notes.is_empty() {
                combat.status = format!("{} {}", combat.status, operation_notes.join(" "));
            }
        }

        combat.round_diagnosis =
            diagnose_round_outcome(&combat, &player_squad, &augments, locale);

        push_round_history_entry(&mut combat, &augments, &enemy_squad, locale);

        if !combat.run_over {
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
                &augments,
                locale,
                &mut combat,
            );
        }
    } else {
        advance_combat_plan_tick(&mut combat);
        combat.recent_highlights = combat_highlights.iter().take(4).cloned().collect();
        let directive_prefix = combat
            .active_directive
            .map(|directive| match locale {
                RuntimeLocale::En => format!("Directive {} active. ", directive.label(locale)),
                RuntimeLocale::ZhCn => format!("战术 {} 生效中。", directive.label(locale)),
            })
            .unwrap_or_default();

        combat.status = if combat_highlights.is_empty() {
            match locale {
                RuntimeLocale::En => format!(
                    "{}Combat underway. {} allied units vs {} enemies.",
                    directive_prefix, combat.player_units, combat.enemy_units
                ),
                RuntimeLocale::ZhCn => format!(
                    "{}战斗进行中。{} 名友军对阵 {} 名敌军。",
                    directive_prefix, combat.player_units, combat.enemy_units
                ),
            }
        } else {
            match locale {
                RuntimeLocale::En => format!(
                    "{}Combat underway. {} allied units vs {} enemies. {}",
                    directive_prefix,
                    combat.player_units,
                    combat.enemy_units,
                    combat_highlights
                        .into_iter()
                        .take(2)
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
                RuntimeLocale::ZhCn => format!(
                    "{}战斗进行中。{} 名友军对阵 {} 名敌军。{}",
                    directive_prefix,
                    combat.player_units,
                    combat.enemy_units,
                    combat_highlights
                        .into_iter()
                        .take(2)
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
            }
        };
    }

    let live_snapshots = unit_queries
        .p0()
        .iter()
        .map(|(entity, unit)| CombatUnitSnapshot {
            entity,
            owner: unit.owner,
            slot_index: unit.slot_index,
            agent_id: unit.agent_id,
            battle_instance_id: unit.battle_instance_id,
            archetype: unit.archetype,
            stars: unit.stars,
            health: unit.health,
            max_health: unit.max_health,
            attack: unit.attack,
            action_counter: unit.action_counter,
        })
        .collect::<Vec<_>>();

    if combat.phase == CombatPhase::Combat || combat.run_over {
        update_projection_from_live_state(
            &combat,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            &live_snapshots,
            locale,
            &mut projection,
        );
    } else {
        update_projection_from_state(
            &combat,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            locale,
            &mut projection,
        );
    }
}

fn resolve_attack(
    attacker: CombatUnitSnapshot,
    allies: &[CombatUnitSnapshot],
    opponents: &[CombatUnitSnapshot],
    locale: RuntimeLocale,
    active_directive: Option<CombatDirectiveOrder>,
    augments: &[AugmentKind],
    buffs: TraitBuffs,
) -> Option<ResolvedCombatAction> {
    let target = select_target(attacker, opponents, active_directive, augments, buffs)?;
    let mut primary_damage = attacker.attack as i32;
    let mut extra_hits = Vec::new();
    let mut heals = Vec::new();
    let mut skill_note = None;
    let cadence_triggered = cadence_skill_would_trigger(attacker, target, allies);
    let hold_skills = attacker.owner == UnitOwner::Player
        && active_directive.is_some_and(|directive| {
            directive.directive == CombatDirective::HoldSkills
                && directive
                    .effective_lane()
                    .is_none_or(|lane| is_lane_slot(attacker.owner, attacker.slot_index, lane))
        });

    match attacker.archetype {
        UnitArchetype::VerdantBruiser => {
            if !hold_skills && (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Bulwark Bash landed heavy",
                    "壁垒重击已触发",
                ));
            }
        }
        UnitArchetype::LumenSentinel => {
            if !hold_skills && (attacker.action_counter + 1) % 3 == 0 {
                primary_damage += 2;
                heals.push((attacker.entity, 2));
                skill_note = Some(localized(
                    locale,
                    "Solar Riposte stabilized the frontline",
                    "耀光还击稳住了前线血线",
                ));
            }
        }
        UnitArchetype::SignalRanger => {
            if !hold_skills && (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Piercing Volley broke through",
                    "穿透齐射已打穿前线",
                ));
            }
        }
        UnitArchetype::AshDuelist => {
            if !hold_skills && target.health * 2 <= target.max_health {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Execution Arc punished a weakened target",
                    "处决弧刃命中了残血目标",
                ));
            }
        }
        UnitArchetype::IronVanguard => {
            if !hold_skills && (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 1;
                skill_note = Some(localized(
                    locale,
                    "Anchor Strike cracked the enemy line",
                    "锚定打击撕开了敌方前线",
                ));
            }
        }
        UnitArchetype::FrostOracle => {
            if !hold_skills && (attacker.action_counter + 1) % 3 == 0 {
                primary_damage += 3;
                skill_note = Some(localized(
                    locale,
                    "Cold Snap burst through the target",
                    "寒霜迸发命中了主目标",
                ));
            }
        }
        UnitArchetype::EmberMedic => {
            if !hold_skills {
                if let Some(ally) = select_ally_to_heal(attacker.entity, allies) {
                    heals.push((ally.entity, 2));
                    skill_note = Some(localized(
                        locale,
                        "Cinder Mend patched the frontline",
                        "炽火疗愈修补了前线",
                    ));
                }
            }
        }
        UnitArchetype::VoltJuggler => {
            if !hold_skills && (attacker.action_counter + 1) % 2 == 0 {
                if let Some(secondary) = select_secondary_target(target.entity, opponents) {
                    extra_hits.push((secondary.entity, 2));
                    skill_note = Some(localized(
                        locale,
                        "Chain Static arced into a second target",
                        "连锁电弧弹射到了第二目标",
                    ));
                }
            }
        }
        UnitArchetype::ShadeRunner => {
            if !hold_skills && (attacker.action_counter + 1) % 2 == 0 {
                extra_hits.push((target.entity, 2));
                skill_note = Some(localized(
                    locale,
                    "Shadow Echo doubled down on the mark",
                    "暗影回响追上了同一目标",
                ));
            }
        }
        UnitArchetype::GraveWarden => {
            if !hold_skills && attacker.health * 2 <= attacker.max_health {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Last Toll hit harder while wounded",
                    "终末丧钟在残血时打得更重",
                ));
            }
        }
    }

    if !hold_skills
        && augments.contains(&AugmentKind::DawnPulse)
        && attacker.archetype.faction() == UnitFaction::Dawn
        && cadence_triggered
    {
        heals.push((attacker.entity, 1));
        skill_note = skill_note.or(Some(localized(
            locale,
            "Dawn Pulse refreshed the attacker",
            "黎明脉冲回复了施放者",
        )));
    }

    if !hold_skills
        && augments.contains(&AugmentKind::DuskPact)
        && attacker.archetype.faction() == UnitFaction::Dusk
        && cadence_triggered
    {
        primary_damage += 1;
        skill_note = skill_note.or(Some(localized(
            locale,
            "Dusk Pact sharpened the finisher",
            "黄昏契约强化了这次终结",
        )));
    }

    if !hold_skills
        && attacker.archetype.faction() == UnitFaction::Dawn
        && buffs.dawn_tier() >= 2
        && cadence_triggered
    {
        heals.push((attacker.entity, 1));
        skill_note = skill_note.or(Some(localized(
            locale,
            "Dawn capstone stabilized the carry",
            "黎明满羁绊稳住了主力血线",
        )));
    }

    if !hold_skills
        && attacker.archetype.faction() == UnitFaction::Dusk
        && buffs.dusk_tier() >= 2
        && cadence_triggered
    {
        primary_damage += 1;
        skill_note = skill_note.or(Some(localized(
            locale,
            "Dusk capstone amplified the spike",
            "黄昏满羁绊放大了爆发伤害",
        )));
    }

    if hold_skills && skill_note.is_none() && cadence_triggered {
        skill_note = Some(localized(
            locale,
            "Directive held the skill window",
            "战术指令压住了技能窗口",
        ));
    }

    let mut hits = vec![(target.entity, primary_damage.max(1))];
    hits.extend(
        extra_hits
            .into_iter()
            .map(|(entity, damage)| (entity, damage.max(1))),
    );

    let highlight = if let Some(skill_note) = skill_note {
        match locale {
            RuntimeLocale::En => format!(
                "{} hit {} for {}. {}.",
                attacker.archetype.label(locale),
                target.archetype.label(locale),
                primary_damage,
                skill_note
            ),
            RuntimeLocale::ZhCn => format!(
                "{} 命中 {}，造成 {} 点伤害。{}。",
                attacker.archetype.label(locale),
                target.archetype.label(locale),
                primary_damage,
                skill_note
            ),
        }
    } else {
        match locale {
            RuntimeLocale::En => format!(
                "{} hit {} for {}.",
                attacker.archetype.label(locale),
                target.archetype.label(locale),
                primary_damage
            ),
            RuntimeLocale::ZhCn => format!(
                "{} 命中 {}，造成 {} 点伤害。",
                attacker.archetype.label(locale),
                target.archetype.label(locale),
                primary_damage
            ),
        }
    };

    Some(ResolvedCombatAction {
        hits,
        heals,
        highlight,
    })
}

fn cadence_skill_would_trigger(
    attacker: CombatUnitSnapshot,
    target: CombatUnitSnapshot,
    allies: &[CombatUnitSnapshot],
) -> bool {
    match attacker.archetype {
        UnitArchetype::VerdantBruiser
        | UnitArchetype::SignalRanger
        | UnitArchetype::IronVanguard
        | UnitArchetype::VoltJuggler
        | UnitArchetype::ShadeRunner => (attacker.action_counter + 1) % 2 == 0,
        UnitArchetype::LumenSentinel => {
            (attacker.action_counter + 1) % 3 == 0
        }
        UnitArchetype::AshDuelist => target.health * 2 <= target.max_health,
        UnitArchetype::FrostOracle => (attacker.action_counter + 1) % 3 == 0,
        UnitArchetype::EmberMedic => select_ally_to_heal(attacker.entity, allies).is_some(),
        UnitArchetype::GraveWarden => attacker.health * 2 <= attacker.max_health,
    }
}

fn select_target(
    attacker: CombatUnitSnapshot,
    opponents: &[CombatUnitSnapshot],
    active_directive: Option<CombatDirectiveOrder>,
    augments: &[AugmentKind],
    buffs: TraitBuffs,
) -> Option<CombatUnitSnapshot> {
    let mut candidates = opponents.to_vec();
    if candidates.is_empty() {
        return None;
    }

    candidates.sort_by_key(|candidate| {
        let directive_bias = directive_target_bias(attacker, *candidate, active_directive);
        (
            directive_bias.0,
            directive_bias.1,
            base_target_priority(attacker.archetype, *candidate, augments, buffs).0,
            base_target_priority(attacker.archetype, *candidate, augments, buffs).1,
        )
    });

    candidates.first().copied()
}

fn base_target_priority(
    archetype: UnitArchetype,
    candidate: CombatUnitSnapshot,
    augments: &[AugmentKind],
    buffs: TraitBuffs,
) -> (i32, i32) {
    let skirmisher_bias = if archetype.role() == UnitRole::Skirmisher {
        let depth_bias = if is_backline_slot(candidate.owner, candidate.slot_index) {
            if buffs.skirmisher_tier() >= 2 { -800 } else { 0 }
        } else {
            0
        };
        let augment_bias = if augments.contains(&AugmentKind::SkirmisherDrive)
            && is_backline_slot(candidate.owner, candidate.slot_index)
        {
            -1000
        } else {
            0
        };
        depth_bias + augment_bias
    } else {
        0
    };

    match archetype {
        UnitArchetype::VerdantBruiser | UnitArchetype::LumenSentinel => {
            (-candidate.max_health, candidate.health)
        }
        UnitArchetype::SignalRanger
        | UnitArchetype::AshDuelist
        | UnitArchetype::EmberMedic
        | UnitArchetype::VoltJuggler
        | UnitArchetype::ShadeRunner => {
            (candidate.health + skirmisher_bias, -(candidate.attack as i32))
        }
        UnitArchetype::IronVanguard | UnitArchetype::FrostOracle => {
            (-(candidate.attack as i32), -candidate.health)
        }
        UnitArchetype::GraveWarden => (-candidate.max_health, -candidate.health),
    }
}

fn directive_target_bias(
    attacker: CombatUnitSnapshot,
    candidate: CombatUnitSnapshot,
    active_directive: Option<CombatDirectiveOrder>,
) -> (u8, u8) {
    match active_directive {
        Some(directive)
            if directive.directive == CombatDirective::FocusBackline
                && attacker.owner == UnitOwner::Player =>
        {
            (
                if is_backline_slot(candidate.owner, candidate.slot_index) {
                    0
                } else {
                    1
                },
                if directive
                    .effective_lane()
                    .is_some_and(|lane| !is_lane_slot(candidate.owner, candidate.slot_index, lane))
                {
                    1
                } else {
                    0
                },
            )
        }
        Some(directive)
            if directive.directive == CombatDirective::FallbackLeft
                && attacker.owner == UnitOwner::Enemy =>
        {
            (
                if directive
                    .effective_lane()
                    .is_some_and(|lane| is_lane_slot(candidate.owner, candidate.slot_index, lane))
                {
                    1
                } else {
                    0
                },
                0,
            )
        }
        _ => (0, 0),
    }
}

fn slot_coordinates(owner: UnitOwner, slot_index: usize) -> Option<(usize, usize)> {
    match owner {
        UnitOwner::Player => PLAYER_SLOTS.get(slot_index).copied(),
        UnitOwner::Enemy => ENEMY_SLOTS.get(slot_index).copied(),
    }
}

fn is_backline_slot(owner: UnitOwner, slot_index: usize) -> bool {
    let Some((_, col)) = slot_coordinates(owner, slot_index) else {
        return false;
    };

    match owner {
        UnitOwner::Player => PLAYER_SLOTS.iter().map(|(_, value)| *value).min(),
        UnitOwner::Enemy => ENEMY_SLOTS.iter().map(|(_, value)| *value).max(),
    }
    .is_some_and(|edge_col| col == edge_col)
}

fn slot_lane(owner: UnitOwner, slot_index: usize) -> Option<CombatDirectiveLane> {
    let Some((row, _)) = slot_coordinates(owner, slot_index) else {
        return None;
    };

    Some(if row <= 1 {
        CombatDirectiveLane::Left
    } else if row == 2 {
        CombatDirectiveLane::Center
    } else {
        CombatDirectiveLane::Right
    })
}

fn is_lane_slot(owner: UnitOwner, slot_index: usize, lane: CombatDirectiveLane) -> bool {
    slot_lane(owner, slot_index) == Some(lane)
}

fn select_secondary_target(
    primary_target: Entity,
    opponents: &[CombatUnitSnapshot],
) -> Option<CombatUnitSnapshot> {
    opponents
        .iter()
        .copied()
        .filter(|candidate| candidate.entity != primary_target)
        .min_by_key(|candidate| (candidate.health, -(candidate.attack as i32)))
}

fn select_ally_to_heal(
    attacker_entity: Entity,
    allies: &[CombatUnitSnapshot],
) -> Option<CombatUnitSnapshot> {
    allies
        .iter()
        .copied()
        .filter(|candidate| candidate.health > 0)
        .min_by_key(|candidate| {
            (
                candidate.health,
                if candidate.entity == attacker_entity {
                    1
                } else {
                    0
                },
                candidate.max_health,
            )
        })
}

fn reposition_board_unit(
    board: &mut [Option<UnitInstance>; PLAYER_SLOTS.len()],
    from_slot: usize,
    to_slot: usize,
) -> Option<BoardRepositionResult> {
    let moved = board.get(from_slot).copied().flatten()?;
    let displaced = board.get(to_slot).copied().flatten();
    board.swap(from_slot, to_slot);

    Some(BoardRepositionResult { moved, displaced })
}

fn mitigate_damage(
    archetype: UnitArchetype,
    damage: i32,
    owner: UnitOwner,
    slot_index: usize,
    active_directive: Option<CombatDirectiveOrder>,
    augments: &[AugmentKind],
    buffs: TraitBuffs,
) -> i32 {
    let directive_mitigation = if active_directive.is_some_and(|directive| {
        directive.directive == CombatDirective::FallbackLeft
            && owner == UnitOwner::Player
            && directive
                .effective_lane()
                .is_some_and(|lane| is_lane_slot(owner, slot_index, lane))
    }) {
        1
    } else {
        0
    };

    let augment_mitigation = if augments.contains(&AugmentKind::VanguardDoctrine)
        && archetype.role() == UnitRole::Vanguard
    {
        1
    } else {
        0
    };

    let trait_mitigation = if buffs.vanguard_tier() >= 2 && archetype.role() == UnitRole::Vanguard
    {
        1
    } else {
        0
    };

    match archetype {
        UnitArchetype::IronVanguard => {
            (damage - 1 - directive_mitigation - augment_mitigation - trait_mitigation).max(1)
        }
        _ => (damage - directive_mitigation - augment_mitigation - trait_mitigation).max(1),
    }
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

fn board_views_from_live_units(
    live_snapshots: &[CombatUnitSnapshot],
    owner: UnitOwner,
    slots: usize,
    locale: RuntimeLocale,
) -> Vec<Option<RuntimeUnitView>> {
    let mut board = vec![None; slots];

    for snapshot in live_snapshots
        .iter()
        .filter(|snapshot| snapshot.owner == owner)
    {
        if snapshot.slot_index >= board.len() {
            continue;
        }

        board[snapshot.slot_index] = Some(RuntimeUnitView {
            agent_id: snapshot.agent_id.to_string(),
            battle_instance_id: snapshot.battle_instance_id.to_string(),
            label: format!(
                "{} {}",
                snapshot.archetype.label(locale),
                star_badge(snapshot.stars)
            ),
            archetype: snapshot.archetype.key().to_owned(),
            faction: snapshot.archetype.faction().key().to_owned(),
            role: snapshot.archetype.role().key().to_owned(),
            skill: snapshot.archetype.skill_label(locale).to_owned(),
            tempo_label: snapshot.archetype.tempo_label(locale).to_owned(),
            cast_state: snapshot
                .archetype
                .cast_state(snapshot.action_counter, locale)
                .to_owned(),
            target_rule: snapshot.archetype.target_rule(locale).to_owned(),
            stars: snapshot.stars,
            attack: snapshot.attack,
            health: snapshot.health.max(1) as u32,
            sell_value: SELL_VALUE_BASE * snapshot.stars as u32,
        });
    }

    board
}

fn board_views_from_persisted_live_units(
    live_units: &[PersistedLiveUnit],
    owner: UnitOwner,
    slots: usize,
    locale: RuntimeLocale,
) -> Vec<Option<RuntimeUnitView>> {
    let mut board = vec![None; slots];

    for unit in live_units.iter().filter(|unit| unit.owner == owner) {
        if unit.slot_index >= board.len() {
            continue;
        }

        board[unit.slot_index] = Some(RuntimeUnitView {
            agent_id: unit.agent_id.to_string(),
            battle_instance_id: unit.battle_instance_id.to_string(),
            label: format!(
                "{} {}",
                unit.archetype.label(locale),
                star_badge(unit.stars)
            ),
            archetype: unit.archetype.key().to_owned(),
            faction: unit.archetype.faction().key().to_owned(),
            role: unit.archetype.role().key().to_owned(),
            skill: unit.archetype.skill_label(locale).to_owned(),
            tempo_label: unit.archetype.tempo_label(locale).to_owned(),
            cast_state: unit
                .archetype
                .cast_state(unit.action_counter, locale)
                .to_owned(),
            target_rule: unit.archetype.target_rule(locale).to_owned(),
            stars: unit.stars,
            attack: unit.attack,
            health: unit.health.max(1) as u32,
            sell_value: SELL_VALUE_BASE * unit.stars as u32,
        });
    }

    board
}

fn serialize_run_state(
    combat: &CombatState,
    shop: &ShopState,
    identity: &IdentityState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    live_snapshots: Option<&[CombatUnitSnapshot]>,
) -> Option<String> {
    let persisted_live_units = live_snapshots
        .unwrap_or(&[])
        .iter()
        .copied()
        .map(PersistedLiveUnit::from)
        .collect::<Vec<_>>();

    serialize_run_state_from_persisted_live_units(
        combat,
        shop,
        identity,
        player_squad,
        enemy_squad,
        augments,
        &persisted_live_units,
    )
}

fn serialize_run_state_from_persisted_live_units(
    combat: &CombatState,
    shop: &ShopState,
    identity: &IdentityState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    live_units: &[PersistedLiveUnit],
) -> Option<String> {
    if combat.run_over {
        return None;
    }

    serde_json::to_string(&PersistedRunState {
        version: 1,
        combat: combat.clone(),
        shop: shop.clone(),
        identity_state: identity.clone(),
        player_squad: player_squad.clone(),
        enemy_squad: enemy_squad.clone(),
        augments: augments.clone(),
        live_units: if combat.phase == CombatPhase::Combat {
            live_units.to_vec()
        } else {
            Vec::new()
        },
    })
    .ok()
}

fn update_projection_from_state(
    combat: &CombatState,
    shop: &ShopState,
    identity: &IdentityState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    locale: RuntimeLocale,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());
    let serialized_run_state = serialize_run_state(
        combat,
        shop,
        identity,
        player_squad,
        enemy_squad,
        augments,
        None,
    );

    apply_common_projection_fields(
        combat,
        shop,
        player_squad,
        enemy_squad,
        augments,
        locale,
        serialized_run_state,
        projection,
    );
    projection.player_board = player_squad
        .board
        .iter()
        .copied()
        .map(|unit| {
            unit.map(|unit| {
                unit.resolved_view(player_buffs, &augments.selected, combat.run_modifier, locale)
            })
        })
        .collect();
    projection.enemy_board = enemy_squad
        .units
        .iter()
        .copied()
        .map(|unit| Some(unit.resolved_view(enemy_buffs, &[], combat.run_modifier, locale)))
        .chain(std::iter::repeat(None::<RuntimeUnitView>))
        .take(ENEMY_SLOTS.len())
        .collect();
}

fn update_projection_from_live_state(
    combat: &CombatState,
    shop: &ShopState,
    identity: &IdentityState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    live_snapshots: &[CombatUnitSnapshot],
    locale: RuntimeLocale,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    let serialized_run_state = serialize_run_state(
        combat,
        shop,
        identity,
        player_squad,
        enemy_squad,
        augments,
        Some(live_snapshots),
    );

    apply_common_projection_fields(
        combat,
        shop,
        player_squad,
        enemy_squad,
        augments,
        locale,
        serialized_run_state,
        projection,
    );
    projection.player_board = board_views_from_live_units(
        live_snapshots,
        UnitOwner::Player,
        PLAYER_SLOTS.len(),
        locale,
    );
    projection.enemy_board =
        board_views_from_live_units(live_snapshots, UnitOwner::Enemy, ENEMY_SLOTS.len(), locale);
}

fn update_projection_from_persisted_live_state(
    combat: &CombatState,
    shop: &ShopState,
    identity: &IdentityState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    live_units: &[PersistedLiveUnit],
    locale: RuntimeLocale,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    let serialized_run_state = serialize_run_state_from_persisted_live_units(
        combat,
        shop,
        identity,
        player_squad,
        enemy_squad,
        augments,
        live_units,
    );

    apply_common_projection_fields(
        combat,
        shop,
        player_squad,
        enemy_squad,
        augments,
        locale,
        serialized_run_state,
        projection,
    );
    projection.player_board = board_views_from_persisted_live_units(
        live_units,
        UnitOwner::Player,
        PLAYER_SLOTS.len(),
        locale,
    );
    projection.enemy_board = board_views_from_persisted_live_units(
        live_units,
        UnitOwner::Enemy,
        ENEMY_SLOTS.len(),
        locale,
    );
}

fn apply_common_projection_fields(
    combat: &CombatState,
    shop: &ShopState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    locale: RuntimeLocale,
    serialized_run_state: Option<String>,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    projection.phase = combat.phase.as_str().to_owned();
    projection.objective = localized(
        locale,
        "Draft a compact squad, manage a lockable shop, and survive scaling enemy rounds with readable skill cadence.",
        "组建一支紧凑阵容，管理可锁定商店，并在不断增强的敌方回合中依靠可读的技能节奏存活。",
    )
    .to_owned();
    projection.status = combat.status.clone();
    projection.score = combat.score;
    projection.gold = combat.gold;
    projection.player_health = combat.player_health;
    projection.enemy_health = combat.enemy_health;
    projection.captured = combat.player_units;
    projection.total = combat.player_units + combat.enemy_units;
    projection.round = combat.round;
    projection.run_number = combat.run_number;
    projection.level = combat.level;
    projection.xp = combat.xp;
    projection.xp_to_next_level = xp_to_next_level(combat.level);
    projection.max_level = max_level();
    projection.reroll_cost = REROLL_COST;
    projection.xp_buy_cost = BUY_XP_COST;
    projection.shop_locked = shop.locked;
    projection.shop_offers = shop
        .offers
        .iter()
        .copied()
        .map(|unit| unit.base_view(locale))
        .collect();
    projection.bench_units = player_squad
        .bench
        .iter()
        .copied()
        .map(|unit| unit.base_view(locale))
        .collect();
    projection.unit_roster = UnitArchetype::all()
        .into_iter()
        .map(|archetype| UnitInstance {
            agent_id: 0,
            battle_instance_id: 0,
            archetype,
            stars: 1,
        })
        .map(|unit| unit.base_view(locale))
        .collect();
    projection.active_traits =
        trait_views_for(player_squad.board.iter().flatten().copied(), locale).collect();
    projection.selected_augments = augments
        .selected
        .iter()
        .copied()
        .map(|augment| augment.as_view(locale))
        .collect();
    projection.pending_augments = augments
        .pending_choices
        .iter()
        .copied()
        .map(|augment| augment.as_view(locale))
        .collect();
    projection.operation_cards = combat
        .operation_cards
        .iter()
        .copied()
        .map(|operation| operation.as_view(locale))
        .collect();
    projection.selected_operation = combat
        .selected_operation
        .map(|operation| operation.as_view(locale));
    projection.starter_doctrine = combat.starter_doctrine.as_view(locale);
    projection.run_modifier = combat.run_modifier.as_view(locale);
    projection.round_event = RoundEventKind::for_round(combat.round).as_view(locale);
    projection.round_history = combat
        .round_history
        .iter()
        .map(|entry| RuntimeRoundSummaryView {
            round: entry.round,
            result: match entry.result {
                RoundOutcome::Victory => "victory".to_owned(),
                RoundOutcome::Defeat => "defeat".to_owned(),
            },
            income_total: entry.income_total,
            threat: entry.threat,
            summary: entry.summary.clone(),
        })
        .collect();
    projection.performance_leaders = performance_views_for(combat, locale);
    projection.combat_feed = combat.recent_highlights.clone();
    projection.active_combat_directive = combat
        .active_directive
        .map(|directive| directive.as_view(locale));
    projection.queued_combat_directives = combat
        .queued_directives
        .iter()
        .copied()
        .map(|directive| directive.as_view(locale))
        .collect();
    projection.augment_draft_round = augments.pending_round.unwrap_or(0);
    projection.enemy_threat =
        enemy_threat(enemy_squad.units.iter().copied()) + combat.operation_enemy_pressure * 8;
    projection.enemy_intent = format!(
        "{} {}",
        enemy_intent_for_round(combat.round, locale),
        enemy_pressure_label(combat.operation_enemy_pressure, locale)
    );
    projection.bench_capacity = combat.run_modifier.bench_capacity();
    projection.board_capacity = PLAYER_SLOTS.len();
    projection.deployment_cap = combat.deployment_cap;
    projection.supplies = combat.supplies;
    projection.medical = combat.medical;
    projection.contamination = combat.contamination;
    projection.secured_loot = combat.secured_loot;
    projection.unsecured_loot = combat.unsecured_loot;
    projection.streak = current_streak(combat);
    let (base_income, interest_income, streak_income, modifier_income) =
        round_income_preview(
            combat.gold,
            projection.streak,
            &augments.selected,
            combat.run_modifier,
        );
    projection.base_income = base_income;
    projection.interest_income = interest_income;
    projection.streak_income = streak_income;
    projection.income_base_total = combat.income_base_total;
    projection.income_interest_total = combat.income_interest_total;
    projection.income_streak_total = combat.income_streak_total;
    projection.income_modifier_total = combat.income_modifier_total + modifier_income;
    projection.income_event_total = combat.income_event_total;
    projection.round_diagnosis = combat.round_diagnosis.clone();
    projection.reroll_cost = effective_reroll_cost(combat);
    projection.round_resolved = combat.phase == CombatPhase::Resolution;
    projection.run_over = combat.run_over;
    projection.run_result = combat.run_result.as_str().to_owned();
    projection.completed = combat.run_over;
    projection.serialized_run_state = serialized_run_state;
}

fn spawn_round_units(
    commands: &mut Commands,
    board: &BoardConfig,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    locale: RuntimeLocale,
    combat: &mut CombatState,
) {
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());

    combat.player_units = 0;
    combat.enemy_units = 0;
    combat.performance_log.clear();

    for (index, maybe_unit) in player_squad.board.iter().copied().enumerate() {
        let Some(unit) = maybe_unit else {
            continue;
        };
        ensure_performance_entry(combat, unit);

        if let Some(&(row, col)) = PLAYER_SLOTS.get(index) {
            spawn_unit(
                commands,
                board,
                UnitOwner::Player,
                index,
                unit,
                resolved_stats(unit, player_buffs, &augments.selected, combat.run_modifier),
                locale,
                row,
                col,
            );
            combat.player_units += 1;
        }
    }

    for (index, unit) in enemy_squad.units.iter().copied().enumerate() {
        if let Some(&(row, col)) = ENEMY_SLOTS.get(index) {
            let mut enemy_stats = resolved_stats(unit, enemy_buffs, &[], combat.run_modifier);
            enemy_stats.attack += combat.operation_enemy_pressure;
            enemy_stats.max_health += combat.operation_enemy_pressure as i32 * 2;
            spawn_unit(
                commands,
                board,
                UnitOwner::Enemy,
                index,
                unit,
                enemy_stats,
                locale,
                row,
                col,
            );
            combat.enemy_units += 1;
        }
    }
}

fn spawn_persisted_live_units(
    commands: &mut Commands,
    board: &BoardConfig,
    live_units: &[PersistedLiveUnit],
    locale: RuntimeLocale,
    combat: &mut CombatState,
) {
    combat.player_units = 0;
    combat.enemy_units = 0;

    for unit in live_units {
        let slots = match unit.owner {
            UnitOwner::Player => &PLAYER_SLOTS,
            UnitOwner::Enemy => &ENEMY_SLOTS,
        };
        let Some(&(row, col)) = slots.get(unit.slot_index) else {
            continue;
        };

        spawn_unit_with_state(
            commands,
            board,
            unit.owner,
            unit.slot_index,
            UnitInstance {
                agent_id: unit.agent_id,
                battle_instance_id: unit.battle_instance_id,
                archetype: unit.archetype,
                stars: unit.stars,
            },
            UnitStats {
                attack: unit.attack,
                max_health: unit.max_health,
            },
            locale,
            row,
            col,
            unit.health,
            unit.action_counter,
        );

        match unit.owner {
            UnitOwner::Player => {
                ensure_performance_entry(
                    combat,
                    UnitInstance {
                        agent_id: unit.agent_id,
                        battle_instance_id: unit.battle_instance_id,
                        archetype: unit.archetype,
                        stars: unit.stars,
                    },
                );
                combat.player_units += 1
            }
            UnitOwner::Enemy => combat.enemy_units += 1,
        }
    }
}

fn spawn_unit(
    commands: &mut Commands,
    board: &BoardConfig,
    owner: UnitOwner,
    slot_index: usize,
    unit: UnitInstance,
    stats: UnitStats,
    locale: RuntimeLocale,
    row: usize,
    col: usize,
) {
    spawn_unit_with_state(
        commands,
        board,
        owner,
        slot_index,
        unit,
        stats,
        locale,
        row,
        col,
        stats.max_health,
        0,
    );
}

fn spawn_unit_with_state(
    commands: &mut Commands,
    board: &BoardConfig,
    owner: UnitOwner,
    slot_index: usize,
    unit: UnitInstance,
    stats: UnitStats,
    locale: RuntimeLocale,
    row: usize,
    col: usize,
    health: i32,
    action_counter: u32,
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
                slot_index,
                agent_id: unit.agent_id,
                battle_instance_id: unit.battle_instance_id,
                archetype: unit.archetype,
                stars: unit.stars,
                action_counter,
                health: health.min(stats.max_health),
                max_health: stats.max_health,
                attack: stats.attack,
            },
            Name::new(unit.label(locale)),
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

fn effective_reroll_cost(combat: &CombatState) -> u32 {
    let base_cost = if combat.free_reroll_available
        && RoundEventKind::for_round(combat.round).grants_free_reroll()
    {
        0
    } else {
        REROLL_COST
    };

    if combat.supplies == 0 {
        base_cost + 1
    } else {
        base_cost
    }
}

fn operation_cards_for(combat: &CombatState) -> Vec<RunOperationKind> {
    let mut cards = vec![RunOperationKind::SteadySearch, RunOperationKind::DeepRaid];
    if combat.unsecured_loot > 0 {
        cards.push(RunOperationKind::TacticalTransfer);
    } else {
        cards.push(RunOperationKind::FieldCache);
    }
    cards
}

fn lock_loot(combat: &mut CombatState, amount: u32) -> u32 {
    let moved = combat.unsecured_loot.min(amount);
    combat.unsecured_loot -= moved;
    combat.secured_loot += moved;
    combat.score += moved * SECURED_LOOT_SCORE;
    moved
}

struct RoundUpkeepOutcome {
    supply_spent: u32,
    contamination_treated: u32,
    contamination_damage: u32,
}

fn apply_round_upkeep(combat: &mut CombatState) -> RoundUpkeepOutcome {
    let supply_spent = u32::from(combat.supplies > 0);
    combat.supplies = combat.supplies.saturating_sub(1);

    let contamination_treated = if combat.contamination > 0 && combat.medical > 0 {
        combat.medical -= 1;
        combat.contamination -= 1;
        1
    } else {
        0
    };

    let contamination_damage = combat.contamination.min(2);
    combat.player_health = combat.player_health.saturating_sub(contamination_damage);

    RoundUpkeepOutcome {
        supply_spent,
        contamination_treated,
        contamination_damage,
    }
}

fn operation_prompt(locale: RuntimeLocale) -> String {
    localized(
        locale,
        "Choose an operation before drafting. It will set this round's risk profile, loot flow, and shop pressure.",
        "先选择本回合行动节点，再开始运营。它会决定本回合的风险、收益流向和商店压力。",
    )
    .to_owned()
}

fn operation_selection_pending(combat: &CombatState) -> bool {
    combat.phase == CombatPhase::Preparation
        && !combat.run_over
        && combat.selected_operation.is_none()
}

fn apply_operation_choice(
    choice: RunOperationKind,
    combat: &mut CombatState,
    shop: &mut ShopState,
    identity: &mut IdentityState,
    locale: RuntimeLocale,
) {
    combat.selected_operation = Some(choice);
    combat.operation_bonus_secured_on_win = 0;
    combat.operation_bonus_unsecured_on_win = 0;
    combat.operation_unsecured_loss_on_defeat = 1;
    combat.operation_enemy_pressure = 0;

    match choice {
        RunOperationKind::SteadySearch => {
            combat.gold += 2;
            combat.supplies += 1;
            combat.operation_bonus_secured_on_win = 1;
            combat.status = match locale {
                RuntimeLocale::En => "Steady Search locked in. +2 gold, +1 supplies, and a win secures 1 carried loot.".to_owned(),
                RuntimeLocale::ZhCn => "已选择稳健搜索。+2 金币、+1 补给；若本回合获胜，可再锁定 1 份携行收益。".to_owned(),
            };
        }
        RunOperationKind::DeepRaid => {
            combat.unsecured_loot += 2;
            combat.contamination += 1;
            combat.operation_unsecured_loss_on_defeat = 2;
            combat.operation_enemy_pressure = 1;
            reroll_shop(
                shop,
                combat.round + 17,
                identity,
                combat.run_modifier,
                RoundEventKind::for_round(combat.round),
                1,
            );
            combat.status = match locale {
                RuntimeLocale::En => "Deep Raid locked in. +2 unsecured loot and a wider market, but contamination rises and the enemy board hardens.".to_owned(),
                RuntimeLocale::ZhCn => "已选择深层突入。+2 未锁定收益并刷新成更宽商店，但污染上升，敌方阵容也会更硬。".to_owned(),
            };
        }
        RunOperationKind::FieldCache => {
            combat.medical += 1;
            let cleared = u32::from(combat.contamination > 0);
            combat.contamination = combat.contamination.saturating_sub(1);
            combat.operation_bonus_unsecured_on_win = 1;
            combat.status = match (locale, cleared) {
                (RuntimeLocale::En, 0) => "Field Cache secured. +1 medical now; a clean win adds 1 unsecured loot.".to_owned(),
                (RuntimeLocale::En, _) => "Field Cache secured. +1 medical, 1 contamination cleared, and a clean win adds 1 unsecured loot.".to_owned(),
                (RuntimeLocale::ZhCn, 0) => "已拿到野战补给。立刻 +1 医疗；若本回合获胜，再得 1 份未锁定收益。".to_owned(),
                (RuntimeLocale::ZhCn, _) => "已拿到野战补给。立刻 +1 医疗并清除 1 点污染；若本回合获胜，再得 1 份未锁定收益。".to_owned(),
            };
        }
        RunOperationKind::TacticalTransfer => {
            let locked = lock_loot(combat, 2);
            combat.operation_bonus_secured_on_win = 1;
            if shop.offers.len() > 1 {
                shop.offers.pop();
            }
            combat.status = match locale {
                RuntimeLocale::En => format!(
                    "Tactical Transfer locked in. Secured {} carried loot now, but the shop narrows this round.",
                    locked
                ),
                RuntimeLocale::ZhCn => format!(
                    "已选择战术转运。立刻锁定 {} 份携行收益，但本回合商店会收窄。",
                    locked
                ),
            };
        }
    }
}

fn resolve_operation_after_round(combat: &mut CombatState, locale: RuntimeLocale) -> Vec<String> {
    let mut notes = Vec::new();

    if combat.enemy_units == 0 {
        let locked = lock_loot(combat, combat.operation_bonus_secured_on_win);
        if locked > 0 {
            notes.push(match locale {
                RuntimeLocale::En => format!("Secured {} carried loot after the win.", locked),
                RuntimeLocale::ZhCn => format!("获胜后额外锁定了 {} 份携行收益。", locked),
            });
        }

        if combat.operation_bonus_unsecured_on_win > 0 {
            combat.unsecured_loot += combat.operation_bonus_unsecured_on_win;
            notes.push(match locale {
                RuntimeLocale::En => format!(
                    "The clean sweep added {} unsecured loot.",
                    combat.operation_bonus_unsecured_on_win
                ),
                RuntimeLocale::ZhCn => format!(
                    "稳稳拿下后又获得了 {} 份未锁定收益。",
                    combat.operation_bonus_unsecured_on_win
                ),
            });
        }
    } else {
        let lost = combat.unsecured_loot.min(combat.operation_unsecured_loss_on_defeat);
        if lost > 0 {
            combat.unsecured_loot -= lost;
            notes.push(match locale {
                RuntimeLocale::En => format!("Lost {} unsecured loot in the retreat.", lost),
                RuntimeLocale::ZhCn => format!("撤离时损失了 {} 份未锁定收益。", lost),
            });
        }
    }

    notes
}

fn enemy_pressure_label(level: u32, locale: RuntimeLocale) -> String {
    match (level, locale) {
        (0, RuntimeLocale::En) => "Baseline enemy pressure.".to_owned(),
        (0, RuntimeLocale::ZhCn) => "敌方压力维持基准。".to_owned(),
        (1, RuntimeLocale::En) => "Enemy pressure is elevated by the operation choice.".to_owned(),
        (1, RuntimeLocale::ZhCn) => "由于行动节点选择，敌方压力已上升。".to_owned(),
        (_, RuntimeLocale::En) => format!("Enemy pressure increased by {} tiers this round.", level),
        (_, RuntimeLocale::ZhCn) => format!("本回合敌方压力提升了 {} 个档位。", level),
    }
}

fn reroll_shop(
    shop: &mut ShopState,
    round_seed: u32,
    identity: &mut IdentityState,
    modifier: RunModifierKind,
    round_event: RoundEventKind,
    shop_size_delta: i32,
) {
    let pool = UnitArchetype::all();
    let start = (shop.reroll_cursor + round_seed as usize) % pool.len();
    let mut rotated = (0..pool.len())
        .map(|offset| pool[(start + offset) % pool.len()])
        .collect::<Vec<_>>();

    if let Some(faction) = modifier.shop_bias() {
        rotated.sort_by_key(|archetype| {
            (
                if archetype.faction() == faction { 0 } else { 1 },
                archetype.key(),
            )
        });
    }

    shop.offers = rotated
        .into_iter()
        .take(
            ((SHOP_SIZE + round_event.shop_size_bonus()) as i32 + shop_size_delta)
                .max(1) as usize,
        )
        .map(|archetype| UnitInstance::new(archetype, identity))
        .collect();
    shop.reroll_cursor = (shop.reroll_cursor + 1) % pool.len();
}

fn seed_enemy_squad(round: u32, identity: &mut IdentityState) -> Vec<UnitInstance> {
    let mut units = match round {
        1 => vec![
            UnitInstance::new(UnitArchetype::AshDuelist, identity),
            UnitInstance::new(UnitArchetype::IronVanguard, identity),
        ],
        2 => vec![
            UnitInstance::new(UnitArchetype::AshDuelist, identity),
            UnitInstance::new(UnitArchetype::IronVanguard, identity),
            UnitInstance::new(UnitArchetype::VoltJuggler, identity),
        ],
        3 => vec![
            mint_starred_unit(identity, UnitArchetype::AshDuelist, 2),
            UnitInstance::new(UnitArchetype::IronVanguard, identity),
            UnitInstance::new(UnitArchetype::VoltJuggler, identity),
        ],
        4 => vec![
            mint_starred_unit(identity, UnitArchetype::AshDuelist, 2),
            mint_starred_unit(identity, UnitArchetype::IronVanguard, 2),
            UnitInstance::new(UnitArchetype::VoltJuggler, identity),
            UnitInstance::new(UnitArchetype::GraveWarden, identity),
        ],
        5 => vec![
            mint_starred_unit(identity, UnitArchetype::IronVanguard, 2),
            UnitInstance::new(UnitArchetype::SignalRanger, identity),
            UnitInstance::new(UnitArchetype::VoltJuggler, identity),
            UnitInstance::new(UnitArchetype::GraveWarden, identity),
        ],
        6 => vec![
            mint_starred_unit(identity, UnitArchetype::IronVanguard, 2),
            mint_starred_unit(identity, UnitArchetype::SignalRanger, 2),
            UnitInstance::new(UnitArchetype::VoltJuggler, identity),
            UnitInstance::new(UnitArchetype::GraveWarden, identity),
            UnitInstance::new(UnitArchetype::AshDuelist, identity),
        ],
        7 => vec![
            mint_starred_unit(identity, UnitArchetype::SignalRanger, 2),
            mint_starred_unit(identity, UnitArchetype::VoltJuggler, 2),
            UnitInstance::new(UnitArchetype::GraveWarden, identity),
            UnitInstance::new(UnitArchetype::IronVanguard, identity),
            UnitInstance::new(UnitArchetype::AshDuelist, identity),
        ],
        _ => vec![
            mint_starred_unit(identity, UnitArchetype::SignalRanger, 2),
            mint_starred_unit(identity, UnitArchetype::VoltJuggler, 2),
            mint_starred_unit(identity, UnitArchetype::GraveWarden, 2),
            mint_starred_unit(identity, UnitArchetype::IronVanguard, 2),
            UnitInstance::new(UnitArchetype::AshDuelist, identity),
        ],
    };

    units.truncate(ENEMY_SLOTS.len());
    units
}

fn enemy_threat(units: impl Iterator<Item = UnitInstance>) -> u32 {
    units
        .map(|unit| {
            let stats = scaled_stats(unit);
            stats.attack + stats.max_health.max(0) as u32 + unit.stars as u32 * 3
        })
        .sum()
}

fn enemy_intent_for_round(round: u32, locale: RuntimeLocale) -> String {
    match round {
        1 => localized(
            locale,
            "Scout squad: two bruisers test the board.",
            "侦查小队：两名前排先来试探棋盘。",
        )
        .to_owned(),
        2 => localized(
            locale,
            "Pressure spike: a third body joins the enemy lane.",
            "压力上升：敌方加入第三个单位。",
        )
        .to_owned(),
        3 => localized(
            locale,
            "First elite spike: the lead duelist upgrades to two stars.",
            "第一次精英强化：主力决斗者提升到两星。",
        )
        .to_owned(),
        4 => localized(
            locale,
            "Frontline hardens: Iron Vanguard upgrades and Grave Warden joins the wall.",
            "前线变硬：钢铁先锋升级，墓垒守卫加入防线。",
        )
        .to_owned(),
        5 => localized(
            locale,
            "Mixed threat: a ranged Signal Ranger appears behind the bruisers.",
            "混合威胁：敌方在前排后方补上了远程信号射手。",
        )
        .to_owned(),
        6 => localized(
            locale,
            "Pressure climb: upgraded ranger and a fifth body widen the enemy board.",
            "压力继续上升：升级后的射手与第五个单位一起扩宽敌方阵面。",
        )
        .to_owned(),
        7 => localized(
            locale,
            "Veteran tempo: chain damage and bruiser pressure hit together.",
            "老练节奏：连锁伤害与前排压力会同时到来。",
        )
        .to_owned(),
        _ => localized(
            locale,
            "Final warband: upgraded mixed comp with five threats online.",
            "最终战帮：五个威胁全开的升级混编阵容。",
        )
        .to_owned(),
    }
}

fn maybe_prepare_augment_draft(augments: &mut AugmentState, round: u32, modifier: RunModifierKind) {
    let draft_rounds = modifier.draft_rounds();
    if !draft_rounds.contains(&round) || augments.pending_round == Some(round) {
        return;
    }

    let mut available = AugmentKind::all()
        .into_iter()
        .filter(|augment| !augments.selected.contains(augment))
        .collect::<Vec<_>>();

    if available.is_empty() {
        return;
    }

    let start = (augments.draft_cursor + round as usize) % available.len();
    available.rotate_left(start);
    augments.pending_choices = available.into_iter().take(3).collect();
    augments.pending_round = Some(round);
    augments.draft_cursor += 1;
}

fn apply_augment_pick(augment: AugmentKind, combat: &mut CombatState) {
    match augment {
        AugmentKind::CompoundInterest => {
            combat.gold += 6;
        }
        AugmentKind::EmergencyHull => {
            combat.player_health = (combat.player_health + 6).min(30);
        }
        _ => {}
    }
}

fn push_round_history_entry(
    combat: &mut CombatState,
    augments: &AugmentState,
    enemy_squad: &EnemySquad,
    locale: RuntimeLocale,
) {
    let income_total = if combat.run_over {
        0
    } else {
        let (base_income, interest_income, streak_income, modifier_income) = round_income_preview(
            combat.gold,
            current_streak(combat),
            &augments.selected,
            combat.run_modifier,
        );
        base_income + interest_income + streak_income + modifier_income
    };

    let result = if combat.enemy_units == 0 {
        RoundOutcome::Victory
    } else {
        RoundOutcome::Defeat
    };

    let operation_label = combat
        .selected_operation
        .map(|operation| operation.label(locale))
        .unwrap_or(localized(locale, "No operation", "未选择行动"));

    let summary = match (result, locale) {
        (RoundOutcome::Victory, RuntimeLocale::En) => format!(
            "Won round {} on {} with {} allied unit(s) left. Loot {} secured / {} unsecured. Next income preview: +{}.",
            combat.round,
            operation_label,
            combat.player_units,
            combat.secured_loot,
            combat.unsecured_loot,
            income_total
        ),
        (RoundOutcome::Victory, RuntimeLocale::ZhCn) => format!(
            "第 {} 回合在 {} 下获胜，场上还剩 {} 个友军。收益为已锁定 {} / 未锁定 {}。下回合收入预览：+{}。",
            combat.round,
            operation_label,
            combat.player_units,
            combat.secured_loot,
            combat.unsecured_loot,
            income_total
        ),
        (RoundOutcome::Defeat, RuntimeLocale::En) => format!(
            "Lost round {} on {}. {} enemy unit(s) survived. Loot {} secured / {} unsecured. Next income preview: +{}.",
            combat.round,
            operation_label,
            combat.enemy_units,
            combat.secured_loot,
            combat.unsecured_loot,
            income_total
        ),
        (RoundOutcome::Defeat, RuntimeLocale::ZhCn) => format!(
            "第 {} 回合在 {} 下失利，敌方还剩 {} 个单位。收益为已锁定 {} / 未锁定 {}。下回合收入预览：+{}。",
            combat.round,
            operation_label,
            combat.enemy_units,
            combat.secured_loot,
            combat.unsecured_loot,
            income_total
        ),
    };

    combat.round_history.push(RoundHistoryEntry {
        round: combat.round,
        result,
        income_total,
        threat: enemy_threat(enemy_squad.units.iter().copied()) + combat.operation_enemy_pressure * 8,
        summary,
    });
    if combat.round_history.len() > FINAL_ROUND as usize {
        let overflow = combat.round_history.len() - FINAL_ROUND as usize;
        combat.round_history.drain(0..overflow);
    }
}

fn diagnose_round_outcome(
    combat: &CombatState,
    player_squad: &PlayerSquad,
    augments: &AugmentState,
    locale: RuntimeLocale,
) -> String {
    let deployed_units = player_squad.board.iter().flatten().count();
    let buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let capstone_online = buffs.highest_tier() >= 2;

    if combat.enemy_units == 0 {
        return if capstone_online {
            localized(
                locale,
                "Capstone synergy carried the round. Keep pressing the same route before pivoting.",
                "满羁绊直接抬走了这一回合，除非商店特别胡，否则继续沿着这条路线加压。",
            )
            .to_owned()
        } else if current_streak(combat) >= 2 {
            localized(
                locale,
                "Tempo held. Keep the streak alive unless a capstone upgrade appears.",
                "节奏已经稳住了。除非能直接补出满羁绊，否则优先保连胜。",
            )
            .to_owned()
        } else {
            localized(
                locale,
                "Board balance was enough this round. Convert pairs into a clearer carry line.",
                "这一回合靠均衡面板就赢了，接下来要把对子转成更明确的主 C 路线。",
            )
            .to_owned()
        };
    }

    if deployed_units < combat.deployment_cap {
        return localized(
            locale,
            "You entered combat down a unit. Fill the board before greed.",
            "你是少上人口进的战斗。先把棋盘站满，再谈贪经济。",
        )
        .to_owned();
    }

    if combat.gold >= 10 {
        return localized(
            locale,
            "You floated double-digit gold while losing. Spend now and stabilize before the next spike.",
            "你在输回合时还攒着两位数金币。下一轮先花钱止血，不要继续空过。",
        )
        .to_owned();
    }

    if buffs.highest_tier() == 0 {
        return localized(
            locale,
            "No active trait was online. Commit to one route instead of spreading the board thin.",
            "当前没有任何成型羁绊。不要再摊开拿牌，先明确押一条路线。",
        )
        .to_owned();
    }

    if buffs.vanguard_tier() == 0 {
        return localized(
            locale,
            "Frontline cracked first. Add a Vanguard body or health-heavy upgrade before rolling for damage.",
            "前排先崩了。先补一个前排位或生命强化，再去找输出。",
        )
        .to_owned();
    }

    if buffs.skirmisher_tier() == 0
        && !augments.selected.contains(&AugmentKind::DawnPulse)
        && !augments.selected.contains(&AugmentKind::DuskPact)
    {
        return localized(
            locale,
            "Damage ceiling was too low. Find a carry augment, a two-star backliner, or the 4-piece capstone.",
            "输出上限不够。去找主 C 强化、两星后排，或者直接冲四件套满羁绊。",
        )
        .to_owned();
    }

    localized(
        locale,
        "The enemy spike outpaced your current board. Roll or level immediately for a real power bump.",
        "敌方这波强度超过了你当前棋盘。下一回合要么刷新要么升级，必须立刻补一段实打实的强度。",
    )
    .to_owned()
}

fn normalize_player_squad(player_squad: &mut PlayerSquad, locale: RuntimeLocale) -> Vec<String> {
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
                    let anchor_unit = consumed
                        .iter()
                        .find_map(|location| unit_at_location(player_squad, *location))
                        .unwrap_or(UnitInstance {
                            agent_id: 0,
                            battle_instance_id: 0,
                            archetype,
                            stars,
                        });

                    remove_locations(player_squad, &consumed);

                    let upgraded = UnitInstance {
                        agent_id: anchor_unit.agent_id,
                        battle_instance_id: anchor_unit.battle_instance_id,
                        archetype,
                        stars: stars + 1,
                    };

                    if let Some(slot_index) = anchor_board {
                        player_squad.board[slot_index] = Some(upgraded);
                    } else {
                        player_squad.bench.push(upgraded);
                    }

                    messages.push(match locale {
                        RuntimeLocale::En => format!(
                            "Merged three {} copies into {}.",
                            archetype.label(locale),
                            upgraded.label(locale)
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "已将三个 {} 合成为 {}。",
                            archetype.label(locale),
                            upgraded.label(locale)
                        ),
                    });
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

fn unit_at_location(player_squad: &PlayerSquad, location: UnitLocation) -> Option<UnitInstance> {
    match location {
        UnitLocation::Board(index) => player_squad.board.get(index).copied().flatten(),
        UnitLocation::Bench(index) => player_squad.bench.get(index).copied(),
    }
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

fn performance_views_for(
    combat: &CombatState,
    locale: RuntimeLocale,
) -> Vec<RuntimePerformanceView> {
    let mut views = combat
        .performance_log
        .iter()
        .map(|entry| RuntimePerformanceView {
            agent_id: entry.agent_id.to_string(),
            battle_instance_id: entry.battle_instance_id.to_string(),
            label: UnitInstance {
                agent_id: entry.agent_id,
                battle_instance_id: entry.battle_instance_id,
                archetype: entry.archetype,
                stars: entry.stars,
            }
            .label(locale),
            damage_dealt: entry.damage_dealt,
            damage_taken: entry.damage_taken,
            healing_done: entry.healing_done,
            kills: entry.kills,
        })
        .collect::<Vec<_>>();

    views.sort_by(|left, right| {
        right
            .damage_dealt
            .cmp(&left.damage_dealt)
            .then_with(|| right.kills.cmp(&left.kills))
            .then_with(|| right.healing_done.cmp(&left.healing_done))
            .then_with(|| right.damage_taken.cmp(&left.damage_taken))
            .then_with(|| left.label.cmp(&right.label))
    });
    views
}

fn trait_tier(count: usize) -> u8 {
    if count >= TRAIT_CAPSTONE_THRESHOLD {
        2
    } else if count >= TRAIT_THRESHOLD {
        1
    } else {
        0
    }
}

fn ensure_performance_entry(combat: &mut CombatState, unit: UnitInstance) {
    if let Some(existing) = combat
        .performance_log
        .iter_mut()
        .find(|entry| entry.agent_id == unit.agent_id)
    {
        existing.battle_instance_id = unit.battle_instance_id;
        existing.archetype = unit.archetype;
        existing.stars = unit.stars;
    } else {
        combat.performance_log.push(CombatPerformanceEntry {
            agent_id: unit.agent_id,
            battle_instance_id: unit.battle_instance_id,
            archetype: unit.archetype,
            stars: unit.stars,
            ..CombatPerformanceEntry::default()
        });
    }
}

fn record_damage_dealt(combat: &mut CombatState, agent_id: u64, amount: u32) {
    if amount == 0 {
        return;
    }

    if let Some(entry) = combat
        .performance_log
        .iter_mut()
        .find(|entry| entry.agent_id == agent_id)
    {
        entry.damage_dealt += amount;
    }
}

fn record_damage_taken(combat: &mut CombatState, agent_id: u64, amount: u32) {
    if amount == 0 {
        return;
    }

    if let Some(entry) = combat
        .performance_log
        .iter_mut()
        .find(|entry| entry.agent_id == agent_id)
    {
        entry.damage_taken += amount;
    }
}

fn record_healing_done(combat: &mut CombatState, agent_id: u64, amount: u32) {
    if amount == 0 {
        return;
    }

    if let Some(entry) = combat
        .performance_log
        .iter_mut()
        .find(|entry| entry.agent_id == agent_id)
    {
        entry.healing_done += amount;
    }
}

fn record_kill(combat: &mut CombatState, agent_id: u64) {
    if let Some(entry) = combat
        .performance_log
        .iter_mut()
        .find(|entry| entry.agent_id == agent_id)
    {
        entry.kills += 1;
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
        dawn_count: dawn,
        dusk_count: dusk,
        vanguard_count: vanguard,
        skirmisher_count: skirmisher,
    }
}

fn trait_views_for(
    units: impl Iterator<Item = UnitInstance>,
    locale: RuntimeLocale,
) -> impl Iterator<Item = RuntimeTraitView> {
    let (dawn, dusk, vanguard, skirmisher) = trait_counts(units);

    [
        RuntimeTraitView {
            key: UnitFaction::Dawn.key().to_owned(),
            label: UnitFaction::Dawn.label(locale).to_owned(),
            count: dawn,
            threshold: TRAIT_THRESHOLD,
            capstone_threshold: TRAIT_CAPSTONE_THRESHOLD,
            tier: trait_tier(dawn) as u32,
            description: UnitFaction::Dawn.description(locale).to_owned(),
            active: dawn >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitFaction::Dusk.key().to_owned(),
            label: UnitFaction::Dusk.label(locale).to_owned(),
            count: dusk,
            threshold: TRAIT_THRESHOLD,
            capstone_threshold: TRAIT_CAPSTONE_THRESHOLD,
            tier: trait_tier(dusk) as u32,
            description: UnitFaction::Dusk.description(locale).to_owned(),
            active: dusk >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Vanguard.key().to_owned(),
            label: UnitRole::Vanguard.label(locale).to_owned(),
            count: vanguard,
            threshold: TRAIT_THRESHOLD,
            capstone_threshold: TRAIT_CAPSTONE_THRESHOLD,
            tier: trait_tier(vanguard) as u32,
            description: UnitRole::Vanguard.description(locale).to_owned(),
            active: vanguard >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Skirmisher.key().to_owned(),
            label: UnitRole::Skirmisher.label(locale).to_owned(),
            count: skirmisher,
            threshold: TRAIT_THRESHOLD,
            capstone_threshold: TRAIT_CAPSTONE_THRESHOLD,
            tier: trait_tier(skirmisher) as u32,
            description: UnitRole::Skirmisher.description(locale).to_owned(),
            active: skirmisher >= TRAIT_THRESHOLD,
        },
    ]
    .into_iter()
}

fn max_level() -> u32 {
    4
}

fn deploy_cap_for_level(level: u32) -> usize {
    (level as usize + 1).min(PLAYER_SLOTS.len())
}

fn xp_to_next_level(level: u32) -> u32 {
    if level >= max_level() { 0 } else { 4 }
}

fn grant_xp(combat: &mut CombatState, amount: u32) -> u32 {
    if combat.level >= max_level() {
        combat.xp = 0;
        return 0;
    }

    combat.xp += amount;
    let mut levels_gained = 0;

    while combat.level < max_level() {
        let threshold = xp_to_next_level(combat.level);
        if combat.xp < threshold {
            break;
        }

        combat.xp -= threshold;
        combat.level += 1;
        combat.deployment_cap = deploy_cap_for_level(combat.level);
        levels_gained += 1;
    }

    if combat.level >= max_level() {
        combat.xp = 0;
        combat.deployment_cap = deploy_cap_for_level(combat.level);
    }

    levels_gained
}

fn streak_bonus(streak: i32) -> u32 {
    let absolute = streak.unsigned_abs();
    if absolute >= 4 {
        2
    } else if absolute >= 2 {
        1
    } else {
        0
    }
}

fn current_streak(combat: &CombatState) -> i32 {
    if combat.win_streak > 0 {
        combat.win_streak as i32
    } else if combat.loss_streak > 0 {
        -(combat.loss_streak as i32)
    } else {
        0
    }
}

fn round_income_preview(
    gold: u32,
    streak: i32,
    augments: &[AugmentKind],
    modifier: RunModifierKind,
) -> (u32, u32, u32, u32) {
    let interest_cap = if augments.contains(&AugmentKind::CompoundInterest) {
        MAX_INTEREST_INCOME + 1
    } else {
        MAX_INTEREST_INCOME
    };
    let interest_income = (gold / 5).min(interest_cap);
    let streak_income = streak_bonus(streak);
    (
        ROUND_BASE_INCOME,
        interest_income,
        streak_income,
        modifier.round_bonus_income(),
    )
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

fn resolved_stats(
    unit: UnitInstance,
    buffs: TraitBuffs,
    augments: &[AugmentKind],
    modifier: RunModifierKind,
) -> UnitStats {
    let mut stats = scaled_stats(unit);

    if buffs.vanguard_tier() >= 1 {
        stats.max_health += 2;
    }

    if buffs.vanguard_tier() >= 2 {
        stats.max_health += 2;
    }

    if buffs.skirmisher_tier() >= 1 {
        stats.attack += 1;
    }

    if buffs.skirmisher_tier() >= 2 && matches!(unit.archetype.role(), UnitRole::Skirmisher) {
        stats.attack += 1;
    }

    match unit.archetype.faction() {
        UnitFaction::Dawn => {
            if buffs.dawn_tier() >= 1 {
                stats.attack += 1;
            }
            if buffs.dawn_tier() >= 2 {
                stats.attack += 1;
            }
        }
        UnitFaction::Dusk => {
            if buffs.dusk_tier() >= 1 {
                stats.max_health += 2;
            }
            if buffs.dusk_tier() >= 2 {
                stats.max_health += 3;
                stats.attack += 1;
            }
        }
    }

    if augments.contains(&AugmentKind::VanguardDoctrine)
        && matches!(unit.archetype.role(), UnitRole::Vanguard)
    {
        stats.max_health += 3;
    }

    if augments.contains(&AugmentKind::SkirmisherDrive)
        && matches!(unit.archetype.role(), UnitRole::Skirmisher)
    {
        stats.attack += 1;
    }

    if augments.contains(&AugmentKind::DawnPulse)
        && matches!(unit.archetype.faction(), UnitFaction::Dawn)
    {
        stats.attack += 1;
    }

    if augments.contains(&AugmentKind::DuskPact)
        && matches!(unit.archetype.faction(), UnitFaction::Dusk)
    {
        stats.max_health += 1;
        stats.attack += 1;
    }

    if augments.contains(&AugmentKind::VanguardDoctrine)
        && matches!(unit.archetype.role(), UnitRole::Vanguard)
    {
        stats.max_health += 1;
    }

    stats.attack = (stats.attack as i32 + modifier.attack_bonus(unit.archetype.faction())).max(1) as u32;
    stats.max_health = (stats.max_health + modifier.health_bonus(unit.archetype.faction())).max(4);

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

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(
        entity_id: u32,
        owner: UnitOwner,
        slot_index: usize,
        archetype: UnitArchetype,
        health: i32,
        max_health: i32,
        attack: u32,
        action_counter: u32,
    ) -> CombatUnitSnapshot {
        CombatUnitSnapshot {
            entity: Entity::from_raw_u32(entity_id).expect("valid entity"),
            owner,
            slot_index,
            agent_id: entity_id as u64,
            battle_instance_id: entity_id as u64,
            archetype,
            stars: 1,
            health,
            max_health,
            attack,
            action_counter,
        }
    }

    fn seeded_identity() -> IdentityState {
        IdentityState::default()
    }

    fn seeded_squads() -> (IdentityState, PlayerSquad, EnemySquad) {
        let mut identity = seeded_identity();
        let player_squad = PlayerSquad {
            board: [
                Some(UnitInstance::new(
                    UnitArchetype::VerdantBruiser,
                    &mut identity,
                )),
                Some(UnitInstance::new(UnitArchetype::EmberMedic, &mut identity)),
                None,
                None,
                None,
            ],
            bench: vec![UnitInstance::new(
                UnitArchetype::SignalRanger,
                &mut identity,
            )],
        };
        let enemy_squad = EnemySquad {
            units: seed_enemy_squad(3, &mut identity),
        };

        (identity, player_squad, enemy_squad)
    }

    fn directive_order(
        directive: CombatDirective,
        lane: Option<CombatDirectiveLane>,
        duration_ticks: u32,
    ) -> CombatDirectiveOrder {
        CombatDirectiveOrder::new(directive, lane, Some(duration_ticks))
    }

    #[test]
    fn merges_three_matching_copies_across_board_and_bench() {
        let mut identity = IdentityState::default();
        let mut squad = PlayerSquad {
            board: [
                Some(UnitInstance::new(
                    UnitArchetype::VerdantBruiser,
                    &mut identity,
                )),
                None,
                None,
                None,
                None,
            ],
            bench: vec![
                UnitInstance::new(UnitArchetype::VerdantBruiser, &mut identity),
                UnitInstance::new(UnitArchetype::VerdantBruiser, &mut identity),
            ],
        };

        let anchor_agent_id = squad.board[0].map(|unit| unit.agent_id).unwrap_or_default();
        let anchor_battle_instance_id = squad.board[0]
            .map(|unit| unit.battle_instance_id)
            .unwrap_or_default();

        let messages = normalize_player_squad(&mut squad, RuntimeLocale::En);

        assert_eq!(messages.len(), 1);
        assert!(messages[0].contains("Verdant Bruiser II"));
        assert_eq!(
            squad.board[0],
            Some(UnitInstance {
                agent_id: anchor_agent_id,
                battle_instance_id: anchor_battle_instance_id,
                archetype: UnitArchetype::VerdantBruiser,
                stars: 2,
            })
        );
        assert!(squad.bench.is_empty());
    }

    #[test]
    fn focus_backline_directive_biases_player_targeting() {
        let attacker = snapshot(
            1,
            UnitOwner::Player,
            0,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            0,
        );
        let enemy_front = snapshot(
            2,
            UnitOwner::Enemy,
            4,
            UnitArchetype::IronVanguard,
            4,
            16,
            3,
            0,
        );
        let enemy_back = snapshot(
            3,
            UnitOwner::Enemy,
            1,
            UnitArchetype::FrostOracle,
            9,
            9,
            6,
            0,
        );

        let baseline_target =
            select_target(attacker, &[enemy_front, enemy_back], None, &[], TraitBuffs::default())
                .expect("target");
        let focused_target = select_target(
            attacker,
            &[enemy_front, enemy_back],
            Some(directive_order(CombatDirective::FocusBackline, None, 3)),
            &[],
            TraitBuffs::default(),
        )
        .expect("target");

        assert_eq!(baseline_target.entity, enemy_front.entity);
        assert_eq!(focused_target.entity, enemy_back.entity);
    }

    #[test]
    fn hold_skills_directive_suppresses_cadence_bonus_damage() {
        let attacker = snapshot(
            1,
            UnitOwner::Player,
            0,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            1,
        );
        let target = snapshot(
            2,
            UnitOwner::Enemy,
            0,
            UnitArchetype::VerdantBruiser,
            14,
            14,
            4,
            0,
        );

        let baseline =
            resolve_attack(
                attacker,
                &[attacker],
                &[target],
                RuntimeLocale::En,
                None,
                &[],
                TraitBuffs::default(),
            )
            .expect("baseline action");
        let held = resolve_attack(
            attacker,
            &[attacker],
            &[target],
            RuntimeLocale::En,
            Some(directive_order(CombatDirective::HoldSkills, None, 2)),
            &[],
            TraitBuffs::default(),
        )
        .expect("held action");

        assert_eq!(baseline.hits[0].1, 7);
        assert_eq!(held.hits[0].1, 5);
        assert!(held.highlight.contains("held the skill window"));
    }

    #[test]
    fn lumen_sentinel_third_strike_heals_and_hits_harder() {
        let attacker = snapshot(
            1,
            UnitOwner::Player,
            0,
            UnitArchetype::LumenSentinel,
            8,
            14,
            4,
            2,
        );
        let target = snapshot(
            2,
            UnitOwner::Enemy,
            0,
            UnitArchetype::IronVanguard,
            16,
            16,
            3,
            0,
        );

        let action = resolve_attack(
            attacker,
            &[attacker],
            &[target],
            RuntimeLocale::En,
            None,
            &[],
            TraitBuffs::default(),
        )
        .expect("sentinel action");

        assert_eq!(action.hits[0].1, 6);
        assert_eq!(action.heals, vec![(attacker.entity, 2)]);
        assert!(action.highlight.contains("Solar Riposte"));
    }

    #[test]
    fn shade_runner_second_shot_adds_echo_damage_on_the_same_target() {
        let attacker = snapshot(
            1,
            UnitOwner::Player,
            3,
            UnitArchetype::ShadeRunner,
            10,
            10,
            5,
            1,
        );
        let target = snapshot(
            2,
            UnitOwner::Enemy,
            0,
            UnitArchetype::VerdantBruiser,
            15,
            15,
            4,
            0,
        );

        let action = resolve_attack(
            attacker,
            &[attacker],
            &[target],
            RuntimeLocale::En,
            None,
            &[],
            TraitBuffs::default(),
        )
        .expect("runner action");

        assert_eq!(action.hits.len(), 2);
        assert_eq!(action.hits[0], (target.entity, 5));
        assert_eq!(action.hits[1], (target.entity, 2));
        assert!(action.highlight.contains("Shadow Echo"));
    }

    #[test]
    fn fallback_left_directive_deprioritizes_left_wing_targets() {
        let enemy_attacker = snapshot(
            9,
            UnitOwner::Enemy,
            0,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            0,
        );
        let left_wing = snapshot(
            10,
            UnitOwner::Player,
            0,
            UnitArchetype::VerdantBruiser,
            4,
            15,
            4,
            0,
        );
        let center_lane = snapshot(
            11,
            UnitOwner::Player,
            2,
            UnitArchetype::AshDuelist,
            8,
            12,
            4,
            0,
        );

        let redirected = select_target(
            enemy_attacker,
            &[left_wing, center_lane],
            Some(directive_order(CombatDirective::FallbackLeft, None, 3)),
            &[],
            TraitBuffs::default(),
        )
        .expect("redirected target");

        assert_eq!(redirected.entity, center_lane.entity);
        assert_eq!(
            mitigate_damage(
                left_wing.archetype,
                4,
                left_wing.owner,
                left_wing.slot_index,
                Some(directive_order(CombatDirective::FallbackLeft, None, 3)),
                &[],
                TraitBuffs::default(),
            ),
            3
        );
    }

    #[test]
    fn focus_backline_lane_bias_prefers_matching_backline_target() {
        let attacker = snapshot(
            1,
            UnitOwner::Player,
            0,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            0,
        );
        let left_back = snapshot(
            2,
            UnitOwner::Enemy,
            1,
            UnitArchetype::FrostOracle,
            9,
            9,
            6,
            0,
        );
        let right_back = snapshot(
            3,
            UnitOwner::Enemy,
            3,
            UnitArchetype::VoltJuggler,
            11,
            11,
            5,
            0,
        );

        let focused_target = select_target(
            attacker,
            &[left_back, right_back],
            Some(directive_order(
                CombatDirective::FocusBackline,
                Some(CombatDirectiveLane::Right),
                3,
            )),
            &[],
            TraitBuffs::default(),
        )
        .expect("target");

        assert_eq!(focused_target.entity, right_back.entity);
    }

    #[test]
    fn hold_skills_lane_only_suppresses_units_on_that_lane() {
        let left_attacker = snapshot(
            1,
            UnitOwner::Player,
            0,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            1,
        );
        let right_attacker = snapshot(
            2,
            UnitOwner::Player,
            3,
            UnitArchetype::SignalRanger,
            10,
            10,
            5,
            1,
        );
        let target = snapshot(
            3,
            UnitOwner::Enemy,
            0,
            UnitArchetype::VerdantBruiser,
            14,
            14,
            4,
            0,
        );
        let directive = directive_order(
            CombatDirective::HoldSkills,
            Some(CombatDirectiveLane::Left),
            2,
        );

        let left_action = resolve_attack(
            left_attacker,
            &[left_attacker, right_attacker],
            &[target],
            RuntimeLocale::En,
            Some(directive),
            &[],
            TraitBuffs::default(),
        )
        .expect("left action");
        let right_action = resolve_attack(
            right_attacker,
            &[left_attacker, right_attacker],
            &[target],
            RuntimeLocale::En,
            Some(directive),
            &[],
            TraitBuffs::default(),
        )
        .expect("right action");

        assert_eq!(left_action.hits[0].1, 5);
        assert_eq!(right_action.hits[0].1, 7);
    }

    #[test]
    fn replace_combat_plan_sets_active_and_queue() {
        let mut combat = CombatState::default();
        combat.phase = CombatPhase::Preparation;

        replace_combat_plan(
            &mut combat,
            vec![
                directive_order(CombatDirective::HoldSkills, None, 2),
                directive_order(
                    CombatDirective::FocusBackline,
                    Some(CombatDirectiveLane::Right),
                    3,
                ),
            ],
            RuntimeLocale::En,
        );

        assert_eq!(
            combat.active_directive.map(|directive| directive.directive),
            Some(CombatDirective::HoldSkills)
        );
        assert_eq!(combat.queued_directives.len(), 1);
        assert_eq!(
            combat.queued_directives[0].lane,
            Some(CombatDirectiveLane::Right)
        );
    }

    #[test]
    fn combat_plan_advances_after_duration_expires() {
        let mut combat = CombatState::default();
        combat.phase = CombatPhase::Combat;

        replace_combat_plan(
            &mut combat,
            vec![
                directive_order(CombatDirective::HoldSkills, None, 1),
                directive_order(
                    CombatDirective::FocusBackline,
                    Some(CombatDirectiveLane::Right),
                    3,
                ),
            ],
            RuntimeLocale::En,
        );

        advance_combat_plan_tick(&mut combat);

        let active = combat.active_directive.expect("promoted directive");
        assert_eq!(active.directive, CombatDirective::FocusBackline);
        assert_eq!(active.remaining_ticks, 3);
        assert!(combat.queued_directives.is_empty());
    }

    #[test]
    fn clear_combat_plan_empties_active_and_queue() {
        let mut combat = CombatState::default();

        replace_combat_plan(
            &mut combat,
            vec![
                directive_order(CombatDirective::HoldSkills, None, 2),
                directive_order(CombatDirective::FallbackLeft, None, 3),
            ],
            RuntimeLocale::ZhCn,
        );
        clear_combat_plan(&mut combat, RuntimeLocale::ZhCn);

        assert!(combat.active_directive.is_none());
        assert!(combat.queued_directives.is_empty());
    }

    #[test]
    fn reposition_board_unit_moves_and_swaps_slots() {
        let mut identity = seeded_identity();
        let left = UnitInstance::new(UnitArchetype::VerdantBruiser, &mut identity);
        let right = UnitInstance::new(UnitArchetype::EmberMedic, &mut identity);
        let mut board = [Some(left), Some(right), None, None, None];

        let swap = reposition_board_unit(&mut board, 0, 1).expect("swap result");
        assert_eq!(swap.moved, left);
        assert_eq!(swap.displaced, Some(right));
        assert_eq!(board[0], Some(right));
        assert_eq!(board[1], Some(left));

        let move_to_empty = reposition_board_unit(&mut board, 1, 3).expect("move result");
        assert_eq!(move_to_empty.moved, left);
        assert_eq!(move_to_empty.displaced, None);
        assert_eq!(board[1], None);
        assert_eq!(board[3], Some(left));
    }

    #[test]
    fn round_income_preview_respects_interest_caps_and_streaks() {
        let standard = round_income_preview(25, 4, &[], RunModifierKind::RichOpening);
        assert_eq!(standard, (ROUND_BASE_INCOME, MAX_INTEREST_INCOME, 2, 0));

        let with_compound_interest = round_income_preview(
            25,
            4,
            &[AugmentKind::CompoundInterest],
            RunModifierKind::RichOpening,
        );
        assert_eq!(
            with_compound_interest,
            (ROUND_BASE_INCOME, MAX_INTEREST_INCOME + 1, 2, 0)
        );
    }

    #[test]
    fn thin_bench_modifier_adds_bonus_income_and_caps_bench() {
        let preview = round_income_preview(10, 0, &[], RunModifierKind::ThinBench);
        assert_eq!(preview, (ROUND_BASE_INCOME, 2, 0, 1));
        assert_eq!(RunModifierKind::ThinBench.bench_capacity(), 4);
    }

    #[test]
    fn starter_doctrines_seed_distinct_openers_and_bonus_curves() {
        let mut identity = seeded_identity();
        let open_market = RuntimeStarterDoctrine::OpenMarket.starting_bench(&mut identity);
        let dawn_relay = RuntimeStarterDoctrine::DawnRelay.starting_bench(&mut identity);
        let iron_wall = RuntimeStarterDoctrine::IronWall.starting_bench(&mut identity);

        assert_eq!(RuntimeStarterDoctrine::Balanced.opening_gold_bonus(), 0);
        assert_eq!(RuntimeStarterDoctrine::DuskRaid.opening_gold_bonus(), 1);
        assert_eq!(RuntimeStarterDoctrine::OpenMarket.opening_gold_bonus(), 2);
        assert_eq!(RuntimeStarterDoctrine::DawnRelay.opening_health_bonus(), 2);
        assert_eq!(RuntimeStarterDoctrine::IronWall.opening_health_bonus(), 3);
        assert_eq!(
            open_market
                .iter()
                .map(|unit| unit.archetype)
                .collect::<Vec<_>>(),
            vec![UnitArchetype::SignalRanger, UnitArchetype::FrostOracle]
        );
        assert_eq!(
            dawn_relay
                .iter()
                .map(|unit| unit.archetype)
                .collect::<Vec<_>>(),
            vec![UnitArchetype::VerdantBruiser, UnitArchetype::LumenSentinel]
        );
        assert_eq!(
            iron_wall
                .iter()
                .map(|unit| unit.archetype)
                .collect::<Vec<_>>(),
            vec![UnitArchetype::IronVanguard, UnitArchetype::GraveWarden]
        );
    }

    #[test]
    fn performance_views_rank_round_impact() {
        let mut combat = CombatState::default();
        let mut identity = seeded_identity();
        let bruiser = UnitInstance::new(UnitArchetype::VerdantBruiser, &mut identity);
        let medic = UnitInstance::new(UnitArchetype::EmberMedic, &mut identity);

        ensure_performance_entry(&mut combat, bruiser);
        ensure_performance_entry(&mut combat, medic);
        record_damage_dealt(&mut combat, bruiser.agent_id, 11);
        record_damage_taken(&mut combat, bruiser.agent_id, 6);
        record_kill(&mut combat, bruiser.agent_id);
        record_healing_done(&mut combat, medic.agent_id, 7);

        let leaders = performance_views_for(&combat, RuntimeLocale::En);

        assert_eq!(leaders.len(), 2);
        assert_eq!(leaders[0].label, bruiser.label(RuntimeLocale::En));
        assert_eq!(leaders[0].damage_dealt, 11);
        assert_eq!(leaders[0].kills, 1);
        assert_eq!(leaders[1].label, medic.label(RuntimeLocale::En));
        assert_eq!(leaders[1].healing_done, 7);
    }

    #[test]
    fn operation_cards_for_shows_transfer_once_loot_exists() {
        let mut combat = CombatState::default();

        let opening_cards = operation_cards_for(&combat);
        assert!(opening_cards.contains(&RunOperationKind::FieldCache));
        assert!(!opening_cards.contains(&RunOperationKind::TacticalTransfer));

        combat.unsecured_loot = 2;
        let loaded_cards = operation_cards_for(&combat);
        assert!(loaded_cards.contains(&RunOperationKind::TacticalTransfer));
        assert!(!loaded_cards.contains(&RunOperationKind::FieldCache));
    }

    #[test]
    fn lock_loot_moves_unsecured_into_secured_and_scores() {
        let mut combat = CombatState::default();
        combat.unsecured_loot = 3;

        let locked = lock_loot(&mut combat, 2);

        assert_eq!(locked, 2);
        assert_eq!(combat.secured_loot, 2);
        assert_eq!(combat.unsecured_loot, 1);
        assert_eq!(combat.score, 2 * SECURED_LOOT_SCORE);
    }

    #[test]
    fn apply_round_upkeep_consumes_supplies_and_medical_before_damage() {
        let mut combat = CombatState::default();
        combat.supplies = 1;
        combat.medical = 1;
        combat.contamination = 2;
        combat.player_health = 10;

        let upkeep = apply_round_upkeep(&mut combat);

        assert_eq!(upkeep.supply_spent, 1);
        assert_eq!(upkeep.contamination_treated, 1);
        assert_eq!(upkeep.contamination_damage, 1);
        assert_eq!(combat.supplies, 0);
        assert_eq!(combat.medical, 0);
        assert_eq!(combat.contamination, 1);
        assert_eq!(combat.player_health, 9);
    }

    #[test]
    fn deep_raid_adds_loot_pressure_and_wider_shop() {
        let mut combat = CombatState::default();
        let mut shop = ShopState::default();
        let mut identity = seeded_identity();

        reroll_shop(
            &mut shop,
            combat.round,
            &mut identity,
            combat.run_modifier,
            RoundEventKind::for_round(combat.round),
            0,
        );
        let baseline_shop_size = shop.offers.len();

        apply_operation_choice(
            RunOperationKind::DeepRaid,
            &mut combat,
            &mut shop,
            &mut identity,
            RuntimeLocale::En,
        );

        assert_eq!(combat.unsecured_loot, 2);
        assert_eq!(combat.contamination, 1);
        assert_eq!(combat.operation_enemy_pressure, 1);
        assert_eq!(shop.offers.len(), baseline_shop_size + 1);
    }

    #[test]
    fn dawn_surge_shop_bias_frontloads_dawn_units() {
        let mut shop = ShopState::default();
        let mut identity = seeded_identity();

        reroll_shop(
            &mut shop,
            1,
            &mut identity,
            RunModifierKind::DawnSurge,
            RoundEventKind::Standard,
            0,
        );

        assert_eq!(shop.offers.len(), SHOP_SIZE);
        assert!(shop.offers[0].archetype.faction() == UnitFaction::Dawn);
        assert!(shop.offers[1].archetype.faction() == UnitFaction::Dawn);
    }

    #[test]
    fn push_round_history_entry_records_preview_and_result() {
        let mut combat = CombatState::default();
        combat.round = 3;
        combat.enemy_units = 0;
        combat.player_units = 2;
        combat.win_streak = 2;
        combat.run_modifier = RunModifierKind::ThinBench;
        let augments = AugmentState {
            selected: vec![AugmentKind::CompoundInterest],
            ..AugmentState::default()
        };
        let mut identity = seeded_identity();
        let enemy_squad = EnemySquad {
            units: seed_enemy_squad(3, &mut identity),
        };

        push_round_history_entry(&mut combat, &augments, &enemy_squad, RuntimeLocale::En);

        assert_eq!(combat.round_history.len(), 1);
        assert_eq!(combat.round_history[0].round, 3);
        assert_eq!(combat.round_history[0].result, RoundOutcome::Victory);
        assert!(combat.round_history[0].income_total >= ROUND_BASE_INCOME + 1);
    }

    #[test]
    fn grant_xp_levels_up_and_unlocks_extra_deployment_capacity() {
        let mut combat = CombatState::default();
        combat.xp = 3;

        let levels_gained = grant_xp(&mut combat, 1);

        assert_eq!(levels_gained, 1);
        assert_eq!(combat.level, 2);
        assert_eq!(combat.xp, 0);
        assert_eq!(combat.deployment_cap, deploy_cap_for_level(2));
    }

    #[test]
    fn resolved_stats_stack_traits_and_augments_for_readable_builds() {
        let mut identity = seeded_identity();
        let unit = UnitInstance::new(UnitArchetype::SignalRanger, &mut identity);

        let stats = resolved_stats(
            unit,
            TraitBuffs {
                dawn_count: 2,
                dusk_count: 0,
                vanguard_count: 0,
                skirmisher_count: 2,
            },
            &[AugmentKind::SkirmisherDrive, AugmentKind::DawnPulse],
            RunModifierKind::RichOpening,
        );

        assert_eq!(stats.attack, 9);
        assert_eq!(stats.max_health, unit.archetype.base_health());
    }

    #[test]
    fn trait_capstone_layers_extra_stats_and_mitigation() {
        let mut identity = seeded_identity();
        let skirmisher = UnitInstance::new(UnitArchetype::SignalRanger, &mut identity);
        let vanguard = UnitInstance::new(UnitArchetype::IronVanguard, &mut identity);
        let buffs = TraitBuffs {
            dawn_count: 4,
            dusk_count: 0,
            vanguard_count: 4,
            skirmisher_count: 4,
        };

        let skirmisher_stats = resolved_stats(
            skirmisher,
            buffs,
            &[],
            RunModifierKind::RichOpening,
        );
        let vanguard_stats =
            resolved_stats(vanguard, buffs, &[], RunModifierKind::RichOpening);

        assert_eq!(skirmisher_stats.attack, skirmisher.archetype.base_attack() + 4);
        assert_eq!(vanguard_stats.max_health, vanguard.archetype.base_health() + 4);
        assert_eq!(
            mitigate_damage(
                vanguard.archetype,
                5,
                UnitOwner::Player,
                0,
                None,
                &[],
                buffs,
            ),
            3
        );
    }

    #[test]
    fn high_roll_market_event_expands_shop_and_zeroes_first_reroll() {
        let mut shop = ShopState::default();
        let mut identity = seeded_identity();
        let mut combat = CombatState::default();
        combat.round = 4;
        combat.free_reroll_available = true;

        reroll_shop(
            &mut shop,
            combat.round,
            &mut identity,
            RunModifierKind::RichOpening,
            RoundEventKind::for_round(combat.round),
            0,
        );

        assert_eq!(
            shop.offers.len(),
            SHOP_SIZE + RoundEventKind::HighRollMarket.shop_size_bonus()
        );
        assert_eq!(effective_reroll_cost(&combat), 0);
    }

    #[test]
    fn seed_enemy_squad_scales_to_the_final_board_cap() {
        let mut identity = seeded_identity();
        let opening = seed_enemy_squad(1, &mut identity);
        let late_game = seed_enemy_squad(FINAL_ROUND, &mut identity);

        assert_eq!(opening.len(), 2);
        assert_eq!(late_game.len(), ENEMY_SLOTS.len());
        assert!(late_game.iter().filter(|unit| unit.stars == 2).count() >= 3);
    }

    #[test]
    fn serialize_run_state_tracks_live_combat_and_skips_finished_runs() {
        let (identity, player_squad, enemy_squad) = seeded_squads();
        let shop = ShopState::default();
        let augments = AugmentState::default();

        let prep_combat = CombatState::default();
        let prep_serialized = serialize_run_state_from_persisted_live_units(
            &prep_combat,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            &[PersistedLiveUnit {
                owner: UnitOwner::Player,
                slot_index: 0,
                agent_id: 11,
                battle_instance_id: 22,
                archetype: UnitArchetype::VerdantBruiser,
                stars: 1,
                health: 12,
                max_health: 15,
                attack: 4,
                action_counter: 1,
            }],
        )
        .expect("prep state should serialize");
        let prep_state = serde_json::from_str::<PersistedRunState>(&prep_serialized)
            .expect("prep state should deserialize");
        assert!(prep_state.live_units.is_empty());

        let mut combat_state = CombatState::default();
        combat_state.phase = CombatPhase::Combat;
        let combat_serialized = serialize_run_state_from_persisted_live_units(
            &combat_state,
            &shop,
            &identity,
            &player_squad,
            &enemy_squad,
            &augments,
            &[PersistedLiveUnit {
                owner: UnitOwner::Enemy,
                slot_index: 1,
                agent_id: 33,
                battle_instance_id: 44,
                archetype: UnitArchetype::IronVanguard,
                stars: 2,
                health: 20,
                max_health: 28,
                attack: 6,
                action_counter: 2,
            }],
        )
        .expect("combat state should serialize");
        let combat_state = serde_json::from_str::<PersistedRunState>(&combat_serialized)
            .expect("combat state should deserialize");
        assert_eq!(combat_state.live_units.len(), 1);
        assert_eq!(combat_state.live_units[0].owner, UnitOwner::Enemy);

        let mut completed_run = CombatState::default();
        completed_run.run_over = true;
        assert!(
            serialize_run_state_from_persisted_live_units(
                &completed_run,
                &shop,
                &identity,
                &player_squad,
                &enemy_squad,
                &augments,
                &[],
            )
            .is_none()
        );
    }
}
