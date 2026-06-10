# Battle City Clone

## Game info
- **Title:** Battle City
- **Genre:** Top-down tank shooter
- **Core mechanic:** Player controls a tank on a tile-based map, destroys 20 enemy tanks per stage while protecting the eagle base at the bottom. Brick walls are destructible; steel walls are not.

## Features implemented
- **Tile map:** 26×26 grid with brick, steel, and eagle tiles — layout varies per stage
- **Multi-stage system:** Stage 1 and Stage 2 implemented; Stage Clear advances to next stage carrying score + lives; GAME OVER resets to Stage 1
- **Player tank:** WASD / Arrow keys to move, SPACE to shoot. One bullet at a time. Grid-snapped turning.
- **Enemy tanks:** 3 types (basic silver, fast orange, armored red). 20 per stage, max on screen varies by stage. Random movement with occasional player-targeting.
- **Bullet system:** Player and enemy bullets, tile collision (brick destroys, steel blocks), eagle collision triggers game over.
- **Destructible terrain:** Brick tiles removed on bullet hit, with particle sparks.
- **Eagle base:** Ornate eagle sprite at map center-bottom. Surrounded by bricks. Destroying it = game over.
- **Lives:** 3 lives (carried across stages); respawn with 2.5s invincibility (blink effect).
- **HUD:** Score, lives, enemy count on right panel. Shows current stage number.
- **Particles:** Explosions (Phaser 3.60+ API) on tank deaths, sparks on wall hits.
- **Score popups:** Floating "+score" text on enemy kills.
- **Overlay:** GAME OVER or STAGE CLEAR screen with SPACE/ENTER to continue.

## Stage configs (STAGE_CONFIGS array)

| | Stage 1 | Stage 2 |
|---|---|---|
| Map | Brick-heavy, lots of cover | More steel, open lanes |
| Max enemies on screen | 4 | 5 |
| Spawn interval | 3000ms | 2200ms |
| Enemy speed mult | 1.0x | 1.2x |
| Shoot cooldown | 1200–3200ms | 800–2000ms |
| Type weights (basic/fast/armored) | 6/3/1 | 3/4/3 |

Adding more stages: append a new `StageConfig` to `STAGE_CONFIGS`. The system auto-detects the last stage and shows "YOU WIN!" — then restarts from Stage 1.

## Key implementation details
- `GameScene.ts` — fully procedural, no scene-as-data; replaces loadWorldScene scaffold
- `BootScene.ts` — preloads manifest then starts GameScene directly
- `buildMap(blocks)` — builds 26×26 tile map from a 13×13 block definition
- Textures generated via `this.make.graphics().generateTexture()` in `create()`
- `wouldCollide()` checks a 44×44 body box against tile grid for tank movement
- `gridSnap()` aligns the perpendicular axis when changing direction (classic feel)
- Player spawns at tile (8, 24); eagle at BLOCKS row 12 col 6 → tiles (24-25, 12-13)
- Particle system uses Phaser 3.60+ `this.add.particles(x, y, key, config)` API
- Stage transition: `this.scene.start('GameScene', { stage, score, lives })`

## Changed this turn
- Added Stage 2 with a new map layout (more steel walls, open lanes)
- Extracted per-stage settings into `StageConfig` / `STAGE_CONFIGS` array
- Stage Clear now advances to the next stage carrying score and lives forward
- HUD now shows current stage number
- Enemy speed, shoot rate, spawn interval, and type mix all driven by stage config
