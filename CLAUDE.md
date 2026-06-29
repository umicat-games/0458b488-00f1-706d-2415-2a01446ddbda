# Game: Arrow Wave Dodge

## Genre / Mechanic
Geometry Dash–style dodge game. Hold SPACE to fly up at exactly 45°, release to fall at exactly 45°. The world scrolls right-to-left at a constant speed. Hit an obstacle → death screen.

## Implemented Features
- **Arrow**: drawn with Graphics (green shaft, blue head, glow halo). Rotates ±45° based on SPACE state. Positioned at horizontal center of screen (ARROW_X = EW/2 ≈ 457).
- **Rocket icon**: alternate player icon drawn with Graphics (silver body, red nose, orange fins, yellow flame, cyan porthole). Selected via CUSTOM ICONS in GEODE. Replaces the arrow during play.
- **Trail**: persistent solid history-based polyline. Stores up to TRAIL_CAP=400 world-space positions (wx=levelX, wy=arrowY). Each frame maps pts to screen (screenX = wx - levelX + ARROW_X). Drawn as two passes: soft glow (18px, 22% alpha) + solid bright-green core (5px, 100% alpha). Never fades, never ends — traces the exact wave path the arrow has cut through the level.
- **Wall Obstacles**: 35 columns of orange/red rectangular blocks; first at worldX=820, spacing WALL_SPACING=700px. Each wall has exactly ONE gap (GAP_H=110px) at a designed height. Each block has glow halo, layered gradient body, yellow warning chevrons.
- **Spike Obstacles**: Cyan/teal triangular spikes between every wall pair (1 cluster per gap). Placed near floor when path rises, near ceiling when path falls — punish wrong-height flying without blocking the intended route.
- **Pixel-art Mountains**: Two parallax layers drawn with 10px block silhouettes. Far layer (dark purple, 0.12× parallax), near layer (dark navy, 0.28× parallax). Drawn 3× wide for seamless looping via Graphics setX().
- **Stars**: 60 seeded pixel-art square stars scattered across the sky.
- **Collision**: AABB hit test using per-obstacle `hw` (half-width). Ceiling/floor clamp the arrow at y=40 / EH-40 (never kill) — keeps glow halo fully inside the rails. Only obstacles end the run.
- **Death screen**: fades in with panel; shows `% COMPLETED` at the top, status text, diamond earnings, and a RESTART button. Clicking or pressing SPACE restarts. Win state shows "LEVEL COMPLETE!".
- **Diamond economy**: Diamonds earned = percentage completed (e.g. 73% → +73 diamonds). Stored in module-level `sessionDiamonds` — persists across restarts in the same browser session.
- **Speed**: SCROLL = 428 px/s, VSPEED = 428 px/s (exact 45° diagonal).
- **Level length**: LEVEL_L ≈ 25,220 world-px (820 + 34×700 + 600) with 35 wall columns + ~40 spike clusters.
- **Camera zoom**: ZOOM = 1.4; all game objects live in effective world space EW × EH ≈ 914 × 514.

## Key Implementation Details
- `GameScene.ts`: self-contained scene-as-code; does NOT call `loadWorldScene`.
- `ZOOM = 1.4`: `cameras.main.setZoom(1.4)` in create(); world objects live in [0..EW] × [0..EH].
- Arrow fixed at world X = ARROW_X = EW/2 ≈ 457 (screen center).
- Obstacle world X = worldX - levelX + ARROW_X.
- `farMtns` and `nearMtns`: Graphics objects drawn 3× wide, repositioned via setX() each frame.
- `ObsBlock.hw`: per-obstacle half-width (walls use OBS_W/2, spikes use count*SPK_W/2).
- `init()` resets all state so `scene.restart()` works cleanly.
- Trail: world-space position history stored in `trailPts[]`, redrawn each frame.
- Death delayed 460ms to show explosion tween first.
- Module-level `sessionDiamonds` and `sessionIconMode` persist across `scene.restart()`.
- Gap boundaries and ceiling/floor clamp both use 40px margin so all gaps are always reachable.

## Controls
- **SPACE held** → player moves up-right at 45°
- **SPACE released** → player moves down-right at 45°
- **ESC / P** → if CUSTOM ICONS open: close it; else if GEODE open: close GEODE; else toggle pause

## GEODE Panel (cheat menu)
- Skull square button (46×46, dark red, pixel-art skull icon) sits to the left of RESTART in the pause menu.
- Opens the GEODE sub-panel: dark violet theme, `G E O D E` spaced monospace title with purple glow shadow.
- **Diamond counter**: `◈ N` shown top-right of panel.
- **NOCLIP** toggle: when ON, collision bypassed (arrow clamps at boundary). A `◈ NOCLIP` indicator shows top-right during play.
- **CUSTOM ICONS**: locked at <25 diamonds (shows "◈ X / 25 to unlock"); unlocked shows "CHOOSE ›".
  - Opens CUSTOM ICONS panel (cyan theme): two 76×76 icon buttons — ARROW and ROCKET.
  - Clicking sets `sessionIconMode`; panel closes+reopens to show updated selection.
- `← BACK` button and ESC/P close the active sub-panel and return to the layer beneath.
- Fields: `noclip`, `geodeOpen`, `geodeObjs[]`, `noclipTxt`, `customIconsOpen`, `customIconsObjs[]`. All reset in `init()`.

## This Turn
- Added home screen shown at game start and via MENU button. Shows "GEOMETRY DASH" title (large, green glow) with "REBIRTH" below-right. PLAY button + SPACE key dismiss it and start play.
- Death screen now has two buttons: RESTART (jumps straight back into play) and MENU (returns to home screen).
- `init(data?)` accepts `skipHome: true` to bypass the home screen on restart. `atHome` field gates `update()` while on the home screen.
