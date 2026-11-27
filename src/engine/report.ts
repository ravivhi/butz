/* Parent report model (SPEC §11.2 R-PA4): learning observations per strand, not a diagnosis. */
import { LETTER, LETTERS, VOWELS } from './hebrew.ts';
import { GAME, MAP_ORDER, SKILLS, STRANDS, type GameId, type Strand } from './curriculum.ts';
import { accuracy, band, confusions, dayKey, DAY, gameLevel, maxLevel, type Attempt, type Band, type Learner } from './learner.ts';

export interface StrandRow { id: Strand; label: string; band: Band; needsPractice: boolean; mastered: number; started: number }
export interface Report {
  strands: StrandRow[];
  letters: { id: string; char: string; band: Band }[];
  vowels: { id: string; name: string; band: Band }[];
  confusions: { a: string; b: string; count: number }[];
  days: { day: string; items: number; ok: number }[];
  totalItems: number;
}

export function buildReport(l: Learner, now: number): Report {
  const strands = STRANDS.map(({ id, label }) => {
    const skills = SKILLS.filter((s) => s.strand === id).map((s) => l.skills[s.id]).filter((s) => s && s.att.length);
    const mastered = skills.filter((s) => s!.status === 'mastered').length;
    const accs = skills.map((s) => accuracy(s) ?? 0);
    const avg = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
    const b: Band = !skills.length ? 'notStarted' : mastered / skills.length >= 0.7 ? 'strong' : avg >= 0.6 ? 'developing' : 'practising';
    return { id, label, band: b, needsPractice: skills.some((s) => band(s).needsPractice), mastered, started: skills.length };
  });
  const letters = LETTERS.map((x) => ({ id: x.id, char: x.char, band: band(l.skills['L.' + x.id]).band }));
  const vowels = VOWELS.map((v) => ({ id: v.id, name: v.name, band: band(l.skills['V.' + v.id]).band }));
  const conf = confusions(l, 60, 2)
    .filter((c) => c.skill.startsWith('L.') && LETTER[c.other])
    .map((c) => ({ a: LETTER[c.skill.slice(2)].char, b: LETTER[c.other].char, count: c.count }));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(now - (6 - i) * DAY);
    const xs = l.recent.filter((a) => dayKey(a.t) === day);
    return { day, items: xs.length, ok: xs.filter((a) => a.ok).length };
  });
  return { strands, letters, vowels, confusions: conf, days, totalItems: l.recent.length };
}

/* ------------------------------------------------------------------ parents area (owner request, 27 Nov 2026)
   One glance: time played today, a 7-day picture, and per game a colour (doing well / practising / finding it hard)
   plus the hidden level. Kept deliberately small: no charts, no per-skill tables. */

export type GameStatus = 'none' | 'new' | 'good' | 'ok' | 'hard';
/** Last `window` answers of a game; first-try answers without a hint count as success. */
export const PARENT = { window: 20, minTries: 4, good: 0.8, ok: 0.6 };
export interface GameRow { game: GameId; status: GameStatus; level: number; max: number; tries: number; rate: number | null }
export interface DayRow { day: string; weekday: number; minutes: number; answers: number; ok: number; stars: number }
export interface ParentSummary { todayMin: number; week: DayRow[]; weekMin: number; weekStars: number; weekRate: number | null; games: GameRow[] }

export function gameStatus(atts: Attempt[]): { status: GameStatus; rate: number | null } {
  if (!atts.length) return { status: 'none', rate: null };
  const last = atts.slice(-PARENT.window);
  const rate = last.filter((a) => a.ok && !a.help).length / last.length;
  if (last.length < PARENT.minTries) return { status: 'new', rate };
  return { status: rate >= PARENT.good ? 'good' : rate >= PARENT.ok ? 'ok' : 'hard', rate };
}

export const minutes = (ms: number | undefined): number => Math.round((ms ?? 0) / 60000);

export function parentSummary(l: Learner, playMs: Record<string, number> | undefined, sessions: { day: string; stars: number }[], now: number): ParentSummary {
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = now - (6 - i) * DAY;
    const day = dayKey(t);
    const xs = l.recent.filter((a) => dayKey(a.t) === day);
    return {
      day, weekday: new Date(t).getDay(), minutes: minutes(playMs?.[day]),
      answers: xs.length, ok: xs.filter((a) => a.ok && !a.help).length,
      stars: sessions.filter((x) => x.day === day).reduce((n, x) => n + x.stars, 0),
    };
  });
  const answers = week.reduce((n, d) => n + d.answers, 0);
  const games = MAP_ORDER.filter((g) => GAME[g]).map((game) => {
    const atts = l.recent.filter((a) => a.game === game);
    return { game, ...gameStatus(atts), level: gameLevel(l, game), max: maxLevel(game), tries: atts.length };
  });
  return {
    todayMin: week[6].minutes, week, weekMin: week.reduce((n, d) => n + d.minutes, 0),
    weekStars: week.reduce((n, d) => n + d.stars, 0),
    weekRate: answers ? week.reduce((n, d) => n + d.ok, 0) / answers : null,
    games,
  };
}
