import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPINE, GAMES, type GameId } from './curriculum.ts';
import { LETTER, SIGN, analyzeWord } from './hebrew.ts';
import { generate, type GenCtx, type Item } from './generators.ts';
import { canRead, knownUnits, practiceable } from './gating.ts';
import { introduce, markSeen, newLearner, record, type Learner } from './learner.ts';
import { tooNewEmoji } from './validate.ts';
import { freePlaySpec, nextToIntroduce, planSession, practiceFocus } from './planner.ts';
import { answerPlacement, currentItem, startPlacement } from './placement.ts';
import { makeRng } from './rng.ts';

const NOW = new Date(2026, 10, 24, 17).getTime();

function learnerWith(units: string[]): Learner {
  const l = newLearner();
  l.placementDone = true;
  for (const u of units) introduce(l, u, NOW - 1000, 'placement');
  return l;
}
const spineUpTo = (u: string) => DEFAULT_SPINE.slice(0, DEFAULT_SPINE.indexOf(u) + 1);
const ctxFor = (l: Learner, seed: number, fewer = false): GenCtx => ({ learner: l, known: knownUnits(l), rng: makeRng(seed), fewerChoices: fewer, audioBad: new Set() });

const STATES: [string, string[]][] = [
  ['nothing', []],
  ['first letters + a', spineUpTo('V.a')],
  ['up to e', spineUpTo('V.e')],
  ['up to u', spineUpTo('V.u')],
  ['whole spine', DEFAULT_SPINE],
];

function checkItem(it: Item, ctx: GenCtx, where: string): void {
  const ids = it.options.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, `${where}: duplicate option ids`);
  if (it.answer !== undefined) assert.ok(ids.includes(it.answer), `${where}: answer not among options`);
  if (it.accept) assert.ok(it.accept.length > 0 && it.accept.every((a) => ids.includes(a)), `${where}: bad accept list`);
  if (it.sequence) assert.ok(it.sequence.every((a) => ids.includes(a)), `${where}: bad sequence`);
  if (it.targets) {
    assert.ok(it.targets.length >= 2, `${where}: findTap needs targets`);
    assert.ok(it.targets.every((t) => it.options.find((o) => o.id === t)?.text === it.show?.letter), `${where}: target cell mismatch`);
    assert.ok(it.options.filter((o) => !it.targets!.includes(o.id)).every((o) => o.text !== it.show?.letter), `${where}: a non-target looks like the target`);
  }
  if (it.game === 'soundLighthouse') {
    const sounds = it.options.map((o) => LETTER[o.id].sound);
    assert.equal(new Set(sounds).size, sounds.length, `${where}: two options share a sound (R-H2)`);
  }
  if (it.game === 'syllableDJ' || it.game === 'secretPassword') {
    const keys = it.options.map((o) => { const [l, v] = o.id.split(':'); return LETTER[l].sound + v; });
    assert.equal(new Set(keys).size, keys.length, `${where}: two צירופים sound the same (R-H2)`);
  }
  if (it.game === 'nikudMagnet') assert.ok(it.options.every((o) => SIGN[o.id]), `${where}: unknown sign`);
  if (it.reading) {
    assert.ok(!it.say?.length, `${where}: a reading item must not speak its stimulus (R-H4)`);
    if (it.word) assert.ok(canRead(it.word.units, ctx.known), `${where}: word ${it.word.id} has unlearned units (R-H1)`);
    if (it.sentence) assert.ok(canRead(it.sentence.units, ctx.known), `${where}: sentence has unlearned units (R-H1)`);
    if (it.game === 'secretPassword') assert.ok(canRead(analyzeWord(it.show!.text!).units.filter((u) => !u.startsWith('L.')), ctx.known), `${where}: unlearned vowel`);
  }
  if (it.game === 'wordBakery' && it.word) assert.ok(canRead(it.word.units, ctx.known), `${where}: bakery word not decodable`);
  if (it.game === 'storyTime' && it.id.startsWith('story:')) assert.ok(it.questions!.length >= 1 && it.puzzle, `${where}: story needs questions and a puzzle`);
  for (const q of it.questions ?? []) checkItem(q, ctx, where + '/q');
  if (it.puzzle) checkItem(it.puzzle, ctx, where + '/puzzle');
}

for (const [name, units] of STATES) {
  test(`generators respect the content rules: ${name}`, () => {
    const l = learnerWith(units);
    for (let seed = 1; seed <= 25; seed++) {
      const ctx = ctxFor(l, seed, seed % 5 === 0);
      for (const g of GAMES) {
        const spec = freePlaySpec(g.id as GameId, l, ctx.known, ctx.rng);
        if (!spec) continue;
        const items = generate({ ...spec, mode: seed % 3 === 0 ? 'demo' : 'independent' }, ctx);
        assert.ok(items.length > 0, `${name}/${g.id}: playable but produced no items`);
        items.forEach((it, i) => checkItem(it, ctx, `${name}/${g.id}/${seed}/${i}`));
      }
    }
  });
}

test('locked games stay locked for a beginner, sounds and stories are open', () => {
  const l = learnerWith([]);
  const ctx = ctxFor(l, 1);
  const open = GAMES.filter((g) => freePlaySpec(g.id as GameId, l, ctx.known, ctx.rng)).map((g) => g.id).sort();
  assert.deepEqual(open, ['robotMixer', 'soundSafari', 'storyPuzzle', 'storyTime', 'syllableHop']);
});

test('planner: a new child gets the first letter taught + practice + Story Time', () => {
  const l = learnerWith([]);
  const plan = planSession({ learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: false, rng: makeRng(3), spine: DEFAULT_SPINE });
  assert.equal(plan.find((a) => a.reason === 'teach')?.skill, 'L.mem');
  assert.equal(plan.at(-1)?.game, 'storyTime');
  assert.ok(plan.length >= 3 && plan.length <= 5);
  assert.ok(plan.every((a) => a.game && a.skill));
});

test('planner: no new unit while the taught ones are not ready; one when they are', () => {
  const l = newLearner();
  l.placementDone = true;
  introduce(l, 'L.mem', NOW - 5000, 'demo');
  const ctx = { learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE };
  assert.equal(nextToIntroduce(ctx), undefined);
  for (let i = 0; i < 6; i++) record(l, { t: NOW - 4000 + i, skill: 'L.mem', game: 'soundLighthouse', item: 'snd:mem', ok: true, help: 0, ms: 1 });
  assert.equal(nextToIntroduce(ctx), 'L.lamed');
});

test('planner: placement-known units do not block new teaching', () => {
  const l = learnerWith(spineUpTo('L.gimel'));
  const ctx = { learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE };
  assert.equal(nextToIntroduce(ctx), 'V.a');
  assert.ok(practiceFocus(ctx).length >= 1);
});

test('planner: review comes first when due', () => {
  const l = learnerWith(spineUpTo('V.a'));
  const st = l.skills['L.mem'];
  st.status = 'mastered'; st.box = 1; st.due = NOW - 1;
  const plan = planSession({ learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: true, rng: makeRng(2), spine: DEFAULT_SPINE });
  assert.equal(plan[0].reason, 'review');
  assert.equal(plan[0].skill, 'L.mem');
});

test('gating thresholds', () => {
  const l = learnerWith(spineUpTo('V.a'));
  const k = knownUnits(l);
  assert.ok(practiceable('CV', l, k));
  assert.ok(!practiceable('W1', l, k), 'only 1 one-syllable word is decodable here');
  const l2 = learnerWith(spineUpTo('V.e'));
  assert.ok(practiceable('W1', l2, knownUnits(l2)));
  assert.ok(practiceable('W2', l2, knownUnits(l2)));
});

function runPlacement(answer: (it: Item) => boolean, seed = 7): Learner {
  const l = newLearner();
  const ctx = ctxFor(l, seed);
  const st = startPlacement(ctx);
  let guard = 0;
  while (currentItem(st) && guard++ < 60) {
    const it = currentItem(st)!;
    answerPlacement(st, l, { ...ctx, known: knownUnits(l) }, answer(it), NOW);
  }
  assert.ok(guard < 60, 'placement must end');
  return l;
}

test('placement: a fluent reader skips ahead, a beginner starts at the beginning', () => {
  const pro = runPlacement(() => true);
  assert.ok(pro.placementDone);
  assert.ok(pro.skills['L.mem'] && pro.skills['L.tsadi'], 'letters (incl. extrapolated) introduced');
  assert.ok(pro.skills['V.a'] && pro.skills['V.u']);
  const n = pro.recent.length;
  assert.ok(n <= 22, `placement too long: ${n}`);
  const beginner = runPlacement(() => false);
  assert.ok(beginner.placementDone);
  assert.ok(!Object.keys(beginner.skills).some((s) => s.startsWith('L.') || s.startsWith('V.')));
});

test('content does not repeat: the least recently seen words, sentences and stories come first', () => {
  const l = learnerWith(DEFAULT_SPINE);
  const shown = new Set<string>();
  for (let round = 0; round < 6; round++) {
    const items = generate({ game: 'wordExplorer', skill: 'W2', mode: 'independent', n: 5 }, ctxFor(l, 100 + round));
    for (const it of items) {
      assert.ok(!shown.has(it.word!.id), `word ${it.word!.id} repeated within 30 items although 180+ W2 words are available`);
      shown.add(it.word!.id);
    }
    markSeen(l, items.map((it) => 'w:' + it.word!.id), NOW + round);
  }
  const heard = new Set<string>();
  for (let round = 0; round < 10; round++) {
    const [story] = generate({ game: 'storyTime', skill: 'COMP.listen', mode: 'independent' }, ctxFor(l, 200 + round));
    assert.ok(!heard.has(story.story!.id), `story ${story.story!.id} repeated within 10 sessions`);
    heard.add(story.story!.id);
    markSeen(l, ['st:' + story.story!.id], NOW + 100 + round);
  }
});

test('sentence meaning questions: distractor pictures never share an emoji with the answer', () => {
  const l = learnerWith(DEFAULT_SPINE);
  const glyphs = (s: string) => [...s].filter((c) => c.codePointAt(0)! > 0x2000 && c !== '\uFE0F' && c !== '\u200D');
  for (let seed = 1; seed <= 20; seed++) {
    for (const it of generate({ game: 'echoReader', skill: 'FLU.sentence', mode: 'independent', n: 3 }, ctxFor(l, seed))) {
      const mine = new Set(glyphs(it.options.find((o) => o.id === it.answer)!.emoji!));
      for (const o of it.options.filter((x) => x.id !== it.answer)) assert.ok(!glyphs(o.emoji!).some((c) => mine.has(c)), `${it.id}: ${o.emoji}`);
    }
  }
});

test('emoji newer than Unicode 13 are rejected', () => {
  assert.deepEqual(tooNewEmoji('🪑🦫🫖'), []);
  assert.equal(tooNewEmoji('🪹').length, 1);
  assert.equal(tooNewEmoji('🫏').length, 1);
});
