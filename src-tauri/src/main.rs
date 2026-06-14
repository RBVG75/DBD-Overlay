mod config;

use config::{AppConfig, AppState};
use std::sync::Mutex;
use tauri::Emitter;
use tauri::Manager;
use tauri::PhysicalPosition;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

struct HotkeyState {
    registered: Vec<Shortcut>,
}

#[tauri::command]
fn set_status(app: tauri::AppHandle, status: String) {
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().unwrap();
    s.current_status = status;
}

#[tauri::command]
async fn toggle_visibility(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().unwrap();
    s.visible = !s.visible;
    if s.visible {
        window.show().map_err(|e| e.to_string())?;
        window.set_ignore_cursor_events(false).ok();
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().unwrap();
    s.visible = true;
    window.show().map_err(|e| e.to_string())?;
    window.set_ignore_cursor_events(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().unwrap();
    s.visible = false;
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn enable_clickthrough(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn resize_window(app: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn disable_clickthrough(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Window not found")?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save(&app, &config)?;
    reload_hotkeys(&app, &config)?;
    Ok(())
}

#[tauri::command]
async fn load_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    config::load(&app)
}

fn unregister_all(app: &tauri::AppHandle) {
    let plugin = app.global_shortcut();
    let mut hotkey_state = app.state::<Mutex<HotkeyState>>();
    let state = hotkey_state.lock().unwrap();
    for shortcut in &state.registered {
        let _ = plugin.unregister(shortcut.clone());
    }
}

fn reload_hotkeys(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    unregister_all(app);

    let plugin = app.global_shortcut();
    let mut hotkey_state = app.state::<Mutex<HotkeyState>>();
    let mut state = hotkey_state.lock().unwrap();
    state.registered.clear();

    let hotkeys = [
        (&config.hotkey_start, "hotkey-start"),
        (&config.hotkey_pause, "hotkey-pause"),
        (&config.hotkey_reset, "hotkey-reset"),
        (&config.hotkey_toggle, "hotkey-toggle"),
        (&config.hotkey_settings, "hotkey-settings"),
        (&config.hotkey_lock, "hotkey-lock"),
    ];

    for (hotkey_str, event_name) in hotkeys.iter() {
        if hotkey_str.is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(hotkey_str) {
            let event_name_str = event_name.to_string();
            let _ = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit(&event_name_str, ());
                }
            });
            state.registered.push(shortcut);
        }
    }

    for cd in &config.countdowns {
        if cd.hotkey.is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(&cd.hotkey) {
            let cfg = cd.clone();
            let _ = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit("countdown-trigger", cfg.clone());
                }
            });
            state.registered.push(shortcut);
        }
    }

    Ok(())
}

fn register_hotkeys(app: &tauri::AppHandle, config: &AppConfig) {
    let plugin = app.global_shortcut();
    let mut hotkey_state = app.state::<Mutex<HotkeyState>>();
    let mut state = hotkey_state.lock().unwrap();

    let hotkeys = [
        (&config.hotkey_start, "hotkey-start"),
        (&config.hotkey_pause, "hotkey-pause"),
        (&config.hotkey_reset, "hotkey-reset"),
        (&config.hotkey_toggle, "hotkey-toggle"),
        (&config.hotkey_settings, "hotkey-settings"),
        (&config.hotkey_lock, "hotkey-lock"),
    ];

    for (hotkey_str, event_name) in hotkeys.iter() {
        if hotkey_str.is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(hotkey_str) {
            let event_name_str = event_name.to_string();
            let _ = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit(&event_name_str, ());
                }
            });
            state.registered.push(shortcut);
        }
    }

    for cd in &config.countdowns {
        if cd.hotkey.is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(&cd.hotkey) {
            let cfg = cd.clone();
            let _ = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit("countdown-trigger", cfg.clone());
                }
            });
            state.registered.push(shortcut);
        }
    }
}

fn parse_hotkey(s: &str) -> Option<Shortcut> {
    use tauri_plugin_global_shortcut::{Code, Modifiers};

    let parts: Vec<&str> = s.split('+').collect();
    if parts.is_empty() {
        return None;
    }

    let mut modifiers = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in parts {
        match part.trim().to_lowercase().as_str() {
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "meta" | "win" | "super" => modifiers |= Modifiers::META,
            key => {
                code = parse_key_code(key);
            }
        }
    }

    if let Some(c) = code {
        Some(Shortcut::new(Some(modifiers), c))
    } else {
        None
    }
}

fn parse_key_code(s: &str) -> Option<tauri_plugin_global_shortcut::Code> {
    use tauri_plugin_global_shortcut::Code;

    if s.len() == 1 {
        let ch = s.chars().next().unwrap();
        return match ch {
            'A'..='Z' | 'a'..='z' => {
                let upper = ch.to_ascii_uppercase();
                match upper {
                    'A' => Some(Code::KeyA),
                    'B' => Some(Code::KeyB),
                    'C' => Some(Code::KeyC),
                    'D' => Some(Code::KeyD),
                    'E' => Some(Code::KeyE),
                    'F' => Some(Code::KeyF),
                    'G' => Some(Code::KeyG),
                    'H' => Some(Code::KeyH),
                    'I' => Some(Code::KeyI),
                    'J' => Some(Code::KeyJ),
                    'K' => Some(Code::KeyK),
                    'L' => Some(Code::KeyL),
                    'M' => Some(Code::KeyM),
                    'N' => Some(Code::KeyN),
                    'O' => Some(Code::KeyO),
                    'P' => Some(Code::KeyP),
                    'Q' => Some(Code::KeyQ),
                    'R' => Some(Code::KeyR),
                    'S' => Some(Code::KeyS),
                    'T' => Some(Code::KeyT),
                    'U' => Some(Code::KeyU),
                    'V' => Some(Code::KeyV),
                    'W' => Some(Code::KeyW),
                    'X' => Some(Code::KeyX),
                    'Y' => Some(Code::KeyY),
                    'Z' => Some(Code::KeyZ),
                    _ => None,
                }
            }
            '0' => Some(Code::Digit0),
            '1' => Some(Code::Digit1),
            '2' => Some(Code::Digit2),
            '3' => Some(Code::Digit3),
            '4' => Some(Code::Digit4),
            '5' => Some(Code::Digit5),
            '6' => Some(Code::Digit6),
            '7' => Some(Code::Digit7),
            '8' => Some(Code::Digit8),
            '9' => Some(Code::Digit9),
            _ => None,
        };
    }

    match s.to_lowercase().as_str() {
        "f1" => Some(Code::F1),
        "f2" => Some(Code::F2),
        "f3" => Some(Code::F3),
        "f4" => Some(Code::F4),
        "f5" => Some(Code::F5),
        "f6" => Some(Code::F6),
        "f7" => Some(Code::F7),
        "f8" => Some(Code::F8),
        "f9" => Some(Code::F9),
        "f10" => Some(Code::F10),
        "f11" => Some(Code::F11),
        "f12" => Some(Code::F12),
        "space" => Some(Code::Space),
        "enter" => Some(Code::Enter),
        "tab" => Some(Code::Tab),
        "escape" | "esc" => Some(Code::Escape),
        "backspace" => Some(Code::Backspace),
        "delete" => Some(Code::Delete),
        "insert" => Some(Code::Insert),
        "home" => Some(Code::Home),
        "end" => Some(Code::End),
        "pageup" => Some(Code::PageUp),
        "pagedown" => Some(Code::PageDown),
        "arrowup" | "up" => Some(Code::ArrowUp),
        "arrowdown" | "down" => Some(Code::ArrowDown),
        "arrowleft" | "left" => Some(Code::ArrowLeft),
        "arrowright" | "right" => Some(Code::ArrowRight),
        "capslock" => Some(Code::CapsLock),
        _ => None,
    }
}

fn position_window(app: &tauri::AppHandle) {
    let window = app.get_webview_window("main").unwrap();

    if let Some(monitor) = window.current_monitor().ok().flatten() {
        let size = monitor.size();

        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: size.width,
            height: size.height,
        }));
        let _ = window.set_position(PhysicalPosition::new(0, 0));
    }
}

#[tauri::command]
async fn set_window_height(app: tauri::AppHandle, height: u32) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let current = window.outer_size().map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: current.width,
            height,
        }))
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let config = config::load(app.handle()).unwrap_or_default();
            app.manage(Mutex::new(AppState {
                current_status: "ready".to_string(),
                visible: true,
            }));
            app.manage(Mutex::new(HotkeyState {
                registered: Vec::new(),
            }));

            position_window(app.handle());

            let _ = config::save(app.handle(), &config);

            register_hotkeys(app.handle(), &config);

            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_ignore_cursor_events(false);
            let _ = window.set_focus();

            let show_i = MenuItem::with_id(app, "show", "Show Overlay", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide Overlay", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Overlay Stopwatch")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            let _ = app.emit("tray-show", ());
                        }
                        "hide" => {
                            let _ = app.emit("tray-hide", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_status,
            toggle_visibility,
            show_window,
            hide_window,
            enable_clickthrough,
            disable_clickthrough,
            resize_window,
            set_window_height,
            save_config,
            load_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
