/* Hebrew speech (SPEC R-T4, §3.3): recorded clips first (generated neural audio, scripts/make-audio.ts), else device TTS
   with the best Hebrew voice. */
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { CLIPS } from './clips';
import { speakable } from '../engine/phrases';

export { speakable };

let voiceId: string | undefined;
let voiceName = '';
let checked = false;
let rateScale = 1;
let token = 0;
let clipPlayer: AudioPlayer | null = null;
const listeners = new Set<() => void>();

export const speechInfo = () => ({ checked, hebrew: !!voiceId, voiceName });
export const onSpeechInfo = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

async function pickVoice(): Promise<boolean> {
  try {
    const vs = await Speech.getAvailableVoicesAsync();
    if (!vs.length) return false;
    const he = vs.filter((v) => /^(he|iw)/i.test(v.language));
    const best = he.find((v) => /natural|online|neural|premium|enhanced/i.test(`${v.name} ${v.identifier}`)) ?? he.find((v) => v.quality === 'Enhanced') ?? he[0];
    voiceId = best?.identifier;
    voiceName = best?.name ?? '';
    return true;
  } catch {
    return false;
  }
}

export async function initSpeech(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    if (await pickVoice()) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  checked = true;
  listeners.forEach((f) => f());
}

export const setSpeechRate = (r: 'slow' | 'normal') => { rateScale = r === 'slow' ? 0.82 : 1; };

function playClip(src: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      clipPlayer?.remove();
      clipPlayer = createAudioPlayer(src);
      const sub = clipPlayer.addListener('playbackStatusUpdate', (s) => { if (s.didJustFinish) { sub.remove(); resolve(); } });
      clipPlayer.play();
      setTimeout(resolve, 6000);
    } catch {
      resolve();
    }
  });
}

function speakOne(raw: string, rate: number, my: number): Promise<void> {
  const clip = CLIPS[raw.normalize('NFC')];
  if (clip) return playClip(clip);
  const text = speakable(raw);
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    // Some engines never fire onDone (web without a voice): fall back to a length-based timer.
    const timer = setTimeout(finish, 900 + text.length * 140 / rate);
    try {
      Speech.speak(text, {
        language: 'he-IL', voice: voiceId, rate: rate * rateScale, pitch: 1,
        onDone: () => { clearTimeout(timer); finish(); }, onStopped: () => { clearTimeout(timer); finish(); }, onError: () => { clearTimeout(timer); finish(); },
      });
    } catch {
      clearTimeout(timer);
      finish();
    }
    if (my !== token) finish();
  });
}

export interface SayOpts { rate?: number; queue?: boolean; gap?: number }

/** Speak one or more utterances in order. Resolves when finished or interrupted by another say/stop. */
export async function say(parts: string | (string | undefined)[], opts: SayOpts = {}): Promise<void> {
  const list = (Array.isArray(parts) ? parts : [parts]).filter((p): p is string => !!p && !!p.trim());
  if (!opts.queue) stopSpeech();
  const my = token;
  for (const p of list) {
    if (my !== token) return;
    await speakOne(p, opts.rate ?? 0.9, my);
    if (opts.gap && my === token) await new Promise((r) => setTimeout(r, opts.gap));
  }
}

export function stopSpeech(): void {
  token++;
  try { Speech.stop(); } catch { /* engine not ready */ }
  try { clipPlayer?.pause(); } catch { /* released */ }
}

export const RATE = { talk: 0.92, stimulus: 0.78, slow: 0.62 };
export const isWeb = Platform.OS === 'web';
