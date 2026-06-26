import { CANVAS_WIDTH, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_WIDTH, PLAYFIELD_BOTTOM_Y } from '../constants';
import type { PaddleInputTarget, Rect } from '../types';

const PADDLE_LAVA_GAP = 12;
const PADDLE_Y = PLAYFIELD_BOTTOM_Y - PADDLE_HEIGHT - PADDLE_LAVA_GAP;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class Paddle {
  x = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
  y = PADDLE_Y;
  width = PADDLE_WIDTH;
  height = PADDLE_HEIGHT;
  speed = PADDLE_SPEED;

  get rect(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt: number, input: PaddleInputTarget | null): void {
    if (input === null) {
      return;
    }

    const targetX = clamp(input.x - this.width / 2, 0, CANVAS_WIDTH - this.width);

    if (input.immediate) {
      this.x = targetX;
      return;
    }

    const delta = targetX - this.x;
    const maxStep = this.speed * dt;

    if (Math.abs(delta) <= maxStep) {
      this.x = targetX;
      return;
    }

    this.x = clamp(this.x + Math.sign(delta) * maxStep, 0, CANVAS_WIDTH - this.width);
  }

  setWidth(width: number): void {
    const centerX = this.x + this.width / 2;

    this.width = clamp(width, PADDLE_WIDTH * 0.5, CANVAS_WIDTH);
    this.x = clamp(centerX - this.width / 2, 0, CANVAS_WIDTH - this.width);
  }

  scaleWidth(multiplier: number): void {
    this.setWidth(PADDLE_WIDTH * multiplier);
  }

  render(ctx: CanvasRenderingContext2D, options: { sticky?: boolean; laser?: boolean } = {}): void {
    const { sticky = false, laser = false } = options;

    if (sticky) {
      this.renderSticky(ctx);
      return;
    }

    if (laser) {
      this.renderLaser(ctx);
      return;
    }

    ctx.save();
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = '#cffafe';
    ctx.fillRect(this.x + 4, this.y + 3, this.width - 8, 3);
    ctx.restore();
  }

  reset(): void {
    this.width = PADDLE_WIDTH;
    this.x = (CANVAS_WIDTH - this.width) / 2;
    this.y = PADDLE_Y;
  }

  private renderSticky(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowColor = '#84cc16';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#65a30d';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#bef264';
    ctx.fillRect(this.x + 5, this.y + 3, this.width - 10, 3);

    ctx.fillStyle = '#4d7c0f';
    for (const offset of [10, 26, 44, 63]) {
      if (offset > this.width - 8) {
        continue;
      }

      const dripHeight = 4 + (offset % 3) * 2;
      ctx.beginPath();
      ctx.roundRect(this.x + offset, this.y + this.height - 1, 5, dripHeight, 3);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(240, 253, 244, 0.42)';
    for (const offset of [16, 38, 58]) {
      if (offset > this.width - 8) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(this.x + offset, this.y + 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderLaser(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(this.x + 5, this.y + 4, this.width - 10, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(this.x + 5, this.y + this.height - 4, this.width - 10, 2);

    this.renderCannon(ctx, this.x + 12);
    this.renderCannon(ctx, this.x + this.width - 12);

    ctx.restore();
  }

  private renderCannon(ctx: CanvasRenderingContext2D, centerX: number): void {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(centerX - 5, this.y - 7, 10, 11, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(centerX, this.y - 7, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fecaca';
    ctx.beginPath();
    ctx.arc(centerX, this.y - 7, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}