/* Item generators (SPEC §8.3): one pure function per game, (spec, ctx) → items. Enforces R-H1/R-H2/R-H4.
   v1.3: every game has hidden levels (learner.levels, see adjustLevel; five, eight for the stories and the Word Bakery).
   The level sets word length, the number of
   choices, look-alike distractors, story length and so on; the child never sees it. Content is large enough that a
   child who plays a game 100+ times keeps meeting new items (words.ts + words2.ts, storygen.ts + storyfamily.ts). */
import { LETTER, LETTERS, SIGN, VOWEL, clusters, consonantIndices, cvSay, cvText, letterIdOf, nfc, vowelOfMark, type LetterInfo, type VowelId, SIMILAR, MARK } from './hebrew.ts';
import { GAME, type GameId } from './curriculum.ts';
import { LONG_WORDS, WORDS, type Word } from './content/words.ts';
import { STORIES, STORY, type Story, type StoryQuestion } from './content/texts.ts';
import { playable, storySentences } from './content/stories.ts';
import { SCHEMAS, makeStory } from './content/storygen.ts';
import { knownLetters, readStoriesFor, decodableWords, type Known } from './gating.ts';
import { accuracy, gameLevel, type Learner, type Level } from './learner.ts';
import type { Rng } from './rng.ts';
import { pathLength, samplePath, strokesOf, type Pt } from './strokes.ts';
import { CURSIVE } from './strokes_cursive.ts';

export type Mode = 'demo' | 'guided' | 'independent' | 'review' | 'placement';
/** `known`: extra units opened for free play from the map (v1.1: every game is open), on top of the child's units.
    `letters`: the letters the child chose in the letter picker (v1.3). `level`: a fixed difficulty (otherwise the
    child's hidden level for the game). */
export interface ActivitySpec { game: GameId; skill: string; mode: Mode; n?: number; target?: string; known?: string[]; letters?: string[]; pick?: boolean; level?: Level }

export interface Option { id: string; text?: string; emoji?: string; say?: string; label?: string; font?: 'read' | 'serif' | 'ui' | 'cursive'; color?: string }
/** One empty box of The Missing Letter: its cluster index in show.clusters, the letter choices and the right one. */
export interface Gap { at: number; options: Option[]; answer: string }
export type Guide = 'full' | 'dots' | 'ghost';
export interface Item {
  id: string;            // content key, also the audio-check key
  skill: string;         // skill credited (R-S2)
  game: GameId;
  level?: Level;         // hidden difficulty the item was made at
  say?: string[];        // spoken stimulus (replayable)
  show?: { text?: string; emoji?: string; parts?: string[]; letter?: string; before?: string; after?: string; clusters?: string[]; script?: 'print' | 'cursive' };
  options: Option[];
  answer?: string;       // option id
  accept?: string[];     // any of these option ids is correct
  sequence?: string[];   // ordered option ids (build / sequence)
  targets?: string[];    // balloons: every target must be popped
  count?: number;        // syllableHop: syllables
  gaps?: Gap[];          // missingLetter: the boxes, filled in order
  nameOptions?: boolean; // Butz names each picture option after the prompt (oral tasks only)
  reading?: boolean;     // R-H4: the written stimulus is never spoken before the answer
  supported?: boolean;   // practice with support (logged as help 1)
  reveal?: string[];     // spoken after a correct answer
  hint?: string[];       // spoken at help level 1
  demo?: { lines: string[]; big?: string; emoji?: string };
  story?: Story;
  questions?: Item[];
  puzzle?: Item;
  word?: Word;
  /** letterTrace: stroke paths (300×300 board), checkpoints per stroke, how much guide is drawn, print or cursive,
      and the two guide lines (top, baseline). */
  trace?: { strokes: string[]; points: Pt[][]; guide: Guide; script: 'print' | 'cursive'; lines: [number, number] };
}

export interface GenCtx { learner: Learner; known: Known; rng: Rng; fewerChoices: boolean; audioBad: Set<string> }

/** The difficulty of an activity: fixed by the spec, easiest for placement and show-me, at most 2 while a new unit is
    practised with support, otherwise the child's hidden level for the game. */
export function levelOf(spec: ActivitySpec, ctx: GenCtx): Level {
  if (spec.level) return spec.level;
  if (spec.mode === 'placement' || spec.mode === 'demo') return 1;
  const l = gameLevel(ctx.learner, spec.game);
  return spec.mode === 'guided' ? (Math.min(l, 2) as Level) : l;
}
const byLevel = <T>(xs: readonly T[], L: Level): T => xs[L - 1];

/** Targets for n items: ≈60% the focus (80% when teaching it), the rest weighted towards weaker units. */
function mixTargets(pool: string[], focus: string | undefined, n: number, ctx: GenCtx, prefix: string, share = 0.6): string[] {
  if (!pool.length) return [];
  const out: string[] = [];
  const weight = (id: string) => 1.2 - (accuracy(ctx.learner.skills[prefix + id]) ?? 0.5);
  const others = pool.filter((p) => p !== focus);
  for (let i = 0; i < n; i++) {
    if (focus && (i === 0 || ctx.rng.chance(share) || !others.length)) { out.push(focus); continue; }
    const total = others.reduce((s, p) => s + weight(p), 0);
    let r = ctx.rng.next() * total;
    let chosen = others[others.length - 1];
    for (const p of others) { r -= weight(p); if (r <= 0) { chosen = p; break; } }
    out.push(chosen);
  }
  // avoid the same target twice in a row when there is a choice
  for (let i = 1; i < out.length; i++) if (out[i] === out[i - 1] && pool.length > 1) out[i] = ctx.rng.pick(pool.filter((p) => p !== out[i - 1]));
  return out;
}

const nonFinal = (ls: LetterInfo[]) => ls.filter((l) => !l.final);

/** Letters for a letter choice: distinct sound classes (R-H2), known first, unknown non-similar letters as filler.
    `hard`: look-alike known letters first. */
function letterOptions(t: LetterInfo, ctx: GenCtx, k: number, hard: boolean): LetterInfo[] {
  const usedSounds = new Set([t.sound]);
  const out: LetterInfo[] = [t];
  const similar = new Set(SIMILAR[t.base] ?? []);
  const known = ctx.rng.shuffle(nonFinal(knownLetters(ctx.known)).filter((l) => l.id !== t.id));
  const ordered = hard ? [...known.filter((l) => similar.has(l.base)), ...known.filter((l) => !similar.has(l.base))] : known;
  const unknown = ctx.rng.shuffle(nonFinal(LETTERS).filter((l) => !ctx.known.has('L.' + l.id) && (hard || !similar.has(l.base)) && l.base !== t.base));
  for (const l of [...ordered, ...unknown]) {
    if (out.length >= k) break;
    if (usedSounds.has(l.sound)) continue;
    usedSounds.add(l.sound);
    out.push(l);
  }
  return ctx.rng.shuffle(out);
}

/** A keyword picture word for a letter (prefer the /a/ vowel so "מָה, כְּמוֹ מָטוֹס" matches). */
export function keywordFor(letterId: string): Word | undefined {
  const ws = WORDS.filter((w) => w.firstLetter === letterId && !w.units.includes('X.genuva'));
  return ws.find((w) => w.vowels[0] === 'a') ?? ws[0];
}

export function letterDemo(l: LetterInfo): Item['demo'] {
  if (l.final) {
    const base = LETTER[l.final];
    const ex = WORDS.find((w) => w.lastLetter === l.id && !w.units.includes('X.genuva'));
    return { big: l.char, emoji: ex?.emoji, lines: [`זֹאת ${l.name}.`, `הִיא כְּמוֹ ${base.name}, אֲבָל הִיא בָּאָה רַק בְּסוֹף מִלָּה.`, ex ? `כְּמוֹ בַּמִּלָּה ${ex.text}.` : ''].filter(Boolean).map(nfc) };
  }
  const kw = keywordFor(l.id);
  return { big: l.char, emoji: kw?.emoji, lines: [`זֹאת הָאוֹת ${l.name}.`, `הִיא עוֹשָׂה ${l.say}.`, kw ? `${l.say}, כְּמוֹ ${kw.text}!` : ''].filter(Boolean).map(nfc) };
}

export function vowelDemo(v: VowelId, letter: LetterInfo): Item['demo'] {
  const info = VOWEL[v];
  const names = info.signs.map((s) => SIGN[s].name);
  const same = names.length > 1 ? `${names[0]} וְ${names[1]} עוֹשִׂים אוֹתוֹ צְלִיל: ${info.sayAlone}!` : `${names[0]} עוֹשֶׂה ${info.sayAlone}.`;
  return { big: cvText(letter.id, info.signs[0]), lines: [same, `${letter.name} עִם ${names[0]}: ${cvSay(letter.id, v)}.`].map(nfc) };
}

export const DEMO_FEATURE: Record<string, Item['demo']> = {
  'X.quiet': { big: 'פָּרָה', emoji: '🐄', lines: ['יֵשׁ אוֹתִיּוֹת שְׁקֵטוֹת!', 'בְּסוֹף הַמִּלָּה פָּרָה, הָאוֹת הֵא שׁוֹתֶקֶת.', 'קוֹרְאִים: פָּרָה.'].map(nfc) },
  'V.shva': { big: 'דְּבַשׁ', emoji: '🍯', lines: ['זֶה שְׁוָא: שְׁתֵּי נְקֻדּוֹת קְטַנּוֹת.', 'לִפְעָמִים הוּא שָׁקֵט, וְלִפְעָמִים אוֹמְרִים אוֹתוֹ מַהֵר מְאֹד.', 'קוֹרְאִים: דְּבַשׁ.'].map(nfc) },
};

/** Least recently shown first (never shown = first); ties in random order. Keeps content from repeating (R-H11). */
function byFreshness<T>(items: T[], key: (t: T) => string, ctx: GenCtx): T[] {
  const seen = ctx.learner.seen ?? {};
  return ctx.rng.shuffle(items).sort((a, b) => (seen[key(a)] ?? 0) - (seen[key(b)] ?? 0));
}
const wKey = (w: Word) => 'w:' + w.id;

/* ------------------------------------------------------------------ letters */

function letterPool(ctx: GenCtx, spec: ActivitySpec): string[] {
  const pool = nonFinal(knownLetters(ctx.known)).map((l) => l.id);
  const focus = spec.skill.startsWith('L.') ? spec.skill.slice(2) : undefined;
  if (focus && LETTER[focus] && !LETTER[focus].final && !pool.includes(focus)) pool.push(focus);
  return pool;
}
const focusOf = (spec: ActivitySpec): string | undefined => spec.target ?? (spec.skill.startsWith('L.') ? spec.skill.slice(2) : undefined);

/** The 27 letter shapes of the letter picker, as letter ids (בּ and ב, שׁ and שׂ are written the same way). */
export const PICK_LETTERS: string[] = LETTERS.filter((l, i, a) => a.findIndex((x) => x.base === l.base) === i).map((l) => l.id);

/** Letters that look alike in cursive (כְּתָב יָד), for the balloons' look-alike distractors. */
const CURSIVE_GROUPS = ['בכפרד', 'גזצ', 'החתק', 'וין', 'סםט', 'מנת', 'עשא', 'ךקר', 'ףץל'];
export const CURSIVE_SIMILAR: Record<string, string[]> = {};
for (const grp of CURSIVE_GROUPS) for (const c of grp) CURSIVE_SIMILAR[c] = [...new Set([...(CURSIVE_SIMILAR[c] ?? []), ...[...grp].filter((x) => x !== c)])];

const BALLOON_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00ACC1', '#F06292', '#6D4C41'];
/** Balloons per board, targets per board and the share of look-alike distractors, by level. */
const BALLOONS = { n: [6, 8, 9, 10, 12], targets: [2, 3, 3, 3, 4], look: [0, 0.25, 0.4, 0.6, 0.8] };

/** Balloon Pop (v1.3): the letter is shown in print; the balloons are in cursive. Pop every balloon of that letter.
    Every letter the child picked gets at least one board. */
function gBalloons(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const picked = spec.letters?.filter((id) => LETTER[id]) ?? [];
  const targets = picked.length
    ? Array.from({ length: Math.max(n, picked.length) }, (_, i) => picked[i % picked.length])
    : mixTargets(letterPool(ctx, spec), focusOf(spec), n, ctx, 'L.');
  const order = picked.length ? ctx.rng.shuffle(targets) : targets;
  return order.map((tid, i) => {
    const t = LETTER[tid];
    const size = ctx.fewerChoices ? 6 : byLevel(BALLOONS.n, L);
    const nT = Math.min(byLevel(BALLOONS.targets, L), size - 3);
    const look = CURSIVE_SIMILAR[t.base] ?? [];
    const nLook = look.length ? Math.round((size - nT) * byLevel(BALLOONS.look, L)) : 0;
    const lookPool = ctx.rng.shuffle(look);
    const others = ctx.rng.shuffle(PICK_LETTERS.map((id) => LETTER[id].base).filter((b) => b !== t.base && !look.includes(b)));
    const fillers = [...Array.from({ length: nLook }, (_, j) => lookPool[j % lookPool.length]), ...others.slice(0, size - nT - nLook)];
    const cells = ctx.rng.shuffle([...Array<string>(nT).fill(t.base), ...fillers]);
    const colors = ctx.rng.shuffle(BALLOON_COLORS);
    const options = cells.map((c, j) => ({ id: 'b' + j, text: c, font: 'cursive' as const, color: colors[j % colors.length] }));
    return {
      id: `pop:${tid}:${i}`, skill: 'L.' + tid, game: 'balloonPop', level: L, say: [nfc(`${t.name}.`)], show: { letter: t.base },
      options, targets: options.filter((o) => o.text === t.base).map((o) => o.id),
      demo: i === 0 && spec.mode === 'demo' ? letterDemo(t) : undefined,
    };
  });
}

/** Memory pairs per board by level; level 5 puts letters that look alike in cursive on the same board. */
const MEMORY_PAIRS = [3, 4, 5, 6, 6];
/** Picture words for a letter's memory card: a short word that starts with that letter. */
const memoryWords = (id: string): Word[] => WORDS.filter((w) => w.firstLetter === id && !w.units.includes('X.genuva') && w.syl.length <= 3);
const MEMORY_OK = new Set(nonFinal(LETTERS).map((l) => l.id).filter((id) => memoryWords(id).length > 0));

function gMemory(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const focus = focusOf(spec);
  const pool = letterPool(ctx, spec).filter((id) => MEMORY_OK.has(id));
  const filler = [...MEMORY_OK];
  const pairs = ctx.fewerChoices ? 3 : byLevel(MEMORY_PAIRS, L);
  return Array.from({ length: n }, (_, i) => {
    const chosen: string[] = [];
    const sounds = new Set<string>(), pics = new Set<string>(), shapes = new Set<string>();
    const words: Record<string, Word> = {};
    const lead = focus && MEMORY_OK.has(focus) && (i === 0 || ctx.rng.chance(0.6)) ? focus : ctx.rng.pick(pool.length ? pool : filler);
    const alike = L >= 5 ? ctx.rng.shuffle(filler.filter((id) => (CURSIVE_SIMILAR[LETTER[lead].base] ?? []).includes(LETTER[id].base))) : [];
    for (const id of [lead, ...alike, ...ctx.rng.shuffle(pool), ...ctx.rng.shuffle(filler)]) {
      if (chosen.length >= pairs) break;
      // one card per sound, picture and cursive shape (בּ/ב and שׁ/שׂ look the same): one match per picture (R-H2)
      if (chosen.includes(id) || sounds.has(LETTER[id].sound) || shapes.has(LETTER[id].base)) continue;
      const w = ctx.rng.shuffle(memoryWords(id)).find((x) => !pics.has(x.emoji));
      if (!w) continue;
      chosen.push(id);
      sounds.add(LETTER[id].sound);
      shapes.add(LETTER[id].base);
      pics.add(w.emoji);
      words[id] = w;
    }
    const cards: Option[] = chosen.flatMap((id) => [
      { id: 'L:' + id, text: LETTER[id].base, font: 'cursive' as const, say: LETTER[id].say },
      { id: 'P:' + id, emoji: words[id].emoji, say: words[id].say ?? words[id].text },
    ]);
    return {
      id: `mem:${lead}:${i}`, skill: 'L.' + lead, game: 'memoryMatch', level: L, options: ctx.rng.shuffle(cards), supported: true,
      say: chosen.map((id) => nfc(`${LETTER[id].say}, כְּמוֹ ${words[id].text}`)),
    };
  });
}

/** The Missing Letter by level: word length (syllables), empty boxes, letter choices per box. Level 1 hides the first
    letter only. */
const MISS = { syl: [[2, 2], [2, 3], [3, 3], [3, 4], [4, 6]] as [number, number][], gaps: [1, 1, 1, 2, 3], k: [3, 3, 4, 4, 4] };
const VOWEL_MARKS = /[\u05B0-\u05BB\u05C7]/;

/** Clusters that can be hidden: letters read as consonants (not a vowel letter or a quiet letter), not final forms. */
function gapSlots(w: Word): number[] {
  const cs = clusters(w.text);
  return consonantIndices(w.text).filter((i) => { const l = LETTER[letterIdOf(cs[i])]; return !!l && !l.final; });
}

/** k box positions, spread out (no two neighbours) when the word allows it; `must` is always one of them. */
function chooseGaps(slots: number[], k: number, must: number | undefined, rng: Rng): number[] {
  const combos: number[][] = [];
  const walk = (from: number, cur: number[]) => {
    if (cur.length === k) { combos.push([...cur]); return; }
    for (let i = from; i < slots.length; i++) walk(i + 1, [...cur, slots[i]]);
  };
  walk(0, []);
  const ok = combos.filter((c) => must === undefined || c.includes(must));
  const spread = ok.filter((c) => !c.some((x, j) => j > 0 && x - c[j - 1] === 1));
  return rng.pick(spread.length ? spread : ok) ?? slots.slice(0, k);
}

const MISSING_WORDS = WORDS.filter((w) => !w.units.includes('X.genuva') && clusters(w.text).length >= 2);
const FINALS = LETTERS.filter((l) => l.final);

/** The Missing Letter. A final letter (ם ן ץ ך ף) is practised with a box at the end of a word that ends with it; its
    choices are the other final letters. */
function gMissing(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const focus = focusOf(spec);
  const [lo, hi] = byLevel(MISS.syl, L);
  const nGaps = byLevel(MISS.gaps, L);
  const k = ctx.fewerChoices ? 2 : byLevel(MISS.k, L);
  const inRange = (w: Word) => w.syl.length >= lo && w.syl.length <= hi;
  const fits = (w: Word, id?: string): boolean => {
    const slots = gapSlots(w);
    if (id && LETTER[id].final) return w.lastLetter === id && slots.length >= nGaps - 1;
    if (L === 1 && slots[0] !== 0) return false;
    if (slots.length < nGaps) return false;
    if (!id) return true;
    const cs = clusters(w.text);
    return L === 1 ? w.firstLetter === id : slots.some((j) => letterIdOf(cs[j]) === id);
  };
  const used = new Set<string>();
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const want = focus && LETTER[focus] && (spec.mode === 'placement' || i === 0 || ctx.rng.chance(0.6)) ? focus : undefined;
    const fin = !!want && !!LETTER[want].final;
    let pool = MISSING_WORDS.filter((w) => !used.has(w.id) && inRange(w) && fits(w, want));
    if (!pool.length && want) pool = MISSING_WORDS.filter((w) => !used.has(w.id) && fits(w, want));
    if (!pool.length) pool = MISSING_WORDS.filter((w) => !used.has(w.id) && inRange(w) && fits(w));
    if (!pool.length) break;
    const w = byFreshness(pool, wKey, ctx)[0];
    used.add(w.id);
    const cs = clusters(w.text);
    const last = cs.length - 1;
    let at: number[];
    if (fin && w.lastLetter === want) {
      at = [...chooseGaps(gapSlots(w).filter((j) => j < last), nGaps - 1, undefined, ctx.rng), last];
    } else {
      const slots = L === 1 ? [0] : gapSlots(w);
      const must = want ? slots.find((j) => letterIdOf(cs[j]) === want) : undefined;
      at = chooseGaps(slots, nGaps, must, ctx.rng);
    }
    const gaps: Gap[] = at.map((j) => {
      const id = letterIdOf(cs[j]);
      if (LETTER[id].final) {
        const opts = [LETTER[id], ...ctx.rng.shuffle(FINALS.filter((l) => l.id !== id)).slice(0, k - 1)];
        return { at: j, options: ctx.rng.shuffle(opts).map((l) => ({ id: l.id, text: l.char, font: 'read' as const })), answer: id };
      }
      // the vowel points of the hidden cluster go on every choice, so only the letter differs
      const marks = [...cs[j].raw].filter((ch) => VOWEL_MARKS.test(ch)).join('');
      const opts = letterOptions(LETTER[id], ctx, k, L >= 3);
      return { at: j, options: opts.map((l) => ({ id: l.id, text: nfc(l.char + marks), font: 'read' as const })), answer: id };
    });
    items.push({
      id: `miss:${w.id}:${at.join('.')}`, skill: 'L.' + (want ?? gaps[0].answer), game: 'missingLetter', level: L, word: w, say: [w.say ?? w.text],
      show: { clusters: cs.map((c) => c.raw), emoji: w.emoji }, gaps, options: gaps[0].options, answer: gaps[0].answer,
      reveal: [w.say ?? w.text], hint: [w.say ?? w.text],
      demo: i === 0 && spec.mode === 'demo' && want ? letterDemo(LETTER[want]) : undefined,
    });
  }
  return items;
}

/* ------------------------------------------------------------------ writing */

const TRACE_START = ['mem', 'lamed', 'dalet', 'gimel', 'yod', 'resh', 'qof', 'he'];
/** How much of the letter is drawn for the child, by level: [print, cursive]. */
const GUIDES: [Guide, Guide][] = [['full', 'full'], ['full', 'dots'], ['dots', 'dots'], ['dots', 'ghost'], ['ghost', 'ghost']];

function traceItem(id: string, script: 'print' | 'cursive', guide: Guide, L: Level): Item | null {
  const l = LETTER[id];
  const cur = CURSIVE[l.base];
  const strokes = script === 'print' ? strokesOf(id) : cur?.strokes ?? [];
  if (!strokes.length) return null;
  const lines: [number, number] = script === 'print' ? [43, 257] : [cur.mid, cur.base];
  return {
    id: `tr:${script}:${l.base}`, skill: 'WRITE', game: 'letterTrace', level: L, say: [nfc(`${l.name}.`)], show: { letter: l.base, script }, options: [],
    trace: { strokes, points: strokes.map((d) => samplePath(d, Math.max(8, Math.round(pathLength(d) / 14)))), guide, script, lines },
    reveal: [nfc(`${l.name}.`)],
  };
}

/** Writing (v1.3): each letter is written in print (דְּפוּס) and then in cursive (כְּתָב). The child may choose the letters. */
function gTrace(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const [gp, gc] = byLevel(GUIDES, L);
  let letters = spec.letters?.filter((id) => LETTER[id]) ?? [];
  if (!letters.length) {
    const focus = focusOf(spec);
    const want = Math.max(1, Math.ceil(n / 2));
    const pool = knownLetters(ctx.known).map((l) => l.id);
    for (const id of TRACE_START) if (pool.length < want + 2 && !pool.includes(id)) pool.push(id);
    // one shape per letter (בּ and ב are written the same way), least recently written first
    const shapes = pool.filter((id, j, a) => strokesOf(id).length && a.findIndex((x) => LETTER[x].base === LETTER[id].base) === j);
    const order = byFreshness(shapes, (id) => 'tr:' + LETTER[id].base, ctx);
    const fi = focus && LETTER[focus] ? order.findIndex((id) => LETTER[id].base === LETTER[focus].base) : -1;
    if (fi > 0) order.unshift(...order.splice(fi, 1));
    letters = order.slice(0, want);
  }
  return letters.flatMap((id) => [traceItem(id, 'print', gp, L), traceItem(id, 'cursive', gc, L)]).filter((x): x is Item => !!x);
}

/* ------------------------------------------------------------------ words */

/** The Word Bakery by level (8 hidden levels): word length (parts), extra parts, and how many extras share a first letter
    with the word's parts (near misses that must be read, not guessed). Levels 7-8 use names of two or three words. */
const BAKE = {
  syl: [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 7]] as [number, number][],
  extra: [1, 2, 2, 3, 3, 4, 4, 5], near: [0, 0, 1, 1, 2, 2, 3, 3],
};
const ALL_SYL = [...new Set(WORDS.flatMap((w) => w.syl))];
const SYL_BASE = new Map(ALL_SYL.map((s) => [s, clusters(s)[0]?.base ?? '']));

function unitDemo(unit: string | undefined, w: Word): Item['demo'] {
  if (!unit) return undefined;
  if (DEMO_FEATURE[unit]) return DEMO_FEATURE[unit];
  const v = unit.slice(2) as VowelId;
  if (!VOWEL[v]) return undefined;
  const l = LETTER[w.firstLetter];
  return vowelDemo(v, l && !l.final && l.id !== 'vav' ? l : LETTER.mem);
}

function gBakery(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const unit = /^(V|X)\./.test(spec.skill) ? spec.skill : undefined;
  const skill = unit ?? (spec.skill === 'W3' ? 'W3' : 'W2');
  const [lo, hi] = byLevel(BAKE.syl, L);
  const all = [...WORDS.filter((w) => w.syl.length >= 2), ...LONG_WORDS];
  const byUnit = (w: Word) => !unit || w.units.includes(unit);
  const inRange = (w: Word) => w.syl.length >= lo && w.syl.length <= hi;
  let pool = all.filter((w) => byUnit(w) && inRange(w));
  // placement and the easiest level keep to words the child can decode (when there are enough of them)
  if (L === 1 || spec.mode === 'placement') {
    const dec = new Set(decodableWords(ctx.known).map((w) => w.id));
    const mine = pool.filter((w) => dec.has(w.id));
    if (mine.length >= (spec.mode === 'placement' ? 1 : 6)) pool = mine;
  }
  // the level's word length wins: too few words with the unit are topped up with other words of that length
  let ws = byFreshness(pool, wKey, ctx).slice(0, n);
  if (ws.length < n) ws = [...ws, ...byFreshness(all.filter((w) => inRange(w) && !ws.includes(w)), wKey, ctx).slice(0, n - ws.length)];
  const nExtra = ctx.fewerChoices ? 1 : byLevel(BAKE.extra, L);
  const nNear = Math.min(nExtra, byLevel(BAKE.near, L));
  return ws.map((w, i) => {
    const bases = new Set(w.syl.map((s) => SYL_BASE.get(s)));
    const near = ctx.rng.shuffle(ALL_SYL.filter((s) => !w.syl.includes(s) && bases.has(SYL_BASE.get(s)))).slice(0, nNear);
    const rest = ctx.rng.shuffle(ALL_SYL.filter((s) => !w.syl.includes(s) && !near.includes(s))).slice(0, nExtra - near.length);
    const blocks = ctx.rng.shuffle([
      ...w.syl.map((s, j) => ({ id: 'b' + j, text: s, font: 'read' as const })),
      ...[...near, ...rest].map((s, j) => ({ id: 'x' + j, text: s, font: 'read' as const })),
    ]);
    return {
      id: 'w:' + w.id, skill: byUnit(w) ? skill : w.syl.length >= 3 ? 'W3' : 'W2', game: 'wordBakery', level: L, word: w, say: [w.say ?? w.text], show: { emoji: w.emoji },
      options: blocks, sequence: w.syl.map((_, j) => 'b' + j), reveal: [w.say ?? w.text],
      demo: i === 0 && spec.mode === 'demo' ? unitDemo(unit, w) : undefined,
    };
  });
}

/* ------------------------------------------------------------------ sounds (oral) */

/** Speakable form of a syllable: open syllables get a quiet letter so TTS says them cleanly (§3.3); a bare צירוף
    uses the TTS-safe form (cvSay: זָא not זָה, which voices read as the word "ze"). */
export function speakSyllable(s: string): string {
  const cs = clusters(s);
  const last = cs[cs.length - 1];
  if (!last || last.vowel === null || last.vowel === 'sheva') return s;
  const v = vowelOfMark(last.vowel);
  const id = cs.length === 1 ? letterIdOf(last) : '';
  if (v && LETTER[id] && !LETTER[id].final) return cvSay(id, v);
  if (last.vowel === 'qamats' || last.vowel === 'patah' || last.vowel === 'tsere' || last.vowel === 'segol') return nfc(s + 'ה');
  if (last.vowel === 'hiriq') return nfc(s + 'י');
  if (last.vowel === 'holam') return nfc(s.replace(MARK.holam, '') + 'ו' + MARK.holam);
  if (last.vowel === 'qubuts') return nfc(s.replace(MARK.qubuts, '') + 'ו' + MARK.dagesh);
  return s;
}

/** Syllable Hop by level: word lengths (a length listed twice comes twice as often). Level 1 is one or two syllables,
    level 5 mostly five. The pond holds up to 6 stones. */
const HOP_LENS = [[1, 1, 2], [2, 2, 3], [3, 3, 4], [4, 4, 5], [5, 5, 5, 6]];
const HOP_POOL = [...WORDS.filter((w) => !w.units.includes('X.genuva')), ...LONG_WORDS.filter((w) => w.syl.length <= 6)];

function gHop(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const L = levelOf(spec, ctx);
  const lens = byLevel(HOP_LENS, L).filter((k) => HOP_POOL.some((w) => w.syl.length === k));
  const byLen = new Map([...new Set(lens)].map((k) => [k, byFreshness(HOP_POOL.filter((w) => w.syl.length === k), wKey, ctx)]));
  return Array.from({ length: n }, () => {
    const list = byLen.get(ctx.rng.pick(lens))!;
    const w = list.shift()!;
    list.push(w);
    return {
      id: 'hop:' + w.id, skill: 'PA.count', game: 'syllableHop', level: L, word: w, say: [w.say ?? w.text], show: { emoji: w.emoji },
      options: [], count: w.syl.length, hint: w.syl.map(speakSyllable), reveal: w.syl.map(speakSyllable),
    };
  });
}

/* ------------------------------------------------------------------ stories */

function questionItem(story: Story, q: StoryQuestion, qi: number, skill: string, game: GameId): Item {
  return {
    id: `q:${story.id}:${qi}`, skill, game, story, say: [q.q],
    options: q.options.map((o, j) => ({ id: String(j), emoji: o.emoji, say: o.label, label: o.label })), answer: String(q.answer),
    reveal: [q.options[q.answer].label],
  };
}

/** Story Puzzle cards: sentences of the story, put back in the order they happened. */
export function puzzleItem(story: Story, game: GameId): Item {
  const ss = storySentences(story);
  const cards = story.order.map((i) => ({ id: 'p' + i, text: ss[i], say: ss[i] }));
  return { id: 'seq:' + story.id, skill: 'COMP.seq', game, story, options: cards, sequence: story.order.map((i) => 'p' + i) };
}

/** Questions per story by level (the Story Puzzle has none: it puts the story's events in order), and puzzle cards. */
const STORY_Q: Record<'storyDetective' | 'storyPuzzle', number[]> = {
  storyDetective: [2, 3, 3, 4, 4, 5, 5, 6], storyPuzzle: [0, 0, 0, 0, 0, 0, 0, 0],
};
const STORY_CARDS = [3, 4, 4, 5, 5, 6, 6, 7];

/** A hand-written story with some of its questions (in story order). */
function handWritten(s: Story, nQ: number, rng: Rng): Story {
  const keep = new Set(rng.shuffle(s.questions).slice(0, nQ));
  return { ...s, questions: s.questions.filter((q) => keep.has(q)) };
}

function chooseStory(spec: ActivitySpec, ctx: GenCtx, game: 'storyDetective' | 'storyPuzzle', L: Level): Story | undefined {
  const nQ = byLevel(STORY_Q[game], L);
  if (spec.target && STORY[spec.target]) return handWritten(STORY[spec.target], nQ || 0, ctx.rng);
  // a hand-written story of this level (least recently read first): a third of the stories at level 1, half above
  const atLevel = STORIES.filter((s) => s.level === L);
  if (atLevel.length && ctx.rng.chance(L === 1 ? 0.35 : 0.5)) {
    const readable = game === 'storyDetective' && L === 1 ? readStoriesFor(ctx.known).filter((s) => s.level === 1) : atLevel;
    return handWritten(byFreshness(readable.length ? readable : atLevel, (x) => 'st:' + x.id, ctx)[0], nQ, ctx.rng);
  }
  // a different story plan every time (least recently used first), a new random story of that plan
  const schema = byFreshness([...SCHEMAS], (x) => 'sch:' + x, ctx)[0];
  const g = makeStory(schema, L, 1 + ctx.rng.int(1_000_000));
  const nOpt = ctx.fewerChoices ? 2 : L <= 2 ? 3 : 4;
  return playable(g, game === 'storyDetective' ? 'detail' : 'literal', nQ, nOpt, byLevel(STORY_CARDS, L), ctx.rng);
}

/** Story games (v1.3): the child reads the whole story on one page (text only), then answers questions (with a way back
    to the story) or does the Story Puzzle. */
function gStory(spec: ActivitySpec, ctx: GenCtx, game: 'storyDetective' | 'storyPuzzle'): Item[] {
  const L = levelOf(spec, ctx);
  const story = chooseStory(spec, ctx, game, L);
  if (!story) return [];
  const skill = game === 'storyDetective' ? 'COMP.read' : 'COMP.seq';
  const questions = story.questions.map((q, i) => questionItem(story, q, i, skill, game));
  const puzzle = game === 'storyPuzzle' && story.order.length >= 2 ? puzzleItem(story, game) : undefined;
  return [{ id: 'story:' + story.id, skill, game, level: L, story, options: [], questions, puzzle, reading: true }];
}

/* ------------------------------------------------------------------ dispatch */

export function generate(spec: ActivitySpec, ctx: GenCtx): Item[] {
  const n = spec.n ?? GAME[spec.game].items;
  switch (spec.game) {
    case 'syllableHop': return gHop(spec, ctx, n);
    case 'balloonPop': return gBalloons(spec, ctx, n);
    case 'memoryMatch': return gMemory(spec, ctx, n);
    case 'missingLetter': return gMissing(spec, ctx, n);
    case 'letterTrace': return gTrace(spec, ctx, n);
    case 'wordBakery': return gBakery(spec, ctx, n);
    case 'storyDetective': return gStory(spec, ctx, 'storyDetective');
    case 'storyPuzzle': return gStory(spec, ctx, 'storyPuzzle');
  }
}
