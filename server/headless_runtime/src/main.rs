use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, patch};
use axum::{Json, Router};
use bevy::app::{AppExit, ScheduleRunnerPlugin};
use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

const DEFAULT_SLOT_IDS: [&str; 3] = ["slot-1", "slot-2", "slot-3"];

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "numeron_headless_backend=info,tower_http=info".into()),
        )
        .init();

    let shared = SharedRuntime::default();

    tokio::task::spawn_blocking({
        let shared = shared.clone();
        move || run_headless_bevy(shared)
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/snapshot", get(snapshot))
        .route("/profiles", get(list_profiles))
        .route("/profiles/{slot_id}", get(get_profile).put(put_profile))
        .route("/sessions", get(list_sessions).post(create_session))
        .route("/sessions/{session_id}", patch(update_session))
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
        .with_state(shared.clone());

    let port = std::env::var("HEADLESS_BACKEND_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8787);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    info!("headless backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind headless backend");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shared))
        .await
        .expect("headless backend server failed");
}

fn run_headless_bevy(shared: SharedRuntime) {
    let mut app = App::new();
    app.add_plugins(MinimalPlugins.set(ScheduleRunnerPlugin::run_loop(
        Duration::from_millis(50),
    )))
    .insert_resource(BackendBridge {
        shared,
        started_at: Instant::now(),
    })
    .insert_resource(AuthorityState::default())
    .add_systems(Startup, setup_authority_state)
    .add_systems(
        Update,
        (advance_tick, apply_commands, publish_snapshot, check_shutdown),
    );

    app.run();
}

async fn shutdown_signal(shared: SharedRuntime) {
    let _ = tokio::signal::ctrl_c().await;
    shared.request_shutdown();
}

async fn health(State(shared): State<SharedRuntime>) -> Json<HealthResponse> {
    let snapshot = shared.read_snapshot();
    Json(HealthResponse {
        ok: true,
        mode: "headless-bevy",
        tick: snapshot.tick,
        sessions: snapshot.sessions.len(),
        profiles: snapshot.profiles.len(),
    })
}

async fn snapshot(State(shared): State<SharedRuntime>) -> Json<BackendSnapshot> {
    Json(shared.read_snapshot())
}

async fn list_profiles(State(shared): State<SharedRuntime>) -> Json<Vec<BackendProfile>> {
    let snapshot = shared.read_snapshot();
    Json(snapshot.profiles.into_values().collect())
}

async fn get_profile(
    Path(slot_id): Path<String>,
    State(shared): State<SharedRuntime>,
) -> Result<Json<BackendProfile>, StatusCode> {
    let snapshot = shared.read_snapshot();
    snapshot
        .profiles
        .get(&slot_id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn put_profile(
    Path(slot_id): Path<String>,
    State(shared): State<SharedRuntime>,
    Json(payload): Json<PutProfileRequest>,
) -> Json<QueuedCommandResponse> {
    shared.push_command(BackendCommand::UpsertProfile {
        slot_id: sanitize_slot_id(&slot_id),
        player_name: sanitize_player_name(&payload.player_name),
        touch_controls: payload.touch_controls,
        best_score: payload.best_score.max(0),
        best_round: payload.best_round.max(0),
    });

    Json(QueuedCommandResponse {
        accepted: true,
        command: "profile.upsert",
    })
}

async fn list_sessions(State(shared): State<SharedRuntime>) -> Json<Vec<BackendSession>> {
    let snapshot = shared.read_snapshot();
    Json(snapshot.sessions)
}

async fn create_session(
    State(shared): State<SharedRuntime>,
    Json(payload): Json<CreateSessionRequest>,
) -> Json<CreateSessionResponse> {
    let session_id = payload.session_id.unwrap_or_else(|| {
        format!(
            "{}-{}",
            sanitize_slot_id(&payload.slot_id),
            shared.next_session_nonce()
        )
    });

    shared.push_command(BackendCommand::CreateSession {
        session_id: session_id.clone(),
        slot_id: sanitize_slot_id(&payload.slot_id),
        player_name: sanitize_player_name(&payload.player_name),
    });

    Json(CreateSessionResponse {
        accepted: true,
        session_id,
    })
}

async fn update_session(
    Path(session_id): Path<String>,
    State(shared): State<SharedRuntime>,
    Json(payload): Json<UpdateSessionRequest>,
) -> Json<QueuedCommandResponse> {
    shared.push_command(BackendCommand::UpdateSession {
        session_id,
        status: payload.status,
        score: payload.score,
        captured: payload.captured,
        total: payload.total,
        round: payload.round,
    });

    Json(QueuedCommandResponse {
        accepted: true,
        command: "session.update",
    })
}

fn setup_authority_state(mut authority: ResMut<AuthorityState>) {
    for slot_id in DEFAULT_SLOT_IDS {
        authority.profiles.insert(
            slot_id.to_owned(),
            BackendProfile {
                slot_id: slot_id.to_owned(),
                player_name: "Pilot".to_owned(),
                touch_controls: true,
                best_score: 0,
                best_round: 0,
                updated_at: iso_now(),
            },
        );
    }
}

fn advance_tick(mut authority: ResMut<AuthorityState>) {
    authority.tick += 1;
}

fn apply_commands(mut authority: ResMut<AuthorityState>, bridge: Res<BackendBridge>) {
    let commands = bridge.shared.take_commands();

    for command in commands {
        match command {
            BackendCommand::CreateSession {
                session_id,
                slot_id,
                player_name,
            } => {
                authority.sessions.insert(
                    session_id.clone(),
                    BackendSession {
                        id: session_id,
                        slot_id,
                        player_name,
                        status: SessionStatus::Staging,
                        round: 1,
                        objective: "Secure each uplink pad once per sweep.".to_owned(),
                        score: 0,
                        captured: 0,
                        total: 4,
                        started_at: iso_now(),
                        updated_at: iso_now(),
                        ended_at: None,
                    },
                );
            }
            BackendCommand::UpdateSession {
                session_id,
                status,
                score,
                captured,
                total,
                round,
            } => {
                let mut profile_update: Option<(String, i64, i64)> = None;

                if let Some(session) = authority.sessions.get_mut(&session_id) {
                    if let Some(next_status) = status {
                        session.status = next_status;
                    }
                    if let Some(next_score) = score {
                        session.score = next_score.max(0);
                    }
                    if let Some(next_captured) = captured {
                        session.captured = next_captured.max(0);
                    }
                    if let Some(next_total) = total {
                        session.total = next_total.max(1);
                    }
                    if let Some(next_round) = round {
                        session.round = next_round.max(1);
                    }
                    if session.status == SessionStatus::Completed && session.ended_at.is_none() {
                        session.ended_at = Some(iso_now());
                    }
                    session.updated_at = iso_now();
                    profile_update =
                        Some((session.slot_id.clone(), session.score, session.round));
                }

                if let Some((slot_id, score, round)) = profile_update
                    && let Some(profile) = authority.profiles.get_mut(&slot_id)
                {
                    profile.best_score = profile.best_score.max(score);
                    profile.best_round = profile.best_round.max(round);
                    profile.updated_at = iso_now();
                }
            }
            BackendCommand::UpsertProfile {
                slot_id,
                player_name,
                touch_controls,
                best_score,
                best_round,
            } => {
                authority.profiles.insert(
                    slot_id.clone(),
                    BackendProfile {
                        slot_id,
                        player_name,
                        touch_controls,
                        best_score,
                        best_round,
                        updated_at: iso_now(),
                    },
                );
            }
        }
    }
}

fn publish_snapshot(authority: Res<AuthorityState>, bridge: Res<BackendBridge>) {
    let snapshot = BackendSnapshot {
        mode: "headless-bevy".to_owned(),
        tick: authority.tick,
        uptime_ms: bridge.started_at.elapsed().as_millis() as u64,
        profiles: authority.profiles.clone(),
        sessions: authority.sessions.values().cloned().collect(),
    };

    bridge.shared.write_snapshot(snapshot);
}

fn check_shutdown(bridge: Res<BackendBridge>, mut exit: MessageWriter<AppExit>) {
    if bridge.shared.should_shutdown() {
        exit.write(AppExit::Success);
    }
}

#[derive(Resource)]
struct BackendBridge {
    shared: SharedRuntime,
    started_at: Instant,
}

#[derive(Resource, Default)]
struct AuthorityState {
    tick: u64,
    profiles: BTreeMap<String, BackendProfile>,
    sessions: BTreeMap<String, BackendSession>,
}

#[derive(Clone, Default)]
struct SharedRuntime {
    snapshot: Arc<RwLock<BackendSnapshot>>,
    commands: Arc<Mutex<Vec<BackendCommand>>>,
    shutdown: Arc<Mutex<bool>>,
    session_nonce: Arc<Mutex<u64>>,
}

impl SharedRuntime {
    fn read_snapshot(&self) -> BackendSnapshot {
        self.snapshot
            .read()
            .expect("snapshot lock poisoned")
            .clone()
    }

    fn write_snapshot(&self, snapshot: BackendSnapshot) {
        *self.snapshot.write().expect("snapshot lock poisoned") = snapshot;
    }

    fn push_command(&self, command: BackendCommand) {
        self.commands
            .lock()
            .expect("command lock poisoned")
            .push(command);
    }

    fn take_commands(&self) -> Vec<BackendCommand> {
        let mut commands = self.commands.lock().expect("command lock poisoned");
        std::mem::take(&mut *commands)
    }

    fn request_shutdown(&self) {
        *self.shutdown.lock().expect("shutdown lock poisoned") = true;
    }

    fn should_shutdown(&self) -> bool {
        *self.shutdown.lock().expect("shutdown lock poisoned")
    }

    fn next_session_nonce(&self) -> u64 {
        let mut nonce = self.session_nonce.lock().expect("nonce lock poisoned");
        *nonce += 1;
        *nonce
    }
}

#[derive(Clone, Serialize)]
struct HealthResponse {
    ok: bool,
    mode: &'static str,
    tick: u64,
    sessions: usize,
    profiles: usize,
}

#[derive(Clone, Debug, Default, Serialize)]
struct BackendSnapshot {
    mode: String,
    tick: u64,
    uptime_ms: u64,
    profiles: BTreeMap<String, BackendProfile>,
    sessions: Vec<BackendSession>,
}

#[derive(Clone, Debug, Serialize)]
struct BackendProfile {
    slot_id: String,
    player_name: String,
    touch_controls: bool,
    best_score: i64,
    best_round: i64,
    updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
struct BackendSession {
    id: String,
    slot_id: String,
    player_name: String,
    status: SessionStatus,
    round: i64,
    objective: String,
    score: i64,
    captured: i64,
    total: i64,
    started_at: String,
    updated_at: String,
    ended_at: Option<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum SessionStatus {
    Staging,
    Live,
    Completed,
}

#[derive(Debug)]
enum BackendCommand {
    CreateSession {
        session_id: String,
        slot_id: String,
        player_name: String,
    },
    UpdateSession {
        session_id: String,
        status: Option<SessionStatus>,
        score: Option<i64>,
        captured: Option<i64>,
        total: Option<i64>,
        round: Option<i64>,
    },
    UpsertProfile {
        slot_id: String,
        player_name: String,
        touch_controls: bool,
        best_score: i64,
        best_round: i64,
    },
}

#[derive(Deserialize)]
struct CreateSessionRequest {
    session_id: Option<String>,
    slot_id: String,
    player_name: String,
}

#[derive(Serialize)]
struct CreateSessionResponse {
    accepted: bool,
    session_id: String,
}

#[derive(Deserialize)]
struct UpdateSessionRequest {
    status: Option<SessionStatus>,
    score: Option<i64>,
    captured: Option<i64>,
    total: Option<i64>,
    round: Option<i64>,
}

#[derive(Deserialize)]
struct PutProfileRequest {
    player_name: String,
    touch_controls: bool,
    best_score: i64,
    best_round: i64,
}

#[derive(Serialize)]
struct QueuedCommandResponse {
    accepted: bool,
    command: &'static str,
}

fn sanitize_slot_id(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "slot-1".to_owned()
    } else {
        trimmed.chars().take(24).collect()
    }
}

fn sanitize_player_name(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "Pilot".to_owned()
    } else {
        trimmed.chars().take(16).collect()
    }
}

fn iso_now() -> String {
    humantime::format_rfc3339_seconds(std::time::SystemTime::now()).to_string()
}
