# DBD Overlay — Project Context

DBD 1v1 overlay and stream HUD for Windows. The app has a transparent, always-on-top
overlay window plus a separate native settings window. The overlay contains two
independent player timers, a two-player scoreboard, countdown timers,
tracker-backed info panels, DBD draw modes/renderers, a crosshair, global hotkeys,
and click-through/edit modes.

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
    ├── match-timers.js     → Two independent monotonic 1v1 timers + auto-score
    ├── stopwatch.js        → Legacy standalone stopwatch module; main uses match-timers.js
    ├── scoreboard.js       → Two-player scoreboard
    ├── crosshair.js        → Crosshair shapes
    ├── widgets.js          → Anchor placement, drag-to-move, direct resize handles
    ├── hotkeys.js          → Hotkey capture (reads `event.code`, layout independent)
    ├── controls.js         → Form-control factory for the settings panel
    ├── settings.js         → Separate settings window: 1v1 quick screen + advanced pages
    ├── game-tools.js       → Draw room + "Pool y reglas" dialogs, opened from overlay toolbar
    ├── game-data.js        → Perk/killer catalogues from `virtual:perk-assets`, DEFAULT_GAME_TOOLS
    ├── draw-controller.js  → getPool → start → draw → reveal, cancellation by sequence
    ├── draw-combinations.js→ Recommended renderer per game mode; renderers may restrict supported modes
    ├── games/              → One `*.game.js` per draw mode (random-killer, random-perk, killer-and-perks)
    └── renderers/          → One `*.renderer.js` per animation (12 renderers, auto-registered)
src/data/
├── killers.json            → Killer catalogue used by `catalog.js`
└── perks.json              → fileAliases, displayNames, labelOverrides, byKiller
src-tauri/
├── tauri.conf.json         → Window, permissions, build config
├── Cargo.toml
└── src/
    ├── main.rs             → Commands, global hotkey registration, window placement, tray
    └── config.rs           → AppConfig/CountdownConfig, atomic JSON save/load, v1 migration
docs/
└── draw-renderers-roadmap.md → Draw contracts, presentation requirements, pending renderer catalogue
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
- The overlay window label is `main`, title **DBD Overlay**,
  and `skipTaskbar` is false so OBS can enumerate/capture it as a window. It is
  transparent, undecorated and always on top. The separate `settings` window is
  decorated, opaque and not always on top; it loads `index.html?window=settings`.
- `main.js` branches on `?window=settings`: only `main` fits the monitor and
  handles global hotkey events. The settings window hides all overlay surfaces.
  Use the overlay toolbar's ruleta button to open draw modes in the stream window;
  keep that action out of the settings dashboard.

### Configuration
`config.json` lives in `%APPDATA%/com.dbdoverlay.app/`. Rust only types the
parts it needs and passes the rest through:

```rust
struct AppConfig {
    version: u32,
    hotkeys: BTreeMap<String, String>,   // action id -> combination
    countdowns: Vec<CountdownConfig>,    // { hotkey, #[serde(flatten)] extra }
    #[serde(flatten)] extra: Map<String, Value>,  // frontend sections incl. match_timers
}
```

**So adding a frontend option needs no Rust change.** Add it to the matching
default object in `js/defaults.js`, give it a normalizer rule, and add a control
in `js/settings.js`.

The frontend config format is version 3. `migrateLegacy()` must preserve every
frontend-owned section it does not type in Rust, especially `match_timers`; its
normalizer is the source of frontend defaults and validation. Old v2 timer
thresholds of 25 seconds were the previous default and migrate to the current
5-second default. Do not drop `match_timers` while rebuilding the migrated
object, or the next load will reset active player, timer values and auto-score.

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

### DBD 1v1 timers, editing and window sync

- `match-timers.js` uses `performance.now()` plus accumulated milliseconds for
  each player. `F1` toggles the selected timer and `F2` swaps the active player.
  Running timers are stored as paused snapshots; restart never resumes against a
  stale monotonic timestamp.
- Auto-score is on by default with a 5-second threshold. It compares one captured
  pause from each player once both are paused and both meet the threshold; greater
  elapsed time earns one point, a tie does not. Starting from stopped or resetting
  clears both pending pause candidates.
- Automatic points route through `scoreboard.addPoint()` so the visible score,
  autosave and settings-window sync use the same path as manual score changes.
- Settings edits emit `config-live-update` to `main` immediately and are also
  debounced to `save_config`. Overlay runtime changes broadcast back so a pending
  settings autosave cannot write stale scores/timer state over newer values.
- `gameTools.setConfig()` normalizes and compares the incoming config before
  canceling an active draw. `save_config` emits `config-updated` even for the
  settings autosave; reapplying unchanged `game_tools` must not cancel a draw.
- Direct resize handles are attached to stopwatch, scoreboard, active countdown
  instances and info panels only in edit mode. Scale is persisted on each widget
  config (`stopwatch.scale`, `scoreboard.scale`, timer `scale`, panel `scale`).
  `Terminar edición` is exposed in the overlay toolbar. Factory `start_locked`
  is false; the overlay starts interactive and can be made click-through with the
  lock button.

### Draw room (sorteos)
Two separate dialogs: `#game-tools` (Sala de sorteos — selectors, preview, run
button, `.draw-stage`) and `#game-tools-config` (Pool y reglas — pools, search,
custom perks, perk count). `js/draw-controller.js` runs
`mode.getPool(request)` → `renderer.start(pool)` → `mode.draw(request)` →
`renderer.reveal(result)` and cancels by sequence, so an aborted draw can never
write a stale result. Game modes (`js/games/*.game.js`) own the rules;
renderers (`js/renderers/*.renderer.js`) own the animation only. Adding either
one is just a new file — both are auto-registered from their folder.

Config lives in `config.game_tools` and is normalized in `js/defaults.js`; the
pools come from the asset folders, **not** from a hand-written list:
`vite.config.js` indexes `images/perks_killers/` and `images/perks-survis/` into
`virtual:perk-assets` (aliases grouped under one logical perk, `labelOverrides`
and `byKiller` from `src/data/perks.json`).

Renderers may declare `static modes = ['random-killer', ...]`; the overlay draw
room filters by those modes and `draw-controller.js` validates them. Without `modes`,
a renderer supports every draw mode. `RENDERER_GROUPS` in `js/game-tools.js`
organizes the selector by families. The roulette and tournament bracket are
killer-only; the portal supports modes with a killer. The roulette shows a
zoomed, clipped wheel arc with a larger portrait and name in each sector.

**Two standing presentation rules — every new renderer must honour them:**

1. **Participants are shown with their icon, never as a number, initial or
   generic symbol.** `item.image` is available for killers and perks alike. When
   the pool is big, shrink the icon or spread the items over several
   rings/levels; only fall back to the typographic mark while an image has not
   loaded yet. On `<canvas>`, preload the sprites and clip them to the piece.
2. **The final result always uses the split layout produced by
   `renderResults()`** in `js/renderers/draw-renderer.js`: left column
   `.draw-result-featured` with only the killer at `--card-scale: 2.6` (≈2× the
   perks) filling the available height; right column `.draw-result-perks` with
   the perks in a 2×2 grid of equal cells at `--card-scale: 1.3`.
   `.draw-results[data-layout]` is `split` / `perks` / `featured`. Every inner
   size of a card is `calc(px * var(--card-scale))`, so scaling a card keeps its
   internals proportional — change the layout through the scale, never by
   restyling the card. Below 680px the columns stack.

`docs/draw-renderers-roadmap.md` holds the full contracts plus the catalogue of
renderer styles still pending.

Current renderer behaviors that are easy to regress:

- Roulette's portraits are radial/outward: keep the slot's sector rotation and
  do not counter-rotate the card content to horizontal/upright.
- Race is `random-killer` only and renders at most 10 racers. The pool remains
  untruncated; if a drawn winner was not in the displayed sample, replace one
  lane so the winner is still visible.
- List/tombola filters its animation pool to non-perk items when the incoming
  pool contains killers and perks; the combined result animation cycles killers
  and only reveals `result.items[0]` (the killer).
- Spotlight scans decoys before converging its beams on the result. Portal is a
  ground gate/pulse and character emergence, not a spinning flat ring.
- Tournament uses generated bracket rounds, bye nodes, explicit “A elimina a B”
  outcomes and red/green eliminated/advancing states. Match rows map to bracket
  slots derived from the next-power-of-two participant count. Future-round
  participants/outcomes stay hidden behind locked placeholders until the prior
  round is complete. Preserve both spoiler gating and dynamic height/grid-row
  mapping when changing its DOM or CSS.
- Slot-machine strips use Web Animations API timing and cancel active animations
  in `destroy()`. Keep `reducedMotion` as the explicit no-motion path.

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
| Add a draw game mode | `js/games/<id>.game.js` (`getPool` + `draw`, auto-registered) → `js/draw-combinations.js` for the recommended renderer |
| Add a draw animation | `js/renderers/<id>.renderer.js` (`start`/`reveal`/`preview`, auto-registered; optional `static modes`) → `styles.css`; keep the icons + `renderResults()` rules |
| Change the draw result layout | `js/renderers/draw-renderer.js` (`renderResults`) → `styles.css` (`.draw-results[data-layout]`, `--card-scale`) |
| Change the draw pools | `images/perks_killers/`, `images/perks-survis/`, `src/data/perks.json` → `vite.config.js` (`virtual:perk-assets`) → `js/game-data.js` |
| Change window size/position | `main.rs` → `compute_rect()` / `apply_rect()` / `fit_overlay`, `tauri.conf.json` |
| Add a Tauri command | `main.rs` → `#[tauri::command]` + `generate_handler![]` |
