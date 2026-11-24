# Audio: correct Hebrew pronunciation for every spoken line

The app can speak about 2,800 different lines: letter sounds, צירופים, syllables, words, sentences, stories, instructions
and Butz's lines. **Device voices guess**: on short pointed strings they often ignore the nikud and read a common word
(זָה → "ze", כָּה → "ko", פָּה → "po"), and their quality depends on the phone. v1.2 adds two fixes:

1. **Now, without anything to install:** TTS-safe spellings for the risky syllables (SPEC §3.3) and the best Hebrew voice
   on the device. This is better, but still a device voice.
2. **The real fix: a recorded clip for every line,** generated once with Microsoft's official Azure AI Speech neural
   Hebrew voice (`he-IL-AvriNeural`, or `he-IL-HilaNeural`). The app then plays these clips and never guesses. Neural
   Azure voices read pointed Hebrew correctly. The clips ship inside the app (offline, no account for the child).

The app never uses unofficial speech services (for example the Edge "read aloud" endpoint); only the official, keyed
Azure API.

## Generate the clips (about 15 minutes of your time, once)

1. **Create a free Speech resource.** In the [Azure portal](https://portal.azure.com) → *Create a resource* → search
   **Speech** → *Create*. Pricing tier **Free F0** (500,000 characters per month; the whole app is about 52,000), any
   region (for example *West Europe*). After it is created open it → **Keys and Endpoint** → copy **KEY 1** and the
   **Location/Region** (e.g. `westeurope`).
2. **Give the key to the script** (it is never printed and never committed). Either set environment variables
   (PowerShell):
   ```powershell
   $env:AZURE_SPEECH_KEY = '<KEY 1>'
   $env:AZURE_SPEECH_REGION = 'westeurope'
   ```
   or create `.secrets/azure-speech.json` in the project folder (the folder is git-ignored):
   ```json
   { "key": "<KEY 1>", "region": "westeurope" }
   ```
3. **Run it** in the project folder:
   ```powershell
   npm run audio            # all lines; safe to stop and rerun, finished files are kept
   npm run audio -- --dry   # only count the lines and characters
   npm run audio -- --limit 50 --voice he-IL-HilaNeural   # try a few lines with the female voice first
   ```
   The free tier allows about 20 requests a minute, so the first full run takes **1.5-2.5 hours** (the script waits and
   retries by itself). A paid S0 tier finishes in minutes and costs about $1 for the whole app.
4. **Listen**: open `test-results/audio-review.html` in a browser and spot-check letters, צירופים and a few stories.
   If a line sounds wrong, either fix its text/`say` in the content, or record it yourself (below).
5. **Check and ship**: `npm run check`, then build as usual (see AGENTS.md → Publishing). The parent area → *בדיקת קול*
   shows "הקלטות באפליקציה: N מתוך M".

What the script writes:

| File | What |
|------|------|
| `assets/audio/<hash>.mp3` | one clip per line (24 kHz mono MP3, about 12-15 MB in total) |
| `src/services/clips.generated.ts` | the map *exact spoken text → clip*; the app plays a clip instead of TTS when the text matches |
| `test-results/audio-review.html` | a page to listen to every clip |

Rerun `npm run audio` after changing or adding content: only new lines are generated (`--prune` deletes clips no longer
used). Changing the voice regenerates everything (the voice is part of the file name).

## Your own recording for one line

Put the file in `assets/audio/manual/` and add it to `MANUAL` in `src/services/clips.ts`:

```ts
import { nfc } from '../engine/hebrew';

const MANUAL: Record<string, number> = {
  [nfc('בּוּץ')]: require('../../assets/audio/manual/butz.mp3'),
};
```

The key must be the exact text the app speaks (see `src/engine/spoken.ts`). Manual recordings win over generated ones.
