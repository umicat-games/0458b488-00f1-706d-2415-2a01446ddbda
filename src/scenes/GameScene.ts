import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Constants ──────────────────────────────────────────────────────────────────
const ZOOM    = 1.4;                               // camera zoom
const EW      = Math.round(GAME_WIDTH  / ZOOM);   // effective world width  ≈ 914
const EH      = Math.round(GAME_HEIGHT / ZOOM);   // effective world height ≈ 514

const SCROLL  = 428;    // world scroll speed px/s  (1.5× original 285)
const VSPEED  = 428;    // vertical speed px/s       (same → exact 45°)
const ARROW_X = 220;    // fixed world X for the arrow
const OBS_W   = 44;     // obstacle width in world-px
const LEVEL_L = 16200;  // total level length in world-px  (3× original 5400)
const NUM_OBS = 35;     // obstacle columns across the level
const TRAIL_L = 150;    // trail line length in world-px

interface ObsBlock {
  gfx:    Phaser.GameObjects.Graphics;
  worldX: number;
  cy:     number;
  h:      number;
}

export class GameScene extends Phaser.Scene {
  private levelX  = 0;
  private arrowY  = EH / 2;
  private goingUp = false;
  private dead    = false;

  private trailGfx!: Phaser.GameObjects.Graphics;
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private obs:       ObsBlock[] = [];

  private space!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'GameScene' }); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  init(): void {
    this.levelX  = 0;
    this.arrowY  = EH / 2;
    this.goingUp = false;
    this.dead    = false;
    this.obs     = [];
  }

  create(): void {
    this.cameras.main.setZoom(ZOOM);   // zoom in — all objects live in EW × EH world space
    this.paintBG();
    this.trailGfx = this.add.graphics().setDepth(2);
    this.arrowGfx = this.add.graphics().setDepth(3);
    this.buildLevel();
    this.space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.syncObs();
    this.paintArrow();
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private paintBG(): void {
    const g = this.add.graphics().setDepth(0);
    // gradient-style fill (4 corner colours)
    g.fillGradientStyle(0x050b18, 0x050b18, 0x0a1428, 0x0a1428, 1, 1, 1, 1);
    g.fillRect(0, 0, EW, EH);
    // faint grid
    g.lineStyle(1, 0x172640, 0.55);
    for (let y = 40; y < EH; y += 40) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(EW, y); g.strokePath();
    }
    // ceiling & floor accent rails
    g.lineStyle(3, 0x00cc66, 0.7);
    g.beginPath(); g.moveTo(0, 6);       g.lineTo(EW, 6);       g.strokePath();
    g.beginPath(); g.moveTo(0, EH - 6);  g.lineTo(EW, EH - 6);  g.strokePath();
  }

  // ── Level ──────────────────────────────────────────────────────────────────
  private buildLevel(): void {
    const H = EH;   // 514 — effective play area height
    type S = { t: number; b: number };

    // 10 distinct obstacle patterns, cycled across all 35 columns
    const patterns: S[][] = [
      [{ t: 0,          b: 142 }],
      [{ t: H - 138,    b: H   }],
      [{ t: H / 2 - 46, b: H / 2 + 46 }],
      [{ t: 0,          b: 122 }, { t: H - 122, b: H }],
      [{ t: H * 0.56,   b: H * 0.56 + 86 }],
      [{ t: H * 0.27,   b: H * 0.27 + 90 }],
      [{ t: 0,          b: 166 }],
      [{ t: H - 162,    b: H   }],
      [{ t: 0,          b: 102 }, { t: H / 2 - 38, b: H / 2 + 38 }],
      [{ t: H * 0.38,   b: H * 0.38 + 108 }],
    ];

    // evenly space NUM_OBS columns from worldX=820 to end of level
    const gap = Math.round((LEVEL_L - 820 - 600) / (NUM_OBS - 1));

    for (let i = 0; i < NUM_OBS; i++) {
      const worldX = 820 + i * gap;
      const pattern = patterns[i % patterns.length];
      for (const { t, b } of pattern) {
        const h = b - t;
        const gfx = this.add.graphics().setDepth(2);
        this.paintObsGfx(gfx, h);
        this.obs.push({ gfx, worldX, cy: t + h / 2, h });
      }
    }
  }

  private paintObsGfx(g: Phaser.GameObjects.Graphics, h: number): void {
    const hw = OBS_W / 2, hh = h / 2;
    // soft glow halo
    g.fillStyle(0xff5500, 0.14);
    g.fillRect(-hw - 8, -hh - 8, OBS_W + 16, h + 16);
    // layered body
    g.fillStyle(0xbb2800, 1); g.fillRect(-hw,      -hh, OBS_W,      h);
    g.fillStyle(0xee4400, 1); g.fillRect(-hw + 7,  -hh, OBS_W - 14, h);
    g.fillStyle(0xff7733, 0.5); g.fillRect(-hw + 15, -hh, 10,         h);
    // border
    g.lineStyle(2, 0xff9966, 1); g.strokeRect(-hw, -hh, OBS_W, h);
    // warning chevrons on approaching (left) face
    const steps = Math.max(1, Math.floor(h / 40));
    for (let s = 0; s < steps; s++) {
      const ty = -hh + 20 + s * 40;
      g.fillStyle(0xffcc00, 0.88);
      g.fillTriangle(-hw, ty - 7, -hw, ty + 7, -hw + 11, ty);
    }
  }

  // ── Arrow ──────────────────────────────────────────────────────────────────
  private paintArrow(): void {
    this.arrowGfx.clear();
    const x = ARROW_X, y = this.arrowY;
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const px = -dy, py = dx;
    const HW   = 12;
    const tailX = x - dx * 28, tailY = y - dy * 28;
    const tipX  = x + dx * 17, tipY  = y + dy * 17;

    // outer glow ring
    this.arrowGfx.fillStyle(0x00ff88, 0.1);
    this.arrowGfx.fillCircle(x, y, 34);

    // shaft glow
    this.arrowGfx.lineStyle(18, 0x00ff88, 0.18);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY); this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();

    // shaft body (green)
    this.arrowGfx.lineStyle(8, 0x00ee77, 1);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY); this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();

    // shaft highlight
    this.arrowGfx.lineStyle(2, 0xaaffcc, 0.65);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tailX + px * 2.5, tailY + py * 2.5);
    this.arrowGfx.lineTo(x     + px * 2.5, y     + py * 2.5);
    this.arrowGfx.strokePath();

    // head glow
    this.arrowGfx.fillStyle(0x0066cc, 0.3);
    this.arrowGfx.fillTriangle(tipX + dx * 5, tipY + dy * 5, x + px * (HW + 5), y + py * (HW + 5), x - px * (HW + 5), y - py * (HW + 5));

    // head (blue)
    this.arrowGfx.fillStyle(0x0099ff, 1);
    this.arrowGfx.fillTriangle(tipX, tipY, x + px * HW, y + py * HW, x - px * HW, y - py * HW);

    // head sheen
    this.arrowGfx.fillStyle(0x77ddff, 0.55);
    this.arrowGfx.fillTriangle(tipX, tipY, x + px * (HW * 0.4), y + py * (HW * 0.4), x + px * 1.5 + dx * 6, y + py * 1.5 + dy * 6);
  }

  // ── Trail — straight 45° streak from the arrow ─────────────────────────────
  private paintTrail(): void {
    this.trailGfx.clear();
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);   // forward direction
    const STEPS = 22;

    for (let i = 0; i < STEPS; i++) {
      const t     = i / STEPS;                         // 0 = at arrow, 1 = tail end
      const alpha = Math.pow(1 - t, 1.4) * 0.9;
      const size  = (1 - t) * 9 + 1.5;
      const cx    = ARROW_X - dx * TRAIL_L * t;        // extend BACKWARD
      const cy    = this.arrowY - dy * TRAIL_L * t;
      // glow
      this.trailGfx.fillStyle(0x00ff88, alpha * 0.22);
      this.trailGfx.fillCircle(cx, cy, size + 5);
      // bright core
      this.trailGfx.fillStyle(0x66ff99, alpha);
      this.trailGfx.fillCircle(cx, cy, size);
    }
  }

  // ── Obstacles ─────────────────────────────────────────────────────────────
  private syncObs(): void {
    for (const o of this.obs)
      o.gfx.setPosition(o.worldX - this.levelX + ARROW_X, o.cy);
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  private checkHits(): boolean {
    const r = 10;
    for (const o of this.obs) {
      const sx = o.worldX - this.levelX + ARROW_X;
      if (ARROW_X + r > sx - OBS_W / 2 && ARROW_X - r < sx + OBS_W / 2 &&
          this.arrowY + r > o.cy - o.h / 2 && this.arrowY - r < o.cy + o.h / 2)
        return true;
    }
    return false;
  }

  // ── Die ────────────────────────────────────────────────────────────────────
  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.arrowGfx.clear();
    this.trailGfx.clear();

    const ex = this.add.graphics().setDepth(10);
    ex.fillStyle(0xff4400, 0.9); ex.fillCircle(ARROW_X, this.arrowY, 22);
    ex.fillStyle(0xffcc00, 0.75); ex.fillCircle(ARROW_X, this.arrowY, 11);
    this.tweens.add({ targets: ex, alpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 420, onComplete: () => ex.destroy() });

    const pct = Math.min(100, Math.round((this.levelX / LEVEL_L) * 100));
    this.time.delayedCall(460, () => this.showDeathUI(pct, false));
  }

  // ── Death UI (coordinates in EW × EH world space — zoom takes care of scale)
  private showDeathUI(pct: number, win: boolean): void {
    const cx = EW / 2, cy = EH / 2;
    const pw = 370, ph = 254;
    const px = cx - pw / 2, py = cy - ph / 2;

    // dimmer
    const dim = this.add.rectangle(cx, cy, EW, EH, 0x000000, 0.7).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });

    // panel
    const panel = this.add.graphics().setDepth(201).setAlpha(0);
    panel.fillStyle(0x060d1a, 1);
    panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(2.5, 0x00ff88, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(1, 0x00ff88, 0.28);
    panel.strokeRoundedRect(px + 4, py + 4, pw - 8, ph - 8, 11);
    this.tweens.add({ targets: panel, alpha: 1, duration: 280, ease: 'Power2' });

    // ── % at TOP of panel ────────────────────────────────────────────────────
    const pctTxt = this.add.text(cx, py + 34, `${pct}%`, {
      fontFamily: 'sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#00ff88',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    const subLbl = this.add.text(cx, py + 75, 'COMPLETED', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#33bb77',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    const divGfx = this.add.graphics().setDepth(202).setAlpha(0);
    divGfx.lineStyle(1, 0x00ff88, 0.28);
    divGfx.beginPath(); divGfx.moveTo(px + 26, py + 92); divGfx.lineTo(px + pw - 26, py + 92); divGfx.strokePath();

    const statusTxt = this.add.text(cx, py + 110, win ? 'LEVEL COMPLETE!' : 'LEVEL FAILED', {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: win ? '#00ff88' : '#ff5533',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    this.tweens.add({ targets: [pctTxt, subLbl, divGfx, statusTxt], alpha: 1, duration: 280, delay: 100 });

    // ── RESTART button — middle of panel ─────────────────────────────────────
    const bw = 176, bh = 52;
    const bcy = py + ph / 2 + 42;

    const btnGfx = this.add.graphics().setDepth(202).setAlpha(0);
    const drawBtn = (hover: boolean): void => {
      btnGfx.clear();
      btnGfx.fillStyle(hover ? 0x00cc55 : 0x008f3c, 1);
      btnGfx.fillRoundedRect(cx - bw / 2, bcy - bh / 2, bw, bh, 11);
      btnGfx.lineStyle(2, 0x00ff88, 1);
      btnGfx.strokeRoundedRect(cx - bw / 2, bcy - bh / 2, bw, bh, 11);
    };
    drawBtn(false);

    const btnTxt = this.add.text(cx, bcy, 'RESTART', {
      fontFamily: 'sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203).setAlpha(0);

    const hintTxt = this.add.text(cx, bcy + bh / 2 + 13, 'or press SPACE', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#337755',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    this.tweens.add({ targets: [btnGfx, btnTxt, hintTxt], alpha: 1, duration: 280, delay: 200 });

    const hit = this.add.rectangle(cx, bcy, bw, bh, 0x000000, 0)
      .setDepth(204).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { drawBtn(true);  this.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.05, scaleY: 1.05, duration: 80 }); });
    hit.on('pointerout',  () => { drawBtn(false); this.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.0,  scaleY: 1.0,  duration: 80 }); });
    hit.on('pointerdown', () => this.scene.restart());

    this.time.delayedCall(500, () => {
      this.input.keyboard!.once('keydown-SPACE', () => this.scene.restart());
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.dead) return;
    const dt = delta / 1000;

    this.levelX += SCROLL * dt;
    if (this.levelX >= LEVEL_L) {
      this.dead = true;
      this.showDeathUI(100, true);
      return;
    }

    this.goingUp = this.space.isDown;
    this.arrowY += (this.goingUp ? -1 : 1) * VSPEED * dt;

    // touching the ceiling or floor kills
    if (this.arrowY < 10 || this.arrowY > EH - 10) { this.die(); return; }

    this.syncObs();
    if (this.checkHits()) { this.die(); return; }

    this.paintTrail();
    this.paintArrow();
  }
}
