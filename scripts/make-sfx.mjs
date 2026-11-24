// Generates the bundled sound effects (assets/sfx/*.wav): small synthesized tones, no third-party audio.
import { writeFileSync, mkdirSync } from 'node:fs';

const RATE = 22050;
const out = new URL('../assets/sfx/', import.meta.url);
mkdirSync(out, { recursive: true });

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767 | 0, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
function tone(buf, start, dur, f0, f1, vol, shape = 'sine') {
  const n = Math.floor(dur * RATE), s0 = Math.floor(start * RATE);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t;
    phase += f / RATE;
    const env = Math.min(1, i / (0.01 * RATE)) * Math.pow(1 - t, 1.6);
    const v = shape === 'tri' ? tri(phase) : Math.sin(2 * Math.PI * phase);
    buf[s0 + i] = (buf[s0 + i] ?? 0) + v * env * vol;
  }
}
const make = (len, fn) => { const b = new Array(Math.floor(len * RATE)).fill(0); fn(b); return b; };

const sounds = {
  tap: make(0.06, (b) => tone(b, 0, 0.05, 1300, 1100, 0.25)),
  correct: make(0.45, (b) => { tone(b, 0, 0.16, 784, 784, 0.35, 'tri'); tone(b, 0.1, 0.32, 1175, 1175, 0.35, 'tri'); }),
  wrong: make(0.3, (b) => tone(b, 0, 0.28, 260, 190, 0.3)),
  star: make(0.5, (b) => [1568, 1760, 2093, 2349, 2637].forEach((f, i) => tone(b, i * 0.07, 0.18, f, f, 0.18, 'tri'))),
  reveal: make(0.9, (b) => { tone(b, 0, 0.45, 400, 1200, 0.2); [1047, 1319, 1568].forEach((f, i) => tone(b, 0.4 + i * 0.08, 0.4, f, f, 0.25, 'tri')); }),
  win: make(1.1, (b) => [523, 659, 784, 1047].forEach((f, i) => tone(b, i * 0.13, i === 3 ? 0.6 : 0.2, f, f, 0.3, 'tri'))),
  page: make(0.18, (b) => { for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * 0.08 * Math.sin(Math.PI * i / b.length); }),
  boing: make(0.4, (b) => { tone(b, 0, 0.38, 180, 520, 0.3); tone(b, 0.02, 0.3, 360, 900, 0.12, 'tri'); }),
  twinkle: make(0.7, (b) => [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(b, i * 0.09, 0.25, f, f, 0.12, 'tri'))),
  pop: make(0.12, (b) => tone(b, 0, 0.1, 900, 300, 0.3)),
};
for (const [name, s] of Object.entries(sounds)) writeFileSync(new URL(name + '.wav', out), wav(s));
console.log('sfx written:', Object.keys(sounds).join(', '));
