import { mkdir, writeFile } from 'node:fs/promises';

const sampleRate = 44100;
const outputDir = new URL('./sounds/', import.meta.url);

const sounds = [
  {
    name: 'buttonPress',
    duration: 0.11,
    layers: [
      { wave: 'sine', start: 0, duration: 0.06, from: 620, to: 920, gain: 0.26 },
      { wave: 'triangle', start: 0.025, duration: 0.055, from: 1240, to: 980, gain: 0.12 },
    ],
  },
  {
    name: 'paddleHit',
    duration: 0.16,
    layers: [
      { wave: 'triangle', start: 0, duration: 0.11, from: 520, to: 760, gain: 0.36 },
      { wave: 'sine', start: 0.012, duration: 0.1, from: 1040, to: 840, gain: 0.2 },
      { wave: 'noise', start: 0, duration: 0.035, from: 0, to: 0, gain: 0.08 },
    ],
  },
  {
    name: 'ballLaunch',
    duration: 0.18,
    layers: [
      { wave: 'sine', start: 0, duration: 0.12, from: 360, to: 940, gain: 0.3 },
      { wave: 'triangle', start: 0.025, duration: 0.11, from: 720, to: 1180, gain: 0.18 },
      { wave: 'noise', start: 0, duration: 0.035, from: 0, to: 0, gain: 0.06 },
    ],
  },
  {
    name: 'brickHit',
    duration: 0.13,
    layers: [
      { wave: 'square', start: 0, duration: 0.075, from: 190, to: 150, gain: 0.18 },
      { wave: 'noise', start: 0, duration: 0.06, from: 0, to: 0, gain: 0.12 },
    ],
  },
  {
    name: 'brickDestroy',
    duration: 0.18,
    layers: [
      { wave: 'triangle', start: 0, duration: 0.13, from: 520, to: 260, gain: 0.22 },
      { wave: 'noise', start: 0.015, duration: 0.11, from: 0, to: 0, gain: 0.16 },
    ],
  },
  {
    name: 'brickExplode',
    duration: 0.32,
    layers: [
      { wave: 'noise', start: 0, duration: 0.23, from: 0, to: 0, gain: 0.28 },
      { wave: 'sawtooth', start: 0, duration: 0.24, from: 120, to: 46, gain: 0.22 },
      { wave: 'square', start: 0.035, duration: 0.09, from: 72, to: 58, gain: 0.18 },
    ],
  },
  {
    name: 'brickIndestructible',
    duration: 0.16,
    layers: [
      { wave: 'square', start: 0, duration: 0.055, from: 95, to: 95, gain: 0.22 },
      { wave: 'square', start: 0.07, duration: 0.055, from: 75, to: 75, gain: 0.18 },
    ],
  },
  {
    name: 'powerUp',
    duration: 0.28,
    layers: [
      { wave: 'sine', start: 0, duration: 0.1, from: 560, to: 760, gain: 0.18 },
      { wave: 'sine', start: 0.08, duration: 0.1, from: 760, to: 980, gain: 0.18 },
      { wave: 'sine', start: 0.16, duration: 0.1, from: 980, to: 1320, gain: 0.15 },
    ],
  },
  {
    name: 'lifeLost',
    duration: 0.42,
    layers: [
      { wave: 'sawtooth', start: 0, duration: 0.35, from: 360, to: 86, gain: 0.32 },
      { wave: 'triangle', start: 0.035, duration: 0.3, from: 180, to: 64, gain: 0.22 },
      { wave: 'noise', start: 0.02, duration: 0.12, from: 0, to: 0, gain: 0.09 },
    ],
  },
  {
    name: 'levelComplete',
    duration: 0.5,
    layers: [
      { wave: 'sine', start: 0, duration: 0.14, from: 520, to: 520, gain: 0.16 },
      { wave: 'sine', start: 0.12, duration: 0.14, from: 660, to: 660, gain: 0.16 },
      { wave: 'sine', start: 0.24, duration: 0.2, from: 880, to: 1040, gain: 0.18 },
    ],
  },
  {
    name: 'gameOver',
    duration: 0.52,
    layers: [
      { wave: 'sawtooth', start: 0, duration: 0.42, from: 190, to: 72, gain: 0.22 },
      { wave: 'triangle', start: 0.1, duration: 0.32, from: 95, to: 48, gain: 0.17 },
    ],
  },
];

const music = {
  name: 'backgroundMusic',
  bpm: 132,
  bars: 4,
};

const alternateMusic = [
  {
    name: 'backgroundMusicBrightRush',
    bpm: 150,
    bassNotes: [48, 48, 55, 55, 53, 53, 58, 55, 48, 50, 51, 53, 55, 58, 60, 58],
    leadNotes: [72, 76, 79, 84, 83, 79, 76, 79, 74, 77, 81, 86, 84, 81, 79, 76],
    chords: [[60, 64, 67], [67, 71, 74], [65, 69, 72], [70, 74, 77]],
    bassWave: 'triangle',
    leadWave: 'square',
    leadGain: 0.055,
    arpGain: 0.035,
    hatGain: 0.075,
    kickGain: 0.22,
    snareGain: 0.14,
  },
  {
    name: 'backgroundMusicNeonSprint',
    bpm: 158,
    bassNotes: [50, 50, 57, 57, 55, 55, 53, 57, 50, 50, 62, 60, 57, 55, 53, 52],
    leadNotes: [74, 81, 79, 86, 84, 81, 79, 76, 77, 84, 82, 89, 86, 82, 81, 77],
    chords: [[62, 65, 69], [69, 72, 76], [67, 71, 74], [65, 69, 72]],
    bassWave: 'sawtooth',
    leadWave: 'triangle',
    leadGain: 0.075,
    arpGain: 0.045,
    hatGain: 0.09,
    kickGain: 0.2,
    snareGain: 0.16,
  },
  {
    name: 'backgroundMusicLaserRun',
    bpm: 144,
    bassNotes: [45, 52, 57, 52, 48, 55, 60, 55, 45, 52, 57, 64, 60, 57, 55, 52],
    leadNotes: [76, 79, 83, 88, 86, 83, 79, 76, 74, 78, 81, 86, 88, 86, 83, 79],
    chords: [[57, 60, 64], [64, 67, 71], [60, 64, 67], [62, 65, 69]],
    bassWave: 'triangle',
    leadWave: 'sawtooth',
    leadGain: 0.05,
    arpGain: 0.04,
    hatGain: 0.08,
    kickGain: 0.24,
    snareGain: 0.12,
  },
  {
    name: 'backgroundMusicArcadePulse',
    bpm: 136,
    bassNotes: [52, 52, 59, 59, 57, 57, 55, 59, 52, 55, 57, 59, 64, 62, 59, 57],
    leadNotes: [76, 80, 83, 88, 90, 88, 83, 80, 78, 81, 85, 90, 88, 85, 81, 78],
    chords: [[64, 68, 71], [71, 75, 78], [69, 73, 76], [67, 71, 74]],
    bassWave: 'square',
    leadWave: 'triangle',
    leadGain: 0.065,
    arpGain: 0.05,
    hatGain: 0.065,
    kickGain: 0.18,
    snareGain: 0.15,
  },
  {
    name: 'backgroundMusicSkylineChase',
    bpm: 166,
    bassNotes: [47, 47, 54, 54, 59, 59, 57, 54, 47, 50, 52, 54, 59, 62, 61, 59],
    leadNotes: [71, 78, 83, 86, 90, 86, 83, 78, 73, 80, 85, 88, 92, 88, 85, 80],
    chords: [[59, 62, 66], [66, 69, 73], [71, 74, 78], [69, 73, 76]],
    bassWave: 'triangle',
    leadWave: 'square',
    leadGain: 0.052,
    arpGain: 0.038,
    hatGain: 0.1,
    kickGain: 0.2,
    snareGain: 0.13,
  },
];

function waveValue(wave, phase, noise) {
  switch (wave) {
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'sawtooth':
      return 2 * ((phase / (Math.PI * 2)) % 1) - 1;
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case 'noise':
      return noise;
    default:
      return Math.sin(phase);
  }
}

function envelope(position) {
  const attack = 0.08;
  const releaseStart = 0.55;

  if (position < attack) {
    return position / attack;
  }

  if (position > releaseStart) {
    return Math.max(1 - (position - releaseStart) / (1 - releaseStart), 0);
  }

  return 1;
}

function renderSound(sound) {
  const sampleCount = Math.ceil(sound.duration * sampleRate);
  const samples = new Float32Array(sampleCount);
  const phases = new Array(sound.layers.length).fill(0);
  let random = 0x12345678;

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    let sample = 0;

    random = (1664525 * random + 1013904223) >>> 0;
    const noise = (random / 0xffffffff) * 2 - 1;

    sound.layers.forEach((layer, layerIndex) => {
      const localTime = time - layer.start;

      if (localTime < 0 || localTime > layer.duration) {
        return;
      }

      const position = localTime / layer.duration;
      const frequency = layer.from + (layer.to - layer.from) * position;
      phases[layerIndex] += (Math.PI * 2 * frequency) / sampleRate;
      sample += waveValue(layer.wave, phases[layerIndex], noise) * layer.gain * envelope(position);
    });

    samples[index] = Math.max(Math.min(sample, 0.95), -0.95);
  }

  return samples;
}

function createWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * 2);
  }

  return buffer;
}

function midiToFrequency(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

function addTone(samples, start, duration, frequency, gain, wave = 'triangle') {
  const startIndex = Math.floor(start * sampleRate);
  const endIndex = Math.min(samples.length, startIndex + Math.floor(duration * sampleRate));
  let phase = 0;

  for (let index = startIndex; index < endIndex; index += 1) {
    const position = (index - startIndex) / Math.max(endIndex - startIndex, 1);
    const noteEnvelope = Math.sin(Math.PI * position) ** 0.7;
    phase += (Math.PI * 2 * frequency) / sampleRate;
    samples[index] += waveValue(wave, phase, 0) * gain * noteEnvelope;
  }
}

function addKick(samples, start, gain = 0.36) {
  const startIndex = Math.floor(start * sampleRate);
  const length = Math.floor(0.18 * sampleRate);
  let phase = 0;

  for (let offset = 0; offset < length && startIndex + offset < samples.length; offset += 1) {
    const position = offset / length;
    const frequency = 120 - 70 * position;
    phase += (Math.PI * 2 * frequency) / sampleRate;
    samples[startIndex + offset] += Math.sin(phase) * gain * ((1 - position) ** 2.4);
  }
}

function addSnare(samples, start, gain = 0.18) {
  const startIndex = Math.floor(start * sampleRate);
  const length = Math.floor(0.12 * sampleRate);
  let random = 0x87654321;

  for (let offset = 0; offset < length && startIndex + offset < samples.length; offset += 1) {
    const position = offset / length;
    random = (1664525 * random + 1013904223) >>> 0;
    const noise = (random / 0xffffffff) * 2 - 1;
    samples[startIndex + offset] += noise * gain * ((1 - position) ** 2);
  }
}

function addHat(samples, start, gain = 0.055) {
  const startIndex = Math.floor(start * sampleRate);
  const length = Math.floor(0.045 * sampleRate);
  let random = 0xabcdef12;

  for (let offset = 0; offset < length && startIndex + offset < samples.length; offset += 1) {
    const position = offset / length;
    random = (1103515245 * random + 12345) >>> 0;
    const noise = (random / 0xffffffff) * 2 - 1;
    samples[startIndex + offset] += noise * gain * (1 - position);
  }
}

function addClap(samples, start, gain = 0.08) {
  addSnare(samples, start, gain);
  addSnare(samples, start + 0.018, gain * 0.72);
  addSnare(samples, start + 0.036, gain * 0.5);
}

function addBrightArp(samples, start, secondsPerBeat, notes, gain) {
  const stepDuration = secondsPerBeat / 4;

  for (let step = 0; step < 4; step += 1) {
    addTone(
      samples,
      start + step * stepDuration,
      stepDuration * 0.74,
      midiToFrequency(notes[step % notes.length]),
      gain,
      step % 2 === 0 ? 'triangle' : 'sine',
    );
  }
}

function renderMusic({ bpm, bars }) {
  const beats = bars * 4;
  const secondsPerBeat = 60 / bpm;
  const duration = beats * secondsPerBeat;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  const bassNotes = [36, 36, 43, 43, 41, 41, 39, 43, 36, 36, 43, 43, 46, 43, 41, 39];
  const leadNotes = [60, 64, 67, 72, 71, 67, 64, 67, 62, 65, 69, 74, 72, 69, 67, 64];

  for (let beat = 0; beat < beats; beat += 1) {
    const time = beat * secondsPerBeat;

    addTone(samples, time, secondsPerBeat * 0.42, midiToFrequency(bassNotes[beat]), 0.18, 'sawtooth');
    addTone(samples, time, secondsPerBeat * 0.3, midiToFrequency(leadNotes[beat]), 0.07, 'triangle');
    addKick(samples, time);

    if (beat % 4 === 1 || beat % 4 === 3) {
      addSnare(samples, time);
    }

    addHat(samples, time);
    addHat(samples, time + secondsPerBeat / 2);
  }

  for (let beat = 0; beat < beats; beat += 2) {
    const time = beat * secondsPerBeat;
    const chord = beat % 8 === 0 ? [48, 52, 55] : beat % 8 === 2 ? [55, 59, 62] : beat % 8 === 4 ? [53, 57, 60] : [51, 55, 58];

    for (const note of chord) {
      addTone(samples, time, secondsPerBeat * 1.7, midiToFrequency(note), 0.035, 'sine');
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.max(Math.min(samples[index], 0.85), -0.85);
  }

  return samples;
}

function renderAlternateMusic(variant) {
  const beats = 16;
  const secondsPerBeat = 60 / variant.bpm;
  const duration = beats * secondsPerBeat;
  const samples = new Float32Array(Math.ceil(duration * sampleRate));

  for (let beat = 0; beat < beats; beat += 1) {
    const time = beat * secondsPerBeat;
    const bassNote = variant.bassNotes[beat % variant.bassNotes.length];
    const leadNote = variant.leadNotes[beat % variant.leadNotes.length];
    const chord = variant.chords[Math.floor(beat / 4) % variant.chords.length];

    addTone(samples, time, secondsPerBeat * 0.34, midiToFrequency(bassNote), 0.11, variant.bassWave);
    addTone(samples, time, secondsPerBeat * 0.38, midiToFrequency(leadNote), variant.leadGain, variant.leadWave);
    addBrightArp(samples, time, secondsPerBeat, chord.map((note) => note + 12), variant.arpGain);
    addKick(samples, time, variant.kickGain);

    if (beat % 4 === 1 || beat % 4 === 3) {
      addClap(samples, time, variant.snareGain);
    }

    addHat(samples, time, variant.hatGain);
    addHat(samples, time + secondsPerBeat / 2, variant.hatGain * 0.82);
    addHat(samples, time + secondsPerBeat * 0.75, variant.hatGain * 0.48);
  }

  for (let beat = 0; beat < beats; beat += 2) {
    const time = beat * secondsPerBeat;
    const chord = variant.chords[Math.floor(beat / 2) % variant.chords.length];

    for (const note of chord) {
      addTone(samples, time, secondsPerBeat * 1.35, midiToFrequency(note), 0.024, 'sine');
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    const position = index / Math.max(samples.length - 1, 1);
    const loopFade = Math.min(position / 0.015, (1 - position) / 0.015, 1);
    samples[index] = Math.max(Math.min(samples[index] * loopFade, 0.82), -0.82);
  }

  return samples;
}

await mkdir(outputDir, { recursive: true });

for (const sound of sounds) {
  await writeFile(new URL(`${sound.name}.wav`, outputDir), createWav(renderSound(sound)));
}

await writeFile(new URL(`${music.name}.wav`, outputDir), createWav(renderMusic(music)));

for (const variant of alternateMusic) {
  await writeFile(new URL(`${variant.name}.wav`, outputDir), createWav(renderAlternateMusic(variant)));
}