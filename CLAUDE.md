# Game: Arrow Wave Dodge

## Genre / Mechanic
Geometry Dash–style dodge game. Hold SPACE to fly up at exactly 45°, release to fall at exactly 45°. The world scrolls right-to-left at a constant speed. Hit an obstacle → death screen.

## Implemented Features
- **Arrow**: drawn with Graphics (green shaft, blue head, glow halo). Rotates ±45° based on SPACE state. Positioned at horizontal center of screen (ARROW_X = EW/2 ≈ 457).
- **Trail**: straight 45° glowing line that extends BACKWARD from the arrow in the exact opposite direction of travel (22 circle-blobs, fading from arrow out to TRAIL_L=150 world-px). Trail snaps to new angle instantly when direction changes.
- **Wall Obstacles**: 35 columns of orange/red rectangular blocks cycling 10 patterns; first at worldX=820, spacing ~436px. Each block has glow halo, layered gradient body, yellow warning chevrons.
- **Spike Obstacles**: Cyan/teal triangular spikes (pointing up from floor or down from ceiling) placed between every wall pair — up to 2 spike clusters per gap. 8 different placement patterns cycled. Makes the game significantly harder.
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

## This Turn
- Arrow repositioned to horizontal center (ARROW_X = EW/2).
- Added pixel-art mountain background with two parallax layers.
- Added seeded pixel-art stars.
- Added cyan spike obstacles (floor/ceiling) between wall columns — ~40 spike clusters make the level much harder.
- ObsBlock now has `hw` field for per-obstacle collision width.
