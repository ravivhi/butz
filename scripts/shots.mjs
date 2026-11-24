// Screenshots of key screens for visual review: node scripts/shots.mjs [outDir]  (needs dist/ served on :8099)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'test-results/shots';
mkdirSync(out, { recursive: true });
const FAKE = `(() => { const v=[{name:'Fake Hebrew',lang:'he-IL',voiceURI:'fake-he',localService:true,default:false}];
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>v,speak(u){setTimeout(()=>u.onend&&u.onend({}),30)},cancel(){},pause(){},resume(){},addEventListener(){},removeEventListener(){}},configurable:true});
  window.SpeechSynthesisUtterance=function(t){this.text=t||''}; })();`;
const ALL = ['L.mem','L.lamed','L.dalet','L.gimel','V.a','L.yod','L.resh','L.qof','L.finalMem','L.he','L.het','L.nun','L.finalNun','V.i','L.shin','L.bet','L.vet','L.samekh','V.e','L.tav','L.pe','L.alef','X.quiet','V.o','L.kaf','L.ayin','L.tsadi','L.finalTsadi','V.u','L.zayin','L.tet','L.vav','L.khaf','L.finalKhaf','L.fe','L.finalFe','L.sin','V.shva'];

const browser = await chromium.launch({ channel: 'msedge' });
// Google Play: each side 320-3840 px and the long side at most 2x the short side (phone 1080x1920, tablet 2048x1536).
for (const [tag, viewport] of [['tablet', { width: 1024, height: 768 }], ['phone', { width: 405, height: 720 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: tag === 'phone' ? 2.6667 : 2 });
  await page.addInitScript(FAKE);
  const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${tag}-${name}.png` }); };
  await page.goto('http://localhost:8099/');
  await page.getByTestId('setup').waitFor();
  await shot('01-setup');
  await page.getByTestId('gender-girl').click();
  await page.getByTestId('setup-details').waitFor();
  await page.getByTestId('name').fill('נועה');
  await shot('01b-setup-details');
  await page.getByTestId('start').click();
  await page.getByTestId('placement-intro').waitFor();
  await shot('02-placement-intro');
  await page.getByTestId('placement-start').click();
  await page.waitForTimeout(500);
  await shot('03-placement-item');
  await page.evaluate((all) => { const s = window.__butz.getState(); const p = s.profiles[0]; p.school = all; p.learner.placementDone = true; p.wallet.stars = 40; p.settings.reducedMotion = true; p.wallet.stickers = { animals: ['animals:0', 'animals:4', 'animals:7', 'animals:13', 'animals:2'] }; window.__butz.go({ name: 'home' }); }, ALL);
  await shot('04-home');
  await page.evaluate(() => { window.__butz.go({ name: 'play', source: 'free', game: 'wordBakery' }); });
  await shot('04b-mission-card');
  await page.evaluate(() => window.__butz.go({ name: 'home' }));
  await page.evaluate(() => window.__butz.go({ name: 'map' }));
  await shot('05-map');
  await page.evaluate(() => window.__butz.go({ name: 'world', world: 'workshop' }));
  await shot('06-world');
  for (const g of ['soundLighthouse', 'letterDetective', 'nikudMagnet', 'syllableDJ', 'secretPassword', 'syllableTrain', 'wordBakery', 'wordExplorer', 'finalTransformer', 'wordCollector', 'syllableHop', 'soundSafari', 'phraseTrain', 'echoReader', 'storyTime', 'storyDetective']) {
    await page.evaluate((game) => { window.__butz.go({ name: 'home' }); window.__butz.go({ name: 'play', source: 'free', game }); }, g);
    await page.waitForTimeout(900);
    if (await page.getByTestId('go').isVisible().catch(() => false)) await page.getByTestId('go').click();
    if (await page.getByTestId('try').isVisible().catch(() => false)) await page.getByTestId('try').click();
    await shot('game-' + g);
  }
  await page.evaluate(() => { window.__butz.go({ name: 'home' }); window.__butz.go({ name: 'notebook', id: 'animals', open: true }); });
  await shot('07-notebook');
  await page.getByTestId('envelope').click();
  await shot('08-reveal');
  await page.evaluate(() => window.__butz.go({ name: 'shop' }));
  await shot('09-shop');
  await page.evaluate(() => window.__butz.go({ name: 'parent' }));
  await shot('10-parent-report');
  await page.close();
}
await browser.close();
console.log('shots in', out);
