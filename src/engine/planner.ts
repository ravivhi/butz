/* Session planner (SPEC §7.2-§7.4): Continue → review, remediation, teach, practise, Story Time. Pure TS. */
import { GAME, gamesFor, isUnit, type GameId } from './curriculum.ts';
import { practiceable, type Known } from './gating.ts';
import { LETTER } from './hebrew.ts';
import { WORDS } from './content/words.ts';
import { MASTERY, accuracy, confusions, dayKey, isReady, reviewDue, type Learner } from './learner.ts';
import { keywordFor, type ActivitySpec, type Mode } from './generators.ts';
import type { Rng } from './rng.ts';

export interface PlanCtx { learner: Learner; known: Known; now: number; minutes: number; storyToday: boolean; rng: Rng; spine: string[] }
export interface PlannedActivity extends ActivitySpec { reason: 'review' | 'remediate' | 'teach' | 'practice' | 'story' }

const HIGHER = ['WRITE', 'CV', 'W1', 'W2', 'W3', 'FIN', 'SIGHT', 'FLU.phrase', 'FLU.sentence', 'COMP.read'];
const PA = ['PA.first', 'PA.count', 'PA.blend'];

/** Next spine unit to introduce (SPEC §7.3). v1.2: only the most recently taught units gate (older weak units keep being
    practised but never block new content), and a unit that is going fine (≥ 60 % of its last 4 answers) never blocks,
    even before mastery (that blocked children for weeks). If one of them is still struggling, the next unit comes anyway
    after MASTERY.stallAttempts answers, unless all of them struggle. `skip`: units already planned this session. */
export function nextToIntroduce(ctx: PlanCtx, skip: string[] = []): string | undefined {
  const l = ctx.learner;
  const next = ctx.spine.find((u) => !l.skills[u] && !ctx.known.has(u) && !skip.includes(u));
  if (!next) return undefined;
  if ((l.pushNext ?? 0) > 0 && !skip.length) return next;
  const demo = Object.entries(l.skills).filter(([id, s]) => isUnit(id) && s.how === 'demo').map(([, s]) => s);
  const recentTaught = demo.filter((s) => s.status !== 'mastered').sort((a, b) => b.introducedAt - a.introducedAt).slice(0, MASTERY.maxInFlight);
  const struggling = recentTaught.filter((s) => !isReady(s)).length;
  if (struggling === 0) return next;
  if (skip.length || struggling >= MASTERY.maxInFlight) return undefined;
  const lastIntro = Math.max(0, ...demo.map((s) => s.introducedAt));
  return l.recent.filter((a) => a.t > lastIntro).length >= MASTERY.stallAttempts ? next : undefined;
}

export function teachGame(unit: string): GameId {
  if (unit.startsWith('L.final')) return 'finalTransformer';
  if (unit.startsWith('L.')) return 'soundLighthouse';
  if (unit === 'V.shva') return 'syllableTrain';
  if (unit.startsWith('V.') && unit !== 'V.hataf') return 'nikudMagnet';
  return 'wordExplorer';
}

/** Games that can actually build items for this skill with the child's current units. */
export function gamesUsable(skill: string, l: Learner, known: Known): GameId[] {
  const letter = skill.startsWith('L.') ? LETTER[skill.slice(2)] : undefined;
  return gamesFor(skill)
    .map((g) => g.id)
    .filter((g) => {
      if (g === 'nikudMagnet') return skill.startsWith('V.');
      if (g === 'wordBakery') return (skill === 'W2' || skill === 'W3') && practiceable(skill, l, known);
      if (g === 'syllableDJ' || g === 'secretPassword') return practiceable('CV', l, known);
      if (g === 'syllableTrain' || g === 'wordExplorer') return practiceable(skill, l, known);
      if (g === 'finalTransformer') return skill === 'FIN' ? practiceable('FIN', l, known) : known.has(skill);
      if (g === 'balloonPop') return !!letter && !letter.final;
      if (g === 'memoryMatch') return !!letter && !letter.final && !!keywordFor(letter.id);
      if (g === 'missingLetter') return !!letter && WORDS.some((w) => w.firstLetter === letter.id && !w.units.includes('X.genuva'));
      return true;
    });
}

/** Prefer the game least used for this skill (transfer across formats, SPEC §6.3). */
export function pickGame(skill: string, l: Learner, known: Known, rng: Rng, avoid: GameId[] = []): GameId | undefined {
  const games = gamesUsable(skill, l, known);
  if (!games.length) return undefined;
  const used = (g: GameId) => (l.skills[skill]?.att ?? []).filter((a) => a.game === g).length + (avoid.includes(g) ? 100 : 0);
  return rng.shuffle(games).sort((a, b) => used(a) - used(b))[0];
}

const hintDependent = (l: Learner, skill: string): boolean => {
  const xs = (l.skills[skill]?.att ?? []).slice(-8);
  return xs.length >= 4 && xs.filter((a) => a.help > 0).length / xs.length > 0.5;
};

function activity(skill: string, ctx: PlanCtx, reason: PlannedActivity['reason'], mode: Mode, avoid: GameId[] = [], game?: GameId, target?: string): PlannedActivity | undefined {
  const g = game ?? pickGame(skill, ctx.learner, ctx.known, ctx.rng, avoid);
  if (!g) return undefined;
  const m = mode === 'independent' && hintDependent(ctx.learner, skill) ? 'guided' : mode;
  return { game: g, skill, mode: m, reason, n: GAME[g].items, target };
}

const lastPracticed = (l: Learner, skill: string): number => l.skills[skill]?.att.at(-1)?.t ?? 0;

/** Skills to practise now: one unit being learned + one higher skill (SPEC §7.2 step 3). */
export function practiceFocus(ctx: PlanCtx): string[] {
  const l = ctx.learner;
  const units = [...ctx.known]
    .filter((u) => isUnit(u) && l.skills[u]?.status !== 'mastered' && practiceable(u, l, ctx.known))
    .sort((a, b) => {
      const demoA = l.skills[a]?.how === 'demo' ? 0 : 1, demoB = l.skills[b]?.how === 'demo' ? 0 : 1;
      return demoA - demoB || (accuracy(l.skills[a]) ?? 0.5) - (accuracy(l.skills[b]) ?? 0.5);
    });
  // letter writing stays in regular practice even once WRITE is mastered: new letters keep coming
  const higher = HIGHER.filter((s) => practiceable(s, l, ctx.known) && (s === 'WRITE' || l.skills[s]?.status !== 'mastered'))
    .slice(0, 3)
    .sort((a, b) => lastPracticed(l, a) - lastPracticed(l, b));
  const lettersKnown = [...ctx.known].filter((u) => u.startsWith('L.')).length;
  const pa = PA.filter((s) => l.skills[s]?.status !== 'mastered').sort((a, b) => lastPracticed(l, a) - lastPracticed(l, b));
  const out: string[] = [];
  if (units[0]) out.push(units[0]);
  if (higher[0]) out.push(higher[0]);
  if (lettersKnown < 8 && pa[0]) out.push(pa[0]);
  for (const s of [...units.slice(1), ...higher.slice(1), ...pa]) if (out.length < 2 && !out.includes(s)) out.push(s);
  if (!out.length) out.push(...PA.slice(0, 2));
  return out;
}

export function planSession(ctx: PlanCtx): PlannedActivity[] {
  const l = ctx.learner;
  const maxActs = Math.max(3, Math.min(7, Math.round((ctx.minutes * 60) / 100)));
  const acts: PlannedActivity[] = [];
  const used: GameId[] = [];
  const push = (a: PlannedActivity | undefined) => { if (a) { acts.push(a); used.push(a.game); } };

  const due = reviewDue(l, ctx.now).filter((s) => practiceable(s, l, ctx.known));
  if (due[0]) push(activity(due[0], ctx, 'review', 'review'));

  const conf = confusions(l)[0];
  if (conf && conf.skill.startsWith('L.')) {
    const recentRemediation = l.recent.slice(-20).some((a) => a.game === 'letterDetective' && a.skill === conf.skill);
    push(activity(conf.skill, ctx, 'remediate', 'guided', [], recentRemediation ? 'soundLighthouse' : 'letterDetective', conf.skill.slice(2)));
  }

  const next = nextToIntroduce(ctx);
  if (next) {
    push(activity(next, ctx, 'teach', 'demo', [], teachGame(next)));
    // a second new unit only for a child who already showed the taught ones are ready (never on day one)
    const proven = Object.values(l.skills).some((s) => s.how === 'demo');
    const second = maxActs >= 5 && proven ? nextToIntroduce(ctx, [next]) : undefined;
    if (second) push(activity(second, ctx, 'teach', 'demo', [], teachGame(second)));
  }

  const focus = practiceFocus(ctx);
  for (const s of focus) {
    if (acts.length >= maxActs - (ctx.storyToday ? 0 : 1)) break;
    push(activity(s, ctx, 'practice', 'independent', used));
  }
  if (acts.filter((a) => a.reason === 'practice').length < 2 && focus[0]) push(activity(focus[0], ctx, 'practice', 'independent', used));

  if (!ctx.storyToday) {
    const readNow = practiceable('COMP.read', l, ctx.known) && new Date(ctx.now).getDate() % 2 === 0;
    push(readNow ? activity('COMP.read', ctx, 'story', 'independent', [], 'storyDetective') : activity('COMP.listen', ctx, 'story', 'independent', [], 'storyTime'));
  }
  return acts.slice(0, maxActs);
}

/** Free play from the map: the best skill for this game right now, or undefined if the child's units are not enough. */
export function freePlaySpec(game: GameId, l: Learner, known: Known, rng: Rng): ActivitySpec | undefined {
  const def = GAME[game];
  const candidates = def.skills.flatMap((p) => (p.endsWith('*') ? [...known].filter((u) => u.startsWith(p.slice(0, -1))) : [p]))
    .filter((s) => practiceable(s, l, known) && gamesUsable(s, l, known).includes(game));
  if (!candidates.length) return undefined;
  const weakest = rng.shuffle(candidates).sort((a, b) => (accuracy(l.skills[a]) ?? 0.5) - (accuracy(l.skills[b]) ?? 0.5))[0];
  return { game, skill: weakest, mode: 'independent', n: def.items };
}

/** Every game is open (v1.1). When the child's units are not enough for a game, the next spine units are lent to it
    (spec.known) and a unit the child has not met yet starts with a show-me demo. */
export function openPlaySpec(game: GameId, l: Learner, known: Known, rng: Rng, spine: string[]): ActivitySpec {
  const direct = freePlaySpec(game, l, known, rng);
  if (direct) return direct;
  const ext = new Set(known);
  const extra: string[] = [];
  for (const u of spine) {
    if (ext.has(u)) continue;
    ext.add(u);
    extra.push(u);
    const s = freePlaySpec(game, l, ext, rng);
    if (s) return { ...s, known: extra, mode: isUnit(s.skill) && !known.has(s.skill) && !l.skills[s.skill] ? 'demo' : s.mode };
  }
  return { game, skill: GAME[game].skills[0].replace('*', 'mem'), mode: 'independent', n: GAME[game].items, known: extra };
}

export const playedStoryToday = (l: Learner, now: number): boolean =>
  l.recent.some((a) => (a.game === 'storyTime' || a.game === 'storyDetective') && dayKey(a.t) === dayKey(now));
