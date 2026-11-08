/** Tiny WebAudio sound effects. No audio files; silent if audio is unavailable. */
let ctx: AudioContext | null = null;
let volume = 0.6;

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
  const c = context();
  if (!c || volume <= 0) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain * volume, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  unlock(): void {
    void context()?.resume();
  },
  place(): void {
    tone(220, 0, 0.12, 'triangle', 0.25);
  },
  transfer(): void {
    tone(520, 0, 0.08, 'sine', 0.15);
  },
  cake(depth: number): void {
    const base = 523 * Math.pow(1.122, Math.min(depth, 6) - 1);
    tone(base, 0, 0.15, 'triangle', 0.25);
    tone(base * 1.25, 0.08, 0.15, 'triangle', 0.25);
    tone(base * 1.5, 0.16, 0.25, 'triangle', 0.25);
  },
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.3));
  },
  lose(): void {
    tone(262, 0, 0.3, 'sine', 0.2);
    tone(196, 0.2, 0.4, 'sine', 0.2);
  },
};
