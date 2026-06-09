# Battle City Clone

## Game info
- **Title:** Battle City
- **Genre:** Top-down tank shooter
- **Core mechanic:** Player controls a tank on a tile-based map, destroys 20 enemy tanks per stage while protecting the eagle base at the bottom. Brick walls are destructible; steel walls are not.

## Features implemented
- **Tile map:** 26×26 grid (Stage 1 layout) with brick, steel, and eagle tiles
- **Player tank:** WASD / Arrow keys to move, SPACE to shoot. One bullet at a time. Grid-snapped turning.
- **Enemy tanks:** 3 types (basic silver, fast orange, armored red). 20 per stage, 4 max on screen. Random movement with occasional player-targeting.
- **Bullet system:** Player and enemy bullets, tile collision (brick destroys, steel blocks), eagle collision triggers game over.
- **Destructible terrain:** Brick tiles removed on bullet hit, with particle sparks.
- **Eagle base:** Ornate eagle sprite at map center-bottom. Surrounded by bricks. Destroying it = game over.
- **Lives:** 3 lives; respawn with 2.5s invincibility (blink effect).
- **HUD:** Score, lives, enemy count on right panel.
- **Particles:** Explosions (Phaser 3.60+ API) on tank deaths, sparks on wall hits.
- **Score popups:** Floating "+score" text on enemy kills.
- **Overlay:** GAME OVER or STAGE CLEAR screen with restart on SPACE/ENTER.

## Key implementation details
- `GameScene.ts` — fully procedural, no scene-as-data; replaces loadWorldScene scaffold
- `BootScene.ts` — preloads manifest then starts GameScene directly
- Map built from `BLOCKS` 13×13 array expanded to 26×26 tile map
- Textures generated via `this.make.graphics().generateTexture()` in `create()`
- `wouldCollide()` checks a 44×44 body box against tile grid for tank movement
- `gridSnap()` aligns the perpendicular axis when changing direction (classic feel)
- Player spawns at tile (8, 24); eagle at tile block (12, 6) → tiles (24-25, 12-13)
- Particle system uses Phaser 3.60+ `this.add.particles(x, y, key, config)` API

## Changed this turn
- Built entire game from scratch: tile map, player tank, enemy tanks, bullet system, HUD, particles, overlays.
