use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// A countdown timer. Rust only cares about the hotkey; every visual option is
/// carried through untouched so the frontend can grow without schema churn.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CountdownConfig {
    #[serde(default)]
    pub hotkey: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// A shortcut the frontend generates for itself (counter +1, -1, reset…).
/// Rust registers it and echoes `action`/`id` back without interpreting them,
/// so new frontend features never need a change here.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CustomHotkey {
    pub hotkey: String,
    #[serde(default)]
    pub action: String,
    #[serde(default)]
    pub id: String,
}

/// Actions the Rust side registers global shortcuts for. Each one is emitted as
/// `hotkey-<id>` so the frontend can add handlers freely.
pub const HOTKEY_ACTIONS: [&str; 20] = [
    "start", "pause", "reset", "lap", "toggle", "settings", "lock", "crosshair",
    "stopwatch", "scoreboard", "countdowns", "panels", "all", "next_page",
    "session_reset", "clear_timers", "score1_up", "score2_up", "score_reset", "swap_player",
];

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub hotkeys: BTreeMap<String, String>,
    #[serde(default)]
    pub countdowns: Vec<CountdownConfig>,
    #[serde(default)]
    pub custom_hotkeys: Vec<CustomHotkey>,
    /// Interface, stopwatch, scoreboard, crosshair and stats sections live here.
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

fn default_version() -> u32 {
    2
}

fn default_hotkeys() -> BTreeMap<String, String> {
    let pairs = [
        ("start", "F1"),
        ("swap_player", "F2"),
        ("pause", ""),
        ("reset", "Ctrl+Shift+F3"),
        ("lap", ""),
        ("toggle", "Ctrl+Shift+F4"),
        ("settings", "Ctrl+Shift+F5"),
        ("lock", "F6"),
        ("crosshair", "F7"),
        ("stopwatch", "F8"),
        ("scoreboard", "F9"),
        ("countdowns", "F10"),
        ("panels", ""),
        ("all", "F11"),
        ("next_page", ""),
        ("session_reset", ""),
        ("clear_timers", ""),
        ("score1_up", ""),
        ("score2_up", ""),
        ("score_reset", ""),
    ];
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
        .collect()
}

fn default_countdown(hotkey: &str, label: &str, seconds: u32, style: &str, color: &str) -> CountdownConfig {
    let mut extra = Map::new();
    extra.insert("label".into(), json!(label));
    extra.insert("seconds".into(), json!(seconds));
    extra.insert("style".into(), json!(style));
    extra.insert("color".into(), json!(color));
    CountdownConfig {
        hotkey: hotkey.to_string(),
        extra,
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: default_version(),
            hotkeys: default_hotkeys(),
            countdowns: vec![
                default_countdown("J", "Corto", 15, "ring", "#00ff88"),
                default_countdown("K", "Largo", 300, "ring-minute", "#22d3ee"),
            ],
            custom_hotkeys: Vec::new(),
            extra: Map::new(),
        }
    }
}

impl AppConfig {
    /// Configurations written by version 1 stored one `hotkey_*` field per
    /// action. Fold those into the map so nobody loses their shortcuts.
    fn migrate(&mut self) {
        if !self.hotkeys.is_empty() {
            return;
        }
        let mut migrated = default_hotkeys();
        let mut found = false;
        for action in HOTKEY_ACTIONS.iter() {
            let legacy_key = format!("hotkey_{}", action);
            if let Some(Value::String(value)) = self.extra.get(&legacy_key) {
                migrated.insert((*action).to_string(), value.clone());
                found = true;
            }
        }
        if found {
            for action in HOTKEY_ACTIONS.iter() {
                self.extra.remove(&format!("hotkey_{}", action));
            }
        }
        self.hotkeys = migrated;
    }

    /// `(hotkey, event name)` pairs for every assigned action.
    pub fn hotkey_bindings(&self) -> Vec<(String, String)> {
        HOTKEY_ACTIONS
            .iter()
            .filter_map(|action| {
                self.hotkeys
                    .get(*action)
                    .filter(|value| !value.trim().is_empty())
                    .map(|value| (value.clone(), format!("hotkey-{}", action)))
            })
            .collect()
    }
}

pub struct AppState {
    pub current_status: String,
    pub visible: bool,
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| dirs::config_dir().unwrap_or_else(|| PathBuf::from(".")));
    config_dir.join("config.json")
}

pub fn load(app: &tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app);
    if !path.exists() {
        let config = AppConfig::default();
        save(app, &config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<AppConfig>(&content) {
        Ok(mut config) => {
            config.migrate();
            Ok(config)
        }
        Err(error) => {
            // A corrupt file should not stop the overlay from starting: keep a
            // copy for inspection and fall back to defaults.
            eprintln!("config.json no se pudo leer ({error}); usando valores por defecto");
            let _ = fs::rename(&path, path.with_extension("json.bak"));
            let config = AppConfig::default();
            save(app, &config)?;
            Ok(config)
        }
    }
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    // Write to a temporary file first so a crash mid-write cannot truncate the
    // real configuration.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}
