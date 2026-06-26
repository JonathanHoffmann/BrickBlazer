import { LASER_SPEED } from '../constants';
import type { Rect } from '../types';

export class Laser {
  width = 4;
  height = 18;
  speed = LASER_SPEED;
  active = true;

  constructor(
    public x: number,
    public y: number,
  ) {
  }

  get rect(): Rect {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height,
      width: this.width,
      height: this.height,
    };
  }

  update(dt: number): void {
    this.y -= this.speed * dt;

    if (this.y < 0) {
      this.active = false;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) {
      return;
    }

    const rect = this.rect;

    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }
}