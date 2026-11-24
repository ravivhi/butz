/* Game mechanics (SPEC §8.3): reusable interaction engines. Each renders one item and reports right/wrong to GameHost.
   `auto` = the parent's read-aloud setting; when off (default) a mechanic speaks only in answer to a tap on a speaking control. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Item, Option } from '../engine/generators';
import { speakSyllable } from '../engine/generators';
import { LETTERS, analyzeWord, cvText, textWords } from '../engine/hebrew';
import { canRead, type Known } from '../engine/gating';
import { pointsPath, type Pt } from '../engine/strokes';
import { Big, Card, ListenButton, Tile, Txt, type TileState } from '../ui/kit';
import { Door, Lighthouse } from '../ui/Butz';
import { FONT, ROW, useLayout, usePalette, useSettings } from '../ui/theme';
import { RATE, say } from '../services/speech';
import { sfx } from '../services/sfx';
import { useProfile } from '../state/store';
import { SAY, g } from '../engine/phrases';

export interface HostItem extends Item { pages?: boolean; unscored?: boolean; listen?: boolean }
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

/** Which wrong options are hidden by help level 1 / easy mode (deterministic per item). */
function hiddenWrong(it: Item, help: number, easy: boolean, chosen: Set<string>): Set<string> {
  const wrongs = it.options.filter((o) => !isRight(it, o.id) && !chosen.has(o.id));
  const n = (help >= 1 ? 1 : 0) + (easy && it.options.length >= 3 ? 1 : 0);
  return new Set(wrongs.slice(0, Math.min(n, Math.max(0, wrongs.length - 1))).map((o) => o.id));
}

function Options({ it, help, easy, highlight, onPick, solved, size, wrongIds, selected }: {
  it: Item; help: number; easy: boolean; highlight: string | null; onPick: (o: Option) => void; solved: string | null; size: number; wrongIds: Set<string>; selected?: string | null;
}) {
  const { s } = useLayout();
  const hidden = hiddenWrong(it, help, easy, wrongIds);
  return (
    <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(14), paddingHorizontal: s(8) }}>
      {it.options.map((o) => {
        let st: TileState = 'idle';
        if (solved) st = solved === o.id ? 'right' : 'dim';
        else if (wrongIds.has(o.id)) st = 'wrong';
        else if (hidden.has(o.id)) st = 'off';
        else if (help >= 2 && isRight(it, o.id)) st = 'hint';
        else if (highlight === o.id || selected === o.id) st = 'selected';
        return <Tile key={o.id} testID={'opt-' + o.id} text={o.text} emoji={o.emoji} font={o.font ?? 'read'} color={o.color} state={st} size={size} label={o.label} onPress={() => onPick(o)} />;
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ choose (listen/read and pick) */

function Train({ parts, speakable, lit }: { parts: string[]; speakable: boolean; lit: boolean }) {
  const pal = usePalette();
  const { s, t } = useLayout();
  return (
    <View style={{ flexDirection: ROW, alignItems: 'flex-end', justifyContent: 'center', gap: s(6) }} testID="train">
      <Text style={{ fontSize: s(64), transform: [{ scaleX: -1 }] }}>🚂</Text>
      {parts.map((p, i) => (
        <Pressable key={i} disabled={!speakable} onPress={() => say(speakSyllable(p), { rate: RATE.stimulus })} testID={'car-' + i}
          style={{ minWidth: s(78), height: s(70), borderRadius: s(14), backgroundColor: lit ? pal.green : [pal.red, pal.blue, pal.purple, pal.teal][i % 4], borderWidth: s(3), borderColor: pal.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(8) }}>
          <Text style={{ fontFamily: FONT.read, fontSize: t(34), color: '#FFFFFF', writingDirection: 'rtl' }}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Choose(p: MechProps) {
  const it = p.item;
  const { s, short } = useLayout();
  const pal = usePalette();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setSolved(null); setWrongIds(new Set()); setSelected(null); }, [it.id]);
  const password = it.game === 'secretPassword';

  const pick = (o: Option) => {
    if (solved) return;
    if (password) { setSelected(o.id); if (o.say) say(o.say, { rate: RATE.stimulus }); return; }
    decide(o.id);
  };
  const decide = (id: string) => {
    if (isRight(it, id)) { setSolved(id); p.onRight(); }
    else { setWrongIds((w) => new Set(w).add(id)); setSelected(null); p.onWrong(id); }
  };

  const k = it.options.length;
  const size = Math.min(150, Math.max(84, (short / s(1)) * (k > 3 ? 0.22 : 0.27)));
  const head = (() => {
    switch (it.game) {
      case 'soundLighthouse':
        return <Pressable onPress={p.replay} testID="replay-visual"><Lighthouse size={s(150)} lit={!!solved} /></Pressable>;
      case 'secretPassword':
        return (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Door size={s(190)} open={!!solved} />
            <View style={{ position: 'absolute', top: s(40), backgroundColor: '#FFF6E5', borderRadius: s(16), borderWidth: s(3), borderColor: pal.line, paddingHorizontal: s(16) }}>
              <Txt font="read" size={56}>{solved ? '🦄' : it.show?.text}</Txt>
            </View>
          </View>
        );
      case 'syllableTrain':
        return <Train parts={it.show!.parts!} speakable={!!it.supported || p.help >= 1} lit={!!solved} />;
      case 'wordExplorer':
        return (
          <Card color="#FFF1C9" style={{ alignItems: 'center', minWidth: s(220) }}>
            <Text style={{ fontSize: s(30) }}>🗺️</Text>
            <Txt font="read" size={60}>{it.show?.text}</Txt>
          </Card>
        );
      case 'soundSafari':
        return <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(84) }}>{it.show?.emoji}</Text></Card></Pressable>;
      case 'robotMixer':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(100) }}>🤖</Text></Pressable>;
      case 'syllableDJ':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(96) }}>🎧</Text></Pressable>;
      case 'wordCollector':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(90) }}>🏛️</Text></Pressable>;
      default:
        return (
          <Pressable onPress={p.replay} testID="replay-visual">
            <Card style={{ maxWidth: s(520) }}><Txt font="read" size={28}>{'🔊 ' + (it.say?.[0] ?? '')}</Txt></Card>
          </Pressable>
        );
    }
  })();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      {head}
      <Options it={it} help={p.help} easy={p.easy} highlight={p.highlight} onPick={pick} solved={solved} size={size} wrongIds={wrongIds} selected={selected} />
      {password && !solved ? <Big label="פּוֹתְחִים!" emoji="🚪" color={pal.green} disabled={!selected} onPress={() => selected && decide(selected)} testID="open-door" /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ find and tap */

export function FindTap(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, w } = useLayout();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  const foundRef = useRef<Set<string>>(new Set());
  useEffect(() => { foundRef.current = new Set(); setFound(new Set()); setBad(null); }, [it.id]);
  const cols = it.options.length > 9 ? 4 : 3;
  const cell = Math.min(s(96), (w - s(40)) / cols - s(10));
  const tap = (o: Option) => {
    if (foundRef.current.has(o.id)) return;
    if (it.targets!.includes(o.id)) {
      const f = new Set(foundRef.current).add(o.id);
      foundRef.current = f;
      setFound(f);
      sfx('tap');
      if (f.size === it.targets!.length) p.onRight();
    } else {
      setBad(o.id);
      setTimeout(() => setBad(null), 500);
      p.onWrong(letterIdByChar(o.text ?? ''));
    }
  };
  const glow = p.help >= 2 ? it.targets!.filter((t) => !found.has(t)) : p.help === 1 ? it.targets!.filter((t) => !found.has(t)).slice(0, 1) : [];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
        <Text style={{ fontSize: s(54) }}>🔍</Text>
        <Card style={{ paddingVertical: s(2), paddingHorizontal: s(22) }}><Txt font="read" size={64}>{it.show?.letter}</Txt></Card>
        <Txt size={22} font="uiHeavy" color={pal.soft}>{`${found.size}/${it.targets!.length}`}</Txt>
      </Pressable>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', width: cols * (cell + s(10)), justifyContent: 'center', gap: s(10) }}>
        {it.options.map((o) => (
          <Tile key={o.id} testID={'cell-' + o.id} text={o.text} size={cell / s(1)} state={found.has(o.id) ? 'right' : bad === o.id ? 'wrong' : glow.includes(o.id) ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ build: nikud magnet, word bakery, final letters */

export function Magnet(p: MechProps) {
  const it = p.item;
  const { s } = useLayout();
  const pal = usePalette();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSolved(null); setWrongIds(new Set()); }, [it.id]);
  const [, L] = it.id.split(':');
  const pick = (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); p.onRight(); }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual" style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: s(44) }}>🧲</Text>
        <Card color={solved ? '#E9FBEF' : undefined} style={{ minWidth: s(170), alignItems: 'center' }}>
          <Txt font="read" size={96} color={solved ? pal.green : pal.ink}>{solved ? cvText(L, solved) : it.show?.letter}</Txt>
          {!solved ? <Txt size={28} color={pal.soft}>◌</Txt> : null}
        </Card>
      </Pressable>
      <Options it={it} help={p.help} easy={p.easy} highlight={p.highlight} onPick={pick} solved={solved} size={104} wrongIds={wrongIds} />
    </View>
  );
}

export function Bakery(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t } = useLayout();
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
      else sfx('tap');
      if (np.length === seq.length) setTimeout(() => p.onRight(), 350);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      p.onWrong(o.text, (it.word?.syl ?? []).map(speakSyllable));
    }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(74) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, gap: s(6), alignItems: 'center' }} testID="tray">
        <Text style={{ fontSize: s(40) }}>🧁</Text>
        {seq.map((_, i) => (
          <View key={i} style={{ minWidth: s(80), height: s(70), borderRadius: s(14), borderWidth: s(3), borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: pal.line, backgroundColor: placed[i] ? '#FFD7A8' : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(6) }}>
            <Text style={{ fontFamily: FONT.read, fontSize: t(32), color: pal.ink }}>{placed[i]?.text ?? ''}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(12) }}>
        {it.options.map((o) => (
          <Tile key={o.id} testID={'blk-' + o.id} text={o.text} size={92} state={used.has(o.id) ? 'off' : bounce === o.id ? 'wrong' : p.help >= 2 && o.text === expected.text && !used.has(o.id) ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

export function FinalGap(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t, landscape } = useLayout();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSolved(null); setWrongIds(new Set()); }, [it.id]);
  const pick = (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); p.onRight(); }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  const fill = solved ? it.options.find((o) => o.id === solved)?.text : '';
  const piece = (x: string | undefined) => (x ? <Text style={{ fontFamily: FONT.read, fontSize: t(56), color: pal.ink }}>{x}</Text> : null);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      {/* picture and word side by side on a landscape tablet, stacked on a phone */}
      <View style={{ flexDirection: landscape ? ROW : 'column', alignItems: 'center', gap: s(16) }}>
        <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
          <Text style={{ fontSize: s(44) }}>{it.game === 'missingLetter' ? '❓' : '🦾'}</Text>
          <Text style={{ fontSize: s(64) }}>{it.show?.emoji}</Text>
        </Pressable>
        <Card style={{ flexDirection: ROW, alignItems: 'center', paddingHorizontal: s(22) }}>
          {piece(it.show?.before)}
          <View testID="gap" style={{ minWidth: s(54), height: s(76), marginHorizontal: s(2), borderRadius: s(10), borderWidth: s(3), borderStyle: solved ? 'solid' : 'dashed', borderColor: solved ? pal.green : pal.line, alignItems: 'center', justifyContent: 'center', backgroundColor: solved ? '#E9FBEF' : 'transparent' }}>
            {piece(fill || ' ')}
          </View>
          {piece(it.show?.after)}
        </Card>
      </View>
      <Options it={it} help={p.help} easy={false} highlight={null} onPick={pick} solved={solved} size={landscape ? 92 : 104} wrongIds={wrongIds} />
    </View>
  );
}

/* ------------------------------------------------------------------ count: syllable hop */

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
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(80) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: s(8), minHeight: s(110), backgroundColor: '#BDE7FF', borderRadius: s(30), padding: s(12), borderWidth: s(3), borderColor: pal.line }} testID="pond">
        <Text style={{ fontSize: s(44), opacity: frog < 0 ? 1 : 0.25 }}>🐸</Text>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: s(40), opacity: frog === i ? 1 : 0 }}>🐸</Text>
            <View style={{ width: s(62), height: s(30), borderRadius: s(20), backgroundColor: p.help >= 2 ? pal.yellow : '#7CB342', borderWidth: s(3), borderColor: pal.line }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, gap: s(14) }}>
        <Big emoji="🪨" label="+" color={pal.teal} size="m" onPress={() => !busy && setN((x) => Math.min(5, x + 1))} testID="stone-add" />
        <Big emoji="↩️" color={pal.soft} size="m" onPress={() => !busy && setN((x) => Math.max(0, x - 1))} testID="stone-remove" />
        <Big emoji="🐸" label="קְפֹץ!" color={pal.green} size="m" disabled={n === 0 || busy} onPress={jump} testID="jump" />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ sequence: story puzzle */

export function Sequence(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s } = useLayout();
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
  const tap = (o: Option) => {
    const cur = placedRef.current;
    if (cur.includes(o.id) || cur.length >= seq.length) return;
    if (o.id === seq[cur.length]) {
      const np = [...cur, o.id];
      placedRef.current = np;
      setPlaced(np);
      sfx('tap');
      if (np.length === seq.length) setTimeout(() => p.onRight(), 300);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      const exp = it.options.find((x) => x.id === seq[placedRef.current.length]);
      p.onWrong(o.id, exp?.say ? [exp.say] : undefined);
    }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Txt size={26} font="uiHeavy">🧩</Txt>
      <View style={{ flexDirection: ROW, gap: s(8) }} testID="slots">
        {seq.map((id, i) => (
          <View key={i} style={{ width: s(84), height: s(84), borderRadius: s(16), borderWidth: s(3), borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: pal.line, alignItems: 'center', justifyContent: 'center', backgroundColor: placed[i] ? '#E9FBEF' : 'transparent' }}>
            {placed[i] ? <Text style={{ fontSize: s(36) }}>{it.options.find((o) => o.id === placed[i])?.emoji}</Text> : <Txt size={28} color={pal.soft}>{String(i + 1)}</Txt>}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(12) }}>
        {pool.map((o) => (
          <Tile key={o.id} testID={'card-' + o.id} emoji={o.emoji} size={100} wide state={placed.includes(o.id) ? 'off' : bounce === o.id ? 'wrong' : p.help >= 2 && o.id === expected ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ read along: echo reader, phrase train */

export function ReadAlong(p: MechProps) {
  const it = p.item;
  const sent = it.sentence!;
  const pal = usePalette();
  const { s, t } = useLayout();
  const echo = it.game === 'echoReader';
  const [phase, setPhase] = useState<'read' | 'check' | 'listen' | 'echo'>('read');
  const [lit, setLit] = useState<number>(-1);
  const [hl, setHl] = useState<number>(-1);
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const alive = useRef(true);
  const gender = useProfile()?.gender;
  useEffect(() => { alive.current = true; setPhase('read'); setLit(-1); setHl(-1); setSolved(null); setWrongIds(new Set());
    return () => { alive.current = false; }; }, [it.id, echo]);

  const listen = async () => {
    setPhase('listen');
    for (let i = 0; i < sent.phrases.length && alive.current; i++) { setHl(i); await say(sent.phrases[i], { rate: RATE.stimulus }); }
    if (!alive.current) return;
    setHl(-1);
    if (echo || !p.auto) { setPhase('echo'); if (echo && p.auto) say(g(SAY.echoTurn, gender)); } else setTimeout(() => alive.current && p.onNext(), 600);
  };
  const pick = async (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) {
      setSolved(o.id);
      await p.onRight({ stay: true, quiet: true });
      // read-aloud model only with autoSpeak; otherwise the child taps 🔊 to hear the sentence
      if (alive.current) { if (p.auto) listen(); else setPhase('echo'); }
    }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  const tapCar = (i: number) => {
    if (phase !== 'read' || i !== lit + 1) return;
    sfx('tap');
    setLit(i);
    if (i === sent.phrases.length - 1) setTimeout(() => setPhase('check'), 300);
  };
  const sentenceView = echo ? (
    <Card style={{ maxWidth: '94%' }}>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(10) }}>
        {sent.phrases.map((ph, i) => <Text key={i} style={{ fontFamily: FONT.read, fontSize: t(44), color: hl === i ? pal.orange : pal.ink, writingDirection: 'rtl' }}>{ph}</Text>)}
      </View>
    </Card>
  ) : (
    <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(8), alignItems: 'flex-end' }}>
      <Text style={{ fontSize: s(50), transform: [{ scaleX: -1 }] }}>🚂</Text>
      {sent.phrases.map((ph, i) => (
        <Pressable key={i} onPress={() => tapCar(i)} testID={'phrase-' + i}
          style={{ borderRadius: s(14), borderWidth: s(3), borderColor: hl === i ? pal.orange : pal.line, backgroundColor: i <= lit || phase !== 'read' ? '#FFE7B8' : pal.card, paddingHorizontal: s(14), paddingVertical: s(6) }}>
          <Text style={{ fontFamily: FONT.read, fontSize: t(38), color: pal.ink, writingDirection: 'rtl' }}>{ph}</Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Text style={{ fontSize: s(54) }}>{echo ? '🦜' : '🚃'}</Text>
      {sentenceView}
      {phase === 'read' && echo ? <Big label="קָרָאתִי!" emoji="📖" color={pal.blue} onPress={() => setPhase('check')} testID="read-done" /> : null}
      {phase === 'check' || solved ? <Options it={it} help={p.help} easy={p.easy} highlight={null} onPick={pick} solved={solved} size={110} wrongIds={wrongIds} /> : null}
      {phase === 'echo' ? (
        <View style={{ flexDirection: ROW, gap: s(14), alignItems: 'center' }}>
          <ListenButton onPress={listen} testID="echo-again" size={64} attention={!p.auto} />
          <Big emoji="👍" label="קָרָאתִי!" color={pal.green} size="m" onPress={p.onNext} testID="echo-done" />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ story pages */

export function StoryPages(p: MechProps) {
  const story = p.item.story!;
  const pal = usePalette();
  const { s, t } = useLayout();
  const reduced = useSettings().reducedMotion;
  const [i, setI] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const alive = useRef(true);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const page = story.pages[i];
  const read = async () => {
    setSpeaking(true);
    await say(page.text, { rate: RATE.talk });
    if (!alive.current) return;
    setSpeaking(false);
  };
  useEffect(() => {
    if (!reduced) { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: false }).start(); }
    if (p.item.listen && p.auto) read().then(() => { if (alive.current && p.item.listen) setTimeout(() => alive.current && nextPage(), 900); });
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextPage = () => {
    sfx('page');
    setI((x) => {
      if (x + 1 >= story.pages.length) { setTimeout(p.onNext, 0); return x; }
      return x + 1;
    });
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Txt font="read" size={26} color={pal.soft}>{story.title}</Txt>
      <Animated.View style={{ opacity: fade, alignItems: 'center', width: '92%' }}>
        <Card style={{ alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: s(92) }} testID="scene">{page.scene}</Text>
          {p.item.listen ? (
            <Txt font="read" size={30} color={speaking ? pal.blue : pal.ink}>{page.text}</Txt>
          ) : (
            <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', columnGap: s(10) }}>
              {page.text.split(' ').map((tok, j) => {
                const clean = textWords(tok)[0] ?? '';
                const easy = !clean || canRead(analyzeWord(clean).units, p.known);
                return (
                  <Pressable key={j} disabled={easy} onPress={() => say(clean, { rate: RATE.stimulus })} testID={easy ? undefined : 'storyword-' + j}>
                    <Text style={{ fontFamily: FONT.read, fontSize: t(38), color: pal.ink, textDecorationLine: easy ? 'none' : 'underline', textDecorationStyle: 'dotted', writingDirection: 'rtl' }}>{tok}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>
      </Animated.View>
      <View style={{ flexDirection: ROW, gap: s(14), alignItems: 'center' }}>
        {p.item.listen ? <ListenButton key={'page-' + i} onPress={read} testID="page-again" size={64} attention={!p.auto} /> : null}
        <Txt size={20} font="uiHeavy" color={pal.soft}>{`${i + 1}/${story.pages.length}`}</Txt>
        <Big emoji="⬅️" color={pal.green} size="m" onPress={nextPage} testID="page-next" />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ balloons: pop the target letter */

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
  return (
    <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-s(6), s(6)] }) }, { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }, { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }}>
      <Pressable testID={'cell-' + o.id} accessibilityRole="button" accessibilityLabel={o.text} disabled={state === 'popped'} onPress={onPress}
        style={{ width: size, height: size * 1.18, borderRadius: size / 2, backgroundColor: o.color ?? pal.red, borderWidth: s(state === 'hint' ? 6 : 3), borderColor: state === 'hint' ? pal.glow : pal.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FONT.read, fontSize: size * 0.42 * textScale, color: '#FFFFFF', writingDirection: 'rtl' }}>{o.text}</Text>
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
  const cols = 4;
  const size = Math.min(s(96), (w - s(40)) / cols - s(16), (h * 0.42) / Math.ceil(it.options.length / cols) - s(30));
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
        <Card style={{ paddingVertical: 0, paddingHorizontal: s(20) }}><Txt font="read" size={46}>{it.show?.letter}</Txt></Card>
        <Txt size={22} font="uiHeavy" color={pal.soft}>{`${found.size}/${it.targets!.length}`}</Txt>
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
  const cols = n > 6 ? 4 : 3;
  const rows = Math.ceil(n / cols);
  const cell = Math.min(s(130), (w - s(40)) / cols - s(12), (h * 0.62) / rows - s(14));
  const pairOf = (id: string) => id.slice(2);
  const tap = (o: Option) => {
    if (busy.current || matchedRef.current.has(o.id) || openRef.current.includes(o.id)) return;
    sfx('tap');
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
              {up ? (o.text ? <Text style={{ fontFamily: FONT.read, fontSize: cell * 0.48 * textScale, color: pal.ink, writingDirection: 'rtl' }}>{o.text}</Text> : <Text style={{ fontSize: cell * 0.55 }}>{o.emoji}</Text>)
                : <Text style={{ fontSize: cell * 0.4 }}>⭐</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ trace: writing letters (SPEC G-07) */

const BOARD = 300;
const NEAR = 36; // board units: how close the finger must come to the next checkpoint
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** Dragging on the web must not select text around the board. */
const NO_SELECT = { userSelect: 'none' } as object;

export function Trace(p: MechProps) {
  const it = p.item;
  const tr = it.trace!;
  const pal = usePalette();
  const { s, w, h, landscape } = useLayout();
  const reduced = useSettings().reducedMotion;
  const size = Math.max(s(200), landscape ? Math.min(h - s(190), w * 0.55, s(560)) : Math.min(w - s(40), h - s(300), s(560)));
  const [pos, setPos] = useState({ stroke: 0, idx: 0 });
  const [demo, setDemo] = useState<Pt | null>(null);
  const cur = useRef({ stroke: 0, idx: 0, done: false });
  const grant = useRef<Pt>({ x: 0, y: 0 });
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const props = useRef(p);
  props.current = p;
  const scale = useRef(BOARD / size);
  scale.current = BOARD / size;
  const guide = p.help >= 1 ? 'full' : tr.guide;

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
  const at = (g: PanResponderGestureState): Pt => ({ x: (grant.current.x + g.dx) * scale.current, y: (grant.current.y + g.dy) * scale.current });
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
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e: GestureResponderEvent, g) => {
      stopDemo();
      grant.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
      advance(at(g));
    },
    onPanResponderMove: (_e, g) => advance(at(g)),
  }), [it.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => { stopDemo(); cur.current = { stroke: 0, idx: 0, done: false }; setPos({ stroke: 0, idx: 0 }); };
  const done = cur.current.done;
  const ink = pal.blue;
  const start = !done ? tr.points[pos.stroke]?.[0] : undefined;
  const partial = !done && pos.idx >= 2 ? pointsPath(tr.points[pos.stroke].slice(0, pos.idx)) : '';
  return (
    <View style={[{ flex: 1, flexDirection: landscape ? ROW : 'column', alignItems: 'center', justifyContent: 'space-evenly' }, NO_SELECT]}>
      <View style={{ flexDirection: landscape ? 'column' : ROW, alignItems: 'center', gap: s(12) }}>
        <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
          <Text style={{ fontSize: s(36) }}>✍️</Text>
          <Card style={{ paddingVertical: 0, paddingHorizontal: s(18) }}><Txt font="read" size={48}>{it.show?.letter}</Txt></Card>
        </Pressable>
        <View style={{ flexDirection: ROW, gap: s(10) }}>
          <Big emoji="👀" color={pal.purple} size="s" onPress={showMe} testID="trace-show" />
          <Big emoji="↩️" color={pal.soft} size="s" onPress={restart} testID="trace-restart" />
        </View>
      </View>
      <View {...pan.panHandlers} testID="trace-board"
        style={{ width: size, height: size, borderRadius: s(24), borderWidth: s(3), borderColor: done ? pal.good : pal.line, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
        <View pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${BOARD} ${BOARD}`}>
          <Rect x={0} y={0} width={BOARD} height={BOARD} fill="#FFFFFF" />
          <Line x1={14} y1={43} x2={286} y2={43} stroke="#C9D3E6" strokeWidth={2} strokeDasharray="8 8" />
          <Line x1={14} y1={257} x2={286} y2={257} stroke="#C9D3E6" strokeWidth={2} strokeDasharray="8 8" />
          {tr.strokes.map((d, k) => (
            <Path key={'g' + k} d={d} fill="none" strokeLinecap="round" strokeLinejoin="round"
              stroke={guide === 'dots' ? '#8D9BB8' : guide === 'ghost' ? '#E8ECF4' : '#D9DFEC'} strokeWidth={guide === 'dots' ? 9 : 26} strokeDasharray={guide === 'dots' ? '0.1 17' : undefined} />
          ))}
          {tr.strokes.map((d, k) => (k < pos.stroke || done ? <Path key={'d' + k} d={d} fill="none" stroke={ink} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" /> : null))}
          {partial ? <Path d={partial} fill="none" stroke={ink} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" /> : null}
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
  if (it.pages) return <StoryPages {...p} />;
  switch (it.game) {
    case 'letterDetective': return <FindTap {...p} />;
    case 'balloonPop': return <Balloons {...p} />;
    case 'memoryMatch': return <Memory {...p} />;
    case 'letterTrace': return <Trace {...p} />;
    case 'nikudMagnet': return <Magnet {...p} />;
    case 'wordBakery': return <Bakery {...p} />;
    case 'finalTransformer': case 'missingLetter': return <FinalGap {...p} />;
    case 'syllableHop': return <Hop {...p} />;
    case 'echoReader': case 'phraseTrain': return <ReadAlong {...p} />;
    default: return it.sequence ? <Sequence {...p} /> : <Choose {...p} />;
  }
}
