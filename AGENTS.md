# Overlay Stopwatch — Project Context

Overlay gamer stopwatch for Windows. Transparent always-on-top window with stopwatch, circular countdown timers, global hotkeys, and click-through mode.

## Tech Stack
- **Frontend**: Vanilla JS + CSS + HTML, bundled with Vite
- **Backend**: Tauri v2 (Rust)
- **Plugins**: `tauri-plugin-global-shortcut` (global hotkeys), `tauri-plugin-shell`

## File Map

```
src/
├── index.html          → DOM structure (stopwatch, settings panel, countdown container, scoreboard)
├── styles.css          → All styles (layout, countdown rings, settings, scoreboard, responsive --scale)
├── main.js             → All logic (timer, countdowns, hotkey capture, config, events, scoreboard)
src-tauri/
├── tauri.conf.json     → Window size, permissions, build config
├── Cargo.toml          → Rust dependencies
└── src/
    ├── main.rs         → Tauri commands, global hotkey registration, window positioning
    └── config.rs       → AppConfig/CountdownConfig structs, JSON save/load
```

## Key Architecture

### Window
- Full-screen transparent window at (0,0), always-on-top, no decorations
- Click-through enabled when locked (🔒), disabled when unlocked (🔓)
- Scoreboard: top-left (`position: fixed; top: 10px; left: 16px`) — player names, scores, match title
- Stopwatch: top-right (`position: fixed; top: 10px; right: 16px`)
- Countdowns: center-left (`position: fixed; top: 50%; left: 36px`)
- Settings: centered modal (`position: fixed; top: 50%; left: 50%`)

### Hotkey System
Global shortcuts registered in Rust → emit Tauri events → JS listens:
| Event | Rust location | JS handler |
|---|---|---|
| `hotkey-start` | `main.rs:124-145` | `main.js:479` → `toggleStartPause()` |
| `hotkey-pause` | `main.rs:124-145` | `main.js:480` → `pauseTimer()` |
| `hotkey-reset` | `main.rs:124-145` | `main.js:481` → `resetTimer()` |
| `hotkey-toggle` | `main.rs:124-145` | `main.js:482` → `toggleOverlay()` |
| `hotkey-settings` | `main.rs:124-145` | `main.js:483` → `toggleSettings()` |
| `hotkey-lock` | `main.rs:124-145` | `main.js:484` → `toggleLock()` |
| `countdown-trigger` | `main.rs:147-160` | `main.js:497` → `createCountdown(cfg)` |

Hotkey strings use format `Ctrl+Shift+F1`. Parsed in Rust `parse_hotkey()` (`main.rs:215`).

### Countdown Timers
- Config stored in `AppConfig.countdowns: Vec<CountdownConfig>` (`config.rs:7`)
- Each has: `hotkey`, `seconds`, `line_width`, `line_color`, `image` (base64)
- Rendered as SVG circles with `stroke-dashoffset` animation via `requestAnimationFrame`
- `buildCountdownElement()` at `main.js:173`, `createCountdown()` at `main.js:247`
- Image upload: file → canvas resize to 200px → `toDataURL('image/jpeg')` → stored in config

### Settings Panel
- Toggle: `toggleSettings()` (`main.js:119`) — async, disables clickthrough first
- Hotkey pickers: click to activate → `keydown` captures keys → `keyup` saves when all released
- Delegated click via `document.addEventListener('click', ...)` (`main.js:313`)
- Save button calls `save_config` Rust command → triggers `reload_hotkeys()`
- Countdown config rows rendered dynamically by `renderCountdownSettings()` (`main.js:271`)

### Responsive Scaling
- Scale factor computed at `main.js:13`: `min(screenW/1920, screenH/1080, 1.8)`
- Stored as CSS `--scale` custom property
- Applied to: `--countdown-size`, `--settings-width`

### Config Format (`config.json`)
```json
{
  "hotkey_start": "Tab",
  "hotkey_pause": "",
  "hotkey_reset": "F3",
  "hotkey_toggle": "F4",
  "hotkey_settings": "F5",
  "hotkey_lock": "F6",
  "font_size": 48,
  "accent_color": "#00ff88",
  "scoreboard": {
    "player1_name": "Player 1",
    "player1_score": 0,
    "player2_name": "Player 2",
    "player2_score": 0,
    "match_title": ""
  },
  "countdowns": [
    {
      "hotkey": "J",
      "seconds": 15,
      "line_width": 4,
      "line_color": "#00ff88",
      "image": ""
    }
  ]
}
```

## Build & Run
```bash
npm run dev      # Dev mode with hot reload
npm run build    # Production build → .exe + .msi
```

## Quick Reference — Where to Change What

| Task | File(s) |
|---|---|
| Add a new global hotkey | `config.rs` (field), `main.rs` (hotkey list + emit), `index.html` (picker), `main.js` (state + listener) |
| Change countdown config fields | `config.rs` → `CountdownConfig` struct, `main.js` → `renderCountdownSettings()`, `buildCountdownElement()`, save/load |
| Change window size/position | `main.rs` → `position_window()`, `tauri.conf.json` |
| Change stopwatch/countdown position | `styles.css` → `#stopwatch`, `#countdowns` |
| Change countdown visual (size, colors, animation) | `styles.css` → `.countdown-*`, `main.js` → `buildCountdownElement()` |
| Change settings panel layout/size | `styles.css` → `#settings-panel`, `main.js` → `toggleSettings()` |
| Change hotkey capture UX | `main.js` → `keydown`/`keyup` handlers + `handlePickerClick()` |
| Change responsive scaling | `main.js` → scale calculation (line ~13), `styles.css` → `--scale` usage |
| Add Tauri command | `main.rs` → `#[tauri::command]` fn + register in `generate_handler![]` |
