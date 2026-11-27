/* Stars, envelopes and notebooks (SPEC §10). No duplicates, never negative, nothing is ever taken away.
   v1.1: everything in the shop starts at 5 stars (about two activities), and prices grow slowly with the collection. */
import { NOTEBOOK, isShiny, starterNotebooks, stickerId } from './content/stickers.ts';
import type { Gender } from './phrases.ts';
import type { Rng } from './rng.ts';

/** `golden`: unopened golden envelopes, the story games' prize (a free sparkling sticker). */
export interface Wallet { stars: number; stickers: Record<string, string[]>; owned: string[]; active: string; golden?: number }

export const PRICES = { envelopeStart: 5, envelopeEvery: 3, envelopeMax: 25, notebookStart: 5, notebookStep: 5, notebookMax: 40 };
export const STARS = { activity: 1, independentBonus: 1, review: 1, mastery: 3, placement: 10, story: 3, storyBonus: 2 };
/** No stars and no prize below this share of items done without guessing (see itemCredit). */
export const PARTIAL = 0.5;

export const newWallet = (gender?: Gender): Wallet => {
  const owned = starterNotebooks(gender);
  return { stars: 0, stickers: {}, owned, active: owned[0] };
};

/** Stickers collected so far (gold trophies excluded). */
export const stickerCount = (w: Wallet): number =>
  Object.values(w.stickers).reduce((n, list) => n + list.filter((s) => !s.endsWith(':gold')).length, 0);
/** Price of the next surprise envelope: 5 stars, +1 for every 3 stickers already collected, at most 25. */
export const envelopePrice = (w: Wallet): number =>
  Math.min(PRICES.envelopeMax, PRICES.envelopeStart + Math.floor(stickerCount(w) / PRICES.envelopeEvery));
/** Price of the next notebook: 5 stars for the first one bought, +5 for each one bought before, at most 40. */
export const notebookPrice = (w: Wallet): number => {
  const bought = w.owned.filter((id) => NOTEBOOK[id] && !NOTEBOOK[id].starter).length;
  return Math.min(PRICES.notebookMax, PRICES.notebookStart + PRICES.notebookStep * bought);
};

/** An item counts as done without guessing when a single choice (a question, a letter) was right on the first try, or a
    task of several steps (order cards, pop balloons, build a word) needed at most one slip or hint. */
export const itemCredit = (singleChoice: boolean, help: 0 | 1 | 2): number => (singleChoice ? (help === 0 ? 1 : 0) : help < 2 ? 1 : 0);

/** `success`: the share of items done without guessing; `story`: a golden story game. */
export interface ActivityOutcome { items: number; independentOk: number; success: number; review: boolean; mastered: number; story?: boolean }
/** Nothing unless at least partly successful (no reward for guessing). Then 1 (a story 3), +1 (a story +2) when ≥ 80 %
    was answered without help, +1 for a review, +3 per newly mastered skill. */
export function activityStars(o: ActivityOutcome): number {
  if (o.items === 0 || o.success < PARTIAL) return 0;
  let s = o.story ? STARS.story : STARS.activity;
  if (o.independentOk / o.items >= 0.8) s += o.story ? STARS.storyBonus : STARS.independentBonus;
  if (o.review) s += STARS.review;
  return s + o.mastered * STARS.mastery;
}
/** The story games' special prize: a golden envelope, only for a story that was at least partly understood. */
export const goldenPrize = (o: ActivityOutcome): boolean => !!o.story && o.items > 0 && o.success >= PARTIAL;

export const notebookFull = (w: Wallet, id: string): boolean => (w.stickers[id]?.filter((s) => !s.endsWith(':gold')).length ?? 0) >= NOTEBOOK[id].stickers.length;
export const progress = (w: Wallet, id: string) => ({ have: w.stickers[id]?.filter((s) => !s.endsWith(':gold')).length ?? 0, total: NOTEBOOK[id].stickers.length });

export type EnvelopeResult = { ok: true; notebook: string; sticker: string; completed: boolean; price: number } | { ok: false; reason: 'stars' | 'full' };

/** Open a surprise envelope: always a sticker the child does not own yet (R-R3). A golden envelope costs no stars and
    holds a sparkling sticker while the notebook still has one. */
export function openEnvelope(w: Wallet, rng: Rng, golden = false): EnvelopeResult {
  const price = golden ? 0 : envelopePrice(w);
  if (golden ? !(w.golden ?? 0) : w.stars < price) return { ok: false, reason: 'stars' };
  const target = NOTEBOOK[w.active] && w.owned.includes(w.active) && !notebookFull(w, w.active) ? w.active : w.owned.find((id) => NOTEBOOK[id] && !notebookFull(w, id));
  if (!target) return { ok: false, reason: 'full' };
  const have = new Set(w.stickers[target] ?? []);
  const missing = NOTEBOOK[target].stickers.map((_, i) => stickerId(target, i)).filter((s) => !have.has(s));
  const shiny = missing.filter(isShiny);
  const sticker = rng.pick(golden && shiny.length ? shiny : missing);
  if (golden) w.golden = (w.golden ?? 0) - 1;
  else w.stars -= price;
  w.stickers[target] = [...(w.stickers[target] ?? []), sticker];
  w.active = target;
  const completed = notebookFull(w, target);
  if (completed) w.stickers[target].push(stickerId(target, 'gold'));
  return { ok: true, notebook: target, sticker, completed, price };
}

export type BuyResult = { ok: true } | { ok: false; reason: 'stars' | 'owned' };
export function buyNotebook(w: Wallet, id: string): BuyResult {
  if (w.owned.includes(id)) return { ok: false, reason: 'owned' };
  const price = notebookPrice(w);
  if (w.stars < price) return { ok: false, reason: 'stars' };
  w.stars -= price;
  w.owned.push(id);
  w.active = id;
  return { ok: true };
}
