# AGENTS.md — קוֹרְאִים עִם בּוּץ (Reading with Butz)

Hebrew reading app for children 5-8 (Expo / React Native, TypeScript). A child uses it alone: one big **Continue**
button runs an adaptive session, Butz the owl explains anything when the child taps 👂, and hard-earned, animated
stickers make it fun.

> **The mascot's name is בּוּץ with SHURUK ("Butz"), never בּוֹץ with holam ("botz" = mud).** Always write it pointed.
> Speech goes through `speakable()` in `speech.ts`, which turns every בּוּץ into `BUTZ_SAY` (`phrases.ts`) so TTS says
> /buts/. Never put a prefix on the name in spoken text (לְבּוּץ, שֶׁבּוּץ…): the replacement only matches the bare word.

**Read first:** [docs/SPEC.md](docs/SPEC.md) — the full product spec with requirement IDs (`R-…`), game specs (`G-…`) and
acceptance criteria. This file is the practical guide: commands, layout, rules, how-tos, status.

## Commands

| What | Command |
|------|---------|
| Install dependencies (into `node_modules/` here) | `npm ci` |
| Run on a phone/tablet | `npx expo start` → scan the QR code with **Expo Go** (same Wi-Fi). Corporate network/VPN: `npx expo start --tunnel` |
| Run in a browser | `npx expo start --web` (Edge has the best Hebrew voice) |
| All fast checks | `npm run check` = content validation + engine unit tests + type check |
| Engine unit tests | `npm test` (Node's built-in runner, native TypeScript, ~1 s) |
| Content rules + spine report | `npm run validate` |
| End-to-end (web, Edge) | `npm run e2e` (builds `dist/`, serves it on :8099, Playwright with a fake speech engine) |
| Screenshots for review / the store | `npm run build:web`, `node scripts/serve.mjs dist 8099`, then `node scripts/shots.mjs` → `test-results/shots/` |
| Regenerate sound effects | `node scripts/make-sfx.mjs` |
| Regenerate icons, splash, store graphics | `node scripts/make-icons.mjs` |
| Add a package | `npx expo install <pkg>` (SDK-compatible versions) |

Everything the app needs is inside this folder; there are no links to other folders. To hand the project over, zip the
folder **without** `node_modules/`, `dist/`, `test-results/`, `playwright-report/`; the receiver runs `npm ci`.

### Publishing on Google Play (EAS Build)

1. `npm ci`, then `npx eas-cli login` (free Expo account) and `npx eas-cli init` (links the project; adds an `extra.eas.projectId`).
2. **Before the first upload** decide the package id in `app.json` (`android.package`, now `com.raviv.butz`).
   It can never change after the first upload.
3. Test build to install on a tablet: `npx eas-cli build -p android --profile preview` → `.apk`.
4. Store build: `npx eas-cli build -p android --profile production` → `.aab`; upload it in the Play Console
   (or `npx eas-cli submit -p android`). EAS creates and keeps the signing key.
5. Each new upload: raise `expo.android.versionCode` (+1) and `expo.version` in `app.json`.
6. Listing: `store/play-icon-512.png`, `store/feature-graphic-1024x500.png`, `store/screenshots/` (phone 1080×1920,
   tablet 2048×1536; regenerate with `scripts/shots.mjs`).
   Audience 5-8 → *Designed for Families*: privacy policy URL required (the app collects nothing, works offline,
   no ads, no purchases); Data safety form = no data collected or shared.

### Expo changes fast

Expo SDK 58 / React Native 0.88. Before using an Expo API, fetch the versioned docs (`https://docs.expo.dev/versions/v58.0.0/…`,
append `.md`) or `https://docs.expo.dev/llms.txt`; do not rely on memory. The app must keep running in **Expo Go**: no
custom native modules.

## Layout

```
App.tsx                 fonts, store hydration, router (simple stack in the store; Expo Router is deliberately not used)
src/engine/             PURE TypeScript, no React/RN — all teaching logic, unit-tested with `node --test`
  hebrew.ts             Unicode → letter clusters → units (SPEC §3.1), sound classes, speakable forms, nikud lint
  content/              words.ts (340 picture words), texts.ts (55 sight words, 72 sentences), stories.ts (14 listening
                        + 12 reading stories), stickers.ts (16 notebooks × 30, by gender)
  phrases.ts            mascot name (BUTZ, BUTZ_SAY) and every gendered child-facing line ([boy, girl])
  curriculum.ts         skills, worlds, GAMES registry (name, icon, mechanic, skills, mission [boy, girl]), DEFAULT_SPINE
  gating.ts             what the child can read (R-H1) and which skills are practiceable
  learner.ts            attempts → mastery, review boxes, confusions, report bands (MASTERY), `seen` (anti-repetition)
  generators.ts         one generator per game: (ActivitySpec, ctx) → Item[]; least-recently-seen content first
  planner.ts            Continue session plan, next unit to teach, free-play spec per game
  placement.ts          playful starting check (state machine)
  economy.ts report.ts  stars/envelope prices/notebooks; parent report model
  validate.ts           content invariants + nikud lint + emoji ≤ Unicode 13 (used by tests and npm run validate)
src/state/store.ts      profiles (local AsyncStorage key 'butz:v1', gender per child), settings, navigation stack
src/services/           speech.ts (expo-speech + recorded clips + name fix), clips.ts (recordings), sfx.ts (+ haptics)
src/ui/                 theme.ts, kit.tsx (Big, Tile, TopBar, HelpButton 👂…), Butz.tsx (SVG mascot), LiveSticker.tsx
src/games/              GameHost.tsx (silent mission card, help levels, feedback, stars) + mechanics.tsx
src/screens/            Home (+Setup: gender → name/friend), Play (+SessionEnd, Placement), Map (+World),
                        Stickers (Notebooks, Notebook, Shop), Parent (+Gate)
assets/                 icons + splash (make-icons.mjs), sfx (make-sfx.mjs)
store/                  Google Play icon and feature graphic
tests/e2e/app.spec.ts   Playwright flows; scripts/serve.mjs serves dist/
```

## Rules that must not break (details: SPEC §3, §8)

1. **R-H1** Reading tasks only show words whose every unit the child was introduced to — computed by `analyzeWord`, never hand-tagged.
2. **R-H2** Never two same-sound options in a sound task (א/ע, כּ/ק, ט/ת, ח/כ, ב/ו, ס/שׂ; קמץ/פתח…).
3. **R-H4** A reading item (`reading: true`) never speaks its stimulus before the answer.
4. **R-H6** Every spoken צירוף uses its speakable form (`cvSay`, `speakSyllable`), never a bare pointed letter.
5. **R-H8** All Hebrew strings are NFC (`nfc()`); child-facing text is fully pointed; parent-facing text may be unpointed.
6. **R-H9** Every child-facing Hebrew string passes the nikud lint. Real exceptions go into `LINT_OK` with a reason.
   Status `checked` = lint + proofreading; only a native-speaker teacher may set `reviewed`.
7. **R-H11** Content must not repeat: show new things through generators (they read `learner.seen`), never pick at random.
8. **R-G5** Never speak instructions automatically. New screens get a 👂 `HelpButton`; only stimuli, story narration,
   "Show me" demos and short feedback are spoken unasked.
9. **R-N7** Anything said *to* the child is gendered: add `[boy, girl]` to `phrases.ts` (or `mission` in `curriculum.ts`).
10. Engine files import each other **with `.ts` extensions** (Node runs them natively); UI files import the engine without.
11. Child screens: tap-only (no drag); no timers, lives, leaderboards or lost rewards. Stickers stay expensive (SPEC §10.1).
12. Emoji must exist in Unicode 13 (older tablets); `npm run validate` rejects newer ones.

## How to…

- **Add a picture word:** add a row to `src/engine/content/words.ts` (`[id, pointed text, 'syl|lab|les', emoji, gloss]`),
  run `npm run validate` (syllables join, unique picture, nikud lint, emoji age) and `npm test`.
- **Add a sentence:** `texts.ts` (`'phrase | phrase'`, a picture that no other sentence uses).
- **Add a story:** `stories.ts`. Reading stories (`kind: 'read'`) are offered only when ≥ 90 % of their tokens are
  decodable — `npm run validate` prints at which spine step each becomes readable; puzzle cards (`order`) need distinct
  scene emoji; questions need 3 options with different emoji. Listening stories may use any vocabulary.
- **Add a game:** registry entry in `curriculum.ts` (+ world, gendered mission), generator in `generators.ts`, mechanic in
  `mechanics.tsx` (or reuse one), extend `gamesUsable` in `planner.ts` if it has content limits, then add to the e2e
  answer helper. The engine test `generators respect the content rules` exercises every game automatically.
- **Add a sticker notebook:** `stickers.ts` (exactly 30 emoji, `gender: 'all' | 'boy' | 'girl'`, at most one starter per gender).
- **Add a recording:** put `assets/audio/<name>.mp3`, register `[nfc('<exact spoken text>')]: require(...)` in
  `src/services/clips.ts`. Recordings override TTS everywhere that text is spoken (a recording of בּוּץ fixes the name for good).
- **Tune learning / rewards:** thresholds in `MASTERY` (`learner.ts`), option counts in `optionCount` (`generators.ts`),
  `STARS` / `PRICES` / `envelopePrice` in `economy.ts`, letter/vowel order in `DEFAULT_SPINE`.

## Test hooks (web only)

`window.__butz` = `{ getState, go }`; `window.__butzGame` = current item/phase (answers included);
`window.__butzPlan` = the current session plan. The e2e fake speech records utterances in `window.__spoken`.

## Status

| Area | State |
|------|-------|
| Spec | `docs/SPEC.md` v1.1 |
| Engine (parser, nikud lint, content, gating, learner, planner, placement, generators, economy, report) | done, 39 unit tests |
| MVP games (SPEC §12.5): soundSafari, syllableHop, soundLighthouse, letterDetective, nikudMagnet, syllableDJ, secretPassword, syllableTrain, wordBakery, wordExplorer, finalTransformer, wordCollector, echoReader, phraseTrain, storyPuzzle, storyDetective | done |
| Extra: robotMixer (used by placement), Story Time | done |
| Content: 340 words, 55 sight words, 72 sentences, 26 stories; anti-repetition | done (`checked`) |
| Gender-first setup, gendered speech, instructions on demand (👂) | done |
| Rewards: 16 gendered notebooks × 30 live stickers (shiny ones), rising envelope price, shop | done |
| Parent area: gate, report, settings, voice check (incl. the name), children (+ gender) | done |
| App icons, splash, Play store graphics, `eas.json`, Android package id | done |
| E2E: first run, instructions on demand + name, beginner path, every game from the map, grown-ups, shop (tablet + phone) | done |
| v1 games: soundTwins, buildALetter, firstSoundMarket, nikudSorter, missingSound, shvaSubmarine, ahvyDetectives, longWordMaze, storyRehearsal, whatNext, drawWhatYouRead; parent voice recording | not started |
| Teacher spot-check of the stories; recorded audio for letters/צירופים and the name | recommended before a public release |
| Privacy policy page (needed by Google Play for a kids app) | to write and host |

## Gotchas

- iPhone/iPad: Expo Speech is silent when the ring/silent switch is on silent.
- Web: `expo-speech`'s `getVoices` waits forever when the browser has no voices; `speech.ts` never blocks on it.
- `npm run e2e` needs Microsoft Edge installed (Playwright `channel: 'msedge'`, no browser download).
- TypeScript 6 defaults `types` to `[]`; `tsconfig.json` lists `node` for the engine tests.
- OneDrive: `node_modules/` is a normal folder here (~500 packages). Pausing OneDrive sync during `npm ci` is faster.
