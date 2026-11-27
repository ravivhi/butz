/* Hebrew text model: parse pointed text into letter clusters and derive the units a child must know to read it
   (SPEC §3.1), sound classes (§3.2) and speakable forms for TTS (§3.3). Pure TypeScript, no React imports. */

export const nfc = (s: string): string => s.normalize('NFC');

export const MARK = {
  sheva: '\u05B0', hatafSegol: '\u05B1', hatafPatah: '\u05B2', hatafQamats: '\u05B3', hiriq: '\u05B4', tsere: '\u05B5',
  segol: '\u05B6', patah: '\u05B7', qamats: '\u05B8', holam: '\u05B9', holamHaserVav: '\u05BA', qubuts: '\u05BB',
  dagesh: '\u05BC', shinDot: '\u05C1', sinDot: '\u05C2', qamatsQatan: '\u05C7',
} as const;

type VowelMark = 'sheva' | 'hatafSegol' | 'hatafPatah' | 'hatafQamats' | 'hiriq' | 'tsere' | 'segol' | 'patah' | 'qamats' | 'holam' | 'qubuts' | 'qamatsQatan';
const VOWEL_OF: Record<string, VowelMark> = {
  '\u05B0': 'sheva', '\u05B1': 'hatafSegol', '\u05B2': 'hatafPatah', '\u05B3': 'hatafQamats', '\u05B4': 'hiriq', '\u05B5': 'tsere',
  '\u05B6': 'segol', '\u05B7': 'patah', '\u05B8': 'qamats', '\u05B9': 'holam', '\u05BA': 'holam', '\u05BB': 'qubuts', '\u05C7': 'qamatsQatan',
};

export const isLetter = (ch: string): boolean => ch >= '\u05D0' && ch <= '\u05EA';
const isMark = (ch: string): boolean => ch >= '\u0591' && ch <= '\u05C7' && ch !== '\u05BE' && ch !== '\u05C0' && ch !== '\u05C3' && ch !== '\u05C6';

export interface Cluster {
  base: string; // the letter
  dagesh: boolean;
  shinDot: boolean;
  sinDot: boolean;
  holamOnVav: boolean; // U+05BA (consonantal vav with holam)
  vowel: VowelMark | null;
  raw: string;
}

/** Split one word (no spaces) into letter clusters. Non-Hebrew characters are dropped. */
export function clusters(word: string): Cluster[] {
  const out: Cluster[] = [];
  for (const ch of nfc(word)) {
    if (isLetter(ch)) {
      out.push({ base: ch, dagesh: false, shinDot: false, sinDot: false, holamOnVav: false, vowel: null, raw: ch });
      continue;
    }
    const c = out[out.length - 1];
    if (!c || !isMark(ch)) continue;
    c.raw += ch;
    if (ch === MARK.dagesh) c.dagesh = true;
    else if (ch === MARK.shinDot) c.shinDot = true;
    else if (ch === MARK.sinDot) c.sinDot = true;
    else if (VOWEL_OF[ch]) {
      if (ch === MARK.holamHaserVav) c.holamOnVav = true;
      c.vowel = VOWEL_OF[ch];
    }
  }
  return out;
}

/* ------------------------------------------------------------------ letters */

export interface LetterInfo {
  id: string;        // unit id without prefix: 'mem' → unit 'L.mem'
  char: string;      // displayed form (with dagesh / shin dot when it matters)
  base: string;      // bare letter
  name: string;      // pointed letter name (LN.*)
  sound: string;     // sound class key (§3.2)
  say: string;       // speakable form of the letter sound (§3.3)
  final?: string;    // for final forms: id of the regular letter
  finalForm?: string;// for regular letters with a final form: id of the final letter
  needsRecording?: boolean;
}

export const LETTERS: LetterInfo[] = [
  { id: 'alef', char: 'א', base: 'א', name: 'אָלֶף', sound: 'ʔ', say: 'אָה' },
  { id: 'bet', char: 'בּ', base: 'ב', name: 'בֵּית', sound: 'b', say: 'בָּה' },
  { id: 'vet', char: 'ב', base: 'ב', name: 'בֵית', sound: 'v', say: 'וָה' },
  { id: 'gimel', char: 'ג', base: 'ג', name: 'גִּימֶל', sound: 'g', say: 'גָּה' },
  { id: 'dalet', char: 'ד', base: 'ד', name: 'דָּלֶת', sound: 'd', say: 'דָּה' },
  { id: 'he', char: 'ה', base: 'ה', name: 'הֵא', sound: 'h', say: 'הָה' },
  { id: 'vav', char: 'ו', base: 'ו', name: 'וָו', sound: 'v', say: 'וָה' },
  { id: 'zayin', char: 'ז', base: 'ז', name: 'זַיִן', sound: 'z', say: 'זָא' },
  { id: 'het', char: 'ח', base: 'ח', name: 'חֵית', sound: 'kh', say: 'חָה' },
  { id: 'tet', char: 'ט', base: 'ט', name: 'טֵית', sound: 't', say: 'טָה' },
  { id: 'yod', char: 'י', base: 'י', name: 'יוֹד', sound: 'y', say: 'יָה' },
  { id: 'kaf', char: 'כּ', base: 'כ', name: 'כָּף', sound: 'k', say: 'קָה' },
  { id: 'khaf', char: 'כ', base: 'כ', name: 'כָף', sound: 'kh', say: 'חָה', finalForm: 'finalKhaf' },
  { id: 'finalKhaf', char: 'ך', base: 'ך', name: 'כָף סוֹפִית', sound: 'kh', say: 'חָה', final: 'khaf' },
  { id: 'lamed', char: 'ל', base: 'ל', name: 'לָמֶד', sound: 'l', say: 'לָה' },
  { id: 'mem', char: 'מ', base: 'מ', name: 'מֵם', sound: 'm', say: 'מָה', finalForm: 'finalMem' },
  { id: 'finalMem', char: 'ם', base: 'ם', name: 'מֵם סוֹפִית', sound: 'm', say: 'מָה', final: 'mem' },
  { id: 'nun', char: 'נ', base: 'נ', name: 'נוּן', sound: 'n', say: 'נָה', finalForm: 'finalNun' },
  { id: 'finalNun', char: 'ן', base: 'ן', name: 'נוּן סוֹפִית', sound: 'n', say: 'נָה', final: 'nun' },
  { id: 'samekh', char: 'ס', base: 'ס', name: 'סָמֶךְ', sound: 's', say: 'סָה' },
  { id: 'ayin', char: 'ע', base: 'ע', name: 'עַיִן', sound: 'ʔ', say: 'עָה' },
  { id: 'pe', char: 'פּ', base: 'פ', name: 'פֵּא', sound: 'p', say: 'פָּא' },
  { id: 'fe', char: 'פ', base: 'פ', name: 'פֵא', sound: 'f', say: 'פָא', finalForm: 'finalFe', needsRecording: true },
  { id: 'finalFe', char: 'ף', base: 'ף', name: 'פֵא סוֹפִית', sound: 'f', say: 'פָא', final: 'fe', needsRecording: true },
  { id: 'tsadi', char: 'צ', base: 'צ', name: 'צָדִי', sound: 'ts', say: 'צָה', finalForm: 'finalTsadi' },
  { id: 'finalTsadi', char: 'ץ', base: 'ץ', name: 'צָדִי סוֹפִית', sound: 'ts', say: 'צָה', final: 'tsadi' },
  { id: 'qof', char: 'ק', base: 'ק', name: 'קוֹף', sound: 'k', say: 'קָה' },
  { id: 'resh', char: 'ר', base: 'ר', name: 'רֵישׁ', sound: 'r', say: 'רָה' },
  { id: 'shin', char: 'שׁ', base: 'ש', name: 'שִׁין', sound: 'sh', say: 'שָׁא' },
  { id: 'sin', char: 'שׂ', base: 'ש', name: 'שִׂין', sound: 's', say: 'סָה' },
  { id: 'tav', char: 'ת', base: 'ת', name: 'תָּו', sound: 't', say: 'תָּא' },
].map((l) => ({ ...l, char: nfc(l.char), name: nfc(l.name), say: nfc(l.say) }));

export const LETTER: Record<string, LetterInfo> = Object.fromEntries(LETTERS.map((l) => [l.id, l]));
export const letterUnit = (id: string): string => 'L.' + id;

const SIMPLE_LETTER: Record<string, string> = {
  'א': 'alef', 'ג': 'gimel', 'ד': 'dalet', 'ה': 'he', 'ו': 'vav', 'ז': 'zayin', 'ח': 'het', 'ט': 'tet', 'י': 'yod', 'ך': 'finalKhaf',
  'ל': 'lamed', 'מ': 'mem', 'ם': 'finalMem', 'נ': 'nun', 'ן': 'finalNun', 'ס': 'samekh', 'ע': 'ayin', 'ף': 'finalFe', 'צ': 'tsadi',
  'ץ': 'finalTsadi', 'ק': 'qof', 'ר': 'resh', 'ת': 'tav',
};

/** Letter id of a cluster, resolving dagesh (ב כ פ) and shin/sin dots. */
export function letterIdOf(c: Cluster): string {
  switch (c.base) {
    case 'ב': return c.dagesh ? 'bet' : 'vet';
    case 'כ': return c.dagesh ? 'kaf' : 'khaf';
    case 'פ': return c.dagesh ? 'pe' : 'fe';
    case 'ש': return c.sinDot ? 'sin' : 'shin';
    default: return SIMPLE_LETTER[c.base];
  }
}

/** Visually similar letters (bare forms), used for hard distractors (SPEC §7.5). */
export const SIMILAR: Record<string, string[]> = {
  'א': ['ע', 'צ', 'ש', 'ט'], 'ב': ['כ', 'פ', 'ר', 'נ'], 'ג': ['נ', 'ז', 'ד'], 'ד': ['ר', 'ה', 'ך'], 'ה': ['ח', 'ת', 'ק'],
  'ו': ['ז', 'י', 'ן'], 'ז': ['ו', 'י', 'ן', 'ג'], 'ח': ['ה', 'ת'], 'ט': ['מ', 'ס', 'ש'], 'י': ['ו', 'ז'], 'כ': ['ב', 'פ', 'נ'],
  'ל': ['ק', 'ר'], 'מ': ['ט', 'ס', 'ם'], 'נ': ['ג', 'כ', 'ב'], 'ס': ['ם', 'ט', 'מ'], 'ע': ['צ', 'א', 'ש'], 'פ': ['כ', 'ב'],
  'צ': ['ע', 'א'], 'ק': ['ה', 'ל'], 'ר': ['ד', 'ך'], 'ש': ['ע', 'ט', 'צ'], 'ת': ['ח', 'ה'], 'ך': ['ד', 'ר'], 'ם': ['ס', 'מ'],
  'ן': ['ו', 'ז'], 'ף': ['ך'], 'ץ': ['צ'],
};

/* ------------------------------------------------------------------ vowels */

export type VowelId = 'a' | 'i' | 'e' | 'o' | 'u';
export interface SignInfo { id: string; vowel: VowelId; name: string; mark: string; /* written after the letter */ }

const SIGN_ROWS: SignInfo[] = [
  { id: 'qamats', vowel: 'a', name: 'קָמָץ', mark: MARK.qamats },
  { id: 'patah', vowel: 'a', name: 'פַּתָּח', mark: MARK.patah },
  { id: 'hiriq', vowel: 'i', name: 'חִירִיק', mark: MARK.hiriq },
  { id: 'hiriqMale', vowel: 'i', name: 'חִירִיק מָלֵא', mark: MARK.hiriq + 'י' },
  { id: 'tsere', vowel: 'e', name: 'צֵירֵה', mark: MARK.tsere },
  { id: 'segol', vowel: 'e', name: 'סֶגּוֹל', mark: MARK.segol },
  { id: 'holamMale', vowel: 'o', name: 'חוֹלָם מָלֵא', mark: 'ו' + MARK.holam },
  { id: 'holam', vowel: 'o', name: 'חוֹלָם חָסֵר', mark: MARK.holam },
  { id: 'shuruk', vowel: 'u', name: 'שׁוּרוּק', mark: 'ו' + MARK.dagesh },
  { id: 'qubuts', vowel: 'u', name: 'קֻבּוּץ', mark: MARK.qubuts },
];
export const SIGNS: SignInfo[] = SIGN_ROWS.map((s) => ({ ...s, name: nfc(s.name) }));
export const SIGN: Record<string, SignInfo> = Object.fromEntries(SIGNS.map((s) => [s.id, s]));

export interface VowelInfo { id: VowelId; name: string; signs: string[]; sayAlone: string }
const VOWEL_ROWS: VowelInfo[] = [
  { id: 'a', name: 'קָמָץ וּפַתָּח', signs: ['qamats', 'patah'], sayAlone: 'אָה' },
  { id: 'i', name: 'חִירִיק', signs: ['hiriq', 'hiriqMale'], sayAlone: 'אִי' },
  { id: 'e', name: 'צֵירֵה וְסֶגּוֹל', signs: ['tsere', 'segol'], sayAlone: 'אֶה' },
  { id: 'o', name: 'חוֹלָם', signs: ['holamMale', 'holam'], sayAlone: 'אוֹ' },
  { id: 'u', name: 'שׁוּרוּק וְקֻבּוּץ', signs: ['shuruk', 'qubuts'], sayAlone: 'אוּ' },
];
export const VOWELS: VowelInfo[] = VOWEL_ROWS.map((v) => ({ ...v, name: nfc(v.name), sayAlone: nfc(v.sayAlone) }));
export const VOWEL: Record<string, VowelInfo> = Object.fromEntries(VOWELS.map((v) => [v.id, v]));
export const vowelUnit = (v: VowelId): string => 'V.' + v;

const VOWEL_SOUND: Partial<Record<VowelMark, VowelId>> = {
  qamats: 'a', patah: 'a', hatafPatah: 'a', hiriq: 'i', tsere: 'e', segol: 'e', hatafSegol: 'e', holam: 'o', hatafQamats: 'o', qubuts: 'u',
  qamatsQatan: 'o',
};
/** Vowel sound of a cluster's vowel mark (undefined for no vowel / shva). */
export const vowelOfMark = (m: VowelMark | null): VowelId | undefined => (m ? VOWEL_SOUND[m] : undefined);

/** Written צירוף: letter + sign (NFC). */
export function cvText(letterId: string, signId: string): string {
  return nfc(LETTER[letterId].char + SIGN[signId].mark);
}

/** Speakable form of a צירוף (§3.3): a trailing quiet letter makes TTS say a clean syllable. */
export function cvSay(letterId: string, vowel: VowelId): string {
  const l = LETTER[letterId];
  // Speak fricatives through their sound twin so TTS cannot read ב/כ/שׂ as בּ/כּ/שׁ.
  const twin: Record<string, string> = { vet: 'ו', khaf: 'ח', sin: 'ס' };
  // /a/ syllables that are also common words with another sound (זה "ze", כה "ko", פה "po", שה "se", תה "te"):
  // the letter's own sound form (זָא, קָה, פָּא, פָא, שָׁא, תָּא) cannot be read as that word.
  if (vowel === 'a' && ['zayin', 'kaf', 'pe', 'fe', 'shin', 'tav'].includes(l.id)) return l.say;
  const head = twin[l.id] ?? l.char;
  const tail: Record<VowelId, string> = { a: MARK.qamats + 'ה', i: MARK.hiriq + 'י', e: MARK.segol + 'ה', o: 'ו' + MARK.holam, u: 'ו' + MARK.dagesh };
  return nfc(head + tail[vowel]);
}

/* ------------------------------------------------------------------ word analysis */

export interface Analysis {
  units: string[];        // sorted unique units (§3.1)
  letters: string[];      // letter ids pronounced as consonants
  vowels: VowelId[];      // vowel sounds in order
  firstSound: string;     // sound class of the first consonant
  firstLetter: string;    // letter id of the first consonant
  lastLetter: string;     // letter id of the last letter
  endsWithFinal: boolean;
}

/** Derive units and features of one pointed word. `katan` = hand-tagged qamats qatan (cannot be detected). */
export function analyzeWord(word: string, katan = false): Analysis {
  const cs = clusters(word);
  const units = new Set<string>();
  const letters: string[] = [];
  const vowels: VowelId[] = [];
  const addVowel = (v: VowelId) => { vowels.push(v); units.add(vowelUnit(v)); };
  let prevHasVowel = false; // previous pronounced cluster carried a vowel (for matres lectionis)

  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const isLast = i === cs.length - 1;
    const prev = cs[i - 1];
    // וּ shuruk / וֹ holam male: the vav is the vowel of the previous (vowel-less) consonant, or of nothing at word start.
    if (c.base === 'ו' && !c.holamOnVav) {
      const prevBare = !prev || prev.vowel === null;
      if (c.dagesh && c.vowel === null && prevBare) { addVowel('u'); prevHasVowel = true; continue; }
      if (c.vowel === 'holam' && prevBare && prev) { addVowel('o'); prevHasVowel = true; continue; }
    }
    // יִ… י after hiriq/tsere/segol without its own vowel = vowel letter (hiriq male, tsere male).
    if (c.base === 'י' && c.vowel === null && !c.dagesh && prev && (prev.vowel === 'hiriq' || prev.vowel === 'tsere' || prev.vowel === 'segol')) {
      continue;
    }
    // Quiet letters: א without vowel after a vowel (unless it carries a following וּ/וֹ, as in זָאוּר); ה at the word end.
    const next = cs[i + 1];
    const carriesVav = !!next && next.base === 'ו' && !next.holamOnVav && ((next.dagesh && next.vowel === null) || next.vowel === 'holam');
    if (c.vowel === null && prevHasVowel && ((c.base === 'א' && !carriesVav) || (c.base === 'ה' && isLast && !c.dagesh))) {
      units.add('X.quiet');
      units.add(letterUnit(c.base === 'א' ? 'alef' : 'he'));
      continue;
    }

    const lid = letterIdOf(c);
    letters.push(lid);
    units.add(letterUnit(lid));
    if (c.vowel === null) { prevHasVowel = false; continue; }

    if (c.vowel === 'sheva') {
      // shva under a final letter (מֶלֶךְ, אַתְּ) is silent by convention and not taught as a unit
      if (!isLast) units.add('V.shva');
      prevHasVowel = false;
      continue;
    }
    if (c.vowel === 'hatafPatah' || c.vowel === 'hatafSegol' || c.vowel === 'hatafQamats') units.add('V.hataf');
    if (c.vowel === 'qamatsQatan') units.add('X.katan');
    // פתח גנובה: patah under a final ח / ע / הּ after a vowel
    if (isLast && c.vowel === 'patah' && (c.base === 'ח' || c.base === 'ע' || (c.base === 'ה' && c.dagesh)) && prevHasVowel) {
      units.add('X.genuva');
    }
    const v = VOWEL_SOUND[c.vowel];
    if (v) addVowel(v);
    prevHasVowel = true;
  }
  if (katan) units.add('X.katan');

  const first = letters[0] ?? '';
  const lastCluster = cs[cs.length - 1];
  const last = lastCluster ? letterIdOf(lastCluster) : '';
  return {
    units: [...units].sort(),
    letters,
    vowels,
    firstSound: first ? LETTER[first].sound : '',
    firstLetter: first,
    lastLetter: last,
    endsWithFinal: !!LETTER[last]?.final,
  };
}

/** Indices of the clusters read as consonants (not a vowel letter such as וּ / וֹ / the י of חִירִיק מָלֵא, and not a quiet
    א / ה). Same rules as analyzeWord. The Missing Letter hides only these. */
export function consonantIndices(word: string): number[] {
  const cs = clusters(word);
  const out: number[] = [];
  let prevHasVowel = false;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], prev = cs[i - 1], next = cs[i + 1], isLast = i === cs.length - 1;
    if (c.base === 'ו' && !c.holamOnVav) {
      const prevBare = !prev || prev.vowel === null;
      if (c.dagesh && c.vowel === null && prevBare) { prevHasVowel = true; continue; }
      if (c.vowel === 'holam' && prevBare && prev) { prevHasVowel = true; continue; }
    }
    if (c.base === 'י' && c.vowel === null && !c.dagesh && prev && (prev.vowel === 'hiriq' || prev.vowel === 'tsere' || prev.vowel === 'segol')) continue;
    const carriesVav = !!next && next.base === 'ו' && !next.holamOnVav && ((next.dagesh && next.vowel === null) || next.vowel === 'holam');
    if (c.vowel === null && prevHasVowel && ((c.base === 'א' && !carriesVav) || (c.base === 'ה' && isLast && !c.dagesh))) continue;
    out.push(i);
    prevHasVowel = c.vowel !== null && c.vowel !== 'sheva';
  }
  return out;
}

/** Units of a whole text (sentence/story), word by word. */
export function textWords(text: string): string[] {
  return nfc(text).split(/[\s\u05BE\-]+/).map((w) => w.replace(/[^\u0591-\u05C7\u05D0-\u05EA]/g, '')).filter(Boolean);
}

/* ------------------------------------------------------------------ nikud lint (SPEC R-H9) */

const BGDKPT = 'בגדכפת';
const GUTTURAL = 'אהחע';
const SHORT: (VowelMark | null)[] = ['patah', 'segol', 'qubuts', 'qamatsQatan', 'hiriq'];
const vowelCount = (c: Cluster): number => [...c.raw].filter((ch) => VOWEL_OF[ch]).length;
const isVavVowel = (c: Cluster | undefined): boolean =>
  !!c && c.base === 'ו' && !c.holamOnVav && ((c.dagesh && c.vowel === null) || c.vowel === 'holam');
const soundsVowel = (c: Cluster | undefined): boolean =>
  !!c && ((c.vowel !== null && c.vowel !== 'sheva') || (c.base === 'ו' && c.dagesh && c.vowel === null));

/** Mechanical pointing checks for one word. They catch typos (a missing vowel, dagesh or dot), not wrong vowel choices. */
export function lintWord(word: string): string[] {
  const out: string[] = [];
  const cs = clusters(word);
  const last = cs.length - 1;
  if (!cs.length) return out;
  if (!cs.some((c) => c.vowel !== null || c.dagesh)) out.push('no nikud');
  cs.forEach((c, i) => {
    const prev = cs[i - 1], next = cs[i + 1];
    if (vowelCount(c) > 1) out.push(`two vowels on ${c.base}`);
    if (c.base === 'ש' && !c.shinDot && !c.sinDot) out.push('ש without shin/sin dot');
    if (c.dagesh && 'אחער'.includes(c.base)) out.push(`dagesh in ${c.base}`);
    if (c.dagesh && c.base === 'ה' && i !== last) out.push('dagesh in ה inside a word');
    if (c.vowel?.startsWith('hataf') && !GUTTURAL.includes(c.base)) out.push(`hataf under ${c.base}`);
    if (i < last && 'ךםןףץ'.includes(c.base)) out.push(`final ${c.base} inside the word`);
    if (i === last && cs.length > 1 && 'כמנפצ'.includes(c.base)) out.push(`regular ${c.base} at the end`);
    if (i === 0 && BGDKPT.includes(c.base) && !c.dagesh) out.push(`word-initial ${c.base} without dagesh`);
    if (i === last && c.vowel === 'sheva' && !'ךת'.includes(c.base)) out.push(`final shva under ${c.base}`);
    if (i === last && c.base === 'ך' && c.vowel !== 'sheva' && c.vowel !== 'qamats') out.push('final ך without shva or qamats');
    // A consonant inside the word needs a vowel or shva, unless it is a vowel letter or a following וּ/וֹ carries its vowel.
    if (i < last && c.vowel === null) {
      const materYod = c.base === 'י' && !c.dagesh && !!prev && (prev.vowel === 'hiriq' || prev.vowel === 'tsere' || prev.vowel === 'segol');
      const suffixYod = c.base === 'י' && prev?.vowel === 'qamats' && i === last - 1 && next.base === 'ו' && next.vowel === null; // ־ָיו
      const quietAlef = c.base === 'א' && soundsVowel(prev);
      const vowelVav = c.base === 'ו' && c.dagesh && !c.holamOnVav;
      if (!(materYod || suffixYod || quietAlef || vowelVav || isVavVowel(next))) out.push(`${c.base} has no vowel`);
    }
    // After a closed syllable (short vowel + shva nach) ב ג ד כ פ ת take dagesh kal.
    if (i > 0 && i < last && c.vowel === 'sheva' && !c.dagesh && SHORT.includes(prev.vowel) && BGDKPT.includes(next.base) && !next.dagesh) {
      out.push(`${next.base} after a closed syllable without dagesh`);
    }
  });
  return out;
}

/** Lint a whole text; returns "word: problem" strings. `ok` = words checked by hand and allowed to break a rule. */
export function lintText(text: string, ok: ReadonlySet<string> = new Set()): string[] {
  return textWords(text).flatMap((w) => (ok.has(w) ? [] : lintWord(w).map((p) => `${w}: ${p}`)));
}

/** Remove all nikud (keeps letters): for the unpointed bridge and for matching. */
export const stripNikud = (s: string): string => nfc(s).replace(/[\u0591-\u05C7]/g, '');

/** Same sound class? (R-H2) */
export const sameSound = (a: string, b: string): boolean => LETTER[a] && LETTER[b] ? LETTER[a].sound === LETTER[b].sound : a === b;
