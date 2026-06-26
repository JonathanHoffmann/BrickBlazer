import { LEVELS_UNLOCKED_AHEAD } from '../constants';
import type { SaveData } from '../types';

const DEFAULT_SAVE_DATA: SaveData = {
  highestUnlocked: LEVELS_UNLOCKED_AHEAD - 1,
  bestScores: {},
  effectsMuted: false,
  vibrationEnabled: true,
  musicVolume: 0.55,
};

export class SaveManager {
  static readonly key = 'brickblaze_save_v1';
  private static readonly legacyKey = 'brickBreaker_save_v1';

  load(): SaveData {
    const storage = this.getStorage();

    if (!storage) {
      return this.createDefaultData();
    }

    try {
      const rawData = storage.getItem(SaveManager.key);

      if (rawData) {
        return this.normalize(JSON.parse(rawData));
      }

      const legacyRawData = storage.getItem(SaveManager.legacyKey);

      if (!legacyRawData) {
        return this.createDefaultData();
      }

      const saveData = this.normalize(JSON.parse(legacyRawData));
      this.save(saveData);
      return saveData;
    } catch {
      return this.createDefaultData();
    }
  }

  save(data: SaveData): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.setItem(SaveManager.key, JSON.stringify(this.normalize(data)));
    } catch {
      // Saving is best-effort; gameplay can continue if browser storage is unavailable.
    }
  }

  resetProgress(): void {
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(SaveManager.key);
      storage.removeItem(SaveManager.legacyKey);
    } catch {
      // Resetting is best-effort; corrupt or unavailable storage falls back to defaults on load.
    }
  }

  resetBestScores(): SaveData {
    const saveData = this.load();
    saveData.bestScores = {};
    this.save(saveData);
    return saveData;
  }

  private getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  private createDefaultData(): SaveData {
    return {
      highestUnlocked: DEFAULT_SAVE_DATA.highestUnlocked,
      bestScores: { ...DEFAULT_SAVE_DATA.bestScores },
      effectsMuted: DEFAULT_SAVE_DATA.effectsMuted,
      vibrationEnabled: DEFAULT_SAVE_DATA.vibrationEnabled,
      musicVolume: DEFAULT_SAVE_DATA.musicVolume,
    };
  }

  private normalize(data: unknown): SaveData {
    if (!data || typeof data !== 'object') {
      return this.createDefaultData();
    }

    const candidate = data as Partial<SaveData>;
    const legacyCandidate = data as { muted?: unknown };
    const bestScores: Record<string, number> = {};
    const highestUnlocked = candidate.highestUnlocked;
    const musicVolume = candidate.musicVolume;

    if (candidate.bestScores && typeof candidate.bestScores === 'object') {
      for (const [levelKey, score] of Object.entries(candidate.bestScores)) {
        if (typeof score === 'number' && Number.isFinite(score)) {
          bestScores[levelKey] = Math.max(0, Math.floor(score));
        }
      }
    }

    return {
      highestUnlocked: typeof highestUnlocked === 'number' && Number.isInteger(highestUnlocked)
        ? Math.max(DEFAULT_SAVE_DATA.highestUnlocked, highestUnlocked)
        : DEFAULT_SAVE_DATA.highestUnlocked,
      bestScores,
      effectsMuted: typeof candidate.effectsMuted === 'boolean'
        ? candidate.effectsMuted
        : typeof legacyCandidate.muted === 'boolean'
          ? legacyCandidate.muted
          : DEFAULT_SAVE_DATA.effectsMuted,
      vibrationEnabled: typeof candidate.vibrationEnabled === 'boolean'
        ? candidate.vibrationEnabled
        : DEFAULT_SAVE_DATA.vibrationEnabled,
      musicVolume: typeof musicVolume === 'number' && Number.isFinite(musicVolume)
        ? Math.min(Math.max(musicVolume, 0), 1)
        : legacyCandidate.muted === true
          ? 0
        : DEFAULT_SAVE_DATA.musicVolume,
    };
  }
}