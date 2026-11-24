/* npm run validate — content invariants + how much becomes decodable along the spine (for tuning the order). */
import { validateContent } from '../src/engine/validate.ts';
import { DEFAULT_SPINE } from '../src/engine/curriculum.ts';
import { WORDS } from '../src/engine/content/words.ts';
import { SENTENCES, SIGHT_WORDS, STORIES } from '../src/engine/content/texts.ts';
import { canRead, storyCoverage } from '../src/engine/gating.ts';

const errors = validateContent();
const known = new Set<string>();
const rows: string[] = [];
for (const u of DEFAULT_SPINE) {
  known.add(u);
  const ws = WORDS.filter((w) => canRead(w.units, known));
  const by = (lv: string) => ws.filter((w) => w.level === lv).length;
  const sents = SENTENCES.filter((s) => canRead(s.units, known)).length;
  const sight = SIGHT_WORDS.filter((s) => canRead(s.units, known)).length;
  const stories = STORIES.filter((s) => s.kind === 'read' && storyCoverage(s, known) >= 0.9).length;
  rows.push(`${u.padEnd(14)} words ${String(ws.length).padStart(3)} (W1 ${by('W1')}, W2 ${by('W2')}, W3 ${by('W3')})  sight ${sight}  sentences ${sents}  read-stories ${stories}`);
}
console.log('Decodable content along the default spine:\n' + rows.join('\n'));
const never = WORDS.filter((w) => !canRead(w.units, known));
if (never.length) console.log(`\nNever decodable with the full spine: ${never.map((w) => w.id).join(', ')}`);
console.log(`\n${WORDS.length} words, ${SIGHT_WORDS.length} sight words, ${SENTENCES.length} sentences, ${STORIES.length} stories`);
if (errors.length) {
  console.error(`\n${errors.length} content problem(s):\n- ` + errors.join('\n- '));
  process.exit(1);
}
console.log('\nContent OK');
