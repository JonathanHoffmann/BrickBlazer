import { BRICK_COLS, BRICK_ROWS, CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { textLevelDefinitions, type TextLevelDefinition } from '../levels';
import { parseTextLevel } from '../levels/parseTextLevel';
import { POWERUP_LABELS, POWERUP_TYPES } from '../powerUpConfig';
import { AudioSystem } from '../systems/AudioSystem';
import type { InputSystem } from '../systems/InputSystem';
import { BrickType, GameState, type GameContext, type PowerUpWeights, type Screen, type Vec2 } from '../types';
import { drawButton, hitButton, type ScreenButton } from './screenUi';

type EditableSymbol = '.' | '1' | '2' | '3' | 'U' | 'T' | 'S';

interface PaletteItem {
  symbol: EditableSymbol;
  label: string;
  color: string;
}

interface GridCell {
  row: number;
  col: number;
}

const CELL_WIDTH = 34;
const CELL_HEIGHT = 19;
const CELL_GAP = 3;
const GRID_WIDTH = BRICK_COLS * CELL_WIDTH + (BRICK_COLS - 1) * CELL_GAP;
const GRID_HEIGHT = BRICK_ROWS * CELL_HEIGHT + (BRICK_ROWS - 1) * CELL_GAP;
const GRID_X = (CANVAS_WIDTH - GRID_WIDTH) / 2;
const GRID_Y = 156;
const PALETTE_Y = 532;
const PALETTE_BUTTON_WIDTH = 46;
const PALETTE_BUTTON_HEIGHT = 48;
const PALETTE_GAP = 9;
const POWERUP_PANEL_WIDTH = 380;
const POWERUP_PANEL_HEIGHT = 560;
const POWERUP_PANEL_X = (CANVAS_WIDTH - POWERUP_PANEL_WIDTH) / 2;
const POWERUP_PANEL_Y = 118;
const POWERUP_ROW_HEIGHT = 38;

const PALETTE: PaletteItem[] = [
  { symbol: '.', label: 'Empty', color: '#0f172a' },
  { symbol: '1', label: '1', color: '#38bdf8' },
  { symbol: '2', label: '2', color: '#f97316' },
  { symbol: '3', label: '3', color: '#84cc16' },
  { symbol: 'U', label: 'U', color: '#64748b' },
  { symbol: 'T', label: 'T', color: '#ef4444' },
  { symbol: 'S', label: 'S', color: '#facc15' },
];

const BRICK_SYMBOLS: Record<BrickType, EditableSymbol> = {
  [BrickType.Empty]: '.',
  [BrickType.Standard]: '1',
  [BrickType.Tough]: '2',
  [BrickType.Armored]: '3',
  [BrickType.Unbreakable]: 'U',
  [BrickType.Explosive]: 'T',
  [BrickType.Sensor]: 'S',
};

const SYMBOL_COLORS = Object.fromEntries(PALETTE.map((item) => [item.symbol, item.color])) as Record<EditableSymbol, string>;
const PALETTE_X = (CANVAS_WIDTH - (PALETTE.length * PALETTE_BUTTON_WIDTH + (PALETTE.length - 1) * PALETTE_GAP)) / 2;
const KEYBOARD_SYMBOLS: Record<string, EditableSymbol> = {
  '.': '.',
  '0': '.',
  '1': '1',
  '2': '2',
  '3': '3',
  u: 'U',
  U: 'U',
  t: 'T',
  T: 'T',
  s: 'S',
  S: 'S',
};

function clampLevelIndex(levelIndex: number): number {
  return Math.min(Math.max(levelIndex, 0), textLevelDefinitions.length);
}

function formatSpeed(speed: number): string {
  return speed.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function cloneGrid(level: TextLevelDefinition): EditableSymbol[][] {
  return level.data.grid.map((row) => row.map((brickType) => BRICK_SYMBOLS[brickType as BrickType] ?? '.'));
}

function createEmptyGrid(): EditableSymbol[][] {
  return Array.from({ length: BRICK_ROWS }, () => Array.from({ length: BRICK_COLS }, () => '.'));
}

function getLevelNumber(fileName: string): number {
  return Number(fileName.match(/^level(\d+)\.txt$/)?.[1] ?? 0);
}

function getNextLevelFileName(): string {
  const lastLevelNumber = Math.max(0, ...textLevelDefinitions.map((level) => getLevelNumber(level.fileName)));

  return `level${String(lastLevelNumber + 1).padStart(2, '0')}.txt`;
}

export class LevelEditorScreen implements Screen {
  private readonly audio = new AudioSystem();
  private context: GameContext | null = null;
  private levelIndex = 0;
  private selectedSymbol: EditableSymbol = '1';
  private grid: EditableSymbol[][] = cloneGrid(textLevelDefinitions[0]);
  private speed = textLevelDefinitions[0].data.ballSpeedMultiplier;
  private powerUpDropChance = textLevelDefinitions[0].data.powerUpDropChance;
  private powerUpWeights: PowerUpWeights = { ...textLevelDefinitions[0].data.powerUpWeights };
  private powerUpPanelOpen = false;
  private dragStartCell: GridCell | null = null;
  private dragCurrentCell: GridCell | null = null;
  private dirty = false;
  private saving = false;
  private statusMessage = 'Select a brick type and paint the grid';

  private readonly backButton: ScreenButton = {
    id: 'back',
    label: 'Back',
    rect: { x: 18, y: 20, width: 82, height: 38 },
  };
  private readonly prevButton: ScreenButton = {
    id: 'prev',
    label: 'Prev',
    rect: { x: 32, y: 108, width: 82, height: 38 },
  };
  private readonly nextButton: ScreenButton = {
    id: 'next',
    label: 'Next',
    rect: { x: CANVAS_WIDTH - 114, y: 108, width: 82, height: 38 },
  };
  private readonly speedDownButton: ScreenButton = {
    id: 'speed-down',
    label: '-',
    rect: { x: 120, y: 642, width: 44, height: 38 },
  };
  private readonly speedUpButton: ScreenButton = {
    id: 'speed-up',
    label: '+',
    rect: { x: CANVAS_WIDTH - 164, y: 642, width: 44, height: 38 },
  };
  private readonly clearButton: ScreenButton = {
    id: 'clear',
    label: 'Clear',
    rect: { x: 32, y: 704, width: 92, height: 46 },
  };
  private readonly powerUpsButton: ScreenButton = {
    id: 'powerups',
    label: 'Drops',
    rect: { x: CANVAS_WIDTH - 124, y: 704, width: 92, height: 46 },
  };
  private readonly saveButton: ScreenButton = {
    id: 'save',
    label: 'Save to code',
    rect: { x: CANVAS_WIDTH / 2 - 88, y: 704, width: 176, height: 46 },
    accent: true,
  };

  enter(context: GameContext): void {
    this.context = context;
    this.audio.preload();
    this.audio.startMusic();
    this.loadLevel(this.levelIndex);
  }

  exit(): void {
    this.context = null;
  }

  update(_dt: number): void {
  }

  render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    const fileName = this.getCurrentFileName();

    ctx.save();
    ctx.fillStyle = '#101624';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Level Editor', CANVAS_WIDTH / 2, 42);

    drawButton(ctx, this.backButton);
    drawButton(ctx, { ...this.prevButton, disabled: this.levelIndex === 0 });
    drawButton(ctx, { ...this.nextButton, disabled: this.levelIndex >= textLevelDefinitions.length });

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(`Level ${this.levelIndex + 1}`, CANVAS_WIDTH / 2, 106);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(fileName, CANVAS_WIDTH / 2, 130);

    this.drawGrid(ctx);
    this.drawPalette(ctx);
    this.drawSpeedControl(ctx);

    drawButton(ctx, { ...this.clearButton, disabled: this.saving });
    drawButton(ctx, { ...this.powerUpsButton, accent: this.powerUpPanelOpen });
    drawButton(ctx, { ...this.saveButton, disabled: this.saving || !this.dirty });

    ctx.fillStyle = this.dirty ? '#fde68a' : '#94a3b8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(this.statusMessage, CANVAS_WIDTH / 2, 778);

    if (this.powerUpPanelOpen) {
      this.drawPowerUpPanel(ctx);
    }

    ctx.restore();
  }

  handleInput(input: InputSystem): void {
    if (this.powerUpPanelOpen && this.handlePowerUpPanelInput(input)) {
      return;
    }

    const keySymbol = this.getKeyboardSymbol(input);

    if (keySymbol) {
      this.selectedSymbol = keySymbol;
      this.audio.play('buttonPress');
      return;
    }

    const pointerPress = input.consumePointerPress();
    const clickedButton = hitButton(this.getButtons(), pointerPress);

    if (clickedButton) {
      this.handleButton(clickedButton.id);
      return;
    }

    const paletteSymbol = this.getPaletteSymbol(pointerPress);

    if (paletteSymbol) {
      this.selectedSymbol = paletteSymbol;
      this.audio.play('buttonPress');
      return;
    }

    if (this.handleGridDrag(input, pointerPress)) {
      return;
    }

    if (input.isPausePressed()) {
      this.context?.setState(GameState.TITLE);
    }
  }

  private handleGridDrag(input: InputSystem, pointerPress: Vec2 | null): boolean {
    if (!this.dragStartCell) {
      const gridCell = this.getGridCell(pointerPress);

      if (!gridCell) {
        return false;
      }

      this.dragStartCell = gridCell;
      this.dragCurrentCell = gridCell;
      this.statusMessage = 'Dragging selection';
      return true;
    }

    if (input.isPointerDown()) {
      this.dragCurrentCell = this.getClampedGridCell(input.getPointerPosition()) ?? this.dragCurrentCell;
      return true;
    }

    const pointerRelease = input.consumePointerRelease();

    if (pointerRelease) {
      this.dragCurrentCell = this.getClampedGridCell(pointerRelease) ?? this.dragCurrentCell;
      this.fillDragSelection();
      return true;
    }

    this.dragStartCell = null;
    this.dragCurrentCell = null;
    return false;
  }

  private fillDragSelection(): void {
    const selection = this.getDragSelection();

    if (!selection) {
      return;
    }

    let changedCells = 0;

    for (let row = selection.startRow; row <= selection.endRow; row += 1) {
      for (let col = selection.startCol; col <= selection.endCol; col += 1) {
        if (this.grid[row][col] !== this.selectedSymbol) {
          this.grid[row][col] = this.selectedSymbol;
          changedCells += 1;
        }
      }
    }

    this.dragStartCell = null;
    this.dragCurrentCell = null;

    if (changedCells > 0) {
      this.markDirty();
      this.statusMessage = `Filled ${changedCells} cell${changedCells === 1 ? '' : 's'}`;
    } else {
      this.statusMessage = 'Selection already matched';
    }
  }

  private getButtons(): ScreenButton[] {
    return [
      this.backButton,
      { ...this.prevButton, disabled: this.levelIndex === 0 },
      { ...this.nextButton, disabled: this.levelIndex >= textLevelDefinitions.length },
      this.speedDownButton,
      this.speedUpButton,
      { ...this.clearButton, disabled: this.saving },
      this.powerUpsButton,
      { ...this.saveButton, disabled: this.saving || !this.dirty },
    ];
  }

  private getKeyboardSymbol(input: InputSystem): EditableSymbol | null {
    const key = input.consumeKeyPress(...Object.keys(KEYBOARD_SYMBOLS));

    return key ? KEYBOARD_SYMBOLS[key] : null;
  }

  private handleButton(buttonId: string): void {
    this.audio.play('buttonPress');

    switch (buttonId) {
      case 'back':
        this.context?.setState(GameState.TITLE);
        break;
      case 'prev':
        this.loadLevel(this.levelIndex - 1);
        break;
      case 'next':
        this.loadLevel(this.levelIndex + 1);
        break;
      case 'speed-down':
        this.setSpeed(this.speed - 0.05);
        break;
      case 'speed-up':
        this.setSpeed(this.speed + 0.05);
        break;
      case 'clear':
        this.clearGrid();
        break;
      case 'powerups':
        this.powerUpPanelOpen = true;
        break;
      case 'save':
        void this.saveLevel();
        break;
    }
  }

  private loadLevel(levelIndex: number): void {
    this.levelIndex = clampLevelIndex(levelIndex);
    const level = textLevelDefinitions[this.levelIndex];

    if (level) {
      this.grid = cloneGrid(level);
      this.speed = level.data.ballSpeedMultiplier;
      this.powerUpDropChance = level.data.powerUpDropChance;
      this.powerUpWeights = { ...level.data.powerUpWeights };
      this.statusMessage = `Editing ${level.fileName}`;
    } else {
      this.grid = createEmptyGrid();
      this.speed = 1.0;
      this.powerUpDropChance = 0.15;
      this.powerUpWeights = Object.fromEntries(POWERUP_TYPES.map((type) => [type, 1])) as PowerUpWeights;
      this.statusMessage = `New level ${getNextLevelFileName()}`;
    }

    this.powerUpPanelOpen = false;
    this.dragStartCell = null;
    this.dragCurrentCell = null;
    this.dirty = false;
    this.saving = false;
  }

  private setSpeed(speed: number): void {
    this.speed = Math.min(Math.max(Number(speed.toFixed(2)), 0.1), 3);
    this.markDirty();
  }

  private clearGrid(): void {
    if (this.grid.every((row) => row.every((symbol) => symbol === '.'))) {
      this.statusMessage = 'Grid is already empty';
      return;
    }

    this.grid = Array.from({ length: BRICK_ROWS }, () => Array.from({ length: BRICK_COLS }, () => '.'));
    this.selectedSymbol = '.';
    this.markDirty();
    this.statusMessage = 'Cleared grid';
  }

  private markDirty(): void {
    this.dirty = true;
    this.statusMessage = 'Unsaved changes';
  }

  private async saveLevel(): Promise<void> {
    if (this.saving || !this.dirty) {
      return;
    }

    const fileName = this.getCurrentFileName();

    if (this.isGridEmpty()) {
      this.statusMessage = 'Empty levels cannot be saved';
      return;
    }

    const text = this.serializeLevel();
    this.saving = true;
    this.statusMessage = `Saving ${fileName}...`;

    try {
      const data = parseTextLevel(text, fileName);
      const response = await fetch('/__brickblaze/level-editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text() || 'Save failed');
      }

      const level = textLevelDefinitions[this.levelIndex];

      if (level) {
        level.text = text;
        level.data = data;
      } else {
        textLevelDefinitions.push({ fileName, text, data });
      }

      this.dirty = false;
      this.statusMessage = `Saved ${fileName}`;
    } catch (error) {
      this.statusMessage = error instanceof Error ? error.message : 'Save failed';
    } finally {
      this.saving = false;
    }
  }

  private serializeLevel(): string {
    return [
      '# 1=one hit, 2=two hit, 3=three hit, U=unbreakable, T=TNT, S=sensor, .=empty',
      '# powerupChance=overall drop chance 0..1; powerup.<name>=relative drop weight, 0 disables',
      `speed=${formatSpeed(this.speed)}`,
      `powerupChance=${formatNumber(this.powerUpDropChance)}`,
      ...POWERUP_TYPES.map((type) => `powerup.${type}=${formatNumber(this.powerUpWeights[type])}`),
      ...this.grid.map((row) => row.join('')),
    ].join('\n') + '\n';
  }

  private getCurrentFileName(): string {
    return textLevelDefinitions[this.levelIndex]?.fileName ?? getNextLevelFileName();
  }

  private isGridEmpty(): boolean {
    return this.grid.every((row) => row.every((symbol) => symbol === '.'));
  }

  private handlePowerUpPanelInput(input: InputSystem): boolean {
    const pointerPress = input.peekPointerPress();

    if (input.isPausePressed()) {
      this.powerUpPanelOpen = false;
      this.audio.play('buttonPress');
      return true;
    }

    if (!pointerPress) {
      return true;
    }

    input.consumePointerPress();
    input.clearTransientActions();

    const panelRect = { x: POWERUP_PANEL_X, y: POWERUP_PANEL_Y, width: POWERUP_PANEL_WIDTH, height: POWERUP_PANEL_HEIGHT };
    const closeButton = this.getPowerUpPanelCloseButton();
    const controlHit = hitButton(this.getPowerUpPanelButtons(), pointerPress);

    if (hitButton([closeButton], pointerPress) || !this.pointInRect(pointerPress, panelRect)) {
      this.powerUpPanelOpen = false;
      this.audio.play('buttonPress');
      return true;
    }

    if (!controlHit) {
      return true;
    }

    this.audio.play('buttonPress');

    if (controlHit.id === 'powerup-drop-down') {
      this.setPowerUpDropChance(this.powerUpDropChance - 0.05);
      return true;
    }

    if (controlHit.id === 'powerup-drop-up') {
      this.setPowerUpDropChance(this.powerUpDropChance + 0.05);
      return true;
    }

    const weightMatch = controlHit.id.match(/^powerup-weight-(.+)-(down|up)$/);
    if (weightMatch) {
      this.adjustPowerUpWeight(weightMatch[1], weightMatch[2] === 'up' ? 0.25 : -0.25);
    }

    return true;
  }

  private setPowerUpDropChance(chance: number): void {
    const nextChance = Math.min(Math.max(Number(chance.toFixed(2)), 0), 1);

    if (nextChance === this.powerUpDropChance) {
      return;
    }

    this.powerUpDropChance = nextChance;
    this.markDirty();
  }

  private adjustPowerUpWeight(powerUpId: string, delta: number): void {
    const powerUpType = POWERUP_TYPES.find((type) => type === powerUpId);

    if (!powerUpType) {
      return;
    }

    const nextWeight = Math.min(Math.max(Number(((this.powerUpWeights[powerUpType] ?? 0) + delta).toFixed(2)), 0), 9.75);

    if (nextWeight === this.powerUpWeights[powerUpType]) {
      return;
    }

    this.powerUpWeights = { ...this.powerUpWeights, [powerUpType]: nextWeight };
    this.markDirty();
  }

  private getPowerUpPanelCloseButton(): ScreenButton {
    return {
      id: 'powerup-panel-close',
      label: 'Done',
      rect: { x: POWERUP_PANEL_X + POWERUP_PANEL_WIDTH - 84, y: POWERUP_PANEL_Y + 18, width: 62, height: 34 },
    };
  }

  private getPowerUpPanelButtons(): ScreenButton[] {
    const valueButtonWidth = 34;
    const valueButtonHeight = 30;
    const leftX = POWERUP_PANEL_X + POWERUP_PANEL_WIDTH - 116;
    const rightX = POWERUP_PANEL_X + POWERUP_PANEL_WIDTH - 48;
    const firstRowY = POWERUP_PANEL_Y + 74;

    return [
      {
        id: 'powerup-drop-down',
        label: '-',
        rect: { x: leftX, y: firstRowY, width: valueButtonWidth, height: valueButtonHeight },
      },
      {
        id: 'powerup-drop-up',
        label: '+',
        rect: { x: rightX, y: firstRowY, width: valueButtonWidth, height: valueButtonHeight },
      },
      ...POWERUP_TYPES.flatMap((type, index) => {
        const y = firstRowY + (index + 1) * POWERUP_ROW_HEIGHT;

        return [
          {
            id: `powerup-weight-${type}-down`,
            label: '-',
            rect: { x: leftX, y, width: valueButtonWidth, height: valueButtonHeight },
          },
          {
            id: `powerup-weight-${type}-up`,
            label: '+',
            rect: { x: rightX, y, width: valueButtonWidth, height: valueButtonHeight },
          },
        ];
      }),
    ];
  }

  private pointInRect(point: Vec2, rect: { x: number; y: number; width: number; height: number }): boolean {
    return point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  private getGridCell(point: Vec2 | null): GridCell | null {
    if (!point || point.x < GRID_X || point.x > GRID_X + GRID_WIDTH || point.y < GRID_Y || point.y > GRID_Y + GRID_HEIGHT) {
      return null;
    }

    const col = Math.floor((point.x - GRID_X) / (CELL_WIDTH + CELL_GAP));
    const row = Math.floor((point.y - GRID_Y) / (CELL_HEIGHT + CELL_GAP));
    const cellX = GRID_X + col * (CELL_WIDTH + CELL_GAP);
    const cellY = GRID_Y + row * (CELL_HEIGHT + CELL_GAP);

    if (col < 0 || col >= BRICK_COLS || row < 0 || row >= BRICK_ROWS) {
      return null;
    }

    if (point.x > cellX + CELL_WIDTH || point.y > cellY + CELL_HEIGHT) {
      return null;
    }

    return { row, col };
  }

  private getClampedGridCell(point: Vec2 | null): GridCell | null {
    if (!point) {
      return null;
    }

    return {
      row: Math.min(Math.max(Math.floor((point.y - GRID_Y) / (CELL_HEIGHT + CELL_GAP)), 0), BRICK_ROWS - 1),
      col: Math.min(Math.max(Math.floor((point.x - GRID_X) / (CELL_WIDTH + CELL_GAP)), 0), BRICK_COLS - 1),
    };
  }

  private getDragSelection(): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
    if (!this.dragStartCell || !this.dragCurrentCell) {
      return null;
    }

    return {
      startRow: Math.min(this.dragStartCell.row, this.dragCurrentCell.row),
      endRow: Math.max(this.dragStartCell.row, this.dragCurrentCell.row),
      startCol: Math.min(this.dragStartCell.col, this.dragCurrentCell.col),
      endCol: Math.max(this.dragStartCell.col, this.dragCurrentCell.col),
    };
  }

  private getPaletteSymbol(point: Vec2 | null): EditableSymbol | null {
    if (!point) {
      return null;
    }

    return PALETTE.find((item, index) => {
      const x = PALETTE_X + index * (PALETTE_BUTTON_WIDTH + PALETTE_GAP);
      return point.x >= x && point.x <= x + PALETTE_BUTTON_WIDTH && point.y >= PALETTE_Y && point.y <= PALETTE_Y + PALETTE_BUTTON_HEIGHT;
    })?.symbol ?? null;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(GRID_X - 10, GRID_Y - 10, GRID_WIDTH + 20, GRID_HEIGHT + 20, 8);
    ctx.fill();
    ctx.stroke();

    for (let row = 0; row < BRICK_ROWS; row += 1) {
      for (let col = 0; col < BRICK_COLS; col += 1) {
        this.drawCell(ctx, GRID_X + col * (CELL_WIDTH + CELL_GAP), GRID_Y + row * (CELL_HEIGHT + CELL_GAP), this.grid[row][col]);
      }
    }

    this.drawDragSelection(ctx);

    ctx.restore();
  }

  private drawDragSelection(ctx: CanvasRenderingContext2D): void {
    const selection = this.getDragSelection();

    if (!selection) {
      return;
    }

    ctx.save();
    ctx.fillStyle = SYMBOL_COLORS[this.selectedSymbol];
    ctx.globalAlpha = 0.38;

    for (let row = selection.startRow; row <= selection.endRow; row += 1) {
      for (let col = selection.startCol; col <= selection.endCol; col += 1) {
        ctx.fillRect(
          GRID_X + col * (CELL_WIDTH + CELL_GAP),
          GRID_Y + row * (CELL_HEIGHT + CELL_GAP),
          CELL_WIDTH,
          CELL_HEIGHT,
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      GRID_X + selection.startCol * (CELL_WIDTH + CELL_GAP) - 2,
      GRID_Y + selection.startRow * (CELL_HEIGHT + CELL_GAP) - 2,
      (selection.endCol - selection.startCol + 1) * CELL_WIDTH + (selection.endCol - selection.startCol) * CELL_GAP + 4,
      (selection.endRow - selection.startRow + 1) * CELL_HEIGHT + (selection.endRow - selection.startRow) * CELL_GAP + 4,
    );
    ctx.restore();
  }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, symbol: EditableSymbol): void {
    ctx.save();
    ctx.fillStyle = SYMBOL_COLORS[symbol];
    ctx.strokeStyle = symbol === '.' ? '#1e293b' : 'rgba(248, 250, 252, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, CELL_WIDTH, CELL_HEIGHT, 4);
    ctx.fill();
    ctx.stroke();

    if (symbol !== '.') {
      ctx.fillStyle = symbol === '1' ? '#082f49' : '#f8fafc';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, x + CELL_WIDTH / 2, y + CELL_HEIGHT / 2 + 0.5);
    }

    ctx.restore();
  }

  private drawPalette(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Paint', CANVAS_WIDTH / 2, PALETTE_Y - 18);

    PALETTE.forEach((item, index) => {
      const x = PALETTE_X + index * (PALETTE_BUTTON_WIDTH + PALETTE_GAP);
      const selected = item.symbol === this.selectedSymbol;

      ctx.fillStyle = selected ? '#155e75' : '#172033';
      ctx.strokeStyle = selected ? '#67e8f9' : '#334155';
      ctx.lineWidth = selected ? 3 : 1;
      ctx.beginPath();
      ctx.roundRect(x, PALETTE_Y, PALETTE_BUTTON_WIDTH, PALETTE_BUTTON_HEIGHT, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.roundRect(x + 6, PALETTE_Y + 8, PALETTE_BUTTON_WIDTH - 12, 18, 4);
      ctx.fill();

      ctx.fillStyle = item.symbol === '1' ? '#082f49' : '#f8fafc';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText(item.label, x + PALETTE_BUTTON_WIDTH / 2, PALETTE_Y + 35);
    });

    ctx.restore();
  }

  private drawSpeedControl(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    drawButton(ctx, this.speedDownButton);
    drawButton(ctx, this.speedUpButton);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Speed ${formatSpeed(this.speed)}`, CANVAS_WIDTH / 2, 687);
    ctx.restore();
  }

  private drawPowerUpPanel(ctx: CanvasRenderingContext2D): void {
    const closeButton = this.getPowerUpPanelCloseButton();
    const controlButtons = this.getPowerUpPanelButtons();
    const firstRowY = POWERUP_PANEL_Y + 74;

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(POWERUP_PANEL_X, POWERUP_PANEL_Y, POWERUP_PANEL_WIDTH, POWERUP_PANEL_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Power-Up Drops', POWERUP_PANEL_X + 22, POWERUP_PANEL_Y + 35);
    drawButton(ctx, closeButton);

    this.drawPowerUpPanelRow(ctx, 'Overall drop', formatPercent(this.powerUpDropChance), firstRowY, controlButtons.slice(0, 2));

    POWERUP_TYPES.forEach((type, index) => {
      const y = firstRowY + (index + 1) * POWERUP_ROW_HEIGHT;
      const buttons = controlButtons.slice(2 + index * 2, 4 + index * 2);
      this.drawPowerUpPanelRow(ctx, POWERUP_LABELS[type], formatNumber(this.powerUpWeights[type]), y, buttons);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Set a weight to 0 to disable that power-up for this level', CANVAS_WIDTH / 2, POWERUP_PANEL_Y + POWERUP_PANEL_HEIGHT - 28);

    ctx.restore();
  }

  private drawPowerUpPanelRow(ctx: CanvasRenderingContext2D, label: string, value: string, y: number, buttons: ScreenButton[]): void {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, POWERUP_PANEL_X + 24, y + 15);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value, POWERUP_PANEL_X + POWERUP_PANEL_WIDTH - 65, y + 15);

    for (const button of buttons) {
      drawButton(ctx, button);
    }
  }
}