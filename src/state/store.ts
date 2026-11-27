/* App state: child profiles on this device, settings, navigation. Local only (SPEC R-PR). Tiny external store. */
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLearner, type Learner } from '../engine/learner';
import { newWallet, type Wallet } from '../engine/economy';
import { NOTEBOOK } from '../engine/content/stickers';
import type { Gender } from '../engine/phrases';
import { DEFAULT_SPINE } from '../engine/curriculum';
import { knownUnits } from '../engine/gating';
import { setSfxEnabled } from '../services/sfx';
import { setSpeechRate } from '../services/speech';

export interface Settings {
  sfx: boolean;
  rate: 'slow' | 'normal';
  minutes: 5 | 8 | 12;
  textScale: 1 | 1.25 | 1.5;
  highContrast: boolean;
  reducedMotion: boolean;
  fewerChoices: boolean;
  /** Read stimuli, praise and stories aloud automatically. Off by default (v1.1): nothing is spoken unless the child taps. */
  autoSpeak: boolean;
}
export const DEFAULT_SETTINGS: Settings = { sfx: true, rate: 'normal', minutes: 8, textScale: 1, highContrast: false, reducedMotion: false, fewerChoices: false, autoSpeak: false };

export interface SessionLog { day: string; acts: number; stars: number }
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  gender: Gender;       // chosen first at setup; drives Hebrew address forms and which sticker notebooks are offered
  createdAt: number;
  learner: Learner;
  wallet: Wallet;
  settings: Settings;
  school: string[];     // units a parent marked "learned at school" (R-H10)
  spine: string[];
  audioBad: string[];   // voice check flags (R-PA6)
  sessions: SessionLog[];
}

export type Route =
  | { name: 'setup' }
  | { name: 'home' }
  | { name: 'map' }
  | { name: 'play'; game: string }
  | { name: 'placement' }
  | { name: 'notebooks' }
  | { name: 'notebook'; id: string; open?: boolean }
  | { name: 'shop' }
  | { name: 'gate'; then: Route }
  | { name: 'parent'; tab?: 'report' | 'settings' | 'voice' | 'children' };

interface State { profiles: Profile[]; currentId: string | null; hydrated: boolean; stack: Route[] }

const KEY = 'butz:v1';
const state: State = { profiles: [], currentId: null, hydrated: false, stack: [{ name: 'home' }] };
let version = 0;
const subs = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit(persist = true): void {
  version++;
  subs.forEach((f) => f());
  if (persist && state.hydrated) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 300);
  }
}
export function saveNow(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  AsyncStorage.setItem(KEY, JSON.stringify({ v: 1, profiles: state.profiles, currentId: state.currentId })).catch(() => undefined);
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const subscribeStore = subscribe;

// Flush pending saves when the app goes to the background or the page is closed.
AppState.addEventListener('change', (s) => { if (s !== 'active' && saveTimer) saveNow(); });
if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (saveTimer) saveNow(); });
export function useStore<T>(sel: (s: State) => T): T {
  useSyncExternalStore(subscribe, () => version, () => version);
  return sel(state);
}
export const getState = () => state;

function applyDeviceSettings(p: Profile | undefined): void {
  if (!p) return;
  setSfxEnabled(p.settings.sfx);
  setSpeechRate(p.settings.rate);
}

/** Fill fields added after a profile was saved (older app versions). */
function migrate(p: Profile): Profile {
  const gender: Gender = p.gender === 'girl' ? 'girl' : 'boy';
  const wallet = p.wallet ?? newWallet(gender);
  wallet.owned = wallet.owned.filter((id) => NOTEBOOK[id]);
  if (!wallet.owned.length) wallet.owned = newWallet(gender).owned;
  if (!NOTEBOOK[wallet.active]) wallet.active = wallet.owned[0];
  return {
    ...p, gender, wallet, settings: { ...DEFAULT_SETTINGS, ...p.settings }, spine: p.spine?.length ? p.spine : DEFAULT_SPINE,
    learner: { ...p.learner, seen: p.learner.seen ?? {} },
  };
}

export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.profiles = (data.profiles ?? []).map(migrate);
      state.currentId = data.currentId ?? state.profiles[0]?.id ?? null;
    }
  } catch { /* corrupt or unavailable storage: start fresh */ }
  state.hydrated = true;
  state.stack = [current() ? { name: 'home' } : { name: 'setup' }];
  applyDeviceSettings(current());
  emit(false);
}

export const current = (): Profile | undefined => state.profiles.find((p) => p.id === state.currentId);
export function useProfile(): Profile | undefined { return useStore(() => current()); }
export const knownFor = (p: Profile) => knownUnits(p.learner, p.school);

/** Mutate the current profile and persist. */
export function updateProfile(fn: (p: Profile) => void): void {
  const p = current();
  if (!p) return;
  fn(p);
  applyDeviceSettings(p);
  emit();
}

export function createProfile(name: string, avatar: string, gender: Gender, school: string[] = []): Profile {
  const p: Profile = {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name: name.replace(/[<>]/g, '').trim().slice(0, 24), avatar, gender, createdAt: Date.now(),
    learner: newLearner(), wallet: newWallet(gender), settings: { ...DEFAULT_SETTINGS }, school, spine: DEFAULT_SPINE, audioBad: [], sessions: [],
  };
  state.profiles.push(p);
  state.currentId = p.id;
  state.stack = [{ name: 'home' }];
  applyDeviceSettings(p);
  emit();
  saveNow();
  return p;
}

export function switchProfile(id: string): void {
  if (!state.profiles.some((p) => p.id === id)) return;
  state.currentId = id;
  applyDeviceSettings(current());
  state.stack = [{ name: 'home' }];
  emit();
}

export function deleteProfile(id: string): void {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.currentId === id) state.currentId = state.profiles[0]?.id ?? null;
  state.stack = [current() ? { name: 'home' } : { name: 'setup' }];
  emit();
  saveNow();
}

/* ------------------------------------------------------------------ navigation */
export const route = (): Route => state.stack[state.stack.length - 1];
export function useRoute(): Route { return useStore(() => route()); }
export function go(r: Route): void { state.stack.push(r); emit(false); }
export function replace(r: Route): void { state.stack[state.stack.length - 1] = r; emit(false); }
export function back(): void { if (state.stack.length > 1) state.stack.pop(); else state.stack = [{ name: 'home' }]; emit(false); }
/** The phone's back button (src/services/backButton.ts): one screen back. False on the first screen, so the
 *  system may close the app. */
export function systemBack(): boolean {
  if (state.stack.length <= 1) return false;
  back();
  return true;
}
export function home(): void { state.stack = [{ name: current() ? 'home' : 'setup' }]; emit(false); }
export const refresh = () => emit();
