import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// ── Constants ──────────────────────────────────────────────────────────────────
const ZOOM    = 1.4;
const EW      = Math.round(GAME_WIDTH  / ZOOM);   // ≈ 914
const EH      = Math.round(GAME_HEIGHT / ZOOM);   // ≈ 514

const SCROLL  = 428;
const VSPEED  = 428;
const ARROW_X = Math.round(EW / 2);   // ≈ 457 — horizontally centred
const OBS_W   = 44;
const SPK_W   = 26;   // single spike width
const SPK_H   = 50;   // single spike height
const LEVEL_L = 16200;
const NUM_OBS = 35;
const TRAIL_L = 150;
const MTN_B   = 10;   // pixel-art mountain block size

interface ObsBlock {
  gfx:   Phaser.GameObjects.Graphics;
  worldX: number;
  cy:     number;
  h:      number;
  hw:     number;   // half-width for AABB
}

export class GameScene extends Phaser.Scene {
  private levelX  = 0;
  private arrowY  = EH / 2;
  private goingUp = false;
  private dead    = false;

  private trailGfx!:  Phaser.GameObjects.Graphics;
  private arrowGfx!:  Phaser.GameObjects.Graphics;
  private farMtns!:   Phaser.GameObjects.Graphics;
  private nearMtns!:  Phaser.GameObjects.Graphics;
  private obs:        ObsBlock[] = [];

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
    this.cameras.main.setZoom(ZOOM);
    this.paintSky();
    this.buildMountains();
    this.trailGfx = this.add.graphics().setDepth(2);
    this.arrowGfx = this.add.graphics().setDepth(3);
    this.buildLevel();
    this.space = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.syncObs();
    this.paintArrow();
  }

  // ── Sky ────────────────────────────────────────────────────────────────────
  private paintSky(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(0x050b18, 0x050b18, 0x0a1428, 0x0a1428, 1, 1, 1, 1);
    g.fillRect(0, 0, EW, EH);

    // pixel-art square stars (seeded so they're consistent every run)
    const rng = new Phaser.Math.RandomDataGenerator(['wave-dodge-stars-v1']);
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 60; i++) {
      const sx = rng.integerInRange(0, EW - 2);
      const sy = rng.integerInRange(0, Math.round(EH * 0.72));
      const sz = rng.pick([1, 1, 1, 2]);
      g.fillRect(sx, sy, sz, sz);
    }

    // ceiling & floor accent rails
    g.lineStyle(3, 0x00cc66, 0.7);
    g.beginPath(); g.moveTo(0, 6);      g.lineTo(EW, 6);      g.strokePath();
    g.beginPath(); g.moveTo(0, EH - 6); g.lineTo(EW, EH - 6); g.strokePath();
  }

  // ── Pixel-art mountains ────────────────────────────────────────────────────
  private buildMountains(): void {
    const B = MTN_B;

    // Far layer — drawn 3× wide for seamless parallax wrap
    this.farMtns = this.add.graphics().setDepth(1);
    for (let rep = 0; rep < 3; rep++) {
      const ox = rep * EW;
      this.pixelMtn(this.farMtns, ox +   0, 0.84, [3,4,5,6,7,8,9,10,11,10,9,8,7,6,5,4,3], B, 0x1a1040);
      this.pixelMtn(this.farMtns, ox + 175, 0.84, [2,3,5,7,9,11,12,11,9,7,5,3,2],         B, 0x1a1040);
      this.pixelMtn(this.farMtns, ox + 340, 0.84, [3,5,7,9,11,13,14,13,11,9,7,5,3],       B, 0x1a1040);
      this.pixelMtn(this.farMtns, ox + 510, 0.84, [2,4,6,8,10,11,10,8,6,4,2],             B, 0x1a1040);
      this.pixelMtn(this.farMtns, ox + 660, 0.84, [3,5,8,11,13,11,8,5,3],                 B, 0x1a1040);
      this.pixelMtn(this.farMtns, ox + 800, 0.84, [2,4,6,8,9,8,6,4,2],                   B, 0x1a1040);
    }

    // Near layer — taller, darker, faster parallax
    this.nearMtns = this.add.graphics().setDepth(1);
    for (let rep = 0; rep < 3; rep++) {
      const ox = rep * EW;
      this.pixelMtn(this.nearMtns, ox +   0, 0.92, [4,7,11,15,20,24,27,24,20,15,11,7,4], B, 0x0c1828);
      this.pixelMtn(this.nearMtns, ox + 200, 0.92, [3,6,10,16,22,28,31,28,22,16,10,6,3], B, 0x0c1828);
      this.pixelMtn(this.nearMtns, ox + 410, 0.92, [5,9,14,20,26,32,34,32,26,20,14,9,5], B, 0x0c1828);
      this.pixelMtn(this.nearMtns, ox + 620, 0.92, [4,8,13,18,24,28,30,28,24,18,13,8,4], B, 0x0c1828);
      this.pixelMtn(this.nearMtns, ox + 800, 0.92, [5,8,12,18,22,26,22,18,12,8,5],       B, 0x0c1828);
    }
  }

  /** Draw a pixel-art mountain silhouette that fills down to EH. */
  private pixelMtn(
    g: Phaser.GameObjects.Graphics,
    ox: number, baseYFrac: number,
    heights: number[], B: number, color: number,
  ): void {
    const baseY = Math.round(EH * baseYFrac);
    g.fillStyle(color, 1);
    for (let i = 0; i < heights.length; i++) {
      const peakY = baseY - heights[i] * B;
      if (peakY < EH) g.fillRect(ox + i * B, peakY, B, EH - peakY);
    }
  }

  // ── Level builder ──────────────────────────────────────────────────────────
  private buildLevel(): void {
    const H = EH;
    type S = { t: number; b: number };

    const wallPats: S[][] = [
      [{ t: 0,          b: 140 }],
      [{ t: H - 135,    b: H   }],
      [{ t: H / 2 - 44, b: H / 2 + 44 }],
      [{ t: 0,          b: 120 }, { t: H - 120, b: H }],
      [{ t: H * 0.56,   b: H * 0.56 + 84 }],
      [{ t: H * 0.27,   b: H * 0.27 + 88 }],
      [{ t: 0,          b: 162 }],
      [{ t: H - 158,    b: H   }],
      [{ t: 0,          b: 100 }, { t: H / 2 - 36, b: H / 2 + 36 }],
      [{ t: H * 0.38,   b: H * 0.38 + 104 }],
    ];

    const gap = Math.round((LEVEL_L - 820 - 600) / (NUM_OBS - 1));

    // Wall obstacles
    for (let i = 0; i < NUM_OBS; i++) {
      const wx = 820 + i * gap;
      for (const { t, b } of wallPats[i % wallPats.length]) {
        const h = b - t;
        const gfx = this.add.graphics().setDepth(2);
        this.paintWall(gfx, h);
        this.obs.push({ gfx, worldX: wx, cy: t + h / 2, h, hw: OBS_W / 2 });
      }
    }

    // Spike clusters between every wall pair — makes the game significantly harder
    for (let i = 0; i < NUM_OBS - 1; i++) {
      const base = 820 + i * gap;
      const wx1  = base + Math.round(gap * 0.33);
      const wx2  = base + Math.round(gap * 0.66);

      switch (i % 8) {
        case 0: this.addSpikes(wx1, H - SPK_H / 2, 'up',   3); break;
        case 1: this.addSpikes(wx1, SPK_H / 2,     'down', 3); break;
        case 2:
          this.addSpikes(wx1, H - SPK_H / 2,         'up',   2);
          this.addSpikes(wx2, SPK_H / 2,             'down', 2);
          break;
        case 3: this.addSpikes(wx2, Math.round(H * 0.65), 'up',   2); break;
        case 4:
          this.addSpikes(wx1, SPK_H / 2,             'down', 3);
          this.addSpikes(wx2, H - SPK_H / 2,         'up',   2);
          break;
        case 5: this.addSpikes(wx1, Math.round(H * 0.32), 'down', 2); break;
        case 6: this.addSpikes(wx2, H - SPK_H / 2,  'up',   3); break;
        case 7:
          this.addSpikes(wx1, H - SPK_H / 2,         'up',   2);
          this.addSpikes(wx2, Math.round(H * 0.35),  'down', 2);
          break;
      }
    }
  }

  /** Add a cluster of `count` spikes pointing up or down. */
  private addSpikes(worldX: number, cy: number, dir: 'up' | 'down', count: number): void {
    const gfx = this.add.graphics().setDepth(2);
    this.paintSpikes(gfx, count, dir);
    this.obs.push({ gfx, worldX, cy, h: SPK_H, hw: (count * SPK_W) / 2 });
  }

  // ── Wall graphics ──────────────────────────────────────────────────────────
  private paintWall(g: Phaser.GameObjects.Graphics, h: number): void {
    const hw = OBS_W / 2, hh = h / 2;
    g.fillStyle(0xff5500, 0.14);
    g.fillRect(-hw - 8, -hh - 8, OBS_W + 16, h + 16);
    g.fillStyle(0xbb2800, 1); g.fillRect(-hw,      -hh, OBS_W,      h);
    g.fillStyle(0xee4400, 1); g.fillRect(-hw + 7,  -hh, OBS_W - 14, h);
    g.fillStyle(0xff7733, 0.5); g.fillRect(-hw + 15, -hh, 10, h);
    g.lineStyle(2, 0xff9966, 1); g.strokeRect(-hw, -hh, OBS_W, h);
    const steps = Math.max(1, Math.floor(h / 40));
    for (let s = 0; s < steps; s++) {
      const ty = -hh + 20 + s * 40;
      g.fillStyle(0xffcc00, 0.88);
      g.fillTriangle(-hw, ty - 7, -hw, ty + 7, -hw + 11, ty);
    }
  }

  // ── Spike graphics ─────────────────────────────────────────────────────────
  private paintSpikes(g: Phaser.GameObjects.Graphics, count: number, dir: 'up' | 'down'): void {
    const SW = SPK_W, SH = SPK_H;
    const totalW = count * SW;
    const startX = -totalW / 2;

    for (let i = 0; i < count; i++) {
      const lx = startX + i * SW;   // left edge of this spike
      const cx = lx + SW / 2;       // centre X

      // Glow halo
      g.fillStyle(0x00ffcc, 0.14);
      if (dir === 'up') {
        g.fillTriangle(cx, -SH / 2 - 6, lx - 5, SH / 2 + 5, lx + SW + 5, SH / 2 + 5);
      } else {
        g.fillTriangle(cx, SH / 2 + 6, lx - 5, -SH / 2 - 5, lx + SW + 5, -SH / 2 - 5);
      }

      // Spike body (teal / cyan)
      g.fillStyle(0x00ccaa, 1);
      if (dir === 'up') {
        g.fillTriangle(cx, -SH / 2,  lx, SH / 2,  lx + SW, SH / 2);
      } else {
        g.fillTriangle(cx, SH / 2,   lx, -SH / 2, lx + SW, -SH / 2);
      }

      // Highlight streak (bright teal)
      g.fillStyle(0x77ffee, 0.55);
      if (dir === 'up') {
        g.fillTriangle(cx, -SH / 2, lx, SH / 2, cx - 2, SH / 2 - SH * 0.12);
      } else {
        g.fillTriangle(cx, SH / 2,  lx, -SH / 2, cx - 2, -SH / 2 + SH * 0.12);
      }

      // Thin edge outline
      g.lineStyle(1, 0x00ffee, 0.85);
      if (dir === 'up') {
        g.beginPath();
        g.moveTo(cx, -SH / 2); g.lineTo(lx, SH / 2);
        g.lineTo(lx + SW, SH / 2); g.closePath(); g.strokePath();
      } else {
        g.beginPath();
        g.moveTo(cx, SH / 2); g.lineTo(lx, -SH / 2);
        g.lineTo(lx + SW, -SH / 2); g.closePath(); g.strokePath();
      }
    }
  }

  // ── Arrow ──────────────────────────────────────────────────────────────────
  private paintArrow(): void {
    this.arrowGfx.clear();
    const x = ARROW_X, y = this.arrowY;
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const px = -dy, py = dx;
    const HW    = 12;
    const tailX = x - dx * 28, tailY = y - dy * 28;
    const tipX  = x + dx * 17, tipY  = y + dy * 17;

    this.arrowGfx.fillStyle(0x00ff88, 0.1);
    this.arrowGfx.fillCircle(x, y, 34);
    this.arrowGfx.lineStyle(18, 0x00ff88, 0.18);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY); this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();
    this.arrowGfx.lineStyle(8, 0x00ee77, 1);
    this.arrowGfx.beginPath(); this.arrowGfx.moveTo(tailX, tailY); this.arrowGfx.lineTo(x, y); this.arrowGfx.strokePath();
    this.arrowGfx.lineStyle(2, 0xaaffcc, 0.65);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tailX + px * 2.5, tailY + py * 2.5);
    this.arrowGfx.lineTo(x     + px * 2.5, y     + py * 2.5);
    this.arrowGfx.strokePath();
    this.arrowGfx.fillStyle(0x0066cc, 0.3);
    this.arrowGfx.fillTriangle(tipX + dx * 5, tipY + dy * 5, x + px * (HW + 5), y + py * (HW + 5), x - px * (HW + 5), y - py * (HW + 5));
    this.arrowGfx.fillStyle(0x0099ff, 1);
    this.arrowGfx.fillTriangle(tipX, tipY, x + px * HW, y + py * HW, x - px * HW, y - py * HW);
    this.arrowGfx.fillStyle(0x77ddff, 0.55);
    this.arrowGfx.fillTriangle(tipX, tipY, x + px * (HW * 0.4), y + py * (HW * 0.4), x + px * 1.5 + dx * 6, y + py * 1.5 + dy * 6);
  }

  // ── Trail — straight 45° streak ────────────────────────────────────────────
  private paintTrail(): void {
    this.trailGfx.clear();
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);
    for (let i = 0; i < 22; i++) {
      const t     = i / 22;
      const alpha = Math.pow(1 - t, 1.4) * 0.9;
      const size  = (1 - t) * 9 + 1.5;
      const cx    = ARROW_X - dx * TRAIL_L * t;
      const cy    = this.arrowY - dy * TRAIL_L * t;
      this.trailGfx.fillStyle(0x00ff88, alpha * 0.22);
      this.trailGfx.fillCircle(cx, cy, size + 5);
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
      if (ARROW_X + r > sx - o.hw && ARROW_X - r < sx + o.hw &&
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

  // ── Death UI ───────────────────────────────────────────────────────────────
  private showDeathUI(pct: number, win: boolean): void {
    const cx = EW / 2, cy = EH / 2;
    const pw = 370, ph = 254;
    const px = cx - pw / 2, py = cy - ph / 2;

    const dim = this.add.rectangle(cx, cy, EW, EH, 0x000000, 0.7).setDepth(200).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });

    const panel = this.add.graphics().setDepth(201).setAlpha(0);
    panel.fillStyle(0x060d1a, 1);
    panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(2.5, 0x00ff88, 1);
    panel.strokeRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(1, 0x00ff88, 0.28);
    panel.strokeRoundedRect(px + 4, py + 4, pw - 8, ph - 8, 11);
    this.tweens.add({ targets: panel, alpha: 1, duration: 280, ease: 'Power2' });

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

    // Parallax mountain scroll — far moves slower than near
    this.farMtns.setX( -(this.levelX * 0.12) % EW);
    this.nearMtns.setX(-(this.levelX * 0.28) % EW);

    this.goingUp = this.space.isDown;
    this.arrowY += (this.goingUp ? -1 : 1) * VSPEED * dt;

    if (this.arrowY < 10 || this.arrowY > EH - 10) { this.die(); return; }

    this.syncObs();
    if (this.checkHits()) { this.die(); return; }

    this.paintTrail();
    this.paintArrow();
  }
}
