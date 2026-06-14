use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CountdownConfig {
    pub hotkey: String,
    pub seconds: u32,
    #[serde(default = "default_line_width")]
    pub line_width: u32,
    #[serde(default = "default_line_color")]
    pub line_color: String,
    #[serde(default)]
    pub image: String,
}

fn default_line_width() -> u32 { 4 }
fn default_line_color() -> String { "#00ff88".to_string() }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScoreboardConfig {
    pub player1_name: String,
    pub player1_score: u32,
    pub player2_name: String,
    pub player2_score: u32,
    pub match_title: String,
}

impl Default for ScoreboardConfig {
    fn default() -> Self {
        Self {
            player1_name: "Player 1".to_string(),
            player1_score: 0,
            player2_name: "Player 2".to_string(),
            player2_score: 0,
            match_title: String::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    pub hotkey_start: String,
    pub hotkey_pause: String,
    pub hotkey_reset: String,
    pub hotkey_toggle: String,
    pub hotkey_settings: String,
    pub hotkey_lock: String,
    pub font_size: u32,
    pub accent_color: String,
    #[serde(default)]
    pub scoreboard: ScoreboardConfig,
    pub countdowns: Vec<CountdownConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hotkey_start: "Tab".to_string(),
            hotkey_pause: "".to_string(),
            hotkey_reset: "F3".to_string(),
            hotkey_toggle: "F4".to_string(),
            hotkey_settings: "F5".to_string(),
            hotkey_lock: "F6".to_string(),
            font_size: 48,
            accent_color: "#00ff88".to_string(),
            scoreboard: ScoreboardConfig::default(),
            countdowns: vec![
                CountdownConfig {
                    hotkey: "J".to_string(),
                    seconds: 15,
                    line_width: 4,
                    line_color: "#00ff88".to_string(),
                    image: String::new(),
                },
                CountdownConfig {
                    hotkey: "K".to_string(),
                    seconds: 60,
                    line_width: 4,
                    line_color: "#ffaa00".to_string(),
                    image: String::new(),
                },
            ],
        }
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
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(config)
    } else {
        let config = AppConfig::default();
        save(app, &config)?;
        Ok(config)
    }
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}
