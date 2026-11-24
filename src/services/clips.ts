/* Recorded audio that overrides TTS (SPEC R-H6, R-T4). Key = the exact spoken text (NFC), value = require('…mp3').
   Add a recording: put the file in assets/audio/ and add a line here, e.g. [nfc('מָה')]: require('../../assets/audio/cv-mem-a.mp3'). */
export const CLIPS: Record<string, number> = {};
