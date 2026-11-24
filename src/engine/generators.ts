/* Item generators (SPEC §8.3): one pure function per game, (spec, ctx) → items. Enforces R-H1/R-H2/R-H4. */
import { LETTER, LETTERS, SIGN, SIGNS, VOWEL, clusters, cvSay, cvText, nfc, type LetterInfo, type VowelId, SIMILAR, MARK } from './hebrew.ts';
import { GAME, type GameId } from './curriculum.ts';
import { WORDS, type Word } from './content/words.ts';
import { SENTENCES, type Sentence, type Story, type StoryQuestion } from './content/texts.ts';
import { knownLetters, knownVowels, listenStories, readStoriesFor, sentencesFor, sightFor, wordsFor, decodableWords, type Known } from './gating.ts';
import { accuracy, type Learner } from './learner.ts';
import type { Rng } from './rng.ts';

export type Mode = 'demo' | 'guided' | 'independent' | 'review' | 'placement';
export interface ActivitySpec { game: GameId; skill: string; mode: Mode; n?: number; target?: string }

export interface Option { id: string; text?: string; emoji?: string; say?: string; label?: string; font?: 'read' | 'serif' | 'ui'; color?: string }
export interface Item {
  id: string;            // content key, also the audio-check key
  skill: string;         // skill credited (R-S2)
  game: GameId;
  say?: string[];        // spoken stimulus (replayable)
  show?: { text?: string; emoji?: string; parts?: string[]; letter?: string; before?: string; after?: string };
  options: Option[];
  answer?: string;       // option id
  accept?: string[];     // any of these option ids is correct
  sequence?: string[];   // ordered option ids (build / sequence)
  targets?: string[];    // findTap: every target must be tapped
  count?: number;        // syllableHop: syllables
  nameOptions?: boolean; // Ori names each picture option after the prompt (oral tasks only)
  reading?: boolean;     // R-H4: the written stimulus is never spoken before the answer
  supported?: boolean;   // practice with support (logged as help 1)
  reveal?: string[];     // spoken after a correct answer
  hint?: string[];       // spoken at help level 1
  demo?: { lines: string[]; big?: string; emoji?: string };
  story?: Story;
  questions?: Item[];
  puzzle?: Item;
  sentence?: Sentence;
  word?: Word;
}

export interface GenCtx { learner: Learner; known: Known; rng: Rng; fewerChoices: boolean; audioBad: Set<string> }

const DOT = '\u25CC';
export const signLabel = (signId: string): string => nfc(DOT + SIGN[signId].mark);

/** Number of options for a skill (SPEC §7.5). */
export function optionCount(ctx: GenCtx, skill: string): number {
  if (ctx.fewerChoices) return 2;
  const acc = accuracy(ctx.learner.skills[skill]);
  return acc !== null && acc >= 0.8 ? 4 : 3;
}

/** Targets for n items: ≈60% the focus, the rest weighted towards weaker units. */
function mixTargets(pool: string[], focus: string | undefined, n: number, ctx: GenCtx, prefix: string): string[] {
  if (!pool.length) return [];
  const out: string[] = [];
  const weight = (id: string) => 1.2 - (accuracy(ctx.learner.skills[prefix + id]) ?? 0.5);
  const others = pool.filter((p) => p !== focus);
  for (let i = 0; i < n; i++) {
    if (focus && (i === 0 || ctx.rng.chance(0.6) || !others.length)) { out.push(focus); continue; }
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
const letterById = (id: string) => LETTER[id];

/** Letters for a sound-choice task: distinct sound classes (R-H2), known first, unknown non-similar letters as filler. */
function letterOptions(t: LetterInfo, ctx: GenCtx, k: number, hard: boolean): LetterInfo[] {
  const usedSounds = new Set([t.sound]);
  const out: LetterInfo[] = [t];
  const similar = new Set(SIMILAR[t.base] ?? []);
  const known = ctx.rng.shuffle(nonFinal(knownLetters(ctx.known)).filter((l) => l.id !== t.id));
  const ordered = hard ? [...known.filter((l) => similar.has(l.base)), ...known.filter((l) => !similar.has(l.base))] : known;
  const unknown = ctx.rng.shuffle(nonFinal(LETTERS).filter((l) => !ctx.known.has('L.' + l.id) && !similar.has(l.base) && l.base !== t.base));
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

function letterDemo(l: LetterInfo): Item['demo'] {
  if (l.final) {
    const base = LETTER[l.final];
    const ex = WORDS.find((w) => w.lastLetter === l.id && !w.units.includes('X.genuva'));
    return { big: l.char, emoji: ex?.emoji, lines: [`זֹאת ${l.name}.`, `הִיא כְּמוֹ ${base.name}, אֲבָל הִיא בָּאָה רַק בְּסוֹף מִלָּה.`, ex ? `כְּמוֹ בַּמִּלָּה ${ex.text}.` : ''].filter(Boolean).map(nfc) };
  }
  const kw = keywordFor(l.id);
  return { big: l.char, emoji: kw?.emoji, lines: [`זֹאת הָאוֹת ${l.name}.`, `הִיא עוֹשָׂה ${l.say}.`, kw ? `${l.say}, כְּמוֹ ${kw.text}!` : ''].filter(Boolean).map(nfc) };
}

function vowelDemo(v: VowelId, letter: LetterInfo): Item['demo'] {
  const info = VOWEL[v];
  const names = info.signs.map((s) => SIGN[s].name);
  const same = names.length > 1 ? `${names[0]} וְ${names[1]} עוֹשִׂים אוֹתוֹ צְלִיל: ${info.sayAlone}!` : `${names[0]} עוֹשֶׂה ${info.sayAlone}.`;
  return { big: cvText(letter.id, info.signs[0]), lines: [same, `${letter.name} עִם ${names[0]}: ${cvSay(letter.id, v)}.`].map(nfc) };
}

const DEMO_FEATURE: Record<string, Item['demo']> = {
  'X.quiet': { big: 'פָּרָה', emoji: '🐄', lines: ['יֵשׁ אוֹתִיּוֹת שְׁקֵטוֹת!', 'בְּסוֹף הַמִּלָּה פָּרָה, הָאוֹת הֵא שׁוֹתֶקֶת.', 'קוֹרְאִים: פָּרָה.'].map(nfc) },
  'V.shva': { big: 'דְּבַשׁ', emoji: '🍯', lines: ['זֶה שְׁוָא: שְׁתֵּי נְקֻדּוֹת קְטַנּוֹת.', 'לִפְעָמִים הוּא שָׁקֵט, וְלִפְעָמִים אוֹמְרִים אוֹתוֹ מַהֵר מְאֹד.', 'קוֹרְאִים: דְּבַשׁ.'].map(nfc) },
};

/* ------------------------------------------------------------------ letters */

function letterPool(ctx: GenCtx, spec: ActivitySpec): string[] {
  const pool = nonFinal(knownLetters(ctx.known)).map((l) => l.id);
  const focus = spec.skill.startsWith('L.') ? spec.skill.slice(2) : undefined;
  if (focus && LETTER[focus] && !LETTER[focus].final && !pool.includes(focus)) pool.push(focus);
  return pool;
}

function gLighthouse(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const focus = spec.target ?? (spec.skill.startsWith('L.') ? spec.skill.slice(2) : undefined);
  const pool = letterPool(ctx, spec).filter((id) => !ctx.audioBad.has('snd:' + id) || id === focus);
  const targets = spec.mode === 'review' && focus ? Array(n).fill(focus) : mixTargets(pool, focus, n, ctx, 'L.');
  return targets.map((tid, i) => {
    const t = letterById(tid);
    const k = optionCount(ctx, 'L.' + tid);
    const opts = letterOptions(t, ctx, k, (accuracy(ctx.learner.skills['L.' + tid]) ?? 0) >= 0.8);
    return {
      id: 'snd:' + tid, skill: 'L.' + tid, game: 'soundLighthouse', say: [t.say, t.say],
      options: opts.map((l) => ({ id: l.id, text: l.char, font: 'read' as const })), answer: tid,
      reveal: [t.say], hint: [t.say],
      demo: i === 0 && spec.mode === 'demo' ? letterDemo(t) : undefined,
    };
  });
}

function gDetective(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const focus = spec.target ?? (spec.skill.startsWith('L.') ? spec.skill.slice(2) : undefined);
  const pool = letterPool(ctx, spec);
  const targets = mixTargets(pool, focus, n, ctx, 'L.');
  return targets.map((tid, i) => {
    const t = letterById(tid);
    const hard = (accuracy(ctx.learner.skills['L.' + tid]) ?? 0) >= 0.8;
    const size = hard && !ctx.fewerChoices ? 12 : 9;
    const nT = 2 + ctx.rng.int(2);
    const sim = (SIMILAR[t.base] ?? []).filter((c) => c !== t.base);
    const others = ctx.rng.shuffle(nonFinal(LETTERS).map((l) => l.base).filter((b, j, a) => a.indexOf(b) === j && b !== t.base && !sim.includes(b)));
    const fillers: string[] = [];
    const simPool = ctx.rng.shuffle(sim.filter((c) => !(LETTER[t.finalForm ?? '']?.base === c)));
    for (let j = 0; fillers.length < size - nT; j++) {
      const useSim = simPool.length && (hard ? j % 2 === 0 : j % 4 === 0);
      fillers.push(useSim ? simPool[j % simPool.length] : others[j % others.length]);
    }
    const cells = ctx.rng.shuffle([...Array(nT).fill(t.char), ...fillers]);
    const options = cells.map((c, j) => ({ id: 'c' + j, text: c, font: 'read' as const }));
    return {
      id: 'shape:' + tid, skill: 'L.' + tid, game: 'letterDetective', say: [nfc(`${t.name}. ${t.say}.`)], show: { letter: t.char },
      options, targets: options.filter((o) => o.text === t.char).map((o) => o.id),
      demo: i === 0 && spec.mode === 'demo' ? letterDemo(t) : undefined,
    };
  });
}

/* ------------------------------------------------------------------ nikud */

const cvLetters = (ctx: GenCtx, spec: ActivitySpec) =>
  letterPool(ctx, spec).filter((id) => id !== 'vav' && !LETTER[id].final);

function pickVowel(ctx: GenCtx, spec: ActivitySpec): VowelId {
  const vs = knownVowels(ctx.known);
  const focus = spec.skill.startsWith('V.') ? (spec.skill.slice(2) as VowelId) : undefined;
  if (focus && VOWEL[focus] && (ctx.rng.chance(0.65) || vs.length < 2)) return focus;
  return vs.length ? ctx.rng.pick(vs) : 'a';
}

function gMagnet(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const letters = cvLetters(ctx, spec);
  const vowels = knownVowels(ctx.known);
  const focusV = spec.skill.startsWith('V.') ? (spec.skill.slice(2) as VowelId) : undefined;
  if (focusV && !vowels.includes(focusV)) vowels.push(focusV);
  return Array.from({ length: n }, (_, i) => {
    const L = ctx.rng.pick(letters);
    const v = i === 0 && focusV ? focusV : pickVowel(ctx, spec);
    const onlyOne = vowels.length < 2 || (spec.mode === 'demo' && i === 0);
    let options: Option[];
    if (onlyOne) {
      options = VOWEL[v].signs.map((s) => ({ id: s, text: signLabel(s), font: 'read' as const }));
      const others = ctx.rng.shuffle(vowels.filter((x) => x !== v)).slice(0, 1);
      for (const o of others) options.push({ id: VOWEL[o].signs[0], text: signLabel(VOWEL[o].signs[0]), font: 'read' });
    } else {
      const k = Math.min(optionCount(ctx, 'V.' + v), vowels.length);
      const groups = [v, ...ctx.rng.shuffle(vowels.filter((x) => x !== v)).slice(0, k - 1)];
      options = groups.map((g) => { const s = ctx.rng.pick(VOWEL[g].signs); return { id: s, text: signLabel(s), font: 'read' as const }; });
    }
    options = ctx.rng.shuffle(options);
    const accept = options.filter((o) => SIGN[o.id].vowel === v).map((o) => o.id);
    return {
      id: `cv:${L}:${v}`, skill: spec.skill.startsWith('V.') ? spec.skill : 'V.' + v, game: 'nikudMagnet',
      say: [cvSay(L, v)], show: { letter: LETTER[L].char }, options, accept, supported: onlyOne && vowels.length < 2,
      reveal: [cvSay(L, v)],
      demo: i === 0 && spec.mode === 'demo' ? vowelDemo(v, LETTER[L]) : undefined,
    };
  });
}

/** Three צירופים that never share (letter sound, vowel sound) (R-H2). */
function cvOptions(L: string, v: VowelId, ctx: GenCtx, k: number, letters: string[]): { letter: string; vowel: VowelId }[] {
  const vs = knownVowels(ctx.known);
  const out = [{ letter: L, vowel: v }];
  const key = (o: { letter: string; vowel: VowelId }) => LETTER[o.letter].sound + o.vowel;
  const seen = new Set([key(out[0])]);
  const cands: { letter: string; vowel: VowelId }[] = [];
  for (const ov of ctx.rng.shuffle(vs.filter((x) => x !== v))) cands.push({ letter: L, vowel: ov });
  for (const ol of ctx.rng.shuffle(letters.filter((x) => x !== L))) cands.push({ letter: ol, vowel: v });
  for (const ol of ctx.rng.shuffle(letters.filter((x) => x !== L))) for (const ov of vs) cands.push({ letter: ol, vowel: ov });
  // alternate "same letter" and "same vowel" distractors
  const sameL = cands.filter((c) => c.letter === L), sameV = cands.filter((c) => c.vowel === v && c.letter !== L), rest = cands.filter((c) => c.letter !== L && c.vowel !== v);
  for (const c of [sameL[0], sameV[0], sameL[1], sameV[1], ...rest, ...sameL, ...sameV]) {
    if (!c || out.length >= k) continue;
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    out.push(c);
  }
  return ctx.rng.shuffle(out);
}

function cvTargets(spec: ActivitySpec, ctx: GenCtx, n: number) {
  const letters = cvLetters(ctx, spec);
  const ls = mixTargets(letters, spec.target && LETTER[spec.target] ? spec.target : undefined, n, ctx, 'L.');
  return ls.map((L) => ({ L, v: pickVowel(ctx, spec), letters }));
}

function gDJ(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  return cvTargets(spec, ctx, n).filter(({ L, v }) => !ctx.audioBad.has(`cv:${L}:${v}`)).map(({ L, v, letters }) => {
    const opts = cvOptions(L, v, ctx, optionCount(ctx, spec.skill), letters);
    const signOf = (o: { letter: string; vowel: VowelId }) => ctx.rng.pick(VOWEL[o.vowel].signs);
    return {
      id: `cv:${L}:${v}`, skill: spec.skill, game: 'syllableDJ', say: [cvSay(L, v)],
      options: opts.map((o) => ({ id: `${o.letter}:${o.vowel}`, text: cvText(o.letter, signOf(o)), font: 'read' as const })),
      answer: `${L}:${v}`, reveal: [cvSay(L, v)], hint: [cvSay(L, v)],
    };
  });
}

function gPassword(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  return cvTargets(spec, ctx, n).map(({ L, v, letters }) => {
    const opts = cvOptions(L, v, ctx, Math.min(3, optionCount(ctx, spec.skill)), letters);
    return {
      id: `cvr:${L}:${v}`, skill: spec.skill, game: 'secretPassword', reading: true,
      show: { text: cvText(L, ctx.rng.pick(VOWEL[v].signs)) },
      options: opts.map((o) => ({ id: `${o.letter}:${o.vowel}`, emoji: '🔑', say: cvSay(o.letter, o.vowel) })),
      answer: `${L}:${v}`, reveal: [cvSay(L, v)],
    };
  });
}

/* ------------------------------------------------------------------ words */

/** Least recently shown first (never shown = first); ties in random order. Keeps content from repeating (R-H11). */
function byFreshness<T>(items: T[], key: (t: T) => string, ctx: GenCtx): T[] {
  const seen = ctx.learner.seen ?? {};
  return ctx.rng.shuffle(items).sort((a, b) => (seen[key(a)] ?? 0) - (seen[key(b)] ?? 0));
}
const wKey = (w: Word) => 'w:' + w.id;

function pickWords(skill: string, ctx: GenCtx, n: number, filter: (w: Word) => boolean = () => true): Word[] {
  let ws = wordsFor(skill, ctx.known).filter(filter);
  if (ws.length < 2 && /^W[123]$/.test(skill)) ws = decodableWords(ctx.known).filter(filter);
  if (!ws.length) return [];
  const order = byFreshness(ws, wKey, ctx);
  const out: Word[] = [];
  for (let i = 0; out.length < n; i++) out.push(order[i % order.length]);
  return out;
}

/** Picture distractors that look like the target (same first letter / length) so the child must decode (R-H4). */
function pictureOptions(w: Word, ctx: GenCtx, k: number): Option[] {
  const score = (x: Word) => (x.firstLetter === w.firstLetter ? 3 : 0) + (x.syl.length === w.syl.length ? 1 : 0) + (x.lastLetter === w.lastLetter ? 1 : 0) + ctx.rng.next() * 2;
  const others = WORDS.filter((x) => x.id !== w.id && x.emoji !== w.emoji && !x.units.includes('X.genuva')).sort((a, b) => score(b) - score(a));
  const chosen: Word[] = [w];
  for (const x of others) {
    if (chosen.length >= k) break;
    if (chosen.some((c) => c.emoji === x.emoji || c.text === x.text)) continue;
    chosen.push(x);
  }
  return ctx.rng.shuffle(chosen).map((x) => ({ id: x.id, emoji: x.emoji, say: x.text, label: x.text }));
}

function gTrainOrExplorer(game: 'syllableTrain' | 'wordExplorer', spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const skill = spec.skill;
  const ws = pickWords(skill, ctx, n);
  const demo = DEMO_FEATURE[skill];
  return ws.map((w, i) => ({
    id: 'w:' + w.id, skill, game, reading: true, word: w,
    show: game === 'syllableTrain' ? { parts: w.syl } : { text: w.text },
    options: pictureOptions(w, ctx, optionCount(ctx, skill)), answer: w.id,
    reveal: [w.say ?? w.text], supported: spec.mode === 'guided' && i === 0,
    demo: i === 0 && spec.mode === 'demo' && demo ? demo : undefined,
  }));
}

function gBakery(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const skill = spec.skill === 'W3' ? 'W3' : 'W2';
  const ws = pickWords(skill, ctx, n, (w) => w.syl.length >= 2);
  const allSyl = [...new Set(decodableWords(ctx.known).flatMap((w) => w.syl))];
  return ws.map((w) => {
    const extra = ctx.rng.shuffle(allSyl.filter((s) => !w.syl.includes(s))).slice(0, ctx.fewerChoices ? 1 : w.syl.length > 2 ? 2 : 1);
    const blocks = ctx.rng.shuffle([...w.syl.map((s, j) => ({ id: 'b' + j, text: s, font: 'read' as const })), ...extra.map((s, j) => ({ id: 'x' + j, text: s, font: 'read' as const }))]);
    return {
      id: 'w:' + w.id, skill, game: 'wordBakery', word: w, say: [w.say ?? w.text], show: { emoji: w.emoji },
      options: blocks, sequence: w.syl.map((_, j) => 'b' + j), reveal: [w.say ?? w.text],
    };
  });
}

function gFinal(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const finalUnit = spec.skill.startsWith('L.final') ? spec.skill : undefined;
  const endWords = wordsFor(finalUnit ?? 'FIN', ctx.known);
  const knownFinals = knownLetters(ctx.known).filter((l) => l.final);
  const midWords = decodableWords(ctx.known).filter((w) => {
    const cs = clusters(w.text);
    return cs.slice(0, -1).some((c) => knownFinals.some((f) => LETTER[f.final!].base === c.base));
  });
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    const endType = !midWords.length || i === 0 || ctx.rng.chance(0.7);
    const w = endType ? ctx.rng.pick(endWords) : ctx.rng.pick(midWords);
    if (!w) break;
    const cs = clusters(w.text);
    let idx = cs.length - 1;
    if (!endType) idx = cs.findIndex((c, j) => j < cs.length - 1 && knownFinals.some((f) => LETTER[f.final!].base === c.base));
    const c = cs[idx];
    const fin = endType ? LETTER[w.lastLetter] : knownFinals.find((f) => LETTER[f.final!].base === c.base)!;
    const regular = LETTER[fin.final!].base;
    const before = cs.slice(0, idx).map((x) => x.raw).join('');
    const after = cs.slice(idx + 1).map((x) => x.raw).join('');
    items.push({
      id: `fin:${w.id}:${idx}`, skill: finalUnit ?? 'FIN', game: 'finalTransformer', word: w, show: { before, after, emoji: w.emoji },
      options: ctx.rng.shuffle([{ id: 'regular', text: regular, font: 'read' as const }, { id: 'final', text: fin.char, font: 'read' as const }]),
      answer: endType ? 'final' : 'regular', reveal: [w.say ?? w.text],
      demo: i === 0 && spec.mode === 'demo' ? letterDemo(fin) : undefined,
    });
  }
  return items;
}

const FONTS: Option['font'][] = ['read', 'serif', 'ui'];
const COLORS = ['#1E6FD9', '#E53935', '#2E7D32', '#8E24AA', '#EF6C00', '#00838F'];

function gCollector(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const pool = sightFor(ctx.known).filter((s) => !ctx.audioBad.has('sw:' + s.id));
  if (!pool.length) return [];
  const targets = byFreshness(pool, (s) => 'sw:' + s.id, ctx);
  return Array.from({ length: n }, (_, i) => {
    const t = targets[i % targets.length];
    const k = Math.min(optionCount(ctx, 'SIGHT'), pool.length);
    const others = ctx.rng.shuffle(pool.filter((s) => s.id !== t.id && s.text !== t.text)).sort((a, b) => Number(b.text[0] === t.text[0]) - Number(a.text[0] === t.text[0])).slice(0, k - 1);
    const fonts = ctx.rng.shuffle(FONTS);
    const colors = ctx.rng.shuffle(COLORS);
    return {
      id: 'sw:' + t.id, skill: 'SIGHT', game: 'wordCollector', say: [t.text],
      options: ctx.rng.shuffle([t, ...others]).map((s, j) => ({ id: s.id, text: s.text, font: fonts[j % fonts.length], color: colors[j % colors.length] })),
      answer: t.id, reveal: [t.text],
    };
  });
}

/* ------------------------------------------------------------------ sounds (oral) */

const oralWords = () => WORDS.filter((w) => !w.units.includes('X.genuva') && w.firstSound && w.firstSound !== 'ʔ');

function gSafari(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const byClass = new Map<string, Word[]>();
  for (const w of oralWords()) byClass.set(w.firstSound, [...(byClass.get(w.firstSound) ?? []), w]);
  const classes = [...byClass.keys()].filter((k) => byClass.get(k)!.length >= 2);
  const usedWords = new Set<string>();
  return Array.from({ length: n }, () => {
    const cls = ctx.rng.pick(classes);
    const fresh = byFreshness(byClass.get(cls)!, wKey, ctx).sort((a, b) => Number(usedWords.has(a.id)) - Number(usedWords.has(b.id)));
    const [cue, ans] = fresh.filter((w, j, a) => a.findIndex((x) => x.emoji === w.emoji) === j);
    usedWords.add(cue.id).add(ans.id);
    const k = optionCount(ctx, 'PA.first');
    const used = new Set([cls]);
    const opts: Word[] = [ans];
    for (const w of ctx.rng.shuffle(oralWords())) {
      if (opts.length >= k) break;
      if (used.has(w.firstSound) || w.emoji === cue.emoji) continue;
      used.add(w.firstSound);
      opts.push(w);
    }
    return {
      id: `pa1:${cue.id}:${ans.id}`, skill: 'PA.first', game: 'soundSafari', word: cue, show: { emoji: cue.emoji },
      say: [cue.text, nfc(`מִי מַתְחִיל כְּמוֹ ${cue.text}?`)], nameOptions: true,
      options: ctx.rng.shuffle(opts).map((w) => ({ id: w.id, emoji: w.emoji, say: w.text })), answer: ans.id,
      reveal: [cue.text, ans.text], hint: [cue.text, ans.text],
    };
  });
}

/** Speakable form of a syllable: open syllables get a quiet letter so TTS says them cleanly (§3.3). */
export function speakSyllable(s: string): string {
  const cs = clusters(s);
  const last = cs[cs.length - 1];
  if (!last || last.vowel === null || last.vowel === 'sheva') return s;
  if (last.vowel === 'qamats' || last.vowel === 'patah' || last.vowel === 'tsere' || last.vowel === 'segol') return nfc(s + 'ה');
  if (last.vowel === 'hiriq') return nfc(s + 'י');
  if (last.vowel === 'holam') return nfc(s.replace(MARK.holam, '') + 'ו' + MARK.holam);
  if (last.vowel === 'qubuts') return nfc(s.replace(MARK.qubuts, '') + 'ו' + MARK.dagesh);
  return s;
}

function gHop(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const pool = WORDS.filter((w) => !w.units.includes('X.genuva') && w.syl.length <= 4);
  const byLen = [1, 2, 3, 4].map((k) => byFreshness(pool.filter((w) => w.syl.length === k), wKey, ctx));
  return Array.from({ length: n }, (_, i) => {
    const len = [2, 1, 3, 2, 4, 3][i % 6];
    const list = byLen[len - 1].length ? byLen[len - 1] : byLen[1];
    const w = list.shift()!;
    list.push(w);
    return {
      id: 'hop:' + w.id, skill: 'PA.count', game: 'syllableHop', word: w, say: [w.say ?? w.text], show: { emoji: w.emoji },
      options: [], count: w.syl.length, hint: w.syl.map(speakSyllable), reveal: w.syl.map(speakSyllable),
    };
  });
}

function gRobot(spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  const pool = byFreshness(oralWords().filter((w) => w.syl.length >= 2), wKey, ctx);
  return pool.slice(0, n).map((w) => {
    const k = optionCount(ctx, 'PA.blend');
    const others = ctx.rng.shuffle(oralWords().filter((x) => x.id !== w.id && x.emoji !== w.emoji && x.syl[0] !== w.syl[0])).slice(0, k - 1);
    return {
      id: 'blend:' + w.id, skill: 'PA.blend', game: 'robotMixer', word: w, say: w.syl.map(speakSyllable),
      options: ctx.rng.shuffle([w, ...others]).map((x) => ({ id: x.id, emoji: x.emoji, say: x.text })), answer: w.id,
      reveal: [w.say ?? w.text], hint: w.syl.map(speakSyllable),
    };
  });
}

/* ------------------------------------------------------------------ sentences and stories */

function sentenceItems(game: 'echoReader' | 'phraseTrain', spec: ActivitySpec, ctx: GenCtx, n: number): Item[] {
  let pool = sentencesFor(ctx.known);
  if (game === 'phraseTrain') pool = pool.filter((s) => s.phrases.length > 1);
  if (!pool.length) return [];
  const order = byFreshness(pool, (s) => 's:' + s.id, ctx);
  // Distractor pictures share no emoji with the answer picture, so the meaning question has one fair answer.
  const glyphs = (pic: string) => [...pic].filter((c) => c.codePointAt(0)! > 0x2000 && c !== '\uFE0F' && c !== '\u200D');
  return order.slice(0, n).map((s) => {
    const mine = new Set(glyphs(s.pic));
    const others = ctx.rng.shuffle(SENTENCES.filter((x) => x.id !== s.id && !glyphs(x.pic).some((c) => mine.has(c)))).slice(0, Math.min(3, optionCount(ctx, spec.skill)) - 1);
    return {
      id: 's:' + s.id, skill: spec.skill, game, sentence: s, reading: true,
      options: ctx.rng.shuffle([s, ...others]).map((x) => ({ id: x.id, emoji: x.pic })), answer: s.id, reveal: [s.text],
    };
  });
}

function questionItem(story: Story, q: StoryQuestion, qi: number, skill: string, game: GameId): Item {
  return {
    id: `q:${story.id}:${qi}`, skill, game, say: [q.q], nameOptions: true,
    options: q.options.map((o, j) => ({ id: String(j), emoji: o.emoji, say: o.label, label: o.label })), answer: String(q.answer),
    reveal: [q.options[q.answer].label],
  };
}

export function puzzleItem(story: Story, game: GameId): Item {
  const cards = story.order.map((p) => ({ id: 'p' + p, emoji: story.pages[p].scene, say: story.pages[p].text }));
  return { id: 'seq:' + story.id, skill: 'COMP.seq', game, story, options: cards, sequence: story.order.map((p) => 'p' + p) };
}

function leastHeard(stories: Story[], ctx: GenCtx): Story | undefined {
  return byFreshness(stories, (s) => 'st:' + s.id, ctx)[0];
}

function gStoryTime(spec: ActivitySpec, ctx: GenCtx): Item[] {
  const story = (spec.target && listenStories().find((s) => s.id === spec.target)) || leastHeard(listenStories(), ctx);
  if (!story) return [];
  const qs = ctx.rng.shuffle(story.questions.map((q, i) => ({ q, i }))).slice(0, 2).map(({ q, i }) => questionItem(story, q, i, 'COMP.listen', 'storyTime'));
  return [{ id: 'story:' + story.id, skill: 'COMP.listen', game: 'storyTime', story, options: [], questions: qs, puzzle: puzzleItem(story, 'storyTime') }];
}

function gStoryDetective(spec: ActivitySpec, ctx: GenCtx): Item[] {
  const story = leastHeard(readStoriesFor(ctx.known), ctx);
  if (!story) return [];
  const qs = story.questions.map((q, i) => questionItem(story, q, i, 'COMP.read', 'storyDetective'));
  return [{ id: 'story:' + story.id, skill: 'COMP.read', game: 'storyDetective', story, options: [], questions: qs, reading: true }];
}

function gStoryPuzzle(spec: ActivitySpec, ctx: GenCtx): Item[] {
  const pool = [...listenStories(), ...readStoriesFor(ctx.known)];
  const story = leastHeard(pool, ctx);
  return story ? [{ ...puzzleItem(story, 'storyPuzzle'), questions: [] }] : [];
}

/* ------------------------------------------------------------------ dispatch */

export function generate(spec: ActivitySpec, ctx: GenCtx): Item[] {
  const n = spec.n ?? GAME[spec.game].items;
  switch (spec.game) {
    case 'soundSafari': return gSafari(spec, ctx, n);
    case 'syllableHop': return gHop(spec, ctx, n);
    case 'robotMixer': return gRobot(spec, ctx, n);
    case 'soundLighthouse': return gLighthouse(spec, ctx, n);
    case 'letterDetective': return gDetective(spec, ctx, n);
    case 'nikudMagnet': return gMagnet(spec, ctx, n);
    case 'syllableDJ': return gDJ(spec, ctx, n);
    case 'secretPassword': return gPassword(spec, ctx, n);
    case 'syllableTrain': return gTrainOrExplorer('syllableTrain', spec, ctx, n);
    case 'wordExplorer': return gTrainOrExplorer('wordExplorer', spec, ctx, n);
    case 'wordBakery': return gBakery(spec, ctx, n);
    case 'finalTransformer': return gFinal(spec, ctx, n);
    case 'wordCollector': return gCollector(spec, ctx, n);
    case 'echoReader': return sentenceItems('echoReader', spec, ctx, n);
    case 'phraseTrain': return sentenceItems('phraseTrain', spec, ctx, n);
    case 'storyTime': return gStoryTime(spec, ctx);
    case 'storyDetective': return gStoryDetective(spec, ctx);
    case 'storyPuzzle': return gStoryPuzzle(spec, ctx);
  }
}

export const SIGN_IDS = SIGNS.map((s) => s.id);
