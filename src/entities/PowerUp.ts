import { CANVAS_HEIGHT, POWERUP_DURATION, POWERUP_FALL_SPEED, POWERUP_SIZE } from '../constants';
import { PowerUpType, type Rect } from '../types';

export const PADDLE_MODIFIER_POWERUPS = new Set<PowerUpType>([
  PowerUpType.WidePaddle,
  PowerUpType.NarrowPaddle,
  PowerUpType.LaserPaddle,
  PowerUpType.StickyPaddle,
]);

export const TIMED_BALL_POWERUPS = new Set<PowerUpType>([
  PowerUpType.SlowBall,
  PowerUpType.FastBall,
  PowerUpType.Fireball,
]);

export const INSTANT_POWERUPS = new Set<PowerUpType>([
  PowerUpType.MultiBall,
  PowerUpType.ExtraLife,
]);

const POWERUP_COLORS: Record<PowerUpType, string> = {
  [PowerUpType.MultiBall]: '#38bdf8',
  [PowerUpType.WidePaddle]: '#22c55e',
  [PowerUpType.LaserPaddle]: '#ef4444',
  [PowerUpType.SlowBall]: '#a78bfa',
  [PowerUpType.Fireball]: '#fb923c',
  [PowerUpType.StickyPaddle]: '#65a30d',
  [PowerUpType.ExtraLife]: '#facc15',
  [PowerUpType.NarrowPaddle]: '#94a3b8',
  [PowerUpType.FastBall]: '#14b8a6',
};

const ICON_COLOR = '#f8fafc';
const ICON_SHADOW = 'rgba(15, 23, 42, 0.35)';

export function isPaddleModifierPowerUp(type: PowerUpType): boolean {
  return PADDLE_MODIFIER_POWERUPS.has(type);
}

export function isTimedBallPowerUp(type: PowerUpType): boolean {
  return TIMED_BALL_POWERUPS.has(type);
}

export function isInstantPowerUp(type: PowerUpType): boolean {
  return INSTANT_POWERUPS.has(type);
}

export function getPowerUpDuration(type: PowerUpType): number {
  return isInstantPowerUp(type) ? 0 : POWERUP_DURATION;
}

export class PowerUp {
  active = true;

  constructor(
    public x: number,
    public y: number,
    readonly type: PowerUpType,
  ) {
  }

  get rect(): Rect {
    const halfSize = POWERUP_SIZE / 2;

    return {
      x: this.x - halfSize,
      y: this.y - halfSize,
      width: POWERUP_SIZE,
      height: POWERUP_SIZE,
    };
  }

  update(dt: number): void {
    this.y += POWERUP_FALL_SPEED * dt;

    if (this.y - POWERUP_SIZE / 2 > CANVAS_HEIGHT) {
      this.active = false;
    }
  }

  collect(): PowerUpType {
    this.active = false;
    return this.type;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) {
      return;
    }

    const radius = POWERUP_SIZE / 2;
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.06;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = POWERUP_COLORS[this.type];
    ctx.shadowBlur = 14;
    ctx.fillStyle = POWERUP_COLORS[this.type];
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(-radius * 0.3, -radius * 0.35, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowColor = ICON_SHADOW;
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = ICON_COLOR;
    ctx.strokeStyle = ICON_COLOR;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawIcon(ctx);
    ctx.restore();
  }

  private drawIcon(ctx: CanvasRenderingContext2D): void {
    switch (this.type) {
      case PowerUpType.MultiBall:
        this.drawMultiBallIcon(ctx);
        break;
      case PowerUpType.WidePaddle:
        this.drawPaddleIcon(ctx, 16);
        break;
      case PowerUpType.NarrowPaddle:
        this.drawPaddleIcon(ctx, 9);
        break;
      case PowerUpType.LaserPaddle:
        this.drawLaserIcon(ctx);
        break;
      case PowerUpType.SlowBall:
        this.drawSpeedIcon(ctx, false);
        break;
      case PowerUpType.FastBall:
        this.drawSpeedIcon(ctx, true);
        break;
      case PowerUpType.Fireball:
        this.drawFireballIcon(ctx);
        break;
      case PowerUpType.StickyPaddle:
        this.drawStickyIcon(ctx);
        break;
      case PowerUpType.ExtraLife:
        this.drawHeartIcon(ctx);
        break;
    }
  }

  private drawMultiBallIcon(ctx: CanvasRenderingContext2D): void {
    ctx.shadowBlur = 0;
    ctx.fillStyle = ICON_COLOR;
    for (const [x, y, radius] of [[-5, 2, 3.5], [0, -4, 3], [6, 3, 2.8]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPaddleIcon(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.fillRect(-width / 2, 4, width, 3.5);
    ctx.beginPath();
    ctx.arc(0, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.lineTo(-width / 2 - 3, -3);
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2 + 3, -3);
    ctx.stroke();
  }

  private drawLaserIcon(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.lineTo(-2, -7);
    ctx.moveTo(4, 7);
    ctx.lineTo(2, -7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSpeedIcon(ctx: CanvasRenderingContext2D, fast: boolean): void {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();

    ctx.beginPath();
    if (fast) {
      ctx.moveTo(4, -5);
      ctx.lineTo(9, -5);
      ctx.lineTo(6, -9);
    } else {
      ctx.moveTo(-4, -5);
      ctx.lineTo(-9, -5);
      ctx.lineTo(-6, -9);
    }
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fast ? 4 : -4, -3);
    ctx.stroke();
  }

  private drawFireballIcon(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(1, -9);
    ctx.bezierCurveTo(8, -3, 7, 7, 0, 9);
    ctx.bezierCurveTo(-7, 6, -6, -1, -2, -4);
    ctx.bezierCurveTo(-1, -1, 2, -1, 1, -9);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.arc(1, 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStickyIcon(ctx: CanvasRenderingContext2D): void {
    ctx.shadowBlur = 0;
    ctx.fillStyle = ICON_COLOR;
    ctx.beginPath();
    ctx.arc(-4, -1, 4.5, 0, Math.PI * 2);
    ctx.arc(2, -3, 5, 0, Math.PI * 2);
    ctx.arc(5, 3, 4.5, 0, Math.PI * 2);
    ctx.arc(-3, 5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    for (const [x, y, radius] of [[-3, -2, 1.2], [4, 2, 1.4], [0, 5, 1]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHeartIcon(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-8, 2, -9, -5, -4, -7);
    ctx.bezierCurveTo(-1, -9, 0, -5, 0, -5);
    ctx.bezierCurveTo(0, -5, 1, -9, 4, -7);
    ctx.bezierCurveTo(9, -5, 8, 2, 0, 8);
    ctx.fill();
  }
}