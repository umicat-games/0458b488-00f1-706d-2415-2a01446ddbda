# Game: Arrow Wave Dodge

## Genre / Mechanic
Geometry Dash–style dodge game. Hold SPACE to fly up at exactly 45°, release to fall at exactly 45°. The world scrolls right-to-left at a constant speed. Hit an obstacle → death screen.

## Implemented Features
- **Arrow**: drawn with Graphics (green shaft, blue head, glow halo). Rotates ±45° based on SPACE state. Positioned at horizontal center of screen (ARROW_X = EW/2 ≈ 457).
- **Trail**: persistent solid history-based polyline. Stores up to TRAIL_CAP=400 world-space positions (wx=levelX, wy=arrowY). Each frame maps pts to screen (screenX = wx - levelX + ARROW_X). Drawn as two passes: soft glow (18px, 22% alpha) + solid bright-green core (5px, 100% alpha). Never fades, never ends — traces the exact wave path the arrow has cut through the level.
- **Wall Obstacles**: 35 columns of orange/red rectangular blocks; first at worldX=820, spacing ~436px. Each wall has exactly ONE narrow gap (82 px) at a designed height — no alternate routes. Each block has glow halo, layered gradient body, yellow warning chevrons.
- **Spike Obstacles**: Cyan/teal triangular spikes between every wall pair (1 cluster per gap). Placed near floor when path rises, near ceiling when path falls — punish wrong-height flying without blocking the intended route.
- **Pixel-art Mountains**: Two parallax layers drawn with 10px block silhouettes. Far layer (dark purple, 0.12× parallax), near layer (dark navy, 0.28× parallax). Drawn 3× wide for seamless looping via Graphics setX().
- **Stars**: 60 seeded pixel-art square stars scattered across the sky.
- **Collision**: AABB hit test using per-obstacle `hw` (half-width). Arrow hitting ceiling/floor also dies.
- **Death screen**: fades in with panel; shows `% COMPLETED` at the top, status text, and a RESTART button. Clicking or pressing SPACE restarts. Win state shows "LEVEL COMPLETE!".
- **Speed**: SCROLL = 428 px/s, VSPEED = 428 px/s (exact 45° diagonal).
- **Level length**: LEVEL_L = 16200 world-px with 35 wall columns + ~40 spike clusters.
- **Camera zoom**: ZOOM = 1.4; all game objects live in effective world space EW × EH ≈ 914 × 514.

## Key Implementation Details
- `GameScene.ts`: self-contained scene-as-code; does NOT call `loadWorldScene`.
- `ZOOM = 1.4`: `cameras.main.setZoom(1.4)` in create(); world objects live in [0..EW] × [0..EH].
- Arrow fixed at world X = ARROW_X = EW/2 ≈ 457 (screen center).
- Obstacle world X = worldX - levelX + ARROW_X.
- `farMtns` and `nearMtns`: Graphics objects drawn 3× wide, repositioned via setX() each frame.
- `ObsBlock.hw`: per-obstacle half-width (walls use OBS_W/2, spikes use count*SPK_W/2).
- `init()` resets all state so `scene.restart()` works cleanly.
- Trail: straight 45° line, no position history — redrawn each frame from arrow backward.
- Death delayed 460ms to show explosion tween first.

## Controls
- **SPACE held** → arrow moves up-right at 45°
- **SPACE released** → arrow moves down-right at 45°
- **ESC / P** → toggle pause menu; if GEODE is open, either key closes GEODE first

## GEODE Panel (cheat menu)
- Skull square button (46×46, dark red, pixel-art skull icon) sits to the left of RESTART in the pause menu.
- Opens the GEODE sub-panel: dark violet theme, `G E O D E` spaced monospace title with purple glow shadow.
- **NOCLIP** toggle: when ON, collision and ceiling/floor death are bypassed (arrow clamps at boundary instead). A `◈ NOCLIP` indicator shows top-right during play.
- `← BACK` button and ESC close GEODE and return to the pause menu.
- Fields: `noclip`, `geodeOpen`, `geodeObjs[]`, `noclipTxt`. All reset in `init()`.

## This Turn
- **GEODE cheat panel**: skull square button added to the left of RESTART in the pause menu; opens a violet GEODE sub-menu with a NOCLIP toggle and `← BACK` button. ESC closes GEODE before closing pause.
