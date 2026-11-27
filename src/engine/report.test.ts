import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, dayKey, newLearner, type Attempt } from './learner.ts';
import { gameStatus, parentSummary, PARENT } from './report.ts';

const T0 = new Date(2026, 10, 27, 18).getTime();
const att = (game: string, ok: boolean, i: number, help: 0 | 1 | 2 = 0, day = 0): Attempt =>
  ({ t: T0 - day * DAY + i * 1000, skill: 'L.b', game, item: 'x' + i, ok, help, ms: 900 });

test('parents area: a game is doing well / practising / hard from its last answers (hints count as not yet)', () => {
  assert.equal(gameStatus([]).status, 'none');
  assert.equal(gameStatus([att('balloonPop', true, 1)]).status, 'new');
  const run = (okCount: number, n = 10) => Array.from({ length: n }, (_, i) => att('balloonPop', i < okCount, i));
  assert.equal(gameStatus(run(9)).status, 'good');
  assert.equal(gameStatus(run(7)).status, 'ok');
  assert.equal(gameStatus(run(4)).status, 'hard');
  // right only with a hint is not success
  assert.equal(gameStatus(Array.from({ length: 10 }, (_, i) => att('balloonPop', true, i, 2))).status, 'hard');
  // only the recent window counts: an old bad start does not hide a good present
  const turnaround = [...run(0, 30), ...Array.from({ length: PARENT.window }, (_, i) => att('balloonPop', true, 100 + i))];
  assert.equal(gameStatus(turnaround).status, 'good');
});

test('parents area: today and the week come from play time, answers and stars; every game has a row', () => {
  const l = newLearner();
  l.recent.push(att('syllableHop', true, 1), att('syllableHop', false, 2), att('memoryMatch', true, 3, 0, 2), att('memoryMatch', true, 4, 0, 9));
  l.levels = { syllableHop: 3.4 };
  const playMs = { [dayKey(T0)]: 12 * 60000 + 20000, [dayKey(T0 - 2 * DAY)]: 5 * 60000, [dayKey(T0 - 9 * DAY)]: 60 * 60000 };
  const sum = parentSummary(l, playMs, [{ day: dayKey(T0), stars: 4 }, { day: dayKey(T0 - DAY), stars: 2 }, { day: dayKey(T0 - 8 * DAY), stars: 9 }], T0);
  assert.equal(sum.todayMin, 12);
  assert.equal(sum.week.length, 7);
  assert.equal(sum.week[6].day, dayKey(T0));
  assert.equal(sum.weekMin, 17, 'a day outside the week does not count');
  assert.equal(sum.weekStars, 6);
  assert.equal(sum.weekRate, 2 / 3);
  const hop = sum.games.find((g) => g.game === 'syllableHop')!;
  assert.deepEqual([hop.level, hop.max, hop.status], [3, 5, 'new']);
  assert.equal(sum.games.find((g) => g.game === 'balloonPop')!.status, 'none');
  assert.equal(sum.games.length, 8);
});
