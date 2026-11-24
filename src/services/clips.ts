/* Recorded audio that overrides TTS (SPEC R-H6, R-T4). Key = the exact spoken text (NFC), value = require('…mp3').
   GENERATED comes from scripts/make-audio.ts (neural Hebrew voice for every spoken line, docs/AUDIO.md). Hand recordings
   go in MANUAL and win over generated ones, e.g. [nfc('מָה')]: require('../../assets/audio/manual/cv-mem-a.mp3'). */
import { GENERATED } from './clips.generated';

const MANUAL: Record<string, number> = {};

export const CLIPS: Record<string, number> = { ...GENERATED, ...MANUAL };
