import { CANVAS_HEIGHT, CANVAS_WIDTH, LEVELS_UNLOCKED_AHEAD } from '../constants';
import { levels } from '../levels';
import { SaveManager } from '../storage/SaveManager';
import { AudioSystem } from '../systems/AudioSystem';
import { GameState, type GameContext, type GameRunResult, type Screen } from '../types';
import type { InputSystem } from '../systems/InputSystem';
import { drawButton, hitButton, type ScreenButton } from './screenUi';

export class LevelCompleteScreen implements Screen {
  private readonly saveManager = new SaveManager();
  private readonly audio = new AudioSystem();
  private context: GameContext | null = null;
  private result: GameRunResult | null = null;
  private bestScore = 0;
  private newBest = false;
  private buttons: ScreenButton[] = [];

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.result = context.getRunResult();
    this.saveResult();
    this.buttons = this.createButtons();
  }

  exit(): void {
    this.context = null;
  }

  update(_dt: number): void {
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    const levelNumber = (this.result?.levelIndex ?? 0) + 1;
    const score = this.result?.score ?? 0;
    const maxCombo = this.result?.maxCombo ?? 0;
    const finalLevelCleared = (this.result?.levelIndex ?? 0) + 1 >= levels.length;

    ctx.save();
    ctx.fillStyle = '#101624';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(finalLevelCleared ? 'You Win!' : 'Level Complete', CANVAS_WIDTH / 2, 172);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(`Level ${levelNumber}`, CANVAS_WIDTH / 2, 224);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 42px system-ui, sans-serif';
    ctx.fillText(`${score}`, CANVAS_WIDTH / 2, 292);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(`${this.newBest ? 'New Best' : 'Best'} ${this.bestScore}`, CANVAS_WIDTH / 2, 340);
    ctx.fillText(`Max Combo ${maxCombo}`, CANVAS_WIDTH / 2, 370);

    for (const button of this.buttons) {
      drawButton(ctx, button);
    }

    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    const clickedButton = hitButton(this.buttons, input.consumePointerPress());

    if (clickedButton?.id === 'next') {
      this.audio.play('buttonPress');
      this.startNextLevel();
      return;
    }

    if (clickedButton?.id === 'menu') {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.LEVEL_SELECT);
      return;
    }

    if (input.isLaunchPressed()) {
      this.audio.play('buttonPress');
      this.startNextLevel();
    }
  }

  private saveResult(): void {
    if (!this.result?.completed) {
      this.bestScore = 0;
      this.newBest = false;
      return;
    }

    const saveData = this.saveManager.load();
    const previousBest = saveData.bestScores[this.result.levelIndex] ?? 0;
    this.newBest = this.result.score > previousBest;
    this.bestScore = Math.max(previousBest, this.result.score);
    saveData.bestScores[this.result.levelIndex] = this.bestScore;
    saveData.highestUnlocked = Math.max(
      saveData.highestUnlocked,
      Math.min(this.result.levelIndex + LEVELS_UNLOCKED_AHEAD, levels.length - 1),
    );
    this.saveManager.save(saveData);
  }

  private createButtons(): ScreenButton[] {
    const hasNextLevel = (this.result?.levelIndex ?? 0) + 1 < levels.length;

    if (!hasNextLevel) {
      return [
        {
          id: 'menu',
          label: 'Level Select',
          rect: { x: CANVAS_WIDTH / 2 - 96, y: 456, width: 192, height: 52 },
          accent: true,
        },
      ];
    }

    return [
      {
        id: 'next',
        label: 'Next Level',
        rect: { x: CANVAS_WIDTH / 2 - 96, y: 456, width: 192, height: 52 },
        accent: true,
      },
      {
        id: 'menu',
        label: 'Menu',
        rect: { x: CANVAS_WIDTH / 2 - 96, y: 524, width: 192, height: 52 },
      },
    ];
  }

  private startNextLevel(): void {
    const levelIndex = this.result?.levelIndex ?? 0;
    const nextLevelIndex = levelIndex + 1;

    if (nextLevelIndex < levels.length) {
      this.context?.startLevel(nextLevelIndex);
      return;
    }

    this.context?.setState(GameState.LEVEL_SELECT);
  }
}