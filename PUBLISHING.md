# Publishing "קוֹרְאִים עִם בּוּץ" (Reading with Butz) on Google Play — instructions for the agent

You (the AI agent) are helping the account owner publish a finished Hebrew reading app for children aged 5-8. The app
is complete and tested. Your job is to **build it, test it on a real device, and publish it on Google Play**. Do not
redesign or rewrite the app. Follow the steps in order and stop at every **ASK THE OWNER** point.

The project is in `Butz_Hebrew_Reading_v1.0.0.zip` (this file is also in the zip as `PUBLISHING.md`).

## 0. What you are publishing

- Expo SDK 58 / React Native 0.88 / TypeScript app. No server, no account, no ads, no purchases, no analytics. It
  works offline and stores everything on the device.
- Android package id: `com.raviv.butz` (chosen by the owner). Version: `1.0.0`, `versionCode` 1, both in `app.json`.
- Speech comes from the device's text-to-speech engine. On Android that is **Speech Services by Google** with the
  **Hebrew** voice installed.
- The mascot's name is **בּוּץ with shuruk ("Butz")**, never בּוֹץ ("botz" = mud). The app already speaks it as
  `בּוּטְס` so TTS says "Butz". Keep the nikud in every store text.
- Store assets are ready in `store/`: `play-icon-512.png`, `feature-graphic-1024x500.png`, and `screenshots/`
  (8 phone at 1080×1920 and 8 tablet at 2048×1536).
- Developer docs: `AGENTS.md` (commands, rules) and `docs/SPEC.md` (full spec). Read `AGENTS.md` before changing
  anything.

## 1. What you need

| Need | Notes |
|------|-------|
| Node.js 24 LTS or newer, with npm | Tested with Node 26. Check with `node --version`. |
| A free Expo account | https://expo.dev/signup. EAS Build compiles in the cloud, so no Android Studio is needed. |
| A Google Play Console developer account | One-time US$25 fee, with identity verification done. |
| An Android phone or tablet for testing | Install "Speech Services by Google" and download the Hebrew voice (Settings → Text-to-speech). |
| A public web page for the privacy policy | Google Sites, GitHub Pages, Notion, or any public URL works (see §6). |

**ASK THE OWNER** before you start:

1. **Package id.** Keep `com.butz.hebrewreading`, or use their own (e.g. `com.<theirname>.butz`)? It must be unique on
   Google Play and **can never change after the first upload**.
2. **Account type.** Is the Play developer account **personal** or **organization**, and when was it created? (§8)
3. **Contact email** to show in the store listing and the privacy policy.
4. **Countries.** Israel only, or worldwide?

## 2. Install and verify (local)

```bash
# unzip to a short path without spaces, e.g. C:\dev\butz or ~/dev/butz
cd butz-hebrew-reading
npm ci                 # installs node_modules inside the project (~1 minute)
npm run check          # content validation + 39 unit tests + TypeScript; all must pass
```

Optional: `npm run e2e` runs the 12 end-to-end tests. It needs Microsoft Edge installed (Playwright uses the
`msedge` channel).

If you changed the package id, edit `app.json` → `expo.android.package` (and `expo.ios.bundleIdentifier` to match).
Change nothing else in `app.json` unless a step below says so.

## 3. Quick look (optional)

- Browser: `npx expo start --web`. Microsoft Edge has the best Hebrew voice.
- Phone: `npx expo start`, then scan the QR code with **Expo Go**. Expo Go must support SDK 58. On a strict network,
  use `npx expo start --tunnel`.

## 4. Connect to Expo (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest init        # creates the EAS project; writes extra.eas.projectId (and owner) into app.json
```

`eas.json` is already set up: `preview` builds an installable **APK**, and `production` builds a Play **app bundle
(.aab)**. `appVersionSource` is `local`, so the version numbers in `app.json` are the source of truth. When EAS asks
to generate a new Android keystore, answer **yes**. EAS stores the signing key; do not lose access to this Expo
account.

## 5. Test build on a real device

```bash
npx eas-cli@latest build -p android --profile preview
```

When the build finishes, open the link on the Android device and install the APK. Then go through this checklist and
report the results to the owner:

- [ ] The first screen asks **בֵּן / בַּת** (boy/girl), then name and animal friend, then a short starting game.
- [ ] Nothing is read aloud automatically when a screen opens. The 👂 button speaks the instructions.
- [ ] Hebrew speech works. If it is silent, install the Google Hebrew voice (§1).
- [ ] Grown-ups area (⚙️ on Home): press and hold the lock button 3 seconds, then answer the addition question. Go
      to **בדיקת קול** (voice check) and press ▶ next to the name. It must sound like **"Butz"** (u as in "put"), not
      "botz". If it sounds wrong, tell the owner; a recorded clip can be added (`src/services/clips.ts`).
- [ ] Play one full session from "מַמְשִׁיכִים!", open the sticker notebooks and the shop. Stickers animate and jump
      when tapped.

## 6. Privacy policy (required for a children's app)

Publish the text below at a public URL. Replace `<EMAIL>` and `<DATE>`. Hebrew first, then English, on the same page
is fine.

```
מדיניות פרטיות — קוראים עם בּוּץ
עדכון אחרון: <DATE>

האפליקציה "קוראים עם בּוּץ" נועדה ללמד ילדים לקרוא עברית. איננו אוספים, שולחים או משתפים מידע אישי כלשהו.
• השם (לא חובה), הדמות וההתקדמות בלמידה נשמרים רק במכשיר עצמו ולא נשלחים לשום שרת.
• אין באפליקציה פרסומות, רכישות, חשבונות משתמש, מעקב או כלי ניתוח (אנליטיקה).
• האפליקציה אינה משתמשת במיקרופון, במצלמה או במיקום.
• ההקראה נעשית באמצעות מנוע הדיבור (TTS) של מערכת ההפעלה. ייתכן שספק מערכת ההפעלה (למשל Google) מעבד את הטקסט המוקרא לפי מדיניות הפרטיות שלו.
• מחיקת האפליקציה או מחיקת פרופיל באזור ההורים מוחקת את כל המידע.
לשאלות: <EMAIL>

Privacy Policy — Reading with Butz (קוראים עם בּוּץ)
Last updated: <DATE>

"Reading with Butz" teaches children to read Hebrew. We do not collect, transmit or share any personal information.
• The optional name, avatar and learning progress are stored only on the device and are never sent to any server.
• The app has no ads, no in-app purchases, no user accounts, no tracking and no analytics.
• The app does not use the microphone, camera or location.
• Speech is produced by the device's built-in text-to-speech engine; the operating-system provider (e.g. Google) may
  process the spoken text under its own privacy policy.
• Uninstalling the app, or deleting a profile in the grown-ups area, deletes all data.
Contact: <EMAIL>
```

## 7. Production build

```bash
npx eas-cli@latest build -p android --profile production     # produces the .aab
```

Download the `.aab` from the build page. The **first upload must be done by hand** in the Play Console. Later updates
can use `npx eas-cli@latest submit -p android`, but that needs a Google service-account key, so manual upload is fine.

## 8. Google Play Console

### 8.1 Create the app
Play Console → **Create app**:
- App name: `קוֹרְאִים עִם בּוּץ`
- Default language: **Hebrew – iw-IL**
- App or game: **App**. Free.
- Accept the declarations.

### 8.2 App content (Policy → App content) — exact answers
| Section | Answer |
|---------|--------|
| Privacy policy | The URL from §6 |
| Ads | **No**, the app has no ads |
| App access | All functionality is available without special access. Optional note for reviewers: "Grown-ups area: tap ⚙️, press and hold the lock button for 3 seconds, then answer the addition question." |
| Content rating | Fill the IARC questionnaire. Category **Reference, News, or Educational**. Answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction / chat, sharing location, and digital purchases. |
| Target audience and content | Age groups **5 and under** and **6-8**. The app is **designed for children** → Google Play **Families policy** applies. The app meets it: no ads, no data collection, no third-party SDKs. |
| Data safety | Does the app collect or share user data? **No**. Data that stays on the device does not count as collected. No account creation, so no account-deletion URL is needed. |
| Advertising ID | **No**, the app does not use the advertising ID (the permission is blocked in `app.json`) |
| Government app, financial features, health, news | **No** |

### 8.3 Store listing (Grow → Store presence → Main store listing)
- **App name (≤ 30):** `קוֹרְאִים עִם בּוּץ`
- **Short description (≤ 80):** `משחקי קריאה בעברית מנוקדת לילדים בני 5–8: מהצלילים והאותיות ועד סיפורים.`
- **Full description:**

```
בּוּץ הַיַּנְשׁוּף מְלַמֵּד לִקְרֹא! 🦉📖

"קוראים עם בּוּץ" לוקחת ילדים בני 5–8 צעד אחר צעד: מצלילים והברות, דרך האותיות והניקוד, ועד קריאת מילים, משפטים וסיפורים — בקצב של כל ילד וילדה.

● 18 משחקים קצרים ומשמחים: מגדלור הצלילים, מגנט הניקוד, רכבת ההברות, מאפיית המילים, בלש הסיפורים ועוד
● מעל 340 מילים עם תמונות, 72 משפטים ו־26 סיפורים — וכמעט אין חזרות, כי האפליקציה זוכרת מה כבר נלמד
● מתאימה את עצמה: בדיקת פתיחה משחקית, תרגול חכם של מה שצריך, וחזרות כדי שהידע יישאר
● הילד/ה משחקים לבד: מסך פשוט עם כפתור אחד גדול, ובלחיצה על 👂 בּוּץ מסביר כל דבר
● פונה לבנים ולבנות בלשון המתאימה
● מחברות מדבקות חיות ומונפשות שמרוויחים בהתמדה — בלי לחץ ובלי להפסיד כלום
● אזור הורים: התקדמות לפי תחומים, הגדרות נגישות, ניגודיות גבוהה, פחות תנועה ובחירת מה שכבר נלמד בבית הספר

בלי פרסומות, בלי רכישות, בלי חשבון ובלי איסוף מידע. הכול נשמר רק במכשיר ועובד גם בלי אינטרנט.

לשמיעת ההקראה צריך קול עברי במכשיר: הגדרות ← טקסט לדיבור ← Google ← התקנת עברית.
```

- **Graphics:** app icon `store/play-icon-512.png`, feature graphic `store/feature-graphic-1024x500.png`, phone
  screenshots `store/screenshots/phone-*.png`, 7" and 10" tablet screenshots `store/screenshots/tablet-*.png`.
- **Category:** Education. Tags: kids, reading, Hebrew. **Contact email:** from §1.
- Optional: an English listing (*Reading with Butz — Hebrew reading games for kids 5-8*) translated from the above.

### 8.4 Testing tracks, then production
1. **Internal testing:** create a release, upload the `.aab`, add the owner's email as a tester, and install from the
   opt-in link. Re-run the §5 checklist.
2. **New personal developer accounts** (created after 13 Nov 2023) must run a **closed test with at least 12 testers
   who stay opted in for 14 days in a row** before Google allows production. **ASK THE OWNER** for 12+ tester Gmail
   addresses (friends and family are fine), create a **Closed testing** track, and wait the 14 days. Then apply for
   production access in the Dashboard. Organization accounts skip this step.
3. **Production:** create the release with the same `.aab` (or a newer one), choose countries (§1), and send it for
   review. Reviews of apps for children often take several days.

## 9. Updates later

1. Make the change. Run `npm run check` (and `npm run e2e` if Edge is available).
2. In `app.json`, increase `expo.android.versionCode` by 1 (**required for every upload**) and update `expo.version`
   (e.g. `1.0.1`).
3. `npx eas-cli@latest build -p android --profile production`, then upload to Play (or use `eas submit`).

## 10. Do not change without the owner

- Children's privacy: no ads, analytics, crash reporters, login, cloud sync or third-party SDKs. Any of these changes
  the Data safety answers and may break the Families policy.
- The Hebrew content and its nikud. `npm run validate` checks it; follow `AGENTS.md`.
- The mascot name בּוּץ and its spoken form (`src/engine/phrases.ts`).
- The microphone stays unused (`RECORD_AUDIO` is blocked).

## 11. Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm ci` fails | Use Node 24+. Delete `node_modules` and retry. Do not switch to `npm install` unless the lock file is the problem. |
| Build fails on EAS | Run `npx expo-doctor` and `npx expo install --check`, then fix what they report (SDK-compatible versions only). |
| No speech on the device | Install the Hebrew voice in Google's text-to-speech settings, and turn up media volume. |
| Play rejects the package name | Pick a new unique `android.package` before the **first** upload, then rebuild. |
| Play says the version code was already used | Increase `versionCode` in `app.json` and rebuild. |
| Play asks about the AD_ID permission | Answer that the app does not use the advertising ID (it is blocked in `app.json`). |
| iOS wanted too | Needs an Apple Developer account (US$99/year): `npx eas-cli@latest build -p ios --profile production`, then `eas submit -p ios`. Same privacy answers ("Data Not Collected", Kids category 6-8). |
