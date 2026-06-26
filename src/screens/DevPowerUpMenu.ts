import { CANVAS_WIDTH, GAME_TOP_BAR_HEIGHT } from '../constants';
import type { InputSystem } from '../systems/InputSystem';
import { PowerUpType } from '../types';
import { drawButton, hitButton, type ScreenButton } from './screenUi';

const POWERUP_OPTIONS = Object.values(PowerUpType) as PowerUpType[];
const PANEL_X = 8;
const PANEL_Y = GAME_TOP_BAR_HEIGHT + 8;
const BUTTON_HEIGHT = 30;
const BUTTON_GAP = 6;
const PANEL_WIDTH = 200;
const CLEAR_LEVEL_BUTTON_ID = 'dev-clear-level';

const POWERUP_LABELS: Record<PowerUpType, string> = {
  [PowerUpType.MultiBall]: 'Multi Ball',
  [PowerUpType.WidePaddle]: 'Wide Paddle',
  [PowerUpType.LaserPaddle]: 'Laser Paddle',
  [PowerUpType.SlowBall]: 'Slow Ball',
  [PowerUpType.Fireball]: 'Fireball',
  [PowerUpType.StickyPaddle]: 'Sticky Paddle',
  [PowerUpType.ExtraLife]: 'Extra Life',
  [PowerUpType.NarrowPaddle]: 'Narrow Paddle',
  [PowerUpType.FastBall]: 'Fast Ball',
};

export class DevPowerUpMenu {
  private open = false;
  private pendingDrop: PowerUpType | null = null;
  private clearLevelRequested = false;
  private readonly toggleButton: ScreenButton = {
    id: 'dev-powerups-toggle',
    label: 'Dev',
    rect: { x: PANEL_X, y: PANEL_Y, width: 58, height: BUTTON_HEIGHT },
  };

  handleInput(input: InputSystem): boolean {
    const pointerPress = input.peekPointerPress();

    if (!pointerPress) {
      return false;
    }

    const toggleHit = hitButton([this.toggleButton], pointerPress);
    const optionHit = this.open ? hitButton(this.createOptionButtons(), pointerPress) : null;

    if (!toggleHit && !optionHit) {
      return false;
    }

    input.consumePointerPress();
    input.clearTransientActions();

    if (toggleHit) {
      this.open = !this.open;
      return true;
    }

    if (optionHit) {
      if (optionHit.id === CLEAR_LEVEL_BUTTON_ID) {
        this.clearLevelRequested = true;
        return true;
      }

      this.pendingDrop = optionHit.id.replace('dev-powerup-', '') as PowerUpType;
      return true;
    }

    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawButton(ctx, {
      ...this.toggleButton,
      accent: this.open,
    });

    if (!this.open) {
      return;
    }

    this.drawPanel(ctx);
  }

  consumeDrop(): PowerUpType | null {
    const type = this.pendingDrop;
    this.pendingDrop = null;
    return type;
  }

  consumeClearLevel(): boolean {
    const requested = this.clearLevelRequested;
    this.clearLevelRequested = false;
    return requested;
  }

  private drawPanel(ctx: CanvasRenderingContext2D): void {
    const optionButtons = this.createOptionButtons();
    const panelHeight = 50 + optionButtons.length * (BUTTON_HEIGHT + BUTTON_GAP);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(PANEL_X, PANEL_Y + 38, PANEL_WIDTH, panelHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Dev Power-Up Drop', PANEL_X + 12, PANEL_Y + 58);

    for (const button of optionButtons) {
      drawButton(ctx, button);
    }
    ctx.restore();
  }

  private createOptionButtons(): ScreenButton[] {
    return [
      {
        id: CLEAR_LEVEL_BUTTON_ID,
        label: 'Clear Level',
        rect: {
          x: PANEL_X + 12,
          y: PANEL_Y + 80,
          width: PANEL_WIDTH - 24,
          height: BUTTON_HEIGHT,
        },
      },
      ...POWERUP_OPTIONS.map((type, index) => ({
        id: `dev-powerup-${type}`,
        label: POWERUP_LABELS[type],
        rect: {
          x: PANEL_X + 12,
          y: PANEL_Y + 80 + (index + 1) * (BUTTON_HEIGHT + BUTTON_GAP),
          width: PANEL_WIDTH - 24,
          height: BUTTON_HEIGHT,
        },
      })),
    ];
  }
}