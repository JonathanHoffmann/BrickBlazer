import type { Ball } from '../entities/Ball';
import { Brick, type BrickHitResult } from '../entities/Brick';
import type { Laser } from '../entities/Laser';
import type { Paddle } from '../entities/Paddle';
import type { PowerUp } from '../entities/PowerUp';
import { BrickType, type PowerUpType, type Rect } from '../types';

export interface CollisionWorld {
  paddle: Paddle;
  balls: Ball[];
  bricks: Brick[];
  powerUps: PowerUp[];
  lasers: Laser[];
  stickyActive: boolean;
  powerUpDropChance: number;
}

export interface CollisionCallbacks {
  onPaddleHit?: () => void;
  onBrickHit?: (brick: Brick, result: BrickHitResult) => void;
  onPowerUpCollected?: (type: PowerUpType) => void;
}

interface CollisionCandidate {
  brick: Brick;
  distanceSquared: number;
}

type SensorSide = 'left' | 'right' | 'top' | 'bottom';

interface SensorPassState {
  entrySide: SensorSide;
}

const MAX_PADDLE_BOUNCE_ANGLE = Math.PI / 3;
const TNT_CHAIN_DELAY_SECONDS = 0.12;

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function ballRect(ball: Ball): Rect {
  return {
    x: ball.x - ball.radius,
    y: ball.y - ball.radius,
    width: ball.radius * 2,
    height: ball.radius * 2,
  };
}

function centerDistanceSquared(a: Rect, b: Rect): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;

  return (ax - bx) ** 2 + (ay - by) ** 2;
}

export class CollisionSystem {
  private readonly pendingExplosions: { brick: Brick; timeRemaining: number }[] = [];
  private readonly sensorPasses = new WeakMap<Brick, WeakMap<Ball, SensorPassState>>();

  update(world: CollisionWorld, callbacks: CollisionCallbacks = {}, dt = 0): void {
    this.resolvePendingExplosions(world, callbacks, dt);
    this.resolvePaddleCollisions(world, callbacks);
    this.resolveBrickCollisions(world, callbacks, dt);
    this.resolveLaserCollisions(world, callbacks);
    this.resolvePowerUpCollisions(world, callbacks);
  }

  private resolvePaddleCollisions(world: CollisionWorld, callbacks: CollisionCallbacks): void {
    const paddleRect = world.paddle.rect;

    for (const ball of world.balls) {
      if (ball.attached || ball.vy <= 0 || !rectsOverlap(ballRect(ball), paddleRect)) {
        continue;
      }

      callbacks.onPaddleHit?.();

      if (world.stickyActive) {
        ball.attachToPaddle(world.paddle);
        continue;
      }

      const paddleCenterX = world.paddle.x + world.paddle.width / 2;
      const hitOffset = (ball.x - paddleCenterX) / (world.paddle.width / 2);
      const clampedOffset = Math.min(Math.max(hitOffset, -1), 1);
      const angle = clampedOffset * MAX_PADDLE_BOUNCE_ANGLE;

      ball.x = Math.min(Math.max(ball.x, ball.radius), paddleRect.x + paddleRect.width - ball.radius);
      ball.y = world.paddle.y - ball.radius;
      ball.vx = Math.sin(angle) * ball.speed;
      ball.vy = -Math.cos(angle) * ball.speed;
    }
  }

  private resolveBrickCollisions(world: CollisionWorld, callbacks: CollisionCallbacks, dt: number): void {
    const sensorsLockedThisFrame = this.updateSensorBricks(world.balls, world.bricks, dt);

    for (const ball of world.balls) {
      if (ball.attached) {
        continue;
      }

      const candidate = this.findClosestBrickCollision(ball, world.bricks, sensorsLockedThisFrame);

      if (!candidate) {
        continue;
      }

      if (!ball.fireball) {
        this.reflectBallFromBrick(ball, candidate.brick.rect);
      }

      if (ball.fireball && candidate.brick.breakable) {
        while (candidate.brick.alive && candidate.brick.breakable) {
          this.applyBrickHit(candidate.brick, world.bricks, callbacks, world.powerUpDropChance);
        }

        continue;
      }

      this.applyBrickHit(candidate.brick, world.bricks, callbacks, world.powerUpDropChance);
    }
  }

  private resolveLaserCollisions(world: CollisionWorld, callbacks: CollisionCallbacks): void {
    for (const laser of world.lasers) {
      if (!laser.active) {
        continue;
      }

      const hitBrick = world.bricks
        .filter((brick) => brick.solid && rectsOverlap(laser.rect, brick.rect))
        .sort((a, b) => b.rect.y - a.rect.y)[0];

      if (!hitBrick) {
        continue;
      }

      this.applyBrickHit(hitBrick, world.bricks, callbacks, world.powerUpDropChance);
      laser.active = false;
    }
  }

  private resolvePowerUpCollisions(world: CollisionWorld, callbacks: CollisionCallbacks): void {
    const paddleRect = world.paddle.rect;

    for (const powerUp of world.powerUps) {
      if (!powerUp.active || !rectsOverlap(powerUp.rect, paddleRect)) {
        continue;
      }

      callbacks.onPowerUpCollected?.(powerUp.collect());
    }
  }

  private findClosestBrickCollision(ball: Ball, bricks: readonly Brick[], excludedBricks: ReadonlySet<Brick>): CollisionCandidate | null {
    const ballBounds = ballRect(ball);
    const candidates = bricks
      .filter((brick) => brick.solid && !excludedBricks.has(brick) && rectsOverlap(ballBounds, brick.rect))
      .map((brick) => ({ brick, distanceSquared: centerDistanceSquared(ballBounds, brick.rect) }))
      .sort((a, b) => a.distanceSquared - b.distanceSquared);

    return candidates[0] ?? null;
  }

  private updateSensorBricks(balls: readonly Ball[], bricks: readonly Brick[], dt: number): Set<Brick> {
    const activeBalls = balls.filter((ball) => !ball.attached);
    const lockedThisFrame = new Set<Brick>();

    for (const brick of bricks) {
      if (!brick.sensor) {
        continue;
      }

      const occupied = activeBalls.some((ball) => rectsOverlap(ballRect(ball), brick.rect));
      const passedThrough = activeBalls.some((ball) => this.updateSensorBallPass(brick, ball, dt));

      if (brick.updateSensorPass(occupied, passedThrough)) {
        lockedThisFrame.add(brick);
      }
    }

    return lockedThisFrame;
  }

  private updateSensorBallPass(brick: Brick, ball: Ball, dt: number): boolean {
    const bounds = ballRect(ball);
    const overlapsSensor = rectsOverlap(bounds, brick.rect);
    const previousCenter = { x: ball.x - ball.vx * dt, y: ball.y - ball.vy * dt };
    const currentCenter = { x: ball.x, y: ball.y };

    if (this.centerCrossedThroughRect(previousCenter, currentCenter, brick.rect)) {
      this.getSensorPasses(brick).delete(ball);
      return true;
    }

    const passes = this.getSensorPasses(brick);
    const pass = passes.get(ball);

    if (!pass && overlapsSensor) {
      passes.set(ball, { entrySide: this.getSensorSide(previousCenter, brick.rect) });
      return false;
    }

    if (!pass) {
      return false;
    }

    if (overlapsSensor) {
      return false;
    }

    passes.delete(ball);
    return this.areOppositeSides(pass.entrySide, this.getSensorSide(currentCenter, brick.rect));
  }

  private getSensorPasses(brick: Brick): WeakMap<Ball, SensorPassState> {
    let passes = this.sensorPasses.get(brick);

    if (!passes) {
      passes = new WeakMap<Ball, SensorPassState>();
      this.sensorPasses.set(brick, passes);
    }

    return passes;
  }

  private centerCrossedThroughRect(start: { x: number; y: number }, end: { x: number; y: number }, rect: Rect): boolean {
    const crossedHorizontally = (start.x < rect.x && end.x > rect.x + rect.width) || (start.x > rect.x + rect.width && end.x < rect.x);
    const crossedVertically = (start.y < rect.y && end.y > rect.y + rect.height) || (start.y > rect.y + rect.height && end.y < rect.y);

    return (crossedHorizontally || crossedVertically) && this.segmentIntersectsRect(start, end, rect);
  }

  private segmentIntersectsRect(start: { x: number; y: number }, end: { x: number; y: number }, rect: Rect): boolean {
    if (this.pointInRect(start, rect) || this.pointInRect(end, rect)) {
      return true;
    }

    return this.segmentsIntersect(start, end, { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y })
      || this.segmentsIntersect(start, end, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height })
      || this.segmentsIntersect(start, end, { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height })
      || this.segmentsIntersect(start, end, { x: rect.x, y: rect.y + rect.height }, { x: rect.x, y: rect.y });
  }

  private pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
    return point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  private segmentsIntersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }): boolean {
    const abC = this.orientation(a, b, c);
    const abD = this.orientation(a, b, d);
    const cdA = this.orientation(c, d, a);
    const cdB = this.orientation(c, d, b);

    return abC * abD <= 0 && cdA * cdB <= 0;
  }

  private orientation(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  private getSensorSide(point: { x: number; y: number }, rect: Rect): SensorSide {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const normalizedX = (point.x - centerX) / (rect.width / 2);
    const normalizedY = (point.y - centerY) / (rect.height / 2);

    if (Math.abs(normalizedX) > Math.abs(normalizedY)) {
      return normalizedX < 0 ? 'left' : 'right';
    }

    return normalizedY < 0 ? 'top' : 'bottom';
  }

  private areOppositeSides(a: SensorSide, b: SensorSide): boolean {
    return (a === 'left' && b === 'right')
      || (a === 'right' && b === 'left')
      || (a === 'top' && b === 'bottom')
      || (a === 'bottom' && b === 'top');
  }

  private reflectBallFromBrick(ball: Ball, brickRect: Rect): void {
    const bounds = ballRect(ball);
    const overlapLeft = bounds.x + bounds.width - brickRect.x;
    const overlapRight = brickRect.x + brickRect.width - bounds.x;
    const overlapTop = bounds.y + bounds.height - brickRect.y;
    const overlapBottom = brickRect.y + brickRect.height - bounds.y;
    const overlapX = Math.min(overlapLeft, overlapRight);
    const overlapY = Math.min(overlapTop, overlapBottom);

    if (overlapX < overlapY) {
      ball.vx *= -1;
      ball.x += overlapLeft < overlapRight ? -overlapX : overlapX;
      return;
    }

    ball.vy *= -1;
    ball.y += overlapTop < overlapBottom ? -overlapY : overlapY;
  }

  private applyBrickHit(brick: Brick, bricks: readonly Brick[], callbacks: CollisionCallbacks, powerUpDropChance: number): void {
    const result = brick.hit(powerUpDropChance);
    callbacks.onBrickHit?.(brick, result);

    if (!result.destroyed || !brick.explosive) {
      return;
    }

    this.applyExplosion(brick, bricks, callbacks, powerUpDropChance);
  }

  private applyExplosion(source: Brick, bricks: readonly Brick[], callbacks: CollisionCallbacks, powerUpDropChance: number): void {
    for (const target of bricks) {
      if (target === source || !target.breakable || !this.canExplosionReach(source, target, bricks)) {
        continue;
      }

      if (target.explosive) {
        this.queueExplosion(target);
        continue;
      }

      const result = target.destroy(powerUpDropChance);
      callbacks.onBrickHit?.(target, result);
    }
  }

  private queueExplosion(brick: Brick): void {
    if (this.pendingExplosions.some((pending) => pending.brick === brick)) {
      return;
    }

    this.pendingExplosions.push({ brick, timeRemaining: TNT_CHAIN_DELAY_SECONDS });
  }

  private resolvePendingExplosions(world: CollisionWorld, callbacks: CollisionCallbacks, dt: number): void {
    for (let index = this.pendingExplosions.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingExplosions[index];
      pending.timeRemaining -= dt;

      if (pending.timeRemaining > 0) {
        continue;
      }

      this.pendingExplosions.splice(index, 1);

      if (!world.bricks.includes(pending.brick) || !pending.brick.breakable) {
        continue;
      }

      const result = pending.brick.destroy(world.powerUpDropChance);
      callbacks.onBrickHit?.(pending.brick, result);
      this.applyExplosion(pending.brick, world.bricks, callbacks, world.powerUpDropChance);
    }
  }

  private canExplosionReach(source: Brick, target: Brick, bricks: readonly Brick[]): boolean {
    const rowDelta = target.row - source.row;
    const colDelta = target.col - source.col;
    const rowDistance = Math.abs(rowDelta);
    const colDistance = Math.abs(colDelta);

    if (rowDistance === 1 && colDistance === 1) {
      return true;
    }

    if (rowDistance === 0 && colDistance <= 2) {
      return !this.hasUnbreakableBetween(source, rowDelta, colDelta, bricks);
    }

    if (colDistance === 0 && rowDistance <= 2) {
      return !this.hasUnbreakableBetween(source, rowDelta, colDelta, bricks);
    }

    return false;
  }

  private hasUnbreakableBetween(source: Brick, rowDelta: number, colDelta: number, bricks: readonly Brick[]): boolean {
    if (Math.abs(rowDelta) <= 1 && Math.abs(colDelta) <= 1) {
      return false;
    }

    const blocker = bricks.find((brick) => (
      brick.row === source.row + Math.sign(rowDelta)
      && brick.col === source.col + Math.sign(colDelta)
    ));

    return blocker?.blocksExplosion === true;
  }
}