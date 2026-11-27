/* End-to-end tests on the web export (SPEC R-Q3). Run: npm run e2e  (builds dist/, serves it, drives Microsoft Edge).
   A fake speech engine records every utterance, so "nothing is spoken unless the child taps" can be checked without audio. */
import { expect, test, type Page } from '@playwright/test';

const FAKE_SPEECH = `(() => {
  const spoken = []; window.__spoken = spoken;
  const voices = [{ name: 'Fake Hebrew', lang: 'he-IL', voiceURI: 'fake-he', localService: true, default: false }];
  const fake = { speaking: false, pending: false, paused: false, onvoiceschanged: null, getVoices: () => voices,
    addEventListener() {}, removeEventListener() {}, cancel() {}, pause() {}, resume() {},
    speak(u) { spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart({}); setTimeout(() => u.onend && u.onend({}), 4); }, 4); } };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t || ''; };
})();`;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  return errors;
}

const visible = (page: Page, id: string) => page.getByTestId(id).first().isVisible().catch(() => false);
const spoken = (page: Page) => page.evaluate(() => (window as any).__spoken as string[]);
const stars = (page: Page) => page.evaluate(() => { const s = (window as any).__butz.getState(); return s.profiles.find((p: any) => p.id === s.currentId).wallet.stars as number; });

interface Pt { x: number; y: number }
interface Snap {
  phase?: string; key: string;
  item?: { id: string; game: string; answer?: string; accept?: string[]; sequence?: string[]; targets?: string[]; count?: number; pages?: boolean; story?: boolean; phrases?: number; options: string[]; gaps?: { answer: string; options: string[] }[]; trace?: Pt[][] };
}
async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const g = (window as any).__butzGame;
    if (!g) return { key: 'none' };
    const it = g.item;
    return {
      phase: g.phase, key: `${g.phase}|${g.ai ?? ''}|${g.ii ?? ''}|${it?.id ?? ''}`,
      item: it && {
        id: it.id, game: it.game, answer: it.answer, accept: it.accept, sequence: it.sequence, targets: it.targets, count: it.count, pages: it.pages, story: !!it.story,
        phrases: it.sentence?.phrases.length, options: it.options.map((o: any) => o.id), gaps: it.gaps?.map((x: any) => ({ answer: x.answer, options: x.options.map((o: any) => o.id) })), trace: it.trace?.points,
      },
    };
  });
}

async function tap(page: Page, id: string) {
  await page.getByTestId(id).first().click({ timeout: 8000 });
}

/** Write a letter: drag the mouse along every stroke's checkpoints on the writing board. */
async function trace(page: Page, strokes: Pt[][]) {
  const box = (await page.getByTestId('trace-board').first().boundingBox())!;
  const k = box.width / 300;
  for (const stroke of strokes) {
    await page.mouse.move(box.x + stroke[0].x * k, box.y + stroke[0].y * k);
    await page.mouse.down();
    for (const p of stroke) await page.mouse.move(box.x + p.x * k, box.y + p.y * k, { steps: 2 });
    await page.mouse.up();
  }
}

/** Answer the current item: correctly, or (wrong=true) with a wrong first choice when the mechanic allows it. */
async function answer(page: Page, s: Snap, wrong = false) {
  const it = s.item!;
  if (it.pages) { await tap(page, 'story-done'); return; }
  const right = it.answer ?? it.accept?.[0];
  const other = it.options.find((o) => o !== right && !(it.accept ?? []).includes(o));
  switch (it.game) {
    // balloons bob all the time, so Playwright's "stable element" wait would never end
    case 'balloonPop': for (const t of it.targets!) await page.getByTestId('cell-' + t).first().click({ force: true, timeout: 8000 }); return;
    case 'memoryMatch':
      // matched cards are disabled; a pair tapped while two cards were still turning over is tried again
      for (const o of it.options.filter((x) => x.startsWith('L:'))) {
        const card = page.getByTestId('card-' + o).first();
        for (let t = 0; t < 3 && !(await card.isDisabled({ timeout: 500 }).catch(() => true)); t++) {
          await tap(page, 'card-' + o);
          await tap(page, 'card-P:' + o.slice(2));
          await expect(card).toBeDisabled({ timeout: 1500 }).catch(() => page.waitForTimeout(1200));
        }
      }
      return;
    case 'letterTrace': await trace(page, it.trace!); return;
    case 'wordBakery': for (const b of it.sequence!) await tap(page, 'blk-' + b); return;
    case 'syllableHop': for (let i = 0; i < it.count!; i++) await tap(page, 'stone-add'); await tap(page, 'jump'); return;
    case 'missingLetter':
      for (const [j, gp] of it.gaps!.entries()) {
        const miss = gp.options.find((o) => o !== gp.answer);
        if (wrong && j === 0 && miss) await tap(page, 'opt-' + miss);
        await tap(page, 'opt-' + gp.answer);
        await page.waitForTimeout(250);
      }
      return;
    default:
      if (it.sequence) { for (const c of it.sequence) await tap(page, 'card-' + c); return; }
      await tap(page, 'opt-' + (wrong && other ? other : right));
  }
}

/** Drive the game until a screen with testID `until` shows. */
async function playUntil(page: Page, until: string, opts: { wrong?: boolean; max?: number } = {}) {
  let last = '';
  let since = Date.now();
  const missed = new Set<string>();
  for (let i = 0; i < (opts.max ?? 400); i++) {
    if (await visible(page, until)) return;
    const s = await snap(page);
    const stuck = Date.now() - since > (missed.has(s.key) ? 2500 : 6000);
    if (s.key !== last || stuck) {
      last = s.key;
      since = Date.now();
      // with `wrong`, miss each item once (to exercise hints), then answer it correctly
      const miss = !!opts.wrong && !missed.has(s.key);
      // screens can move on by themselves (an activity's end advances after a moment): a vanished button is not an error
      const safe = (p: Promise<unknown>) => p.catch(() => { last = ''; });
      if (s.phase === 'mission' && await visible(page, 'go')) await safe(tap(page, 'go'));
      else if (s.phase === 'demo' && await visible(page, 'try')) await safe(tap(page, 'try'));
      else if (s.phase === 'done' && await visible(page, 'next-activity')) await safe(tap(page, 'next-activity'));
      else if (s.phase === 'play' && s.item) { missed.add(s.key); await safe(answer(page, s, miss)); }
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`never reached ${until}`);
}

const N = (s: string) => s.normalize('NFC');
const state = (page: Page) => page.evaluate(() => (window as any).__butz.getState());
/** Free play of one game, optionally at a hidden level. */
const freePlay = (page: Page, game: string, level?: number) => page.evaluate(([g, lv]) => {
  const s = (window as any).__butz.getState();
  if (lv) s.profiles[0].learner.levels = { ...(s.profiles[0].learner.levels ?? {}), [g as string]: lv };
  (window as any).__spoken.length = 0;
    (window as any).__butz.go({ name: 'play', game: g });
}, [game, level ?? 0] as const);

async function firstRun(page: Page, name: string, wrong = false, gender: 'boy' | 'girl' = 'girl') {
  await page.addInitScript(FAKE_SPEECH);
  await page.goto('/');
  await expect(page.getByTestId('setup')).toBeVisible();
  await tap(page, 'gender-' + gender);
  await expect(page.getByTestId('setup-details')).toBeVisible();
  await page.getByTestId('name').fill(name);
  await page.getByTestId('avatar-🐼').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('placement-intro')).toBeVisible();
  await expect(page.getByTestId('placement-text')).toBeVisible();
  await page.getByTestId('placement-start').click();
  await playUntil(page, 'placement-done', { wrong });
}

test('first run: gender first, starting check, a game from the map, a live sticker', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'נועה');
  const p0 = (await state(page)).profiles[0];
  expect(p0.gender).toBe('girl');
  expect(p0.wallet.owned).toEqual(['animals', 'magic']);
  expect(await stars(page)).toBe(10);
  await tap(page, 'placement-continue');
  await expect(page.getByTestId('map')).toBeVisible();
  await tap(page, 'game-syllableHop');
  await playUntil(page, 'session-end');
  const said = await spoken(page);
  // Silent by default: no instruction, stimulus, praise or end-of-activity line is read unless the child taps.
  const chatter = ['הַקְשִׁיבִי', 'גְּעִי', 'כָּל הַכָּבוֹד', 'יֹפִי', 'סִיַּמְנוּ', 'אֵיזוֹ הַרְפַתְקָה', 'אֲנִי בּוּטְס'].map(N);
  expect(said.filter((t) => chatter.some((c) => t.includes(c)))).toEqual([]);
  // Stickers are within reach: the placement stars plus one game buy an envelope (5 stars).
  expect(await stars(page)).toBeGreaterThanOrEqual(10 + 2);
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].wallet.stars = 7; (window as any).__butz.go({ name: 'notebook', id: s.profiles[0].wallet.active, open: true }); });
  await tap(page, 'envelope');
  await expect(page.getByTestId('reveal')).toBeVisible();
  await tap(page, 'place-sticker');
  const sticker = page.locator('[data-testid^="sticker-"]');
  await expect(sticker).toHaveCount(1);
  await sticker.first().click();
  expect(await stars(page)).toBe(2);
  await expect(page.getByText('✉️ 2/5 ⭐')).toBeVisible();
  // progress survives a reload, and the newest sticker is alive on the home screen
  await page.reload();
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.locator('[data-testid^="live-"]')).toHaveCount(1);
  expect((await state(page)).profiles[0].wallet.stickers.animals.length).toBe(1);
  expect(errors).toEqual([]);
});

test('instructions are written, nothing is spoken unless the child taps 🔊 / 💡, and Butz is said with shuruk', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'רוני');
  expect(await spoken(page), 'the starting check is silent too').toEqual([]);
  await tap(page, 'placement-continue');
  await tap(page, 'close');
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByTestId('continue'), 'the map is the only way to a game').toHaveCount(0);
  await page.waitForTimeout(800);
  expect(await spoken(page)).toEqual([]);
  await tap(page, 'nav-map');
  await tap(page, 'close');
  expect(await spoken(page), 'menu buttons do not talk').toEqual([]);
  await tap(page, 'help');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain(N('גְּעִי בַּכַּפְתּוֹר הַיָּרֹק'));
  const help = (await spoken(page)).join(' ');
  expect(help).toContain(N('בּוּטְס'));
  expect(help).not.toContain(N('בּוּץ'));
  await freePlay(page, 'syllableHop');
  // the game's instructions are on the mission card, in the girl's form, and are not read aloud
  await expect(page.getByTestId('mission-text')).toContainText(N('הוֹסִיפִי'));
  await expect(page.getByTestId('help-mission')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(await spoken(page)).toEqual([]);
  await tap(page, 'go');
  await expect(page.getByTestId('instruction')).toContainText(N('הוֹסִיפִי'));
  await page.waitForTimeout(1000);
  expect(await spoken(page), 'the stimulus waits for 🔊').toEqual([]);
  await tap(page, 'replay');
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  // the parent can turn read-aloud back on
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].settings.autoSpeak = true; });
  await freePlay(page, 'syllableHop');
  await tap(page, 'go');
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('beginner boy: a letter game on the map starts with a demonstration of the first letter, wrong answers get help', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'יוסי', true, 'boy');
  const learner = (await state(page)).profiles[0].learner;
  expect(Object.keys(learner.skills).some((s: string) => s.startsWith('L.'))).toBeFalsy();
  await tap(page, 'placement-continue');
  await tap(page, 'game-missingLetter');
  await expect(page.getByTestId('play')).toBeVisible();
  const plan = await page.evaluate(() => (window as any).__butzPlan);
  expect(plan.map((a: any) => [a.mode, a.skill])).toEqual([['demo', 'L.mem']]);
  await playUntil(page, 'session-end', { wrong: true });
  const said = await spoken(page);
  const tryAgain = ['כִּמְעַט! נְנַסֶּה שׁוּב?', 'נַקְשִׁיב שׁוּב…', 'לֹא נוֹרָא, עוֹד פַּעַם!', 'נַסֵּה שׁוּב, אַתָּה יָכוֹל!'].map(N);
  expect(said.some((t) => tryAgain.some((x) => t.startsWith(x))), 'misses get visual help, not talk').toBeFalsy();
  expect(said.some((t) => t.includes(N('נַסִּי')) || t.includes(N('אַלּוּפָה'))), 'a boy is never addressed as a girl').toBeFalsy();
  const after = (await state(page)).profiles[0].learner.skills['L.mem'];
  expect(after.how).toBe('demo');
  expect(after.att.some((a: any) => a.help > 0), 'a miss raises the help level').toBeTruthy();
  expect(Object.keys((await state(page)).profiles[0].learner.seen).length).toBeGreaterThan(0);
  // the show-me is written, and speaks when the child taps 🔊
  await freePlay(page, 'wordBakery');
  await tap(page, 'go');
  await expect(page.getByTestId('demo')).toBeVisible();
  await tap(page, 'demo-again');
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the map lists every game in learning order (no worlds); each is open, even for a beginner, and can be played', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = trackErrors(page);
  await firstRun(page, 'דנה', true);
  await page.evaluate(() => (window as any).__butz.go({ name: 'map' }));
  const games = await page.locator('[data-testid^="game-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(5)));
  expect(games).toEqual(['syllableHop', 'memoryMatch', 'balloonPop', 'letterTrace', 'missingLetter', 'wordBakery', 'storyDetective', 'storyPuzzle']);
  await expect(page.locator('[data-testid^="golden-"]'), 'the two story games are golden').toHaveCount(2);
  await expect(page.getByTestId('golden-storyDetective')).toBeVisible();
  await expect(page.getByTestId('golden-storyPuzzle')).toBeVisible();
  await expect(page.getByText('🔒')).toHaveCount(0);
  for (const g of games) {
    await page.evaluate(() => (window as any).__butz.go({ name: 'map' }));
    await tap(page, 'game-' + g);
    await playUntil(page, 'session-end');
    await tap(page, 'home-btn');
  }
  expect(errors).toEqual([]);
});

test('writing: each letter is written in print and then in cursive, along the strokes', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'עדי', true, 'boy');
  await freePlay(page, 'letterTrace');
  await expect(page.getByTestId('picker')).toBeVisible();
  await tap(page, 'pick-gimel');
  await tap(page, 'go');
  await expect(page.getByTestId('trace-board')).toBeVisible();
  await expect(page.getByTestId('script-print')).toBeVisible();
  // a scribble that does not start at the red dot writes nothing
  const s0 = await snap(page);
  expect(s0.item!.id).toBe('tr:print:' + N('ג'));
  const box = (await page.getByTestId('trace-board').boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + box.height - 5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 8 });
  await page.mouse.up();
  expect((await snap(page)).key).toBe(s0.key);
  await trace(page, s0.item!.trace!);
  await expect.poll(async () => (await snap(page)).item?.id).toBe('tr:cursive:' + N('ג'));
  await expect(page.getByTestId('script-cursive')).toBeVisible();
  await playUntil(page, 'session-end');
  const p = (await state(page)).profiles[0];
  expect(p.learner.skills.WRITE.att.length).toBe(2);
  expect(p.learner.skills.WRITE.att.every((a: any) => a.ok)).toBeTruthy();
  expect(p.learner.picks.letterTrace).toEqual(['gimel']);
  expect(errors).toEqual([]);
});

test('balloons: the letter is shown in print, the balloons are in cursive, and the child picks the letters', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'ליה');
  await freePlay(page, 'balloonPop');
  await expect(page.getByTestId('picker')).toBeVisible();
  await tap(page, 'pick-finalMem');
  await tap(page, 'pick-shin');
  await tap(page, 'pick-alef');
  await tap(page, 'pick-gimel');
  await tap(page, 'go');
  const it = await page.evaluate(() => (window as any).__butzGame.item);
  expect([N('ם'), N('ש'), N('א'), N('ג')]).toContain(it.show.letter);
  expect(await page.evaluate(() => (window as any).__butzGame.n), 'more than three letters: one board each').toBe(4);
  expect(it.options.every((o: any) => o.font === 'cursive')).toBeTruthy();
  const font = await page.getByTestId('cell-' + it.targets[0]).first().evaluate((el, ch) => {
    const leaf = [...el.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent === ch) as HTMLElement;
    return getComputedStyle(leaf).fontFamily;
  }, it.show.letter);
  expect(font).toContain('DanaYad');
  await expect.poll(() => page.evaluate(() => [...(document as any).fonts].some((f: any) => f.family.replace(/"/g, '') === 'DanaYad' && f.status === 'loaded'))).toBeTruthy();
  await playUntil(page, 'session-end');
  expect((await state(page)).profiles[0].learner.picks.balloonPop).toEqual(['finalMem', 'shin', 'alef', 'gimel']);
  expect(errors).toEqual([]);
});

test('stories: the whole story is one page of text, every question can go back to it, hard stories are long', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'שירה');
  await freePlay(page, 'storyDetective', 8);
  await tap(page, 'go');
  await expect(page.getByTestId('story-scroll')).toBeVisible();
  await expect.poll(() => page.locator('[data-testid^="sent-"]').count()).toBeGreaterThanOrEqual(30);
  await tap(page, 'story-done');
  const q = await snap(page);
  expect(q.item!.story).toBeTruthy();
  if (await visible(page, 'story-open')) {
    // phone: the story is one tap away, and the question waits
    await tap(page, 'story-open');
    await expect(page.getByTestId('story-again')).toBeVisible();
    await expect(page.getByTestId('opt-' + q.item!.answer)).toBeHidden();
    await tap(page, 'story-close');
  } else {
    // tablet in landscape: the story stays beside the questions
    await expect(page.getByTestId('story-again')).toBeVisible();
  }
  await tap(page, 'opt-' + q.item!.answer);
  await playUntil(page, 'session-end');
  // a story read well pays the most: more stars and a golden envelope with a sparkling sticker
  expect(await stars(page)).toBeGreaterThanOrEqual(10 + 3);
  await tap(page, 'open-golden');
  await tap(page, 'golden-envelope');
  await expect(page.getByTestId('reveal')).toBeVisible();
  await tap(page, 'place-sticker');
  const wallet = (await state(page)).profiles[0].wallet;
  expect(wallet.golden).toBe(0);
  expect(Object.values(wallet.stickers).flat().some((x: any) => [4, 13, 22, 29].includes(Number(String(x).split(':')[1]))), 'a sparkling sticker').toBeTruthy();
  // guessing earns nothing: every question answered wrong first
  const before = await stars(page);
  await freePlay(page, 'storyDetective', 3);
  await playUntil(page, 'session-end', { wrong: true });
  await expect(page.getByTestId('no-prize')).toBeVisible();
  expect(await stars(page)).toBe(before);
  expect((await state(page)).profiles[0].wallet.golden).toBe(0);
  // the child reads the story alone: nothing reads it aloud; level 3 stories have 10-12 sentences
  await freePlay(page, 'storyPuzzle', 3);
  await tap(page, 'go');
  await expect(page.getByTestId('sent-9')).toBeAttached();
  expect(await page.locator('[data-testid^="sent-"]').count()).toBeLessThan(13);
  await expect(page.getByTestId('story-listen')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(await spoken(page)).toEqual([]);
  await tap(page, 'story-done');
  await playUntil(page, 'session-end');
  expect(errors).toEqual([]);
});

test('hidden levels: a hard Missing Letter has three boxes, success keeps it hard, the child never sees a level', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'אור');
  await freePlay(page, 'missingLetter', 5);
  await tap(page, 'go');
  const s = await snap(page);
  expect(s.item!.gaps!.length).toBe(3);
  await expect(page.getByTestId('gap-2')).toBeVisible();
  await playUntil(page, 'session-end');
  expect((await state(page)).profiles[0].learner.levels.missingLetter).toBeGreaterThanOrEqual(5);
  expect(errors).toEqual([]);
});

test('grown-ups area: gate, report with hidden levels, settings, voice check with the name, gender, second child', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'מיה');
  await tap(page, 'placement-continue');
  await tap(page, 'close');
  await expect(page.getByTestId('home')).toBeVisible();
  await tap(page, 'parent');
  const hold = page.getByTestId('gate-hold');
  await hold.hover();
  await page.mouse.down();
  await page.waitForTimeout(2800);
  await page.mouse.up();
  await tap(page, 'gate-answer');
  await expect(page.getByTestId('report')).toBeVisible();
  await expect(page.getByTestId('strand-letters')).toBeVisible();
  await expect(page.getByTestId('level-storyDetective')).toBeVisible();
  await tap(page, 'tab-settings');
  await tap(page, 'set-minutes-12');
  await tap(page, 'school-V.a');
  await tap(page, 'set-autospeak');
  const p = (await state(page)).profiles[0];
  expect(p.settings.minutes).toBe(12);
  expect(p.settings.autoSpeak).toBe(true);
  expect(p.school).toContain('V.a');
  await tap(page, 'tab-voice');
  await tap(page, 'play-name');
  await expect.poll(async () => (await spoken(page)).at(-1)).toBe(N('בּוּטְס'));
  await tap(page, 'bad-snd:mem');
  expect((await state(page)).profiles[0].audioBad).toContain('snd:mem');
  await tap(page, 'tab-children');
  await tap(page, `gender-${p.id}-boy`);
  expect((await state(page)).profiles[0].gender).toBe('boy');
  await tap(page, 'add-child');
  await tap(page, 'gender-boy');
  await page.getByTestId('name').fill('תום');
  await tap(page, 'start');
  await expect(page.getByTestId('placement-intro')).toBeVisible();
  const st = await state(page);
  expect(st.profiles.length).toBe(2);
  expect(st.profiles[1].gender).toBe('boy');
  expect(st.profiles[1].wallet.owned).toEqual(['animals', 'dino']);
  expect(errors).toEqual([]);
});

test('shop: notebooks follow the gender, cost 5 stars at first, and too few stars just boings', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'גל');
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].wallet.stars = 3; (window as any).__butz.go({ name: 'shop' }); });
  await expect(page.getByTestId('buy-princess')).toBeVisible();
  await expect(page.getByTestId('buy-sports')).toHaveCount(0);
  await expect(page.getByTestId('buy-magic')).toHaveCount(0);
  await expect(page.getByTestId('buy-envelope')).toContainText('5 ⭐');
  await expect(page.getByTestId('buy-princess')).toContainText('5 ⭐');
  await tap(page, 'buy-princess');
  await page.waitForTimeout(500);
  expect(await spoken(page)).toEqual([]);
  expect((await state(page)).profiles[0].wallet.owned).not.toContain('princess');
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].wallet.stars = 12; (window as any).__butz.go({ name: 'shop' }); });
  await tap(page, 'buy-princess');
  await expect(page.getByTestId('notebook')).toBeVisible();
  const w = (await state(page)).profiles[0].wallet;
  expect(w.owned).toContain('princess');
  expect(w.stars).toBe(7);
  await page.evaluate(() => (window as any).__butz.go({ name: 'shop' }));
  await expect(page.getByTestId('buy-sea')).toContainText('10 ⭐');
  expect(errors).toEqual([]);
});
