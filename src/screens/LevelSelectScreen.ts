import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { getLevelSignature, levels } from '../levels';
import { SaveManager } from '../storage/SaveManager';
import { AudioSystem } from '../systems/AudioSystem';
import { GameState, type GameContext, type SaveData, type Screen, type Vec2 } from '../types';
import type { InputSystem } from '../systems/InputSystem';
import { SettingsPanel } from './SettingsPanel';
import { hitButton, type ScreenButton } from './screenUi';

const GRID_COLS = 3;
const CELL_WIDTH = 118;
const CELL_HEIGHT = 74;
const CELL_GAP = 14;
const GRID_START_X = (CANVAS_WIDTH - GRID_COLS * CELL_WIDTH - (GRID_COLS - 1) * CELL_GAP) / 2;
const GRID_START_Y = 172;
const VIEWPORT_TOP = 154;
const VIEWPORT_BOTTOM = CANVAS_HEIGHT - 24;
const VIEWPORT_HEIGHT = VIEWPORT_BOTTOM - VIEWPORT_TOP;
const DRAG_CLICK_THRESHOLD = 6;

function pointInScrollViewport(point: Vec2 | null): boolean {
  return Boolean(point)
    && point!.x >= 0
    && point!.x <= CANVAS_WIDTH
    && point!.y >= VIEWPORT_TOP
    && point!.y <= VIEWPORT_BOTTOM;
}

export class LevelSelectScreen implements Screen {
  private readonly saveManager = new SaveManager();
  private readonly audio = new AudioSystem();
  private readonly settingsPanel = new SettingsPanel({
    onHighScoresReset: () => this.refreshSaveData(),
  });
  private context: GameContext | null = null;
  private saveData: SaveData = this.saveManager.load();
  private levelButtons: ScreenButton[] = [];
  private scrollOffset = 0;
  private dragPreviousY: number | null = null;
  private dragDistance = 0;
  private scrolling = false;
  private readonly backButton: ScreenButton = {
    id: 'back',
    label: '',
    rect: { x: 18, y: 20, width: 42, height: 38 },
  };

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.scrollOffset = this.getScrollOffsetForLevel(context.getSelectedLevelIndex());
    this.refreshSaveData();
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

    this.drawBackButton(ctx);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Select Level', CANVAS_WIDTH / 2, 84);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`Unlocked through Level ${Math.min(this.saveData.highestUnlocked + 1, levels.length)}`, CANVAS_WIDTH / 2, 122);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, VIEWPORT_TOP, CANVAS_WIDTH, VIEWPORT_HEIGHT);
    ctx.clip();
    for (const button of this.levelButtons) {
      this.drawLevelCell(ctx, button);
    }
    ctx.restore();

    this.drawScrollBar(ctx);

    this.settingsPanel.render(ctx);

    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    if (this.settingsPanel.handleInput(input)) {
      return;
    }

    if (hitButton([this.backButton], input.peekPointerPress())) {
      input.consumePointerPress();
      input.clearTransientActions();
      this.audio.play('buttonPress');
      this.context?.setState(GameState.TITLE);
      return;
    }

    const levelClickPoint = this.handleScrollInput(input);

    const clickedButton = hitButton(this.levelButtons, levelClickPoint);

    if (!clickedButton) {
      return;
    }

    const levelIndex = Number(clickedButton.id.replace('level-', ''));

    if (Number.isInteger(levelIndex)) {
      this.audio.play('buttonPress');
      this.context?.startLevel(levelIndex);
    }
  }

  private createLevelButton(levelIndex: number): ScreenButton {
    const col = levelIndex % GRID_COLS;
    const row = Math.floor(levelIndex / GRID_COLS);

    return {
      id: `level-${levelIndex}`,
      label: `Level ${levelIndex + 1}`,
      rect: {
        x: GRID_START_X + col * (CELL_WIDTH + CELL_GAP),
        y: GRID_START_Y + row * (CELL_HEIGHT + CELL_GAP) - this.scrollOffset,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
      },
      disabled: levelIndex > this.saveData.highestUnlocked,
      accent: levelIndex === this.context?.getSelectedLevelIndex(),
    };
  }

  private refreshSaveData(): void {
    this.saveData = this.saveManager.load();
    this.setScrollOffset(this.scrollOffset);
  }

  private handleScrollInput(input: InputSystem): Vec2 | null {
    const scrollDelta = input.consumeScrollDelta();

    if (scrollDelta !== 0) {
      this.setScrollOffset(this.scrollOffset + scrollDelta);
    }

    const pointerPress = input.peekPointerPress();

    if (!this.scrolling && pointInScrollViewport(pointerPress)) {
      this.scrolling = true;
      this.dragPreviousY = pointerPress?.y ?? null;
      this.dragDistance = 0;
    }

    if (this.scrolling && input.isPointerDown()) {
      const pointerPosition = input.getPointerPosition();

      if (pointerPosition && this.dragPreviousY !== null) {
        const deltaY = pointerPosition.y - this.dragPreviousY;
        this.dragPreviousY = pointerPosition.y;
        this.dragDistance += Math.abs(deltaY);

        if (deltaY !== 0) {
          this.setScrollOffset(this.scrollOffset - deltaY);
        }

        if (this.dragDistance > DRAG_CLICK_THRESHOLD) {
          input.consumePointerPress();
          input.clearTransientActions();
        }
      }

      return null;
    }

    if (!this.scrolling) {
      return null;
    }

    const pointerRelease = input.consumePointerRelease();
    input.consumePointerPress();

    const clickPoint = this.dragDistance <= DRAG_CLICK_THRESHOLD && pointInScrollViewport(pointerRelease)
      ? pointerRelease
      : null;

    this.scrolling = false;
    this.dragPreviousY = null;
    this.dragDistance = 0;

    return clickPoint;
  }

  private setScrollOffset(scrollOffset: number): void {
    this.scrollOffset = Math.min(Math.max(scrollOffset, 0), this.getMaxScrollOffset());
    this.levelButtons = levels.map((_, levelIndex) => this.createLevelButton(levelIndex));
  }

  private getScrollOffsetForLevel(levelIndex: number): number {
    const row = Math.floor(levelIndex / GRID_COLS);
    const targetY = GRID_START_Y + row * (CELL_HEIGHT + CELL_GAP) - VIEWPORT_TOP - CELL_GAP;

    return Math.min(Math.max(targetY, 0), this.getMaxScrollOffset());
  }

  private getMaxScrollOffset(): number {
    const rowCount = Math.ceil(levels.length / GRID_COLS);
    const contentHeight = rowCount * CELL_HEIGHT + Math.max(rowCount - 1, 0) * CELL_GAP;
    const contentBottom = GRID_START_Y + contentHeight;

    return Math.max(contentBottom - VIEWPORT_BOTTOM, 0);
  }

  private drawScrollBar(ctx: CanvasRenderingContext2D): void {
    const maxScrollOffset = this.getMaxScrollOffset();

    if (maxScrollOffset <= 0) {
      return;
    }

    const trackX = CANVAS_WIDTH - 10;
    const trackY = VIEWPORT_TOP + 8;
    const trackHeight = VIEWPORT_HEIGHT - 16;
    const thumbHeight = Math.max((VIEWPORT_HEIGHT / (VIEWPORT_HEIGHT + maxScrollOffset)) * trackHeight, 42);
    const thumbY = trackY + (this.scrollOffset / maxScrollOffset) * (trackHeight - thumbHeight);

    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, 4, trackHeight, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(103, 232, 249, 0.8)';
    ctx.beginPath();
    ctx.roundRect(trackX, thumbY, 4, thumbHeight, 3);
    ctx.fill();
    ctx.restore();
  }

  private drawBackButton(ctx: CanvasRenderingContext2D): void {
    const { x, y, width, height } = this.backButton.rect;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX + 8, centerY);
    ctx.lineTo(centerX - 7, centerY);
    ctx.moveTo(centerX - 1, centerY - 7);
    ctx.lineTo(centerX - 8, centerY);
    ctx.lineTo(centerX - 1, centerY + 7);
    ctx.stroke();
    ctx.restore();
  }

  private drawLevelCell(ctx: CanvasRenderingContext2D, button: ScreenButton): void {
    const levelIndex = Number(button.id.replace('level-', ''));
    const levelSignature = getLevelSignature(levelIndex);
    const bestScore = this.saveData.bestScores[levelSignature] ?? this.saveData.bestScores[String(levelIndex)] ?? 0;
    const completed = bestScore > 0;

    ctx.save();
    ctx.globalAlpha = button.disabled ? 0.44 : 1;
    ctx.fillStyle = button.disabled ? '#1e293b' : button.accent ? '#155e75' : '#172033';
    ctx.strokeStyle = completed ? '#67e8f9' : '#334155';
    ctx.lineWidth = completed ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(button.rect.x, button.rect.y, button.rect.width, button.rect.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = button.disabled ? '#64748b' : '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (button.disabled) {
      this.drawLockIcon(ctx, button.rect.x + button.rect.width / 2, button.rect.y + 20);
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillText(`${levelIndex + 1}`, button.rect.x + button.rect.width / 2, button.rect.y + 43);
    } else {
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText(`${levelIndex + 1}`, button.rect.x + button.rect.width / 2, button.rect.y + 25);
    }

    ctx.fillStyle = button.disabled ? '#64748b' : '#bae6fd';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(button.disabled ? 'Locked' : `Best ${bestScore}`, button.rect.x + button.rect.width / 2, button.rect.y + 57);

    if (completed) {
      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(button.rect.x + button.rect.width - 30, button.rect.y + 19);
      ctx.lineTo(button.rect.x + button.rect.width - 23, button.rect.y + 27);
      ctx.lineTo(button.rect.x + button.rect.width - 12, button.rect.y + 13);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawLockIcon(ctx: CanvasRenderingContext2D, centerX: number, centerY: number): void {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.fillStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.arc(centerX, centerY - 1, 7, Math.PI, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(centerX - 10, centerY - 1, 20, 15, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(centerX, centerY + 6, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(centerX - 1, centerY + 7, 2, 4);
    ctx.restore();
  }
}