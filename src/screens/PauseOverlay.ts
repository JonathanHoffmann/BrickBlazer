import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { AudioSystem } from '../systems/AudioSystem';
import { GameState, type GameContext, type Screen } from '../types';
import type { InputSystem } from '../systems/InputSystem';
import { drawButton, hitButton, type ScreenButton } from './screenUi';
import { SettingsPanel } from './SettingsPanel';

export class PauseOverlay implements Screen {
  private readonly audio = new AudioSystem();
  private readonly settingsPanel = new SettingsPanel({ showButton: false, placement: 'center' });
  private context: GameContext | null = null;
  private readonly buttons: ScreenButton[] = [
    {
      id: 'resume',
      label: 'Resume',
      rect: { x: CANVAS_WIDTH / 2 - 86, y: CANVAS_HEIGHT / 2 - 38, width: 172, height: 50 },
      accent: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      rect: { x: CANVAS_WIDTH / 2 - 86, y: CANVAS_HEIGHT / 2 + 24, width: 172, height: 50 },
    },
    {
      id: 'quit',
      label: 'Quit',
      rect: { x: CANVAS_WIDTH / 2 - 86, y: CANVAS_HEIGHT / 2 + 86, width: 172, height: 50 },
    },
  ];

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
  }

  exit(): void {
    this.context = null;
  }

  update(_dt: number): void {
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.68)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paused', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 108);

    for (const button of this.buttons) {
      drawButton(ctx, button);
    }

    this.settingsPanel.render(ctx);

    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    if (this.settingsPanel.handleInput(input)) {
      input.clearPointerTarget();
      input.clearTransientActions();
      return;
    }

    const clickedButton = hitButton(this.buttons, input.consumePointerPress());

    if (clickedButton?.id === 'resume') {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.PLAYING);
      return;
    }

    if (clickedButton?.id === 'settings') {
      this.audio.play('buttonPress');
      this.settingsPanel.openPanel();
      input.clearPointerTarget();
      input.clearTransientActions();
      return;
    }

    if (clickedButton?.id === 'quit') {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.LEVEL_SELECT);
      return;
    }

    if (input.isPausePressed()) {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.PLAYING);
      return;
    }

    input.isLaunchPressed();
  }
}