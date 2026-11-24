/* Sticker notebooks (SPEC §10.2). Stickers are emoji on colored badges; ids are `<notebook>:<index>`.
   16 notebooks × 30 stickers. `gender` decides who sees a notebook in the shop ('all' = everyone). Emoji ≤ Unicode 13. */
import type { Gender } from '../phrases.ts';

export type NotebookGender = 'all' | Gender;
export interface Notebook { id: string; name: string; cover: string; color: string; gender: NotebookGender; starter: boolean; stickers: string[] }

// Space-separated lists: Hermes has no Intl.Segmenter, and ZWJ emoji must stay whole.
const nb = (id: string, name: string, cover: string, color: string, gender: NotebookGender, starter: boolean, list: string): Notebook =>
  ({ id, name: name.normalize('NFC'), cover, color, gender, starter, stickers: list.split(' ').filter(Boolean) });

export const NOTEBOOKS: Notebook[] = [
  nb('animals', 'חֲבֵרִים מֵהַחַיּוֹת', '🦁', '#FFB74D', 'all', true, '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐴 🦄 🐝 🐞 🐢 🐑 🐐 🐓 🦔 🐿️'),
  nb('dino', 'עוֹלַם הַדִּינוֹזָאוּרִים', '🦖', '#81C784', 'boy', true, '🦕 🦖 🐉 🐲 🌋 🦴 🥚 🌴 🌿 🍃 🦎 🐊 🐢 🌵 🏔️ 🦣 🦤 🪶 🐾 🌄 🍂 🌾 🦂 🐌 🪨 🌲 🌳 🐍 🦟 ☄️'),
  nb('magic', 'הַיַּעַר הַקָּסוּם', '🦄', '#BA68C8', 'girl', true, '🦄 🧚 🧙 🧜 🧞 🧝 🐉 ✨ 🔮 🪄 🌈 👑 💎 🏰 🍄 ⭐ 🌙 🦋 🌸 🧸 🎩 🐇 🦉 🕯️ 🧚‍♀️ 🧜‍♀️ 💫 🌟 🎆 🪞'),
  nb('sea', 'מִתַּחַת לַיָּם', '🐠', '#4FC3F7', 'all', false, '🐟 🐠 🐡 🦈 🐬 🐳 🐋 🐙 🦑 🦀 🦞 🦐 🐚 🐢 🦭 🐊 🌊 🏝️ ⛵ 🚤 ⚓ 🏖️ 🧜‍♀️ 🐧 🦦 🏄 🤿 🚣 🛶 🦩'),
  nb('space', 'חוֹקְרֵי הֶחָלָל', '🚀', '#7986CB', 'all', false, '🚀 🛸 🌍 🌎 🌏 🌕 🌙 ⭐ 🌟 ✨ ☄️ 🪐 🌞 👽 🛰️ 🔭 👩‍🚀 🌌 🌠 🌑 🌓 🌗 💫 🌒 👨‍🚀 🌘 🌖 🌔 🌝 🌛'),
  nb('wild', 'חַיּוֹת הַבָּר', '🦒', '#A1887F', 'all', false, '🦒 🦓 🦏 🦛 🐘 🦍 🦧 🐆 🐅 🦁 🐊 🦘 🦥 🦨 🦡 🦝 🐺 🦌 🐗 🦬 🐃 🐂 🦙 🦚 🦜 🦩 🦢 🦅 🐍 🦎'),
  nb('food', 'אֹכֶל טָעִים', '🍕', '#FF8A65', 'all', false, '🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🥒 🫑 🧅 🥔 🍕 🍔 🌭 🥪 🌮 🍝'),
  nb('israel', 'הַהַרְפַּתְקָה הַיִּשְׂרְאֵלִית', '🐪', '#FFD54F', 'all', false, '🐪 🦌 🐐 🦊 🦔 🐢 🦅 🐝 🍯 🍊 🫒 🍇 🍉 🌵 🌴 🌻 🌺 🏜️ 🏖️ 🏞️ 🕎 🥙 🧆 🍋 🇮🇱 🕍 ✡️ 🎉 🌾 🍎'),
  nb('vehicles', 'אֹסֶף כְּלֵי רֶכֶב', '🚗', '#E57373', 'boy', false, '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🚂 🚆 🚇 ✈️ 🚁 🚢 🚀 🛺 🚤 🚡 🚠 🛩️'),
  nb('sports', 'כּוֹכְבֵי סְפּוֹרְט', '⚽', '#4DB6AC', 'boy', false, '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🏓 🏸 🥅 🏒 🏑 🥍 🏏 ⛳ 🥊 🥋 🎳 🏹 🎯 🛹 ⛸️ 🎿 🏂 🏄 🚴 🏊 🏆 🥇 🏅'),
  nb('heroes', 'גִּבּוֹרִים וְאַבִּירִים', '🦸', '#5C6BC0', 'boy', false, '🦸 🦹 🥷 🤴 🛡️ ⚔️ 🗡️ 🏹 🏰 🐉 🐲 👑 💪 ⚡ 🔥 🌪️ 🦅 🐺 🦁 🚀 🤖 👾 🛸 🎖️ 🏴‍☠️ 🦜 🗺️ 💎 🧭 🪝'),
  nb('builders', 'בּוֹנִים וּמַמְצִיאִים', '🏗️', '#FFA726', 'boy', false, '🏗️ 🚧 🔨 🔧 🪛 🪚 ⚙️ 🔩 🧱 🪵 🧰 🧲 📐 📏 ✏️ 🔦 💡 🔋 🤖 🛠️ ⛏️ 🪜 🚜 🚚 🏠 🏡 🏢 🌉 🗼 🔬'),
  nb('princess', 'הַנְּסִיכוֹת', '👸', '#F48FB1', 'girl', false, '👸 👑 💍 💎 👗 👠 👛 👜 💄 💅 🎀 🌹 💐 🏰 🦢 🦄 🪞 🕰️ 🎠 🎡 🫖 🍰 🧁 🍬 💌 💖 💝 🌷 🦋 🐩'),
  nb('garden', 'הַגִּנָּה הַפּוֹרַחַת', '🌷', '#AED581', 'girl', false, '🌷 🌹 🌻 🌼 🌸 🌺 💐 🥀 🌱 🌿 🍀 ☘️ 🌳 🌴 🍄 🐝 🐞 🦋 🐛 🐌 🐜 🦗 🕷️ 🐦 🐤 🐣 🐇 🦔 🍓 🌈'),
  nb('bakery', 'מַמְתַּקִּים וְעוּגוֹת', '🧁', '#FFAB91', 'girl', false, '🧁 🍰 🎂 🍩 🍪 🍫 🍬 🍭 🍮 🍯 🥧 🥐 🥞 🧇 🍦 🍧 🍨 🥤 🧃 🧋 🍡 🥮 🍿 🍓 🍒 🍌 🥥 🍑 🥛 ☕'),
  nb('music', 'מוּזִיקָה וְרִקּוּד', '🎵', '#9575CD', 'girl', false, '🎵 🎶 🎤 🎧 🎸 🎹 🎺 🎷 🥁 🪘 🎻 🪗 💃 🩰 🎼 📻 🎙️ 🎚️ 🔔 🎭 🎬 🎨 🖌️ 🖍️ 🎪 🎟️ 🌟 💖 🦜 🎀'),
];
export const NOTEBOOK: Record<string, Notebook> = Object.fromEntries(NOTEBOOKS.map((n) => [n.id, n]));
export const STICKERS_PER_NOTEBOOK = 30;
export const GOLD_STICKER = '🏆';
/** Shiny stickers glow and twinkle in the notebook. */
export const SHINY = new Set([4, 13, 22, 29]);
export const stickerId = (notebook: string, index: number | 'gold'): string => `${notebook}:${index}`;
export const stickerIndex = (id: string): number => Number(id.split(':')[1]);
export const isShiny = (id: string): boolean => SHINY.has(stickerIndex(id));
export const stickerEmoji = (id: string): string => {
  const [n, i] = id.split(':');
  return i === 'gold' ? GOLD_STICKER : NOTEBOOK[n]?.stickers[+i] ?? '⭐';
};
/** Notebooks a child of this gender can see and buy. */
export const notebooksFor = (gender: Gender | undefined): Notebook[] =>
  NOTEBOOKS.filter((n) => n.gender === 'all' || n.gender === (gender ?? 'boy'));
export const starterNotebooks = (gender: Gender | undefined): string[] => notebooksFor(gender).filter((n) => n.starter).map((n) => n.id);
