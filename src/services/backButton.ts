// The phone's back button goes one screen back in the app, and closes the app only on the first screen.
//
// Native (Expo Go): BackHandler. Web, and so the Android app (a Trusted Web Activity in Chrome): the app's screens are
// a stack in the store, not browser pages, so Chrome would leave the app on the first back press. While the app is
// deeper than its first screen we keep one extra history entry ("guard"); the back button pops it (popstate), we go
// one screen back and add the guard again if still needed. When the app gets back to its first screen by itself
// (a ✕ / home button), the guard is removed so the next back press leaves the app.
import { BackHandler, Platform } from 'react-native';
import { getState, subscribeStore, systemBack } from '../state/store';

export function initBackButton(): void {
  if (Platform.OS !== 'web') {
    BackHandler.addEventListener('hardwareBackPress', systemBack);
    return;
  }
  if (typeof window === 'undefined' || !window.history?.pushState) return;
  let guard = false; // our extra history entry is on top
  let ignorePops = 0; // pops we caused ourselves with history.back()
  const sync = () => {
    const deep = getState().stack.length > 1;
    if (deep && !guard) {
      window.history.pushState({ butzGuard: true }, '');
      guard = true;
    } else if (!deep && guard) {
      guard = false;
      ignorePops++;
      window.history.back();
    }
  };
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) { ignorePops--; return; }
    guard = false; // the back button just removed it
    systemBack(); // the store change runs sync(), which adds a new guard if the app is still deep
    sync();
  });
  subscribeStore(sync);
  sync();
}
