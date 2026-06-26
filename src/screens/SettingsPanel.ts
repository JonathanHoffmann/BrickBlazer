import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { SaveManager } from '../storage/SaveManager';
import { AudioSystem } from '../systems/AudioSystem';
import type { InputSystem } from '../systems/InputSystem';
import type { Rect, Vec2 } from '../types';
import { createSettingsButton, drawButton, drawSettingsButton, hitButton, type ScreenButton } from './screenUi';

interface SettingsPanelOptions {
  onHighScoresReset?(): void;
  showButton?: boolean;
  placement?: 'topRight' | 'center';
}

const PANEL_WIDTH = 306;
const PANEL_HEIGHT = 304;
const SLIDER_TRACK_HEIGHT = 6;

function pointInRect(point: Vec2 | null, rect: Rect): boolean {
  return Boolean(point)
    && point!.x >= rect.x
    && point!.x <= rect.x + rect.width
    && point!.y >= rect.y
    && point!.y <= rect.y + rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class SettingsPanel {
  private readonly audio = new AudioSystem();
  private readonly saveManager = new SaveManager();
  private readonly settingsButton = createSettingsButton();
  private open = false;
  private sliderDragging = false;

  constructor(private readonly options: SettingsPanelOptions = {}) {
  }

  handleInput(input: InputSystem): boolean {
    const pointerPress = input.peekPointerPress();

    if (!this.open) {
      if (this.options.showButton === false) {
        return false;
      }

      if (!hitButton([this.settingsButton], pointerPress)) {
        return false;
      }

      input.consumePointerPress();
      input.clearTransientActions();
      this.open = true;
      this.audio.play('buttonPress');
      return true;
    }

    if (input.isPausePressed()) {
      this.open = false;
      this.sliderDragging = false;
      this.audio.play('buttonPress');
      return true;
    }

    if (!input.isPointerDown()) {
      this.sliderDragging = false;
    }

    const panelRect = this.getPanelRect();
    const sliderRect = this.getSliderRect(panelRect);
    const closeButton = this.getCloseButton(panelRect);
    const effectsButton = this.getEffectsButton(panelRect);
    const vibrationButton = this.getVibrationButton(panelRect);
    const resetHighScoreButton = this.getResetHighScoreButton(panelRect);
    const pointerPosition = input.getPointerPosition();

    if (this.sliderDragging && input.isPointerDown() && pointerPosition) {
      this.setMusicVolumeFromPoint(pointerPosition, sliderRect);
      return true;
    }

    if (!pointerPress) {
      return true;
    }

    input.consumePointerPress();
    input.clearTransientActions();

    const closeButtons = this.options.showButton === false ? [closeButton] : [this.settingsButton, closeButton];

    if (hitButton(closeButtons, pointerPress) || !pointInRect(pointerPress, panelRect)) {
      this.open = false;
      this.sliderDragging = false;
      this.audio.play('buttonPress');
      return true;
    }

    if (hitButton([effectsButton], pointerPress)) {
      this.toggleEffectsMuted();
      return true;
    }

    if (hitButton([vibrationButton], pointerPress)) {
      this.toggleVibrationEnabled();
      return true;
    }

    if (hitButton([resetHighScoreButton], pointerPress)) {
      this.resetHighScores();
      return true;
    }

    if (pointInRect(pointerPress, sliderRect)) {
      this.sliderDragging = true;
      this.setMusicVolumeFromPoint(pointerPress, sliderRect);
      return true;
    }

    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.options.showButton !== false) {
      drawSettingsButton(ctx, this.settingsButton, this.open);
    }

    if (!this.open) {
      return;
    }

    this.drawPanel(ctx);
  }

  getOpen(): boolean {
    return this.open;
  }

  openPanel(): void {
    this.open = true;
  }

  private drawPanel(ctx: CanvasRenderingContext2D): void {
    const effectsMuted = this.audio.getEffectsMuted();
    const vibrationEnabled = this.audio.getVibrationEnabled();
    const musicVolume = this.audio.getMusicVolume();
    const panelRect = this.getPanelRect();
    const closeButton = this.getCloseButton(panelRect);
    const effectsButton = this.getEffectsButton(panelRect);
    const vibrationButton = this.getVibrationButton(panelRect);
    const resetHighScoreButton = this.getResetHighScoreButton(panelRect);
    const sliderRect = this.getSliderRect(panelRect);

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
    ctx.fillRect(panelRect.x + 5, panelRect.y + 6, panelRect.width, panelRect.height);

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Settings', panelRect.x + 22, panelRect.y + 28);

    drawButton(ctx, closeButton);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('Sound FX', panelRect.x + 22, panelRect.y + 85);
    ctx.fillText('Vibration', panelRect.x + 22, panelRect.y + 127);
    ctx.fillText('Music', panelRect.x + 22, panelRect.y + 179);

    this.drawEffectsToggle(ctx, effectsButton, effectsMuted);
    this.drawVibrationToggle(ctx, vibrationButton, vibrationEnabled);
    this.drawMusicSlider(ctx, panelRect, sliderRect, musicVolume);
    drawButton(ctx, resetHighScoreButton);

    ctx.restore();
  }

  private drawEffectsToggle(ctx: CanvasRenderingContext2D, effectsButton: ScreenButton, effectsMuted: boolean): void {
    const button = {
      ...effectsButton,
      label: effectsMuted ? 'Off' : 'On',
      accent: !effectsMuted,
    };

    drawButton(ctx, button);
  }

  private drawVibrationToggle(ctx: CanvasRenderingContext2D, vibrationButton: ScreenButton, vibrationEnabled: boolean): void {
    const vibrationSupported = this.audio.isVibrationSupported();
    const button = {
      ...vibrationButton,
      label: vibrationSupported ? vibrationEnabled ? 'On' : 'Off' : 'N/A',
      accent: vibrationSupported && vibrationEnabled,
      disabled: !vibrationSupported,
    };

    drawButton(ctx, button);
  }

  private drawMusicSlider(ctx: CanvasRenderingContext2D, panelRect: Rect, sliderRect: Rect, musicVolume: number): void {
    const trackY = sliderRect.y + sliderRect.height / 2 - SLIDER_TRACK_HEIGHT / 2;
    const fillWidth = sliderRect.width * musicVolume;
    const knobX = sliderRect.x + fillWidth;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(sliderRect.x, trackY, sliderRect.width, SLIDER_TRACK_HEIGHT, 4);
    ctx.fill();

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.roundRect(sliderRect.x, trackY, fillWidth, SLIDER_TRACK_HEIGHT, 4);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(knobX, sliderRect.y + sliderRect.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(musicVolume * 100)}%`, panelRect.x + panelRect.width - 24, panelRect.y + 208);
  }

  private toggleEffectsMuted(): void {
    const effectsMuted = this.audio.getEffectsMuted();

    if (effectsMuted) {
      this.audio.setEffectsMuted(false);
      this.audio.play('buttonPress');
      return;
    }

    this.audio.play('buttonPress');
    this.audio.setEffectsMuted(true);
  }

  private toggleVibrationEnabled(): void {
    if (!this.audio.isVibrationSupported()) {
      return;
    }

    const vibrationEnabled = this.audio.getVibrationEnabled();
    this.audio.setVibrationEnabled(!vibrationEnabled);
    this.audio.play('buttonPress');
  }

  private setMusicVolumeFromPoint(point: Vec2, sliderRect: Rect): void {
    const normalizedVolume = clamp((point.x - sliderRect.x) / sliderRect.width, 0, 1);
    this.audio.setMusicVolume(normalizedVolume);
  }

  private getPanelRect(): Rect {
    if (this.options.placement === 'center') {
      return {
        x: (CANVAS_WIDTH - PANEL_WIDTH) / 2,
        y: (CANVAS_HEIGHT - PANEL_HEIGHT) / 2,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      };
    }

    return {
      x: CANVAS_WIDTH - PANEL_WIDTH - 20,
      y: 52,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    };
  }

  private getCloseButton(panelRect: Rect): ScreenButton {
    return {
      id: 'settings-close',
      label: 'X',
      rect: { x: panelRect.x + panelRect.width - 42, y: panelRect.y + 12, width: 28, height: 28 },
    };
  }

  private getEffectsButton(panelRect: Rect): ScreenButton {
    return {
      id: 'settings-effects',
      label: '',
      rect: { x: panelRect.x + panelRect.width - 92, y: panelRect.y + 68, width: 68, height: 34 },
    };
  }

  private getVibrationButton(panelRect: Rect): ScreenButton {
    return {
      id: 'settings-vibration',
      label: '',
      rect: { x: panelRect.x + panelRect.width - 92, y: panelRect.y + 110, width: 68, height: 34 },
    };
  }

  private getResetHighScoreButton(panelRect: Rect): ScreenButton {
    return {
      id: 'settings-reset-high-score',
      label: 'Reset High Score',
      rect: { x: panelRect.x + 22, y: panelRect.y + 244, width: panelRect.width - 44, height: 38 },
    };
  }

  private getSliderRect(panelRect: Rect): Rect {
    return { x: panelRect.x + 92, y: panelRect.y + 166, width: 172, height: 26 };
  }

  private resetHighScores(): void {
    this.saveManager.resetBestScores();
    this.audio.play('buttonPress');
    this.options.onHighScoresReset?.();
  }
}