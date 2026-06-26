import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { AudioSystem } from '../systems/AudioSystem';
import { GameState, type GameContext, type GameRunResult, type Screen } from '../types';
import type { InputSystem } from '../systems/InputSystem';
import { drawButton, hitButton, type ScreenButton } from './screenUi';

export class GameOverScreen implements Screen {
  private readonly audio = new AudioSystem();
  private context: GameContext | null = null;
  private result: GameRunResult | null = null;
  private readonly buttons: ScreenButton[] = [
    {
      id: 'retry',
      label: 'Retry',
      rect: { x: CANVAS_WIDTH / 2 - 92, y: 444, width: 184, height: 52 },
      accent: true,
    },
    {
      id: 'menu',
      label: 'Menu',
      rect: { x: CANVAS_WIDTH / 2 - 92, y: 512, width: 184, height: 52 },
    },
  ];

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.result = context.getRunResult();
  }

  exit(): void {
    this.context = null;
  }

  update(_dt: number): void {
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    const levelNumber = (this.result?.levelIndex ?? this.context?.getSelectedLevelIndex() ?? 0) + 1;
    const score = this.result?.score ?? 0;
    const maxCombo = this.result?.maxCombo ?? 0;

    ctx.save();
    ctx.fillStyle = '#101624';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', CANVAS_WIDTH / 2, 174);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(`Level ${levelNumber}`, CANVAS_WIDTH / 2, 230);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 42px system-ui, sans-serif';
    ctx.fillText(`${score}`, CANVAS_WIDTH / 2, 296);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(`Max Combo ${maxCombo}`, CANVAS_WIDTH / 2, 346);

    for (const button of this.buttons) {
      drawButton(ctx, button);
    }

    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    const clickedButton = hitButton(this.buttons, input.consumePointerPress());

    if (clickedButton?.id === 'retry') {
      this.audio.play('buttonPress');
      this.retry();
      return;
    }

    if (clickedButton?.id === 'menu') {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.LEVEL_SELECT);
      return;
    }

    if (input.isLaunchPressed()) {
      this.audio.play('buttonPress');
      this.retry();
    }
  }

  private retry(): void {
    if (this.result) {
      this.context?.startLevel(this.result.levelIndex);
      return;
    }

    this.context?.restartLevel();
  }
}