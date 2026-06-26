import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { DEV_TOOLS_ENABLED } from '../devFlags';
import { SaveManager } from '../storage/SaveManager';
import { AudioSystem } from '../systems/AudioSystem';
import { GameState, type GameContext, type Screen } from '../types';
import type { InputSystem } from '../systems/InputSystem';
import { SettingsPanel } from './SettingsPanel';
import { drawButton, hitButton, type ScreenButton } from './screenUi';

export class TitleScreen implements Screen {
  private readonly saveManager = new SaveManager();
  private readonly audio = new AudioSystem();
  private readonly settingsPanel = new SettingsPanel({
    onHighScoresReset: () => this.refreshHighScore(),
  });
  private context: GameContext | null = null;
  private highScore = 0;
  private readonly playButton: ScreenButton = {
    id: 'play',
    label: 'Play',
    rect: { x: CANVAS_WIDTH / 2 - 82, y: CANVAS_HEIGHT / 2 + (DEV_TOOLS_ENABLED ? 30 : 54), width: 164, height: 52 },
    accent: true,
  };
  private readonly levelEditorButton: ScreenButton = {
    id: 'level-editor',
    label: 'Level Editor',
    rect: { x: CANVAS_WIDTH / 2 - 82, y: CANVAS_HEIGHT / 2 + 94, width: 164, height: 48 },
  };

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.refreshHighScore();
  }

  exit(): void {
    this.context = null;
  }

  update(_dt: number): void {
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    ctx.save();
    ctx.fillStyle = '#101624';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.drawLogo(ctx);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Brickblaze', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 86);

    ctx.fillStyle = '#bae6fd';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(`High Score ${this.highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 38);

    drawButton(ctx, this.playButton);
    if (DEV_TOOLS_ENABLED) {
      drawButton(ctx, this.levelEditorButton);
    }
    this.settingsPanel.render(ctx);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(
      'Clear boards, chase combos, unlock every level',
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + (DEV_TOOLS_ENABLED ? 166 : 136),
    );
    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    if (this.settingsPanel.handleInput(input)) {
      return;
    }

    const pointerPress = input.consumePointerPress();
    const clickedButton = hitButton(DEV_TOOLS_ENABLED ? [this.playButton, this.levelEditorButton] : [this.playButton], pointerPress);

    if (clickedButton?.id === 'level-editor') {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.LEVEL_EDITOR);
      return;
    }

    if (clickedButton || input.isLaunchPressed()) {
      this.audio.play('buttonPress');
      this.context?.setState(GameState.LEVEL_SELECT);
    }
  }

  private refreshHighScore(): void {
    const saveData = this.saveManager.load();
    this.highScore = Math.max(0, ...Object.values(saveData.bestScores));
  }

  private drawLogo(ctx: CanvasRenderingContext2D): void {
    const centerX = CANVAS_WIDTH / 2;
    const logoY = CANVAS_HEIGHT / 2 - 198;

    ctx.save();
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(centerX - 70, logoY, 140, 84, 12);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.roundRect(centerX - 70, logoY, 140, 30, 12);
    ctx.fill();

    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.78;
    for (const lineY of [logoY + 30, logoY + 58]) {
      ctx.beginPath();
      ctx.moveTo(centerX - 70, lineY);
      ctx.lineTo(centerX + 70, lineY);
      ctx.stroke();
    }

    for (const line of [
      { x: centerX - 26, y1: logoY, y2: logoY + 30 },
      { x: centerX + 24, y1: logoY + 30, y2: logoY + 58 },
      { x: centerX - 32, y1: logoY + 58, y2: logoY + 84 },
      { x: centerX + 34, y1: logoY + 58, y2: logoY + 84 },
    ]) {
      ctx.beginPath();
      ctx.moveTo(line.x, line.y1);
      ctx.lineTo(line.x, line.y2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(centerX, logoY);
    ctx.lineTo(centerX - 12, logoY + 32);
    ctx.lineTo(centerX + 8, logoY + 25);
    ctx.lineTo(centerX - 6, logoY + 84);
    ctx.lineTo(centerX + 28, logoY + 18);
    ctx.lineTo(centerX + 6, logoY + 28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, logoY + 2);
    ctx.lineTo(centerX - 12, logoY + 32);
    ctx.lineTo(centerX + 8, logoY + 25);
    ctx.lineTo(centerX - 6, logoY + 80);
    ctx.stroke();

    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#67e8f9';
    ctx.beginPath();
    ctx.arc(centerX + 78, logoY - 12, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(centerX + 73, logoY - 17, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}