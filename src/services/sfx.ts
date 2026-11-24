/* Sound effects + haptics. Players are created lazily and reused; everything is a no-op when switched off. */
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SOURCES = {
  tap: require('../../assets/sfx/tap.wav'),
  correct: require('../../assets/sfx/correct.wav'),
  wrong: require('../../assets/sfx/wrong.wav'),
  star: require('../../assets/sfx/star.wav'),
  reveal: require('../../assets/sfx/reveal.wav'),
  win: require('../../assets/sfx/win.wav'),
  page: require('../../assets/sfx/page.wav'),
  boing: require('../../assets/sfx/boing.wav'),
  twinkle: require('../../assets/sfx/twinkle.wav'),
  pop: require('../../assets/sfx/pop.wav'),
};
export type Sfx = keyof typeof SOURCES;

let enabled = true;
const players: Partial<Record<Sfx, AudioPlayer>> = {};

export function initAudio(): void {
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
}
export const setSfxEnabled = (on: boolean) => { enabled = on; };

export function sfx(name: Sfx): void {
  if (enabled) {
    try {
      const p = players[name] ?? (players[name] = createAudioPlayer(SOURCES[name]));
      p.volume = name === 'tap' ? 0.4 : 0.8;
      p.seekTo(0).catch(() => undefined);
      p.play();
    } catch { /* audio unavailable */ }
  }
  if (Platform.OS === 'web') return;
  try {
    if (name === 'correct' || name === 'win') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (name === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (name === 'wrong') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  } catch { /* no haptics */ }
}
