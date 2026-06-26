import { BRICK_COLS, BRICK_ROWS } from '../constants';
import { DEFAULT_POWERUP_DROP_CHANCE, createDefaultPowerUpWeights, findPowerUpType } from '../powerUpConfig';
import { BrickType, type LevelData } from '../types';

const BRICK_SYMBOLS: Record<string, BrickType> = {
  '.': BrickType.Empty,
  '0': BrickType.Empty,
  '1': BrickType.Standard,
  '2': BrickType.Tough,
  '3': BrickType.Armored,
  U: BrickType.Unbreakable,
  T: BrickType.Explosive,
  S: BrickType.Sensor,
};

const NUMBER_PATTERN = '(\\d+(?:\\.\\d+)?)';
const SPEED_PATTERN = new RegExp(`^speed\\s*=\\s*${NUMBER_PATTERN}$`, 'i');
const POWERUP_CHANCE_PATTERN = new RegExp(`^powerupChance\\s*=\\s*${NUMBER_PATTERN}$`, 'i');
const POWERUP_WEIGHT_PATTERN = new RegExp(`^powerup\\.([a-z][a-z0-9]*)\\s*=\\s*${NUMBER_PATTERN}$`, 'i');

export function parseTextLevel(text: string, sourceName = 'level'): LevelData {
  let ballSpeedMultiplier = 1.0;
  let powerUpDropChance = DEFAULT_POWERUP_DROP_CHANCE;
  const powerUpWeights = createDefaultPowerUpWeights();
  const gridLines: string[] = [];

  text.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      return;
    }

    const speedMatch = line.match(SPEED_PATTERN);
    if (speedMatch) {
      ballSpeedMultiplier = Number(speedMatch[1]);
      return;
    }

    const powerUpChanceMatch = line.match(POWERUP_CHANCE_PATTERN);
    if (powerUpChanceMatch) {
      powerUpDropChance = Number(powerUpChanceMatch[1]);

      if (powerUpDropChance < 0 || powerUpDropChance > 1) {
        throw new Error(`${sourceName}:${lineIndex + 1} powerupChance must be between 0 and 1`);
      }

      return;
    }

    const powerUpWeightMatch = line.match(POWERUP_WEIGHT_PATTERN);
    if (powerUpWeightMatch) {
      const powerUpType = findPowerUpType(powerUpWeightMatch[1]);

      if (!powerUpType) {
        throw new Error(`${sourceName}:${lineIndex + 1} has unknown powerup "${powerUpWeightMatch[1]}"`);
      }

      powerUpWeights[powerUpType] = Number(powerUpWeightMatch[2]);
      return;
    }

    if (line.includes('=')) {
      throw new Error(`${sourceName}:${lineIndex + 1} has unknown level setting "${line.split('=')[0].trim()}"`);
    }

    if (line.length !== BRICK_COLS) {
      throw new Error(`${sourceName}:${lineIndex + 1} must contain ${BRICK_COLS} brick symbols`);
    }

    gridLines.push(line);
  });

  if (gridLines.length !== BRICK_ROWS) {
    throw new Error(`${sourceName} must contain ${BRICK_ROWS} grid rows`);
  }

  const grid = gridLines.map((line, row) => Array.from(line, (symbol, col) => {
    const brickType = BRICK_SYMBOLS[symbol];
    if (brickType === undefined) {
      throw new Error(`${sourceName}:${row + 1}:${col + 1} has unknown brick symbol "${symbol}"`);
    }

    return brickType;
  }));

  return { grid, ballSpeedMultiplier, powerUpDropChance, powerUpWeights };
}