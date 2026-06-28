import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Tunables ───────────────────────────────────────────────────────────────────
const SCROLL  = 285;    // world scroll speed px/s
const VSPEED  = 285;    // vertical speed px/s (same → true 45°)
const ARROW_X = 220;    // fixed screen X
const OBS_W   = 44;     // obstacle width px
const LEVEL_L = 5400;   // total level length world-px
const TRAIL_N = 90;     // trail history size

interface ObsBlock {
  gfx:    Phaser.GameObjects.Graphics;
  worldX: number;
  cy:     number;
  h:      number;
}

export class GameScene extends Phaser.Scene {
  private levelX  = 0;
  private arrowY  = GAME_HEIGHT / 2;
  private goingUp = false;
  private dead    = false;

  private trailGfx!: Phaser.GameObjects.Graphics;
  private arrowGfx!: Phaser.GameObjects.Graphics;
  private obs:   ObsBlock[] = [];
  private trail: Array<{ x: number; y: number }> = [];

  private space!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'GameScene' }); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  init(): void {
    this.levelX  = 0;
    this.arrowY  = GAME_HEIGHT / 2;
    this.goingUp = false;
    this.dead    = false;
    this.trail   = [];
    this.obs     = [];
  }

  create(): void {
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
    g.fillGradientStyle(0x050b18, 0x050b18, 0x0a1428, 0x0a1428, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, 0x172640, 0.55);
    for (let y = 60; y < GAME_HEIGHT; y += 60) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(GAME_WIDTH, y); g.strokePath();
    }
    g.lineStyle(3, 0x00cc66, 0.7);
    g.beginPath(); g.moveTo(0, 7); g.lineTo(GAME_WIDTH, 7); g.strokePath();
    g.beginPath(); g.moveTo(0, GAME_HEIGHT - 7); g.lineTo(GAME_WIDTH, GAME_HEIGHT - 7); g.strokePath();
  }

  // ── Level ──────────────────────────────────────────────────────────────────
  private buildLevel(): void {
    const H = GAME_HEIGHT;
    type S = { t: number; b: number };
    const cols: S[][] = [
      [{ t: 0,          b: 165 }],
      [{ t: H - 160,    b: H }],
      [{ t: H / 2 - 55, b: H / 2 + 55 }],
      [{ t: 0,          b: 145 }, { t: H - 145, b: H }],
      [{ t: H * 0.55,   b: H * 0.55 + 100 }],
      [{ t: H * 0.27,   b: H * 0.27 + 108 }],
      [{ t: 0,          b: 195 }],
      [{ t: H - 190,    b: H }],
      [{ t: 0,          b: 120 }, { t: H / 2 - 45, b: H / 2 + 45 }],
      [{ t: H * 0.38,   b: H * 0.38 + 128 }],
    ];
    cols.forEach((col, i) => {
      const worldX = 820 + i * 430;
      col.forEach(({ t, b }) => {
        const h = b - t;
        const gfx = this.add.graphics().setDepth(2);
        this.paintObsGfx(gfx, h);
        this.obs.push({ gfx, worldX, cy: t + h / 2, h });
      });
    });
  }

  private paintObsGfx(g: Phaser.GameObjects.Graphics, h: number): void {
    const hw = OBS_W / 2, hh = h / 2;
    g.fillStyle(0xff5500, 0.14);
    g.fillRect(-hw - 8, -hh - 8, OBS_W + 16, h + 16);
    g.fillStyle(0xbb2800, 1); g.fillRect(-hw,      -hh, OBS_W,      h);
    g.fillStyle(0xee4400, 1); g.fillRect(-hw + 7,  -hh, OBS_W - 14, h);
    g.fillStyle(0xff7733, 0.5); g.fillRect(-hw + 15, -hh, 10, h);
    g.lineStyle(2, 0xff9966, 1); g.strokeRect(-hw, -hh, OBS_W, h);
    const steps = Math.max(1, Math.floor(h / 44));
    for (let s = 0; s < steps; s++) {
      const ty = -hh + 22 + s * 44;
      g.fillStyle(0xffcc00, 0.88);
      g.fillTriangle(-hw, ty - 8, -hw, ty + 8, -hw + 12, ty);
    }
  }

  // ── Arrow ──────────────────────────────────────────────────────────────────
  private paintArrow(): void {
    this.arrowGfx.clear();
    const x = ARROW_X, y = this.arrowY;
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const px = -dy, py = dx;

    const tailX = x - dx * 28, tailY = y - dy * 28;
    const HW = 12;
    const tipX = x + dx * 17, tipY = y + dy * 17;

    // outer glow
    this.arrowGfx.fillStyle(0x00ff88, 0.1);
    this.arrowGfx.fillCircle(x, y, 34);

    // shaft glow
    this.arrowGfx.lineStyle(18, 0x00ff88, 0.18);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY);
    this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();

    // shaft (green)
    this.arrowGfx.lineStyle(8, 0x00ee77, 1);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY);
    this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();

    // shaft highlight
    this.arrowGfx.lineStyle(2, 0xaaffcc, 0.65);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tailX + px * 2.5, tailY + py * 2.5);
    this.arrowGfx.lineTo(x + px * 2.5, y + py * 2.5);
    this.arrowGfx.strokePath();

    // head glow (blue halo)
    this.arrowGfx.fillStyle(0x0066cc, 0.3);
    this.arrowGfx.fillTriangle(
      tipX + dx * 5, tipY + dy * 5,
      x + px * (HW + 5), y + py * (HW + 5),
      x - px * (HW + 5), y - py * (HW + 5)
    );

    // head (blue)
    this.arrowGfx.fillStyle(0x0099ff, 1);
    this.arrowGfx.fillTriangle(
      tipX, tipY,
      x + px * HW, y + py * HW,
      x - px * HW, y - py * HW
    );

    // head sheen
    this.arrowGfx.fillStyle(0x77ddff, 0.55);
    this.arrowGfx.fillTriangle(
      tipX, tipY,
      x + px * (HW * 0.4), y + py * (HW * 0.4),
      x + px * 1.5 + dx * 6, y + py * 1.5 + dy * 6
    );
  }

  // ── Trail ──────────────────────────────────────────────────────────────────
  private paintTrail(): void {
    this.trailGfx.clear();
    const n = this.trail.length;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const age   = i / n;
      const alpha = Math.pow(1 - age, 1.4) * 0.92;
      const thick = (1 - age) * 9 + 1.5;
      const ax = this.trail[i - 1].x, ay = this.trail[i - 1].y;
      const bx = this.trail[i].x,     by = this.trail[i].y;
      this.trailGfx.lineStyle(thick + 8, 0x00ff88, alpha * 0.2);
      this.trailGfx.beginPath(); this.trailGfx.moveTo(ax, ay); this.trailGfx.lineTo(bx, by); this.trailGfx.strokePath();
      this.trailGfx.lineStyle(thick, 0x44ff88, alpha);
      this.trailGfx.beginPath(); this.trailGfx.moveTo(ax, ay); this.trailGfx.lineTo(bx, by); this.trailGfx.strokePath();
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

    // explosion
    const ex = this.add.graphics().setDepth(10);
    ex.fillStyle(0xff4400, 0.9); ex.fillCircle(ARROW_X, this.arrowY, 22);
    ex.fillStyle(0xffcc00, 0.75); ex.fillCircle(ARROW_X, this.arrowY, 11);
    this.tweens.add({ targets: ex, alpha: 0, scaleX: 2.8, scaleY: 2.8, duration: 420, onComplete: () => ex.destroy() });

    const pct = Math.min(100, Math.round((this.levelX / LEVEL_L) * 100));
    this.time.delayedCall(460, () => this.showDeathUI(pct, false));
  }

  // ── Death UI ───────────────────────────────────────────────────────────────
  private showDeathUI(pct: number, win: boolean): void {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const pw = 500, ph = 330;
    const px = cx - pw / 2, py = cy - ph / 2;

    // dim
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });

    // panel
    const panel = this.add.graphics().setDepth(201).setAlpha(0);
    panel.fillStyle(0x060d1a, 1);
    panel.fillRoundedRect(px, py, pw, ph, 20);
    panel.lineStyle(3, 0x00ff88, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 20);
    panel.lineStyle(1, 0x00ff88, 0.28);
    panel.strokeRoundedRect(px + 5, py + 5, pw - 10, ph - 10, 15);
    this.tweens.add({ targets: panel, alpha: 1, duration: 280, ease: 'Power2' });

    // ── % at TOP of panel ────────────────────────────────────────────────────
    const pctTxt = this.add.text(cx, py + 46, `${pct}%`, {
      fontFamily: 'sans-serif', fontSize: '60px', fontStyle: 'bold', color: '#00ff88',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    const subLbl = this.add.text(cx, py + 100, 'COMPLETED', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#33bb77',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    const divGfx = this.add.graphics().setDepth(202).setAlpha(0);
    divGfx.lineStyle(1, 0x00ff88, 0.28);
    divGfx.beginPath(); divGfx.moveTo(px + 36, py + 122); divGfx.lineTo(px + pw - 36, py + 122); divGfx.strokePath();

    const statusTxt = this.add.text(cx, py + 152, win ? 'LEVEL COMPLETE!' : 'LEVEL FAILED', {
      fontFamily: 'sans-serif', fontSize: '21px', fontStyle: 'bold',
      color: win ? '#00ff88' : '#ff5533',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    this.tweens.add({ targets: [pctTxt, subLbl, divGfx, statusTxt], alpha: 1, duration: 280, delay: 100 });

    // ── Restart button — MIDDLE of panel ────────────────────────────────────
    const bw = 234, bh = 72;
    const bcy = py + ph / 2 + 52;

    const btnGfx = this.add.graphics().setDepth(202).setAlpha(0);
    const drawBtn = (hover: boolean): void => {
      btnGfx.clear();
      btnGfx.fillStyle(hover ? 0x00cc55 : 0x008f3c, 1);
      btnGfx.fillRoundedRect(cx - bw / 2, bcy - bh / 2, bw, bh, 14);
      btnGfx.lineStyle(2.5, 0x00ff88, 1);
      btnGfx.strokeRoundedRect(cx - bw / 2, bcy - bh / 2, bw, bh, 14);
    };
    drawBtn(false);

    const btnTxt = this.add.text(cx, bcy, 'RESTART', {
      fontFamily: 'sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203).setAlpha(0);

    const hintTxt = this.add.text(cx, bcy + bh / 2 + 18, 'or press SPACE', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#337755',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);

    this.tweens.add({ targets: [btnGfx, btnTxt, hintTxt], alpha: 1, duration: 280, delay: 200 });

    const hit = this.add.rectangle(cx, bcy, bw, bh, 0x000000, 0)
      .setDepth(204).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { drawBtn(true);  this.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.04, scaleY: 1.04, duration: 80 }); });
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

    if (this.arrowY < 10 || this.arrowY > GAME_HEIGHT - 10) { this.die(); return; }

    this.syncObs();
    if (this.checkHits()) { this.die(); return; }

    this.trail.unshift({ x: ARROW_X, y: this.arrowY });
    if (this.trail.length > TRAIL_N) this.trail.pop();

    this.paintTrail();
    this.paintArrow();
  }
}
