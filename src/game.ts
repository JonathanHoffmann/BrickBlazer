import { CANVAS_HEIGHT, CANVAS_WIDTH, FIXED_TIMESTEP, MAX_FRAME_TIME } from './constants';
import { GameOverScreen } from './screens/GameOverScreen';
import { GameScreen } from './screens/GameScreen';
import { LevelCompleteScreen } from './screens/LevelCompleteScreen';
import { LevelEditorScreen } from './screens/LevelEditorScreen';
import { LevelSelectScreen } from './screens/LevelSelectScreen';
import { PauseOverlay } from './screens/PauseOverlay';
import { TitleScreen } from './screens/TitleScreen';
import { InputSystem } from './systems/InputSystem';
import { levels } from './levels';
import { GameState, type GameContext, type GameRunResult, type Screen } from './types';

export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screens: Record<GameState, Screen>;
  private activeScreen: Screen | null = null;
  private readonly input: InputSystem;
  private animationFrameId = 0;
  private accumulator = 0;
  private previousTime = 0;
  private state: GameState | null = null;
  private selectedLevelIndex = 0;
  private runResult: GameRunResult | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly getCanvasScale: () => number = () => 1,
  ) {
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }

    this.ctx = ctx;
    this.input = new InputSystem(canvas);
    this.screens = {
      [GameState.TITLE]: new TitleScreen(),
      [GameState.LEVEL_SELECT]: new LevelSelectScreen(),
      [GameState.LEVEL_EDITOR]: new LevelEditorScreen(),
      [GameState.PLAYING]: new GameScreen(),
      [GameState.PAUSED]: new PauseOverlay(),
      [GameState.LEVEL_COMPLETE]: new LevelCompleteScreen(),
      [GameState.GAME_OVER]: new GameOverScreen(),
    };
  }

  init(): void {
    this.setState(GameState.TITLE);
    this.previousTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  update(_dt: number): void {
    this.activeScreen?.handleInput(this.input);
    this.activeScreen?.update(_dt);
  }

  render(_alpha: number): void {
    this.ctx.fillStyle = '#101624';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (this.state === GameState.PAUSED) {
      this.screens[GameState.PLAYING].render(this.ctx, _alpha);
      this.screens[GameState.PAUSED].render(this.ctx, _alpha);
      return;
    }

    this.activeScreen?.render(this.ctx, _alpha);
  }

  setState(state: GameState): void {
    if (this.state === state) {
      return;
    }

    if (this.state === GameState.PLAYING && state === GameState.PAUSED) {
      this.state = state;
      this.activeScreen = this.screens[state];
      this.activeScreen.enter(this.createContext(state));
      this.input.clearTransientActions();
      return;
    }

    if (this.state === GameState.PAUSED && state === GameState.PLAYING) {
      this.activeScreen?.exit();
      this.state = state;
      this.activeScreen = this.screens[state];
      this.input.clearTransientActions();
      return;
    }

    if (this.state === GameState.PAUSED) {
      this.activeScreen?.exit();
      this.screens[GameState.PLAYING].exit();
    } else {
      this.activeScreen?.exit();
    }

    this.state = state;
    this.activeScreen = this.screens[state];
    this.activeScreen.enter(this.createContext(state));
    this.input.clearTransientActions();
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.activeScreen?.exit();

    if (this.state === GameState.PAUSED) {
      this.screens[GameState.PLAYING].exit();
    }

    this.input.destroy();
    this.activeScreen = null;
    this.state = null;
  }

  private startLevel(levelIndex: number): void {
    this.selectedLevelIndex = Math.min(Math.max(levelIndex, 0), levels.length - 1);
    this.runResult = null;

    if (this.state === GameState.PLAYING) {
      const screen = this.screens[GameState.PLAYING];
      screen.exit();
      this.activeScreen = screen;
      screen.enter(this.createContext(GameState.PLAYING));
      return;
    }

    this.setState(GameState.PLAYING);
  }

  private createContext(state = this.state): GameContext {

    if (!state) {
      throw new Error('Cannot create game context before state is initialized.');
    }

    return {
      canvas: this.canvas,
      state,
      getCanvasScale: this.getCanvasScale,
      getSelectedLevelIndex: () => this.selectedLevelIndex,
      getRunResult: () => this.runResult,
      setRunResult: (result) => {
        this.runResult = result;
      },
      startLevel: (levelIndex) => this.startLevel(levelIndex),
      restartLevel: () => this.startLevel(this.selectedLevelIndex),
      setState: (nextState) => this.setState(nextState),
    };
  }

  private readonly loop = (timestamp: number): void => {
    const elapsed = Math.min((timestamp - this.previousTime) / 1000, MAX_FRAME_TIME);
    this.previousTime = timestamp;
    this.accumulator += elapsed;

    while (this.accumulator >= FIXED_TIMESTEP) {
      this.update(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.render(this.accumulator / FIXED_TIMESTEP);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}