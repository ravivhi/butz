// App icons, splash and Google Play store graphics, rendered from the Butz owl SVG (same art as src/ui/Butz.tsx).
// Usage: node scripts/make-icons.mjs   (writes assets/*.png, store/*.png, public/icons/*.png (web app / PWA) and the
// android-twa/ launcher, maskable and splash images; needs Microsoft Edge for Playwright)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = pathToFileURL(join(root, 'node_modules/@expo-google-fonts/rubik/700Bold/Rubik_700Bold.ttf')).href;
for (const d of ['store', 'public/icons']) mkdirSync(join(root, d), { recursive: true });

const OWL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <ellipse cx="45" cy="128" rx="18" ry="40" fill="#7A4A2E" transform="rotate(-25 52 125)"/>
  <ellipse cx="155" cy="128" rx="18" ry="40" fill="#7A4A2E" transform="rotate(25 148 125)"/>
  <path d="M52 58 L44 20 L80 46 Z" fill="#8D5A3B"/><path d="M148 58 L156 20 L120 46 Z" fill="#8D5A3B"/>
  <ellipse cx="100" cy="115" rx="62" ry="72" fill="#A0673F"/>
  <ellipse cx="100" cy="148" rx="40" ry="36" fill="#F6D9A9"/>
  <path d="M84 140 q6 6 12 0 M104 140 q6 6 12 0 M94 156 q6 6 12 0" stroke="#D9B27A" stroke-width="3" fill="none"/>
  <circle cx="74" cy="88" r="30" fill="#FFE9C7"/><circle cx="126" cy="88" r="30" fill="#FFE9C7"/>
  <circle cx="74" cy="88" r="19" fill="#FFFFFF"/><circle cx="126" cy="88" r="19" fill="#FFFFFF"/>
  <circle cx="76" cy="90" r="10" fill="#24304A"/><circle cx="124" cy="90" r="10" fill="#24304A"/>
  <circle cx="80" cy="86" r="3.5" fill="#FFFFFF"/><circle cx="128" cy="86" r="3.5" fill="#FFFFFF"/>
  <path d="M90 106 L110 106 L100 122 Z" fill="#FFB300"/>
  <path d="M78 186 l6 -12 l6 12 M110 186 l6 -12 l6 12" stroke="#FF9800" stroke-width="6" stroke-linecap="round" fill="none"/>
</svg>`;
const BG = 'radial-gradient(circle at 50% 40%, #FFE08A 0%, #FFC94D 60%, #FFB020 100%)';
const page = (body, w, h) => `<!doctype html><html><head><style>
  @font-face { font-family: Rubik; src: url('${font}'); }
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
  .c { width: ${w}px; height: ${h}px; display: flex; align-items: center; justify-content: center; }
  .mono svg * { fill: #000 !important; stroke: #000 !important; }
</style></head><body>${body}</body></html>`;
const owl = (pct, extra = '') => `<div style="width:${pct}%;height:${pct}%;${extra}">${OWL}</div>`;

const jobs = [
  { file: 'assets/icon.png', w: 1024, h: 1024, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
  { file: 'assets/android-icon-foreground.png', w: 1024, h: 1024, transparent: true, body: `<div class="c">${owl(56)}</div>` },
  { file: 'assets/android-icon-background.png', w: 1024, h: 1024, body: `<div class="c" style="background:${BG}"></div>` },
  { file: 'assets/android-icon-monochrome.png', w: 1024, h: 1024, transparent: true, body: `<div class="c mono">${owl(56)}</div>` },
  { file: 'assets/splash-icon.png', w: 1024, h: 1024, transparent: true, body: `<div class="c">${owl(90)}</div>` },
  { file: 'assets/favicon.png', w: 48, h: 48, body: `<div class="c" style="background:${BG};border-radius:10px">${owl(90)}</div>`, transparent: true },
  { file: 'store/play-icon-512.png', w: 512, h: 512, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
  {
    file: 'store/feature-graphic-1024x500.png', w: 1024, h: 500,
    body: `<div class="c" style="background:${BG};gap:40px;flex-direction:row-reverse">
      <div style="width:330px;height:330px">${OWL}</div>
      <div style="font-family:Rubik;direction:rtl;color:#24304A;text-align:center">
        <div style="font-size:86px;line-height:1.25">קוֹרְאִים עִם בּוּץ</div>
        <div style="font-size:40px;opacity:.8">מִשְׂחָקֵי קְרִיאָה בְּעִבְרִית</div>
        <div style="font-size:58px;margin-top:14px">🦉 📖 ⭐</div>
      </div></div>`,
  },
  // web app (PWA) icons, used by the browser's "add to home screen" and the Android app (TWA)
  { file: 'public/icons/icon-192.png', w: 192, h: 192, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
  { file: 'public/icons/icon-512.png', w: 512, h: 512, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
  { file: 'public/icons/maskable-512.png', w: 512, h: 512, body: `<div class="c" style="background:${BG}">${owl(56)}</div>` },
  // Android app (android-twa/): launcher, adaptive (maskable) icon and splash for each screen density
  ...[['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]].flatMap(([d, k]) => [
    { file: `android-twa/app/src/main/res/mipmap-${d}/ic_launcher.png`, w: 48 * k, h: 48 * k, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
    { file: `android-twa/app/src/main/res/mipmap-${d}/ic_maskable.png`, w: 82 * k, h: 82 * k, body: `<div class="c" style="background:${BG}">${owl(56)}</div>` },
    { file: `android-twa/app/src/main/res/drawable-${d}/splash.png`, w: 300 * k, h: 300 * k, transparent: true, body: `<div class="c">${owl(90)}</div>` },
  ]),
  { file: 'android-twa/store_icon.png', w: 512, h: 512, body: `<div class="c" style="background:${BG}">${owl(78)}</div>` },
];

const browser = await chromium.launch({ channel: 'msedge' });
for (const j of jobs) {
  const p = await browser.newPage({ viewport: { width: j.w, height: j.h } });
  await p.setContent(page(j.body, j.w, j.h));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(root, j.file), omitBackground: !!j.transparent });
  await p.close();
  console.log('wrote', j.file);
}
await browser.close();
