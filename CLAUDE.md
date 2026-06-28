# Game: Arrow Wave Dodge

## Genre / Mechanic
Geometry Dash–style dodge game. Hold SPACE to fly up at exactly 45°, release to fall at exactly 45°. The world scrolls right-to-left at a constant speed. Hit an obstacle → death screen.

## Implemented Features
- **Arrow**: drawn with Graphics (green shaft, blue head, glow halo). Rotates ±45° based on SPACE state.
- **Trail**: straight 45° glowing line that extends BACKWARD from the arrow in the exact opposite direction of travel (22 circle-blobs, fading from arrow out to TRAIL_L=150 world-px). Trail snaps to new angle instantly when direction changes.
- **Obstacles**: 35 columns of orange/red rectangular blocks cycling 10 patterns; first at worldX=820, spacing ~436px. Each block has glow halo, layered gradient body, yellow warning chevrons.
- **Collision**: AABB hit test (radius 10px circle vs. obstacle rect). Arrow hitting ceiling/floor also dies.
- **Death screen**: fades in with panel; shows `% COMPLETED` at the top, `LEVEL FAILED` text, and a RESTART button in the middle. Clicking or pressing SPACE restarts. Win state shows "LEVEL COMPLETE!".
- **Speed**: SCROLL = 428 px/s, VSPEED = 428 px/s (1.5× original, exact 45° diagonal).
- **Level length**: LEVEL_L = 16200 world-px (3× original 5400).
- **Camera zoom**: ZOOM = 1.4; all game objects live in effective world space EW × EH ≈ 914 × 514.

## Key Implementation Details
- `GameScene.ts`: self-contained scene-as-code; does NOT call `loadWorldScene`.
- `ZOOM = 1.4`: `cameras.main.setZoom(1.4)` in create(); world objects live in [0..EW] × [0..EH].
- Arrow fixed at world X = ARROW_X = 220; world scrolls via `levelX` counter.
- Obstacle world X = worldX - levelX + ARROW_X.
- `init()` resets all state so `scene.restart()` works cleanly.
- Trail: straight 45° line, no position history — redrawn each frame from arrow backward.
- Death delayed 460ms to show explosion tween first.

## Controls
- **SPACE held** → arrow moves up-right at 45°
- **SPACE released** → arrow moves down-right at 45°

## This Turn
- Trail changed to straight 45° streak (no position-history zigzag).
- Camera zoom raised to 1.4× — all world coords rescaled to EW≈914 × EH≈514.
- Speed raised 1.5× to SCROLL=VSPEED=428.
- Level extended 3× to LEVEL_L=16200 with 35 obstacle columns.
