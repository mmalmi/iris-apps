import type { SongFixture } from './types';
import { toHttpHtreeUrl } from './htree';

const cache = new Map<string, string>();

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function synthesize(song: SongFixture): string {
  const sampleRate = 24_000;
  const seconds = Math.min(24, Math.max(14, Math.round(song.duration / 10)));
  const total = sampleRate * seconds;
  const samples = new Float32Array(total);
  const beat = 60 / song.bpm;

  for (let index = 0; index < total; index += 1) {
    const time = index / sampleRate;
    const beatPhase = (time % beat) / beat;
    const pulseEnvelope = Math.exp(-6 * beatPhase);
    const slowEnvelope = 0.55 + 0.45 * Math.sin((2 * Math.PI * time) / (seconds / 2));
    const wobble = Math.sin((2 * Math.PI * song.audio.wobble * time) / seconds);

    const bass = Math.sin(2 * Math.PI * song.audio.baseFrequency * time) * 0.26;
    const pulse = Math.sin(2 * Math.PI * song.audio.pulseFrequency * time) * pulseEnvelope * 0.18;
    const pad = Math.sin(2 * Math.PI * (song.audio.padFrequency + wobble * 3) * time) * 0.12 * slowEnvelope;
    const shimmer = Math.sin(2 * Math.PI * (song.audio.pulseFrequency / 2) * time * 1.01) * 0.05;

    samples[index] = bass + pulse + pad + shimmer;
  }

  return URL.createObjectURL(encodeWav(samples, sampleRate));
}

export function getSongAudioUrl(song: SongFixture): string {
  if (song.audioUrl) return toHttpHtreeUrl(song.audioUrl);
  const cached = cache.get(song.id);
  if (cached) return cached;
  const url = synthesize(song);
  cache.set(song.id, url);
  return url;
}
