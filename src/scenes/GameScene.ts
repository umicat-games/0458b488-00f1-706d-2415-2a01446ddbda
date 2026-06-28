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
const LEVEL_L    = 16200;
const NUM_OBS    = 35;
const TRAIL_CAP  = 400;  // max trail history points (≈ 6 s at 60 fps)
const MTN_B      = 10;   // pixel-art mountain block size

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
  // Trail: world-space position history  { wx = levelX at that frame, wy = arrowY }
  private trailPts:   Array<{ wx: number; wy: number }> = [];

  private space!:    Phaser.Input.Keyboard.Key;
  private escKey!:   Phaser.Input.Keyboard.Key;
  private paused    = false;
  private pauseObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'GameScene' }); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  init(): void {
    this.levelX  = 0;
    this.arrowY  = EH / 2;
    this.goingUp = false;
    this.dead    = false;
    this.obs      = [];
    this.trailPts = [];
    this.paused   = false;
    this.pauseObjs = [];
  }

  create(): void {
    this.cameras.main.setZoom(ZOOM);
    this.paintSky();
    this.buildMountains();
    this.trailGfx = this.add.graphics().setDepth(2);
    this.arrowGfx = this.add.graphics().setDepth(3);
    this.buildLevel();
    this.space  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
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
    const GAP_H = 82;  // narrow single gap per wall — one route only

    // Explicitly designed gap-centre fractions for all 35 walls.
    // Adjacent gaps are always ≤ ~110 px apart (well within 45° reach of ~435 px).
    // Every wall has exactly ONE passable opening — no alternate routes.
    const gapFracs = [
      0.50, 0.36, 0.22, 0.32, 0.50,  // walls  0–4   (start centre → high → low → centre)
      0.68, 0.78, 0.65, 0.50, 0.34,  // walls  5–9   (dive low)
      0.22, 0.30, 0.48, 0.68, 0.80,  // walls 10–14  (shoot high → deep low)
      0.65, 0.50, 0.34, 0.22, 0.32,  // walls 15–19  (recover → high)
      0.50, 0.68, 0.80, 0.66, 0.50,  // walls 20–24  (sweep low)
      0.34, 0.22, 0.30, 0.48, 0.68,  // walls 25–29  (rise high)
      0.80, 0.65, 0.48, 0.30, 0.50,  // walls 30–34  (final dive → centre finish)
    ];

    const wallSpacing = Math.round((LEVEL_L - 820 - 600) / (NUM_OBS - 1));

    for (let i = 0; i < NUM_OBS; i++) {
      const wx     = 820 + i * wallSpacing;
      const gapCY  = Math.round(H * gapFracs[i]);
      const gapTop = Math.max(12, gapCY - GAP_H / 2);
      const gapBot = Math.min(H - 12, gapTop + GAP_H);

      // Top block (above the gap)
      if (gapTop > 12) {
        const h   = gapTop;
        const gfx = this.add.graphics().setDepth(2);
        this.paintWall(gfx, h);
        this.obs.push({ gfx, worldX: wx, cy: h / 2, h, hw: OBS_W / 2 });
      }

      // Bottom block (below the gap)
      const botH = H - gapBot;
      if (botH > 12) {
        const gfx = this.add.graphics().setDepth(2);
        this.paintWall(gfx, botH);
        this.obs.push({ gfx, worldX: wx, cy: gapBot + botH / 2, h: botH, hw: OBS_W / 2 });
      }

      // One spike cluster mid-gap: floor spikes when path goes up, ceiling spikes when path goes down.
      // Placed far from the intended 45° trajectory so they only punish wrong-height flying.
      if (i < NUM_OBS - 1) {
        const sx        = wx + Math.round(wallSpacing * 0.5);
        const nextFrac  = gapFracs[i + 1];
        if (nextFrac <= gapFracs[i]) {
          this.addSpikes(sx, H - SPK_H / 2, 'up',   2);   // floor spikes — path goes up
        } else {
          this.addSpikes(sx, SPK_H / 2,     'down', 2);   // ceiling spikes — path goes down
        }
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

  // ── Arrow (shorter body + symmetrical fish-tail) ───────────────────────────
  private paintArrow(): void {
    this.arrowGfx.clear();
    const x = ARROW_X, y = this.arrowY;
    const rad = Phaser.Math.DegToRad(this.goingUp ? -45 : 45);
    const dx = Math.cos(rad), dy = Math.sin(rad);
    const apx = -dy, apy = dx;   // perpendicular (arrow-local left)
    const HW   = 10;
    const tbx  = x - dx * 8, tby  = y - dy * 8;    // tail base — short stub
    const tipX = x + dx * 12, tipY = y + dy * 12;  // arrowhead tip

    // Halo glow
    this.arrowGfx.fillStyle(0x00ff88, 0.1);
    this.arrowGfx.fillCircle(x, y, 26);

    // Shaft — glow pass
    this.arrowGfx.lineStyle(14, 0x00ff88, 0.18);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tbx, tby); this.arrowGfx.lineTo(x, y);
    this.arrowGfx.strokePath();

    // Shaft — solid
    this.arrowGfx.lineStyle(7, 0x00ee77, 1);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tbx, tby); this.arrowGfx.lineTo(x, y);
    this.arrowGfx.strokePath();

    // Shaft — highlight streak
    this.arrowGfx.lineStyle(1.5, 0xaaffcc, 0.65);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tbx + apx * 2, tby + apy * 2);
    this.arrowGfx.lineTo(x   + apx * 2, y   + apy * 2);
    this.arrowGfx.strokePath();

    // Arrowhead — outer glow
    this.arrowGfx.fillStyle(0x0066cc, 0.3);
    this.arrowGfx.fillTriangle(tipX + dx * 4, tipY + dy * 4, x + apx * (HW + 4), y + apy * (HW + 4), x - apx * (HW + 4), y - apy * (HW + 4));
    // Arrowhead — solid
    this.arrowGfx.fillStyle(0x0099ff, 1);
    this.arrowGfx.fillTriangle(tipX, tipY, x + apx * HW, y + apy * HW, x - apx * HW, y - apy * HW);
    // Arrowhead — highlight streak
    this.arrowGfx.fillStyle(0x77ddff, 0.55);
    this.arrowGfx.fillTriangle(tipX, tipY, x + apx * (HW * 0.4), y + apy * (HW * 0.4), x + apx * 1.5 + dx * 5, y + apy * 1.5 + dy * 5);

    // ── Fish tail — two symmetrical forked prongs meeting at a V-notch ────────
    // prong tips: finBack units behind tailBase, spread finSpread laterally
    // notch:      notchBack units behind tailBase (less than finBack → V opens outward)
    const finBack   = 5;
    const finSpread = 5;
    const notchBack = 2;
    const shW       = 3;   // shaft half-width at tailBase

    const ubX = tbx + apx * shW,                          ubY = tby + apy * shW;   // upper shaft edge
    const lbX = tbx - apx * shW,                          lbY = tby - apy * shW;   // lower shaft edge
    const utX = tbx - dx * finBack + apx * finSpread,     utY = tby - dy * finBack + apy * finSpread;  // upper prong tip
    const ltX = tbx - dx * finBack - apx * finSpread,     ltY = tby - dy * finBack - apy * finSpread;  // lower prong tip
    const nvX = tbx - dx * notchBack,                     nvY = tby - dy * notchBack;                  // V-notch apex

    // Tail — solid fill (both fins)
    this.arrowGfx.fillStyle(0x00dd66, 1);
    this.arrowGfx.fillTriangle(ubX, ubY, utX, utY, nvX, nvY);
    this.arrowGfx.fillTriangle(lbX, lbY, ltX, ltY, nvX, nvY);

    // Tail — highlight on upper fin
    this.arrowGfx.fillStyle(0x44ffaa, 0.35);
    this.arrowGfx.fillTriangle(ubX, ubY, utX, utY, nvX, nvY);

    // Tail — outline
    this.arrowGfx.lineStyle(1.5, 0x44ffaa, 0.9);
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(ubX, ubY);
    this.arrowGfx.lineTo(utX, utY);
    this.arrowGfx.lineTo(nvX, nvY);
    this.arrowGfx.lineTo(ltX, ltY);
    this.arrowGfx.lineTo(lbX, lbY);
    this.arrowGfx.strokePath();
  }

  // ── Trail — persistent solid path following the arrow ─────────────────────
  // Records the arrow's world position every frame and draws it as a solid
  // connected line that scrolls with the level (never fades, never ends).
  private paintTrail(): void {
    // Record current position
    this.trailPts.push({ wx: this.levelX, wy: this.arrowY });
    if (this.trailPts.length > TRAIL_CAP) this.trailPts.shift();

    this.trailGfx.clear();
    const n = this.trailPts.length;
    if (n < 2) return;

    // Map a stored world point → current screen position
    const sx = (wx: number) => wx - this.levelX + ARROW_X;

    // Glow pass (wide, soft)
    this.trailGfx.lineStyle(18, 0x00ff88, 0.22);
    this.trailGfx.beginPath();
    this.trailGfx.moveTo(sx(this.trailPts[0].wx), this.trailPts[0].wy);
    for (let i = 1; i < n; i++)
      this.trailGfx.lineTo(sx(this.trailPts[i].wx), this.trailPts[i].wy);
    this.trailGfx.strokePath();

    // Core pass (solid bright green)
    this.trailGfx.lineStyle(5, 0x44ff88, 1);
    this.trailGfx.beginPath();
    this.trailGfx.moveTo(sx(this.trailPts[0].wx), this.trailPts[0].wy);
    for (let i = 1; i < n; i++)
      this.trailGfx.lineTo(sx(this.trailPts[i].wx), this.trailPts[i].wy);
    this.trailGfx.strokePath();
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

  // ── Pause ──────────────────────────────────────────────────────────────────
  private togglePause(): void {
    if (this.paused) {
      this.paused = false;
      for (const o of this.pauseObjs) o.destroy();
      this.pauseObjs = [];
    } else {
      this.paused = true;
      this.showPauseUI();
    }
  }

  private showPauseUI(): void {
    const cx  = EW / 2, cy = EH / 2;
    const pw  = 320,    ph = 238;
    const pL  = cx - pw / 2;          // panel left edge
    const pT  = cy - ph / 2;          // panel top edge

    // Dim overlay
    const dim = this.add.rectangle(cx, cy, EW, EH, 0x000000, 0.62)
      .setDepth(200).setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 1, duration: 200 });
    this.pauseObjs.push(dim);

    // Panel
    const panelGfx = this.add.graphics().setDepth(201).setAlpha(0);
    panelGfx.fillStyle(0x060d1a, 1);
    panelGfx.fillRoundedRect(pL, pT, pw, ph, 14);
    panelGfx.lineStyle(2.5, 0x00ff88, 1);
    panelGfx.strokeRoundedRect(pL, pT, pw, ph, 14);
    panelGfx.lineStyle(1, 0x00ff88, 0.28);
    panelGfx.strokeRoundedRect(pL + 4, pT + 4, pw - 8, ph - 8, 11);
    this.tweens.add({ targets: panelGfx, alpha: 1, duration: 200 });
    this.pauseObjs.push(panelGfx);

    // Title
    const titleTxt = this.add.text(cx, pT + 44, 'PAUSED', {
      fontFamily: 'sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#00ff88',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);
    this.tweens.add({ targets: titleTxt, alpha: 1, duration: 200, delay: 60 });
    this.pauseObjs.push(titleTxt);

    // Divider
    const divGfx = this.add.graphics().setDepth(202).setAlpha(0);
    divGfx.lineStyle(1, 0x00ff88, 0.28);
    divGfx.beginPath();
    divGfx.moveTo(pL + 24, pT + 78); divGfx.lineTo(pL + pw - 24, pT + 78);
    divGfx.strokePath();
    this.tweens.add({ targets: divGfx, alpha: 1, duration: 200, delay: 60 });
    this.pauseObjs.push(divGfx);

    const bw = 210, bh = 46;

    // ── RESUME button ──
    const resumeY = pT + 120;
    const resumeGfx = this.add.graphics().setDepth(202).setAlpha(0);
    const drawResume = (hover: boolean): void => {
      resumeGfx.clear();
      resumeGfx.fillStyle(hover ? 0x00cc55 : 0x008f3c, 1);
      resumeGfx.fillRoundedRect(cx - bw / 2, resumeY - bh / 2, bw, bh, 10);
      resumeGfx.lineStyle(2, 0x00ff88, 1);
      resumeGfx.strokeRoundedRect(cx - bw / 2, resumeY - bh / 2, bw, bh, 10);
    };
    drawResume(false);
    this.tweens.add({ targets: resumeGfx, alpha: 1, duration: 200, delay: 100 });
    this.pauseObjs.push(resumeGfx);

    const resumeTxt = this.add.text(cx, resumeY, 'RESUME', {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203).setAlpha(0);
    this.tweens.add({ targets: resumeTxt, alpha: 1, duration: 200, delay: 100 });
    this.pauseObjs.push(resumeTxt);

    const resumeHit = this.add.rectangle(cx, resumeY, bw, bh, 0x000000, 0)
      .setDepth(204).setInteractive({ useHandCursor: true });
    resumeHit.on('pointerover', () => drawResume(true));
    resumeHit.on('pointerout',  () => drawResume(false));
    resumeHit.on('pointerdown', () => this.togglePause());
    this.pauseObjs.push(resumeHit);

    // ── RESTART button ──
    const restartY = resumeY + bh + 12;
    const restartGfx = this.add.graphics().setDepth(202).setAlpha(0);
    const drawRestart = (hover: boolean): void => {
      restartGfx.clear();
      restartGfx.fillStyle(hover ? 0x884400 : 0x553300, 1);
      restartGfx.fillRoundedRect(cx - bw / 2, restartY - bh / 2, bw, bh, 10);
      restartGfx.lineStyle(2, 0xff8844, 0.8);
      restartGfx.strokeRoundedRect(cx - bw / 2, restartY - bh / 2, bw, bh, 10);
    };
    drawRestart(false);
    this.tweens.add({ targets: restartGfx, alpha: 1, duration: 200, delay: 130 });
    this.pauseObjs.push(restartGfx);

    const restartTxt = this.add.text(cx, restartY, 'RESTART', {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffaa66',
    }).setOrigin(0.5).setDepth(203).setAlpha(0);
    this.tweens.add({ targets: restartTxt, alpha: 1, duration: 200, delay: 130 });
    this.pauseObjs.push(restartTxt);

    const restartHit = this.add.rectangle(cx, restartY, bw, bh, 0x000000, 0)
      .setDepth(204).setInteractive({ useHandCursor: true });
    restartHit.on('pointerover', () => drawRestart(true));
    restartHit.on('pointerout',  () => drawRestart(false));
    restartHit.on('pointerdown', () => this.scene.restart());
    this.pauseObjs.push(restartHit);

    // Hint text
    const hintTxt = this.add.text(cx, restartY + bh / 2 + 14, 'press ESC to resume', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#337755',
    }).setOrigin(0.5).setDepth(202).setAlpha(0);
    this.tweens.add({ targets: hintTxt, alpha: 1, duration: 200, delay: 160 });
    this.pauseObjs.push(hintTxt);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    // ESC toggles pause (only when playing)
    if (Phaser.Input.Keyboard.JustDown(this.escKey) && !this.dead) {
      this.togglePause();
      return;
    }
    if (this.dead || this.paused) return;
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
