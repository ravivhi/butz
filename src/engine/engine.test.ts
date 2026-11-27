import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SPINE, GAMES, type GameId } from './curriculum.ts';
import { LETTER, LETTERS, clusters, letterIdOf } from './hebrew.ts';
import { generate, levelOf, PICK_LETTERS, type ActivitySpec, type GenCtx, type Item } from './generators.ts';
import { canRead, knownUnits, practiceable } from './gating.ts';
import { MASTERY, adjustLevel, gameLevel, introduce, markSeen, maxLevel, newLearner, record, type Learner, type Level } from './learner.ts';
import { tooNewEmoji } from './validate.ts';
import { freePlaySpec, nextToIntroduce, openPlaySpec, planSession, practiceFocus } from './planner.ts';
import { answerPlacement, currentItem, startPlacement } from './placement.ts';
import { makeRng } from './rng.ts';
import { pathLength, samplePath, strokesOf } from './strokes.ts';
import { CURSIVE } from './strokes_cursive.ts';
import { STORY_LENGTH } from './content/storygen.ts';
import { STORIES, storySentences } from './content/stories.ts';
import { FAMILY_STORIES } from './content/familystories.ts';
import { MORE_STORIES } from './content/morestories.ts';
import { HARD_STORIES } from './content/hardstories.ts';
import { nfc } from './hebrew.ts';

const NOW = new Date(2026, 10, 24, 17).getTime();
const DAY_MS = 24 * 3600 * 1000;
const LEVELS: Level[] = [1, 2, 3, 4, 5];
const STORY_LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7, 8];

function learnerWith(units: string[]): Learner {
  const l = newLearner();
  l.placementDone = true;
  for (const u of units) introduce(l, u, NOW - 1000, 'placement');
  return l;
}
const spineUpTo = (u: string) => DEFAULT_SPINE.slice(0, DEFAULT_SPINE.indexOf(u) + 1);
const ctxFor = (l: Learner, seed: number, fewer = false): GenCtx => ({ learner: l, known: knownUnits(l), rng: makeRng(seed), fewerChoices: fewer, audioBad: new Set() });
const play = (game: GameId, level: Level, seed: number, extra: Partial<ActivitySpec> = {}, l = learnerWith(DEFAULT_SPINE)): Item[] =>
  generate({ game, skill: GAMES.find((g) => g.id === game)!.skills[0].replace('*', 'mem'), mode: 'independent', level, ...extra }, ctxFor(l, seed));

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
    assert.ok(it.targets.length >= 2, `${where}: balloons need targets`);
    assert.ok(it.targets.every((t) => it.options.find((o) => o.id === t)?.text === it.show?.letter), `${where}: target cell mismatch`);
    assert.ok(it.options.filter((o) => !it.targets!.includes(o.id)).every((o) => o.text !== it.show?.letter), `${where}: a non-target is the target letter`);
  }
  if (it.game === 'balloonPop') assert.ok(it.options.every((o) => o.font === 'cursive'), `${where}: balloons are written in cursive`);
  if (it.game === 'memoryMatch') {
    const letters = it.options.filter((o) => o.id.startsWith('L:')).map((o) => o.id.slice(2));
    const pics = it.options.filter((o) => o.id.startsWith('P:')).map((o) => o.id.slice(2));
    assert.deepEqual([...letters].sort(), [...pics].sort(), `${where}: every letter card needs its picture card`);
    assert.ok(letters.length >= 3, `${where}: too few pairs`);
    assert.equal(new Set(letters.map((x) => LETTER[x].sound)).size, letters.length, `${where}: two letters share a sound (R-H2)`);
    const cards = it.options.filter((o) => o.id.startsWith('L:'));
    assert.ok(cards.every((o) => o.font === 'cursive' && o.text === LETTER[o.id.slice(2)].base), `${where}: letter cards are in cursive`);
    assert.equal(new Set(cards.map((o) => o.text)).size, cards.length, `${where}: two letter cards look the same in cursive`);
    assert.equal(new Set(it.options.filter((o) => o.emoji).map((o) => o.emoji)).size, pics.length, `${where}: two pictures look the same`);
  }
  if (it.game === 'missingLetter') {
    const cs = clusters(it.word!.text);
    assert.ok(it.gaps && it.gaps.length >= 1, `${where}: no boxes`);
    assert.deepEqual(it.show?.clusters, cs.map((c) => c.raw), `${where}: the word is shown cluster by cluster`);
    for (const gp of it.gaps!) {
      assert.equal(letterIdOf(cs[gp.at]), gp.answer, `${where}: box ${gp.at} must hide the answer letter`);
      assert.ok(gp.options.some((o) => o.id === gp.answer), `${where}: answer among the choices`);
      const sounds = gp.options.map((o) => LETTER[o.id].sound);
      assert.equal(new Set(sounds).size, sounds.length, `${where}: two choices share a sound (R-H2)`);
    }
    assert.ok(it.gaps!.every((gp, j) => j === 0 || gp.at > it.gaps![j - 1].at), `${where}: boxes in reading order`);
  }
  if (it.game === 'letterTrace') {
    assert.ok(it.trace && it.trace.strokes.length > 0 && it.trace.points.length === it.trace.strokes.length, `${where}: trace needs strokes`);
    assert.ok(it.trace.points.every((p) => p.length >= 8), `${where}: too few checkpoints`);
    assert.ok(it.trace.lines[0] < it.trace.lines[1], `${where}: guide lines`);
  }
  if (it.reading) {
    assert.ok(!it.say?.length, `${where}: a reading item must not speak its stimulus (R-H4)`);
  }
  if (it.id.startsWith('story:')) {
    const n = storySentences(it.story!).length;
    assert.ok(it.story!.order.every((i) => i >= 0 && i < n), `${where}: puzzle order inside the story`);
    if (it.game !== 'storyPuzzle') assert.ok(it.questions!.length >= 1, `${where}: story needs questions`);
    if (it.game === 'storyPuzzle') assert.ok(it.puzzle, `${where}: story needs a puzzle`);
    else assert.ok(!it.puzzle, `${where}: only the Story Puzzle has a puzzle`);
  }
  if (it.story && it.answer !== undefined) {
    const labels = it.options.map((o) => o.label);
    assert.equal(new Set(labels).size, labels.length, `${where}: two answers read the same`);
    assert.ok(labels.every((x) => x && x.length > 0), `${where}: every answer is written`);
  }
  for (const q of it.questions ?? []) checkItem(q, ctx, where + '/q');
  if (it.puzzle) checkItem(it.puzzle, ctx, where + '/puzzle');
}

for (const [name, units] of STATES) {
  test(`generators respect the content rules: ${name}`, () => {
    const l = learnerWith(units);
    for (let seed = 1; seed <= 20; seed++) {
      const base = ctxFor(l, seed, seed % 5 === 0);
      for (const g of GAMES) {
        // every game is open from the map: units the child lacks are lent from the spine (openPlaySpec)
        const spec = openPlaySpec(g.id as GameId, l, base.known, base.rng, DEFAULT_SPINE);
        const ctx = { ...base, known: new Set([...base.known, ...(spec.known ?? [])]) };
        const level = LEVELS[seed % 5];
        const items = generate({ ...spec, mode: seed % 3 === 0 ? 'demo' : spec.mode, level: seed % 3 === 0 ? undefined : level }, ctx);
        assert.ok(items.length > 0, `${name}/${g.id}: open but produced no items`);
        items.forEach((it, i) => checkItem(it, ctx, `${name}/${g.id}/L${level}/${seed}/${i}`));
      }
    }
  });
}

test('every game has at least 400 different items across its levels (writing: every letter, print and cursive)', () => {
  const sig = (it: Item) => JSON.stringify([it.id, it.options.map((o) => o.text ?? o.emoji), it.gaps?.map((gp) => gp.at), it.story?.paragraphs[0]?.[0]]);
  for (const g of GAMES) {
    const seen = new Set<string>();
    for (const L of g.id.startsWith('story') ? STORY_LEVELS : LEVELS) {
      for (let seed = 1; seed <= 120 && seen.size < 400; seed++) {
        for (const it of play(g.id as GameId, L, seed * 7 + L)) {
          seen.add(sig(it));
          for (const q of it.questions ?? []) seen.add(sig(q));
        }
      }
    }
    if (g.id === 'letterTrace') assert.equal(seen.size, PICK_LETTERS.length * 2, 'every letter shape in print and in cursive');
    else assert.ok(seen.size >= 400, `${g.id}: only ${seen.size} different items`);
  }
});

test('Syllable Hop: one or two syllables at level 1, five at level 5', () => {
  const lens = (L: Level) => Array.from({ length: 40 }, (_, seed) => play('syllableHop', L, seed + 1)).flat().map((it) => it.count!);
  assert.ok(lens(1).every((n) => n >= 1 && n <= 2), 'level 1');
  assert.ok(lens(3).every((n) => n >= 3 && n <= 4), 'level 3');
  const hard = lens(5);
  assert.ok(hard.every((n) => n >= 5 && n <= 6), 'level 5');
  assert.ok(hard.filter((n) => n === 5).length > hard.length / 2, 'level 5 is mostly five syllables');
  const five = new Set(Array.from({ length: 40 }, (_, seed) => play('syllableHop', 5, seed + 1)).flat().filter((it) => it.count === 5).map((it) => it.word!.id));
  assert.ok(five.size >= 12, `only ${five.size} different five-syllable words`);
});

test('levels: easy to hard', () => {
  for (const L of LEVELS) {
    // The Missing Letter: 1 / 1 / 1 / 2 / 3 boxes, the first letter at level 1, longer words higher up
    for (const it of play('missingLetter', L, 11 * L, { n: 6 })) {
      assert.equal(it.gaps!.length, [1, 1, 1, 2, 3][L - 1], `missing L${L}: boxes`);
      if (L === 1) assert.equal(it.gaps![0].at, 0, 'level 1 hides the first letter');
      const [lo, hi] = [[2, 2], [2, 3], [3, 3], [3, 4], [4, 6]][L - 1];
      assert.ok(it.word!.syl.length >= lo && it.word!.syl.length <= hi, `missing L${L}: ${it.word!.text}`);
    }
    // balloons, memory pairs
    for (const it of play('balloonPop', L, 17 * L)) assert.equal(it.options.length, [6, 8, 9, 10, 12][L - 1]);
    for (const it of play('memoryMatch', L, 19 * L)) assert.equal(it.options.length / 2, [3, 4, 5, 6, 6][L - 1]);
    // stories: 5 / 7 / 10 / 13 / 16 sentences at levels 1-5 (a hand-written story is at least as long as its level asks)
    for (let seed = 1; seed <= 6; seed++) {
      const [st] = play('storyDetective', L, 23 * L + seed);
      const n = storySentences(st.story!).length;
      if (st.story!.id.startsWith('g:')) assert.equal(n, STORY_LENGTH[L], `story L${L}`);
      else assert.ok((L === 1 || n >= STORY_LENGTH[L]) && n < STORY_LENGTH[(L + 1) as Level], `hand-written story L${L}: ${n} sentences`);
      assert.equal(st.story!.level, L);
      assert.equal(st.questions!.length, Math.min([2, 3, 3, 4, 4][L - 1], st.story!.questions.length));
    }
  }
  const hard = play('storyDetective', 8, 3)[0].story!;
  assert.ok(storySentences(hard).length >= 30, 'the hardest stories have 30 sentences or more');
});

test('Word Bakery: eight hidden levels, from two parts to names of seven parts, with more extra parts', () => {
  for (const L of STORY_LEVELS) {
    const [lo, hi] = [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [4, 5], [5, 6], [6, 7]][L - 1];
    const words = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      for (const it of play('wordBakery', L, 13 * L + seed, { skill: 'W2' })) {
        assert.ok(it.word!.syl.length >= lo && it.word!.syl.length <= hi, `bakery L${L}: ${it.word!.text}`);
        assert.equal(it.options.length - it.sequence!.length, [1, 2, 2, 3, 3, 4, 4, 5][L - 1], `bakery L${L}: extra parts`);
        words.add(it.word!.id);
      }
    }
    assert.ok(words.size >= 12, `bakery L${L}: only ${words.size} different words`);
  }
  // practising a vowel keeps the level's length; words without the vowel do not credit it
  for (const unit of ['V.u', 'X.genuva', 'V.hataf']) {
    for (const it of play('wordBakery', 7, 31, { skill: unit })) {
      assert.ok(it.word!.syl.length >= 5 && it.word!.syl.length <= 6, `bakery L7 ${unit}: ${it.word!.text}`);
      assert.ok(it.skill === unit ? it.word!.units.includes(unit) : it.skill === 'W3', `bakery L7 ${unit}: credits ${it.skill}`);
    }
  }
  assert.equal(maxLevel('wordBakery'), 8);
  const l = learnerWith(DEFAULT_SPINE);
  for (let i = 0; i < 40; i++) adjustLevel(l, 'wordBakery', 0);
  assert.equal(gameLevel(l, 'wordBakery'), 8, 'successes climb to the hardest level');
  for (let i = 0; i < 6; i++) adjustLevel(l, 'wordBakery', 2);
  assert.ok(gameLevel(l, 'wordBakery') < 8, 'misses make it easier');
});

test('levels: placement and show-me are easy, supported practice is at most level 2', () => {
  const l = learnerWith(DEFAULT_SPINE);
  l.levels = { wordBakery: 4.5 };
  const ctx = ctxFor(l, 1);
  assert.equal(levelOf({ game: 'wordBakery', skill: 'W2', mode: 'independent' }, ctx), 4);
  assert.equal(levelOf({ game: 'wordBakery', skill: 'W2', mode: 'guided' }, ctx), 2);
  assert.equal(levelOf({ game: 'wordBakery', skill: 'W2', mode: 'placement' }, ctx), 1);
  assert.equal(levelOf({ game: 'wordBakery', skill: 'W2', mode: 'demo' }, ctx), 1);
  assert.equal(levelOf({ game: 'missingLetter', skill: 'L.mem', mode: 'independent' }, ctx), 1, 'other games start easy');
});

test('letter picker: balloons and writing use the letters the child chose', () => {
  const balloons = play('balloonPop', 3, 5, { letters: ['finalMem', 'shin'] });
  assert.ok(balloons.every((it) => it.show!.letter === 'ם' || it.show!.letter === 'ש'));
  assert.ok(new Set(balloons.map((it) => it.show!.letter)).size === 2);
  const many = ['alef', 'bet', 'gimel', 'dalet', 'he', 'vav', 'zayin'];
  const boards = play('balloonPop', 2, 6, { letters: many });
  assert.equal(boards.length, many.length, 'every picked letter gets a board');
  assert.deepEqual(new Set(boards.map((it) => it.skill)), new Set(many.map((id) => 'L.' + id)));
  const writing = play('letterTrace', 2, 5, { letters: ['alef', 'finalFe'] });
  assert.deepEqual(writing.map((it) => it.id), ['tr:print:א', 'tr:cursive:א', 'tr:print:ף', 'tr:cursive:ף']);
  assert.deepEqual(writing.map((it) => it.trace!.guide), ['full', 'dots', 'full', 'dots']);
  const six = ['mem', 'lamed', 'dalet', 'gimel', 'shin', 'tav'];
  const written = play('letterTrace', 2, 7, { letters: six });
  assert.equal(written.length, six.length * 2, 'more than three letters: each is written in print and in cursive');
});

test('every game is open for a beginner; games beyond the child borrow the next spine units', () => {
  const l = learnerWith([]);
  const ctx = ctxFor(l, 1);
  const direct = GAMES.filter((g) => freePlaySpec(g.id as GameId, l, ctx.known, ctx.rng)).map((g) => g.id).sort();
  assert.deepEqual(direct, ['letterTrace', 'storyPuzzle', 'syllableHop']);
  const missing = openPlaySpec('missingLetter', l, ctx.known, ctx.rng, DEFAULT_SPINE);
  assert.equal(missing.skill, 'L.mem');
  assert.equal(missing.mode, 'demo', 'a unit the child has not met starts with show-me');
  assert.deepEqual(missing.known, spineUpTo('L.mem'));
  assert.equal(openPlaySpec('balloonPop', l, ctx.known, ctx.rng, DEFAULT_SPINE).pick, true, 'balloons start with the letter picker');
  const reading = openPlaySpec('storyDetective', l, ctx.known, ctx.rng, DEFAULT_SPINE);
  assert.equal(reading.skill, 'COMP.read');
});

test('letter writing: every letter shape has print and cursive strokes; checkpoints run along each stroke in order', () => {
  for (const l of LETTERS) {
    for (const strokes of [strokesOf(l.id), CURSIVE[l.base].strokes]) {
      assert.ok(strokes.length >= 1 && strokes.length <= 3, `${l.id}: strokes`);
      for (const d of strokes) {
        const pts = samplePath(d, 20);
        const [, x0, y0] = d.match(/^M\s+([\d.]+)\s+([\d.]+)/)!.map(Number);
        assert.ok(Math.hypot(pts[0].x - x0, pts[0].y - y0) < 0.01, `${l.id}: starts at the path start`);
        const step = pathLength(d) / 19;
        for (let i = 1; i < pts.length; i++) assert.ok(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) <= step + 0.5, `${l.id}: even spacing`);
        assert.ok(pts.every((p) => p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 300), `${l.id}: inside the board`);
      }
    }
  }
  assert.deepEqual(strokesOf('bet'), strokesOf('vet'), 'בּ and ב are written the same way');
});

test('planner: a new child gets the first letter taught + practice; a story comes once the child can read', () => {
  const l = learnerWith([]);
  const plan = planSession({ learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: false, rng: makeRng(3), spine: DEFAULT_SPINE });
  assert.equal(plan.find((a) => a.reason === 'teach')?.skill, 'L.mem');
  assert.ok(!plan.some((a) => a.reason === 'story'), 'no story before the child can read one');
  assert.ok(plan.length >= 3 && plan.length <= 5);
  assert.ok(plan.every((a) => a.game && a.skill));
  const reader = learnerWith(DEFAULT_SPINE);
  for (const day of [0, 1]) {
    const p = planSession({ learner: reader, known: knownUnits(reader), now: NOW + day * DAY_MS, minutes: 8, storyToday: false, rng: makeRng(3), spine: DEFAULT_SPINE });
    assert.ok(['storyDetective', 'storyPuzzle'].includes(p.at(-1)!.game), `day ${day}: ${p.at(-1)!.game}`);
  }
});

test('planner: no new unit while the taught ones are not ready; one when they are', () => {
  const l = newLearner();
  l.placementDone = true;
  introduce(l, 'L.mem', NOW - 5000, 'demo');
  const ctx = { learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE };
  assert.equal(nextToIntroduce(ctx), undefined);
  for (let i = 0; i < 6; i++) record(l, { t: NOW - 4000 + i, skill: 'L.mem', game: 'missingLetter', item: 'miss:x', ok: true, help: 0, ms: 1 });
  assert.equal(nextToIntroduce(ctx), 'L.lamed');
});

test('planner: the child is never stuck — after many answers the next unit comes anyway; a parent can push it', () => {
  const l = newLearner();
  l.placementDone = true;
  introduce(l, 'L.mem', NOW - 5000, 'demo');
  const ctx = { learner: l, known: knownUnits(l), now: NOW, minutes: 8, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE };
  for (let i = 0; i < MASTERY.stallAttempts - 1; i++) record(l, { t: NOW - 4000 + i, skill: 'L.mem', game: 'missingLetter', item: 'miss:x', ok: false, help: 0, ms: 1 });
  assert.equal(nextToIntroduce(ctx), undefined, 'not yet');
  record(l, { t: NOW - 100, skill: 'PA.count', game: 'syllableHop', item: 'x', ok: false, help: 0, ms: 1 });
  assert.equal(nextToIntroduce(ctx), 'L.lamed', 'stall guard');
  const l2 = newLearner();
  introduce(l2, 'L.mem', NOW - 5000, 'demo');
  const ctx2 = { ...ctx, learner: l2, known: knownUnits(l2) };
  assert.equal(nextToIntroduce(ctx2), undefined);
  l2.pushNext = 1;
  assert.equal(nextToIntroduce(ctx2), 'L.lamed', 'parent push');
});

test('planner: a child who is ready gets two new units in a long session, a brand-new child one', () => {
  const fresh = learnerWith([]);
  const p1 = planSession({ learner: fresh, known: knownUnits(fresh), now: NOW, minutes: 12, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE });
  assert.equal(p1.filter((a) => a.reason === 'teach').length, 1);
  const l = newLearner();
  introduce(l, 'L.mem', NOW - 5000, 'demo');
  for (let i = 0; i < 6; i++) record(l, { t: NOW - 4000 + i, skill: 'L.mem', game: 'missingLetter', item: 'miss:x', ok: true, help: 0, ms: 1 });
  const p2 = planSession({ learner: l, known: knownUnits(l), now: NOW, minutes: 12, storyToday: true, rng: makeRng(1), spine: DEFAULT_SPINE });
  assert.deepEqual(p2.filter((a) => a.reason === 'teach').map((a) => a.skill), ['L.lamed', 'L.dalet']);
});

test('planner: sessions include letter writing', () => {
  const l = learnerWith(spineUpTo('L.gimel'));
  const plan = planSession({ learner: l, known: knownUnits(l), now: NOW, minutes: 12, storyToday: true, rng: makeRng(4), spine: DEFAULT_SPINE });
  assert.ok(plan.some((a) => a.game === 'letterTrace'), plan.map((a) => a.game).join());
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
  assert.ok(!practiceable('W2', l, knownUnits(l)), 'one two-syllable word is not enough');
  const l2 = learnerWith(spineUpTo('V.e'));
  assert.ok(practiceable('W2', l2, knownUnits(l2)));
  assert.ok(!practiceable('W3', l2, knownUnits(l2)));
  const l3 = learnerWith(spineUpTo('V.u'));
  assert.ok(practiceable('W3', l3, knownUnits(l3)));
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

test('placement: letters are probed silently (first letter of a picture word); the word probe uses decodable words', () => {
  const l = newLearner();
  const ctx = ctxFor(l, 3);
  const st = startPlacement(ctx);
  let guard = 0;
  while (currentItem(st) && guard++ < 60) {
    const it = currentItem(st)!;
    if (it.game === 'missingLetter') {
      assert.equal(it.gaps!.length, 1);
      assert.equal(it.gaps![0].at, 0);
      assert.equal(it.word!.firstLetter, it.gaps![0].answer);
    }
    if (it.game === 'wordBakery') assert.ok(canRead(it.word!.units, new Set([...knownUnits(l), 'V.a', 'V.i', 'V.e', 'V.o', 'V.u'])), it.word!.text);
    answerPlacement(st, l, { ...ctx, known: knownUnits(l) }, true, NOW);
  }
});

test('content does not repeat: the least recently seen words and stories come first; story plans rotate', () => {
  const l = learnerWith(DEFAULT_SPINE);
  const shown = new Set<string>();
  for (let round = 0; round < 6; round++) {
    const items = generate({ game: 'wordBakery', skill: 'W2', mode: 'independent', n: 5, level: 2 }, ctxFor(l, 100 + round));
    for (const it of items) {
      assert.ok(!shown.has(it.word!.id), `word ${it.word!.id} repeated within 30 items`);
      shown.add(it.word!.id);
    }
    markSeen(l, items.map((it) => 'w:' + it.word!.id), NOW + round);
  }
  const plans = new Set<string>(), stories = new Set<string>();
  const handAt3 = STORIES.filter((s) => s.level === 3).length;
  let hand = 0;
  for (let round = 0; round < 7; round++) {
    const [story] = generate({ game: 'storyDetective', skill: 'COMP.read', mode: 'independent', level: 3 }, ctxFor(l, 200 + round));
    const id = story.story!.id;
    if (id.startsWith('g:')) {
      const plan = id.split(':')[1];
      assert.ok(!plans.has(plan), `story plan ${plan} repeated within 7 stories`);
      plans.add(plan);
    } else {
      assert.ok(!stories.has(id) || hand >= handAt3, `hand-written story ${id} repeated before the others were read`);
      hand++;
    }
    stories.add(id);
    markSeen(l, ['st:' + id, ...(id.startsWith('g:') ? ['sch:' + id.split(':')[1]] : [])], NOW + 100 + round);
  }
});

type AStory = (typeof STORIES)[number];
const sentenceCount = (s: AStory) => storySentences(s).length;
const storyText = (s: AStory) => storySentences(s).join(' ');
const FAMILY = ['\u05de\u05b4\u05d9\u05bc\u05b8\u05d4', '\u05e2\u05b4\u05d9\u05d3\u05b8\u05df', '\u05dc\u05b4\u05d9\u05e8\u05d5\u05b9\u05df', '\u05e9\u05b8\u05c2\u05d2\u05b4\u05d9\u05d0', '\u05e0\u05b9\u05d2\u05b8\u05d4', '\u05de\u05b7\u05e2\u05b0\u05d9\u05b8\u05df'].map(nfc);
function checkHandWritten(stories: AStory[]): void {
  for (const s of stories) {
    const n = sentenceCount(s);
    assert.ok(n >= STORY_LENGTH[s.level] && (s.level === 8 || n < STORY_LENGTH[(s.level + 1) as Level]), `${s.id}: level ${s.level} for ${n} sentences`);
    assert.ok(s.questions.length >= [3, 4, 4, 5, 5, 6, 6, 6][s.level - 1], `${s.id}: enough questions for every game`);
    assert.ok(s.questions.every((q) => q.answer >= 0 && q.answer < q.options.length), `${s.id}: answers`);
    assert.ok(new Set(s.questions.map((q) => q.answer)).size > 1 || s.questions.length < 2, `${s.id}: the right answer is not always in the same place`);
    assert.ok(s.order.length >= 4 && s.order.every((x, i) => x < n && (i === 0 || x > s.order[i - 1])), `${s.id}: puzzle cards in story order`);
  }
}

test('twenty more hand-written stories: Mia and her family and other characters, many of 10+ sentences', () => {
  assert.equal(FAMILY_STORIES.length, 20);
  assert.equal(new Set(FAMILY_STORIES.map((s) => s.title)).size, 20, 'different titles');
  assert.ok(FAMILY_STORIES.filter((s) => sentenceCount(s) >= 10).length >= 10, 'at least ten stories of 10 sentences or more');
  assert.ok(new Set(FAMILY_STORIES.map((s) => s.level)).size >= 6, 'spread over the story levels');
  for (const name of FAMILY) assert.ok(FAMILY_STORIES.some((s) => storyText(s).includes(name)), `a story with ${name}`);
  const withFamily = FAMILY_STORIES.filter((s) => FAMILY.some((n) => storyText(s).includes(n))).length;
  assert.ok(withFamily >= 10 && withFamily <= 16, `${withFamily} family stories; the rest have other characters`);
  checkHandWritten(FAMILY_STORIES);
});

test('fifty more hard stories (10-30 sentences, levels 3-8); in many of them Mia is the hero', () => {
  assert.equal(MORE_STORIES.length, 50);
  assert.ok(MORE_STORIES.every((s) => sentenceCount(s) >= 10), 'every new story has 10 sentences or more');
  assert.deepEqual([...new Set(MORE_STORIES.map((s) => s.level))].sort(), [3, 4, 5, 6, 7, 8]);
  assert.ok(MORE_STORIES.filter((s) => s.level >= 6).length >= 15, 'many long stories');
  const withMia = MORE_STORIES.filter((s) => storyText(s).includes(FAMILY[0])).length;
  assert.ok(withMia >= 15 && withMia <= 30, `${withMia} stories with Mia; the rest have other heroes`);
  for (const name of FAMILY) assert.ok(MORE_STORIES.some((s) => storyText(s).includes(name)), `a new story with ${name}`);
  checkHandWritten(MORE_STORIES);
  // the Story Puzzle cards are marked in the text; no marker is left in a sentence
  assert.ok(MORE_STORIES.every((s) => storySentences(s).every((t) => !t.startsWith('*'))));
});

test('fifty very hard stories (16-34 sentences, levels 5-8); about twenty with Mia and her family', () => {
  assert.equal(HARD_STORIES.length, 50);
  assert.ok(HARD_STORIES.every((s) => sentenceCount(s) >= 16 && sentenceCount(s) <= 34), 'every very hard story has 16-34 sentences');
  assert.deepEqual([...new Set(HARD_STORIES.map((s) => s.level))].sort(), [5, 6, 7, 8]);
  assert.ok(HARD_STORIES.filter((s) => s.level === 8).length >= 12, 'many two-page stories');
  const withMia = HARD_STORIES.filter((s) => storyText(s).includes(FAMILY[0])).length;
  assert.ok(withMia >= 15 && withMia <= 25, `${withMia} stories with Mia; the rest have other heroes`);
  for (const name of FAMILY) assert.ok(HARD_STORIES.some((s) => storyText(s).includes(name)), `a very hard story with ${name}`);
  checkHandWritten(HARD_STORIES);
  assert.ok(HARD_STORIES.every((s) => storySentences(s).every((t) => !t.startsWith('*'))));
  const ids = new Set([...FAMILY_STORIES, ...MORE_STORIES].map((s) => s.id));
  assert.ok(HARD_STORIES.every((s) => !ids.has(s.id)), 'new ids');
});

test('the story games differ: the Detective asks questions (also about details), the Puzzle orders events; both are read', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const L = STORY_LEVELS[seed % 8];
    const [det] = play('storyDetective', L, seed);
    const [puz] = play('storyPuzzle', L, seed);
    assert.ok(det.reading && puz.reading, 'the child reads the story');
    assert.ok(!det.puzzle && det.questions!.length > 0, 'Detective: questions, no puzzle');
    assert.ok(puz.puzzle && !puz.questions?.length, 'Puzzle: only the puzzle');
    if (det.story!.id.startsWith('g:') && det.story!.questions.length > 1) assert.ok(det.story!.questions.some((q) => q.depth === 'detail'), 'Detective asks about details');
  }
  // the former Story Time stories are read in the story games too
  const ids = new Set(Array.from({ length: 120 }, (_, i) => play('storyDetective', 1, i + 1)[0].story!.id));
  assert.ok(STORIES.some((s) => s.kind === 'listen' && ids.has(s.id)), 'listening stories appear in the Detective');
});

test('emoji newer than Unicode 13 are rejected', () => {
  assert.deepEqual(tooNewEmoji('🪑🦫🫖'), []);
  assert.equal(tooNewEmoji('🪹').length, 1);
  assert.equal(tooNewEmoji('🫏').length, 1);
});
