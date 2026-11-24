/* End-to-end tests on the web export (SPEC R-Q3). Run: npm run e2e  (builds dist/, serves it, drives Microsoft Edge).
   A fake speech engine records every utterance, so "everything is spoken" can be checked without audio. */
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

interface Snap { phase?: string; key: string; item?: { id: string; game: string; answer?: string; accept?: string[]; sequence?: string[]; targets?: string[]; count?: number; pages?: boolean; phrases?: number; options: string[] } }
async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const g = (window as any).__butzGame;
    if (!g) return { key: 'none' };
    const it = g.item;
    return {
      phase: g.phase, key: `${g.phase}|${g.ai ?? ''}|${g.ii ?? ''}|${it?.id ?? ''}`,
      item: it && { id: it.id, game: it.game, answer: it.answer, accept: it.accept, sequence: it.sequence, targets: it.targets, count: it.count, pages: it.pages, phrases: it.sentence?.phrases.length, options: it.options.map((o: any) => o.id) },
    };
  });
}

async function tap(page: Page, id: string) {
  await page.getByTestId(id).first().click({ timeout: 8000 });
}

/** Answer the current item: correctly, or (wrong=true) with a wrong first choice when the mechanic allows it. */
async function answer(page: Page, s: Snap, wrong = false) {
  const it = s.item!;
  if (it.pages) { await tap(page, 'page-next'); return; }
  const right = it.answer ?? it.accept?.[0];
  const other = it.options.find((o) => o !== right && !(it.accept ?? []).includes(o));
  switch (it.game) {
    case 'letterDetective': for (const t of it.targets!) await tap(page, 'cell-' + t); return;
    case 'wordBakery': for (const b of it.sequence!) await tap(page, 'blk-' + b); return;
    case 'syllableHop': for (let i = 0; i < it.count!; i++) await tap(page, 'stone-add'); await tap(page, 'jump'); return;
    case 'secretPassword': await tap(page, 'opt-' + (wrong && other ? other : right)); await tap(page, 'open-door'); return;
    case 'echoReader':
      if (await visible(page, 'read-done')) await tap(page, 'read-done');
      await tap(page, 'opt-' + right);
      await page.getByTestId('echo-done').click({ timeout: 15000 });
      return;
    case 'phraseTrain':
      for (let i = 0; i < it.phrases!; i++) await tap(page, 'phrase-' + i);
      await tap(page, 'opt-' + right);
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
      if (s.phase === 'mission' && await visible(page, 'go')) await tap(page, 'go');
      else if (s.phase === 'demo' && await visible(page, 'try')) await tap(page, 'try');
      else if (s.phase === 'done' && await visible(page, 'next-activity')) await tap(page, 'next-activity');
      else if (s.phase === 'play' && s.item) { missed.add(s.key); await answer(page, s, miss).catch(() => { last = ''; }); }
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`never reached ${until}`);
}

const N = (s: string) => s.normalize('NFC');
const state = (page: Page) => page.evaluate(() => (window as any).__butz.getState());

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
  await page.getByTestId('placement-start').click();
  await playUntil(page, 'placement-done', { wrong });
}

test('first run: gender first, starting check, a full session, a live sticker', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'נועה');
  const p0 = (await state(page)).profiles[0];
  expect(p0.gender).toBe('girl');
  expect(p0.wallet.owned).toEqual(['animals', 'magic']);
  expect(await stars(page)).toBe(10);
  await tap(page, 'placement-continue');
  await playUntil(page, 'session-end');
  const said = await spoken(page);
  // Instructions are never read automatically (the mission card is silent until 👂 is tapped).
  expect(said.some((t) => t.startsWith(N('הַקְשִׁיבִי לַסִּפּוּר')) || t.startsWith(N('בּוֹאוּ')))).toBeFalsy();
  expect(said.some((t) => t.includes(N('אֲנִי בּוּטְס')))).toBeFalsy();
  // Stickers are expensive: one session is not enough for an envelope.
  expect(await stars(page)).toBeLessThan(20 + 10);
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].wallet.stars = 25; (window as any).__butz.go({ name: 'notebook', id: s.profiles[0].wallet.active, open: true }); });
  await tap(page, 'envelope');
  await expect(page.getByTestId('reveal')).toBeVisible();
  await tap(page, 'place-sticker');
  const sticker = page.locator('[data-testid^="sticker-"]');
  await expect(sticker).toHaveCount(1);
  await sticker.first().click();
  expect(await stars(page)).toBe(5);
  await expect(page.getByText('✉️ 5/22 ⭐')).toBeVisible();
  // progress survives a reload, and the newest sticker is alive on the home screen
  await page.reload();
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.locator('[data-testid^="live-"]')).toHaveCount(1);
  expect((await state(page)).profiles[0].wallet.stickers.animals.length).toBe(1);
  expect(errors).toEqual([]);
});

test('instructions are spoken only when the child taps 👂, and Butz is said with shuruk', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'רוני');
  await tap(page, 'placement-continue');
  await tap(page, 'close');
  await expect(page.getByTestId('home')).toBeVisible();
  await page.evaluate(() => { (window as any).__spoken.length = 0; });
  await page.waitForTimeout(800);
  expect(await spoken(page)).toEqual([]);
  await tap(page, 'help');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain(N('גְּעִי בַּכַּפְתּוֹר הַיָּרֹק'));
  const help = (await spoken(page)).join(' ');
  expect(help).toContain(N('בּוּטְס'));
  expect(help).not.toContain(N('בּוּץ'));
  await page.evaluate(() => { (window as any).__spoken.length = 0; (window as any).__butz.go({ name: 'play', source: 'free', game: 'soundSafari' }); });
  await expect(page.getByTestId('mission')).toBeVisible();
  await page.waitForTimeout(800);
  expect(await spoken(page)).toEqual([]);
  await tap(page, 'help-mission');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain(N('הַקְשִׁיבִי לַמִּלָּה'));
  await tap(page, 'go');
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('beginner boy: the first session teaches the first letter with a demonstration, wrong answers get help', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'יוסי', true, 'boy');
  const learner = (await state(page)).profiles[0].learner;
  expect(Object.keys(learner.skills).some((s: string) => s.startsWith('L.'))).toBeFalsy();
  await tap(page, 'placement-continue');
  await expect(page.getByTestId('play')).toBeVisible();
  const plan = await page.evaluate(() => (window as any).__butzPlan);
  expect(plan.some((a: any) => a.reason === 'teach' && a.skill === 'L.mem')).toBeTruthy();
  await playUntil(page, 'session-end', { wrong: true });
  const said = await spoken(page);
  expect(said.some((t) => t.includes(N('מֵם')))).toBeTruthy();
  const tryAgain = ['כִּמְעַט! נְנַסֶּה שׁוּב?', 'נַקְשִׁיב שׁוּב…', 'לֹא נוֹרָא, עוֹד פַּעַם!', 'נַסֵּה שׁוּב, אַתָּה יָכוֹל!'].map(N);
  expect(said.some((t) => tryAgain.some((x) => t.startsWith(x))), 'a miss gets a gentle level-1 hint').toBeTruthy();
  expect(said.some((t) => t.includes(N('נַסִּי')) || t.includes(N('אַלּוּפָה'))), 'a boy is never addressed as a girl').toBeFalsy();
  const after = (await state(page)).profiles[0].learner.skills['L.mem'];
  expect(after.how).toBe('demo');
  expect(after.att.some((a: any) => a.help > 0)).toBeTruthy();
  expect(Object.keys((await state(page)).profiles[0].learner.seen).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('every open game can be played from the map', async ({ page }) => {
  test.setTimeout(480_000);
  const errors = trackErrors(page);
  await firstRun(page, 'דנה');
  await page.evaluate(() => (window as any).__butz.go({ name: 'home' }));
  // a fluent reader: mark the whole curriculum as learned at school so every MVP game opens
  await page.evaluate(() => {
    const st = (window as any).__butz.getState();
    const p = st.profiles[0];
    p.school = ['L.mem','L.lamed','L.dalet','L.gimel','V.a','L.yod','L.resh','L.qof','L.finalMem','L.he','L.het','L.nun','L.finalNun','V.i','L.shin','L.bet','L.vet','L.samekh','V.e','L.tav','L.pe','L.alef','X.quiet','V.o','L.kaf','L.ayin','L.tsadi','L.finalTsadi','V.u','L.zayin','L.tet','L.vav','L.khaf','L.finalKhaf','L.fe','L.finalFe','L.sin','V.shva'];
  });
  const worlds = ['storytime', 'forest', 'island', 'workshop', 'train', 'mountain', 'museum', 'theatre', 'kingdom'];
  let played = 0;
  for (const w of worlds) {
    await page.evaluate((world) => (window as any).__butz.go({ name: 'world', world }), w);
    const games = await page.locator('[data-testid^="game-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.slice(5)));
    for (const g of games) {
      await page.evaluate((world) => (window as any).__butz.go({ name: 'world', world }), w);
      await tap(page, 'game-' + g);
      await playUntil(page, 'session-end');
      played++;
      await tap(page, 'home-btn');
    }
  }
  // 18 games; Story Puzzle appears in two worlds
  expect(played).toBe(19);
  expect(errors).toEqual([]);
});

test('grown-ups area: gate, report, settings, voice check with the name, gender, second child', async ({ page }) => {
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
  await tap(page, 'tab-settings');
  await tap(page, 'set-minutes-12');
  await tap(page, 'school-V.a');
  const p = (await state(page)).profiles[0];
  expect(p.settings.minutes).toBe(12);
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

test('shop: notebooks follow the gender, too few stars is explained kindly, a notebook can be bought', async ({ page }) => {
  const errors = trackErrors(page);
  await firstRun(page, 'גל');
  await page.evaluate(() => (window as any).__butz.go({ name: 'shop' }));
  await expect(page.getByTestId('buy-princess')).toBeVisible();
  await expect(page.getByTestId('buy-sports')).toHaveCount(0);
  await expect(page.getByTestId('buy-magic')).toHaveCount(0);
  await tap(page, 'buy-princess');
  await expect.poll(async () => (await spoken(page)).some((t) => t.startsWith(N('צָרִיךְ עוֹד')) && t.includes(N('בּוֹאִי')))).toBeTruthy();
  await page.evaluate(() => { const s = (window as any).__butz.getState(); s.profiles[0].wallet.stars = 60; (window as any).__butz.go({ name: 'shop' }); });
  await tap(page, 'buy-princess');
  await expect(page.getByTestId('notebook')).toBeVisible();
  const w = (await state(page)).profiles[0].wallet;
  expect(w.owned).toContain('princess');
  expect(w.stars).toBe(10);
  expect(errors).toEqual([]);
});
