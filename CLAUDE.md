# Game: Arrow Wave Dodge

## Genre / Mechanic
Geometry Dash–style dodge game. Hold SPACE to fly up at exactly 45°, release to fall at exactly 45°. The world scrolls right-to-left at a constant speed. Hit an obstacle → death screen.

## Implemented Features
- **Arrow**: drawn with Graphics (green shaft, blue head, glow halo). Rotates ±45° based on SPACE state.
- **Trail**: bright light-green glowing line trail (90 points history, glow + core layers).
- **Obstacles**: 10 columns of orange/red rectangular blocks at world positions 820–5050px, spaced 430px apart. Each block has a glow halo, layered gradient body, yellow warning chevrons.
- **Collision**: AABB hit test (radius 10px circle vs. obstacle rect). Arrow hitting ceiling/floor also dies.
- **Death screen**: fades in with panel; shows `% COMPLETED` at the top, `LEVEL FAILED` text, and a large green `RESTART` button in the middle. Clicking or pressing SPACE restarts.
- **Win state**: at levelX >= 5400 (100%), shows "LEVEL COMPLETE!" variant.
- **Speed**: SCROLL = 285 px/s, VSPEED = 285 px/s (exact 45° diagonal).

## Key Implementation Details
- `GameScene.ts`: self-contained scene-as-code; does NOT call `loadWorldScene`.
- Arrow fixed at screen X = 220; world scrolls via `levelX` counter.
- Obstacle screen X = `worldX - levelX + ARROW_X`.
- `init()` resets all state so `scene.restart()` works cleanly.
- Trail rendered each frame as connected line segments with two passes (glow + core).
- Death delayed 460ms to show explosion tween first.

## Controls
- **SPACE held** → arrow moves up-right at 45°
- **SPACE released** → arrow moves down-right at 45°

## This Turn
- Built the complete game from scratch (was blank scaffold).
