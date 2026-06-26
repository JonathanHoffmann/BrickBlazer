import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import type { PaddleInputTarget, Vec2 } from '../types';

type PointerSource = 'mouse' | 'touch';

export class InputSystem {
  private leftHeld = false;
  private rightHeld = false;
  private pointerX: number | null = null;
  private pointerSource: PointerSource | null = null;
  private pointerPosition: Vec2 | null = null;
  private pointerDown = false;
  private pointerPressed: Vec2 | null = null;
  private pointerReleased: Vec2 | null = null;
  private scrollDelta = 0;
  private readonly pressedKeys = new Set<string>();
  private launchPressed = false;
  private pausePressed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    window.addEventListener('touchend', this.handleTouchEnd);
    window.addEventListener('touchcancel', this.handleTouchCancel);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('touchcancel', this.handleTouchCancel);
  }

  getPaddleTarget(): PaddleInputTarget | null {
    if (this.pointerX !== null) {
      return { x: this.pointerX, immediate: true };
    }

    if (this.leftHeld === this.rightHeld) {
      return null;
    }

    return { x: this.leftHeld ? 0 : CANVAS_WIDTH, immediate: false };
  }

  isLaunchPressed(): boolean {
    const pressed = this.launchPressed;
    this.launchPressed = false;
    return pressed;
  }

  isPausePressed(): boolean {
    const pressed = this.pausePressed;
    this.pausePressed = false;
    return pressed;
  }

  consumePointerPress(): Vec2 | null {
    const pressed = this.pointerPressed;
    this.pointerPressed = null;
    return pressed;
  }

  consumePointerRelease(): Vec2 | null {
    const released = this.pointerReleased;
    this.pointerReleased = null;
    return released;
  }

  consumeScrollDelta(): number {
    const delta = this.scrollDelta;
    this.scrollDelta = 0;
    return delta;
  }

  consumeKeyPress(...keys: string[]): string | null {
    for (const key of keys) {
      if (this.pressedKeys.has(key)) {
        this.pressedKeys.delete(key);
        return key;
      }
    }

    return null;
  }

  peekPointerPress(): Vec2 | null {
    return this.pointerPressed;
  }

  getPointerPosition(): Vec2 | null {
    return this.pointerPosition;
  }

  isPointerDown(): boolean {
    return this.pointerDown;
  }

  clearTransientActions(): void {
    this.pointerPressed = null;
    this.pointerReleased = null;
    this.scrollDelta = 0;
    this.pressedKeys.clear();
    this.launchPressed = false;
    this.pausePressed = false;
  }

  clearPointerTarget(): void {
    this.pointerX = null;
    this.pointerSource = null;
    this.pointerPosition = null;
    this.pointerPressed = null;
    this.pointerReleased = null;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!event.repeat) {
      this.pressedKeys.add(event.key);
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.leftHeld = true;
        this.pointerX = null;
        this.pointerSource = null;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.rightHeld = true;
        this.pointerX = null;
        this.pointerSource = null;
        break;
      case ' ':
      case 'Enter':
        this.launchPressed = true;
        event.preventDefault();
        break;
      case 'Escape':
      case 'p':
      case 'P':
        this.pausePressed = true;
        event.preventDefault();
        break;
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.leftHeld = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.rightHeld = false;
        break;
    }
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    this.setPointerPosition(event.clientX, event.clientY, 'mouse');
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    this.pointerDown = true;
    this.setPointerPosition(event.clientX, event.clientY, 'mouse', true);
    this.launchPressed = true;
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    this.pointerReleased = this.getCanvasPoint(event.clientX, event.clientY);
    this.pointerPosition = this.pointerReleased;
    this.pointerDown = false;
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const deltaPixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * rect.height
        : event.deltaY;

    this.scrollDelta += deltaPixels * (CANVAS_HEIGHT / rect.height);
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    this.pointerDown = true;
    this.handleTouch(event, true);
  };

  private readonly handleTouchMove = (event: TouchEvent): void => {
    this.handleTouch(event, false);
  };

  private readonly handleTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];

    if (touch) {
      this.pointerReleased = this.getCanvasPoint(touch.clientX, touch.clientY);
      this.pointerPosition = this.pointerReleased;
    }

    if (this.pointerSource === 'touch') {
      this.launchPressed = true;
    }

    this.pointerDown = false;
  };

  private readonly handleTouchCancel = (_event: TouchEvent): void => {
    this.pointerDown = false;
  };

  private handleTouch(event: TouchEvent, pressed: boolean): void {
    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    event.preventDefault();
    this.setPointerPosition(touch.clientX, touch.clientY, 'touch', pressed);
  }

  private setPointerPosition(clientX: number, clientY: number, source: PointerSource, pressed = false): void {
    if (this.pointerSource === 'touch' && source === 'mouse') {
      return;
    }

    const pointer = this.getCanvasPoint(clientX, clientY);

    this.pointerX = pointer.x;
    this.pointerPosition = pointer;

    if (pressed) {
      this.pointerPressed = pointer;
    }

    this.pointerSource = source;
  }

  private getCanvasPoint(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const normalizedX = (clientX - rect.left) / rect.width;
    const normalizedY = (clientY - rect.top) / rect.height;

    return {
      x: Math.min(Math.max(normalizedX * CANVAS_WIDTH, 0), CANVAS_WIDTH),
      y: Math.min(Math.max(normalizedY * CANVAS_HEIGHT, 0), CANVAS_HEIGHT),
    };
  }
}