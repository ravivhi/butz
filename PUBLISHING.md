# Publishing "קוֹרְאִים עִם בּוּץ" (Reading with Butz) on Google Play — instructions for the agent

You (the AI agent) are helping the account owner publish a finished Hebrew reading app for children aged 5-8. The app
is complete and tested. Your job is to **build it, test it on a real device, and publish it on Google Play**. Do not
redesign or rewrite the app. Follow the steps in order and stop at every **ASK THE OWNER** point.

The project is in `Butz_Hebrew_Reading_2026-11-27.zip` (this file is also in the zip as `PUBLISHING.md`). Unzip it; the
project is the folder `butz-hebrew-reading/`.

**Just want to try it?** Install Node.js 24+, unzip, then in `butz-hebrew-reading/` run `npm ci` and
`npx expo start --web` (opens in the browser; Microsoft Edge has the best Hebrew voice), or `npx expo start` and scan the
QR code with the **Expo Go** app on a phone or tablet (same Wi-Fi). Everything below is for publishing on Google Play.

## 0. What you are publishing

- Expo SDK 58 / React Native 0.88 / TypeScript app. No server, no account, no ads, no purchases, no analytics. It
  works offline and stores everything on the device.
- Android package id: `com.raviv.butz` (chosen by the owner).
- **How the Android app is made (owner's decision, 26 Nov 2026):** like the owner's other apps (alfi, ehadi,
  englishQuiz, guessingGame), the Android app is a **Trusted Web Activity** made with Bubblewrap (`android-twa/`). It
  opens the web version at https://ravivh.com/butz/ full screen in Chrome. The web version is an installable, offline
  web app (`public/manifest.json`, a service worker made by `scripts/make-sw.mjs`). So **every push to `main` updates
  the app on all phones** (on the next launch with internet); a new Play upload is needed only when `android-twa/`
  itself changes (icon, name, colors, Android version). Expo is used only for the web build (`expo export -p web`);
  EAS Build and `eas.json` are not used.
- Content (27 Nov 2026): 8 games (קְפִיצַת הֲבָרוֹת, בָּלוֹנֵי אוֹתִיּוֹת, זוּגוֹת שֶׁל אוֹתִיּוֹת, כּוֹתְבִים אוֹתִיּוֹת, הָאוֹת הַחֲסֵרָה,
  מַאֲפִיַּת הַמִּלִּים, בַּלַּשׁ הַסִּפּוּרִים, פָּאזֶל הַסִּפּוּר), listed on the map in learning order and all open; 528 picture words,
  55 sight words, 72 sentences and 146 stories; hidden difficulty levels that follow the child; letters written in
  print, then cursive.
- Speech: recorded clips first (generated once with Microsoft's official Azure neural Hebrew voice, see §2b and
  `docs/AUDIO.md`; **the zip has no clips yet**), otherwise the device's text-to-speech engine. On Android that is
  **Speech Services by Google** with the **Hebrew** voice installed. The app is **quiet by default**: instructions are
  written on the screen, and it speaks only when the child taps 🔊 (the sound or word), 💡 (a hint) or 👂 (explain).
- The mascot's name is **בּוּץ with shuruk ("Butz")**, never בּוֹץ ("botz" = mud). The app already speaks it as
  `בּוּטְס` so TTS says "Butz". Keep the nikud in every store text.
- Store assets in `store/`: `play-icon-512.png`, `feature-graphic-1024x500.png`, and `screenshots/` (8 phone at
  1080×1920 and 8 tablet at 2048×1536). The screenshots are from 24 Nov, before the map and several games changed:
  regenerate them before the store listing (`npm run build:web`, `node scripts/serve.mjs dist 8099`, then
  `node scripts/shots.mjs`; see `AGENTS.md`).
- Developer docs: `AGENTS.md` (commands, rules) and `docs/SPEC.md` (full spec). Read `AGENTS.md` before changing
  anything.

## 1. What you need

| Need | Notes |
|------|-------|
| Node.js 24 LTS or newer, with npm | Tested with Node 26. Check with `node --version`. |
| JDK 17 + Android SDK, and Bubblewrap | `npm i -g @bubblewrap/cli`. Bubblewrap's config (`~/.bubblewrap/config.json`) points at the JDK and SDK. |
| The upload key | `~/signing-keys/butz/android.keystore` (alias `butz`) + `signing-secrets.txt`. Never in git; back it up. |
| A Google Play Console developer account | One-time US$25 fee, with identity verification done. |
| An Android phone or tablet for testing | Install "Speech Services by Google" and download the Hebrew voice (Settings → Text-to-speech). |
| A public web page for the privacy policy | Google Sites, GitHub Pages, Notion, or any public URL works (see §6). |

**ASK THE OWNER** before you start:

1. **Package id.** Decided: `com.raviv.butz`. It must be unique on
   Google Play and **can never change after the first upload**.
2. **Account type.** Is the Play developer account **personal** or **organization**, and when was it created? (§8)
3. **Contact email** to show in the store listing and the privacy policy.
4. **Countries.** Israel only, or worldwide?

## 2. Install and verify (local)

```bash
# unzip to a short path without spaces, e.g. C:\dev\butz or ~/dev/butz
cd butz-hebrew-reading
npm ci                 # installs node_modules inside the project (~1 minute)
npm run check          # content validation + 59 unit tests + TypeScript; all must pass
```

Optional: `npm run e2e` runs the 20 end-to-end tests (10 scenarios, phone and tablet). It needs Microsoft Edge installed
(Playwright uses the `msedge` channel). All checks passed on the zipped version (27 Nov 2026).

If you changed the package id, edit `app.json` → `expo.android.package` (and `expo.ios.bundleIdentifier` to match).
Change nothing else in `app.json` unless a step below says so.

## 2b. Correct pronunciation: generate the voice clips (strongly recommended before the store build)

Device voices often mispronounce short pointed Hebrew. The project includes a generator that renders **every line the
app can say** (about 2,800) with Microsoft's official Azure AI Speech neural Hebrew voice; the clips are bundled into the
app and played instead of the device voice. **ASK THE OWNER** for an Azure Speech key + region (free tier F0 is enough;
how to create one: `docs/AUDIO.md`). Never print or commit the key. Then:

```bash
# PowerShell: $env:AZURE_SPEECH_KEY='...'; $env:AZURE_SPEECH_REGION='westeurope'
npm run audio          # 1.5-2.5 hours on the free tier (waits and retries by itself); rerun = only missing lines
npm run check
```

Open `test-results/audio-review.html` and let the owner listen to a sample (letters, צירופים, the name בּוּץ = "Butz").
If the owner has no key, the app still works with the device voice.

## 3. Quick look (optional)

- Browser: `npx expo start --web`. Microsoft Edge has the best Hebrew voice.
- Phone: `npx expo start`, then scan the QR code with **Expo Go**. Expo Go must support SDK 58. On a strict network,
  use `npx expo start --tunnel`.

## 4. Build the Android app (TWA)

From **PowerShell** (passwords come from `~/signing-keys/butz/signing-secrets.txt`; never print them):

```powershell
$s = @{}; Get-Content "$HOME\signing-keys\butz\signing-secrets.txt" | ? { $_ -match '=' } | % { $i = $_.IndexOf('='); $s[$_.Substring(0,$i).Trim()] = $_.Substring($i+1).Trim() }
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $s.KEYSTORE_PASSWORD; $env:BUBBLEWRAP_KEY_PASSWORD = $s.KEY_PASSWORD
Remove-Item Env:NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue   # else "'gradlew.bat' is not recognized"
cd android-twa
bubblewrap build --skipPwaValidation
```

It writes `android-twa/app-release-signed.apk` (install on a phone) and `android-twa/app-release-bundle.aab` (upload
to Play), both signed with the butz upload key (SHA-256 `F7:EB:1B:45:…:4C:FE:BB`). They are git-ignored.

- **Never run `bubblewrap update`**: it regenerates the project from Bubblewrap's template and resets
  `targetSdkVersion` to 35 (Play needs 36).
- If you edit `android-twa/twa-manifest.json`, keep the copies in `android-twa/app/build.gradle` in sync and write its
  SHA-1 into `manifest-checksum.txt` (no newline), or Bubblewrap asks to regenerate the project.
- **Digital Asset Links:** `https://ravivh.com/.well-known/assetlinks.json` (repo `ravivhi/ravivhi.github.io`) lists
  `com.raviv.butz` with the upload key's SHA-256. After the first Play upload, **add the Play app-signing key's
  SHA-256** (Play Console → Test and release → App integrity) to the same entry. Without it, the app installed from
  Play shows a browser address bar.
- Images (launcher, adaptive icon, splash, `store_icon.png`) come from `node scripts/make-icons.mjs`.

## 5. Test build on a real device

Copy `android-twa/app-release-signed.apk` to the Android device and install it (allow installing from this source).
Open it once **with internet** (the first load downloads the app; after that it works offline). Then go through this
checklist and report the results to the owner:

- [ ] No address bar at the top (if there is one, the assetlinks fingerprint does not match the key that signed the APK).
- [ ] Airplane mode, then reopen the app: it still works.

- [ ] The first screen asks **בֵּן / בַּת** (boy/girl), then name and animal friend, then a short starting game.
- [ ] Nothing is read aloud by itself — not when a screen opens, not during games. Instructions are written on the
      screen; 🔊 plays the sound or word, 💡 gives a hint, 👂 explains.
- [ ] Hebrew speech works when 🔊 is tapped. If it is silent, install the Google Hebrew voice (§1).
- [ ] Map: all 8 games are listed in learning order and every one opens, even for a beginner. **כּוֹתְבִים אוֹתִיּוֹת**:
      write a letter with a finger from the red dot along the grey path, first in print, then in cursive.
      **בָּלוֹנֵי אוֹתִיּוֹת**: the letter is shown in print, the balloons are in cursive.
- [ ] Stories (בַּלַּשׁ הַסִּפּוּרִים, פָּאזֶל הַסִּפּוּר): the whole story is one page, and every question can go back to it.
- [ ] There is no grown-ups area (removed by the owner, 27 Nov 2026): no ⚙️ on Home, no settings.
- [ ] Tapping buttons makes no sound; games still sound right/wrong answers, and getting stickers or a notebook sounds.
- [ ] The phone's back button goes one screen back, and closes the app only from Home.
- [ ] Play one full session from "מַמְשִׁיכִים!", open the sticker notebooks and the shop (envelopes and notebooks start at
      5 ⭐). Stickers animate and jump when tapped.

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
• ההקראה נעשית מהקלטות שנמצאות בתוך האפליקציה, ואם אין הקלטה — באמצעות מנוע הדיבור (TTS) של מערכת ההפעלה. ייתכן שספק מערכת ההפעלה (למשל Google) מעבד את הטקסט המוקרא לפי מדיניות הפרטיות שלו.
• ניקוי נתוני האתר ravivh.com ב־Chrome מוחק את כל המידע.
לשאלות: <EMAIL>

Privacy Policy — Reading with Butz (קוראים עם בּוּץ)
Last updated: <DATE>

"Reading with Butz" teaches children to read Hebrew. We do not collect, transmit or share any personal information.
• The optional name, avatar and learning progress are stored only on the device and are never sent to any server.
• The app has no ads, no in-app purchases, no user accounts, no tracking and no analytics.
• The app does not use the microphone, camera or location.
• Speech comes from recordings bundled in the app, or else from the device's built-in text-to-speech engine; the
  operating-system provider (e.g. Google) may process the spoken text under its own privacy policy.
• Clearing the site data of ravivh.com in Chrome deletes all data.
Contact: <EMAIL>
```

## 7. Production build

`android-twa/app-release-bundle.aab` from §4. Upload it by hand in the Play Console. Choose **Use Google-generated
key** (Play App Signing); then add that key's SHA-256 to assetlinks (§4).

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
| App access | All functionality is available without special access. There is no login, no settings area and nothing locked. |
| Content rating | Fill the IARC questionnaire. Category **Reference, News, or Educational**. Answer **No** to violence, sexuality, language, controlled substances, gambling, user interaction / chat, sharing location, and digital purchases. |
| Target audience and content | Age groups **5 and under** and **6-8**. The app is **designed for children** → Google Play **Families policy** applies. The app meets it: no ads, no data collection, no third-party SDKs. |
| Data safety | Does the app collect or share user data? **No**. Data that stays on the device does not count as collected. No account creation, so no account-deletion URL is needed. |
| Advertising ID | **No**, the app does not use the advertising ID (the TWA requests no such permission) |
| Government app, financial features, health, news | **No** |

### 8.3 Store listing (Grow → Store presence → Main store listing)
- **App name (≤ 30):** `קוֹרְאִים עִם בּוּץ`
- **Short description (≤ 80):** `משחקי קריאה בעברית מנוקדת לילדים בני 5–8: מהצלילים והאותיות ועד סיפורים.`
- **Full description:**

```
בּוּץ הַיַּנְשׁוּף מְלַמֵּד לִקְרֹא! 🦉📖

"קוראים עם בּוּץ" לוקחת ילדים בני 5–8 צעד אחר צעד: מצלילים והברות, דרך האותיות והניקוד, ועד קריאת מילים, משפטים וסיפורים — בקצב של כל ילד וילדה.

● 8 משחקים: קפיצת הברות, בלוני אותיות, זוגות של אותיות, כותבים אותיות, האות החסרה, מאפיית המילים, בלש הסיפורים ופאזל הסיפור
● כותבים את האותיות עם האצבע — קודם בדפוס ואחר כך בכתב יד, לפי סדר הקווים והכיוון הנכון
● מעל 500 מילים עם תמונות, 72 משפטים ו־146 סיפורים, מסיפורים קצרים ועד סיפורים ארוכים לקוראים מתקדמים — וכמעט אין חזרות, כי האפליקציה זוכרת מה כבר נלמד
● מתאימה את עצמה: בדיקת פתיחה משחקית, רמת קושי שעולה ויורדת לפי ההצלחה, ותרגול חכם של מה שצריך — וכל המשחקים פתוחים
● הילד/ה משחקים לבד, בשקט: ההוראות כתובות על המסך, ובלחיצה על 🔊 שומעים את הצליל או המילה
● פונה לבנים ולבנות בלשון המתאימה
● מחברות מדבקות חיות ומונפשות שמרוויחים במשחק — בלי לחץ ובלי להפסיד כלום

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

1. Make the change. Run `npm run check` and `npm run e2e`. If content changed, rerun `npm run audio` (only new lines).
2. Push to `main`. GitHub Actions rebuilds https://ravivh.com/butz/ and **phones get the new version on the next
   launch** (the service worker checks the network first for the page). No Play upload, no review.
3. Only when `android-twa/` changes: raise `versionCode`/`versionName` in `android-twa/app/build.gradle` **and**
   `appVersionCode`/`appVersionName` in `android-twa/twa-manifest.json` (+ the checksum), rebuild (§4), upload the `.aab`.

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
| Web build fails | Run `npx expo-doctor` and `npx expo install --check`, then fix what they report (SDK-compatible versions only). |
| The Android app shows an address bar | The SHA-256 of the signing key is missing from ravivh.com/.well-known/assetlinks.json (after a Play install: the Play app-signing key). |
| No speech on the device | Speech plays only when 🔊 / 👂 is tapped (by design). Lines without a generated clip need the Hebrew voice in Google's text-to-speech settings; turn up media volume. |
| A word or sound is pronounced wrongly | Generate the clips (§2b). If a clip itself is wrong, fix the line's text/`say` or add a manual recording (`docs/AUDIO.md`). |
| Play rejects the package name | Pick a new unique `android.package` before the **first** upload, then rebuild. |
| Play says the version code was already used | Increase the version code in `android-twa/` (§9) and rebuild. |
| Play asks about the AD_ID permission | Answer that the app does not use the advertising ID. |
| iOS wanted too | iPhone/iPad users can open https://ravivh.com/butz/ in Safari → Share → Add to Home Screen (works offline). |
