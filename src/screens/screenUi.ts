import { CANVAS_WIDTH } from '../constants';
import type { Rect, Vec2 } from '../types';

export interface ScreenButton {
  id: string;
  label: string;
  rect: Rect;
  disabled?: boolean;
  accent?: boolean;
}

const SETTINGS_BUTTON_SIZE = 32;
const PAUSE_BUTTON_SIZE = 32;

export function createSettingsButton(): ScreenButton {
  return {
    id: 'settings',
    label: '',
    rect: {
      x: CANVAS_WIDTH - SETTINGS_BUTTON_SIZE - 10,
      y: 8,
      width: SETTINGS_BUTTON_SIZE,
      height: SETTINGS_BUTTON_SIZE,
    },
  };
}

export function createPauseButton(): ScreenButton {
  return {
    id: 'pause',
    label: '',
    rect: {
      x: CANVAS_WIDTH - PAUSE_BUTTON_SIZE - 10,
      y: 8,
      width: PAUSE_BUTTON_SIZE,
      height: PAUSE_BUTTON_SIZE,
    },
  };
}

export function hitButton(buttons: readonly ScreenButton[], point: Vec2 | null): ScreenButton | null {
  if (!point) {
    return null;
  }

  return buttons.find((button) => (
    !button.disabled
    && point.x >= button.rect.x
    && point.x <= button.rect.x + button.rect.width
    && point.y >= button.rect.y
    && point.y <= button.rect.y + button.rect.height
  )) ?? null;
}

export function drawButton(ctx: CanvasRenderingContext2D, button: ScreenButton): void {
  ctx.save();
  ctx.globalAlpha = button.disabled ? 0.45 : 1;
  ctx.fillStyle = button.accent ? '#22d3ee' : '#1e293b';
  ctx.strokeStyle = button.accent ? '#a5f3fc' : '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(button.rect.x, button.rect.y, button.rect.width, button.rect.height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = button.accent ? '#082f49' : '#f8fafc';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(button.label, button.rect.x + button.rect.width / 2, button.rect.y + button.rect.height / 2);
  ctx.restore();
}

export function drawSettingsButton(ctx: CanvasRenderingContext2D, button: ScreenButton, active: boolean): void {
  const { x, y, width, height } = button.rect;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  ctx.fillStyle = active ? '#155e75' : '#1e293b';
  ctx.strokeStyle = active ? '#67e8f9' : '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = active ? '#cffafe' : '#f8fafc';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const innerRadius = 6;
    const outerRadius = 9;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

export function drawPauseButton(ctx: CanvasRenderingContext2D, button: ScreenButton): void {
  const { x, y, width, height } = button.rect;
  const centerY = y + height / 2;
  const barWidth = 4;
  const barHeight = 15;

  ctx.save();
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(x + width / 2 - 7, centerY - barHeight / 2, barWidth, barHeight, 2);
  ctx.roundRect(x + width / 2 + 3, centerY - barHeight / 2, barWidth, barHeight, 2);
  ctx.fill();
  ctx.restore();
}