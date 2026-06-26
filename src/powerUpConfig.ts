import { POWERUP_DROP_CHANCE } from './constants';
import { PowerUpType, type PowerUpWeights } from './types';

export const POWERUP_TYPES = Object.values(PowerUpType) as PowerUpType[];

export const POWERUP_LABELS: Record<PowerUpType, string> = {
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

export const DEFAULT_POWERUP_DROP_CHANCE = POWERUP_DROP_CHANCE;

export function createDefaultPowerUpWeights(): PowerUpWeights {
  return Object.fromEntries(POWERUP_TYPES.map((type) => [type, 1])) as PowerUpWeights;
}

export function findPowerUpType(powerUpId: string): PowerUpType | undefined {
  return POWERUP_TYPES.find((type) => type.toLowerCase() === powerUpId.toLowerCase());
}