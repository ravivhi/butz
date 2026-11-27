/* Game mechanics (SPEC §8.3): reusable interaction engines. Each renders one item and reports right/wrong to GameHost.
   `auto` = the parent's read-aloud setting; when off (default) a mechanic speaks only in answer to a tap on a speaking
   control. v1.3: a story is one scrolling page of text (no pictures), and every question and the Story Puzzle can go
   back to it (📖, or side by side on a wide landscape screen). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Item, Option } from '../engine/generators';
import { speakSyllable } from '../engine/generators';
import { LETTERS, analyzeWord, textWords } from '../engine/hebrew';
import { canRead, type Known } from '../engine/gating';
import { storySentences, type Story } from '../engine/content/stories';
import { pointsPath, type Pt } from '../engine/strokes';
import { Big, Card, Tile, Txt, type TileState } from '../ui/kit';
import { FONT, ROW, useLayout, usePalette, useSettings } from '../ui/theme';
import { RATE, say, stopSpeech } from '../services/speech';
import { sfx } from '../services/sfx';

export interface HostItem extends Item { pages?: boolean; unscored?: boolean }
export interface MechProps {
  item: HostItem;
  help: 0 | 1 | 2;
  easy: boolean;
  highlight: string | null;
  known: Known;
  auto: boolean;
  onRight: (o?: { stay?: boolean; quiet?: boolean }) => Promise<void>;
  onWrong: (choice?: string, lines?: string[]) => void;
  onNext: () => void;
  replay: () => void;
}

const isRight = (it: Item, id: string) => id === it.answer || !!it.accept?.includes(id);
const letterIdByChar = (ch: string) => LETTERS.find((l) => l.char === ch || l.base === ch)?.id ?? ch;

/** Emoji pictures made of several emoji (a sentence picture) get smaller glyphs so the tile stays a tile. */
function picScale(emoji?: string): { emojiScale: number; wide: boolean } {
  const n = emoji ? [...emoji].filter((c) => { const cp = c.codePointAt(0)!; return cp > 0x2000 && c !== '\uFE0F' && c !== '\u200D' && (cp < 0x1F3FB || cp > 0x1F3FF); }).length : 0;
  if (n <= 1) return { emojiScale: 0.5, wide: false };
  return { emojiScale: n === 2 ? 0.36 : n <= 4 ? 0.26 : 0.19, wide: n >= 3 };
}

/** Which wrong options are hidden by help level 1 / easy mode (deterministic per item). */
function hiddenWrong(it: Item, help: number, easy: boolean, chosen: Set<string>): Set<string> {
  const wrongs = it.options.filter((o) => !isRight(it, o.id) && !chosen.has(o.id));
  const n = (help >= 1 ? 1 : 0) + (easy && it.options.length >= 3 ? 1 : 0);
  return new Set(wrongs.slice(0, Math.min(n, Math.max(0, wrongs.length - 1))).map((o) => o.id));
}

function optionState(it: Item, o: Option, help: number, solved: string | null, wrongIds: Set<string>, hidden: Set<string>, highlight?: string | null): TileState {
  if (solved) return solved === o.id ? 'right' : 'dim';
  if (wrongIds.has(o.id)) return 'wrong';
  if (hidden.has(o.id)) return 'off';
  if (help >= 2 && isRight(it, o.id)) return 'hint';
  if (highlight === o.id) return 'selected';
  return 'idle';
}

function Options({ it, help, easy, highlight, onPick, solved, size, wrongIds }: {
  it: Item; help: number; easy: boolean; highlight: string | null; onPick: (o: Option) => void; solved: string | null; size: number; wrongIds: Set<string>;
}) {
  const { s } = useLayout();
  const hidden = hiddenWrong(it, help, easy, wrongIds);
  return (
    <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(14), paddingHorizontal: s(8) }}>
      {it.options.map((o) => (
        <Tile key={o.id} testID={'opt-' + o.id} text={o.text} emoji={o.emoji} font={o.font ?? 'read'} color={o.color} size={size} label={o.label}
          state={optionState(it, o, help, solved, wrongIds, hidden, highlight)} onPress={() => onPick(o)} {...picScale(o.emoji)} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ build: word bakery, missing letter */

export function Bakery(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t, w } = useLayout();
  const [placed, setPlaced] = useState<Option[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  const placedRef = useRef<Option[]>([]);
  useEffect(() => { placedRef.current = []; setPlaced([]); setBounce(null); }, [it.id]);
  const seq = it.sequence!;
  const byId = (id: string) => it.options.find((o) => o.id === id)!;
  const used = new Set(placed.map((o) => o.id));
  const expected = byId(seq[placed.length] ?? seq[0]);
  const tap = (o: Option) => {
    const cur = placedRef.current;
    const want = byId(seq[cur.length] ?? seq[0]);
    if (cur.length >= seq.length || cur.some((x) => x.id === o.id)) return;
    if (o.text === want.text) {
      const np = [...cur, o];
      placedRef.current = np;
      setPlaced(np);
      if (p.auto) say(speakSyllable(o.text!), { rate: RATE.stimulus });
      if (np.length === seq.length) setTimeout(() => p.onRight(), 350);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      p.onWrong(o.text, (it.word?.syl ?? []).map(speakSyllable));
    }
  };
  // long words: narrower tray slots so six syllables still fit on a phone
  const slotW = Math.min(s(80), (w - s(90)) / seq.length - s(6));
  const blk = it.options.length > 8 ? 78 : 92;
  const slotFont = t(seq.length > 5 ? 22 : seq.length > 4 ? 26 : 32);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(74) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(6), alignItems: 'center', maxWidth: w - s(16) }} testID="tray">
        <Text style={{ fontSize: s(40) }}>🧁</Text>
        {seq.map((_, i) => (
          <View key={i} style={{ minWidth: slotW, height: s(70), borderRadius: s(14), borderWidth: s(3), borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: pal.line, backgroundColor: placed[i] ? '#FFD7A8' : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(4) }}>
            <Text style={{ fontFamily: FONT.read, fontSize: slotFont, color: pal.ink }}>{placed[i]?.text ?? ''}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(12), paddingHorizontal: s(8) }}>
        {it.options.map((o) => (
          <Tile key={o.id} testID={'blk-' + o.id} text={o.text} size={blk} state={used.has(o.id) ? 'off' : bounce === o.id ? 'wrong' : p.help >= 2 && o.text === expected.text && !used.has(o.id) ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

/** The Missing Letter (v1.3): a picture word with one or more empty boxes, filled in reading order. */
export function Gaps(p: MechProps) {
  const it = p.item;
  const gaps = it.gaps!;
  const cs = it.show!.clusters!;
  const pal = usePalette();
  const { s, t, landscape } = useLayout();
  const [cur, setCur] = useState(0);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const curRef = useRef(0);
  useEffect(() => { curRef.current = 0; setCur(0); setWrongIds(new Set()); }, [it.id]);
  const done = cur >= gaps.length;
  const gap = gaps[Math.min(cur, gaps.length - 1)];
  const view: Item = { ...it, options: gap.options, answer: gap.answer, accept: undefined };
  const pick = (o: Option) => {
    const c = curRef.current;
    if (c >= gaps.length) return;
    if (o.id === gaps[c].answer) {
      curRef.current = c + 1;
      setCur(c + 1);
      setWrongIds(new Set());
      if (c + 1 >= gaps.length) p.onRight();
    } else {
      setWrongIds((x) => new Set(x).add(o.id));
      p.onWrong(o.id);
    }
  };
  const fs = cs.length > 9 ? 38 : cs.length > 6 ? 46 : 54;
  const at = new Map(gaps.map((x, j) => [x.at, j]));
  const pieces: ReactNode[] = [];
  let run = '';
  const flush = (key: string) => {
    if (run) pieces.push(<Text key={key} style={{ fontFamily: FONT.read, fontSize: t(fs), color: pal.ink }}>{run}</Text>);
    run = '';
  };
  cs.forEach((c, i) => {
    const j = at.get(i);
    if (j === undefined) { run += c; return; }
    flush('t' + i);
    const filled = j < cur, active = j === cur;
    pieces.push(
      <View key={'g' + i} testID={'gap-' + j} style={{ minWidth: s(fs), height: s(fs * 1.4), marginHorizontal: s(2), borderRadius: s(10), borderWidth: s(active ? 4 : 3), borderStyle: filled ? 'solid' : 'dashed',
        borderColor: filled ? pal.green : active ? pal.orange : pal.line, backgroundColor: filled ? '#E9FBEF' : active ? '#FFF1D6' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FONT.read, fontSize: t(fs), color: filled ? pal.green : pal.ink }}>{filled ? c : ' '}</Text>
      </View>,
    );
  });
  flush('end');
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <View style={{ flexDirection: landscape ? ROW : 'column', alignItems: 'center', gap: s(16) }}>
        <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(70) }}>{it.show?.emoji}</Text></Pressable>
        <Card style={{ flexDirection: ROW, alignItems: 'center', paddingHorizontal: s(18) }}>{pieces}</Card>
      </View>
      {done ? <View style={{ height: s(100) }} /> : (
        <Options key={'gap' + cur} it={view} help={p.help} easy={p.easy} highlight={null} onPick={pick} solved={null} size={landscape ? 92 : 100} wrongIds={wrongIds} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ count: syllable hop */

const MAX_STONES = 6;

export function Hop(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s } = useLayout();
  const [n, setN] = useState(0);
  const [frog, setFrog] = useState(-1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setN(0); setFrog(-1); setBusy(false); }, [it.id]);
  useEffect(() => { if (p.help >= 2) setN(it.count!); }, [p.help, it.count]);
  const jump = async () => {
    if (busy || n === 0) return;
    setBusy(true);
    const parts = (it.word?.syl ?? []).map(speakSyllable);
    for (let i = 0; i < n; i++) {
      setFrog(i);
      sfx('tap');
      if (n === it.count && p.auto) await say(parts[i], { rate: RATE.stimulus });
      else await new Promise((r) => setTimeout(r, 380));
    }
    if (n === it.count) await p.onRight({ quiet: true });
    else { setFrog(-1); setBusy(false); p.onWrong(String(n)); }
  };
  const stone = n > 4 ? 50 : 62;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(80) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: s(6), minHeight: s(110), backgroundColor: '#BDE7FF', borderRadius: s(30), padding: s(12), borderWidth: s(3), borderColor: pal.line }} testID="pond">
        <Text style={{ fontSize: s(44), opacity: frog < 0 ? 1 : 0.25 }}>🐸</Text>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: s(40), opacity: frog === i ? 1 : 0 }}>🐸</Text>
            <View style={{ width: s(stone), height: s(30), borderRadius: s(20), backgroundColor: p.help >= 2 ? pal.yellow : '#7CB342', borderWidth: s(3), borderColor: pal.line }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, gap: s(14) }}>
        <Big emoji="🪨" label="+" color={pal.teal} size="m" onPress={() => !busy && setN((x) => Math.min(MAX_STONES, x + 1))} testID="stone-add" />
        <Big emoji="↩️" color={pal.soft} size="m" onPress={() => !busy && setN((x) => Math.max(0, x - 1))} testID="stone-remove" />
        <Big emoji="🐸" label="קְפֹץ!" color={pal.green} size="m" disabled={n === 0 || busy} onPress={jump} testID="jump" />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ stories: one page of text, questions, puzzle */

const storySize = (st: Story, compact = false) => (compact ? (st.level <= 3 ? 26 : 22) : st.level <= 2 ? 30 : st.level <= 4 ? 27 : 24);

/** The whole story, paragraph by paragraph. `onSentence`: tap a sentence (Story Time reads it aloud). `reading`: a tap
    on a word the child cannot decode yet says it (no underline: plain text is easier to read). */
function StoryText({ story, hl = -1, onSentence, reading, known, size }: { story: Story; hl?: number; onSentence?: (i: number) => void; reading: boolean; known: Known; size: number }) {
  const pal = usePalette();
  const { s, t } = useLayout();
  const hard = useMemo(() => {
    const out = new Set<string>();
    if (reading) for (const w of storySentences(story).flatMap((x) => textWords(x))) if (!canRead(analyzeWord(w).units, known)) out.add(w);
    return out;
  }, [story, reading, known]);
  let k = 0;
  return (
    <View style={{ gap: s(12) }}>
      {story.paragraphs.map((para, pi) => (
        <Text key={pi} style={{ fontFamily: FONT.read, fontSize: t(size), lineHeight: t(size) * 1.8, color: pal.ink, writingDirection: 'rtl', textAlign: 'right' }}>
          {para.map((sent) => {
            const i = k++;
            const toks = sent.split(' ');
            return (
              <Text key={i} testID={'sent-' + i} onPress={onSentence ? () => onSentence(i) : undefined} style={hl === i ? { backgroundColor: '#FFE7B8' } : undefined}>
                {reading
                  ? toks.map((tok, j) => {
                    const clean = textWords(tok)[0] ?? '';
                    const tap = !!clean && hard.has(clean);
                    return (
                      <Text key={j} onPress={tap ? () => say(clean, { rate: RATE.stimulus }) : undefined}>
                        {tok + (j < toks.length - 1 ? ' ' : '')}
                      </Text>
                    );
                  })
                  : sent}
                {' '}
              </Text>
            );
          })}
        </Text>
      ))}
    </View>
  );
}

/** A story page: the whole story in one scrolling card, no pictures. The child reads it alone (a tap on a word the child
    cannot decode yet says that word). */
export function StoryRead(p: MechProps) {
  const story = p.item.story!;
  const pal = usePalette();
  const { s } = useLayout();
  const stop = () => stopSpeech();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: s(8) }}>
      <Txt font="read" size={28} color={pal.purple}>{story.title}</Txt>
      <Card style={{ flex: 1, width: '96%', maxWidth: s(780), padding: 0 }}>
        <ScrollView testID="story-scroll" contentContainerStyle={{ padding: s(16) }}>
          <StoryText story={story} reading known={p.known} size={storySize(story)} />
        </ScrollView>
      </Card>
      <View style={{ flexDirection: ROW, gap: s(14), alignItems: 'center' }}>
        <Big label="קָרָאתִי!" emoji="⬅️" color={pal.green} size="m" onPress={() => { stop(); p.onNext(); }} testID="story-done" />
      </View>
    </View>
  );
}

/** Questions and the puzzle keep the story at hand: side by side on a wide landscape screen, otherwise behind 📖.
    The task stays mounted while the story is open, so nothing the child did is lost. */
function WithStory({ story, known, children }: { story: Story; known: Known; children: ReactNode }) {
  const pal = usePalette();
  const { s, w, landscape } = useLayout();
  const [open, setOpen] = useState(false);
  const split = landscape && w >= 900;
  const text = (
    <Card style={{ flex: 1, padding: 0 }}>
      <ScrollView testID="story-again" contentContainerStyle={{ padding: s(14), gap: s(6) }}>
        <Txt font="read" size={22} color={pal.purple}>{story.title}</Txt>
        <StoryText story={story} reading known={known} size={storySize(story, true)} />
      </ScrollView>
    </Card>
  );
  if (split) {
    return (
      <View style={{ flex: 1, flexDirection: ROW, gap: s(12) }}>
        <View style={{ flex: 1 }}>{text}</View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: open ? 'none' : 'flex', gap: s(8) }}>
        <View style={{ flexDirection: ROW, justifyContent: 'flex-start' }}>
          <Big emoji="📖" label="לַסִּפּוּר" color={pal.purple} size="s" onPress={() => setOpen(true)} testID="story-open" />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {open ? (
        <View style={{ flex: 1, gap: s(8), alignItems: 'center' }}>
          {text}
          <Big emoji="➡️" label="חֲזָרָה" color={pal.green} size="m" onPress={() => setOpen(false)} testID="story-close" />
        </View>
      ) : null}
    </View>
  );
}

/** One answer of a story question: a wide card with an optional picture and the answer text. */
function Answer({ o, state, onPress }: { o: Option; state: TileState; onPress: () => void }) {
  const pal = usePalette();
  const { s, t } = useLayout();
  const bg = state === 'right' ? pal.good : state === 'hint' ? '#FFF6D0' : pal.card;
  const border = state === 'right' ? pal.good : state === 'wrong' ? pal.bad : state === 'hint' ? pal.glow : pal.line;
  return (
    <Pressable testID={'opt-' + o.id} accessibilityRole="button" accessibilityLabel={o.label} onPress={onPress} disabled={state === 'off' || state === 'dim'}
      style={{ flexDirection: ROW, alignItems: 'center', gap: s(12), minHeight: s(64), paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(18), borderWidth: s(state === 'hint' ? 5 : 3), borderColor: border, backgroundColor: bg,
        opacity: state === 'off' || state === 'dim' ? pal.dim : 1 }}>
      {o.emoji ? <Text style={{ fontSize: s(34) }}>{o.emoji}</Text> : null}
      <Text style={{ flex: 1, fontFamily: FONT.read, fontSize: t(26), color: state === 'right' ? '#FFFFFF' : pal.ink, writingDirection: 'rtl', textAlign: 'right' }}>{o.label}</Text>
    </Pressable>
  );
}

export function StoryQuestion(p: MechProps) {
  const it = p.item;
  const { s } = useLayout();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSolved(null); setWrongIds(new Set()); }, [it.id]);
  const pick = (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); p.onRight(); }
    else { setWrongIds((w) => new Set(w).add(o.id)); p.onWrong(o.id); }
  };
  const hidden = hiddenWrong(it, p.help, p.easy, wrongIds);
  return (
    <WithStory story={it.story!} known={p.known}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', gap: s(14), paddingBottom: s(70) }}>
        <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ maxWidth: s(640) }}><Txt font="read" size={30}>{'❓ ' + (it.say?.[0] ?? '')}</Txt></Card></Pressable>
        <View style={{ width: '100%', maxWidth: s(560), gap: s(10) }}>
          {it.options.map((o) => <Answer key={o.id} o={o} state={optionState(it, o, p.help, solved, wrongIds, hidden)} onPress={() => pick(o)} />)}
        </View>
      </ScrollView>
    </WithStory>
  );
}

/** Story Puzzle: tap the sentences in the order they happened. */
export function StoryOrder(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t } = useLayout();
  const [placed, setPlaced] = useState<string[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  const pool = useMemo(() => {
    const h = (x: string) => [...x].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const shuffled = [...it.options].sort((a, b) => h(a.id + it.id) - h(b.id + it.id));
    return shuffled.map((o) => o.id).join() === it.sequence!.join() ? shuffled.reverse() : shuffled;
  }, [it.id, it.options, it.sequence]);
  const placedRef = useRef<string[]>([]);
  useEffect(() => { placedRef.current = []; setPlaced([]); setBounce(null); }, [it.id]);
  const seq = it.sequence!;
  const expected = seq[placed.length];
  const textOf = (id: string) => it.options.find((o) => o.id === id)?.text ?? '';
  const tap = (o: Option) => {
    const cur = placedRef.current;
    if (cur.includes(o.id) || cur.length >= seq.length) return;
    if (o.id === seq[cur.length]) {
      const np = [...cur, o.id];
      placedRef.current = np;
      setPlaced(np);
      if (np.length === seq.length) setTimeout(() => p.onRight(), 300);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      const exp = it.options.find((x) => x.id === seq[placedRef.current.length]);
      p.onWrong(o.id, exp?.say ? [exp.say] : undefined);
    }
  };
  const row = { flexDirection: ROW, alignItems: 'center' as const, gap: s(10), minHeight: s(54), paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(14), borderWidth: s(3) };
  const sentence = (x: string, color = pal.ink) => <Text style={{ flex: 1, fontFamily: FONT.read, fontSize: t(22), color, writingDirection: 'rtl', textAlign: 'right' }}>{x}</Text>;
  return (
    <WithStory story={it.story!} known={p.known}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', gap: s(10), paddingBottom: s(70) }}>
        <Txt size={24} font="uiHeavy">🧩</Txt>
        <View style={{ width: '100%', maxWidth: s(680), gap: s(6) }} testID="slots">
          {seq.map((_, i) => (
            <View key={i} style={{ ...row, borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: placed[i] ? pal.good : pal.line, backgroundColor: placed[i] ? '#E9FBEF' : 'transparent' }}>
              <Txt size={22} font="uiHeavy" color={pal.soft}>{String(i + 1)}</Txt>
              {placed[i] ? sentence(textOf(placed[i])) : <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>
        <View style={{ width: '100%', maxWidth: s(680), gap: s(8), marginTop: s(6) }}>
          {pool.filter((o) => !placed.includes(o.id)).map((o) => (
            <Pressable key={o.id} testID={'card-' + o.id} onPress={() => tap(o)}
              style={{ ...row, borderColor: bounce === o.id ? pal.bad : p.help >= 2 && o.id === expected ? pal.glow : pal.line, borderWidth: s(p.help >= 2 && o.id === expected ? 5 : 3), backgroundColor: pal.card }}>
              <Text style={{ fontSize: s(22) }}>📜</Text>
              {sentence(o.text ?? '')}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </WithStory>
  );
}

/* ------------------------------------------------------------------ balloons: pop the letter, written in cursive */

function Balloon({ o, state, size, onPress, i }: { o: Option; state: 'idle' | 'popped' | 'wrong' | 'hint'; size: number; onPress: () => void; i: number }) {
  const pal = usePalette();
  const { s } = useLayout();
  const { reducedMotion: reduced, textScale } = useSettings();
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1100 + (i % 4) * 170, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1100 + (i % 4) * 170, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, i, reduced]);
  useEffect(() => {
    if (state === 'popped') Animated.timing(pop, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    if (state === 'wrong' && !reduced) Animated.sequence([-1, 1, -0.6, 0.6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, useNativeDriver: true }))).start();
  }, [state, pop, shake, reduced]);
  const cursive = o.font === 'cursive';
  const fs = size * (cursive ? 0.68 : 0.42) * textScale;
  return (
    <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-s(6), s(6)] }) }, { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }}>
      <Pressable testID={'cell-' + o.id} accessibilityRole="button" accessibilityLabel={o.text} disabled={state === 'popped'} onPress={onPress}
        style={{ width: size, height: size * 1.18, borderRadius: size / 2, backgroundColor: o.color ?? pal.red, borderWidth: s(state === 'hint' ? 6 : 3), borderColor: state === 'hint' ? pal.glow : pal.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: cursive ? FONT.cursive : FONT.read, fontSize: fs, lineHeight: fs * 1.3, color: '#FFFFFF', writingDirection: 'rtl', textAlign: 'center' }}>{o.text}</Text>
        <View style={{ position: 'absolute', top: size * 0.16, left: size * 0.2, width: size * 0.16, height: size * 0.26, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.45)' }} />
      </Pressable>
      <View style={{ width: s(2), height: s(16), backgroundColor: pal.line }} />
    </Animated.View>
  );
}

export function Balloons(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, w, h } = useLayout();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  const foundRef = useRef<Set<string>>(new Set());
  useEffect(() => { foundRef.current = new Set(); setFound(new Set()); setBad(null); }, [it.id]);
  const cols = it.options.length > 9 ? 5 : 4;
  const size = Math.min(s(96), (w - s(40)) / cols - s(16), (h * 0.46) / Math.ceil(it.options.length / cols) - s(30));
  const tap = (o: Option) => {
    if (foundRef.current.has(o.id)) return;
    if (it.targets!.includes(o.id)) {
      const f = new Set(foundRef.current).add(o.id);
      foundRef.current = f;
      setFound(f);
      sfx('pop');
      if (f.size === it.targets!.length) setTimeout(() => p.onRight({ quiet: true }), 250);
    } else {
      setBad(o.id);
      setTimeout(() => setBad(null), 500);
      p.onWrong(letterIdByChar(o.text ?? ''));
    }
  };
  const glow = p.help >= 2 ? it.targets!.filter((x) => !found.has(x)) : p.help === 1 ? it.targets!.filter((x) => !found.has(x)).slice(0, 1) : [];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
        <Text style={{ fontSize: s(40) }}>🎈</Text>
        <Card style={{ paddingVertical: 0, paddingHorizontal: s(20) }}><Txt font="read" size={50}>{it.show?.letter}</Txt></Card>
        <Txt size={20} font="uiHeavy" color={pal.soft}>{`➜ ✍️  ${found.size}/${it.targets!.length}`}</Txt>
      </Pressable>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', width: cols * (size + s(18)), justifyContent: 'center', columnGap: s(16), rowGap: s(4) }}>
        {it.options.map((o, i) => (
          <Balloon key={o.id} o={o} i={i} size={size} onPress={() => tap(o)} state={found.has(o.id) ? 'popped' : bad === o.id ? 'wrong' : glow.includes(o.id) ? 'hint' : 'idle'} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ memory: letter ↔ picture pairs */

export function Memory(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, w, h } = useLayout();
  const textScale = useSettings().textScale;
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState(false);
  const busy = useRef(false);
  // the truth lives in refs so two quick taps are never lost between renders
  const openRef = useRef<string[]>([]);
  const matchedRef = useRef<Set<string>>(new Set());
  const show = (o: string[], m?: Set<string>) => { openRef.current = o; setOpen(o); if (m) { matchedRef.current = m; setMatched(m); } };
  useEffect(() => { show([], new Set()); busy.current = false; }, [it.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (p.help < 1) return;
    setPeek(true);
    const tm = setTimeout(() => setPeek(false), 1800);
    return () => clearTimeout(tm);
  }, [p.help]);
  const n = it.options.length;
  const cols = n > 9 ? 4 : n > 6 ? 4 : 3;
  const rows = Math.ceil(n / cols);
  const cell = Math.min(s(130), (w - s(40)) / cols - s(12), (h * 0.62) / rows - s(14));
  const pairOf = (id: string) => id.slice(2);
  const tap = (o: Option) => {
    if (busy.current || matchedRef.current.has(o.id) || openRef.current.includes(o.id)) return;
    if (p.auto && o.say) say(o.say, { rate: RATE.stimulus });
    const nx = [...openRef.current, o.id];
    show(nx);
    if (nx.length < 2) return;
    busy.current = true;
    if (pairOf(nx[0]) === pairOf(nx[1])) {
      setTimeout(() => {
        const m = new Set(matchedRef.current).add(nx[0]).add(nx[1]);
        show([], m);
        busy.current = false;
        sfx('twinkle');
        if (m.size === n) p.onRight({ quiet: true });
      }, 450);
    } else {
      setTimeout(() => { show([]); busy.current = false; }, 1100);
    }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Txt size={24} font="uiHeavy" color={pal.soft}>{`🃏 ${matched.size / 2}/${n / 2}`}</Txt>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', width: cols * (cell + s(12)), justifyContent: 'center', gap: s(12) }}>
        {it.options.map((o) => {
          const up = open.includes(o.id) || matched.has(o.id) || peek;
          const done = matched.has(o.id);
          return (
            <Pressable key={o.id} testID={'card-' + o.id} accessibilityRole="button" accessibilityLabel={up ? o.text ?? o.say : 'קלף'} onPress={() => tap(o)} disabled={done}
              style={{ width: cell, height: cell, borderRadius: s(18), borderWidth: s(done ? 5 : 3), borderColor: done ? pal.good : pal.line, backgroundColor: up ? (done ? '#E9FBEF' : pal.card) : pal.purple, alignItems: 'center', justifyContent: 'center',
                shadowColor: pal.line, shadowOffset: { width: 0, height: s(4) }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}>
              {up ? (o.text ? <Text style={{ fontFamily: o.font === 'cursive' ? FONT.cursive : FONT.read, fontSize: cell * (o.font === 'cursive' ? 0.7 : 0.48) * textScale, color: pal.ink, writingDirection: 'rtl' }}>{o.text}</Text> : <Text style={{ fontSize: cell * 0.55 }}>{o.emoji}</Text>)
                : <Text style={{ fontSize: cell * 0.4 }}>⭐</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ trace: writing letters in print and cursive (SPEC G-07) */

const BOARD = 300;
const NEAR = 36; // board units: how close the finger must come to the next checkpoint
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** Dragging on the web must not select text around the board. */
const NO_SELECT = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object;
// The writing board owns every touch on it: without this the browser (phones, the TWA) takes the finger drag as a
// page pan / pull-to-refresh / rubber-band, so the whole screen moved while the child wrote (and the stroke was cut).
const BOARD_TOUCH = { touchAction: 'none', overscrollBehavior: 'contain' } as object;

export function Trace(p: MechProps) {
  const it = p.item;
  const tr = it.trace!;
  const pal = usePalette();
  const { s, w, h, landscape } = useLayout();
  const reduced = useSettings().reducedMotion;
  const size = Math.max(s(200), landscape ? Math.min(h - s(210), w * 0.55, s(560)) : Math.min(w - s(40), h - s(320), s(560)));
  const [pos, setPos] = useState({ stroke: 0, idx: 0 });
  const [demo, setDemo] = useState<Pt | null>(null);
  const cur = useRef({ stroke: 0, idx: 0, done: false });
  const grant = useRef<Pt>({ x: 0, y: 0 });
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const props = useRef(p);
  props.current = p;
  const scale = useRef(BOARD / size);
  const board = useRef<unknown>(null);
  useEffect(() => {
    // older mobile browsers ignore touch-action: also stop the default (scroll) of a move on the board itself
    const el = Platform.OS === 'web' ? (board.current as unknown as HTMLElement | null) : null;
    if (!el?.addEventListener) return;
    const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);
  scale.current = BOARD / size;
  const guide = p.help >= 1 ? 'full' : tr.guide;
  const cursive = tr.script === 'cursive';

  const stopDemo = () => { if (demoTimer.current) clearInterval(demoTimer.current); demoTimer.current = null; setDemo(null); };
  const showMe = () => {
    stopDemo();
    const pts = tr.points[cur.current.stroke] ?? tr.points[0];
    let k = 0;
    demoTimer.current = setInterval(() => {
      if (k >= pts.length) { stopDemo(); return; }
      setDemo(pts[k++]);
    }, 70);
  };
  useEffect(() => {
    cur.current = { stroke: 0, idx: 0, done: false };
    setPos({ stroke: 0, idx: 0 });
    if (tr.guide === 'full' && !reduced) { const tm = setTimeout(showMe, 500); return () => { clearTimeout(tm); stopDemo(); }; }
    return stopDemo;
  }, [it.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Finger position on the 300×300 board: where the touch started inside the board plus how far it moved
  // (scroll-proof on the web, and the same on phones).
  const at = (gs: PanResponderGestureState): Pt => ({ x: (grant.current.x + gs.dx) * scale.current, y: (grant.current.y + gs.dy) * scale.current });
  const advance = (pt: Pt) => {
    const c = cur.current;
    if (c.done) return;
    const pts = tr.points[c.stroke];
    let j = -1;
    // checkpoints are passed in order (that teaches the writing direction); a fast finger may skip a few
    for (let k = c.idx; k < Math.min(pts.length, c.idx + 4); k++) if (dist(pts[k], pt) <= NEAR) j = k;
    if (j < 0) return;
    c.idx = j + 1;
    if (c.idx >= pts.length) {
      sfx('pop');
      if (c.stroke + 1 < tr.points.length) { c.stroke++; c.idx = 0; }
      else { c.done = true; setTimeout(() => props.current.onRight({ quiet: true }), 300); }
    }
    setPos({ stroke: c.stroke, idx: c.done ? tr.points[c.stroke].length : c.idx });
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onShouldBlockNativeResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e: GestureResponderEvent, gs) => {
      stopDemo();
      grant.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
      advance(at(gs));
    },
    onPanResponderMove: (_e, gs) => advance(at(gs)),
  }), [it.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => { stopDemo(); cur.current = { stroke: 0, idx: 0, done: false }; setPos({ stroke: 0, idx: 0 }); };
  const done = cur.current.done;
  const ink = cursive ? pal.purple : pal.blue;
  const start = !done ? tr.points[pos.stroke]?.[0] : undefined;
  const partial = !done && pos.idx >= 2 ? pointsPath(tr.points[pos.stroke].slice(0, pos.idx)) : '';
  const width = cursive ? 16 : 20;
  const xs = tr.points.flat().map((q) => q.x);
  const sampleX = [Math.min(...xs) - 12, Math.max(...xs) + 12];
  return (
    <View style={[{ flex: 1, flexDirection: landscape ? ROW : 'column', alignItems: 'center', justifyContent: 'space-evenly' }, NO_SELECT]}>
      <View style={{ flexDirection: landscape ? 'column' : ROW, alignItems: 'center', gap: s(12) }}>
        <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
          <Card style={{ paddingVertical: 0, paddingHorizontal: s(16), alignItems: 'center' }}>
            {cursive ? (
              // the sample is drawn from the same strokes as the board (the font's cursive differs from the school chart)
              <Svg testID="cursive-sample" width={s(100) * (sampleX[1] - sampleX[0]) / 280} height={s(100)} viewBox={`${sampleX[0]} 10 ${sampleX[1] - sampleX[0]} 280`}>
                {tr.strokes.map((d, k) => <Path key={k} d={d} fill="none" stroke={pal.ink} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />)}
              </Svg>
            ) : <Txt font="read" size={48}>{it.show?.letter}</Txt>}
          </Card>
          <View testID={'script-' + tr.script} style={{ backgroundColor: cursive ? '#EFE6FF' : '#E3F2FD', borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(4) }}>
            <Txt size={20} font="read" color={ink}>{cursive ? '✍️ כְּתָב' : '🔤 דְּפוּס'}</Txt>
          </View>
        </Pressable>
        <View style={{ flexDirection: ROW, gap: s(10) }}>
          <Big emoji="👀" color={pal.purple} size="s" onPress={showMe} testID="trace-show" />
          <Big emoji="↩️" color={pal.soft} size="s" onPress={restart} testID="trace-restart" />
        </View>
      </View>
      <View ref={board as never} {...pan.panHandlers} testID="trace-board"
        style={[BOARD_TOUCH, { width: size, height: size, borderRadius: s(24), borderWidth: s(3), borderColor: done ? pal.good : pal.line, backgroundColor: '#FFFFFF', overflow: 'hidden' }]}>
        <View pointerEvents="none">
          <Svg width={size} height={size} viewBox={`0 0 ${BOARD} ${BOARD}`}>
            <Rect x={0} y={0} width={BOARD} height={BOARD} fill="#FFFFFF" />
            <Line x1={14} y1={tr.lines[0]} x2={286} y2={tr.lines[0]} stroke="#C9D3E6" strokeWidth={2} strokeDasharray="8 8" />
            <Line x1={14} y1={tr.lines[1]} x2={286} y2={tr.lines[1]} stroke={cursive ? '#9FB0D0' : '#C9D3E6'} strokeWidth={cursive ? 3 : 2} strokeDasharray={cursive ? undefined : '8 8'} />
            {tr.strokes.map((d, k) => (
              <Path key={'g' + k} d={d} fill="none" strokeLinecap="round" strokeLinejoin="round"
                stroke={guide === 'dots' ? '#8D9BB8' : guide === 'ghost' ? '#E8ECF4' : '#D9DFEC'} strokeWidth={guide === 'dots' ? 9 : cursive ? 22 : 26} strokeDasharray={guide === 'dots' ? '0.1 17' : undefined} />
            ))}
            {tr.strokes.map((d, k) => (k < pos.stroke || done ? <Path key={'d' + k} d={d} fill="none" stroke={ink} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null))}
            {partial ? <Path d={partial} fill="none" stroke={ink} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null}
            {start && pos.idx === 0 ? (
              <>
                <Circle cx={start.x} cy={start.y} r={17} fill={pal.red} stroke="#FFFFFF" strokeWidth={3} />
                <SvgText x={start.x} y={start.y + 6} fontSize={17} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">{String(pos.stroke + 1)}</SvgText>
              </>
            ) : null}
            {demo ? <Circle cx={demo.x} cy={demo.y} r={14} fill={pal.yellow} stroke={pal.line} strokeWidth={3} /> : null}
          </Svg>
        </View>
      </View>
    </View>
  );
}

export function Mechanic(p: MechProps) {
  const it = p.item;
  if (it.pages) return <StoryRead {...p} />;
  if (it.story && it.sequence) return <StoryOrder {...p} />;
  if (it.story) return <StoryQuestion {...p} />;
  switch (it.game) {
    case 'balloonPop': return <Balloons {...p} />;
    case 'memoryMatch': return <Memory {...p} />;
    case 'letterTrace': return <Trace {...p} />;
    case 'wordBakery': return <Bakery {...p} />;
    case 'missingLetter': return <Gaps {...p} />;
    case 'syllableHop': return <Hop {...p} />;
    default: return null;
  }
}
