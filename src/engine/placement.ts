/* Playful starting check (SPEC §7.1): adaptive blocks, no pass/fail, ≤ ~24 items. Pure state machine. */
import { LETTERS } from './hebrew.ts';
import { generate, type GenCtx, type Item } from './generators.ts';
import { introduce, record, type Learner } from './learner.ts';

type Block = 'sounds' | 'letters' | 'letters2' | 'words' | 'done';
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
  st.queue = generate({ game: 'syllableHop', skill: 'PA.count', mode: 'placement', n: 2 }, ctx);
  return st;
}

/** Probe ctx with a learner that "knows" every letter, so distractors can be drawn from the whole alphabet. */
function probeCtx(ctx: GenCtx, units: string[]): GenCtx {
  return { ...ctx, known: new Set([...ctx.known, ...units]) };
}

/** Letter probes without sound (v1.3): a picture word with its first letter missing (הָאוֹת הַחֲסֵרָה, easiest level). */
function letterItems(ids: string[], ctx: GenCtx): Item[] {
  const all = LETTERS.filter((l) => !l.final).map((l) => 'L.' + l.id);
  return ids.map((id) => generate({ game: 'missingLetter', skill: 'L.' + id, mode: 'placement', n: 1, target: id }, probeCtx(ctx, all))[0]).filter(Boolean);
}

/** Reading probe: build three picture words from their syllables, with every vowel lent (so only letters gate the words). */
function wordItems(st: PlacementState, ctx: GenCtx): Item[] {
  const units = st.okLetters.map((l) => 'L.' + l).concat(VOWEL_UNITS);
  const probe = probeCtx({ ...ctx, known: new Set() }, units);
  return generate({ game: 'wordBakery', skill: 'W2', mode: 'placement', n: 3 }, probe);
}

const VOWEL_UNITS = ['V.a', 'V.i', 'V.e', 'V.o', 'V.u'];

function nextBlock(st: PlacementState, ctx: GenCtx, learner: Learner): void {
  const ratio = st.blockN ? st.blockOk / st.blockN : 0;
  const from = st.block;
  st.blockOk = 0;
  st.blockN = 0;
  st.missStreak = 0;
  st.queue = [];
  const toWords = () => {
    st.block = st.okLetters.length >= 4 ? 'words' : 'done';
    if (st.block === 'words') st.queue = wordItems(st, ctx);
  };
  if (from === 'sounds') {
    st.block = 'letters';
    st.queue = letterItems(LETTERS_A, ctx);
  } else if (from === 'letters') {
    if (ratio >= 5 / 6) { st.block = 'letters2'; st.queue = letterItems(LETTERS_B, ctx); } else toWords();
  } else if (from === 'letters2') {
    toWords();
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
    record(learner, { t: now, skill: item.skill, game: item.game, item: item.id, ok, help: 0, ms: 0 });
  }
  // words block: two of three words built = the child reads pointed words, so the vowels count as learned
  if (st.block === 'words' && !st.queue.length && st.blockOk >= 2) {
    for (const v of VOWEL_UNITS) introduce(learner, v, now, 'placement');
    introduce(learner, 'W2', now, 'placement');
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
  introduce(learner, 'PA.count', now, 'placement');
  learner.placementDone = true;
}
