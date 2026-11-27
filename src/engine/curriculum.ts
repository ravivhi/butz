/* Curriculum data (SPEC §5-§6, §9): skills, the game registry and map order, and the introduction spine. Pure data. */
import { LETTER, LETTERS, VOWELS, nfc } from './hebrew.ts';
import { g, type G2 } from './phrases.ts';

export type GameId =
  | 'storyDetective' | 'storyPuzzle'
  | 'syllableHop'
  | 'balloonPop' | 'memoryMatch'
  | 'letterTrace'
  | 'wordBakery' | 'missingLetter';

export type Strand = 'sounds' | 'letters' | 'nikud' | 'blending' | 'read';

export interface SkillDef { id: string; strand: Strand; label: string; /* parent-facing, Hebrew */ }

const S = (id: string, strand: Strand, label: string): SkillDef => ({ id, strand, label });
export const SKILLS: SkillDef[] = [
  S('PA.count', 'sounds', 'סְפִירַת הֲבָרוֹת'),
  ...LETTERS.map((l) => S('L.' + l.id, 'letters', l.char)),
  S('WRITE', 'letters', 'כְּתִיבַת אוֹתִיּוֹת'),
  ...VOWELS.map((v) => S('V.' + v.id, 'nikud', v.name)),
  S('V.shva', 'nikud', 'שְׁוָא'),
  S('V.hataf', 'nikud', 'חֲטָפִים'),
  S('X.quiet', 'blending', 'אוֹתִיּוֹת שְׁקֵטוֹת'),
  S('X.genuva', 'blending', 'פַּתָּח גְּנוּבָה'),
  S('W2', 'blending', 'מִלִּים שֶׁל שְׁתֵּי הֲבָרוֹת'),
  S('W3', 'blending', 'מִלִּים אֲרֻכּוֹת'),
  S('COMP.seq', 'read', 'סֵדֶר אֵרוּעִים'),
  S('COMP.read', 'read', 'הֲבָנַת הַנִּקְרָא'),
].map((s) => ({ ...s, label: nfc(s.label) }));
export const SKILL: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const STRANDS: { id: Strand; label: string }[] = [
  { id: 'sounds', label: 'צְלִילִים וַהֲבָרוֹת' },
  { id: 'letters', label: 'אוֹתִיּוֹת וּצְלִילִים' },
  { id: 'nikud', label: 'נִקּוּד' },
  { id: 'blending', label: 'קְרִיאַת מִלִּים' },
  { id: 'read', label: 'הֲבָנַת הַנִּקְרָא' },
].map((s) => ({ ...s, id: s.id as Strand, label: nfc(s.label) }));

export type Mechanic = 'findTap' | 'build' | 'count' | 'sequence' | 'story' | 'trace' | 'memory';

export interface GameDef {
  id: GameId;
  color: string;       // its place on the map
  name: string;        // shown (pointed)
  icon: string;
  mechanic: Mechanic;
  skills: string[];    // exact ids or prefix patterns ending with '*'
  mission: readonly [string, string]; // written instruction shown in the game, [boy, girl] (v1.3: printed, never spoken)
  items: number;       // items per activity
  pick?: boolean;      // free play starts with a letter picker (the child chooses the letters)
}

const G = (id: GameId, color: string, name: string, icon: string, mechanic: Mechanic, skills: string[], mission: G2, items = 5, pick = false): GameDef =>
  ({ id, color, name: nfc(name), icon, mechanic, skills, mission: [g(mission, 'boy'), g(mission, 'girl')], items, pick });

/** The child reads every story alone. The Story Detective then asks questions; the Story Puzzle puts the events in order. */
export const GAMES: GameDef[] = [
  G('storyDetective', '#FFCA28', 'בַּלַּשׁ הַסִּפּוּרִים', '🕵️', 'story', ['COMP.read'], ['קְרָא אֶת הַסִּפּוּר לְבַד, וַעֲנֵה עַל שְׁאֵלוֹת שֶׁל בַּלָּשִׁים: מִי? מָה? כַּמָּה? לָמָּה? בְּכָל שְׁאֵלָה אֶפְשָׁר לַחֲזֹר לַסִּפּוּר 📖.', 'קִרְאִי אֶת הַסִּפּוּר לְבַד, וַעֲנִי עַל שְׁאֵלוֹת שֶׁל בַּלָּשִׁים: מִי? מָה? כַּמָּה? לָמָּה? בְּכָל שְׁאֵלָה אֶפְשָׁר לַחֲזֹר לַסִּפּוּר 📖.'], 1),
  G('storyPuzzle', '#FFB300', 'פָּאזֶל הַסִּפּוּר', '🧩', 'sequence', ['COMP.seq'], ['קְרָא אֶת הַסִּפּוּר לְבַד. אַחַר כָּךְ סַדֵּר אֶת הַמִּשְׁפָּטִים לְפִי מָה שֶׁקָּרָה קֹדֶם. אֶפְשָׁר לַחֲזֹר לַסִּפּוּר 📖.', 'קִרְאִי אֶת הַסִּפּוּר לְבַד. אַחַר כָּךְ סַדְּרִי אֶת הַמִּשְׁפָּטִים לְפִי מָה שֶׁקָּרָה קֹדֶם. אֶפְשָׁר לַחֲזֹר לַסִּפּוּר 📖.'], 1),
  G('syllableHop', '#43A047', 'קְפִיצַת הֲבָרוֹת', '🐸', 'count', ['PA.count'], ['כַּמָּה הֲבָרוֹת יֵשׁ בַּמִּלָּה שֶׁל הַתְּמוּנָה? אֶפְשָׁר לִשְׁמֹעַ אוֹתָהּ 🔊. הוֹסֵף אֶבֶן 🪨 לְכָל הֲבָרָה, וּלְחַץ עַל הַצְּפַרְדֵּעַ 🐸.', 'כַּמָּה הֲבָרוֹת יֵשׁ בַּמִּלָּה שֶׁל הַתְּמוּנָה? אֶפְשָׁר לִשְׁמֹעַ אוֹתָהּ 🔊. הוֹסִיפִי אֶבֶן 🪨 לְכָל הֲבָרָה, וְלַחֲצִי עַל הַצְּפַרְדֵּעַ 🐸.']),
  G('balloonPop', '#8E24AA', 'בָּלוֹנֵי אוֹתִיּוֹת', '🎈', 'findTap', ['L.*'], ['הָאוֹת לְמַעְלָה כְּתוּבָה בִּדְפוּס. פּוֹצֵץ אֶת כָּל הַבָּלוֹנִים שֶׁעֲלֵיהֶם הִיא כְּתוּבָה בִּכְתַב יָד ✍️.', 'הָאוֹת לְמַעְלָה כְּתוּבָה בִּדְפוּס. פּוֹצְצִי אֶת כָּל הַבָּלוֹנִים שֶׁעֲלֵיהֶם הִיא כְּתוּבָה בִּכְתַב יָד ✍️.'], 3, true),
  G('memoryMatch', '#00ACC1', 'זוּגוֹת שֶׁל אוֹתִיּוֹת', '🃏', 'memory', ['L.*'], ['הָפֹךְ שְׁנֵי קְלָפִים. מְצָא זוּג: אוֹת בִּכְתַב יָד ✍️ וּתְמוּנָה שֶׁמַּתְחִילָה בָּהּ.', 'הִפְכִי שְׁנֵי קְלָפִים. מִצְאִי זוּג: אוֹת בִּכְתַב יָד ✍️ וּתְמוּנָה שֶׁמַּתְחִילָה בָּהּ.'], 2),
  G('letterTrace', '#5C6BC0', 'כּוֹתְבִים אוֹתִיּוֹת', '✍️', 'trace', ['WRITE'], ['כְּתֹב אֶת הָאוֹת עִם הָאֶצְבַּע: מַתְחִילִים בַּנְּקֻדָּה הָאֲדֻמָּה וְהוֹלְכִים לְאֹרֶךְ הַקַּו. קֹדֶם בִּדְפוּס, אַחַר כָּךְ בִּכְתַב יָד.', 'כִּתְבִי אֶת הָאוֹת עִם הָאֶצְבַּע: מַתְחִילִים בַּנְּקֻדָּה הָאֲדֻמָּה וְהוֹלְכִים לְאֹרֶךְ הַקַּו. קֹדֶם בִּדְפוּס, אַחַר כָּךְ בִּכְתַב יָד.'], 4, true),
  G('wordBakery', '#F4511E', 'מַאֲפִיַּת הַמִּלִּים', '🧁', 'build', ['W2', 'W3', 'V.*', 'X.quiet', 'X.genuva'], ['בּוּץ הִזְמִין עוּגָה בְּצוּרַת מִלָּה! הִסְתַּכֵּל בַּתְּמוּנָה, וְסַדֵּר אֶת הַהֲבָרוֹת לְפִי הַסֵּדֶר.', 'בּוּץ הִזְמִין עוּגָה בְּצוּרַת מִלָּה! הִסְתַּכְּלִי בַּתְּמוּנָה, וְסַדְּרִי אֶת הַהֲבָרוֹת לְפִי הַסֵּדֶר.'], 4),
  G('missingLetter', '#E53935', 'הָאוֹת הַחֲסֵרָה', '❓', 'build', ['L.*'], ['אֵילוּ אוֹתִיּוֹת חֲסֵרוֹת בַּמִּלָּה? הִסְתַּכֵּל בַּתְּמוּנָה, וּבְחַר אוֹת לְכָל רִבּוּעַ רֵיק.', 'אֵילוּ אוֹתִיּוֹת חֲסֵרוֹת בַּמִּלָּה? הִסְתַּכְּלִי בַּתְּמוּנָה, וּבַחֲרִי אוֹת לְכָל רִבּוּעַ רֵיק.'], 4),
];
export const GAME: Record<string, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g]));

/** The map, in learning order: syllables, letters and their sounds, print and cursive, writing, words, then stories. */
export const MAP_ORDER: GameId[] = ['syllableHop', 'memoryMatch', 'balloonPop', 'letterTrace', 'missingLetter', 'wordBakery', 'storyDetective', 'storyPuzzle'];
/** The best games (reading whole stories): golden on the map, more stars and a golden envelope for a story understood. */
export const GOLDEN_GAMES = new Set<GameId>(['storyDetective', 'storyPuzzle']);

export const gameServes = (g: GameDef, skill: string): boolean =>
  g.skills.some((p) => (p.endsWith('*') ? skill.startsWith(p.slice(0, -1)) : p === skill));
export const gamesFor = (skill: string): GameDef[] => GAMES.filter((g) => gameServes(g, skill));

/** Introduction order (SPEC §5.1). Units only: higher skills (W2, W3…) become available automatically (gating.ts). */
export const DEFAULT_SPINE: string[] = [
  'L.mem', 'L.lamed', 'L.dalet', 'L.gimel',
  'V.a',
  'L.yod', 'L.resh', 'L.qof', 'L.finalMem',
  'L.he', 'L.het', 'L.nun', 'L.finalNun',
  'V.i',
  'L.shin', 'L.bet', 'L.vet', 'L.samekh',
  'V.e',
  'L.tav', 'L.pe', 'L.alef', 'X.quiet',
  'V.o',
  'L.kaf', 'L.ayin', 'L.tsadi', 'L.finalTsadi',
  'V.u',
  'L.zayin', 'L.tet', 'L.vav', 'L.khaf', 'L.finalKhaf',
  'L.fe', 'L.finalFe', 'L.sin',
  'V.shva',
  'V.hataf', 'X.genuva',
];

export const isUnit = (id: string): boolean => /^(L|V|X)\./.test(id);
export const isLetterSkill = (id: string): boolean => id.startsWith('L.');
export const letterOfSkill = (id: string) => LETTER[id.slice(2)];
