import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SaveManager } from '../storage/SaveManager';

export type SoundId =
  | 'buttonPress'
  | 'paddleHit'
  | 'ballLaunch'
  | 'brickHit'
  | 'brickDestroy'
  | 'brickExplode'
  | 'brickIndestructible'
  | 'powerUp'
  | 'lifeLost'
  | 'levelComplete'
  | 'gameOver';

const DEFAULT_SOUND_URLS: Record<SoundId, string> = {
  buttonPress: new URL('../../assets/sounds/buttonPress.wav', import.meta.url).href,
  paddleHit: new URL('../../assets/sounds/paddleHit.wav', import.meta.url).href,
  ballLaunch: new URL('../../assets/sounds/ballLaunch.wav', import.meta.url).href,
  brickHit: new URL('../../assets/sounds/brickHit.wav', import.meta.url).href,
  brickDestroy: new URL('../../assets/sounds/brickDestroy.wav', import.meta.url).href,
  brickExplode: new URL('../../assets/sounds/brickExplode.wav', import.meta.url).href,
  brickIndestructible: new URL('../../assets/sounds/brickIndestructible.wav', import.meta.url).href,
  powerUp: new URL('../../assets/sounds/powerUp.wav', import.meta.url).href,
  lifeLost: new URL('../../assets/sounds/lifeLost.wav', import.meta.url).href,
  levelComplete: new URL('../../assets/sounds/levelComplete.wav', import.meta.url).href,
  gameOver: new URL('../../assets/sounds/gameOver.wav', import.meta.url).href,
};

const BACKGROUND_MUSIC_URL = new URL('../../assets/sounds/backgroundMusicLaserRun.wav', import.meta.url).href;

const FALLBACK_FREQUENCIES: Record<SoundId, number> = {
  buttonPress: 880,
  paddleHit: 220,
  ballLaunch: 680,
  brickHit: 330,
  brickDestroy: 440,
  brickExplode: 90,
  brickIndestructible: 120,
  powerUp: 660,
  lifeLost: 150,
  levelComplete: 760,
  gameOver: 110,
};

const SOUND_GAINS: Record<SoundId, number> = {
  buttonPress: 0.35,
  paddleHit: 0.78,
  ballLaunch: 0.68,
  brickHit: 0.42,
  brickDestroy: 0.5,
  brickExplode: 0.58,
  brickIndestructible: 0.48,
  powerUp: 0.58,
  lifeLost: 0.82,
  levelComplete: 0.5,
  gameOver: 0.55,
};

const VIBRATION_PATTERNS: Record<SoundId, number | number[]> = {
  buttonPress: 12,
  paddleHit: 16,
  ballLaunch: 14,
  brickHit: 10,
  brickDestroy: [12, 20, 16],
  brickExplode: [28, 22, 42],
  brickIndestructible: [16, 14, 16],
  powerUp: [18, 24, 18],
  lifeLost: [55, 35, 28],
  levelComplete: [22, 26, 22, 26, 38],
  gameOver: [70, 35, 70],
};

export class AudioSystem {
  private static effectsMuted: boolean | null = null;
  private static vibrationEnabled: boolean | null = null;
  private static musicVolume: number | null = null;
  private static context: AudioContext | null = null;
  private static buffers = new Map<SoundId, AudioBuffer>();
  private static preloadStarted = false;
  private static musicBuffer: AudioBuffer | null = null;
  private static musicLoading: Promise<void> | null = null;
  private static musicRequested = false;
  private static musicSource: AudioBufferSourceNode | null = null;
  private static musicGain: GainNode | null = null;
  private static unlockListenersRegistered = false;
  private static lifecycleListenersRegistered = false;
  private static backgrounded = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  private readonly saveManager = new SaveManager();

  constructor(private readonly soundUrls: Record<SoundId, string> = DEFAULT_SOUND_URLS) {
    const saveData = this.saveManager.load();

    if (AudioSystem.effectsMuted === null) {
      AudioSystem.effectsMuted = saveData.effectsMuted;
    }

    if (AudioSystem.vibrationEnabled === null) {
      AudioSystem.vibrationEnabled = saveData.vibrationEnabled;
    }

    if (AudioSystem.musicVolume === null) {
      AudioSystem.musicVolume = saveData.musicVolume;
    }
  }

  preload(): void {
    this.registerUnlockListeners();
    this.registerLifecycleListeners();

    if (AudioSystem.preloadStarted) {
      return;
    }

    AudioSystem.preloadStarted = true;
    const context = this.getContext();

    if (!context) {
      return;
    }

    for (const [soundId, url] of Object.entries(this.soundUrls) as [SoundId, string][]) {
      void this.loadBuffer(context, soundId, url);
    }

    void this.loadMusicBuffer(context);
  }

  play(soundId: SoundId): void {
    this.registerUnlockListeners();

    if (AudioSystem.backgrounded) {
      return;
    }

    this.vibrate(soundId);

    if (this.getEffectsMuted()) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const buffer = AudioSystem.buffers.get(soundId);

    if (!buffer) {
      this.playFallbackTone(context, soundId);
      this.preload();
      return;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = SOUND_GAINS[soundId];
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  startMusic(): void {
    this.registerUnlockListeners();
    this.registerLifecycleListeners();
    AudioSystem.musicRequested = true;

    if (AudioSystem.backgrounded || this.getMusicVolume() <= 0) {
      return;
    }

    if (AudioSystem.musicSource) {
      this.updateMusicGain();
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    this.preload();

    if (!AudioSystem.musicBuffer) {
      void this.loadMusicBuffer(context).then(() => this.startMusic());
      return;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = AudioSystem.musicBuffer;
    source.loop = true;
    gain.gain.value = this.getMusicGainValue();
    source.connect(gain).connect(context.destination);
    source.start();

    AudioSystem.musicSource = source;
    AudioSystem.musicGain = gain;
  }

  stopMusic(): void {
    AudioSystem.musicRequested = false;
    this.stopMusicSource();
  }

  setEffectsMuted(effectsMuted: boolean): void {
    AudioSystem.effectsMuted = effectsMuted;
    const saveData = this.saveManager.load();
    saveData.effectsMuted = effectsMuted;
    this.saveManager.save(saveData);
  }

  getEffectsMuted(): boolean {
    if (AudioSystem.effectsMuted === null) {
      AudioSystem.effectsMuted = this.saveManager.load().effectsMuted;
    }

    return AudioSystem.effectsMuted;
  }

  setVibrationEnabled(vibrationEnabled: boolean): void {
    AudioSystem.vibrationEnabled = vibrationEnabled;
    const saveData = this.saveManager.load();
    saveData.vibrationEnabled = vibrationEnabled;
    this.saveManager.save(saveData);
  }

  getVibrationEnabled(): boolean {
    if (AudioSystem.vibrationEnabled === null) {
      AudioSystem.vibrationEnabled = this.saveManager.load().vibrationEnabled;
    }

    return AudioSystem.vibrationEnabled;
  }

  isVibrationSupported(): boolean {
    return Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function');
  }

  setMusicVolume(volume: number): void {
    AudioSystem.musicVolume = Math.min(Math.max(volume, 0), 1);
    const saveData = this.saveManager.load();
    saveData.musicVolume = AudioSystem.musicVolume;
    this.saveManager.save(saveData);

    if (AudioSystem.musicVolume <= 0) {
      this.stopMusicSource();
      return;
    }

    this.updateMusicGain();

    if (AudioSystem.musicRequested) {
      this.startMusic();
    }
  }

  getMusicVolume(): number {
    if (AudioSystem.musicVolume === null) {
      AudioSystem.musicVolume = this.saveManager.load().musicVolume;
    }

    return AudioSystem.musicVolume;
  }

  private stopMusicSource(): void {

    if (!AudioSystem.musicSource) {
      return;
    }

    try {
      AudioSystem.musicSource.stop();
    } catch {
      // The source may already be stopped; clearing references is enough.
    }

    AudioSystem.musicSource.disconnect();
    AudioSystem.musicGain?.disconnect();
    AudioSystem.musicSource = null;
    AudioSystem.musicGain = null;
  }

  private pauseForBackground(): void {
    AudioSystem.backgrounded = true;
    this.stopMusicSource();

    if (AudioSystem.context?.state === 'running') {
      void AudioSystem.context.suspend();
    }
  }

  private resumeFromBackground(): void {
    AudioSystem.backgrounded = false;

    const context = AudioSystem.context;

    if (context?.state === 'suspended') {
      void context.resume().then(() => {
        if (AudioSystem.musicRequested && this.getMusicVolume() > 0) {
          this.startMusic();
        }
      });
      return;
    }

    if (AudioSystem.musicRequested && this.getMusicVolume() > 0) {
      this.startMusic();
    }
  }

  private getContext(): AudioContext | null {
    if (AudioSystem.context) {
      return AudioSystem.context;
    }

    try {
      AudioSystem.context = new AudioContext();
    } catch {
      AudioSystem.context = null;
    }

    return AudioSystem.context;
  }

  private vibrate(soundId: SoundId): void {
    if (!this.getVibrationEnabled() || !this.isVibrationSupported()) {
      return;
    }

    if (Capacitor.isNativePlatform()) {
      void this.playNativeHaptic(soundId);
      return;
    }

    this.playBrowserVibration(soundId);
  }

  private async playNativeHaptic(soundId: SoundId): Promise<void> {
    try {
      switch (soundId) {
        case 'buttonPress':
          await Haptics.selectionChanged();
          break;
        case 'brickExplode':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          await Haptics.vibrate({ duration: 45 });
          break;
        case 'brickDestroy':
        case 'powerUp':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'brickIndestructible':
          await Haptics.impact({ style: ImpactStyle.Medium });
          await Haptics.vibrate({ duration: 22 });
          break;
        case 'lifeLost':
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case 'levelComplete':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'gameOver':
          await Haptics.notification({ type: NotificationType.Error });
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
      }
    } catch {
      this.playBrowserVibration(soundId);
    }
  }

  private playBrowserVibration(soundId: SoundId): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    try {
      navigator.vibrate(VIBRATION_PATTERNS[soundId]);
    } catch {
      // Vibration support varies by device and browser; audio should continue either way.
    }
  }

  private registerUnlockListeners(): void {
    if (AudioSystem.unlockListenersRegistered || typeof window === 'undefined') {
      return;
    }

    AudioSystem.unlockListenersRegistered = true;

    const unlock = (): void => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      void this.unlockAudioFromGesture();
    };

    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  private registerLifecycleListeners(): void {
    if (AudioSystem.lifecycleListenersRegistered || typeof window === 'undefined') {
      return;
    }

    AudioSystem.lifecycleListenersRegistered = true;

    const updateFromVisibility = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.pauseForBackground();
        return;
      }

      this.resumeFromBackground();
    };

    document.addEventListener('visibilitychange', updateFromVisibility);
    window.addEventListener('pagehide', () => this.pauseForBackground());
    window.addEventListener('pageshow', () => updateFromVisibility());

    if (Capacitor.isNativePlatform()) {
      void App.addListener('pause', () => this.pauseForBackground());
      void App.addListener('resume', () => this.resumeFromBackground());
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          this.resumeFromBackground();
          return;
        }

        this.pauseForBackground();
      });
    }
  }

  private async unlockAudioFromGesture(): Promise<void> {
    const context = this.getContext();

    if (!context) {
      return;
    }

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
    } catch {
      return;
    }

    if (AudioSystem.musicRequested && this.getMusicVolume() > 0) {
      this.startMusic();
    }
  }

  private async loadBuffer(context: AudioContext, soundId: SoundId, url: string): Promise<void> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      AudioSystem.buffers.set(soundId, audioBuffer);
    } catch {
      AudioSystem.buffers.delete(soundId);
    }
  }

  private async loadMusicBuffer(context: AudioContext): Promise<void> {
    if (AudioSystem.musicBuffer) {
      return;
    }

    if (AudioSystem.musicLoading) {
      return AudioSystem.musicLoading;
    }

    AudioSystem.musicLoading = (async () => {
      try {
        const response = await fetch(BACKGROUND_MUSIC_URL);

        if (!response.ok) {
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        AudioSystem.musicBuffer = await context.decodeAudioData(arrayBuffer);
      } catch {
        AudioSystem.musicBuffer = null;
      } finally {
        AudioSystem.musicLoading = null;
      }
    })();

    await AudioSystem.musicLoading;

    if (AudioSystem.musicRequested && this.getMusicVolume() > 0 && !AudioSystem.musicSource) {
      this.startMusic();
    }
  }

  private updateMusicGain(): void {
    if (!AudioSystem.musicGain) {
      return;
    }

    AudioSystem.musicGain.gain.value = this.getMusicGainValue();
  }

  private getMusicGainValue(): number {
    return this.getMusicVolume() * 0.12;
  }

  private playFallbackTone(context: AudioContext, soundId: SoundId): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = soundId === 'lifeLost' || soundId === 'gameOver' ? 'sawtooth' : 'triangle';
    oscillator.frequency.value = FALLBACK_FREQUENCIES[soundId];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }
}