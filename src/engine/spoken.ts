/* Everything the app can say (SPEC R-T4): the input of the audio generator (scripts/make-audio.ts) and the parent's
   "recorded N of M" line. Keys are the exact NFC strings passed to say(); kind sets the speaking rate. Pure TS. */
import { LETTERS, VOWELS, VOWEL, SIGN, cvSay, nfc, textWords } from './hebrew.ts';
import { GAMES } from './curriculum.ts';
import { LONG_WORDS, WORDS } from './content/words.ts';
import { STORIES } from './content/texts.ts';
import { NOTEBOOKS } from './content/stickers.ts';
import { storySentences } from './content/stories.ts';
import { DEMO_FEATURE, letterDemo, speakSyllable, vowelDemo } from './generators.ts';
import { BUTZ, SAY, allPhrases, g, needMore } from './phrases.ts';

export type SpokenKind = 'sound' | 'word' | 'talk';
export interface Spoken { text: string; kind: SpokenKind }

let cache: Spoken[] | null = null;

export function allSpokenTexts(): Spoken[] {
  if (cache) return cache;
  const out = new Map<string, SpokenKind>();
  const add = (kind: SpokenKind, ...xs: (string | undefined)[]) => {
    for (const x of xs) {
      const t = x ? nfc(x).trim() : '';
      if (t && !t.includes('#') && !out.has(t)) out.set(t, kind);
    }
  };
  // letter and vowel sounds, צירופים
  for (const l of LETTERS) {
    add('sound', l.say);
    add('talk', l.name, nfc(`${l.name}.`), nfc(`${l.name}. ${l.say}.`));
    add('talk', ...(letterDemo(l)?.lines ?? []));
  }
  for (const v of VOWELS) {
    add('sound', v.sayAlone);
    add('talk', v.name, ...VOWEL[v.id].signs.map((s) => SIGN[s].name));
    for (const l of LETTERS.filter((x) => !x.final && x.id !== 'vav')) {
      add('sound', cvSay(l.id, v.id));
      add('talk', ...(vowelDemo(v.id, l)?.lines ?? []));
    }
  }
  for (const d of Object.values(DEMO_FEATURE)) add('talk', ...(d?.lines ?? []));
  // words, syllables, memory-card prompts
  for (const w of WORDS) {
    add('word', w.say ?? w.text, w.text);
    add('sound', ...w.syl.map(speakSyllable));
    add('talk', ...LETTERS.filter((l) => l.id === w.firstLetter).map((l) => nfc(`${l.say}, כְּמוֹ ${w.text}`)));
  }
  for (const w of LONG_WORDS) {
    add('word', w.say ?? w.text);
    add('sound', ...w.syl.map(speakSyllable));
  }
  // hand-written stories (generated stories, v1.3, are endless: they are spoken by the device voice)
  for (const st of STORIES) {
    add('talk', st.title, ...storySentences(st));
    for (const q of st.questions) add('talk', q.q, ...q.options.map((o) => o.label));
    for (const t of storySentences(st)) add('word', ...textWords(t));
  }
  // game names and Butz's lines, both genders (v1.3: instructions are written, not spoken)
  for (const gm of GAMES) add('talk', gm.name);
  for (const n of NOTEBOOKS) add('talk', n.name);
  add('talk', ...allPhrases(), BUTZ);
  for (const gender of ['boy', 'girl'] as const) {
    for (let n = 1; n <= 45; n++) add('talk', needMore(n, gender));
    add('talk', g(SAY.inShop, gender));
  }
  cache = [...out].map(([text, kind]) => ({ text, kind }));
  return cache;
}
