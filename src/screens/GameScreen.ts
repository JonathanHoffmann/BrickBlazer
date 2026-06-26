import {
  BRICK_GAP,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  CANVAS_WIDTH,
  COMBO_MULTIPLIER_STEP,
  COMBO_TIMEOUT,
  FAST_BALL_MULTIPLIER,
  GAME_TOP_BAR_HEIGHT,
  INITIAL_LIVES,
  LASER_FIRE_INTERVAL,
  MULTIBALL_COUNT,
  NARROW_PADDLE_SCALE,
  POWERUP_DURATION,
  SLOW_BALL_MULTIPLIER,
  WIDE_PADDLE_SCALE,
} from '../constants';
import { DEV_TOOLS_ENABLED } from '../devFlags';
import { Ball } from '../entities/Ball';
import { Brick, type BrickHitResult } from '../entities/Brick';
import { Laser } from '../entities/Laser';
import { Paddle } from '../entities/Paddle';
import { PowerUp } from '../entities/PowerUp';
import { levels } from '../levels';
import { POWERUP_TYPES } from '../powerUpConfig';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import type { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { type Particle, Renderer } from '../systems/Renderer';
import { BrickType, GameState, PowerUpType, type GameContext, type LevelData, type PaddleInputTarget, type Screen } from '../types';
import { DevPowerUpMenu } from './DevPowerUpMenu';
import { createPauseButton, drawPauseButton, hitButton } from './screenUi';

const BRICK_START_X = (CANVAS_WIDTH - (9 * BRICK_WIDTH + 8 * BRICK_GAP)) / 2;
const BRICK_START_Y = GAME_TOP_BAR_HEIGHT + 18;
const PARTICLE_LIFE = 0.4;

const PARTICLE_COLORS: Record<BrickType, string> = {
  [BrickType.Empty]: '#101624',
  [BrickType.Standard]: '#38bdf8',
  [BrickType.Tough]: '#f97316',
  [BrickType.Armored]: '#84cc16',
  [BrickType.Unbreakable]: '#64748b',
  [BrickType.Explosive]: '#ef4444',
  [BrickType.Sensor]: '#facc15',
};

export class GameScreen implements Screen {
  private readonly renderer = new Renderer();
  private readonly physics = new PhysicsSystem();
  private readonly collision = new CollisionSystem();
  private readonly audio = new AudioSystem();
  private readonly devPowerUpMenu = DEV_TOOLS_ENABLED ? new DevPowerUpMenu() : null;
  private readonly pauseButton = createPauseButton();

  private context: GameContext | null = null;
  private paddle = new Paddle();
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: PowerUp[] = [];
  private lasers: Laser[] = [];
  private particles: Particle[] = [];
  private levelData: LevelData = levels[0];
  private levelIndex = 0;
  private paddleTarget: PaddleInputTarget | null = null;
  private launchQueued = false;
  private score = 0;
  private lives = INITIAL_LIVES;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private activePaddleModifier: PowerUpType | null = null;
  private slowBallTimer = 0;
  private fastBallTimer = 0;
  private fireballTimer = 0;
  private laserTimer = 0;

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.resetLevel();
  }

  exit(): void {
    this.context = null;
  }

  update(dt: number): void {
    this.updatePowerUpTimers(dt);
    this.fireLasers(dt);

    const physicsResult = this.physics.update(dt, {
      paddle: this.paddle,
      balls: this.balls,
      powerUps: this.powerUps,
      lasers: this.lasers,
      paddleTarget: this.paddleTarget,
      ballSpeedMultiplier: this.getBallSpeedMultiplier(),
    });

    this.handleQueuedLaunch();

    this.collision.update(
      {
        paddle: this.paddle,
        balls: this.balls,
        bricks: this.bricks,
        powerUps: this.powerUps,
        lasers: this.lasers,
        stickyActive: this.activePaddleModifier === PowerUpType.StickyPaddle,
        powerUpDropChance: this.levelData.powerUpDropChance,
      },
      {
        onPaddleHit: () => this.audio.play('paddleHit'),
        onBrickHit: (brick, result) => this.handleBrickHit(brick, result),
        onPowerUpCollected: (type) => this.activatePowerUp(type),
      },
      dt,
    );

    if (physicsResult.lifeLost) {
      this.handleLifeLost();
    }

    this.updateCombo(dt);
    this.updateParticles(dt);

    if (this.isLevelCleared()) {
      this.completeLevel();
    }
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    this.renderer.clear(ctx);
    this.renderer.drawLavaZone(ctx);
    this.renderer.drawBricks(ctx, this.bricks);
    this.renderer.drawParticles(ctx, this.particles);
    this.renderer.drawPaddle(ctx, this.paddle, {
      sticky: this.activePaddleModifier === PowerUpType.StickyPaddle,
      laser: this.activePaddleModifier === PowerUpType.LaserPaddle,
    });
    this.renderer.drawLasers(ctx, this.lasers);
    this.renderer.drawPowerUps(ctx, this.powerUps);
    this.renderer.drawBalls(ctx, this.balls);
    this.renderer.drawHUD(ctx, this.score, this.lives, this.levelIndex + 1, this.combo, this.getHudPowerUp());
    drawPauseButton(ctx, this.pauseButton);
    this.devPowerUpMenu?.render(ctx);
  }

  handleInput(input: InputSystem): void {
    if (hitButton([this.pauseButton], input.peekPointerPress())) {
      input.consumePointerPress();
      input.clearPointerTarget();
      input.clearTransientActions();
      this.audio.play('buttonPress');
      this.context?.setState(GameState.PAUSED);
      return;
    }

    if (this.devPowerUpMenu?.handleInput(input)) {
      if (this.devPowerUpMenu.consumeClearLevel()) {
        this.completeLevel();
        input.clearPointerTarget();
        input.clearTransientActions();
        return;
      }

      const powerUpType = this.devPowerUpMenu.consumeDrop();

      if (powerUpType) {
        this.dropDevPowerUp(powerUpType);
      }

      input.clearPointerTarget();
      input.clearTransientActions();
      return;
    }

    this.paddleTarget = input.getPaddleTarget();

    if (input.isLaunchPressed()) {
      this.launchQueued = true;
    }

    if (input.isPausePressed()) {
      this.context?.setState(GameState.PAUSED);
    }
  }

  private resetLevel(): void {
    const selectedLevelIndex = this.context?.getSelectedLevelIndex() ?? 0;
    this.levelIndex = Math.min(Math.max(selectedLevelIndex, 0), levels.length - 1);
    this.levelData = levels[this.levelIndex];
    this.paddle = new Paddle();
    const ball = new Ball(this.getBallSpeedMultiplier());
    ball.reset(this.paddle, this.getBallSpeedMultiplier());
    this.balls = [ball];
    this.bricks = this.createBricks(this.levelData);
    this.powerUps = [];
    this.lasers = [];
    this.particles = [];
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.applyPaddleModifierToPaddle();
    this.slowBallTimer = 0;
    this.fastBallTimer = 0;
    this.fireballTimer = 0;
    this.laserTimer = 0;
  }

  private createBricks(levelData: LevelData): Brick[] {
    return levelData.grid.flatMap((row, rowIndex) =>
      row.map((brickType, colIndex) => new Brick(
        rowIndex,
        colIndex,
        brickType,
        BRICK_START_X + colIndex * (BRICK_WIDTH + BRICK_GAP),
        BRICK_START_Y + rowIndex * (BRICK_HEIGHT + BRICK_GAP),
      )),
    );
  }

  private handleQueuedLaunch(): void {
    if (!this.launchQueued) {
      return;
    }

    this.launchQueued = false;
    let launched = false;

    for (const ball of this.balls) {
      if (ball.attached) {
        ball.launch();
        launched = true;
      }
    }

    if (launched) {
      this.audio.play('ballLaunch');
    }
  }

  private handleBrickHit(brick: Brick, result: BrickHitResult): void {
    if (!result.destroyed) {
      this.audio.play(brick.breakable ? 'brickHit' : 'brickIndestructible');
      return;
    }

    this.audio.play(brick.type === BrickType.Explosive ? 'brickExplode' : 'brickDestroy');
    this.addScore(result.points);
    this.spawnParticles(brick);

    const powerUpType = result.spawnPowerUp ? this.getRandomPowerUpType() : null;

    if (powerUpType) {
      this.powerUps.push(new PowerUp(
        brick.rect.x + brick.rect.width / 2,
        brick.rect.y + brick.rect.height / 2,
        powerUpType,
      ));
    }
  }

  private addScore(points: number): void {
    if (points <= 0) {
      return;
    }

    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = COMBO_TIMEOUT / 1000;
    this.score += Math.round(points * (1 + (this.combo - 1) * COMBO_MULTIPLIER_STEP));
  }

  private updateCombo(dt: number): void {
    if (this.comboTimer <= 0) {
      this.combo = 0;
      return;
    }

    this.comboTimer = Math.max(this.comboTimer - dt, 0);
  }

  private handleLifeLost(): void {
    this.lives -= 1;
    this.audio.play('lifeLost');
    this.powerUps = [];
    this.lasers = [];
    this.clearPaddleModifier();

    if (this.lives <= 0) {
      this.audio.play('gameOver');
      this.context?.setRunResult({
        levelIndex: this.levelIndex,
        score: this.score,
        completed: false,
        maxCombo: this.maxCombo,
      });
      this.context?.setState(GameState.GAME_OVER);
    }
  }

  private activatePowerUp(type: PowerUpType): void {
    this.audio.play('powerUp');

    switch (type) {
      case PowerUpType.WidePaddle:
        this.setPaddleModifier(type);
        this.paddle.scaleWidth(WIDE_PADDLE_SCALE);
        break;
      case PowerUpType.NarrowPaddle:
        this.setPaddleModifier(type);
        this.paddle.scaleWidth(NARROW_PADDLE_SCALE);
        break;
      case PowerUpType.LaserPaddle:
      case PowerUpType.StickyPaddle:
        this.setPaddleModifier(type);
        break;
      case PowerUpType.SlowBall:
        this.slowBallTimer = POWERUP_DURATION / 1000;
        this.applyBallEffects();
        break;
      case PowerUpType.FastBall:
        this.fastBallTimer = POWERUP_DURATION / 1000;
        this.applyBallEffects();
        break;
      case PowerUpType.Fireball:
        this.fireballTimer = POWERUP_DURATION / 1000;
        this.applyBallEffects();
        break;
      case PowerUpType.MultiBall:
        this.spawnMultiBalls();
        break;
      case PowerUpType.ExtraLife:
        this.lives += 1;
        break;
    }
  }

  private setPaddleModifier(type: PowerUpType): void {
    this.activePaddleModifier = type;
    this.applyPaddleModifierToPaddle();
  }

  private clearPaddleModifier(): void {
    this.activePaddleModifier = null;
    this.laserTimer = 0;
    this.paddle.scaleWidth(1);
  }

  private applyPaddleModifierToPaddle(): void {
    switch (this.activePaddleModifier) {
      case PowerUpType.WidePaddle:
        this.paddle.scaleWidth(WIDE_PADDLE_SCALE);
        break;
      case PowerUpType.NarrowPaddle:
        this.paddle.scaleWidth(NARROW_PADDLE_SCALE);
        break;
      default:
        this.paddle.scaleWidth(1);
        break;
    }
  }

  private updatePowerUpTimers(dt: number): void {
    const previousSpeedMultiplier = this.getBallSpeedMultiplier();
    const previousFireballActive = this.fireballTimer > 0;

    this.slowBallTimer = Math.max(this.slowBallTimer - dt, 0);
    this.fastBallTimer = Math.max(this.fastBallTimer - dt, 0);
    this.fireballTimer = Math.max(this.fireballTimer - dt, 0);

    if (previousSpeedMultiplier !== this.getBallSpeedMultiplier() || previousFireballActive !== (this.fireballTimer > 0)) {
      this.applyBallEffects();
    }
  }

  private getBallSpeedMultiplier(): number {
    let multiplier = this.levelData.ballSpeedMultiplier;

    if (this.slowBallTimer > 0) {
      multiplier *= SLOW_BALL_MULTIPLIER;
    }

    if (this.fastBallTimer > 0) {
      multiplier *= FAST_BALL_MULTIPLIER;
    }

    return multiplier;
  }

  private applyBallEffects(): void {
    const speedMultiplier = this.getBallSpeedMultiplier();
    const fireballActive = this.fireballTimer > 0;

    for (const ball of this.balls) {
      ball.setSpeedMultiplier(speedMultiplier);
      ball.fireball = fireballActive;
    }
  }

  private fireLasers(dt: number): void {
    if (this.activePaddleModifier !== PowerUpType.LaserPaddle) {
      return;
    }

    if (this.balls.every((ball) => ball.attached)) {
      this.laserTimer = 0;
      return;
    }

    this.laserTimer += dt * 1000;

    if (this.laserTimer < LASER_FIRE_INTERVAL) {
      return;
    }

    this.laserTimer %= LASER_FIRE_INTERVAL;
    this.lasers.push(
      new Laser(this.paddle.x + 12, this.paddle.y),
      new Laser(this.paddle.x + this.paddle.width - 12, this.paddle.y),
    );
  }

  private spawnMultiBalls(): void {
    const source = this.balls.find((ball) => !ball.attached) ?? this.balls[0];

    if (!source) {
      return;
    }

    if (source.attached) {
      source.launch();
    }

    const velocityAngle = Math.atan2(source.vy || -source.speed, source.vx || 0);
    const spread = 0.35;

    for (let index = 0; index < MULTIBALL_COUNT; index += 1) {
      const offset = index % 2 === 0 ? -spread : spread;
      const ball = new Ball(this.getBallSpeedMultiplier());
      ball.x = source.x;
      ball.y = source.y;
      ball.attached = false;
      ball.fireball = this.fireballTimer > 0;
      ball.vx = Math.cos(velocityAngle + offset) * ball.speed;
      ball.vy = Math.sin(velocityAngle + offset) * ball.speed;
      this.balls.push(ball);
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }

    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  private spawnParticles(brick: Brick): void {
    const centerX = brick.rect.x + brick.rect.width / 2;
    const centerY = brick.rect.y + brick.rect.height / 2;

    for (let index = 0; index < 8; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 120;

      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFE,
        maxLife: PARTICLE_LIFE,
        color: PARTICLE_COLORS[brick.type],
        size: 3 + Math.random() * 3,
      });
    }
  }

  private isLevelCleared(): boolean {
    return this.bricks.every((brick) => !brick.alive || brick.type === BrickType.Empty || brick.type === BrickType.Unbreakable || brick.type === BrickType.Sensor);
  }

  private completeLevel(): void {
    this.audio.play('levelComplete');
    this.context?.setRunResult({
      levelIndex: this.levelIndex,
      score: this.score,
      completed: true,
      maxCombo: this.maxCombo,
    });
    this.context?.setState(GameState.LEVEL_COMPLETE);
  }

  private getHudPowerUp(): PowerUpType | null {
    if (this.activePaddleModifier) {
      return this.activePaddleModifier;
    }

    if (this.fireballTimer > 0) {
      return PowerUpType.Fireball;
    }

    if (this.slowBallTimer > 0) {
      return PowerUpType.SlowBall;
    }

    if (this.fastBallTimer > 0) {
      return PowerUpType.FastBall;
    }

    return null;
  }

  private getRandomPowerUpType(): PowerUpType | null {
    const totalWeight = POWERUP_TYPES.reduce((total, type) => total + Math.max(this.levelData.powerUpWeights[type] ?? 0, 0), 0);

    if (totalWeight <= 0) {
      return null;
    }

    let roll = Math.random() * totalWeight;

    for (const type of POWERUP_TYPES) {
      roll -= Math.max(this.levelData.powerUpWeights[type] ?? 0, 0);

      if (roll <= 0) {
        return type;
      }
    }

    return POWERUP_TYPES[POWERUP_TYPES.length - 1];
  }

  private dropDevPowerUp(type: PowerUpType): void {
    this.powerUps.push(new PowerUp(
      this.paddle.x + this.paddle.width / 2,
      Math.max(GAME_TOP_BAR_HEIGHT + 28, this.paddle.y - 160),
      type,
    ));
    this.audio.play('powerUp');
  }
}