# Overlay Stopwatch — Project Context

Overlay gamer stopwatch and stream HUD for Windows. Transparent always-on-top
window with a stopwatch, a two-player scoreboard, highly customizable countdown
timers, tracker-backed info panels (streak, records, win rate, kill rate…), a
crosshair and global hotkeys, plus a click-through mode.

## Tech Stack
- **Frontend**: Vanilla JS ES modules + CSS + HTML, bundled with Vite
- **Backend**: Tauri v2 (Rust)
- **Plugins**: `tauri-plugin-global-shortcut` (global hotkeys), `tauri-plugin-shell`

## File Map

```
src/
├── index.html              → DOM shell (widgets, crosshair, toolbar, settings frame)
├── styles.css              → Whole design system + every timer style
├── main.js                 → Bootstrap: config load/save, hotkey events, lock, wiring
└── js/
    ├── defaults.js         → Catalogues (styles, fonts, anchors…), defaults, normalizers, v1 migration
    ├── utils.js            → clamping, colour maths, SVG arcs, time formatting
    ├── timer-render.js     → One builder per visual style → `createTimerView(cfg)`
    ├── timers.js           → Timer engine: anchors, spawning, rAF loop, end actions, WebAudio alerts
    ├── stats.js            → Trackers (counters, W/L, text), records, streak chaining, formula parser
    ├── panels.js           → Info panels: rows, pages, rotation, skins, portraits
    ├── catalog.js          → Generated list of the 44 killer and 54 survivor portraits
    ├── stopwatch.js        → Stopwatch widget (display, laps, skins)
    ├── scoreboard.js       → Two-player scoreboard
    ├── crosshair.js        → Crosshair shapes
    ├── widgets.js          → Anchor placement + drag-to-move
    ├── hotkeys.js          → Hotkey capture (reads `event.code`, layout independent)
    ├── controls.js         → Form-control factory for the settings panel
    └── settings.js         → Settings panel: tabs, pages, live preview
src-tauri/
├── tauri.conf.json         → Window, permissions, build config
├── Cargo.toml
└── src/
    ├── main.rs             → Commands, global hotkey registration, window placement, tray
    └── config.rs           → AppConfig/CountdownConfig, atomic JSON save/load, v1 migration
```

## Key Architecture

### Window
- Transparent, always-on-top, undecorated window stretched over the **full**
  monitor rectangle — the taskbar strip included.
- Click-through toggled with `set_ignore_cursor_events`

**Covering the taskbar was the tricky part.** tao shrinks a borderless window's
client area in two places, and both had to be disabled:

1. `WM_NCCALCSIZE` clamps the client rect to `rcWork` (screen minus taskbar)
   whenever `GetWindowPlacement().showCmd == SW_MAXIMIZE` — hence
   `"maximizable": false`, `"resizable": false` and an `unmaximize()` before
   every fit.
2. An undecorated window **with a shadow** gets its client rect inset by the
   frame thickness (`calculate_insets_for_dpi`), and `set_inner_size` then grows
   the outer window to compensate — so inner size and outer position no longer
   describe the same rectangle. `"shadow": false` removes that path, making
   client rect == window rect == monitor rect.

`fit_overlay` (a command, also run at start-up and 700 ms later) computes the
rect and returns it to the frontend, which shows it in *Ajustes → General* so the
coverage can be verified instead of guessed. `screen_mode` picks the current
monitor or the union of all of them. A `Resized`/`Moved`/`ScaleFactorChanged`
handler re-applies the stored rect if Windows moves it; it is self-terminating
because it only acts when the geometry differs from the target.
- **No `data-tauri-drag-region`**: the window covers the screen, so dragging it
  would displace the whole overlay. Widgets are moved *inside* the page by
  `js/widgets.js`, and the position is stored as anchor + offset.

### Configuration
`config.json` lives in `%APPDATA%/com.overlay.stopwatch/`. Rust only types the
parts it needs and passes the rest through:

```rust
struct AppConfig {
    version: u32,
    hotkeys: BTreeMap<String, String>,   // action id -> combination
    countdowns: Vec<CountdownConfig>,    // { hotkey, #[serde(flatten)] extra }
    #[serde(flatten)] extra: Map<String, Value>,  // interface/stopwatch/scoreboard/crosshair
}
```

**So adding a frontend option needs no Rust change.** Add it to the matching
default object in `js/defaults.js`, give it a normalizer rule, and add a control
in `js/settings.js`.

Both sides migrate v1 files (flat `hotkey_*` keys, `line_width`/`line_color`
countdowns) by merging: modern values win, legacy values fill the gaps.

### Hotkey System
Rust registers one shortcut per entry of `config.hotkeys` and emits
`hotkey-<action>`; `main.js` maps each action id to a handler in `ACTIONS`.
Adding an action = one entry in `HOTKEY_ACTIONS` (`js/defaults.js`), one entry
in `HOTKEY_ACTIONS` (`config.rs`) and one handler in `ACTIONS` (`main.js`).

Countdown shortcuts emit `countdown-trigger` with `{ index }` only — never the
whole timer, which may carry a base64 image.

Combinations are captured from `event.code`, so they match what
`parse_key_code()` in `main.rs` understands on any keyboard layout.

### Timer Styles
`js/timer-render.js` holds one builder per style. A builder receives
`(cfg, artElement)` and returns `update(ctx)`:

```js
ctx = { total, remaining, elapsed, p, phase, color, text, now }
//  p     = fraction to draw (direction 'drain' → remaining/total, 'fill' → elapsed/total)
//  phase = 'normal' | 'warning' | 'danger'
```

The shell around it (frame, background image, backdrop, text, caption, glow,
opacity) is shared, so a new style only draws its own artwork. Colours come from
CSS custom properties (`--tc`, `--tc2`, `--track`, `--glow`) that `update()`
rewrites only when the phase changes — never per frame.

To add a style: push an entry to `TIMER_STYLES` in `js/defaults.js`, write the
builder, register it in `BUILDERS`, and add its selectors to `styles.css`. If it
is round, add its id to `CIRCULAR`; if the time should be drawn below instead of
inside, add it to `TEXT_OUTSIDE`.

### Character portraits
`images/` at the project root is Vite's `publicDir`, so `images/killers/x.webp`
is served as `/killers/x.webp` in dev and copied into `dist/` on build — no
imports, no bundling. `js/catalog.js` lists every portrait with a display name
derived from the filename (`K16_TheGhostFace` → "The Ghost Face"); it is
generated from the directory listing, so re-generate it when the folder changes
rather than editing entries by hand. Every path is checked against the real
folder as part of testing, because a typo there is an invisible broken image.

### Trackers and info panels
A **tracker** is a named value (`kind`: `number`, `winloss`, `text` or `choice`)
with a `key` used in formulas. A **panel** holds `pages`, each page a list of `items`,
and each item points at a tracker or a formula. Panels store no numbers.

- `js/stats.js` owns the model. `evaluateFormula()` is a shunting-yard parser
  (no `eval`, so no CSP issues); unknown identifiers resolve to 0 and division by
  zero yields 0. Formula keys: `<key>` (value or games played), `<key>_v` `_d`
  `_e` `_pct` for win/loss trackers, `<key>_record`, and `sesion` (minutes live).
- Chaining makes streaks automatic: a number tracker with `bump_with` set to a
  win/loss tracker grows on each win, and `reset_with` puts it back to zero on
  each loss. `record` follows the peak on its own — only for `number` trackers,
  since a win counter would break its record on every win.
- Panels rotate through their pages every `rotate_seconds`; `activate()` in
  `js/panels.js` runs the transition classes and both the live layer and the
  settings preview share it through `mountPanel()`.
- A `choice` tracker holds a `catalog` (`killers`/`survivors`) and a `choice_id`.
  `stats.bump()` cycles it (wrapping at both ends) so the same counter shortcuts
  work as "next/previous character"; the `portrait` item source draws it and the
  plain `tracker` source prints its name. Its formula key resolves to 0 — a
  character has no numeric meaning, but the key must still resolve.
- The `media` panel layout splits a page into `.ip-media` (portrait items) and
  `.ip-items` (everything else) inside an `.ip-split`, with `media_position`
  choosing the side. Without a portrait it degrades to a normal column.
- `STATS_TEMPLATES` + `buildTemplate()` in `js/defaults.js` create a ready set of
  trackers and panels. `buildTemplate` reuses an existing win/loss tracker rather
  than creating a second one, so stacking templates keeps one source of truth.

### Counter shortcuts
`buildCustomHotkeys()` in `main.js` derives `config.custom_hotkeys` from the
trackers on every apply. Rust registers each one and emits `custom-hotkey` with
`{action, id}` without interpreting it, so **new shortcut-driven features need no
Rust change** — just emit a new `action` and handle it in `main.js`.

### Positioning
Nine anchor containers live in `#timer-layer`. Each timer goes into the anchor
named by `position`, inside a `.timer-slot` that carries `offset_x`/`offset_y` as
a transform — keeping the timer's own transform free for animations. Widgets use
`positionWidget()` from `js/widgets.js`, which resolves the same nine anchors to
`top/left/right/bottom` + a translate.

## Build & Run
```bash
npm run dev      # Vite dev server + Tauri dev window
npm run build    # Production build → .exe + .msi
```

## Quick Reference — Where to Change What

| Task | File(s) |
|---|---|
| Add a timer option | `js/defaults.js` (DEFAULT_TIMER + normalizeTimer) → `js/settings.js` (control) → `js/timer-render.js` / `styles.css` if visual |
| Add a timer style | `js/defaults.js` (TIMER_STYLES) → `js/timer-render.js` (builder + BUILDERS + CIRCULAR/TEXT_OUTSIDE) → `styles.css` |
| Add a global hotkey action | `js/defaults.js` (HOTKEY_ACTIONS, DEFAULT_HOTKEYS) → `config.rs` (HOTKEY_ACTIONS) → `main.js` (ACTIONS) |
| Add a counter-driven shortcut | `main.js` → `buildCustomHotkeys()` + the `custom-hotkey` handler (no Rust change) |
| Add a panel skin | `js/defaults.js` (PANEL_STYLES) → `styles.css` (`.info-panel[data-style=…]`) |
| Add a panel data type | `js/defaults.js` (ITEM_SOURCES) → `js/panels.js` (`buildItem` switch + `defaultLabel`) → `js/settings.js` (`itemCard`) |
| Add a ready-made setup | `js/defaults.js` → `STATS_TEMPLATES` (use `ctx.games()` to share the win/loss counter) |
| Change the stopwatch look | `js/stopwatch.js`, `styles.css` (`#stopwatch[data-skin=…]`) |
| Change the scoreboard | `js/scoreboard.js`, `styles.css` (`#scoreboard[data-skin=…]`) |
| Add a crosshair shape | `js/defaults.js` (POINTER_TYPES) → `styles.css` (`#crosshair[data-pointer=…]`) |
| Add a settings page | `js/settings.js` (PAGES + builder function) |
| Add a form control type | `js/controls.js`, `styles.css` |
| Change window size/position | `main.rs` → `compute_rect()` / `apply_rect()` / `fit_overlay`, `tauri.conf.json` |
| Add a Tauri command | `main.rs` → `#[tauri::command]` + `generate_handler![]` |
