import { BALL_BASE_SPEED, BALL_RADIUS, CANVAS_WIDTH } from '../constants';
import type { Paddle } from './Paddle';

const DEFAULT_LAUNCH_ANGLE = Math.PI / 2;
const MAX_LAUNCH_OFFSET = Math.PI / 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class Ball {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  radius = BALL_RADIUS;
  speed = BALL_BASE_SPEED;
  attached = true;
  attachedOffsetX = 0;
  fireball = false;

  constructor(speedMultiplier = 1) {
    this.setSpeedMultiplier(speedMultiplier);
  }

  update(dt: number, paddle?: Paddle): void {
    if (this.attached) {
      if (paddle) {
        this.trackPaddle(paddle);
      }

      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.fireball) {
      ctx.shadowColor = '#fb923c';
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = this.fireball ? '#fb923c' : '#f8fafc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  launch(angle = Ball.createLaunchAngle()): void {
    this.attached = false;
    this.attachedOffsetX = 0;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = -Math.sin(angle) * this.speed;
  }

  reset(paddle: Paddle, speedMultiplier?: number): void {
    if (speedMultiplier !== undefined) {
      this.setSpeedMultiplier(speedMultiplier);
    }

    this.attached = true;
    this.attachedOffsetX = 0;
    this.vx = 0;
    this.vy = 0;
    this.trackPaddle(paddle);
  }

  attachToPaddle(paddle: Paddle, offsetX = this.x - (paddle.x + paddle.width / 2)): void {
    this.attached = true;
    this.attachedOffsetX = clamp(offsetX, -paddle.width / 2, paddle.width / 2);
    this.vx = 0;
    this.vy = 0;
    this.trackPaddle(paddle);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0, speed);

    if (this.attached) {
      return;
    }

    const velocityLength = Math.hypot(this.vx, this.vy);

    if (velocityLength === 0) {
      return;
    }

    this.vx = (this.vx / velocityLength) * this.speed;
    this.vy = (this.vy / velocityLength) * this.speed;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.setSpeed(BALL_BASE_SPEED * multiplier);
  }

  multiplySpeed(multiplier: number): void {
    this.setSpeed(this.speed * multiplier);
  }

  static createLaunchAngle(): number {
    return DEFAULT_LAUNCH_ANGLE + (Math.random() * 2 - 1) * MAX_LAUNCH_OFFSET;
  }

  private trackPaddle(paddle: Paddle): void {
    this.x = clamp(paddle.x + paddle.width / 2 + this.attachedOffsetX, this.radius, CANVAS_WIDTH - this.radius);
    this.y = paddle.y - this.radius;
  }
}