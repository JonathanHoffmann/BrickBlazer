import { CANVAS_HEIGHT, CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT, PLAYFIELD_BOTTOM_Y } from '../constants';
import type { Ball } from '../entities/Ball';
import type { Brick } from '../entities/Brick';
import type { Laser } from '../entities/Laser';
import type { Paddle } from '../entities/Paddle';
import type { PowerUp } from '../entities/PowerUp';
import { PowerUpType } from '../types';

const HUD_PANEL_RADIUS = 8;

const HUD_POWERUP_LABELS: Record<PowerUpType, string> = {
  [PowerUpType.MultiBall]: 'Multi Ball',
  [PowerUpType.WidePaddle]: 'Wide Paddle',
  [PowerUpType.LaserPaddle]: 'Laser Paddle',
  [PowerUpType.SlowBall]: 'Slow Ball',
  [PowerUpType.Fireball]: 'Fireball',
  [PowerUpType.StickyPaddle]: 'Sticky Paddle',
  [PowerUpType.ExtraLife]: 'Extra Life',
  [PowerUpType.NarrowPaddle]: 'Narrow Paddle',
  [PowerUpType.FastBall]: 'Fast Ball',
};

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class Renderer {
  clear(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#101624';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawBricks(ctx: CanvasRenderingContext2D, bricks: readonly Brick[]): void {
    for (const brick of bricks) {
      brick.render(ctx);
    }
  }

  drawLavaZone(ctx: CanvasRenderingContext2D): void {
    const lavaHeight = CANVAS_HEIGHT - PLAYFIELD_BOTTOM_Y;

    ctx.save();
    const gradient = ctx.createLinearGradient(0, PLAYFIELD_BOTTOM_Y, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#fb923c');
    gradient.addColorStop(0.58, '#f97316');
    gradient.addColorStop(1, '#c2410c');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, PLAYFIELD_BOTTOM_Y + 12);

    for (let x = 0; x <= CANVAS_WIDTH + 24; x += 24) {
      const controlY = PLAYFIELD_BOTTOM_Y + (x % 48 === 0 ? 0 : 22);
      ctx.quadraticCurveTo(x + 12, controlY, x + 24, PLAYFIELD_BOTTOM_Y + 12);
    }

    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 237, 213, 0.58)';
    for (const bubble of [
      { x: 42, y: 46, radius: 3 },
      { x: 118, y: 28, radius: 2 },
      { x: 204, y: 52, radius: 4 },
      { x: 316, y: 34, radius: 3 },
      { x: 396, y: 48, radius: 2 },
    ]) {
      ctx.beginPath();
      ctx.arc(bubble.x, PLAYFIELD_BOTTOM_Y + bubble.y, bubble.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle, options: { sticky?: boolean; laser?: boolean } = {}): void {
    paddle.render(ctx, options);
  }

  drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
    ball.render(ctx);
  }

  drawBalls(ctx: CanvasRenderingContext2D, balls: readonly Ball[]): void {
    for (const ball of balls) {
      this.drawBall(ctx, ball);
    }
  }

  drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: readonly PowerUp[]): void {
    for (const powerUp of powerUps) {
      powerUp.render(ctx);
    }
  }

  drawLasers(ctx: CanvasRenderingContext2D, lasers: readonly Laser[]): void {
    for (const laser of lasers) {
      laser.render(ctx);
    }
  }

  drawHUD(
    ctx: CanvasRenderingContext2D,
    score: number,
    lives: number,
    level: number,
    combo: number,
    activePowerUp: PowerUpType | null,
  ): void {
    ctx.save();

    this.drawHudBackplate(ctx);
    this.drawHudStat(ctx, 12, 8, 138, 'SCORE', score.toLocaleString(), '#38bdf8');
    this.drawHudStat(ctx, CANVAS_WIDTH / 2 - 58, 8, 116, 'LEVEL', `${level}`, '#facc15', true);
    this.drawLivesHudStat(ctx, CANVAS_WIDTH - 148, 8, 100, lives);

    if (combo > 1 || activePowerUp) {
      const comboText = combo > 1 ? `Combo x${combo}` : '';
      const powerUpText = activePowerUp ? HUD_POWERUP_LABELS[activePowerUp] : '';
      this.drawHudStatusChip(ctx, [comboText, powerUpText].filter(Boolean).join('  |  '));
    }

    ctx.restore();
  }

  private drawHudBackplate(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT);
    gradient.addColorStop(0, '#451a2b');
    gradient.addColorStop(0.46, '#7f1d1d');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT);

    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    for (let x = -72; x < CANVAS_WIDTH + 72; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, GAME_TOP_BAR_HEIGHT);
      ctx.lineTo(x + 58, 0);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    const bottomGlow = ctx.createLinearGradient(0, GAME_TOP_BAR_HEIGHT - 4, CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT - 4);
    bottomGlow.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    bottomGlow.addColorStop(0.5, 'rgba(250, 204, 21, 0.95)');
    bottomGlow.addColorStop(1, 'rgba(248, 113, 113, 0.25)');
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, GAME_TOP_BAR_HEIGHT - 4, CANVAS_WIDTH, 3);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.46)';
    ctx.fillRect(0, GAME_TOP_BAR_HEIGHT - 1, CANVAS_WIDTH, 1);
  }

  private drawHudStat(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    accentColor: string,
    centered = false,
  ): void {
    const height = 38;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, HUD_PANEL_RADIUS);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 5, 4, height - 10, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(248, 250, 252, 0.64)';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = centered ? 'center' : 'left';
    const textX = centered ? x + width / 2 : x + 16;
    ctx.fillText(label, textX, y + 6);

    ctx.fillStyle = '#f8fafc';
    ctx.font = centered ? '800 20px system-ui, sans-serif' : '800 17px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, textX, y + 30);
    ctx.restore();
  }

  private drawLivesHudStat(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, lives: number): void {
    this.drawHudStat(ctx, x, y, width, 'LIVES', '', '#fb7185');

    ctx.save();
    if (lives <= 5) {
      for (let index = 0; index < lives; index += 1) {
        this.drawHeart(ctx, x + 18 + index * 17, y + 27, 5.3);
      }
    } else {
      this.drawHeart(ctx, x + 22, y + 27, 5.8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`x${lives}`, x + 36, y + 31);
    }
    ctx.restore();
  }

  private drawHeart(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    ctx.save();
    ctx.fillStyle = '#fb7185';
    ctx.shadowColor = 'rgba(251, 113, 133, 0.7)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + size);
    ctx.bezierCurveTo(centerX - size * 1.8, centerY - size * 0.2, centerX - size * 1.05, centerY - size * 1.5, centerX, centerY - size * 0.6);
    ctx.bezierCurveTo(centerX + size * 1.05, centerY - size * 1.5, centerX + size * 1.8, centerY - size * 0.2, centerX, centerY + size);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawHudStatusChip(ctx: CanvasRenderingContext2D, text: string): void {
    ctx.save();
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const width = Math.min(Math.max(ctx.measureText(text).width + 28, 96), CANVAS_WIDTH - 24);
    const x = CANVAS_WIDTH / 2 - width / 2;
    const y = 50;
    const height = 16;

    ctx.fillStyle = 'rgba(8, 13, 24, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.74)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#bae6fd';
    ctx.fillText(text, CANVAS_WIDTH / 2, y + height / 2 + 0.5, width - 14);
    ctx.restore();
  }

  drawParticles(ctx: CanvasRenderingContext2D, particles: readonly Particle[]): void {
    ctx.save();

    for (const particle of particles) {
      const alpha = Math.max(particle.life / particle.maxLife, 0);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }

    ctx.restore();
  }
}