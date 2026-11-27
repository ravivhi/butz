/* Play time for the parents area: every few seconds, while the app is on screen and the child touched it in the last
   minute, add the time to today's total (Profile.playMs). The parents area itself and the first-run setup don't count. */
import { AppState, Platform } from 'react-native';
import { addPlayTime, route } from '../state/store';

const TICK = 5000;
const IDLE = 60_000;
const NOT_PLAY = new Set(['gate', 'parent', 'preview', 'setup']);
let started = false;

export function initPlayTime(): void {
  if (started) return;
  started = true;
  let lastTouch = Date.now();
  let active = AppState.currentState === 'active';
  AppState.addEventListener('change', (s) => { active = s === 'active'; if (active) lastTouch = Date.now(); });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const touched = () => { lastTouch = Date.now(); };
    for (const ev of ['pointerdown', 'touchstart', 'keydown'] as const) window.addEventListener(ev, touched, { capture: true, passive: true });
  }
  setInterval(() => {
    const visible = Platform.OS !== 'web' || typeof document === 'undefined' || document.visibilityState === 'visible';
    if (!active || !visible || Date.now() - lastTouch > IDLE || NOT_PLAY.has(route().name)) return;
    addPlayTime(TICK);
  }, TICK);
}
