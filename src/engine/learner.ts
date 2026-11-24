/* Learner model (SPEC §6): attempts → skill states, mastery, spaced review, confusions, report bands. Pure TS. */
import { gamesFor } from './curriculum.ts';

export interface Attempt {
  t: number;
  skill: string;
  game: string;
  item: string;
  ok: boolean;
  help: 0 | 1 | 2;
  first?: string;   // option picked first when wrong (confusions)
  ms: number;
  fresh?: boolean;  // item never answered correctly before (set by record)
  review?: boolean;
}

export type Status = 'introduced' | 'practising' | 'mastered';
export interface SkillState {
  introducedAt: number;
  how: 'demo' | 'placement' | 'school' | 'practice';
  att: Attempt[];
  okItems: string[];
  status: Status;
  box: number;
  due: number | null;
  masteredAt: number | null;
}

export interface Learner {
  skills: Record<string, SkillState>;
  recent: Attempt[];
  placementDone: boolean;
  /** Content key ('w:', 's:', 'st:', 'sw:' + id) → last time it was shown. Generators pick the least recently seen. */
  seen: Record<string, number>;
}

export const DAY = 24 * 3600 * 1000;

/** All tunable thresholds in one place (SPEC §6.3, §7.3). Initial product heuristics, not official cut-offs. */
export const MASTERY = {
  window: 8,
  accuracy: 0.85,
  minGames: 2,
  minDays: 2,
  freshShare: 0.5,
  freshSkills: ['CV', 'W1', 'W2', 'W3', 'SIGHT', 'FIN', 'X.quiet', 'V.shva', 'COMP.read', 'COMP.listen'],
  reviewDays: [1, 3, 7, 14, 30],
  reviewPass: 0.8,
  reviewFail: 0.7,
  reviewMin: 3,
  readyWindow: 6,
  readyAccuracy: 0.7,
  maxInFlight: 3,
  keepPerSkill: 30,
  keepRecent: 400,
  keepOkItems: 300,
};

export const newLearner = (): Learner => ({ skills: {}, recent: [], placementDone: false, seen: {} });

/** Remember that content was shown now (so it is not repeated soon). Keeps the map bounded. */
export function markSeen(l: Learner, keys: string[], now: number): void {
  l.seen ??= {};
  for (const k of keys) l.seen[k] = now;
  const all = Object.keys(l.seen);
  if (all.length > 3000) for (const k of all.sort((a, b) => l.seen[a] - l.seen[b]).slice(0, all.length - 2500)) delete l.seen[k];
}

export const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function introduce(l: Learner, skill: string, now: number, how: SkillState['how'] = 'demo'): SkillState {
  let st = l.skills[skill];
  if (!st) {
    st = { introducedAt: now, how, att: [], okItems: [], status: 'introduced', box: 0, due: null, masteredAt: null };
    l.skills[skill] = st;
  }
  return st;
}

const independent = (st: SkillState): Attempt[] => st.att.filter((a) => a.help === 0);

/** Accuracy over the last n independent attempts (null when there are none). */
export function accuracy(st: SkillState | undefined, n = MASTERY.window): number | null {
  if (!st) return null;
  const xs = independent(st).slice(-n);
  return xs.length ? xs.filter((a) => a.ok).length / xs.length : null;
}

export function isMasteredNow(skill: string, st: SkillState): boolean {
  const xs = independent(st).filter((a) => !a.review).slice(-MASTERY.window);
  if (xs.length < MASTERY.window) return false;
  const ok = xs.filter((a) => a.ok);
  if (ok.length / xs.length < MASTERY.accuracy) return false;
  const needGames = Math.min(MASTERY.minGames, Math.max(1, gamesFor(skill).length));
  if (new Set(ok.map((a) => a.game)).size < needGames) return false;
  if (new Set(xs.map((a) => dayKey(a.t))).size < MASTERY.minDays) return false;
  if (MASTERY.freshSkills.includes(skill) && ok.filter((a) => a.fresh).length < Math.ceil(ok.length * MASTERY.freshShare)) return false;
  return true;
}

export interface RecordResult { mastered: boolean }

export function record(l: Learner, a: Attempt): RecordResult {
  const st = introduce(l, a.skill, a.t, 'practice');
  const fresh = !st.okItems.includes(a.item);
  const att: Attempt = { ...a, fresh };
  st.att.push(att);
  if (st.att.length > MASTERY.keepPerSkill) st.att.splice(0, st.att.length - MASTERY.keepPerSkill);
  if (a.ok && a.help === 0 && fresh) {
    st.okItems.push(a.item);
    if (st.okItems.length > MASTERY.keepOkItems) st.okItems.splice(0, st.okItems.length - MASTERY.keepOkItems);
  }
  l.recent.push(att);
  if (l.recent.length > MASTERY.keepRecent) l.recent.splice(0, l.recent.length - MASTERY.keepRecent);

  if (st.status === 'mastered') return { mastered: false };
  if (isMasteredNow(a.skill, st)) {
    st.status = 'mastered';
    st.masteredAt = a.t;
    st.box = 1;
    st.due = a.t + MASTERY.reviewDays[0] * DAY;
    return { mastered: true };
  }
  st.status = 'practising';
  return { mastered: false };
}

/** Mastered skills whose review is due, most overdue first. */
export function reviewDue(l: Learner, now: number): string[] {
  return Object.entries(l.skills)
    .filter(([, s]) => s.status === 'mastered' && s.due !== null && s.due <= now)
    .sort((a, b) => (a[1].due ?? 0) - (b[1].due ?? 0))
    .map(([k]) => k);
}

/** Close a review activity: move the review box up, keep it, or send the skill back to practice (SPEC §6.3). */
export function closeReview(l: Learner, skill: string, attempts: Attempt[], now: number): 'passed' | 'failed' | 'repeat' {
  const st = l.skills[skill];
  if (!st || st.status !== 'mastered') return 'repeat';
  const xs = attempts.filter((a) => a.skill === skill);
  const acc = xs.length ? xs.filter((a) => a.ok && a.help === 0).length / xs.length : 0;
  if (xs.length >= MASTERY.reviewMin && acc < MASTERY.reviewFail) {
    st.status = 'practising';
    st.box = 0;
    st.due = null;
    st.masteredAt = null;
    return 'failed';
  }
  if (acc >= MASTERY.reviewPass) {
    st.box = Math.min(st.box + 1, MASTERY.reviewDays.length);
    st.due = now + MASTERY.reviewDays[st.box - 1] * DAY;
    return 'passed';
  }
  st.due = now + DAY;
  return 'repeat';
}

/** Is an in-flight unit ready for the next introduction? (SPEC §7.3) */
export function isReady(st: SkillState | undefined): boolean {
  if (!st) return false;
  if (st.status === 'mastered') return true;
  const xs = independent(st).slice(-MASTERY.readyWindow);
  if (xs.length < MASTERY.readyWindow) return false;
  return xs.filter((a) => a.ok).length / xs.length >= MASTERY.readyAccuracy;
}

export interface Confusion { skill: string; other: string; count: number }
/** Repeated wrong first choices on letter/vowel skills in the last `window` attempts. */
export function confusions(l: Learner, window = 30, min = 3): Confusion[] {
  const counts = new Map<string, Confusion>();
  for (const a of l.recent.slice(-window)) {
    if (a.ok && a.help === 0) continue;
    if (!a.first || !(a.skill.startsWith('L.') || a.skill.startsWith('V.'))) continue;
    const key = a.skill + '|' + a.first;
    const c = counts.get(key) ?? { skill: a.skill, other: a.first, count: 0 };
    c.count++;
    counts.set(key, c);
  }
  return [...counts.values()].filter((c) => c.count >= min).sort((a, b) => b.count - a.count);
}

export type Band = 'notStarted' | 'practising' | 'developing' | 'strong';
export function band(st: SkillState | undefined): { band: Band; needsPractice: boolean } {
  if (!st || st.att.length === 0) return { band: 'notStarted', needsPractice: false };
  if (st.status === 'mastered') return { band: 'strong', needsPractice: false };
  const acc = accuracy(st) ?? 0;
  const last6 = st.att.slice(-6);
  const needsPractice = last6.length >= 6 && last6.filter((a) => a.ok && a.help === 0).length / last6.length < 0.6;
  return { band: acc >= 0.6 ? 'developing' : 'practising', needsPractice };
}
