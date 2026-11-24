/* Everything the app can say (SPEC R-T4): the input of the audio generator (scripts/make-audio.ts) and the parent's
   "recorded N of M" line. Keys are the exact NFC strings passed to say(); kind sets the speaking rate. Pure TS. */
import { LETTERS, VOWELS, VOWEL, SIGN, cvSay, nfc, textWords } from './hebrew.ts';
import { GAMES, WORLDS } from './curriculum.ts';
import { WORDS } from './content/words.ts';
import { SENTENCES, SIGHT_WORDS, STORIES } from './content/texts.ts';
import { NOTEBOOKS } from './content/stickers.ts';
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
  // words, syllables, sound-game prompts
  for (const w of WORDS) {
    add('word', w.say ?? w.text, w.text);
    add('sound', ...w.syl.map(speakSyllable));
    add('talk', nfc(`מִי מַתְחִיל כְּמוֹ ${w.text}?`));
    add('talk', ...LETTERS.filter((l) => l.id === w.firstLetter).map((l) => nfc(`${l.say}, כְּמוֹ ${w.text}`)));
  }
  for (const s of SIGHT_WORDS) add('word', s.text);
  for (const s of SENTENCES) add('talk', s.text, ...s.phrases);
  for (const st of STORIES) {
    add('talk', st.title, ...st.pages.map((p) => p.text));
    for (const q of st.questions) add('talk', q.q, ...q.options.map((o) => o.label));
    if (st.kind === 'read') for (const p of st.pages) add('word', ...p.text.split(' ').map((tok) => textWords(tok)[0]));
  }
  // instructions and Butz's lines, both genders
  for (const gm of GAMES) add('talk', gm.name, ...gm.mission);
  for (const w of WORLDS) add('talk', w.name);
  for (const n of NOTEBOOKS) add('talk', n.name);
  add('talk', ...allPhrases(), BUTZ);
  for (const gender of ['boy', 'girl'] as const) {
    for (let n = 1; n <= 45; n++) add('talk', needMore(n, gender));
    add('talk', g(SAY.inShop, gender));
  }
  cache = [...out].map(([text, kind]) => ({ text, kind }));
  return cache;
}
