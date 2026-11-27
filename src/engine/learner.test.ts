import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, LEVELS, adjustLevel, closeReview, confusions, gameLevel, introduce, isMasteredNow, markSeen, newLearner, record, reviewDue, type Attempt } from './learner.ts';
import { activityStars, buyNotebook, envelopePrice, goldenPrize, itemCredit, newWallet, notebookPrice, openEnvelope, PRICES, STARS } from './economy.ts';
import { NOTEBOOK, isShiny, notebooksFor } from './content/stickers.ts';
import { makeRng } from './rng.ts';

const T0 = new Date(2026, 10, 2, 10).getTime();
const at = (skill: string, i: number, ok: boolean, game = i % 2 ? 'missingLetter' : 'balloonPop', day = 0, help: 0 | 1 | 2 = 0): Attempt =>
  ({ t: T0 + day * DAY + i * 1000, skill, game, item: `${skill}#${i}`, ok, help, ms: 1000 });

test('mastery needs 8 independent answers at ≥85%, 2 games and 2 days', () => {
  const l = newLearner();
  for (let i = 0; i < 8; i++) record(l, at('L.mem', i, true, 'missingLetter', 0));
  assert.equal(l.skills['L.mem'].status, 'practising', 'one game, one day is not enough');
  const l2 = newLearner();
  let mastered = false;
  for (let i = 0; i < 8; i++) mastered = record(l2, at('L.mem', i, i !== 3, undefined, i < 4 ? 0 : 1)).mastered || mastered;
  assert.ok(mastered, '7/8 correct across 2 games and 2 days');
  assert.equal(l2.skills['L.mem'].status, 'mastered');
  const l3 = newLearner();
  for (let i = 0; i < 8; i++) record(l3, at('L.mem', i, i > 1, undefined, i < 4 ? 0 : 1));
  assert.equal(l3.skills['L.mem'].status, 'practising', '6/8 = 75% is not mastery');
});

test('hinted answers never count towards mastery', () => {
  const l = newLearner();
  for (let i = 0; i < 12; i++) record(l, at('L.lamed', i, true, undefined, i < 6 ? 0 : 1, 1));
  assert.notEqual(l.skills['L.lamed'].status, 'mastered');
});

test('fresh-item rule for word skills', () => {
  const l = newLearner();
  for (let i = 0; i < 8; i++) record(l, { ...at('W2', i, true, undefined, i < 4 ? 0 : 1), item: 'w:dag' });
  assert.ok(!isMasteredNow('W2', l.skills.W2), 'the same word 8 times is not mastery');
});

test('review boxes: pass moves up, fail returns to practice without losing anything else', () => {
  const l = newLearner();
  for (let i = 0; i < 8; i++) record(l, at('L.mem', i, true, undefined, i < 4 ? 0 : 1));
  assert.equal(l.skills['L.mem'].status, 'mastered');
  const due = l.skills['L.mem'].due!;
  assert.deepEqual(reviewDue(l, due - 1), []);
  assert.deepEqual(reviewDue(l, due), ['L.mem']);
  assert.equal(closeReview(l, 'L.mem', [at('L.mem', 20, true), at('L.mem', 21, true), at('L.mem', 22, true)], due), 'passed');
  assert.equal(l.skills['L.mem'].box, 2);
  assert.equal(closeReview(l, 'L.mem', [at('L.mem', 30, false), at('L.mem', 31, false), at('L.mem', 32, true)], due), 'failed');
  assert.equal(l.skills['L.mem'].status, 'practising');
});

test('confusions are counted from wrong first choices', () => {
  const l = newLearner();
  for (let i = 0; i < 3; i++) record(l, { ...at('L.bet', i, false), first: 'kaf', help: 1 });
  record(l, at('L.bet', 9, true));
  assert.deepEqual(confusions(l).map((c) => [c.skill, c.other, c.count]), [['L.bet', 'kaf', 3]]);
});

test('introduce is idempotent and keeps how', () => {
  const l = newLearner();
  introduce(l, 'V.a', T0, 'placement');
  introduce(l, 'V.a', T0 + 5, 'demo');
  assert.equal(l.skills['V.a'].how, 'placement');
});

test('envelopes: never duplicates, gold sticker on completion, never negative, slowly pricier as the collection grows', () => {
  const w = newWallet('boy');
  const rng = makeRng(1);
  assert.deepEqual(openEnvelope(w, rng), { ok: false, reason: 'stars' });
  assert.equal(envelopePrice(w), 5, 'the first envelope costs 5 stars');
  w.stars = PRICES.envelopeMax * 40;
  const got = new Set<string>();
  const total = NOTEBOOK[w.active].stickers.length;
  let completed = false;
  let lastPrice = 0;
  for (let i = 0; i < total; i++) {
    const r = openEnvelope(w, rng);
    assert.ok(r.ok);
    if (r.ok) {
      assert.ok(!got.has(r.sticker), 'duplicate sticker');
      assert.ok(r.price >= lastPrice && r.price <= PRICES.envelopeMax, 'price never drops and is capped');
      lastPrice = r.price;
      got.add(r.sticker);
      completed = r.completed;
    }
  }
  assert.ok(completed);
  assert.equal(lastPrice, 5 + Math.floor((total - 1) / 3), '+1 star every 3 stickers');
  for (let i = 0; i < 200; i++) openEnvelope(w, rng);
  assert.ok(envelopePrice(w) <= PRICES.envelopeMax);
  assert.ok(w.stickers.animals.includes('animals:gold'));
  assert.ok(w.stickers.dino?.length, 'a full notebook moves on to another owned one');
  assert.ok(w.stars >= 0);
});

test('starter notebooks and the shop follow the gender', () => {
  assert.deepEqual(newWallet('boy').owned, ['animals', 'dino']);
  assert.deepEqual(newWallet('girl').owned, ['animals', 'magic']);
  const boys = notebooksFor('boy').map((n) => n.id), girls = notebooksFor('girl').map((n) => n.id);
  assert.ok(boys.includes('sports') && !boys.includes('princess'));
  assert.ok(girls.includes('princess') && !girls.includes('sports'));
  assert.ok(boys.includes('sea') && girls.includes('sea'), 'shared notebooks are offered to everyone');
  assert.equal(boys.length, 11);
  assert.equal(girls.length, 11);
});

test('buying notebooks: the first costs 5 stars, each next one 5 more', () => {
  const w = newWallet('girl');
  assert.deepEqual(buyNotebook(w, 'garden'), { ok: false, reason: 'stars' });
  assert.equal(notebookPrice(w), 5);
  w.stars = 7;
  assert.deepEqual(buyNotebook(w, 'garden'), { ok: true });
  assert.equal(w.stars, 2);
  assert.deepEqual(buyNotebook(w, 'garden'), { ok: false, reason: 'owned' });
  assert.equal(notebookPrice(w), 10);
  w.stars = 1000;
  for (const n of notebooksFor('girl')) buyNotebook(w, n.id);
  assert.ok(notebookPrice(w) <= PRICES.notebookMax);
});

test('stars reward effort, independence, reviews and mastery; the shop is reachable quickly', () => {
  assert.equal(activityStars({ items: 5, independentOk: 1, success: 0.6, review: false, mastered: 0 }), 1);
  assert.equal(activityStars({ items: 5, independentOk: 4, success: 1, review: false, mastered: 0 }), 2);
  assert.equal(activityStars({ items: 5, independentOk: 5, success: 1, review: true, mastered: 1 }), 1 + 1 + 1 + 3);
  assert.equal(activityStars({ items: 0, independentOk: 0, success: 0, review: false, mastered: 0 }), 0);
  // v1.1: the first sticker comes after about one session (3 good activities), even for a struggling child after 5.
  assert.ok(PRICES.envelopeStart / activityStars({ items: 5, independentOk: 5, success: 1, review: false, mastered: 0 }) <= 3);
  assert.ok(PRICES.envelopeStart / activityStars({ items: 5, independentOk: 0, success: 0.6, review: false, mastered: 0 }) <= 5);
});

test('no stars and no prize for guessing: only an activity done at least half without guessing pays', () => {
  assert.equal(itemCredit(true, 0), 1, 'a question right on the first try');
  assert.equal(itemCredit(true, 1), 0, 'a question right only after a wrong answer or a hint is a guess');
  assert.equal(itemCredit(false, 1), 1, 'a task of several steps with one slip still counts');
  assert.equal(itemCredit(false, 2), 0);
  const guessed = { items: 4, independentOk: 1, success: 0.25, review: false, mastered: 0, story: true };
  assert.equal(activityStars(guessed), 0);
  assert.equal(goldenPrize(guessed), false);
  assert.equal(activityStars({ ...guessed, story: false }), 0);
  // the story games are the best: more stars, and a golden envelope for a story at least partly understood
  const half = { ...guessed, independentOk: 2, success: 0.5 };
  assert.equal(activityStars(half), STARS.story);
  assert.equal(goldenPrize(half), true);
  assert.equal(activityStars({ ...half, independentOk: 4, success: 1 }), STARS.story + STARS.storyBonus);
  assert.ok(STARS.story > STARS.activity && STARS.storyBonus > STARS.independentBonus);
  assert.equal(goldenPrize({ ...half, story: false }), false, 'only the story games give golden envelopes');
});

test('a golden envelope costs no stars and holds a sparkling sticker', () => {
  const w = newWallet('girl');
  const rng = makeRng(4);
  assert.deepEqual(openEnvelope(w, rng, true), { ok: false, reason: 'stars' }, 'no golden envelope yet');
  w.golden = 2;
  for (let i = 0; i < 2; i++) {
    const r = openEnvelope(w, rng, true);
    assert.ok(r.ok && isShiny(r.sticker) && r.price === 0);
  }
  assert.equal(w.golden, 0);
  assert.equal(w.stars, 0);
});

test('seen content is remembered and bounded', () => {
  const l = newLearner();
  markSeen(l, ['w:dag', 's:s_dag'], 5);
  assert.equal(l.seen['w:dag'], 5);
  markSeen(l, Array.from({ length: 3100 }, (_, i) => 'w:x' + i), 10);
  assert.ok(Object.keys(l.seen).length <= 3000);
});

test('hidden levels: every game starts easy, successes raise it, misses lower it, within its levels', () => {
  const l = newLearner();
  assert.equal(gameLevel(l, 'wordBakery'), 1);
  const ups = Math.ceil(1 / LEVELS.up);
  for (let i = 0; i < ups; i++) adjustLevel(l, 'wordBakery', 0);
  assert.equal(gameLevel(l, 'wordBakery'), 2, `${ups} right answers in a row move up one level`);
  assert.equal(gameLevel(l, 'missingLetter'), 1, 'levels are per game');
  adjustLevel(l, 'wordBakery', 1);
  assert.equal(gameLevel(l, 'wordBakery'), 2, 'one slip right after a level change does not undo it');
  for (let i = 0; i < 4; i++) adjustLevel(l, 'wordBakery', 2);
  assert.equal(gameLevel(l, 'wordBakery'), 1, 'repeated misses make it easier');
  for (let i = 0; i < 100; i++) adjustLevel(l, 'wordBakery', 0);
  assert.equal(gameLevel(l, 'wordBakery'), 8, 'capped at the hardest level (the Word Bakery has 8)');
  for (let i = 0; i < 100; i++) adjustLevel(l, 'missingLetter', 0);
  assert.equal(gameLevel(l, 'missingLetter'), 5, 'most games have 5');
  for (let i = 0; i < 100; i++) adjustLevel(l, 'wordBakery', 2);
  assert.equal(gameLevel(l, 'wordBakery'), 1, 'never below the easiest level');
});

test('hidden levels: a child who mostly succeeds climbs, one who mostly needs help stays low', () => {
  const rng = makeRng(3);
  const good = newLearner(), weak = newLearner();
  for (let i = 0; i < 60; i++) {
    adjustLevel(good, 'storyDetective', rng.chance(0.85) ? 0 : 1);
    adjustLevel(weak, 'storyDetective', rng.chance(0.4) ? 0 : 2);
  }
  assert.ok(gameLevel(good, 'storyDetective') >= 4, `good: ${gameLevel(good, 'storyDetective')}`);
  assert.ok(gameLevel(weak, 'storyDetective') <= 2, `weak: ${gameLevel(weak, 'storyDetective')}`);
});
