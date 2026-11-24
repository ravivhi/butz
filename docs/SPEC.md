# קוֹרְאִים עִם בּוּץ — Reading with Butz

**Product spec v1.1 (2026-11-25). Source of truth for agents building this app.**

> The mascot is **בּוּץ** — with **shuruk** ("Butz"), never בּוֹץ with holam ("botz", which means *mud*). Display it
> pointed; speech always goes through `BUTZ_SAY` (`src/engine/phrases.ts`), a spelling TTS engines read with /u/ (R-H11).

A Hebrew reading app for children aged 5-8 (kindergarten to Grade 2). It takes a child from hearing sounds to reading short
pointed (מנוקד) stories. The child can use it **alone, without reading any menu**, and wants to come back because it is a
fun adventure with a sticker collection. Underneath, it behaves like a structured, individualized Hebrew reading tutor.

> How to use this document: every requirement has a stable ID (`R-…`, `G-…`, `S-…`). Cite IDs in commits and tests.
> Sections 1-4 are the *why* and the *rules*; 5-11 are buildable specs with acceptance criteria; 12 is the delivery plan;
> 13 lists the research sources. The implementation status lives in [AGENTS.md](../AGENTS.md#status).

---

## Contents

1. [Product principles](#1-product-principles)
2. [Hebrew reading development: what the app must respect](#2-hebrew-reading-development)
3. [Hebrew content invariants (never break these)](#3-hebrew-content-invariants)
4. [Users, platform and constraints](#4-users-platform-and-constraints)
5. [The journey: worlds and the curriculum spine](#5-the-journey)
6. [Skills model and mastery](#6-skills-model-and-mastery)
7. [Adaptive engine: placement, planner, remediation](#7-adaptive-engine)
8. [Game engine: round structure, mechanics, feedback](#8-game-engine)
9. [Game catalog (32 games + Story Time)](#9-game-catalog)
10. [Rewards: stars, sticker notebooks, shop](#10-rewards)
11. [Child navigation, parent area, accessibility, privacy](#11-navigation-parent-area-accessibility-privacy)
12. [Architecture, data contracts, testing, release plan](#12-architecture-data-testing-release)
13. [Research and curriculum sources](#13-research-and-curriculum-sources)
14. [Glossary](#14-glossary)

---

## 1. Product principles

| ID | Principle | What it means in practice |
|----|-----------|---------------------------|
| R-P1 | **Systematic decoding** | Letters → nikud → צירופים → words → sentences, explicit and cumulative. Never whole-word guessing as a substitute for decoding. |
| R-P2 | **Language and comprehension in parallel** | Story Time (listening) exists from day 1, long before the child can read the story. |
| R-P3 | **A profile, not a level** | The child has a per-skill profile (letters, nikud, blending, comprehension…), never one "reading level". |
| R-P4 | **Curriculum is separate from games** | A skill is practised by several games; a game serves several skills. Changing a game never changes the teaching sequence. |
| R-P5 | **Usable alone by a pre-reader** | Every screen can speak its instruction when the child taps 👂 (never automatically, R-G5); navigation is pictures + one big button; no written instruction is required. |
| R-P6 | **Fun without pressure** | Adventure map, mascot, sticker notebooks. No timers, leaderboards, streak pressure, lives, or losing rewards. |
| R-P7 | **Errors teach** | A wrong answer produces a hint or a demonstration, never a red failure screen. |
| R-P8 | **Measure learning, not screen time** | Success = independent accuracy on *new* items, transfer, retention, comprehension. Not minutes or games played. |
| R-P9 | **Not a diagnosis** | The app shows where a child struggles; it never claims to diagnose dyslexia or any disability. |
| R-P10 | **Privacy by default** | Local data only, no accounts, no ads, no analytics, no in-app purchases, microphone optional. |

The complexity lives in the engine, not on the child's screen: one **Continue** button, one map, a notebook collection,
a sticker shop.

## 2. Hebrew reading development

What the design is built on (sources in [§13.3](#133-research-and-curriculum-sources)):

- **Two parallel strands** (Israeli Ministry of Education, Grade 1 framework): (a) foundational reading and writing
  (code), (b) comprehension and production of spoken and written texts (language). The app has a strand for each:
  the *journey* (code) and *Story Time* (language).
- **Pointed Hebrew first.** Beginning readers read fully pointed text. The ministry describes gradual, formal removal of
  nikud from **Grade 3**, so unpointed reading is an optional extension world, never a requirement for a K-2 child.
- **The צירוף (consonant + vowel) is the core unit** of early pointed-Hebrew reading. The first phase is phonological
  decoding of pointed Hebrew; later readers rely more on lexical, morphological and orthographic knowledge (Share &
  Bar-On, *Triplex model*). The journey mirrors this: Sound → Letters → Nikud/צירופים → Words → Word patterns/morphology →
  Fluency → Comprehension.
- **Children develop at different rates.** Placement and progression are per skill and per child, never by age/grade.
- **Letter name ≠ letter sound.** Knowing "מֵם" does not mean knowing that מ says /m/. They are tracked separately.
- **Hebrew-specific traps the content must handle** (see §3): letters with two sounds (בּ/ב, כּ/כ, פּ/פ, שׁ/שׂ),
  letters with the same sound (א/ע, כּ/ק, ט/ת, ח/כ, ב/ו, ס/שׂ), vowel signs with the same sound (קָמָץ/פַּתָּח = /a/,
  צֵירֵה/סֶגּוֹל = /e/, חוֹלָם חָסֵר/מָלֵא = /o/, קֻבּוּץ/שׁוּרוּק = /u/, חִירִיק חָסֵר/מָלֵא = /i/), quiet letters
  (final ה, א; ו/י as vowel letters), final letters (ך ם ן ף ץ), שְׁוָא (נָע/נָח — context dependent), קָמָץ קָטָן (reads /o/),
  and פַּתָּח גְּנוּבָה (תַּפּוּחַ).

## 3. Hebrew content invariants

Hard rules. A content validator and unit tests enforce them (`npm run validate`). Breaking one is a bug.

| ID | Rule |
|----|------|
| R-H1 | **No unlearned symbols.** An item is shown for *independent reading* only if every unit it contains (letters incl. dagesh/dot variant, vowel signs, final letters, shva, quiet letters) is introduced for this child. Computed from the pointed text, not hand-tagged. |
| R-H2 | **Same-sound options never compete.** In any task where the child chooses by sound, two options from the same sound class must not both appear (e.g. never ask "which letter says /t/?" with both ט and ת). Same for vowels: קמץ vs פתח are never rival answers. |
| R-H3 | **Teach the sign, not a fake sound difference.** קמץ and פתח are taught together as two ways to write /a/; same for צירה/סגול etc. The app never implies they sound different. |
| R-H4 | **No answer leakage in reading tasks.** When the goal is independent decoding, the word/picture/audio of the answer is not revealed before the child responds (no picture on the train before answering; no auto-speak of the written stimulus). |
| R-H5 | **Kamatz katan and patach genuva are excluded** from early content; words carrying them are tagged by hand and only appear from the Word Mountain world. |
| R-H6 | **Every item has an audio rendering.** Either a recorded clip or a TTS string (`say`) that makes the TTS pronounce it correctly. Isolated צירופים use the *speakable form* (`מָה`, `מִי`, `מֶה`, `מוֹ`, `מוּ`), never the bare pointed letter (TTS may read the letter name). |
| R-H7 | **Syllable splits are explicit** in content (`syl: ['בָּ','נָ','נָה']`) and must join (NFC) to the word. |
| R-H8 | **NFC normalization** everywhere: all comparisons and keys use `text.normalize('NFC')`. |
| R-H9 | **Checked pointing.** Every Hebrew string the child sees or hears (words, sight words, sentences, stories, questions, answer labels, missions, phrases, notebook and game names) passes the automatic nikud lint (`lintWord` in `hebrew.ts`): every inner consonant has a vowel or shva unless it is a vowel letter; word-initial בּגּדּכּפּתּ has dagesh; בגדכפת after a closed syllable (short vowel + shva nach) has dagesh; shva on a last letter only under ך/ת; final ך has shva or qamats; final/regular letter forms in the right place; one vowel per letter; hataf only under gutturals; ש always has its dot; no dagesh in אחער. Hand-checked exceptions live in `LINT_OK` (`validate.ts`). Items then carry `review: 'checked' | 'reviewed'`: `checked` = lint + proofreading; `reviewed` = a native-speaker teacher confirmed it. A teacher spot-check of new stories is still recommended. |
| R-H11 | **No repetition.** The app remembers when each word, sentence, sight word and story was last shown (`learner.seen`); generators always prefer the least recently seen content, so a child does not meet the same items again until the pool is used up. |
| R-H10 | **Order is configurable.** The letter and vowel introduction order is data (the *spine*), and a parent can mark units "already learned at school". |

### 3.1 Units (what R-H1 gates on)

Derived by `parseHebrew(text)` from Unicode marks:

| Unit ID | Meaning | Example |
|---------|---------|---------|
| `L.<letter>` | consonant, incl. variant: `bet`(בּ) `vet`(ב) `kaf`(כּ) `khaf`(כ) `pe`(פּ) `fe`(פ) `shin`(שׁ) `sin`(שׂ) + the other 19 letters | שָׁ → `L.shin` |
| `L.final<X>` | final forms `finalKhaf` ך `finalMem` ם `finalNun` ן `finalFe` ף `finalTsadi` ץ | יָם → `L.finalMem` |
| `V.a` `V.i` `V.e` `V.o` `V.u` | vowel *sound group*; the group covers its signs (`V.a` = קמץ+פתח, `V.i` = חיריק חסר+מלא, `V.e` = צירה+סגול (+צירה מלא), `V.o` = חולם מלא+חסר, `V.u` = שורוק+קובוץ) | פִּיל → `V.i` |
| `V.shva` | any שווא (נע or נח) except under final ך | סַבְתָּא |
| `V.hataf` | חטף פתח/סגול/קמץ | אֲנִי |
| `X.quiet` | a letter that is not pronounced: final ה/א after a vowel, ו/י used as vowel letters are *not* in this unit (they are part of `V.o`/`V.u`/`V.i`) | פָּרָה, סַבָּא |
| `X.genuva` | פתח גנובה | תַּפּוּחַ |
| `X.katan` | קמץ קטן (hand-tagged, cannot be detected) | צָהֳרַיִם |

Dagesh in letters other than ב/כ/פ does not change pronunciation and is not a unit. מַפִּיק is ignored.

### 3.2 Sound classes (what R-H2 checks)

`'ʔ': א ע` · `'k': כּ ק` · `'t': ט ת` · `'kh': ח כ ך` · `'v': ב ו` · `'s': ס שׂ` · `'m': מ ם` · `'n': נ ן` · `'f': פ ף` ·
`'ts': צ ץ`. Every other letter is its own class. Vowel classes = the five sound groups + shva.

### 3.3 Speakable forms (what R-H6 uses)

Hebrew TTS reads a lone pointed letter badly (often the letter *name*). Solution: speak the צירוף with a trailing quiet
letter so the TTS produces a clean syllable.

| Vowel | Written | Spoken as |
|-------|---------|-----------|
| /a/ | מָ / מַ | `מָה` |
| /i/ | מִ | `מִי` |
| /e/ | מֵ / מֶ | `מֶה` |
| /o/ | מוֹ / מֹ | `מוֹ` |
| /u/ | מוּ / מֻ | `מוּ` |

Letter *sounds* are spoken as the /a/ syllable (`מָה`), and fricative variants via their sound twin (ב → `וָה`,
כ → `חָה`, שׂ → `סָה`). פ (fe) has no twin and is flagged `needsRecording`. Any item can override with `say`.

## 4. Users, platform and constraints

| ID | Requirement |
|----|-------------|
| R-U1 | **Child (primary user), 5-8.** May not read at all. Uses the app alone on a phone or tablet. |
| R-U2 | **Parent (secondary).** Sets up profiles and settings, reads the progress report, behind a parent gate. |
| R-U3 | **Teacher (later).** Reads the same report; class features are out of scope for v1. |
| R-T1 | **Platform: native mobile via Expo (React Native + TypeScript)**, iOS and Android, tablet-first, phone supported, portrait and landscape. The same code runs on the web (used for automated tests and as a bonus web version). |
| R-T2 | **Runs in Expo Go** during development: no custom native modules. Only Expo SDK modules + pure JS libraries. |
| R-T3 | **Offline.** Everything works with no network after install (TTS uses the device's Hebrew voice). |
| R-T4 | **Audio.** Device Hebrew TTS via `expo-speech` (prefer natural/enhanced voices), plus per-item recorded clips that override TTS when present (`assets/audio/`). Sound effects are bundled WAV files. |
| R-T5 | **RTL.** All layouts are right-to-left regardless of the device locale (`I18nManager.isRTL` may be either; layout helpers handle both). |
| R-T6 | **Fonts.** Reading text: *Noto Sans Hebrew* (clean print letters, correct nikud placement). UI: *Rubik*. Word Collector also uses a serif Hebrew font for font variety. All OFL. |
| R-T7 | **Performance.** First interaction < 3 s on a mid-range phone; every tap gets visual feedback within 100 ms. |

## 5. The journey

Eight themed worlds on one right-to-left map, plus a parallel Story Time and an optional extension world. The child never
has to pick a world: **Continue** picks the next activity. The map shows progress and allows free play in unlocked worlds.

| # | World ID | Hebrew (spoken) | Skill focus | Phase |
|---|----------|-----------------|-------------|-------|
| 0 | `forest` | יַעַר הַצְּלִילִים — The Sound Forest | phonological awareness | MVP |
| 1 | `island` | אִי הָאוֹתִיּוֹת — Letter Island | letter ↔ sound, letter shapes | MVP |
| 2 | `workshop` | סַדְנַת הַנִּקּוּד — The Nikud Workshop | vowel signs, צירופים | MVP |
| 3 | `train` | רַכֶּבֶת הַמִּלִּים — The Word Train | blending, short decodable words | MVP |
| 4 | `mountain` | הַר הַמִּלִּים — The Word Mountain | finals, shva, quiet letters, long words | MVP (1 game) |
| 5 | `museum` | מוּזֵאוֹן הַמִּלִּים — The Word Museum | sight words, morphology | MVP (1 game) |
| 6 | `theatre` | תֵּאַטְרוֹן הַסִּפּוּרִים — The Story Theatre | phrase & sentence fluency | MVP (2 games) |
| 7 | `kingdom` | מַמְלֶכֶת הַסִּפּוּרִים — The Story Kingdom | reading comprehension | MVP (2 games) |
| 8 | `bridge` | גֶּשֶׁר בְּלִי נִקּוּד — The Unpointed Bridge | first unpointed words | v3, optional |
| — | `storytime` | שְׁעַת סִפּוּר — Story Time | listening comprehension, vocabulary | MVP, from day 1 |

> Naming note: the blueprint called world 4 "The Word Explorer", which collides with the Word Train game "Word Explorer".
> World 4 is **The Word Mountain**; `wordExplorer` is only the game.

**Unlocking (R-J1):** a world unlocks when any skill it practises becomes available (its prerequisites are introduced).
The Sound Forest is open at start but is not mandatory: placement can skip it (R-J2). Locked worlds show a padlock and say
"עוֹד מְעַט נַגִּיעַ לְכָאן!" (we'll get here soon) when tapped (R-J3).

### 5.1 The curriculum spine (default, configurable — R-H10)

The spine is the ordered list of *units/skills to introduce*. Letters and vowels are **interleaved** so the child reads
real צירופים and words early (motivation + R-P1). The planner introduces the next spine entry when the in-flight entries
are going well (§7.3). A final form is introduced right after its base letter's family is in use.

```
 1. PA.first, PA.count, PA.blend      Sound Forest (always open; placement can skip it)
 2. L.mem L.lamed L.dalet L.gimel     4 visually distinct letters
 3. V.a                               קמץ + פתח together → מָ לָ דָּ גָּ, first words דָּג, גָּמָל
 4. L.yod L.resh L.qof L.finalMem     → יָד, יָם, קַר, מָרָק (W1 opens with ≥ 4 words)
 5. L.he L.het L.nun L.finalNun       → הַר, חַג, חַם, נָהָר, עָנָן…
 6. V.i                               → פִּיל… (after פּ), קִיר, עִיר
 7. L.shin L.bet L.vet L.samekh
 8. V.e                               (common school order: a, i, e, o, u)
 9. L.tav L.pe L.alef X.quiet         quiet final ה/א → פָּרָה, סַבָּא, מַפָּה
10. V.o
11. L.kaf L.ayin L.tsadi L.finalTsadi
12. V.u
13. L.zayin L.tet L.vav L.khaf L.finalKhaf L.fe L.finalFe L.sin   (fricative twins and the rest)
14. V.shva
15. V.hataf X.genuva                  Word Mountain (later)
```

The data file is the source of truth (`DEFAULT_SPINE` in `src/engine/curriculum.ts`). Higher skills (CV, W1-W3, FIN,
SIGHT, FLU.*, COMP.read) are not in the spine: they open automatically when enough decodable content exists
(`practiceable` in `gating.ts`). `npm run validate` prints how many words, sight words, sentences and reading stories
become decodable at each step. Story Time and comprehension (`COMP.listen`) run in parallel from step 1.

## 6. Skills model and mastery

### 6.1 Skill IDs

| Strand | IDs | Practised by |
|--------|-----|--------------|
| Phonological | `PA.first` initial sound · `PA.final` final sound (v1) · `PA.count` syllable count · `PA.blend` syllable blending · `PA.same` sound discrimination (v1) | soundSafari, syllableHop, robotMixer, soundTwins |
| Letters | `L.<id>` per letter/variant/final (31) — **sound** knowledge. `LN.<id>` letter *name* (tracked, never gates). | soundLighthouse, letterDetective, firstSoundMarket, buildALetter |
| Nikud | `V.a V.i V.e V.o V.u V.shva V.hataf` | nikudMagnet, syllableDJ, secretPassword, nikudSorter |
| Decoding | `CV` read צירופים · `W1` 1-syllable · `W2` 2-syllable · `W3` 3+ syllables · `X.quiet` · `FIN` final letters in words | syllableTrain, wordBakery, wordExplorer, missingSound, finalTransformer, longWordMaze |
| Word recognition & morphology | `SIGHT` frequent words · `MORPH.prefix` · `MORPH.family` · `MORPH.pattern` (v2) | wordCollector, familyTree, prefixPuzzle, patternDetective |
| Fluency | `FLU.phrase` · `FLU.sentence` · `FLU.passage` | echoReader, phraseTrain, storyRehearsal, theatreActors |
| Comprehension | `COMP.listen` (after listening) · `COMP.read` (after independent reading) · `COMP.seq` · `COMP.infer` | storyTime, storyDetective, storyPuzzle, whatNext, drawWhatYouRead |

**R-S1:** Listening comprehension and reading comprehension are separate skills and separate report lines.
**R-S2:** Each answer is credited to the skill(s) of the *item* (a Sound Lighthouse round about ש credits `L.shin`), not
to the game.

### 6.2 What is recorded per answer (R-S3)

```ts
interface Attempt {
  t: number;            // epoch ms
  skill: SkillId;
  game: GameId;
  item: string;         // content item id (word id, letter id, cv "mem+a"…)
  ok: boolean;          // final outcome of the item
  help: 0 | 1 | 2;      // 0 independent, 1 after a hint, 2 after a demonstration (modeled)
  firstChoice?: string; // what the child picked first if wrong (confusion tracking)
  ms: number;           // time to first answer (never shown to the child, never timed against)
}
```

### 6.3 Skill states and mastery (R-S4)

`locked → available → introduced → practising → mastered`, with `review due` as a flag on mastered skills.

- **available:** all prerequisites are `introduced` or better.
- **introduced:** the child has seen the demonstration (Show me) once, or placement/parent marked it.
- **mastered** when **all** hold (initial product heuristic, to be validated with teachers; not an official threshold):
  - ≥ **85 %** correct over the **last 8 independent attempts** (`help = 0`) on that skill, and
  - those correct answers include **≥ 2 different games** (transfer), and
  - attempts came from **≥ 2 different days** (stability), and
  - at least half of the independent correct answers were on items the child had not answered correctly before (new items).
- **Spaced review:** on mastery, `box = 1`; review due after `[1, 3, 7, 14, 30]` days for boxes 1-5. A review activity with
  ≥ 80 % independent accuracy moves the box up; < 70 % (min 3 attempts) moves the skill back to `practising`
  (no stars or stickers are ever taken away — R-P6).
- **Report bands** (shown to parents, never to the child as a grade): *Not started* · *Practising* (< 60 %) ·
  *Developing well* (60-84 %) · *Strong* (mastered) · flag *Needs practice* when the last 6+ attempts are < 60 %.

All thresholds live in one config object (`MASTERY` in `src/engine/learner.ts`) so they can be tuned.

## 7. Adaptive engine

### 7.1 Placement — "the playful starting check" (R-A1)

Runs once after setup (re-runnable from the parent area). Feels like a game: Butz asks, every answer gets a cheer,
**no pass/fail screen, no score shown, no hints, one try per item**. ≤ 22 items, ≈ 4 minutes, and a block stops after
3 misses in a row (deeper blocks are then skipped).

| Block | Items | Game used | Result |
|-------|-------|-----------|--------|
| Sounds | 1 × blend, 1 × first sound | robotMixer, soundSafari | `PA.*` introduced |
| Letters | 6 common letters (מ ל ר שׁ ד בּ), then 6 more (נ ת ג י ק פּ) if ≥ 5/6 | soundLighthouse (3 choices from the whole alphabet) | each correct letter → `introduced` with 1 independent attempt; ≥ 11/12 → the other 14 base letters are marked introduced too (practice verifies them) |
| Nikud | one צירוף per vowel group (a, i, e, o, u) with letters the child just showed | syllableDJ | each correct group → `V.x` + `CV` introduced |
| Words | 3 decodable words (only if ≥ 60 % in Nikud) | wordExplorer | `W1`/`W2`/`W3` introduced |

Placement never marks a skill mastered: mastery needs the evidence in §6.3. Guessing (1 in 3) is corrected quickly by
normal practice. Units introduced by placement or by the parent ("learned at school") never block new teaching (§7.3).
The child gets 10 ⭐ for finishing.

### 7.2 Continue — the session planner (R-A2)

A session is **6-10 minutes** by default (parent setting: 5 / 8 / 12). The child can stop at any time; progress is saved
after every item. The planner builds an ordered list of activities:

1. **Warm-up review** (0-1): the most overdue `review due` skill, or the top remediation from §7.4.
2. **Teach** (0-1): if the next spine entry should be introduced (§7.3), its demonstration activity ("Show me" + guided).
3. **Practise** (2): the current focus skills in **two different game formats**, preferring formats not yet used
   successfully for that skill (transfer). Items interleave focus targets (≈ 60 %) with other introduced units weighted
   by weakness (≈ 40 %).
4. **Story Time** (1, once per day): listening story + questions; if `COMP.read` is available, alternate with a reading
   story.
5. **Celebration**: stars summary, and the surprise-envelope button if the child can afford the next envelope (§10.1).

Each activity is ≈ 5 items (1 guided + 4 independent) and ≈ 1.5-2 minutes.

### 7.3 When to introduce the next spine entry (R-A3)

Introduce the next entry when every unit the app is **teaching** (introduced by a demonstration, not by placement or the
parent) has ≥ 70 % over its last 6 independent attempts (or is mastered), **and** fewer than 3 such units are in flight.
Never introduce more than **one** new unit per session.

### 7.4 Remediation rules (R-A4)

| Observation (rolling window) | Action |
|------------------------------|--------|
| A letter confused with the same other letter ≥ 3 times in the last 30 attempts (`firstChoice`) | Letter Detective with exactly those two letters + 1 easy distractor, then Sound Lighthouse on the pair |
| Letter shape OK (Detective ≥ 80 %) but sound < 60 % | Sound Lighthouse + First-Sound Market, audio replay before each item |
| Vowel known alone (`V.x` ≥ 80 %) but `CV` < 60 % | Nikud Magnet (guided) then Syllable DJ |
| `CV` ≥ 80 % but `W1`/`W2` < 60 % | Syllable Train in guided mode (carriages speak on tap) |
| Correct mostly with hints (> 50 % `help > 0` in last 8) | next activity starts with a demonstration and stays guided |
| 3 misses in a row inside an activity | fewer choices (4 → 3 → 2), then demonstrate, end the activity early with a positive close and schedule a prerequisite |
| > 50 % misses over the last 6 items of a session | end the session early with a celebration (fatigue) |
| `COMP.listen` ≥ 80 % but `COMP.read` < 60 % and decoding not mastered | keep listening stories; focus decoding; note it in the parent report |
| Accurate but slow (median first-answer time > 6 s on mastered items) | Word Collector + Echo Reader (repetition, never a timer) |

### 7.5 Distractor rules (R-A5)

- Options come from units the child has been **introduced** to (Letter Detective may add unknown letters as background noise).
- Respect R-H2 sound classes.
- Difficulty: *easy* = visually and audibly distant options; *hard* = visually similar letters (ב/כ/פ, ד/ר/ך, ו/ז/ן/י,
  ה/ח/ת, ס/ם/ט, ע/צ/א, ג/נ, מ/ט, ש/ע, ק/ה) and same-letter-different-vowel צירופים.
- Default **3 options**; 4 when a skill is practising ≥ 80 %; 2 in "fewer choices" mode or after 2 misses.

## 8. Game engine

### 8.1 Round structure (R-G1) — every game, same rhythm

1. **Mission card** — silent: the game's icon and name, Butz (the owl mascot) and a 👂 button. Tapping 👂 makes Butz say
   the goal in the child's grammatical gender ("הַקְשֵׁב לַמִּלָּה, וּמְצָא…" / "הַקְשִׁיבִי לַמִּלָּה, וּמִצְאִי…"); the 👂
   wiggles the first time a game is played. ▶ starts. 👂 stays in the game header (R-G5).
2. **Show me** — first time a skill is met (or after remediation): Butz demonstrates one item (animation + speech).
3. **Let's try together** — 1 guided item: hint offered after the first miss.
4. **Your turn** — 3-4 independent items.
5. **Helpful feedback** — correct: chime + short praise + sparkle; wrong: soft "boop", the wrong option fades, Butz gives a
   hint ("זֶה עוֹשֶׂה מָה… נְנַסֶּה שׁוּב?"). Second miss: Butz shows the answer, the child taps it (logged `help: 2`).
6. **Celebration** — stars fly to the counter; progress dots fill.

Progress dots (not numbers) show items left. An **X** in the corner leaves at any time (no confirmation for the child; the
activity is saved as partial).

**R-G5 Instructions on demand.** Instructions, greetings, screen names and explanations are **never spoken
automatically** — hearing them every time is annoying. Every child screen that needs explaining has a 👂 button (Home,
mission card + game header, notebooks, shop, starting check, session end). Spoken automatically are only: the task
stimulus itself (the sound/word to find, option names in listening tasks), Story Time narration, a new unit's "Show me"
demonstration, and short feedback (praise, a gentle retry line, the answer after a second miss).

### 8.2 Help levels (R-G2)

| Level | Trigger | Effect | Logged |
|-------|---------|--------|--------|
| 0 | — | independent | `help: 0` |
| 1 | first miss, or the child taps Butz's 💡 | replay the prompt slowly, remove one wrong option | `help: 1` |
| 2 | second miss, or 💡 again | Butz points at the answer and says it; child taps it | `help: 2` |

### 8.3 Mechanics (reusable engines, R-G3)

| Mechanic | Child action | Powers |
|----------|--------------|--------|
| `M.listenChoose` | hear prompt → tap one of 2-4 tiles (letters, צירופים, words or pictures) | soundSafari, soundLighthouse, syllableDJ, robotMixer, wordCollector, storyTime questions |
| `M.readChoose` | read a written stimulus (no audio) → tap the matching picture/sound | wordExplorer, secretPassword, syllableTrain, storyDetective |
| `M.findTap` | tap every target in a grid | letterDetective, patternDetective |
| `M.build` | tap pieces in order to fill slots (drag optional, never required) | nikudMagnet, wordBakery, finalTransformer, missingSound |
| `M.count` | tap one stone per syllable heard | syllableHop |
| `M.sequence` | tap cards in story order | storyPuzzle, phraseTrain (v1) |
| `M.sort` | tap an item, then a basket | nikudSorter, soundTwins, prefixPuzzle |
| `M.readAlong` | text with moving highlight; child reads, then compares with the model | echoReader, phraseTrain, storyRehearsal |
| `M.story` | paged picture story read aloud with highlighted sentence, then questions | storyTime, storyKingdom |

Each mechanic is a React component: `({ item, mode, onAnswer }) => UI`. Each **game** = mechanic + item generator + texts.
A generator is pure: `generate(ctx) => Item[]` where `ctx` holds the learner snapshot, target skills, difficulty, RNG.

### 8.4 Interaction rules (R-G4)

- Tap targets ≥ 64 dp (≥ 88 dp for main choices on tablets); 16 dp minimum gap.
- One instruction at a time; at most 4 options on screen (except Letter Detective's grid).
- Every prompt can be replayed with the speaker button; tapping a *picture* option speaks its word (pictures are not
  reading), tapping a *written* option in a reading task does **not** speak it (R-H4).
- No timers, countdowns or speed scoring anywhere.
- Animations ≤ 600 ms; reduced-motion setting replaces them with fades.

## 9. Game catalog

Status: **MVP** = in the first release; v1/v2/v3 = later (see §12.5). Each game lists acceptance criteria (AC).

### World 0 — The Sound Forest (`forest`)

**G-01 `soundSafari` — סָפָארִי צְלִילִים — Sound Safari** · MVP · `PA.first` (`PA.final` in v1) · `M.listenChoose`
Butz says a word ("שֶׁמֶשׁ… מִי מַתְחִיל כְּמוֹ שֶׁמֶשׁ?"); the child taps the animal/object whose name starts with the
same sound (3 pictures). Isolated phonemes are never spoken (TTS can't); matching is word-to-word.
AC: options never share the target's first sound class except the answer; tapping a picture speaks its word; 5 items.

**G-02 `syllableHop` — קְפִיצַת הֲבָרוֹת — Syllable Hop** · MVP · `PA.count` · `M.count`
Butz says a word with its picture (בָּנָנָה); the child taps one stone per syllable; then taps "jump" and the character
hops once per stone while each syllable is spoken. 1-4 syllables.
AC: syllable count comes from `syl`; the hop animation speaks each syllable; "undo" stone available; 5 items.

**G-03 `robotMixer` — הָרוֹבּוֹט מְחַבֵּר — Robot Word Mixer** · MVP (built early: placement uses it) · `PA.blend` · `M.listenChoose`
The robot says syllables separately (בָּ… לוֹן); the child taps the picture of the whole word (3 pictures).

**G-04 `soundTwins` — תְּאוֹמֵי צְלִילִים — Sound Twins** · v1 · `PA.same` · `M.sort`
Two spoken words: same first sound? 👍 / 👎. Later: which word starts differently (odd one out).

### World 1 — Letter Island (`island`)

**G-05 `soundLighthouse` — מִגְדַּלּוֹר הַצְּלִילִים — The Sound Lighthouse** · MVP · `L.*` · `M.listenChoose`
The lighthouse calls a letter sound (speakable form, §3.3); the child taps the matching letter (2-4 big letters) and the
lighthouse lights up.
AC: R-H2 enforced; letters shown without nikud; dagesh/dot variants shown with their mark (בּ vs ב); 5 items.

**G-06 `letterDetective` — בַּלַּשׁ הָאוֹתִיּוֹת — Letter Detective** · MVP · `L.*` (shape) · `M.findTap`
A big target letter (spoken by sound and name) and a 3×3 to 4×4 grid of letters; tap all copies of the target with the
magnifying glass. Hard mode adds visually similar letters and two fonts.
AC: 2-4 targets per grid; wrong taps wobble but do not end the round; round ends when all targets found; 3 grids.

**G-07 `buildALetter` — סַדְנַת הָאוֹתִיּוֹת — Build-a-Letter** · v1 · `LN.*`, shape · tracing with a finger along stroke
paths.

**G-08 `firstSoundMarket` — שׁוּק הַצְּלִיל הָרִאשׁוֹן — The First-Sound Market** · v1 · `L.*` · `M.sort`
Hear a word, put its picture in the basket of its first letter (2-3 baskets).

### World 2 — The Nikud Workshop (`workshop`)

**G-09 `nikudMagnet` — מַגְנֵט הַנִּקּוּד — The Nikud Magnet** · MVP · `V.*`, `CV` · `M.build`
A letter sits on the workbench. Two modes: **explore** (tap any vowel sign from the tray → it snaps under the letter and
the צירוף is spoken) and **challenge** ("make מוּ" → pick the right sign).
AC: tray shows only introduced signs; both signs of a sound group are correct (קמץ or פתח for /a/) unless the item
asks for a specific sign; 5 items; explore mode is the "Show me" for every new vowel.

**G-10 `syllableDJ` — דִּי־גֵ'יי הֲבָרוֹת — Syllable DJ** · MVP · `CV`, `V.*` · `M.listenChoose`
Hear a צירוף, tap the matching written צירוף on the DJ pads (3 pads). Distractors: same letter/other vowel and
same vowel/other letter.
AC: R-H2 for vowels (never מָ vs מַ as rivals); 5 items.

**G-11 `nikudSorter` — מְמַיֵּן הַנִּקּוּד — The Nikud Sorter** · v1 · `V.*` · `M.sort` — sort written צירופים into
baskets by vowel sound.

**G-12 `secretPassword` — הַסִּיסְמָה הַסּוֹדִית — The Secret Password** · MVP · `CV` (reading direction) · `M.readChoose`
A magic door shows a written צירוף (e.g. מוּ). Three sound keys 🔑 play a צירוף each when tapped; the child picks the key
whose sound matches and the door opens to reveal a creature. This is the **written → sound** direction (decoding),
complementing Syllable DJ (sound → written).
AC: the written צירוף is never spoken before the answer; keys can be replayed freely; 5 items.

### World 3 — The Word Train (`train`)

**G-13 `syllableTrain` — רַכֶּבֶת הַהֲבָרוֹת — The Syllable Train** · MVP · `W1`-`W3` (blending) · `M.readChoose`
The train arrives with one צירוף/syllable per carriage (דָּ | ג). The child reads, then taps the picture the train should
carry (3 pictures). Guided mode: tapping a carriage speaks it; then the carriages slide together.
AC: independent mode never speaks the word before the answer (R-H4); words gated by R-H1; 5 items.

**G-14 `wordBakery` — מַאֲפִיַּת הַמִּלִּים — The Word Bakery** · MVP · `W1`-`W3` (encoding) · `M.build`
Butz orders a cake shaped like a word (picture + spoken word). The child taps syllable blocks into the baking tray in
order (correct blocks + 1-2 distractor blocks).
AC: blocks sit right-to-left; a wrong block bounces back with a hint; undo; 4 items.

**G-15 `missingSound` — הַצְּלִיל הֶחָסֵר — Rescue the Missing Sound** · v1 · `CV`, `W*` · `M.build`
A word with a missing letter or vowel sign; choose the missing piece.

**G-16 `wordExplorer` — מְגַלֶּה הַמִּלִּים — The Word Explorer** · MVP · `W1`-`W3` (transfer) · `M.readChoose`
A new, never-answered decodable word on a treasure map; the child taps the matching picture (3). After answering, the word
is spoken and its picture joins the explorer's album.
AC: prefers words the child has never answered (new-item evidence for mastery); no audio before the answer; 5 items.

### World 4 — The Word Mountain (`mountain`)

**G-17 `finalTransformer` — הָרוֹבּוֹט הַמְּשַׁנֶּה — The Final Letter Transformer** · MVP · `L.final*`, `FIN` · `M.build`
A word is missing its last letter; two options: the regular and the final form (מ / ם). Placing the regular form at the
end makes the robot "transform" it. Mode 2: a letter at the start/middle vs end.
AC: only pairs whose base letter is introduced; 5 items.

**G-18 `shvaSubmarine` — צוֹלֶלֶת הַשְּׁוָא — The Shva Submarine** · v1 · `V.shva` — read words with shva in context;
expert-reviewed examples only (shva נע/נח is context dependent).

**G-19 `ahvyDetectives` — בַּלָּשֵׁי אֶהֱוִ"י — The AHVY Detectives** · v1 · `X.quiet`, matres lectionis.

**G-20 `longWordMaze` — מָבוֹךְ הַמִּלִּים הָאֲרֻכּוֹת — The Long-Word Maze** · v1 · `W3` — walk a word one syllable at
a time.

### World 5 — The Word Museum (`museum`)

**G-21 `wordCollector` — אַסְפַן הַמִּלִּים — The Word Collector** · MVP · `SIGHT` · `M.listenChoose`
Butz names a frequent word (שֶׁל, יֵשׁ, לֹא, הוּא…); the child finds it among 3 written words shown in **different fonts
and colors**; collected words go into the museum showcase.
AC: same word in ≥ 2 fonts across items; only words decodable or explicitly marked sight words; 5 items.

**G-22 `familyTree`** (כָּתַב, כְּתִיבָה, מִכְתָּב) · v2 · `MORPH.family`. **G-23 `prefixPuzzle`** (וְ, הַ, בְּ, מִ, לְ) ·
v2 · `MORPH.prefix`. **G-24 `patternDetective`** · v2 · `MORPH.pattern`. Introduce relations through familiar words and
pictures, never grammar terms. Decoding stays the priority for children still struggling with it.

### World 6 — The Story Theatre (`theatre`)

**G-25 `echoReader` — קוֹרֵא הַהֵד — The Echo Reader** · MVP · `FLU.sentence` · `M.readAlong`
(1) Try it: the child reads the sentence alone (no audio) and taps "קָרָאתִי!". (2) Check: a picture question
(3 pictures) — the scored, independent evidence. (3) Listen: Butz reads it phrase by phrase with highlighting. (4) Echo:
the child reads it again like Butz and gives a self-check 👍 (or 🔊 to hear it again). No microphone needed.
AC: only the picture question is scored (`FLU.sentence`); the stimulus is never spoken before it (R-H4); 3 sentences.

**G-26 `phraseTrain` — רַכֶּבֶת הַמִּשְׁפָּטִים — The Phrase Train** · MVP · `FLU.phrase` · `M.readAlong`
The sentence appears as phrase carriages (הַכֶּלֶב רָץ | בַּגִּנָּה). The child taps each carriage in order while reading it,
then answers a picture question (scored), then hears the model phrase by phrase.
AC: phrase split comes from content (`|` in `texts.ts`); 3 sentences.

**G-27 `storyRehearsal`** · v1 · repeated reading of the same passage across sessions (track smoothness by self-check
and, later, optional speech recognition). **G-28 `theatreActors`** · v2 · dialogue with character voices, punctuation and
expression (prosody). Never a speed race.

### World 7 — The Story Kingdom (`kingdom`)

**G-29 `storyPuzzle` — פָּאזֶל הַסִּפּוּר — Story Puzzle** · MVP · `COMP.seq` · `M.sequence`
After a story (read or heard), 3-4 scene cards appear shuffled; the child taps them in order (right to left slots).
AC: a misplaced card returns to the pool with a hint; works for listening and reading stories.

**G-30 `storyDetective` — בַּלַּשׁ הַסִּפּוּרִים — The Story Detective** · MVP · `COMP.read` · `M.story` + `M.listenChoose`
The child reads a short decodable story (tap a word to hear it only for words marked "story words"), then answers
מִי / מָה / אֵיפֹה / לָמָּה questions with picture options; the question is spoken.
AC: a story is offered only if ≥ 90 % of its word tokens are decodable for the child (R-H1); 2-3 questions.

**G-31 `whatNext`** (prediction) · v1. **G-32 `drawWhatYouRead`** (read a sentence, pick/draw the scene) · v1.

### Story Time (`storytime`) — parallel strand from day 1

**G-33 `storyTime` — שְׁעַת סִפּוּר** · MVP · `COMP.listen`, vocabulary · `M.story`
Butz reads a picture story aloud (4-6 pages, sentence highlighted, page turns by tap or automatically). Then 2 spoken
questions with picture answers ("מָה עָף?") and sometimes a Story Puzzle. Language may be richer than what the child can
decode (it is heard, not read).
AC: once per day in Continue; also available from the map any time; stories are scored as `COMP.listen` only.

### Extension — The Unpointed Bridge (`bridge`) · v3, optional

`nikudDisappears` (familiar pointed words fade their nikud) · `meaningDetectives` (context picks the meaning) ·
`doubleMeaning` (same letters, different reading) · `pointedOrNot`. Only for children with mastered `W3` and `FLU.*`.

## 10. Rewards

### 10.1 Stars (R-R1)

Stickers must feel earned: they take **a lot of practice** (`economy.ts`).

| Action | Stars |
|--------|-------|
| Finish an activity (any accuracy — effort counts; stories too) | 1 |
| ≥ 80 % answered without help in that activity | +1 |
| Finish a review activity | +1 |
| A skill becomes mastered | +3 (with a special cheer) |
| Finish the starting check | 10 (once) |
| Open a surprise envelope | −(20 + 2 × stickers already collected), at most −60 |
| Unlock a new notebook | −50 |

So the first sticker takes ≈ 10-15 activities (2-3 sessions) and later ones up to ≈ 30-40 activities. Stars are never lost
by mistakes. Tune with real children.

### 10.2 Sticker notebooks (R-R2)

**16 themed notebooks × 30 stickers** (5 pages × 6 slots) = 480 stickers. Notebooks are offered by the gender chosen at
setup: 6 shared + 5 for boys + 5 for girls, so each child sees 11. A child starts with 2: `animals` + `dino` (boy) or
`magic` (girl).

| Shared | Boys | Girls |
|--------|------|-------|
| `animals` חֲבֵרִים מֵהַחַיּוֹת (start) | `dino` עוֹלַם הַדִּינוֹזָאוּרִים (start) | `magic` הַיַּעַר הַקָּסוּם (start) |
| `sea` מִתַּחַת לַיָּם | `vehicles` אֹסֶף כְּלֵי רֶכֶב | `princess` הַנְּסִיכוֹת |
| `space` חוֹקְרֵי הֶחָלָל | `sports` כּוֹכְבֵי סְפּוֹרְט | `garden` הַגִּנָּה הַפּוֹרַחַת |
| `wild` חַיּוֹת הַבָּר | `heroes` גִּבּוֹרִים וְאַבִּירִים | `bakery` מַמְתַּקִּים וְעוּגוֹת |
| `food` אֹכֶל טָעִים | `builders` בּוֹנִים וּמַמְצִיאִים | `music` מוּזִיקָה וְרִקּוּד |
| `israel` הַהַרְפַּתְקָה הַיִּשְׂרְאֵלִית | | |

Stickers are large emoji (Unicode ≤ 13, checked by `npm run validate`) on round badges — **and they are alive**
(`LiveSticker`): each one floats, wiggles, pulses, swings, hops or flips on its own rhythm; a tap makes it jump and spin
with a sound. Stickers 5, 14, 23 and 30 of every notebook are **shiny** (gold ring, sparkle, twinkle sound, a special
reveal). The newest stickers also play on the home screen. "Less motion" stops all of it. **Surprise flow:** the
envelope wiggles when affordable → tap → spinning reveal → "put it in my notebook" → stays forever.
**No duplicates (R-R3):** a reveal always picks a sticker the child does not own in the active notebook. A completed
notebook gets a golden trophy sticker and the next envelope fills another owned notebook.

### 10.3 The shop (R-R4)

The surprise envelope (price from §10.1) and the notebooks for the child's gender (50 ⭐) — that is all. No real money,
no ads, no pay-to-win, no leaderboard, no streak pressure, no loss of rewards for breaks or mistakes. Too few stars →
Butz says how many more are needed, kindly ("צָרִיךְ עוֹד 12 כּוֹכָבִים. בּוֹאִי נְשַׂחֵק!").

## 11. Navigation, parent area, accessibility, privacy

### 11.1 Child navigation (R-N*)

- **Home** (R-N1): avatar + name, **one huge Continue button** (Butz + ▶ + 👂), the newest stickers alive, and medium
  buttons: **Map** 🗺️, **My notebooks** 📒 and **Sticker shop** 🛍️. Star counter; tiny parent gear (gated).
- Every button **speaks its label** when tapped; screens explain themselves only when 👂 is tapped (R-N2, R-G5).
- **Map** (R-N3): islands along a path that starts on the right; locked worlds show a padlock.
- **Address** (R-N7): Butz speaks to the child in the grammatical gender chosen at setup (גַּע/גְּעִי, אַלּוּף/אַלּוּפָה);
  all gendered lines live in `phrases.ts` and the missions in `curriculum.ts` (`mission: [boy, girl]`).
- **Consistency** (R-N4): same characters, colors and button positions everywhere; colour is never the only signal
  (icons + shapes too).
- No long written text on child screens (R-N5). Texts that appear are short, pointed, and always also spoken.
- **No-voice warning** (R-N6): if no Hebrew voice exists, a parent-facing banner explains how to install one
  (iOS: Settings → Accessibility → Spoken Content → Voices → Hebrew; Android: Settings → Text-to-speech → Google → Hebrew).

### 11.2 Parent area (R-PA*)

- **Gate** (R-PA1): press-and-hold 3 s, then a sum written in digits (e.g. 7 + 5) with 4 options. Friction, not security.
- **First-run setup** (R-PA2): the app starts by creating the child's profile. Step 1: **boy or girl** (two big cards
  בֵּן 👦 / בַּת 👧) — this decides how Butz addresses the child and which notebooks the shop offers. Step 2: name
  (optional) and an animal friend. Then the starting check. Gender can be changed later in the Children tab.
- **Profiles** (R-PA3): several children on one device; switch from the home screen avatar.
- **Progress report** (R-PA4): per strand (Letters & sounds · Nikud & צירופים · Blending words · Sight words ·
  Fluency · Listening comprehension · Reading comprehension) a band from §6.3, per-letter and per-vowel grid,
  confusions (e.g. "ב ↔ כ"), last 7 days activity, and "what we'll practise next". Clearly labelled *learning
  observations, not a diagnosis*.
- **Settings** (R-PA5): sound effects, speech rate (slow / normal), session length, text size (100 / 125 / 150 %),
  high contrast, reduced motion, fewer choices, letter/vowel order preset, "learned at school" units, re-run the
  starting check, reset progress (double confirm).
- **Voice check** (R-PA6): the mascot's name first (it must sound "Butz"), then a list of items with ▶ and 👎. A 👎
  marks the item's audio as wrong on this device; such items
  are excluded from tasks where the audio is the stimulus until a recording exists. (v1: record the parent's own voice
  for an item.)

### 11.3 Accessibility (R-X*)

| Need | Adaptation |
|------|------------|
| Dyslexia / decoding difficulties | explicit teaching, cumulative practice, short tasks, constant sound-letter links |
| ADHD / attention | short rounds, one instruction at a time, predictable layout, optional break after each activity |
| Working memory | fewer choices setting, short instructions, one step per screen |
| Visual | text size 150 %, letter spacing, high contrast, less animation |
| Speech | microphone never required (R-X1) |
| Motor | tap-only everywhere (drag never required), large targets (R-X2) |
| Sensory | sound effects off, reduced motion, no background animation (R-X3) |

### 11.4 Privacy (R-PR*)

All data stays on the device (AsyncStorage). No account, network calls, analytics, ads or third-party SDKs. The
microphone is unused in the MVP. A parent can delete a profile entirely. (The OS TTS engine may use cloud voices on some
devices; the report screen says so.)

## 12. Architecture, data, testing, release

### 12.1 Stack

Expo SDK 58, React Native 0.88, TypeScript (strict), `expo-speech`, `expo-audio`, `expo-haptics`, `react-native-svg`,
`@react-native-async-storage/async-storage`, `expo-font` + `@expo-google-fonts/*`, `react-native-safe-area-context`.
State is a tiny external store (`useSyncExternalStore`), navigation a stack in that store (no Expo Router: the app has
few screens and state-driven flows). Web via `react-native-web`. Unit tests: Node's built-in test runner on the pure
engine (`node --test`, native TS). E2E: Playwright on the web export with Microsoft Edge and a fake speech engine.

### 12.2 Folder layout

```
App.tsx                      entry: fonts, store hydrate, router
src/engine/                  PURE TypeScript (no React/RN imports) — node-testable
  hebrew.ts                  Unicode parsing → units, sound classes, speakable forms, NFC, nikud lint
  content/                   words.ts (340 picture words), texts.ts (55 sight words, 72 sentences), stories.ts (26),
                             stickers.ts (16 notebooks × 30) — data only
  phrases.ts                 the mascot's name (+ spoken form) and every gendered child-facing line
  curriculum.ts              skills, spine, worlds, game registry metadata (gendered missions)
  gating.ts                  decodable content and practiceable skills
  learner.ts                 attempts → skill states, mastery, review boxes, confusions (MASTERY config)
  planner.ts                 session plan, next unit to teach, free-play spec, remediation rules
  placement.ts               starting check state machine
  generators.ts              one generator per game: (spec, ctx) → items
  economy.ts / report.ts     stars, envelopes, notebooks / parent report model
  validate.ts, *.test.ts     content invariants, unit tests (node --test)
src/services/                speech.ts (TTS + recorded clips + voice pick), clips.ts, sfx.ts (+ haptics)
src/state/store.ts           profiles, settings, persistence, navigation stack
src/ui/                      theme.ts (palette, fonts, scaling, RTL row), kit.tsx (shared components, 👂 HelpButton),
                             Butz.tsx (SVG mascot + game art), LiveSticker.tsx (animated stickers)
src/games/                   GameHost.tsx (round structure §8.1) + mechanics.tsx (all mechanics)
src/screens/                 Home (+Setup), Play (+SessionEnd, Placement), Map (+World), Stickers, Parent (+Gate)
assets/                      app icons + splash (scripts/make-icons.mjs), sfx (scripts/make-sfx.mjs)
store/                       Google Play icon 512×512 and feature graphic 1024×500 (scripts/make-icons.mjs)
scripts/                     make-icons.mjs, make-sfx.mjs, validate-content.ts, serve.mjs, shots.mjs
tests/e2e/                   Playwright specs (web)
eas.json                     EAS Build profiles (preview = APK, production = Play app bundle)
```

### 12.3 Core data contracts

```ts
type SkillId = string;      // 'L.mem' | 'V.a' | 'CV' | 'W1' | 'PA.count' | 'COMP.listen' | …
type UnitId = SkillId;      // units (§3.1) are skills too

interface Word {            // src/engine/content/words.ts
  id: string;               // ascii slug, stable forever (progress refers to it)
  text: string;             // fully pointed, NFC
  syl: string[];            // syllables, join === text (R-H7)
  emoji: string;            // picture
  en: string;               // gloss for agents/parents
  say?: string;             // TTS override (R-H6)
  katan?: true;             // has kamatz katan (R-H5)
  review: 'checked' | 'reviewed';   // R-H9
}
// derived once at load: units: UnitId[], level: 'W1'|'W2'|'W3', firstSound: string

interface Story {
  id: string; title: string; kind: 'listen' | 'read';
  pages: { text: string; scene: string /* emoji scene */ }[];
  questions: { q: string; options: { emoji: string; label: string }[]; answer: number; type: 'who'|'what'|'where'|'why' }[];
  order?: number[];         // page indices used as Story Puzzle cards
  storyWords?: string[];    // words the child may tap to hear (not counted for R-H1)
  review: 'checked' | 'reviewed';
}

interface Profile {         // src/state/store.ts (AsyncStorage key 'butz:v1')
  id: string; name: string; avatar: string; gender: 'boy' | 'girl';
  learner: { skills; recent; placementDone; seen: Record<string, number> /* R-H11 */ };
  wallet: { stars; stickers: Record<notebookId, stickerId[]>; owned: string[]; active: string };
  settings; school: UnitId[]; spine: UnitId[]; audioBad: string[]; sessions;
}

interface ActivitySpec {    // produced by the planner
  game: GameId; skills: SkillId[]; mode: 'demo' | 'guided' | 'independent' | 'review' | 'placement';
  targets?: string[];       // e.g. ['L.mem'] or word ids
  n: number;                // items
}

interface Item {            // produced by generators, consumed by mechanics
  id: string; skill: SkillId; prompt: Prompt; options: Option[]; answer: string | string[];
  // mechanic-specific fields allowed
}
```

### 12.4 Testing and definition of done (R-Q*)

- **R-Q1 Engine unit tests:** parser (units, sound classes, speakable forms), every content invariant (§3) over all
  content, gating, mastery transitions, review scheduling, planner rules (§7), every generator (valid answer present,
  R-H2, R-H4 flags, no unintroduced units), economy (no duplicates, never negative stars).
- **R-Q2 Content validation:** `npm run validate` fails on any R-H violation.
- **R-Q3 E2E (web):** first run → setup → placement → Continue session plays through every MVP game via test hooks →
  stars → envelope → sticker in notebook → parent gate → report → settings; no console errors; phone and tablet sizes.
- **R-Q4 Type check:** `npx tsc --noEmit` clean.
- **Definition of done for a game:** generator + mechanic + registry entry + unit test + e2e coverage + every AC in §9 +
  gendered mission text (spoken on 👂) + works at 360×640 and 1024×768.

### 12.5 Release plan

| Release | Content | Purpose |
|---------|---------|---------|
| **MVP** | Placement, Continue planner, Sound Forest (3 incl. Robot Mixer), Letter Island (2), Nikud Workshop (3), Word Train (3), Final Letter Transformer, Word Collector, Echo Reader, Phrase Train, Story Puzzle, Story Detective (= 17 games), Story Time, 16 gendered sticker notebooks (480 live stickers) + shop, gender-first setup, parent area, voice check, 340 words / 72 sentences / 26 stories | prove the learning loop: letters → צירופים → decoding, with comprehension in parallel |
| **v1** | Sound Twins, Build-a-Letter, First-Sound Market, Nikud Sorter, Missing Sound, Shva Submarine, AHVY Detectives, Long-Word Maze, Story Rehearsal, What Next, Draw What You Read, parent voice recording, recorded audio for all items | full decoding path + retention |
| **v2** | Word Museum morphology (3), Theatre Actors, richer story library, optional on-device speech recognition for read-aloud | fluency + comprehension |
| **v3** | Unpointed Bridge, teacher view, printable practice pages | advanced readers, home-school link |

### 12.6 Success metrics (what to measure in pilots)

1. Independent decoding accuracy on **new** words built from learned units. 2. Transfer across games. 3. Retention at
review. 4. Fluency (self-check + later ASR). 5. Reading comprehension. 6. Listening comprehension. 7. Voluntary return
without streak pressure. Not: minutes in app or games completed.

### 12.7 Self-contained project and Google Play (R-REL)

- Everything lives in the project folder: `npm ci` installs dependencies into `node_modules/` inside it (no links to
  other folders). The folder can be zipped (without `node_modules/`, `dist/`, `test-results/`) and built anywhere.
- `app.json`: `android.package` / `ios.bundleIdentifier` = `com.butz.hebrewreading` (change it **before the first
  upload** if the publishing account wants its own id; it can never change afterwards), `android.versionCode` (+1 for
  every upload), `version`, no microphone permission (`RECORD_AUDIO` blocked).
- Build: `npx eas-cli build -p android --profile production` → `.aab` for Google Play (the `preview` profile builds an
  `.apk` to install directly on a tablet). EAS keeps the signing key.
- Play listing: app icon `store/play-icon-512.png`, feature graphic `store/feature-graphic-1024x500.png`, phone + tablet
  screenshots (`node scripts/shots.mjs`). Target audience 5-8 → **Designed for Families** rules apply: a privacy policy
  URL is required (the app collects nothing; see §11.4), Data safety = "no data collected or shared", no ads.

## 13. Research and curriculum sources


- Israeli Ministry of Education — Grade 1 Hebrew reading and writing framework:
  <https://meyda.education.gov.il/files/Pop/0files/ivrit_hinuch_leshoni/Yesodi/horaa.pdf>
- RAMA — recommendations for language foundations: <https://rama.gov.il/advice/lang-basics-4>
- Shechter & Share — *Learning to Read and Developmental Dyslexia in Hebrew*: <https://doi.org/10.1002/rrq.599>
- Share & Bar-On — *The Triplex Model of Hebrew Reading Development*: <https://doi.org/10.1177/0022219417718198>
- Ministry of Education — reading instruction for students with intellectual disabilities and/or complex communication
  needs (individualized supports; not a dyslexia curriculum):
  <https://meyda.education.gov.il/files/Special/Disabilities/intellectual-disabilities/teaching-reading-complex.pdf>

## 14. Glossary

| Term | Meaning |
|------|---------|
| נִקּוּד nikud | vowel signs (and dagesh/dots) written around letters |
| צֵרוּף tsiruf | a consonant + vowel unit, e.g. מָ — the core unit of early reading |
| דָּגֵשׁ dagesh | dot inside a letter; in ב/כ/פ it changes the sound (בּ /b/ vs ב /v/) |
| שְׁוָא shva | two vertical dots; silent or a short /e/ depending on context |
| אוֹתִיּוֹת סוֹפִיּוֹת | final letter forms ך ם ן ף ץ |
| אֶהֱוִ"י | the letters א ה ו י, which can be quiet or mark vowels |
| unit | a symbol type the child must know to read an item (§3.1) |
| skill | something tracked for mastery; every unit is a skill, plus higher skills (CV, W1, FLU…) |
| spine | the ordered list of skills to introduce (§5.1) |
| speakable form | the TTS string that makes a voice say a צירוף correctly (§3.3) |
