import { BRICK_HEIGHT, BRICK_WIDTH, POWERUP_DROP_CHANCE } from '../constants';
import { BrickType, type Rect } from '../types';

export interface BrickHitResult {
  destroyed: boolean;
  points: number;
  spawnPowerUp: boolean;
}

const BRICK_POINTS: Record<BrickType, number> = {
  [BrickType.Empty]: 0,
  [BrickType.Standard]: 10,
  [BrickType.Tough]: 25,
  [BrickType.Armored]: 50,
  [BrickType.Unbreakable]: 0,
  [BrickType.Explosive]: 15,
  [BrickType.Sensor]: 0,
};

const UNBREAKABLE_BRICK_COLOR = '#64748b';

const BRICK_COLORS: Record<BrickType, string[]> = {
  [BrickType.Empty]: ['#000000'],
  [BrickType.Standard]: ['#38bdf8'],
  [BrickType.Tough]: ['#f97316'],
  [BrickType.Armored]: ['#84cc16'],
  [BrickType.Unbreakable]: [UNBREAKABLE_BRICK_COLOR],
  [BrickType.Explosive]: ['#ef4444'],
  [BrickType.Sensor]: [UNBREAKABLE_BRICK_COLOR],
};

const BRICK_HP_COLORS: Record<number, string> = {
  1: BRICK_COLORS[BrickType.Standard][0],
  2: BRICK_COLORS[BrickType.Tough][0],
  3: BRICK_COLORS[BrickType.Armored][0],
};

function usesHpColor(type: BrickType): boolean {
  return type === BrickType.Standard || type === BrickType.Tough || type === BrickType.Armored;
}

function getInitialHp(type: BrickType): number {
  switch (type) {
    case BrickType.Tough:
      return 2;
    case BrickType.Armored:
      return 3;
    case BrickType.Empty:
      return 0;
    default:
      return 1;
  }
}

function isInExplosiveBlastRange(source: Brick, target: Brick, bricks: readonly Brick[]): boolean {
  const rowDelta = target.row - source.row;
  const colDelta = target.col - source.col;
  const rowDistance = Math.abs(rowDelta);
  const colDistance = Math.abs(colDelta);

  if (rowDistance === 1 && colDistance === 1) {
    return true;
  }

  if (rowDistance === 0 && colDistance <= 2) {
    return !hasUnbreakableBetween(source, rowDelta, colDelta, bricks);
  }

  if (colDistance === 0 && rowDistance <= 2) {
    return !hasUnbreakableBetween(source, rowDelta, colDelta, bricks);
  }

  return false;
}

function hasUnbreakableBetween(source: Brick, rowDelta: number, colDelta: number, bricks: readonly Brick[]): boolean {
  if (Math.abs(rowDelta) <= 1 && Math.abs(colDelta) <= 1) {
    return false;
  }

  const blocker = bricks.find((brick) => (
    brick.row === source.row + Math.sign(rowDelta)
    && brick.col === source.col + Math.sign(colDelta)
  ));

  return blocker?.blocksExplosion === true;
}

export class Brick {
  hp: number;
  readonly maxHp: number;
  alive: boolean;
  rect: Rect;
  private sensorPassed = false;
  private sensorLocked = false;

  constructor(
    readonly row: number,
    readonly col: number,
    readonly type: BrickType,
    x: number,
    y: number,
  ) {
    this.hp = getInitialHp(type);
    this.maxHp = this.hp;
    this.alive = type !== BrickType.Empty;
    this.rect = { x, y, width: BRICK_WIDTH, height: BRICK_HEIGHT };
  }

  get breakable(): boolean {
    return this.alive && this.type !== BrickType.Unbreakable && this.type !== BrickType.Sensor;
  }

  get explosive(): boolean {
    return this.type === BrickType.Explosive;
  }

  get sensor(): boolean {
    return this.type === BrickType.Sensor;
  }

  get solid(): boolean {
    return this.alive && (!this.sensor || this.sensorLocked);
  }

  get blocksExplosion(): boolean {
    return this.alive && (this.type === BrickType.Unbreakable || this.solid && this.sensor);
  }

  updateSensorPass(occupied: boolean, passedThrough = false): boolean {
    if (!this.sensor || !this.alive || this.sensorLocked) {
      return false;
    }

    if (passedThrough) {
      this.sensorPassed = true;
    }

    if (!occupied && this.sensorPassed) {
      this.sensorLocked = true;
      return true;
    }

    return false;
  }

  hit(dropChance = POWERUP_DROP_CHANCE, rng = Math.random): BrickHitResult {
    if (!this.breakable) {
      return { destroyed: false, points: 0, spawnPowerUp: false };
    }

    this.hp = Math.max(this.hp - 1, 0);
    this.alive = this.hp > 0;

    const destroyed = !this.alive;

    return {
      destroyed,
      points: destroyed ? BRICK_POINTS[this.type] : 0,
      spawnPowerUp: destroyed && rng() < dropChance,
    };
  }

  destroy(dropChance = POWERUP_DROP_CHANCE, rng = Math.random): BrickHitResult {
    if (!this.breakable) {
      return { destroyed: false, points: 0, spawnPowerUp: false };
    }

    this.hp = 0;
    this.alive = false;

    return {
      destroyed: true,
      points: BRICK_POINTS[this.type],
      spawnPowerUp: rng() < dropChance,
    };
  }

  explode(bricks: readonly Brick[]): BrickHitResult[] {
    if (!this.explosive || this.alive) {
      return [];
    }

    return bricks
      .filter((brick) => brick !== this && brick.breakable && isInExplosiveBlastRange(this, brick, bricks))
      .map((brick) => brick.destroy());
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) {
      return;
    }

    if (this.sensor && !this.solid) {
      this.renderSensorOutline(ctx);
      return;
    }

    const color = usesHpColor(this.type)
      ? BRICK_HP_COLORS[this.hp] ?? BRICK_COLORS[this.type][0]
      : BRICK_COLORS[this.type][0];

    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.rect.x + 1, this.rect.y + 1, this.rect.width - 2, this.rect.height - 2);

    if (this.type === BrickType.Explosive) {
      this.renderTntMark(ctx);
    }

    ctx.restore();
  }

  private renderSensorOutline(ctx: CanvasRenderingContext2D): void {
    const color = BRICK_COLORS[BrickType.Sensor][0];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(this.rect.x + 2, this.rect.y + 2, this.rect.width - 4, this.rect.height - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(this.rect.x + 4, this.rect.y + 4, this.rect.width - 8, this.rect.height - 8);
    ctx.restore();
  }

  private renderTntMark(ctx: CanvasRenderingContext2D): void {
    const x = this.rect.x;
    const y = this.rect.y;
    const width = this.rect.width;
    const height = this.rect.height;
    const stickY = y + 4;
    const stickHeight = height - 8;

    ctx.save();
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x + 5, stickY, width - 14, stickHeight);
    ctx.fillStyle = 'rgba(254, 226, 226, 0.26)';
    ctx.fillRect(x + 7, stickY + 2, width - 18, 3);

    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1;
    for (let offset = 12; offset <= width - 18; offset += 12) {
      ctx.beginPath();
      ctx.moveTo(x + offset, stickY + 1);
      ctx.lineTo(x + offset, stickY + stickHeight - 1);
      ctx.stroke();
    }

    ctx.fillStyle = '#fee2e2';
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', x + width / 2 - 3, y + height / 2 + 0.5);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + width - 9, y + height / 2);
    ctx.quadraticCurveTo(x + width - 3, y + 3, x + width + 1, y + 5);
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(x + width + 1, y + 5);
    ctx.lineTo(x + width - 2, y + 9);
    ctx.lineTo(x + width + 3, y + 10);
    ctx.lineTo(x + width + 2, y + 14);
    ctx.lineTo(x + width + 7, y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}