/* Story generator (v1.3, SPEC §9.6): text-only stories at eight lengths (5 to 30 sentences) from seven
   story plans. Every sentence is hand-pointed; names, things, places and numbers fill the slots with matching gender
   (verbs, adjectives, pronouns and numbers agree). A sentence may carry facts: questions it answers, with wrong options
   of the same kind. The same seed always makes the same story. Pure TypeScript. */
import { nfc, textWords } from '../hebrew.ts';
import { makeRng, type Rng } from '../rng.ts';

export type StoryLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** Sentences per level: easy stories have 5 sentences, hard ones 30. */
export const STORY_LENGTH: Record<StoryLevel, number> = { 1: 5, 2: 7, 3: 10, 4: 13, 5: 16, 6: 20, 7: 25, 8: 30 };
/** The level of a hand-written story: the highest level whose length it reaches. */
export const levelForLength = (n: number): StoryLevel =>
  (Object.keys(STORY_LENGTH).map(Number) as StoryLevel[]).filter((l) => STORY_LENGTH[l] <= n).pop() ?? 1;

export type QType = 'who' | 'what' | 'where' | 'why' | 'how' | 'when' | 'count' | 'color' | 'order' | 'feel';
export interface Opt { label: string; emoji?: string }
export interface Fact { depth: 'literal' | 'detail'; type: QType; q: string; a: Opt; pool: Opt[] }
export interface Line { t: string; p: number; facts?: Fact[]; ev?: boolean }
export type Part = Line[];
export interface Plan { title: string; parts: (k: number) => Part[]; k: [number, number] }

export interface GenStory {
  id: string;
  title: string;
  level: StoryLevel;
  paragraphs: string[][];
  facts: Fact[];
  events: string[];
}

export type Gn = 'm' | 'f';
export interface Who { name: string; to: string; and: string; from?: string; g: Gn; emoji: string; pet?: boolean }
/** Pick the masculine or feminine form for a character or thing. */
const sw = (w: { g: Gn }) => (m: string, f: string): string => (w.g === 'm' ? m : f);

/* ------------------------------------------------------------------ lexicon */

const K = (name: string, to: string, and: string, g: Gn): Who => ({ name, to, and, g, emoji: g === 'm' ? '👦' : '👧' });
const KIDS: Who[] = [
  K('דָּנִי', 'לְדָנִי', 'וְדָנִי', 'm'), K('יוֹסִי', 'לְיוֹסִי', 'וְיוֹסִי', 'm'), K('אוֹרִי', 'לְאוֹרִי', 'וְאוֹרִי', 'm'),
  K('עִידוֹ', 'לְעִידוֹ', 'וְעִידוֹ', 'm'), K('נָדָב', 'לְנָדָב', 'וְנָדָב', 'm'), K('עוֹמֶר', 'לְעוֹמֶר', 'וְעוֹמֶר', 'm'),
  K('אֵיתָן', 'לְאֵיתָן', 'וְאֵיתָן', 'm'), K('יוֹנָתָן', 'לְיוֹנָתָן', 'וְיוֹנָתָן', 'm'), K('רוֹעִי', 'לְרוֹעִי', 'וְרוֹעִי', 'm'),
  K('בֶּן', 'לְבֶן', 'וּבֶן', 'm'), K('תּוֹם', 'לְתוֹם', 'וְתוֹם', 'm'), K('אִיתַי', 'לְאִיתַי', 'וְאִיתַי', 'm'),
  K('נוֹעָה', 'לְנוֹעָה', 'וְנוֹעָה', 'f'), K('מִיכַל', 'לְמִיכַל', 'וּמִיכַל', 'f'), K('שִׁירָה', 'לְשִׁירָה', 'וְשִׁירָה', 'f'),
  K('יָעֵל', 'לְיָעֵל', 'וְיָעֵל', 'f'), K('תָּמָר', 'לְתָמָר', 'וְתָמָר', 'f'), K('מָאיָה', 'לְמָאיָה', 'וּמָאיָה', 'f'),
  K('הִילָה', 'לְהִילָה', 'וְהִילָה', 'f'), K('דָּנָה', 'לְדָנָה', 'וְדָנָה', 'f'), K('נֹגָה', 'לְנֹגָה', 'וְנֹגָה', 'f'),
  K('אַיָּלָה', 'לְאַיָּלָה', 'וְאַיָּלָה', 'f'), K('רוֹמִי', 'לְרוֹמִי', 'וְרוֹמִי', 'f'), K('אֶלָּה', 'לְאֶלָּה', 'וְאֶלָּה', 'f'),
];
const FAMILY: Who[] = [
  { name: 'אִמָּא', to: 'לְאִמָּא', and: 'וְאִמָּא', from: 'מֵאִמָּא', g: 'f', emoji: '👩' },
  { name: 'אַבָּא', to: 'לְאַבָּא', and: 'וְאַבָּא', from: 'מֵאַבָּא', g: 'm', emoji: '👨' },
  { name: 'סַבָּא', to: 'לְסַבָּא', and: 'וְסַבָּא', from: 'מִסַּבָּא', g: 'm', emoji: '👴' },
  { name: 'סַבְתָּא', to: 'לְסַבְתָּא', and: 'וְסַבְתָּא', from: 'מִסַּבְתָּא', g: 'f', emoji: '👵' },
];
const PETS: Who[] = [
  { name: 'הַכֶּלֶב', to: 'לַכֶּלֶב', and: 'וְהַכֶּלֶב', g: 'm', emoji: '🐕', pet: true },
  { name: 'הֶחָתוּל', to: 'לֶחָתוּל', and: 'וְהֶחָתוּל', g: 'm', emoji: '🐈', pet: true },
  { name: 'הַתֻּכִּי', to: 'לַתֻּכִּי', and: 'וְהַתֻּכִּי', g: 'm', emoji: '🦜', pet: true },
  { name: 'הָאַרְנֶבֶת', to: 'לָאַרְנֶבֶת', and: 'וְהָאַרְנֶבֶת', g: 'f', emoji: '🐰', pet: true },
];
const NEIGHBORS: Who[] = [
  { name: 'הַשָּׁכֵן', to: 'לַשָּׁכֵן', and: 'וְהַשָּׁכֵן', g: 'm', emoji: '🧔' },
  { name: 'הַשְּׁכֵנָה', to: 'לַשְּׁכֵנָה', and: 'וְהַשְּׁכֵנָה', g: 'f', emoji: '👩‍🦰' },
];
const FIREFIGHTER: Who = { name: 'הַכַּבַּאי', to: 'לַכַּבַּאי', and: 'וְהַכַּבַּאי', g: 'm', emoji: '🧑‍🚒' };

interface Color { m: string; f: string; mp: string; emoji: string }
const COLORS: Color[] = [
  { m: 'אָדֹם', f: 'אֲדֻמָּה', mp: 'אֲדֻמִּים', emoji: '🔴' },
  { m: 'כָּחֹל', f: 'כְּחֻלָּה', mp: 'כְּחֻלִּים', emoji: '🔵' },
  { m: 'יָרֹק', f: 'יְרֻקָּה', mp: 'יְרֻקִּים', emoji: '🟢' },
  { m: 'צָהֹב', f: 'צְהֻבָּה', mp: 'צְהֻבִּים', emoji: '🟡' },
  { m: 'סָגֹל', f: 'סְגֻלָּה', mp: 'סְגֻלִּים', emoji: '🟣' },
  { m: 'כָּתֹם', f: 'כְּתֻמָּה', mp: 'כְּתֻמִּים', emoji: '🟠' },
  { m: 'לָבָן', f: 'לְבָנָה', mp: 'לְבָנִים', emoji: '⚪' },
  { m: 'שָׁחֹר', f: 'שְׁחֹרָה', mp: 'שְׁחֹרִים', emoji: '⚫' },
];
const PINK: Color = { m: 'וָרֹד', f: 'וְרֻדָּה', mp: 'וְרֻדִּים', emoji: '🌸' };
/** Numbers before a noun (2 is the construct form): [masculine noun, feminine noun]. */
const NUM: [string, string][] = [['', ''], ['אֶחָד', 'אַחַת'], ['שְׁנֵי', 'שְׁתֵּי'], ['שְׁלֹשָׁה', 'שָׁלֹשׁ'], ['אַרְבָּעָה', 'אַרְבַּע'], ['חֲמִשָּׁה', 'חָמֵשׁ'], ['שִׁשָּׁה', 'שֵׁשׁ']];

type Feel = { m: string; f: string; emoji: string };
const FEEL: Record<'sad' | 'happy' | 'tired' | 'angry' | 'scared' | 'hungry', Feel> = {
  sad: { m: 'עָצוּב', f: 'עֲצוּבָה', emoji: '😢' },
  happy: { m: 'שָׂמֵחַ', f: 'שְׂמֵחָה', emoji: '😄' },
  tired: { m: 'עָיֵף', f: 'עֲיֵפָה', emoji: '😴' },
  angry: { m: 'כּוֹעֵס', f: 'כּוֹעֶסֶת', emoji: '😠' },
  scared: { m: 'מְפֻחָד', f: 'מְפֻחֶדֶת', emoji: '😨' },
  hungry: { m: 'רָעֵב', f: 'רְעֵבָה', emoji: '😋' },
};
const feel = (w: { g: Gn }, k: keyof typeof FEEL): Opt => ({ label: sw(w)(FEEL[k].m, FEEL[k].f), emoji: FEEL[k].emoji });
const feels = (w: { g: Gn }, ks: (keyof typeof FEEL)[]): Opt[] => ks.map((k) => feel(w, k));

const whoOpt = (w: Who): Opt => ({ label: w.name, emoji: w.emoji });
const ORDER_NEXT = ['אַחַר כָּךְ', 'אַחֲרֵי זֶה', 'אָז', 'מְעַט אַחַר כָּךְ'];
const DAYS = ['בַּיּוֹם הָרִאשׁוֹן', 'בַּיּוֹם הַשֵּׁנִי', 'בַּיּוֹם הַשְּׁלִישִׁי', 'בַּיּוֹם הָרְבִיעִי', 'בַּיּוֹם הַחֲמִישִׁי', 'בַּיּוֹם הַשִּׁשִּׁי', 'בַּיּוֹם הַשְּׁבִיעִי', 'בַּיּוֹם הַשְּׁמִינִי', 'בַּיּוֹם הַתְּשִׁיעִי', 'בַּיּוֹם הָעֲשִׂירִי'];

const L = (t: string, p = 0, facts?: Fact[], ev = false): Line => ({ t, p, facts, ev });
const F = (depth: Fact['depth'], type: QType, q: string, a: Opt, pool: Opt[]): Fact => ({ depth, type, q, a, pool });
const others = (xs: Who[], not: Who[]): Who[] => xs.filter((x) => !not.includes(x));

/* ------------------------------------------------------------------ 1. a lost toy */

interface Thing { key: string; a: string; the: string; g: Gn; emoji: string }
const TOYS: Thing[] = [
  { key: 'ball', a: 'כַּדּוּר', the: 'הַכַּדּוּר', g: 'm', emoji: '⚽' },
  { key: 'teddy', a: 'דּוּבִּי', the: 'הַדּוּבִּי', g: 'm', emoji: '🧸' },
  { key: 'hat', a: 'כּוֹבַע', the: 'הַכּוֹבַע', g: 'm', emoji: '🧢' },
  { key: 'key', a: 'מַפְתֵּחַ', the: 'הַמַּפְתֵּחַ', g: 'm', emoji: '🔑' },
  { key: 'book', a: 'סֵפֶר', the: 'הַסֵּפֶר', g: 'm', emoji: '📖' },
  { key: 'scarf', a: 'צָעִיף', the: 'הַצָּעִיף', g: 'm', emoji: '🧣' },
  { key: 'bag', a: 'תִּיק', the: 'הַתִּיק', g: 'm', emoji: '🎒' },
  { key: 'pencil', a: 'עִפָּרוֹן', the: 'הָעִפָּרוֹן', g: 'm', emoji: '✏️' },
  { key: 'doll', a: 'בּוּבָּה', the: 'הַבּוּבָּה', g: 'f', emoji: '🪆' },
  { key: 'notebook', a: 'מַחְבֶּרֶת', the: 'הַמַּחְבֶּרֶת', g: 'f', emoji: '📓' },
  { key: 'ring', a: 'טַבַּעַת', the: 'הַטַּבַּעַת', g: 'f', emoji: '💍' },
  { key: 'umbrella', a: 'מִטְרִיָּה', the: 'הַמִּטְרִיָּה', g: 'f', emoji: '☂️' },
  { key: 'car', a: 'מְכוֹנִית', the: 'הַמְּכוֹנִית', g: 'f', emoji: '🚗' },
  { key: 'dice', a: 'קֻבִּיָּה', the: 'הַקֻּבִּיָּה', g: 'f', emoji: '🎲' },
  { key: 'mask', a: 'מַסֵּכָה', the: 'הַמַּסֵּכָה', g: 'f', emoji: '🎭' },
];
const SPOTS = ['מִתַּחַת לַמִּטָּה', 'מִתַּחַת לַסַּפָּה', 'מִתַּחַת לַשֻּׁלְחָן', 'בָּאָרוֹן', 'עַל הַמַּדָּף', 'בְּאַרְגַּז הַצַּעֲצוּעִים',
  'לְיַד הַדֶּלֶת', 'בְּסַל הַכְּבִיסָה', 'מֵאֲחוֹרֵי הַוִּילוֹן', 'בַּמְּגֵרָה', 'עַל הַמְּקָרֵר', 'בְּתוֹךְ הַנַּעַל'];
const FINDS: (Opt & { key: string })[] = [
  { key: 'sock', label: 'גֶּרֶב יָשָׁן', emoji: '🧦' }, { key: 'coin', label: 'מַטְבֵּעַ', emoji: '🪙' },
  { key: 'spoon', label: 'כַּפִּית', emoji: '🥄' }, { key: 'puzzle', label: 'חֲתִיכַת פָּאזֶל', emoji: '🧩' },
  { key: 'letter', label: 'מִכְתָּב יָשָׁן', emoji: '✉️' }, { key: 'tennis', label: 'כַּדּוּר טֶנִיס', emoji: '🎾' },
  { key: 'cookie', label: 'עוּגִיָּה', emoji: '🍪' }, { key: 'feather', label: 'נוֹצָה', emoji: '🪶' },
  { key: 'stone', label: 'אֶבֶן חֲלָקָה', emoji: '🪨' }, { key: 'button', label: 'כַּפְתּוֹר', emoji: '🔘' },
  { key: 'shell', label: 'צִדְפָּה', emoji: '🐚' }, { key: 'candy', label: 'סֻכָּרִיָּה', emoji: '🍬' },
];
interface Room { at: string; to: string; act: [string, string]; emoji: string }
const ROOMS: Room[] = [
  { at: 'בַּמִּטְבָּח', to: 'לַמִּטְבָּח', act: ['בִּשֵּׁל מָרָק', 'בִּשְּׁלָה מָרָק'], emoji: '🍲' },
  { at: 'בַּסָּלוֹן', to: 'לַסָּלוֹן', act: ['קָרָא עִתּוֹן', 'קָרְאָה עִתּוֹן'], emoji: '📰' },
  { at: 'בַּגִּנָּה', to: 'לַגִּנָּה', act: ['הִשְׁקָה פְּרָחִים', 'הִשְׁקְתָה פְּרָחִים'], emoji: '🌸' },
  { at: 'בֶּחָצֵר', to: 'לֶחָצֵר', act: ['תָּלָה כְּבִיסָה', 'תָּלְתָה כְּבִיסָה'], emoji: '👕' },
  { at: 'בַּמִּרְפֶּסֶת', to: 'לַמִּרְפֶּסֶת', act: ['שָׁתָה תֵּה', 'שָׁתְתָה תֵּה'], emoji: '🍵' },
];

function lostPlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const item = rng.pick(TOYS), it = sw(item);
  const color = rng.pick(COLORS);
  const spots = rng.shuffle(SPOTS);
  const finalSpot = spots[0];
  const helper = rng.pick([...FAMILY, ...PETS]), hp = sw(helper);
  const finds = rng.shuffle(FINDS.filter((f) => !(item.key === 'ball' && f.key === 'tennis')));
  const rooms = rng.shuffle(ROOMS);
  const met = rng.shuffle(FAMILY.filter((f) => f !== helper));
  const lost = it('נֶעְלַם', 'נֶעֶלְמָה'), was = it('הָיָה', 'הָיְתָה');
  const searched = h('חִפֵּשׂ', 'חִפְּשָׂה');
  const toyOpts = TOYS.filter((t) => t !== item).map((t) => ({ label: t.a, emoji: t.emoji }));
  const spotOpt = (s: string): Opt => ({ label: s });
  const searchExtras = rng.shuffle([
    `${h('הוּא הִסְתַּכֵּל', 'הִיא הִסְתַּכְּלָה')} טוֹב טוֹב.`, `${h('הוּא אָמַר', 'הִיא אָמְרָה')}: לֹא כָּאן!`, 'שָׁם הָיָה רַק אָבָק.',
    `${H.name} ${h('נֶאֱנַח', 'נֶאֶנְחָה')}, ${h('וְהִמְשִׁיךְ', 'וְהִמְשִׁיכָה')} לְחַפֵּשׂ.`, `${h('הוּא חָשַׁב', 'הִיא חָשְׁבָה')}: אוּלַי בַּמָּקוֹם הַבָּא?`,
  ]);
  const order = rng.shuffle(ORDER_NEXT);
  return {
    title: `${item.the} שֶׁל ${H.name}`,
    k: [0, 8],
    parts: (k) => {
      const used = spots.slice(1, 1 + k);
      const intro: Part = [
        L(`${H.to} יֵשׁ ${item.a} ${color[item.g]}.`, 0, [F('detail', 'color', `בְּאֵיזֶה צֶבַע ${item.the} שֶׁל ${H.name}?`, { label: color[item.g], emoji: color.emoji }, COLORS.filter((c) => c !== color).map((c) => ({ label: c[item.g], emoji: c.emoji })))]),
        L(`${H.name} ${h('אוֹהֵב', 'אוֹהֶבֶת')} ${it('אוֹתוֹ', 'אוֹתָהּ')} מְאֹד.`, 1),
        L(`${h('הוּא מְשַׂחֵק', 'הִיא מְשַׂחֶקֶת')} ${it('אִתּוֹ', 'אִתָּהּ')} כָּל יוֹם.`, 3),
        L(`יוֹם אֶחָד, ${item.the} ${lost}!`, 0, [F('literal', 'what', `מָה ${searched} ${H.name}?`, { label: item.a, emoji: item.emoji }, toyOpts)], true),
        L(`${H.name} ${h('הָיָה עָצוּב', 'הָיְתָה עֲצוּבָה')}.`, 1, [F('detail', 'feel', `אֵיךְ ${h('הִרְגִּישׁ', 'הִרְגִּישָׁה')} ${H.name} כְּשֶׁ${item.the} ${lost}?`, feel(H, 'sad'), feels(H, ['happy', 'tired', 'hungry']))]),
        L(`${h('הוּא שָׁאַל', 'הִיא שָׁאֲלָה')}: אֵיפֹה ${item.the} שֶׁלִּי?`, 2),
        L(`${h('הוּא הֶחְלִיט', 'הִיא הֶחְלִיטָה')} לְחַפֵּשׂ בְּכָל הַבַּיִת.`, 1),
      ];
      const eps: Part[] = [];
      let roomI = 0, findI = 0;
      for (let i = 0; i < k; i++) {
        const when = i === 0 ? 'קֹדֶם כֹּל' : order[i % order.length];
        if (i % 3 === 1 && roomI < rooms.length && roomI < met.length) {
          const R = rooms[roomI], M = met[roomI], m = sw(M);
          roomI++;
          const act = R.act[M.g === 'm' ? 0 : 1];
          eps.push([
            L(`${when}, ${H.name} ${h('רָץ', 'רָצָה')} ${R.to}, וְשָׁם ${h('הוּא פָּגַשׁ', 'הִיא פָּגְשָׁה')} אֶת ${M.name}.`, 0, [F('literal', 'who', `אֶת מִי ${h('פָּגַשׁ', 'פָּגְשָׁה')} ${H.name} ${R.at}?`, whoOpt(M), others(FAMILY, [M]).map(whoOpt))], true),
            L(`${M.name} ${m('אָמַר', 'אָמְרָה')}: לֹא רָאִיתִי ${it('אוֹתוֹ', 'אוֹתָהּ')}.`, 0),
            L(`${M.name} ${act} ${R.at}.`, 1, [F('detail', 'what', `מָה ${m('עָשָׂה', 'עָשְׂתָה')} ${M.name} ${R.at}?`, { label: act, emoji: R.emoji }, ROOMS.filter((x) => x !== R).map((x) => ({ label: x.act[M.g === 'm' ? 0 : 1], emoji: x.emoji })))]),
            L(`${m('הוּא נָתַן', 'הִיא נָתְנָה')} ${H.to} חִבּוּק, ${h('וְהוּא הִמְשִׁיךְ', 'וְהִיא הִמְשִׁיכָה')} לְחַפֵּשׂ.`, 2),
          ]);
        } else {
          const spot = used[i], O = finds[findI++ % finds.length];
          eps.push([
            L(`${when}, ${H.name} ${searched} ${spot}.`, 0, i === 0 ? [F('detail', 'order', `אֵיפֹה ${searched} ${H.name} קֹדֶם כֹּל?`, spotOpt(spot), SPOTS.filter((x) => x !== spot).map(spotOpt))] : undefined, true),
            L(`${item.the} לֹא ${was} שָׁם, אֲבָל ${h('הוּא מָצָא', 'הִיא מָצְאָה')} ${O.label}.`, 0,
              [F('detail', 'what', `מָה ${h('מָצָא', 'מָצְאָה')} ${H.name} ${spot}?`, { label: O.label, emoji: O.emoji }, [{ label: item.a, emoji: item.emoji }, ...FINDS.filter((f) => f !== O)])]),
            L(searchExtras[i % searchExtras.length], 2),
          ]);
        }
      }
      const ending: Part = [
        L(`פִּתְאוֹם ${helper.name} ${hp('בָּא', 'בָּאָה')} ${helper.pet ? 'בְּרִיצָה' : 'לַעֲזֹר'}.`, 0, [F('literal', 'who', `מִי עָזַר ${H.to} לִמְצֹא אֶת ${item.the}?`, whoOpt(helper), others([...FAMILY, ...PETS], [helper]).map(whoOpt))], true),
        L(`${helper.name} ${hp('מָצָא', 'מָצְאָה')} אֶת ${item.the} ${finalSpot}!`, 0, [F('literal', 'where', `אֵיפֹה ${was} ${item.the}?`, spotOpt(finalSpot), SPOTS.filter((x) => x !== finalSpot).map(spotOpt))], true),
        L(`${item.the} ${was} שָׁם כָּל הַזְּמַן!`, 1),
        L(`${H.name} ${h('שָׂמַח', 'שָׂמְחָה')} מְאֹד, ${h('וְחִבֵּק', 'וְחִבְּקָה')} אֶת ${helper.name}.`, 0, [F('detail', 'feel', `אֵיךְ ${h('הִרְגִּישׁ', 'הִרְגִּישָׁה')} ${H.name} בַּסּוֹף?`, feel(H, 'happy'), feels(H, ['sad', 'angry', 'tired']))], true),
        L(`${h('הוּא אָמַר', 'הִיא אָמְרָה')}: תּוֹדָה רַבָּה!`, 1),
        L(`מֵאָז, ${H.name} ${h('שׁוֹמֵר', 'שׁוֹמֶרֶת')} עַל ${item.the} ${h('שֶׁלּוֹ', 'שֶׁלָּהּ')} טוֹב טוֹב.`, 2),
      ];
      return [intro, ...eps, ending];
    },
  };
}

/* ------------------------------------------------------------------ 2. a trip */

interface Sight { a: string; the: string; g: Gn; emoji: string; act: string; many?: boolean }
interface Dest { to: string; emoji: string; sights: Sight[] }
const S = (a: string, the: string, g: Gn, emoji: string, act: string, many = false): Sight => ({ a, the, g, emoji, act, many });
const DESTS: Dest[] = [
  { to: 'לְגַן הַחַיּוֹת', emoji: '🦁', sights: [
    S('פִּיל גָּדוֹל', 'הַפִּיל', 'm', '🐘', 'הִתִּיז מַיִם עִם הַחֶדֶק'), S('אַרְיֵה', 'הָאַרְיֵה', 'm', '🦁', 'שָׁאַג בְּקוֹל רָם'),
    S('קוֹף שׁוֹבָב', 'הַקּוֹף', 'm', '🐒', 'קָפַץ מֵעָנָף לְעָנָף'), S('זֶבְּרָה', 'הַזֶּבְּרָה', 'f', '🦓', 'אָכְלָה עֵשֶׂב'),
    S('דֹּב חוּם', 'הַדֹּב', 'm', '🐻', 'יָשַׁן בְּתוֹךְ מְעָרָה'), S('פִּינְגְּוִין', 'הַפִּינְגְּוִין', 'm', '🐧', 'הֶחְלִיק עַל הַקֶּרַח'),
    S('תַּנִּין', 'הַתַּנִּין', 'm', '🐊', 'שָׁכַב בַּשֶּׁמֶשׁ'), S('טַוָּס', 'הַטַּוָּס', 'm', '🦚', 'פָּתַח זָנָב צִבְעוֹנִי'),
    S('קֶנְגּוּרוּ', 'הַקֶּנְגּוּרוּ', 'm', '🦘', 'קָפַץ גָּבוֹהַּ'), S('צָב עֲנָק', 'הַצָּב', 'm', '🐢', 'הָלַךְ לְאַט לְאַט'),
  ] },
  { to: 'לַחַוָּה', emoji: '🐄', sights: [
    S('פָּרָה', 'הַפָּרָה', 'f', '🐄', 'אָמְרָה מוּ'), S('סוּס חוּם', 'הַסּוּס', 'm', '🐎', 'רָץ בַּשָּׂדֶה'),
    S('תַּרְנְגֹלֶת', 'הַתַּרְנְגֹלֶת', 'f', '🐔', 'הֵטִילָה בֵּיצָה'), S('כִּבְשָׂה לְבָנָה', 'הַכִּבְשָׂה', 'f', '🐑', 'לָעֲסָה עֵשֶׂב'),
    S('עֵז קְטַנָּה', 'הָעֵז', 'f', '🐐', 'טִפְּסָה עַל סֶלַע'), S('בַּרְוָז', 'הַבַּרְוָז', 'm', '🦆', 'שָׂחָה בַּבְּרֵכָה'),
    S('חֲזִיר וָרֹד', 'הַחֲזִיר', 'm', '🐷', 'הִתְגַּלְגֵּל בִּשְׁלוּלִית'), S('תַּרְנְגוֹל', 'הַתַּרְנְגוֹל', 'm', '🐓', 'קָרָא קוּקוּרִיקוּ'),
    S('כֶּלֶב רוֹעִים', 'כֶּלֶב הָרוֹעִים', 'm', '🐕', 'שָׁמַר עַל הַכְּבָשִׂים'), S('טְרַקְטוֹר אָדֹם', 'הַטְּרַקְטוֹר', 'm', '🚜', 'חָרַשׁ אֶת הַשָּׂדֶה'),
  ] },
  { to: 'לַיָּם', emoji: '🌊', sights: [
    S('סַרְטָן קָטָן', 'הַסַּרְטָן', 'm', '🦀', 'הָלַךְ הַצִּדָּה'), S('דּוֹלְפִין', 'הַדּוֹלְפִין', 'm', '🐬', 'קָפַץ מֵהַמַּיִם'),
    S('סְפִינָה גְּדוֹלָה', 'הַסְּפִינָה', 'f', '🚢', 'שָׁטָה רָחוֹק'), S('צִדְפָּה וְרֻדָּה', 'הַצִּדְפָּה', 'f', '🐚', 'נָצְצָה בַּחוֹל'),
    S('גּוֹלֵשׁ', 'הַגּוֹלֵשׁ', 'm', '🏄', 'רָכַב עַל גַּל גָּבוֹהַּ'), S('דַּיָּג', 'הַדַּיָּג', 'm', '🎣', 'זָרַק חַכָּה לַמַּיִם'),
    S('סִירַת מִפְרָשׂ', 'הַסִּירָה', 'f', '⛵', 'שָׁטָה עִם הָרוּחַ'), S('כַּדּוּר חוֹף', 'כַּדּוּר הַחוֹף', 'm', '🏐', 'עָף גָּבוֹהַּ בָּאֲוִיר'),
    S('שַׁחַף לָבָן', 'הַשַּׁחַף', 'm', '🐦', 'עָף מֵעַל הַגַּלִּים'), S('אַרְמוֹן חוֹל', 'אַרְמוֹן הַחוֹל', 'm', '🏰', 'עָמַד לְיַד הַמַּיִם'),
  ] },
  { to: 'לַיַּעַר', emoji: '🌲', sights: [
    S('סְנָאִי', 'הַסְּנָאִי', 'm', '🐿️', 'אָסַף אֱגוֹזִים'), S('קִפּוֹד', 'הַקִּפּוֹד', 'm', '🦔', 'הִתְכַּדֵּר כְּמוֹ כַּדּוּר'),
    S('יַנְשׁוּף', 'הַיַּנְשׁוּף', 'm', '🦉', 'יָשַׁב עַל עָנָף'), S('צְבִי', 'הַצְּבִי', 'm', '🦌', 'רָץ בֵּין הָעֵצִים'),
    S('פַּרְפַּר צִבְעוֹנִי', 'הַפַּרְפַּר', 'm', '🦋', 'נָחַת עַל פֶּרַח'), S('פִּטְרִיָּה אֲדֻמָּה', 'הַפִּטְרִיָּה', 'f', '🍄', 'צָמְחָה לְיַד עֵץ'),
    S('שׁוּעָל', 'הַשּׁוּעָל', 'm', '🦊', 'הֵצִיץ מֵאֲחוֹרֵי שִׂיחַ'), S('נַחַל קָטָן', 'הַנַּחַל', 'm', '🏞️', 'זָרַם בֵּין הָאֲבָנִים'),
    S('צִפּוֹר כְּחֻלָּה', 'הַצִּפּוֹר', 'f', '🐦', 'שָׁרָה שִׁיר'), S('נְמָלִים', 'הַנְּמָלִים', 'f', '🐜', 'סָחֲבוּ פֵּרוּרִים', true),
  ] },
];
const VEHICLES: Opt[] = [{ label: 'בָּאוֹטוֹבּוּס', emoji: '🚌' }, { label: 'בָּרַכֶּבֶת', emoji: '🚂' }, { label: 'בַּמְּכוֹנִית', emoji: '🚗' }, { label: 'בַּמּוֹנִית', emoji: '🚕' }, { label: 'בָּאוֹפַנַּיִם', emoji: '🚲' }];
interface Food { pl: string; thePl: string; g: Gn; emoji: string }
const SNACKS: Food[] = [
  { pl: 'תַּפּוּחִים', thePl: 'הַתַּפּוּחִים', g: 'm', emoji: '🍎' }, { pl: 'כְּרִיכִים', thePl: 'הַכְּרִיכִים', g: 'm', emoji: '🥪' },
  { pl: 'בָּנָנוֹת', thePl: 'הַבָּנָנוֹת', g: 'f', emoji: '🍌' }, { pl: 'עוּגִיּוֹת', thePl: 'הָעוּגִיּוֹת', g: 'f', emoji: '🍪' },
  { pl: 'תַּפּוּזִים', thePl: 'הַתַּפּוּזִים', g: 'm', emoji: '🍊' }, { pl: 'אֲגָסִים', thePl: 'הָאֲגָסִים', g: 'm', emoji: '🍐' },
];
const countOpt = (n: number, f: { pl: string; g: Gn; emoji: string }): Opt => ({ label: `${NUM[n][f.g === 'm' ? 0 : 1]} ${f.pl}`, emoji: f.emoji.repeat(n) });
const CARRY: Opt[] = [{ label: 'מַצְלֵמָה', emoji: '📷' }, { label: 'מַפָּה', emoji: '🗺️' }, { label: 'מִשְׁקֶפֶת', emoji: '🔭' }, { label: 'בַּקְבּוּק מַיִם', emoji: '💧' }, { label: 'כּוֹבַע שֶׁמֶשׁ', emoji: '👒' }];

function tripPlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const C = rng.pick(FAMILY), c = sw(C);
  const D = rng.pick(DESTS);
  const V = rng.pick(VEHICLES);
  const snack = rng.pick(SNACKS), n = 2 + rng.int(4);
  const carry = rng.pick(CARRY);
  const teller = rng.pick(FAMILY.filter((f) => f !== C));
  const sights = rng.shuffle(D.sights);
  const elsewhere = DESTS.filter((d) => d !== D).flatMap((d) => d.sights);
  const sightOpt = (s: Sight): Opt => ({ label: s.a, emoji: s.emoji });
  const reacts = rng.shuffle([
    `${H.name} ${h('צָחַק', 'צָחֲקָה')}.`, `${C.name} ${c('צִלֵּם', 'צִלְּמָה')} תְּמוּנָה.`, `${H.name} ${h('אָמַר', 'אָמְרָה')}: וָואו!`,
    'הֵם עָמְדוּ שָׁם וְהִסְתַּכְּלוּ הַרְבֵּה זְמַן.', `${H.name} ${h('הֶרְאָה', 'הֶרְאֲתָה')} ${C.to} בָּאֶצְבַּע.`,
  ]);
  const order = rng.shuffle(ORDER_NEXT);
  const weather = rng.pick(['הַשֶּׁמֶשׁ זָרְחָה, וְהַשָּׁמַיִם הָיוּ כְּחֻלִּים.', 'הָיָה בֹּקֶר קָרִיר וְנָעִים.', 'הָיָה יוֹם יָפֶה, וְהָרוּחַ הָיְתָה נְעִימָה.']);
  const we = `${H.name} ${C.and}`;
  return {
    title: `טִיּוּל ${D.to}`,
    k: [1, 9],
    parts: (k) => {
      const seen = sights.slice(0, k);
      const fav = seen[seen.length - 1];
      const intro: Part = [
        L(`${we} נָסְעוּ ${D.to} ${V.label}.`, 0, [
          F('literal', 'where', `לְאָן נָסְעוּ ${we}?`, { label: D.to, emoji: D.emoji }, DESTS.filter((d) => d !== D).map((d) => ({ label: d.to, emoji: d.emoji }))),
          F('detail', 'how', `בַּמֶּה נָסְעוּ ${we}?`, V, VEHICLES.filter((x) => x !== V)),
          F('literal', 'who', `עִם מִי ${h('נָסַע', 'נָסְעָה')} ${H.name}?`, whoOpt(C), others(FAMILY, [C]).map(whoOpt)),
        ], true),
        L(`${H.name} ${h('אָרַז', 'אָרְזָה')} תִּיק עִם ${countOpt(n, snack).label}.`, 1, [F('detail', 'count', `כַּמָּה ${snack.pl} ${h('אָרַז', 'אָרְזָה')} ${H.name}?`, countOpt(n, snack), [2, 3, 4, 5, 6].filter((x) => x !== n).map((x) => countOpt(x, snack)))]),
        L(`${C.name} ${c('לָקַח', 'לָקְחָה')} ${c('אִתּוֹ', 'אִתָּהּ')} ${carry.label}.`, 2, [F('detail', 'what', `מָה ${c('לָקַח', 'לָקְחָה')} ${C.name} לַטִּיּוּל?`, carry, CARRY.filter((x) => x !== carry))]),
        L(weather, 3),
        L(`${H.name} ${h('הִתְרַגֵּשׁ', 'הִתְרַגְּשָׁה')} מְאֹד.`, 2),
      ];
      const eps: Part[] = seen.map((s, i) => {
        const when = i === 0 ? 'קֹדֶם כֹּל' : order[i % order.length];
        const did = s.many ? undefined : [F('detail', 'what', `מָה ${sw(s)('עָשָׂה', 'עָשְׂתָה')} ${s.the}?`, { label: s.act, emoji: s.emoji }, [...D.sights, ...elsewhere].filter((x) => x !== s && x.g === s.g && !x.many).map((x) => ({ label: x.act })))];
        return [
          L(`${when}, הֵם רָאוּ ${s.a}.`, 0, i === 0 ? [F('detail', 'order', `מָה רָאוּ ${we} קֹדֶם כֹּל?`, sightOpt(s), [...D.sights.filter((x) => x !== s), ...elsewhere].map(sightOpt))] : undefined, true),
          L(`${s.the} ${s.act}.`, 0, did),
          L(reacts[i % reacts.length], i % 2 ? 2 : 1),
        ];
      });
      if (k >= 4) {
        eps.splice(Math.floor(k / 2), 0, [
          L(`בַּצָּהֳרַיִם, הֵם יָשְׁבוּ עַל סַפְסָל וְאָכְלוּ אֶת ${snack.thePl}.`, 0, [F('detail', 'when', `מָתַי אָכְלוּ ${we}?`, { label: 'בַּצָּהֳרַיִם', emoji: '🕛' }, [{ label: 'בַּבֹּקֶר', emoji: '🌅' }, { label: 'בַּלַּיְלָה', emoji: '🌙' }, { label: 'בָּעֶרֶב', emoji: '🌆' }])], true),
          L(`${H.name} ${h('הָיָה רָעֵב', 'הָיְתָה רְעֵבָה')}, ${h('וְאָכַל', 'וְאָכְלָה')} הַכֹּל.`, 2),
        ]);
      }
      if (k >= 6) {
        eps.splice(eps.length - 1, 0, [
          L('פִּתְאוֹם הִתְחִיל לָרֶדֶת גֶּשֶׁם!', 0, [F('detail', 'what', 'מָה קָרָה פִּתְאוֹם בַּטִּיּוּל?', { label: 'יָרַד גֶּשֶׁם', emoji: '🌧️' }, [{ label: 'יָרַד שֶׁלֶג', emoji: '❄️' }, { label: 'הָיְתָה סוּפָה', emoji: '🌪️' }, { label: 'נִהְיָה חֹשֶׁךְ', emoji: '🌙' }])], true),
          L(`${C.name} ${c('פָּתַח', 'פָּתְחָה')} מִטְרִיָּה גְּדוֹלָה, וְהֵם עָמְדוּ מִתַּחְתֶּיהָ.`, 0),
          L('אַחֲרֵי כַּמָּה דַּקּוֹת, הַגֶּשֶׁם נִפְסַק.', 1),
        ]);
      }
      const ending: Part = [
        L(`בָּעֶרֶב, ${we} חָזְרוּ הַבַּיְתָה.`, 0, undefined, true),
        L(`${H.name} ${h('אָמַר', 'אָמְרָה')}: זֶה הָיָה טִיּוּל נֶהְדָּר!`, 0),
        L(`${h('הוּא סִפֵּר', 'הִיא סִפְּרָה')} ${teller.to} עַל ${fav.the}.`, 1, [F('detail', 'what', `עַל מָה ${h('סִפֵּר', 'סִפְּרָה')} ${H.name} ${teller.to}?`, sightOpt(fav), elsewhere.map(sightOpt))]),
        L(`בַּלַּיְלָה, ${h('הוּא חָלַם', 'הִיא חָלְמָה')} עַל הַטִּיּוּל.`, 2),
      ];
      return [intro, ...eps, ending];
    },
  };
}

/* ------------------------------------------------------------------ 3. baking a birthday cake */

const FLAVORS: Opt[] = [{ label: 'עוּגַת שׁוֹקוֹלָד', emoji: '🍫' }, { label: 'עוּגַת תּוּתִים', emoji: '🍓' }, { label: 'עוּגַת תַּפּוּזִים', emoji: '🍊' },
  { label: 'עוּגַת גֶּזֶר', emoji: '🥕' }, { label: 'עוּגַת תַּפּוּחִים', emoji: '🍎' }, { label: 'עוּגַת בָּנָנוֹת', emoji: '🍌' }, { label: 'עוּגַת גְּבִינָה', emoji: '🧀' }];
interface Need { a: string; got: string; src: Opt; extra: string; emoji: string }
const NEEDS: Need[] = [
  { a: 'בֵּיצִים', got: 'שָׁלֹשׁ בֵּיצִים', src: { label: 'מֵהַלּוּל', emoji: '🐔' }, extra: 'הַתַּרְנְגֹלוֹת קִרְקְרוּ: קוּד קוּד!', emoji: '🥚' },
  { a: 'קֶמַח', got: 'שַׂקִּית קֶמַח', src: { label: 'מֵהַמַּכֹּלֶת', emoji: '🛒' }, extra: 'בַּמַּכֹּלֶת הָיָה תּוֹר אָרֹךְ.', emoji: '🌾' },
  { a: 'חָלָב', got: 'בַּקְבּוּק חָלָב', src: { label: 'מֵהַשְּׁכֵנָה', emoji: '🏠' }, extra: 'הַשְּׁכֵנָה חִיְּכָה וְאָמְרָה: בְּתֵאָבוֹן!', emoji: '🥛' },
  { a: 'סֻכָּר', got: 'קֻפְסַת סֻכָּר', src: { label: 'מֵהָאָרוֹן הַגָּבוֹהַּ', emoji: '🗄️' }, extra: 'הָאָרוֹן הָיָה גָּבוֹהַּ, וְהָיָה צָרִיךְ לַעֲלוֹת עַל כִּסֵּא.', emoji: '🧂' },
  { a: 'חֶמְאָה', got: 'חֲתִיכַת חֶמְאָה', src: { label: 'מֵהַמְּקָרֵר', emoji: '🧊' }, extra: 'הַחֶמְאָה הָיְתָה קָרָה וְקָשָׁה.', emoji: '🧈' },
  { a: 'שׁוֹקוֹלָד', got: 'חֲפִיסַת שׁוֹקוֹלָד', src: { label: 'מֵהַמְּגֵרָה', emoji: '🗃️' }, extra: 'הַשּׁוֹקוֹלָד הֵרִיחַ מָתוֹק מְאֹד.', emoji: '🍫' },
  { a: 'תּוּתִים', got: 'סַל תּוּתִים', src: { label: 'מֵהַגִּנָּה', emoji: '🌱' }, extra: 'הַתּוּתִים הָיוּ אֲדֻמִּים וּמְתוּקִים.', emoji: '🍓' },
];
const DECOR: (Opt & { w: string })[] = [
  { label: 'סֻכָּרִיּוֹת', w: 'בְּסֻכָּרִיּוֹת', emoji: '🍬' }, { label: 'תּוּתִים', w: 'בְּתוּתִים', emoji: '🍓' },
  { label: 'פְּרָחִים', w: 'בִּפְרָחִים', emoji: '🌸' }, { label: 'כּוֹכָבִים', w: 'בְּכוֹכָבִים', emoji: '⭐' },
];
const CANDLES = [3, 4, 5, 6];

function bakePlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const R = rng.pick(FAMILY), r = sw(R);
  const helper = rng.pick(FAMILY.filter((f) => f !== R)), hp = sw(helper);
  const flavor = rng.pick(FLAVORS);
  const needs = rng.shuffle(NEEDS);
  const decor = rng.pick(DECOR);
  const candles = rng.pick(CANDLES);
  const candleOpt = (x: number): Opt => ({ label: `${NUM[x][0]} נֵרוֹת`, emoji: '🕯️'.repeat(x) });
  const order = rng.shuffle(ORDER_NEXT);
  return {
    title: `עוּגָה ${R.to}`,
    k: [0, NEEDS.length],
    parts: (k) => {
      const got = needs.slice(0, k);
      const intro: Part = [
        L(`מָחָר יוֹם הֻלֶּדֶת ${R.to}.`, 0, [F('literal', 'who', 'לְמִי יֵשׁ יוֹם הֻלֶּדֶת?', whoOpt(R), others(FAMILY, [R]).map(whoOpt))]),
        L(`${H.name} ${h('רָצָה', 'רָצְתָה')} לֶאֱפוֹת ${R.to} ${flavor.label}.`, 0, [F('literal', 'what', `אֵיזוֹ עוּגָה ${h('אָפָה', 'אָפְתָה')} ${H.name}?`, flavor, FLAVORS.filter((x) => x !== flavor))], true),
        L(`${h('הוּא פָּתַח', 'הִיא פָּתְחָה')} סֵפֶר מַתְכּוֹנִים.`, 1),
        L(`${h('הוּא לָבַשׁ', 'הִיא לָבְשָׁה')} סִנָּר, ${h('וְרָחַץ', 'וְרָחֲצָה')} יָדַיִם.`, 2),
      ];
      const eps: Part[] = got.map((nd, i) => [
        L(`${i === 0 ? 'קֹדֶם כֹּל' : order[i % order.length]}, ${H.name} ${h('הֵבִיא', 'הֵבִיאָה')} ${nd.got} ${nd.src.label}.`, 0, [
          F('detail', 'where', `מֵאֵיפֹה ${h('הֵבִיא', 'הֵבִיאָה')} ${H.name} ${nd.a}?`, nd.src, NEEDS.filter((x) => x !== nd).map((x) => x.src)),
          ...(i === 0 ? [F('detail', 'order', `מָה ${h('הֵבִיא', 'הֵבִיאָה')} ${H.name} קֹדֶם כֹּל?`, { label: nd.a, emoji: nd.emoji }, NEEDS.filter((x) => x !== nd).map((x) => ({ label: x.a, emoji: x.emoji })))] : []),
        ], true),
        L(nd.extra, i % 2 ? 2 : 1),
      ]);
      if (k >= 2) {
        eps.push([
          L(`${H.name} ${h('עִרְבֵּב', 'עִרְבְּבָה')} הַכֹּל בִּקְעָרָה גְּדוֹלָה.`, 0, undefined, true),
          L(`${helper.name} ${hp('הִכְנִיס', 'הִכְנִיסָה')} אֶת הָעוּגָה לַתַּנּוּר.`, 0, [F('literal', 'who', `מִי עָזַר ${H.to} עִם הַתַּנּוּר?`, whoOpt(helper), others(FAMILY, [helper]).map(whoOpt))]),
          L('כָּל הַבַּיִת הֵרִיחַ טוֹב.', 1),
        ]);
      }
      if (k >= 4) {
        eps.push([
          L('פִּתְאוֹם, הֶחָתוּל קָפַץ עַל הַשֻּׁלְחָן!', 0, [F('detail', 'who', 'מִי קָפַץ עַל הַשֻּׁלְחָן?', { label: 'הֶחָתוּל', emoji: '🐈' }, [{ label: 'הַכֶּלֶב', emoji: '🐕' }, { label: 'הַתֻּכִּי', emoji: '🦜' }, { label: 'הָאַרְנֶבֶת', emoji: '🐰' }])], true),
          L(`${H.name} ${h('תָּפַס', 'תָּפְסָה')} אֶת הַקְּעָרָה בָּרֶגַע הָאַחֲרוֹן.`, 0),
          L(`${h('הוּא צָחַק', 'הִיא צָחֲקָה')} ${h('וְאָמַר', 'וְאָמְרָה')}: חָתוּל שׁוֹבָב!`, 2),
        ]);
      }
      const ending: Part = [
        L(`${H.name} ${h('קִשֵּׁט', 'קִשְּׁטָה')} אֶת הָעוּגָה ${decor.w}.`, 0, [F('detail', 'what', `בַּמֶּה ${h('קִשֵּׁט', 'קִשְּׁטָה')} ${H.name} אֶת הָעוּגָה?`, decor, DECOR.filter((x) => x !== decor))], true),
        L(`${R.name} ${r('שָׂמַח', 'שָׂמְחָה')} מְאֹד מֵהָעוּגָה.`, 0, undefined, true),
        L(`${r('הוּא נָשַׁף', 'הִיא נָשְׁפָה')} עַל ${NUM[candles][0]} נֵרוֹת.`, 1, [F('detail', 'count', `עַל כַּמָּה נֵרוֹת ${r('נָשַׁף', 'נָשְׁפָה')} ${R.name}?`, candleOpt(candles), CANDLES.filter((x) => x !== candles).map(candleOpt))]),
        L('כֻּלָּם שָׁרוּ: הַיּוֹם יוֹם הֻלֶּדֶת!', 2),
        L(`${R.name} ${r('אָמַר', 'אָמְרָה')}: זֹאת הָעוּגָה הֲכִי טְעִימָה בָּעוֹלָם!`, 1),
      ];
      const wait: Part = [
        L(`${H.name} ${h('חִכָּה', 'חִכְּתָה')} לְיַד הַתַּנּוּר, ${h('וְהִסְתַּכֵּל', 'וְהִסְתַּכְּלָה')} בָּעוּגָה שֶׁתָּפְחָה.`, 0, undefined, true),
        L('אַחֲרֵי חֲצִי שָׁעָה, הַשָּׁעוֹן צִלְצֵל: טִין!', 1),
        L('הָעוּגָה יָצְאָה חוּמָה וְיָפָה.', 2),
        L(`${H.name} ${h('חִכָּה', 'חִכְּתָה')} שֶׁהִיא תִּתְקַרֵּר.`, 3),
      ];
      return [intro, ...eps, ...(k >= 3 ? [wait] : []), ending];
    },
  };
}

/* ------------------------------------------------------------------ 4. a flowerpot */

interface Plant { name: string; the: string; g: Gn; emoji: string; color: Color }
const colorOf = (m: string): Color => COLORS.find((c) => c.m === m)!;
const PLANTS: Plant[] = [
  { name: 'חַמָּנִיָּה', the: 'הַחַמָּנִיָּה', g: 'f', emoji: '🌻', color: colorOf('צָהֹב') },
  { name: 'וֶרֶד', the: 'הַוֶּרֶד', g: 'm', emoji: '🌹', color: colorOf('אָדֹם') },
  { name: 'צִבְעוֹנִי', the: 'הַצִּבְעוֹנִי', g: 'm', emoji: '🌷', color: PINK },
  { name: 'חַרְצִית', the: 'הַחַרְצִית', g: 'f', emoji: '🌼', color: colorOf('לָבָן') },
  { name: 'עַגְבָנִיָּה', the: 'הָעַגְבָנִיָּה', g: 'f', emoji: '🍅', color: colorOf('אָדֹם') },
  { name: 'דְּלַעַת', the: 'הַדְּלַעַת', g: 'f', emoji: '🎃', color: colorOf('כָּתֹם') },
  { name: 'מְלָפְפוֹן', the: 'הַמְּלָפְפוֹן', g: 'm', emoji: '🥒', color: colorOf('יָרֹק') },
  { name: 'תּוּת', the: 'הַתּוּת', g: 'm', emoji: '🍓', color: colorOf('אָדֹם') },
];
interface Visitor { label: string; emoji: string; landed: string; go: string }
const VISITORS: Visitor[] = [
  { label: 'צִפּוֹר קְטַנָּה', emoji: '🐦', landed: 'נָחֲתָה', go: 'עוּפִי' },
  { label: 'פַּרְפַּר', emoji: '🦋', landed: 'נָחַת', go: 'עוּף' },
  { label: 'דְּבוֹרָה', emoji: '🐝', landed: 'נָחֲתָה', go: 'עוּפִי' },
  { label: 'שַׁבְּלוּל', emoji: '🐌', landed: 'טִפֵּס', go: 'לֵךְ' },
];

function gardenPlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const giver = rng.pick(FAMILY), gv = sw(giver);
  const R = rng.pick(FAMILY), r = sw(R);
  const P = rng.pick(PLANTS), pp = sw(P);
  const pot = rng.pick(COLORS);
  const V = rng.pick(VISITORS);
  const pal = rng.pick(KIDS.filter((x) => x !== H)), pl = sw(pal);
  const before = rng.shuffle(['sun', 'rain', 'visit', 'water2', 'wind', 'friend']);
  const plantOpt = (x: Plant): Opt => ({ label: x.name, emoji: x.emoji });
  const day = (kind: string, d: number, n: number): Part => {
    const when = DAYS[d];
    switch (kind) {
      case 'water': return [L(`${when}, ${H.name} ${h('הִשְׁקָה', 'הִשְׁקְתָה')} אֶת הֶעָצִיץ.`, 0, undefined, true), L(`${h('הוּא נָתַן', 'הִיא נָתְנָה')} לוֹ קְצָת מַיִם, לֹא יוֹתֵר מִדַּי.`, 2)];
      case 'water2': return [L(`${when}, ${H.name} ${h('הִשְׁקָה', 'הִשְׁקְתָה')} שׁוּב, ${h('וְשָׁר', 'וְשָׁרָה')} לַזְּרָעִים שִׁיר.`, 0, undefined, true)];
      case 'sun': return [L(`${when}, הַשֶּׁמֶשׁ הָיְתָה חֲזָקָה מְאֹד.`, 0, undefined, true), L(`${H.name} ${h('הֵזִיז', 'הֵזִיזָה')} אֶת הֶעָצִיץ לַצֵּל.`, 1)];
      case 'rain': return [L(`${when}, יָרַד גֶּשֶׁם, וְלֹא הָיָה צָרִיךְ לְהַשְׁקוֹת.`, 0, undefined, true), L(`${H.name} ${h('הִסְתַּכֵּל', 'הִסְתַּכְּלָה')} בַּטִּפּוֹת מֵהַחַלּוֹן.`, 2)];
      case 'visit': return [
        L(`${when}, ${V.label} ${V.landed} עַל הֶעָצִיץ.`, 0, [F('detail', 'who', 'מִי בָּא לְבַקֵּר בֶּעָצִיץ?', { label: V.label, emoji: V.emoji }, [...VISITORS.filter((x) => x !== V).map((x) => ({ label: x.label, emoji: x.emoji })), { label: 'חָתוּל', emoji: '🐈' }])], true),
        L(`${H.name} ${h('אָמַר', 'אָמְרָה')} בְּשֶׁקֶט: ${V.go} מִכָּאן, אֵלֶּה הַזְּרָעִים שֶׁלִּי!`, 1),
      ];
      case 'sprout': return [
        L(`${when}, יָצָא מֵהָאֲדָמָה נֶבֶט יָרֹק וְקָטָן!`, 0, d > 0 ? [F('detail', 'when', 'מָתַי יָצָא הַנֶּבֶט מֵהָאֲדָמָה?', { label: when }, DAYS.slice(0, Math.max(n, 4)).filter((x) => x !== when).map((x) => ({ label: x })))] : undefined, true),
        L(`${H.name} ${h('קָפַץ', 'קָפְצָה')} מִשִּׂמְחָה.`, 1),
      ];
      case 'wind': return [L(`${when}, נָשְׁבָה רוּחַ חֲזָקָה.`, 0, undefined, true), L(`${H.name} ${h('הִכְנִיס', 'הִכְנִיסָה')} אֶת הֶעָצִיץ הַבַּיְתָה.`, 1), L('הָעֲצִיץ לֹא נָפַל.', 3)];
      case 'friend': return [
        L(`${when}, ${pal.name} ${pl('בָּא', 'בָּאָה')} לִרְאוֹת אֶת הֶעָצִיץ.`, 0, [F('detail', 'who', 'מִי בָּא לִרְאוֹת אֶת הֶעָצִיץ?', whoOpt(pal), KIDS.filter((x) => x !== pal && x !== H).slice(0, 6).map(whoOpt))], true),
        L(`${pal.name} ${pl('אָמַר', 'אָמְרָה')}: עוֹד מְעַט זֶה יִגְדַּל!`, 1),
        L(`${H.name} ${pal.and} שִׂחֲקוּ בַּגִּנָּה.`, 3),
      ];
      case 'measure': return [L(`${when}, ${H.name} ${h('מָדַד', 'מָדְדָה')} אֶת הַצֶּמַח עִם סַרְגֵּל.`, 0, undefined, true), L('הַצֶּמַח כְּבָר הָיָה גָּבוֹהַּ כְּמוֹ כּוֹס!', 1)];
      case 'leaves': return [L(`${when}, צָמְחוּ לַצֶּמַח עָלִים חֲדָשִׁים.`, 0, undefined, true), L('הָעָלִים הָיוּ יְרֻקִּים וּמַבְרִיקִים.', 2)];
      default: return [L(`${when}, הוֹפִיעַ עַל הַצֶּמַח נִצָּן קָטָן.`, 0, undefined, true), L(`${H.name} ${h('סָפַר', 'סָפְרָה')} אֶת הַיָּמִים עַד שֶׁיִּפְתַּח.`, 2)];
    }
  };
  return {
    title: `הֶעָצִיץ שֶׁל ${H.name}`,
    k: [1, 10],
    parts: (k) => {
      // the growth order is fixed: care days, then the sprout, then leaves and a bud
      const after = ['measure', 'leaves', 'bud'].slice(0, Math.min(3, Math.floor((k - 1) / 2)));
      const pre = k >= 2 ? ['water', ...before].slice(0, k - 1 - after.length) : [];
      const kinds = [...pre, 'sprout', ...after];
      const intro: Part = [
        L(`${H.name} ${h('קִבֵּל', 'קִבְּלָה')} ${giver.from} שַׂקִּית זְרָעִים.`, 0, [F('literal', 'who', `מִמִּי ${h('קִבֵּל', 'קִבְּלָה')} ${H.name} אֶת הַזְּרָעִים?`, whoOpt(giver), others(FAMILY, [giver]).map(whoOpt))], true),
        L(`${h('הוּא שָׁתַל', 'הִיא שָׁתְלָה')} אוֹתָם בְּעָצִיץ ${pot.m}.`, 1, [F('detail', 'color', 'בְּאֵיזֶה צֶבַע הָיָה הֶעָצִיץ?', { label: pot.m, emoji: pot.emoji }, COLORS.filter((x) => x !== pot).map((x) => ({ label: x.m, emoji: x.emoji })))], true),
        L(`${h('הוּא שָׂם', 'הִיא שָׂמָה')} אֶת הֶעָצִיץ עַל אֶדֶן הַחַלּוֹן.`, 2),
        L(`${giver.name} ${gv('אָמַר', 'אָמְרָה')}: צָרִיךְ סַבְלָנוּת!`, 3),
      ];
      const ending: Part = [
        L(`בַּסּוֹף, ${pp('צָמַח', 'צָמְחָה')} בֶּעָצִיץ ${P.name} ${P.color[P.g]}!`, 0, [
          F('literal', 'what', 'מָה צָמַח בֶּעָצִיץ?', plantOpt(P), PLANTS.filter((x) => x !== P).map(plantOpt)),
          F('detail', 'color', `בְּאֵיזֶה צֶבַע ${pp('הָיָה', 'הָיְתָה')} ${P.the}?`, { label: P.color[P.g], emoji: P.color.emoji }, [...COLORS, PINK].filter((x) => x.m !== P.color.m).map((x) => ({ label: x[P.g], emoji: x.emoji }))),
        ], true),
        L(`${H.name} ${h('נָתַן', 'נָתְנָה')} אֶת ${P.the} ${R.to}.`, 0, [F('literal', 'who', `לְמִי ${h('נָתַן', 'נָתְנָה')} ${H.name} אֶת ${P.the}?`, whoOpt(R), others(FAMILY, [R]).map(whoOpt))], true),
        L(`${R.name} ${r('אָמַר', 'אָמְרָה')}: אֵיזֶה יֹפִי! תּוֹדָה!`, 1),
        L(`${H.name} ${h('הֶחְלִיט', 'הֶחְלִיטָה')} לִשְׁתֹּל עוֹד זְרָעִים.`, 2),
      ];
      intro.push(L(`${H.name} ${h('שָׁאַל', 'שָׁאֲלָה')}: מָה יִצְמַח מֵהַזְּרָעִים?`, 2), L(`${giver.name} ${gv('חִיֵּךְ', 'חִיְּכָה')}, ${gv('וְלֹא גִּלָּה', 'וְלֹא גִּלְּתָה')}.`, 3));
      ending.push(L(`${h('הוּא צִיֵּר', 'הִיא צִיְּרָה')} תְּמוּנָה שֶׁל ${P.the}.`, 3));
      return [intro, ...kinds.map((kind, d) => day(kind, d, k)), ending];
    },
  };
}

/* ------------------------------------------------------------------ 5. a birthday party */

const GIFTS: Opt[] = [
  { label: 'כַּדּוּר חָדָשׁ', emoji: '⚽' }, { label: 'סֵפֶר עִם תְּמוּנוֹת', emoji: '📖' }, { label: 'קֻפְסַת צְבָעִים', emoji: '🎨' },
  { label: 'פָּאזֶל גָּדוֹל', emoji: '🧩' }, { label: 'עֲפִיפוֹן', emoji: '🪁' }, { label: 'מְכוֹנִית צַעֲצוּעַ', emoji: '🚗' },
  { label: 'דּוּבִּי רַךְ', emoji: '🧸' }, { label: 'מִשְׂחַק קְלָפִים', emoji: '🃏' }, { label: 'כּוֹבַע מַצְחִיק', emoji: '🎩' },
  { label: 'רוֹבּוֹט קָטָן', emoji: '🤖' }, { label: 'גִּיטָרָה קְטַנָּה', emoji: '🎸' }, { label: 'תֹּף', emoji: '🥁' },
];
const GAMES_PLAYED: (Opt & { w: string })[] = [
  { label: 'מַחְבּוֹאִים', w: 'בְּמַחְבּוֹאִים', emoji: '🙈' }, { label: 'תּוֹפֶסֶת', w: 'בְּתוֹפֶסֶת', emoji: '🏃' },
  { label: 'כַּדּוּר', w: 'בְּכַדּוּר', emoji: '⚽' }, { label: 'כִּסְאוֹת מוּזִיקָלִיִּים', w: 'בְּכִסְאוֹת מוּזִיקָלִיִּים', emoji: '🪑' },
];
const AGES = ['חָמֵשׁ', 'שֵׁשׁ', 'שֶׁבַע', 'שְׁמוֹנֶה'];

function partyPlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const friends = rng.shuffle(KIDS.filter((x) => x !== H));
  const gifts = rng.shuffle(GIFTS);
  const parent = rng.pick(FAMILY), pa = sw(parent);
  const age = rng.pick(AGES);
  const balloons = rng.pick(COLORS);
  const game = rng.pick(GAMES_PLAYED);
  const order = rng.shuffle(ORDER_NEXT);
  return {
    title: `יוֹם הַהֻלֶּדֶת שֶׁל ${H.name}`,
    k: [1, 8],
    parts: (k) => {
      const came = friends.slice(0, k);
      const intro: Part = [
        L(`הַיּוֹם יוֹם הֻלֶּדֶת ${H.to}!`, 0, undefined, true),
        L(`${h('הוּא בֶּן', 'הִיא בַּת')} ${age}.`, 0, [F('detail', 'count', `${h('בֶּן', 'בַּת')} כַּמָּה ${H.name}?`, { label: age }, AGES.filter((a) => a !== age).map((a) => ({ label: a })))]),
        L(`${h('הוּא הִזְמִין', 'הִיא הִזְמִינָה')} אֶת כָּל הַחֲבֵרִים לִמְסִבָּה.`, 1),
        L(`${parent.name} ${pa('תָּלָה', 'תָּלְתָה')} בָּלוֹנִים ${balloons.mp} בְּכָל הַבַּיִת.`, 2, [F('detail', 'color', 'בְּאֵיזֶה צֶבַע הָיוּ הַבָּלוֹנִים?', { label: balloons.mp, emoji: balloons.emoji }, COLORS.filter((x) => x !== balloons).map((x) => ({ label: x.mp, emoji: x.emoji })))]),
      ];
      const eps: Part[] = came.map((Fr, i) => {
        const f = sw(Fr), gift = gifts[i];
        return [
          L(i === 0 ? `${Fr.name} ${f('הִגִּיעַ רִאשׁוֹן', 'הִגִּיעָה רִאשׁוֹנָה')}.` : `${order[i % order.length]} ${f('הִגִּיעַ', 'הִגִּיעָה')} ${Fr.name}.`, 1,
            i === 0 ? [F('detail', 'order', 'מִי הִגִּיעַ רִאשׁוֹן לַמְּסִבָּה?', whoOpt(Fr), [...came.slice(1), ...friends.slice(k, k + 3)].map(whoOpt))] : undefined),
          L(`${Fr.name} ${f('הֵבִיא', 'הֵבִיאָה')} ${H.to} ${gift.label}.`, 0, [
            F('literal', 'what', `מָה ${f('הֵבִיא', 'הֵבִיאָה')} ${Fr.name}?`, gift, GIFTS.filter((x) => x !== gift)),
            F('detail', 'who', `מִי הֵבִיא ${gift.label}?`, whoOpt(Fr), friends.filter((x) => x !== Fr).map(whoOpt)),
          ], true),
          L(`${H.name} ${h('אָמַר', 'אָמְרָה')}: תּוֹדָה, ${Fr.name}!`, 2),
        ];
      });
      if (k >= 3) {
        const winner = rng.pick(came), w = sw(winner);
        eps.push([
          L(`אַחֲרֵי שֶׁכֻּלָּם הִגִּיעוּ, הַיְּלָדִים שִׂחֲקוּ ${game.w}.`, 0, [F('detail', 'what', 'בַּמֶּה שִׂחֲקוּ הַיְּלָדִים בַּמְּסִבָּה?', game, GAMES_PLAYED.filter((x) => x !== game))], true),
          L(`${winner.name} ${w('נִצַּח', 'נִצְּחָה')} בַּמִּשְׂחָק.`, 1, [F('detail', 'who', 'מִי נִצַּח בַּמִּשְׂחָק?', whoOpt(winner), [...came.filter((x) => x !== winner), H].map(whoOpt))]),
          L('כֻּלָּם צָחֲקוּ וְרָצוּ בְּכָל הַבַּיִת.', 2),
        ]);
      }
      const ending: Part = [
        L(`אַחַר כָּךְ ${parent.name} ${pa('הֵבִיא', 'הֵבִיאָה')} עוּגָה גְּדוֹלָה עִם נֵרוֹת.`, 0, [F('literal', 'who', 'מִי הֵבִיא אֶת הָעוּגָה?', whoOpt(parent), others(FAMILY, [parent]).map(whoOpt))], true),
        L(`${H.name} ${h('נָשַׁף', 'נָשְׁפָה')} עַל הַנֵּרוֹת, וְכֻלָּם מָחֲאוּ כַּפַּיִם.`, 0, undefined, true),
        L('זֶה הָיָה יוֹם הֻלֶּדֶת שָׂמֵחַ!', 1),
        L(`בַּלַּיְלָה, ${H.name} ${h('הָיָה עָיֵף', 'הָיְתָה עֲיֵפָה')}, אֲבָל ${h('שָׂמֵחַ', 'שְׂמֵחָה')}.`, 2, [F('detail', 'feel', `אֵיךְ ${h('הִרְגִּישׁ', 'הִרְגִּישָׁה')} ${H.name} בַּלַּיְלָה?`, feel(H, 'tired'), feels(H, ['angry', 'scared', 'hungry']))]),
      ];
      return [intro, ...eps, ending];
    },
  };
}

/* ------------------------------------------------------------------ 6. a rescue */

interface Stuck { a: string; the: string; to: string; emoji: string; sound: string; place: string; title: string; out: [string, string]; stay: string; where: Opt }
const STUCK: Stuck[] = [
  { a: 'חֲתַלְתּוּל קָטָן', the: 'הַחֲתַלְתּוּל', to: 'לַחֲתַלְתּוּל', emoji: '🐱', sound: 'מְיָאוּ, מְיָאוּ!', place: 'יָשַׁב עַל עָנָף גָּבוֹהַּ שֶׁל עֵץ', title: 'עַל הָעֵץ', out: ['וְהוֹרִיד', 'וְהוֹרִידָה'], stay: 'לָרֶדֶת', where: { label: 'עַל עֵץ גָּבוֹהַּ', emoji: '🌳' } },
  { a: 'חֲתַלְתּוּל קָטָן', the: 'הַחֲתַלְתּוּל', to: 'לַחֲתַלְתּוּל', emoji: '🐱', sound: 'מְיָאוּ, מְיָאוּ!', place: 'עָמַד עַל הַגַּג שֶׁל הַמַּחְסָן', title: 'עַל הַגַּג', out: ['וְהוֹרִיד', 'וְהוֹרִידָה'], stay: 'לָרֶדֶת', where: { label: 'עַל הַגַּג', emoji: '🏠' } },
  { a: 'כְּלַבְלַב קָטָן', the: 'הַכְּלַבְלַב', to: 'לַכְּלַבְלַב', emoji: '🐶', sound: 'הַב, הַב!', place: 'נָפַל לְתוֹךְ בּוֹר עָמֹק', title: 'בַּבּוֹר', out: ['וְהוֹצִיא', 'וְהוֹצִיאָה'], stay: 'לָצֵאת', where: { label: 'בְּתוֹךְ בּוֹר', emoji: '🕳️' } },
  { a: 'כְּלַבְלַב קָטָן', the: 'הַכְּלַבְלַב', to: 'לַכְּלַבְלַב', emoji: '🐶', sound: 'הַב, הַב!', place: 'נִתְקַע מֵאֲחוֹרֵי גָּדֵר גְּבוֹהָה', title: 'מֵאֲחוֹרֵי הַגָּדֵר', out: ['וְהוֹצִיא', 'וְהוֹצִיאָה'], stay: 'לָצֵאת', where: { label: 'מֵאֲחוֹרֵי גָּדֵר', emoji: '🚧' } },
];
const TOOLS: { a: string; fail: string; emoji: string }[] = [
  { a: 'סֻלָּם קָטָן', fail: 'אֲבָל הַסֻּלָּם הָיָה קָצָר מִדַּי.', emoji: '🪜' },
  { a: 'חֶבֶל', fail: 'אֲבָל הַחֶבֶל לֹא הָיָה אָרֹךְ מַסְפִּיק.', emoji: '🪢' },
  { a: 'סַל עִם אֹכֶל', fail: 'אֲבָל הַגּוּר פָּחַד לָזוּז.', emoji: '🧺' },
  { a: 'מַקֵּל אָרֹךְ', fail: 'אֲבָל הַמַּקֵּל לֹא עָזַר.', emoji: '🪵' },
  { a: 'כָּרִית גְּדוֹלָה', fail: 'אֲבָל הַגּוּר לֹא רָצָה לִקְפֹּץ.', emoji: '🛏️' },
];
const PET_NAMES: Opt[] = [{ label: 'שׁוֹקוֹ' }, { label: 'מִיצִי' }, { label: 'לוּלוּ' }, { label: 'פִּיצִי' }, { label: 'קוֹקוֹ' }, { label: 'בַּמְבָּה' }];

/** What the stuck animal does while each helper tries (a different line in every episode). */
const cryLine = (i: number, the: string, cry: string): string =>
  [`${the} רָעַד מִפַּחַד.`, `${the} קָרָא חָזָק: ${cry}`, `${the} חִכָּה וְחִכָּה.`, `${the} הִסְתַּכֵּל עֲלֵיהֶם בְּעֵינַיִם גְּדוֹלוֹת.`][(i - 1) % 4];

function rescuePlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const A = rng.pick(STUCK);
  const helpers = rng.shuffle([...FAMILY, ...NEIGHBORS]);
  const tools = rng.shuffle(TOOLS);
  const petName = rng.pick(PET_NAMES);
  const order = rng.shuffle(ORDER_NEXT);
  return {
    title: `${A.the} ${A.title}`,
    k: [0, 5],
    parts: (k) => {
      const tried = helpers.slice(0, k);
      const savior = k >= 2 ? FIREFIGHTER : helpers[k], sv = sw(savior);
      const intro: Part = [
        L(`${H.name} ${h('שָׁמַע', 'שָׁמְעָה')} קוֹל קָטָן: ${A.sound}`, 0, undefined, true),
        L(`${A.a} ${A.place}, וְלֹא יָכֹל ${A.stay}.`, 0, [
          F('literal', 'where', `אֵיפֹה הָיָה ${A.the}?`, A.where, [...STUCK.filter((x) => x.where.label !== A.where.label).map((x) => x.where), { label: 'בְּתוֹךְ הַבְּרֵכָה', emoji: '🏊' }]),
          F('literal', 'who', 'מִי הָיָה צָרִיךְ עֶזְרָה?', { label: A.a, emoji: A.emoji }, [{ label: 'גּוּר אַרְיוֹת', emoji: '🦁' }, { label: 'אֶפְרוֹחַ קָטָן', emoji: '🐥' }, { label: 'אַרְנָב קָטָן', emoji: '🐰' }, ...STUCK.filter((x) => x.a !== A.a).map((x) => ({ label: x.a, emoji: x.emoji }))]),
        ]),
        L(`${A.the} הָיָה מְפֻחָד.`, 1),
        L(`${H.name} ${h('רָץ', 'רָצָה')} לְהָבִיא עֶזְרָה.`, 1),
      ];
      const eps: Part[] = tried.map((Hp, i) => {
        const p = sw(Hp), T = tools[i];
        return [
          L(`${i === 0 ? 'קֹדֶם' : order[i % order.length]} ${p('בָּא', 'בָּאָה')} ${Hp.name} עִם ${T.a}.`, 0, i === 0 ? [
            F('literal', 'who', 'מִי בָּא לַעֲזֹר רִאשׁוֹן?', whoOpt(Hp), [...FAMILY, ...NEIGHBORS].filter((x) => x !== Hp).map(whoOpt)),
            F('detail', 'what', `מָה ${p('הֵבִיא', 'הֵבִיאָה')} ${Hp.name}?`, { label: T.a, emoji: T.emoji }, TOOLS.filter((x) => x !== T).map((x) => ({ label: x.a, emoji: x.emoji }))),
          ] : undefined, true),
          L(nfc(T.fail).replace(nfc('הַגּוּר'), A.the), 0),
          L(`${Hp.name} ${p('נִסָּה', 'נִסְּתָה')} שׁוּב וָשׁוּב.`, 2),
        ];
      });
      const ending: Part = [
        L(`לְבַסּוֹף ${sv('בָּא', 'בָּאָה')} ${savior.name} עִם סֻלָּם אָרֹךְ, ${A.out[savior.g === 'm' ? 0 : 1]} אֶת ${A.the} בִּזְהִירוּת.`, 0, [F('literal', 'who', `מִי הִצִּיל אֶת ${A.the}?`, whoOpt(savior), [...FAMILY, ...NEIGHBORS, FIREFIGHTER].filter((x) => x !== savior).map(whoOpt))], true),
        L(`${A.the} לִקֵּק אֶת הַיָּד שֶׁל ${H.name}.`, 0, undefined, true),
        L(`${H.name} ${h('נָתַן', 'נָתְנָה')} לוֹ קְצָת חָלָב.`, 1),
        L(`${h('הוּא קָרָא', 'הִיא קָרְאָה')} לוֹ בְּשֵׁם ${petName.label}.`, 1, [F('detail', 'what', `אֵיזֶה שֵׁם ${h('נָתַן', 'נָתְנָה')} ${H.name} ${A.to}?`, petName, PET_NAMES.filter((x) => x !== petName))]),
        L(`מֵאָז, ${A.the} גָּר אֵצֶל ${H.name}.`, 2),
      ];
      const cry = A.emoji === '🐱' ? 'מְיָאוּ!' : 'הַב!';
      eps.forEach((e, i) => e.splice(2, 0, i > 0 ? L(cryLine(i, A.the, cry), 1) : L(`${A.the} קָרָא שׁוּב: ${cry}`, 1)));
      intro.splice(1, 0, L(`${H.name} ${h('עָצַר', 'עָצְרָה')} ${h('וְהִקְשִׁיב', 'וְהִקְשִׁיבָה')}.`, 2));
      intro.push(L(`${h('הוּא קָרָא', 'הִיא קָרְאָה')}: אַל תִּפְחַד, אֲנַחְנוּ כָּאן!`, 3));
      ending.push(L('כֻּלָּם מָחֲאוּ כַּפַּיִם.', 2), L(`${H.name} ${h('הוֹדָה', 'הוֹדְתָה')} ${savior.to} עַל הַעֶזְרָה.`, 3));
      return [intro, ...eps, ending];
    },
  };
}

/* ------------------------------------------------------------------ 7. the market */

interface Buy { pl: string; g: Gn; emoji: string }
const BUYS: Buy[] = [
  { pl: 'תַּפּוּחִים', g: 'm', emoji: '🍎' }, { pl: 'בָּנָנוֹת', g: 'f', emoji: '🍌' }, { pl: 'תַּפּוּזִים', g: 'm', emoji: '🍊' },
  { pl: 'לִימוֹנִים', g: 'm', emoji: '🍋' }, { pl: 'עַגְבָנִיּוֹת', g: 'f', emoji: '🍅' }, { pl: 'מְלָפְפוֹנִים', g: 'm', emoji: '🥒' },
  { pl: 'אֲגָסִים', g: 'm', emoji: '🍐' }, { pl: 'גְּזָרִים', g: 'm', emoji: '🥕' }, { pl: 'חֲצִילִים', g: 'm', emoji: '🍆' },
  { pl: 'תּוּתִים', g: 'm', emoji: '🍓' }, { pl: 'בֵּיצִים', g: 'f', emoji: '🥚' }, { pl: 'פִּלְפְּלִים', g: 'm', emoji: '🫑' },
];
const FORGOT: Opt[] = [{ label: 'לֶחֶם', emoji: '🍞' }, { label: 'חָלָב', emoji: '🥛' }, { label: 'גְּבִינָה', emoji: '🧀' }, { label: 'אֹרֶז', emoji: '🍚' }];
const DISHES: Opt[] = [{ label: 'סָלָט גָּדוֹל', emoji: '🥗' }, { label: 'מִיץ טָרִי', emoji: '🧃' }, { label: 'מָרָק חַם', emoji: '🍲' }, { label: 'פַּשְׁטִידָה', emoji: '🥧' }];
const STALL_EXTRA = ['הַמּוֹכֵר צָעַק: טָרִי, טָרִי!', 'הַסַּל נַעֲשָׂה כָּבֵד.', 'בַּשּׁוּק הָיָה רַעַשׁ גָּדוֹל.', 'הֵם שָׂמוּ הַכֹּל בַּסַּל.', 'הַמּוֹכֶרֶת חִיְּכָה אֲלֵיהֶם.'];

/** More stall lines: with up to nine stalls every line is used at most once per story. */
const STALL_MORE = ['הָיָה רֵיחַ טוֹב שֶׁל פֵּרוֹת.', 'הֵם טָעֲמוּ קְצָת לִפְנֵי שֶׁקָּנוּ.', 'הַמּוֹכֵר נָתַן לָהֶם שַׂקִּית.', 'הֵם בָּחֲרוּ בִּזְהִירוּת.', 'הֵם שִׁלְּמוּ לַמּוֹכֵר.'];

function marketPlan(rng: Rng): Plan {
  const H = rng.pick(KIDS), h = sw(H);
  const C = rng.pick(FAMILY), c = sw(C);
  const buys = rng.shuffle(BUYS);
  const counts = buys.map(() => 2 + rng.int(5));
  const forgot = rng.pick(FORGOT);
  const dish = rng.pick(DISHES);
  const extras = rng.shuffle([...STALL_EXTRA, ...STALL_MORE]);
  const order = rng.shuffle(ORDER_NEXT);
  const we = `${H.name} ${C.and}`;
  return {
    title: `${H.name} בַּשּׁוּק`,
    k: [2, 9],
    parts: (k) => {
      const bought = buys.slice(0, k);
      const intro: Part = [
        L(`${we} הָלְכוּ לַשּׁוּק.`, 0, [F('literal', 'who', `עִם מִי ${h('הָלַךְ', 'הָלְכָה')} ${H.name} לַשּׁוּק?`, whoOpt(C), others(FAMILY, [C]).map(whoOpt))], true),
        L(`${C.name} ${c('כָּתַב', 'כָּתְבָה')} רְשִׁימָה אֲרֻכָּה.`, 1),
        L(`${H.name} ${h('הֶחְזִיק', 'הֶחְזִיקָה')} אֶת הַסַּל.`, 2),
      ];
      const eps: Part[] = bought.map((b, i) => [
        L(`${i === 0 ? 'קֹדֶם כֹּל' : order[i % order.length]} הֵם קָנוּ ${countOpt(counts[i], b).label}.`, 0, [
          F('detail', 'count', `כַּמָּה ${b.pl} הֵם קָנוּ?`, countOpt(counts[i], b), [2, 3, 4, 5, 6].filter((x) => x !== counts[i]).map((x) => countOpt(x, b))),
          ...(i === 0 ? [F('literal', 'order', 'מָה הֵם קָנוּ קֹדֶם כֹּל?', { label: b.pl, emoji: b.emoji }, BUYS.filter((x) => x !== b).map((x) => ({ label: x.pl, emoji: x.emoji })))] : []),
        ], true),
        L(extras[i % extras.length], 2),
      ]);
      if (k >= 4) {
        eps.push([
          L(`בַּבַּיִת, ${C.name} ${c('גִּלָּה', 'גִּלְּתָה')} שֶׁהֵם שָׁכְחוּ לִקְנוֹת ${forgot.label}.`, 0, [F('detail', 'what', 'מָה הֵם שָׁכְחוּ לִקְנוֹת?', forgot, [...FORGOT.filter((x) => x !== forgot), ...bought.slice(0, 2).map((b) => ({ label: b.pl, emoji: b.emoji }))])], true),
          L(`${H.name} ${h('רָץ', 'רָצָה')} לַמַּכֹּלֶת, ${h('וְקָנָה', 'וְקָנְתָה')} ${forgot.label}.`, 0),
          L(`${C.name} ${c('אָמַר', 'אָמְרָה')}: ${h('אֵיזֶה עוֹזֵר טוֹב!', 'אֵיזוֹ עוֹזֶרֶת טוֹבָה!')}`, 1),
        ]);
      }
      const ending: Part = [
        L(`בַּסּוֹף, ${we} הֵכִינוּ ${dish.label}.`, 0, [F('literal', 'what', `מָה הֵכִינוּ ${we} בַּסּוֹף?`, dish, DISHES.filter((x) => x !== dish))], true),
        L('הָיָה טָעִים מְאֹד!', 0),
        L(`${H.name} ${h('אָמַר', 'אָמְרָה')}: מָחָר נֵלֵךְ שׁוּב לַשּׁוּק!`, 1),
      ];
      intro.push(L('בַּשּׁוּק הָיוּ דּוּכָנִים צִבְעוֹנִיִּים.', 3));
      eps.push([L('בַּדֶּרֶךְ הַבַּיְתָה, הֵם עָצְרוּ לִשְׁתּוֹת מִיץ.', 3)]);
      ending.push(L(`${C.name} ${c('אָמַר', 'אָמְרָה')}: תּוֹדָה עַל הַעֶזְרָה!`, 2), L('אַחֲרֵי הַאֲרוּחָה, כֻּלָּם נָחוּ עַל הַסַּפָּה.', 3));
      return [intro, ...eps, ending];
    },
  };
}

/* ------------------------------------------------------------------ assembly */

const PLANS: Record<string, (rng: Rng) => Plan> = {
  lost: lostPlan, trip: tripPlan, bake: bakePlan, garden: gardenPlan, party: partyPlan, rescue: rescuePlan, market: marketPlan,
};
export const SCHEMAS: string[] = Object.keys(PLANS);
export type Schema = string;

/** Keep every core line, then add extra lines by priority (in story order) until the story has `target` sentences. */
function choose(parts: Part[], target: number): Part[] | null {
  const all = parts.flat();
  if (all.filter((l) => l.p === 0).length > target) return null;
  const keep = new Set(all.filter((l) => l.p === 0));
  for (let pr = 1; pr <= 3 && keep.size < target; pr++) for (const l of all) if (l.p === pr && keep.size < target) keep.add(l);
  return parts.map((p) => p.filter((l) => keep.has(l))).filter((p) => p.length);
}

/** One story of the given plan and level. Prefers the longest plot whose core lines leave about a third of the story
    for optional detail lines (so easy levels are not just lists); otherwise the longest plot that fits. */
export function makeStory(schema: Schema, level: StoryLevel, seed: number): GenStory {
  const target = STORY_LENGTH[level];
  let best: Part[] = [], bestLen = -1, title = '', roomy: Part[] | null = null;
  for (let k = 0; k <= 10; k++) {
    const plan = PLANS[schema](makeRng(seed * 7919 + SCHEMAS.indexOf(schema) * 104729 + level));
    if (k < plan.k[0] || k > plan.k[1]) continue;
    const parts = plan.parts(k);
    const picked = choose(parts, target);
    if (!picked) break;
    const len = picked.flat().length;
    const core = parts.flat().filter((l) => l.p === 0).length;
    if (len === target && core <= Math.ceil(target * 0.7)) roomy = picked;
    if (len >= bestLen) { best = picked; bestLen = len; }
    title = plan.title;
  }
  if (roomy) best = roomy;
  const lines = best.flat();
  const fixOpt = (o: Opt): Opt => ({ ...o, label: nfc(o.label) });
  return {
    id: `g:${schema}:${level}:${seed}`,
    title: nfc(title),
    level,
    paragraphs: best.map((p) => p.map((l) => nfc(l.t))),
    facts: lines.flatMap((l) => l.facts ?? []).map((f) => ({ ...f, q: nfc(f.q), a: fixOpt(f.a), pool: f.pool.map(fixOpt) })),
    events: lines.filter((l) => l.ev).map((l) => nfc(l.t)),
  };
}

/** All words of a generated story (for content checks). */
export const genStoryWords = (s: GenStory): string[] => s.paragraphs.flat().flatMap((t) => textWords(t));
