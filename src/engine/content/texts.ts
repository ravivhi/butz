/* Sight words and sentences (stories live in stories.ts). All text passes the automatic nikud checks (lintText) and was
   proofread: review = 'checked'; a native-speaker teacher can mark items 'reviewed' (SPEC R-H9). */
import { analyzeWord, nfc, textWords } from '../hebrew.ts';

export interface SightWord { id: string; text: string; en: string; units: string[] }
// No homophones in this list (e.g. עִם/אִם, לֹא/לוֹ): Word Collector says a word and the child must find the one spelling.
const SIGHT_ROWS: [string, string, string][] = [
  ['shel', 'שֶׁל', 'of'], ['im', 'עִם', 'with'], ['yesh', 'יֵשׁ', 'there is'], ['ein', 'אֵין', 'there is not'],
  ['lo', 'לֹא', 'no'], ['ken', 'כֵּן', 'yes'], ['gam', 'גַּם', 'also'], ['hu', 'הוּא', 'he'], ['hi', 'הִיא', 'she'],
  ['et', 'אֶת', 'object marker'], ['al', 'עַל', 'on'], ['ma', 'מָה', 'what'], ['mi', 'מִי', 'who'], ['ze', 'זֶה', 'this'],
  ['zot', 'זֹאת', 'this (f)'], ['sham', 'שָׁם', 'there'], ['po', 'פֹּה', 'here'], ['kan', 'כָּאן', 'here'], ['ata', 'אַתָּה', 'you'],
  ['hem', 'הֵם', 'they'], ['tov', 'טוֹב', 'good'], ['gadol', 'גָּדוֹל', 'big'], ['katan', 'קָטָן', 'small'], ['yafe', 'יָפֶה', 'pretty'],
  ['li', 'לִי', 'to me'], ['ani', 'אֲנִי', 'I'],
  ['kol', 'כָּל', 'all'], ['kmo', 'כְּמוֹ', 'like'], ['ad', 'עַד', 'until'], ['el', 'אֶל', 'to'], ['az', 'אָז', 'then'],
  ['aval', 'אֲבָל', 'but'], ['ki', 'כִּי', 'because'], ['od', 'עוֹד', 'more'], ['rak', 'רַק', 'only'], ['kvar', 'כְּבָר', 'already'],
  ['eifo', 'אֵיפֹה', 'where'], ['lama', 'לָמָּה', 'why'], ['matai', 'מָתַי', 'when'], ['eikh', 'אֵיךְ', 'how'], ['hine', 'הִנֵּה', 'here is'],
  ['anahnu', 'אֲנַחְנוּ', 'we'], ['at', 'אַתְּ', 'you (f)'], ['hen', 'הֵן', 'they (f)'], ['la', 'לָהּ', 'to her'], ['sheli', 'שֶׁלִּי', 'mine'],
  ['hayom', 'הַיּוֹם', 'today'], ['tamid', 'תָּמִיד', 'always'], ['harbe', 'הַרְבֵּה', 'a lot'], ['meat', 'מְעַט', 'a little'],
  ['ehad', 'אֶחָד', 'one'], ['shtayim', 'שְׁתַּיִם', 'two'], ['toda', 'תּוֹדָה', 'thank you'], ['shalom', 'שָׁלוֹם', 'hello'],
  ['bevakasha', 'בְּבַקָּשָׁה', 'please'],
];
export const SIGHT_WORDS: SightWord[] = SIGHT_ROWS.map(([id, text, en]) => ({ id, text: nfc(text), en, units: analyzeWord(text).units }));

export interface Sentence {
  id: string;
  text: string;
  phrases: string[];   // phrase split for Phrase Train
  words: string[];     // tokens
  pic: string;         // emoji scene that shows the meaning
  units: string[];     // union of units of all tokens
  review: 'checked' | 'reviewed';
}
// Ordered roughly by when they become readable along the spine. Pictures never repeat (meaning questions stay fair).
const SENT_ROWS: [string, string, string][] = [
  ['s_shir', 'יֵשׁ לִי | שִׁיר.', '🎶'],
  ['s_gamal', 'הַגָּמָל | שָׁר.', '🐫🎵'],
  ['s_nahar', 'הַדָּג | בַּנָּהָר.', '🐟🏞️'],
  ['s_halav', 'יֵשׁ לִי | חָלָב.', '🥛'],
  ['s_marak', 'הַמָּרָק | חַם.', '🍲🔥'],
  ['s_yam_kar', 'הַיָּם | קַר.', '🌊🥶'],
  ['s_shiri', 'שִׁירִי | בַּגַּן.', '👧🌳'],
  ['s_dag', 'דָּג | בַּיָּם.', '🐟🌊'],
  ['s_shalom_dov', 'שָׁלוֹם, | דֹּב!', '👋🐻'],
  ['s_saba_omer', 'סַבָּא | אוֹמֵר | שָׁלוֹם.', '👴👋'],
  ['s_dov_bayit', 'הַדֹּב | בַּבַּיִת.', '🐻🏠'],
  ['s_aba', 'אַבָּא | בַּבַּיִת.', '👨🏠'],
  ['s_balon', 'יֵשׁ לִי | בָּלוֹן.', '🎈'],
  ['s_pil', 'הַפִּיל | גָּדוֹל.', '🐘'],
  ['s_kadur_gag', 'הַכַּדּוּר | עַל הַגַּג.', '⚽🏘️'],
  ['s_kipod', 'הַקִּפּוֹד | בַּגִּנָּה.', '🦔🌿'],
  ['s_hatul_kise', 'הַחָתוּל | עַל הַכִּסֵּא.', '🐈🪑'],
  ['s_shira', 'שִׁירָה | צוֹחֶקֶת.', '👧😂'],
  ['s_tinok', 'הַתִּינוֹק | יָשֵׁן.', '👶💤'],
  ['s_kelev_rats', 'הַכֶּלֶב | רָץ.', '🐕💨'],
  ['s_hatul', 'הַחָתוּל | יָשֵׁן.', '🐈💤'],
  ['s_tavas', 'הַטַּוָּס | יָפֶה.', '🦚'],
  ['s_kof', 'הַקּוֹף | אוֹכֵל בָּנָנָה.', '🐒🍌'],
  ['s_kelev_gina', 'הַכֶּלֶב רָץ | בַּגִּנָּה.', '🐕🌳'],
  ['s_saba', 'סַבָּא וְסַבְתָּא | בַּגַּן.', '👴👵'],
  ['s_yeled', 'הַיֶּלֶד | קוֹרֵא סֵפֶר.', '👦📖'],
  ['s_tsipor', 'הַצִּפּוֹר | שָׁרָה שִׁיר.', '🐦🎵'],
  ['s_shemesh', 'הַשֶּׁמֶשׁ | חַמָּה.', '☀️'],
  ['s_dana', 'דָּנָה | אוֹכֶלֶת גְּלִידָה.', '👧🍦'],
  ['s_sus', 'הַסּוּס | רָץ מַהֵר.', '🐎'],
  ['s_kadur', 'יֵשׁ לִי | כַּדּוּר אָדֹם.', '⚽'],
  ['s_dag_mayim', 'הַדָּג | שׂוֹחֶה בַּמַּיִם.', '🐠💧'],
  ['s_ima', 'אִמָּא נוֹתֶנֶת לִי | תּוּת.', '👩🍓'],
  ['s_uga', 'יֵשׁ עוּגָה | עַל הַשֻּׁלְחָן.', '🎂'],
  ['s_parpar', 'הַפַּרְפַּר | עָף | בֵּין הַפְּרָחִים.', '🦋🌸'],
  ['s_arnav', 'הָאַרְנָב | אוֹכֵל גֶּזֶר.', '🐰🥕'],
  ['s_ofanayim', 'הַיַּלְדָּה | רוֹכֶבֶת | עַל אוֹפַנַּיִם.', '👧🚲'],
  ['s_aba_marak', 'אַבָּא | מְבַשֵּׁל | מָרָק.', '👨🍲'],
  ['s_tanin', 'הַתַּנִּין | שׂוֹחֶה | בַּנָּהָר.', '🐊🏞️'],
  ['s_savta', 'סַבְתָּא | סוֹרֶגֶת | צָעִיף.', '👵🧶'],
  ['s_dvora', 'הַדְּבוֹרָה | עַל הַפֶּרַח.', '🐝🌼'],
  ['s_migdal', 'הַיֶּלֶד | בּוֹנֶה | מִגְדָּל.', '👦🧱'],
  ['s_shoter', 'הַשּׁוֹטֵר | עוֹצֵר | אֶת הַמְּכוֹנִית.', '👮🚗'],
  ['s_rakevet', 'הָרַכֶּבֶת | נוֹסַעַת | מַהֵר.', '🚂💨'],
  ['s_tarnegol', 'הַתַּרְנְגוֹל | קוֹרֵא | בַּבֹּקֶר.', '🐓🌅'],
  ['s_yareah', 'הַיָּרֵחַ | זוֹרֵחַ | בַּלַּיְלָה.', '🌙✨'],
  ['s_kabaim', 'הַכַּבָּאִים | מְכַבִּים | אֶת הָאֵשׁ.', '🚒🔥'],
  ['s_tinoket', 'הַתִּינוֹקֶת | בּוֹכָה.', '👶😢'],
  ['s_rofe', 'הָרוֹפֵא | בּוֹדֵק | אֶת הַדֹּב.', '🩺🧸'],
  ['s_keshet', 'נוֹעָה | מְצַיֶּרֶת | קֶשֶׁת.', '👧🌈'],
  ['s_iton', 'הַכֶּלֶב | מֵבִיא | אֶת הָעִתּוֹן.', '🐕📰'],
  ['s_ima_sipur', 'אִמָּא | קוֹרֵאת לִי | סִפּוּר.', '👩📖'],
  ['s_dolfin', 'הַדּוֹלְפִין | קוֹפֵץ | מֵהַמַּיִם.', '🐬💦'],
  ['s_pil_nahar', 'הַפִּיל | מִתְרַחֵץ | בַּנָּהָר.', '🐘🚿'],
  ['s_ken', 'הַצִּפּוֹר | בּוֹנָה קֵן | עַל הָעֵץ.', '🐦🌲'],
  ['s_glida', 'הַגְּלִידָה | נָמֵסָה | בַּשֶּׁמֶשׁ.', '🍦☀️'],
  ['s_yeladim', 'הַיְּלָדִים | מְשַׂחֲקִים | בַּכַּדּוּר.', '👧👦⚽'],
  ['s_traktor', 'סַבָּא | נוֹהֵג | בַּטְּרַקְטוֹר.', '👴🚜'],
  ['s_halalit', 'הַחֲלָלִית | טָסָה | לַיָּרֵחַ.', '🚀🌙'],
  ['s_sheleg', 'הַשֶּׁלֶג | לָבָן | וְקַר.', '⛄'],
  ['s_horef', 'בַּחֹרֶף | יוֹרֵד | הַרְבֵּה גֶּשֶׁם.', '🌧️☂️'],
  ['s_atsits', 'הַפֶּרַח | צָמַח | בָּעָצִיץ.', '🌷🪴'],
  ['s_nemalim', 'הַנְּמָלִים | סוֹחֲבוֹת | פֵּרוּרִים.', '🐜🍞'],
  ['s_robot', 'הָרוֹבּוֹט | רוֹקֵד | עִם הַבּוּבָּה.', '🤖🪆'],
  ['s_melekh', 'הַמֶּלֶךְ | יוֹשֵׁב | עַל הַכִּסֵּא.', '🤴👑'],
  ['s_yanshuf', 'הַיַּנְשׁוּף | עֵר | בַּלַּיְלָה.', '🦉🌙'],
  ['s_butz', 'בּוּץ | קוֹרֵא | סֵפֶר.', '🦉📚'],
  ['s_hayzar', 'הַחַיְזָר | נָחַת | בֶּחָצֵר.', '👽🛸'],
  ['s_pinguin', 'הַפִּינְגְּוִין | מַחְלִיק | עַל הַקֶּרַח.', '🐧🧊'],
  ['s_dino', 'הַדִּינוֹזָאוּר | אוֹכֵל | עָלִים.', '🦕🌿'],
  ['s_masait', 'הַמַּשָּׂאִית | מְבִיאָה | אֲבָנִים.', '🚚🪨'],
  ['s_sfarim', 'כֻּלָּם | אוֹהֲבִים | סְפָרִים.', '📚❤️'],
];
export const SENTENCES: Sentence[] = SENT_ROWS.map(([id, raw, pic]) => {
  const phrases = raw.split('|').map((p) => nfc(p.trim()));
  const text = phrases.join(' ');
  const words = textWords(text);
  const units = [...new Set(words.flatMap((w) => analyzeWord(w).units))].sort();
  return { id, text, phrases, words, pic, units, review: 'checked' };
});

export { STORIES, STORY, type Story, type StoryQuestion } from './stories.ts';
