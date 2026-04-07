use crate::{GameState, RuntimeConfig, RuntimeLocale};
use crate::web_bridge::{RuntimeCommand, take_runtime_commands};
use bevy::prelude::*;
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
const STARTING_HEALTH: u32 = 20;
const ROUND_BASE_INCOME: u32 = 4;
const PASSIVE_ROUND_XP: u32 = 1;
const MAX_INTEREST_INCOME: u32 = 3;
const COMBAT_INTERVAL: f32 = 0.7;
const TRAIT_THRESHOLD: usize = 2;
const MAX_STARS: u8 = 3;
const FINAL_ROUND: u32 = 8;

const PLAYER_SLOTS: [(usize, usize); 5] = [(0, 1), (1, 1), (2, 1), (3, 1), (1, 2)];
const ENEMY_SLOTS: [(usize, usize); 5] = [(0, 5), (1, 5), (2, 5), (3, 5), (2, 4)];

fn localized(locale: RuntimeLocale, en: &'static str, zh: &'static str) -> &'static str {
    match locale {
        RuntimeLocale::En => en,
        RuntimeLocale::ZhCn => zh,
    }
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

#[derive(Resource, Clone, Debug)]
pub struct CombatState {
    pub phase: CombatPhase,
    pub round: u32,
    pub run_number: u32,
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
    pub status: String,
}

impl Default for CombatState {
    fn default() -> Self {
        Self {
            phase: CombatPhase::Preparation,
            round: 1,
            run_number: 1,
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
    pub augment_draft_round: u32,
    pub enemy_threat: u32,
    pub enemy_intent: String,
    pub bench_capacity: usize,
    pub board_capacity: usize,
    pub deployment_cap: usize,
    pub streak: i32,
    pub base_income: u32,
    pub interest_income: u32,
    pub streak_income: u32,
    pub round_resolved: bool,
    pub run_over: bool,
    pub run_result: String,
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
            augment_draft_round: 0,
            enemy_threat: 0,
            enemy_intent: "Awaiting board allocation.".to_owned(),
            bench_capacity: BENCH_CAPACITY,
            board_capacity: PLAYER_SLOTS.len(),
            deployment_cap: deploy_cap_for_level(1),
            streak: 0,
            base_income: ROUND_BASE_INCOME,
            interest_income: 0,
            streak_income: 0,
            round_resolved: false,
            run_over: false,
            run_result: RunResult::Active.as_str().to_owned(),
            completed: false,
        }
    }
}

#[derive(Resource, Default)]
struct ShopState {
    offers: Vec<UnitInstance>,
    reroll_cursor: usize,
    locked: bool,
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

#[derive(Resource, Default)]
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitOwner {
    Player,
    Enemy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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
                "Your Vanguard units gain +3 health.",
                "你的前排单位获得 +3 生命。",
            ),
            Self::SkirmisherDrive => localized(
                locale,
                "Your Skirmisher units gain +1 attack.",
                "你的游击单位获得 +1 攻击。",
            ),
            Self::DawnPulse => localized(
                locale,
                "Your Dawn units gain +1 attack.",
                "你的黎明单位获得 +1 攻击。",
            ),
            Self::DuskPact => localized(
                locale,
                "Your Dusk units gain +3 health.",
                "你的黄昏单位获得 +3 生命。",
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
                "2 deployed Dawn units: Dawn allies gain +1 attack.",
                "部署 2 个黎明单位：所有黎明友军获得 +1 攻击。",
            ),
            UnitFaction::Dusk => localized(
                locale,
                "2 deployed Dusk units: Dusk allies gain +2 health.",
                "部署 2 个黄昏单位：所有黄昏友军获得 +2 生命。",
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
                "2 deployed Vanguards: all allies gain +2 health.",
                "部署 2 个前排单位：所有友军获得 +2 生命。",
            ),
            UnitRole::Skirmisher => localized(
                locale,
                "2 deployed Skirmishers: all allies gain +1 attack.",
                "部署 2 个游击单位：所有友军获得 +1 攻击。",
            ),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum UnitArchetype {
    VerdantBruiser,
    SignalRanger,
    AshDuelist,
    IronVanguard,
    FrostOracle,
    EmberMedic,
    VoltJuggler,
    GraveWarden,
}

impl UnitArchetype {
    fn all() -> [Self; 8] {
        [
            Self::SignalRanger,
            Self::AshDuelist,
            Self::IronVanguard,
            Self::FrostOracle,
            Self::VerdantBruiser,
            Self::EmberMedic,
            Self::VoltJuggler,
            Self::GraveWarden,
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
        }
    }

    fn cast_state(self, action_counter: u32, locale: RuntimeLocale) -> &'static str {
        match self {
            Self::VerdantBruiser
            | Self::SignalRanger
            | Self::IronVanguard
            | Self::VoltJuggler => {
                if (action_counter + 1) % 2 == 0 {
                    localized(locale, "Next attack is empowered.", "下一次攻击已强化。")
                } else {
                    localized(locale, "One swing until the empowered cast.", "再攻击一次就会进入强化。")
                }
            }
            Self::FrostOracle => {
                if (action_counter + 1) % 3 == 0 {
                    localized(locale, "Next cast detonates with frost burst.", "下一次施法会引爆霜爆。")
                } else {
                    localized(locale, "Charging the next frost burst.", "正在为下一次霜爆蓄势。")
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
        }
    }

    fn faction(self) -> UnitFaction {
        match self {
            Self::VerdantBruiser
            | Self::SignalRanger
            | Self::FrostOracle
            | Self::EmberMedic => UnitFaction::Dawn,
            Self::AshDuelist
            | Self::IronVanguard
            | Self::VoltJuggler
            | Self::GraveWarden => UnitFaction::Dusk,
        }
    }

    fn role(self) -> UnitRole {
        match self {
            Self::VerdantBruiser
            | Self::IronVanguard
            | Self::EmberMedic
            | Self::GraveWarden => UnitRole::Vanguard,
            Self::SignalRanger
            | Self::AshDuelist
            | Self::FrostOracle
            | Self::VoltJuggler => UnitRole::Skirmisher,
        }
    }

    fn color(self, owner: UnitOwner) -> Color {
        match (self, owner) {
            (Self::VerdantBruiser, UnitOwner::Player) => Color::linear_rgba(0.30, 0.83, 0.79, 0.98),
            (Self::SignalRanger, UnitOwner::Player) => Color::linear_rgba(0.32, 0.62, 0.93, 0.98),
            (Self::FrostOracle, UnitOwner::Player) => Color::linear_rgba(0.63, 0.73, 0.97, 0.98),
            (Self::EmberMedic, UnitOwner::Player) => Color::linear_rgba(0.95, 0.66, 0.35, 0.98),
            (Self::AshDuelist, UnitOwner::Enemy) => Color::linear_rgba(0.94, 0.41, 0.58, 0.98),
            (Self::IronVanguard, UnitOwner::Enemy) => Color::linear_rgba(0.82, 0.30, 0.35, 0.98),
            (Self::VoltJuggler, UnitOwner::Enemy) => Color::linear_rgba(0.74, 0.42, 0.95, 0.98),
            (Self::GraveWarden, UnitOwner::Enemy) => Color::linear_rgba(0.45, 0.50, 0.59, 0.98),
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

    fn label(self, locale: RuntimeLocale) -> String {
        format!("{} {}", self.archetype.label(locale), star_badge(self.stars))
    }

    fn sell_value(self) -> u32 {
        SELL_VALUE_BASE * self.stars as u32
    }

    fn base_view(self, locale: RuntimeLocale) -> RuntimeUnitView {
        let stats = scaled_stats(self);
        RuntimeUnitView {
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
        locale: RuntimeLocale,
    ) -> RuntimeUnitView {
        let stats = resolved_stats(self, buffs, augments);
        RuntimeUnitView {
            attack: stats.attack,
            health: stats.max_health.max(1) as u32,
            ..self.base_view(locale)
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

#[derive(Clone, Copy, Debug)]
struct CombatUnitSnapshot {
    entity: Entity,
    owner: UnitOwner,
    slot_index: usize,
    archetype: UnitArchetype,
    stars: u8,
    health: i32,
    max_health: i32,
    attack: u32,
    action_counter: u32,
}

#[derive(Clone, Debug)]
struct ResolvedCombatAction {
    hits: Vec<(Entity, i32)>,
    heals: Vec<(Entity, i32)>,
    highlight: String,
}

impl Plugin for StarterScenePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<BoardConfig>()
            .init_resource::<CombatState>()
            .init_resource::<StarterSliceProjection>()
            .init_resource::<ShopState>()
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

    reset_run_state(
        &mut commands,
        &board,
        config.locale,
        &mut combat,
        &mut shop,
        &mut player_squad,
        &mut enemy_squad,
        &mut augments,
        &mut combat_timer,
        false,
    );
    update_projection_from_state(
        &combat,
        &shop,
        &player_squad,
        &enemy_squad,
        &augments,
        config.locale,
        &mut projection,
    );
}

fn reset_run_state(
    commands: &mut Commands,
    board: &BoardConfig,
    locale: RuntimeLocale,
    combat: &mut CombatState,
    shop: &mut ShopState,
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
    combat_timer.0.reset();

    shop.locked = false;
    shop.offers.clear();
    *augments = AugmentState::default();
    player_squad.board = [None; PLAYER_SLOTS.len()];
    player_squad.bench = vec![
        UnitInstance::new(UnitArchetype::VerdantBruiser),
        UnitInstance::new(UnitArchetype::EmberMedic),
    ];
    enemy_squad.units = seed_enemy_squad(1);
    reroll_shop(shop, combat.round);
    combat.status = if increment_run_number {
        match locale {
            RuntimeLocale::En => format!(
                "Run {} restarted. Bench primed with a two-unit opening. Deploy up to your level cap before combat.",
                combat.run_number
            ),
            RuntimeLocale::ZhCn => format!(
                "第 {} 局已重新开始。初始两单位已在备战席，战斗前可按人口上限部署。",
                combat.run_number
            ),
        }
    } else {
        localized(
            locale,
            "Bench primed. Deploy up to your current cap before opening combat.",
            "备战席已就绪。开始战斗前可先部署到当前人口上限。",
        )
        .to_owned()
    };
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

fn handle_runtime_commands(
    mut commands: Commands,
    board: Res<BoardConfig>,
    config: Res<RuntimeConfig>,
    mut combat: ResMut<CombatState>,
    mut projection: ResMut<StarterSliceProjection>,
    mut shop: ResMut<ShopState>,
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
                {
                    combat.phase = CombatPhase::Combat;
                    combat.status = match locale {
                        RuntimeLocale::En => format!(
                            "Combat started. {} allied units engage {} enemies.",
                            combat.player_units, combat.enemy_units
                        ),
                        RuntimeLocale::ZhCn => format!(
                            "战斗开始。{} 名友军正在迎战 {} 名敌军。",
                            combat.player_units, combat.enemy_units
                        ),
                    };
                    combat_timer.0.reset();
                }
            }
            RuntimeCommand::ResetRound => {
                if combat.phase == CombatPhase::Resolution && !combat.run_over {
                    let (base_income, interest_income, streak_income) = round_income_preview(
                        combat.gold,
                        current_streak(&combat),
                        &augments.selected,
                    );
                    let total_income = base_income + interest_income + streak_income;
                    combat.round += 1;
                    combat.phase = CombatPhase::Preparation;
                    combat.run_result = RunResult::Active;
                    combat.gold += total_income;
                    let levels_gained = grant_xp(&mut combat, PASSIVE_ROUND_XP);
                    enemy_squad.units = seed_enemy_squad(combat.round);
                    maybe_prepare_augment_draft(&mut augments, combat.round);
                    if shop.locked {
                        combat.status = match locale {
                            RuntimeLocale::En => format!(
                                "Round {} ready. Income +{} (base {} / interest {} / streak {}). Locked shop carried forward. Level {} with {} cap{}.",
                                combat.round,
                                total_income,
                                base_income,
                                interest_income,
                                streak_income,
                                combat.level,
                                combat.deployment_cap,
                                if levels_gained > 0 { " after leveling." } else { "." }
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "第 {} 回合已就绪。收入 +{}（基础 {} / 利息 {} / 连胜连败 {}）。锁定商店已保留。当前等级 {}，可部署 {} 个单位{}",
                                combat.round,
                                total_income,
                                base_income,
                                interest_income,
                                streak_income,
                                combat.level,
                                combat.deployment_cap,
                                if levels_gained > 0 { "，并已升级。" } else { "。" }
                            ),
                        };
                    } else {
                        reroll_shop(&mut shop, combat.round);
                        combat.status = match locale {
                            RuntimeLocale::En => format!(
                                "Round {} ready. Income +{} (base {} / interest {} / streak {}). Draft, merge, or reposition before combat. Level {} supports {} deployed units{}.",
                                combat.round,
                                total_income,
                                base_income,
                                interest_income,
                                streak_income,
                                combat.level,
                                combat.deployment_cap,
                                if levels_gained > 0 { " after leveling up" } else { "" }
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "第 {} 回合已就绪。收入 +{}（基础 {} / 利息 {} / 连胜连败 {}）。战斗前可以继续招募、合成或调整站位。当前等级 {}，可部署 {} 个单位{}",
                                combat.round,
                                total_income,
                                base_income,
                                interest_income,
                                streak_income,
                                combat.level,
                                combat.deployment_cap,
                                if levels_gained > 0 { "，并已升级。" } else { "。" }
                            ),
                        };
                    }
                    if !augments.pending_choices.is_empty() {
                        combat.status = match locale {
                            RuntimeLocale::En => format!(
                                "Round {} augment draft ready. Pick one upgrade before combat.",
                                combat.round
                            ),
                            RuntimeLocale::ZhCn => format!(
                                "第 {} 回合强化已出现。先选择一个升级，再进入战斗。",
                                combat.round
                            ),
                        };
                    }
                    needs_respawn = true;
                }
            }
            RuntimeCommand::RestartRun => {
                despawn_units(&mut commands, units.iter());
                reset_run_state(
                    &mut commands,
                    &board,
                    locale,
                    &mut combat,
                    &mut shop,
                    &mut player_squad,
                    &mut enemy_squad,
                    &mut augments,
                    &mut combat_timer,
                    true,
                );
            }
            RuntimeCommand::RerollShop => {
                if combat.phase == CombatPhase::Preparation
                    && !combat.run_over
                    && combat.gold >= REROLL_COST
                {
                    combat.gold -= REROLL_COST;
                    reroll_shop(&mut shop, combat.round + 1);
                    combat.status = localized(
                        locale,
                        "Shop rerolled. Draft before combat starts.",
                        "商店已刷新。战斗前先完成招募。",
                    )
                    .to_owned();
                }
            }
            RuntimeCommand::BuyXp => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || combat.gold < BUY_XP_COST
                    || combat.level >= max_level()
                {
                    continue;
                }

                combat.gold -= BUY_XP_COST;
                let previous_level = combat.level;
                let levels_gained = grant_xp(&mut combat, BUY_XP_AMOUNT);
                combat.status = match locale {
                    RuntimeLocale::En => {
                        if levels_gained > 0 {
                            format!(
                                "Bought XP for {} gold. Level {} unlocked with {} deployment slots.",
                                BUY_XP_COST, combat.level, combat.deployment_cap
                            )
                        } else {
                            format!(
                                "Bought XP for {} gold. Level {} progress: {}/{}.",
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
                                "已花费 {} 金币购买经验。升到 {} 级，可部署 {} 个单位。",
                                BUY_XP_COST, combat.level, combat.deployment_cap
                            )
                        } else {
                            format!(
                                "已花费 {} 金币购买经验。{} 级进度：{}/{}。",
                                BUY_XP_COST,
                                previous_level,
                                combat.xp,
                                xp_to_next_level(previous_level)
                            )
                        }
                    }
                };
            }
            RuntimeCommand::ChooseAugment(index) => {
                if combat.phase != CombatPhase::Preparation || combat.run_over {
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
                if combat.phase != CombatPhase::Preparation || combat.run_over {
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
                    || combat.gold < BUY_COST
                    || player_squad.bench.len() >= BENCH_CAPACITY
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
                reroll_shop(&mut shop, combat.round + index as u32 + 2);
                needs_respawn = true;
            }
            RuntimeCommand::DeployBenchToBoard {
                bench_index,
                slot_index,
            } => {
                let deployed_units = player_squad.board.iter().flatten().count();
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
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
                            format!("Deployed {} into slot {}.", deployed.label(locale), slot_index + 1)
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
            RuntimeCommand::WithdrawBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
                    || slot_index >= player_squad.board.len()
                    || player_squad.bench.len() >= BENCH_CAPACITY
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
                    || bench_index >= player_squad.bench.len()
                {
                    continue;
                }

                let sold = player_squad.bench.remove(bench_index);
                combat.gold += sold.sell_value();
                combat.status = match locale {
                    RuntimeLocale::En => {
                        format!("Sold {} for {} gold.", sold.label(locale), sold.sell_value())
                    }
                    RuntimeLocale::ZhCn => {
                        format!("已出售 {}，获得 {} 金币。", sold.label(locale), sold.sell_value())
                    }
                };
            }
            RuntimeCommand::SellBoardUnit(slot_index) => {
                if combat.phase != CombatPhase::Preparation
                    || combat.run_over
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
        }
    }

    if needs_respawn {
        despawn_units(&mut commands, units.iter());
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

    update_projection_from_state(
        &combat,
        &shop,
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
    let mut pending_healing = HashMap::<Entity, i32>::new();
    let mut combat_highlights = Vec::new();

    for attacker in &player_entities {
        if let Some(action) = resolve_attack(*attacker, &player_entities, &enemy_entities, locale) {
            for (target_entity, damage) in action.hits {
                *pending_damage.entry(target_entity).or_insert(0) += damage;
            }
            for (target_entity, healing) in action.heals {
                *pending_healing.entry(target_entity).or_insert(0) += healing;
            }
            if combat_highlights.len() < 2 {
                combat_highlights.push(action.highlight);
            }
        }
    }

    for attacker in &enemy_entities {
        if let Some(action) = resolve_attack(*attacker, &enemy_entities, &player_entities, locale) {
            for (target_entity, damage) in action.hits {
                *pending_damage.entry(target_entity).or_insert(0) += damage;
            }
            for (target_entity, healing) in action.heals {
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
            let mitigated = mitigate_damage(unit.archetype, damage);
            unit.health -= mitigated;
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
            combat.win_streak += 1;
            combat.loss_streak = 0;
            combat.score += 80;
            combat.gold += 1;
            combat.enemy_health = combat.enemy_health.saturating_sub(2);
            if combat.round >= FINAL_ROUND {
                combat.run_over = true;
                combat.run_result = RunResult::Victory;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Run clear. Round {} collapsed the final enemy squad. Restart to begin a new climb.",
                        combat.round
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "通关。第 {} 回合击溃了最后一支敌军。重新开局即可开始新的爬塔。",
                        combat.round
                    ),
                };
            } else {
                combat.run_result = RunResult::Active;
                combat.status = match locale {
                    RuntimeLocale::En => format!(
                        "Victory. Enemy board collapsed. Click Next Round to continue to round {}.",
                        combat.round + 1
                    ),
                    RuntimeLocale::ZhCn => format!(
                        "胜利。敌方棋盘已崩溃。点击“下一回合”进入第 {} 回合。",
                        combat.round + 1
                    ),
                };
            }
        } else {
            combat.loss_streak += 1;
            combat.win_streak = 0;
            let defeat_damage = combat.enemy_units.max(1) as u32 * 2;
            combat.player_health = combat.player_health.saturating_sub(defeat_damage);
            if combat.player_health == 0 {
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
        }

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
        combat.status = if combat_highlights.is_empty() {
            match locale {
                RuntimeLocale::En => format!(
                    "Combat underway. {} allied units vs {} enemies.",
                    combat.player_units, combat.enemy_units
                ),
                RuntimeLocale::ZhCn => format!(
                    "战斗进行中。{} 名友军对阵 {} 名敌军。",
                    combat.player_units, combat.enemy_units
                ),
            }
        } else {
            match locale {
                RuntimeLocale::En => format!(
                    "Combat underway. {} allied units vs {} enemies. {}",
                    combat.player_units,
                    combat.enemy_units,
                    combat_highlights
                        .into_iter()
                        .take(2)
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
                RuntimeLocale::ZhCn => format!(
                    "战斗进行中。{} 名友军对阵 {} 名敌军。{}",
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
) -> Option<ResolvedCombatAction> {
    let target = select_target(attacker.archetype, opponents)?;
    let mut primary_damage = attacker.attack as i32;
    let mut extra_hits = Vec::new();
    let mut heals = Vec::new();
    let mut skill_note = None;

    match attacker.archetype {
        UnitArchetype::VerdantBruiser => {
            if (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Bulwark Bash landed heavy",
                    "壁垒重击已触发",
                ));
            }
        }
        UnitArchetype::SignalRanger => {
            if (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Piercing Volley broke through",
                    "穿透齐射已打穿前线",
                ));
            }
        }
        UnitArchetype::AshDuelist => {
            if target.health * 2 <= target.max_health {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Execution Arc punished a weakened target",
                    "处决弧刃命中了残血目标",
                ));
            }
        }
        UnitArchetype::IronVanguard => {
            if (attacker.action_counter + 1) % 2 == 0 {
                primary_damage += 1;
                skill_note = Some(localized(
                    locale,
                    "Anchor Strike cracked the enemy line",
                    "锚定打击撕开了敌方前线",
                ));
            }
        }
        UnitArchetype::FrostOracle => {
            if (attacker.action_counter + 1) % 3 == 0 {
                primary_damage += 3;
                skill_note = Some(localized(
                    locale,
                    "Cold Snap burst through the target",
                    "寒霜迸发命中了主目标",
                ));
            }
        }
        UnitArchetype::EmberMedic => {
            if let Some(ally) = select_ally_to_heal(attacker.entity, allies) {
                heals.push((ally.entity, 2));
                skill_note = Some(localized(
                    locale,
                    "Cinder Mend patched the frontline",
                    "炽火疗愈修补了前线",
                ));
            }
        }
        UnitArchetype::VoltJuggler => {
            if (attacker.action_counter + 1) % 2 == 0 {
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
        UnitArchetype::GraveWarden => {
            if attacker.health * 2 <= attacker.max_health {
                primary_damage += 2;
                skill_note = Some(localized(
                    locale,
                    "Last Toll hit harder while wounded",
                    "终末丧钟在残血时打得更重",
                ));
            }
        }
    }

    let mut hits = vec![(target.entity, primary_damage.max(1))];
    hits.extend(extra_hits.into_iter().map(|(entity, damage)| (entity, damage.max(1))));

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

fn select_target(
    archetype: UnitArchetype,
    opponents: &[CombatUnitSnapshot],
) -> Option<CombatUnitSnapshot> {
    let mut candidates = opponents.to_vec();
    if candidates.is_empty() {
        return None;
    }

    match archetype {
        UnitArchetype::VerdantBruiser => {
            candidates.sort_by_key(|candidate| (-candidate.max_health, candidate.health));
        }
        UnitArchetype::SignalRanger
        | UnitArchetype::AshDuelist
        | UnitArchetype::EmberMedic
        | UnitArchetype::VoltJuggler => {
            candidates.sort_by_key(|candidate| (candidate.health, -(candidate.attack as i32)));
        }
        UnitArchetype::IronVanguard | UnitArchetype::FrostOracle => {
            candidates.sort_by_key(|candidate| (-(candidate.attack as i32), -candidate.health));
        }
        UnitArchetype::GraveWarden => {
            candidates.sort_by_key(|candidate| (-candidate.max_health, -candidate.health));
        }
    }

    candidates.first().copied()
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
                if candidate.entity == attacker_entity { 1 } else { 0 },
                candidate.max_health,
            )
        })
}

fn mitigate_damage(archetype: UnitArchetype, damage: i32) -> i32 {
    match archetype {
        UnitArchetype::IronVanguard => (damage - 1).max(1),
        _ => damage.max(1),
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

    for snapshot in live_snapshots.iter().filter(|snapshot| snapshot.owner == owner) {
        if snapshot.slot_index >= board.len() {
            continue;
        }

        board[snapshot.slot_index] = Some(RuntimeUnitView {
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

fn update_projection_from_state(
    combat: &CombatState,
    shop: &ShopState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    locale: RuntimeLocale,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    let player_buffs = trait_buffs_for(player_squad.board.iter().flatten().copied());
    let enemy_buffs = trait_buffs_for(enemy_squad.units.iter().copied());

    apply_common_projection_fields(
        combat,
        shop,
        player_squad,
        enemy_squad,
        augments,
        locale,
        projection,
    );
    projection.player_board = player_squad
        .board
        .iter()
        .copied()
        .map(|unit| unit.map(|unit| unit.resolved_view(player_buffs, &augments.selected, locale)))
        .collect();
    projection.enemy_board = enemy_squad
        .units
        .iter()
        .copied()
        .map(|unit| Some(unit.resolved_view(enemy_buffs, &[], locale)))
        .chain(std::iter::repeat(None::<RuntimeUnitView>))
        .take(ENEMY_SLOTS.len())
        .collect();
}

fn update_projection_from_live_state(
    combat: &CombatState,
    shop: &ShopState,
    player_squad: &PlayerSquad,
    enemy_squad: &EnemySquad,
    augments: &AugmentState,
    live_snapshots: &[CombatUnitSnapshot],
    locale: RuntimeLocale,
    projection: &mut ResMut<StarterSliceProjection>,
) {
    apply_common_projection_fields(
        combat,
        shop,
        player_squad,
        enemy_squad,
        augments,
        locale,
        projection,
    );
    projection.player_board = board_views_from_live_units(
        live_snapshots,
        UnitOwner::Player,
        PLAYER_SLOTS.len(),
        locale,
    );
    projection.enemy_board = board_views_from_live_units(
        live_snapshots,
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
        .map(UnitInstance::new)
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
    projection.augment_draft_round = augments.pending_round.unwrap_or(0);
    projection.enemy_threat = enemy_threat(enemy_squad.units.iter().copied());
    projection.enemy_intent = enemy_intent_for_round(combat.round, locale);
    projection.bench_capacity = BENCH_CAPACITY;
    projection.board_capacity = PLAYER_SLOTS.len();
    projection.deployment_cap = combat.deployment_cap;
    projection.streak = current_streak(combat);
    let (base_income, interest_income, streak_income) =
        round_income_preview(combat.gold, projection.streak, &augments.selected);
    projection.base_income = base_income;
    projection.interest_income = interest_income;
    projection.streak_income = streak_income;
    projection.round_resolved = combat.phase == CombatPhase::Resolution;
    projection.run_over = combat.run_over;
    projection.run_result = combat.run_result.as_str().to_owned();
    projection.completed = combat.run_over;
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

    for (index, maybe_unit) in player_squad.board.iter().copied().enumerate() {
        let Some(unit) = maybe_unit else {
            continue;
        };

        if let Some(&(row, col)) = PLAYER_SLOTS.get(index) {
            spawn_unit(
                commands,
                board,
                UnitOwner::Player,
                index,
                unit,
                resolved_stats(unit, player_buffs, &augments.selected),
                locale,
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
                index,
                unit,
                resolved_stats(unit, enemy_buffs, &[]),
                locale,
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
    slot_index: usize,
    unit: UnitInstance,
    stats: UnitStats,
    locale: RuntimeLocale,
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
                slot_index,
                archetype: unit.archetype,
                stars: unit.stars,
                action_counter: 0,
                health: stats.max_health,
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

fn reroll_shop(shop: &mut ShopState, round_seed: u32) {
    let pool = UnitArchetype::all();
    let start = (shop.reroll_cursor + round_seed as usize) % pool.len();
    shop.offers = (0..SHOP_SIZE)
        .map(|offset| UnitInstance::new(pool[(start + offset) % pool.len()]))
        .collect();
    shop.reroll_cursor = (shop.reroll_cursor + 1) % pool.len();
}

fn seed_enemy_squad(round: u32) -> Vec<UnitInstance> {
    let mut units = match round {
        1 => vec![
            UnitInstance::new(UnitArchetype::AshDuelist),
            UnitInstance::new(UnitArchetype::IronVanguard),
        ],
        2 => vec![
            UnitInstance::new(UnitArchetype::AshDuelist),
            UnitInstance::new(UnitArchetype::IronVanguard),
            UnitInstance::new(UnitArchetype::VoltJuggler),
        ],
        3 => vec![
            UnitInstance {
                archetype: UnitArchetype::AshDuelist,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::IronVanguard),
            UnitInstance::new(UnitArchetype::VoltJuggler),
        ],
        4 => vec![
            UnitInstance {
                archetype: UnitArchetype::AshDuelist,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::IronVanguard,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::VoltJuggler),
            UnitInstance::new(UnitArchetype::GraveWarden),
        ],
        5 => vec![
            UnitInstance {
                archetype: UnitArchetype::IronVanguard,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::SignalRanger),
            UnitInstance::new(UnitArchetype::VoltJuggler),
            UnitInstance::new(UnitArchetype::GraveWarden),
        ],
        6 => vec![
            UnitInstance {
                archetype: UnitArchetype::IronVanguard,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::SignalRanger,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::VoltJuggler),
            UnitInstance::new(UnitArchetype::GraveWarden),
            UnitInstance::new(UnitArchetype::AshDuelist),
        ],
        7 => vec![
            UnitInstance {
                archetype: UnitArchetype::SignalRanger,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::VoltJuggler,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::GraveWarden),
            UnitInstance::new(UnitArchetype::IronVanguard),
            UnitInstance::new(UnitArchetype::AshDuelist),
        ],
        _ => vec![
            UnitInstance {
                archetype: UnitArchetype::SignalRanger,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::VoltJuggler,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::GraveWarden,
                stars: 2,
            },
            UnitInstance {
                archetype: UnitArchetype::IronVanguard,
                stars: 2,
            },
            UnitInstance::new(UnitArchetype::AshDuelist),
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

fn maybe_prepare_augment_draft(augments: &mut AugmentState, round: u32) {
    let draft_rounds = [2, 5];
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
    locale: RuntimeLocale,
) -> impl Iterator<Item = RuntimeTraitView> {
    let (dawn, dusk, vanguard, skirmisher) = trait_counts(units);

    [
        RuntimeTraitView {
            key: UnitFaction::Dawn.key().to_owned(),
            label: UnitFaction::Dawn.label(locale).to_owned(),
            count: dawn,
            threshold: TRAIT_THRESHOLD,
            description: UnitFaction::Dawn.description(locale).to_owned(),
            active: dawn >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitFaction::Dusk.key().to_owned(),
            label: UnitFaction::Dusk.label(locale).to_owned(),
            count: dusk,
            threshold: TRAIT_THRESHOLD,
            description: UnitFaction::Dusk.description(locale).to_owned(),
            active: dusk >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Vanguard.key().to_owned(),
            label: UnitRole::Vanguard.label(locale).to_owned(),
            count: vanguard,
            threshold: TRAIT_THRESHOLD,
            description: UnitRole::Vanguard.description(locale).to_owned(),
            active: vanguard >= TRAIT_THRESHOLD,
        },
        RuntimeTraitView {
            key: UnitRole::Skirmisher.key().to_owned(),
            label: UnitRole::Skirmisher.label(locale).to_owned(),
            count: skirmisher,
            threshold: TRAIT_THRESHOLD,
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
    if level >= max_level() {
        0
    } else {
        4
    }
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

fn round_income_preview(gold: u32, streak: i32, augments: &[AugmentKind]) -> (u32, u32, u32) {
    let interest_cap = if augments.contains(&AugmentKind::CompoundInterest) {
        MAX_INTEREST_INCOME + 1
    } else {
        MAX_INTEREST_INCOME
    };
    let interest_income = (gold / 5).min(interest_cap);
    let streak_income = streak_bonus(streak);
    (ROUND_BASE_INCOME, interest_income, streak_income)
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

fn resolved_stats(unit: UnitInstance, buffs: TraitBuffs, augments: &[AugmentKind]) -> UnitStats {
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
        stats.max_health += 3;
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
