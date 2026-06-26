import { CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT, PLAYFIELD_BOTTOM_Y } from '../constants';
import { Ball } from '../entities/Ball';
import type { Laser } from '../entities/Laser';
import type { Paddle } from '../entities/Paddle';
import type { PowerUp } from '../entities/PowerUp';
import type { PaddleInputTarget } from '../types';

export interface PhysicsWorld {
  paddle: Paddle;
  balls: Ball[];
  powerUps: PowerUp[];
  lasers: Laser[];
  paddleTarget: PaddleInputTarget | null;
  ballSpeedMultiplier: number;
}

export interface PhysicsResult {
  lifeLost: boolean;
}

function keepActive<T extends { active: boolean }>(items: T[]): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index].active) {
      items.splice(index, 1);
    }
  }
}

export class PhysicsSystem {
  update(dt: number, world: PhysicsWorld): PhysicsResult {
    world.paddle.update(dt, world.paddleTarget);

    for (const ball of world.balls) {
      ball.update(dt, world.paddle);
      this.resolveWallBounce(ball);
    }

    for (const powerUp of world.powerUps) {
      powerUp.update(dt);
    }

    for (const laser of world.lasers) {
      laser.update(dt);
    }

    keepActive(world.powerUps);
    keepActive(world.lasers);

    const lifeLost = this.removeLostBalls(world);

    return { lifeLost };
  }

  private resolveWallBounce(ball: Ball): void {
    if (ball.attached) {
      return;
    }

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius > CANVAS_WIDTH) {
      ball.x = CANVAS_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.radius < GAME_TOP_BAR_HEIGHT) {
      ball.y = GAME_TOP_BAR_HEIGHT + ball.radius;
      ball.vy = Math.abs(ball.vy);
    }
  }

  private removeLostBalls(world: PhysicsWorld): boolean {
    for (let index = world.balls.length - 1; index >= 0; index -= 1) {
      const ball = world.balls[index];

      if (ball.y + ball.radius > PLAYFIELD_BOTTOM_Y) {
        world.balls.splice(index, 1);
      }
    }

    if (world.balls.length > 0) {
      return false;
    }

    const ball = new Ball(world.ballSpeedMultiplier);
    ball.reset(world.paddle, world.ballSpeedMultiplier);
    world.balls.push(ball);

    return true;
  }
}