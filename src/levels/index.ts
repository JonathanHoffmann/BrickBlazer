import { DEV_TOOLS_ENABLED } from '../devFlags';
import type { LevelData } from '../types';
import { parseTextLevel } from './parseTextLevel';

export interface TextLevelDefinition {
  fileName: string;
  text: string;
  data: LevelData;
}

const textLevelFiles = import.meta.glob('./level*.txt', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

function loadTextLevelDefinitions(): TextLevelDefinition[] {
  return Object.entries(textLevelFiles)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB, undefined, { numeric: true }))
    .map(([path, text]) => {
      const fileName = path.replace('./', '');

      return {
        fileName,
        text,
        data: parseTextLevel(text, fileName),
      };
    });
}

export const textLevelDefinitions: TextLevelDefinition[] = [];
export const devLevels: LevelData[] = [];
export const playableLevels: LevelData[] = [];
export const levels: LevelData[] = [];

function hashLevelContent(text: string): string {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function getLevelSignature(levelIndex: number): string {
  const level = textLevelDefinitions[levelIndex];

  if (!level) {
    return `legacy:${levelIndex}`;
  }

  return hashLevelContent(level.text);
}

export function rebuildLevelCollections(): void {
  const devLevelDefinitions = textLevelDefinitions.filter((level) => level.fileName === 'level00.txt');
  const playableTextLevelDefinitions = textLevelDefinitions.filter((level) => level.fileName !== 'level00.txt');

  devLevels.splice(0, devLevels.length, ...devLevelDefinitions.map((level) => level.data));
  playableLevels.splice(0, playableLevels.length, ...playableTextLevelDefinitions.map((level) => level.data));
  levels.splice(0, levels.length, ...(DEV_TOOLS_ENABLED ? [...devLevels, ...playableLevels] : playableLevels));
}

export function refreshLevelDefinitions(definitions: TextLevelDefinition[] = loadTextLevelDefinitions()): TextLevelDefinition[] {
  textLevelDefinitions.splice(0, textLevelDefinitions.length, ...definitions);
  rebuildLevelCollections();
  return textLevelDefinitions;
}

refreshLevelDefinitions();