/* Content gating (SPEC R-H1): what the child can read independently, and which skills are practiceable. */
import { LETTERS } from './hebrew.ts';
import { isUnit } from './curriculum.ts';
import { WORDS, type Word } from './content/words.ts';
import { SENTENCES, SIGHT_WORDS, STORIES, type Sentence, type SightWord, type Story } from './content/texts.ts';
import { analyzeWord } from './hebrew.ts';
import type { Learner } from './learner.ts';

export type Known = Set<string>;

/** Units the child has been introduced to (any status), plus units a parent marked as learned at school. */
export function knownUnits(l: Learner, school: string[] = []): Known {
  const k = new Set<string>(school);
  for (const id of Object.keys(l.skills)) if (isUnit(id)) k.add(id);
  return k;
}

export const canRead = (units: string[], known: Known): boolean => units.every((u) => known.has(u));

export const decodableWords = (known: Known): Word[] => WORDS.filter((w) => canRead(w.units, known));

/** Words that practise a decoding skill (W1/W2/W3 by length; X.quiet / V.shva by feature). */
export function wordsFor(skill: string, known: Known): Word[] {
  const ws = decodableWords(known);
  switch (skill) {
    case 'W1': case 'W2': case 'W3': return ws.filter((w) => w.level === skill);
    case 'X.quiet': return ws.filter((w) => w.units.includes('X.quiet'));
    case 'V.shva': return ws.filter((w) => w.units.includes('V.shva'));
    case 'X.genuva': return ws.filter((w) => w.units.includes('X.genuva'));
    case 'FIN': return ws.filter((w) => w.endsWithFinal);
    default:
      if (skill.startsWith('L.final')) return ws.filter((w) => w.units.includes(skill));
      return ws;
  }
}

export const sightFor = (known: Known): SightWord[] => SIGHT_WORDS.filter((s) => canRead(s.units, known));
export const sentencesFor = (known: Known): Sentence[] => SENTENCES.filter((s) => canRead(s.units, known));

/** Share of a story's word tokens the child can decode. */
export function storyCoverage(s: Story, known: Known): number {
  const ok = s.words.filter((w) => canRead(analyzeWord(w).units, known)).length;
  return s.words.length ? ok / s.words.length : 0;
}
export const readStoriesFor = (known: Known): Story[] => STORIES.filter((s) => s.kind === 'read' && storyCoverage(s, known) >= 0.9);
export const listenStories = (): Story[] => STORIES.filter((s) => s.kind === 'listen');

export const knownLetters = (known: Known) => LETTERS.filter((l) => known.has('L.' + l.id));
export const knownVowels = (known: Known) => (['a', 'i', 'e', 'o', 'u'] as const).filter((v) => known.has('V.' + v));

/** Minimum content needed before a skill can be practised (keeps games from repeating 2 items forever). */
export const MIN_CONTENT = { words: 4, w3: 3, final: 3, sight: 4, sentences: 3 };

/** Can this skill be practised now? Units: once introduced. Higher skills: once enough decodable content exists. */
export function practiceable(skill: string, l: Learner, known: Known): boolean {
  if (skill.startsWith('PA.') || skill === 'COMP.listen' || skill === 'COMP.seq') return true;
  if (skill === 'CV') return knownVowels(known).length > 0 && knownLetters(known).filter((x) => !x.final).length >= 3;
  if (skill === 'W1' || skill === 'W2') return wordsFor(skill, known).length >= MIN_CONTENT.words;
  if (skill === 'W3') return wordsFor(skill, known).length >= MIN_CONTENT.w3;
  if (skill === 'FIN') return wordsFor('FIN', known).length >= MIN_CONTENT.final;
  if (skill === 'SIGHT') return sightFor(known).length >= MIN_CONTENT.sight;
  if (skill === 'FLU.sentence') return sentencesFor(known).length >= MIN_CONTENT.sentences;
  if (skill === 'FLU.phrase') return sentencesFor(known).filter((s) => s.phrases.length > 1).length >= MIN_CONTENT.sentences;
  if (skill === 'COMP.read') return readStoriesFor(known).length > 0;
  if (skill === 'X.quiet' || skill === 'V.shva' || skill === 'X.genuva') return known.has(skill) && wordsFor(skill, known).length >= 2;
  if (skill.startsWith('L.final')) return known.has(skill);
  if (isUnit(skill)) return known.has(skill) || !!l.skills[skill];
  return false;
}
