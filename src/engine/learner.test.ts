import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, closeReview, confusions, introduce, isMasteredNow, markSeen, newLearner, record, reviewDue, type Attempt } from './learner.ts';
import { activityStars, buyNotebook, envelopePrice, newWallet, notebookPrice, openEnvelope, PRICES } from './economy.ts';
import { NOTEBOOK, notebooksFor } from './content/stickers.ts';
import { makeRng } from './rng.ts';

const T0 = new Date(2026, 10, 2, 10).getTime();
const at = (skill: string, i: number, ok: boolean, game = i % 2 ? 'soundLighthouse' : 'letterDetective', day = 0, help: 0 | 1 | 2 = 0): Attempt =>
  ({ t: T0 + day * DAY + i * 1000, skill, game, item: `${skill}#${i}`, ok, help, ms: 1000 });

test('mastery needs 8 independent answers at ≥85%, 2 games and 2 days', () => {
  const l = newLearner();
  for (let i = 0; i < 8; i++) record(l, at('L.mem', i, true, 'soundLighthouse', 0));
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
  for (let i = 0; i < 8; i++) record(l, { ...at('W1', i, true, undefined, i < 4 ? 0 : 1), item: 'w:dag' });
  assert.ok(!isMasteredNow('W1', l.skills.W1), 'the same word 8 times is not mastery');
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
  assert.equal(activityStars({ items: 5, independentOk: 1, review: false, mastered: 0 }), 1);
  assert.equal(activityStars({ items: 5, independentOk: 4, review: false, mastered: 0 }), 2);
  assert.equal(activityStars({ items: 5, independentOk: 5, review: true, mastered: 1 }), 1 + 1 + 1 + 3);
  assert.equal(activityStars({ items: 0, independentOk: 0, review: false, mastered: 0 }), 0);
  // v1.1: the first sticker comes after about one session (3 good activities), even for a struggling child after 5.
  assert.ok(PRICES.envelopeStart / activityStars({ items: 5, independentOk: 5, review: false, mastered: 0 }) <= 3);
  assert.ok(PRICES.envelopeStart / activityStars({ items: 5, independentOk: 0, review: false, mastered: 0 }) <= 5);
});

test('seen content is remembered and bounded', () => {
  const l = newLearner();
  markSeen(l, ['w:dag', 's:s_dag'], 5);
  assert.equal(l.seen['w:dag'], 5);
  markSeen(l, Array.from({ length: 3100 }, (_, i) => 'w:x' + i), 10);
  assert.ok(Object.keys(l.seen).length <= 3000);
});
