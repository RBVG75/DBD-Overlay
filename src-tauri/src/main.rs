#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;

use config::{AppConfig, AppState};
use serde::Serialize;
use serde_json::json;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Emitter;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::PhysicalPosition;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

struct HotkeyState {
    registered: Vec<Shortcut>,
}

#[tauri::command]
fn set_status(app: tauri::AppHandle, status: String) {
    if let Some(state) = app.try_state::<Mutex<AppState>>() {
        if let Ok(mut s) = state.lock() {
            s.current_status = status;
        }
    }
}

#[tauri::command]
async fn toggle_visibility(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let state = app.state::<Mutex<AppState>>();
    let mut s = state.lock().map_err(|e| e.to_string())?;
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
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    {
        let state = app.state::<Mutex<AppState>>();
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.visible = true;
    }
    window.show().map_err(|e| e.to_string())?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    {
        let state = app.state::<Mutex<AppState>>();
        let mut s = state.lock().map_err(|e| e.to_string())?;
        s.visible = false;
    }
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
async fn enable_clickthrough(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn disable_clickthrough(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save(&app, &config)?;
    reload_hotkeys(&app, &config);
    let _ = app.emit("config-updated", ());
    Ok(())
}

#[tauri::command]
async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("DBD Overlay · Ajustes")
    .inner_size(940.0, 760.0)
    .min_inner_size(720.0, 600.0)
    .resizable(true)
    .decorations(true)
    .transparent(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .visible(true)
    .build()
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn request_overlay_edit(app: tauri::AppHandle) {
    let _ = app.emit("overlay-edit-request", ());
}

#[tauri::command]
async fn load_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    config::load(&app)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Releases every shortcut this app currently holds.
fn unregister_all(app: &tauri::AppHandle) {
    let plugin = app.global_shortcut();
    let hotkey_state = app.state::<Mutex<HotkeyState>>();
    let mut state = match hotkey_state.lock() {
        Ok(state) => state,
        Err(_) => return,
    };
    for shortcut in state.registered.drain(..) {
        let _ = plugin.unregister(shortcut);
    }
}

fn register_hotkeys(app: &tauri::AppHandle, config: &AppConfig) {
    let plugin = app.global_shortcut();
    let hotkey_state = app.state::<Mutex<HotkeyState>>();
    let mut state = match hotkey_state.lock() {
        Ok(state) => state,
        Err(_) => return,
    };

    for (combo, event_name) in config.hotkey_bindings() {
        if let Some(shortcut) = parse_hotkey(&combo) {
            let event = event_name.clone();
            let registered = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit(&event, ());
                }
            });
            if registered.is_ok() {
                state.registered.push(shortcut);
            } else {
                eprintln!("No se pudo registrar el atajo {combo} ({event_name})");
            }
        }
    }

    for custom in &config.custom_hotkeys {
        if custom.hotkey.trim().is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(&custom.hotkey) {
            let action = custom.action.clone();
            let id = custom.id.clone();
            let registered = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit("custom-hotkey", json!({ "action": action, "id": id }));
                }
            });
            if registered.is_ok() {
                state.registered.push(shortcut);
            }
        }
    }

    for (index, countdown) in config.countdowns.iter().enumerate() {
        if countdown.hotkey.trim().is_empty() {
            continue;
        }
        if let Some(shortcut) = parse_hotkey(&countdown.hotkey) {
            // Only the index travels over IPC — sending the whole timer (which
            // may hold a base64 image) on every key press was wasteful.
            let registered = plugin.on_shortcut(shortcut.clone(), move |app, _shortcut, shortcut_event| {
                if matches!(shortcut_event.state, ShortcutState::Pressed) {
                    let _ = app.emit("countdown-trigger", json!({ "index": index }));
                }
            });
            if registered.is_ok() {
                state.registered.push(shortcut);
            }
        }
    }
}

fn reload_hotkeys(app: &tauri::AppHandle, config: &AppConfig) {
    unregister_all(app);
    register_hotkeys(app, config);
}

fn parse_hotkey(s: &str) -> Option<Shortcut> {
    use tauri_plugin_global_shortcut::{Code, Modifiers};

    let mut modifiers = Modifiers::empty();
    let mut code: Option<Code> = None;

    for part in s.split('+') {
        match part.trim().to_lowercase().as_str() {
            "" => continue,
            "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
            "alt" => modifiers |= Modifiers::ALT,
            "shift" => modifiers |= Modifiers::SHIFT,
            "meta" | "win" | "super" | "cmd" => modifiers |= Modifiers::META,
            key => code = parse_key_code(key),
        }
    }

    code.map(|c| Shortcut::new(Some(modifiers), c))
}

/// Accepts both friendly names ("F5", "Space") and W3C key codes
/// ("Numpad1", "BracketLeft"), which is what the frontend captures.
fn parse_key_code(s: &str) -> Option<tauri_plugin_global_shortcut::Code> {
    use tauri_plugin_global_shortcut::Code;

    if s.chars().count() == 1 {
        let ch = s.chars().next().unwrap();
        return match ch.to_ascii_uppercase() {
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

    match s {
        // Function keys, up to F24 on keyboards that have them.
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
        "f13" => Some(Code::F13),
        "f14" => Some(Code::F14),
        "f15" => Some(Code::F15),
        "f16" => Some(Code::F16),
        "f17" => Some(Code::F17),
        "f18" => Some(Code::F18),
        "f19" => Some(Code::F19),
        "f20" => Some(Code::F20),
        "f21" => Some(Code::F21),
        "f22" => Some(Code::F22),
        "f23" => Some(Code::F23),
        "f24" => Some(Code::F24),

        // Numeric keypad: distinct from the number row, which is the point.
        "numpad0" => Some(Code::Numpad0),
        "numpad1" => Some(Code::Numpad1),
        "numpad2" => Some(Code::Numpad2),
        "numpad3" => Some(Code::Numpad3),
        "numpad4" => Some(Code::Numpad4),
        "numpad5" => Some(Code::Numpad5),
        "numpad6" => Some(Code::Numpad6),
        "numpad7" => Some(Code::Numpad7),
        "numpad8" => Some(Code::Numpad8),
        "numpad9" => Some(Code::Numpad9),
        "numpadadd" => Some(Code::NumpadAdd),
        "numpadsubtract" => Some(Code::NumpadSubtract),
        "numpadmultiply" => Some(Code::NumpadMultiply),
        "numpaddivide" => Some(Code::NumpadDivide),
        "numpaddecimal" => Some(Code::NumpadDecimal),
        "numpadenter" => Some(Code::NumpadEnter),
        "numpadequal" => Some(Code::NumpadEqual),
        "numpadcomma" => Some(Code::NumpadComma),
        "numlock" => Some(Code::NumLock),

        // Editing and navigation.
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

        // Lock and system keys.
        "capslock" => Some(Code::CapsLock),
        "scrolllock" => Some(Code::ScrollLock),
        "printscreen" => Some(Code::PrintScreen),
        "pause" => Some(Code::Pause),
        "contextmenu" => Some(Code::ContextMenu),

        // Punctuation, by physical position so the layout does not matter.
        "minus" => Some(Code::Minus),
        "equal" => Some(Code::Equal),
        "bracketleft" => Some(Code::BracketLeft),
        "bracketright" => Some(Code::BracketRight),
        "backslash" => Some(Code::Backslash),
        "semicolon" => Some(Code::Semicolon),
        "quote" => Some(Code::Quote),
        "backquote" => Some(Code::Backquote),
        "comma" => Some(Code::Comma),
        "period" => Some(Code::Period),
        "slash" => Some(Code::Slash),
        "intlbackslash" => Some(Code::IntlBackslash),
        "intlro" => Some(Code::IntlRo),
        "intlyen" => Some(Code::IntlYen),

        // Media keys, on keyboards that expose them.
        "mediaplaypause" => Some(Code::MediaPlayPause),
        "mediastop" => Some(Code::MediaStop),
        "mediatracknext" => Some(Code::MediaTrackNext),
        "mediatrackprevious" => Some(Code::MediaTrackPrevious),
        "audiovolumeup" => Some(Code::AudioVolumeUp),
        "audiovolumedown" => Some(Code::AudioVolumeDown),
        "audiovolumemute" => Some(Code::AudioVolumeMute),

        _ => None,
    }
}

/// The rectangle the overlay should occupy, in physical pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct OverlayRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

/// What the frontend gets back after a fit, so the geometry can be checked from
/// the settings panel instead of guessed at.
#[derive(Clone, Debug, Serialize)]
pub struct ScreenFit {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
    pub monitors: usize,
    pub mode: String,
}

/// The rectangle the window is meant to hold, re-applied whenever Windows
/// decides otherwise.
pub struct TargetRect(pub Mutex<Option<OverlayRect>>);

fn monitor_rect(monitor: &tauri::Monitor) -> OverlayRect {
    let size = monitor.size();
    let position = monitor.position();
    OverlayRect {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

/// Union of every monitor: the whole virtual desktop.
fn union_rect(rects: &[OverlayRect]) -> Option<OverlayRect> {
    let first = rects.first()?;
    let mut left = first.x;
    let mut top = first.y;
    let mut right = first.x + first.width as i32;
    let mut bottom = first.y + first.height as i32;
    for r in rects.iter().skip(1) {
        left = left.min(r.x);
        top = top.min(r.y);
        right = right.max(r.x + r.width as i32);
        bottom = bottom.max(r.y + r.height as i32);
    }
    Some(OverlayRect {
        x: left,
        y: top,
        width: (right - left).max(1) as u32,
        height: (bottom - top).max(1) as u32,
    })
}

fn compute_rect(window: &tauri::WebviewWindow, mode: &str) -> Option<(OverlayRect, usize)> {
    let monitors: Vec<OverlayRect> = window
        .available_monitors()
        .map(|list| list.iter().map(monitor_rect).collect())
        .unwrap_or_default();

    if mode == "all" {
        if let Some(rect) = union_rect(&monitors) {
            return Some((rect, monitors.len()));
        }
    }

    let current = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())?;

    Some((monitor_rect(&current), monitors.len().max(1)))
}

/// Sizes the overlay to the **full** monitor rectangle — not the work area, so
/// it also covers the strip where the taskbar sits.
fn apply_rect(window: &tauri::WebviewWindow, rect: OverlayRect) {
    // A window Windows considers maximized gets its client area clamped to the
    // work area — the screen minus the taskbar — so never stay maximized.
    let _ = window.unmaximize();

    // Position first, then size, then position again: on Windows a borderless
    // window that is moved across monitors can be clamped on the way, and the
    // second call puts it back where it belongs.
    let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: rect.width,
        height: rect.height,
    }));
    let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
    let _ = window.set_always_on_top(true);
}

fn fit_window(app: &tauri::AppHandle, mode: &str) -> Option<ScreenFit> {
    let window = app.get_webview_window("main")?;
    let (rect, monitors) = compute_rect(&window, mode)?;
    apply_rect(&window, rect);

    if let Some(state) = app.try_state::<TargetRect>() {
        if let Ok(mut target) = state.0.lock() {
            *target = Some(rect);
        }
    }

    Some(ScreenFit {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale: window.scale_factor().unwrap_or(1.0),
        monitors,
        mode: mode.to_string(),
    })
}

/// Re-applies the stored rectangle if the window drifted from it. Self
/// terminating: once the size matches, the resize event stops triggering work.
fn reassert_rect(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(state) = app.try_state::<TargetRect>() else {
        return;
    };
    let target = match state.0.lock() {
        Ok(guard) => *guard,
        Err(_) => return,
    };
    let Some(rect) = target else { return };

    let size = match window.outer_size() {
        Ok(size) => size,
        Err(_) => return,
    };
    let position = window.outer_position().unwrap_or(PhysicalPosition::new(rect.x, rect.y));

    if size.width != rect.width || size.height != rect.height || position.x != rect.x || position.y != rect.y {
        apply_rect(&window, rect);
    }
}

#[tauri::command]
async fn fit_overlay(app: tauri::AppHandle, mode: Option<String>) -> Result<ScreenFit, String> {
    let mode = mode.unwrap_or_else(|| "monitor".to_string());
    let mode = if mode == "all" { "all" } else { "monitor" };
    fit_window(&app, mode).ok_or_else(|| "No se pudo leer la geometría de la pantalla".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let config = config::load(&handle).unwrap_or_default();

            app.manage(Mutex::new(AppState {
                current_status: "ready".to_string(),
                visible: true,
            }));
            app.manage(Mutex::new(HotkeyState {
                registered: Vec::new(),
            }));
            app.manage(TargetRect(Mutex::new(None)));

            let screen_mode = config
                .extra
                .get("interface")
                .and_then(|value| value.get("screen_mode"))
                .and_then(|value| value.as_str())
                .unwrap_or("monitor")
                .to_string();

            fit_window(&handle, &screen_mode);
            register_hotkeys(&handle, &config);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(false);
                let _ = window.set_always_on_top(true);
                let _ = window.set_skip_taskbar(false);
                // No `set_focus()` here on purpose: stealing focus at startup
                // pulls the player out of a running game.

                // Windows likes to clamp borderless windows to the work area
                // (screen minus taskbar). Put the window back whenever it does.
                let watcher = handle.clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                        reassert_rect(&watcher);
                    }
                    tauri::WindowEvent::ScaleFactorChanged { .. } => {
                        reassert_rect(&watcher);
                    }
                    _ => {}
                });

                // The first fit can land before the window is fully realized, so
                // do it once more shortly after start-up.
                let later = handle.clone();
                let mode = screen_mode.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(700));
                    let _ = fit_window(&later, &mode);
                });
            }

            let show_i = MenuItem::with_id(app, "show", "Mostrar overlay", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Ocultar overlay", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Ajustes", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &hide_i, &settings_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("DBD Overlay")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        let _ = app.emit("tray-show", ());
                    }
                    "hide" => {
                        let _ = app.emit("tray-hide", ());
                    }
                    "settings" => {
                        let _ = app.emit("hotkey-settings", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
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
            fit_overlay,
            save_config,
            open_settings_window,
            hide_settings_window,
            request_overlay_edit,
            load_config,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
