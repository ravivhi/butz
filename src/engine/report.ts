/* Parent report model (SPEC §11.2 R-PA4): learning observations per strand, not a diagnosis. */
import { LETTER, LETTERS, VOWELS } from './hebrew.ts';
import { SKILLS, STRANDS, type Strand } from './curriculum.ts';
import { accuracy, band, confusions, dayKey, DAY, type Band, type Learner } from './learner.ts';

export interface StrandRow { id: Strand; label: string; band: Band; needsPractice: boolean; mastered: number; started: number }
export interface Report {
  strands: StrandRow[];
  letters: { id: string; char: string; band: Band }[];
  vowels: { id: string; name: string; band: Band }[];
  confusions: { a: string; b: string; count: number }[];
  days: { day: string; items: number; ok: number }[];
  totalItems: number;
}

export function buildReport(l: Learner, now: number): Report {
  const strands = STRANDS.map(({ id, label }) => {
    const skills = SKILLS.filter((s) => s.strand === id).map((s) => l.skills[s.id]).filter((s) => s && s.att.length);
    const mastered = skills.filter((s) => s!.status === 'mastered').length;
    const accs = skills.map((s) => accuracy(s) ?? 0);
    const avg = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
    const b: Band = !skills.length ? 'notStarted' : mastered / skills.length >= 0.7 ? 'strong' : avg >= 0.6 ? 'developing' : 'practising';
    return { id, label, band: b, needsPractice: skills.some((s) => band(s).needsPractice), mastered, started: skills.length };
  });
  const letters = LETTERS.map((x) => ({ id: x.id, char: x.char, band: band(l.skills['L.' + x.id]).band }));
  const vowels = VOWELS.map((v) => ({ id: v.id, name: v.name, band: band(l.skills['V.' + v.id]).band }));
  const conf = confusions(l, 60, 2)
    .filter((c) => c.skill.startsWith('L.') && LETTER[c.other])
    .map((c) => ({ a: LETTER[c.skill.slice(2)].char, b: LETTER[c.other].char, count: c.count }));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(now - (6 - i) * DAY);
    const xs = l.recent.filter((a) => dayKey(a.t) === day);
    return { day, items: xs.length, ok: xs.filter((a) => a.ok).length };
  });
  return { strands, letters, vowels, confusions: conf, days, totalItems: l.recent.length };
}
