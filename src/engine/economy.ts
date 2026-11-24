/* Stars, envelopes and notebooks (SPEC §10). No duplicates, never negative, nothing is ever taken away.
   Stickers are earned slowly on purpose: a few stars per activity, envelopes get pricier as the collection grows. */
import { NOTEBOOK, starterNotebooks, stickerId } from './content/stickers.ts';
import type { Gender } from './phrases.ts';
import type { Rng } from './rng.ts';

export interface Wallet { stars: number; stickers: Record<string, string[]>; owned: string[]; active: string }

export const PRICES = { envelopeStart: 20, envelopeStep: 2, envelopeMax: 60, notebook: 50 };
export const STARS = { activity: 1, independentBonus: 1, review: 1, mastery: 3, placement: 10 };

export const newWallet = (gender?: Gender): Wallet => {
  const owned = starterNotebooks(gender);
  return { stars: 0, stickers: {}, owned, active: owned[0] };
};

/** Stickers collected so far (gold trophies excluded). */
export const stickerCount = (w: Wallet): number =>
  Object.values(w.stickers).reduce((n, list) => n + list.filter((s) => !s.endsWith(':gold')).length, 0);
/** Price of the next surprise envelope: 20 stars, +2 for every sticker already collected, at most 60. */
export const envelopePrice = (w: Wallet): number =>
  Math.min(PRICES.envelopeMax, PRICES.envelopeStart + PRICES.envelopeStep * stickerCount(w));

export interface ActivityOutcome { items: number; independentOk: number; review: boolean; mastered: number }
/** 1 for finishing, +1 when ≥ 80 % was answered without help, +1 for a review, +3 per newly mastered skill. */
export function activityStars(o: ActivityOutcome): number {
  if (o.items === 0) return 0;
  let s = STARS.activity;
  if (o.independentOk / o.items >= 0.8) s += STARS.independentBonus;
  if (o.review) s += STARS.review;
  return s + o.mastered * STARS.mastery;
}

export const notebookFull = (w: Wallet, id: string): boolean => (w.stickers[id]?.filter((s) => !s.endsWith(':gold')).length ?? 0) >= NOTEBOOK[id].stickers.length;
export const progress = (w: Wallet, id: string) => ({ have: w.stickers[id]?.filter((s) => !s.endsWith(':gold')).length ?? 0, total: NOTEBOOK[id].stickers.length });

export type EnvelopeResult = { ok: true; notebook: string; sticker: string; completed: boolean; price: number } | { ok: false; reason: 'stars' | 'full' };

/** Open a surprise envelope: always a sticker the child does not own yet (R-R3). */
export function openEnvelope(w: Wallet, rng: Rng): EnvelopeResult {
  const price = envelopePrice(w);
  if (w.stars < price) return { ok: false, reason: 'stars' };
  const target = NOTEBOOK[w.active] && w.owned.includes(w.active) && !notebookFull(w, w.active) ? w.active : w.owned.find((id) => NOTEBOOK[id] && !notebookFull(w, id));
  if (!target) return { ok: false, reason: 'full' };
  const have = new Set(w.stickers[target] ?? []);
  const missing = NOTEBOOK[target].stickers.map((_, i) => stickerId(target, i)).filter((s) => !have.has(s));
  const sticker = rng.pick(missing);
  w.stars -= price;
  w.stickers[target] = [...(w.stickers[target] ?? []), sticker];
  w.active = target;
  const completed = notebookFull(w, target);
  if (completed) w.stickers[target].push(stickerId(target, 'gold'));
  return { ok: true, notebook: target, sticker, completed, price };
}

export type BuyResult = { ok: true } | { ok: false; reason: 'stars' | 'owned' };
export function buyNotebook(w: Wallet, id: string): BuyResult {
  if (w.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (w.stars < PRICES.notebook) return { ok: false, reason: 'stars' };
  w.stars -= PRICES.notebook;
  w.owned.push(id);
  w.active = id;
  return { ok: true };
}
