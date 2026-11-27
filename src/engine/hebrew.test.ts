import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWord, cvSay, cvText, lintWord, nfc, sameSound, LETTERS } from './hebrew.ts';
import { BUTZ, BUTZ_SAY } from './phrases.ts';
import { validateContent } from './validate.ts';
import { WORDS, WORD } from './content/words.ts';
import { speakSyllable } from './generators.ts';
import { allSpokenTexts } from './spoken.ts';
import { GAMES } from './curriculum.ts';

const units = (w: string) => analyzeWord(w).units;

test('units: simple CVC word', () => {
  assert.deepEqual(units('דָּג'), ['L.dalet', 'L.gimel', 'V.a']);
});

test('units: quiet final ה and א (X.quiet + the letter)', () => {
  assert.deepEqual(units('פָּרָה'), ['L.he', 'L.pe', 'L.resh', 'V.a', 'X.quiet']);
  assert.ok(units('סַבָּא').includes('X.quiet'));
  assert.ok(units('סַבָּא').includes('L.alef'));
});

test('units: holam male / shuruk are vowels, not the letter vav', () => {
  assert.deepEqual(units('אוֹר'), ['L.alef', 'L.resh', 'V.o']);
  assert.ok(!units('סוּס').includes('L.vav'));
  assert.ok(units('סוּס').includes('V.u'));
  assert.ok(units('טַוָּס').includes('L.vav'), 'vav with dagesh and a vowel is a consonant');
});

test('units: hiriq male / tsere male yod is not a consonant; yod with a vowel is', () => {
  assert.ok(!units('פִּיל').includes('L.yod'));
  assert.ok(!units('בֵּיצָה').includes('L.yod'));
  assert.ok(units('בַּיִת').includes('L.yod'));
});

test('units: alef carrying shuruk is not quiet', () => {
  const u = units('דִּינוֹזָאוּר');
  assert.ok(u.includes('L.alef'));
  assert.ok(!u.includes('X.quiet'));
});

test('units: dagesh and dots pick the letter variant', () => {
  assert.deepEqual(units('כּוֹכָב').filter((u) => u.startsWith('L.')), ['L.kaf', 'L.khaf', 'L.vet']);
  assert.ok(units('שִׂמְלָה').includes('L.sin'));
  assert.ok(units('שֶׁמֶשׁ').includes('L.shin'));
});

test('units: shva, final-letter shva, hataf, genuva', () => {
  assert.ok(units('סַבְתָּא').includes('V.shva'));
  assert.ok(!units('מֶלֶךְ').includes('V.shva'), 'shva under final kaf is not taught');
  assert.ok(units('מֶלֶךְ').includes('L.finalKhaf'));
  assert.ok(units('אֲבַטִּיחַ').includes('V.hataf'));
  assert.ok(units('תַּפּוּחַ').includes('X.genuva'));
});

test('speakable forms (§3.3)', () => {
  assert.equal(cvSay('mem', 'a'), nfc('מָה'));
  assert.equal(cvSay('vet', 'a'), nfc('וָה'), 'fricative ב is spoken through its twin');
  assert.equal(cvSay('lamed', 'i'), nfc('לִי'));
  assert.equal(cvSay('bet', 'o'), nfc('בּוֹ'));
  assert.equal(cvText('bet', 'qamats'), nfc('בָּ'));
  assert.equal(speakSyllable(nfc('בָּ')), nfc('בָּה'));
  assert.equal(speakSyllable(nfc('נָה')), nfc('נָה'));
  assert.equal(speakSyllable(nfc('קֻ')), nfc('קוּ'));
});

test('speakable forms never spell a common word with another sound (זה כה פה שה תה)', () => {
  const unpointed = (s: string) => s.replace(/[\u0591-\u05C7]/g, '');
  for (const id of ['zayin', 'kaf', 'pe', 'fe', 'shin', 'tav']) {
    const l = LETTERS.find((x) => x.id === id)!;
    for (const s of [l.say, cvSay(id, 'a')]) assert.ok(!['זה', 'כה', 'פה', 'שה', 'תה'].includes(unpointed(s)), `${id}: ${s}`);
  }
  assert.equal(cvSay('zayin', 'a'), nfc('זָא'));
  assert.equal(cvSay('tav', 'a'), nfc('תָּא'));
  assert.equal(speakSyllable(nfc('זָ')), nfc('זָא'), 'one-letter syllables in word games use the same forms');
  assert.equal(speakSyllable(nfc('תָּ')), nfc('תָּא'));
});

test('the audio inventory lists every spoken line once, NFC, without placeholders', () => {
  const all = allSpokenTexts();
  const texts = new Set(all.map((s) => s.text));
  assert.equal(texts.size, all.length);
  assert.ok(all.length > 2000, String(all.length));
  for (const l of LETTERS) assert.ok(texts.has(l.say) && texts.has(l.name), l.id);
  // v1.3: game instructions are written on screen, not spoken
  for (const g of GAMES) assert.ok(texts.has(g.name) && !g.mission.some((m) => texts.has(m)), g.id);
  assert.ok(texts.has(BUTZ));
  assert.ok(all.every((s) => s.text === s.text.normalize('NFC') && !s.text.includes('#')));
});

test('sound classes (R-H2)', () => {
  assert.ok(sameSound('tet', 'tav'));
  assert.ok(sameSound('kaf', 'qof'));
  assert.ok(sameSound('alef', 'ayin'));
  assert.ok(sameSound('vet', 'vav'));
  assert.ok(!sameSound('bet', 'vet'));
  for (const l of LETTERS) assert.ok(l.say && l.name && l.char, l.id);
});

test('content invariants hold (R-H1..R-H9)', () => {
  assert.deepEqual(validateContent(), []);
});

test('nikud lint catches typical pointing typos', () => {
  const bad = (w: string) => lintWord(nfc(w));
  assert.deepEqual(bad('סַבְתָּא'), [], 'correct word passes');
  assert.deepEqual(bad('עַכְשָׁיו'), [], 'the ־ָיו suffix is fine');
  assert.deepEqual(bad('בּוֹאוּ'), [], 'alef carried by shuruk is fine');
  assert.ok(bad('דג').includes('no nikud'));
  assert.ok(bad('שָלוֹם').some((p) => p.includes('shin/sin dot')));
  assert.ok(bad('סַבְתָא').some((p) => p.includes('closed syllable')), 'missing dagesh kal after shva nach');
  assert.ok(bad('גַמָל').some((p) => p.includes('word-initial')), 'missing initial dagesh');
  assert.ok(bad('מֶלֶך').some((p) => p.includes('final ך')));
  assert.ok(bad('כֶּלֶבְ').some((p) => p.includes('final shva')));
  assert.ok(bad('תַפּוּחַ').some((p) => p.includes('word-initial')));
  assert.ok(bad('אַרנָב').some((p) => p.includes('no vowel')), 'missing shva');
  assert.deepEqual(bad('דָּגִים'), []);
  assert.ok(bad('יְלָדִימ').some((p) => p.includes('regular מ')), 'regular letter at the end');
  assert.ok(bad('שָׁםלוֹם').some((p) => p.includes('final ם')), 'final letter inside a word');
  assert.ok(bad('בְּנִֵי').some((p) => p.includes('two vowels')));
  assert.ok(bad('חָבֲר').some((p) => p.includes('hataf')), 'hataf under a non-guttural');
});

test('mascot name is spoken with shuruk (Butz), never as botz', () => {
  assert.equal(BUTZ, nfc('בּוּץ'));
  assert.ok(!BUTZ_SAY.includes('\u05B9'), 'no holam in the spoken form');
  assert.ok(BUTZ_SAY.includes('\u05D5\u05BC'), 'shuruk in the spoken form');
});

test('word metadata', () => {
  assert.equal(WORD.banana.level, 'W3');
  assert.equal(WORD.dag.firstSound, 'd');
  assert.ok(WORD.yam.endsWithFinal);
  assert.ok(WORDS.every((w) => w.review === 'checked' || w.review === 'reviewed'));
  assert.ok(WORDS.length >= 320, 'large word bank');
});
