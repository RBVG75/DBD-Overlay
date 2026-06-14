# Overlay Stopwatch

Minimalist gamer overlay stopwatch for Windows built with **Tauri v2**.

## Features

- **Always on top** - Stays above all windows including fullscreen borderless games
- **Transparent background** - Glass morphism UI with blur effect
- **Click-through** - Does not block interaction with underlying apps
- **Global hotkeys** - Customizable keyboard shortcuts for all actions
- **Scoreboard** - Win counter for two players with editable names and match title
- **Countdown timers** - Circular SVG countdowns triggered by hotkeys
- **Persistent config** - Settings saved locally in JSON
- **Low resource usage** - ~5MB binary, ~30MB RAM
- **Modern minimalist design** - Clean UI with customizable color and font size

## Hotkeys (Default)

| Action | Default Hotkey |
|--------|---------------|
| Start/Pause | `Ctrl+Shift+F1` |
| Pause | `Ctrl+Shift+F2` |
| Reset | `Ctrl+Shift+F3` |
| Toggle Overlay | `Ctrl+Shift+F4` |
| Settings | `Ctrl+Shift+F5` |
| Lock (click-through) | `F6` |

## Prerequisites

1. **Rust** - Install from https://www.rust-lang.org/tools/install
2. **Node.js** - Install from https://nodejs.org/
3. **Visual Studio Build Tools** - With "Desktop development with C++" workload
4. **WebView2** - Pre-installed on Windows 10/11

## Installation

```powershell
# Install dependencies
npm install

# Generate icons (optional, for building)
# Place a 1024x1024 PNG as src-tauri/icons/icon.png then run:
npx tauri icon src-tauri/icons/icon.png
```

## Development

```powershell
npm run dev
```

This starts the Vite dev server and launches the Tauri app in dev mode.

## Build to .exe

```powershell
npm run build
```

Output: `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/bundle/nsis/`

## Project Structure

```
cronometro/
├── src/                          # Frontend (HTML/CSS/JS)
│   ├── index.html                # Main HTML
│   ├── styles.css                # Styles with CSS variables
│   └── main.js                   # Frontend logic
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Entry point, window setup, hotkeys
│   │   └── config.rs             # Config load/save
│   ├── capabilities/
│   │   └── default.json          # Tauri permissions
│   ├── icons/                    # App icons
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   └── build.rs                  # Build script
├── package.json
├── vite.config.js                # Vite dev server config
└── README.md
```

## Good Practices for Windows Overlays

### 1. Always On Top + Transparent + No Decorations
```json
{
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true
}
```

### 2. Click-Through Mode
Use `set_ignore_cursor_events(true)` to let clicks pass through to underlying windows.
Disable it when showing settings UI so buttons are clickable.

### 3. Positioning
Position the window on startup using the primary monitor dimensions:
```rust
let x = monitor_width - window_width - margin;
let y = margin;
```

### 4. Fullscreen Borderless Games
- `alwaysOnTop: true` works over borderless fullscreen
- For exclusive fullscreen games, overlay is not possible (by design)
- Use `skipTaskbar: true` to avoid showing in taskbar

### 5. Performance
- Tauri uses system WebView2 (no bundled Chromium)
- Binary size: ~5-8MB vs Electron's ~150MB+
- RAM usage: ~30MB vs Electron's ~200MB+
- No background processes

### 6. Global Hotkeys
- Use `tauri-plugin-global-shortcut` for system-wide shortcuts
- Register on startup, unregister on exit
- Avoid common shortcuts to prevent conflicts

### 7. Config Storage
- Store in `%APPDATA%/com.overlay.stopwatch/config.json`
- Use `serde_json` for serialization
- Load on startup, save on change

## Customization

### Change Colors
Edit CSS variables in `src/styles.css`:
```css
:root {
  --accent: #00ff88;
  --bg-glass: rgba(10, 10, 15, 0.65);
}
```

### Change Font
Edit `font-family` in `src/styles.css`:
```css
font-family: 'JetBrains Mono', 'Consolas', monospace;
```

### Change Default Position
Edit `position_window()` in `src-tauri/src/main.rs`.

## Troubleshooting

### App doesn't appear
- Check system tray for the app
- Use toggle hotkey (`Ctrl+Shift+F4`) to show/hide

### Hotkeys don't work
- Make sure no other app is using the same shortcut
- Check config file at `%APPDATA%/com.overlay.stopwatch/config.json`

### Build fails
- Ensure Rust is installed: `rustc --version`
- Ensure Visual Studio Build Tools are installed
- Run `rustup update`

## License

MIT
