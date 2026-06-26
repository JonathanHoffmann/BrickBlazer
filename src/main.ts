import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';
import { Game } from './game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
let canvasScale = 1;
let resizeFrame = 0;

if (!canvas) {
  throw new Error('Game canvas was not found.');
}

const gameCanvas = canvas;

gameCanvas.width = CANVAS_WIDTH;
gameCanvas.height = CANVAS_HEIGHT;

export function getCanvasScale(): number {
  return canvasScale;
}

function getSafeAreaInset(propertyName: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(propertyName);
  return Number.parseFloat(value) || 0;
}

function getAvailableViewportSize(): { width: number; height: number } {
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const safeAreaWidth = getSafeAreaInset('--safe-area-inset-left') + getSafeAreaInset('--safe-area-inset-right');
  const safeAreaHeight = getSafeAreaInset('--safe-area-inset-top') + getSafeAreaInset('--safe-area-inset-bottom');

  return {
    width: Math.max(viewportWidth - safeAreaWidth, 1),
    height: Math.max(viewportHeight - safeAreaHeight, 1),
  };
}

function resizeCanvas(): void {
  const { width, height } = getAvailableViewportSize();

  canvasScale = Math.min(
    width / CANVAS_WIDTH,
    height / CANVAS_HEIGHT,
  );

  gameCanvas.style.width = `${Math.floor(CANVAS_WIDTH * canvasScale)}px`;
  gameCanvas.style.height = `${Math.floor(CANVAS_HEIGHT * canvasScale)}px`;
}

function scheduleResize(): void {
  if (resizeFrame !== 0) {
    return;
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    resizeCanvas();
  });
}

window.addEventListener('resize', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize);
window.visualViewport?.addEventListener('scroll', scheduleResize);
resizeCanvas();

const game = new Game(gameCanvas, getCanvasScale);
game.init();