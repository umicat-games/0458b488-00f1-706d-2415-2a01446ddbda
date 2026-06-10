import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';


// ─── Layout ───────────────────────────────────────────────────────────────────
const TILE = 24;          // px per tile
const COLS = 26;          // map columns
const ROWS = 26;          // map rows
const OX   = 48;          // map left edge
const OY   = 48;          // map top edge
const MAP_W = COLS * TILE; // 624
const MAP_H = ROWS * TILE; // 624
const HUD_X = OX + MAP_W + 32; // right panel start
const TANK  = TILE * 2;   // tank pixel size (48)
const HALF  = TANK / 2;   // 24

// ─── Speeds ───────────────────────────────────────────────────────────────────
const PLAYER_SPEED = 120;  // px/s
const ENEMY_SPEED  = 72;
const BULLET_SPEED = 320;

// ─── Tile types ───────────────────────────────────────────────────────────────
const TE = 0; // empty
const TB = 1; // brick (destructible)
const TS = 2; // steel (indestructible)
const TX = 3; // eagle (base)

// ─── Directions: 0=UP 1=RIGHT 2=DOWN 3=LEFT ──────────────────────────────────
const DX   = [0, 1, 0, -1];
const DY   = [-1, 0, 1, 0];
const DANG = [0, 90, 180, 270]; // sprite angle (drawn facing UP)

type Dir = 0 | 1 | 2 | 3;

// ─── Enemy types ──────────────────────────────────────────────────────────────
interface EnemyDef { color: number; speed: number; health: number; score: number; }
const ENEMY_TYPES: EnemyDef[] = [
  { color: 0xaaaaaa, speed: ENEMY_SPEED,       health: 1, score: 100 },
  { color: 0xff8800, speed: ENEMY_SPEED * 1.5, health: 1, score: 200 },
  { color: 0xcc3333, speed: ENEMY_SPEED,       health: 4, score: 400 },
];

interface EnemyState {
  sprite: Phaser.Physics.Arcade.Image;
  dir: Dir;
  type: number;
  health: number;
  speed: number;
  moveTimer: number;   // ms until next direction change
  shootTimer: number;  // ms until next shot
  flashTimer: number;
}

interface BulletState {
  sprite: Phaser.Physics.Arcade.Image;
  owner: 'player' | 'enemy';
}

// ─── Stage configs ────────────────────────────────────────────────────────────
interface StageConfig {
  blocks: number[][];
  totalEnemies: number;
  maxOnScreen: number;
  spawnInterval: number;   // ms between spawns
  enemySpeedMult: number;  // multiplier on base ENEMY_SPEED
  shootMin: number;        // ms
  shootMax: number;
  typeWeights: [number, number, number]; // relative weights for basic/fast/armored
}

// Stage 1 — standard, brick-heavy, mostly basic tanks
const BLOCKS_S1: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,0,1,1,0,1,1,0,1,1,0],
  [0,1,1,0,1,1,0,1,1,0,1,1,0],
  [0,1,1,0,1,1,0,1,1,0,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,0,1,2,2,0,2,2,1,0,1,1],
  [1,1,0,1,2,2,0,2,2,1,0,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,0,1,1,0,1,1,0,1,1,0],
  [0,1,1,0,1,1,0,1,1,0,1,1,0],
  [0,1,1,0,0,0,0,0,0,0,1,1,0],
  [0,0,0,0,0,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,3,1,0,0,0,0,0],
];

// Stage 2 — more steel, open lanes, faster & tougher enemies
const BLOCKS_S2: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [2,0,1,0,2,0,1,0,2,0,1,0,2],
  [2,0,1,0,2,0,1,0,2,0,1,0,2],
  [0,0,0,1,0,0,0,0,0,1,0,0,0],
  [0,2,0,1,0,2,0,2,0,1,0,2,0],
  [0,2,0,0,2,0,0,0,2,0,0,2,0],
  [0,0,1,0,0,2,0,2,0,0,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,1,0,0],
  [1,0,0,2,0,1,0,1,0,2,0,0,1],
  [1,0,0,2,0,0,0,0,0,2,0,0,1],
  [0,2,0,0,1,0,0,0,1,0,0,2,0],
  [0,0,0,0,0,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,3,1,0,0,0,0,0],
];

const STAGE_CONFIGS: StageConfig[] = [
  {
    blocks: BLOCKS_S1,
    totalEnemies: 20,
    maxOnScreen: 4,
    spawnInterval: 3000,
    enemySpeedMult: 1.0,
    shootMin: 1200,
    shootMax: 3200,
    typeWeights: [6, 3, 1],
  },
  {
    blocks: BLOCKS_S2,
    totalEnemies: 20,
    maxOnScreen: 5,
    spawnInterval: 2200,
    enemySpeedMult: 1.2,
    shootMin: 800,
    shootMax: 2000,
    typeWeights: [3, 4, 3],
  },
];

// ─── Build 26×26 tile map from 13×13 block map ────────────────────────────────
function buildMap(blocks: number[][]): number[][] {
  const m: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(TE));
  for (let br = 0; br < 13; br++) {
    for (let bc = 0; bc < 13; bc++) {
      const v = blocks[br][bc];
      if (!v) continue;
      const fill = v;
      m[br * 2][bc * 2]         = fill;
      m[br * 2][bc * 2 + 1]     = fill;
      m[br * 2 + 1][bc * 2]     = fill;
      m[br * 2 + 1][bc * 2 + 1] = fill;
    }
  }
  return m;
}

export class GameScene extends Phaser.Scene {
  // ── Map ──────────────────────────────────────────────────────────────────
  private tileMap: number[][] = [];
  private mapGfx!: Phaser.GameObjects.Graphics;

  // ── Player ────────────────────────────────────────────────────────────────
  private player!: Phaser.Physics.Arcade.Image;
  private playerDir: Dir = 0;        // facing UP
  private playerAlive = true;
  private playerLives = 3;
  private playerInvTimer = 0;        // invincibility ms after respawn
  private playerRespawnTimer = 0;
  private playerBulletActive = false;
  private playerBulletCooldown = 0;

  // ── Enemies ───────────────────────────────────────────────────────────────
  private enemies: EnemyState[] = [];
  private totalEnemies = 20;
  private enemiesDefeated = 0;
  private enemySpawnTimer = 2000;
  private readonly SPAWN_COLS = [0, 12, 24];
  private spawnRoundRobin = 0;

  // ── Bullets ───────────────────────────────────────────────────────────────
  private bullets: BulletState[] = [];

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private dKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private enemyCountText!: Phaser.GameObjects.Text;
  private score = 0;

  // ── Stage ─────────────────────────────────────────────────────────────────
  private currentStage = 1;   // 1-based
  private stageCfg!: StageConfig;

  // ── State ─────────────────────────────────────────────────────────────────
  private gameOverFlag = false;
  private stageClearFlag = false;
  private overlayShown = false;

  // (particle texture key is 'particle', created in create())

  constructor() {
    super({ key: 'GameScene' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE
  // ──────────────────────────────────────────────────────────────────────────
  create(data?: { stage?: number; score?: number; lives?: number }): void {
    // Read stage from init data (stage transitions pass data forward)
    this.currentStage = (data?.stage ?? 1);
    const cfgIndex    = Math.min(this.currentStage - 1, STAGE_CONFIGS.length - 1);
    this.stageCfg     = STAGE_CONFIGS[cfgIndex];

    this.gameOverFlag   = false;
    this.stageClearFlag = false;
    this.overlayShown   = false;
    this.score          = data?.score ?? 0;
    this.playerLives    = data?.lives ?? 3;
    this.totalEnemies   = this.stageCfg.totalEnemies;
    this.enemiesDefeated= 0;
    this.enemySpawnTimer= this.stageCfg.spawnInterval;
    this.spawnRoundRobin= 0;
    this.enemies        = [];
    this.bullets        = [];
    this.playerBulletActive  = false;
    this.playerBulletCooldown= 0;
    this.playerInvTimer      = 0;
    this.playerRespawnTimer  = 0;
    this.eagleAlive          = true;
    this.eagleSprite         = undefined;

    this.tileMap = buildMap(this.stageCfg.blocks);

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x1c1c1c);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Side panel bg
    bg.fillStyle(0x111111);
    bg.fillRect(HUD_X - 16, 0, GAME_WIDTH - HUD_X + 16, GAME_HEIGHT);
    // Map area frame
    bg.lineStyle(3, 0x444444);
    bg.strokeRect(OX - 3, OY - 3, MAP_W + 6, MAP_H + 6);

    // ── Textures ──────────────────────────────────────────────────────────
    this.makeTextures();

    // ── Map graphics ──────────────────────────────────────────────────────
    this.mapGfx = this.add.graphics().setDepth(1);
    this.redrawMap();

    // ── Particle texture ──────────────────────────────────────────────────
    const pg = this.make.graphics({ x: 0, y: 0, add: false });
    pg.fillStyle(0xffffff);
    pg.fillRect(0, 0, 4, 4);
    pg.generateTexture('particle', 4, 4);
    pg.destroy();

    // ── Player ────────────────────────────────────────────────────────────
    this.spawnPlayer(true);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.wKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── HUD ───────────────────────────────────────────────────────────────
    this.createHUD();

    // ── Focus canvas so keyboard works without clicking first ─────────────
    this.game.canvas.focus();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEXTURES
  // ──────────────────────────────────────────────────────────────────────────
  private makeTextures(): void {
    this.makeTankTex('tank_player',  0x44dd44, 0x228822);
    this.makeTankTex('tank_enemy_0', 0xbbbbbb, 0x888888);
    this.makeTankTex('tank_enemy_1', 0xff9900, 0xcc6600);
    this.makeTankTex('tank_enemy_2', 0xee3333, 0xaa1111);
    this.makeTankTex('tank_player_inv', 0xffffff, 0xaaaaff); // invincible flash

    // Bullet (player)
    const bg2 = this.make.graphics({ x: 0, y: 0, add: false });
    bg2.fillStyle(0xffff88);
    bg2.fillRect(0, 0, 6, 10);
    bg2.fillStyle(0xffffff);
    bg2.fillRect(1, 1, 4, 3);
    bg2.generateTexture('bullet_player', 6, 10);
    bg2.destroy();

    // Bullet (enemy)
    const bg3 = this.make.graphics({ x: 0, y: 0, add: false });
    bg3.fillStyle(0xff6666);
    bg3.fillRect(0, 0, 6, 10);
    bg3.fillStyle(0xffaaaa);
    bg3.fillRect(1, 1, 4, 3);
    bg3.generateTexture('bullet_enemy', 6, 10);
    bg3.destroy();

    // Eagle
    const eg = this.make.graphics({ x: 0, y: 0, add: false });
    // Body
    eg.fillStyle(0x333300);
    eg.fillRect(0, 0, TANK, TANK);
    // Eagle silhouette - wings
    eg.fillStyle(0xddaa00);
    // Left wing
    eg.fillTriangle(4, 28, 18, 4, 18, 44);
    // Right wing
    eg.fillTriangle(44, 28, 30, 4, 30, 44);
    // Head
    eg.fillStyle(0xffcc00);
    eg.fillCircle(24, 24, 9);
    // Eye
    eg.fillStyle(0x000000);
    eg.fillCircle(27, 22, 3);
    // Beak
    eg.fillStyle(0xff8800);
    eg.fillTriangle(28, 26, 36, 28, 28, 30);
    // Outline
    eg.lineStyle(2, 0xffdd00);
    eg.strokeCircle(24, 24, 9);
    eg.generateTexture('eagle', TANK, TANK);
    eg.destroy();
  }

  private makeTankTex(key: string, colorMain: number, colorDark: number): void {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const S = TANK; // 48

    // Treads (sides)
    g.fillStyle(colorDark);
    g.fillRoundedRect(0,       6, 10, S - 12, 3); // left tread
    g.fillRoundedRect(S - 10,  6, 10, S - 12, 3); // right tread
    // Tread marks
    g.fillStyle(colorMain);
    for (let i = 0; i < 4; i++) {
      g.fillRect(1, 10 + i * 9, 8, 5);
      g.fillRect(S - 9, 10 + i * 9, 8, 5);
    }

    // Body
    g.fillStyle(colorMain);
    g.fillRoundedRect(10, 10, S - 20, S - 12, 4);

    // Turret base
    g.fillStyle(colorDark);
    g.fillCircle(S / 2, S / 2 + 2, 11);

    // Cannon barrel (pointing UP = negative y)
    g.fillStyle(colorDark);
    g.fillRect(S / 2 - 3, 2, 6, S / 2 - 2);

    // Highlight
    g.fillStyle(0xffffff, 0.2);
    g.fillRoundedRect(14, 14, (S - 20) / 2, 10, 3);

    g.generateTexture(key, S, S);
    g.destroy();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAP DRAWING
  // ──────────────────────────────────────────────────────────────────────────
  private redrawMap(): void {
    this.mapGfx.clear();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.tileMap[r][c];
        const px = OX + c * TILE;
        const py = OY + r * TILE;

        if (tile === TB) {
          // Brick – draw 4 mini bricks
          this.mapGfx.fillStyle(0xcc6633);
          this.mapGfx.fillRect(px, py, TILE - 1, TILE - 1);
          // Mortar lines
          this.mapGfx.fillStyle(0x993322);
          this.mapGfx.fillRect(px,           py,           TILE/2 - 1, TILE/2 - 1);
          this.mapGfx.fillRect(px + TILE/2,  py + TILE/2,  TILE/2 - 1, TILE/2 - 1);
          // Highlight
          this.mapGfx.fillStyle(0xdd8855, 0.5);
          this.mapGfx.fillRect(px + 2, py + 2, 4, 2);
          this.mapGfx.fillRect(px + TILE/2 + 2, py + TILE/2 + 2, 4, 2);
        } else if (tile === TS) {
          // Steel
          this.mapGfx.fillStyle(0x888899);
          this.mapGfx.fillRect(px, py, TILE - 1, TILE - 1);
          this.mapGfx.fillStyle(0xaabbcc);
          this.mapGfx.fillRect(px + 2, py + 2, TILE - 6, 4);
          this.mapGfx.fillStyle(0x555566);
          this.mapGfx.fillRect(px + 2, py + TILE - 6, TILE - 6, 4);
          // Cross
          this.mapGfx.lineStyle(1, 0x666677);
          this.mapGfx.lineBetween(px, py, px + TILE - 1, py + TILE - 1);
          this.mapGfx.lineBetween(px + TILE - 1, py, px, py + TILE - 1);
        }
        // Eagle tiles drawn by sprite below
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // EAGLE SPRITE
  // ──────────────────────────────────────────────────────────────────────────
  private eagleSprite?: Phaser.GameObjects.Image;
  private eagleAlive = true;

  private placeEagle(): void {
    // Find eagle tile position
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.tileMap[r][c] === TX) {
          // Center on the 2×2 tile block (tile + TILE = center of 2 tiles)
          const ex = OX + c * TILE + TILE;
          const ey = OY + r * TILE + TILE;
          if (!this.eagleSprite) {
            this.eagleSprite = this.add.image(ex, ey, 'eagle')
              .setDepth(2)
              .setDisplaySize(TILE * 2, TILE * 2)
              .setOrigin(0.5);
          }
          return;
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PLAYER SPAWN
  // ──────────────────────────────────────────────────────────────────────────
  private spawnPlayer(firstTime = false): void {
    // Player starts at col 8, row 24 (classic position, clear of eagle bricks)
    const spawnCol = 8;
    const spawnRow = 24;
    const px = OX + spawnCol * TILE + TANK / 2;
    const py = OY + spawnRow * TILE + TANK / 2;

    if (firstTime) {
      this.player = this.physics.add.image(px, py, 'tank_player')
        .setDepth(3)
        .setDisplaySize(TANK, TANK);
      (this.player.body as Phaser.Physics.Arcade.Body)
        .setSize(TANK - 4, TANK - 4);
      this.placeEagle();
    } else {
      this.player.setPosition(px, py);
      this.player.setAlpha(1);
      this.player.setTexture('tank_player');
    }

    this.playerDir  = 0; // UP
    this.playerAlive = true;
    this.playerInvTimer = 2500;
    this.playerBulletActive = false;
    this.playerBulletCooldown = 0;
    this.player.setAngle(DANG[this.playerDir]);

    // Flash in
    this.tweens.add({
      targets: this.player,
      alpha: { from: 0, to: 1 },
      duration: 300,
      ease: 'Linear',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ENEMY SPAWN
  // ──────────────────────────────────────────────────────────────────────────
  private spawnEnemy(): void {
    if (this.enemies.length >= this.stageCfg.maxOnScreen) return;
    const remaining = this.totalEnemies - this.enemiesDefeated - this.enemies.length;
    if (remaining <= 0) return;

    const col = this.SPAWN_COLS[this.spawnRoundRobin % 3];
    this.spawnRoundRobin++;

    const px = OX + col * TILE + TANK / 2;
    const py = OY + TANK / 2;

    // Pick enemy type based on stage weight table
    const w = this.stageCfg.typeWeights;
    const total = w[0] + w[1] + w[2];
    const roll  = Math.random() * total;
    const typeIndex = roll < w[0] ? 0 : roll < w[0] + w[1] ? 1 : 2;
    const def = ENEMY_TYPES[typeIndex];

    const spr = this.physics.add.image(px, py, `tank_enemy_${typeIndex}`)
      .setDepth(3)
      .setDisplaySize(TANK, TANK);
    (spr.body as Phaser.Physics.Arcade.Body).setSize(TANK - 4, TANK - 4);

    const dir: Dir = 2; // face DOWN
    spr.setAngle(DANG[dir]);

    const { shootMin, shootMax, enemySpeedMult } = this.stageCfg;
    this.enemies.push({
      sprite: spr,
      dir,
      type: typeIndex,
      health: def.health,
      speed: def.speed * enemySpeedMult,
      moveTimer: 500 + Math.random() * 1500,
      shootTimer: shootMin + Math.random() * (shootMax - shootMin),
      flashTimer: 0,
    });

    // Spawn pop
    this.tweens.add({
      targets: spr,
      scaleX: { from: 0, to: 1 },
      scaleY: { from: 0, to: 1 },
      duration: 250,
      ease: 'Back.Out',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FIRE BULLET
  // ──────────────────────────────────────────────────────────────────────────
  private fireBullet(fromSprite: Phaser.Physics.Arcade.Image, dir: Dir, owner: 'player' | 'enemy'): void {
    const bx = fromSprite.x + DX[dir] * (HALF + 6);
    const by = fromSprite.y + DY[dir] * (HALF + 6);
    const texKey = owner === 'player' ? 'bullet_player' : 'bullet_enemy';

    const spr = this.physics.add.image(bx, by, texKey)
      .setDepth(4)
      .setDisplaySize(6, 10)
      .setAngle(DANG[dir]);
    (spr.body as Phaser.Physics.Arcade.Body)
      .setVelocity(DX[dir] * BULLET_SPEED, DY[dir] * BULLET_SPEED);

    this.bullets.push({ sprite: spr, owner });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HUD
  // ──────────────────────────────────────────────────────────────────────────
  private createHUD(): void {
    const x = HUD_X;
    const style = { fontFamily: 'monospace', color: '#eeeeee', fontSize: '16px' };
    const titleStyle = { fontFamily: 'monospace', color: '#ffcc00', fontSize: '14px', fontStyle: 'bold' };

    this.add.text(x, 56, `★ STAGE ${this.currentStage} ★`, titleStyle).setDepth(10);
    this.add.text(x, 80, '─────────────', { fontFamily: 'monospace', color: '#444444', fontSize: '14px' }).setDepth(10);

    this.add.text(x, 108, 'SCORE', titleStyle).setDepth(10);
    this.scoreText = this.add.text(x, 128, '000000', style).setDepth(10);

    this.add.text(x, 168, 'LIVES', titleStyle).setDepth(10);
    this.livesText = this.add.text(x, 188, '♥ ♥ ♥', { ...style, color: '#ff5555' }).setDepth(10);

    this.add.text(x, 228, 'ENEMIES', titleStyle).setDepth(10);
    this.enemyCountText = this.add.text(x, 248, '20 remaining', style).setDepth(10);

    // Controls reminder
    this.add.text(x, 340, 'CONTROLS', titleStyle).setDepth(10);
    this.add.text(x, 360, 'WASD / Arrows\nmove tank', { ...style, fontSize: '13px', color: '#888888' }).setDepth(10);
    this.add.text(x, 400, 'SPACE / Z\nfire!', { ...style, fontSize: '13px', color: '#888888' }).setDepth(10);

    // Mini-map border
    this.add.graphics().setDepth(10)
      .lineStyle(2, 0x333344)
      .strokeRect(x - 4, 50, 190, GAME_HEIGHT - 60);
  }

  private updateHUD(): void {
    this.scoreText.setText(String(this.score).padStart(6, '0'));
    const hearts = '♥ '.repeat(Math.max(0, this.playerLives)).trim();
    this.livesText.setText(hearts || '✗');
    const left = Math.max(0, this.totalEnemies - this.enemiesDefeated - this.enemies.length);
    this.enemyCountText.setText(`${left} remaining`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TANK MOVEMENT HELPERS
  // ──────────────────────────────────────────────────────────────────────────
  /** Returns true if the 48×48 tank centered at (nx,ny) would overlap a solid tile. */
  private wouldCollide(nx: number, ny: number, skipEagle = false): boolean {
    const left   = nx - HALF + 2;
    const right  = nx + HALF - 2;
    const top    = ny - HALF + 2;
    const bottom = ny + HALF - 2;

    const c0 = Math.floor((left  - OX) / TILE);
    const c1 = Math.floor((right - OX) / TILE);
    const r0 = Math.floor((top   - OY) / TILE);
    const r1 = Math.floor((bottom- OY) / TILE);

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true; // map edge
        const t = this.tileMap[r][c];
        if (t === TB || t === TS) return true;
        if (!skipEagle && t === TX) return true;
      }
    }
    return false;
  }

  /** Snap coordinate to nearest TILE grid so turning works cleanly. */
  private gridSnap(v: number, origin: number): number {
    const rel = v - origin - HALF;
    const snapped = Math.round(rel / TILE) * TILE;
    return snapped + origin + HALF;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.gameOverFlag || this.stageClearFlag) {
      if (!this.overlayShown) {
        this.overlayShown = true;
        this.time.delayedCall(1500, () => this.showOverlay());
      }
      return;
    }

    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updateBullets(delta);
    this.updateEnemySpawn(delta);
    this.updateHUD();
    this.checkStageClear();
  }

  // ── Player update ─────────────────────────────────────────────────────────
  private updatePlayer(delta: number): void {
    if (!this.playerAlive) {
      this.playerRespawnTimer -= delta;
      if (this.playerRespawnTimer <= 0 && this.playerLives > 0) {
        this.spawnPlayer(false);
      }
      return;
    }

    // Invincibility tick
    if (this.playerInvTimer > 0) {
      this.playerInvTimer -= delta;
      // Blink
      const vis = Math.floor(this.playerInvTimer / 150) % 2 === 0;
      this.player.setTexture(vis ? 'tank_player_inv' : 'tank_player');
      if (this.playerInvTimer <= 0) {
        this.playerInvTimer = 0;
        this.player.setTexture('tank_player');
      }
    }

    if (this.playerBulletCooldown > 0) this.playerBulletCooldown -= delta;

    // Direction input
    const up    = this.cursors.up.isDown    || this.wKey.isDown;
    const down  = this.cursors.down.isDown  || this.sKey.isDown;
    const left  = this.cursors.left.isDown  || this.aKey.isDown;
    const right = this.cursors.right.isDown || this.dKey.isDown;

    let wantDir: Dir | null = null;
    if (up)    wantDir = 0;
    if (right) wantDir = 1;
    if (down)  wantDir = 2;
    if (left)  wantDir = 3;

    const moving = wantDir !== null;

    if (moving) {
      const newDir = wantDir as Dir;

      // Turn: snap axis perpendicular to new dir before changing
      let nx = this.player.x;
      let ny = this.player.y;
      if (newDir !== this.playerDir) {
        if (newDir === 0 || newDir === 2) nx = this.gridSnap(nx, OX); // vertical move → snap X
        if (newDir === 1 || newDir === 3) ny = this.gridSnap(ny, OY); // horizontal → snap Y
      }
      this.playerDir = newDir;
      this.player.setAngle(DANG[this.playerDir]);

      const speed = PLAYER_SPEED * delta / 1000;
      nx = Phaser.Math.Clamp(nx + DX[this.playerDir] * speed, OX + HALF, OX + MAP_W - HALF);
      ny = Phaser.Math.Clamp(ny + DY[this.playerDir] * speed, OY + HALF, OY + MAP_H - HALF);

      if (!this.wouldCollide(nx, ny)) {
        this.player.setPosition(nx, ny);
      }
    }

    // Shoot
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      if (!this.playerBulletActive && this.playerBulletCooldown <= 0) {
        this.fireBullet(this.player, this.playerDir, 'player');
        this.playerBulletActive = true;
        this.playerBulletCooldown = 300;
      }
    }
  }

  // ── Enemy update ──────────────────────────────────────────────────────────
  private updateEnemies(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Move
      e.moveTimer -= delta;
      if (e.moveTimer <= 0) {
        e.moveTimer = 600 + Math.random() * 1400;
        // Pick a new random direction (bias toward player)
        this.pickEnemyDir(e);
      }

      const speed = e.speed * delta / 1000;
      let nx = e.sprite.x + DX[e.dir] * speed;
      let ny = e.sprite.y + DY[e.dir] * speed;

      // Clamp to map
      nx = Phaser.Math.Clamp(nx, OX + HALF, OX + MAP_W - HALF);
      ny = Phaser.Math.Clamp(ny, OY + HALF, OY + MAP_H - HALF);

      if (this.wouldCollide(nx, ny, true)) {
        // Bounce off walls
        e.moveTimer = 0; // pick new dir next frame
      } else {
        e.sprite.setPosition(nx, ny);
      }

      // Shoot
      e.shootTimer -= delta;
      if (e.shootTimer <= 0) {
        const { shootMin, shootMax } = this.stageCfg;
        e.shootTimer = shootMin + Math.random() * (shootMax - shootMin);
        this.fireBullet(e.sprite, e.dir, 'enemy');
      }

      // Flash when hit
      if (e.flashTimer > 0) {
        e.flashTimer -= delta;
        e.sprite.setAlpha(Math.floor(e.flashTimer / 80) % 2 === 0 ? 1 : 0.3);
        if (e.flashTimer <= 0) e.sprite.setAlpha(1);
      }
    }
  }

  private pickEnemyDir(e: EnemyState): void {
    // 30% chance to aim toward player
    if (this.playerAlive && Math.random() < 0.3) {
      const dx = this.player.x - e.sprite.x;
      const dy = this.player.y - e.sprite.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        e.dir = dx > 0 ? 1 : 3;
      } else {
        e.dir = dy > 0 ? 2 : 0;
      }
    } else {
      e.dir = Math.floor(Math.random() * 4) as Dir;
    }
    e.sprite.setAngle(DANG[e.dir]);
  }

  // ── Bullet update ─────────────────────────────────────────────────────────
  private updateBullets(delta: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const spr = b.sprite;
      const bx = spr.x;
      const by = spr.y;

      // Off-screen check
      if (bx < OX || bx > OX + MAP_W || by < OY || by > OY + MAP_H) {
        spr.destroy();
        this.bullets.splice(i, 1);
        if (b.owner === 'player') this.playerBulletActive = false;
        continue;
      }

      // Tile collision
      const tc = Math.floor((bx - OX) / TILE);
      const tr = Math.floor((by - OY) / TILE);
      if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
        const tile = this.tileMap[tr][tc];
        if (tile === TB) {
          this.destroyTile(tr, tc);
          this.spawnHitParticles(bx, by, 0xcc6633);
          spr.destroy();
          this.bullets.splice(i, 1);
          if (b.owner === 'player') this.playerBulletActive = false;
          continue;
        } else if (tile === TS) {
          this.spawnHitParticles(bx, by, 0xaabbcc);
          spr.destroy();
          this.bullets.splice(i, 1);
          if (b.owner === 'player') this.playerBulletActive = false;
          continue;
        } else if (tile === TX) {
          // Eagle hit!
          this.destroyEagle();
          spr.destroy();
          this.bullets.splice(i, 1);
          if (b.owner === 'player') this.playerBulletActive = false;
          continue;
        }
      }

      // Tank collision
      if (b.owner === 'enemy' && this.playerAlive && this.playerInvTimer <= 0) {
        const dist = Phaser.Math.Distance.Between(bx, by, this.player.x, this.player.y);
        if (dist < HALF - 4) {
          this.hitPlayer();
          spr.destroy();
          this.bullets.splice(i, 1);
          continue;
        }
      }

      if (b.owner === 'player') {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dist = Phaser.Math.Distance.Between(bx, by, e.sprite.x, e.sprite.y);
          if (dist < HALF - 4) {
            this.hitEnemy(j);
            spr.destroy();
            this.bullets.splice(i, 1);
            this.playerBulletActive = false;
            break;
          }
        }
      }
    }
  }

  // ── Enemy spawn timer ─────────────────────────────────────────────────────
  private updateEnemySpawn(delta: number): void {
    const remaining = this.totalEnemies - this.enemiesDefeated - this.enemies.length;
    if (remaining <= 0) return;
    this.enemySpawnTimer -= delta;
    if (this.enemySpawnTimer <= 0) {
      this.enemySpawnTimer = this.stageCfg.spawnInterval;
      this.spawnEnemy();
    }
  }

  // ── Tile destruction ──────────────────────────────────────────────────────
  private destroyTile(row: number, col: number): void {
    this.tileMap[row][col] = TE;
    // Redraw only the affected tile area
    const px = OX + col * TILE;
    const py = OY + row * TILE;
    this.mapGfx.fillStyle(0x2a2a2a);
    this.mapGfx.fillRect(px, py, TILE, TILE);
    // (We redraw the whole map periodically or just clear that tile)
  }

  private destroyEagle(): void {
    if (!this.eagleAlive) return;
    this.eagleAlive = false;

    // Mark tiles as empty
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.tileMap[r][c] === TX) this.tileMap[r][c] = TE;
      }
    }

    if (this.eagleSprite) {
      this.spawnExplosion(this.eagleSprite.x, this.eagleSprite.y, 60, 0xffaa00);
      this.tweens.add({
        targets: this.eagleSprite,
        alpha: 0,
        angle: 180,
        scaleX: 0,
        scaleY: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => this.eagleSprite?.destroy(),
      });
    }

    this.cameras.main.shake(400, 0.012);
    this.gameOverFlag = true;
  }

  // ── Hit player ────────────────────────────────────────────────────────────
  private hitPlayer(): void {
    if (!this.playerAlive || this.playerInvTimer > 0) return;
    this.spawnExplosion(this.player.x, this.player.y, 40, 0xffcc44);
    this.cameras.main.shake(250, 0.008);
    this.playerAlive = false;
    this.playerLives--;
    this.player.setAlpha(0);

    if (this.playerLives <= 0) {
      this.gameOverFlag = true;
    } else {
      this.playerRespawnTimer = 2000;
    }
  }

  // ── Hit enemy ─────────────────────────────────────────────────────────────
  private hitEnemy(idx: number): void {
    const e = this.enemies[idx];
    e.health--;
    if (e.health <= 0) {
      const ex = e.sprite.x;
      const ey = e.sprite.y;
      this.spawnExplosion(ex, ey, 44, 0xff8833);
      this.cameras.main.shake(150, 0.005);
      e.sprite.destroy();
      this.enemies.splice(idx, 1);
      this.enemiesDefeated++;
      this.score += ENEMY_TYPES[e.type].score;

      // Score pop
      const pop = this.add.text(ex, ey - 10,
        `+${ENEMY_TYPES[e.type].score}`,
        { fontFamily: 'monospace', fontSize: '14px', color: '#ffff88' }
      ).setDepth(10).setOrigin(0.5);
      this.tweens.add({
        targets: pop,
        y: pop.y - 30,
        alpha: 0,
        duration: 800,
        ease: 'Power1',
        onComplete: () => pop.destroy(),
      });
    } else {
      e.flashTimer = 300;
    }
  }

  // ── Check stage clear ─────────────────────────────────────────────────────
  private checkStageClear(): void {
    const remaining = this.totalEnemies - this.enemiesDefeated;
    if (remaining <= 0 && this.enemies.length === 0) {
      this.stageClearFlag = true;
    }
  }

  // ── Particles (Phaser 3.60+ API) ──────────────────────────────────────────
  private spawnExplosion(x: number, y: number, size: number, color: number): void {
    const e = this.add.particles(x, y, 'particle', {
      speed:    { min: size * 2, max: size * 5 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.2, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 500,
      stopAfter: 14,
      tint:     [color],
    }).setDepth(5);
    this.time.delayedCall(700, () => e.destroy());
  }

  private spawnHitParticles(x: number, y: number, color: number): void {
    const e = this.add.particles(x, y, 'particle', {
      speed:    { min: 60, max: 160 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 0.8, end: 0 },
      alpha:    { start: 1, end: 0 },
      lifespan: 300,
      stopAfter: 6,
      tint:     [color],
    }).setDepth(5);
    this.time.delayedCall(400, () => e.destroy());
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  private showOverlay(): void {
    const cx = OX + MAP_W / 2;
    const cy = OY + MAP_H / 2;

    const isLastStage = this.currentStage >= STAGE_CONFIGS.length;

    // Dim
    const dim = this.add.graphics().setDepth(1000);
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(OX, OY, MAP_W, MAP_H);

    if (this.stageClearFlag && !this.gameOverFlag) {
      const headline = isLastStage ? 'YOU WIN!' : 'STAGE CLEAR!';
      const t = this.add.text(cx, cy - 50, headline, {
        fontFamily: 'monospace', fontSize: '40px', color: '#ffff44', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1001).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 400, ease: 'Power2' });

      if (!isLastStage) {
        this.add.text(cx, cy + 5, `STAGE ${this.currentStage} COMPLETE`, {
          fontFamily: 'monospace', fontSize: '18px', color: '#aaffaa',
        }).setOrigin(0.5).setDepth(1001);
      }

      this.add.text(cx, cy + 35, `SCORE: ${this.score}`, {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(1001);

      const promptLabel = isLastStage
        ? '[ PRESS SPACE TO PLAY AGAIN ]'
        : `[ PRESS SPACE FOR STAGE ${this.currentStage + 1} ]`;
      const restart = this.add.text(cx, cy + 76, promptLabel, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffff88',
      }).setOrigin(0.5).setDepth(1001);
      this.tweens.add({ targets: restart, alpha: { from: 1, to: 0.3 }, yoyo: true, repeat: -1, duration: 600 });

      const advance = () => {
        if (isLastStage) {
          // Restart from stage 1
          this.scene.start('GameScene', { stage: 1, score: 0, lives: 3 });
        } else {
          // Advance to next stage, carry score + lives
          this.scene.start('GameScene', {
            stage: this.currentStage + 1,
            score: this.score,
            lives: this.playerLives,
          });
        }
      };
      this.input.keyboard!.once('keydown-SPACE', advance);
      this.input.keyboard!.once('keydown-ENTER', advance);

    } else {
      const t = this.add.text(cx, cy - 50, 'GAME OVER', {
        fontFamily: 'monospace', fontSize: '44px', color: '#ff4444', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1001).setAlpha(0);
      this.add.text(cx, cy + 20, `SCORE: ${this.score}`, {
        fontFamily: 'monospace', fontSize: '24px', color: '#aaaaaa',
      }).setOrigin(0.5).setDepth(1001);
      this.tweens.add({ targets: t, alpha: 1, duration: 400 });

      const restart = this.add.text(cx, cy + 70, '[ PRESS SPACE TO PLAY AGAIN ]', {
        fontFamily: 'monospace', fontSize: '18px', color: '#cccccc',
      }).setOrigin(0.5).setDepth(1001);
      this.tweens.add({ targets: restart, alpha: { from: 1, to: 0.3 }, yoyo: true, repeat: -1, duration: 600 });

      this.input.keyboard!.once('keydown-SPACE', () => {
        this.scene.start('GameScene', { stage: 1, score: 0, lives: 3 });
      });
      this.input.keyboard!.once('keydown-ENTER', () => {
        this.scene.start('GameScene', { stage: 1, score: 0, lives: 3 });
      });
    }
  }
}
