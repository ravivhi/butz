/* Content invariants (SPEC §3, R-H9): returns a list of problems; empty = valid. Used by tests and `npm run validate`.
   Every Hebrew string the child sees or hears is linted for pointing typos (lintText in hebrew.ts). */
import { LETTER, clusters, lintText, nfc } from './hebrew.ts';
import { LONG_WORDS, WORDS } from './content/words.ts';
import { SENTENCES, SIGHT_WORDS, STORIES } from './content/texts.ts';
import { NOTEBOOKS, STICKERS_PER_NOTEBOOK } from './content/stickers.ts';
import { storySentences } from './content/stories.ts';
import { SCHEMAS, STORY_LENGTH, makeStory } from './content/storygen.ts';
import { DEFAULT_SPINE, GAMES, MAP_ORDER, SKILLS, SKILL, STRANDS } from './curriculum.ts';
import { allPhrases } from './phrases.ts';

/** Words checked by hand that legitimately break a mechanical rule (loanwords, interjections, lexical exceptions). */
export const LINT_OK = new Set([
  'וָואו',        // interjection "wow"
  'דִּי', 'גֵיי',   // "DJ" (ג׳)
  'עַגְבָנִיָּה',  // rafe ב after shva nach (lexical)
  'עַגְבָנִיּוֹת',
  'שַׁרְבִיט',     // rafe ב after shva nach (lexical)
  'פֵיָה',        // loanword, initial פ = f
  'פָלָאפֶל', 'פְלָמִינְגּוֹ', // loanwords, initial פ = f
  // hovering shva (שְׁוָא מְרַחֵף): the letter after it stays rafe
  'בִּדְפוּס', 'בִּכְתַב', 'הִפְכִי', 'כִּתְבִי',
  'הַבַּיְתָה', 'הָעַגְבָנִיָּה', // lexical: ת / ב stay rafe
  // more hovering shva (stories): בִּ/בְּ/לִ + a shva-initial word
  'בִּסְפָרִים', 'בִּשְׁבִיל', 'בִּשְׁבִילֵךְ', 'בִּשְׁבִילִי', 'בִּשְׁבִילוֹ', 'בִּגְדֵי', 'בְּבִגְדֵי', 'בִּמְגֵרָה',
  'בִּסְבִיבוֹנִים', 'בִּצְבָעִים', 'בִּמְכוֹנִית', 'לִצְפַרְדְּעִים',
  'אֶתְכֶם', 'מַלְכוּתוֹ', 'לָעַגְבָנִיּוֹת', // lexical: כ / ב stay rafe
].map(nfc));

/** Emoji added after Unicode 13 (2020) show as empty boxes on older tablets. Symbols & Pictographs Extended-A (U+1FA70…)
    is the block that keeps growing; the ranges below are the ones that existed by Unicode 13. */
const EXT_A_OK: [number, number][] = [[0x1FA70, 0x1FA74], [0x1FA78, 0x1FA7A], [0x1FA80, 0x1FA86], [0x1FA90, 0x1FAA8], [0x1FAB0, 0x1FAB6], [0x1FAC0, 0x1FAC2], [0x1FAD0, 0x1FAD6]];
const NEWER = new Set([0x1F6DD, 0x1F6DE, 0x1F6DF, 0x1F7F0, 0x1F979, 0x1F9CC]);
export function tooNewEmoji(s: string): string[] {
  return [...s].filter((ch) => {
    const cp = ch.codePointAt(0)!;
    if (NEWER.has(cp)) return true;
    return cp >= 0x1FA70 && cp <= 0x1FAFF && !EXT_A_OK.some(([a, b]) => cp >= a && cp <= b);
  });
}
function checkEmoji(where: string, s: string, errors: string[]): void {
  const bad = tooNewEmoji(s);
  if (bad.length) errors.push(`${where}: emoji newer than Unicode 13: ${bad.join(' ')}`);
}

function checkPointed(where: string, text: string, errors: string[]): void {
  if (text !== nfc(text)) errors.push(`${where}: not NFC`);
  for (const c of clusters(text)) {
    if (c.base === 'ש' && !c.shinDot && !c.sinDot) errors.push(`${where}: ש without shin/sin dot in "${text}"`);
  }
  for (const p of lintText(text, LINT_OK)) errors.push(`${where}: ${p}`);
}

export function validateContent(): string[] {
  const e: string[] = [];
  const ids = new Set<string>(), texts = new Set<string>(), emojis = new Map<string, string>();
  for (const w of WORDS) {
    const where = `word ${w.id}`;
    if (ids.has(w.id)) e.push(`${where}: duplicate id`);
    ids.add(w.id);
    if (texts.has(w.text)) e.push(`${where}: duplicate text`);
    texts.add(w.text);
    if (!w.emoji) e.push(`${where}: no picture`);
    if (emojis.has(w.emoji)) e.push(`${where}: picture ${w.emoji} also used by ${emojis.get(w.emoji)}`);
    emojis.set(w.emoji, w.id);
    if (w.syl.join('') !== w.text) e.push(`${where}: syllables do not join to the word (R-H7)`);
    if (w.units.includes('X.katan') && !w.katan) e.push(`${where}: kamatz katan not tagged`);
    if (w.letters.some((l) => !LETTER[l])) e.push(`${where}: unknown letter`);
    if (!w.letters.length) e.push(`${where}: no consonants`);
    checkPointed(where, w.text, e);
    checkEmoji(where, w.emoji, e);
  }
  for (const w of LONG_WORDS) {
    const where = `long word ${w.id}`;
    if (ids.has(w.id)) e.push(`${where}: duplicate id`);
    ids.add(w.id);
    if (w.syl.join('') !== w.text.replace(/ /g, '')) e.push(`${where}: syllables do not join to the word (R-H7)`);
    if (w.syl.length > 7) e.push(`${where}: more than 7 parts (the bakery tray has 7 places)`);
    if (emojis.has(w.emoji)) e.push(`${where}: picture ${w.emoji} also used by ${emojis.get(w.emoji)}`);
    emojis.set(w.emoji, w.id);
    checkPointed(where, w.text, e);
    checkEmoji(where, w.emoji, e);
  }
  for (const s of SIGHT_WORDS) checkPointed(`sight ${s.id}`, s.text, e);
  for (const s of SENTENCES) {
    checkPointed(`sentence ${s.id}`, s.text, e);
    checkEmoji(`sentence ${s.id}`, s.pic, e);
    if (s.phrases.join(' ') !== s.text) e.push(`sentence ${s.id}: phrases do not join`);
    if (!s.pic) e.push(`sentence ${s.id}: no picture`);
  }
  const pics = SENTENCES.map((s) => s.pic);
  if (new Set(pics).size !== pics.length) e.push('sentences: duplicate pictures (meaning questions would be ambiguous)');
  for (const st of STORIES) {
    const ss = storySentences(st);
    checkPointed(`story ${st.id} title`, st.title, e);
    checkEmoji(`story ${st.id}`, st.questions.flatMap((q) => q.options.map((o) => o.emoji ?? '')).join(''), e);
    ss.forEach((t, i) => checkPointed(`story ${st.id} s${i}`, t, e));
    for (const [qi, q] of st.questions.entries()) {
      if (q.answer < 0 || q.answer >= q.options.length) e.push(`story ${st.id} q${qi}: bad answer index`);
      if (new Set(q.options.map((o) => o.label)).size !== q.options.length) e.push(`story ${st.id} q${qi}: duplicate option labels`);
      checkPointed(`story ${st.id} q${qi}`, q.q, e);
      q.options.forEach((o, oi) => checkPointed(`story ${st.id} q${qi} option ${oi}`, o.label, e));
    }
    if (st.order.some((i) => i < 0 || i >= ss.length)) e.push(`story ${st.id}: bad order index`);
    const cards = st.order.map((i) => ss[i]);
    if (new Set(cards).size !== cards.length) e.push(`story ${st.id}: puzzle cards repeat a sentence`);
  }
  // generated stories (v1.3): every plan at every level, a few seeds each
  for (const schema of SCHEMAS) {
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const gs = makeStory(schema, level, seed);
        const where = `story ${gs.id}`;
        const ss = gs.paragraphs.flat();
        if (ss.length !== STORY_LENGTH[level]) e.push(`${where}: ${ss.length} sentences (expected ${STORY_LENGTH[level]})`);
        checkPointed(`${where} title`, gs.title, e);
        ss.forEach((t, i) => checkPointed(`${where} s${i}`, t, e));
        for (const f of gs.facts) {
          checkPointed(`${where} q`, f.q, e);
          for (const o of [f.a, ...f.pool]) { checkPointed(`${where} q option`, o.label, e); checkEmoji(where, o.emoji ?? '', e); }
          if (!f.pool.some((o) => o.label !== f.a.label)) e.push(`${where}: question without wrong answers: ${f.q}`);
        }
        if (gs.events.length < 3) e.push(`${where}: fewer than 3 puzzle events`);
      }
    }
  }
  const storyIds = STORIES.map((s) => s.id), storyTitles = STORIES.map((s) => s.title);
  if (new Set(storyIds).size !== storyIds.length) e.push('stories: duplicate id');
  if (new Set(storyTitles).size !== storyTitles.length) e.push('stories: duplicate title');
  const sentTexts = SENTENCES.map((s) => s.text), sentIds = SENTENCES.map((s) => s.id);
  if (new Set(sentTexts).size !== sentTexts.length || new Set(sentIds).size !== sentIds.length) e.push('sentences: duplicate text or id');
  const sightTexts = SIGHT_WORDS.map((s) => s.text), sightIds = SIGHT_WORDS.map((s) => s.id);
  if (new Set(sightTexts).size !== sightTexts.length || new Set(sightIds).size !== sightIds.length) e.push('sight words: duplicate text or id');
  for (const n of NOTEBOOKS) {
    checkPointed(`notebook ${n.id}`, n.name, e);
    checkEmoji(`notebook ${n.id}`, n.cover + n.stickers.join(''), e);
    if (n.stickers.length !== STICKERS_PER_NOTEBOOK) e.push(`notebook ${n.id}: ${n.stickers.length} stickers (expected ${STICKERS_PER_NOTEBOOK})`);
    if (new Set(n.stickers).size !== n.stickers.length) e.push(`notebook ${n.id}: duplicate stickers`);
  }
  for (const gd of ['boy', 'girl'] as const) {
    const starters = NOTEBOOKS.filter((n) => n.starter && (n.gender === 'all' || n.gender === gd));
    if (starters.length !== 2) e.push(`notebooks: ${gd} should start with 2 notebooks`);
  }
  for (const g of GAMES) {
    checkPointed(`game ${g.id} name`, g.name, e);
    checkEmoji(`game ${g.id}`, g.icon, e);
    g.mission.forEach((m, i) => checkPointed(`game ${g.id} mission ${i ? 'girl' : 'boy'}`, m, e));
  }
  for (const s of [...SKILLS.filter((x) => !x.id.startsWith('L.')), ...STRANDS]) checkPointed(`label ${s.id}`, s.label, e);
  allPhrases().forEach((p, i) => checkPointed(`phrase ${i}`, p, e));
  for (const u of DEFAULT_SPINE) if (!SKILL[u]) e.push(`spine: unknown skill ${u}`);
  for (const g of GAMES) for (const p of g.skills) if (!p.endsWith('*') && !SKILL[p]) e.push(`game ${g.id}: unknown skill ${p}`);
  if (MAP_ORDER.length !== GAMES.length || GAMES.some((g) => !MAP_ORDER.includes(g.id))) e.push('map: every game must be on the map once');
  return e;
}
