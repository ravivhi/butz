/* Playful starting check (SPEC §7.1): adaptive blocks, no pass/fail, ≤ ~24 items. Pure state machine. */
import { LETTERS } from './hebrew.ts';
import { generate, type GenCtx, type Item } from './generators.ts';
import { introduce, record, type Learner } from './learner.ts';
import { decodableWords, knownUnits } from './gating.ts';

type Block = 'sounds' | 'letters' | 'letters2' | 'nikud' | 'words' | 'done';
export interface PlacementState {
  block: Block;
  queue: Item[];
  blockOk: number;
  blockN: number;
  missStreak: number;
  okLetters: string[];
  okVowels: string[];
  total: number;
}

const LETTERS_A = ['mem', 'lamed', 'resh', 'shin', 'dalet', 'bet'];
const LETTERS_B = ['nun', 'tav', 'gimel', 'yod', 'qof', 'pe'];
/** When the child knows ≥ 11 of the 12 probed letters, the remaining base letters are marked introduced too. */
const EXTRAPOLATE = ['samekh', 'he', 'het', 'kaf', 'alef', 'ayin', 'tsadi', 'zayin', 'tet', 'vav', 'vet', 'khaf', 'fe', 'sin'];

export function startPlacement(ctx: GenCtx): PlacementState {
  const st: PlacementState = { block: 'sounds', queue: [], blockOk: 0, blockN: 0, missStreak: 0, okLetters: [], okVowels: [], total: 0 };
  st.queue = [
    ...generate({ game: 'robotMixer', skill: 'PA.blend', mode: 'placement', n: 1 }, ctx),
    ...generate({ game: 'soundSafari', skill: 'PA.first', mode: 'placement', n: 1 }, ctx),
  ];
  return st;
}

/** Probe ctx with a learner that "knows" every letter, so distractors can be drawn from the whole alphabet. */
function probeCtx(ctx: GenCtx, units: string[]): GenCtx {
  return { ...ctx, known: new Set([...ctx.known, ...units]) };
}

function letterItems(ids: string[], ctx: GenCtx): Item[] {
  const all = LETTERS.filter((l) => !l.final).map((l) => 'L.' + l.id);
  return ids.map((id) => generate({ game: 'soundLighthouse', skill: 'L.' + id, mode: 'placement', n: 1, target: id }, probeCtx(ctx, all))[0]);
}

function nikudItems(st: PlacementState, ctx: GenCtx): Item[] {
  const letters = st.okLetters.filter((l) => l !== 'vav');
  const units = letters.map((l) => 'L.' + l).concat(['V.a', 'V.i', 'V.e', 'V.o', 'V.u']);
  const probe = probeCtx({ ...ctx, known: new Set() }, units);
  return (['a', 'i', 'e', 'o', 'u'] as const)
    .map((v) => generate({ game: 'syllableDJ', skill: 'V.' + v, mode: 'placement', n: 1, target: ctx.rng.pick(letters) }, probe)[0])
    .filter(Boolean);
}

function nextBlock(st: PlacementState, ctx: GenCtx, learner: Learner): void {
  const ratio = st.blockN ? st.blockOk / st.blockN : 0;
  const from = st.block;
  st.blockOk = 0;
  st.blockN = 0;
  st.missStreak = 0;
  st.queue = [];
  const toNikud = () => {
    st.block = st.okLetters.length >= 3 ? 'nikud' : 'done';
    if (st.block === 'nikud') st.queue = nikudItems(st, ctx);
  };
  if (from === 'sounds') {
    st.block = 'letters';
    st.queue = letterItems(LETTERS_A, ctx);
  } else if (from === 'letters') {
    if (ratio >= 5 / 6) { st.block = 'letters2'; st.queue = letterItems(LETTERS_B, ctx); } else toNikud();
  } else if (from === 'letters2') {
    toNikud();
  } else if (from === 'nikud') {
    const known = knownUnits(learner);
    const ws = decodableWords(known).filter((w) => !w.units.includes('X.quiet'));
    if (ratio >= 0.6 && ws.length >= 4) {
      st.block = 'words';
      st.queue = generate({ game: 'wordExplorer', skill: 'W2', mode: 'placement', n: 3 }, { ...ctx, known });
    } else st.block = 'done';
  } else st.block = 'done';
  if (!st.queue.length && st.block !== 'done') nextBlock(st, ctx, learner);
}

export const currentItem = (st: PlacementState): Item | undefined => st.queue[0];

/** Record one placement answer and advance. Mutates the learner (introductions + attempts) and the state. */
export function answerPlacement(st: PlacementState, learner: Learner, ctx: GenCtx, ok: boolean, now: number): void {
  const item = st.queue.shift();
  if (!item) return;
  st.total++;
  st.blockN++;
  if (ok) { st.blockOk++; st.missStreak = 0; } else st.missStreak++;
  if (ok) {
    if (item.skill.startsWith('L.')) { st.okLetters.push(item.skill.slice(2)); introduce(learner, item.skill, now, 'placement'); }
    if (item.game === 'syllableDJ') { const v = item.skill; st.okVowels.push(v); introduce(learner, v, now, 'placement'); introduce(learner, 'CV', now, 'placement'); }
    if (item.game === 'wordExplorer' && item.word) introduce(learner, item.word.level, now, 'placement');
    record(learner, { t: now, skill: item.skill, game: item.game, item: item.id, ok, help: 0, ms: 0 });
  }
  if (st.block === 'letters2' && !st.queue.length && st.okLetters.length >= 11) {
    for (const id of EXTRAPOLATE) introduce(learner, 'L.' + id, now, 'placement');
  }
  if (!st.queue.length || st.missStreak >= 3) {
    if (st.missStreak >= 3 && st.block !== 'sounds') { st.block = 'done'; st.queue = []; }
    else nextBlock(st, ctx, learner);
  }
  if (st.block === 'done') finishPlacement(learner, now);
}

export function finishPlacement(learner: Learner, now: number): void {
  for (const s of ['PA.first', 'PA.count', 'PA.blend']) introduce(learner, s, now, 'placement');
  learner.placementDone = true;
}
