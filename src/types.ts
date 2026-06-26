import type { InputSystem } from './systems/InputSystem';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect extends Vec2 {
  width: number;
  height: number;
}

export interface PaddleInputTarget {
  x: number;
  immediate: boolean;
}

export enum BrickType {
  Empty = 0,
  Standard = 1,
  Tough = 2,
  Armored = 3,
  Unbreakable = 4,
  Explosive = 5,
  Sensor = 6,
}

export enum PowerUpType {
  MultiBall = 'multiBall',
  WidePaddle = 'widePaddle',
  LaserPaddle = 'laserPaddle',
  SlowBall = 'slowBall',
  Fireball = 'fireball',
  StickyPaddle = 'stickyPaddle',
  ExtraLife = 'extraLife',
  NarrowPaddle = 'narrowPaddle',
  FastBall = 'fastBall',
}

export type PowerUpWeights = Record<PowerUpType, number>;

export enum GameState {
  TITLE = 'TITLE',
  LEVEL_SELECT = 'LEVEL_SELECT',
  LEVEL_EDITOR = 'LEVEL_EDITOR',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
}

export interface LevelData {
  grid: number[][];
  ballSpeedMultiplier: number;
  powerUpDropChance: number;
  powerUpWeights: PowerUpWeights;
}

export interface SaveData {
  highestUnlocked: number;
  bestScores: Record<string, number>;
  effectsMuted: boolean;
  vibrationEnabled: boolean;
  musicVolume: number;
}

export interface GameRunResult {
  levelIndex: number;
  score: number;
  completed: boolean;
  maxCombo: number;
}

export interface GameContext {
  canvas: HTMLCanvasElement;
  state: GameState;
  getCanvasScale(): number;
  getSelectedLevelIndex(): number;
  getRunResult(): GameRunResult | null;
  setRunResult(result: GameRunResult): void;
  startLevel(levelIndex: number): void;
  restartLevel(): void;
  setState(state: GameState): void;
}

export interface Screen {
  enter(context: GameContext): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  handleInput(input: InputSystem): void;
}