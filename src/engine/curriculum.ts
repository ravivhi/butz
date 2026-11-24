/* Curriculum data (SPEC §5-§6, §9): skills, worlds, the game registry and the introduction spine. Pure data. */
import { LETTER, LETTERS, VOWELS, nfc } from './hebrew.ts';
import { g, type G2 } from './phrases.ts';

export type WorldId = 'forest' | 'island' | 'workshop' | 'train' | 'mountain' | 'museum' | 'theatre' | 'kingdom' | 'storytime';
export type GameId =
  | 'soundSafari' | 'syllableHop' | 'robotMixer'
  | 'soundLighthouse' | 'letterDetective'
  | 'nikudMagnet' | 'syllableDJ' | 'secretPassword'
  | 'syllableTrain' | 'wordBakery' | 'wordExplorer'
  | 'finalTransformer' | 'wordCollector'
  | 'echoReader' | 'phraseTrain'
  | 'storyPuzzle' | 'storyDetective' | 'storyTime';

export type Strand = 'sounds' | 'letters' | 'nikud' | 'blending' | 'sight' | 'fluency' | 'listen' | 'read';

export interface SkillDef { id: string; strand: Strand; label: string; /* parent-facing, Hebrew */ }

const S = (id: string, strand: Strand, label: string): SkillDef => ({ id, strand, label });
export const SKILLS: SkillDef[] = [
  S('PA.first', 'sounds', 'צְלִיל פּוֹתֵחַ'),
  S('PA.count', 'sounds', 'סְפִירַת הֲבָרוֹת'),
  S('PA.blend', 'sounds', 'חִבּוּר הֲבָרוֹת'),
  ...LETTERS.map((l) => S('L.' + l.id, 'letters', l.char)),
  ...VOWELS.map((v) => S('V.' + v.id, 'nikud', v.name)),
  S('V.shva', 'nikud', nfc('שְׁוָא')),
  S('V.hataf', 'nikud', nfc('חֲטָפִים')),
  S('CV', 'nikud', nfc('קְרִיאַת צֵרוּפִים')),
  S('X.quiet', 'blending', nfc('אוֹתִיּוֹת שְׁקֵטוֹת')),
  S('X.genuva', 'blending', nfc('פַּתָּח גְּנוּבָה')),
  S('W1', 'blending', nfc('מִלִּים שֶׁל הֲבָרָה אַחַת')),
  S('W2', 'blending', nfc('מִלִּים שֶׁל שְׁתֵּי הֲבָרוֹת')),
  S('W3', 'blending', nfc('מִלִּים אֲרֻכּוֹת')),
  S('FIN', 'blending', nfc('אוֹתִיּוֹת סוֹפִיּוֹת בְּמִלִּים')),
  S('SIGHT', 'sight', nfc('מִלִּים שְׁכִיחוֹת')),
  S('FLU.phrase', 'fluency', nfc('קְרִיאָה בְּצֵרוּפֵי מִלִּים')),
  S('FLU.sentence', 'fluency', nfc('קְרִיאַת מִשְׁפָּטִים')),
  S('COMP.listen', 'listen', nfc('הֲבָנַת הַנִּשְׁמָע')),
  S('COMP.seq', 'read', nfc('סֵדֶר אֵרוּעִים')),
  S('COMP.read', 'read', nfc('הֲבָנַת הַנִּקְרָא')),
].map((s) => ({ ...s, label: nfc(s.label) }));
export const SKILL: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const STRANDS: { id: Strand; label: string }[] = [
  { id: 'sounds', label: 'צְלִילִים וַהֲבָרוֹת' },
  { id: 'letters', label: 'אוֹתִיּוֹת וּצְלִילִים' },
  { id: 'nikud', label: 'נִקּוּד וְצֵרוּפִים' },
  { id: 'blending', label: 'קְרִיאַת מִלִּים' },
  { id: 'sight', label: 'מִלִּים שְׁכִיחוֹת' },
  { id: 'fluency', label: 'שֶׁטֶף קְרִיאָה' },
  { id: 'listen', label: 'הֲבָנַת הַנִּשְׁמָע' },
  { id: 'read', label: 'הֲבָנַת הַנִּקְרָא' },
].map((s) => ({ ...s, id: s.id as Strand, label: nfc(s.label) }));

export interface WorldDef { id: WorldId; name: string; emoji: string; color: string; games: GameId[] }
export const WORLDS: WorldDef[] = [
  { id: 'forest', name: 'יַעַר הַצְּלִילִים', emoji: '🌳', color: '#43A047', games: ['soundSafari', 'syllableHop', 'robotMixer'] },
  { id: 'island', name: 'אִי הָאוֹתִיּוֹת', emoji: '🏝️', color: '#00ACC1', games: ['soundLighthouse', 'letterDetective'] },
  { id: 'workshop', name: 'סַדְנַת הַנִּקּוּד', emoji: '🛠️', color: '#8E24AA', games: ['nikudMagnet', 'syllableDJ', 'secretPassword'] },
  { id: 'train', name: 'רַכֶּבֶת הַמִּלִּים', emoji: '🚂', color: '#E53935', games: ['syllableTrain', 'wordBakery', 'wordExplorer'] },
  { id: 'mountain', name: 'הַר הַמִּלִּים', emoji: '⛰️', color: '#6D4C41', games: ['finalTransformer'] },
  { id: 'museum', name: 'מוּזֵאוֹן הַמִּלִּים', emoji: '🏛️', color: '#3949AB', games: ['wordCollector'] },
  { id: 'theatre', name: 'תֵּאַטְרוֹן הַסִּפּוּרִים', emoji: '🎭', color: '#D81B60', games: ['echoReader', 'phraseTrain'] },
  { id: 'kingdom', name: 'מַמְלֶכֶת הַסִּפּוּרִים', emoji: '🏰', color: '#F4511E', games: ['storyPuzzle', 'storyDetective'] },
].map((w) => ({ ...w, id: w.id as WorldId, games: w.games as GameId[], name: nfc(w.name) }));
export const WORLD: Record<string, WorldDef> = Object.fromEntries(WORLDS.map((w) => [w.id, w]));

export type Mechanic = 'choose' | 'findTap' | 'build' | 'count' | 'sequence' | 'readAlong' | 'story';

export interface GameDef {
  id: GameId;
  world: WorldId;
  name: string;        // spoken + shown (pointed)
  icon: string;
  mechanic: Mechanic;
  skills: string[];    // exact ids or prefix patterns ending with '*'
  mission: readonly [string, string]; // spoken instruction (Butz), [boy, girl]; played only when the child taps 👂
  items: number;       // items per activity
}

const G = (id: GameId, world: WorldId, name: string, icon: string, mechanic: Mechanic, skills: string[], mission: G2, items = 5): GameDef =>
  ({ id, world, name: nfc(name), icon, mechanic, skills, mission: [g(mission, 'boy'), g(mission, 'girl')], items });

export const GAMES: GameDef[] = [
  G('soundSafari', 'forest', 'סָפָארִי צְלִילִים', '🦁', 'choose', ['PA.first'], ['הַקְשֵׁב לַמִּלָּה, וּמְצָא אֶת הַתְּמוּנָה שֶׁמַּתְחִילָה בְּאוֹתוֹ צְלִיל!', 'הַקְשִׁיבִי לַמִּלָּה, וּמִצְאִי אֶת הַתְּמוּנָה שֶׁמַּתְחִילָה בְּאוֹתוֹ צְלִיל!']),
  G('syllableHop', 'forest', 'קְפִיצַת הֲבָרוֹת', '🐸', 'count', ['PA.count'], ['גַּע בְּאֶבֶן אַחַת לְכָל הֲבָרָה, וְהַצְּפַרְדֵּעַ תִּקְפֹּץ!', 'גְּעִי בְּאֶבֶן אַחַת לְכָל הֲבָרָה, וְהַצְּפַרְדֵּעַ תִּקְפֹּץ!']),
  G('robotMixer', 'forest', 'הָרוֹבּוֹט מְחַבֵּר', '🤖', 'choose', ['PA.blend'], 'הָרוֹבּוֹט אוֹמֵר מִלָּה בַּחֲתִיכוֹת. אֵיזוֹ מִלָּה הוּא אָמַר?'),
  G('soundLighthouse', 'island', 'מִגְדַּלּוֹר הַצְּלִילִים', '💡', 'choose', ['L.*'], ['הַמִּגְדַּלּוֹר אוֹמֵר צְלִיל. גַּע בָּאוֹת שֶׁעוֹשָׂה אֶת הַצְּלִיל הַזֶּה!', 'הַמִּגְדַּלּוֹר אוֹמֵר צְלִיל. גְּעִי בָּאוֹת שֶׁעוֹשָׂה אֶת הַצְּלִיל הַזֶּה!']),
  G('letterDetective', 'island', 'בַּלַּשׁ הָאוֹתִיּוֹת', '🔍', 'findTap', ['L.*'], ['הַקְשֵׁב לָאוֹת, וּמְצָא אֶת כָּל הָאוֹתִיּוֹת הַמִּתְחַבְּאוֹת!', 'הַקְשִׁיבִי לָאוֹת, וּמִצְאִי אֶת כָּל הָאוֹתִיּוֹת הַמִּתְחַבְּאוֹת!'], 3),
  G('nikudMagnet', 'workshop', 'מַגְנֵט הַנִּקּוּד', '🧲', 'build', ['V.a', 'V.i', 'V.e', 'V.o', 'V.u'], ['הַקְשֵׁב, וְהַדְבֵּק לָאוֹת אֶת הַנִּקּוּד הַנָּכוֹן!', 'הַקְשִׁיבִי, וְהַדְבִּיקִי לָאוֹת אֶת הַנִּקּוּד הַנָּכוֹן!']),
  G('syllableDJ', 'workshop', 'דִּי־גֵ׳יי הֲבָרוֹת', '🎧', 'choose', ['CV', 'V.a', 'V.i', 'V.e', 'V.o', 'V.u'], ['הַקְשֵׁב לַצְּלִיל, וְגַע בַּכַּפְתּוֹר הַנָּכוֹן!', 'הַקְשִׁיבִי לַצְּלִיל, וּגְעִי בַּכַּפְתּוֹר הַנָּכוֹן!']),
  G('secretPassword', 'workshop', 'הַסִּיסְמָה הַסּוֹדִית', '🚪', 'choose', ['CV', 'V.a', 'V.i', 'V.e', 'V.o', 'V.u'], ['קְרָא אֶת הַסִּיסְמָה שֶׁעַל הַדֶּלֶת, וּבְחַר אֶת הַמַּפְתֵּחַ שֶׁאוֹמֵר אוֹתָהּ!', 'קִרְאִי אֶת הַסִּיסְמָה שֶׁעַל הַדֶּלֶת, וּבַחֲרִי אֶת הַמַּפְתֵּחַ שֶׁאוֹמֵר אוֹתָהּ!']),
  G('syllableTrain', 'train', 'רַכֶּבֶת הַהֲבָרוֹת', '🚂', 'choose', ['W1', 'W2', 'W3', 'X.quiet', 'V.shva'], ['קְרָא אֶת הַקְּרוֹנוֹת, וּבְחַר מָה הָרַכֶּבֶת מְבִיאָה!', 'קִרְאִי אֶת הַקְּרוֹנוֹת, וּבַחֲרִי מָה הָרַכֶּבֶת מְבִיאָה!']),
  G('wordBakery', 'train', 'מַאֲפִיַּת הַמִּלִּים', '🧁', 'build', ['W2', 'W3'], ['בּוּץ הִזְמִין עוּגַת מִלָּה. סַדֵּר אֶת הַהֲבָרוֹת לְפִי הַסֵּדֶר!', 'בּוּץ הִזְמִין עוּגַת מִלָּה. סַדְּרִי אֶת הַהֲבָרוֹת לְפִי הַסֵּדֶר!'], 4),
  G('wordExplorer', 'train', 'מְגַלֶּה הַמִּלִּים', '🧭', 'choose', ['W1', 'W2', 'W3', 'X.quiet', 'V.shva'], ['מָצָאנוּ מִלָּה חֲדָשָׁה בַּמַּפָּה! קְרָא אוֹתָהּ, וּבְחַר אֶת הַתְּמוּנָה.', 'מָצָאנוּ מִלָּה חֲדָשָׁה בַּמַּפָּה! קִרְאִי אוֹתָהּ, וּבַחֲרִי אֶת הַתְּמוּנָה.']),
  G('finalTransformer', 'mountain', 'הָרוֹבּוֹט הַמְּשַׁנֶּה', '🦾', 'build', ['FIN', 'L.finalKhaf', 'L.finalMem', 'L.finalNun', 'L.finalFe', 'L.finalTsadi'], 'בְּסוֹף מִלָּה, יֵשׁ אוֹתִיּוֹת שֶׁמִּשְׁתַּנּוֹת! אֵיזוֹ אוֹת חֲסֵרָה?'),
  G('wordCollector', 'museum', 'אֹסֶף הַמִּלִּים', '🏛️', 'choose', ['SIGHT'], ['הַקְשֵׁב לַמִּלָּה, וּמְצָא אוֹתָהּ!', 'הַקְשִׁיבִי לַמִּלָּה, וּמִצְאִי אוֹתָהּ!']),
  G('echoReader', 'theatre', 'קוֹרֵא הַהֵד', '🦜', 'readAlong', ['FLU.sentence'], ['קְרָא אֶת הַמִּשְׁפָּט, וּבְחַר אֶת הַתְּמוּנָה. אַחַר כָּךְ בּוּץ יִקְרָא אוֹתוֹ, וְתִקְרָא שׁוּב כְּמוֹהוּ!', 'קִרְאִי אֶת הַמִּשְׁפָּט, וּבַחֲרִי אֶת הַתְּמוּנָה. אַחַר כָּךְ בּוּץ יִקְרָא אוֹתוֹ, וְתִקְרְאִי שׁוּב כְּמוֹהוּ!'], 3),
  G('phraseTrain', 'theatre', 'רַכֶּבֶת הַמִּשְׁפָּטִים', '🚃', 'readAlong', ['FLU.phrase'], ['גַּע בְּכָל קָרוֹן כְּשֶׁאַתָּה קוֹרֵא אוֹתוֹ, וְאָז בְּחַר אֶת הַתְּמוּנָה!', 'גְּעִי בְּכָל קָרוֹן כְּשֶׁאַתְּ קוֹרֵאת אוֹתוֹ, וְאָז בַּחֲרִי אֶת הַתְּמוּנָה!'], 3),
  G('storyPuzzle', 'kingdom', 'פָּאזֶל הַסִּפּוּר', '🧩', 'sequence', ['COMP.seq'], ['הַקְשֵׁב לַסִּפּוּר, וְסַדֵּר אֶת הַתְּמוּנוֹת לְפִי הַסֵּדֶר!', 'הַקְשִׁיבִי לַסִּפּוּר, וְסַדְּרִי אֶת הַתְּמוּנוֹת לְפִי הַסֵּדֶר!'], 1),
  G('storyDetective', 'kingdom', 'בַּלַּשׁ הַסִּפּוּרִים', '🕵️', 'story', ['COMP.read'], ['קְרָא אֶת הַסִּפּוּר, וַעֲנֵה עַל שְׁאֵלוֹת שֶׁל בַּלָּשִׁים!', 'קִרְאִי אֶת הַסִּפּוּר, וַעֲנִי עַל שְׁאֵלוֹת שֶׁל בַּלָּשִׁים!'], 1),
  G('storyTime', 'storytime', 'שְׁעַת סִפּוּר', '📚', 'story', ['COMP.listen'], ['הַקְשֵׁב לַסִּפּוּר, וְאַחַר כָּךְ עֲנֵה עַל הַשְּׁאֵלוֹת!', 'הַקְשִׁיבִי לַסִּפּוּר, וְאַחַר כָּךְ עֲנִי עַל הַשְּׁאֵלוֹת!'], 1),
];
export const GAME: Record<string, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export const gameServes = (g: GameDef, skill: string): boolean =>
  g.skills.some((p) => (p.endsWith('*') ? skill.startsWith(p.slice(0, -1)) : p === skill));
export const gamesFor = (skill: string): GameDef[] => GAMES.filter((g) => gameServes(g, skill));

/** Introduction order (SPEC §5.1). Units only: higher skills (CV, W1…) become available automatically (gating.ts). */
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
